/**
 * Tanya Fitur — Floating Customer Service AI Assistant UI (v86)
 *
 * - Floating "Tanya Fitur" button with built-in × dismiss button (persisted cleanly)
 *   and footer trigger support so users can hide the floating pill and reopen anytime from footer.
 * - Powered by Manifest AI streaming engine with full Markdown + HTML table renderer (`renderMarkdownSafe`),
 *   natural courtesy replies ("Terimakasih", "Oke", "Berhasil"), context-aware follow-ups,
 *   and zero-leak confidentiality guards.
 */

import {
  buildFeatureCsCourtesyReply,
  buildFeatureCsGreetingReply,
  buildFeatureCsLocalFallback,
  buildFeatureCsOffTopicReply,
  buildFeatureCsRestrictedReply,
  buildFeatureCsSystemPrompt,
  classifyFeatureCsIntent,
  sanitizeFeatureCsReply,
} from './feature-cs-logic.js?v=87';
import { renderMarkdownSafe } from './manifest-ai-logic.js?v=87';

const FCS_FAB_HIDDEN_KEY = 'manifestudio_fcs_fab_hidden_v1';

function escapeHtml(str = '') {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readFabDismissed() {
  try {
    return localStorage.getItem(FCS_FAB_HIDDEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeFabDismissed(hidden) {
  try {
    if (hidden) {
      localStorage.setItem(FCS_FAB_HIDDEN_KEY, '1');
    } else {
      localStorage.removeItem(FCS_FAB_HIDDEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

const QUICK_PROMPTS = [
  'Ada fitur apa saja di sini?',
  'Cara pakai Shortlink Bypass',
  'Drama pendek ngelag / patah-patah',
  'Cara download video tanpa watermark',
];

export function createFeatureCsController({
  getActiveTab = () => null,
  onOpenFeature = () => {},
  getConfig = () => ({ enabled: true, greeting: '' }),
} = {}) {
  let rootEl = null;
  let isOpen = false;
  let isSending = false;
  let fabDismissed = readFabDismissed();
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
      manifestAiModPromise = import('./manifest-ai.js?v=87');
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
    const isEnabled = cfg.enabled !== false;
    const root = ensureRoot();
    root.hidden = !isEnabled;

    // Also sync footer "Tanya Fitur" trigger button visibility with Admin toggle
    document.querySelectorAll('[data-open-feature-cs]').forEach((el) => {
      el.hidden = !isEnabled;
    });
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
                    ? renderMarkdownSafe(sanitizeFeatureCsReply(m.content))
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

    const showFab = !fabDismissed;

    root.innerHTML = `
      <div class="fcs-fab-cluster" id="feature-cs-fab-cluster" ${showFab ? '' : 'hidden'}>
        <button
          type="button"
          id="feature-cs-fab-close"
          class="fcs-fab-close-btn"
          title="Sembunyikan tombol Tanya Fitur (tetap bisa dibuka dari bagian bawah halaman)"
          aria-label="Tutup tombol mengambang Tanya Fitur"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
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
      </div>

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

  function dismissFab() {
    fabDismissed = true;
    writeFabDismissed(true);
    if (isOpen) {
      closeDrawer();
      return;
    }
    renderShell();
  }

  function restoreFab() {
    fabDismissed = false;
    writeFabDismissed(false);
    renderShell();
  }

  function openDrawer({ restoreFloating = false } = {}) {
    if (restoreFloating && fabDismissed) {
      fabDismissed = false;
      writeFabDismissed(false);
    }
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
    const hasPriorContext = messages.some((m) => m.role === 'user');
    const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : null;

    messages.push({ role: 'user', content: prompt });
    const intent = classifyFeatureCsIntent(prompt, {
      hasContext: hasPriorContext,
      activeTabId: activeTab || '',
    });

    // Instant deterministic replies for greetings, courtesies ("Terimakasih"), restricted probes, or clear off-topic
    if (intent === 'greeting') {
      messages.push({ role: 'assistant', content: buildFeatureCsGreetingReply(), showUniversalCta: false });
      renderMessages();
      return;
    }
    if (intent === 'courtesy') {
      messages.push({ role: 'assistant', content: buildFeatureCsCourtesyReply(prompt), showUniversalCta: false });
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
        localFallbackBuilder: (p) =>
          buildFeatureCsLocalFallback(p, activeTab || '', { hasContext: hasPriorContext }),
        onDelta: (partial) => {
          messages[botIndex].content = sanitizeFeatureCsReply(partial);
          renderMessages();
        },
      });

      const finalSafe = sanitizeFeatureCsReply(
        res?.content || buildFeatureCsLocalFallback(prompt, activeTab || '', { hasContext: hasPriorContext })
      );
      messages[botIndex].content = finalSafe;
      messages[botIndex].streaming = false;
    } catch (err) {
      if (err?.message === 'ABORTED') {
        messages[botIndex].content =
          messages[botIndex].content || 'Permintaan dibatalkan.';
      } else {
        messages[botIndex].content = sanitizeFeatureCsReply(
          buildFeatureCsLocalFallback(prompt, activeTab || '', { hasContext: hasPriorContext })
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
    rootEl?.querySelector('#feature-cs-fab-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFab();
    });
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
    dismissFab,
    restoreFab,
    isFabDismissed: () => fabDismissed,
    refreshConfig: () => {
      syncVisibility();
      if (!isOpen && messages.length <= 1) {
        messages = [];
      }
    },
  };
}
