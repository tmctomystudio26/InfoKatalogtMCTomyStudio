/**
 * Shortlink Bypass & Anti-Malware Intelligence — Pure Logic Module (v87)
 *
 * Zero DOM dependencies so all decoding, security checks, consensus ranking,
 * and Multi-AI ensemble aggregation are 100% unit-testable with node:test.
 */

export const SHORTLINK_HISTORY_KEY = 'manifestudio_shortlink_history_v1';

export const KNOWN_SHORTENER_HOSTS = Object.freeze([
  'bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'v.gd',
  'buff.ly', 'rebrand.ly', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc', 'bl.ink',
  's.id', 't.ly', 'kutt.it', 'short.io', 'lnkd.in', 'dlvr.it', 'snip.ly', 'clck.ru',
  'u.to', 'qr.ae', 'trib.al', 's.shopee.co.id', 'shope.ee', 'vt.tiktok.com', 'vm.tiktok.com',
  'youtu.be', 'l.facebook.com', 'lm.facebook.com', 'l.instagram.com', 'out.reddit.com',
  'linkvertise.com', 'linkvertise.net', 'linkvertise.download', 'link-to.net', 'link-target.net',
  'link-center.net', 'link-hub.net', 'direct-link.net', 'file-link.net', 'up-to-down.net', 'filedm.com',
  'ouo.io', 'ouo.press', 'shrinkme.io', 'shrinke.me', 'shrinkearn.com', 'exe.io', 'exey.io', 'fc.lc',
  'gplinks.co', 'gplinks.in', 'droplink.co', 'safelinku.com', 'safelinkku.com', 'safelinkblogger.com',
  'sfl.gl', 'sfl.ink', 'duit.cc', 'semawur.com', 'khaddavi.net', 'cararegistrasi.com', 'tutwuri.id',
  'adfly.com', 'adf.ly', 'bc.vc', 'sh.st', 'gestyy.com', 'za.gl', 'clk.sh', 'clk.kim', 'clicksfly.com',
  'aylink.co', 'ay.live', 'loot-link.com', 'lootdest.org', 'lootdest.com', 'lootlabs.gg',
  'work.ink', 'workink.net', 'sub2unlock.com', 'sub2unlock.io', 'sub2unlock.me', 'sub2unlock.net',
  'sub4unlock.com', 'sub4unlock.io', 'sub4unlock.me', 'boost.ink', 'bst.gg', 'bst.wtf', 'booo.st',
  'boostylink.com', 'mboost.me', 'rekonise.com', 'social-unlock.com', 'socialwolvez.com', 'scwz.me',
  'link-unlock.com', 'linkunlocker.com', 'paster.so', 'paster.gg', 'adfoc.us',
  'bicolink.net', 'bicolink.com', 'bico.link', 'cuty.io', 'arolinks.com', 'vplink.in', 'bstlar.com',
  'link4m.com', 'tpi.li', 'lockr.net', 'lockr.so', 'lockr.to', 'oke.io', 'tny.so', 'v2links.com',
  'modijiurl.com', 'shareus.io', 'link1s.com', 'adrinolinks.in', 'yorurl.com', 'sfile.mobi', 'mediafire.com',
]);

const AD_WALL_HOSTS = new Set([
  'linkvertise.com', 'linkvertise.net', 'link-to.net', 'link-target.net', 'link-center.net', 'direct-link.net',
  'ouo.io', 'ouo.press', 'shrinkme.io', 'shrinke.me', 'shrinkearn.com', 'exe.io', 'exey.io', 'fc.lc',
  'gplinks.co', 'gplinks.in', 'droplink.co', 'safelinku.com', 'safelinkku.com', 'sfl.gl', 'sfl.ink',
  'duit.cc', 'semawur.com', 'khaddavi.net', 'cararegistrasi.com', 'tutwuri.id', 'adf.ly', 'adfly.com',
  'bc.vc', 'sh.st', 'za.gl', 'clk.sh', 'clicksfly.com', 'aylink.co', 'loot-link.com', 'lootdest.org',
  'lootdest.com', 'lootlabs.gg', 'work.ink', 'workink.net', 'sub2unlock.com', 'sub2unlock.io', 'sub2unlock.me',
  'sub4unlock.com', 'sub4unlock.io', 'boost.ink', 'boostylink.com', 'mboost.me', 'rekonise.com',
  'socialwolvez.com', 'link-unlock.com', 'paster.so', 'adfoc.us', 'bicolink.net', 'bicolink.com', 'bico.link',
  'cuty.io', 'arolinks.com', 'vplink.in', 'bstlar.com', 'link4m.com', 'tpi.li', 'lockr.so', 'lockr.net',
  'oke.io', 'v2links.com', 'modijiurl.com', 'shareus.io', 'link1s.com',
]);

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'utm_reader', 'utm_name', 'utm_referrer', 'fbclid', 'gclid', 'gbraid', 'wbraid',
  'dclid', 'msclkid', 'yclid', 'mc_cid', 'mc_eid', 'igshid', 'igsh', 'si',
  'spm', 'ref', 'ref_src', 'ref_url', 'src', 'feature', 'pp',
  '_hsenc', '_hsmi', 'mkt_tok', 'oly_anon_id', 'oly_enc_id', 'vero_id',
  'wickedid', 'twclid', 'ttclid', 'li_fat_id', 's_cid', 'scid', 'aff_id', 'click_id',
]);

