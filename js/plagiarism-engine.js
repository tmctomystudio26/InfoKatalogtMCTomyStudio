/**
 * Manifestudio Integrated Plagiarism Engine (v69 — Authentic Original-Document & No Repository Mode)
 * 1. Universal All-File Extractor preserving 100% ORIGINAL document pages/layout:
 *    - PDF (Text Layer + Auto Multi-Page OCR Scan): keeps raw `pdfBytes` + crisp page preview images + normalized word bboxes
 *    - Images (PNG/JPG/WEBP): keeps original image + OCR word bboxes
 *    - DOCX: parses OOXML paragraphs, headings, bold/italic/underline, alignment, tables, & embedded media images
 *    - PPTX, ODT, EPUB, XLSX, RTF, HTML, TXT/MD/Code: clean paginated A4 sheets
 * 2. Unified On-Click Pipeline: zero wait on file selection; extraction + OCR + 6-engine parallel scan
 *    run together under one live 0-100% cancellable progress bar.
 */

import {
  extractZipEntries,
  parseDocxBuffer,
  parseExcelBuffer,
  extractTextFromPdfBuffer,
} from './converter.js?v=100';
import {
  extractPdfDetailedWithPdfJs,
  loadPdfLib,
  renderPdfPagesToBlobs,
  renderPdfPagesToPreviewImages,
} from './media-engine.js?v=100';
import {
  buildFaithfulPdfFromRenderedPages,
  parseDocxRichModel,
  renderDocxToFaithfulPages,
} from './docx-fidelity.js?v=100';
import {
  executeModelTarget,
  getCachedModelRegistry,
  loadStoredByokKeys,
  loadStoredLimitMap,
  syncLiveModelRegistry,
} from './manifest-ai.js?v=67';
import { planEnsembleExecution } from './manifest-ai-logic.js?v=67';
import {
  PLAGIARISM_STORAGE_KEYS,
  assessExtractedTextQuality,
  buildPlagiarismSearchQueries,
  countWords,
  detectDocumentLanguage,
  escapePlagHtml,
  extractReadableTextFromBinaryBytes,
  fusePlagiarismReport,
  normalizePlainText,
  parseAiPlagiarismAuditJson,
  reconstructOpenAlexAbstract,
  segmentDocumentSentences,
  stripHtmlOrXmlToPlainText,
  stripRtfToPlainText,
} from './plagiarism-logic.js?v=69';

const API_TIMEOUT_MS = 9000;
const AI_AUDIT_TIMEOUT_MS = 18000;

export function loadPlagiarismApiConfig() {
  try {
    const raw = localStorage.getItem(PLAGIARISM_STORAGE_KEYS.API_CONFIG);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      turnitinEndpoint: String(parsed.turnitinEndpoint || '').trim(),
      turnitinApiKey: String(parsed.turnitinApiKey || '').trim(),
      turnitinInstitutionId: String(parsed.turnitinInstitutionId || '').trim(),
      customPlagEndpoint: String(parsed.customPlagEndpoint || '').trim(),
      customPlagApiKey: String(parsed.customPlagApiKey || '').trim(),
    };
  } catch {
    return {
      turnitinEndpoint: '',
      turnitinApiKey: '',
      turnitinInstitutionId: '',
      customPlagEndpoint: '',
      customPlagApiKey: '',
    };
  }
}

export function savePlagiarismApiConfig(cfg = {}) {
  try {
    localStorage.setItem(
      PLAGIARISM_STORAGE_KEYS.API_CONFIG,
      JSON.stringify({
        turnitinEndpoint: String(cfg.turnitinEndpoint || '').trim(),
        turnitinApiKey: String(cfg.turnitinApiKey || '').trim(),
        turnitinInstitutionId: String(cfg.turnitinInstitutionId || '').trim(),
        customPlagEndpoint: String(cfg.customPlagEndpoint || '').trim(),
        customPlagApiKey: String(cfg.customPlagApiKey || '').trim(),
      })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPlagiarismHistory() {
  try {
    const raw = localStorage.getItem(PLAGIARISM_STORAGE_KEYS.HISTORY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.slice(0, 15) : [];
  } catch {
    return [];
  }
}

export function savePlagiarismHistoryEntry(report) {
  if (!report || !report.submissionId) return loadPlagiarismHistory();
  const compact = {
    submissionId: report.submissionId,
    checkedAt: report.checkedAt,
    fileName: report.fileName,
    fileFormat: report.fileFormat,
    totalWords: report.totalWords,
    similarityPct: report.similarityPct,
    internetPct: report.internetPct,
    publicationsPct: report.publicationsPct,
    aiWritingPct: report.aiAnalysis?.aiWritingPct || 0,
    sourcesCount: report.primarySources?.length || 0,
    riskLevel: report.riskLevel,
    repositoryMode: 'no-repository',
  };
  const next = [compact, ...loadPlagiarismHistory().filter((h) => h.submissionId !== compact.submissionId)].slice(0, 15);
  try {
    localStorage.setItem(PLAGIARISM_STORAGE_KEYS.HISTORY, JSON.stringify(next));
  } catch {
    // Ignore quota
  }
  return next;
}

export function clearPlagiarismHistory() {
  try {
    localStorage.removeItem(PLAGIARISM_STORAGE_KEYS.HISTORY);
  } catch {
    // Ignore
  }
}

function getFileExtension(name = '') {
  const clean = String(name || '').toLowerCase().trim();
  const idx = clean.lastIndexOf('.');
  return idx !== -1 ? clean.slice(idx + 1) : '';
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS, parentSignal = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      clearTimeout(timer);
      throw new Error('ABORTED');
    }
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  try {
    const resp = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
    if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
  }
}

async function ensureTesseractLoaded(onProgress = () => {}) {
  if (typeof window === 'undefined') return null;
  if (window.Tesseract) return window.Tesseract;
  onProgress({ percent: 45, label: 'Memuat mesin OCR lokal browser (Tesseract.js)...' });
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return window.Tesseract || null;
  } catch {
    return null;
  }
}

function normalizeOcrWordsToSpans(words = [], width = 1000, height = 1414) {
  const safeW = Math.max(1, Number(width) || 1000);
  const safeH = Math.max(1, Number(height) || 1414);
  const spans = [];
  for (const w of Array.isArray(words) ? words : []) {
    const text = String(w?.text || '').trim();
    const bbox = w?.bbox;
    if (!text || !bbox) continue;
    const x0 = Math.max(0, Number(bbox.x0) || 0);
    const y0 = Math.max(0, Number(bbox.y0) || 0);
    const x1 = Math.max(x0 + 2, Number(bbox.x1) || x0 + 10);
    const y1 = Math.max(y0 + 2, Number(bbox.y1) || y0 + 10);
    spans.push({
      text,
      x: Math.min(0.99, x0 / safeW),
      y: Math.min(0.99, y0 / safeH),
      w: Math.max(0.005, Math.min(1, (x1 - x0) / safeW)),
      h: Math.max(0.008, Math.min(0.12, (y1 - y0) / safeH)),
    });
  }
  return spans;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca data gambar.'));
    reader.readAsDataURL(file);
  });
}

function measureImageDataUrl(dataUrl) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve({ width: 1000, height: 1414 });
      return;
    }
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1000, height: img.naturalHeight || 1414 });
    img.onerror = () => resolve({ width: 1000, height: 1414 });
    img.src = dataUrl;
  });
}

