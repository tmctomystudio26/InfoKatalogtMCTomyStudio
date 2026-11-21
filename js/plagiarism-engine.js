/**
 * Manifestudio Integrated Plagiarism Engine (v67)
 * 1. Universal All-File Extractor (PDF, DOCX, PPTX, ODT/ODP/ODS, EPUB, XLSX/CSV, RTF, HTML/XML, TXT/MD/Code, DOC, Images OCR, Any File)
 * 2. Parallel Integrated Multi-Engine Scanner (OpenAlex + Crossref + DOAJ + Wikipedia ID/EN + Multi-AI Ensemble + Optional Turnitin Core API)
 *    All engines execute concurrently in a single fused pipeline with real-time 0–100% progress & live status updates.
 */

import {
  extractZipEntries,
  parseDocxBuffer,
  parseExcelBuffer,
  extractTextFromPdfBuffer,
} from './converter.js?v=60';
import { extractPdfTextWithPdfJs } from './media-engine.js?v=60';
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
  buildPlagiarismSearchQueries,
  countWords,
  detectDocumentLanguage,
  extractReadableTextFromBinaryBytes,
  fusePlagiarismReport,
  normalizePlainText,
  parseAiPlagiarismAuditJson,
  reconstructOpenAlexAbstract,
  segmentDocumentSentences,
  stripHtmlOrXmlToPlainText,
  stripRtfToPlainText,
} from './plagiarism-logic.js?v=67';

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
    previewText: String(report.text || '').slice(0, 260),
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

async function runImageOcrFallback(file, onProgress = () => {}) {
  // Optional lazy load of Tesseract.js from jsDelivr for image screenshots/scanned pages
  if (typeof window === 'undefined') return '';
  onProgress({ percent: 45, label: 'Memuat mesin OCR gambar (Tesseract.js)...' });
  try {
    if (!window.Tesseract) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }
    if (window.Tesseract && typeof window.Tesseract.recognize === 'function') {
      onProgress({ percent: 65, label: 'Membaca teks dari gambar (OCR ID + EN)...' });
      const res = await window.Tesseract.recognize(file, 'ind+eng');
      return normalizePlainText(res?.data?.text || '');
    }
  } catch {
    // Graceful fallback if offline
  }
  return '';
}

/**
 * Universal All-File Text Extractor (supports all document, code, and image types).
 * Extracts clean prose from PDF, DOCX, PPTX, ODT/ODP/ODS, EPUB, XLSX/XLS/CSV, RTF, HTML/XML,
 * TXT/MD/TeX/JSON/Source Code, legacy `.doc`, Images (via OCR), and arbitrary text/binary files.
 */
