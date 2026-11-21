/**
 * Manifestudio Turnitin Latest-Style Similarity Report Exporter (v67)
 * Generates:
 * 1. Genuine Multi-Page Vector PDF (`generateTurnitinPdfBlob`) modeled on Turnitin's latest Originality Report:
 *    - Page 1: Turnitin Cover Sheet (Document Title, Submission ID, Date, File Info, Word/Char Count, Engines Fused)
 *    - Pages 2..N: Annotated Manuscript with real colored vector highlight bands & inline [1], [2] source badges
 *    - Final Pages: Originality Report Summary (Crimson Similarity Index %, Internet %, Publications %, AI Writing %,
 *      Ranked Primary Sources table with color square badges, URL/DOI, and Turnitin Filter Exclusion footer)
 * 2. Self-Contained Interactive HTML Report (`generateTurnitinHtmlReport`) with Print-to-PDF `@media print` styling
 * 3. Structured JSON Audit Report (`generateTurnitinJsonReport`)
 */

import { escapePlagHtml } from './plagiarism-logic.js?v=67';

function sanitizePdfText(str = '') {
  return String(str || '')
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

/**
 * Compiles an array of PDF content-stream strings (one per A4 page 595x842pt)
 * into a standards-compliant multi-page binary PDF Uint8Array.
 */
function assembleMultiPagePdf(pageStreams = []) {
  const streams = pageStreams.length > 0 ? pageStreams : ['BT /F1 12 Tf 50 780 Td (Empty Report) Tj ET'];
  const encoder = new TextEncoder();

  // Object allocation:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Helvetica)
  // 4: Font F2 (Helvetica-Bold)
  // 5: Font F3 (Courier)
  // For each page i (0..N-1):
  //   pageObj = 6 + i * 2
  //   contentObj = 7 + i * 2
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
  const offsets = [0]; // object 0 free entry

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
 * Generates a Turnitin Latest-style multi-page PDF Uint8Array (and Blob helper).
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

  const drawPageChrome = (ops, pageNum, totalLabel, sectionTitle) => {
    // Top Turnitin-style slim crimson + navy bar
    ops.push(`${rgbFill([225, 29, 72])} 0 834 190 8 re f`);
    ops.push(`${rgbFill([15, 23, 42])} 190 834 405 8 re f`);
    // Header text
    ops.push(`BT /F2 8.5 Tf ${rgbFill([15, 23, 42])} 48 814 Td (${pdfEsc(docTitle.slice(0, 58))}) Tj ET`);
    ops.push(`BT /F1 8 Tf ${rgbFill([100, 116, 139])} 395 814 Td (${pdfEsc(sectionTitle)}) Tj ET`);
    ops.push(`${rgbStroke([226, 232, 240])} 0.7 w 48 806 m 547 806 l S`);
    // Footer
    ops.push(`${rgbStroke([226, 232, 240])} 0.7 w 48 44 m 547 44 l S`);
    ops.push(`BT /F1 7.5 Tf ${rgbFill([100, 116, 139])} 48 31 Td (Manifestudio Integrated Plagiarism Checker  |  Submission ID: ${pdfEsc(subId)}) Tj ET`);
    ops.push(`BT /F2 8 Tf ${rgbFill([71, 85, 105])} 492 31 Td (Page ${pageNum}${totalLabel}) Tj ET`);
  };

  // ==================== PAGE 1: TURNITIN COVER PAGE ====================
  const cover = [];
  // Bold top hero band (Turnitin Latest clean institutional cover)
  cover.push(`${rgbFill([15, 23, 42])} 0 726 595 116 re f`);
  cover.push(`${rgbFill([225, 29, 72])} 0 720 595 6 re f`);
  cover.push(`BT /F2 11 Tf ${rgbFill([244, 63, 94])} 48 806 Td (MANIFESTUDIO  |  SIMILARITY & ORIGINALITY REPORT) Tj ET`);
  cover.push(`BT /F2 22 Tf ${rgbFill([255, 255, 255])} 48 776 Td (${pdfEsc(docTitle.slice(0, 42))}) Tj ET`);
  cover.push(`BT /F1 10 Tf ${rgbFill([203, 213, 225])} 48 750 Td (Multi-Engine Integrated Verification: OpenAlex + Crossref + DOAJ + Wikipedia + Multi-AI + Turnitin API) Tj ET`);

  // Big Similarity Summary Card on Cover
  cover.push(`${rgbFill([248, 250, 252])} 48 566 499 124 re f`);
  cover.push(`${rgbStroke([226, 232, 240])} 1 w 48 566 499 124 re S`);
  const scoreColor = simPct >= 45 ? [225, 29, 72] : simPct >= 25 ? [217, 119, 6] : [5, 150, 105];
  cover.push(`BT /F2 44 Tf ${rgbFill(scoreColor)} 72 624 Td (${simPct}%) Tj ET`);
  cover.push(`BT /F2 10 Tf ${rgbFill([15, 23, 42])} 72 602 Td (OVERALL SIMILARITY INDEX) Tj ET`);
  cover.push(`BT /F1 8.5 Tf ${rgbFill([100, 116, 139])} 72 586 Td (${pdfEsc(report.riskLabel || '')}) Tj ET`);

  // 3 Breakdown Metrics right side of Cover Card
  const metrics = [
    { x: 255, val: `${netPct}%`, lbl: 'INTERNET SOURCES', col: [2, 132, 199] },
    { x: 356, val: `${pubPct}%`, lbl: 'PUBLICATIONS', col: [124, 58, 237] },
    { x: 454, val: `${aiPct}%`, lbl: 'AI WRITING IND.', col: [217, 119, 6] },
  ];
  for (const m of metrics) {
    cover.push(`BT /F2 24 Tf ${rgbFill(m.col)} ${m.x} 632 Td (${m.val}) Tj ET`);
    cover.push(`BT /F2 7.5 Tf ${rgbFill([71, 85, 105])} ${m.x} 612 Td (${m.lbl}) Tj ET`);
  }
  cover.push(`BT /F1 8.5 Tf ${rgbFill([71, 85, 105])} 255 586 Td (Unique Content: ${report.uniquePct ?? (100 - simPct)}%  |  Self-Check / Internal: ${stuPct}%) Tj ET`);

  // Submission Metadata Table (Turnitin Cover Sheet style)
  cover.push(`BT /F2 12 Tf ${rgbFill([15, 23, 42])} 48 532 Td (SUBMISSION DETAILS) Tj ET`);
  cover.push(`${rgbStroke([15, 23, 42])} 1.2 w 48 524 m 547 524 l S`);

  const metaRows = [
    ['Submission ID', subId],
    ['Submission Date', dateStr],
    ['File Name', docTitle],
    ['File Format', `${report.fileFormat || 'TEXT'} (${Math.max(1, Math.round((report.fileSize || 0) / 1024))} KB)`],
    ['Word Count', `${Number(report.totalWords || 0).toLocaleString('en-US')} words (Eligible: ${Number(report.eligibleWords || 0).toLocaleString('en-US')})`],
    ['Character Count', `${Number(report.totalChars || 0).toLocaleString('en-US')} characters`],
    ['Detected Language', report.language?.label || 'Bahasa Indonesia'],
    ['Matched Primary Sources', `${(report.primarySources || []).length} verified sources`],
    ['AI Consensus Models', (report.aiAnalysis?.modelsUsed || []).length > 0 ? report.aiAnalysis.modelsUsed.join(', ') : 'Stylometric + Multi-API Fusion'],
    ['Scan Duration', `${((report.durationMs || 0) / 1000).toFixed(1)}s`],
  ];

  let my = 500;
  for (let i = 0; i < metaRows.length; i += 1) {
    const [k, v] = metaRows[i];
    if (i % 2 === 0) {
      cover.push(`${rgbFill([248, 250, 252])} 48 ${my - 7} 499 22 re f`);
    }
    cover.push(`BT /F2 9 Tf ${rgbFill([71, 85, 105])} 58 ${my} Td (${pdfEsc(k)}) Tj ET`);
    cover.push(`BT /F1 9 Tf ${rgbFill([15, 23, 42])} 215 ${my} Td (${pdfEsc(String(v).slice(0, 62))}) Tj ET`);
    my -= 24;
  }

  // Active Engines Fused Box
  cover.push(`BT /F2 11 Tf ${rgbFill([15, 23, 42])} 48 232 Td (INTEGRATED ENGINES COMBINED IN THIS REPORT) Tj ET`);
  cover.push(`${rgbStroke([226, 232, 240])} 0.8 w 48 224 m 547 224 l S`);
  let ey = 204;
  for (const eng of (report.engineStatuses || []).slice(0, 7)) {
    const badgeCol = eng.status === 'done' ? [5, 150, 105] : eng.status === 'standby' ? [100, 116, 139] : [217, 119, 6];
    cover.push(`${rgbFill(badgeCol)} 52 ${ey + 1} 6 6 re f`);
    cover.push(`BT /F2 8.5 Tf ${rgbFill([15, 23, 42])} 66 ${ey} Td (${pdfEsc(eng.name)}) Tj ET`);
    cover.push(`BT /F1 8 Tf ${rgbFill([100, 116, 139])} 315 ${ey} Td (${pdfEsc(eng.note || eng.status).slice(0, 44)}) Tj ET`);
    ey -= 18;
  }

  cover.push(`${rgbStroke([226, 232, 240])} 0.7 w 48 44 m 547 44 l S`);
  cover.push(`BT /F1 7.5 Tf ${rgbFill([100, 116, 139])} 48 31 Td (Generated by Manifestudio Plagiarism Checker  |  https://manifestudio.my.id) Tj ET`);
  cover.push(`BT /F2 8 Tf ${rgbFill([71, 85, 105])} 492 31 Td (Page 1) Tj ET`);
  pages.push(cover.join('\n'));

  // ==================== PAGES 2..N: ANNOTATED MANUSCRIPT ====================
  let docOps = [];
  let y = 784;
  const startDocPage = () => {
    docOps = [];
    drawPageChrome(docOps, pages.length + 1, '', 'ANNOTATED MANUSCRIPT');
    y = 784;
  };
  const flushDocPage = () => {
    if (docOps.length > 0) pages.push(docOps.join('\n'));
  };

  startDocPage();
  docOps.push(`BT /F2 12 Tf ${rgbFill([15, 23, 42])} 48 ${y} Td (ANNOTATED DOCUMENT VIEW  (Color-Coded Source Highlights)) Tj ET`);
  y -= 22;

  const sourceByRank = new Map((report.primarySources || []).map((s) => [s.rank, s]));
  const sentences = report.annotatedSentences || [];

  for (const s of sentences) {
    const rank = s.activeSourceRank;
    const src = rank ? sourceByRank.get(rank) : null;
    const prefix = rank ? `[${rank}] ` : '';
    const wrapped = wrapPdfLines(`${prefix}${s.text}`, 86);
    if (wrapped.length === 0) continue;

    for (let li = 0; li < wrapped.length; li += 1) {
      if (y < 66) {
        flushDocPage();
        startDocPage();
      }
      const lineStr = wrapped[li];
      if (src) {
        // Draw Turnitin-style colored highlight band behind matched sentence line
        const bg = src.colorBgRgb || [253, 230, 236];
        const bar = src.colorRgb || [225, 29, 72];
        docOps.push(`${rgbFill(bg)} 46 ${y - 3} 503 14 re f`);
        if (li === 0) {
          docOps.push(`${rgbFill(bar)} 46 ${y - 3} 3 14 re f`);
        }
        docOps.push(`BT /F1 9.5 Tf ${rgbFill([15, 23, 42])} 53 ${y} Td (${pdfEsc(lineStr)}) Tj ET`);
      } else if (s.excludedReason) {
        docOps.push(`BT /F1 9 Tf ${rgbFill([148, 163, 184])} 50 ${y} Td (${pdfEsc(lineStr)}) Tj ET`);
      } else {
        docOps.push(`BT /F1 9.5 Tf ${rgbFill([30, 41, 59])} 50 ${y} Td (${pdfEsc(lineStr)}) Tj ET`);
      }
      y -= 15;
    }
    y -= 4;
  }
  flushDocPage();

  // ==================== FINAL PAGES: TURNITIN ORIGINALITY REPORT SUMMARY ====================
  let sumOps = [];
  let sy = 784;
  const startSumPage = () => {
    sumOps = [];
    drawPageChrome(sumOps, pages.length + 1, '', 'ORIGINALITY REPORT');
    sy = 784;
  };
  const flushSumPage = () => {
    if (sumOps.length > 0) pages.push(sumOps.join('\n'));
  };

  startSumPage();

  // Classic Turnitin Originality Report Top Banner
  sumOps.push(`BT /F2 11 Tf ${rgbFill([100, 116, 139])} 48 ${sy} Td (ORIGINALITY REPORT) Tj ET`);
  sy -= 36;
  sumOps.push(`BT /F2 34 Tf ${rgbFill(scoreColor)} 48 ${sy} Td (${simPct}%) Tj ET`);
  sumOps.push(`BT /F2 22 Tf ${rgbFill([15, 23, 42])} 185 ${sy + 4} Td (${netPct}%) Tj ET`);
  sumOps.push(`BT /F2 22 Tf ${rgbFill([15, 23, 42])} 315 ${sy + 4} Td (${pubPct}%) Tj ET`);
  sumOps.push(`BT /F2 22 Tf ${rgbFill([15, 23, 42])} 445 ${sy + 4} Td (${aiPct}%) Tj ET`);
  sy -= 14;
  sumOps.push(`BT /F2 7.5 Tf ${rgbFill([100, 116, 139])} 48 ${sy} Td (SIMILARITY INDEX) Tj ET`);
  sumOps.push(`BT /F2 7.5 Tf ${rgbFill([100, 116, 139])} 185 ${sy} Td (INTERNET SOURCES) Tj ET`);
  sumOps.push(`BT /F2 7.5 Tf ${rgbFill([100, 116, 139])} 315 ${sy} Td (PUBLICATIONS) Tj ET`);
  sumOps.push(`BT /F2 7.5 Tf ${rgbFill([100, 116, 139])} 445 ${sy} Td (AI WRITING / PARAPHRASE) Tj ET`);

  sy -= 16;
  sumOps.push(`${rgbStroke([225, 29, 72])} 1.5 w 48 ${sy} m 547 ${sy} l S`);
  sy -= 22;
  sumOps.push(`BT /F2 10.5 Tf ${rgbFill([15, 23, 42])} 48 ${sy} Td (PRIMARY SOURCES) Tj ET`);
  sy -= 22;

  const sources = report.primarySources || [];
  if (sources.length === 0) {
    sumOps.push(`BT /F1 9.5 Tf ${rgbFill([5, 150, 105])} 48 ${sy} Td (Tidak ditemukan kecocokan sumber plagiarisme signifikan pada dokumen ini (100% Orisinal).) Tj ET`);
    sy -= 24;
  } else {
    for (const src of sources) {
      if (sy < 110) {
        flushSumPage();
        startSumPage();
      }
      const badgeRgb = src.colorRgb || [225, 29, 72];
      // Turnitin colored rank square badge
      sumOps.push(`${rgbFill(badgeRgb)} 48 ${sy - 4} 20 16 re f`);
      sumOps.push(`BT /F2 9 Tf ${rgbFill([255, 255, 255])} ${src.rank >= 10 ? 52 : 55} ${sy} Td (${src.rank}) Tj ET`);

      // Source Title + Meta
      const titleLine = sanitizePdfText(src.title || 'Sumber').slice(0, 62);
      const urlLine = sanitizePdfText(src.url || (src.doi ? `https://doi.org/${src.doi}` : src.engine)).slice(0, 74);
      const catLabel =
        src.category === 'publication'
          ? 'Publication'
          : src.category === 'student'
          ? 'Internal / Student Check'
          : 'Internet Source';

      sumOps.push(`BT /F2 9.5 Tf ${rgbFill([15, 23, 42])} 78 ${sy + 2} Td (${pdfEsc(titleLine)}) Tj ET`);
      sumOps.push(`BT /F1 8 Tf ${rgbFill([100, 116, 139])} 78 ${sy - 10} Td (${pdfEsc(`${catLabel}  |  ${src.engine}  |  ${src.matchedWords} kata`)}) Tj ET`);
      if (urlLine) {
        sumOps.push(`BT /F1 7.5 Tf ${rgbFill([2, 132, 199])} 78 ${sy - 20} Td (${pdfEsc(urlLine)}) Tj ET`);
      }

      // Right-aligned % match (Turnitin style)
      const pctLabel = src.exactPct < 1 ? '<1%' : `${src.percent}%`;
      sumOps.push(`BT /F2 12 Tf ${rgbFill([15, 23, 42])} 510 ${sy} Td (${pdfEsc(pctLabel)}) Tj ET`);

      sy -= 34;
      sumOps.push(`${rgbStroke([241, 245, 249])} 0.6 w 48 ${sy + 6} m 547 ${sy + 6} l S`);
    }
  }

  // Turnitin Exclusion Filter Footer Box
  if (sy < 120) {
    flushSumPage();
    startSumPage();
  }
  sy -= 14;
  sumOps.push(`${rgbFill([248, 250, 252])} 48 ${sy - 46} 499 58 re f`);
  sumOps.push(`${rgbStroke([226, 232, 240])} 0.8 w 48 ${sy - 46} 499 58 re S`);
  sumOps.push(`BT /F2 8.5 Tf ${rgbFill([15, 23, 42])} 60 ${sy - 4} Td (REPORT FILTERS & EXCLUSIONS) Tj ET`);
  sumOps.push(
    `BT /F1 8.5 Tf ${rgbFill([71, 85, 105])} 60 ${sy - 20} Td (Exclude quotes: ${report.filters?.excludeQuotes ? 'ON' : 'OFF'}     |     Exclude bibliography: ${report.filters?.excludeBibliography ? 'ON' : 'OFF'}     |     Exclude matches: ${report.filters?.excludeSmallWords ? `< ${report.filters.excludeSmallWords} words` : 'OFF'}) Tj ET`
  );
  sumOps.push(
    `BT /F1 8 Tf ${rgbFill([100, 116, 139])} 60 ${sy - 35} Td (AI Stylometry Verdict: ${pdfEsc(report.aiAnalysis?.stylometric?.verdict || 'Terverifikasi')}) Tj ET`
  );

  flushSumPage();
  return assembleMultiPagePdf(pages);
}

export function generateTurnitinPdfBlob(report) {
  const bytes = buildTurnitinPdfBytes(report);
  return new Blob([bytes], { type: 'application/pdf' });
}

/**
 * Generates a complete, self-contained, Turnitin Latest-styled Interactive HTML Report
 * (ready for offline viewing AND crisp A4 Print-to-PDF).
 */
export function generateTurnitinHtmlReport(report) {
  const safeTitle = escapePlagHtml(report.fileName || 'Dokumen_Naskah');
  const safeId = escapePlagHtml(report.submissionId || '');
  const dateStr = escapePlagHtml(formatReportDate(report.checkedAt));
  const simPct = Number(report.similarityPct || 0);
  const scoreClass = simPct >= 45 ? '#e11d48' : simPct >= 25 ? '#d97706' : '#059669';

  const manuscriptHtml = (report.annotatedSentences || [])
    .map((s) => {
      if (s.activeSourceRank && s.activeColorHex) {
        return `<span class="t-hl" style="background:${escapePlagHtml(s.activeColorSoft)};border-bottom:2px solid ${escapePlagHtml(s.activeColorHex)}"><sup class="t-badge" style="background:${escapePlagHtml(s.activeColorHex)}">${s.activeSourceRank}</sup>${escapePlagHtml(s.text)}</span> `;
      }
      if (s.excludedReason) {
        return `<span class="t-excl" title="Dikecualikan (${escapePlagHtml(s.excludedReason)})">${escapePlagHtml(s.text)}</span> `;
      }
      return `<span>${escapePlagHtml(s.text)}</span> `;
    })
    .join('');

  const sourcesHtml = (report.primarySources || []).length === 0
    ? '<p class="t-ok">Tidak ditemukan kecocokan sumber plagiarisme signifikan (100% Orisinal).</p>'
    : (report.primarySources || [])
        .map((src) => {
          const catLabel = src.category === 'publication' ? 'Publication' : src.category === 'student' ? 'Internal Check' : 'Internet Source';
          const pctStr = src.exactPct < 1 ? '&lt;1%' : `${src.percent}%`;
          return `
            <div class="t-source-row">
              <div class="t-rank" style="background:${escapePlagHtml(src.colorHex)}">${src.rank}</div>
              <div class="t-src-meta">
                <strong>${escapePlagHtml(src.title)}</strong>
                <div class="t-src-sub">${escapePlagHtml(catLabel)} · ${escapePlagHtml(src.engine)} · ${src.matchedWords} kata</div>
                ${src.url ? `<a href="${escapePlagHtml(src.url)}" target="_blank" rel="noopener noreferrer">${escapePlagHtml(src.url)}</a>` : ''}
              </div>
              <div class="t-src-pct">${pctStr}</div>
            </div>
          `;
        })
        .join('');

  const recsHtml = (report.aiAnalysis?.recommendations || [])
    .map((r) => `<li>${escapePlagHtml(r)}</li>`)
    .join('');

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Similarity Report — ${safeTitle}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f1f5f9; color: #0f172a; line-height: 1.65; }
  .sheet { max-width: 920px; margin: 24px auto; background: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 12px 36px rgba(15,23,42,0.08); }
  .hero { background: #0f172a; color: #ffffff; padding: 28px 36px; border-bottom: 5px solid #e11d48; }
  .hero-kicker { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #fb7185; text-transform: uppercase; }
  .hero h1 { margin: 6px 0 4px; font-size: 24px; line-height: 1.25; }
  .hero-sub { font-size: 13px; color: #cbd5e1; margin: 0; }
  .body { padding: 28px 36px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 24px; }
  .kpi { padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; }
  .kpi strong { display: block; font-size: 30px; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .kpi span { font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.04em; text-transform: uppercase; }
  .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13px; }
  .meta-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  .meta-table td:first-child { width: 210px; font-weight: 700; color: #475569; background: #f8fafc; }
  h2 { font-size: 14px; letter-spacing: 0.06em; text-transform: uppercase; color: #0f172a; border-bottom: 2px solid #e11d48; padding-bottom: 6px; margin: 28px 0 14px; }
  .manuscript { font-size: 14.5px; line-height: 1.9; color: #1e293b; text-align: justify; }
  .t-hl { padding: 2px 4px; border-radius: 4px; }
  .t-badge { display: inline-block; color: #fff; font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 4px; margin-right: 4px; vertical-align: middle; }
  .t-excl { color: #94a3b8; }
  .t-source-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
  .t-rank { width: 26px; height: 26px; border-radius: 6px; color: #fff; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .t-src-meta { flex: 1; min-width: 0; }
  .t-src-meta strong { display: block; font-size: 14px; color: #0f172a; }
  .t-src-sub { font-size: 12px; color: #64748b; margin: 2px 0; }
  .t-src-meta a { font-size: 12px; color: #0284c7; word-break: break-all; }
  .t-src-pct { font-size: 18px; font-weight: 800; font-variant-numeric: tabular-nums; color: #0f172a; flex-shrink: 0; }
  .t-ok { color: #059669; font-weight: 600; }
  .filters { margin-top: 24px; padding: 14px 16px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 12.5px; color: #475569; }
  .print-btn { float: right; padding: 8px 14px; border-radius: 8px; border: none; background: #e11d48; color: #fff; font-weight: 700; cursor: pointer; }
  @media print { body { background: #fff; } .sheet { margin: 0; box-shadow: none; border-radius: 0; } .print-btn { display: none; } }
  @media (max-width: 640px) { .body, .hero { padding: 20px; } .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>
  <article class="sheet">
    <header class="hero">
      <button class="print-btn" onclick="window.print()">Cetak / Simpan PDF</button>
      <div class="hero-kicker">Manifestudio · Originality &amp; Similarity Report</div>
      <h1>${safeTitle}</h1>
      <p class="hero-sub">Submission ID: ${safeId} · ${dateStr}</p>
    </header>
    <div class="body">
      <div class="kpi-grid">
        <div class="kpi"><strong style="color:${scoreClass}">${simPct}%</strong><span>Similarity Index</span></div>
        <div class="kpi"><strong style="color:#0284c7">${report.internetPct || 0}%</strong><span>Internet Sources</span></div>
        <div class="kpi"><strong style="color:#7c3aed">${report.publicationsPct || 0}%</strong><span>Publications</span></div>
        <div class="kpi"><strong style="color:#d97706">${report.aiAnalysis?.aiWritingPct || 0}%</strong><span>AI Writing Indicator</span></div>
      </div>
      <table class="meta-table">
        <tr><td>Nama Berkas</td><td>${safeTitle} (${escapePlagHtml(report.fileFormat || 'TEXT')})</td></tr>
        <tr><td>Jumlah Kata / Karakter</td><td>${Number(report.totalWords || 0).toLocaleString('id-ID')} kata · ${Number(report.totalChars || 0).toLocaleString('id-ID')} karakter</td></tr>
        <tr><td>Status Evaluasi</td><td>${escapePlagHtml(report.riskLabel || '')} (Orisinalitas ${report.uniquePct ?? (100 - simPct)}%)</td></tr>
        <tr><td>Mesin Terintegrasi</td><td>OpenAlex · Crossref · DOAJ · Wikipedia ID/EN · Multi-AI Ensemble · Local Winnowing${report.turnitinApiConnected ? ' · Turnitin Core API' : ''}</td></tr>
      </table>

      <h2>Naskah Teranotasi (Highlight Warna Sumber)</h2>
      <div class="manuscript">${manuscriptHtml}</div>

      <h2>Primary Sources (Daftar Sumber Cocok)</h2>
      <div>${sourcesHtml}</div>

      <h2>Rekomendasi Perbaikan &amp; Integritas Akademik</h2>
      <ul>${recsHtml}</ul>

      <div class="filters">
        <strong>Filter Laporan:</strong>
        Exclude quotes: <b>${report.filters?.excludeQuotes ? 'ON' : 'OFF'}</b> ·
        Exclude bibliography: <b>${report.filters?.excludeBibliography ? 'ON' : 'OFF'}</b> ·
        Exclude small matches: <b>${report.filters?.excludeSmallWords ? `&lt; ${report.filters.excludeSmallWords} kata` : 'OFF'}</b>
      </div>
    </div>
  </article>
</body>
</html>`;
}

export function generateTurnitinJsonReport(report) {
  return JSON.stringify(
    {
      generator: 'Manifestudio Integrated Plagiarism Checker v67',
      submissionId: report.submissionId,
      checkedAt: report.checkedAt,
      fileName: report.fileName,
      fileFormat: report.fileFormat,
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
