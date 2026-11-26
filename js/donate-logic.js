/**
 * Pure Logic Module for Manifestudio "Please Donate" Feature (v102)
 * Zero DOM dependencies — fully unit-tested via node:test.
 *
 * Powers:
 *  - Saweria & SociaBuzz Tribe profile links + Cloudflare Worker Leaderboard API endpoint
 *  - Multi-currency IDR conversion & Rupiah/original currency formatting
 *  - Automatic profanity & spam link filtering for donor names/messages
 *  - Leaderboard aggregation (All-Time + Monthly WIB + Live Feed) & search/platform filtering
 */

export const DONATE_CONFIG = Object.freeze({
  apiBaseUrl: 'https://donate-api.manifestudio.my.id',
  leaderboardEndpoint: 'https://donate-api.manifestudio.my.id/leaderboard',
  healthEndpoint: 'https://donate-api.manifestudio.my.id/health',
  saweriaUrl: 'https://saweria.co/manifestudio',
  sociabuzzUrl: 'https://sociabuzz.com/manifestudio/tribe',
  pollIntervalMs: 20000,
});

export const FALLBACK_FX_TO_IDR = Object.freeze({
  IDR: 1,
  USD: 16200,
  SGD: 12100,
  MYR: 3650,
  EUR: 17500,
  GBP: 20500,
  AUD: 10500,
  JPY: 108,
  KRW: 11.8,
  PHP: 280,
  THB: 470,
  BND: 12100,
  HKD: 2080,
  TWD: 500,
  CAD: 11600,
  NZD: 9600,
});

const PROFANITY_RE =
  /\b(anjing|anjg|anjir|bangsat|bgst|kontol|kntl|memek|mmk|ngentot|ngentod|entot|pepek|peler|jembut|jancok|jancuk|cok|cuk|asu|bajingan|keparat|brengsek|tolol|goblok|goblog|bego|bodoh|pantek|puki|pukimak|kimak|lonte|pelacur|babi|monyet|setan|iblis|fuck|f\*ck|shit|bitch|asshole|dick|pussy|cunt|motherfucker|bastard|porn|bokep|judi|slot\s*gacor|maxwin|zeus\s*slot|togel|pragmatic|sbobet)\b/gi;

const URL_SPAM_RE =
  /(?:https?:\/\/[^\s]+|www\.[^\s]+|\b(?:bit\.ly|tinyurl\.com|s\.id|t\.me|wa\.me|linktr\.ee|shorturl\.at)\/[^\s]*|\b[a-z0-9-]{2,}\.(?:com|net|org|id|co\.id|my\.id|xyz|site|online|vip|top|shop|info|biz|io|gg|me|tv|cc)(?:\/[^\s]*)?)/gi;