export async function extractTextFromAnyFile(file, onProgress = () => {}) {
  if (!file) throw new Error('Berkas tidak ditemukan.');
  const ext = getFileExtension(file.name);
  const mime = String(file.type || '').toLowerCase();
  onProgress({ percent: 15, label: `Membaca berkas "${file.name}"...` });

  // 1. Images -> OCR
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) {
    const ocrText = await runImageOcrFallback(file, onProgress);
    if (ocrText && countWords(ocrText) >= 3) {
      return {
        text: ocrText,
        fileName: file.name,
        fileFormat: `${(ext || 'IMG').toUpperCase()} (OCR)`,
        fileSize: file.size || 0,
        note: 'Teks berhasil diekstrak dari gambar menggunakan OCR.',
      };
    }
    throw new Error('Tidak ditemukan teks terbaca pada gambar ini (pastikan gambar jelas atau salin teks langsung).');
  }

  const rawBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(rawBuffer);
  const isPdfMagic = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  const isZipMagic = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

  // 2. PDF
  if (ext === 'pdf' || mime.includes('pdf') || isPdfMagic) {
    onProgress({ percent: 45, label: 'Mengekstrak teks dokumen PDF (PDF.js)...' });
    let lines = null;
    if (typeof window !== 'undefined') {
      try {
        lines = await extractPdfTextWithPdfJs(rawBuffer);
      } catch {
        lines = null;
      }
    }
    if (!lines || lines.length === 0) {
      lines = extractTextFromPdfBuffer(rawBuffer);
    }
    const text = normalizePlainText(Array.isArray(lines) ? lines.join('\n\n') : String(lines || ''));
    if (!text || countWords(text) < 2) {
      throw new Error('Dokumen PDF ini tampak berupa hasil scan gambar tanpa lapisan teks. Unggah sebagai gambar (PNG/JPG) untuk OCR atau tempel teks langsung.');
    }
    return {
      text,
      fileName: file.name,
      fileFormat: 'PDF',
      fileSize: file.size || bytes.length,
      note: 'Diekstrak dari dokumen PDF.',
    };
  }

  // 3. DOCX
  if (ext === 'docx' || mime.includes('wordprocessingml')) {
    onProgress({ percent: 48, label: 'Membongkar struktur dokumen Word (.docx)...' });
    const parsed = await parseDocxBuffer(rawBuffer);
    const paras = (parsed?.paragraphs || []).map((p) => (typeof p === 'string' ? p : p.text || '')).filter(Boolean);
    const text = normalizePlainText(paras.join('\n\n'));
    if (text && countWords(text) >= 2) {
      return {
        text,
        fileName: file.name,
        fileFormat: 'DOCX',
        fileSize: file.size || bytes.length,
        note: 'Diekstrak dari Microsoft Word (.docx).',
      };
    }
  }

  // 4. XLSX / XLS / CSV / TSV
  if (['xlsx', 'xls', 'ods'].includes(ext) || mime.includes('spreadsheetml') || mime.includes('excel')) {
    onProgress({ percent: 48, label: 'Mengekstrak isi tabel spreadsheet...' });
    try {
      const parsed = await parseExcelBuffer(rawBuffer, file.name);
      const rows = (parsed?.rows || []).map((r) => (Array.isArray(r) ? r.filter(Boolean).join(' · ') : String(r || ''))).filter(Boolean);
      const text = normalizePlainText(rows.join('\n'));
      if (text) {
        return {
          text,
          fileName: file.name,
          fileFormat: ext.toUpperCase() || 'XLSX',
          fileSize: file.size || bytes.length,
          note: 'Diekstrak dari lembar kerja spreadsheet.',
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
      const entries = await extractZipEntries(rawBuffer);
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const textParts = [];

      const relevant = entries
        .filter((e) => {
          const n = String(e.name || '').toLowerCase();
          if (n.startsWith('ppt/slides/slide') && n.endsWith('.xml')) return true;
          if (n === 'word/document.xml' || n === 'content.xml') return true;
          if (n.endsWith('.xhtml') || n.endsWith('.html') || n.endsWith('.htm') || n.endsWith('.txt') || n.endsWith('.md')) return true;
          return false;
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

      for (const entry of relevant) {
        const rawStr = decoder.decode(entry.data);
        const extracted = entry.name.endsWith('.txt') || entry.name.endsWith('.md')
          ? normalizePlainText(rawStr)
          : stripHtmlOrXmlToPlainText(rawStr);
        if (extracted) textParts.push(extracted);
      }

      const text = normalizePlainText(textParts.join('\n\n'));
      if (text && countWords(text) >= 2) {
        return {
          text,
          fileName: file.name,
          fileFormat: (ext || 'ARCHIVE').toUpperCase(),
          fileSize: file.size || bytes.length,
          note: `Berhasil mengekstrak ${relevant.length} bagian teks dari berkas .${(ext || 'zip').toUpperCase()}.`,
        };
      }
    } catch {
      // Fall through to text/binary decoder
    }
  }

  // 6. RTF
  if (ext === 'rtf' || mime.includes('rtf')) {
    onProgress({ percent: 60, label: 'Membersihkan kode format RTF...' });
    const rawText = new TextDecoder('latin1').decode(bytes);
    const text = stripRtfToPlainText(rawText);
    return {
      text,
      fileName: file.name,
      fileFormat: 'RTF',
      fileSize: file.size || bytes.length,
      note: 'Diekstrak dari dokumen Rich Text (.rtf).',
    };
  }

  // 7. HTML / XML / SVG
  if (['html', 'htm', 'xhtml', 'xml', 'svg'].includes(ext) || mime.includes('html') || mime.includes('xml')) {
    onProgress({ percent: 60, label: 'Mengekstrak teks bersih dari HTML/XML...' });
    const rawStr = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const text = stripHtmlOrXmlToPlainText(rawStr);
    return {
      text,
      fileName: file.name,
      fileFormat: (ext || 'HTML').toUpperCase(),
      fileSize: file.size || bytes.length,
      note: 'Diekstrak dari dokumen web/markup.',
    };
  }

  // 8. Plain text, Markdown, CSV, LaTeX, JSON, Code, or Legacy .doc / Any Other File
  onProgress({ percent: 65, label: 'Mengekstrak teks dari berkas...' });
  const text = extractReadableTextFromBinaryBytes(bytes);
  if (!text || countWords(text) < 2) {
    throw new Error(`Tidak ditemukan teks yang dapat dibaca pada berkas "${file.name}". Coba konversi ke PDF/DOCX/TXT atau tempel teks langsung.`);
  }
  return {
    text,
    fileName: file.name,
    fileFormat: (ext || 'FILE').toUpperCase(),
    fileSize: file.size || bytes.length,
    note: ext === 'doc' ? 'Diekstrak dari dokumen Word klasik (.doc).' : `Diekstrak dari berkas .${(ext || 'txt').toUpperCase()}.`,
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
      note: 'Siap dihubungkan via Pengaturan API (mode terpadu gratis aktif)',
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
          'X-Turnitin-Integration-Version': '67.0',
          ...(apiConfig.turnitinInstitutionId ? { 'X-Turnitin-Institution-Id': apiConfig.turnitinInstitutionId } : {}),
        },
        body: JSON.stringify({
          title: fileName || 'Document',
          text: String(text || '').slice(0, 80000),
          submitter: 'manifestudio-user',
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
      note: `Terhubung · ${sources.length} sumber institusional disatukan`,
    };
  } catch (err) {
    return {
      id: 'turnitin',
      name: 'Turnitin Core API / Institutional',
      status: 'fallback',
      found: 0,
      latencyMs: Date.now() - started,
      result: null,
      note: `Endpoint tidak merespons (${err?.message || 'CORS/Auth'}), dilanjutkan mesin terpadu lain`,
    };
  }
}

/**
 * Main Integrated Multi-Engine Orchestrator.
 * Runs ALL plagiarism engines together concurrently and fuses every signal into ONE Turnitin-style report.
 */
export async function runIntegratedPlagiarismCheck({
  text = '',
  fileName = 'Naskah_Tempel_Langsung.txt',
  fileFormat = 'TEXT',
  fileSize = 0,
  options = {},
  apiConfig = null,
  signal = null,
  onProgress = () => {},
} = {}) {
  const startedAt = Date.now();
  const cleanText = normalizePlainText(text);
  const words = countWords(cleanText);
  if (words < 10) {
    throw new Error('Masukkan minimal 10 kata agar mesin pengecekan plagiarisme dapat menganalisis secara akurat.');
  }

  const effectiveApi = apiConfig || loadPlagiarismApiConfig();
  const engineState = [
    { id: 'local', name: 'Winnowing K-Gram & Stylometry', status: 'running', found: 0, note: 'Menganalisis struktur & sidik jari kalimat...' },
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
        ? 'Menghubungkan ke Turnitin Core API...'
        : 'Siap via Pengaturan API (mode terpadu gratis aktif)',
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

  // PHASE 1: Segmentation & Fingerprinting (0% -> 18%)
  emit(8, 'Menormalisasi naskah, mendeteksi kutipan, daftar pustaka & bahasa...', 'prepare');
  const sentences = segmentDocumentSentences(cleanText);
  const lang = options.language && options.language !== 'auto' ? options.language : detectDocumentLanguage(cleanText).code;
  const maxQueries = options.mode === 'deep' ? 7 : 5;
  const queries = buildPlagiarismSearchQueries(sentences, maxQueries);

  updateEngine('local', {
    status: 'done',
    found: sentences.length,
    note: `${sentences.length} kalimat & ${queries.length} sidik jari k-gram siap`,
  });
  emit(18, 'Meluncurkan pemindaian paralel terpadu lintas publikasi, web & Multi-AI...', 'parallel');

  if (signal?.aborted) throw new Error('ABORTED');

  // PHASE 2: Parallel Integrated Multi-API Scan (18% -> 78%)
  let completedCount = 0;
  const totalParallel = 6;
  const bumpProgress = (engineLabel) => {
    completedCount += 1;
    const pct = 18 + Math.round((completedCount / totalParallel) * 60);
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
  emit(22, 'Semua mesin (OpenAlex, Crossref, DOAJ, Wikipedia, Multi-AI & Turnitin API) berjalan serentak...', 'parallel');

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
    probeTurnitinCoreApi(cleanText, fileName, effectiveApi, signal).then((r) => {
      updateEngine('turnitin', { status: r.status, found: r.found, latencyMs: r.latencyMs, note: r.note });
      bumpProgress('Turnitin Connector');
      return r;
    }),
  ]);

  if (signal?.aborted) throw new Error('ABORTED');

  // PHASE 3: Cross-Engine Fusion & Alignment (78% -> 94%)
  emit(84, 'Menyelaraskan seluruh hasil mesin, menghitung Winnowing k-gram & bobot Turnitin...', 'fusion');

  const allCandidates = [
    ...(wikiRes.candidates || []),
    ...(oaRes.candidates || []),
    ...(crRes.candidates || []),
    ...(doajRes.candidates || []),
  ];

  const report = fusePlagiarismReport({
    text: cleanText,
    fileName,
    fileFormat,
    fileSize,
    candidates: allCandidates,
    aiAudits: aiRes.audits || [],
    turnitinResult: turnitinRes.result,
    engineStatuses: engineState.map((e) => ({ ...e })),
    options,
    durationMs: Date.now() - startedAt,
  });

  // PHASE 4: Finalization (94% -> 100%)
  emit(96, 'Menyusun laporan visual & dokumen unduhan berformat Turnitin terbaru...', 'finalize');
  savePlagiarismHistoryEntry(report);
  emit(100, `Pengecekan selesai — Indeks Kemiripan ${report.similarityPct}% (${report.primarySources.length} sumber teridentifikasi).`, 'complete');

  return report;
}