function uint8ToBase64(u8) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function paginateBlocksToA4Pages(blocks = [], wordsPerPage = 380) {
  const pages = [];
  let curBlocks = [];
  let curWords = 0;
  for (const b of blocks) {
    const bw = Math.max(1, Number(b.wordCount) || countWords(b.plain || ''));
    if (curBlocks.length > 0 && curWords + bw > wordsPerPage) {
      pages.push({
        pageNumber: pages.length + 1,
        widthPt: 595,
        heightPt: 842,
        blocks: curBlocks,
      });
      curBlocks = [];
      curWords = 0;
    }
    curBlocks.push(b);
    curWords += bw;
  }
  if (curBlocks.length > 0) {
    pages.push({
      pageNumber: pages.length + 1,
      widthPt: 595,
      heightPt: 842,
      blocks: curBlocks,
    });
  }
  return pages;
}

/**
 * Builds clean A4 document sheets for Paste / TXT / RTF / HTML so documents always
 * render page-by-page like real printed pages (never a raw flat text dump).
 */
export function buildDocumentSheetsOriginalSource(text = '') {
  const paras = normalizePlainText(text)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const blocks = paras.map((p) => {
    const isHeading = p.length <= 92 && !/[.?!]$/.test(p) && p.split(/\s+/).length <= 12;
    return {
      type: isHeading ? 'heading' : 'paragraph',
      level: isHeading ? 2 : 0,
      align: 'justify',
      plain: p,
      wordCount: countWords(p),
    };
  });
  const pages = paginateBlocksToA4Pages(blocks, 360);
  return {
    kind: 'document-sheets',
    pageCount: Math.max(1, pages.length),
    pages,
  };
}

/**
 * Parses a DOCX archive directly (word/document.xml + styles + numbering + headers/footers + rels + media)
 * into structured A4 pages preserving original headings, bold/italic/underline, alignment, <w:sdt> citations,
 * automatic numbering, full multi-paragraph tables, and embedded images (works in both browser and Node!).
 */
async function buildRichDocxOriginalSource(rawBuffer, fallbackText = '', preParsedModel = null) {
  try {
    const model = preParsedModel || (await parseDocxRichModel(rawBuffer, extractZipEntries));
    if (!model || !Array.isArray(model.blocks) || model.blocks.length === 0) {
      return buildDocumentSheetsOriginalSource(fallbackText);
    }

    const blocks = [];
    for (const blk of model.blocks) {
      if (blk.type === 'table' && Array.isArray(blk.rows) && blk.rows.length > 0) {
        const plainRows = Array.isArray(blk.plainRows)
          ? blk.plainRows
          : blk.rows.map((r) => (Array.isArray(r) ? r.map((c) => (typeof c === 'string' ? c : c?.text || '')) : []));
        const tblPlain = plainRows.map((r) => r.join(' · ')).join('\n');
        blocks.push({
          type: 'table',
          rows: plainRows,
          plain: tblPlain,
          wordCount: Math.max(25, countWords(tblPlain)),
        });
      } else {
        const hasImage = Array.isArray(blk.runs) && blk.runs.some((r) => r.type === 'image');
        const plain = normalizePlainText(blk.plain || '');
        if (!plain && !hasImage) continue;
        blocks.push({
          type: blk.type === 'heading' ? 'heading' : blk.type === 'list-item' ? 'list-item' : 'paragraph',
          level: blk.level || 0,
          align: blk.align || 'left',
          runs: Array.isArray(blk.runs) ? blk.runs : [{ type: 'text', text: plain }],
          plain,
          wordCount: Math.max(hasImage ? 25 : 1, countWords(plain)),
        });
      }
    }

    if (blocks.length === 0) return buildDocumentSheetsOriginalSource(fallbackText);
    const pages = paginateBlocksToA4Pages(blocks, 360);
    return {
      kind: 'docx-rich',
      pageCount: Math.max(1, pages.length),
      pages,
    };
  } catch {
    return buildDocumentSheetsOriginalSource(fallbackText);
  }
}

async function runImageOcrFallback(file, onProgress = () => {}, signal = null) {
  if (signal?.aborted) throw new Error('ABORTED');
  const imageDataUrl = await readFileAsDataUrl(file);
  const dims = await measureImageDataUrl(imageDataUrl);
  const tesseract = await ensureTesseractLoaded(onProgress);
  if (!tesseract || typeof tesseract.recognize !== 'function') {
    return { text: '', spans: [], imageDataUrl, width: dims.width, height: dims.height };
  }
  try {
    onProgress({ percent: 65, label: 'Membaca teks & koordinat kata dari gambar (OCR ID + EN, 100% lokal)...' });
    const res = await tesseract.recognize(file, 'ind+eng');
    if (signal?.aborted) throw new Error('ABORTED');
    const text = normalizePlainText(res?.data?.text || '');
    const spans = normalizeOcrWordsToSpans(res?.data?.words || [], dims.width, dims.height);
    return { text, spans, imageDataUrl, width: dims.width, height: dims.height };
  } catch (err) {
    if (err?.message === 'ABORTED') throw err;
    return { text: '', spans: [], imageDataUrl, width: dims.width, height: dims.height };
  }
}

async function runScannedPdfOcr(rawBuffer, onProgress = () => {}, signal = null) {
  if (typeof window === 'undefined') return { text: '', pagesOcrd: 0, numPages: 0, pages: [] };
  if (signal?.aborted) throw new Error('ABORTED');
  onProgress({ percent: 34, label: 'PDF hasil scan terdeteksi — menyiapkan halaman asli untuk OCR lokal...' });
  const rendered = await renderPdfPagesToBlobs(rawBuffer, {
    maxPages: 12,
    scale: 1.65,
    onPage: ({ page, total }) => {
      onProgress({
        percent: 34 + Math.round((page / Math.max(1, total)) * 18),
        label: `Merender halaman asli PDF ${page}/${total} untuk OCR...`,
      });
    },
  });
  if (signal?.aborted) throw new Error('ABORTED');
  if (!rendered.blobs || rendered.blobs.length === 0) {
    return { text: '', pagesOcrd: 0, numPages: rendered.numPages || 0, pages: [] };
  }

  const tesseract = await ensureTesseractLoaded(onProgress);
  if (!tesseract) {
    return { text: '', pagesOcrd: 0, numPages: rendered.numPages || 0, pages: [] };
  }

  const ocrParts = [];
  const pages = [];
  let worker = null;
  try {
    if (typeof tesseract.createWorker === 'function') {
      onProgress({ percent: 54, label: 'Menginisialisasi model bahasa OCR Indonesia + Inggris...' });
      worker = await tesseract.createWorker('ind+eng');
    }
    for (let i = 0; i < rendered.blobs.length; i += 1) {
      if (signal?.aborted) throw new Error('ABORTED');
      const { page, blob, jpegDataUrl, width, height, widthPt, heightPt } = rendered.blobs[i];
      onProgress({
        percent: 56 + Math.round(((i + 1) / rendered.blobs.length) * 38),
        label: `Membaca teks & posisi kata halaman scan ${page}/${rendered.blobs.length} (OCR)...`,
      });
      const res = worker ? await worker.recognize(blob) : await tesseract.recognize(blob, 'ind+eng');
      const pageTxt = normalizePlainText(res?.data?.text || '');
      const spans = normalizeOcrWordsToSpans(res?.data?.words || [], width, height);
      if (pageTxt) ocrParts.push(pageTxt);
      pages.push({
        pageNumber: page,
        widthPt: widthPt || 595,
        heightPt: heightPt || 842,
        imageDataUrl: jpegDataUrl,
        spans,
        text: pageTxt,
      });
    }
  } catch (err) {
    if (err?.message === 'ABORTED') throw err;
    // Keep any pages already recognized
  } finally {
    if (worker && typeof worker.terminate === 'function') {
      try {
        await worker.terminate();
      } catch {
        // Ignore
      }
    }
  }

  return {
    text: normalizePlainText(ocrParts.join('\n\n')),
    pagesOcrd: rendered.blobs.length,
    numPages: rendered.numPages || rendered.blobs.length,
    pages,
  };
}

