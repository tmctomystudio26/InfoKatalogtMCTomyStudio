/**
 * Manifestudio Standard Originality & Similarity Report Exporter (v69 — Authentic Original-Document Turnitin Layout)
 * Generates:
 * 1. `generateTurnitinPdfBlobAsync(report)` — True Original-Document PDF powered by `pdf-lib`:
 *    - Page 1: Minimalist White Cover Page (`Page 1 of N - Cover Page`, Document Details + Pages/Words/Chars Card, NO REPOSITORY)
 *    - Page 2: Integrity Overview (`XX% Overall Similarity`, Filtered from Report, Top Sources Breakdown, Integrated Engines)
 *    - Page 3+: Top Sources (Ranked colored pills, category pills, URL/DOI, right-aligned %)
 *    - Pages 4..N: ACTUAL ORIGINAL DOCUMENT PAGES (`Page X of N - Integrity Submission`)
 *      - PDFs / Scanned PDFs: embeds 100% untouched original PDF pages via `pdf-lib` `embedPage`,
 *        preserving exact letterhead, logos, tables, fonts, stamps & layout, with translucent color highlights
 *        and circular numbered badges (1, 2, ...) in the left margin gutter!
 *      - Images: embeds actual original image with translucent highlights & left-gutter circular badges.
 *      - DOCX / A4 Sheets: preserves original headings, alignment, bold/italic, tables & embedded media images
 *        with color highlights & left-gutter circular badges.
 * 2. Synchronous fallback `buildTurnitinPdfBytes(report)` / `generateTurnitinPdfBlob(report)` (offline & Node tests)
 * 3. Self-Contained Interactive HTML Report (`generateTurnitinHtmlReport`) embedding actual original pages
 * 4. Structured JSON Audit Report (`generateTurnitinJsonReport`)
 */

import { escapePlagHtml, mapAnnotatedSentencesToPageHighlights } from './plagiarism-logic.js?v=69';
import { loadPdfLib } from './media-engine.js?v=101';
import { normalizeTypographyForPdf } from './docx-fidelity.js?v=101';

