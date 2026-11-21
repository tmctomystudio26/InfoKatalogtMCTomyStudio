/**
 * Manifestudio Integrated Plagiarism Checker UI Controller (v69 — Authentic Original-Document & Fullscreen Studio)
 * - Instant File Upload (0ms pre-scan waiting!): selecting/dropping ANY file immediately enables
 *   "Cek Plagiarisme Sekarang" — extraction, OCR, and 6-engine parallel scan run inside ONE progress bar.
 * - Upload File mode hides the text editor completely.
 * - Real Original Document Multi-Page Viewer (replaces plain-text "Naskah Teranotasi"):
 *   - Displays actual original PDF / Scanned PDF / Image / Rich DOCX A4 pages preserving exact letterhead,
 *     tables, fonts, images & layout, scrollable page-by-page with Zoom & Layar Penuh (Fullscreen) mode.
 *   - Translucent color-coded plagiarism highlights & left-margin circular numbered badges (1, 2, ...).
 * - Direct Downloads prefixed with "Report_": Authentic Original-Document PDF (`Unduh PDF (Standar Report)`),
 *   Interactive HTML, & JSON Audit. Strict NO REPOSITORY mode.
 */

import {
  PLAGIARISM_DEMO_TEXT,
  applyReportFilters,
  buildPlagiarismDownloadFilename,
  countWords,
  detectDocumentLanguage,
  escapePlagHtml,
  mapAnnotatedSentencesToPageHighlights,
  segmentDocumentSentences,
} from './plagiarism-logic.js?v=69';
import {
  clearPlagiarismHistory,
  loadPlagiarismApiConfig,
  loadPlagiarismHistory,
  runIntegratedPlagiarismCheck,
  savePlagiarismApiConfig,
} from './plagiarism-engine.js?v=69';
import {
  annotateBlockTextSegments,
  generateTurnitinHtmlReport,
  generateTurnitinJsonReport,
  generateTurnitinPdfBlobAsync,
} from './plagiarism-report.js?v=69';
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

function formatFileSizeKb(bytes = 0) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
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

function detectQuickFileFormat(file) {
  const name = String(file?.name || '');
  const idx = name.lastIndexOf('.');
  const ext = idx !== -1 ? name.slice(idx + 1).toUpperCase() : '';
  if (ext) return ext;
  const mime = String(file?.type || '').toLowerCase();
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('word')) return 'DOCX';
  if (mime.startsWith('image/')) return 'IMAGE';
  return 'FILE';
}

