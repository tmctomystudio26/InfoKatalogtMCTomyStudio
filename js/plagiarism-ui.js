/**
 * Manifestudio Integrated Plagiarism Checker UI Controller (v67)
 * Turnitin Latest-inspired workspace with:
 * - Universal All-File Upload (PDF, DOCX, PPTX, XLSX, ODT, EPUB, RTF, HTML, TXT, MD, Code, Images OCR, Any File) + Paste Editor
 * - Real-time Progress Bar (0–100%), live status text, elapsed timer, Cancel button & per-engine live telemetry
 * - Interactive Color-Coded Annotated Manuscript + Click-to-Inspect Match Details & Paraphrase Suggestions
 * - Turnitin Similarity Index Panel (Overall %, Internet %, Publications %, AI Writing %) + Live Exclusion Filters
 * - Direct Downloads: Multi-Page Turnitin-Style PDF (.pdf), Interactive HTML Report (.html), & Structured JSON (.json)
 * - Optional Turnitin Core API / Institutional API Settings Modal + Local Check History
 */

import {
  PLAGIARISM_DEMO_TEXT,
  applyReportFilters,
  countWords,
  detectDocumentLanguage,
  escapePlagHtml,
  segmentDocumentSentences,
} from './plagiarism-logic.js?v=67';
import {
  clearPlagiarismHistory,
  extractTextFromAnyFile,
  loadPlagiarismApiConfig,
  loadPlagiarismHistory,
  runIntegratedPlagiarismCheck,
  savePlagiarismApiConfig,
} from './plagiarism-engine.js?v=67';
import {
  generateTurnitinHtmlReport,
  generateTurnitinJsonReport,
  generateTurnitinPdfBlob,
} from './plagiarism-report.js?v=67';
import { loadStoredByokKeys } from './manifest-ai.js?v=67';

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore
    }
  }, 4000);
}

function sanitizeDownloadStem(fileName = 'laporan_plagiarisme') {
  return (
    String(fileName || 'laporan_plagiarisme')
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'laporan_plagiarisme'
  );
}

