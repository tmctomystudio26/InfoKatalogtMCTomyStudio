/**
 * Manifestudio Integrated Plagiarism Checker — Pure Core Logic (v67)
 * Zero DOM / network side-effects; 100% deterministic and unit-tested via node:test.
 *
 * Implements:
 * - Offset-preserving sentence segmentation (ID + EN abbreviation aware)
 * - Quote, inline citation (APA/IEEE/MLA), and Bibliography section detection
 * - Winnowing / Rabin-Karp K-Gram Shingling, Jaccard & TF-IDF Cosine Similarity, & LCS phrase alignment
 * - Internal self-duplication detector across paragraphs
 * - Stylometric AI-Writing Probability estimator (burstiness, lexical richness, transition uniformity)
 * - Unified Multi-Engine Fusion (Turnitin Core API + OpenAlex + Crossref + DOAJ + Wikipedia ID/EN + Multi-AI Ensemble)
 * - Turnitin Latest live filter recalculation (Exclude Quotes, Exclude Bibliography, Exclude Small Sources)
 * - Pure file text-extraction helpers (RTF, HTML/XML, CSV, Markdown, binary fallback)
 */

export const PLAGIARISM_STORAGE_KEYS = Object.freeze({
  HISTORY: 'manifestudio_plagiarism_history_v1',
  API_CONFIG: 'manifestudio_plagiarism_api_cfg_v1',
  PREFS: 'manifestudio_plagiarism_prefs_v1',
});

// Turnitin Latest Multi-Color Highlight Palette (high-contrast accessible inks + soft bands)
export const TURNITIN_SOURCE_COLORS = Object.freeze([
  { id: 1, hex: '#e11d48', soft: 'rgba(225, 29, 72, 0.16)', rgb: [225, 29, 72], bgRgb: [253, 230, 236], name: 'Crimson' },
  { id: 2, hex: '#7c3aed', soft: 'rgba(124, 58, 237, 0.16)', rgb: [124, 58, 237], bgRgb: [238, 232, 254], name: 'Violet' },
  { id: 3, hex: '#0284c7', soft: 'rgba(2, 132, 199, 0.16)', rgb: [2, 132, 199], bgRgb: [224, 242, 254], name: 'Ocean' },
  { id: 4, hex: '#059669', soft: 'rgba(5, 150, 105, 0.16)', rgb: [5, 150, 105], bgRgb: [209, 250, 229], name: 'Emerald' },
  { id: 5, hex: '#d97706', soft: 'rgba(217, 119, 6, 0.18)', rgb: [217, 119, 6], bgRgb: [254, 243, 199], name: 'Amber' },
  { id: 6, hex: '#db2777', soft: 'rgba(219, 39, 119, 0.16)', rgb: [219, 39, 119], bgRgb: [252, 231, 243], name: 'Magenta' },
  { id: 7, hex: '#4f46e5', soft: 'rgba(79, 70, 229, 0.16)', rgb: [79, 70, 229], bgRgb: [224, 231, 255], name: 'Indigo' },
  { id: 8, hex: '#0d9488', soft: 'rgba(13, 148, 136, 0.16)', rgb: [13, 148, 136], bgRgb: [204, 251, 241], name: 'Teal' },
  { id: 9, hex: '#ea580c', soft: 'rgba(234, 88, 12, 0.16)', rgb: [234, 88, 12], bgRgb: [255, 237, 213], name: 'Tangerine' },
  { id: 10, hex: '#9333ea', soft: 'rgba(147, 51, 234, 0.16)', rgb: [147, 51, 234], bgRgb: [243, 232, 255], name: 'Purple' },
]);

export const PLAGIARISM_DEMO_TEXT = `Kecerdasan buatan atau Akal Imitasi (dari bahasa Inggris: artificial intelligence atau AI) adalah kemampuan sistem komputasi untuk melaksanakan tugas-tugas yang umumnya dikaitkan dengan kecerdasan manusia, seperti pembelajaran, penalaran, pemecahan masalah, persepsi, dan pengambilan keputusan.

Dalam perkembangan teknologi pendidikan modern di Indonesia, pemanfaatan pembelajaran mesin dan pemrosesan bahasa alami membantu mahasiswa serta peneliti meninjau literatur secara jauh lebih cepat dan terstruktur. Menurut pengamatan langsung kami di kelas praktikum semester ganjil tahun 2026, mahasiswa yang menyusun kerangka gagasan dengan bahasa sendiri sebelum menulis draf akhir menunjukkan pemahaman konsep yang lebih matang dibandingkan mahasiswa yang sekadar menyalin definisi dari ensiklopedia daring.

"Pendidikan adalah senjata paling ampuh yang bisa kamu gunakan untuk mengubah dunia" (Mandela, 2003). Kutipan tersebut menegaskan bahwa kejujuran akademik merupakan fondasi utama dalam membangun kualitas riset nasional yang kredibel dan berdaya saing global.

Machine learning (ML) is a field of study in artificial intelligence concerned with the development and study of statistical algorithms that can learn from data and generalize to unseen data, and thus perform tasks without explicit instructions. Oleh karena itu, penulis karya ilmiah wajib melakukan parafrase secara utuh, mencantumkan rujukan primer secara konsisten, serta memverifikasi orisinalitas naskah sebelum publikasi.

Daftar Pustaka
Mandela, N. (2003). Lighting Your Way to a Better Future. Johannesburg: Mindset Network.
Russell, S., & Norvig, P. (2021). Artificial Intelligence: A Modern Approach (4th ed.). Pearson.`;

const STOPWORDS = new Set([
  // Indonesian
  'yang', 'dan', 'di', 'ke', 'dari', 'pada', 'dalam', 'untuk', 'dengan', 'atau', 'adalah', 'ini', 'itu',
  'sebagai', 'oleh', 'akan', 'juga', 'dapat', 'bisa', 'telah', 'sudah', 'tidak', 'ada', 'karena', 'agar',
  'bahwa', 'sebuah', 'suatu', 'para', 'kami', 'kita', 'mereka', 'anda', 'saya', 'ia', 'dia', 'tersebut',
  'lebih', 'sangat', 'seperti', 'secara', 'serta', 'namun', 'tetapi', 'bila', 'jika', 'maka', 'saat',
  'ketika', 'antara', 'hingga', 'sampai', 'atas', 'bawah', 'melalui', 'menjadi', 'merupakan', 'yaitu',
  'yakni', 'maupun', 'bagi', 'tentang', 'terhadap', 'hal', 'pun', 'lah', 'kah', 'nya',
  // English
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'are', 'was', 'were', 'been', 'being', 'have',
  'has', 'had', 'not', 'but', 'can', 'will', 'would', 'should', 'could', 'into', 'onto', 'upon', 'about',
  'above', 'below', 'between', 'through', 'during', 'before', 'after', 'such', 'than', 'then', 'there',
  'their', 'they', 'them', 'these', 'those', 'which', 'while', 'where', 'when', 'what', 'whose', 'also',
  'more', 'most', 'very', 'only', 'just', 'over', 'under', 'each', 'other', 'some', 'many', 'much',
  'its', 'our', 'your', 'his', 'her', 'who', 'whom', 'how', 'why', 'all', 'any', 'both', 'few', 'same',
]);

