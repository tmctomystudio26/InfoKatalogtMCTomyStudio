/**
 * Tanya Fitur — Floating Customer Service AI Assistant UI (v85)
 *
 * Replaces the old idle floating black circle with a purposeful, responsive "Tanya Fitur"
 * Customer Service button & drawer powered by the Manifest AI streaming engine.
 * - Strictly answers feature questions & visitor troubleshooting based on verified facts.
 * - Offers quick-action chips + direct "Buka Manifest AI" shortcut when visitors ask off-topic questions.
 */

import {
  buildFeatureCsGreetingReply,
  buildFeatureCsLocalFallback,
  buildFeatureCsOffTopicReply,
  buildFeatureCsRestrictedReply,
  buildFeatureCsSystemPrompt,
  classifyFeatureCsIntent,
  sanitizeFeatureCsReply,
} from './feature-cs-logic.js?v=85';

function escapeHtml(str = '') {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderSimpleMarkdown(md = '') {
  const escaped = escapeHtml(md);
  const lines = escaped.split('\n');
  const html = [];
  let inList = false;

  const formatInline = (line) =>
    line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      continue;
    }
    const bulletMatch = trimmed.match(/^(?:-|\*|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      if (!inList) {
        html.push('<ul class="fcs-md-list">');
        inList = true;
      }
      html.push(`<li>${formatInline(bulletMatch[1])}</li>`);
    } else {
      if (inList) {
        html.push('</ul>');
        inList = false;
      }
      html.push(`<p>${formatInline(trimmed)}</p>`);
    }
  }
  if (inList) html.push('</ul>');
  return html.join('');
}

const QUICK_PROMPTS = [
  'Ada fitur apa saja di sini?',
  'Cara download video tanpa watermark',
  'Kompres video biar tidak pecah',
  'Cara install aplikasi di HP',
];

