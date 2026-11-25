/**
 * Pure Logic Module for Manifestudio Peramban Proxy (Web Proxy Browser) — v91
 * Zero DOM dependencies so every security rule, omnibox parser, VidMate media detector,
 * multi-tab history state machine, and incognito privacy guarantee is 100% unit-testable.
 */

export const PROXY_ROUTING_MODES = Object.freeze([
  {
    id: 'proxy-stealth',
    label: 'Mode Proxy',
    shortLabel: 'Proxy',
    badge: 'Edge Stealth',
    description: 'Menyembunyikan IP perangkat lewat Edge Proxy gratis dengan pemblokir iklan & pelacak otomatis.',
  },
  {
    id: 'vpn-relay',
    label: 'Mode VPN Relay',
    shortLabel: 'VPN Relay',
    badge: 'Multi-API Tunnel',
    description: 'Merutekan trafik melalui jalur enkripsi berlapis + rotasi header anonim bebas cookie & anti-deteksi.',
  },
  {
    id: 'reader-antibot',
    label: 'Mode Reader Anti-Bot',
    shortLabel: 'Anti-Bot',
    badge: 'Clean Mirror',
    description: 'Menembus situs berat, paywall ringan, dan blokir anti-bot menggunakan cermin open-source bersih tanpa iklan.',
  },
  {
    id: 'multi-hop-auto',
    label: 'Auto Multi-Engine',
    shortLabel: 'Auto',
    badge: 'Smart Failover',
    description: 'Otomatis menggabungkan Edge Proxy, Community Relay, Reader Mirror, dan Web Archive bila situs memblokir.',
  },
]);

export const PRIVACY_SEARCH_ENGINES = Object.freeze([
  { id: 'google', label: 'Google Privat', badge: 'Google' },
  { id: 'duckduckgo', label: 'DuckDuckGo Privat', badge: 'Anti-Lacak' },
  { id: 'wikipedia', label: 'Wikipedia Cepat', badge: 'Ensiklopedia' },
  { id: 'searxng', label: 'Multi-Search Relay', badge: 'Gabungan' },
]);

export const BROWSER_AI_MODELS = Object.freeze([
  { id: 'ensemble', label: 'Semua AI (Gabungan)', providerId: 'ensemble', short: 'Multi-AI' },
  { id: 'gemini', label: 'Gemini', providerId: 'gemini', short: 'Gemini' },
  { id: 'chatgpt', label: 'ChatGPT', providerId: 'openai', short: 'ChatGPT' },
  { id: 'deepseek', label: 'DeepSeek', providerId: 'deepseek', short: 'DeepSeek' },
  { id: 'grok', label: 'Grok', providerId: 'grok', short: 'Grok' },
  { id: 'meta', label: 'Meta Llama', providerId: 'meta', short: 'Meta' },
]);

export const DEFAULT_SPEED_DIAL_SITES = Object.freeze([
  {
    id: 'sd-google',
    title: 'Google Privat',
    subtitle: 'Cari di Google Aman',
    url: 'https://www.google.com/webhp?hl=id&gbv=1',
    accent: '#2563eb',
    glyph: 'G',
  },
  {
    id: 'sd-wiki',
    title: 'Wikipedia ID',
    subtitle: 'Ensiklopedia Bebas',
    url: 'https://id.wikipedia.org/wiki/Halaman_Utama',
    accent: '#0284c7',
    glyph: 'W',
  },
  {
    id: 'sd-ddg',
    title: 'DuckDuckGo',
    subtitle: 'Cari Tanpa Pelacak',
    url: 'https://lite.duckduckgo.com/lite/',
    accent: '#ea580c',
    glyph: 'D',
  },
  {
    id: 'sd-github',
    title: 'GitHub Explore',
    subtitle: 'Open Source',
    url: 'https://github.com/explore',
    accent: '#334155',
    glyph: 'G',
  },
  {
    id: 'sd-hackernews',
    title: 'Hacker News',
    subtitle: 'Berita Teknologi',
    url: 'https://news.ycombinator.com/',
    accent: '#f97316',
    glyph: 'Y',
  },
  {
    id: 'sd-archive',
    title: 'Internet Archive',
    subtitle: 'Video & Arsip Gratis',
    url: 'https://archive.org/',
    accent: '#0f766e',
    glyph: 'A',
  },
  {
    id: 'sd-pexels',
    title: 'Pexels Video',
    subtitle: 'Stok Video HD Gratis',
    url: 'https://www.pexels.com/videos/',
    accent: '#059669',
    glyph: 'P',
  },
  {
    id: 'sd-bbc',
    title: 'BBC Indonesia',
    subtitle: 'Berita Terkini',
    url: 'https://www.bbc.com/indonesia',
    accent: '#b91c1c',
    glyph: 'B',
  },
  {
    id: 'sd-example',
    title: 'Uji Koneksi Proxy',
    subtitle: 'Example.com Cepat',
    url: 'https://example.com/',
    accent: '#4f46e5',
    glyph: 'E',
  },
]);