const ABBREVIATIONS = new Set([
  'dr', 'drs', 'dra', 'prof', 'ir', 'mr', 'mrs', 'ms', 'st', 'jr', 'sr', 'no', 'hlm', 'hal', 'vol',
  'ed', 'eds', 'dkk', 'dll', 'dsb', 'dst', 'yth', 'tgl', 'rp', 'pt', 'cv', 'tbk', 'fig', 'eq', 'vs',
  'etc', 'al', 'eg', 'ie', 'inc', 'ltd', 'co', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep',
  'sept', 'oct', 'nov', 'dec', 'des', 'agt', 'okt',
]);

const AI_TRANSITION_PHRASES = [
  'kesimpulannya', 'secara keseluruhan', 'penting untuk dicatat', 'perlu diperhatikan bahwa',
  'di era digital saat ini', 'tidak dapat dipungkiri', 'dalam dunia yang terus berkembang',
  'oleh karena itu, dapat disimpulkan', 'seiring dengan perkembangan zaman', 'berperan penting dalam',
  'in conclusion', 'it is important to note', 'furthermore', 'moreover', 'additionally',
  'in today\'s rapidly evolving', 'delve into', 'tapestry of', 'testament to', 'pivotal role',
  'comprehensive overview', 'multifaceted', 'landscape of', 'underscores the importance',
];

export function clampNum(val, min, max, fallback = min) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function escapePlagHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function normalizePlainText(raw = '') {
  return String(raw || '')
    .replace(/\uFEFF/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u00A0\u2000-\u200A\u202F]/g, ' ')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function tokenizeWords(text = '', { stripStopwords = false, minLen = 2 } = {}) {
  const cleaned = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
    .trim();
  if (!cleaned) return [];
  const raw = cleaned.split(/\s+/);
  return raw.filter((w) => {
    if (w.length < minLen) return false;
    if (stripStopwords && STOPWORDS.has(w)) return false;
    return true;
  });
}

export function countWords(text = '') {
  const m = String(text || '').trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
}

export function detectDocumentLanguage(text = '') {
  const words = tokenizeWords(text, { minLen: 2 });
  if (words.length === 0) return { code: 'id', label: 'Bahasa Indonesia' };
  const idMarkers = new Set(['yang', 'dan', 'adalah', 'untuk', 'dengan', 'dalam', 'pada', 'dari', 'tidak', 'dapat', 'sebagai', 'atau', 'oleh', 'juga', 'karena', 'bahwa']);
  const enMarkers = new Set(['the', 'and', 'that', 'with', 'from', 'this', 'which', 'have', 'been', 'their', 'about', 'through', 'between', 'however', 'therefore']);
  let idHits = 0;
  let enHits = 0;
  for (const w of words) {
    if (idMarkers.has(w)) idHits += 1;
    if (enMarkers.has(w)) enHits += 1;
  }
  if (idHits > 0 && enHits > 0) {
    const ratio = Math.min(idHits, enHits) / Math.max(idHits, enHits);
    if (ratio >= 0.35) return { code: 'mix', label: 'Campuran (ID + EN)' };
  }
  if (enHits > idHits * 1.2) return { code: 'en', label: 'English' };
  return { code: 'id', label: 'Bahasa Indonesia' };
}

/**
 * Finds the character index where a Bibliography / References section begins, or -1.
 */
export function findBibliographyStartIndex(text = '') {
  const src = String(text || '');
  const regex = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:daftar\s+pustaka|daftar\s+referensi|referensi|kepustakaan|bibliografi|references|bibliography|works\s+cited)\s*:?\s*(?:\n|$)/gi;
  let lastIdx = -1;
  let match;
  while ((match = regex.exec(src)) !== null) {
    // Only treat as bibliography if it's in the latter 45% of the document (or after char 120)
    if (match.index >= Math.min(120, Math.floor(src.length * 0.45))) {
      lastIdx = match.index;
    }
  }
  return lastIdx;
}

/**
 * Checks whether a sentence is predominantly a direct quotation or bibliographic citation entry.
 */