const WRAPPER_QUERY_KEYS = [
  'url', 'u', 'target', 'dest', 'destination', 'redirect', 'redirect_url', 'redir',
  'to', 'link', 'go', 'next', 'out', 'q', 'r', 'continue', 'href', 'site', 'id', 'payload',
];

const SUSPICIOUS_TLDS = new Set([
  'zip', 'mov', 'xyz', 'top', 'click', 'gq', 'tk', 'ml', 'ga', 'cf', 'work',
  'icu', 'buzz', 'rest', 'cam', 'monster', 'loan', 'download', 'racing', 'win',
  'bid', 'stream', 'party', 'trade', 'date', 'faith', 'review', 'science',
]);

const RISKY_BINARY_EXT_RE = /\.(?:apk|exe|msi|scr|bat|cmd|vbs|ps1|jar|dmg|pkg|iso|cab|com|pif|hta)(?:$|[?#])/i;

const PRIVATE_OR_LOCAL_HOST_RE = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^\[?::1\]?$/i,
  /^\[?fe80:/i,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
];

const PHISHING_BRAND_TOKENS = [
  'bri', 'bca', 'mandiri', 'bni', 'bsi', 'dana', 'ovo', 'gopay', 'shopeepay',
  'paypal', 'apple', 'icloud', 'google', 'microsoft', 'netflix', 'whatsapp',
  'instagram', 'facebook', 'tiktok', 'telegram', 'ojk', 'pajak', 'djp', 'bpjs',
  'jne', 'jnt', 'sicepat', 'posindonesia', 'pln', 'telkomsel',
];

const OFFICIAL_SAFE_DOMAINS = new Set([
  'google.com', 'youtube.com', 'youtu.be', 'github.com', 'raw.githubusercontent.com',
  'wikipedia.org', 'wikimedia.org', 'archive.org', 'drive.google.com', 'docs.google.com',
  'play.google.com', 'apps.apple.com', 'microsoft.com', 'apple.com', 'mozilla.org',
  'cloudflare.com', 'npmjs.com', 'pypi.org', 'stackoverflow.com', 'medium.com',
  'tiktok.com', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com',
  'whatsapp.com', 'telegram.org', 't.me', 'linkedin.com', 'reddit.com',
  'bca.co.id', 'bri.co.id', 'bankmandiri.co.id', 'bni.co.id', 'ojk.go.id',
  'pajak.go.id', 'shopee.co.id', 'tokopedia.com', 'bukalapak.com', 'blibli.com',
  'manifestudio.my.id',
]);

export const AI_ENSEMBLE_MODELS = Object.freeze([
  { id: 'gemini', label: 'Gemini', vendor: 'Google', role: 'Audit Phishing & Reputasi Domain' },
  { id: 'openai', label: 'ChatGPT', vendor: 'OpenAI', role: 'Analisis Struktur URL & Redirect' },
  { id: 'claude', label: 'Claude', vendor: 'Anthropic', role: 'Verifikasi Risiko Malware & Unduhan' },
  { id: 'grok', label: 'Grok', vendor: 'xAI', role: 'Deteksi Pola Iklan & Pop-up Agresif' },
  { id: 'deepseek', label: 'DeepSeek', vendor: 'DeepSeek', role: 'Dekode Payload Tersamar & Konsensus' },
]);

/**
 * Validates and normalizes user URL input safely (blocks javascript:, data:, file:, private IPs).
 */
export function normalizeAndValidateUrl(rawInput = '') {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Masukkan tautan shortlink terlebih dahulu.' };
  }

  // Reject explicit dangerous schemes before auto-prepending https://
  if (/^(?:javascript|data|vbscript|file|blob|about|chrome|chrome-extension):/i.test(trimmed)) {
    return { valid: false, error: 'Skema tautan berbahaya diblokir demi keamanan Anda.' };
  }

  // Extract first URL if user pasted a paragraph containing a link
  const embeddedMatch = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  const candidate = embeddedMatch
    ? embeddedMatch[0].replace(/[),.;!?]+$/, '')
    : /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  if (candidate.length > 2048) {
    return { valid: false, error: 'Tautan terlalu panjang (maksimal 2048 karakter).' };
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    return { valid: false, error: 'Format tautan tidak valid. Pastikan diawali https:// atau domain yang benar.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Hanya tautan HTTP dan HTTPS yang didukung.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || !host.includes('.') || host.startsWith('.') || host.endsWith('.')) {
    return { valid: false, error: 'Domain tautan tidak valid.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'Tautan dengan kredensial tertanam diblokir demi keamanan.' };
  }

  if (/^(?:0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(host)) {
    return { valid: false, error: 'Alamat numerik tersamar diblokir demi keamanan.' };
  }

  for (const re of PRIVATE_OR_LOCAL_HOST_RE) {
    if (re.test(host)) {
      return { valid: false, error: 'Alamat jaringan lokal/internal tidak diperbolehkan.' };
    }
  }

  return {
    valid: true,
    url: parsed.toString(),
    hostname: host,
    protocol: parsed.protocol,
  };
}

/**
 * Splits a multi-line batch input into deduplicated valid URL candidates (max 10 per batch).
 */
export function parseBatchUrls(rawText = '', maxItems = 10) {
  const lines = String(rawText || '')
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const line of lines) {
    const res = normalizeAndValidateUrl(line);
    const key = res.valid ? res.url : line;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ raw: line, ...res });
    if (unique.length >= maxItems) break;
  }
  return unique;
}