function sanitizePdfText(str = '') {
  return normalizeTypographyForPdf(String(str || ''))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pdfEsc(str = '') {
  return sanitizePdfText(str)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function rgbFill(rgb = [15, 23, 42]) {
  return `${(rgb[0] / 255).toFixed(3)} ${(rgb[1] / 255).toFixed(3)} ${(rgb[2] / 255).toFixed(3)} rg`;
}

function rgbStroke(rgb = [203, 213, 225]) {
  return `${(rgb[0] / 255).toFixed(3)} ${(rgb[1] / 255).toFixed(3)} ${(rgb[2] / 255).toFixed(3)} RG`;
}

function wrapPdfLines(text = '', maxChars = 84) {
  const clean = sanitizePdfText(text);
  if (!clean) return [];
  const words = clean.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!line) {
      if (w.length > maxChars) {
        for (let i = 0; i < w.length; i += maxChars) lines.push(w.slice(i, i + maxChars));
      } else {
        line = w;
      }
    } else if (line.length + 1 + w.length <= maxChars) {
      line += ` ${w}`;
    } else {
      lines.push(line);
      line = w.length > maxChars ? w.slice(0, maxChars) : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatReportDate(iso = '') {
  try {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
  }
}

function formatSizeReadable(bytes = 0) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function dataUrlToUint8(dataUrl = '') {
  const parts = String(dataUrl || '').split(',');
  if (parts.length < 2) return null;
  const bin = atob(parts[1]);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function getPageHighlightsObj(report) {
  if (report?.pageHighlights && typeof report.pageHighlights === 'object') {
    return report.pageHighlights;
  }
  if (report?.originalSource?.pages?.some((p) => Array.isArray(p.spans) && p.spans.length > 0)) {
    const m = mapAnnotatedSentencesToPageHighlights(report.originalSource.pages, report.annotatedSentences || []);
    return Object.fromEntries(m.entries());
  }
  return {};
}

/**
 * Matches annotated sentences against a block's plain text (for DOCX & A4 sheets)
 * so matched sentences inside headings/paragraphs/tables get highlighted while keeping structure!
 */
export function annotateBlockTextSegments(blockText = '', annotatedSentences = []) {
  const text = String(blockText || '');
  if (!text.trim()) return [];
  const matched = (annotatedSentences || []).filter(
    (s) => s && s.activeSourceRank && s.activeColorHex && !s.excludedReason && String(s.text || '').trim().length >= 12
  );
  if (matched.length === 0) {
    return [{ text, matched: false }];
  }

  const lower = text.toLowerCase();
  const hits = [];
  for (const s of matched) {
    const needle = String(s.text || '').trim();
    const needleLow = needle.toLowerCase();
    let idx = lower.indexOf(needleLow);
    let len = needle.length;
    if (idx === -1 && needleLow.length > 36) {
      // Partial probe with first 36 chars (handles minor whitespace/punctuation diffs in DOCX runs)
      const probe = needleLow.slice(0, 36);
      idx = lower.indexOf(probe);
      if (idx !== -1) len = Math.min(text.length - idx, needle.length);
    }
    if (idx !== -1) {
      hits.push({
        start: idx,
        end: Math.min(text.length, idx + len),
        sentence: s,
      });
    }
  }

  if (hits.length === 0) return [{ text, matched: false }];
  hits.sort((a, b) => a.start - b.start || b.end - a.end);

  const segments = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue;
    if (h.start > cursor) {
      segments.push({ text: text.slice(cursor, h.start), matched: false });
    }
    segments.push({
      text: text.slice(h.start, h.end),
      matched: true,
      rank: h.sentence.activeSourceRank,
      colorHex: h.sentence.activeColorHex,
      colorSoft: h.sentence.activeColorSoft || 'rgba(225, 29, 72, 0.16)',
      colorRgb: h.sentence.activeColorRgb || [225, 29, 72],
      colorBgRgb: h.sentence.activeColorBgRgb || [253, 230, 236],
      sentenceIndex: h.sentence.index,
    });
    cursor = h.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }
  return segments;
}

/**
 * Primary Async PDF Exporter using `pdf-lib` (matches Turnitin's real original-document PDF!).
 * Embeds 100% original untouched PDF pages / original Images / rich DOCX pages on Pages 4..N,
 * preceded by minimalist white Cover Page (Page 1), Integrity Overview (Page 2), & Top Sources (Page 3).
 */
export async function generateTurnitinPdfBlobAsync(report) {
  const pdfLib = await loadPdfLib();
  if (!pdfLib || !pdfLib.PDFDocument) {
    return generateTurnitinPdfBlob(report);
  }

  try {
    const { PDFDocument, StandardFonts, rgb } = pdfLib;
    const outDoc = await PDFDocument.create();
    const fontReg = await outDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await outDoc.embedFont(StandardFonts.HelveticaOblique);

    const c = (arr) => rgb((arr[0] || 0) / 255, (arr[1] || 0) / 255, (arr[2] || 0) / 255);
    const colInk = c([15, 23, 42]);
    const colBody = c([30, 41, 59]);
    const colMuted = c([100, 116, 139]);
    const colLine = c([226, 232, 240]);
    const colCardBg = c([244, 246, 249]);
    const colAccent = c([14, 165, 233]);
    const colEmerald = c([5, 150, 105]);
    const colWhite = rgb(1, 1, 1);

    const docTitle = sanitizePdfText(report.fileName || 'Dokumen_Naskah');
    const subId = sanitizePdfText(report.submissionId || 'MS-PLG-000000');
    const submittedDate = formatReportDate(report.checkedAt);
    const downloadDate = formatReportDate(new Date().toISOString());
    const simPct = Number(report.similarityPct || 0);
    const netPct = Number(report.internetPct || 0);
    const pubPct = Number(report.publicationsPct || 0);
    const stuPct = Number(report.studentPapersPct || 0);
    const aiPct = Number(report.aiAnalysis?.aiWritingPct || 0);
    const orig = report.originalSource || null;
    const sources = report.primarySources || [];
    const hlByPage = getPageHighlightsObj(report);

    // Load original PDF if present so we know exact total page count upfront
    let srcPdfDoc = null;
    let origPdfPageCount = 0;
    if (orig?.pdfBytes && orig.pdfBytes.length > 32) {
      try {
        srcPdfDoc = await PDFDocument.load(orig.pdfBytes, { ignoreEncryption: true });
        origPdfPageCount = srcPdfDoc.getPageCount();
      } catch {
        srcPdfDoc = null;
        origPdfPageCount = 0;
      }
    }

    const bodyPagesCount =
      origPdfPageCount > 0
        ? origPdfPageCount
        : Array.isArray(orig?.pages) && orig.pages.length > 0
        ? orig.pages.length
        : 1;

    // Source pages: 9 sources per page
    const sourcesPerPage = 9;
    const pageSections = [];
    const registerPage = (page, sectionLabel) => {
      pageSections.push({ page, sectionLabel });
      return page;
    };

    const drawChrome = (page, pageNum, totalOutPages, sectionLabel) => {
      const W = 595;
      const H = 842;
      // Clean minimalist Turnitin header bar
      page.drawRectangle({ x: 44, y: H - 36, width: 14, height: 14, color: colInk });
      page.drawText('M', { x: 47.4, y: H - 32.5, size: 9, font: fontBold, color: colWhite });
      page.drawText('manifestudio', { x: 63, y: H - 32.5, size: 9.5, font: fontBold, color: colInk });

      const midLabel = `Page ${pageNum} of ${totalOutPages} - ${sectionLabel}`;
      const midW = fontReg.widthOfTextAtSize(midLabel, 8);
      page.drawText(midLabel, { x: (W - midW) / 2, y: H - 32, size: 8, font: fontReg, color: colMuted });

      const rightLabel = `Submission ID ${subId}`;
      const rightW = fontReg.widthOfTextAtSize(rightLabel, 7.8);
      page.drawText(rightLabel, { x: W - 44 - rightW, y: H - 32, size: 7.8, font: fontReg, color: colMuted });

      page.drawLine({ start: { x: 44, y: H - 44 }, end: { x: W - 44, y: H - 44 }, thickness: 0.7, color: colLine });

      // Clean minimalist Turnitin footer bar
      page.drawLine({ start: { x: 44, y: 42 }, end: { x: W - 44, y: 42 }, thickness: 0.7, color: colLine });
      page.drawText('Manifestudio · No Repository', { x: 44, y: 27, size: 7.5, font: fontBold, color: colMuted });
      page.drawText(midLabel, { x: (W - midW) / 2, y: 27, size: 7.5, font: fontReg, color: colMuted });
      page.drawText(rightLabel, { x: W - 44 - rightW, y: 27, size: 7.5, font: fontReg, color: colMuted });
    };

    // ==================== PAGE 1: MINIMALIST COVER PAGE ====================
    const coverPage = registerPage(outDoc.addPage([595, 842]), 'Cover Page');

    let cy = 742;
    coverPage.drawText('STANDARD SIMILARITY & ORIGINALITY REPORT', {
      x: 44,
      y: cy,
      size: 9,
      font: fontBold,
      color: colAccent,
    });
    cy -= 28;
    const titleLines = wrapPdfLines(docTitle, 42).slice(0, 3);
    for (const tl of titleLines) {
      coverPage.drawText(tl, { x: 44, y: cy, size: 20, font: fontBold, color: colInk });
      cy -= 26;
    }
    coverPage.drawText('Manifestudio Integrated Multi-Engine Verification  ·  No Repository Verified', {
      x: 44,
      y: cy - 2,
      size: 10,
      font: fontReg,
      color: colMuted,
    });
    cy -= 24;
    coverPage.drawLine({ start: { x: 44, y: cy }, end: { x: 551, y: cy }, thickness: 1, color: colLine });
    cy -= 26;

    // Left column: Document Details (exact Turnitin Cover Page anatomy)
    coverPage.drawText('Document Details', { x: 44, y: cy, size: 12, font: fontBold, color: colInk });
    let dy = cy - 24;
    const docDetails = [
      ['Submission ID', subId],
      ['Submission Date', submittedDate],
      ['Download Date', downloadDate],
      ['File Name', docTitle.slice(0, 48)],
      ['File Format & Size', `${report.fileFormat || 'DOCUMENT'} · ${formatSizeReadable(report.fileSize)}`],
      ['Detected Language', report.language?.label || 'Bahasa Indonesia'],
      ['Repository Policy', 'NO REPOSITORY (Not stored or indexed in any database)'],
    ];
    for (const [label, val] of docDetails) {
      coverPage.drawText(label, { x: 44, y: dy, size: 8.5, font: fontBold, color: colMuted });
      dy -= 14;
      const isNoRepo = label === 'Repository Policy';
      coverPage.drawText(sanitizePdfText(val).slice(0, 56), {
        x: 44,
        y: dy,
        size: 9.5,
        font: isNoRepo ? fontBold : fontReg,
        color: isNoRepo ? colEmerald : colInk,
      });
      dy -= 22;
    }

    // Right column: Light-gray summary stats card (rendered after submission pages so page count is exact!)
    const cardX = 376;
    const cardY = cy - 160;
    const cardW = 175;
    const cardH = 166;
    const drawCoverStatsCard = (actualSubmissionPages) => {
      coverPage.drawRectangle({
        x: cardX,
        y: cardY,
        width: cardW,
        height: cardH,
        color: colCardBg,
        borderColor: colLine,
        borderWidth: 0.8,
      });
      const statItems = [
        { val: `${actualSubmissionPages} Pages`, sub: 'Original document preserved' },
        { val: `${Number(report.totalWords || 0).toLocaleString('en-US')} Words`, sub: `Eligible: ${Number(report.eligibleWords || 0).toLocaleString('en-US')}` },
        { val: `${Number(report.totalChars || 0).toLocaleString('en-US')} Characters`, sub: `Similarity: ${simPct}% · Unique: ${report.uniquePct ?? (100 - simPct)}%` },
      ];
      let syCard = cardY + cardH - 34;
      for (const st of statItems) {
        coverPage.drawText(st.val, { x: cardX + 16, y: syCard, size: 13, font: fontBold, color: colInk });
        coverPage.drawText(st.sub, { x: cardX + 16, y: syCard - 14, size: 7.8, font: fontReg, color: colMuted });
        syCard -= 48;
      }
    };

    // Bottom No Repository Trust Notice on Cover Page
    coverPage.drawRectangle({
      x: 44,
      y: 78,
      width: 507,
      height: 54,
      color: c([236, 253, 245]),
      borderColor: c([167, 243, 208]),
      borderWidth: 0.8,
    });
    coverPage.drawText('NO REPOSITORY GUARANTEE', { x: 58, y: 112, size: 9, font: fontBold, color: colEmerald });
    coverPage.drawText(
      'Dokumen ini diperiksa secara lokal & tidak pernah disimpan atau diindeks ke repositori/database manapun.',
      { x: 58, y: 94, size: 8.5, font: fontReg, color: c([6, 95, 70]) }
    );

    // ==================== PAGE 2: INTEGRITY OVERVIEW ====================
    const ovPage = registerPage(outDoc.addPage([595, 842]), 'Integrity Overview');

    const scoreRgb = simPct >= 45 ? [225, 29, 72] : simPct >= 25 ? [217, 119, 6] : [5, 150, 105];
    let oy = 736;
    ovPage.drawText(`${simPct}%`, { x: 44, y: oy, size: 42, font: fontBold, color: c(scoreRgb) });
    const pctWidth = fontBold.widthOfTextAtSize(`${simPct}%`, 42);
    ovPage.drawText('Overall Similarity', { x: 44 + pctWidth + 16, y: oy + 14, size: 17, font: fontBold, color: colInk });
    ovPage.drawText(sanitizePdfText(report.riskLabel || 'ORIGINALITY REPORT'), {
      x: 44 + pctWidth + 16,
      y: oy - 3,
      size: 9.5,
      font: fontReg,
      color: colMuted,
    });
    oy -= 26;
    ovPage.drawText(
      'The combined total of all matches, including overlapping sources, across integrated web, publication & AI engines.',
      { x: 44, y: oy, size: 8.8, font: fontReg, color: colMuted }
    );

    // Filtered from the Report section
    oy -= 32;
    ovPage.drawText('Filtered from the Report', { x: 44, y: oy, size: 11, font: fontBold, color: colInk });
    oy -= 18;
    const filterItems = [
      `Bibliography: ${report.filters?.excludeBibliography ? 'Excluded' : 'Included'}`,
      `Quoted Text: ${report.filters?.excludeQuotes ? 'Excluded' : 'Included'}`,
      `Small Matches: ${report.filters?.excludeSmallWords ? `Excluded (< ${report.filters.excludeSmallWords} words)` : 'None excluded'}`,
      'Repository Policy: NO REPOSITORY (Verified local processing)',
    ];
    for (const fi of filterItems) {
      ovPage.drawCircle({ x: 52, y: oy + 3, size: 2.2, color: colMuted });
      ovPage.drawText(fi, { x: 62, y: oy, size: 9, font: fontReg, color: colBody });
      oy -= 16;
    }

    oy -= 10;
    ovPage.drawLine({ start: { x: 44, y: oy }, end: { x: 551, y: oy }, thickness: 0.9, color: colLine });

    // Top Sources Category Breakdown (exact Turnitin Page 2 style)
    oy -= 26;
    ovPage.drawText('Top Sources  (ORIGINALITY REPORT)', { x: 44, y: oy, size: 12, font: fontBold, color: colInk });
    oy -= 28;

    const catBreakdown = [
      { pct: `${netPct}%`, label: 'Internet sources', col: c([2, 132, 199]), sub: 'Wikipedia ID/EN, web index & semantic web sources' },
      { pct: `${pubPct}%`, label: 'Publications', col: c([124, 58, 237]), sub: 'OpenAlex (250M+), Crossref DOI (150M+), DOAJ Open-Access' },
      { pct: `${stuPct}%`, label: 'Internal / Self-Check', col: colEmerald, sub: 'Local Winnowing k-gram & internal duplication detector' },
      { pct: `${aiPct}%`, label: 'AI Writing Indicator', col: c([217, 119, 6]), sub: sanitizePdfText(report.aiAnalysis?.stylometric?.verdict || 'Stylometric + Multi-AI consensus') },
    ];
    for (const cb of catBreakdown) {
      ovPage.drawText(cb.pct, { x: 44, y: oy, size: 16, font: fontBold, color: cb.col });
      ovPage.drawText(cb.label, { x: 106, y: oy + 3, size: 10.5, font: fontBold, color: colInk });
      ovPage.drawText(cb.sub.slice(0, 72), { x: 106, y: oy - 10, size: 8, font: fontReg, color: colMuted });
      oy -= 36;
    }

    oy -= 8;
    ovPage.drawLine({ start: { x: 44, y: oy }, end: { x: 551, y: oy }, thickness: 0.9, color: colLine });

    // Integrated Engines Summary
    oy -= 24;
    ovPage.drawText('Integrated Engines Fused in This Report', { x: 44, y: oy, size: 11, font: fontBold, color: colInk });
    oy -= 18;
    for (const eng of (report.engineStatuses || []).slice(0, 8)) {
      const dotCol = eng.status === 'done' ? colEmerald : eng.status === 'standby' ? colMuted : c([217, 119, 6]);
      ovPage.drawCircle({ x: 50, y: oy + 3, size: 2.8, color: dotCol });
      ovPage.drawText(sanitizePdfText(eng.name || '').slice(0, 38), { x: 60, y: oy, size: 8.5, font: fontBold, color: colInk });
      ovPage.drawText(sanitizePdfText(eng.note || eng.status || '').slice(0, 48), { x: 294, y: oy, size: 8, font: fontReg, color: colMuted });
      oy -= 17;
    }

    // ==================== PAGE 3..K: TOP SOURCES ====================
    const sourcePagesCount = Math.max(1, Math.ceil(Math.max(1, sources.length) / sourcesPerPage));
    for (let sp = 0; sp < sourcePagesCount; sp += 1) {
      const srcPage = registerPage(outDoc.addPage([595, 842]), 'Integrity Overview');

      let ty = 748;
      srcPage.drawText('Top Sources  (PRIMARY SOURCES)', { x: 44, y: ty, size: 14, font: fontBold, color: colInk });
      ty -= 16;
      srcPage.drawText(
        'The sources with the highest number of matches within the submission. Overlapping sources are ranked by matched words.',
        { x: 44, y: ty, size: 8.5, font: fontReg, color: colMuted }
      );
      ty -= 16;
      srcPage.drawLine({ start: { x: 44, y: ty }, end: { x: 551, y: ty }, thickness: 0.9, color: colLine });
      ty -= 28;

      const slice = sources.slice(sp * sourcesPerPage, (sp + 1) * sourcesPerPage);
      if (slice.length === 0) {
        srcPage.drawRectangle({
          x: 44,
          y: ty - 34,
          width: 507,
          height: 52,
          color: c([236, 253, 245]),
          borderColor: c([167, 243, 208]),
          borderWidth: 0.8,
        });
        srcPage.drawText('100% Orisinal — Tidak ditemukan kecocokan sumber plagiarisme signifikan.', {
          x: 58,
          y: ty - 12,
          size: 10,
          font: fontBold,
          color: colEmerald,
        });
      } else {
        for (const src of slice) {
          const badgeRgb = src.colorRgb || [225, 29, 72];
          // Colored rounded rank pill
          srcPage.drawRectangle({ x: 44, y: ty - 6, width: 22, height: 18, color: c(badgeRgb) });
          const rStr = String(src.rank);
          const rW = fontBold.widthOfTextAtSize(rStr, 9.5);
          srcPage.drawText(rStr, { x: 44 + (22 - rW) / 2, y: ty - 0.5, size: 9.5, font: fontBold, color: colWhite });

          // Soft category pill next to rank
          const catLabel =
            src.category === 'publication'
              ? 'Publication'
              : src.category === 'student'
              ? 'Internal Check'
              : 'Internet Source';
          const catW = fontBold.widthOfTextAtSize(catLabel, 7.2) + 12;
          srcPage.drawRectangle({ x: 74, y: ty - 4, width: catW, height: 14, color: colCardBg, borderColor: colLine, borderWidth: 0.5 });
          srcPage.drawText(catLabel, { x: 80, y: ty, size: 7.2, font: fontBold, color: colMuted });

          // Title + URL (graceful ellipsis truncation)
          const rawTitle = sanitizePdfText(src.title || 'Sumber Terdeteksi');
          const titleTxt = rawTitle.length > 68 ? `${rawTitle.slice(0, 65).trim()}...` : rawTitle;
          srcPage.drawText(titleTxt, { x: 74, y: ty - 19, size: 9.5, font: fontBold, color: colInk });

          const rawMeta = sanitizePdfText(
            `${src.engine || 'Integrated'}  ·  ${src.matchedWords || 0} kata${src.url ? `  ·  ${src.url}` : ''}`
          );
          const metaTxt = rawMeta.length > 86 ? `${rawMeta.slice(0, 83).trim()}...` : rawMeta;
          srcPage.drawText(metaTxt, { x: 74, y: ty - 31, size: 7.6, font: fontReg, color: colMuted });

          // Right-aligned %
          const pctStr = src.exactPct < 1 ? '<1%' : `${src.percent}%`;
          const pW = fontBold.widthOfTextAtSize(pctStr, 13);
          srcPage.drawText(pctStr, { x: 551 - pW, y: ty - 8, size: 13, font: fontBold, color: colInk });

          ty -= 46;
          srcPage.drawLine({ start: { x: 44, y: ty + 6 }, end: { x: 551, y: ty + 6 }, thickness: 0.5, color: colLine });
          ty -= 12;
        }
      }
    }

    // ==================== PAGES 4..N: ACTUAL ORIGINAL DOCUMENT PAGES ====================
    const drawOverlayHighlightsAndBadges = (page, pageNumber, drawX, drawY, drawW, drawH) => {
      const hl = hlByPage[pageNumber] || hlByPage[String(pageNumber)];
      if (!hl) return;

      // 1. Translucent colored highlight bands directly over matched text on the original page!
      for (const r of hl.rects || []) {
        const hx = drawX + r.x * drawW;
        const hw = Math.max(4, r.w * drawW);
        const hh = Math.max(7, r.h * drawH);
        const hy = drawY + drawH - (r.y + r.h) * drawH;
        const fillRgb = r.colorRgb || [225, 29, 72];
        page.drawRectangle({
          x: hx - 1,
          y: hy - 1,
          width: hw + 2,
          height: hh + 2,
          color: c(fillRgb),
          opacity: 0.26,
        });
      }

      // 2. Circular colored numbered badges (1, 2, ...) in the left margin gutter — exact Turnitin look!
      for (const b of hl.badges || []) {
        const by = drawY + drawH - b.y * drawH;
        const safeBy = Math.max(drawY + 12, Math.min(drawY + drawH - 12, by));
        const bx = 24;
        const badgeRgb = b.colorRgb || [225, 29, 72];
        page.drawCircle({ x: bx, y: safeBy, size: 8.5, color: c(badgeRgb) });
        const numStr = String(b.rank);
        const nw = fontBold.widthOfTextAtSize(numStr, 8);
        page.drawText(numStr, {
          x: bx - nw / 2,
          y: safeBy - 2.8,
          size: 8,
          font: fontBold,
          color: colWhite,
        });
      }
    };

    const frameX = 44; // leaves 44pt left gutter for Turnitin circular numbered badges
    const frameY = 52;
    const frameW = 512;
    const frameH = 736;

    const submissionPagesBefore = pageSections.length;

    if (srcPdfDoc && origPdfPageCount > 0) {
      // CASE A: 100% ORIGINAL UNTOUCHED PDF / RENDERED DOCX PAGES EMBEDDED VIA pdf-lib `embedPage`!
      const origPages = srcPdfDoc.getPages();
      for (let i = 0; i < origPages.length; i += 1) {
        const outPage = registerPage(outDoc.addPage([595, 842]), 'Integrity Submission');

        const embedded = await outDoc.embedPage(origPages[i]);
        const { width: ew, height: eh } = embedded.size();
        const scale = Math.min(frameW / Math.max(1, ew), frameH / Math.max(1, eh));
        const drawW = ew * scale;
        const drawH = eh * scale;
        const drawX = frameX + (frameW - drawW) / 2;
        const drawY = frameY + (frameH - drawH) / 2;

        // Crisp subtle frame behind original page
        outPage.drawRectangle({
          x: drawX - 0.5,
          y: drawY - 0.5,
          width: drawW + 1,
          height: drawH + 1,
          borderColor: colLine,
          borderWidth: 0.6,
        });
        outPage.drawPage(embedded, { x: drawX, y: drawY, width: drawW, height: drawH });
        drawOverlayHighlightsAndBadges(outPage, i + 1, drawX, drawY, drawW, drawH);
      }
    } else if (orig?.kind === 'image' || (Array.isArray(orig?.pages) && orig.pages.some((p) => p.imageDataUrl))) {
      // CASE B: ORIGINAL IMAGE / RENDERED PAGE IMAGES EMBEDDED WITH HIGHLIGHTS & BADGES
      for (let i = 0; i < orig.pages.length; i += 1) {
        const pg = orig.pages[i];
        const outPage = registerPage(outDoc.addPage([595, 842]), 'Integrity Submission');

        const rawBytes = dataUrlToUint8(pg.imageDataUrl);
        if (rawBytes) {
          const isPng = String(pg.imageDataUrl || '').startsWith('data:image/png');
          const img = isPng ? await outDoc.embedPng(rawBytes) : await outDoc.embedJpg(rawBytes);
          const scale = Math.min(frameW / Math.max(1, img.width), frameH / Math.max(1, img.height));
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = frameX + (frameW - drawW) / 2;
          const drawY = frameY + (frameH - drawH) / 2;
          outPage.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
          drawOverlayHighlightsAndBadges(outPage, pg.pageNumber || i + 1, drawX, drawY, drawW, drawH);
        }
      }
    } else {
      // CASE C: STRUCTURED DOCX / A4 DOCUMENT SHEETS (Dynamic pagination, wrapped multi-line tables, inline highlights — zero dropped content!)
      const sheetPages =
        Array.isArray(orig?.pages) && orig.pages.length > 0
          ? orig.pages
          : [{ pageNumber: 1, blocks: (report.annotatedSentences || []).map((s) => ({ type: 'paragraph', plain: s.text })) }];

      const allBlocks = sheetPages.flatMap((pg) => (Array.isArray(pg.blocks) ? pg.blocks : []));
      const leftX = 56;
      const maxW = 492;
      const topY = 772;
      const bottomY = 64;

      let outPage = registerPage(outDoc.addPage([595, 842]), 'Integrity Submission');
      let y = topY;
      let drawnBadges = [];

      const startNewSubmissionPage = () => {
        outPage = registerPage(outDoc.addPage([595, 842]), 'Integrity Submission');
        y = topY;
        drawnBadges = [];
      };

      const drawMarginBadgeIfNeeded = (yPos, seg) => {
        if (!seg?.matched || !seg.rank) return;
        const dup = drawnBadges.find((b) => b.rank === seg.rank && Math.abs(b.y - yPos) < 22);
        if (dup) return;
        let safeY = yPos;
        const prev = drawnBadges[drawnBadges.length - 1];
        if (prev && Math.abs(prev.y - safeY) < 18) safeY = prev.y - 19;
        if (safeY < 56) return;
        drawnBadges.push({ rank: seg.rank, y: safeY });
        outPage.drawCircle({ x: 26, y: safeY + 3, size: 8.5, color: c(seg.colorRgb || [225, 29, 72]) });
        const rs = String(seg.rank);
        const rw = fontBold.widthOfTextAtSize(rs, 8);
        outPage.drawText(rs, { x: 26 - rw / 2, y: safeY + 0.2, size: 8, font: fontBold, color: colWhite });
      };

      const wrapTextByWidth = (text, font, size, widthPt) => {
        const clean = sanitizePdfText(text);
        if (!clean) return [''];
        const words = clean.split(' ');
        const lines = [];
        let cur = '';
        for (const w of words) {
          const cand = cur ? `${cur} ${w}` : w;
          if (font.widthOfTextAtSize(cand, size) <= widthPt) {
            cur = cand;
          } else {
            if (cur) lines.push(cur);
            cur = w;
          }
        }
        if (cur) lines.push(cur);
        return lines.length > 0 ? lines : [''];
      };

      for (const block of allBlocks) {
        // 1. Render embedded DOCX images if present
        if (Array.isArray(block.runs)) {
          for (const run of block.runs) {
            if (run.type === 'image' && run.src) {
              try {
                const imgBytes = dataUrlToUint8(run.src);
                if (imgBytes) {
                  const isPng = run.src.startsWith('data:image/png');
                  const img = isPng ? await outDoc.embedPng(imgBytes) : await outDoc.embedJpg(imgBytes);
                  const sc = Math.min(maxW / Math.max(1, img.width), 160 / Math.max(1, img.height), 1);
                  const iw = img.width * sc;
                  const ih = img.height * sc;
                  if (y - ih < bottomY) startNewSubmissionPage();
                  outPage.drawImage(img, { x: leftX, y: y - ih, width: iw, height: ih });
                  y -= ih + 10;
                }
              } catch {
                // Skip unsupported image encoding
              }
            }
          }
        }

        // 2. Render tables with FULL multi-line cell wrapping & automatic page pagination (NEVER truncated!)
        if (block.type === 'table' && Array.isArray(block.rows)) {
          const cols = Math.max(1, ...block.rows.map((r) => (Array.isArray(r) ? r.length : 1)));
          const colW = maxW / cols;
          const cellFontSize = 8.4;
          const cellLineH = 12;
          const padX = 5;
          const padY = 5;

          for (let ri = 0; ri < block.rows.length; ri += 1) {
            const row = Array.isArray(block.rows[ri]) ? block.rows[ri] : [block.rows[ri]];
            const rowFont = ri === 0 && block.rows.length > 1 ? fontBold : fontReg;
            const wrappedCols = [];
            let maxLines = 1;
            for (let ci = 0; ci < cols; ci += 1) {
              const rawCell = String(row[ci] ?? '');
              const paras = rawCell.split(/\r?\n/);
              const cellLines = [];
              for (const pStr of paras) {
                const lns = wrapTextByWidth(pStr, rowFont, cellFontSize, Math.max(24, colW - padX * 2));
                cellLines.push(...lns);
              }
              wrappedCols.push(cellLines.length > 0 ? cellLines : ['']);
              maxLines = Math.max(maxLines, cellLines.length || 1);
            }

            let lineOffset = 0;
            while (lineOffset < maxLines) {
              const availH = y - bottomY;
              const maxFitLines = Math.floor((availH - padY * 2) / cellLineH);
              if (maxFitLines < 1) {
                startNewSubmissionPage();
                continue;
              }
              const take = Math.min(maxLines - lineOffset, maxFitLines);
              const segH = take * cellLineH + padY * 2;
              const boxBottom = y - segH;

              if (ri === 0 && lineOffset === 0 && block.rows.length > 1) {
                outPage.drawRectangle({ x: leftX, y: boxBottom, width: maxW, height: segH, color: colCardBg });
              }
              outPage.drawRectangle({ x: leftX, y: boxBottom, width: maxW, height: segH, borderColor: colLine, borderWidth: 0.6 });

              for (let ci = 0; ci < cols; ci += 1) {
                const cx = leftX + ci * colW;
                if (ci > 0) {
                  outPage.drawLine({ start: { x: cx, y: boxBottom }, end: { x: cx, y }, thickness: 0.5, color: colLine });
                }
                const segLines = wrappedCols[ci].slice(lineOffset, lineOffset + take);
                for (let li = 0; li < segLines.length; li += 1) {
                  outPage.drawText(segLines[li], {
                    x: cx + padX,
                    y: y - padY - 8.5 - li * cellLineH,
                    size: cellFontSize,
                    font: rowFont,
                    color: colInk,
                  });
                }
              }

              y -= segH;
              lineOffset += take;
              if (lineOffset < maxLines) startNewSubmissionPage();
            }
          }
          y -= 10;
          continue;
        }

        // 3. Paragraphs / headings / list items with INLINE word-level highlight flow (zero broken mid-word newlines!)
        const isHeading = block.type === 'heading';
        const fontSize = isHeading ? (block.level === 1 ? 13.5 : 11.2) : 9.8;
        const lineH = isHeading ? fontSize + 5.5 : 14.8;
        const useFont = isHeading ? fontBold : block.runs?.every((r) => r.italic) ? fontItalic : fontReg;

        const segments = annotateBlockTextSegments(block.plain || '', report.annotatedSentences || []);
        const tokens = [];
        for (const seg of segments) {
          const cleanSeg = sanitizePdfText(seg.text || '');
          if (!cleanSeg) continue;
          const words = cleanSeg.split(' ').filter(Boolean);
          for (const w of words) {
            tokens.push({ word: w, seg });
          }
        }
        if (tokens.length === 0) continue;

        const spaceW = useFont.widthOfTextAtSize(' ', fontSize);
        const lines = [];
        let curLine = [];
        let curWidth = 0;

        for (const tok of tokens) {
          const wWidth = useFont.widthOfTextAtSize(tok.word, fontSize);
          const needed = curLine.length > 0 ? spaceW + wWidth : wWidth;
          if (curLine.length > 0 && curWidth + needed > maxW) {
            lines.push({ tokens: curLine, width: curWidth });
            curLine = [{ ...tok, width: wWidth }];
            curWidth = wWidth;
          } else {
            curLine.push({ ...tok, width: wWidth });
            curWidth += needed;
          }
        }
        if (curLine.length > 0) lines.push({ tokens: curLine, width: curWidth });

        const markedSegRanks = new Set();
        for (const ln of lines) {
          if (y < bottomY + lineH) startNewSubmissionPage();

          let drawX = leftX;
          if (block.align === 'center') drawX = leftX + Math.max(0, (maxW - ln.width) / 2);
          else if (block.align === 'right') drawX = leftX + Math.max(0, maxW - ln.width);

          // Group contiguous tokens with identical highlight state to draw seamless highlight bands
          let cursorX = drawX;
          for (let ti = 0; ti < ln.tokens.length; ti += 1) {
            const tk = ln.tokens[ti];
            const isLast = ti === ln.tokens.length - 1;
            const nextMatchedSame =
              !isLast &&
              tk.seg.matched &&
              ln.tokens[ti + 1].seg.matched &&
              ln.tokens[ti + 1].seg.rank === tk.seg.rank;

            if (tk.seg.matched) {
              const rectW = tk.width + (nextMatchedSame ? spaceW + 1 : 2);
              outPage.drawRectangle({
                x: cursorX - 1,
                y: y - 3,
                width: rectW,
                height: lineH - 1.5,
                color: c(tk.seg.colorRgb || [225, 29, 72]),
                opacity: 0.24,
              });
              const rankKey = `${tk.seg.rank}-${pageSections.length}`;
              if (!markedSegRanks.has(rankKey)) {
                drawMarginBadgeIfNeeded(y, tk.seg);
                markedSegRanks.add(rankKey);
              }
            }

            outPage.drawText(tk.word, {
              x: cursorX,
              y,
              size: fontSize,
              font: useFont,
              color: isHeading ? colInk : colBody,
            });
            cursorX += tk.width + spaceW;
          }
          y -= lineH;
        }
        y -= isHeading ? 6 : 5;
      }
    }

    const actualSubmissionPages = Math.max(1, pageSections.length - submissionPagesBefore);
    drawCoverStatsCard(actualSubmissionPages);

    const totalActualPages = pageSections.length;
    for (let pi = 0; pi < totalActualPages; pi += 1) {
      const { page, sectionLabel } = pageSections[pi];
      drawChrome(page, pi + 1, totalActualPages, sectionLabel);
    }

    const pdfBytes = await outDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  } catch {
    // Seamless offline / error fallback to native pure-JS PDF builder
    return generateTurnitinPdfBlob(report);
  }
}

/**
 * Compiles an array of PDF content-stream strings (one per A4 page 595x842pt)
 * into a standards-compliant multi-page binary PDF Uint8Array (zero external dependencies).
 */
function assembleMultiPagePdf(pageStreams = []) {
  const streams = pageStreams.length > 0 ? pageStreams : ['BT /F1 12 Tf 50 780 Td (Empty Report) Tj ET'];
  const encoder = new TextEncoder();

  const objects = [];
  const pageKids = [];
  for (let i = 0; i < streams.length; i += 1) {
    pageKids.push(`${6 + i * 2} 0 R`);
  }

  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objects.push(`2 0 obj\n<< /Type /Pages /Count ${streams.length} /Kids [ ${pageKids.join(' ')} ] >>\nendobj\n`);
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');

  for (let i = 0; i < streams.length; i += 1) {
    const pageObjNum = 6 + i * 2;
    const contentObjNum = 7 + i * 2;
    const streamStr = streams[i];
    const streamLen = encoder.encode(streamStr).length;
    objects.push(
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`
    );
    objects.push(
      `${contentObjNum} 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamStr}\nendstream\nendobj\n`
    );
  }

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const chunks = [encoder.encode(header)];
  let offset = chunks[0].length;
  const offsets = [0];

  for (const objStr of objects) {
    offsets.push(offset);
    const bytes = encoder.encode(objStr);
    chunks.push(bytes);
    offset += bytes.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(encoder.encode(xref + trailer));

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * Synchronous pure-JS Turnitin minimalist PDF builder (used as offline fallback & Node unit tests).
 * Matches the clean white Turnitin Cover Page -> Integrity Overview -> Top Sources -> Integrity Submission order.
 */
export function buildTurnitinPdfBytes(report) {
  const pages = [];
  const docTitle = sanitizePdfText(report.fileName || 'Dokumen_Naskah');
  const subId = sanitizePdfText(report.submissionId || 'MS-PLG-000000');
  const dateStr = formatReportDate(report.checkedAt);
  const simPct = Number(report.similarityPct || 0);
  const netPct = Number(report.internetPct || 0);
  const pubPct = Number(report.publicationsPct || 0);
  const stuPct = Number(report.studentPapersPct || 0);
  const aiPct = Number(report.aiAnalysis?.aiWritingPct || 0);
  const scoreColor = simPct >= 45 ? [225, 29, 72] : simPct >= 25 ? [217, 119, 6] : [5, 150, 105];

  const drawMinimalChrome = (ops, pageNum, sectionLabel) => {
    ops.push(`${rgbFill([15, 23, 42])} 44 806 14 14 re f`);
    ops.push(`BT /F2 9 Tf ${rgbFill([255, 255, 255])} 47 809 Td (M) Tj ET`);
    ops.push(`BT /F2 9.5 Tf ${rgbFill([15, 23, 42])} 63 809 Td (manifestudio) Tj ET`);
    ops.push(`BT /F1 8 Tf ${rgbFill([100, 116, 139])} 225 810 Td (Page ${pageNum} - ${pdfEsc(sectionLabel)}) Tj ET`);
    ops.push(`BT /F1 7.8 Tf ${rgbFill([100, 116, 139])} 410 810 Td (Submission ID ${pdfEsc(subId)}) Tj ET`);
    ops.push(`${rgbStroke([226, 232, 240])} 0.7 w 44 798 m 551 798 l S`);

    ops.push(`${rgbStroke([226, 232, 240])} 0.7 w 44 42 m 551 42 l S`);
    ops.push(`BT /F2 7.5 Tf ${rgbFill([100, 116, 139])} 44 28 Td (Manifestudio Standard Report  |  NO REPOSITORY) Tj ET`);
    ops.push(`BT /F1 7.5 Tf ${rgbFill([100, 116, 139])} 445 28 Td (Page ${pageNum} - ${pdfEsc(sectionLabel)}) Tj ET`);
  };

  // ==================== PAGE 1: COVER PAGE ====================
  const cover = [];
  drawMinimalChrome(cover, 1, 'Cover Page');
  cover.push(`BT /F2 9 Tf ${rgbFill([14, 165, 233])} 44 756 Td (STANDARD SIMILARITY & ORIGINALITY REPORT) Tj ET`);
  cover.push(`BT /F2 19 Tf ${rgbFill([15, 23, 42])} 44 730 Td (${pdfEsc(docTitle.slice(0, 46))}) Tj ET`);
  cover.push(`BT /F1 9.5 Tf ${rgbFill([100, 116, 139])} 44 708 Td (Manifestudio Multi-Engine Verification  |  NO REPOSITORY Verified) Tj ET`);
  cover.push(`${rgbStroke([226, 232, 240])} 0.9 w 44 694 m 551 694 l S`);

  cover.push(`BT /F2 11.5 Tf ${rgbFill([15, 23, 42])} 44 668 Td (Document Details) Tj ET`);
  const detailRows = [
    ['Submission ID', subId],
    ['Submission Date', dateStr],
    ['File Name', docTitle],
    ['File Format & Size', `${report.fileFormat || 'TEXT'} (${formatSizeReadable(report.fileSize)})`],
    ['Detected Language', report.language?.label || 'Bahasa Indonesia'],
    ['Repository Policy', 'NO REPOSITORY (Dokumen tidak disimpan/diindeks ke database manapun)'],
  ];
  let dy = 644;
  for (const [k, v] of detailRows) {
    const isNoRepo = k === 'Repository Policy';
    cover.push(`BT /F2 8.2 Tf ${rgbFill([100, 116, 139])} 44 ${dy} Td (${pdfEsc(k)}) Tj ET`);
    cover.push(`BT /F${isNoRepo ? '2' : '1'} 9 Tf ${rgbFill(isNoRepo ? [5, 150, 105] : [15, 23, 42])} 44 ${dy - 13} Td (${pdfEsc(String(v).slice(0, 56))}) Tj ET`);
    dy -= 34;
  }

  // Right stats summary card
  cover.push(`${rgbFill([244, 246, 249])} 380 500 171 174 re f`);
  cover.push(`${rgbStroke([226, 232, 240])} 0.8 w 380 500 171 174 re S`);
  const pageCount = report.originalSource?.pageCount || 1;
  cover.push(`BT /F2 13 Tf ${rgbFill([15, 23, 42])} 396 644 Td (${pageCount} Pages) Tj ET`);
  cover.push(`BT /F1 8 Tf ${rgbFill([100, 116, 139])} 396 630 Td (Original layout preserved) Tj ET`);
  cover.push(`BT /F2 13 Tf ${rgbFill([15, 23, 42])} 396 594 Td (${Number(report.totalWords || 0).toLocaleString('en-US')} Words) Tj ET`);
  cover.push(`BT /F1 8 Tf ${rgbFill([100, 116, 139])} 396 580 Td (Eligible: ${Number(report.eligibleWords || 0).toLocaleString('en-US')}) Tj ET`);
  cover.push(`BT /F2 13 Tf ${rgbFill([15, 23, 42])} 396 544 Td (${Number(report.totalChars || 0).toLocaleString('en-US')} Characters) Tj ET`);
  cover.push(`BT /F1 8 Tf ${rgbFill([100, 116, 139])} 396 530 Td (Similarity: ${simPct}% | Unique: ${report.uniquePct ?? (100 - simPct)}%) Tj ET`);
  pages.push(cover.join('\n'));

  // ==================== PAGE 2: INTEGRITY OVERVIEW ====================
  const ov = [];
  drawMinimalChrome(ov, 2, 'Integrity Overview');
  ov.push(`BT /F2 38 Tf ${rgbFill(scoreColor)} 44 736 Td (${simPct}%) Tj ET`);
  ov.push(`BT /F2 16 Tf ${rgbFill([15, 23, 42])} 146 750 Td (Overall Similarity) Tj ET`);
  ov.push(`BT /F1 9 Tf ${rgbFill([100, 116, 139])} 146 734 Td (${pdfEsc(report.riskLabel || 'ORIGINALITY REPORT')}) Tj ET`);
  ov.push(`BT /F2 10.5 Tf ${rgbFill([15, 23, 42])} 44 694 Td (Filtered from the Report) Tj ET`);
  ov.push(`BT /F1 9 Tf ${rgbFill([51, 65, 85])} 56 676 Td (- Bibliography: ${report.filters?.excludeBibliography ? 'Excluded' : 'Included'}  |  Quoted Text: ${report.filters?.excludeQuotes ? 'Excluded' : 'Included'}) Tj ET`);
  ov.push(`BT /F1 9 Tf ${rgbFill([51, 65, 85])} 56 660 Td (- Small Matches: ${report.filters?.excludeSmallWords ? `< ${report.filters.excludeSmallWords} words` : 'OFF'}  |  NO REPOSITORY Verified) Tj ET`);
  ov.push(`${rgbStroke([226, 232, 240])} 0.8 w 44 644 m 551 644 l S`);

  ov.push(`BT /F2 11.5 Tf ${rgbFill([15, 23, 42])} 44 620 Td (ORIGINALITY REPORT - Top Sources Breakdown) Tj ET`);
  ov.push(`BT /F2 16 Tf ${rgbFill([2, 132, 199])} 44 590 Td (${netPct}%) Tj ET`);
  ov.push(`BT /F2 10 Tf ${rgbFill([15, 23, 42])} 104 593 Td (Internet sources) Tj ET`);
  ov.push(`BT /F2 16 Tf ${rgbFill([124, 58, 237])} 44 558 Td (${pubPct}%) Tj ET`);
  ov.push(`BT /F2 10 Tf ${rgbFill([15, 23, 42])} 104 561 Td (Publications) Tj ET`);
  ov.push(`BT /F2 16 Tf ${rgbFill([5, 150, 105])} 44 526 Td (${stuPct}%) Tj ET`);
  ov.push(`BT /F2 10 Tf ${rgbFill([15, 23, 42])} 104 529 Td (Internal / Self-Check) Tj ET`);
  ov.push(`BT /F2 16 Tf ${rgbFill([217, 119, 6])} 44 494 Td (${aiPct}%) Tj ET`);
  ov.push(`BT /F2 10 Tf ${rgbFill([15, 23, 42])} 104 497 Td (AI Writing Indicator) Tj ET`);
  pages.push(ov.join('\n'));

  // ==================== PAGE 3: TOP SOURCES ====================
  const srcOps = [];
  drawMinimalChrome(srcOps, 3, 'Integrity Overview');
  srcOps.push(`BT /F2 13 Tf ${rgbFill([15, 23, 42])} 44 756 Td (Top Sources - PRIMARY SOURCES) Tj ET`);
  srcOps.push(`${rgbStroke([226, 232, 240])} 0.8 w 44 742 m 551 742 l S`);
  let sy = 716;
  const sources = report.primarySources || [];
  if (sources.length === 0) {
    srcOps.push(`BT /F2 10 Tf ${rgbFill([5, 150, 105])} 44 ${sy} Td (100% Orisinal - Tidak ditemukan kecocokan sumber plagiarisme signifikan.) Tj ET`);
  } else {
    for (const src of sources.slice(0, 12)) {
      const badgeRgb = src.colorRgb || [225, 29, 72];
      srcOps.push(`${rgbFill(badgeRgb)} 44 ${sy - 4} 20 16 re f`);
      srcOps.push(`BT /F2 9 Tf ${rgbFill([255, 255, 255])} ${src.rank >= 10 ? 48 : 51} ${sy} Td (${src.rank}) Tj ET`);
      srcOps.push(`BT /F2 9.5 Tf ${rgbFill([15, 23, 42])} 74 ${sy + 2} Td (${pdfEsc(String(src.title || '').slice(0, 62))}) Tj ET`);
      srcOps.push(`BT /F1 8 Tf ${rgbFill([100, 116, 139])} 74 ${sy - 11} Td (${pdfEsc(`${src.engine || ''} | ${src.matchedWords || 0} kata | ${src.url || ''}`.slice(0, 78))}) Tj ET`);
      const pctLabel = src.exactPct < 1 ? '<1%' : `${src.percent}%`;
      srcOps.push(`BT /F2 12 Tf ${rgbFill([15, 23, 42])} 510 ${sy} Td (${pdfEsc(pctLabel)}) Tj ET`);
      sy -= 42;
      if (sy < 84) break;
    }
  }
  pages.push(srcOps.join('\n'));

  // ==================== PAGES 4..N: INTEGRITY SUBMISSION ====================
  let docOps = [];
  let y = 766;
  const startSubPage = () => {
    docOps = [];
    drawMinimalChrome(docOps, pages.length + 1, 'Integrity Submission');
    y = 766;
  };
  const flushSubPage = () => {
    if (docOps.length > 0) pages.push(docOps.join('\n'));
  };

  startSubPage();
  const sourceByRank = new Map((report.primarySources || []).map((s) => [s.rank, s]));
  for (const s of report.annotatedSentences || []) {
    const rank = s.activeSourceRank;
    const src = rank ? sourceByRank.get(rank) : null;
    const wrapped = wrapPdfLines(s.text, 84);
    for (let li = 0; li < wrapped.length; li += 1) {
      if (y < 66) {
        flushSubPage();
        startSubPage();
      }
      if (src) {
        docOps.push(`${rgbFill(src.colorBgRgb || [253, 230, 236])} 50 ${y - 3} 498 14 re f`);
        if (li === 0) {
          docOps.push(`${rgbFill(src.colorRgb || [225, 29, 72])} 20 ${y - 3} 16 14 re f`);
          docOps.push(`BT /F2 8 Tf ${rgbFill([255, 255, 255])} 25 ${y} Td (${rank}) Tj ET`);
        }
      }
      docOps.push(`BT /F1 9.5 Tf ${rgbFill([30, 41, 59])} 54 ${y} Td (${pdfEsc(wrapped[li])}) Tj ET`);
      y -= 15;
    }
    y -= 4;
  }
  flushSubPage();

  return assembleMultiPagePdf(pages);
}

export function generateTurnitinPdfBlob(report) {
  const bytes = buildTurnitinPdfBytes(report);
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Generates a complete, self-contained HTML Standard Report matching Turnitin's minimalist layout
 * AND preserving the actual original document pages (rendered PDF/Scan images with highlight overlays
 * and left-gutter circular badges, OR structured DOCX/A4 pages).
 */
export function generateTurnitinHtmlReport(report) {
  const safeTitle = escapePlagHtml(report.fileName || 'Dokumen_Naskah');
  const safeId = escapePlagHtml(report.submissionId || '');
  const dateStr = escapePlagHtml(formatReportDate(report.checkedAt));
  const simPct = Number(report.similarityPct || 0);
  const scoreClass = simPct >= 45 ? '#e11d48' : simPct >= 25 ? '#d97706' : '#059669';
  const orig = report.originalSource || null;
  const hlByPage = getPageHighlightsObj(report);
  const hasImagePages = Array.isArray(orig?.pages) && orig.pages.some((p) => p.imageDataUrl);

  let originalPagesHtml = '';
  if (hasImagePages) {
    originalPagesHtml = orig.pages
      .map((pg) => {
        const hl = hlByPage[pg.pageNumber] || hlByPage[String(pg.pageNumber)] || { rects: [], badges: [] };
        const rectsHtml = (hl.rects || [])
          .map(
            (r) =>
              `<div class="orig-hl" style="left:${(r.x * 100).toFixed(3)}%;top:${(r.y * 100).toFixed(3)}%;width:${(r.w * 100).toFixed(3)}%;height:${(r.h * 100).toFixed(3)}%;background:${escapePlagHtml(r.colorHex)}"></div>`
          )
          .join('');
        const badgesHtml = (hl.badges || [])
          .map(
            (b) =>
              `<div class="orig-badge" style="top:${(b.y * 100).toFixed(2)}%;background:${escapePlagHtml(b.colorHex)}">${b.rank}</div>`
          )
          .join('');
        return `
          <div class="orig-page-sheet">
            <div class="orig-page-meta"><span>Halaman ${pg.pageNumber} dari ${orig.pageCount || orig.pages.length}</span><span>Integrity Submission · Dokumen Asli</span></div>
            <div class="orig-page-frame">
              <div class="orig-gutter">${badgesHtml}</div>
              <div class="orig-canvas">
                <img src="${pg.imageDataUrl}" alt="Halaman asli ${pg.pageNumber}" />
                <div class="orig-overlay">${rectsHtml}</div>
              </div>
            </div>
          </div>
        `;
      })
      .join('');
  } else {
    const sheetPages = Array.isArray(orig?.pages) && orig.pages.length > 0 ? orig.pages : [];
    originalPagesHtml = sheetPages
      .map((pg) => {
        const blocksHtml = (pg.blocks || [])
          .map((block) => {
            if (block.type === 'table' && Array.isArray(block.rows)) {
              return `<table class="docx-tbl">${block.rows
                .map((row, ri) => `<tr>${row.map((cell) => (ri === 0 ? `<th>${escapePlagHtml(cell)}</th>` : `<td>${escapePlagHtml(cell)}</td>`)).join('')}</tr>`)
                .join('')}</table>`;
            }
            const segs = annotateBlockTextSegments(block.plain || '', report.annotatedSentences || []);
            const inner = segs
              .map((sg) =>
                sg.matched
                  ? `<mark class="t-hl" style="background:${escapePlagHtml(sg.colorSoft)};border-bottom:2px solid ${escapePlagHtml(sg.colorHex)}"><sup class="t-badge" style="background:${escapePlagHtml(sg.colorHex)}">${sg.rank}</sup>${escapePlagHtml(sg.text)}</mark>`
                  : escapePlagHtml(sg.text)
              )
              .join('');
            const imgs = (block.runs || [])
              .filter((r) => r.type === 'image' && r.src)
              .map((r) => `<img class="docx-img" src="${r.src}" alt="" />`)
              .join('');
            const alignStyle = block.align ? ` style="text-align:${escapePlagHtml(block.align)}"` : '';
            if (block.type === 'heading') {
              const tag = block.level === 1 ? 'h3' : 'h4';
              return `${imgs}<${tag} class="docx-h"${alignStyle}>${inner}</${tag}>`;
            }
            return `${imgs}<p class="docx-p"${alignStyle}>${inner}</p>`;
          })
          .join('');
        return `
          <div class="orig-page-sheet">
            <div class="orig-page-meta"><span>Halaman ${pg.pageNumber} dari ${sheetPages.length}</span><span>Integrity Submission</span></div>
            <div class="docx-a4">${blocksHtml}</div>
          </div>
        `;
      })
      .join('');
  }

  const sourcesHtml = (report.primarySources || []).length === 0
    ? '<p class="t-ok">100% Orisinal — Tidak ditemukan kecocokan sumber plagiarisme signifikan.</p>'
    : (report.primarySources || [])
        .map((src) => {
          const catLabel = src.category === 'publication' ? 'Publication' : src.category === 'student' ? 'Internal Check' : 'Internet Source';
          const pctStr = src.exactPct < 1 ? '&lt;1%' : `${src.percent}%`;
          return `
            <div class="t-source-row">
              <div class="t-rank" style="background:${escapePlagHtml(src.colorHex)}">${src.rank}</div>
              <div class="t-src-meta">
                <span class="t-cat-pill">${escapePlagHtml(catLabel)}</span>
                <strong>${escapePlagHtml(src.title)}</strong>
                <div class="t-src-sub">${escapePlagHtml(src.engine)} · ${src.matchedWords} kata</div>
                ${src.url ? `<a href="${escapePlagHtml(src.url)}" target="_blank" rel="noopener noreferrer">${escapePlagHtml(src.url)}</a>` : ''}
              </div>
              <div class="t-src-pct">${pctStr}</div>
            </div>
          `;
        })
        .join('');

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Report — ${safeTitle}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #eef2f6; color: #0f172a; line-height: 1.6; }
  .sheet { max-width: 920px; margin: 24px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(15,23,42,0.08); }
  .topbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 32px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  .brand { font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 8px; }
  .brand-sq { width: 20px; height: 20px; border-radius: 4px; background: #0f172a; color: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; }
  .body { padding: 30px 34px; }
  .kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: #0284c7; text-transform: uppercase; }
  h1 { margin: 6px 0 4px; font-size: 24px; line-height: 1.25; }
  .sub { color: #64748b; font-size: 13px; margin: 0 0 20px; }
  .cover-grid { display: grid; grid-template-columns: 1fr 220px; gap: 20px; padding: 18px 0; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
  .stats-card { background: #f4f6f9; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  .stats-card strong { display: block; font-size: 16px; }
  .stats-card span { font-size: 11.5px; color: #64748b; }
  .overview-hero { display: flex; align-items: center; gap: 20px; margin: 18px 0; }
  .overview-pct { font-size: 46px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin: 18px 0 24px; }
  .kpi { padding: 14px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
  .kpi strong { display: block; font-size: 24px; font-variant-numeric: tabular-nums; }
  .kpi span { font-size: 11px; font-weight: 700; color: #64748b; }
  h2 { font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; color: #0f172a; border-bottom: 1.5px solid #0f172a; padding-bottom: 6px; margin: 28px 0 14px; }
  .t-source-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
  .t-rank { width: 26px; height: 26px; border-radius: 6px; color: #fff; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .t-cat-pill { display: inline-block; font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 4px; background: #f1f5f9; color: #475569; margin-bottom: 4px; }
  .t-src-meta { flex: 1; min-width: 0; }
  .t-src-meta strong { display: block; font-size: 14px; }
  .t-src-sub { font-size: 12px; color: #64748b; }
  .t-src-meta a { font-size: 12px; color: #0284c7; word-break: break-all; }
  .t-src-pct { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .orig-page-sheet { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; margin: 18px 0; overflow: hidden; page-break-inside: avoid; }
  .orig-page-meta { display: flex; justify-content: space-between; padding: 8px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 11.5px; font-weight: 700; color: #64748b; }
  .orig-page-frame { display: flex; align-items: stretch; padding: 14px 14px 14px 6px; }
  .orig-gutter { position: relative; width: 32px; flex-shrink: 0; }
  .orig-badge { position: absolute; left: 4px; transform: translateY(-50%); width: 22px; height: 22px; border-radius: 999px; color: #fff; font-size: 11px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
  .orig-canvas { position: relative; flex: 1; border: 1px solid #e2e8f0; }
  .orig-canvas img { display: block; width: 100%; height: auto; }
  .orig-overlay { position: absolute; inset: 0; pointer-events: none; }
  .orig-hl { position: absolute; opacity: 0.28; border-radius: 2px; }
  .docx-a4 { padding: 34px 40px; font-family: Georgia, "Times New Roman", serif; font-size: 14.5px; line-height: 1.75; }
  .docx-h { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 14px 0 8px; }
  .docx-p { margin: 0 0 10px; }
  .docx-tbl { width: 100%; border-collapse: collapse; margin: 12px 0; font-family: sans-serif; font-size: 12.5px; }
  .docx-tbl th, .docx-tbl td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
  .docx-tbl th { background: #f8fafc; }
  .docx-img { max-width: 100%; height: auto; margin: 10px 0; border-radius: 6px; }
  .t-hl { padding: 1px 3px; border-radius: 3px; }
  .t-badge { display: inline-block; color: #fff; font-size: 10px; font-weight: 800; padding: 0 5px; border-radius: 999px; margin-right: 4px; }
  .print-btn { padding: 7px 14px; border-radius: 7px; border: none; background: #0f172a; color: #fff; font-weight: 700; cursor: pointer; font-size: 12px; }
  @media print { body { background: #fff; } .sheet { margin: 0; box-shadow: none; } .print-btn { display: none; } }
  @media (max-width: 640px) { .body { padding: 18px; } .cover-grid, .kpi-grid { grid-template-columns: 1fr; } }
</style>
</head>
<body>
  <article class="sheet">
    <header class="topbar">
      <div class="brand"><span class="brand-sq">M</span><span>Manifestudio · Standard Report</span></div>
      <div>Submission ID: <strong>${safeId}</strong></div>
      <button class="print-btn" onclick="window.print()">Cetak / Simpan PDF</button>
    </header>
    <div class="body">
      <div class="kicker">Standard Similarity &amp; Originality Report · No Repository</div>
      <h1>${safeTitle}</h1>
      <p class="sub">${dateStr} · Status Repositori: <strong style="color:#059669">NO REPOSITORY</strong></p>

      <div class="cover-grid">
        <div>
          <p><strong>Submission ID:</strong> ${safeId}</p>
          <p><strong>Format &amp; Ukuran:</strong> ${escapePlagHtml(report.fileFormat || 'TEXT')} (${formatSizeReadable(report.fileSize)})</p>
          <p><strong>Bahasa:</strong> ${escapePlagHtml(report.language?.label || 'Bahasa Indonesia')}</p>
          <p><strong>Kebijakan Privasi:</strong> <span style="color:#059669;font-weight:700">NO REPOSITORY</span> — Tidak pernah disimpan atau diindeks ke database manapun.</p>
        </div>
        <div class="stats-card">
          <div><strong>${orig?.pageCount || 1} Pages</strong><span>Dokumen asli dipertahankan</span></div>
          <div><strong>${Number(report.totalWords || 0).toLocaleString('id-ID')} Words</strong><span>Eligible: ${Number(report.eligibleWords || 0).toLocaleString('id-ID')}</span></div>
          <div><strong>${Number(report.totalChars || 0).toLocaleString('id-ID')} Characters</strong><span>Orisinal: ${report.uniquePct ?? (100 - simPct)}%</span></div>
        </div>
      </div>

      <div class="overview-hero">
        <div class="overview-pct" style="color:${scoreClass}">${simPct}%</div>
        <div>
          <strong style="font-size:18px;display:block">Overall Similarity</strong>
          <span style="color:#64748b;font-size:13px">${escapePlagHtml(report.riskLabel || '')}</span>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><strong style="color:#0284c7">${report.internetPct || 0}%</strong><span>Internet Sources</span></div>
        <div class="kpi"><strong style="color:#7c3aed">${report.publicationsPct || 0}%</strong><span>Publications</span></div>
        <div class="kpi"><strong style="color:#059669">${report.studentPapersPct || 0}%</strong><span>Internal Check</span></div>
        <div class="kpi"><strong style="color:#d97706">${report.aiAnalysis?.aiWritingPct || 0}%</strong><span>AI Indicator</span></div>
      </div>

      <h2>Top Sources</h2>
      <div>${sourcesHtml}</div>

      <h2>Dokumen Asli Beranotasi (Integrity Submission)</h2>
      <div>${originalPagesHtml}</div>
    </div>
  </article>
</body>
</html>`;
}

export function generateTurnitinJsonReport(report) {
  return JSON.stringify(
    {
      generator: 'Manifestudio Integrated Plagiarism Checker v69 (Standard Report)',
      repositoryMode: 'no-repository',
      repositoryLabel: report.repositoryLabel || 'No Repository (Tidak disimpan/diindeks ke repositori manapun)',
      submissionId: report.submissionId,
      checkedAt: report.checkedAt,
      fileName: report.fileName,
      fileFormat: report.fileFormat,
      pageCount: report.originalSource?.pageCount || 1,
      totalWords: report.totalWords,
      totalChars: report.totalChars,
      similarityPct: report.similarityPct,
      uniquePct: report.uniquePct,
      internetPct: report.internetPct,
      publicationsPct: report.publicationsPct,
      studentPapersPct: report.studentPapersPct,
      aiWritingPct: report.aiAnalysis?.aiWritingPct || 0,
      riskLevel: report.riskLevel,
      riskLabel: report.riskLabel,
      filters: report.filters,
      primarySources: report.primarySources,
      aiAnalysis: report.aiAnalysis,
      engineStatuses: report.engineStatuses,
    },
    null,
    2
  );
}