export function classifySentenceMeta(sentenceText = '', isAfterBibHeading = false) {
  const trimmed = String(sentenceText || '').trim();
  if (isAfterBibHeading) {
    return { isBibliography: true, isQuote: false, hasCitation: true };
  }
  // Direct quotes wrapped in "..." or “...” or ‘...’
  const quoteMatch = trimmed.match(/["“«]([^"”»]{12,})["”»]/g);
  const quotedChars = quoteMatch ? quoteMatch.reduce((sum, s) => sum + s.length, 0) : 0;
  const isQuote = quotedChars >= trimmed.length * 0.48;

  // Inline citations like (Smith, 2020), (Sugiyono, 2019: 45), [1], [12-14], et al.
  const hasCitation =
    /\([A-Z][A-Za-z\s.&,-]+,\s*(?:19|20)\d{2}[a-z]?(?:\s*[:;,]\s*(?:p{1,2}\.?|hlm\.?)?\s*\d+(?:-\d+)?)?\)/.test(trimmed) ||
    /\[\d+(?:\s*[-–,]\s*\d+)*\]/.test(trimmed) ||
    /\b(?:et\s+al\.|dkk\.|menurut\s+[A-Z][a-z]+)\b/.test(trimmed);

  return { isBibliography: false, isQuote, hasCitation };
}

/**
 * Segments document text into sentences while preserving exact [start, end) character offsets
 * so Turnitin-style inline highlights map 1:1 back to the original manuscript.
 */
export function segmentDocumentSentences(rawText = '') {
  const text = normalizePlainText(rawText);
  if (!text) return [];
  const bibStart = findBibliographyStartIndex(text);
  const sentences = [];

  let cursor = 0;
  const len = text.length;

  const pushSlice = (rawStart, rawEnd) => {
    let s = rawStart;
    let e = rawEnd;
    while (s < e && /\s/.test(text[s])) s += 1;
    while (e > s && /\s/.test(text[e - 1])) e -= 1;
    if (e <= s) return;
    const chunk = text.slice(s, e);
    const words = countWords(chunk);
    if (words === 0) return;
    const inBib = bibStart !== -1 && s >= bibStart;
    const meta = classifySentenceMeta(chunk, inBib);
    sentences.push({
      index: sentences.length,
      start: s,
      end: e,
      text: chunk,
      wordCount: words,
      tokens: tokenizeWords(chunk, { stripStopwords: false, minLen: 2 }),
      keyTokens: tokenizeWords(chunk, { stripStopwords: true, minLen: 3 }),
      isBibliography: meta.isBibliography,
      isQuote: meta.isQuote,
      hasCitation: meta.hasCitation,
    });
  };

  for (let i = 0; i < len; i += 1) {
    const ch = text[i];

    // Paragraph break (\n\n) always terminates sentence
    if (ch === '\n' && text[i + 1] === '\n') {
      pushSlice(cursor, i);
      cursor = i + 2;
      i += 1;
      continue;
    }

    // Single newline in bibliography or headings
    if (ch === '\n' && (bibStart !== -1 && i >= bibStart)) {
      pushSlice(cursor, i);
      cursor = i + 1;
      continue;
    }

    if (ch === '.' || ch === '!' || ch === '?') {
      const nextCh = text[i + 1] || '';
      const nextNext = text[i + 2] || '';
      // Skip decimals like 3.14 or URLs like api.crossref.org
      if (ch === '.' && /\d/.test(text[i - 1] || '') && /\d/.test(nextCh)) continue;
      if (ch === '.' && /[a-z0-9]/i.test(nextCh)) continue;

      // Check abbreviation before period
      if (ch === '.') {
        const before = text.slice(Math.max(cursor, i - 14), i);
        const lastWordMatch = before.match(/([A-Za-z]+)$/);
        if (lastWordMatch) {
          const lw = lastWordMatch[1].toLowerCase();
          if (ABBREVIATIONS.has(lw) || lw.length === 1) {
            continue;
          }
        }
      }

      // Close optional trailing quote/paren
      let endIdx = i + 1;
      if (nextCh === '"' || nextCh === '”' || nextCh === "'" || nextCh === ')') {
        endIdx = i + 2;
      }

      if (!nextCh || /\s/.test(nextCh) || (endIdx === i + 2 && (!nextNext || /\s/.test(nextNext)))) {
        pushSlice(cursor, endIdx);
        cursor = endIdx;
        i = endIdx - 1;
      }
    }
  }

  if (cursor < len) {
    pushSlice(cursor, len);
  }

  return sentences;
}

/**
 * Generates k-gram word shingles (used for Winnowing / Rabin-Karp exact & near-exact plagiarism matching).
 */
export function buildWordShingles(tokens = [], k = 5) {
  const set = new Set();
  if (!Array.isArray(tokens) || tokens.length === 0) return set;
  const effK = Math.min(k, tokens.length);
  if (effK < 3) return set;
  for (let i = 0; i <= tokens.length - effK; i += 1) {
    set.add(tokens.slice(i, i + effK).join(' '));
  }
  return set;
}

/**
 * Computes Jaccard overlap on k-gram shingles + containment (how much of sentence A appears in source B).
 */
export function computeShingleContainment(sentenceTokens = [], sourceTokens = [], k = 5) {
  if (sentenceTokens.length < 4 || sourceTokens.length < 4) return 0;
  const sShingles = buildWordShingles(sentenceTokens, Math.min(k, sentenceTokens.length));
  if (sShingles.size === 0) return 0;
  const tShingles = buildWordShingles(sourceTokens, Math.min(k, sentenceTokens.length));
  if (tShingles.size === 0) return 0;
  let hits = 0;
  for (const sh of sShingles) {
    if (tShingles.has(sh)) hits += 1;
  }
  return hits / sShingles.size;
}

/**
 * Computes longest consecutive word match ratio between a sentence and candidate source tokens.
 */
export function computeLongestWordRunRatio(sentenceTokens = [], sourceTokens = []) {
  if (sentenceTokens.length < 4 || sourceTokens.length < 4) return { ratio: 0, maxRun: 0 };
  // Index positions of words in source for O(n * avg_occ) exact alignment
  const posMap = new Map();
  for (let j = 0; j < sourceTokens.length; j += 1) {
    const w = sourceTokens[j];
    let arr = posMap.get(w);
    if (!arr) {
      arr = [];
      posMap.set(w, arr);
    }
    if (arr.length < 24) arr.push(j);
  }
  let maxRun = 0;
  for (let i = 0; i < sentenceTokens.length; i += 1) {
    const starts = posMap.get(sentenceTokens[i]);
    if (!starts) continue;
    for (const j0 of starts) {
      let run = 1;
      while (
        i + run < sentenceTokens.length &&
        j0 + run < sourceTokens.length &&
        sentenceTokens[i + run] === sourceTokens[j0 + run]
      ) {
        run += 1;
      }
      if (run > maxRun) maxRun = run;
    }
  }
  return {
    maxRun,
    ratio: maxRun / sentenceTokens.length,
  };
}

/**
 * Computes weighted Cosine similarity on informative (non-stopword) tokens.
 */
export function computeTokenCosineSimilarity(tokensA = [], tokensB = []) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const freqA = new Map();
  const freqB = new Map();
  for (const t of tokensA) freqA.set(t, (freqA.get(t) || 0) + 1);
  for (const t of tokensB) freqB.set(t, (freqB.get(t) || 0) + 1);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const [k, v] of freqA) {
    magA += v * v;
    const vb = freqB.get(k);
    if (vb) dot += v * vb;
  }
  for (const [, v] of freqB) magB += v * v;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Combined local sentence-to-source alignment score in [0..1], returning matchType & confidence.
 */