/**
 * Pure-browser FlateDecode PDF text extractor fallback (only used if PDF.js CDN is unreachable).
 * Never accepts raw compressed binary bytes without passing `assessExtractedTextQuality`.
 */
async function tryDecompressedPdfFallback(rawBuffer) {
  const safeRawLines = extractTextFromPdfBuffer(rawBuffer).filter(
    (l) => !/^Dokumen PDF Terverifikasi|^Ukuran Berkas PDF:/i.test(String(l || '').trim())
  );
  const rawJoined = normalizePlainText(safeRawLines.join('\n\n'));
  if (rawJoined && assessExtractedTextQuality(rawJoined).isReadable && countWords(rawJoined) >= 10) {
    return rawJoined;
  }

  // Try inflating FlateDecode streams using native browser DecompressionStream('deflate')
  if (typeof DecompressionStream === 'undefined') return '';
  const bytes = new Uint8Array(rawBuffer);
  const latin1 = new TextDecoder('latin1').decode(bytes);
  const parts = [];
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  let scannedStreams = 0;

  while ((match = streamRegex.exec(latin1)) !== null && scannedStreams < 40) {
    scannedStreams += 1;
    const startIdx = match.index + match[0].indexOf(match[1]);
    const endIdx = startIdx + match[1].length;
    if (endIdx - startIdx < 8 || endIdx - startIdx > 2_000_000) continue;
    const slice = bytes.subarray(startIdx, endIdx);
    // Zlib header check (0x78 ...)
    if (slice[0] !== 0x78) continue;
    try {
      const ds = new DecompressionStream('deflate');
      const ab = await new Response(new Blob([slice]).stream().pipeThrough(ds)).arrayBuffer();
      const dec = new TextDecoder('latin1').decode(new Uint8Array(ab));
      const tj = [...dec.matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)\s*Tj/g)].map((m) =>
        m[1].replace(/\\([()\\])/g, '$1')
      );
      const tja = [...dec.matchAll(/\[([^\]]+)\]\s*TJ/g)].map((m) =>
        [...m[1].matchAll(/\(([^()\\]*(?:\\.[^()\\]*)*)\)/g)]
          .map((x) => x[1].replace(/\\([()\\])/g, '$1'))
          .join('')
      );
      const chunk = normalizePlainText([...tj, ...tja].join(' '));
      if (chunk && assessExtractedTextQuality(chunk).isReadable) {
        parts.push(chunk);
      }
    } catch {
      // Not a deflate text stream (likely image stream) — skip cleanly
    }
  }
  const merged = normalizePlainText(parts.join('\n\n'));
  return assessExtractedTextQuality(merged).isReadable ? merged : '';
}

/**
 * Universal All-File Text + Original-Document Extractor.
 * Preserves original PDF bytes/pages, original Images + OCR coordinates, rich DOCX OOXML layout,
 * and paginated A4 sheets so neither the web viewer nor downloaded PDF ever rebuilds plain text.
 */