export function createFeatureCsController({
  getActiveTab = () => null,
  onOpenFeature = () => {},
  getConfig = () => ({ enabled: true, greeting: '' }),
} = {}) {
  let rootEl = null;
  let isOpen = false;
  let isSending = false;
  let abortCtrl = null;
  let manifestAiModPromise = null;
  let messages = [];

  function ensureGreetingMessage() {
    if (messages.length > 0) return;
    const cfg = getConfig() || {};
    const greeting = String(cfg.greeting || '').trim() || buildFeatureCsGreetingReply();
    messages.push({
      role: 'assistant',
      content: greeting,
      showUniversalCta: false,
    });
  }

  function loadManifestAiEngine() {
    if (!manifestAiModPromise) {
      manifestAiModPromise = import('./manifest-ai.js?v=85');
    }
    return manifestAiModPromise;
  }

  function ensureRoot() {
    if (rootEl && document.body.contains(rootEl)) return rootEl;
    rootEl = document.getElementById('feature-cs-root');
    if (!rootEl) {
      rootEl = document.createElement('div');
      rootEl.id = 'feature-cs-root';
      rootEl.className = 'fcs-root';
      document.body.appendChild(rootEl);
    }
    return rootEl;
  }

  function syncVisibility() {
    const cfg = getConfig() || {};
    const root = ensureRoot();
    root.hidden = cfg.enabled === false;
  }

  function scrollMessagesToBottom() {
    const body = rootEl?.querySelector('#fcs-messages');
    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }

  function renderMessages() {
    const body = rootEl?.querySelector('#fcs-messages');
    if (!body) return;
    ensureGreetingMessage();

    body.innerHTML = messages
      .map((m, idx) => {
        const isUser = m.role === 'user';
        const isStreaming = Boolean(m.streaming);
        return `
          <div class="fcs-msg ${isUser ? 'is-user' : 'is-bot'} ${isStreaming ? 'is-streaming' : ''}" data-msg-idx="${idx}">
            <div class="fcs-bubble">
              ${
                isUser
                  ? `<p>${escapeHtml(m.content)}</p>`
                  : m.content
                    ? renderSimpleMarkdown(m.content)
                    : '<div class="fcs-typing" aria-label="Mengetik jawaban"><span></span><span></span><span></span></div>'
              }
              ${
                !isUser && m.showUniversalCta
                  ? `<div class="fcs-inline-cta">
                      <button type="button" class="btn btn-primary btn-sm fcs-open-ai-btn" data-fcs-open-tab="manifestai">
                        Buka Manifest AI →
                      </button>
                    </div>`
                  : ''
              }
            </div>
          </div>
        `;
      })
      .join('');

    body.querySelectorAll('[data-fcs-open-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-fcs-open-tab');
        closeDrawer();
        if (tab) onOpenFeature(tab);
      });
    });

    scrollMessagesToBottom();
  }

  function renderShell() {
    const root = ensureRoot();
    syncVisibility();

    root.innerHTML = `
      <button
        type="button"
        id="feature-cs-fab"
        class="fcs-fab ${isOpen ? 'is-open' : ''}"
        aria-label="${isOpen ? 'Tutup bantuan Tanya Fitur' : 'Buka layanan Tanya Fitur'}"
        aria-expanded="${isOpen}"
      >
        <span class="fcs-fab-icon" aria-hidden="true">
          ${
            isOpen
              ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
              : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>'
          }
        </span>
        <span class="fcs-fab-label">Tanya Fitur</span>
      </button>

      <div id="fcs-backdrop" class="fcs-backdrop" ${isOpen ? '' : 'hidden'}></div>

      <section
        id="fcs-drawer"
        class="fcs-drawer ${isOpen ? 'is-open' : ''}"
        role="dialog"
        aria-modal="false"
        aria-labelledby="fcs-title"
        ${isOpen ? '' : 'hidden'}
      >
        <header class="fcs-header">
          <div class="fcs-header-left">
            <img src="./assets/icons/tool-manifestai.svg" alt="" width="34" height="34" class="fcs-avatar" />
            <div>
              <h2 id="fcs-title" class="fcs-title">Tanya Fitur</h2>
              <p class="fcs-subtitle">Bantuan Fitur &amp; Solusi · Manifest AI</p>
            </div>
          </div>
          <div class="fcs-header-actions">
            <button type="button" id="fcs-reset-btn" class="fcs-icon-btn" title="Mulai percakapan baru" aria-label="Mulai percakapan baru">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
            <button type="button" id="fcs-close-btn" class="fcs-icon-btn" aria-label="Tutup Tanya Fitur">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </header>

        <div id="fcs-messages" class="fcs-messages" aria-live="polite"></div>

        <div class="fcs-quick-row" id="fcs-quick-row">
          ${QUICK_PROMPTS.map(
            (q) =>
              `<button type="button" class="fcs-quick-btn" data-fcs-quick="${escapeHtml(q)}">${escapeHtml(q)}</button>`
          ).join('')}
        </div>

        <form id="fcs-form" class="fcs-form" novalidate>
          <input
            type="text"
            id="fcs-input"
            class="fcs-input"
            placeholder="Tanyakan cara pakai atau kendala fitur..."
            autocomplete="off"
            maxlength="400"
            ${isSending ? 'disabled' : ''}
          />
          <button type="submit" id="fcs-send-btn" class="fcs-send-btn" aria-label="Kirim pertanyaan" ${isSending ? 'disabled' : ''}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </section>
    `;

    bindEvents();
    renderMessages();
  }

  function openDrawer() {
    isOpen = true;
    renderShell();
    requestAnimationFrame(() => {
      rootEl?.querySelector('#fcs-input')?.focus();
    });
  }

  function closeDrawer() {
    if (!isOpen) return;
    isOpen = false;
    if (abortCtrl) {
      abortCtrl.abort();
      abortCtrl = null;
    }
    isSending = false;
    renderShell();
  }

  async function submitQuestion(rawText) {
    const prompt = String(rawText || '').trim();
    if (!prompt || isSending) return;

    ensureGreetingMessage();
    messages.push({ role: 'user', content: prompt });
    const intent = classifyFeatureCsIntent(prompt);
    const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : null;

    // Instant deterministic guard for greetings, restricted probes, or off-topic universal prompts
    if (intent === 'greeting') {
      messages.push({ role: 'assistant', content: buildFeatureCsGreetingReply(), showUniversalCta: false });
      renderMessages();
      return;
    }
    if (intent === 'restricted_leak') {
      messages.push({ role: 'assistant', content: buildFeatureCsRestrictedReply(), showUniversalCta: false });
      renderMessages();
      return;
    }
    if (intent === 'off_topic') {
      messages.push({ role: 'assistant', content: buildFeatureCsOffTopicReply(), showUniversalCta: true });
      renderMessages();
      return;
    }

    // Feature & Troubleshooting support: powered by Manifest AI engine with verified KB grounding
    isSending = true;
    const botIndex = messages.length;
    messages.push({ role: 'assistant', content: '', streaming: true, showUniversalCta: false });
    renderShell();

    abortCtrl = new AbortController();
    const csHistory = messages
      .slice(1, botIndex)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const aiMod = await loadManifestAiEngine();
      const customSystemPrompt = buildFeatureCsSystemPrompt(activeTab || '');

      const res = await aiMod.sendManifestAiMessage({
        history: csHistory,
        prompt,
        mode: 'ensemble',
        focusProviderId: 'gemini',
        byokKeys: aiMod.loadStoredByokKeys ? aiMod.loadStoredByokKeys() : [],
        combineByokWithFree: true,
        signal: abortCtrl.signal,
        customSystemPrompt,
        disableWebResearch: true,
        siteMode: 'utilities',
        localFallbackBuilder: (p) => buildFeatureCsLocalFallback(p, activeTab || ''),
        onDelta: (partial) => {
          messages[botIndex].content = sanitizeFeatureCsReply(partial);
          renderMessages();
        },
      });

      const finalSafe = sanitizeFeatureCsReply(
        res?.content || buildFeatureCsLocalFallback(prompt, activeTab || '')
      );
      messages[botIndex].content = finalSafe;
      messages[botIndex].streaming = false;
    } catch (err) {
      if (err?.message === 'ABORTED') {
        messages[botIndex].content =
          messages[botIndex].content || 'Permintaan dibatalkan.';
      } else {
        messages[botIndex].content = sanitizeFeatureCsReply(
          buildFeatureCsLocalFallback(prompt, activeTab || '')
        );
      }
      messages[botIndex].streaming = false;
    } finally {
      isSending = false;
      abortCtrl = null;
      renderShell();
    }
  }

  function bindEvents() {
    rootEl?.querySelector('#feature-cs-fab')?.addEventListener('click', () => {
      if (isOpen) closeDrawer();
      else openDrawer();
    });
    rootEl?.querySelector('#fcs-backdrop')?.addEventListener('click', closeDrawer);
    rootEl?.querySelector('#fcs-close-btn')?.addEventListener('click', closeDrawer);
    rootEl?.querySelector('#fcs-reset-btn')?.addEventListener('click', () => {
      if (abortCtrl) abortCtrl.abort();
      isSending = false;
      messages = [];
      ensureGreetingMessage();
      renderShell();
    });
    rootEl?.querySelectorAll('[data-fcs-quick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-fcs-quick');
        if (q) submitQuestion(q);
      });
    });
    rootEl?.querySelector('#fcs-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = rootEl?.querySelector('#fcs-input');
      const val = String(input?.value || '').trim();
      if (!val) return;
      if (input) input.value = '';
      submitQuestion(val);
    });
  }

  renderShell();

  return {
    open: openDrawer,
    close: closeDrawer,
    refreshConfig: () => {
      syncVisibility();
      if (!isOpen && messages.length <= 1) {
        messages = [];
      }
    },
  };
}