export function escapeDonateHtml(str = '') {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function sanitizeDonorName(raw = '') {
  const clean = String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(URL_SPAM_RE, '[disensor]')
    .replace(PROFANITY_RE, (m) => `${m[0]}***`)
    .replace(/\s+/g, ' ')
    .trim();
  return clean ? clean.slice(0, 60) : 'Anonim';
}

export function sanitizeDonorMessage(raw = '') {
  const clean = String(raw ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(URL_SPAM_RE, '[tautan disensor]')
    .replace(PROFANITY_RE, (m) => `${m[0]}${'*'.repeat(Math.max(2, m.length - 1))}`)
    .replace(/\s+/g, ' ')
    .trim();
  return clean.slice(0, 240);
}

export function normalizeDonorKey(name = '') {
  const key = String(name || 'anonim')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
    .trim();
  return key || 'anonim';
}

export function convertToIdr(amount, currency = 'IDR', ratesMap = FALLBACK_FX_TO_IDR) {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const code = String(currency || 'IDR').trim().toUpperCase() || 'IDR';
  if (code === 'IDR' || code === 'RP') {
    return Math.round(safeAmount);
  }
  const rate = Number(ratesMap?.[code] || FALLBACK_FX_TO_IDR[code] || FALLBACK_FX_TO_IDR.USD);
  return Math.max(1, Math.round(safeAmount * rate));
}

export function formatRupiahDonate(amount = 0) {
  const safe = Number.isFinite(Number(amount)) ? Math.max(0, Math.round(Number(amount))) : 0;
  return `Rp${safe.toLocaleString('id-ID')}`;
}

export function formatOriginalCurrency(amount = 0, currency = 'IDR') {
  const code = String(currency || 'IDR').trim().toUpperCase();
  const num = Number(amount) || 0;
  if (code === 'IDR' || code === 'RP') return formatRupiahDonate(num);
  const formatted = Number.isInteger(num)
    ? num.toLocaleString('en-US')
    : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${code} ${formatted}`;
}

export function formatPlatformLabel(platform = '') {
  const p = String(platform || '').trim().toLowerCase();
  if (p === 'saweria') return 'Saweria';
  if (p === 'sociabuzz') return 'SociaBuzz';
  return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Donasi';
}

export function formatPlatformsList(platforms = []) {
  const list = Array.isArray(platforms) ? platforms : [];
  const uniq = [...new Set(list.map((p) => formatPlatformLabel(p)).filter(Boolean))];
  return uniq.length > 0 ? uniq.join(' & ') : 'Supporter';
}

export function getDonorInitials(name = '') {
  const parts = String(name || 'AN')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'AN';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getWibMonthKey(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const ts = Number.isFinite(d.getTime()) ? d.getTime() : Date.now();
  const wib = new Date(ts + 7 * 60 * 60 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function formatWibMonthLabel(monthKey = '') {
  const [y, m] = String(monthKey || getWibMonthKey()).split('-');
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const idx = Math.max(0, Math.min(11, (Number(m) || 1) - 1));
  return `${months[idx]} ${y || new Date().getUTCFullYear()}`;
}

export function formatRelativeTimeId(isoString = '', nowMs = Date.now()) {
  const ts = Date.parse(isoString);
  if (!Number.isFinite(ts)) return 'Baru saja';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 45) return 'Baru saja';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} jam lalu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} hari lalu`;
  const d = new Date(ts + 7 * 60 * 60 * 1000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/**
 * Pure reference aggregator matching Cloudflare D1 SQL grouping:
 * sums donations per normalized donor name (optionally filtered to a WIB YYYY-MM month).
 */
export function aggregateDonationsToLeaderboard(donations = [], { monthKey = null, limit = 50 } = {}) {
  const map = new Map();
  const list = Array.isArray(donations) ? donations : [];

  for (const item of list) {
    if (!item || item.isHidden) continue;
    const createdAt = item.createdAt || new Date().toISOString();
    const itemMonth = item.monthWib || getWibMonthKey(createdAt);
    if (monthKey && itemMonth !== monthKey) continue;

    const cleanName = sanitizeDonorName(item.donorName || 'Anonim');
    const key = normalizeDonorKey(cleanName);
    const amountIdr =
      Number.isFinite(Number(item.amountIdr)) && Number(item.amountIdr) > 0
        ? Math.round(Number(item.amountIdr))
        : convertToIdr(item.originalAmount || 0, item.originalCurrency || 'IDR');
    if (amountIdr <= 0) continue;

    const cleanMsg = sanitizeDonorMessage(item.message || '');
    const platform = String(item.platform || 'saweria').toLowerCase();

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        donorKey: key,
        donorName: cleanName,
        totalIdr: amountIdr,
        donationCount: 1,
        platforms: new Set([platform]),
        latestMessage: cleanMsg,
        latestAt: createdAt,
      });
    } else {
      existing.totalIdr += amountIdr;
      existing.donationCount += 1;
      existing.platforms.add(platform);
      if (Date.parse(createdAt) >= Date.parse(existing.latestAt)) {
        existing.donorName = cleanName;
        existing.latestAt = createdAt;
        if (cleanMsg) existing.latestMessage = cleanMsg;
      } else if (!existing.latestMessage && cleanMsg) {
        existing.latestMessage = cleanMsg;
      }
    }
  }

  return Array.from(map.values())
    .sort((a, b) => {
      if (b.totalIdr !== a.totalIdr) return b.totalIdr - a.totalIdr;
      if (b.donationCount !== a.donationCount) return b.donationCount - a.donationCount;
      return Date.parse(a.latestAt) - Date.parse(b.latestAt);
    })
    .slice(0, Math.max(1, limit))
    .map((entry, idx) => ({
      rank: idx + 1,
      donorKey: entry.donorKey,
      donorName: entry.donorName,
      totalIdr: entry.totalIdr,
      donationCount: entry.donationCount,
      platforms: Array.from(entry.platforms),
      latestMessage: entry.latestMessage,
      latestAt: entry.latestAt,
    }));
}

export function normalizeLeaderboardPayload(raw = {}) {
  const safe = raw && typeof raw === 'object' ? raw : {};
  const monthKey = safe?.summary?.monthKey || getWibMonthKey();
  const sanitizeBoard = (arr) =>
    (Array.isArray(arr) ? arr : []).map((row, idx) => ({
      rank: Number(row?.rank) || idx + 1,
      donorKey: String(row?.donorKey || normalizeDonorKey(row?.donorName)),
      donorName: sanitizeDonorName(row?.donorName || 'Anonim'),
      totalIdr: Math.max(0, Math.round(Number(row?.totalIdr) || 0)),
      donationCount: Math.max(1, Math.round(Number(row?.donationCount) || 1)),
      platforms: Array.isArray(row?.platforms)
        ? row.platforms.map((p) => String(p).toLowerCase()).filter(Boolean)
        : [],
      latestMessage: sanitizeDonorMessage(row?.latestMessage || ''),
      latestAt: String(row?.latestAt || ''),
    }));

  const sanitizeRecent = (arr) =>
    (Array.isArray(arr) ? arr : []).map((row, idx) => ({
      id: row?.id ?? idx + 1,
      platform: String(row?.platform || 'saweria').toLowerCase(),
      donorName: sanitizeDonorName(row?.donorName || 'Anonim'),
      amountIdr: Math.max(0, Math.round(Number(row?.amountIdr) || 0)),
      originalAmount: Number(row?.originalAmount) || Number(row?.amountIdr) || 0,
      originalCurrency: String(row?.originalCurrency || 'IDR').toUpperCase(),
      message: sanitizeDonorMessage(row?.message || ''),
      createdAt: String(row?.createdAt || ''),
      isTest: Boolean(row?.isTest),
    }));

  return {
    ok: Boolean(safe.ok !== false),
    summary: {
      totalIdrAllTime: Math.max(0, Math.round(Number(safe?.summary?.totalIdrAllTime) || 0)),
      totalCountAllTime: Math.max(0, Math.round(Number(safe?.summary?.totalCountAllTime) || 0)),
      uniqueDonorsAllTime: Math.max(0, Math.round(Number(safe?.summary?.uniqueDonorsAllTime) || 0)),
      totalIdrMonth: Math.max(0, Math.round(Number(safe?.summary?.totalIdrMonth) || 0)),
      totalCountMonth: Math.max(0, Math.round(Number(safe?.summary?.totalCountMonth) || 0)),
      uniqueDonorsMonth: Math.max(0, Math.round(Number(safe?.summary?.uniqueDonorsMonth) || 0)),
      monthKey,
      monthLabel: String(safe?.summary?.monthLabel || formatWibMonthLabel(monthKey)),
      updatedAt: String(safe?.summary?.updatedAt || new Date().toISOString()),
    },
    allTime: sanitizeBoard(safe.allTime),
    monthly: sanitizeBoard(safe.monthly),
    recent: sanitizeRecent(safe.recent),
  };
}

export function filterLeaderboardEntries(entries = [], { query = '', platform = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const pf = String(platform || 'all').trim().toLowerCase();
  return (Array.isArray(entries) ? entries : []).filter((item) => {
    if (pf && pf !== 'all') {
      const hasPlatform = Array.isArray(item.platforms)
        ? item.platforms.includes(pf)
        : String(item.platform || '').toLowerCase() === pf;
      if (!hasPlatform) return false;
    }
    if (!q) return true;
    const nameMatch = String(item.donorName || '').toLowerCase().includes(q);
    const msgMatch = String(item.latestMessage || item.message || '').toLowerCase().includes(q);
    return nameMatch || msgMatch;
  });
}