export async function extractTextFromAnyFile(file, onProgress = () => {}, signal = null) {
  if (!file) throw new Error('Berkas tidak ditemukan.');
  if (signal?.aborted) throw new Error('ABORTED');
  const ext = getFileExtension(file.name);
  const mime = String(file.type || '').toLowerCase();
  onProgress({ percent: 10, label: `Membaca berkas asli "${file.name}" secara lokal (No Repository)...` });

  // 1. Images -> OCR + preserve original image page
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) {
    const ocrRes = await runImageOcrFallback(file, onProgress, signal);
    if (ocrRes.text && assessExtractedTextQuality(ocrRes.text).isReadable && countWords(ocrRes.text) >= 3) {
      const aspect = ocrRes.height / Math.max(1, ocrRes.width);
      const widthPt = 595;
      const heightPt = Math.round(595 * aspect);
      return {
        text: ocrRes.text,
        fileName: file.name,
        fileFormat: `${(ext || 'IMG').toUpperCase()} (OCR)`,
        fileSize: file.size || 0,
        pageCount: 1,
        note: 'Gambar asli dipertahankan · teks dibaca lokal dengan OCR (No Repository).',
        originalSource: {
          kind: 'image',
          pageCount: 1,
          pages: [
            {
              pageNumber: 1,
              widthPt,
              heightPt,
              imageDataUrl: ocrRes.imageDataUrl,
              spans: ocrRes.spans,
              text: ocrRes.text,
            },
          ],
        },
      };
    }
    throw new Error('Tidak ditemukan teks terbaca pada gambar ini (pastikan gambar tajam/tidak buram).');
  }

  const rawBuffer = await file.arrayBuffer();
  if (signal?.aborted) throw new Error('ABORTED');
  const bytes = new Uint8Array(rawBuffer);
  const isPdfMagic = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const isZipMagic = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

  // 2. PDF (Stage 1: PDF.js text layer + original page previews -> Stage 2: Scanned-PDF OCR -> Stage 3: FlateDecode)
  if (ext === 'pdf' || mime.includes('pdf') || isPdfMagic) {
    onProgress({ percent: 20, label: 'Mengekstrak teks & koordinat kata dari dokumen PDF asli...' });
    let pdfDetail = null;
    if (typeof window !== 'undefined') {
      try {
        pdfDetail = await extractPdfDetailedWithPdfJs(rawBuffer, {
          maxPages: 40,
          onProgress: ({ page, total }) => {
            onProgress({
              percent: 20 + Math.round((page / Math.max(1, total)) * 22),
              label: `Membaca teks & posisi halaman PDF ${page}/${total}...`,
            });
          },
        });
      } catch {
        pdfDetail = null;
      }
    }
    if (signal?.aborted) throw new Error('ABORTED');

    const pdfText = normalizePlainText(pdfDetail?.text || '');
    const pdfQuality = assessExtractedTextQuality(pdfText);
    if (pdfText && pdfQuality.isReadable && countWords(pdfText) >= 12) {
      let previewPages = [];
      if (typeof window !== 'undefined') {
        try {
          const renderedPreviews = await renderPdfPagesToPreviewImages(rawBuffer, {
            maxPages: 30,
            scale: 1.45,
            onPage: ({ page, total }) => {
              onProgress({
                percent: 44 + Math.round((page / Math.max(1, total)) * 46),
                label: `Menyiapkan tampilan halaman asli PDF ${page}/${total}...`,
              });
            },
          });
          previewPages = renderedPreviews.pages || [];
        } catch {
          previewPages = [];
        }
      }
      if (signal?.aborted) throw new Error('ABORTED');

      const layoutByPage = new Map((pdfDetail?.pagesLayout || []).map((p) => [p.pageNumber, p]));
      const mergedPages = (previewPages.length > 0 ? previewPages : pdfDetail?.pagesLayout || []).map((pg) => {
        const lay = layoutByPage.get(pg.pageNumber) || {};
        return {
          pageNumber: pg.pageNumber,
          widthPt: pg.widthPt || lay.widthPt || 595,
          heightPt: pg.heightPt || lay.heightPt || 842,
          imageDataUrl: pg.imageDataUrl || '',
          spans: lay.spans || [],
          text: lay.text || '',
        };
      });

      return {
        text: pdfText,
        fileName: file.name,
        fileFormat: 'PDF',
        fileSize: file.size || bytes.length,
        pageCount: pdfDetail?.numPages || mergedPages.length || 1,
        note: `Halaman asli PDF (${pdfDetail?.numPages || 1} hal) dipertahankan 100% lokal.`,
        originalSource: {
          kind: 'pdf',
          pdfBytes: new Uint8Array(bytes),
          pageCount: pdfDetail?.numPages || mergedPages.length || 1,
          pages: mergedPages,
        },
      };
    }

    // Stage 2: Scanned/image-only PDF -> Automatic multi-page Canvas + Tesseract OCR with word bboxes
    if (typeof window !== 'undefined') {
      const ocrRes = await runScannedPdfOcr(rawBuffer, onProgress, signal);
      const ocrQuality = assessExtractedTextQuality(ocrRes.text);
      if (ocrRes.text && ocrQuality.isReadable && countWords(ocrRes.text) >= 8) {
        const extraNote =
          ocrRes.numPages > ocrRes.pagesOcrd
            ? ` (${ocrRes.pagesOcrd} dari ${ocrRes.numPages} hal dipindai OCR; seluruh halaman asli dipertahankan di PDF)`
            : ` (${ocrRes.pagesOcrd} halaman asli dipertahankan)`;
        return {
          text: ocrRes.text,
          fileName: file.name,
          fileFormat: 'PDF (OCR Scan)',
          fileSize: file.size || bytes.length,
          pageCount: ocrRes.numPages || ocrRes.pagesOcrd,
          note: `PDF scan dibaca lokal dengan OCR${extraNote}.`,
          originalSource: {
            kind: 'pdf-scan',
            pdfBytes: new Uint8Array(bytes),
            pageCount: ocrRes.numPages || ocrRes.pagesOcrd || 1,
            pages: ocrRes.pages,
          },
        };
      }
    }

    // Stage 3: Offline pure-JS FlateDecode text-stream fallback (still preserves raw pdfBytes!)
    const fallbackText = await tryDecompressedPdfFallback(rawBuffer);
    if (fallbackText && countWords(fallbackText) >= 10) {
      return {
        text: fallbackText,
        fileName: file.name,
        fileFormat: 'PDF',
        fileSize: file.size || bytes.length,
        pageCount: 1,
        note: 'PDF asli dipertahankan (ekstraksi teks lokal).',
        originalSource: {
          kind: 'pdf',
          pdfBytes: new Uint8Array(bytes),
          pageCount: 1,
          pages: [],
        },
      };
    }

    throw new Error(
      'Gagal mengekstrak teks terbaca dari PDF ini (kemungkinan PDF terenkripsi password atau hasil scan buram). Coba simpan ulang PDF tanpa kunci atau unggah versi DOCX/TXT.'
    );
  }

  // 3. DOCX -> Render authentic original Word pages (logo, header/footer, tables, fonts, citations) in browser,
  // preserving exact layout & normalized word coordinates for Turnitin highlights + original-page PDF report!
  if (ext === 'docx' || mime.includes('wordprocessingml')) {
    onProgress({ percent: 24, label: 'Membaca struktur lengkap & sitasi dokumen Word (.docx)...' });
    const parsed = await parseDocxBuffer(rawBuffer);
    const orderedText =
      parsed?.plainText ||
      (Array.isArray(parsed?.blocks) && parsed.blocks.length > 0
        ? parsed.blocks.map((b) => b.plain || '').filter(Boolean).join('\n\n')
        : [
            ...(parsed?.paragraphs || []).map((p) => (typeof p === 'string' ? p : p.text || '')),
            ...(parsed?.tables || []).flatMap((tbl) =>
              Array.isArray(tbl) ? tbl.map((row) => (Array.isArray(row) ? row.filter(Boolean).join(' · ') : '')) : []
            ),
          ]
            .filter(Boolean)
            .join('\n\n'));
    const text = normalizePlainText(orderedText);
    if (signal?.aborted) throw new Error('ABORTED');

    if (text && assessExtractedTextQuality(text).isReadable && countWords(text) >= 2) {
      let originalSource = null;

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          onProgress({
            percent: 36,
            label: 'Merender halaman asli Word (.docx) agar logo, tabel & tata letak dipertahankan 100%...',
          });
          const rendered = await renderDocxToFaithfulPages(rawBuffer, {
            scale: 1.85,
            maxPages: 30,
            onProgress: (p) => {
              if (signal?.aborted) return;
              if (p && typeof p.percent === 'number') {
                onProgress({
                  percent: 36 + Math.round((Math.min(100, p.percent) / 100) * 44),
                  label: p.label || 'Menyiapkan tampilan halaman asli Word (.docx)...',
                });
              }
            },
          });
          if (signal?.aborted) throw new Error('ABORTED');

          if (rendered && Array.isArray(rendered.pages) && rendered.pages.length > 0) {
            let pdfBytes = null;
            try {
              const pdfLib = await loadPdfLib();
              pdfBytes = await buildFaithfulPdfFromRenderedPages(rendered.pages, pdfLib);
            } catch {
              pdfBytes = null;
            }
            originalSource = {
              kind: 'docx-rendered',
              pdfBytes: pdfBytes && pdfBytes.byteLength > 200 ? pdfBytes : undefined,
              pageCount: rendered.pageCount || rendered.pages.length,
              pages: rendered.pages,
            };
          }
        } catch (err) {
          if (err?.message === 'ABORTED') throw err;
          originalSource = null;
        }
      }

      if (!originalSource) {
        originalSource = await buildRichDocxOriginalSource(rawBuffer, text, parsed?.model || null);
      }

      return {
        text,
        fileName: file.name,
        fileFormat: 'DOCX',
        fileSize: file.size || bytes.length,
        pageCount: originalSource.pageCount || 1,
        note:
          originalSource.kind === 'docx-rendered'
            ? `Halaman asli Word (.docx · ${originalSource.pageCount} hal) dipertahankan 100% lokal (No Repository).`
            : 'Tata letak, sitasi, tabel & gambar asli Word (.docx) dipertahankan.',
        originalSource,
      };
    }
  }

  // 4. XLSX / XLS / ODS
  if (['xlsx', 'xls', 'ods'].includes(ext) || mime.includes('spreadsheetml') || mime.includes('excel')) {
    onProgress({ percent: 48, label: 'Mengekstrak isi tabel spreadsheet...' });
    try {
      const parsed = await parseExcelBuffer(rawBuffer, file.name);
      const rows = (parsed?.rows || []).map((r) => (Array.isArray(r) ? r.filter(Boolean).join(' · ') : String(r || ''))).filter(Boolean);
      const text = normalizePlainText(rows.join('\n'));
      if (text && assessExtractedTextQuality(text).isReadable) {
        const originalSource = buildDocumentSheetsOriginalSource(text);
        return {
          text,
          fileName: file.name,
          fileFormat: ext.toUpperCase() || 'XLSX',
          fileSize: file.size || bytes.length,
          pageCount: originalSource.pageCount,
          note: 'Diekstrak dari lembar kerja spreadsheet.',
          originalSource,
        };
      }
    } catch {
      // Fall through to ZIP/text extractor
    }
  }

  // 5. ZIP-based office & e-book formats: PPTX, ODT, ODP, ODS, EPUB, or generic DOCX fallback
  if (isZipMagic || ['pptx', 'odt', 'odp', 'epub', 'docx'].includes(ext)) {
    onProgress({ percent: 55, label: `Membaca konten arsip dokumen .${(ext || 'zip').toUpperCase()}...` });
    try {
      const entriesRaw = await extractZipEntries(rawBuffer);
      const entryList =
        entriesRaw instanceof Map
          ? Array.from(entriesRaw.entries()).map(([name, data]) => ({ name, data }))
          : Array.isArray(entriesRaw)
          ? entriesRaw
          : [];
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const textParts = [];

      const relevant = entryList
        .filter((e) => {
          const n = String(e.name || '').toLowerCase();
          if (n.startsWith('ppt/slides/slide') && n.endsWith('.xml')) return true;
          if (n === 'word/document.xml' || n === 'content.xml' || n === 'xl/sharedstrings.xml') return true;
          if (n.endsWith('.xhtml') || n.endsWith('.html') || n.endsWith('.htm') || n.endsWith('.txt') || n.endsWith('.md')) return true;
          return false;
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      for (const entry of relevant) {
        const rawStr = decoder.decode(entry.data);
        const extracted =
          entry.name.endsWith('.txt') || entry.name.endsWith('.md')
            ? normalizePlainText(rawStr)
            : stripHtmlOrXmlToPlainText(rawStr);
        if (extracted) textParts.push(extracted);
      }

      const text = normalizePlainText(textParts.join('\n\n'));
      if (text && assessExtractedTextQuality(text).isReadable && countWords(text) >= 2) {
        const originalSource = ext === 'docx' ? await buildRichDocxOriginalSource(rawBuffer, text) : buildDocumentSheetsOriginalSource(text);
        return {
          text,
          fileName: file.name,
          fileFormat: (ext || 'ARCHIVE').toUpperCase(),
          fileSize: file.size || bytes.length,
          pageCount: originalSource.pageCount,
          note: `Berhasil membaca ${relevant.length} bagian dari berkas .${(ext || 'zip').toUpperCase()}.`,
          originalSource,
        };
      }
    } catch {
      // Fall through to strict error
    }
    throw new Error(`Berkas arsip .${(ext || 'zip').toUpperCase()} tidak berisi teks terbaca atau terproteksi kata sandi.`);
  }

  // 6. RTF
  if (ext === 'rtf' || mime.includes('rtf')) {
    onProgress({ percent: 60, label: 'Membersihkan kode format RTF...' });
    const rawText = new TextDecoder('latin1').decode(bytes);
    const text = stripRtfToPlainText(rawText);
    if (!text || !assessExtractedTextQuality(text).isReadable) {
      throw new Error('Dokumen RTF ini tidak mengandung teks terbaca.');
    }
    const originalSource = buildDocumentSheetsOriginalSource(text);
    return {
      text,
      fileName: file.name,
      fileFormat: 'RTF',
      fileSize: file.size || bytes.length,
      pageCount: originalSource.pageCount,
      note: 'Diekstrak dari dokumen Rich Text (.rtf).',
      originalSource,
    };
  }

  // 7. HTML / XML / SVG
  if (['html', 'htm', 'xhtml', 'xml', 'svg'].includes(ext) || mime.includes('html') || mime.includes('xml')) {
    onProgress({ percent: 60, label: 'Mengekstrak teks bersih dari HTML/XML...' });
    const rawStr = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const text = stripHtmlOrXmlToPlainText(rawStr);
    if (!text || !assessExtractedTextQuality(text).isReadable) {
      throw new Error('Berkas HTML/XML ini tidak mengandung paragraf teks terbaca.');
    }
    const originalSource = buildDocumentSheetsOriginalSource(text);
    return {
      text,
      fileName: file.name,
      fileFormat: (ext || 'HTML').toUpperCase(),
      fileSize: file.size || bytes.length,
      pageCount: originalSource.pageCount,
      note: 'Diekstrak dari dokumen web/markup.',
      originalSource,
    };
  }

  // 8. Plain text, Markdown, CSV, LaTeX, JSON, Code, or Legacy .doc / Any Other File
  onProgress({ percent: 65, label: 'Mengekstrak teks dari berkas...' });
  const text = extractReadableTextFromBinaryBytes(bytes);
  if (!text || !assessExtractedTextQuality(text).isReadable || countWords(text) < 2) {
    throw new Error(
      `Berkas "${file.name}" tidak memiliki lapisan teks terbaca atau berformat biner terkompresi. Gunakan PDF, DOCX, TXT, HTML, atau gambar jelas (OCR).`
    );
  }
  const originalSource = buildDocumentSheetsOriginalSource(text);
  return {
    text,
    fileName: file.name,
    fileFormat: (ext || 'FILE').toUpperCase(),
    fileSize: file.size || bytes.length,
    pageCount: originalSource.pageCount,
    note: ext === 'doc' ? 'Diekstrak dari dokumen Word klasik (.doc).' : `Diekstrak dari berkas .${(ext || 'txt').toUpperCase()}.`,
    originalSource,
  };
}

/**
 * Engine 1: OpenAlex Academic Publications API (250M+ works, CORS *, keyless).
 */
async function probeOpenAlex(queries = [], signal = null) {
  const started = Date.now();
  const candidates = [];
  const targets = queries.slice(0, 2);
  for (const q of targets) {
    if (signal?.aborted) break;
    const searchStr = q.shortKeywords || q.keywords || q.phrase;
    if (!searchStr || searchStr.length < 5) continue;
    try {
      const url = `https://api.openalex.org/works?search=${encodeURIComponent(searchStr)}&per-page=4&mailto=contact@manifestudio.my.id&select=id,title,doi,publication_year,primary_location,authorships,abstract_inverted_index`;
      const data = await fetchJsonWithTimeout(url, {}, API_TIMEOUT_MS, signal);
      for (const w of data?.results || []) {
        const abstract = reconstructOpenAlexAbstract(w.abstract_inverted_index);
        const authors = (w.authorships || []).slice(0, 3).map((a) => a?.author?.display_name).filter(Boolean).join(', ');
        const landing = w?.primary_location?.landing_page_url || (w.doi ? w.doi : w.id || '');
        candidates.push({
          title: String(w.title || 'Karya Ilmiah OpenAlex').trim(),
          url: landing,
          doi: String(w.doi || '').replace(/^https?:\/\/doi\.org\//i, ''),
          category: 'publication',
          engine: 'OpenAlex',
          authors,
          year: w.publication_year ? String(w.publication_year) : '',
          content: `${w.title || ''}. ${abstract}`,
        });
      }
    } catch {
      // Polite fallback if OpenAlex search cluster is rate-limited
      break;
    }
  }
  return {
    id: 'openalex',
    name: 'OpenAlex Academic (250M+)',
    status: candidates.length > 0 ? 'done' : 'fallback',
    found: candidates.length,
    latencyMs: Date.now() - started,
    candidates,
  };
}

/**
 * Engine 2: Crossref Scholarly DOI Publications API (150M+ works, CORS *, keyless).
 */
async function probeCrossref(queries = [], signal = null) {
  const started = Date.now();
  const candidates = [];
  const targets = queries.slice(0, 3);
  await Promise.allSettled(
    targets.map(async (q) => {
      const searchStr = q.shortKeywords || q.keywords || q.phrase;
      if (!searchStr || searchStr.length < 5) return;
      const url = `https://api.crossref.org/works?query=${encodeURIComponent(searchStr)}&filter=has-abstract:true&rows=4&select=DOI,title,URL,author,published,abstract`;
      const data = await fetchJsonWithTimeout(url, {}, API_TIMEOUT_MS, signal);
      for (const item of data?.message?.items || []) {
        const title = Array.isArray(item.title) ? item.title[0] : String(item.title || '');
        if (!title) continue;
        const abstract = item.abstract ? stripHtmlOrXmlToPlainText(item.abstract) : '';
        const authors = (item.author || [])
          .slice(0, 3)
          .map((a) => [a.given, a.family].filter(Boolean).join(' '))
          .filter(Boolean)
          .join(', ');
        const year = item?.published?.['date-parts']?.[0]?.[0] ? String(item.published['date-parts'][0][0]) : '';
        candidates.push({
          title: title.trim(),
          url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ''),
          doi: item.DOI || '',
          category: 'publication',
          engine: 'Crossref DOI',
          authors,
          year,
          content: `${title}. ${abstract}`,
        });
      }
    })
  );
  return {
    id: 'crossref',
    name: 'Crossref Publications (150M+)',
    status: candidates.length > 0 ? 'done' : 'idle',
    found: candidates.length,
    latencyMs: Date.now() - started,
    candidates,
  };
}

/**
 * Engine 3: DOAJ Open Access Journals API (CORS *, keyless — rich Indonesian & global journals).
 */
async function probeDoaj(queries = [], signal = null) {
  const started = Date.now();
  const candidates = [];
  const targets = queries.slice(0, 2);
  await Promise.allSettled(
    targets.map(async (q) => {
      const searchStr = q.keywords || q.phrase;
      if (!searchStr || searchStr.length < 6) return;
      const url = `https://doaj.org/api/search/articles/${encodeURIComponent(searchStr)}?pageSize=4`;
      const data = await fetchJsonWithTimeout(url, {}, API_TIMEOUT_MS, signal);
      for (const item of data?.results || []) {
        const bib = item?.bibjson || {};
        const title = String(bib.title || '').trim();
        if (!title) continue;
        const abstract = String(bib.abstract || '').trim();
        const link = (bib.link || []).find((l) => l.url)?.url || '';
        const doi = (bib.identifier || []).find((id) => id.type === 'doi')?.id || '';
        const authors = (bib.author || []).slice(0, 3).map((a) => a.name).filter(Boolean).join(', ');
        candidates.push({
          title,
          url: link || (doi ? `https://doi.org/${doi}` : ''),
          doi,
          category: 'publication',
          engine: 'DOAJ Journals',
          authors,
          year: bib.year ? String(bib.year) : '',
          content: `${title}. ${abstract}`,
        });
      }
    })
  );
  return {
    id: 'doaj',
    name: 'DOAJ Open-Access Journals',
    status: candidates.length > 0 ? 'done' : 'idle',
    found: candidates.length,
    latencyMs: Date.now() - started,
    candidates,
  };
}

/**
 * Engine 4: Wikipedia ID + EN Full-Article Extract API (CORS origin=*, keyless).
 * Searches matching articles AND fetches full plain-text extracts (`prop=extracts&explaintext=1`)
 * so verbatim Indonesian & English copy-paste is caught with near-100% precision.
 */
async function probeWikipediaFullText(queries = [], docLang = 'id', signal = null) {
  const started = Date.now();
  const candidates = [];
  const langs = docLang === 'en' ? ['en', 'id'] : ['id', 'en'];

  const tasks = [];
  const seenTaskKey = new Set();
  for (const q of queries.slice(0, 6)) {
    const searchQ = q.shortKeywords || q.keywords || q.phrase;
    if (!searchQ || searchQ.length < 4) continue;
    const targetLangs = q.lang === 'en' ? ['en'] : q.lang === 'id' ? ['id'] : langs;
    for (const lang of targetLangs) {
      const tk = `${lang}:${searchQ.toLowerCase()}`;
      if (seenTaskKey.has(tk)) continue;
      seenTaskKey.add(tk);
      tasks.push({ lang, search: searchQ });
    }
  }

  const pageIdsByLang = { id: new Set(), en: new Set() };
  const snippetsByLang = { id: new Map(), en: new Map() };

  await Promise.allSettled(
    tasks.slice(0, 8).map(async ({ lang, search }) => {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(search)}&srlimit=3&format=json&origin=*`;
      const data = await fetchJsonWithTimeout(url, {}, API_TIMEOUT_MS, signal);
      for (const hit of data?.query?.search || []) {
        if (hit.pageid) {
          pageIdsByLang[lang].add(hit.pageid);
          snippetsByLang[lang].set(hit.pageid, {
            title: hit.title,
            snippet: stripHtmlOrXmlToPlainText(hit.snippet || ''),
          });
        }
      }
    })
  );

  // Batch fetch full lead plain-text extracts for all matched pageids (`exintro=1&exlimit=max` is required by MediaWiki)
  await Promise.allSettled(
    ['id', 'en'].map(async (lang) => {
      const ids = [...pageIdsByLang[lang]].slice(0, 8);
      if (ids.length === 0) return;
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url&explaintext=1&exintro=1&exlimit=max&pageids=${ids.join('|')}&format=json&origin=*`;
      const data = await fetchJsonWithTimeout(url, {}, API_TIMEOUT_MS, signal);
      const pages = data?.query?.pages || {};
      for (const page of Object.values(pages)) {
        if (!page || !page.title) continue;
        const fallback = snippetsByLang[lang].get(page.pageid);
        const content = String(page.extract || fallback?.snippet || '').trim();
        if (!content) continue;
        candidates.push({
          title: `${page.title} — Wikipedia (${lang.toUpperCase()})`,
          url: page.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
          doi: '',
          category: 'internet',
          engine: `Wikipedia ${lang.toUpperCase()}`,
          authors: 'Wikimedia Encyclopedia',
          year: String(new Date().getFullYear()),
          content,
        });
      }
    })
  );

  return {
    id: 'wikipedia',
    name: 'Wikipedia ID & EN Full-Index',
    status: candidates.length > 0 ? 'done' : 'idle',
    found: candidates.length,
    latencyMs: Date.now() - started,
    candidates,
  };
}