export function scoreSentenceAgainstSource(sentence, sourceText = '') {
  const sTokens = sentence?.tokens || tokenizeWords(sentence?.text || '');
  const sKey = sentence?.keyTokens || tokenizeWords(sentence?.text || '', { stripStopwords: true, minLen: 3 });
  if (sTokens.length < 5 || !sourceText) {
    return { score: 0, matchType: 'none', maxRun: 0, containment: 0, cosine: 0 };
  }
  const srcTokens = tokenizeWords(sourceText, { stripStopwords: false, minLen: 2 });
  if (srcTokens.length < 5) {
    return { score: 0, matchType: 'none', maxRun: 0, containment: 0, cosine: 0 };
  }
  const srcKey = tokenizeWords(sourceText, { stripStopwords: true, minLen: 3 });

  const contain5 = computeShingleContainment(sTokens, srcTokens, 5);
  const contain4 = computeShingleContainment(sTokens, srcTokens, 4);
  const { maxRun, ratio: runRatio } = computeLongestWordRunRatio(sTokens, srcTokens);
  const cosine = computeTokenCosineSimilarity(sKey, srcKey);

  // Exact / Verbatim copy detection (e.g., 6+ consecutive matching words or strong 5-gram containment)
  if (maxRun >= 7 || contain5 >= 0.35 || runRatio >= 0.55) {
    const score = clampNum(
      Math.max(contain5 * 1.15, runRatio * 1.05, cosine * 0.92, maxRun >= 9 ? 0.86 : 0.72),
      0.58,
      1.0,
      0.75
    );
    return { score, matchType: 'exact', maxRun, containment: contain5, cosine };
  }

  // Mosaic / Near-copy detection
  if (maxRun >= 5 || contain4 >= 0.32 || (cosine >= 0.62 && sKey.length >= 5)) {
    const score = clampNum(
      Math.max(contain4 * 0.95, runRatio * 0.9, cosine * 0.85),
      0.42,
      0.88,
      0.55
    );
    return { score, matchType: 'near-exact', maxRun, containment: contain4, cosine };
  }

  // Strong topical/paraphrase overlap (requires multiple distinct key terms matching)
  const keyOverlap = sKey.filter((t) => srcKey.includes(t));
  const uniqueOverlap = new Set(keyOverlap).size;
  if (cosine >= 0.52 && uniqueOverlap >= 5) {
    return {
      score: clampNum(cosine * 0.78, 0.38, 0.74, 0.45),
      matchType: 'paraphrase',
      maxRun,
      containment: contain4,
      cosine,
    };
  }

  return { score: 0, matchType: 'none', maxRun, containment: contain5, cosine };
}

/**
 * Selects diverse, high-signal search queries from the document for parallel multi-API probing.
 */
export function buildPlagiarismSearchQueries(sentences = [], maxQueries = 6) {
  const eligible = sentences.filter((s) => !s.isBibliography && s.wordCount >= 7);
  if (eligible.length === 0) {
    const fallback = sentences.filter((s) => s.wordCount >= 4).slice(0, 2);
    return fallback.map((s) => ({
      sentenceIndex: s.index,
      phrase: s.text.slice(0, 140),
      keywords: s.keyTokens.slice(0, 7).join(' ') || s.tokens.slice(0, 7).join(' '),
      lang: detectDocumentLanguage(s.text).code,
    }));
  }

  // Evenly spread across document (beginning, middle, end) + longest information-dense sentences
  const picked = [];
  const seenIdx = new Set();
  const step = Math.max(1, Math.floor(eligible.length / maxQueries));
  for (let i = 0; i < eligible.length && picked.length < maxQueries; i += step) {
    const s = eligible[i];
    if (!seenIdx.has(s.index)) {
      seenIdx.add(s.index);
      picked.push(s);
    }
  }
  // Fill remaining slots with highest key-token density sentences
  const byDensity = [...eligible].sort((a, b) => b.keyTokens.length - a.keyTokens.length);
  for (const s of byDensity) {
    if (picked.length >= maxQueries) break;
    if (!seenIdx.has(s.index)) {
      seenIdx.add(s.index);
      picked.push(s);
    }
  }

  return picked.map((s) => {
    const cleanWords = s.text
      .replace(/["“”()[\]{}]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ');
    // Grab an 8-11 word informative core phrase
    const startOffset = cleanWords.length > 14 ? 2 : 0;
    const phrase = cleanWords.slice(startOffset, startOffset + 11).join(' ');
    const uniqKey = [...new Set(s.keyTokens)];
    const keywords = uniqKey.slice(0, 7).join(' ') || s.tokens.slice(0, 7).join(' ');
    const shortKeywords = uniqKey.slice(0, 4).join(' ') || s.tokens.slice(0, 4).join(' ');
    return {
      sentenceIndex: s.index,
      phrase,
      keywords,
      shortKeywords,
      lang: detectDocumentLanguage(s.text).code,
    };
  });
}

/**
 * Detects internal self-duplication (copy-pasted / heavily recycled sentences inside the same document).
 */
export function detectInternalSelfDuplication(sentences = []) {
  const duplicates = [];
  const active = sentences.filter((s) => !s.isBibliography && s.wordCount >= 8);
  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const a = active[i];
      const b = active[j];
      const contain = computeShingleContainment(b.tokens, a.tokens, 5);
      const cosine = computeTokenCosineSimilarity(b.keyTokens, a.keyTokens);
      if (contain >= 0.55 || cosine >= 0.86) {
        duplicates.push({
          sentenceIndex: b.index,
          mirrorsIndex: a.index,
          score: clampNum(Math.max(contain, cosine), 0.65, 1.0, 0.8),
        });
        break;
      }
    }
  }
  return duplicates;
}

/**
 * Pure stylometric AI-Writing Probability estimator (Turnitin AI Writing Indicator style).
 * Measures sentence-length burstiness (CV), lexical diversity (TTR), and AI boilerplate transition density.
 */