function formatShortDate(iso = '') {
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

export function createPlagiarismController({ onToast = () => {} } = {}) {
  let hostEl = null;
  let mounted = false;

  // Input state
  let inputText = '';
  let fileName = 'Naskah_Tempel_Langsung.txt';
  let fileFormat = 'TEXT';
  let fileSize = 0;
  let uploadedFileNote = '';
  let extractingFile = false;
  let extractLabel = '';

  // Scan options
  let scanOptions = {
    language: 'auto',
    mode: 'standard', // 'standard' | 'deep'
    excludeQuotes: false,
    excludeBibliography: true,
    excludeSmallWords: 0,
  };

  // Scanning progress state
  let scanning = false;
  let progressPct = 0;
  let progressLabel = '';
  let progressEngines = [];
  let scanStartedAt = 0;
  let elapsedTimer = null;
  let activeAbort = null;

  // Report & inspection state
  let activeReport = null;
  let inspectorTab = 'sources'; // 'sources' | 'ai' | 'filters' | 'history'
  let selectedSourceRank = null; // null = highlight all, number = focus source rank
  let selectedSentenceIdx = null;
  let historyList = loadPlagiarismHistory();

  // API Settings modal state
  let apiModalOpen = false;
  let apiConfig = loadPlagiarismApiConfig();

  function stopElapsedTimer() {
    if (elapsedTimer) {
      clearInterval(elapsedTimer);
      elapsedTimer = null;
    }
  }

  function updateProgressDom() {
    if (!hostEl) return;
    const fill = hostEl.querySelector('#plg-progress-fill');
    const pctEl = hostEl.querySelector('#plg-progress-pct');
    const lblEl = hostEl.querySelector('#plg-progress-label');
    const enginesEl = hostEl.querySelector('#plg-engine-grid');
    if (fill) fill.style.width = `${Math.min(100, Math.max(0, progressPct))}%`;
    if (pctEl) pctEl.textContent = `${Math.round(progressPct)}%`;
    if (lblEl) lblEl.textContent = progressLabel;
    if (enginesEl && progressEngines.length > 0) {
      enginesEl.innerHTML = renderEngineGridItems(progressEngines);
    }
  }

  function renderEngineGridItems(engines = []) {
    return engines
      .map((eng) => {
        const stateCls =
          eng.status === 'done'
            ? 'is-done'
            : eng.status === 'running'
            ? 'is-running'
            : eng.status === 'standby'
            ? 'is-standby'
            : eng.status === 'fallback'
            ? 'is-warn'
            : 'is-pending';
        const stateText =
          eng.status === 'done'
            ? 'Terpadu'
            : eng.status === 'running'
            ? 'Memindai...'
            : eng.status === 'standby'
            ? 'Siap API'
            : eng.status === 'fallback'
            ? 'Cadangan'
            : 'Antre';
        return `
          <div class="plg-engine-card ${stateCls}">
            <div class="plg-engine-top">
              <strong>${escapePlagHtml(eng.name)}</strong>
              <span class="plg-engine-state">${stateText}</span>
            </div>
            <span class="plg-engine-note">${escapePlagHtml(eng.note || '')}</span>
          </div>
        `;
      })
      .join('');
  }

  async function handleFileSelect(file) {
    if (!file || scanning) return;
    extractingFile = true;
    extractLabel = `Mengekstrak "${file.name}"...`;
    render();
    try {
      const extracted = await extractTextFromAnyFile(file, (p) => {
        extractLabel = p?.label || extractLabel;
        const el = hostEl?.querySelector('#plg-extract-label');
        if (el) el.textContent = extractLabel;
      });
      inputText = extracted.text;
      fileName = extracted.fileName;
      fileFormat = extracted.fileFormat;
      fileSize = extracted.fileSize;
      uploadedFileNote = extracted.note || '';
      extractingFile = false;
      activeReport = null;
      selectedSourceRank = null;
      selectedSentenceIdx = null;
      render();
      onToast(`Berkas "${file.name}" siap dicek (${countWords(inputText)} kata).`);
    } catch (err) {
      extractingFile = false;
      render();
      onToast(err?.message || 'Gagal membaca berkas. Pastikan file berisi teks atau salin teks langsung.');
    }
  }

  async function handleStartCheck() {
    if (scanning) return;
    const words = countWords(inputText);
    if (words < 10) {
      onToast('Masukkan minimal 10 kata atau klik "Contoh Naskah Uji" untuk memulai pengecekan.');
      return;
    }

    scanning = true;
    progressPct = 4;
    progressLabel = 'Menginisialisasi mesin deteksi plagiarisme terpadu...';
    progressEngines = [];
    selectedSourceRank = null;
    selectedSentenceIdx = null;
    scanStartedAt = Date.now();
    activeAbort = new AbortController();
    render();

    stopElapsedTimer();
    elapsedTimer = setInterval(() => {
      const el = hostEl?.querySelector('#plg-elapsed-val');
      if (el) {
        const secs = ((Date.now() - scanStartedAt) / 1000).toFixed(1);
        el.textContent = `${secs} dtk`;
      }
    }, 200);

    try {
      const report = await runIntegratedPlagiarismCheck({
        text: inputText,
        fileName,
        fileFormat,
        fileSize: fileSize || inputText.length,
        options: scanOptions,
        apiConfig,
        signal: activeAbort.signal,
        onProgress: (p) => {
          progressPct = p.percent ?? progressPct;
          progressLabel = p.label || progressLabel;
          if (Array.isArray(p.engines)) progressEngines = p.engines;
          updateProgressDom();
        },
      });
      stopElapsedTimer();
      scanning = false;
      activeAbort = null;
      activeReport = report;
      historyList = loadPlagiarismHistory();
      inspectorTab = 'sources';
      render();
      onToast(`Pengecekan selesai! Indeks Kemiripan ${report.similarityPct}% (${report.primarySources.length} sumber).`);
      hostEl?.querySelector('#plg-report-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      stopElapsedTimer();
      scanning = false;
      activeAbort = null;
      render();
      if (err?.message === 'ABORTED') {
        onToast('Pengecekan plagiarisme dibatalkan.');
      } else {
        onToast(err?.message || 'Terjadi kendala saat mengecek plagiarisme. Coba ulangi.');
      }
    }
  }

  function handleCancelCheck() {
    if (activeAbort) {
      try {
        activeAbort.abort();
      } catch {
        // Ignore
      }
    }
  }

  function handleDownloadPdf() {
    if (!activeReport) return;
    try {
      const blob = generateTurnitinPdfBlob(activeReport);
      const stem = sanitizeDownloadStem(activeReport.fileName);
      triggerBlobDownload(blob, `Turnitin_Report_${stem}_${activeReport.similarityPct}pct.pdf`);
      onToast('Laporan PDF format Turnitin terbaru berhasil diunduh.');
    } catch {
      onToast('Gagal membuat PDF. Coba unduh versi HTML Laporan.');
    }
  }

  function handleDownloadHtml() {
    if (!activeReport) return;
    const html = generateTurnitinHtmlReport(activeReport);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const stem = sanitizeDownloadStem(activeReport.fileName);
    triggerBlobDownload(blob, `Turnitin_Report_${stem}_${activeReport.similarityPct}pct.html`);
    onToast('Laporan HTML interaktif format Turnitin berhasil diunduh.');
  }

  function handleDownloadJson() {
    if (!activeReport) return;
    const json = generateTurnitinJsonReport(activeReport);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const stem = sanitizeDownloadStem(activeReport.fileName);
    triggerBlobDownload(blob, `Plagiarism_Audit_${stem}.json`);
    onToast('Data audit JSON berhasil diekspor.');
  }

  function renderSimilarityGauge(pct, riskLevel) {
    const safe = Math.min(100, Math.max(0, Number(pct) || 0));
    const r = 42;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - safe / 100);
    const stroke =
      riskLevel === 'high'
        ? '#e11d48'
        : riskLevel === 'moderate'
        ? '#d97706'
        : riskLevel === 'guarded'
        ? '#0284c7'
        : '#059669';

    return `
      <div class="plg-gauge" aria-label="Indeks Kemiripan ${safe}%">
        <svg viewBox="0 0 100 100" width="96" height="96" aria-hidden="true">
          <circle cx="50" cy="50" r="${r}" fill="none" stroke="currentColor" stroke-opacity="0.12" stroke-width="9" />
          <circle
            cx="50"
            cy="50"
            r="${r}"
            fill="none"
            stroke="${stroke}"
            stroke-width="9"
            stroke-linecap="round"
            stroke-dasharray="${circ.toFixed(1)}"
            stroke-dashoffset="${offset.toFixed(1)}"
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div class="plg-gauge-center">
          <strong class="plg-mono" style="color:${stroke}">${safe}%</strong>
          <span>Kemiripan</span>
        </div>
      </div>
    `;
  }

  function renderSelectedSentenceCard() {
    if (!activeReport || selectedSentenceIdx === null) return '';
    const sent = activeReport.annotatedSentences?.[selectedSentenceIdx];
    if (!sent) return '';
    const src = sent.activeSourceRank
      ? activeReport.primarySources.find((s) => s.rank === sent.activeSourceRank)
      : null;

    return `
      <div class="plg-sentence-detail" role="region" aria-label="Detail kalimat terpilih">
        <div class="plg-detail-head">
          <div class="plg-detail-title">
            ${
              src
                ? `<span class="plg-rank-sq" style="background:${escapePlagHtml(src.colorHex)}">${src.rank}</span>`
                : ''
            }
            <strong>${src ? escapePlagHtml(src.title) : 'Kalimat Orisinal / Dikecualikan'}</strong>
          </div>
          <button type="button" class="plg-close-mini" id="plg-close-sent-detail" aria-label="Tutup detail kalimat">×</button>
        </div>
        <p class="plg-detail-quote">"${escapePlagHtml(sent.text)}"</p>
        ${
          sent.match && src
            ? `<div class="plg-detail-meta">
                <span>Skor Kemiripan: <strong class="plg-mono">${Math.round((sent.match.score || 0.7) * 100)}%</strong></span>
                <span aria-hidden="true">·</span>
                <span>Tipe: <strong>${sent.match.matchType === 'exact' ? 'Salinan Persis' : sent.match.matchType === 'near-exact' ? 'Mozaik / Dekat' : sent.match.matchType === 'self-duplicate' ? 'Pengulangan Internal' : 'Parafrase Semantik'}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Mesin: <strong>${escapePlagHtml(src.engine)}</strong></span>
              </div>
              <p class="plg-detail-reason">${escapePlagHtml(sent.match.reason || '')}</p>
              ${
                sent.match.suggestion
                  ? `<div class="plg-detail-suggest"><strong>Saran Perbaikan AI:</strong> ${escapePlagHtml(sent.match.suggestion)}</div>`
                  : ''
              }
              ${
                src.url
                  ? `<a href="${escapePlagHtml(src.url)}" target="_blank" rel="noopener noreferrer" class="plg-source-ext-link">Buka Sumber Asli →</a>`
                  : ''
              }`
            : `<p class="plg-detail-reason">${
                sent.excludedReason === 'bibliography'
                  ? 'Bagian ini masuk daftar pustaka dan dikecualikan oleh filter Turnitin.'
                  : sent.excludedReason === 'quote'
                  ? 'Kalimat ini terdeteksi sebagai kutipan langsung dan dikecualikan oleh filter.'
                  : 'Kalimat ini dinilai unik dan tidak ditemukan salinan identik pada seluruh indeks.'
              }</p>`
        }
      </div>
    `;
  }

  function renderReportSection() {
    if (!activeReport) return '';
    const r = activeReport;
    const sources = r.primarySources || [];

    const manuscriptHtml = (r.annotatedSentences || [])
      .map((s) => {
        const isMatched = Boolean(s.activeSourceRank && s.activeColorHex);
        const isDimmed = selectedSourceRank !== null && s.activeSourceRank !== selectedSourceRank;
        const isSelected = selectedSentenceIdx === s.index;

        if (isMatched) {
          return `<button type="button" class="plg-sent-hl ${isDimmed ? 'is-dimmed' : ''} ${isSelected ? 'is-selected' : ''}" data-plg-sent-idx="${s.index}" style="--hl-color:${escapePlagHtml(s.activeColorHex)};--hl-soft:${escapePlagHtml(s.activeColorSoft)}"><sup class="plg-inline-rank" style="background:${escapePlagHtml(s.activeColorHex)}">${s.activeSourceRank}</sup>${escapePlagHtml(s.text)}</button> `;
        }
        if (s.excludedReason) {
          return `<button type="button" class="plg-sent-plain is-excluded ${isSelected ? 'is-selected' : ''}" data-plg-sent-idx="${s.index}" title="Dikecualikan filter (${escapePlagHtml(s.excludedReason)})">${escapePlagHtml(s.text)}</button> `;
        }
        return `<button type="button" class="plg-sent-plain ${isSelected ? 'is-selected' : ''}" data-plg-sent-idx="${s.index}">${escapePlagHtml(s.text)}</button> `;
      })
      .join('');

    const sidebarTabHtml =
      inspectorTab === 'sources'
        ? `
          <div class="plg-sources-head">
            <span>Daftar Sumber Utama (${sources.length})</span>
            ${
              selectedSourceRank !== null
                ? `<button type="button" class="plg-link-btn" id="plg-clear-source-filter">Tampilkan Semua</button>`
                : ''
            }
          </div>
          ${
            sources.length === 0
              ? `<div class="plg-empty-box">
                  <strong>100% Orisinal</strong>
                  <p>Tidak ditemukan kecocokan sumber plagiarisme signifikan di OpenAlex, Crossref, DOAJ, Wikipedia, maupun analisis semantik Multi-AI.</p>
                </div>`
              : `<div class="plg-source-list">
                  ${sources
                    .map((src) => {
                      const active = selectedSourceRank === src.rank;
                      const catText =
                        src.category === 'publication'
                          ? 'Publication'
                          : src.category === 'student'
                          ? 'Internal Check'
                          : 'Internet Source';
                      const pctText = src.exactPct < 1 ? '&lt;1%' : `${src.percent}%`;
                      return `
                        <button type="button" class="plg-source-item ${active ? 'is-active' : ''}" data-plg-source-rank="${src.rank}">
                          <span class="plg-rank-sq" style="background:${escapePlagHtml(src.colorHex)}">${src.rank}</span>
                          <div class="plg-source-body">
                            <strong>${escapePlagHtml(src.title)}</strong>
                            <span class="plg-source-meta">${escapePlagHtml(catText)} · ${escapePlagHtml(src.engine)} · ${src.matchedWords} kata</span>
                            ${src.url ? `<span class="plg-source-url">${escapePlagHtml(src.url.replace(/^https?:\/\//, '').slice(0, 56))}</span>` : ''}
                          </div>
                          <span class="plg-source-pct plg-mono">${pctText}</span>
                        </button>
                      `;
                    })
                    .join('')}
                </div>`
          }
        `
        : inspectorTab === 'ai'
        ? `
          <div class="plg-ai-panel">
            <div class="plg-ai-score-banner">
              <div>
                <span class="plg-kicker-sm">Turnitin-Style AI Writing Indicator</span>
                <strong class="plg-ai-big plg-mono">${r.aiAnalysis?.aiWritingPct || 0}%</strong>
              </div>
              <p>${escapePlagHtml(r.aiAnalysis?.stylometric?.verdict || '')}</p>
            </div>

            <div class="plg-metric-bars">
              <div class="plg-mbar">
                <div class="plg-mbar-head"><span>Variasi Panjang Kalimat (Burstiness)</span><strong class="plg-mono">${r.aiAnalysis?.stylometric?.burstinessScore ?? 50}/100</strong></div>
                <div class="plg-mbar-track"><div class="plg-mbar-fill" style="width:${r.aiAnalysis?.stylometric?.burstinessScore ?? 50}%"></div></div>
              </div>
              <div class="plg-mbar">
                <div class="plg-mbar-head"><span>Kekayaan Kosakata (Lexical Diversity)</span><strong class="plg-mono">${r.aiAnalysis?.stylometric?.lexicalDiversity ?? 50}/100</strong></div>
                <div class="plg-mbar-track"><div class="plg-mbar-fill" style="width:${r.aiAnalysis?.stylometric?.lexicalDiversity ?? 50}%"></div></div>
              </div>
            </div>

            ${
              (r.aiAnalysis?.modelsUsed || []).length > 0
                ? `<div class="plg-ai-models-note">Konsensus Aktif: <strong>${escapePlagHtml(r.aiAnalysis.modelsUsed.join(' · '))}</strong></div>`
                : ''
            }

            ${
              (r.aiAnalysis?.summaries || []).length > 0
                ? `<div class="plg-ai-summaries">
                    ${r.aiAnalysis.summaries.map((s) => `<p>${escapePlagHtml(s)}</p>`).join('')}
                  </div>`
                : ''
            }

            <div class="plg-recs-box">
              <strong>Rekomendasi Perbaikan &amp; Parafrase</strong>
              <ul>
                ${(r.aiAnalysis?.recommendations || []).map((rec) => `<li>${escapePlagHtml(rec)}</li>`).join('')}
              </ul>
            </div>
          </div>
        `
        : inspectorTab === 'filters'
        ? `
          <div class="plg-filters-panel">
            <p class="plg-filter-intro">Atur pengecualian layaknya panel <strong>Turnitin Filters &amp; Settings</strong>. Persentase kemiripan otomatis dihitung ulang secara instan.</p>

            <label class="plg-toggle-card">
              <input type="checkbox" id="plg-flt-quotes" ${r.filters?.excludeQuotes ? 'checked' : ''} />
              <div>
                <strong>Exclude Quotes (Kecualikan Kutipan)</strong>
                <span>Abaikan teks di dalam tanda petik ("...") agar kutipan resmi tidak menaikkan skor.</span>
              </div>
            </label>

            <label class="plg-toggle-card">
              <input type="checkbox" id="plg-flt-bib" ${r.filters?.excludeBibliography ? 'checked' : ''} />
              <div>
                <strong>Exclude Bibliography (Kecualikan Daftar Pustaka)</strong>
                <span>Abaikan bagian Daftar Pustaka / References di akhir naskah.</span>
              </div>
            </label>

            <div class="plg-small-src-box">
              <label for="plg-flt-small"><strong>Exclude Small Sources (Sumber Kecil)</strong></label>
              <select id="plg-flt-small" class="plg-select">
                <option value="0" ${Number(r.filters?.excludeSmallWords || 0) === 0 ? 'selected' : ''}>Matikan (Tampilkan semua sumber)</option>
                <option value="5" ${Number(r.filters?.excludeSmallWords) === 5 ? 'selected' : ''}>Abaikan sumber &lt; 5 kata</option>
                <option value="10" ${Number(r.filters?.excludeSmallWords) === 10 ? 'selected' : ''}>Abaikan sumber &lt; 10 kata</option>
                <option value="15" ${Number(r.filters?.excludeSmallWords) === 15 ? 'selected' : ''}>Abaikan sumber &lt; 15 kata</option>
              </select>
            </div>
          </div>
        `
        : `
          <div class="plg-history-panel">
            <div class="plg-sources-head">
              <span>Riwayat Pengecekan (${historyList.length})</span>
              ${
                historyList.length > 0
                  ? `<button type="button" class="plg-link-btn" id="plg-clear-history-btn">Hapus Semua</button>`
                  : ''
              }
            </div>
            ${
              historyList.length === 0
                ? `<div class="plg-empty-box"><p>Belum ada riwayat pengecekan tersimpan di browser ini.</p></div>`
                : `<div class="plg-history-list">
                    ${historyList
                      .map(
                        (h) => `
                        <div class="plg-history-row">
                          <div class="plg-history-meta">
                            <strong>${escapePlagHtml(h.fileName)}</strong>
                            <span>${escapePlagHtml(formatShortDate(h.checkedAt))} · ${h.totalWords} kata · ${h.sourcesCount} sumber</span>
                          </div>
                          <span class="plg-history-score plg-mono is-${escapePlagHtml(h.riskLevel || 'low')}">${h.similarityPct}%</span>
                        </div>
                      `
                      )
                      .join('')}
                  </div>`
            }
          </div>
        `;

    return `
      <section class="plg-report-shell" id="plg-report-anchor" aria-label="Laporan Hasil Cek Plagiarisme">
        <div class="plg-report-topbar">
          <div class="plg-report-title-block">
            <span class="plg-kicker-sm">Turnitin-Style Integrated Similarity Report · ${escapePlagHtml(r.submissionId)}</span>
            <h3>${escapePlagHtml(r.fileName)}</h3>
            <div class="plg-meta-inline">
              <span>${r.totalWords.toLocaleString('id-ID')} kata</span>
              <span aria-hidden="true">·</span>
              <span>${r.totalChars.toLocaleString('id-ID')} karakter</span>
              <span aria-hidden="true">·</span>
              <span>${escapePlagHtml(r.language?.label || 'ID')}</span>
              <span aria-hidden="true">·</span>
              <span>${((r.durationMs || 0) / 1000).toFixed(1)} dtk</span>
            </div>
          </div>

          <div class="plg-download-bar">
            <button type="button" class="plg-dl-btn is-primary" id="plg-dl-pdf-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Unduh PDF (Turnitin)</span>
            </button>
            <button type="button" class="plg-dl-btn" id="plg-dl-html-btn">Laporan HTML</button>
            <button type="button" class="plg-dl-btn" id="plg-dl-json-btn">JSON</button>
          </div>
        </div>

        <div class="plg-kpi-strip">
          <div class="plg-kpi-hero">
            ${renderSimilarityGauge(r.similarityPct, r.riskLevel)}
            <div class="plg-kpi-verdict">
              <span class="plg-risk-label is-${escapePlagHtml(r.riskLevel)}">${escapePlagHtml(r.riskLabel)}</span>
              <p>Orisinalitas Naskah: <strong class="plg-mono">${r.uniquePct}%</strong> (${Math.max(0, r.eligibleWords - r.matchedWords)} dari ${r.eligibleWords} kata dinilai unik)</p>
            </div>
          </div>
          <div class="plg-kpi-cells">
            <div class="plg-kpi-cell">
              <strong class="plg-mono is-ocean">${r.internetPct}%</strong>
              <span>Internet Sources</span>
            </div>
            <div class="plg-kpi-cell">
              <strong class="plg-mono is-violet">${r.publicationsPct}%</strong>
              <span>Publications</span>
            </div>
            <div class="plg-kpi-cell">
              <strong class="plg-mono is-emerald">${r.studentPapersPct}%</strong>
              <span>Internal Check</span>
            </div>
            <div class="plg-kpi-cell">
              <strong class="plg-mono is-amber">${r.aiAnalysis?.aiWritingPct || 0}%</strong>
              <span>AI Indicator</span>
            </div>
          </div>
        </div>

        <div class="plg-split-workspace">
          <div class="plg-doc-pane">
            <div class="plg-pane-head">
              <strong>Naskah Teranotasi</strong>
              <span>Klik kalimat berwarna untuk melihat sumber &amp; saran parafrase</span>
            </div>
            ${renderSelectedSentenceCard()}
            <div class="plg-manuscript-view" id="plg-manuscript-view">
              ${manuscriptHtml}
            </div>
          </div>

          <aside class="plg-inspector-pane" aria-label="Panel Inspektor Sumber & Filter Turnitin">
            <div class="plg-inspector-tabs" role="tablist">
              <button type="button" role="tab" class="plg-itab ${inspectorTab === 'sources' ? 'is-active' : ''}" data-plg-itab="sources" aria-selected="${inspectorTab === 'sources'}">Sumber (${sources.length})</button>
              <button type="button" role="tab" class="plg-itab ${inspectorTab === 'ai' ? 'is-active' : ''}" data-plg-itab="ai" aria-selected="${inspectorTab === 'ai'}">AI &amp; Saran</button>
              <button type="button" role="tab" class="plg-itab ${inspectorTab === 'filters' ? 'is-active' : ''}" data-plg-itab="filters" aria-selected="${inspectorTab === 'filters'}">Filter</button>
              <button type="button" role="tab" class="plg-itab ${inspectorTab === 'history' ? 'is-active' : ''}" data-plg-itab="history" aria-selected="${inspectorTab === 'history'}">Riwayat</button>
            </div>
            <div class="plg-inspector-body">
              ${sidebarTabHtml}
            </div>
          </aside>
        </div>

        ${
          (r.engineStatuses || []).length > 0
            ? `<div class="plg-engines-footer">
                <div class="plg-pane-head">
                  <strong>Status Integrasi Multi-Mesin pada Laporan Ini</strong>
                  <span>Seluruh mesin berjalan serentak &amp; digabungkan dalam 1 skor terpadu</span>
                </div>
                <div class="plg-engine-grid">${renderEngineGridItems(r.engineStatuses)}</div>
              </div>`
            : ''
        }
      </section>
    `;
  }

  function renderApiModal() {
    if (!apiModalOpen) return '';
    const syncedAiKeys = loadStoredByokKeys().filter((k) => k.enabled && k.apiKey);
    return `
      <div class="plg-modal-backdrop" id="plg-api-backdrop" role="dialog" aria-modal="true" aria-labelledby="plg-api-modal-title">
        <div class="plg-modal-card">
          <div class="plg-modal-head">
            <h3 id="plg-api-modal-title">Pengaturan Integrasi API Turnitin &amp; Multi-AI</h3>
            <button type="button" class="plg-close-mini" id="plg-api-close" aria-label="Tutup pengaturan API">×</button>
          </div>
          <p class="plg-modal-desc">
            Secara bawaan, seluruh mesin gratis terpadu (<strong>OpenAlex 250M+</strong>, <strong>Crossref 150M+</strong>, <strong>DOAJ</strong>, <strong>Wikipedia ID/EN</strong>, <strong>Winnowing Lokal</strong>, dan <strong>Multi-AI Ensemble ChatGPT/Gemini/Claude/DeepSeek/Grok</strong>) sudah aktif otomatis tanpa API key.
            Anda juga dapat menghubungkan kunci <strong>Turnitin Core API (TCA)</strong> atau endpoint institusional di bawah ini agar ikut berjalan serentak bersama semua mesin lainnya.
          </p>

          <div class="plg-field-group">
            <label for="plg-cfg-tca-url">Turnitin Core API / Institutional Endpoint URL (Opsional)</label>
            <input id="plg-cfg-tca-url" type="url" placeholder="https://your-institution.turnitin.com/api/v1/submissions" value="${escapePlagHtml(apiConfig.turnitinEndpoint)}" />
          </div>
          <div class="plg-field-group">
            <label for="plg-cfg-tca-key">Turnitin Bearer API Key (Disimpan lokal di browser Anda)</label>
            <input id="plg-cfg-tca-key" type="password" autocomplete="off" placeholder="Masukkan Turnitin Core API Key..." value="${escapePlagHtml(apiConfig.turnitinApiKey)}" />
          </div>
          <div class="plg-field-group">
            <label for="plg-cfg-tca-inst">Institution / Tenant ID (Opsional)</label>
            <input id="plg-cfg-tca-inst" type="text" placeholder="Contoh: univ-id-2026" value="${escapePlagHtml(apiConfig.turnitinInstitutionId)}" />
          </div>

          <div class="plg-sync-info">
            <strong>Sinkronisasi API Key Manifest AI:</strong>
            <span>${syncedAiKeys.length > 0 ? `${syncedAiKeys.length} kunci pribadi aktif ikut digunakan untuk analisis parafrase Multi-AI.` : 'Menggunakan jalur gratis Multi-AI otomatis (dapat tambah API Key pribadi di menu Manifest AI).'}</span>
          </div>

          <div class="plg-modal-actions">
            <button type="button" class="plg-btn-secondary" id="plg-api-reset">Reset</button>
            <button type="button" class="plg-btn-primary" id="plg-api-save">Simpan Konfigurasi</button>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    if (!hostEl || !mounted) return;
    const words = countWords(inputText);
    const chars = inputText.length;
    const sentCount = inputText.trim() ? segmentDocumentSentences(inputText).length : 0;
    const detectedLang = inputText.trim() ? detectDocumentLanguage(inputText).label : 'Otomatis';
    const hasTurnitinKey = Boolean(apiConfig.turnitinEndpoint && apiConfig.turnitinApiKey);

    hostEl.innerHTML = `
      <div class="plg-studio">
        <div class="plg-studio-head">
          <div class="plg-head-copy">
            <h3>Cek Plagiarisme Terpadu Multi-Mesin</h3>
            <p>Unggah semua jenis berkas atau tempel naskah untuk dipindai serentak oleh OpenAlex, Crossref, DOAJ, Wikipedia, Multi-AI (ChatGPT · Gemini · Claude · DeepSeek · Grok), &amp; Turnitin API.</p>
          </div>
          <div class="plg-head-actions">
            <button type="button" class="plg-btn-secondary" id="plg-demo-btn" ${scanning ? 'disabled' : ''}>Contoh Naskah Uji</button>
            <button type="button" class="plg-btn-secondary ${hasTurnitinKey ? 'is-connected' : ''}" id="plg-open-api-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              <span>${hasTurnitinKey ? 'Turnitin API Aktif' : 'API & Turnitin'}</span>
            </button>
          </div>
        </div>

        <div class="plg-input-card">
          <label class="plg-dropzone ${extractingFile ? 'is-busy' : ''}" id="plg-dropzone" for="plg-file-input">
            <input id="plg-file-input" type="file" accept="*/*" hidden ${scanning || extractingFile ? 'disabled' : ''} />
            <div class="plg-drop-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div class="plg-drop-text">
              <strong id="plg-extract-label">${extractingFile ? escapePlagHtml(extractLabel) : 'Tarik & lepas atau pilih SEMUA jenis file dokumen'}</strong>
              <span>Mendukung PDF, DOCX, DOC, PPTX, XLSX, CSV, ODT, EPUB, RTF, HTML, TXT, Markdown, Kode, hingga Gambar (OCR)</span>
              ${
                uploadedFileNote
                  ? `<span class="plg-file-loaded">Berkas aktif: <b>${escapePlagHtml(fileName)}</b> (${escapePlagHtml(fileFormat)}) · ${escapePlagHtml(uploadedFileNote)}</span>`
                  : ''
              }
            </div>
          </label>

          <div class="plg-editor-wrap">
            <div class="plg-editor-bar">
              <label for="plg-textarea">Tempel atau sunting naskah di sini</label>
              <div class="plg-editor-stats plg-mono">
                <span id="plg-stat-words">${words.toLocaleString('id-ID')} kata</span>
                <span aria-hidden="true">·</span>
                <span id="plg-stat-chars">${chars.toLocaleString('id-ID')} karakter</span>
                <span aria-hidden="true">·</span>
                <span>${sentCount} kalimat</span>
                <span aria-hidden="true">·</span>
                <span>${escapePlagHtml(detectedLang)}</span>
              </div>
            </div>
            <textarea
              id="plg-textarea"
              class="plg-textarea"
              rows="8"
              placeholder="Tempel paragraf makalah, skripsi, jurnal, esai, artikel blog, atau unggah dokumen apa saja di atas..."
              ${scanning ? 'disabled' : ''}
            >${escapePlagHtml(inputText)}</textarea>
          </div>

          <div class="plg-options-bar">
            <div class="plg-option-item">
              <label for="plg-opt-mode">Kedalaman</label>
              <select id="plg-opt-mode" class="plg-select" ${scanning ? 'disabled' : ''}>
                <option value="standard" ${scanOptions.mode === 'standard' ? 'selected' : ''}>Standar Terpadu (Cepat)</option>
                <option value="deep" ${scanOptions.mode === 'deep' ? 'selected' : ''}>Mendalam (Multi-AI 3 Model + 7 Query)</option>
              </select>
            </div>
            <div class="plg-option-item">
              <label for="plg-opt-lang">Bahasa</label>
              <select id="plg-opt-lang" class="plg-select" ${scanning ? 'disabled' : ''}>
                <option value="auto" ${scanOptions.language === 'auto' ? 'selected' : ''}>Deteksi Otomatis</option>
                <option value="id" ${scanOptions.language === 'id' ? 'selected' : ''}>Bahasa Indonesia</option>
                <option value="en" ${scanOptions.language === 'en' ? 'selected' : ''}>English</option>
              </select>
            </div>
            <label class="plg-check-inline">
              <input type="checkbox" id="plg-opt-quotes" ${scanOptions.excludeQuotes ? 'checked' : ''} ${scanning ? 'disabled' : ''} />
              <span>Kecualikan Kutipan</span>
            </label>
            <label class="plg-check-inline">
              <input type="checkbox" id="plg-opt-bib" ${scanOptions.excludeBibliography ? 'checked' : ''} ${scanning ? 'disabled' : ''} />
              <span>Kecualikan Daftar Pustaka</span>
            </label>
          </div>

          <div class="plg-action-footer">
            <button type="button" class="plg-btn-secondary" id="plg-clear-btn" ${scanning || !inputText ? 'disabled' : ''}>Bersihkan</button>
            ${
              scanning
                ? `<button type="button" class="plg-btn-danger" id="plg-cancel-btn">Batalkan Pengecekan</button>`
                : `<button type="button" class="plg-btn-primary" id="plg-run-btn" ${words < 10 ? 'disabled' : ''}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><path d="m8.5 11 1.8 1.8 3.5-3.6"/></svg>
                    <span>Cek Plagiarisme Sekarang</span>
                  </button>`
            }
          </div>
        </div>

        ${
          scanning
            ? `<section class="plg-progress-panel" role="status" aria-live="polite" aria-label="Progres pengecekan plagiarisme">
                <div class="plg-progress-top">
                  <div>
                    <strong id="plg-progress-label">${escapePlagHtml(progressLabel)}</strong>
                    <span class="plg-elapsed-line">Waktu berjalan: <b id="plg-elapsed-val" class="plg-mono">0.0 dtk</b></span>
                  </div>
                  <strong class="plg-progress-pct plg-mono" id="plg-progress-pct">${Math.round(progressPct)}%</strong>
                </div>
                <div class="plg-progress-track">
                  <div class="plg-progress-fill" id="plg-progress-fill" style="width:${Math.min(100, Math.max(0, progressPct))}%"></div>
                </div>
                <div class="plg-engine-grid" id="plg-engine-grid">
                  ${renderEngineGridItems(progressEngines)}
                </div>
              </section>`
            : ''
        }

        ${renderReportSection()}
        ${renderApiModal()}
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    if (!hostEl) return;

    // File input & Drag/Drop
    hostEl.querySelector('#plg-file-input')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) handleFileSelect(f);
    });
    const dz = hostEl.querySelector('#plg-dropzone');
    if (dz) {
      dz.addEventListener('dragover', (e) => {
        e.preventDefault();
        dz.classList.add('is-dragover');
      });
      dz.addEventListener('dragleave', () => dz.classList.remove('is-dragover'));
      dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('is-dragover');
        const f = e.dataTransfer?.files?.[0];
        if (f) handleFileSelect(f);
      });
    }

    // Paste text live stats without re-rendering full DOM while typing
    const ta = hostEl.querySelector('#plg-textarea');
    if (ta) {
      ta.addEventListener('input', () => {
        inputText = ta.value;
        if (!uploadedFileNote) {
          fileName = 'Naskah_Tempel_Langsung.txt';
          fileFormat = 'TEXT';
          fileSize = inputText.length;
        }
        const w = countWords(inputText);
        const wEl = hostEl.querySelector('#plg-stat-words');
        const cEl = hostEl.querySelector('#plg-stat-chars');
        const runBtn = hostEl.querySelector('#plg-run-btn');
        const clrBtn = hostEl.querySelector('#plg-clear-btn');
        if (wEl) wEl.textContent = `${w.toLocaleString('id-ID')} kata`;
        if (cEl) cEl.textContent = `${inputText.length.toLocaleString('id-ID')} karakter`;
        if (runBtn) runBtn.disabled = w < 10;
        if (clrBtn) clrBtn.disabled = !inputText;
      });
    }

    // Demo sample & clear
    hostEl.querySelector('#plg-demo-btn')?.addEventListener('click', () => {
      inputText = PLAGIARISM_DEMO_TEXT;
      fileName = 'Contoh_Makalah_AI_Pendidikan_2026.docx';
      fileFormat = 'DEMO DOCX';
      fileSize = inputText.length;
      uploadedFileNote = 'Naskah contoh uji campuran (salinan Wikipedia ID/EN + tulisan asli + kutipan + daftar pustaka).';
      activeReport = null;
      render();
      onToast('Contoh naskah uji dimuat — klik "Cek Plagiarisme Sekarang" untuk melihat laporan Turnitin.');
    });

    hostEl.querySelector('#plg-clear-btn')?.addEventListener('click', () => {
      inputText = '';
      fileName = 'Naskah_Tempel_Langsung.txt';
      fileFormat = 'TEXT';
      fileSize = 0;
      uploadedFileNote = '';
      activeReport = null;
      selectedSourceRank = null;
      selectedSentenceIdx = null;
      render();
    });

    // Scan options
    hostEl.querySelector('#plg-opt-mode')?.addEventListener('change', (e) => {
      scanOptions.mode = e.target.value || 'standard';
    });
    hostEl.querySelector('#plg-opt-lang')?.addEventListener('change', (e) => {
      scanOptions.language = e.target.value || 'auto';
    });
    hostEl.querySelector('#plg-opt-quotes')?.addEventListener('change', (e) => {
      scanOptions.excludeQuotes = Boolean(e.target.checked);
    });
    hostEl.querySelector('#plg-opt-bib')?.addEventListener('change', (e) => {
      scanOptions.excludeBibliography = Boolean(e.target.checked);
    });

    // Run / Cancel
    hostEl.querySelector('#plg-run-btn')?.addEventListener('click', handleStartCheck);
    hostEl.querySelector('#plg-cancel-btn')?.addEventListener('click', handleCancelCheck);

    // Report downloads
    hostEl.querySelector('#plg-dl-pdf-btn')?.addEventListener('click', handleDownloadPdf);
    hostEl.querySelector('#plg-dl-html-btn')?.addEventListener('click', handleDownloadHtml);
    hostEl.querySelector('#plg-dl-json-btn')?.addEventListener('click', handleDownloadJson);

    // Inspector tabs
    hostEl.querySelectorAll('[data-plg-itab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        inspectorTab = btn.getAttribute('data-plg-itab') || 'sources';
        render();
      });
    });

    // Source rank filter click
    hostEl.querySelectorAll('[data-plg-source-rank]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rank = Number(btn.getAttribute('data-plg-source-rank'));
        selectedSourceRank = selectedSourceRank === rank ? null : rank;
        render();
      });
    });
    hostEl.querySelector('#plg-clear-source-filter')?.addEventListener('click', () => {
      selectedSourceRank = null;
      render();
    });

    // Sentence click to inspect
    hostEl.querySelectorAll('[data-plg-sent-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-plg-sent-idx'));
        selectedSentenceIdx = selectedSentenceIdx === idx ? null : idx;
        render();
      });
    });
    hostEl.querySelector('#plg-close-sent-detail')?.addEventListener('click', () => {
      selectedSentenceIdx = null;
      render();
    });

    // Live Turnitin Filter recalculation
    const reapplyFilters = (patch) => {
      if (!activeReport) return;
      scanOptions = { ...scanOptions, ...patch };
      activeReport = applyReportFilters(activeReport, scanOptions);
      selectedSourceRank = null;
      render();
      onToast(`Filter diterapkan · Indeks Kemiripan diperbarui menjadi ${activeReport.similarityPct}%.`);
    };
    hostEl.querySelector('#plg-flt-quotes')?.addEventListener('change', (e) => {
      reapplyFilters({ excludeQuotes: Boolean(e.target.checked) });
    });
    hostEl.querySelector('#plg-flt-bib')?.addEventListener('change', (e) => {
      reapplyFilters({ excludeBibliography: Boolean(e.target.checked) });
    });
    hostEl.querySelector('#plg-flt-small')?.addEventListener('change', (e) => {
      reapplyFilters({ excludeSmallWords: Number(e.target.value) || 0 });
    });

    // History clear
    hostEl.querySelector('#plg-clear-history-btn')?.addEventListener('click', () => {
      clearPlagiarismHistory();
      historyList = [];
      render();
      onToast('Riwayat pengecekan plagiarisme dibersihkan.');
    });

    // API Modal
    hostEl.querySelector('#plg-open-api-btn')?.addEventListener('click', () => {
      apiModalOpen = true;
      render();
    });
    hostEl.querySelector('#plg-api-close')?.addEventListener('click', () => {
      apiModalOpen = false;
      render();
    });
    hostEl.querySelector('#plg-api-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'plg-api-backdrop') {
        apiModalOpen = false;
        render();
      }
    });
    hostEl.querySelector('#plg-api-save')?.addEventListener('click', () => {
      apiConfig = {
        ...apiConfig,
        turnitinEndpoint: String(hostEl.querySelector('#plg-cfg-tca-url')?.value || '').trim(),
        turnitinApiKey: String(hostEl.querySelector('#plg-cfg-tca-key')?.value || '').trim(),
        turnitinInstitutionId: String(hostEl.querySelector('#plg-cfg-tca-inst')?.value || '').trim(),
      };
      savePlagiarismApiConfig(apiConfig);
      apiModalOpen = false;
      render();
      onToast('Konfigurasi API Turnitin & Integrasi disimpan.');
    });
    hostEl.querySelector('#plg-api-reset')?.addEventListener('click', () => {
      apiConfig = {
        turnitinEndpoint: '',
        turnitinApiKey: '',
        turnitinInstitutionId: '',
        customPlagEndpoint: '',
        customPlagApiKey: '',
      };
      savePlagiarismApiConfig(apiConfig);
      apiModalOpen = false;
      render();
      onToast('Konfigurasi API dikembalikan ke mode bawaan gratis terpadu.');
    });
  }

  return {
    mount(el) {
      hostEl = el;
      mounted = true;
      apiConfig = loadPlagiarismApiConfig();
      historyList = loadPlagiarismHistory();
      render();
    },
    unmount() {
      handleCancelCheck();
      stopElapsedTimer();
      mounted = false;
      hostEl = null;
    },
    redrawTheme() {
      if (mounted) render();
    },
  };
}