/**
 * Engine 5: Multi-AI Ensemble Semantic, Paraphrase & AI-Writing Auditor
 * Combines multiple AI models (ChatGPT, Gemini, Claude, Grok, DeepSeek, Meta, Qwen, Mistral)
 * concurrently via Manifest AI's free multi-provider router + user BYOK keys.
 */
async function probeMultiAiEnsemble(sentences = [], docLang = 'id', mode = 'standard', signal = null) {
  const started = Date.now();
  const audits = [];

  // Build numbered sentence list (up to 28 non-bibliography sentences to stay fast & focused)
  const inspected = sentences
    .filter((s) => !s.isBibliography && s.wordCount >= 5)
    .slice(0, mode === 'deep' ? 32 : 20);

  if (inspected.length === 0) {
    return {
      id: 'multiai',
      name: 'Multi-AI Ensemble (ChatGPT · Gemini · Claude · DeepSeek · Grok)',
      status: 'idle',
      found: 0,
      modelsUsed: [],
      latencyMs: Date.now() - started,
      audits: [],
    };
  }

  const numberedBlock = inspected
    .map((s) => `[${s.index}] ${s.text.slice(0, 320)}`)
    .join('\n');

  const messages = [
    {
      role: 'system',
      content:
        'Anda adalah auditor integritas akademik & detektor plagiarisme semantik/parafrase berstandar Turnitin. Balas HANYA dengan objek JSON valid tanpa teks tambahan di luar JSON.',
    },
    {
      role: 'user',
      content: `Audit kalimat bernomor berikut (bahasa: ${docLang}). Identifikasi:
1. Kalimat yang merupakan definisi populer/salinan/parafrase dekat dari buku teks, Wikipedia, atau artikel daring (tanpa menulis ulang orisinal).
2. Indikasi pola penulisan generatif AI (aiWritingScore 0-100).
3. Saran perbaikan konkret berbahasa Indonesia.

Format JSON WAJIB:
{
  "semanticPlagiarismScore": 0-100,
  "aiWritingScore": 0-100,
  "summary": "ringkasan 1-2 kalimat",
  "flaggedSentences": [
    {"index": 0, "type": "exact|paraphrase|ai", "confidence": 65-95, "suspectedSource": "nama sumber/topik umum", "reason": "alasan singkat", "suggestion": "saran parafrase singkat"}
  ],
  "recommendations": ["saran 1", "saran 2", "saran 3"]
}

Teks bernomor:
${numberedBlock}`,
    },
  ];

  try {
    const registry = getCachedModelRegistry() || (await syncLiveModelRegistry({ force: false }).catch(() => null));
    const byokKeys = loadStoredByokKeys();
    const limitMap = loadStoredLimitMap();
    const plan = planEnsembleExecution({
      mode: 'ensemble',
      focusProviderId: 'gemini',
      liveRegistry: registry,
      byokKeys,
      limitMap,
      puterAvailable: false,
      turnIndex: Math.floor(Date.now() / 1000) % 3,
    });

    const targets = [...(plan.primary || []), ...(plan.backups || [])].slice(
      0,
      mode === 'deep' ? 5 : 4
    );

    const runTargetWithTimeout = async (target) => {
      const localAbort = new AbortController();
      const timer = setTimeout(() => localAbort.abort(), AI_AUDIT_TIMEOUT_MS);
      const onOuter = () => localAbort.abort();
      if (signal) signal.addEventListener('abort', onOuter, { once: true });
      try {
        const res = await executeModelTarget(target, messages, { signal: localAbort.signal });
        const parsed = parseAiPlagiarismAuditJson(res?.content || '');
        if (!parsed) throw new Error('NON_JSON');
        return {
          providerId: target.providerId,
          providerLabel: target.providerName || target.shortName || target.model,
          model: target.model,
          latencyMs: res.latencyMs,
          parsed,
        };
      } finally {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onOuter);
      }
    };

    const settled = await Promise.allSettled(targets.slice(0, mode === 'deep' ? 3 : 2).map(runTargetWithTimeout));
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) {
        audits.push(s.value);
      }
    }

    // If first wave all failed due to free rate limit, try next fallback targets
    if (audits.length === 0) {
      for (const fb of targets.slice(2, 4)) {
        if (signal?.aborted) break;
        try {
          const fallbackRes = await runTargetWithTimeout(fb);
          if (fallbackRes) {
            audits.push(fallbackRes);
            break;
          }
        } catch {
          // Try next backup provider
        }
      }
    }
  } catch {
    // Graceful degradation to local stylometric + academic engines
  }

  return {
    id: 'multiai',
    name: 'Multi-AI Ensemble (ChatGPT · Gemini · Claude · DeepSeek · Grok)',
    status: audits.length > 0 ? 'done' : 'fallback',
    found: audits.reduce((sum, a) => sum + (a.parsed?.flaggedSentences?.length || 0), 0),
    modelsUsed: audits.map((a) => a.providerLabel || a.model),
    latencyMs: Date.now() - started,
    audits,
  };
}