export function analyzeStylometricAiSignals(text = '', sentences = []) {
  const nonBib = sentences.filter((s) => !s.isBibliography && s.wordCount >= 4);
  const allTokens = tokenizeWords(text, { minLen: 2 });
  const totalWords = allTokens.length;

  if (totalWords < 25 || nonBib.length < 2) {
    return {
      aiProbability: 0,
      burstinessScore: 50,
      lexicalDiversity: 50,
      clicheHits: [],
      verdict: 'Teks terlalu singkat untuk analisis pola AI yang konklusif',
      flaggedSentenceIndices: [],
    };
  }

  // 1. Burstiness (Coefficient of Variation of sentence lengths; human prose tends to vary more)
  const lengths = nonBib.map((s) => s.wordCount);
  const meanLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, l) => sum + (l - meanLen) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);
  const cv = meanLen > 0 ? stdDev / meanLen : 0.4;
  // Low CV (<0.26) = very uniform AI-like cadence; high CV (>0.48) = human bursty cadence
  const burstinessScore = Math.round(clampNum((cv / 0.62) * 100, 5, 100, 50));

  // 2. Root-TTR (Guiraud index, length-invariant lexical richness)
  const uniqueCount = new Set(allTokens).size;
  const guiraud = uniqueCount / Math.sqrt(totalWords);
  const lexicalDiversity = Math.round(clampNum(((guiraud - 3.0) / 5.5) * 100, 10, 100, 55));

  // 3. AI formulaic transition clichés
  const lower = text.toLowerCase();
  const clicheHits = AI_TRANSITION_PHRASES.filter((p) => lower.includes(p));
  const clicheDensity = clicheHits.length / Math.max(1, nonBib.length / 4);

  // Flag individual sentences with AI-boilerplate markers or ultra-uniform 16–26 word structure
  const flaggedSentenceIndices = [];
  for (const s of nonBib) {
    const sLow = s.text.toLowerCase();
    const hasCliche = AI_TRANSITION_PHRASES.some((p) => sLow.includes(p));
    if (hasCliche) {
      flaggedSentenceIndices.push(s.index);
    }
  }

  let rawAi = 18;
  if (cv < 0.24) rawAi += 28;
  else if (cv < 0.34) rawAi += 14;
  else if (cv > 0.5) rawAi -= 10;

  if (meanLen >= 16 && meanLen <= 28 && nonBib.length >= 4) rawAi += 10;
  rawAi += Math.min(34, clicheDensity * 18);
  if (lexicalDiversity < 38) rawAi += 10;

  const aiProbability = Math.round(clampNum(rawAi, 0, 96, 15));
  let verdict = 'Pola penulisan dominan alami (manusia)';
  if (aiProbability >= 65) verdict = 'Indikasi kuat pola generatif AI / struktur seragam';
  else if (aiProbability >= 38) verdict = 'Pola campuran (sebagian terindikasi bantuan/parafrase AI)';

  return {
    aiProbability,
    burstinessScore,
    lexicalDiversity,
    clicheHits,
    verdict,
    flaggedSentenceIndices,
  };
}

/**
 * Reconstructs plain abstract string from OpenAlex's `abstract_inverted_index`.
 */
export function reconstructOpenAlexAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const words = [];
  for (const [token, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (Number.isInteger(pos) && pos >= 0 && pos < 1500) {
        words[pos] = token;
      }
    }
  }
  return words.filter(Boolean).join(' ').trim();
}

/**
 * Safely parses Multi-AI JSON evaluation block from LLM responses.
 */
export function parseAiPlagiarismAuditJson(rawText = '') {
  const str = String(rawText || '').trim();
  if (!str) return null;
  const fenced = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : str;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object') return null;
    const semanticScore = clampNum(parsed.semanticPlagiarismScore ?? parsed.similarityScore ?? 0, 0, 100, 0);
    const aiWritingScore = clampNum(parsed.aiWritingScore ?? parsed.aiProbability ?? 0, 0, 100, 0);
    const flagged = Array.isArray(parsed.flaggedSentences)
      ? parsed.flaggedSentences
          .filter((item) => item && Number.isInteger(Number(item.index)))
          .map((item) => ({
            index: Number(item.index),
            reason: String(item.reason || 'Terindikasi kemiripan semantik / parafrase').slice(0, 220),
            matchType: String(item.type || 'paraphrase').toLowerCase(),
            confidence: clampNum(item.confidence ?? 68, 35, 98, 68),
            suspectedSource: String(item.suspectedSource || '').slice(0, 180),
            suggestion: String(item.suggestion || '').slice(0, 260),
          }))
      : [];
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map((r) => String(r || '').trim()).filter(Boolean).slice(0, 6)
      : [];
    return {
      semanticPlagiarismScore: Math.round(semanticScore),
      aiWritingScore: Math.round(aiWritingScore),
      summary: String(parsed.summary || '').trim().slice(0, 500),
      flaggedSentences: flagged,
      recommendations,
    };
  } catch {
    return null;
  }
}

/**
 * Generates a Turnitin-style Submission ID (`MS-PLG-YYYYMMDD-XXXXXX`).
 */
export function generateSubmissionId(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `MS-PLG-${yyyy}${mm}${dd}-${rand}`;
}

/**
 * Unifies and fuses candidates from ALL integrated engines:
 * - Academic Publications (OpenAlex, Crossref, DOAJ)
 * - Web & Encyclopedia (Wikipedia ID/EN, Wikisource/Wikibooks)
 * - Turnitin Core API / Institutional API matches (when configured)
 * - Multi-AI Semantic & Paraphrase Consensus (ChatGPT, Gemini, Claude, Grok, DeepSeek, Meta, Qwen, Mistral)
 * - Local Winnowing + Self-Duplication + Stylometric AI Engine
 *
 * Returns a complete Turnitin-ready report object whose scores can be dynamically recalculated via `applyReportFilters`.
 */
