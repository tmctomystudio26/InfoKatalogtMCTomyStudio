/**
 * Manifestudio Novel Hub — Pure Domain Logic (v72)
 * - Unified multi-platform novel normalizer & strict free-only (zero VIP/paywall) filter
 * - Real-time feed merger & deduplicator across 14+ sources & VIP-to-Free full mirror networks
 * - Anti-OCR/DjVu Anomaly Sanitizer (rejoins soft-hyphens `¬`, strips scanned book OCR noise, merges hard-wrapped lines)
 * - Chapter HTML sanitizer (XSS-safe prose paragraphs) & exact page-jump paginator
 * - Procedural Play Store-grade Book Cover SVG generator (fallback when offline)
 * - 0%–100% Novel Matcher (Excerpt, OCR Screenshot text, or Uploaded Novel File)
 */

export const NOVEL_GENRES = [
  { id: 'all', label: 'Semua Genre' },
  { id: 'vip-free', label: 'Eks-VIP → Gratis Full' },
  { id: 'romance', label: 'Romansa & CEO' },
  { id: 'fantasy', label: 'Fantasi & Isekai' },
  { id: 'action', label: 'Aksi & Kultivasi' },
  { id: 'horror', label: 'Horor & Misteri' },
  { id: 'teen', label: 'Remaja & Fiksi' },
  { id: 'classic', label: 'Sastra & Klasik' },
];

export const CANONICAL_NOVEL_TITLES = {
  co: 'Cultivation Online (CO)',
  og: 'Overgeared (OG)',
  lotm: 'Lord of the Mysteries',
  orv: "Omniscient Reader's Viewpoint",
  tbate: 'The Beginning After The End',
  rotssg: 'Reincarnation Of The Strongest Sword God',
  atg: 'Against the Gods (Dewa Jahat Menentang Langit)',
  mga: 'Martial God Asura',
   'dominasi kaisar 1-2000': "Emperor's Domination (Dominasi Kaisar)",
  'dominasi kaisar 2001-4000': "Emperor's Domination: Arc Pertengahan (Bab 2001–4000)",
  'dominasi kaisar 4001-6000': "Emperor's Domination: Arc Puncak (Bab 4001–6000)",
};