export function isKnownShortenerHost(hostname = '') {
  const h = String(hostname || '').toLowerCase().replace(/^www\./, '');
  if (!h) return false;
  return KNOWN_SHORTENER_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
}

export function detectShortlinkService(rawUrl = '') {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const isAdWall = [...AD_WALL_HOSTS].some((d) => host === d || host.endsWith(`.${d}`));
    const isShortener = isKnownShortenerHost(host);
    if (isAdWall) {
      return { host, kind: 'ad-wall', label: 'Shortlink Beriklan / Safelink' };
    }
    if (isShortener) {
      return { host, kind: 'shortener', label: 'Pemendek Tautan / Wrapper' };
    }
    if (host.includes('safelink') || host.includes('short') || u.pathname.includes('/go/')) {
      return { host, kind: 'wrapper', label: 'Halaman Pengalihan / Safelink' };
    }
    return { host, kind: 'direct', label: 'Tautan Langsung' };
  } catch {
    return { host: '', kind: 'unknown', label: 'Tidak Diketahui' };
  }
}

function decodeBase64Flexible(str = '') {
  const clean = String(str || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  if (clean.length < 10 || clean.length > 2048) return '';
  if (!/^[A-Za-z0-9+/=]+$/.test(clean)) return '';
  try {
    const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
    const decoded =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf8');
    return decoded.trim();
  } catch {
    return '';
  }
}

function decodeRot13(str = '') {
  return String(str || '').replace(/[a-zA-Z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function decodeHexToAscii(str = '') {
  const clean = String(str || '').trim();
  if (clean.length < 20 || clean.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(clean)) return '';
  let out = '';
  for (let i = 0; i < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if (code < 32 || code > 126) return '';
    out += String.fromCharCode(code);
  }
  return out;
}

function extractSafeUrlFromValue(rawVal = '') {
  const candidates = [];
  let val = String(rawVal || '').trim();
  if (!val) return '';

  // Try raw and URI-decoded (up to 2 passes for double-encoded links)
  candidates.push(val);
  for (let i = 0; i < 2; i += 1) {
    try {
      const dec = decodeURIComponent(val);
      if (dec !== val) {
        candidates.push(dec);
        val = dec;
      }
    } catch {
      break;
    }
  }

  for (const c of candidates) {
    if (/^https?:\/\/[^\s"'<>]{4,}$/i.test(c)) {
      const check = normalizeAndValidateUrl(c);
      if (check.valid) return check.url;
    }
    const b64 = decodeBase64Flexible(c);
    if (b64 && /^https?:\/\/[^\s"'<>]{4,}$/i.test(b64)) {
      const check = normalizeAndValidateUrl(b64);
      if (check.valid) return check.url;
    }
    const hex = decodeHexToAscii(c);
    if (hex && /^https?:\/\/[^\s"'<>]{4,}$/i.test(hex)) {
      const check = normalizeAndValidateUrl(hex);
      if (check.valid) return check.url;
    }
    if (/^uggcf?:\/\//i.test(c)) {
      const rot = decodeRot13(c);
      if (/^https?:\/\/[^\s"'<>]{4,}$/i.test(rot)) {
        const check = normalizeAndValidateUrl(rot);
        if (check.valid) return check.url;
      }
    }
  }
  return '';
}

/**
 * Strips ad-tracking query parameters (utm_*, fbclid, gclid, igshid, etc.)
 * while preserving meaningful functional parameters (like YouTube v=, search q=).
 */
export function stripTrackingParams(rawUrl = '') {
  try {
    const u = new URL(rawUrl);
    const removed = [];
    const onShortener = isKnownShortenerHost(u.hostname);
    const onTwitter = /(?:^|\.)(?:twitter\.com|x\.com)$/i.test(u.hostname);
    const keys = [...u.searchParams.keys()];
    for (const k of keys) {
      const low = k.toLowerCase();
      // Only strip X/Twitter share tracking params 's' and 't' on twitter.com/x.com
      if ((low === 't' || low === 's') && onTwitter) {
        u.searchParams.delete(k);
        removed.push(k);
        continue;
      }
      // On unresolved shorteners/safelinks, preserve non-UTM keys (token/ref/source gates often depend on them)
      if (onShortener && !low.startsWith('utm_') && low !== 'fbclid' && low !== 'gclid') continue;
      if (TRACKING_PARAMS.has(low) || low.startsWith('utm_')) {
        u.searchParams.delete(k);
        removed.push(k);
      }
    }
    return {
      cleanUrl: u.toString(),
      removedParams: removed,
    };
  } catch {
    return { cleanUrl: rawUrl, removedParams: [] };
  }
}

/**
 * Layer 1 — Instant Deterministic Local Unwrapper:
 * Recursively unwraps query-parameter wrappers (Google/FB/IG/YouTube/Safelink),
 * Base64/Hex/ROT13 payloads, and strips tracking noise in <1ms without network latency.
 */
export function runLocalInstantBypass(rawUrl = '') {
  const initial = normalizeAndValidateUrl(rawUrl);
  if (!initial.valid) {
    return {
      ok: false,
      inputUrl: rawUrl,
      resolvedUrl: '',
      cleanUrl: '',
      removedParams: [],
      steps: [],
      error: initial.error,
    };
  }

  const steps = [];
  let current = initial.url;
  const visited = new Set([current]);

  for (let depth = 0; depth < 6; depth += 1) {
    let parsed;
    try {
      parsed = new URL(current);
    } catch {
      break;
    }

    let nextUrl = '';
    let method = '';

    // Check prioritized wrapper query params
    for (const key of WRAPPER_QUERY_KEYS) {
      const val = parsed.searchParams.get(key);
      if (!val) continue;
      const extracted = extractSafeUrlFromValue(val);
      if (extracted && !visited.has(extracted)) {
        nextUrl = extracted;
        method = `Dekode parameter ?${key}=`;
        break;
      }
    }

    // Check any other query parameter that looks like an encoded URL
    if (!nextUrl) {
      for (const [k, v] of parsed.searchParams.entries()) {
        if (WRAPPER_QUERY_KEYS.includes(k)) continue;
        const extracted = extractSafeUrlFromValue(v);
        if (extracted && !visited.has(extracted)) {
          nextUrl = extracted;
          method = `Dekode muatan tersamar (${k})`;
          break;
        }
      }
    }

    // Check URL hash fragment (e.g., safelink.com/#aHR0cHM6Ly9...)
    if (!nextUrl && parsed.hash && parsed.hash.length > 10) {
      const hashToken = parsed.hash.replace(/^#!?\/?/, '');
      const extracted = extractSafeUrlFromValue(hashToken);
      if (extracted && !visited.has(extracted)) {
        nextUrl = extracted;
        method = 'Dekode fragment Base64/URL';
      }
    }

    // Check path segments for embedded Base64 URL payload
    if (!nextUrl) {
      const segs = parsed.pathname.split('/').filter((s) => s.length >= 16);
      for (const seg of segs) {
        const extracted = extractSafeUrlFromValue(seg);
        if (extracted && !visited.has(extracted)) {
          nextUrl = extracted;
          method = 'Dekode jalur terenkripsi';
          break;
        }
      }
    }

    if (!nextUrl) break;
    visited.add(nextUrl);
    steps.push({
      step: steps.length + 1,
      from: current,
      to: nextUrl,
      method,
    });
    current = nextUrl;
  }

  const stripped = stripTrackingParams(current);

  return {
    ok: steps.length > 0 || stripped.removedParams.length > 0,
    unwrapped: steps.length > 0,
    inputUrl: initial.url,
    resolvedUrl: current,
    cleanUrl: stripped.cleanUrl,
    removedParams: stripped.removedParams,
    steps,
  };
}

function getRootDomain(hostname = '') {
  const parts = String(hostname || '').toLowerCase().replace(/^www\./, '').split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  if (/^(?:co|or|ac|go|web|my|biz|sch|net)\.[a-z]{2}$/i.test(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/**
 * Evaluates malware, phishing, pop-up, and download risks on the resolved URL + redirect signals.
 * Returns structured score (0 = safest, 100 = highest risk) + clear Indonesian verdict.
 */
export function evaluateUrlSafety(finalUrl = '', { inputUrl = '', hopsCount = 0, edgeSignals = [] } = {}) {
  const findings = [];
  let riskScore = 0;

  let parsed;
  try {
    parsed = new URL(finalUrl);
  } catch {
    return {
      level: 'danger',
      label: 'Tautan Tidak Valid',
      riskScore: 95,
      trustScore: 5,
      findings: [{ severity: 'high', text: 'Format tautan tujuan tidak valid atau rusak.' }],
      isOfficial: false,
    };
  }

  const host = parsed.hostname.toLowerCase();
  const rootDomain = getRootDomain(host);
  const tld = host.split('.').pop() || '';
  const isOfficial = OFFICIAL_SAFE_DOMAINS.has(rootDomain) || OFFICIAL_SAFE_DOMAINS.has(host);

  if (parsed.protocol === 'http:') {
    riskScore += 18;
    findings.push({
      severity: 'medium',
      text: 'Situs tujuan belum memakai enkripsi HTTPS (koneksi terbuka).',
    });
  }

  if (host.includes('xn--')) {
    riskScore += 38;
    findings.push({
      severity: 'high',
      text: 'Terdeteksi domain Punycode (xn--) yang kerap digunakan untuk menyamar sebagai domain resmi.',
    });
  }

  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    riskScore += 42;
    findings.push({
      severity: 'high',
      text: 'Tautan langsung menuju alamat IP mentah tanpa nama domain resmi.',
    });
  }

  if (RISKY_BINARY_EXT_RE.test(`${parsed.pathname}${parsed.search}`)) {
    riskScore += 44;
    findings.push({
      severity: 'high',
      text: 'Tautan mengarah langsung ke berkas instalasi (.apk/.exe/.msi/.bat) — berisiko malware jika bukan dari sumber tepercaya.',
    });
  }

  if (SUSPICIOUS_TLDS.has(tld) && !isOfficial) {
    riskScore += 22;
    findings.push({
      severity: 'medium',
      text: `Ekstensi domain .${tld} sering dipakai oleh halaman iklan agresif atau tautan jebakan.`,
    });
  }

  // Brand typosquatting / phishing heuristic
  if (!isOfficial) {
    const fullLower = `${host}${parsed.pathname}`.toLowerCase();
    const matchedBrand = PHISHING_BRAND_TOKENS.find((b) => {
      const re = new RegExp(`(?:^|[.-])${b}(?:[.-]|$)`, 'i');
      return re.test(host);
    });
    if (matchedBrand && /(?:login|verify|verif|claim|hadiah|bonus|update|secure|account|undian|bansos|kurir|paket)/i.test(fullLower)) {
      riskScore += 46;
      findings.push({
        severity: 'high',
        text: `Indikasi phishing: domain tidak resmi memakai kata "${matchedBrand}" bersama pola login/klaim/verifikasi.`,
      });
    }
  }

  if (host.split('.').length >= 5 && !isOfficial) {
    riskScore += 16;
    findings.push({
      severity: 'medium',
      text: 'Struktur subdomain terlalu berlapis (sering digunakan untuk menyamarkan domain asli).',
    });
  }

  if (hopsCount >= 4) {
    riskScore += 14;
    findings.push({
      severity: 'medium',
      text: `Terdeteksi ${hopsCount} kali pengalihan berantai sebelum mencapai tujuan akhir.`,
    });
  }

  const sigSet = new Set(Array.isArray(edgeSignals) ? edgeSignals : []);
  if (sigSet.has('ad_popup_script')) {
    riskScore += 15;
    findings.push({
      severity: 'medium',
      text: 'Halaman perantara mengandung skrip iklan pop-under/pop-up yang berhasil dilewati.',
    });
  }
  if (sigSet.has('ad_countdown_wall')) {
    findings.push({
      severity: 'info',
      text: 'Terdeteksi halaman tunggu iklan (safelink countdown) pada tautan asal.',
    });
  }
  if (sigSet.has('cloudflare_block')) {
    findings.push({
      severity: 'medium',
      text: 'Server tujuan melindungi halaman dengan tantangan interaktif Cloudflare (403) yang membatasi akses otomatis.',
    });
  } else if (sigSet.has('captcha_challenge')) {
    findings.push({
      severity: 'info',
      text: 'Situs asal memakai proteksi anti-bot (CAPTCHA/Turnstile) sehingga sebagian lapisan perlu dibuka di browser.',
    });
  }
  if (sigSet.has('blocked_private_hop')) {
    riskScore += 50;
    findings.push({
      severity: 'high',
      text: 'Pengalihan mencoba mengakses jaringan lokal/internal dan langsung diblokir demi keamanan.',
    });
  }

  const sameCleanUrl =
    stripTrackingParams(finalUrl).cleanUrl === stripTrackingParams(inputUrl || '').cleanUrl;
  const unresolvedAdWall = Boolean(
    isKnownShortenerHost(host) && (sameCleanUrl || sigSet.has('cloudflare_block') || sigSet.has('captcha_challenge') || AD_WALL_HOSTS.has(rootDomain))
  );

  if (unresolvedAdWall) {
    riskScore = Math.max(riskScore, sigSet.has('cloudflare_block') || AD_WALL_HOSTS.has(rootDomain) ? 35 : 25);
    findings.push({
      severity: 'medium',
      text: !sameCleanUrl
        ? `Sebagian lapisan berhasil ditembus hingga ${rootDomain}, namun tahap akhir masih mengunci akses dengan verifikasi browser manusia.`
        : 'Tujuan asli belum berhasil ditembus karena domain perantara mengunci akses dengan verifikasi browser manusia atau tautan sudah tidak aktif.',
    });
  } else if (isOfficial && riskScore === 0) {
    findings.push({
      severity: 'safe',
      text: `Domain tujuan (${rootDomain}) terverifikasi sebagai platform publik tepercaya dengan HTTPS.`,
    });
  } else if (findings.length === 0) {
    findings.push({
      severity: 'safe',
      text: 'Tidak ditemukan indikasi malware, skrip jebakan, maupun pola phishing pada struktur tautan tujuan.',
    });
  }

  const clampedRisk = Math.max(0, Math.min(100, riskScore));
  const trustScore = 100 - clampedRisk;

  let level = 'safe';
  let label = 'Aman Dibuka';
  if (clampedRisk >= 55) {
    level = 'danger';
    label = 'Berbahaya / Hindari';
  } else if (unresolvedAdWall) {
    level = 'warn';
    label = !sameCleanUrl
      ? 'Baru Tembus Sebagian — Tahap Akhir Terhalang Anti-Bot'
      : 'Belum Tembus ke Tujuan — Terhalang Anti-Bot';
  } else if (clampedRisk >= 22) {
    level = 'warn';
    label = 'Waspada — Periksa Dulu';
  }

  return {
    level,
    label,
    riskScore: clampedRisk,
    trustScore,
    rootDomain,
    isOfficial,
    unresolvedAdWall,
    partialAdvance: Boolean(unresolvedAdWall && !sameCleanUrl),
    findings,
  };
}

const ENGINE_OWN_HOSTS = new Set([
  'bypass.vip', 'www.bypass.vip', 'api.bypass.vip', 'bypass.pm', 'ww17.bypass.pm',
  'bypassx-omega.vercel.app', 'trw.lat', 'rip.linkvertise.lol', 'shortlink-bypass.vercel.app',
  'api.zapi.ink', 'r.jina.ai', 'unshorten.me',
]);

function isBogusEngineCandidate(rawUrl = '') {
  const s = String(rawUrl || '').trim();
  if (!s) return true;
  if (/FREE\s+API\s+SHUT\s+DOWN|bypass\.vip\/discord/i.test(s)) return true;
  try {
    const h = new URL(s).hostname.toLowerCase();
    if (ENGINE_OWN_HOSTS.has(h) || /^ww\d+\./i.test(h)) return true;
  } catch {
    return true;
  }
  return false;
}

/**
 * Combines outputs from Local Instant Decoder + Edge Redirect Inspector + Open-Source/Public APIs
 * to pick the highest-confidence, cleanest direct destination URL (preferring non-shortener targets).
 */
export function mergeBypassEngineResults({ inputUrl = '', localResult = null, edgeResponse = null } = {}) {
  const candidates = new Map();
  const engineRows = [];

  const registerCandidate = (rawUrl, weight, engineName) => {
    if (isBogusEngineCandidate(rawUrl)) return;
    const check = normalizeAndValidateUrl(rawUrl);
    if (!check.valid) return;
    const cleaned = stripTrackingParams(check.url).cleanUrl;
    const isSameAsInput = cleaned === stripTrackingParams(inputUrl).cleanUrl;
    const host = new URL(cleaned).hostname.toLowerCase();
    const stillShortener = isKnownShortenerHost(host);

    // Reward direct non-shortener destinations strongly over unresolved shortlinks
    let score = weight;
    if (!isSameAsInput) score += 25;
    if (!stillShortener) score += 55;
    if (cleaned.startsWith('https://')) score += 5;

    const existing = candidates.get(cleaned);
    if (existing) {
      existing.score += score;
      existing.votes += 1;
      if (!existing.engines.includes(engineName)) existing.engines.push(engineName);
    } else {
      candidates.set(cleaned, {
        url: cleaned,
        rawUrl: check.url,
        score,
        votes: 1,
        stillShortener,
        engines: [engineName],
      });
    }
  };

  // 1. Local Deterministic Decoder
  if (localResult) {
    const localOk = Boolean(localResult.unwrapped || (localResult.removedParams || []).length > 0);
    engineRows.push({
      engineId: 'local-decoder',
      name: 'Dekoder Lokal Instan',
      category: 'local',
      ok: localOk,
      resolvedUrl: localResult.cleanUrl || localResult.resolvedUrl || '',
      note: localResult.unwrapped
        ? `Mengurai ${localResult.steps.length} lapisan parameter/Base64`
        : localResult.removedParams?.length > 0
        ? `Membersihkan ${localResult.removedParams.length} pelacak iklan`
        : 'Tidak ada muatan terenkripsi di URL',
    });
    if (localResult.cleanUrl) {
      registerCandidate(localResult.cleanUrl, localResult.unwrapped ? 40 : 10, 'Dekoder Lokal Instan');
    }
  }

  // 2. Edge & Community Open-Source / Public APIs
  const remoteEngines = Array.isArray(edgeResponse?.engines) ? edgeResponse.engines : [];
  for (const eng of remoteEngines) {
    if (!eng || !eng.name) continue;
    const safeResolved = isBogusEngineCandidate(eng.resolvedUrl) ? '' : eng.resolvedUrl;
    const engOk = Boolean(eng.ok && safeResolved);
    engineRows.push({
      engineId: eng.engineId || eng.name.toLowerCase().replace(/\s+/g, '-'),
      name: eng.name,
      category: eng.category || 'public-api',
      ok: engOk,
      resolvedUrl: safeResolved || '',
      note: eng.note || (engOk ? 'Berhasil diurai' : 'Tidak ada hasil tambahan'),
    });
    if (safeResolved) {
      const weight =
        eng.category === 'open-source' ? 50 : eng.category === 'edge' ? 45 : 35;
      registerCandidate(safeResolved, engOk ? weight : 10, eng.name);
    }
  }

  // Pick highest-scoring consensus candidate
  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score || b.votes - a.votes);
  const best = ranked[0] || null;

  const fallbackClean = stripTrackingParams(inputUrl);
  const finalUrl = best ? best.url : fallbackClean.cleanUrl;
  const rawFinalUrl = best ? best.rawUrl : inputUrl;

  const removedParamsSet = new Set(localResult?.removedParams || []);
  const postStrip = stripTrackingParams(rawFinalUrl);
  postStrip.removedParams.forEach((p) => removedParamsSet.add(p));

  const cleanFinal = postStrip.cleanUrl || finalUrl;
  const finalHost = (() => {
    try {
      return new URL(cleanFinal).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const stillOnShortener = isKnownShortenerHost(finalHost);
  const movedPastInput = cleanFinal !== inputUrl && cleanFinal !== fallbackClean.cleanUrl;
  const reachedDestination = movedPastInput && !stillOnShortener;
  const partialAdvance = movedPastInput && stillOnShortener;
  const bypassed = reachedDestination;

  const agreeingEngines = best ? best.engines : [];
  const edgeSignals = Array.isArray(edgeResponse?.edgeTrace?.signals) ? edgeResponse.edgeTrace.signals : [];

  return {
    inputUrl,
    finalUrl: cleanFinal,
    bypassed,
    reachedDestination,
    partialAdvance,
    stillOnShortener,
    cfBlocked: Boolean(edgeResponse?.edgeTrace?.cfBlocked || edgeSignals.includes('cloudflare_block')),
    trackingRemovedCount: removedParamsSet.size,
    removedParams: [...removedParamsSet],
    agreeingEngines,
    agreeingCount: agreeingEngines.length,
    totalEnginesChecked: engineRows.length,
    engineRows,
    hops: Array.isArray(edgeResponse?.edgeTrace?.hops) ? edgeResponse.edgeTrace.hops : [],
    pageTitle: String(edgeResponse?.edgeTrace?.pageTitle || '').trim(),
    edgeSignals,
  };
}

/**
 * Parses a structured Multi-AI JSON or plain-text security audit response cleanly.
 */
export function parseAiSecurityReply(rawText = '') {
  const txt = String(rawText || '').trim();
  if (!txt) return null;

  const jsonMatch = txt.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const rawVerdict = String(parsed.verdict || parsed.status || '').toLowerCase();
      let verdict = 'safe';
      if (/danger|berbahaya|phish|malware|blokir|hindari/i.test(rawVerdict)) verdict = 'danger';
      else if (/warn|waspada|hati|ragu|iklan/i.test(rawVerdict)) verdict = 'warn';

      const extractedUrl = parsed.extractedUrl
        ? normalizeAndValidateUrl(parsed.extractedUrl)
        : { valid: false };

      return {
        verdict,
        summary: String(parsed.summary || parsed.ringkasan || '').trim().slice(0, 320),
        advice: String(parsed.advice || parsed.saran || '').trim().slice(0, 240),
        extractedUrl: extractedUrl.valid ? stripTrackingParams(extractedUrl.url).cleanUrl : '',
      };
    } catch {
      // Fall through to text parser
    }
  }

  // Plain-text fallback
  const low = txt.toLowerCase();
  let verdict = 'safe';
  if (/\b(berbahaya|malware|phishing|penipuan|scam|hindari)\b/.test(low)) verdict = 'danger';
  else if (/\b(waspada|hati-hati|mencurigakan|iklan\s*agresif)\b/.test(low)) verdict = 'warn';

  return {
    verdict,
    summary: txt.replace(/\s+/g, ' ').slice(0, 280),
    advice: '',
    extractedUrl: '',
  };
}

/**
 * Combines Multi-AI ensemble verdicts (Gemini, ChatGPT, Claude, Grok, DeepSeek)
 * with the deterministic heuristic audit to produce a unified final safety verdict.
 */
export function mergeAiSafetyConsensus(heuristicSafety, aiReports = []) {
  const validReports = (Array.isArray(aiReports) ? aiReports : []).filter((r) => r && r.parsed);
  if (validReports.length === 0) {
    return {
      ...heuristicSafety,
      aiConsensusUsed: false,
      aiSummary: '',
      aiAdvice: '',
      aiModelsParticipated: [],
      aiExtractedUrl: '',
    };
  }

  const votes = { safe: 0, warn: 0, danger: 0 };
  let aiExtractedUrl = '';
  for (const r of validReports) {
    const v = r.parsed.verdict || 'safe';
    if (votes[v] !== undefined) votes[v] += 1;
    if (!aiExtractedUrl && r.parsed.extractedUrl) {
      aiExtractedUrl = r.parsed.extractedUrl;
    }
  }

  // Strict safety bias: if heuristics OR any AI flags danger with strong consensus, elevate safely
  let finalLevel = heuristicSafety.level;
  if (votes.danger >= 2 || (votes.danger >= 1 && heuristicSafety.level !== 'safe')) {
    finalLevel = 'danger';
  } else if (finalLevel === 'safe' && (votes.danger >= 1 || votes.warn >= 2)) {
    finalLevel = 'warn';
  }

  const labelMap = {
    safe: 'Aman Dibuka',
    warn: heuristicSafety.unresolvedAdWall ? heuristicSafety.label : 'Waspada — Periksa Dulu',
    danger: 'Berbahaya / Hindari',
  };

  const primaryReport = validReports.find((r) => r.parsed.summary) || validReports[0];

  return {
    ...heuristicSafety,
    level: finalLevel,
    label: labelMap[finalLevel] || heuristicSafety.label,
    aiConsensusUsed: true,
    aiSummary: primaryReport?.parsed?.summary || '',
    aiAdvice: primaryReport?.parsed?.advice || '',
    aiModelsParticipated: validReports.map((r) => ({
      id: r.modelId,
      label: r.label,
      verdict: r.parsed.verdict,
      summary: r.parsed.summary,
    })),
    aiExtractedUrl,
  };
}

export function upsertShortlinkHistory(history = [], entry = {}, maxItems = 15) {
  const list = Array.isArray(history) ? history : [];
  if (!entry || !entry.inputUrl) return list;
  const filtered = list.filter((h) => h && h.inputUrl !== entry.inputUrl);
  return [
    {
      inputUrl: String(entry.inputUrl),
      finalUrl: String(entry.finalUrl || entry.inputUrl),
      safetyLevel: String(entry.safetyLevel || 'safe'),
      safetyLabel: String(entry.safetyLabel || 'Aman Dibuka'),
      bypassed: Boolean(entry.bypassed),
      timestamp: entry.timestamp || new Date().toISOString(),
    },
    ...filtered,
  ].slice(0, maxItems);
}