export function fusePlagiarismReport({
  text = '',
  fileName = 'Naskah_Tempel_Langsung.txt',
  fileFormat = 'TEXT',
  fileSize = 0,
  candidates = [],
  aiAudits = [],
  turnitinResult = null,
  engineStatuses = [],
  options = {},
  submissionId = null,
  checkedAt = new Date().toISOString(),
  durationMs = 0,
} = {}) {
  const cleanText = normalizePlainText(text);
  const sentences = segmentDocumentSentences(cleanText);
  const totalWords = countWords(cleanText);
  const totalChars = cleanText.length;
  const language = detectDocumentLanguage(cleanText);
  const stylometric = analyzeStylometricAiSignals(cleanText, sentences);
  const selfDups = detectInternalSelfDuplication(sentences);

  // 1. Deduplicate external candidate sources by normalized URL/DOI or title
  const dedupSources = new Map();
  const addCandidate = (cand) => {
    if (!cand || (!cand.content && !cand.title)) return;
    const normKey = String(cand.url || cand.doi || cand.title || '')
      .toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/+$/, '')
      .trim();
    if (!normKey) return;
    const existing = dedupSources.get(normKey);
    const mergedContent = existing
      ? `${existing.content}\n${cand.content || ''}`.slice(0, 12000)
      : String(cand.content || cand.title || '').slice(0, 12000);
    dedupSources.set(normKey, {
      key: normKey,
      title: cand.title || existing?.title || 'Sumber Eksternal',
      url: cand.url || existing?.url || '',
      doi: cand.doi || existing?.doi || '',
      category: cand.category || existing?.category || 'internet', // 'internet' | 'publication' | 'student'
      engine: existing ? `${existing.engine} + ${cand.engine || 'Web'}` : (cand.engine || 'Open Source API'),
      authors: cand.authors || existing?.authors || '',
      year: cand.year || existing?.year || '',
      content: mergedContent,
      explicitSentenceMatches: [
        ...(existing?.explicitSentenceMatches || []),
        ...(Array.isArray(cand.explicitSentenceMatches) ? cand.explicitSentenceMatches : []),
      ],
    });
  };

  for (const c of candidates) addCandidate(c);

  // Merge Turnitin Core API direct sources if returned
  if (turnitinResult && Array.isArray(turnitinResult.sources)) {
    for (const ts of turnitinResult.sources) {
      addCandidate({
        title: ts.title || ts.name || 'Turnitin Repository Source',
        url: ts.url || '',
        doi: ts.doi || '',
        category: ts.category || 'publication',
        engine: 'Turnitin Core API',
        content: ts.matchedText || ts.excerpt || ts.title || '',
        explicitSentenceMatches: ts.sentenceIndices || [],
      });
    }
  }

  // Add internal self-duplication virtual source if found
  if (selfDups.length > 0) {
    dedupSources.set('internal-self-duplication', {
      key: 'internal-self-duplication',
      title: 'Pengulangan Internal Dokumen (Self-Duplication)',
      url: '',
      doi: '',
      category: 'student',
      engine: 'Local Winnowing Engine',
      authors: 'Dokumen Saat Ini',
      year: String(new Date().getFullYear()),
      content: '',
      explicitSentenceMatches: selfDups.map((d) => ({ index: d.sentenceIndex, score: d.score, matchType: 'self-duplicate' })),
    });
  }

  const sourceList = [...dedupSources.values()];

  // 2. Align every sentence against ALL candidate sources (best-scoring primary source per sentence)
  const sentenceMatches = sentences.map((sent) => {
    let best = null;
    for (const src of sourceList) {
      // Check explicit matches (e.g. from Turnitin API or Self-Duplication)
      const explicit = (src.explicitSentenceMatches || []).find(
        (m) => (typeof m === 'number' ? m === sent.index : m.index === sent.index)
      );
      if (explicit) {
        const expScore = typeof explicit === 'number' ? 0.88 : clampNum(explicit.score, 0.5, 1, 0.85);
        if (!best || expScore > best.score) {
          best = {
            sourceKey: src.key,
            score: expScore,
            matchType: typeof explicit === 'object' && explicit.matchType ? explicit.matchType : 'exact',
            reason: src.key === 'internal-self-duplication'
              ? 'Kalimat berulang / disalin dari bagian lain dalam dokumen yang sama.'
              : `Kecocokan terverifikasi oleh ${src.engine}.`,
            suggestion: '',
          };
        }
        continue;
      }

      if (!src.content) continue;
      const evalRes = scoreSentenceAgainstSource(sent, src.content);
      if (evalRes.score >= 0.42 && (!best || evalRes.score > best.score)) {
        best = {
          sourceKey: src.key,
          score: evalRes.score,
          matchType: evalRes.matchType,
          maxRun: evalRes.maxRun,
          reason:
            evalRes.matchType === 'exact'
              ? `Kecocokan frasa persis (${evalRes.maxRun} kata berurutan) terdeteksi pada "${src.title}".`
              : evalRes.matchType === 'near-exact'
              ? `Kemiripan tinggi / salinan mozaik terdeteksi pada "${src.title}".`
              : `Kemiripan struktur & istilah kunci terdeteksi pada "${src.title}".`,
          suggestion: '',
        };
      }
    }

    return {
      ...sent,
      match: best,
    };
  });

  // 3. Fuse Multi-AI Ensemble semantic / paraphrase findings WITH the web/academic matches
  const validAudits = aiAudits.filter((a) => a && a.parsed);
  const aiModelNames = validAudits.map((a) => a.providerLabel || a.model || 'AI Model');
  const aiCombinedRecommendations = [];
  const aiSummaries = [];

  if (validAudits.length > 0) {
    const aiSentenceVotes = new Map();
    for (const audit of validAudits) {
      if (audit.parsed.summary) aiSummaries.push(`[${audit.providerLabel || 'AI'}] ${audit.parsed.summary}`);
      for (const rec of audit.parsed.recommendations || []) {
        if (!aiCombinedRecommendations.includes(rec)) aiCombinedRecommendations.push(rec);
      }
      for (const flag of audit.parsed.flaggedSentences || []) {
        const idx = flag.index;
        if (idx < 0 || idx >= sentenceMatches.length) continue;
        const curr = aiSentenceVotes.get(idx) || { votes: 0, confSum: 0, reasons: [], sources: [], suggestions: [], type: flag.matchType };
        curr.votes += 1;
        curr.confSum += flag.confidence;
        if (flag.reason) curr.reasons.push(flag.reason);
        if (flag.suspectedSource) curr.sources.push(flag.suspectedSource);
        if (flag.suggestion) curr.suggestions.push(flag.suggestion);
        aiSentenceVotes.set(idx, curr);
      }
    }

    // Fuse AI paraphrase flags into sentenceMatches:
    // - If already matched by OpenAlex/Crossref/DOAJ/Wikipedia, enrich it with AI paraphrase insight & suggestion!
    // - If NOT matched literally, and AI confidence >= 64%, create an integrated Multi-AI Paraphrase / Semantic source!
    let aiParaphraseSourceCreated = false;
    for (const [idx, vote] of aiSentenceVotes.entries()) {
      const sent = sentenceMatches[idx];
      if (!sent || sent.isBibliography || sent.wordCount < 6) continue;
      const avgConf = vote.confSum / vote.votes;
      if (sent.match) {
        // Enrich existing verified source match with Multi-AI suggestion
        sent.match.aiConfirmed = true;
        if (vote.suggestions[0]) sent.match.suggestion = vote.suggestions[0];
        if (vote.reasons[0] && !sent.match.reason.includes(vote.reasons[0])) {
          sent.match.reason = `${sent.match.reason} · Konsensus AI: ${vote.reasons[0]}`;
        }
      } else if (avgConf >= 64) {
        const srcTitle = vote.sources[0]
          ? `Deteksi Parafrase Semantik Multi-AI (${vote.sources[0]})`
          : 'Deteksi Parafrase & Kemiripan Semantik (Multi-AI Ensemble)';
        const srcKey = `ai-semantic-${srcTitle.toLowerCase().slice(0, 48)}`;
        if (!dedupSources.has(srcKey)) {
          dedupSources.set(srcKey, {
            key: srcKey,
            title: srcTitle,
            url: '',
            doi: '',
            category: 'internet',
            engine: `Multi-AI (${aiModelNames.slice(0, 3).join(', ')})`,
            authors: 'Analisis Semantik Terpadu',
            year: String(new Date().getFullYear()),
            content: '',
          });
          aiParaphraseSourceCreated = true;
        }
        sent.match = {
          sourceKey: srcKey,
          score: clampNum(avgConf / 100, 0.5, 0.88, 0.65),
          matchType: 'paraphrase',
          aiConfirmed: true,
          reason: vote.reasons[0] || 'Terindikasi parafrase atau kemiripan struktur gagasan oleh Multi-AI Ensemble.',
          suggestion: vote.suggestions[0] || 'Tulis ulang gagasan utama dengan struktur kalimat orisinal dan sertakan sumber rujukan.',
        };
      }
    }
    if (aiParaphraseSourceCreated) {
      sourceList.length = 0;
      sourceList.push(...dedupSources.values());
    }
  }

  // 4. Fuse AI Writing Probability (Stylometric Local + Multi-AI Consensus)
  let fusedAiWritingPct = stylometric.aiProbability;
  if (validAudits.length > 0) {
    const avgAiFromModels =
      validAudits.reduce((sum, a) => sum + clampNum(a.parsed.aiWritingScore, 0, 100, 0), 0) / validAudits.length;
    fusedAiWritingPct = Math.round(clampNum(stylometric.aiProbability * 0.45 + avgAiFromModels * 0.55, 0, 99, stylometric.aiProbability));
  }

  // 5. Build initial source registry (unfiltered) and then apply Turnitin filters to compute final metrics
  const defaultFilters = {
    excludeQuotes: Boolean(options.excludeQuotes),
    excludeBibliography: options.excludeBibliography !== false, // Turnitin default often toggles cleanly
    excludeSmallWords: clampNum(options.excludeSmallWords ?? 0, 0, 30, 0),
  };

  const baseReport = {
    submissionId: submissionId || generateSubmissionId(),
    checkedAt,
    durationMs: Math.round(durationMs),
    fileName: String(fileName || 'Naskah_Tempel_Langsung.txt'),
    fileFormat: String(fileFormat || 'TEXT').toUpperCase(),
    fileSize: Number(fileSize || cleanText.length),
    text: cleanText,
    totalWords,
    totalChars,
    totalSentences: sentences.length,
    language,
    rawSourcesByKey: Object.fromEntries(
      [...dedupSources.values()].map((s) => [
        s.key,
        {
          key: s.key,
          title: s.title,
          url: s.url,
          doi: s.doi,
          category: s.category,
          engine: s.engine,
          authors: s.authors,
          year: s.year,
        },
      ])
    ),
    sentences: sentenceMatches,
    aiAnalysis: {
      aiWritingPct: fusedAiWritingPct,
      stylometric,
      modelsUsed: aiModelNames,
      summaries: aiSummaries,
      recommendations:
        aiCombinedRecommendations.length > 0
          ? aiCombinedRecommendations
          : [
              'Gunakan parafrase berbasis pemahaman sendiri untuk kalimat yang ditandai warna merah/ungu.',
              'Pastikan setiap kutipan langsung diapit tanda petik ("...") dan mencantumkan sitasi lengkap.',
              'Periksa konsistensi antara sitasi dalam teks dan daftar pustaka di akhir dokumen.',
            ],
    },
    engineStatuses: Array.isArray(engineStatuses) ? engineStatuses : [],
    turnitinApiConnected: Boolean(turnitinResult && turnitinResult.ok),
    filters: defaultFilters,
  };

  return applyReportFilters(baseReport, defaultFilters);
}