export function expandCanonicalNovelTitle(rawTitle = '') {
  const clean = decodeHtmlEntities(rawTitle || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'Tanpa Judul';
  const key = clean.toLowerCase();
  return CANONICAL_NOVEL_TITLES[key] || clean;
}

export function escapeNovelHtml(str = '') {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeHtmlEntities(str = '') {
  return String(str || '')
    .replace(/&#(\d+);/g, (_, num) => {
      const n = Number(num);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8212;|&mdash;/gi, '—')
    .replace(/&#8216;|&#8217;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&#8220;|&#8221;|&rdquo;|&ldquo;/gi, '"')
    .replace(/&#8230;|&hellip;/gi, '...')
    .replace(/&#039;|&apos;/gi, "'");
}

export function stripHtmlToPlain(html = '') {
  return decodeHtmlEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/**
 * Classifies any novel into one of our unified Play Store genres using title, tags, and synopsis.
 */
export function inferNovelGenre(title = '', tags = [], synopsis = '') {
  const hay = `${title} ${(Array.isArray(tags) ? tags.join(' ') : tags)} ${synopsis}`.toLowerCase();
  if (/(horor|horror|hantu|misteri|mystery|thriller|detektif|ghost|vampir|zombie|curse|kubur|pocong|kuntilanak|pembunuh)/.test(hay)) {
    return 'horror';
  }
  if (/(romansa|romance|cinta|nikah|suami|istri|ceo|miliarder|billionaire|love|wife|husband|bride|villainess|alpha|omega|hati|rindu|mantan|pengantin|sweet|presdir|pewaris)/.test(hay)) {
    return 'romance';
  }
  if (/(martial|peak|cultivation|kultivasi|wuxia|xianxia|pedang|naga|system|sistem|level|dungeon|hunter|shadow|slave|survival|tower|war|sword|emperor|god|action|aksi|seni bela diri|sect|immortal|regressor|regression)/.test(hay)) {
    return 'action';
  }
  if (/(fantasi|fantasy|isekai|magic|sihir|witch|penyihir|reincarnat|reinkarnasi|demon|iblis|dragon|elf|kingdom|kerajaan|aristocrat|knight|academy|akademi|monster|dungeon|grimoire|necromancer|summoner)/.test(hay)) {
    return 'fantasy';
  }
  if (/(klasik|classic|sastra|hikayat|balai pustaka|wikisource|gutenberg|roman|sejarah|historical|18\d\d|19[0-5]\d)/.test(hay)) {
    return 'classic';
  }
  if (/(remaja|teen|sma|sekolah|kampus|senior|junior|sahabat|slice of life|komedi|comedy|high school|dilan|milea)/.test(hay)) {
    return 'teen';
  }
  return 'fantasy';
}

export function getGenreLabel(genreId = 'fantasy') {
  const found = NOVEL_GENRES.find((g) => g.id === genreId);
  return found ? found.label : 'Fantasi & Isekai';
}

/**
 * Strict Free-Access Guard: rejects any paywalled / VIP / coin-locked story or chapter
 * so users NEVER hit a paywall mid-novel.
 */
export function isNovelFreeFullAccess(raw = {}) {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.isPaywalled === true || raw.paid === true || raw.paywalled === true || raw.isVip === true || raw.vipOnly === true) {
    return false;
  }
  if (raw.isPaywalled === 'true' || raw.paid === 'true') return false;
  if (Number(raw.coinCost || raw.coins || raw.price || 0) > 0) return false;
  return true;
}

/**
 * Wraps hotlink-protected external cover URLs with wsrv.nl fast WebP image proxy
 * so mobile browsers never fail with 403/hotlink blocks, while keeping fast CDNs direct.
 */
export function buildProxiedCoverUrl(rawUrl = '') {
  const clean = String(rawUrl || '').trim();
  if (!clean || !/^https?:\/\//i.test(clean)) return '';
  if (/^https?:\/\/(wsrv\.nl|images\.weserv\.nl|s4\.anilist\.co|covers\.openlibrary\.org|archive\.org|is[1-5]-ssl\.mzstatic\.com)/i.test(clean)) {
    return clean;
  }
  const stripped = clean.replace(/^https?:\/\//i, '');
  return `https://wsrv.nl/?url=${encodeURIComponent(stripped)}&w=360&fit=cover&output=webp`;
}

/**
 * Generates a crisp Play Store / WebNovel-grade vector 2:3 book cover data URI
 * with clear safe zones at top & bottom corners so card badges (#1, Gratis, Rating) NEVER collide.
 */
export function buildProceduralBookCover(title = 'Novel', author = 'Manifestudio', genre = 'fantasy') {
  const palettes = {
    romance: ['#881337', '#be123c', '#fda4af', '#fff1f2'],
    fantasy: ['#1e1b4b', '#4338ca', '#a5b4fc', '#eef2ff'],
    action: ['#0f172a', '#0f766e', '#5eead4', '#f0fdfa'],
    horror: ['#18080c', '#7f1d1d', '#fca5a5', '#fef2f2'],
    teen: ['#1e3a8a', '#2563eb', '#93c5fd', '#eff6ff'],
    classic: ['#3b2412', '#92400e', '#fcd34d', '#fffbeb'],
  };
  const [c1, c2, c3, c4] = palettes[genre] || palettes.fantasy;
  const cleanTitle = expandCanonicalNovelTitle(title || 'Novel Pilihan');
  const cleanAuthor = decodeHtmlEntities(author || 'Komunitas Novel').trim().slice(0, 24);

  // Word-wrap title into up to 4 crisp centered cover lines inside the middle safe zone
  const words = cleanTitle.split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur ? `${cur} ${w}` : w).length <= 15) {
      cur = cur ? `${cur} ${w}` : w;
    } else {
      if (cur) lines.push(cur);
      cur = w.slice(0, 15);
      if (lines.length >= 3) break;
    }
  }
  if (cur && lines.length < 4) lines.push(cur);
  if (lines.length === 0) lines.push('Novel Pilihan');

  const startY = Math.round(218 - ((lines.length - 1) * 28) / 2);
  const titleSvg = lines
    .map(
      (ln, idx) =>
        `<text x="150" y="${startY + idx * 30}" text-anchor="middle" fill="${c4}" font-family="Georgia,serif" font-size="22" font-weight="700">${escapeNovelHtml(ln)}</text>`
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 450" width="300" height="450">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
      <linearGradient id="sp" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#000" stop-opacity="0.32"/>
        <stop offset="100%" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect width="300" height="450" fill="url(#g)"/>
    <circle cx="240" cy="110" r="90" fill="${c3}" fill-opacity="0.14"/>
    <circle cx="65" cy="365" r="105" fill="${c3}" fill-opacity="0.10"/>
    <rect x="0" y="0" width="16" height="450" fill="url(#sp)"/>
    <rect x="24" y="84" width="252" height="276" rx="14" fill="#000000" fill-opacity="0.14" stroke="${c3}" stroke-opacity="0.32" stroke-width="1.2"/>
    <line x1="112" y1="126" x2="188" y2="126" stroke="${c3}" stroke-opacity="0.7" stroke-width="2"/>
    ${titleSvg}
    <line x1="112" y1="316" x2="188" y2="316" stroke="${c3}" stroke-opacity="0.35" stroke-width="1.2"/>
    <text x="150" y="340" text-anchor="middle" fill="${c3}" font-family="sans-serif" font-size="11.5" font-weight="600">${escapeNovelHtml(cleanAuthor)}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

/**
 * Extracts a clean series title from chapter post titles like
 * "Shadow Slave - Chapter 3068 Tainted Jade Bahasa Indonesia".
 */
export function extractSeriesTitleFromChapter(rawTitle = '') {
  const clean = decodeHtmlEntities(rawTitle)
    .replace(/\s+/g, ' ')
    .replace(/\b(bahasa indonesia|sub indo|indo)\b/gi, '')
    .trim();
  const cut = clean.split(/\s*(?:[-–—|:]\s*)?(?:\bchapter\b|\bbab\b|\bch\.?\s*\d|\bvol\.?\s*\d|\bpart\b|\bepisode\b)/i)[0];
  const base = (cut || clean).replace(/[-–—:|]+$/, '').trim();
  return expandCanonicalNovelTitle(base);
}

/**
 * Normalizes any provider's book object into a single unified Novel Hub schema.
 */
export function normalizeUnifiedNovel(raw = {}) {
  const title = expandCanonicalNovelTitle(raw.title || 'Tanpa Judul');
  const author = decodeHtmlEntities(raw.author || raw.platformLabel || 'Komunitas Penulis').trim();
  const rawSyn = stripHtmlToPlain(raw.synopsis || raw.description || '').slice(0, 620);
  const synopsis = /^(null|undefined|none|n\/a|-+)$/i.test(rawSyn.trim()) ? '' : rawSyn;
  const tags = Array.isArray(raw.tags) ? raw.tags.map((t) => decodeHtmlEntities(String(t)).trim()).filter(Boolean).slice(0, 8) : [];
  const genre = raw.genre || inferNovelGenre(title, tags, synopsis);
  const fallbackCover = buildProceduralBookCover(title, author, genre);
  const rawCover = typeof raw.cover === 'string' && /^https?:\/\//i.test(raw.cover) ? raw.cover.trim() : '';
  const cover = rawCover ? buildProxiedCoverUrl(rawCover) : fallbackCover;
  const updatedMs = raw.updatedAt ? Date.parse(raw.updatedAt) || 0 : 0;

  const sourceId = String(raw.sourceId || raw.source || 'unified');
  const sourceName = String(raw.sourceName || raw.platformLabel || 'Novel Terpadu');
  const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : raw.apiMeta && typeof raw.apiMeta === 'object' ? raw.apiMeta : {};
  const vipOriginPlatform = String(raw.vipOriginPlatform || meta.vipOriginPlatform || '').trim();
  const isVipMirror = Boolean(
    raw.isVipMirror ||
      meta.isVipMirror ||
      vipOriginPlatform ||
      /^(sakuranovel|indowebnovel|secondlife|vip-mirror|webnovel|kakaopage|goodnovel)/i.test(sourceId)
  );

  return {
    id: String(raw.id || `${sourceId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48)}`),
    source: sourceId,
    sourceId,
    sourceName,
    platformLabel: sourceName,
    vipOriginPlatform: vipOriginPlatform || (isVipMirror ? 'WebNovel / Kakaopage / GoodNovel' : ''),
    isVipMirror,
    sourceKey: String(raw.sourceKey || raw.slug || ''),
    sourceUrl: String(raw.sourceUrl || ''),
    slug: String(raw.slug || ''),
    title,
    author,
    synopsis: synopsis || 'Novel lengkap dapat dibaca gratis penuh tanpa kunci bab atau langganan.',
    cover,
    rawCover,
    fallbackCover,
    genre,
    genreLabel: getGenreLabel(genre),
    language: String(raw.language || 'ID').toUpperCase(),
    chapterCount: Math.max(1, Number(raw.chapterCount) || 1),
    latestChapterTitle: decodeHtmlEntities(raw.latestChapterTitle || '').replace(/\s+/g, ' ').trim(),
    rating: Number(raw.rating || 4.7).toFixed(1),
    reads: Number(raw.reads || 0),
    tags,
    updatedAt: raw.updatedAt || new Date().toISOString(),
    updatedMs,
    freeFullAccess: true,
    meta,
    apiMeta: meta,
  };
}

/**
 * Merges novels from all live platforms into ONE unified, deduplicated real-time catalog.
 * Interleaves sources cleanly for "trending" or sorts strictly by newest update for "latest".
 */
export function mergeUnifiedNovels(sourceBuckets = [], { sortBy = 'trending', genre = 'all' } = {}) {
  const seen = new Map();
  const interleaved = [];
  const maxLen = Math.max(0, ...sourceBuckets.map((b) => (Array.isArray(b) ? b.length : 0)));

  // Round-robin interleave so no single platform dominates the unified view!
  for (let i = 0; i < maxLen; i += 1) {
    for (const bucket of sourceBuckets) {
      if (!Array.isArray(bucket) || i >= bucket.length) continue;
      const item = bucket[i];
      if (!item || !isNovelFreeFullAccess(item)) continue;
      const norm = item.fallbackCover ? item : normalizeUnifiedNovel(item);
      const dedupKey = norm.title.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 42);
      if (!dedupKey) continue;
      const existing = seen.get(dedupKey);
      if (!existing) {
        seen.set(dedupKey, norm);
        interleaved.push(norm);
      } else if (
        norm.chapterCount > existing.chapterCount ||
        (existing.cover === existing.fallbackCover && norm.cover !== norm.fallbackCover) ||
        (!existing.vipOriginPlatform && norm.vipOriginPlatform)
      ) {
        const upgraded = {
          ...existing,
          ...norm,
          chapterCount: Math.max(norm.chapterCount, existing.chapterCount),
          reads: Math.max(norm.reads || 0, existing.reads || 0),
          cover: norm.cover !== norm.fallbackCover ? norm.cover : existing.cover,
          rawCover: norm.rawCover || existing.rawCover,
          vipOriginPlatform: norm.vipOriginPlatform || existing.vipOriginPlatform,
          isVipMirror: Boolean(norm.isVipMirror || existing.isVipMirror),
          meta: { ...(existing.meta || {}), ...(norm.meta || {}) },
          apiMeta: { ...(existing.apiMeta || {}), ...(norm.apiMeta || {}) },
        };
        const idx = interleaved.indexOf(existing);
        if (idx !== -1) interleaved[idx] = upgraded;
        seen.set(dedupKey, upgraded);
      }
    }
  }

  let list = interleaved;
  if (genre && genre !== 'all') {
    if (genre === 'vip-free') {
      list = list.filter((n) => Boolean(n.isVipMirror || n.vipOriginPlatform));
    } else {
      list = list.filter((n) => n.genre === genre);
    }
  }

  if (sortBy === 'latest') {
    return [...list].sort((a, b) => (b.updatedMs || 0) - (a.updatedMs || 0));
  }
  if (sortBy === 'chapters') {
    return [...list].sort((a, b) => (b.chapterCount || 0) - (a.chapterCount || 0));
  }
  return list;
}

const VALID_NOVEL_ABBR = /^(?:HTTPS?|ISBN|ISSN|SMA|SMK|SMP|SD|TK|PT|CV|TNI|PLN|KTP|SIM|MDP|DKI|DIY|WIB|WITA|WIT|HLM|TELP|FAKS|NO|JL|JLN|DR|IR|PROF|DRS|SH|MH|SE|MM|MPD|SPD|ST|MT|KH|HJ|NY|TN|SDR|BRL|RP|USD|BMKG|BPJS|KPK|DPR|MPR|KPU|OSIS|PMR|PRAMUKA|CEO|VIP|DNA|RNA|FBI|CIA|KGB|NPC|RPG|MMORPG|HP|MP|XP|LVL|ATK|DEF|AGI|INT|STR|OST|BAB|VOL|CH|RI|DKI)$/i;

/**
 * Detects OCR / DjVu scanner artifact lines (such as garbled cursive TOC lines,
 * symbol noise `(p/vdA`, `/972 ~2o9t>`, `S^CiA/Uaa`, `furjjf fijlftj.`, or running page numbers `15 »2`).
 */
export function isOcrGarbageLine(line = '') {
  const s = String(line || '').trim();
  if (!s) return false;
  // 1. Scanner page numbers / running markers like "13 9-2", "14 2", "15 »2", "16", ")5,"
  if (/^[)\[(]?\d{1,4}(?:\s*[»«\-~*,.)\]]+\s*\d{0,4}|\s+\d{1,3})?[,.)\]]*$/.test(s)) return true;
  // 2. Signature fake year range like ( 1972 - 2098 )
  if (/^\(\s*\d{4}\s*-\s*20[4-9]\d\s*\)$/.test(s)) return true;
  // 3. OCR noise symbols ^ ~ \ | < > » «
  if (/[\^~\\|<>»«]/.test(s)) return true;
  // 4. Leading punctuation noise like ",-A-yw", "/ 1 /S/I", "(p/vdA", "?4jPiq"
  if (/^(?:[,;\-:/\\*?]+|[(\[]?[a-zA-Z]\/)/.test(s) && !/^(?:\.{3}|-\s*[A-Za-z"“]|--)/.test(s)) return true;
  if (
    /(?:^|\s)\/[A-Za-z0-9]|\([A-Za-z]\)\/|[A-Za-z]\/[A-Za-z]{1,4}(?:\s|$)/.test(s) &&
    !/https?:\/\//i.test(s) &&
    !/\b(?:d\/a|s\/d|u\/p|a\/n|km\/jam|m\/s)\b/i.test(s)
  ) {
    return true;
  }
  // 5. Analyze tokens for OCR camelCase / vowelless gibberish / consonant clusters
  const tokens = s.split(/\s+/);
  let weirdWords = 0;
  for (const tok of tokens) {
    if (/^(?:https?:\/\/|www\.|@[A-Za-z0-9_]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/i.test(tok)) continue;
    if (/[A-Za-z0-9'][&*$#@?\\^~][A-Za-z0-9']|[0-9][$@&*][0-9A-Za-z]/.test(tok)) {
      weirdWords += 2;
      continue;
    }
    const cleanW = tok.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (!cleanW) continue;
    const lettersOnly = cleanW.replace(/[^A-Za-z]/g, '');
    if (/^[A-Za-z]+$/.test(cleanW) || (lettersOnly.length >= 4 && /[a-z][A-Z]/.test(lettersOnly))) {
      if (VALID_NOVEL_ABBR.test(cleanW)) continue;
      if (/[a-z][A-Z]/.test(lettersOnly) && !/^Mc[A-Z]/.test(lettersOnly)) {
        weirdWords += 1;
      } else if (/[jfqxzv]{2,}/i.test(cleanW)) {
        weirdWords += 1;
      } else if (
        /[bcdfghjklmnpqrstvwxyz]{5,}/i.test(cleanW) &&
        !/(?:ngstr|ngkr|nggl|nggr|ngkl|mpel|nyem|nstit|nstru|kspres|kstr)/i.test(cleanW)
      ) {
        weirdWords += 1;
      } else if (cleanW.length >= 3 && !/[aiueoyAIUEOY]/.test(cleanW)) {
        weirdWords += 1;
      } else if (
        /iii+|uuu+|jj|qq|vv|ww|xx|zz/i.test(cleanW) &&
        !/^(?:uzz|jazz|pizza|fuzzy|dizzy|buzz|puzzle|muzzle|quizz|shiite|vacuum|continuum|aww|shh|hmm|zzz)$/i.test(cleanW)
      ) {
        weirdWords += 1;
      }
    } else if (/[A-Za-z]/.test(cleanW) && /[0-9]/.test(cleanW)) {
      if (
        !/^(?:\d+(?:st|nd|rd|th|km|m|cm|mm|kg|gr|g|mg|ml|l|gb|mb|kb|tb|px|pt|pct|ribu|juta|miliar|an|x)|ke-\d+|mp3|mp4|ps[1-5]|3g|4g|5g|v\d+|a[0-9]|b[0-9]|cb\d*|19\d\d[a-z]?|20\d\d[a-z]?)$/i.test(
          cleanW
        )
      ) {
        weirdWords += 1;
      }
    }
  }
  if (weirdWords >= 2 || (weirdWords === 1 && (tokens.length <= 4 || weirdWords / Math.max(1, tokens.length) >= 0.3))) {
    return true;
  }
  // 6. TOC numbered OCR lines like "j, Moa 13", "21. foojdmuk 525"
  if (/^[0-9jIl/,.)\]]{1,4}\s+[A-Za-z'&* ]{1,25}\s+\d{1,4}[)$q]?$/.test(s)) return true;
  // 7. Short fragment line ending with isolated single consonant like "Mil r" or "3 WTH?"
  if (s.length < 15 && (/\s+[bcdfghjklmnpqrstvwxyz]$/i.test(s) || /^\d+\s+[A-Z]{2,5}\??$/.test(s))) return true;
  // 8. Very short meaningless fragment (1-4 chars)
  if (s.length <= 4 && !/^(?:Bab|Ya\.?|Tidak|Oh\.?|Ah\.?|Eh\.?|Nah|Kok|Lho|Wah|Huh|Hmm|Iya|Yuk|Ayo|Dia|Aku|Kau|Dan|Itu|Ini)$/i.test(s)) {
    return true;
  }
  return false;
}

/**
 * Cleans raw DjVu / OCR / plain-text novel content:
 * 1. Strips OCR garbage lines and scanner running page numbers
 * 2. Rejoins soft-hyphenated words (`perem¬\npuan.` -> `perempuan.`)
 * 3. Rejoins hard-wrapped physical book lines into coherent paragraphs
 */
export function cleanOcrAndDjvuText(rawText = '') {
  const normalized = String(rawText || '').replace(/\r\n/g, '\n');
  const hasSoftHyphensOrOcr = /\u00AC|[\^~\\|<>»«]|\(\s*\d{4}\s*-\s*20[4-9]\d\s*\)/.test(normalized);
  const rawLines = normalized.split('\n');
  const keptLines = [];

  for (const line of rawLines) {
    const t = line.trim();
    if (!t) {
      keptLines.push('');
      continue;
    }
    if (isOcrGarbageLine(t)) continue;
    keptLines.push(t);
  }

  let joined = keptLines.join('\n');
  // Rejoin soft hyphens (¬ / \u00AC) across line breaks (even if blank lines from stripped page numbers intervened)
  joined = joined.replace(/([A-Za-zÀ-ÿ])\s*\u00AC\s*(?:\n\s*)+([A-Za-zÀ-ÿ])/g, '$1$2');
  joined = joined.replace(/([A-Za-zÀ-ÿ])\u00AC([A-Za-zÀ-ÿ])/g, '$1$2').replace(/\u00AC/g, '');
  if (hasSoftHyphensOrOcr) {
    // Rejoin words split with a regular hyphen at the end of a physical book line when the suffix isn't a reduplication
    joined = joined.replace(/([a-z]{3,})-\s*\n\s*([a-z]{2,})\b/g, (full, p1, p2) => {
      if (p1 === p2 || p1.endsWith(p2) || p2.startsWith(p1)) return `${p1}-${p2}`;
      return `${p1}${p2}`;
    });
  }

  // If the text comes from a multi-line wrapped book (has double-newline blocks or soft hyphens),
  // join single newlines inside each paragraph block and merge blocks split across page numbers.
  const hasDoubleNewlines = /\n\s*\n/.test(joined);
  if (hasDoubleNewlines || hasSoftHyphensOrOcr) {
    const blocks = joined.split(/\n\s*\n+/);
    const rawParas = [];
    for (const b of blocks) {
      const p = b.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
      if (p.length >= 2 && !isOcrGarbageLine(p)) rawParas.push(p);
    }
    const mergedParas = [];
    for (const p of rawParas) {
      if (
        mergedParas.length > 0 &&
        !/[.!?…"”'’)\]:]$/.test(mergedParas[mergedParas.length - 1]) &&
        /^[a-z]/.test(p)
      ) {
        mergedParas[mergedParas.length - 1] += ` ${p}`;
      } else {
        mergedParas.push(p);
      }
    }
    return mergedParas.join('\n\n');
  }

  return joined;
}

/**
 * Sanitizes chapter HTML or DjVu/OCR text from any novel platform into clean, readable prose paragraphs
 * (strips scripts, ads, navigation junk, OCR symbol garbage, and rejoins soft-hyphenated words).
 */
export function sanitizeChapterToParagraphs(rawHtmlOrText = '') {
  const cleanedHtml = String(rawHtmlOrText || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<ins[\s\S]*?<\/ins>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<div[^>]*class="[^"]*(?:ads|share|related|nav|code-block|jp-relatedposts|sharedaddy|wp-post-navigation)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');

  const decoded = decodeHtmlEntities(cleanedHtml);
  const ocrCleaned = cleanOcrAndDjvuText(decoded);

  const rawParas = ocrCleaned
    .split(/\n{2,}|\r?\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => {
      if (!p || p.length < 2) return false;
      if (isOcrGarbageLine(p)) return false;
      if (/^(prev(ious)?\s*chapter|next\s*chapter|bab sebelumnya|bab selanjutnya|table of contents|daftar isi|share this|like loading|comment|tinggalkan balasan|baca juga|iklan|advertisement)$/i.test(p)) {
        return false;
      }
      if (/^(?:baca novel terbaru|read latest chapters|kunjungi situs kami|dukung translator|donasi saweria|jangan lupa bookmark)\b/i.test(p) && p.length < 160) {
        return false;
      }
      if (/^(https?:\/\/|www\.)/i.test(p) && p.length < 140) return false;
      return true;
    });

  return rawParas;
}

/**
 * Splits a chapter's prose paragraphs into discrete reading pages for Page-Jump ("Loncat Halaman") mode.
 */
export function paginateChapterParagraphs(paragraphs = [], targetCharsPerPage = 1350) {
  const list = Array.isArray(paragraphs) ? paragraphs.filter(Boolean) : [];
  if (list.length === 0) return [{ pageNumber: 1, paragraphs: [], startParaIndex: 0 }];

  const cap = Math.max(500, Math.min(3200, Number(targetCharsPerPage) || 1350));
  const pages = [];
  let current = [];
  let charCount = 0;
  let startIdx = 0;

  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    if (current.length > 0 && charCount + p.length > cap) {
      pages.push({ pageNumber: pages.length + 1, paragraphs: current, startParaIndex: startIdx });
      current = [];
      charCount = 0;
      startIdx = i;
    }
    current.push(p);
    charCount += p.length + 40;
  }

  if (current.length > 0) {
    pages.push({ pageNumber: pages.length + 1, paragraphs: current, startParaIndex: startIdx });
  }
  return pages;
}

// ==================== EXCERPT / OCR / FILE NOVEL MATCHER (UP TO 100%) ====================
const MATCH_STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk', 'pada', 'adalah', 'sebagai', 'dalam',
  'tidak', 'akan', 'juga', 'atau', 'oleh', 'karena', 'bahwa', 'saat', 'sudah', 'telah', 'bisa', 'dapat',
  'saya', 'aku', 'kamu', 'dia', 'mereka', 'kita', 'kami', 'nya', 'ada', 'jika', 'tapi', 'namun', 'hanya',
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'was', 'were', 'are', 'not', 'but', 'she',
  'him', 'her', 'his', 'they', 'their', 'into', 'when', 'what', 'there', 'about', 'would', 'could',
]);

export function tokenizeForNovelMatch(text = '') {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

/**
 * Extracts high-signal search queries from a pasted novel excerpt, OCR screenshot, or uploaded novel file.
 */
export function extractNovelSearchQueries(excerpt = '') {
  const clean = String(excerpt || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];

  const queries = [];
  // 1. Check for explicit title-like first line (short line before newline)
  const firstLine = String(excerpt || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length >= 4 && l.length <= 72);
  if (firstLine && firstLine.split(/\s+/).length <= 10) {
    queries.push(firstLine.replace(/^(bab|chapter|judul|title)\s*\d*\s*[:\-–]?\s*/i, '').trim());
  }

  // 2. Distinctive long words / proper nouns (character names, unique terms)
  const tokens = tokenizeForNovelMatch(clean).filter((w) => w.length >= 4 && !MATCH_STOPWORDS.has(w));
  const freq = new Map();
  for (const w of tokens) freq.set(w, (freq.get(w) || 0) + 1);

  const rankedWords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([w]) => w);

  if (rankedWords.length >= 2) {
    queries.push(rankedWords.slice(0, 4).join(' '));
  }
  if (rankedWords.length >= 5) {
    queries.push(rankedWords.slice(2, 6).join(' '));
  }

  // 3. Exact 5-word phrase probe from middle of excerpt
  const allWords = tokenizeForNovelMatch(clean);
  if (allWords.length >= 5) {
    const mid = Math.max(0, Math.floor(allWords.length / 3));
    queries.push(allWords.slice(mid, mid + 5).join(' '));
  }

  return [...new Set(queries.map((q) => q.trim()).filter((q) => q.length >= 3))].slice(0, 4);
}

/**
 * Computes 0–100% similarity between user's excerpt/OCR/file text and a candidate novel's title + synopsis + chapter text.
 * Returns exact 100% when the excerpt appears verbatim (or near-verbatim) in the candidate text!
 */
export function scoreNovelExcerptMatch(queryText = '', candidateText = '', candidateTitle = '') {
  const qNorm = tokenizeForNovelMatch(queryText).join(' ');
  const cNorm = tokenizeForNovelMatch(`${candidateTitle} ${candidateText}`).join(' ');
  const tNorm = tokenizeForNovelMatch(candidateTitle).join(' ');
  if (!qNorm || !cNorm) return { scorePct: 0, reason: 'Tidak ada teks pembanding', matchReason: 'Tidak ada teks pembanding' };

  // 1. Direct verbatim substring match (exact quote or title match -> 100%)
  if (qNorm.length >= 16 && cNorm.includes(qNorm)) {
    const msg = 'Cocok 100% — kutipan naskah ditemukan persis di dalam novel!';
    return { scorePct: 100, reason: msg, matchReason: msg };
  }
  if (tNorm.length >= 5 && (qNorm === tNorm || qNorm.includes(tNorm) || tNorm.includes(qNorm))) {
    const ratio = Math.min(qNorm.length, tNorm.length) / Math.max(qNorm.length, tNorm.length);
    if (ratio >= 0.72) {
      const msg = 'Cocok 100% — judul novel cocok persis!';
      return { scorePct: 100, reason: msg, matchReason: msg };
    }
  }

  // 2. Word n-gram containment ratio
  const qWords = qNorm.split(' ');
  const cWords = cNorm.split(' ');
  const nSize = qWords.length >= 6 ? 3 : 2;
  const makeGrams = (arr, n) => {
    const set = new Set();
    for (let i = 0; i + n <= arr.length; i += 1) {
      set.add(arr.slice(i, i + n).join(' '));
    }
    return set;
  };
  const qGrams = makeGrams(qWords, nSize);
  const cGrams = makeGrams(cWords, nSize);
  let gramHits = 0;
  for (const g of qGrams) {
    if (cGrams.has(g)) gramHits += 1;
  }
  const gramContainment = qGrams.size > 0 ? gramHits / qGrams.size : 0;

  // 3. Distinctive keyword containment (robust against OCR typos via prefix + char-trigram fuzzy match)
  const makeCharTrigrams = (str) => {
    const s = str.replace(/\s+/g, ' ').trim();
    const out = new Set();
    for (let i = 0; i + 3 <= s.length; i += 1) out.add(s.slice(i, i + 3));
    return out;
  };

  const qDistinct = [...new Set(qWords.filter((w) => w.length >= 4 && !MATCH_STOPWORDS.has(w)))];
  const cWordSet = new Set(cWords);
  let kwHits = 0;
  for (const kw of qDistinct) {
    if (cWordSet.has(kw)) {
      kwHits += 1;
    } else if (kw.length >= 5) {
      const kwTri = makeCharTrigrams(kw);
      let bestSim = 0;
      for (const cw of cWordSet) {
        if (Math.abs(cw.length - kw.length) > 2) continue;
        if (cw.slice(0, 3) !== kw.slice(0, 3) && cw.slice(-3) !== kw.slice(-3)) continue;
        const cwTri = makeCharTrigrams(cw);
        let shared = 0;
        for (const t of kwTri) {
          if (cwTri.has(t)) shared += 1;
        }
        const sim = kwTri.size > 0 ? shared / Math.max(kwTri.size, cwTri.size) : 0;
        if (sim > bestSim) bestSim = sim;
      }
      if (bestSim >= 0.45) kwHits += Math.min(0.95, bestSim + 0.2);
    }
  }
  const kwContainment = qDistinct.length > 0 ? kwHits / qDistinct.length : 0;

  // 4. Whole-phrase character 3-gram containment (handles noisy OCR screenshots smoothly!)
  const qCharTri = makeCharTrigrams(qNorm);
  const cCharTri = makeCharTrigrams(cNorm);
  let charHits = 0;
  for (const t of qCharTri) {
    if (cCharTri.has(t)) charHits += 1;
  }
  const charContainment = qCharTri.size > 0 ? charHits / qCharTri.size : 0;

  // Weighted fusion scaled to 0..100%
  const wordFusion = gramContainment * 0.55 + kwContainment * 0.45;
  const ocrFusion = charContainment * 0.55 + kwContainment * 0.45;
  let rawScore = Math.max(wordFusion, kwContainment >= 0.45 ? ocrFusion : wordFusion);
  if (gramContainment >= 0.88) rawScore = Math.max(rawScore, 0.96 + (gramContainment - 0.88) * 0.33);
  const scorePct = Math.max(0, Math.min(100, Math.round(rawScore * 100)));

  let matchReason = 'Kemiripan kata kunci & topik';
  if (scorePct >= 95) matchReason = 'Kecocokan sangat akurat (frasa naskah & nama tokoh identik)';
  else if (scorePct >= 70) matchReason = 'Kecocokan tinggi pada alur kalimat & kata kunci utama';
  else if (scorePct >= 45) matchReason = 'Kecocokan sebagian frasa & karakter cerita';

  return { scorePct, reason: matchReason, matchReason };
}

export function formatReadsCompact(n = 0) {
  const num = Number(n) || 0;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)} Jt`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)} Rb`;
  return num > 0 ? String(num) : 'Baru';
}

export function formatRelativeUpdate(iso = '') {
  const ts = Date.parse(iso || '');
  if (!Number.isFinite(ts) || ts <= 0) return 'Update Live';
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;
  try {
    return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return 'Baru';
  }
}