export function createPlagiarismController({ onToast = () => {} } = {}) {
  let hostEl = null;
  let mounted = false;

  // Input state (ZERO pre-scan wait: pendingFile is held directly until user clicks "Cek Plagiarisme Sekarang")
  let inputMode = 'upload'; // 'upload' | 'paste'
  let pendingFile = null;
  let inputText = '';
  let fileName = 'Naskah_Tempel_Langsung.txt';
  let fileFormat = 'TEXT';
  let fileSize = 0;

  // Scan options
  let scanOptions = {
    language: 'auto',
    mode: 'standard',
    excludeQuotes: false,
    excludeBibliography: true,
    excludeSmallWords: 0,
  };

  // Unified scanning progress state
  let scanning = false;
  let progressPct = 0;
  let progressLabel = '';
  let progressEngines = [];
  let scanStartedAt = 0;
  let elapsedTimer = null;
  let activeAbort = null;

  // Report & Original-Document Viewer state
  let activeReport = null;
  let inspectorTab = 'sources'; // 'sources' | 'ai' | 'filters' | 'history'
  let selectedSourceRank = null;
  let selectedSentenceIdx = null;
  let viewerFullscreen = false;
  let viewerZoom = 100; // 75..150 (%)
  let currentVisiblePage = 1;
  let generatingPdf = false;
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

  function syncFullscreenBodyLock() {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('plg-fs-lock', Boolean(viewerFullscreen && activeReport));
  }

  function handleGlobalKeydown(e) {
    if (e.key === 'Escape' && viewerFullscreen) {
      viewerFullscreen = false;
      syncFullscreenBodyLock();
      render();
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
            ? 'Berjalan...'
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

  /**
   * INSTANT file selection (0ms wait — just like Turnitin!):
   * Stores the File object and immediately enables "Cek Plagiarisme Sekarang".
   */
  function handleFileSelect(file) {
    if (!file || scanning) return;
    inputMode = 'upload';
    pendingFile = file;
    fileName = file.name || 'Dokumen_Unggahan';
    fileFormat = detectQuickFileFormat(file);
    fileSize = Number(file.size) || 0;
    activeReport = null;
    selectedSourceRank = null;
    selectedSentenceIdx = null;
    viewerFullscreen = false;
    currentVisiblePage = 1;
    syncFullscreenBodyLock();
    render();
    onToast(`Berkas "${fileName}" siap — langsung klik "Cek Plagiarisme Sekarang" (No Repository).`);
  }

  async function handleStartCheck() {
    if (scanning) return;
    if (inputMode === 'upload') {
      if (!pendingFile) {
        onToast('Pilih berkas dokumen terlebih dahulu untuk memulai pengecekan.');
        return;
      }
    } else {
      const words = countWords(inputText);
      if (words < 10) {
        onToast('Masukkan minimal 10 kata atau klik "Contoh Naskah Uji" untuk memulai pengecekan.');
        return;
      }
    }

    scanning = true;
    progressPct = 3;
    progressLabel =
      inputMode === 'upload' && pendingFile
        ? `Membaca berkas asli "${pendingFile.name}" & meluncurkan pengecekan terpadu...`
        : 'Menginisialisasi mesin deteksi plagiarisme terpadu...';
    progressEngines = [];
    selectedSourceRank = null;
    selectedSentenceIdx = null;
    viewerFullscreen = false;
    currentVisiblePage = 1;
    syncFullscreenBodyLock();
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
        file: inputMode === 'upload' ? pendingFile : null,
        text: inputMode === 'paste' ? inputText : '',
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
      currentVisiblePage = 1;
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

  async function handleDownloadPdf() {
    if (!activeReport || generatingPdf) return;
    generatingPdf = true;
    const btn = hostEl?.querySelector('#plg-dl-pdf-btn');
    if (btn) {
      btn.disabled = true;
      const span = btn.querySelector('span');
      if (span) span.textContent = 'Menyusun PDF Dokumen Asli...';
    }
    try {
      const blob = await generateTurnitinPdfBlobAsync(activeReport);
      const outName = buildPlagiarismDownloadFilename(activeReport.fileName, activeReport.similarityPct, 'pdf');
      triggerBlobDownload(blob, outName);
      onToast(`PDF Standar Report berhasil diunduh (${outName}).`);
    } catch {
      onToast('Gagal membuat PDF. Coba unduh versi Laporan HTML.');
    } finally {
      generatingPdf = false;
      render();
    }
  }

  function handleDownloadHtml() {
    if (!activeReport) return;
    const html = generateTurnitinHtmlReport(activeReport);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const outName = buildPlagiarismDownloadFilename(activeReport.fileName, activeReport.similarityPct, 'html');
    triggerBlobDownload(blob, outName);
    onToast(`Laporan HTML berhasil diunduh (${outName}).`);
  }

  function handleDownloadJson() {
    if (!activeReport) return;
    const json = generateTurnitinJsonReport(activeReport);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const outName = buildPlagiarismDownloadFilename(activeReport.fileName, activeReport.similarityPct, 'json');
    triggerBlobDownload(blob, outName);
    onToast(`Data audit JSON berhasil diekspor (${outName}).`);
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
      <div class="plg-sentence-detail" role="region" aria-label="Detail kecocokan terpilih">
        <div class="plg-detail-head">
          <div class="plg-detail-title">
            ${
              src
                ? `<span class="plg-rank-sq" style="background:${escapePlagHtml(src.colorHex)}">${src.rank}</span>`
                : ''
            }
            <strong>${src ? escapePlagHtml(src.title) : 'Bagian Orisinal / Dikecualikan'}</strong>
          </div>
          <button type="button" class="plg-close-mini" id="plg-close-sent-detail" aria-label="Tutup detail kecocokan">×</button>
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
                  ? 'Bagian ini masuk daftar pustaka dan dikecualikan oleh filter.'
                  : sent.excludedReason === 'quote'
                  ? 'Kalimat ini terdeteksi sebagai kutipan langsung dan dikecualikan oleh filter.'
                  : 'Bagian ini dinilai unik dan tidak ditemukan salinan identik pada seluruh indeks.'
              }</p>`
        }
      </div>
    `;
  }

  /**
   * Renders the REAL Original Document Multi-Page Viewer (PDF/Scan images with highlight overlays
   * & left-margin circular badges, OR formatted DOCX/A4 pages with headings, tables & images).
   */
  function renderOriginalDocumentPages(report) {
    const orig = report.originalSource || null;
    const pages = Array.isArray(orig?.pages) ? orig.pages : [];
    const totalPages = orig?.pageCount || pages.length || 1;
    const hasImagePages = pages.some((p) => p.imageDataUrl);
    const zoomScale = viewerZoom / 100;

    if (hasImagePages) {
      let hlByPage = report.pageHighlights || null;
      if (!hlByPage && pages.some((p) => Array.isArray(p.spans) && p.spans.length > 0)) {
        hlByPage = Object.fromEntries(mapAnnotatedSentencesToPageHighlights(pages, report.annotatedSentences || []).entries());
      }
      hlByPage = hlByPage || {};

      return pages
        .map((pg) => {
          const hl = hlByPage[pg.pageNumber] || hlByPage[String(pg.pageNumber)] || { rects: [], badges: [] };
          const rectsHtml = (hl.rects || [])
            .map((rect) => {
              const isDimmed = selectedSourceRank !== null && rect.rank !== selectedSourceRank;
              const isSelected = selectedSentenceIdx === rect.sentenceIndex;
              return `<button
                type="button"
                class="plg-hl-rect ${isDimmed ? 'is-dimmed' : ''} ${isSelected ? 'is-selected' : ''}"
                data-plg-sent-idx="${rect.sentenceIndex}"
                data-plg-hl-rank="${rect.rank}"
                aria-label="Sumber nomor ${rect.rank} halaman ${pg.pageNumber}"
                style="left:${(rect.x * 100).toFixed(3)}%;top:${(rect.y * 100).toFixed(3)}%;width:${(rect.w * 100).toFixed(3)}%;height:${(rect.h * 100).toFixed(3)}%;--hl-color:${escapePlagHtml(rect.colorHex)}"
              ></button>`;
            })
            .join('');

          const badgesHtml = (hl.badges || [])
            .map((b) => {
              const isDimmed = selectedSourceRank !== null && b.rank !== selectedSourceRank;
              const isSelected = selectedSentenceIdx === b.sentenceIndex;
              return `<button
                type="button"
                class="plg-margin-badge ${isDimmed ? 'is-dimmed' : ''} ${isSelected ? 'is-selected' : ''}"
                data-plg-sent-idx="${b.sentenceIndex}"
                data-plg-hl-rank="${b.rank}"
                aria-label="Inspeksi sumber ${b.rank} di halaman ${pg.pageNumber}"
                style="top:${(b.y * 100).toFixed(2)}%;background:${escapePlagHtml(b.colorHex)}"
              >${b.rank}</button>`;
            })
            .join('');

          return `
            <article class="plg-orig-page-card" data-plg-page="${pg.pageNumber}" style="--plg-zoom:${zoomScale.toFixed(2)}">
              <div class="plg-orig-page-head">
                <span class="plg-mono">Halaman ${pg.pageNumber} / ${totalPages}</span>
                <span>Dokumen Asli · Tata Letak Dipertahankan</span>
              </div>
              <div class="plg-orig-page-body">
                <div class="plg-orig-page-gutter" aria-label="Nomor sumber margin kiri halaman ${pg.pageNumber}">
                  ${badgesHtml}
                </div>
                <div class="plg-orig-page-canvas-wrap">
                  <img
                    class="plg-orig-page-img"
                    src="${pg.imageDataUrl}"
                    alt="Halaman asli ${pg.pageNumber} dari ${escapePlagHtml(report.fileName)}"
                    loading="lazy"
                  />
                  <div class="plg-orig-hl-layer">
                    ${rectsHtml}
                  </div>
                </div>
              </div>
            </article>
          `;
        })
        .join('');
    }

    // Rich DOCX / Paginated A4 Document Sheets (never a raw flat text box)
    const sheetPages =
      pages.length > 0
        ? pages
        : [{ pageNumber: 1, blocks: (report.annotatedSentences || []).map((s) => ({ type: 'paragraph', plain: s.text })) }];

    return sheetPages
      .map((pg) => {
        const blocksHtml = (pg.blocks || [])
          .map((block) => {
            if (block.type === 'table' && Array.isArray(block.rows)) {
              const rowsHtml = block.rows
                .map(
                  (row, ri) =>
                    `<tr>${row
                      .map((cell) => {
                        const cellSegs = annotateBlockTextSegments(cell || '', report.annotatedSentences || []);
                        const cellInner = cellSegs
                          .map((sg) => {
                            if (!sg.matched) return escapePlagHtml(sg.text);
                            const isDim = selectedSourceRank !== null && sg.rank !== selectedSourceRank;
                            const isSel = selectedSentenceIdx === sg.sentenceIndex;
                            return `<button type="button" class="plg-rich-hl ${isDim ? 'is-dimmed' : ''} ${isSel ? 'is-selected' : ''}" data-plg-sent-idx="${sg.sentenceIndex}" data-plg-hl-rank="${sg.rank}" style="--hl-color:${escapePlagHtml(sg.colorHex)};--hl-soft:${escapePlagHtml(sg.colorSoft)}"><span class="plg-rich-pill" style="background:${escapePlagHtml(sg.colorHex)}">${sg.rank}</span>${escapePlagHtml(sg.text)}</button>`;
                          })
                          .join('');
                        return ri === 0 ? `<th>${cellInner}</th>` : `<td>${cellInner}</td>`;
                      })
                      .join('')}</tr>`
                )
                .join('');
              return `<div class="plg-rich-tbl-wrap"><table class="plg-rich-tbl">${rowsHtml}</table></div>`;
            }

            const imgsHtml = (block.runs || [])
              .filter((r) => r.type === 'image' && r.src)
              .map((r) => `<img class="plg-rich-img" src="${r.src}" alt="Gambar dokumen asli" loading="lazy" />`)
              .join('');

            const segs = annotateBlockTextSegments(block.plain || '', report.annotatedSentences || []);
            const inner = segs
              .map((sg) => {
                if (!sg.matched) return escapePlagHtml(sg.text);
                const isDim = selectedSourceRank !== null && sg.rank !== selectedSourceRank;
                const isSel = selectedSentenceIdx === sg.sentenceIndex;
                return `<button type="button" class="plg-rich-hl ${isDim ? 'is-dimmed' : ''} ${isSel ? 'is-selected' : ''}" data-plg-sent-idx="${sg.sentenceIndex}" data-plg-hl-rank="${sg.rank}" style="--hl-color:${escapePlagHtml(sg.colorHex)};--hl-soft:${escapePlagHtml(sg.colorSoft)}"><span class="plg-rich-pill" style="background:${escapePlagHtml(sg.colorHex)}">${sg.rank}</span>${escapePlagHtml(sg.text)}</button>`;
              })
              .join('');

            const alignStyle = block.align ? ` style="text-align:${escapePlagHtml(block.align)}"` : '';
            if (block.type === 'heading') {
              const tag = block.level === 1 ? 'h4' : 'h5';
              return `${imgsHtml}<${tag} class="plg-rich-h is-lvl-${block.level || 2}"${alignStyle}>${inner}</${tag}>`;
            }
            if (block.type === 'list-item') {
              return `${imgsHtml}<p class="plg-rich-li"${alignStyle}>• ${inner}</p>`;
            }
            return `${imgsHtml}<p class="plg-rich-p"${alignStyle}>${inner}</p>`;
          })
          .join('');

        return `
          <article class="plg-orig-page-card" data-plg-page="${pg.pageNumber}" style="--plg-zoom:${zoomScale.toFixed(2)}">
            <div class="plg-orig-page-head">
              <span class="plg-mono">Halaman ${pg.pageNumber} / ${sheetPages.length}</span>
              <span>${orig?.kind === 'docx-rich' ? 'Dokumen Word Asli · Format Dipertahankan' : 'Lembar Dokumen A4'}</span>
            </div>
            <div class="plg-rich-a4-page">
              ${blocksHtml}
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderReportSection() {
    if (!activeReport) return '';
    const r = activeReport;
    const sources = r.primarySources || [];
    const totalPages = r.originalSource?.pageCount || r.originalSource?.pages?.length || 1;

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
                <span class="plg-kicker-sm">AI Writing Indicator</span>
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
            <p class="plg-filter-intro">Atur pengecualian laporan. Persentase kemiripan &amp; sorotan warna pada halaman dokumen asli otomatis diperbarui instan.</p>

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
      <section class="plg-report-shell ${viewerFullscreen ? 'is-fullscreen' : ''}" id="plg-report-anchor" aria-label="Laporan Hasil Cek Plagiarisme">
        <div class="plg-report-topbar">
          <div class="plg-report-title-block">
            <span class="plg-kicker-sm">Standar Similarity Report · No Repository · ${escapePlagHtml(r.submissionId)}</span>
            <h3>${escapePlagHtml(r.fileName)}</h3>
            <div class="plg-meta-inline">
              <span>${totalPages} hal</span>
              <span aria-hidden="true">·</span>
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
            <button type="button" class="plg-dl-btn is-primary" id="plg-dl-pdf-btn" ${generatingPdf ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>${generatingPdf ? 'Menyusun PDF Dokumen Asli...' : 'Unduh PDF (Standar Report)'}</span>
            </button>
            <button type="button" class="plg-dl-btn" id="plg-dl-html-btn">Laporan HTML</button>
            <button type="button" class="plg-dl-btn" id="plg-dl-json-btn">JSON</button>
            ${
              viewerFullscreen
                ? `<button type="button" class="plg-dl-btn is-fs-exit" id="plg-fs-top-exit">Keluar Full</button>`
                : ''
            }
          </div>
        </div>

        ${
          viewerFullscreen
            ? ''
            : `<div class="plg-kpi-strip">
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
              </div>`
        }

        <div class="plg-split-workspace">
          <div class="plg-doc-viewer" aria-label="Penampil Dokumen Asli Beranotasi">
            <div class="plg-viewer-bar">
              <div class="plg-viewer-title">
                <strong>Dokumen Asli Beranotasi</strong>
                <span class="plg-page-counter plg-mono" id="plg-page-counter">Hal ${Math.min(currentVisiblePage, totalPages)} / ${totalPages}</span>
              </div>
              <div class="plg-viewer-controls">
                <div class="plg-zoom-group" role="group" aria-label="Zoom halaman dokumen">
                  <button type="button" class="plg-vbtn" id="plg-zoom-out" aria-label="Perkecil tampilan" ${viewerZoom <= 75 ? 'disabled' : ''}>−</button>
                  <span class="plg-zoom-val plg-mono">${viewerZoom}%</span>
                  <button type="button" class="plg-vbtn" id="plg-zoom-in" aria-label="Perbesar tampilan" ${viewerZoom >= 150 ? 'disabled' : ''}>+</button>
                </div>
                <button type="button" class="plg-vbtn is-fs-btn" id="plg-fullscreen-btn" aria-pressed="${viewerFullscreen}">
                  ${
                    viewerFullscreen
                      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg><span>Keluar Full</span>`
                      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg><span>Layar Penuh</span>`
                  }
                </button>
              </div>
            </div>

            ${renderSelectedSentenceCard()}

            <div class="plg-pages-stage" id="plg-pages-stage" tabindex="0" aria-label="Halaman dokumen asli yang dapat digulir">
              ${renderOriginalDocumentPages(r)}
            </div>
          </div>

          <aside class="plg-inspector-pane" aria-label="Panel Inspektor Sumber & Filter">
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
          !viewerFullscreen && (r.engineStatuses || []).length > 0
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
            Anda juga dapat menghubungkan kunci <strong>Turnitin Core API (TCA)</strong> atau endpoint institusional (mode <strong>No Repository</strong>) di bawah ini agar ikut berjalan serentak.
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
    const canRun = inputMode === 'upload' ? Boolean(pendingFile) : words >= 10;
    const canClear = inputMode === 'upload' ? Boolean(pendingFile || activeReport) : Boolean(inputText || activeReport);

    hostEl.innerHTML = `
      <div class="plg-studio">
        <div class="plg-studio-head">
          <div class="plg-head-copy">
            <h3>Cek Plagiarisme Terpadu Multi-Mesin</h3>
            <p>Unggah semua jenis berkas atau tempel naskah untuk dipindai serentak oleh OpenAlex, Crossref, DOAJ, Wikipedia, Multi-AI (ChatGPT · Gemini · Claude · DeepSeek · Grok), &amp; Turnitin API — tampilan &amp; PDF mempertahankan dokumen asli.</p>
          </div>
          <div class="plg-head-actions">
            <button type="button" class="plg-btn-secondary" id="plg-demo-btn" ${scanning ? 'disabled' : ''}>Contoh Naskah Uji</button>
            <button type="button" class="plg-btn-secondary ${hasTurnitinKey ? 'is-connected' : ''}" id="plg-open-api-btn">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
              <span>${hasTurnitinKey ? 'Turnitin API Aktif' : 'API & Turnitin'}</span>
            </button>
          </div>
        </div>

        <div class="plg-norepo-banner" role="note" aria-label="Jaminan No Repository">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <span><strong>No Repository Aktif:</strong> Dokumen diproses 100% lokal di browser Anda, tata letak asli dipertahankan, &amp; dijamin tidak pernah masuk repositori manapun.</span>
        </div>

        <div class="plg-input-card">
          <div class="plg-input-mode-tabs" role="tablist" aria-label="Metode input naskah">
            <button type="button" role="tab" class="plg-mode-tab ${inputMode === 'upload' ? 'is-active' : ''}" data-plg-mode="upload" aria-selected="${inputMode === 'upload'}" ${scanning ? 'disabled' : ''}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload File</span>
            </button>
            <button type="button" role="tab" class="plg-mode-tab ${inputMode === 'paste' ? 'is-active' : ''}" data-plg-mode="paste" aria-selected="${inputMode === 'paste'}" ${scanning ? 'disabled' : ''}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Tempel Tulisan</span>
            </button>
          </div>

          ${
            inputMode === 'upload'
              ? `
                <input id="plg-file-input" type="file" accept="*/*" hidden ${scanning ? 'disabled' : ''} />
                ${
                  pendingFile
                    ? `<div class="plg-uploaded-file-card" id="plg-dropzone">
                        <div class="plg-uf-top">
                          <div class="plg-uf-icon" aria-hidden="true">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>
                          </div>
                          <div class="plg-uf-meta">
                            <strong>${escapePlagHtml(fileName)}</strong>
                            <span>${escapePlagHtml(fileFormat)} · ${formatFileSizeKb(fileSize)} · Siap langsung dicek (tata letak asli dipertahankan · No Repository)</span>
                          </div>
                        </div>
                        <div class="plg-uf-actions">
                          <label for="plg-file-input" class="plg-btn-secondary plg-btn-compact">Ganti Berkas</label>
                          <button type="button" class="plg-btn-secondary plg-btn-compact" id="plg-remove-file-btn" ${scanning ? 'disabled' : ''}>Hapus Berkas</button>
                        </div>
                      </div>`
                    : `<label class="plg-dropzone" id="plg-dropzone" for="plg-file-input">
                        <div class="plg-drop-icon" aria-hidden="true">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </div>
                        <div class="plg-drop-text">
                          <strong>Pilih atau tarik SEMUA jenis file dokumen (instan, tanpa tunggu)</strong>
                          <span>PDF (teks &amp; scan OCR otomatis), DOCX, DOC, PPTX, XLSX, CSV, ODT, EPUB, RTF, HTML, TXT, Markdown, Kode, &amp; Gambar</span>
                        </div>
                      </label>`
                }
              `
              : `
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
                    placeholder="Tempel paragraf makalah, skripsi, jurnal, esai, atau artikel di sini..."
                    ${scanning ? 'disabled' : ''}
                  >${escapePlagHtml(inputText)}</textarea>
                </div>
              `
          }

          <div class="plg-options-bar">
            <div class="plg-option-item">
              <label for="plg-opt-mode">Kedalaman</label>
              <select id="plg-opt-mode" class="plg-select" ${scanning ? 'disabled' : ''}>
                <option value="standard" ${scanOptions.mode === 'standard' ? 'selected' : ''}>Standar Terpadu (Cepat)</option>
                <option value="deep" ${scanOptions.mode === 'deep' ? 'selected' : ''}>Mendalam (Multi-AI + 7 Query)</option>
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
            <div class="plg-checks-row">
              <label class="plg-check-inline">
                <input type="checkbox" id="plg-opt-quotes" ${scanOptions.excludeQuotes ? 'checked' : ''} ${scanning ? 'disabled' : ''} />
                <span>Kecualikan Kutipan</span>
              </label>
              <label class="plg-check-inline">
                <input type="checkbox" id="plg-opt-bib" ${scanOptions.excludeBibliography ? 'checked' : ''} ${scanning ? 'disabled' : ''} />
                <span>Kecualikan Daftar Pustaka</span>
              </label>
            </div>
          </div>

          <div class="plg-action-footer">
            <button type="button" class="plg-btn-secondary" id="plg-clear-btn" ${scanning || !canClear ? 'disabled' : ''}>Bersihkan</button>
            ${
              scanning
                ? `<button type="button" class="plg-btn-danger" id="plg-cancel-btn">Batalkan Pengecekan</button>`
                : `<button type="button" class="plg-btn-primary" id="plg-run-btn" ${!canRun ? 'disabled' : ''}>
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

    // Input Mode Switcher (Upload File vs Paste Text)
    hostEl.querySelectorAll('[data-plg-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (scanning) return;
        const nextMode = btn.getAttribute('data-plg-mode') === 'paste' ? 'paste' : 'upload';
        if (nextMode !== inputMode) {
          inputMode = nextMode;
          if (nextMode === 'paste' && pendingFile) {
            pendingFile = null;
            fileName = 'Naskah_Tempel_Langsung.txt';
            fileFormat = 'TEXT';
            fileSize = inputText.length;
          }
          render();
        }
      });
    });

    // Remove uploaded file button
    hostEl.querySelector('#plg-remove-file-btn')?.addEventListener('click', () => {
      if (scanning) return;
      pendingFile = null;
      fileName = 'Naskah_Tempel_Langsung.txt';
      fileFormat = 'TEXT';
      fileSize = 0;
      activeReport = null;
      selectedSourceRank = null;
      selectedSentenceIdx = null;
      viewerFullscreen = false;
      syncFullscreenBodyLock();
      render();
    });

    // File input & Drag/Drop (instant, 0ms wait)
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
        pendingFile = null;
        fileName = 'Naskah_Tempel_Langsung.txt';
        fileFormat = 'TEXT';
        fileSize = inputText.length;
        const w = countWords(inputText);
        const wEl = hostEl.querySelector('#plg-stat-words');
        const cEl = hostEl.querySelector('#plg-stat-chars');
        const runBtn = hostEl.querySelector('#plg-run-btn');
        const clrBtn = hostEl.querySelector('#plg-clear-btn');
        if (wEl) wEl.textContent = `${w.toLocaleString('id-ID')} kata`;
        if (cEl) cEl.textContent = `${inputText.length.toLocaleString('id-ID')} karakter`;
        if (runBtn) runBtn.disabled = w < 10;
        if (clrBtn) clrBtn.disabled = !inputText && !activeReport;
      });
    }

    // Demo sample & clear
    hostEl.querySelector('#plg-demo-btn')?.addEventListener('click', () => {
      inputMode = 'paste';
      pendingFile = null;
      inputText = PLAGIARISM_DEMO_TEXT;
      fileName = 'Contoh_Makalah_AI_Pendidikan_2026.docx';
      fileFormat = 'DEMO DOCX';
      fileSize = inputText.length;
      activeReport = null;
      viewerFullscreen = false;
      syncFullscreenBodyLock();
      render();
      onToast('Contoh naskah uji dimuat — klik "Cek Plagiarisme Sekarang" untuk melihat Standar Report.');
    });

    hostEl.querySelector('#plg-clear-btn')?.addEventListener('click', () => {
      pendingFile = null;
      inputText = '';
      fileName = 'Naskah_Tempel_Langsung.txt';
      fileFormat = 'TEXT';
      fileSize = 0;
      activeReport = null;
      selectedSourceRank = null;
      selectedSentenceIdx = null;
      viewerFullscreen = false;
      syncFullscreenBodyLock();
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

    // Original-Document Viewer: Zoom & Fullscreen & Page Scroll Tracking
    hostEl.querySelector('#plg-zoom-out')?.addEventListener('click', () => {
      viewerZoom = Math.max(75, viewerZoom - 15);
      render();
    });
    hostEl.querySelector('#plg-zoom-in')?.addEventListener('click', () => {
      viewerZoom = Math.min(150, viewerZoom + 15);
      render();
    });
    const toggleFullscreen = () => {
      viewerFullscreen = !viewerFullscreen;
      syncFullscreenBodyLock();
      render();
    };
    hostEl.querySelector('#plg-fullscreen-btn')?.addEventListener('click', toggleFullscreen);
    hostEl.querySelector('#plg-fs-top-exit')?.addEventListener('click', toggleFullscreen);

    const pagesStage = hostEl.querySelector('#plg-pages-stage');
    if (pagesStage) {
      pagesStage.addEventListener('scroll', () => {
        const cards = pagesStage.querySelectorAll('[data-plg-page]');
        const stageTop = pagesStage.getBoundingClientRect().top;
        let bestPage = currentVisiblePage;
        let bestDist = Infinity;
        cards.forEach((card) => {
          const dist = Math.abs(card.getBoundingClientRect().top - stageTop - 16);
          if (dist < bestDist) {
            bestDist = dist;
            bestPage = Number(card.getAttribute('data-plg-page')) || 1;
          }
        });
        if (bestPage !== currentVisiblePage) {
          currentVisiblePage = bestPage;
          const total = activeReport?.originalSource?.pageCount || cards.length || 1;
          const ctr = hostEl.querySelector('#plg-page-counter');
          if (ctr) ctr.textContent = `Hal ${currentVisiblePage} / ${total}`;
        }
      });
    }

    // Inspector tabs
    hostEl.querySelectorAll('[data-plg-itab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        inspectorTab = btn.getAttribute('data-plg-itab') || 'sources';
        render();
      });
    });

    // Source rank filter click -> filters highlights & scrolls directly to first matched page!
    hostEl.querySelectorAll('[data-plg-source-rank]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rank = Number(btn.getAttribute('data-plg-source-rank'));
        selectedSourceRank = selectedSourceRank === rank ? null : rank;
        render();
        if (selectedSourceRank !== null) {
          const firstMatchEl = hostEl.querySelector(`[data-plg-hl-rank="${selectedSourceRank}"]`);
          firstMatchEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
    hostEl.querySelector('#plg-clear-source-filter')?.addEventListener('click', () => {
      selectedSourceRank = null;
      render();
    });

    // Highlight overlay / margin badge click -> open match details
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

    // Live Filter recalculation (automatically recomputes pageHighlights on original pages!)
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
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', handleGlobalKeydown);
      }
      render();
    },
    unmount() {
      handleCancelCheck();
      stopElapsedTimer();
      viewerFullscreen = false;
      syncFullscreenBodyLock();
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleGlobalKeydown);
      }
      mounted = false;
      hostEl = null;
    },
    redrawTheme() {
      if (mounted) render();
    },
  };
}