/**
 * Dynamically applies Turnitin Exclusion Filters (Exclude Quotes, Exclude Bibliography, Exclude Small Matches)
 * and computes Turnitin-style Similarity Index, Category Breakdown, Ranked Primary Sources, & Color Assignments.
 */
export function applyReportFilters(report, nextFilters = {}) {
  const filters = {
    excludeQuotes: Boolean(nextFilters.excludeQuotes ?? report.filters?.excludeQuotes),
    excludeBibliography: Boolean(nextFilters.excludeBibliography ?? report.filters?.excludeBibliography),
    excludeSmallWords: clampNum(nextFilters.excludeSmallWords ?? report.filters?.excludeSmallWords ?? 0, 0, 30, 0),
  };

  const rawSentences = Array.isArray(report.sentences) ? report.sentences : [];
  const rawSourcesByKey = report.rawSourcesByKey || {};

  // Calculate eligible words (denominator adjusts cleanly if bibliography excluded)
  let eligibleWords = 0;
  for (const s of rawSentences) {
    if (filters.excludeBibliography && s.isBibliography) continue;
    eligibleWords += s.wordCount;
  }
  const denomWords = Math.max(1, eligibleWords || report.totalWords || 1);

  // Tally matched words per source under current filters
  const sourceWordCounts = new Map();
  const sourceSentenceIndices = new Map();

  for (const s of rawSentences) {
    if (!s.match) continue;
    if (filters.excludeBibliography && s.isBibliography) continue;
    if (filters.excludeQuotes && s.isQuote) continue;
    const key = s.match.sourceKey;
    sourceWordCounts.set(key, (sourceWordCounts.get(key) || 0) + s.wordCount);
    const list = sourceSentenceIndices.get(key) || [];
    list.push(s.index);
    sourceSentenceIndices.set(key, list);
  }

  // Filter out small sources below `excludeSmallWords`
  const qualifyingSources = [];
  for (const [key, matchedWords] of sourceWordCounts.entries()) {
    if (filters.excludeSmallWords > 0 && matchedWords < filters.excludeSmallWords) continue;
    const meta = rawSourcesByKey[key] || {
      key,
      title: 'Sumber Terdeteksi',
      url: '',
      doi: '',
      category: 'internet',
      engine: 'Integrated Engine',
      authors: '',
      year: '',
    };
    const exactPct = (matchedWords / denomWords) * 100;
    qualifyingSources.push({
      ...meta,
      matchedWords,
      exactPct,
      percent: exactPct >= 1 ? Math.round(exactPct) : (matchedWords > 0 ? 1 : 0),
      sentenceIndices: sourceSentenceIndices.get(key) || [],
    });
  }

  // Rank descending by matchedWords (Turnitin Primary Sources ordering)
  qualifyingSources.sort((a, b) => b.matchedWords - a.matchedWords || a.title.localeCompare(b.title));

  const rankedSources = qualifyingSources.map((src, i) => {
    const color = TURNITIN_SOURCE_COLORS[i % TURNITIN_SOURCE_COLORS.length];
    return {
      ...src,
      rank: i + 1,
      colorHex: color.hex,
      colorSoft: color.soft,
      colorRgb: color.rgb,
      colorBgRgb: color.bgRgb,
    };
  });

  const rankByKey = new Map(rankedSources.map((s) => [s.key, s]));

  // Annotate active sentences with their assigned rank & color
  let totalMatchedWords = 0;
  let internetWords = 0;
  let publicationWords = 0;
  let studentWords = 0;

  const annotatedSentences = rawSentences.map((s) => {
    const excludedByBib = filters.excludeBibliography && s.isBibliography;
    const excludedByQuote = filters.excludeQuotes && s.isQuote;
    const activeSource = !excludedByBib && !excludedByQuote && s.match ? rankByKey.get(s.match.sourceKey) || null : null;

    if (activeSource) {
      totalMatchedWords += s.wordCount;
      if (activeSource.category === 'publication') publicationWords += s.wordCount;
      else if (activeSource.category === 'student') studentWords += s.wordCount;
      else internetWords += s.wordCount;
    }

    return {
      ...s,
      excludedReason: excludedByBib ? 'bibliography' : excludedByQuote ? 'quote' : null,
      activeSourceRank: activeSource ? activeSource.rank : null,
      activeColorHex: activeSource ? activeSource.colorHex : null,
      activeColorSoft: activeSource ? activeSource.colorSoft : null,
    };
  });

  const similarityPct = Math.min(100, Math.round((totalMatchedWords / denomWords) * 100));
  const internetPct = Math.min(100, Math.round((internetWords / denomWords) * 100));
  const publicationsPct = Math.min(100, Math.round((publicationWords / denomWords) * 100));
  const studentPapersPct = Math.min(100, Math.round((studentWords / denomWords) * 100));
  const uniquePct = Math.max(0, 100 - similarityPct);

  let riskLevel = 'low';
  let riskLabel = 'Orisinalitas Tinggi (Aman)';
  if (similarityPct >= 45) {
    riskLevel = 'high';
    riskLabel = 'Plagiarisme Tinggi — Wajib Revisi';
  } else if (similarityPct >= 25) {
    riskLevel = 'moderate';
    riskLabel = 'Kemiripan Sedang — Perlu Parafrase';
  } else if (similarityPct >= 12) {
    riskLevel = 'guarded';
    riskLabel = 'Kemiripan Ringan — Periksa Sitasi';
  }

  return {
    ...report,
    filters,
    eligibleWords: denomWords,
    matchedWords: totalMatchedWords,
    similarityPct,
    uniquePct,
    internetPct,
    publicationsPct,
    studentPapersPct,
    riskLevel,
    riskLabel,
    primarySources: rankedSources,
    annotatedSentences,
  };
}