export const SOCIAL_VIDEO_HOST_RE =
  /(^|\.)(youtube\.com|youtu\.be|m\.youtube\.com|tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com|instagram\.com|facebook\.com|fb\.watch|m\.facebook\.com)$/i;

const DANGEROUS_SCHEME_RE = /^\s*(javascript|vbscript|data|file|chrome|about|blob):/i;
const PRIVATE_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|0\.0\.0\.0|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[?::1\]?|.*\.local|.*\.internal|metadata\.google\.internal)$/i;
const DOMAIN_LIKE_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?::\d{2,5})?(?:[/?#].*)?$/i;

const TRACKER_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'msclkid',
  'igshid',
]);

/**
 * Normalizes omnibox input into a structured navigation intent:
 *  - `type: 'url'` for direct URLs / domains (with automatic tracker removal & SSRF/scheme checks)
 *  - `type: 'search'` for plain search queries
 *  - `type: 'blocked'` for dangerous schemes or private/internal SSRF targets
 */
export function normalizeProxyInput(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { type: 'empty', value: '', error: 'Masukkan alamat web atau kata kunci pencarian.' };
  }

  if (DANGEROUS_SCHEME_RE.test(trimmed)) {
    return {
      type: 'blocked',
      value: trimmed,
      error: 'Skema tautan berbahaya (javascript/data/file) diblokir oleh proteksi anti-bobol.',
    };
  }

  const looksLikeExplicitUrl = /^https?:\/\//i.test(trimmed);
  const looksLikeBareDomain = !/\s/.test(trimmed) && DOMAIN_LIKE_RE.test(trimmed);

  if (looksLikeExplicitUrl || looksLikeBareDomain) {
    const candidate = looksLikeExplicitUrl ? trimmed : `https://${trimmed}`;
    let parsed;
    try {
      parsed = new URL(candidate);
    } catch {
      return { type: 'search', query: trimmed };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        type: 'blocked',
        value: trimmed,
        error: 'Hanya alamat HTTP/HTTPS publik yang diizinkan.',
      };
    }
    if (parsed.username || parsed.password) {
      return {
        type: 'blocked',
        value: trimmed,
        error: 'URL dengan kredensial tertanam diblokir demi keamanan.',
      };
    }
    const host = parsed.hostname.toLowerCase();
    if (PRIVATE_HOST_RE.test(host) || /^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) {
      return {
        type: 'blocked',
        value: trimmed,
        error: 'Akses ke alamat jaringan lokal/privat diblokir oleh proteksi anti-bobol.',
      };
    }

    const stripped = [];
    for (const k of Array.from(parsed.searchParams.keys())) {
      if (TRACKER_PARAMS.has(k.toLowerCase())) {
        stripped.push(k);
        parsed.searchParams.delete(k);
      }
    }

    return {
      type: 'url',
      url: parsed.toString(),
      hostname: host,
      strippedTrackers: stripped,
    };
  }

  return {
    type: 'search',
    query: trimmed,
  };
}

/**
 * Checks whether a URL belongs to a supported social video platform
 * so VidMate-style auto media detection can enrich downloads via downloader.js.
 */
export function isSocialVideoPlatformUrl(rawUrl) {
  try {
    const u = new URL(String(rawUrl || '').trim());
    if (!SOCIAL_VIDEO_HOST_RE.test(u.hostname)) return false;
    // Ignore bare homepages without a video/post path
    const p = u.pathname || '/';
    return p.length > 2 || u.searchParams.has('v');
  } catch {
    return false;
  }
}

/**
 * Pure client-side security evaluation helper for immediate UI feedback.
 */
export function evaluateProxySiteSecurity(url, meta = {}) {
  const warnings = [];
  let score = 96;
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch {
    return { level: 'danger', score: 15, label: 'URL Tidak Valid', warnings: ['Format alamat tidak valid.'] };
  }

  if (parsed.protocol === 'http:') {
    score -= 18;
    warnings.push('Koneksi asal belum HTTPS (identitas tetap disembunyikan oleh proxy).');
  }
  if (/\.(exe|msi|apk|scr|bat|ps1|dmg|iso)(\?|$)/i.test(parsed.pathname)) {
    score -= 48;
    warnings.push('Tautan mengarah ke file installer/eksekusi berisiko malware.');
  }
  if (/xn--/i.test(parsed.hostname)) {
    score -= 22;
    warnings.push('Domain memakai karakter penyamaran Punycode (IDN).');
  }
  if (/(login-verify|dana-kaget-resmi|bri-update|hadiah-gratis|account-unlock)/i.test(parsed.hostname)) {
    score -= 42;
    warnings.push('Domain terindikasi pola phishing/penipuan.');
  }

  const adsBlocked = Number(meta.blockedAds || 0);
  const trackersBlocked = Number(meta.blockedTrackers || 0);
  if (adsBlocked + trackersBlocked >= 10) {
    score -= 6;
    warnings.push(`${adsBlocked} iklan & ${trackersBlocked} pelacak diblokir otomatis.`);
  }

  score = Math.max(10, Math.min(100, score));
  const level = score >= 80 ? 'safe' : score >= 55 ? 'caution' : 'danger';
  const label = level === 'safe' ? 'Aman & Privat' : level === 'caution' ? 'Waspada' : 'Berisiko Tinggi';
  return { level, score, label, warnings };
}