/**
 * Engine 6: Optional Turnitin Core API (TCA) / Institutional Plagiarism API Connector.
 * Executes IN PARALLEL with OpenAlex, Crossref, DOAJ, Wikipedia, & Multi-AI whenever configured.
 */
async function probeTurnitinCoreApi(text = '', fileName = '', apiConfig = {}, signal = null) {
  const started = Date.now();
  const endpoint = String(apiConfig?.turnitinEndpoint || apiConfig?.customPlagEndpoint || '').trim();
  const apiKey = String(apiConfig?.turnitinApiKey || apiConfig?.customPlagApiKey || '').trim();

  if (!endpoint || !apiKey) {
    return {
      id: 'turnitin',
      name: 'Turnitin Core API / Institutional',
      status: 'standby',
      found: 0,
      latencyMs: Date.now() - started,
      result: null,
      note: 'Mode gratis aktif · No Repository',
    };
  }

  try {
    const data = await fetchJsonWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'X-Turnitin-Integration-Name': 'Manifestudio-Plagiarism-Checker',
          'X-Turnitin-Integration-Version': '68.0',
          'X-No-Repository': 'true',
          ...(apiConfig.turnitinInstitutionId ? { 'X-Turnitin-Institution-Id': apiConfig.turnitinInstitutionId } : {}),
        },
        body: JSON.stringify({
          title: fileName || 'Document',
          text: String(text || '').slice(0, 80000),
          submitter: 'manifestudio-user',
          no_repository: true,
          store_in_repository: false,
          index_submission: false,
          submit_to_repository: false,
        }),
      },
      12000,
      signal
    );

    const sources = Array.isArray(data?.sources)
      ? data.sources
      : Array.isArray(data?.matches)
      ? data.matches
      : [];

    return {
      id: 'turnitin',
      name: 'Turnitin Core API / Institutional',
      status: 'done',
      found: sources.length,
      latencyMs: Date.now() - started,
      result: { ok: true, sources, raw: data },
      note: `Terhubung (No Repo) · ${sources.length} sumber`,
    };
  } catch (err) {
    return {
      id: 'turnitin',
      name: 'Turnitin Core API / Institutional',
      status: 'fallback',
      found: 0,
      latencyMs: Date.now() - started,
      result: null,
      note: `Endpoint fallback (${err?.message || 'CORS/Auth'})`,
    };
  }
}

