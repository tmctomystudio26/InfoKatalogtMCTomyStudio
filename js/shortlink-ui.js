/**
 * Shortlink Bypass & Anti-Malware Intelligence UI Controller (v87)
 *
 * Clean, responsive workspace (mobile 390px + desktop 1440px, Light & Dark theme):
 *  - Single URL & Batch (up to 10 URLs) bypass modes
 *  - Paste button + Quick Demo test chips
 *  - Toggleable Multi-AI Ensemble Security Audit (Gemini, ChatGPT, Claude, Grok, DeepSeek)
 *  - Clear Safety Verdict Banner (Aman / Waspada / Berbahaya) with Trust Score
 *  - Final Clean URL Card with Copy & Safe Open controls (strictly blocks unsafe schemes)
 *  - Step-by-step Redirect Trail, Multi-Engine Verification Grid, & Local History
 */

import {
  AI_ENSEMBLE_MODELS,
  SHORTLINK_HISTORY_KEY,
  normalizeAndValidateUrl,
  parseBatchUrls,
  upsertShortlinkHistory,
} from './shortlink-logic.js?v=87';
import { executeCollaborativeBypass } from './shortlink.js?v=87';

const QUICK_SAMPLES = [
  {
    label: 'Safelink Base64 + Pelacak',
    url: 'https://safelinku.com/go?u=aHR0cHM6Ly9naXRodWIuY29tL2dvb2dsZT91dG1fc291cmNlPWFkcyZmYmNsaWQ9MTIzNDU=',
    note: 'Dekode Instan',
  },
  {
    label: 'Wrapper Redirect + UTM',
    url: 'https://l.facebook.com/l.php?u=https%3A%2F%2Fid.wikipedia.org%2Fwiki%2FIndonesia%3Futm_source%3Dfb%26fbclid%3Dabc999',
    note: 'Bersih Pelacak',
  },
  {
    label: 'Shortlink Publik (TinyURL)',
    url: 'https://tinyurl.com/2p8d6r8w',
    note: 'Multi-API',
  },
  {
    label: 'Simulasi Link Phishing .APK',
    url: 'https://bit.ly/go?url=http%3A%2F%2Fbri-verifikasi-hadiah.xyz%2Funduh-resi.apk',
    note: 'Uji Deteksi Bahaya',
  },
];

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readHistory() {
  try {
    const raw = localStorage.getItem(SHORTLINK_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(list) {
  try {
    localStorage.setItem(SHORTLINK_HISTORY_KEY, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

function formatShortTime(iso = '') {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function getSafeOpenHref(url = '') {
  const check = normalizeAndValidateUrl(url);
  return check.valid ? check.url : '';
}

function getVerdictMeta(level = 'safe') {
  if (level === 'danger') {
    return {
      cls: 'is-danger',
      badge: 'Berbahaya',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`,
    };
  }
  if (level === 'warn') {
    return {
      cls: 'is-warn',
      badge: 'Waspada',
      icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
    };
  }
  return {
    cls: 'is-safe',
    badge: 'Aman',
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>`,
  };
}

export function createShortlinkController({ onToast = () => {} } = {}) {
  const state = {
    mode: 'single', // 'single' | 'batch'
    urlInput: '',
    batchInput: '',
    enableMultiAi: true,
    loading: false,
    stageText: '',
    error: '',
    result: null,
    batchResults: [],
    history: readHistory(),
  };

  let containerEl = null;
  let activeAbort = null;

  async function copyText(text, successMsg = 'Tautan bersih disalin!') {
    try {
      await navigator.clipboard.writeText(text);
      onToast(successMsg);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      onToast(successMsg);
    }
  }

  async function runSingleBypass(explicitUrl = null) {
    const raw = explicitUrl !== null ? explicitUrl : state.urlInput;
    state.urlInput = raw;
    const check = normalizeAndValidateUrl(raw);
    if (!check.valid) {
      state.error = check.error;
      render();
      return;
    }

    if (activeAbort) activeAbort.abort();
    activeAbort = new AbortController();

    state.loading = true;
    state.error = '';
    state.stageText = 'Memulai pemindaian multi-mesin...';
    render();

    try {
      const res = await executeCollaborativeBypass(check.url, {
        enableMultiAi: state.enableMultiAi,
        signal: activeAbort.signal,
        onStage: (txt) => {
          state.stageText = txt;
          const stageEl = containerEl?.querySelector('#slb-stage-text');
          if (stageEl) stageEl.textContent = txt;
        },
      });
      state.result = res;
      state.history = upsertShortlinkHistory(state.history, {
        inputUrl: res.inputUrl,
        finalUrl: res.finalUrl,
        safetyLevel: res.safety.level,
        safetyLabel: res.safety.label,
        bypassed: res.bypassed,
        timestamp: res.timestamp,
      });
      writeHistory(state.history);
    } catch (err) {
      if (err?.message !== 'ABORTED') {
        state.error = err?.message || 'Gagal memproses tautan. Periksa koneksi Anda lalu coba lagi.';
      }
    } finally {
      state.loading = false;
      state.stageText = '';
      activeAbort = null;
      render();
    }
  }

  async function runBatchBypass() {
    const items = parseBatchUrls(state.batchInput, 10);
    if (items.length === 0) {
      state.error = 'Masukkan minimal 1 tautan (satu tautan per baris, maksimal 10 tautan).';
      render();
      return;
    }

    if (activeAbort) activeAbort.abort();
    activeAbort = new AbortController();

    state.loading = true;
    state.error = '';
    state.batchResults = [];
    render();

    try {
      for (let i = 0; i < items.length; i += 1) {
        if (activeAbort.signal.aborted) break;
        const item = items[i];
        state.stageText = `Memproses tautan ${i + 1} dari ${items.length}...`;
        const stageEl = containerEl?.querySelector('#slb-stage-text');
        if (stageEl) stageEl.textContent = state.stageText;

        if (!item.valid) {
          state.batchResults.push({
            ok: false,
            inputUrl: item.raw,
            error: item.error,
          });
          continue;
        }
        try {
          const res = await executeCollaborativeBypass(item.url, {
            enableMultiAi: false, // Keep batch snappy across up to 10 links
            signal: activeAbort.signal,
          });
          state.batchResults.push(res);
          state.history = upsertShortlinkHistory(state.history, {
            inputUrl: res.inputUrl,
            finalUrl: res.finalUrl,
            safetyLevel: res.safety.level,
            safetyLabel: res.safety.label,
            bypassed: res.bypassed,
            timestamp: res.timestamp,
          });
        } catch (err) {
          if (err?.message === 'ABORTED') break;
          state.batchResults.push({
            ok: false,
            inputUrl: item.url,
            error: err?.message || 'Gagal diproses',
          });
        }
      }
      writeHistory(state.history);
    } finally {
      state.loading = false;
      state.stageText = '';
      activeAbort = null;
      render();
    }
  }

  function renderSingleResultCard(res) {
    if (!res) return '';
    const vMeta = getVerdictMeta(res.safety.level);
    const safeHref = getSafeOpenHref(res.finalUrl);
    const totalTrailSteps = (res.localSteps?.length || 0) + (res.hops?.length || 0);

    return `
      <div class="slb-result-stack" data-testid="shortlink-result">
        <!-- 1. Safety Verdict & Final Destination Hero -->
        <div class="slb-verdict-card ${vMeta.cls}">
          <div class="slb-verdict-top">
            <div class="slb-verdict-badge-row">
              <span class="slb-verdict-icon">${vMeta.icon}</span>
              <div>
                <div class="slb-verdict-title">${escapeHtml(res.safety.label)}</div>
                <div class="slb-verdict-sub">
                  Skor Keamanan <strong class="mono-num">${res.safety.trustScore}/100</strong>
                  · ${escapeHtml(res.serviceInfo?.label || 'Tautan')}
                  ${res.trackingRemovedCount > 0 ? ` · ${res.trackingRemovedCount} pelacak dihapus` : ''}
                </div>
              </div>
            </div>
            <span class="slb-trust-pill ${vMeta.cls}">${escapeHtml(vMeta.badge)}</span>
          </div>

          <div class="slb-final-url-box">
            <div class="slb-final-url-label">
              <span>${res.bypassed ? 'Tautan Tujuan Langsung (Bersih Tanpa Iklan)' : 'Tautan Terverifikasi'}</span>
              ${res.pageTitle ? `<span class="slb-page-title">${escapeHtml(res.pageTitle)}</span>` : ''}
            </div>
            <div class="slb-final-url-text mono-num" data-testid="shortlink-final-url">${escapeHtml(res.finalUrl)}</div>
            <div class="slb-final-actions">
              <button type="button" class="btn btn-primary btn-sm" id="slb-copy-final-btn">
                Salin Tautan Bersih
              </button>
              ${
                safeHref && res.safety.level !== 'danger'
                  ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer nofollow" class="btn btn-secondary btn-sm">
                      Buka Tautan Aman ↗
                    </a>`
                  : safeHref
                  ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer nofollow" class="btn btn-ghost btn-sm slb-danger-open-link">
                      Tetap Buka (Berisiko) ↗
                    </a>`
                  : ''
              }
            </div>
          </div>

          ${
            res.removedParams?.length > 0
              ? `<div class="slb-cleaned-strip">
                  <strong>Pelacak iklan dibersihkan:</strong>
                  ${res.removedParams.map((p) => `<span class="slb-param-tag mono-num">${escapeHtml(p)}</span>`).join('')}
                </div>`
              : ''
          }
        </div>

        <!-- 2. Two-Column Intelligence Breakdown (Findings + Multi-AI Ensemble) -->
        <div class="slb-intel-grid">
          <div class="slb-card">
            <h3 class="slb-card-title">Audit Keamanan &amp; Anti-Malware</h3>
            <ul class="slb-findings-list">
              ${(res.safety.findings || [])
                .map(
                  (f) => `
                <li class="slb-finding-item is-${escapeHtml(f.severity || 'info')}">
                  <span class="slb-finding-dot" aria-hidden="true"></span>
                  <span>${escapeHtml(f.text)}</span>
                </li>
              `
                )
                .join('')}
            </ul>
          </div>

          <div class="slb-card">
            <div class="slb-card-head-row">
              <h3 class="slb-card-title">Konsensus Multi-AI</h3>
              <span class="slb-mini-count">${res.safety.aiConsensusUsed ? 'Aktif' : 'Standby'}</span>
            </div>
            <div class="slb-ai-chip-row">
              ${AI_ENSEMBLE_MODELS.map((m) => {
                const match = (res.safety.aiModelsParticipated || []).find((p) => p.id === m.id);
                return `
                  <span class="slb-ai-badge ${match ? 'is-verified' : ''}" title="${escapeHtml(m.role)}">
                    ${escapeHtml(m.label)}
                  </span>
                `;
              }).join('')}
            </div>
            ${
              res.safety.aiConsensusUsed && res.safety.aiSummary
                ? `<p class="slb-ai-summary">${escapeHtml(res.safety.aiSummary)}</p>
                   ${res.safety.aiAdvice ? `<p class="slb-ai-advice"><strong>Saran:</strong> ${escapeHtml(res.safety.aiAdvice)}</p>` : ''}`
                : `<p class="slb-ai-summary">
                    Analisis heuristik anti-phishing &amp; keamanan domain selesai dijalankan secara lokal.
                    ${state.enableMultiAi ? 'Panel Multi-AI (Gemini, ChatGPT, Claude, Grok, DeepSeek) siap melakukan verifikasi silang setiap kali gateway AI tersedia.' : 'Aktifkan opsi Analisis Multi-AI di atas untuk verifikasi silang dari beberapa model AI.'}
                  </p>`
            }
          </div>
        </div>

        <!-- 3. Multi-Engine Collaborative Status + Redirect Trail -->
        <div class="slb-intel-grid">
          <div class="slb-card">
            <div class="slb-card-head-row">
              <h3 class="slb-card-title">Kolaborasi Multi-Mesin Bypass</h3>
              <span class="slb-mini-count mono-num">${res.totalEnginesChecked} mesin</span>
            </div>
            <div class="slb-engine-list">
              ${(res.engineRows || [])
                .map(
                  (eng) => `
                <div class="slb-engine-row">
                  <div class="slb-engine-meta">
                    <span class="slb-engine-dot ${eng.ok ? 'is-ok' : 'is-muted'}" aria-hidden="true"></span>
                    <div>
                      <div class="slb-engine-name">${escapeHtml(eng.name)}</div>
                      <div class="slb-engine-note">${escapeHtml(eng.note)}</div>
                    </div>
                  </div>
                  <span class="slb-engine-state ${eng.ok ? 'is-ok' : ''}">${eng.ok ? 'Cocok' : 'Selesai'}</span>
                </div>
              `
                )
                .join('')}
            </div>
          </div>

          <div class="slb-card">
            <div class="slb-card-head-row">
              <h3 class="slb-card-title">Jejak Pengalihan Tautan</h3>
              <span class="slb-mini-count mono-num">${Math.max(1, totalTrailSteps)} langkah</span>
            </div>
            <ol class="slb-trail-list">
              <li class="slb-trail-item">
                <span class="slb-trail-step">Asal</span>
                <span class="slb-trail-url mono-num">${escapeHtml(res.inputUrl)}</span>
              </li>
              ${(res.localSteps || [])
                .map(
                  (st) => `
                <li class="slb-trail-item">
                  <span class="slb-trail-step">${escapeHtml(st.method)}</span>
                  <span class="slb-trail-url mono-num">${escapeHtml(st.to)}</span>
                </li>
              `
                )
                .join('')}
              ${(res.hops || [])
                .filter((h) => h.target && h.target !== res.inputUrl)
                .map(
                  (h) => `
                <li class="slb-trail-item">
                  <span class="slb-trail-step">${h.status ? `HTTP ${h.status}` : escapeHtml(h.type)}</span>
                  <span class="slb-trail-url mono-num">${escapeHtml(h.target)}</span>
                </li>
              `
                )
                .join('')}
              <li class="slb-trail-item is-final">
                <span class="slb-trail-step">Akhir</span>
                <span class="slb-trail-url mono-num">${escapeHtml(res.finalUrl)}</span>
              </li>
            </ol>
          </div>
        </div>
      </div>
    `;
  }

  function renderBatchResults() {
    if (!state.batchResults.length) return '';
    return `
      <div class="slb-card slb-batch-card" data-testid="shortlink-batch-results">
        <div class="slb-card-head-row">
          <h3 class="slb-card-title">Hasil Bypass Massal (${state.batchResults.length} tautan)</h3>
          <button type="button" class="btn btn-secondary btn-sm" id="slb-copy-batch-btn">Salin Semua Link Bersih</button>
        </div>
        <div class="slb-batch-list">
          ${state.batchResults
            .map((item, idx) => {
              if (!item.ok) {
                return `
                  <div class="slb-batch-row is-error">
                    <div class="slb-batch-urls">
                      <span class="mono-num">${escapeHtml(item.inputUrl)}</span>
                      <span class="slb-batch-err">${escapeHtml(item.error)}</span>
                    </div>
                  </div>
                `;
              }
              const vm = getVerdictMeta(item.safety.level);
              const safeHref = getSafeOpenHref(item.finalUrl);
              return `
                <div class="slb-batch-row">
                  <div class="slb-batch-urls">
                    <div class="slb-batch-top-meta">
                      <span class="slb-trust-pill ${vm.cls}">${escapeHtml(vm.badge)} (${item.safety.trustScore})</span>
                      <span class="slb-batch-orig mono-num">${escapeHtml(item.inputUrl)}</span>
                    </div>
                    <div class="slb-batch-final mono-num">${escapeHtml(item.finalUrl)}</div>
                  </div>
                  <div class="slb-batch-actions">
                    <button type="button" class="btn btn-secondary btn-sm" data-batch-copy="${idx}">Salin</button>
                    ${
                      safeHref
                        ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer nofollow" class="btn btn-ghost btn-sm">Buka ↗</a>`
                        : ''
                    }
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  function render() {
    if (!containerEl) return;

    containerEl.innerHTML = `
      <div class="slb-shell" data-testid="shortlink-hub">
        <div class="slb-input-card">
          <div class="slb-mode-bar">
            <div class="slb-mode-tabs" role="tablist" aria-label="Mode Bypass Shortlink">
              <button
                type="button"
                role="tab"
                class="slb-mode-btn ${state.mode === 'single' ? 'is-active' : ''}"
                data-slb-mode="single"
                aria-selected="${state.mode === 'single'}"
              >
                Satu Tautan
              </button>
              <button
                type="button"
                role="tab"
                class="slb-mode-btn ${state.mode === 'batch' ? 'is-active' : ''}"
                data-slb-mode="batch"
                aria-selected="${state.mode === 'batch'}"
              >
                Banyak Tautan (Batch)
              </button>
            </div>

            <label class="slb-ai-toggle">
              <input type="checkbox" id="slb-multi-ai-check" ${state.enableMultiAi ? 'checked' : ''} />
              <span>Audit Keamanan Multi-AI</span>
            </label>
          </div>

          ${
            state.mode === 'single'
              ? `
                <form id="slb-single-form" class="slb-form" novalidate>
                  <div class="slb-input-row">
                    <input
                      type="url"
                      id="slb-url-input"
                      class="slb-url-input"
                      placeholder="Tempel tautan shortlink atau safelink (bit.ly, ouo.io, safelinku, linkvertise, s.id, dll.)..."
                      value="${escapeHtml(state.urlInput)}"
                      autocomplete="off"
                      spellcheck="false"
                      aria-label="Masukkan tautan shortlink untuk di-bypass"
                      ${state.loading ? 'disabled' : ''}
                    />
                    <button type="button" class="btn btn-secondary btn-sm slb-paste-btn" id="slb-paste-btn" ${state.loading ? 'disabled' : ''}>
                      Tempel
                    </button>
                    <button type="submit" class="btn btn-primary slb-submit-btn" id="slb-submit-btn" ${state.loading ? 'disabled' : ''}>
                      ${state.loading ? 'Memproses...' : 'Bypass & Cek'}
                    </button>
                  </div>
                </form>

                <div class="slb-samples-row">
                  <span class="slb-samples-label">Coba cepat:</span>
                  ${QUICK_SAMPLES.map(
                    (s, idx) => `
                    <button type="button" class="slb-sample-chip" data-slb-sample="${idx}" ${state.loading ? 'disabled' : ''}>
                      ${escapeHtml(s.label)}
                    </button>
                  `
                  ).join('')}
                </div>
              `
              : `
                <form id="slb-batch-form" class="slb-form" novalidate>
                  <textarea
                    id="slb-batch-input"
                    class="slb-batch-textarea mono-num"
                    rows="5"
                    placeholder="Tempel hingga 10 tautan shortlink (satu tautan per baris)..."
                    aria-label="Masukkan daftar tautan shortlink"
                    ${state.loading ? 'disabled' : ''}
                  >${escapeHtml(state.batchInput)}</textarea>
                  <div class="slb-batch-submit-row">
                    <span class="slb-batch-hint">Maksimal 10 tautan per proses</span>
                    <button type="submit" class="btn btn-primary btn-sm" id="slb-batch-submit-btn" ${state.loading ? 'disabled' : ''}>
                      ${state.loading ? 'Memproses Batch...' : 'Bypass Semua Tautan'}
                    </button>
                  </div>
                </form>
              `
          }

          ${
            state.loading
              ? `<div class="slb-progress-bar" role="status" aria-live="polite">
                  <span class="tool-lazy-spinner" aria-hidden="true"></span>
                  <span id="slb-stage-text">${escapeHtml(state.stageText || 'Menghubungkan mesin bypass...')}</span>
                </div>`
              : ''
          }

          ${
            state.error
              ? `<div class="form-error slb-error" role="alert">${escapeHtml(state.error)}</div>`
              : ''
          }
        </div>

        ${state.mode === 'single' ? renderSingleResultCard(state.result) : renderBatchResults()}

        ${
          state.history.length > 0
            ? `
              <div class="slb-card slb-history-card">
                <div class="slb-card-head-row">
                  <h3 class="slb-card-title">Riwayat Bypass di Perangkat</h3>
                  <button type="button" class="btn btn-ghost btn-sm" id="slb-clear-history-btn">Hapus Riwayat</button>
                </div>
                <div class="slb-history-list">
                  ${state.history
                    .slice(0, 8)
                    .map((h, idx) => {
                      const vm = getVerdictMeta(h.safetyLevel);
                      return `
                        <div class="slb-history-row">
                          <div class="slb-history-main">
                            <div class="slb-history-top">
                              <span class="slb-trust-pill ${vm.cls}">${escapeHtml(vm.badge)}</span>
                              <span class="slb-history-time">${escapeHtml(formatShortTime(h.timestamp))}</span>
                            </div>
                            <div class="slb-history-dest mono-num">${escapeHtml(h.finalUrl)}</div>
                          </div>
                          <div class="slb-history-actions">
                            <button type="button" class="btn btn-secondary btn-sm" data-history-copy="${idx}">Salin</button>
                            <button type="button" class="btn btn-ghost btn-sm" data-history-rerun="${idx}">Cek Ulang</button>
                          </div>
                        </div>
                      `;
                    })
                    .join('')}
                </div>
              </div>
            `
            : ''
        }
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    if (!containerEl) return;

    containerEl.querySelectorAll('[data-slb-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextMode = btn.getAttribute('data-slb-mode');
        if (nextMode && nextMode !== state.mode) {
          state.mode = nextMode;
          state.error = '';
          render();
        }
      });
    });

    containerEl.querySelector('#slb-multi-ai-check')?.addEventListener('change', (e) => {
      state.enableMultiAi = Boolean(e.target.checked);
    });

    containerEl.querySelector('#slb-url-input')?.addEventListener('input', (e) => {
      state.urlInput = e.target.value;
      if (state.error) {
        state.error = '';
        const errEl = containerEl?.querySelector('.slb-error');
        if (errEl) errEl.remove();
      }
    });

    containerEl.querySelector('#slb-batch-input')?.addEventListener('input', (e) => {
      state.batchInput = e.target.value;
    });

    containerEl.querySelector('#slb-paste-btn')?.addEventListener('click', async () => {
      try {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim()) {
          state.urlInput = clip.trim();
          state.error = '';
          render();
          onToast('Tautan ditempel dari clipboard.');
        } else {
          onToast('Clipboard kosong.');
        }
      } catch {
        onToast('Izin baca clipboard ditolak browser. Tempel manual dengan Ctrl+V / tahan lama.');
      }
    });

    containerEl.querySelector('#slb-single-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      runSingleBypass();
    });

    containerEl.querySelector('#slb-batch-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      runBatchBypass();
    });

    containerEl.querySelectorAll('[data-slb-sample]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-slb-sample'));
        const sample = QUICK_SAMPLES[idx];
        if (sample) {
          runSingleBypass(sample.url);
        }
      });
    });

    containerEl.querySelector('#slb-copy-final-btn')?.addEventListener('click', () => {
      if (state.result?.finalUrl) {
        copyText(state.result.finalUrl);
      }
    });

    containerEl.querySelector('#slb-copy-batch-btn')?.addEventListener('click', () => {
      const cleanLinks = state.batchResults
        .filter((r) => r.ok && r.finalUrl)
        .map((r) => r.finalUrl)
        .join('\n');
      if (cleanLinks) copyText(cleanLinks, 'Semua tautan bersih disalin!');
    });

    containerEl.querySelectorAll('[data-batch-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-batch-copy'));
        const item = state.batchResults[idx];
        if (item?.finalUrl) copyText(item.finalUrl);
      });
    });

    containerEl.querySelector('#slb-clear-history-btn')?.addEventListener('click', () => {
      state.history = [];
      writeHistory([]);
      render();
      onToast('Riwayat bypass dibersihkan.');
    });

    containerEl.querySelectorAll('[data-history-copy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-history-copy'));
        const h = state.history[idx];
        if (h?.finalUrl) copyText(h.finalUrl);
      });
    });

    containerEl.querySelectorAll('[data-history-rerun]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-history-rerun'));
        const h = state.history[idx];
        if (h?.inputUrl) {
          state.mode = 'single';
          runSingleBypass(h.inputUrl);
        }
      });
    });
  }

  return {
    mount(targetEl) {
      containerEl = targetEl;
      render();
    },
    unmount() {
      if (activeAbort) {
        activeAbort.abort();
        activeAbort = null;
      }
      containerEl = null;
    },
    redrawTheme() {
      // Uses CSS variables automatically
    },
  };
}