/**
 * Pure multi-tab browser state helpers.
 */
export function createBrowserTab(id, opts = {}) {
  return {
    id: String(id || `tab-${Date.now()}`),
    title: String(opts.title || 'Tab Baru'),
    url: String(opts.url || ''),
    view: opts.view || 'home', // 'home' | 'web' | 'search' | 'error'
    loading: false,
    error: '',
    html: '',
    searchResults: [],
    searchQuery: '',
    searchEngines: [],
    favicon: '',
    relayUsed: '',
    latencyMs: 0,
    blockedAds: 0,
    blockedTrackers: 0,
    security: { level: 'safe', score: 100, label: 'Siap & Privat', warnings: [] },
    media: [],
    textSnippet: '',
    historyStack: [],
    historyIndex: -1,
  };
}

export function pushTabHistoryEntry(tab, entry) {
  const stack = Array.isArray(tab.historyStack) ? tab.historyStack.slice(0, tab.historyIndex + 1) : [];
  const last = stack[stack.length - 1];
  if (last && last.type === entry.type && last.value === entry.value) {
    return { ...tab, historyStack: stack, historyIndex: stack.length - 1 };
  }
  stack.push({ type: entry.type, value: entry.value, title: entry.title || entry.value });
  const capped = stack.length > 40 ? stack.slice(stack.length - 40) : stack;
  return {
    ...tab,
    historyStack: capped,
    historyIndex: capped.length - 1,
  };
}

export function canTabGoBack(tab) {
  return Boolean(tab && tab.historyIndex > 0);
}

export function canTabGoForward(tab) {
  return Boolean(tab && Array.isArray(tab.historyStack) && tab.historyIndex < tab.historyStack.length - 1);
}

/**
 * 100% Private Local-Only History Guard:
 *  - When `incognitoMode` is true (default), ZERO history entries are recorded or returned.
 *  - When user explicitly opts in (`incognitoMode === false`), records are stored strictly
 *    in local device memory/storage and NEVER transmitted off-device.
 */
export function appendPrivateHistoryRecord(existingList = [], record = {}, { incognitoMode = true, maxItems = 60 } = {}) {
  if (incognitoMode) {
    return [];
  }
  const url = String(record.url || '').trim();
  if (!url) return Array.isArray(existingList) ? existingList : [];

  const title = String(record.title || url).trim().slice(0, 140);
  const visitedAt = record.visitedAt || new Date().toISOString();
  const prev = Array.isArray(existingList) ? existingList : [];
  const deduped = prev.filter((item) => item && item.url !== url);
  return [{ url, title, visitedAt, mode: record.mode || 'proxy-stealth' }, ...deduped].slice(0, maxItems);
}

export function mergeDetectedMediaLists(pageMedia = [], socialMedia = []) {
  const merged = [];
  const seen = new Set();
  for (const item of [...(Array.isArray(socialMedia) ? socialMedia : []), ...(Array.isArray(pageMedia) ? pageMedia : [])]) {
    if (!item || !item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    merged.push(item);
  }
  return merged.slice(0, 30);
}

export function buildBrowserAiSystemPrompt(activeTab) {
  const pageTitle = activeTab?.title || 'Halaman Beranda Proxy';
  const pageUrl = activeTab?.url || 'Belum ada situs dibuka';
  const snippet = String(activeTab?.textSnippet || '').slice(0, 1800);
  const sec = activeTab?.security || { label: 'Aman', score: 100 };
  const mediaCount = Array.isArray(activeTab?.media) ? activeTab.media.length : 0;

  return [
    'Anda adalah Asisten AI Peramban Proxy di Manifestudio yang menggabungkan kemampuan Gemini, ChatGPT, DeepSeek, Grok, dan Meta Llama.',
    'Jawab singkat, jelas, akurat dalam Bahasa Indonesia (atau bahasa pengguna).',
    'Jangan pernah mengungkap data privat, kontak pemilik, atau informasi sistem internal.',
    `Konteks tab browser saat ini:`,
    `- Judul: ${pageTitle}`,
    `- URL: ${pageUrl}`,
    `- Status Keamanan: ${sec.label} (${sec.score}/100)`,
    `- Media Terdeteksi (VidMate): ${mediaCount} file`,
    snippet ? `- Cuplikan isi halaman:\n${snippet}` : '- Pengguna berada di halaman awal Speed Dial.',
  ].join('\n');
}