/**
 * Pure text extraction helpers for RTF, HTML/XML, CSV, and legacy binary `.doc` / unknown buffers.
 */
export function stripRtfToPlainText(rtf = '') {
  let s = String(rtf || '');
  // Remove header groups like fonttbl, colortbl, stylesheet, info
  s = s.replace(/\{\\\*?[a-z]+(?:[^{}]|\{[^{}]*\})*\}/gi, (m) => {
    if (/^\\?\{\\?(?:fonttbl|colortbl|stylesheet|info|pict|object|header|footer|\*)/i.test(m)) return '';
    return m;
  });
  s = s.replace(/\\par[d]?/gi, '\n').replace(/\\line/gi, '\n').replace(/\\tab/gi, ' ');
  s = s.replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  s = s.replace(/\\u(-?\d+)\??/g, (_, code) => {
    const n = Number(code);
    return String.fromCharCode(n < 0 ? n + 65536 : n);
  });
  s = s.replace(/\\[a-z]+-?\d* ?/gi, '');
  s = s.replace(/[{}]/g, '');
  return normalizePlainText(s);
}

export function stripHtmlOrXmlToPlainText(markup = '') {
  return normalizePlainText(
    String(markup || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:\/p|\/div|\/li|\/h[1-6]|\/tr|br\s*\/?)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
  );
}

export function extractReadableTextFromBinaryBytes(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (u8.length === 0) return '';
  // Try clean UTF-8 first
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(u8);
    const printableRatio = (utf8.match(/[\p{L}\p{N}\p{P}\s]/gu) || []).length / Math.max(1, utf8.length);
    if (printableRatio > 0.85 && !utf8.includes('\u0000\u0000')) {
      return normalizePlainText(utf8);
    }
  } catch {
    // Fall through
  }
  // Legacy .doc / OLE UTF-16LE + ASCII readable runs
  const runs = [];
  let asciiBuf = '';
  for (let i = 0; i < u8.length; i += 1) {
    const b = u8[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      asciiBuf += String.fromCharCode(b);
    } else {
      if (asciiBuf.trim().length >= 24 && /[a-zA-Z]{3,}\s+[a-zA-Z]{2,}/.test(asciiBuf)) {
        runs.push(asciiBuf.trim());
      }
      asciiBuf = '';
    }
  }
  if (asciiBuf.trim().length >= 24) runs.push(asciiBuf.trim());

  // Also scan UTF-16LE runs (common in MS Word .doc)
  let u16Buf = '';
  for (let i = 0; i + 1 < u8.length; i += 2) {
    const lo = u8[i];
    const hi = u8[i + 1];
    if (hi === 0 && ((lo >= 32 && lo <= 126) || lo === 10 || lo === 13)) {
      u16Buf += String.fromCharCode(lo);
    } else {
      if (u16Buf.trim().length >= 24 && /[a-zA-Z]{3,}\s+[a-zA-Z]{2,}/.test(u16Buf)) {
        runs.push(u16Buf.trim());
      }
      u16Buf = '';
    }
  }
  if (u16Buf.trim().length >= 24) runs.push(u16Buf.trim());

  const uniqueRuns = [...new Set(runs)].filter(
    (r) => !/^(?:Root Entry|WordDocument|CompObj|SummaryInformation|Microsoft Word)/i.test(r)
  );
  return normalizePlainText(uniqueRuns.join('\n\n'));
}