/**
 * Main Integrated Multi-Engine Orchestrator (v69).
 * Accepts EITHER a raw `file` (extracted + rendered inside the unified progress bar so uploading
 * requires 0ms waiting!) OR plain `text`, runs ALL plagiarism engines concurrently, preserves
 * the 100% original document layout, and maps matched highlights onto real original pages.
 */
export async function runIntegratedPlagiarismCheck({
  file = null,
  text = '',
  fileName = 'Naskah_Tempel_Langsung.txt',
  fileFormat = 'TEXT',
  fileSize = 0,
  originalSource = null,
  options = {},
  apiConfig = null,
  signal = null,
  onProgress = () => {},
} = {}) {
  const startedAt = Date.now();
  const effectiveApi = apiConfig || loadPlagiarismApiConfig();

  const engineState = [
    ...(file
      ? [{ id: 'extract', name: 'Pembaca Dokumen Asli & OCR Lokal', status: 'running', found: 0, note: `Membaca "${file.name}"...` }]
      : []),
    { id: 'local', name: 'Winnowing K-Gram & Stylometry', status: 'pending', found: 0, note: 'Menunggu teks siap...' },
    { id: 'openalex', name: 'OpenAlex Academic (250M+)', status: 'pending', found: 0, note: 'Menunggu antrean paralel...' },
    { id: 'crossref', name: 'Crossref Publications (150M+)', status: 'pending', found: 0, note: 'Menunggu antrean paralel...' },
    { id: 'doaj', name: 'DOAJ Open-Access Journals', status: 'pending', found: 0, note: 'Menunggu antrean paralel...' },
    { id: 'wikipedia', name: 'Wikipedia ID & EN Full-Index', status: 'pending', found: 0, note: 'Menunggu antrean paralel...' },
    { id: 'multiai', name: 'Multi-AI Ensemble (ChatGPT · Gemini · Claude · DeepSeek · Grok)', status: 'pending', found: 0, note: 'Menunggu analisis semantik & AI...' },
    {
      id: 'turnitin',
      name: 'Turnitin Core API / Institutional',
      status: effectiveApi.turnitinEndpoint && effectiveApi.turnitinApiKey ? 'pending' : 'standby',
      found: 0,
      note: effectiveApi.turnitinEndpoint && effectiveApi.turnitinApiKey
        ? 'Menghubungkan (No Repository)...'
        : 'Mode gratis aktif · No Repository',
    },
  ];

  const emit = (percent, label, phase = 'scanning') => {
    onProgress({
      percent: Math.round(percent),
      label,
      phase,
      engines: engineState.map((e) => ({ ...e })),
    });
  };

  const updateEngine = (id, patch) => {
    const idx = engineState.findIndex((e) => e.id === id);
    if (idx !== -1) {
      engineState[idx] = { ...engineState[idx], ...patch };
    }
  };

  // PHASE 0 (when File uploaded): Extract text + preserve original document pages/bytes (2% -> 34%)
  let workingText = text;
  let workingFileName = fileName;
  let workingFileFormat = fileFormat;
  let workingFileSize = fileSize;
  let workingOriginal = originalSource;

  if (file) {
    emit(4, `Membaca berkas asli "${file.name}" secara lokal (No Repository)...`, 'extract');
    const extracted = await extractTextFromAnyFile(
      file,
      (p) => {
        const mappedPct = 4 + Math.round(((Number(p?.percent) || 10) / 100) * 30);
        updateEngine('extract', { status: 'running', note: p?.label || `Membaca "${file.name}"...` });
        emit(mappedPct, p?.label || `Membaca "${file.name}"...`, 'extract');
      },
      signal
    );
    workingText = extracted.text;
    workingFileName = extracted.fileName;
    workingFileFormat = extracted.fileFormat;
    workingFileSize = extracted.fileSize;
    workingOriginal = extracted.originalSource || null;
    updateEngine('extract', {
      status: 'done',
      found: extracted.pageCount || 1,
      note: extracted.note || `${extracted.pageCount || 1} halaman asli siap`,
    });
  }

  if (signal?.aborted) throw new Error('ABORTED');

  const cleanText = normalizePlainText(workingText);
  const words = countWords(cleanText);
  if (words < 10) {
    throw new Error('Dokumen memiliki kurang dari 10 kata terbaca. Pastikan file berisi teks atau tempel minimal 10 kata.');
  }

  if (!workingOriginal) {
    workingOriginal = buildDocumentSheetsOriginalSource(cleanText);
  }

  // PHASE 1: Segmentation & Fingerprinting (34% -> 42%)
  const basePct = file ? 36 : 10;
  updateEngine('local', { status: 'running', note: 'Menganalisis struktur & sidik jari k-gram...' });
  emit(basePct, 'Menormalisasi naskah, mendeteksi kutipan, daftar pustaka & bahasa...', 'prepare');
  const sentences = segmentDocumentSentences(cleanText);
  const lang = options.language && options.language !== 'auto' ? options.language : detectDocumentLanguage(cleanText).code;
  const maxQueries = options.mode === 'deep' ? 7 : 5;
  const queries = buildPlagiarismSearchQueries(sentences, maxQueries);

  updateEngine('local', {
    status: 'done',
    found: sentences.length,
    note: `${sentences.length} kalimat & ${queries.length} sidik jari k-gram siap`,
  });
  const parallelStartPct = file ? 42 : 18;
  const parallelSpan = file ? 44 : 60;
  emit(parallelStartPct, 'Meluncurkan pemindaian paralel terpadu lintas publikasi, web & Multi-AI...', 'parallel');

  if (signal?.aborted) throw new Error('ABORTED');

  // PHASE 2: Parallel Integrated Multi-API Scan
  let completedCount = 0;
  const totalParallel = 6;
  const bumpProgress = (engineLabel) => {
    completedCount += 1;
    const pct = parallelStartPct + Math.round((completedCount / totalParallel) * parallelSpan);
    emit(pct, `Mesin terpadu selesai: ${engineLabel} (${completedCount}/${totalParallel})...`, 'parallel');
  };

  updateEngine('openalex', { status: 'running', note: 'Memindai 250M+ karya ilmiah OpenAlex...' });
  updateEngine('crossref', { status: 'running', note: 'Memindai 150M+ DOI jurnal Crossref...' });
  updateEngine('doaj', { status: 'running', note: 'Memindai jurnal open-access DOAJ...' });
  updateEngine('wikipedia', { status: 'running', note: 'Memindai ensiklopedia Wikipedia ID & EN...' });
  updateEngine('multiai', { status: 'running', note: 'Menjalankan konsensus Multi-AI (parafrase & indikator AI)...' });
  if (effectiveApi.turnitinEndpoint && effectiveApi.turnitinApiKey) {
    updateEngine('turnitin', { status: 'running', note: 'Memindai repositori Turnitin Core API...' });
  }
  emit(parallelStartPct + 3, 'Semua mesin (OpenAlex, Crossref, DOAJ, Wikipedia, Multi-AI & Turnitin API) berjalan serentak...', 'parallel');

  const [oaRes, crRes, doajRes, wikiRes, aiRes, turnitinRes] = await Promise.all([
    probeOpenAlex(queries, signal).then((r) => {
      updateEngine('openalex', { status: r.status, found: r.found, latencyMs: r.latencyMs, note: `${r.found} kandidat ilmiah (${r.latencyMs}ms)` });
      bumpProgress('OpenAlex');
      return r;
    }),
    probeCrossref(queries, signal).then((r) => {
      updateEngine('crossref', { status: r.status, found: r.found, latencyMs: r.latencyMs, note: `${r.found} DOI jurnal (${r.latencyMs}ms)` });
      bumpProgress('Crossref');
      return r;
    }),
    probeDoaj(queries, signal).then((r) => {
      updateEngine('doaj', { status: r.status, found: r.found, latencyMs: r.latencyMs, note: `${r.found} artikel jurnal (${r.latencyMs}ms)` });
      bumpProgress('DOAJ');
      return r;
    }),
    probeWikipediaFullText(queries, lang, signal).then((r) => {
      updateEngine('wikipedia', { status: r.status, found: r.found, latencyMs: r.latencyMs, note: `${r.found} artikel lengkap (${r.latencyMs}ms)` });
      bumpProgress('Wikipedia ID/EN');
      return r;
    }),
    probeMultiAiEnsemble(sentences, lang, options.mode || 'standard', signal).then((r) => {
      updateEngine('multiai', {
        status: r.status,
        found: r.found,
        latencyMs: r.latencyMs,
        note: r.modelsUsed?.length
          ? `${r.modelsUsed.join(' + ')} aktif (${r.latencyMs}ms)`
          : 'Menggunakan mesin stylometry & n-gram lokal presisi tinggi',
      });
      bumpProgress('Multi-AI Ensemble');
      return r;
    }),
    probeTurnitinCoreApi(cleanText, workingFileName, effectiveApi, signal).then((r) => {
      updateEngine('turnitin', { status: r.status, found: r.found, latencyMs: r.latencyMs, note: r.note });
      bumpProgress('Turnitin Connector');
      return r;
    }),
  ]);

  if (signal?.aborted) throw new Error('ABORTED');

  // PHASE 3: Cross-Engine Fusion & Original-Page Highlight Mapping (86% -> 96%)
  emit(90, 'Menyelaraskan seluruh hasil mesin & memetakan sorotan warna ke halaman dokumen asli...', 'fusion');

  const allCandidates = [
    ...(wikiRes.candidates || []),
    ...(oaRes.candidates || []),
    ...(crRes.candidates || []),
    ...(doajRes.candidates || []),
  ];

  const report = fusePlagiarismReport({
    text: cleanText,
    fileName: workingFileName,
    fileFormat: workingFileFormat,
    fileSize: workingFileSize,
    candidates: allCandidates,
    aiAudits: aiRes.audits || [],
    turnitinResult: turnitinRes.result,
    engineStatuses: engineState.map((e) => ({ ...e })),
    options,
    durationMs: Date.now() - startedAt,
    originalSource: workingOriginal,
  });

  // PHASE 4: Finalization (96% -> 100%)
  emit(96, 'Menyusun Standar Report dengan dokumen asli teranotasi (No Repository)...', 'finalize');
  savePlagiarismHistoryEntry(report);
  emit(100, `Pengecekan selesai — Indeks Kemiripan ${report.similarityPct}% (${report.primarySources.length} sumber teridentifikasi).`, 'complete');

  return report;
}
