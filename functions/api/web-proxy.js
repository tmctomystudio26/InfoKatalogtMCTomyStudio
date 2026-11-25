/**
 * Manifestudio Edge Web Proxy & Privacy Relay Function (v91)
 * Route: GET / POST /api/web-proxy
 *
 * Zero-cost, zero-logging privacy browser backend for Cloudflare Pages & local dev:
 *  - Mode `browse`: Fetches public pages via direct Cloudflare Edge, Privacy VPN-Relay
 *    stripped headers, Jina Anti-Bot Reader mirror, Wayback Archive, or AllOrigins relay.
 *    Strips ad networks & tracking pixels, rewrites links to safe postMessage events,
 *    and automatically detects embedded video/audio streams (VidMate-style).
 *  - Mode `search`: Privacy-preserving web search via DuckDuckGo HTML, Wikipedia OpenSearch,
 *    and public SearXNG relays with zero personal cookies or tracking headers.
 *  - Mode `asset` / `download`: Streams safe public images/media/files through the proxy
 *    with strict MIME, size cap, and SSRF validation.
 *
 * Strict Security Guarantees:
 *  - Zero server-side browsing logs or history persistence.
 *  - Strict SSRF guard on initial URL AND every redirect hop (blocks private/loopback/
 *    link-local/metadata IPs, IPv6 private space, numeric/octal/hex hosts, credentials).
 *  - Never forwards client cookies/auth headers upstream; strips upstream Set-Cookie &
 *    anti-framing headers cleanly before returning sanitized srcdoc payload.
 */

const MAX_REDIRECT_HOPS = 6;
const MAX_HTML_BYTES = 450 * 1024;
const MAX_ASSET_BYTES = 14 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 11000;

const PRIVACY_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.135 Mobile Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
];

const AD_DOMAIN_PATTERNS = [
  'googlesyndication.com',
  'doubleclick.net',
  'googleadservices.com',
  'adservice.google.',
  'pagead2.googlesyndication',
  'adsterra.',
  'propellerads.',
  'monetag.',
  'popads.',
  'popcash.',
  'exoclick.',
  'juicyads.',
  'taboola.com',
  'outbrain.com',
  'mgid.com',
  'revcontent.com',
  'adnxs.com',
  'criteo.com',
  'pubmatic.com',
  'rubiconproject.com',
  'openx.net',
  'amazon-adsystem.com',
  'media.net',
  'bidvertiser.com',
  'hilltopads.',
  'admaven.',
  'onclickperformance.',
  'highperformanceformat.',
  'effectivegatecpm.',
];

const TRACKER_DOMAIN_PATTERNS = [
  'google-analytics.com',
  'googletagmanager.com',
  'connect.facebook.net',
  'facebook.com/tr',
  'analytics.tiktok.com',
  'hotjar.com',
  'clarity.ms',
  'mixpanel.com',
  'segment.io',
  'amplitude.com',
  'quantserve.com',
  'scorecardresearch.com',
  'newrelic.com',
  'sentry.io',
  'mc.yandex.ru',
  'pixel.wp.com',
  'matomo.',
  'plausible.io',
];

const TRACKING_QUERY_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'yclid',
  'igshid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'ref_src',
  'spm',
]);

const MALWARE_DANGEROUS_EXT_RE = /\.(exe|msi|scr|bat|cmd|ps1|vbs|jar|dmg|pkg|deb|rpm|apk|ipa|iso|lnk)(\?|$)/i;
const PHISHING_HOST_HINT_RE =
  /(login-verify|secure-update|account-unlock|claim-reward|hadiah-gratis|dana-kaget-resmi|bri-mobile-update|bca-verify|paypal-security|free-robux|crypto-airdrop-claim)/i;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function isBlockedIpOrHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.lan') ||
    host.endsWith('.home') ||
    host === 'metadata.google.internal' ||
    host === 'metadata' ||
    host === 'instance-data'
  ) {
    return true;
  }

  // Block raw integer/hex/octal IP obfuscation (e.g. 2130706433, 0x7f000001, 0177.0.0.1)
  if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/i.test(host)) return true;
  if (/^0\d+\./.test(host) || /\.0\d+/.test(host)) return true;

  // IPv4 private / loopback / link-local / CGNAT / multicast / unspecified
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    const c = Number(ipv4Match[3]);
    const d = Number(ipv4Match[4]);
    if (a > 255 || b > 255 || c > 255 || d > 255) return true;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }

  // IPv6 loopback, link-local, unique-local, mapped IPv4
  if (host.includes(':')) {
    if (
      host === '::1' ||
      host === '::' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe8') ||
      host.startsWith('fe9') ||
      host.startsWith('fea') ||
      host.startsWith('feb') ||
      host.startsWith('::ffff:') ||
      host.startsWith('0:0:0:0:0:ffff:')
    ) {
      return true;
    }
  }

  // Must contain a valid TLD dot for public domains
  if (!host.includes('.')) return true;
  return false;
}

export function validatePublicProxyUrl(raw) {
  const input = String(raw || '').trim();
  if (!input || input.length > 2048) {
    return { ok: false, reason: 'URL kosong atau terlalu panjang.' };
  }
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { ok: false, reason: 'Format URL tidak valid.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Hanya protokol HTTP/HTTPS publik yang diizinkan.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL dengan kredensial tertanam diblokir demi keamanan.' };
  }
  if (isBlockedIpOrHost(parsed.hostname)) {
    return { ok: false, reason: 'Alamat jaringan privat/lokal diblokir oleh proteksi anti-bobol.' };
  }

  // Clean tracking parameters automatically
  const strippedTrackers = [];
  for (const key of Array.from(parsed.searchParams.keys())) {
    if (TRACKING_QUERY_PARAMS.has(key.toLowerCase())) {
      strippedTrackers.push(key);
      parsed.searchParams.delete(key);
    }
  }

  return {
    ok: true,
    url: parsed.toString(),
    hostname: parsed.hostname.toLowerCase(),
    protocol: parsed.protocol,
    strippedTrackers,
  };
}

function pickPrivacyUserAgent(node = 'proxy-stealth') {
  if (node === 'vpn-relay') return PRIVACY_USER_AGENTS[1];
  if (node === 'reader-antibot') return PRIVACY_USER_AGENTS[2];
  return PRIVACY_USER_AGENTS[0];
}

function buildStealthHeaders(
  node = 'proxy-stealth',
  accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  { isAsset = false, assetKind = 'video' } = {}
) {
  const ua = pickPrivacyUserAgent(node);
  const isMobile = /Android|Mobile/i.test(ua);
  const isChrome = /Chrome\/134/i.test(ua);

  if (isAsset) {
    const h = {
      'User-Agent': ua,
      Accept:
        accept ||
        (assetKind === 'image'
          ? 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
          : '*/*'),
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'Sec-Fetch-Dest': assetKind === 'image' ? 'image' : assetKind === 'audio' ? 'audio' : 'video',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site',
    };
    if (isChrome) {
      h['Sec-Ch-Ua'] = '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"';
      h['Sec-Ch-Ua-Mobile'] = isMobile ? '?1' : '?0';
      h['Sec-Ch-Ua-Platform'] = isMobile ? '"Android"' : '"Windows"';
    }
    return h;
  }

  const h = {
    'User-Agent': ua,
    Accept: accept,
    'Accept-Language': node === 'vpn-relay' ? 'en-US,en;q=0.9,id;q=0.8' : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
  };
  if (isChrome) {
    h['Sec-Ch-Ua'] = '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"';
    h['Sec-Ch-Ua-Mobile'] = isMobile ? '?1' : '?0';
    h['Sec-Ch-Ua-Platform'] = isMobile ? '"Android"' : '"Windows"';
  }
  return h;
}

function captureEphemeralCookies(response, hostname, cookieJar) {
  if (!cookieJar || !hostname) return;
  let setCookies = [];
  if (typeof response.headers.getSetCookie === 'function') {
    setCookies = response.headers.getSetCookie();
  } else {
    const raw = response.headers.get('set-cookie');
    if (raw) setCookies = raw.split(/,(?=\s*[a-zA-Z0-9_.-]+=)/);
  }
  if (!setCookies.length) return;
  const hostMap = cookieJar.get(hostname) || new Map();
  for (const line of setCookies) {
    const pair = String(line || '').split(';')[0].trim();
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const k = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      if (k && k.length < 120 && v.length < 2048) hostMap.set(k, v);
    }
  }
  cookieJar.set(hostname, hostMap);
}

function serializeEphemeralCookies(hostname, cookieJar) {
  if (!cookieJar || !hostname) return '';
  const parts = [];
  for (const [jarHost, map] of cookieJar.entries()) {
    if (hostname === jarHost || hostname.endsWith(`.${jarHost}`)) {
      for (const [k, v] of map.entries()) {
        parts.push(`${k}=${v}`);
      }
    }
  }
  return parts.join('; ');
}

/**
 * Normalizes generic upstream MIME types (like application/octet-stream) to the true media MIME
 * based on URL extension so `X-Content-Type-Options: nosniff` never blocks valid thumbnails or videos.
 */
export function inferMediaMimeFromUrl(urlStr, rawContentType = '') {
  const ct = String(rawContentType || '').split(';')[0].trim().toLowerCase();
  const isGeneric =
    !ct ||
    ct === 'application/octet-stream' ||
    ct === 'binary/octet-stream' ||
    ct === 'application/force-download' ||
    ct === 'text/plain';
  if (!isGeneric) return ct;

  let pathname = '';
  try {
    pathname = new URL(urlStr).pathname.toLowerCase();
  } catch {
    pathname = String(urlStr || '').toLowerCase();
  }
  if (/\.webp$/i.test(pathname)) return 'image/webp';
  if (/\.(?:jpe?g|jfif)$/i.test(pathname)) return 'image/jpeg';
  if (/\.png$/i.test(pathname)) return 'image/png';
  if (/\.gif$/i.test(pathname)) return 'image/gif';
  if (/\.avif$/i.test(pathname)) return 'image/avif';
  if (/\.svg$/i.test(pathname)) return 'image/svg+xml';
  if (/\.ico$/i.test(pathname)) return 'image/x-icon';
  if (/\.mp4$|\.m4v$/i.test(pathname)) return 'video/mp4';
  if (/\.webm$/i.test(pathname)) return 'video/webm';
  if (/\.mov$/i.test(pathname)) return 'video/quicktime';
  if (/\.m3u8$/i.test(pathname)) return 'application/vnd.apple.mpegurl';
  if (/\.ts$/i.test(pathname)) return 'video/mp2t';
  if (/\.mp3$/i.test(pathname)) return 'audio/mpeg';
  if (/\.m4a$/i.test(pathname)) return 'audio/mp4';
  if (/\.ogg$/i.test(pathname)) return 'audio/ogg';
  if (/\.wav$/i.test(pathname)) return 'audio/wav';
  return ct || 'application/octet-stream';
}

/**
 * Detects HTML-level redirects, `Please visit https://...` stubs, JS location redirects,
 * simple literal `document.cookie` gates, and anti-bot interstitial pages so the proxy
 * automatically unwraps them or fails over to a headless HTML mirror instead of trapping users.
 */
export function detectInterstitialOrRedirect(rawHtml, currentUrl) {
  const html = String(rawHtml || '');
  if (!html.trim()) return null;

  // 1. <meta http-equiv="refresh" content="0; url=https://...">
  const metaRefresh =
    html.match(/<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]+content\s*=\s*["'][^"']*url\s*=\s*([^"'\s;>]+)["']/i) ||
    html.match(/<meta[^>]+content\s*=\s*["'][^"']*url\s*=\s*([^"'\s;>]+)["'][^>]+http-equiv\s*=\s*["']refresh["']/i);
  if (metaRefresh?.[1]) {
    const targetUrl = resolveSafeHttpUrl(decodeHtmlEntities(metaRefresh[1]).replace(/^['"]|['"]$/g, ''), currentUrl);
    if (targetUrl) {
      return { kind: 'meta-refresh', targetUrl, cookies: [] };
    }
  }

  const plainText = extractPlainTextSnippet(html, 900);
  const isCompactStub = plainText.length < 480;

  // 2. Simple literal JS cookie gate (e.g. document.cookie="human=1; path=/"; location.reload())
  const cookies = [];
  if (isCompactStub && /document\.cookie\s*=/i.test(html)) {
    const cookieRe = /document\.cookie\s*=\s*["']([a-zA-Z0-9_.-]{1,64}=[^;"'\r\n]{1,256})/gi;
    let cm;
    while ((cm = cookieRe.exec(html)) !== null) {
      cookies.push(cm[1]);
    }
  }

  // 3. JS location redirect on stub pages
  if (isCompactStub) {
    const jsRedirect = html.match(
      /(?:window|self|top|document)?\.?location(?:\.href)?\s*=\s*["'](https?:\/\/[^"'\s<>]+|\/[^"'\s<>]+)["']|location\.(?:replace|assign)\(\s*["'](https?:\/\/[^"'\s<>]+|\/[^"'\s<>]+)["']\s*\)/i
    );
    const rawJsUrl = jsRedirect?.[1] || jsRedirect?.[2] || '';
    if (rawJsUrl) {
      const targetUrl = resolveSafeHttpUrl(decodeHtmlEntities(rawJsUrl), currentUrl);
      if (targetUrl) {
        return { kind: cookies.length ? 'cookie-gate' : 'js-redirect', targetUrl, cookies };
      }
    }
  }

  // 4. "Please visit https://..." / "Moved Permanently" / "Redirecting to..." stub pages
  if (
    isCompactStub &&
    /(?:please\s+visit|click\s+here\s+to\s+(?:continue|proceed|visit)|moved\s+permanently|document\s+has\s+moved|object\s+moved|redirecting\s+to|you\s+are\s+being\s+redirected)/i.test(
      plainText
    )
  ) {
    const anchorMatch = html.match(/<a[^>]+href\s*=\s*["']([^"']+)["']/i);
    const plainUrlMatch = plainText.match(/https?:\/\/[^\s"'<>]+/i);
    const candidate = anchorMatch?.[1] || plainUrlMatch?.[0] || '';
    const targetUrl = candidate ? resolveSafeHttpUrl(decodeHtmlEntities(candidate), currentUrl) : '';
    return {
      kind: 'visit-stub',
      targetUrl: targetUrl || currentUrl,
      cookies,
    };
  }

  // 5. Simple cookie-gate reload on same URL
  if (cookies.length > 0 && /location\.reload|window\.location/i.test(html)) {
    return { kind: 'cookie-gate', targetUrl: currentUrl, cookies };
  }

  // 6. Anti-bot / Cloudflare / DDoS-Guard interstitial stub
  if (
    plainText.length < 900 &&
    /(?:just\s+a\s+moment|checking\s+your\s+browser|enable\s+javascript\s+and\s+cookies|attention\s+required!\s*\|\s*cloudflare|verify\s+you\s+are\s+human|ddos-guard|one\s+more\s+step|cf-browser-verification)/i.test(
      `${plainText} ${html.slice(0, 2000)}`
    )
  ) {
    return { kind: 'antibot-challenge', targetUrl: currentUrl, cookies };
  }

  return null;
}

async function fetchWithSafeRedirects(
  startUrl,
  {
    node = 'proxy-stealth',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    accept,
    range,
    referer,
    method = 'GET',
    isAsset = false,
    assetKind = 'video',
    cookieJar = new Map(),
  } = {}
) {
  let currentUrl = startUrl;
  const hops = [];

  for (let i = 0; i <= MAX_REDIRECT_HOPS; i += 1) {
    const check = validatePublicProxyUrl(currentUrl);
    if (!check.ok) {
      throw new Error(check.reason || 'URL tujuan diblokir oleh proteksi keamanan.');
    }
    const headers = buildStealthHeaders(node, accept, { isAsset, assetKind });
    if (range) headers.Range = range;
    if (referer) {
      const refCheck = validatePublicProxyUrl(referer);
      if (refCheck.ok) {
        headers.Referer = refCheck.url;
      }
    }
    const cookieHeader = serializeEphemeralCookies(check.hostname, cookieJar);
    if (cookieHeader) {
      headers.Cookie = cookieHeader;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(check.url, {
        method: method === 'HEAD' ? 'HEAD' : 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers,
      });
    } finally {
      clearTimeout(timer);
    }

    captureEphemeralCookies(res, check.hostname, cookieJar);
    hops.push({ url: check.url, status: res.status });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        return { response: res, finalUrl: check.url, hops, cookieJar };
      }
      let nextUrl;
      try {
        nextUrl = new URL(location, check.url).toString();
      } catch {
        throw new Error('Header pengalihan tidak valid.');
      }
      currentUrl = nextUrl;
      continue;
    }

    return { response: res, finalUrl: check.url, hops, cookieJar };
  }

  throw new Error('Terlalu banyak pengalihan (redirect loop terdeteksi).');
}

async function readTextCapped(response, maxBytes = MAX_HTML_BYTES) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const txt = await response.text();
    return txt.slice(0, maxBytes);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const remaining = maxBytes - total;
        chunks.push(value.byteLength > remaining ? value.subarray(0, remaining) : value);
        total += Math.min(value.byteLength, remaining);
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cancel error
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const ch of chunks) {
    merged.set(ch, offset);
    offset += ch.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtmlAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function resolveSafeHttpUrl(rawUrl, baseUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed || /^(javascript|vbscript|data|blob|file|mailto|tel):/i.test(trimmed)) {
    return '';
  }
  try {
    const abs = new URL(trimmed, baseUrl).toString();
    const check = validatePublicProxyUrl(abs);
    return check.ok ? check.url : '';
  } catch {
    return '';
  }
}

function matchesAnyPattern(str, patterns) {
  const lower = String(str || '').toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

function extractTitleAndFavicon(html, baseUrl) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const iconMatch = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i);

  let hostTitle = 'Halaman Web';
  try {
    hostTitle = new URL(baseUrl).hostname;
  } catch {
    // fallback
  }

  const title = decodeHtmlEntities(titleMatch?.[1] || ogTitleMatch?.[1] || hostTitle).slice(0, 140);
  const description = decodeHtmlEntities(descMatch?.[1] || '').slice(0, 260);
  const favicon = iconMatch?.[1] ? resolveSafeHttpUrl(iconMatch[1], baseUrl) : '';

  return { title, description, favicon };
}

function extractPlainTextSnippet(html, maxChars = 2800) {
  const stripped = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return decodeHtmlEntities(stripped).slice(0, maxChars);
}

/**
 * Automatic VidMate-style media extraction from HTML tags, OpenGraph, JSON-LD, and inline media URLs.
 */
export function extractMediaFromHtml(html, baseUrl, pageTitle = '') {
  const found = [];
  const seen = new Set();

  const pushMedia = (rawUrl, kind = 'video', label = '', mime = '', source = 'html') => {
    const resolved = resolveSafeHttpUrl(rawUrl, baseUrl);
    if (!resolved || seen.has(resolved)) return;
    if (matchesAnyPattern(resolved, AD_DOMAIN_PATTERNS)) return;
    seen.add(resolved);

    const extMatch = resolved.match(/\.([a-z0-9]{2,5})(?:[?#]|$)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : kind === 'audio' ? 'mp3' : 'mp4';
    const isHls = ext === 'm3u8' || resolved.includes('.m3u8');
    const finalKind =
      kind === 'audio' || /\.(mp3|m4a|ogg|wav|aac|flac)(?:[?#]|$)/i.test(resolved)
        ? 'audio'
        : 'video';

    found.push({
      id: `media-${found.length + 1}`,
      url: resolved,
      kind: finalKind,
      format: isHls ? 'HLS (M3U8)' : ext.toUpperCase(),
      quality:
        label ||
        (/1080|fhd/i.test(resolved)
          ? '1080p HD'
          : /720|hd/i.test(resolved)
          ? '720p HD'
          : /480/i.test(resolved)
          ? '480p SD'
          : finalKind === 'audio'
          ? 'Audio Stream'
          : 'Auto Video'),
      mime: mime || (finalKind === 'audio' ? 'audio/mpeg' : isHls ? 'application/vnd.apple.mpegurl' : 'video/mp4'),
      title: pageTitle || 'Media Terdeteksi',
      source,
      proxyDownloadUrl: `/api/web-proxy?mode=download&url=${encodeURIComponent(resolved)}&ref=${encodeURIComponent(
        (() => {
          try {
            return `${new URL(baseUrl).origin}/`;
          } catch {
            return '';
          }
        })()
      )}`,
    });
  };

  const rawHtml = String(html || '');

  // 1. <video src="..."> & <audio src="..."> & <source src="...">
  const tagRe = /<(video|audio|source)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(rawHtml)) !== null) {
    const tagName = m[1].toLowerCase();
    const attrs = m[2] || '';
    const srcMatch = attrs.match(/\b(?:src|data-src)\s*=\s*["']([^"']+)["']/i);
    const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const labelMatch = attrs.match(/\b(?:label|title|data-quality|size)\s*=\s*["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      const mime = typeMatch?.[1] || '';
      const kind = tagName === 'audio' || mime.startsWith('audio/') ? 'audio' : 'video';
      pushMedia(srcMatch[1], kind, labelMatch?.[1] || '', mime, `<${tagName}>`);
    }
  }

  // 2. OpenGraph og:video / og:audio / twitter:player:stream
  const metaRe =
    /<meta[^>]+(?:property|name)\s*=\s*["'](og:video(?::url|:secure_url)?|og:audio(?::url)?|twitter:player:stream)["'][^>]+content\s*=\s*["']([^"']+)["']/gi;
  while ((m = metaRe.exec(rawHtml)) !== null) {
    const key = m[1].toLowerCase();
    const val = m[2];
    if (val) {
      pushMedia(val, key.includes('audio') ? 'audio' : 'video', 'HD Stream', '', key);
    }
  }

  // 3. JSON-LD contentUrl / embedUrl
  const jsonUrlRe = /"(?:contentUrl|mediaUrl|videoUrl|streamUrl|mp4Url|audioUrl)"\s*:\s*"(https?:\\?\/\\?\/[^"]+)"/gi;
  while ((m = jsonUrlRe.exec(rawHtml)) !== null) {
    const cleaned = m[1].replace(/\\\//g, '/');
    if (/\.(mp4|webm|m3u8|mp3|m4a|ogg|mov)(?:[?#]|$)/i.test(cleaned)) {
      pushMedia(cleaned, /\.(mp3|m4a|ogg)/i.test(cleaned) ? 'audio' : 'video', 'Direct Stream', '', 'json-ld');
    }
  }

  // 4. Direct embedded .mp4 / .webm / .m3u8 / .mp3 links in page markup
  const directRe = /https?:\/\/[^\s"'<>\\)]+\.(?:mp4|webm|m3u8|mp3|m4a|ogg)(?:\?[^\s"'<>\\)]*)?/gi;
  while ((m = directRe.exec(rawHtml)) !== null) {
    pushMedia(m[0], /\.(mp3|m4a|ogg)/i.test(m[0]) ? 'audio' : 'video', '', '', 'embedded-url');
    if (found.length >= 24) break;
  }

  return found.slice(0, 24);
}

/**
 * Sanitize fetched HTML:
 *  - Removes ad scripts/iframes/containers and tracking pixels
 *  - Strips untrusted inline executable scripts (prevents pop-ups, anti-adblock traps, cryptominers)
 *  - Resolves relative assets via <base> and injects a tiny safe navigation & media postMessage bridge
 */
export function buildProxiedAssetUrl(rawUrl, baseUrl, proxyOrigin = '') {
  const s = String(rawUrl || '').trim();
  if (!s || /^data:/i.test(s) || /^blob:/i.test(s) || /^javascript:/i.test(s) || /^#/i.test(s)) {
    return s;
  }
  if (s.includes('/api/web-proxy?mode=asset')) {
    return s;
  }
  let resolved;
  try {
    resolved = new URL(s, baseUrl).toString();
  } catch {
    return s;
  }
  if (!/^https?:\/\//i.test(resolved)) return s;
  if (!proxyOrigin) return resolved;
  let refOrigin = '';
  try {
    refOrigin = `${new URL(baseUrl).origin}/`;
  } catch {
    refOrigin = '';
  }
  const refPart = refOrigin ? `&ref=${encodeURIComponent(refOrigin)}` : '';
  return `${proxyOrigin}/api/web-proxy?mode=asset&url=${encodeURIComponent(resolved)}${refPart}`;
}

export function sanitizeAndRewriteHtml(
  rawHtml,
  finalUrl,
  { adBlock = true, antiTrack = true, darkTheme = false, proxyOrigin = '', detectedMedia = [] } = {}
) {
  let html = String(rawHtml || '');
  let blockedAds = 0;
  let blockedTrackers = 0;

  // Remove <meta http-equiv="refresh"> and CSP metas that interfere with sandboxed rendering
  html = html.replace(/<meta[^>]+http-equiv\s*=\s*["'](?:content-security-policy|x-frame-options|refresh)["'][^>]*>/gi, '');

  // Strip ad & tracker <script> tags and untrusted scripts to guarantee zero pop-ups / cryptominers
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (_full, attrs, body) => {
    const combined = `${attrs || ''} ${body || ''}`;
    if (adBlock && matchesAnyPattern(combined, AD_DOMAIN_PATTERNS)) {
      blockedAds += 1;
      return '';
    }
    if (antiTrack && matchesAnyPattern(combined, TRACKER_DOMAIN_PATTERNS)) {
      blockedTrackers += 1;
      return '';
    }
    // Strip arbitrary third-party scripts in proxy sandbox to enforce 100% anti-popup, anti-malware & anti-fingerprint
    return '';
  });

  // Remove <noscript> tracking pixels & ad iframes
  html = html.replace(/<iframe\b([^>]*)>[\s\S]*?<\/iframe>/gi, (full, attrs) => {
    if (adBlock && matchesAnyPattern(attrs, AD_DOMAIN_PATTERNS)) {
      blockedAds += 1;
      return '';
    }
    if (antiTrack && matchesAnyPattern(attrs, TRACKER_DOMAIN_PATTERNS)) {
      blockedTrackers += 1;
      return '';
    }
    // Keep legitimate video embed iframes (YouTube/Vimeo/Dailymotion/embed players) safely sandboxed, block ad frames
    if (
      /(youtube\.com|youtube-nocookie\.com|youtu\.be|player\.vimeo\.com|dailymotion\.com|ok\.ru|vk\.com\/video|rumble\.com|archive\.org\/embed|streamable\.com|\/embed\/|\/player\/|player\.|stream\.)/i.test(
        attrs
      )
    ) {
      let cleanedFrame = full.replace(/\s+sandbox\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
      const lazyIframeSrc = attrs.match(/\bdata-src\s*=\s*["']([^"']+)["']/i)?.[1];
      const curIframeSrc = attrs.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1] || '';
      if (lazyIframeSrc && (!curIframeSrc || curIframeSrc === 'about:blank') && !/^javascript:/i.test(lazyIframeSrc)) {
        const resolvedFrameSrc = escapeHtmlAttr(resolveSafeHttpUrl(decodeHtmlEntities(lazyIframeSrc), finalUrl) || lazyIframeSrc);
        if (/\bsrc\s*=/i.test(cleanedFrame)) {
          cleanedFrame = cleanedFrame.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${resolvedFrameSrc}"`);
        } else {
          cleanedFrame = cleanedFrame.replace(/<iframe/i, `<iframe src="${resolvedFrameSrc}"`);
        }
      }
      return cleanedFrame.replace(
        /<iframe/i,
        '<iframe referrerpolicy="no-referrer" loading="lazy" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"'
      );
    }
    blockedAds += 1;
    return '';
  });

  // Clean any Wayback Archive toolbar or /web/<timestamp>/ URL prefixes so CSS & images never 404
  html = cleanWaybackHtml(html);

  // Strip 1x1 tracking pixel images, promote lazy-loaded data-* thumbnails, and route through asset proxy
  // with `data-wpb-orig` preserved for automatic 3-tier self-healing fallback (proxy -> wsrv.nl -> direct)
  html = html.replace(/<img\b([^>]*)>/gi, (_full, attrs) => {
    if (antiTrack) {
      if (matchesAnyPattern(attrs, TRACKER_DOMAIN_PATTERNS) || matchesAnyPattern(attrs, AD_DOMAIN_PATTERNS)) {
        blockedTrackers += 1;
        return '';
      }
      if (/\b(?:width|height)\s*=\s*["']?1["']?/i.test(attrs) && /pixel|track|beacon|analytics/i.test(attrs)) {
        blockedTrackers += 1;
        return '';
      }
    }
    let nextAttrs = attrs;
    const lazyMatch = nextAttrs.match(
      /\b(?:data-src|data-original|data-lazy-src|data-lazy|data-img-src|data-thumb|data-echo|data-url|data-image)\s*=\s*["']([^"']+)["']/i
    );
    const currentSrc = nextAttrs.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1] || '';
    const isPlaceholder =
      !currentSrc ||
      /^data:image\//i.test(currentSrc) ||
      /(blank|spacer|placeholder|loading|transparent|1x1|pixel\.gif|grey\.gif)/i.test(currentSrc);

    let chosenSrc = currentSrc;
    const hasValidLazy =
      Boolean(lazyMatch?.[1]) && !/^(?:javascript|data):/i.test(lazyMatch[1].trim());
    if (hasValidLazy && (isPlaceholder || lazyMatch[1].trim() !== currentSrc.trim())) {
      chosenSrc = lazyMatch[1];
    } else if (!chosenSrc || isPlaceholder) {
      // Fallback: extract first URL from data-srcset or srcset if src is empty/placeholder
      const srcsetMatch = nextAttrs.match(/\b(?:data-srcset|srcset)\s*=\s*["']([^"']+)["']/i);
      if (srcsetMatch?.[1]) {
        const firstUrl = srcsetMatch[1].split(',')[0].trim().split(/\s+/)[0];
        if (firstUrl && !/^javascript:/i.test(firstUrl)) chosenSrc = firstUrl;
      }
    }

    if (chosenSrc) {
      const decodedChosen = decodeHtmlEntities(chosenSrc);
      const absOrig = resolveSafeHttpUrl(decodedChosen, finalUrl);
      const proxiedImg = escapeHtmlAttr(buildProxiedAssetUrl(decodedChosen, finalUrl, proxyOrigin));
      if (/\bsrc\s*=/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${proxiedImg}"`);
      } else {
        nextAttrs = ` src="${proxiedImg}"${nextAttrs}`;
      }
      if (absOrig && !/\bdata-wpb-orig\s*=/i.test(nextAttrs)) {
        nextAttrs += ` data-wpb-orig="${escapeHtmlAttr(absOrig)}"`;
      }
      // Drop unproxied srcset so browser uses our proxied src + 3-tier self-healing loader
      if (proxyOrigin) {
        nextAttrs = nextAttrs.replace(/\s+(?:data-)?srcset\s*=\s*(?:"[^"]*"|'[^']*')/gi, '');
      }
    }

    // Strip crossorigin attribute & eager-load lazy thumbnails
    nextAttrs = nextAttrs
      .replace(/\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
      .replace(/\s+loading\s*=\s*["']lazy["']/gi, '');
    if (!/\breferrerpolicy\s*=/i.test(nextAttrs)) {
      nextAttrs = ` referrerpolicy="no-referrer"${nextAttrs}`;
    }
    return `<img${nextAttrs}>`;
  });

  // Rewrite <video> & <audio> src/poster through streaming Range-capable asset proxy with self-healing metadata
  html = html.replace(/<(video|audio)\b([^>]*)>/gi, (_full, tag, attrs) => {
    let nextAttrs = attrs.replace(/\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
    const lazySrc = nextAttrs.match(/\b(?:data-src|data-video-src|data-url)\s*=\s*["']([^"']+)["']/i)?.[1];
    const rawSrc = nextAttrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || lazySrc || '';
    if (rawSrc && !/^javascript:/i.test(rawSrc)) {
      const decoded = decodeHtmlEntities(rawSrc);
      const absOrig = resolveSafeHttpUrl(decoded, finalUrl);
      const proxied = escapeHtmlAttr(buildProxiedAssetUrl(decoded, finalUrl, proxyOrigin));
      if (/\bsrc\s*=/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${proxied}"`);
      } else {
        nextAttrs = ` src="${proxied}"${nextAttrs}`;
      }
      if (absOrig && !/\bdata-wpb-orig\s*=/i.test(nextAttrs)) {
        nextAttrs += ` data-wpb-orig="${escapeHtmlAttr(absOrig)}"`;
      }
    }
    const lazyPoster = nextAttrs.match(/\bdata-poster\s*=\s*["']([^"']+)["']/i)?.[1];
    const rawPoster = nextAttrs.match(/\bposter\s*=\s*["']([^"']+)["']/i)?.[1] || lazyPoster || '';
    if (rawPoster && !/^javascript:/i.test(rawPoster)) {
      const decodedPoster = decodeHtmlEntities(rawPoster);
      const absPoster = resolveSafeHttpUrl(decodedPoster, finalUrl);
      const proxiedPoster = escapeHtmlAttr(buildProxiedAssetUrl(decodedPoster, finalUrl, proxyOrigin));
      if (/\bposter\s*=/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\bposter\s*=\s*["'][^"']*["']/i, `poster="${proxiedPoster}"`);
      } else {
        nextAttrs = ` poster="${proxiedPoster}"${nextAttrs}`;
      }
      if (absPoster && !/\bdata-wpb-orig-poster\s*=/i.test(nextAttrs)) {
        nextAttrs += ` data-wpb-orig-poster="${escapeHtmlAttr(absPoster)}"`;
      }
    }
    if (!/\bcontrols\b/i.test(nextAttrs)) nextAttrs += ' controls';
    if (tag.toLowerCase() === 'video' && !/\bplaysinline\b/i.test(nextAttrs)) nextAttrs += ' playsinline';
    if (!/\bpreload\s*=/i.test(nextAttrs)) nextAttrs += ' preload="metadata"';
    return `<${tag}${nextAttrs}>`;
  });

  // Unwrap <picture> <source srcset> (so self-healing <img> wins) & rewrite video/audio <source src>
  html = html.replace(/<source\b([^>]*)>/gi, (_full, attrs) => {
    let nextAttrs = attrs;
    const isImageSource = /\bsrcset\s*=/i.test(nextAttrs) && !/\bsrc\s*=/i.test(nextAttrs);
    if (proxyOrigin && isImageSource) {
      return '';
    }
    const lazySrc = nextAttrs.match(/\b(?:data-src|data-url)\s*=\s*["']([^"']+)["']/i)?.[1];
    const rawSrc = nextAttrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] || lazySrc || '';
    if (rawSrc && !/^javascript:/i.test(rawSrc)) {
      const decoded = decodeHtmlEntities(rawSrc);
      const absOrig = resolveSafeHttpUrl(decoded, finalUrl);
      const proxied = escapeHtmlAttr(buildProxiedAssetUrl(decoded, finalUrl, proxyOrigin));
      if (/\bsrc\s*=/i.test(nextAttrs)) {
        nextAttrs = nextAttrs.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${proxied}"`);
      } else {
        nextAttrs = ` src="${proxied}"${nextAttrs}`;
      }
      if (absOrig && !/\bdata-wpb-orig\s*=/i.test(nextAttrs)) {
        nextAttrs += ` data-wpb-orig="${escapeHtmlAttr(absOrig)}"`;
      }
    }
    return `<source${nextAttrs}>`;
  });

  // If a page's JS normally hydrates <video> at runtime (so <video> has no src and no child <source src>),
  // automatically attach the first detected video stream (proxied + original fallback) so playback works immediately!
  const fallbackVideoMedia = Array.isArray(detectedMedia)
    ? detectedMedia.find((m) => m && m.kind === 'video' && m.url)
    : null;
  if (fallbackVideoMedia?.url) {
    const fallbackProxiedVideo = escapeHtmlAttr(
      buildProxiedAssetUrl(fallbackVideoMedia.url, finalUrl, proxyOrigin)
    );
    const fallbackOrigVideo = escapeHtmlAttr(fallbackVideoMedia.url);
    html = html.replace(/<video\b([^>]*)>([\s\S]*?)<\/video>/gi, (full, attrs, inner) => {
      const hasDirectSrc = /\bsrc\s*=\s*["'][^"']+["']/i.test(attrs);
      const hasChildSource = /<source\b[^>]*\bsrc\s*=\s*["'][^"']+["']/i.test(inner);
      if (hasDirectSrc || hasChildSource) return full;
      return `<video${attrs} src="${fallbackProxiedVideo}" data-wpb-orig="${fallbackOrigVideo}">${inner}</video>`;
    });
  }

  // Promote lazy background thumbnails (data-bg / data-background-image) & proxy inline background-image URLs
  html = html.replace(
    /<(div|a|span|section|article|figure|li)\b([^>]*\b(?:data-bg|data-background|data-background-image)\s*=\s*["']([^"']+)["'][^>]*)>/gi,
    (_full, tag, attrs, bgUrl) => {
      if (!bgUrl || /^javascript:/i.test(bgUrl)) return `<${tag}${attrs}>`;
      const proxiedBg = escapeHtmlAttr(buildProxiedAssetUrl(decodeHtmlEntities(bgUrl), finalUrl, proxyOrigin));
      if (/\bstyle\s*=\s*["']/i.test(attrs)) {
        const updated = attrs.replace(
          /\bstyle\s*=\s*(["'])([^"']*)\1/i,
          (_m, q, st) => `style=${q}${st};background-image:url('${proxiedBg}');background-size:cover;background-position:center;${q}`
        );
        return `<${tag}${updated}>`;
      }
      return `<${tag}${attrs} style="background-image:url('${proxiedBg}');background-size:cover;background-position:center;">`;
    }
  );

  if (proxyOrigin) {
    html = html.replace(
      /background(?:-image)?\s*:\s*url\(\s*(['"]?)(https?:\/\/[^'")\s]+)\1\s*\)/gi,
      (_full, _q, rawBg) => {
        if (rawBg.includes('/api/web-proxy?mode=asset')) return _full;
        const proxied = buildProxiedAssetUrl(decodeHtmlEntities(rawBg), finalUrl, proxyOrigin);
        return `background-image:url("${proxied}")`;
      }
    );
  }

  // Promote async <link rel="preload" as="style"> to real stylesheets & strip crossorigin/integrity
  // so sandboxed srcdoc iframes (opaque null origin) never drop external site CSS
  html = html.replace(/<link\b([^>]*)>/gi, (_full, attrs) => {
    let nextAttrs = attrs;
    if (/\brel\s*=\s*["']preload["']/i.test(nextAttrs) && /\bas\s*=\s*["']style["']/i.test(nextAttrs)) {
      nextAttrs = nextAttrs
        .replace(/\brel\s*=\s*["']preload["']/i, 'rel="stylesheet"')
        .replace(/\s+as\s*=\s*["']style["']/i, '');
    }
    if (/\brel\s*=\s*["'][^"']*stylesheet[^"']*["']/i.test(nextAttrs)) {
      nextAttrs = nextAttrs
        .replace(/\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
        .replace(/\s+integrity\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    }
    return `<link${nextAttrs}>`;
  });

  // Strip inline event handlers (onclick=, onerror=, onload=, etc.) to block XSS/popunder injection
  html = html.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Neutralize javascript: URLs
  html = html.replace(/\b(href|src|action)\s*=\s*["']\s*javascript:[^"']*["']/gi, '$1="#"');
  // Remove existing <base> tags so ours wins cleanly
  html = html.replace(/<base\b[^>]*>/gi, '');

  const originSafeBase = escapeHtmlAttr(finalUrl);
  // Preserve each website's authentic light/dark CSS — never force dark color-scheme onto external sites
  void darkTheme;
  const proxyHelperCss = `
    <style data-manifest-proxy-style>
      html, body { max-width: 100% !important; overflow-x: hidden !important; }
      img, video, iframe, table { max-width: 100% !important; height: auto; }
      img[src], img.lazyload, img.lazy, img.lozad, .lazyload, .lazy { opacity: 1 !important; visibility: visible !important; }
      video { background: #000000; display: block; }
      [id*="google_ads"], [id*="div-gpt-ad"], [class*="adsbygoogle"], [class*="ad-banner"], [class*="ad-slot"],
      [class*="advertisement"], [class*="billboard-ad"], [class*="top-banner-ad"], [class*="ads-wrapper"],
      [class*="popup-ad"], [class*="sponsored-ad"], [id*="taboola"], [id*="outbrain"],
      ins.adsbygoogle { display: none !important; }
    </style>
  `;

  // Safe navigation + 3-tier self-healing thumbnail/video/HLS bridge inside sandboxed iframe
  // (NO allow-same-origin, communicates solely via postMessage)
  const hlsVendorUrl = proxyOrigin ? `${proxyOrigin}/js/vendor/hls.min.js` : '';
  const navBridgeScript = `
    <script data-manifest-proxy-nav>
      (function(){
        var BASE = ${JSON.stringify(finalUrl)};
        var HLS_SRC = ${JSON.stringify(hlsVendorUrl)};
        function resolveNav(raw) {
          if (!raw) return '';
          var s = String(raw).trim();
          if (!s || s.startsWith('#') || /^javascript:/i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return '';
          try { return new URL(s, BASE).toString(); } catch (e) { return ''; }
        }
        function wsrvUrl(orig) {
          return 'https://wsrv.nl/?url=' + encodeURIComponent(orig) + '&n=-1';
        }
        // 3-Tier Self-Healing Image & Video Recovery (Proxy -> wsrv.nl -> Direct)
        document.addEventListener('error', function(e) {
          var el = e.target;
          if (!el || !el.tagName) return;
          var tag = el.tagName.toUpperCase();
          if (tag === 'IMG') {
            var orig = el.getAttribute('data-wpb-orig');
            if (!orig) return;
            var step = Number(el.getAttribute('data-wpb-fb') || '0');
            if (step === 0) {
              el.setAttribute('data-wpb-fb', '1');
              el.src = wsrvUrl(orig);
            } else if (step === 1) {
              el.setAttribute('data-wpb-fb', '2');
              el.src = orig;
            }
            return;
          }
          if (tag === 'SOURCE' && el.parentElement && el.parentElement.tagName === 'VIDEO') {
            var vParent = el.parentElement;
            var sOrig = el.getAttribute('data-wpb-orig');
            var sStep = Number(el.getAttribute('data-wpb-fb') || '0');
            if (sOrig && sStep === 0) {
              el.setAttribute('data-wpb-fb', '1');
              el.src = sOrig;
              try { vParent.load(); } catch (err) {}
            }
            return;
          }
          if (tag === 'VIDEO' || tag === 'AUDIO') {
            var mOrig = el.getAttribute('data-wpb-orig');
            var mStep = Number(el.getAttribute('data-wpb-fb') || '0');
            if (mOrig && mStep === 0) {
              el.setAttribute('data-wpb-fb', '1');
              el.src = mOrig;
              try { el.load(); } catch (err) {}
            }
          }
        }, true);

        // Self-healing <video poster> + Same-Origin HLS.js auto-engine for .m3u8 streams
        function initMediaEnhancements() {
          var videos = document.querySelectorAll('video');
          var hlsTargets = [];
          videos.forEach(function(v) {
            var origPoster = v.getAttribute('data-wpb-orig-poster');
            if (origPoster && v.poster && v.poster.indexOf('/api/web-proxy?mode=asset') !== -1) {
              var probe = new Image();
              probe.referrerPolicy = 'no-referrer';
              probe.onerror = function() {
                var p2 = new Image();
                p2.referrerPolicy = 'no-referrer';
                p2.onload = function() { v.poster = wsrvUrl(origPoster); };
                p2.onerror = function() { v.poster = origPoster; };
                p2.src = wsrvUrl(origPoster);
              };
              probe.src = v.poster;
            }
            var srcEl = v.querySelector('source[src]');
            var activeUrl = v.getAttribute('src') || (srcEl && srcEl.getAttribute('src')) || '';
            var origUrl = v.getAttribute('data-wpb-orig') || (srcEl && srcEl.getAttribute('data-wpb-orig')) || '';
            if (/\.m3u8(?:$|[?#%&])/i.test(origUrl) || /\.m3u8(?:$|[?#%&])/i.test(activeUrl)) {
              hlsTargets.push({ video: v, proxied: activeUrl, orig: origUrl });
            }
          });
          if (hlsTargets.length > 0 && HLS_SRC) {
            var sc = document.createElement('script');
            sc.src = HLS_SRC;
            sc.onload = function() {
              if (!window.Hls || !window.Hls.isSupported()) return;
              hlsTargets.forEach(function(item) {
                var hls = new window.Hls({ enableWorker: false, lowLatencyMode: false });
                var triedDirect = false;
                hls.on(window.Hls.Events.ERROR, function(_ev, data) {
                  if (data && data.fatal && !triedDirect && item.orig && item.orig !== item.proxied) {
                    triedDirect = true;
                    hls.loadSource(item.orig);
                  }
                });
                hls.loadSource(item.proxied || item.orig);
                hls.attachMedia(item.video);
              });
            };
            document.head.appendChild(sc);
          }
        }
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initMediaEnhancements);
        } else {
          initMediaEnhancements();
        }

        document.addEventListener('click', function(e) {
          var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
          if (!a) return;
          var href = a.getAttribute('href') || '';
          if (href.startsWith('#')) return;
          var target = resolveNav(href);
          if (!target) return;
          e.preventDefault();
          e.stopPropagation();
          window.parent.postMessage({ type: 'MANIFEST_PROXY_NAV', url: target }, '*');
        }, true);
        document.addEventListener('submit', function(e) {
          var form = e.target;
          if (!form || form.tagName !== 'FORM') return;
          var action = resolveNav(form.getAttribute('action') || BASE);
          if (!action) return;
          e.preventDefault();
          var method = String(form.getAttribute('method') || 'GET').toUpperCase();
          if (method === 'GET') {
            try {
              var u = new URL(action);
              var fd = new FormData(form);
              fd.forEach(function(v, k){ if (typeof v === 'string') u.searchParams.set(k, v); });
              window.parent.postMessage({ type: 'MANIFEST_PROXY_NAV', url: u.toString() }, '*');
            } catch (err) {}
          }
        }, true);
      })();
    </script>
  `;

  const headInjection = `<meta charset="utf-8"><meta name="referrer" content="no-referrer"><base href="${originSafeBase}">${proxyHelperCss}`;

  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${headInjection}`);
  } else {
    html = `<!doctype html><html><head>${headInjection}</head><body>${html}</body></html>`;
  }

  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${navBridgeScript}\n</body>`);
  } else {
    html += navBridgeScript;
  }

  return {
    sanitizedHtml: html,
    blockedAds,
    blockedTrackers,
  };
}

function buildSecurityAudit(finalUrl, { blockedAds = 0, blockedTrackers = 0, contentType = '' } = {}) {
  const warnings = [];
  let score = 96;
  let parsed;
  try {
    parsed = new URL(finalUrl);
  } catch {
    return { level: 'danger', score: 20, label: 'Tautan Tidak Valid', warnings: ['URL tidak dapat diverifikasi.'] };
  }

  if (parsed.protocol === 'http:') {
    score -= 18;
    warnings.push('Situs masih memakai HTTP tanpa enkripsi TLS; proxy melindungi identitas Anda, hindari memasukkan kata sandi.');
  }
  if (MALWARE_DANGEROUS_EXT_RE.test(parsed.pathname)) {
    score -= 45;
    warnings.push('Tautan mengarah ke berkas eksekusi/installer berisiko tinggi (APK/EXE/MSI).');
  }
  if (PHISHING_HOST_HINT_RE.test(parsed.hostname)) {
    score -= 40;
    warnings.push('Pola domain menyerupai situs phishing/penipuan. Jangan masukkan data pribadi atau OTP.');
  }
  if (/xn--/i.test(parsed.hostname)) {
    score -= 22;
    warnings.push('Domain menggunakan Punycode (IDN) yang sering dipakai untuk penyamaran domain.');
  }
  if (blockedAds + blockedTrackers >= 8) {
    score -= 8;
    warnings.push(`Diblokir ${blockedAds} iklan & ${blockedTrackers} pelacak agresif dari halaman ini.`);
  }
  if (/application\/x-msdownload|application\/vnd\.android\.package-archive/i.test(contentType)) {
    score -= 45;
    warnings.push('Server mengembalikan berkas biner/aplikasi yang berpotensi malware.');
  }

  score = Math.max(10, Math.min(100, score));
  const level = score >= 80 ? 'safe' : score >= 55 ? 'caution' : 'danger';
  const label =
    level === 'safe'
      ? 'Aman & Terlindungi'
      : level === 'caution'
      ? 'Waspada — Proteksi Aktif'
      : 'Berisiko Tinggi — Diblokir/Peringatan';

  return { level, score, label, warnings };
}

/**
 * Strips Wayback Archive injected toolbar & rewrites /web/<timestamp>/ URLs back to original hosts
 * so stylesheets and images never 404 when loaded inside the proxy iframe.
 */
export function cleanWaybackHtml(rawHtml = '') {
  let out = String(rawHtml || '');
  if (!/web\.archive\.org|BEGIN WAYBACK TOOLBAR|\/web\/\d{8,14}/i.test(out)) {
    return out;
  }
  out = out.replace(/<!--\s*BEGIN WAYBACK TOOLBAR INSERT\s*-->[\s\S]*?<!--\s*END WAYBACK TOOLBAR INSERT\s*-->/gi, '');
  out = out.replace(/<script[^>]+archive\.org[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<link[^>]+archive\.org\/_static\/[^>]*>/gi, '');
  out = out.replace(/(?:https?:\/\/web\.archive\.org)?\/web\/\d{8,14}(?:[a-z_]+)?\/(https?:\/\/[^"'\s)>]+)/gi, '$1');
  out = out.replace(/(?:https?:\/\/web\.archive\.org)?\/web\/\d{8,14}(?:[a-z_]+)?\/(\/\/[^"'\s)>]+)/gi, 'https:$1');
  return out;
}

/**
 * Fallback anti-bot mirror cascade:
 *  1. Jina Headless Browser (`X-Return-Format: html`) — executes JS challenges, resolves "Please visit" stubs,
 *     hydrates lazy thumbnails & video elements, and returns REAL full-CSS HTML!
 *  2. AllOrigins & CodeTabs community relays — bypass Cloudflare-Worker IP blocks
 *  3. Jina Clean Markdown Reader — clean article fallback
 *  4. Wayback Archive Raw (`id_`) — historical snapshot fallback
 */
async function fetchViaFallbackMirror(targetUrl, preferredNode = 'reader-antibot', { allowWayback = true } = {}) {
  const attempts = [];

  // 1. Jina Headless HTML Mirror (preserves real site layout, thumbnails & video tags while bypassing JS/cookie walls)
  if (preferredNode === 'reader-antibot' || preferredNode === 'multi-hop-auto' || preferredNode === 'vpn-relay') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 11000);
      const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
        headers: {
          'X-Return-Format': 'html',
          'X-No-Cache': 'true',
          'X-Timeout': '10',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const html = await readTextCapped(res, MAX_HTML_BYTES);
        const looksHtml = /<(?:html|body|div|main|article|section|video|img)\b/i.test(html);
        const stub = detectInterstitialOrRedirect(html, targetUrl);
        if (looksHtml && html.trim().length > 220 && !stub) {
          return {
            ok: true,
            relayUsed: 'Headless Anti-Bot Browser Relay',
            html,
            textSnippet: extractPlainTextSnippet(html),
            title: '',
          };
        }
      }
      attempts.push({ relay: 'Jina Headless HTML', status: res.status });
    } catch {
      attempts.push({ relay: 'Jina Headless HTML', status: 'timeout' });
    }
  }

  // 2. AllOrigins & CodeTabs free community proxies (non-Cloudflare-Worker egress IPs)
  for (const relay of [
    { name: 'AllOrigins Community Relay', url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}` },
    { name: 'CodeTabs Community Relay', url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}` },
  ]) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      const res = await fetch(relay.url, { signal: controller.signal }).finally(() => clearTimeout(timer));
      if (res.ok) {
        const html = await readTextCapped(res, MAX_HTML_BYTES);
        const stub = detectInterstitialOrRedirect(html, targetUrl);
        if (html.trim().length > 120 && !stub) {
          return {
            ok: true,
            relayUsed: relay.name,
            html,
            textSnippet: extractPlainTextSnippet(html),
            title: '',
          };
        }
      }
      attempts.push({ relay: relay.name, status: res.status });
    } catch {
      attempts.push({ relay: relay.name, status: 'timeout' });
    }
  }

  // 3. Jina Clean Markdown Reader (always-readable clean text + images fallback)
  if (preferredNode === 'reader-antibot' || preferredNode === 'multi-hop-auto' || preferredNode === 'vpn-relay') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8500);
      const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
        headers: {
          Accept: 'text/plain',
          'X-No-Cache': 'true',
        },
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const md = (await res.text()).slice(0, 120000);
        if (md.trim().length > 40) {
          const titleLine = md.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || new URL(targetUrl).hostname;
          const cleanBody = md
            .replace(/^Title:.*\n?/m, '')
            .replace(/^URL Source:.*\n?/m, '')
            .replace(/^Published Time:.*\n?/m, '')
            .replace(/^Markdown Content:\s*\n?/m, '')
            .trim();
          const MD_URL_PAT = 'https?:\\/\\/(?:[^()\\s]+|\\([^()\\s]*\\))+';
          const mdImgRe = new RegExp(`!\\[([^\\]]*)\\]\\((${MD_URL_PAT})\\)`, 'g');
          const mdLinkRe = new RegExp(`\\[([^\\]]+)\\]\\((${MD_URL_PAT})\\)`, 'g');
          const paragraphs = cleanBody
            .split(/\n{2,}/)
            .slice(0, 90)
            .map((block) => {
              const trimmed = block.trim();
              if (!trimmed) return '';
              const formatted = escapeHtmlAttr(trimmed)
                .replace(mdImgRe, '<figure><img src="$2" alt="$1" referrerpolicy="no-referrer"></figure>')
                .replace(mdLinkRe, '<a href="$2">$1</a>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
              if (trimmed.startsWith('# ')) return `<h1>${formatted.slice(2)}</h1>`;
              if (trimmed.startsWith('## ')) return `<h2>${formatted.slice(3)}</h2>`;
              if (trimmed.startsWith('### ')) return `<h3>${formatted.slice(4)}</h3>`;
              return `<p>${formatted}</p>`;
            })
            .filter(Boolean)
            .join('\n');

          const readerHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtmlAttr(titleLine)}</title><style>
            :root{color-scheme:light;}
            body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.72;max-width:780px;margin:0 auto;padding:22px 18px 40px;color:#0f172a;background:#ffffff;}
            article{display:flex;flex-direction:column;gap:0.75rem;}
            h1{font-size:1.55rem;line-height:1.25;margin:0 0 0.5rem;color:#020617;}
            h2{font-size:1.22rem;line-height:1.3;margin:1rem 0 0.35rem;color:#0f172a;}
            h3{font-size:1.05rem;line-height:1.35;margin:0.85rem 0 0.25rem;color:#1e293b;}
            p{margin:0;color:#1e293b;word-break:break-word;}
            a{color:#2563eb;text-decoration:none;font-weight:500;} a:hover{text-decoration:underline;}
            figure{margin:0.6rem 0;} img{max-width:100%;height:auto;border-radius:10px;display:block;}
            pre,code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.9em;}
          </style></head><body><article><h1>${escapeHtmlAttr(titleLine)}</h1>${paragraphs}</article></body></html>`;

          return {
            ok: true,
            relayUsed: 'Jina Anti-Bot Reader (Open-Source)',
            html: readerHtml,
            textSnippet: cleanBody.slice(0, 2600),
            title: titleLine,
          };
        }
      }
      attempts.push({ relay: 'Jina Reader', status: res.status });
    } catch {
      attempts.push({ relay: 'Jina Reader', status: 'timeout' });
    }
  }

  // 4. Wayback Archive Raw Snapshot (uses id_ flag + cleanWaybackHtml so CSS & images stay intact)
  if (allowWayback) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      const availRes = await fetch(
        `https://archive.org/wayback/available?url=${encodeURIComponent(targetUrl)}`,
        { signal: controller.signal }
      ).finally(() => clearTimeout(timer));
      if (availRes.ok) {
        const json = await availRes.json();
        let snapUrl = json?.archived_snapshots?.closest?.url || '';
        if (snapUrl) {
          // Request unmodified original HTML using Wayback's `id_` modifier to prevent broken /web/... CSS links
          snapUrl = snapUrl.replace(/^http:\/\//i, 'https://').replace(/(\/web\/\d{8,14})(\/)/, '$1id_$2');
          const snapRes = await fetch(snapUrl);
          if (snapRes.ok) {
            const html = cleanWaybackHtml(await readTextCapped(snapRes, MAX_HTML_BYTES));
            return {
              ok: true,
              relayUsed: 'Internet Archive (Wayback Clean)',
              html,
              textSnippet: extractPlainTextSnippet(html),
              title: '',
            };
          }
        }
      }
    } catch {
      attempts.push({ relay: 'Wayback Archive', status: 'unavailable' });
    }
  }

  return { ok: false, attempts };
}

/**
 * Privacy Web Search across Google Privat (basic HTML + News RSS), DuckDuckGo HTML, Wikipedia OpenSearch,
 * and Multi-Search public relays — zero personal cookies or tracking headers.
 */
async function handlePrivacySearch(query, engine = 'google') {
  const q = String(query || '').trim().slice(0, 260);
  if (!q) {
    return jsonResponse({ ok: false, error: 'Masukkan kata kunci pencarian.' }, 400);
  }

  const results = [];
  const usedEngines = [];

  // Engine G: Google Search Privat (clean basic HTML `gbv=1` + Google News RSS fallback, 0 cookies)
  if (engine === 'google' || engine === 'auto' || engine === 'searxng') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7500);
      const res = await fetch(
        `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=id&gl=id&num=12&gbv=1`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Lynx/2.8.9rel.1 libwww-FM/2.14)',
            Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
          },
          signal: controller.signal,
        }
      ).finally(() => clearTimeout(timer));

      if (res.ok) {
        const html = await readTextCapped(res, 240 * 1024);
        const gRe = /<a[^>]+href="\/url\?q=(https?:\/\/[^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = gRe.exec(html)) !== null && results.length < 12) {
          let href = '';
          try {
            href = decodeURIComponent(decodeHtmlEntities(match[1]));
          } catch {
            href = decodeHtmlEntities(match[1]);
          }
          if (/google\.com\/(?:preferences|accounts|policies|support|webhp|search)/i.test(href)) continue;
          const check = validatePublicProxyUrl(href);
          if (!check.ok || results.some((r) => r.url === check.url)) continue;
          const rawTitle = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
          if (!rawTitle || rawTitle.length < 3 || /^cached$|^similar$/i.test(rawTitle)) continue;
          results.push({
            title: rawTitle.slice(0, 140),
            url: check.url,
            displayHost: check.hostname,
            snippet: `Hasil Google Privat untuk "${q}" — dibuka aman lewat jalur proxy tanpa pelacak.`,
            source: 'Google Privat',
          });
        }
        if (results.length > 0) usedEngines.push('Google Privat');
      }
    } catch {
      // Fallback below
    }

    // Google News RSS supplement when Google Web HTML returns < 4 items (reliable from Edge IPs!)
    if (engine === 'google' && results.length < 4) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5500);
        const rssRes = await fetch(
          `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`,
          { headers: buildStealthHeaders('proxy-stealth', 'application/rss+xml,text/xml'), signal: controller.signal }
        ).finally(() => clearTimeout(timer));
        if (rssRes.ok) {
          const xml = await readTextCapped(rssRes, 140 * 1024);
          const itemRe = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?(?:<source[^>]*>([\s\S]*?)<\/source>)?[\s\S]*?<\/item>/gi;
          let m;
          let addedNews = 0;
          while ((m = itemRe.exec(xml)) !== null && addedNews < 5 && results.length < 12) {
            const title = decodeHtmlEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
            const link = decodeHtmlEntities(m[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
            const src = decodeHtmlEntities((m[3] || 'Google News').replace(/<!\[CDATA\[|\]\]>/g, '').trim());
            const check = validatePublicProxyUrl(link);
            if (!check.ok || !title || results.some((r) => r.url === check.url)) continue;
            results.push({
              title: title.slice(0, 150),
              url: check.url,
              displayHost: src || check.hostname,
              snippet: `Indeks Google News (${src}) — dibuka privat tanpa cookie.`,
              source: 'Google News',
            });
            addedNews += 1;
          }
          if (addedNews > 0 && !usedEngines.includes('Google News')) usedEngines.push('Google News');
        }
      } catch {
        // Ignore RSS failure
      }
    }
  }

  // Engine A: DuckDuckGo HTML (free, privacy-first, no cookies; also acts as instant organic backup for Google mode)
  if (engine === 'duckduckgo' || engine === 'auto' || engine === 'searxng' || (engine === 'google' && results.length < 6)) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8500);
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
        headers: buildStealthHeaders('vpn-relay'),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.ok) {
        const html = await readTextCapped(res, 220 * 1024);
        const itemRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>)?/gi;
        let match;
        while ((match = itemRe.exec(html)) !== null && results.length < 14) {
          let href = decodeHtmlEntities(match[1]);
          // Unwrap DuckDuckGo uddg redirect
          const uddgMatch = href.match(/[?&]uddg=([^&]+)/i);
          if (uddgMatch?.[1]) {
            try {
              href = decodeURIComponent(uddgMatch[1]);
            } catch {
              // keep raw
            }
          }
          const check = validatePublicProxyUrl(href);
          if (!check.ok || results.some((r) => r.url === check.url)) continue;
          const title = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ''));
          const snippet = decodeHtmlEntities((match[3] || match[4] || '').replace(/<[^>]+>/g, ''));
          if (title) {
            results.push({
              title,
              url: check.url,
              displayHost: check.hostname,
              snippet: snippet || 'Hasil pencarian privat bebas pelacak.',
              source: engine === 'google' ? 'Google Relay · Web' : 'DuckDuckGo Privacy',
            });
          }
        }
        if (results.length > 0 && !usedEngines.includes('DuckDuckGo Privacy')) {
          usedEngines.push(engine === 'google' ? 'Google Web Relay' : 'DuckDuckGo Privacy');
        }
      }
    } catch {
      // Fallback below
    }
  }

  // Engine B: Wikipedia OpenSearch (ID + EN instant knowledge results)
  if (engine === 'wikipedia' || results.length < 4) {
    const wikiLangs = engine === 'wikipedia' ? ['id', 'en'] : ['id'];
    for (const lang of wikiLangs) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5500);
        const res = await fetch(
          `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=6&namespace=0&format=json`,
          { headers: buildStealthHeaders('proxy-stealth', 'application/json'), signal: controller.signal }
        ).finally(() => clearTimeout(timer));
        if (res.ok) {
          const data = await res.json();
          const titles = Array.isArray(data?.[1]) ? data[1] : [];
          const descs = Array.isArray(data?.[2]) ? data[2] : [];
          const urls = Array.isArray(data?.[3]) ? data[3] : [];
          for (let i = 0; i < titles.length; i += 1) {
            const url = urls[i];
            if (!url || results.some((r) => r.url === url)) continue;
            results.push({
              title: String(titles[i] || ''),
              url,
              displayHost: `${lang}.wikipedia.org`,
              snippet: String(descs[i] || `Artikel ensiklopedia terbuka (${lang.toUpperCase()}) tentang ${titles[i]}.`),
              source: `Wikipedia (${lang.toUpperCase()})`,
            });
          }
          if (titles.length > 0) usedEngines.push(`Wikipedia ${lang.toUpperCase()}`);
        }
      } catch {
        // Ignore wiki failure
      }
    }
  }

  // Engine C: DuckDuckGo Instant Answer JSON fallback
  if (results.length === 0) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
        { headers: buildStealthHeaders('proxy-stealth', 'application/json'), signal: controller.signal }
      ).finally(() => clearTimeout(timer));
      if (res.ok) {
        const data = await res.json();
        if (data?.AbstractURL && data?.Heading) {
          results.push({
            title: data.Heading,
            url: data.AbstractURL,
            displayHost: new URL(data.AbstractURL).hostname,
            snippet: data.AbstractText || 'Ringkasan pengetahuan terbuka.',
            source: 'DuckDuckGo Instant',
          });
        }
        const related = Array.isArray(data?.RelatedTopics) ? data.RelatedTopics : [];
        for (const item of related.slice(0, 8)) {
          if (item?.FirstURL && item?.Text) {
            results.push({
              title: item.Text.split(' - ')[0].slice(0, 110),
              url: item.FirstURL,
              displayHost: new URL(item.FirstURL).hostname,
              snippet: item.Text,
              source: 'DuckDuckGo Instant',
            });
          }
        }
        if (results.length > 0) usedEngines.push('DuckDuckGo Instant');
      }
    } catch {
      // Ignore
    }
  }

  return jsonResponse({
    ok: true,
    mode: 'search',
    query: q,
    enginesUsed: usedEngines.length > 0 ? usedEngines : ['Privacy Search Relay'],
    results: results.slice(0, 15),
    privacy: {
      zeroLogs: true,
      cookiesForwarded: false,
      trackersBlocked: true,
    },
  });
}

/**
 * Streams a public image, video, audio, or HLS stream safely through the edge proxy with full
 * HTTP Range (206 Partial Content) support, anti-hotlink Referer forwarding, and strict SSRF/malware guards.
 */
async function handleAssetOrDownload(
  targetUrl,
  asDownload = false,
  { rangeHeader = '', refererUrl = '', proxyOrigin = '', method = 'GET' } = {}
) {
  const check = validatePublicProxyUrl(targetUrl);
  if (!check.ok) {
    return jsonResponse({ ok: false, error: check.reason }, 400);
  }
  if (MALWARE_DANGEROUS_EXT_RE.test(new URL(check.url).pathname)) {
    return jsonResponse(
      { ok: false, error: 'Unduhan berkas eksekusi/installer (EXE/APK/MSI) diblokir oleh proteksi anti-malware.' },
      403
    );
  }

  try {
    const targetPath = new URL(check.url).pathname;
    const isLikelyImage = /\.(?:jpe?g|png|webp|gif|avif|svg|ico|jfif)(?:$|\?)/i.test(targetPath);
    const isLikelyAudio = /\.(?:mp3|m4a|ogg|wav|aac|flac)(?:$|\?)/i.test(targetPath);
    const assetKind = isLikelyImage ? 'image' : isLikelyAudio ? 'audio' : 'video';
    const targetOriginRef = `${new URL(check.url).origin}/`;
    const primaryReferer = refererUrl || targetOriginRef;

    let fetched = await fetchWithSafeRedirects(check.url, {
      node: 'proxy-stealth',
      timeoutMs: 18000,
      accept: isLikelyImage ? 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' : '*/*',
      range: !asDownload && rangeHeader ? rangeHeader : '',
      referer: primaryReferer,
      method,
      isAsset: true,
      assetKind,
    });

    // Failover 1: try target's own origin Referer if page Referer was rejected
    if ((fetched.response.status === 401 || fetched.response.status === 403) && primaryReferer !== targetOriginRef) {
      try {
        await fetched.response.body?.cancel?.();
      } catch {
        // ignore
      }
      fetched = await fetchWithSafeRedirects(check.url, {
        node: 'vpn-relay',
        timeoutMs: 16000,
        accept: isLikelyImage ? 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' : '*/*',
        range: !asDownload && rangeHeader ? rangeHeader : '',
        referer: targetOriginRef,
        method,
        isAsset: true,
        assetKind,
      });
    }

    // Failover 2: try with NO Referer (some CDNs strictly reject any cross-site Referer)
    if (fetched.response.status === 401 || fetched.response.status === 403) {
      try {
        await fetched.response.body?.cancel?.();
      } catch {
        // ignore
      }
      fetched = await fetchWithSafeRedirects(check.url, {
        node: 'reader-antibot',
        timeoutMs: 15000,
        accept: isLikelyImage ? 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' : '*/*',
        range: !asDownload && rangeHeader ? rangeHeader : '',
        referer: '',
        method,
        isAsset: true,
        assetKind,
      });
    }

    // Failover 3 (Images): if origin CDN blocks Cloudflare Worker IPs (403/5xx), fetch via free open-source wsrv.nl CDN
    if (!asDownload && isLikelyImage && !fetched.response.ok) {
      try {
        await fetched.response.body?.cancel?.();
      } catch {
        // ignore
      }
      try {
        const wsrvController = new AbortController();
        const wsrvTimer = setTimeout(() => wsrvController.abort(), 9000);
        const wsrvRes = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(check.url)}&n=-1`, {
          method: method === 'HEAD' ? 'HEAD' : 'GET',
          signal: wsrvController.signal,
        }).finally(() => clearTimeout(wsrvTimer));
        if (wsrvRes.ok) {
          fetched = { response: wsrvRes, finalUrl: check.url, hops: fetched.hops };
        }
      } catch {
        // Keep original status error
      }
    }

    const { response, finalUrl } = fetched;
    if (!response.ok && response.status !== 206) {
      return jsonResponse({ ok: false, error: `Server sumber mengembalikan status ${response.status}.` }, 502);
    }

    const contentType = inferMediaMimeFromUrl(finalUrl, response.headers.get('content-type') || '');
    if (/application\/x-msdownload|application\/vnd\.android\.package-archive|application\/x-sh/i.test(contentType)) {
      return jsonResponse({ ok: false, error: 'Tipe berkas berbahaya diblokir oleh anti-malware.' }, 403);
    }

    const filenameRaw = new URL(finalUrl).pathname.split('/').pop() || 'manifestudio-media.mp4';
    const safeFilename = filenameRaw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'manifestudio-media.mp4';

    // Rewrite HLS .m3u8 playlists so video segments also stream cleanly through the proxy
    const isHlsPlaylist =
      !asDownload &&
      (/(mpegurl|m3u8)/i.test(contentType) || /\.m3u8(\?|$)/i.test(new URL(finalUrl).pathname));
    if (isHlsPlaylist) {
      const m3u8Text = await readTextCapped(response, 512 * 1024);
      const rewritten = m3u8Text
        .split(/\r?\n/)
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return line;
          if (trimmed.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/gi, (_m, uri) => `URI="${buildProxiedAssetUrl(uri, finalUrl, proxyOrigin)}"`);
          }
          return buildProxiedAssetUrl(trimmed, finalUrl, proxyOrigin);
        })
        .join('\n');
      return new Response(rewritten, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Cache-Control': 'private, max-age=60',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }

    const outHeaders = new Headers({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Type',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': asDownload ? 'no-store' : 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });

    const acceptRanges = response.headers.get('accept-ranges');
    const contentRange = response.headers.get('content-range');
    const contentLength = response.headers.get('content-length');
    const contentEncoding = response.headers.get('content-encoding');
    if (acceptRanges) outHeaders.set('Accept-Ranges', acceptRanges);
    else if (/^(video|audio)\//i.test(contentType)) outHeaders.set('Accept-Ranges', 'bytes');
    if (contentRange) outHeaders.set('Content-Range', contentRange);
    // Only forward Content-Length when upstream was NOT compressed (fetch transparently decompresses gzip/br bodies)
    if (contentLength && !contentEncoding) outHeaders.set('Content-Length', contentLength);

    if (asDownload) {
      if (Number(contentLength || 0) > MAX_ASSET_BYTES) {
        return jsonResponse(
          { ok: false, error: 'Ukuran berkas melebihi batas unduh langsung 14 MB. Gunakan tombol salin tautan langsung.' },
          413
        );
      }
      outHeaders.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    // Stream directly without buffering entire video files into memory!
    return new Response(method === 'HEAD' ? null : response.body, {
      status: response.status === 206 ? 206 : 200,
      headers: outHeaders,
    });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : 'Gagal memuat media melalui proxy.' },
      502
    );
  }
}

export async function handleWebProxyRequest(request) {
  try {
    const reqUrl = new URL(request.url);
    const proxyOrigin = reqUrl.origin;
    let body = {};
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }

    const mode = String(body.mode || reqUrl.searchParams.get('mode') || 'browse').trim().toLowerCase();
    const rawUrl = String(body.url || reqUrl.searchParams.get('url') || '').trim();
    const refererUrl = String(body.ref || reqUrl.searchParams.get('ref') || '').trim();
    const query = String(body.q || reqUrl.searchParams.get('q') || '').trim();
    const node = String(body.node || reqUrl.searchParams.get('node') || 'proxy-stealth').trim().toLowerCase();
    const engine = String(body.engine || reqUrl.searchParams.get('engine') || 'google').trim().toLowerCase();
    const adBlock = body.adBlock !== false && reqUrl.searchParams.get('adBlock') !== '0';
    const antiTrack = body.antiTrack !== false && reqUrl.searchParams.get('antiTrack') !== '0';
    const darkTheme = Boolean(body.darkTheme || reqUrl.searchParams.get('darkTheme') === '1');

    if (mode === 'search') {
      return handlePrivacySearch(query || rawUrl, engine);
    }

    if (mode === 'asset' || mode === 'download') {
      return handleAssetOrDownload(rawUrl, mode === 'download', {
        rangeHeader: request.headers.get('range') || '',
        refererUrl,
        proxyOrigin,
        method: request.method,
      });
    }

    // Default mode: browse
    const validation = validatePublicProxyUrl(rawUrl);
    if (!validation.ok) {
      return jsonResponse({ ok: false, error: validation.reason, blockedBySecurity: true }, 400);
    }

    const startedAt = Date.now();
    let finalUrl = validation.url;
    let statusCode = 200;
    let contentType = 'text/html';
    let rawHtml = '';
    let relayUsed =
      node === 'vpn-relay'
        ? 'VPN Privacy Relay (Edge Tunneled)'
        : node === 'reader-antibot'
        ? 'Reader Anti-Bot Mirror'
        : 'Cloudflare Edge Stealth Proxy';
    let usedFallback = false;

    // If user explicitly chose Reader Anti-Bot mode, try live Reader/AllOrigins first (without jumping
    // straight to an old Wayback snapshot before trying a live direct Stealth Edge fetch!)
    if (node === 'reader-antibot') {
      const mirror = await fetchViaFallbackMirror(validation.url, 'reader-antibot', { allowWayback: false });
      if (mirror.ok) {
        rawHtml = mirror.html;
        relayUsed = mirror.relayUsed;
        usedFallback = true;
      }
    }

    if (!rawHtml) {
      try {
        const fetched = await fetchWithSafeRedirects(validation.url, {
          node,
          timeoutMs: DEFAULT_TIMEOUT_MS,
        });
        finalUrl = fetched.finalUrl;
        statusCode = fetched.response.status;
        contentType = String(fetched.response.headers.get('content-type') || 'text/html').toLowerCase();

        // Direct video/audio file opened in browser -> wrap in a clean built-in player + VidMate entry!
        if (/^(video|audio)\//i.test(contentType)) {
          const mediaKind = contentType.startsWith('audio/') ? 'audio' : 'video';
          const safeTitle = new URL(finalUrl).pathname.split('/').pop() || 'Media Langsung';
          const security = buildSecurityAudit(finalUrl, { contentType });
          const proxyPlayUrl = `${proxyOrigin}/api/web-proxy?mode=asset&url=${encodeURIComponent(finalUrl)}`;
          const playerHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
            body{margin:0;min-height:100vh;display:grid;place-items:center;background:#090d16;color:#f8fafc;font-family:system-ui,sans-serif;padding:24px;}
            video,audio{max-width:100%;max-height:82vh;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.5);}
          </style></head><body>${
            mediaKind === 'audio'
              ? `<audio controls autoplay src="${escapeHtmlAttr(proxyPlayUrl)}"></audio>`
              : `<video controls autoplay playsinline src="${escapeHtmlAttr(proxyPlayUrl)}"></video>`
          }</body></html>`;

          return jsonResponse({
            ok: true,
            mode: 'browse',
            finalUrl,
            hostname: new URL(finalUrl).hostname,
            statusCode,
            contentType,
            title: safeTitle,
            description: 'Pemutar media langsung melalui jalur proxy terenkripsi.',
            favicon: '',
            relayUsed,
            latencyMs: Date.now() - startedAt,
            blockedAds: 0,
            blockedTrackers: validation.strippedTrackers.length,
            strippedQueryTrackers: validation.strippedTrackers,
            security,
            media: [
              {
                id: 'media-direct-1',
                url: finalUrl,
                kind: mediaKind,
                format: contentType.split('/')[1]?.toUpperCase() || 'MEDIA',
                quality: 'Original',
                mime: contentType,
                title: safeTitle,
                source: 'direct-stream',
                proxyDownloadUrl: `/api/web-proxy?mode=download&url=${encodeURIComponent(finalUrl)}`,
              },
            ],
            textSnippet: `Direct ${mediaKind} stream: ${safeTitle}`,
            html: playerHtml,
          });
        }

        // Plain JSON or text API response -> render cleanly formatted
        if (/^(application\/json|text\/plain)/i.test(contentType)) {
          const textBody = await readTextCapped(fetched.response, 180 * 1024);
          const security = buildSecurityAudit(finalUrl, { contentType });
          const prettyHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
            body{margin:0;padding:20px;background:#0f172a;color:#e2e8f0;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word;}
          </style></head><body>${escapeHtmlAttr(textBody)}</body></html>`;
          return jsonResponse({
            ok: true,
            mode: 'browse',
            finalUrl,
            hostname: new URL(finalUrl).hostname,
            statusCode,
            contentType,
            title: new URL(finalUrl).hostname,
            description: 'Dokumen teks/JSON dimuat melalui jalur proxy privat.',
            favicon: '',
            relayUsed,
            latencyMs: Date.now() - startedAt,
            blockedAds: 0,
            blockedTrackers: validation.strippedTrackers.length,
            strippedQueryTrackers: validation.strippedTrackers,
            security,
            media: [],
            textSnippet: textBody.slice(0, 2200),
            html: prettyHtml,
          });
        }

        if (statusCode === 403 || statusCode === 429 || statusCode === 503) {
          const mirror = await fetchViaFallbackMirror(finalUrl, 'multi-hop-auto');
          if (mirror.ok) {
            rawHtml = mirror.html;
            relayUsed = `${mirror.relayUsed} (Auto Failover)`;
            usedFallback = true;
            statusCode = 200;
          } else {
            rawHtml = await readTextCapped(fetched.response, MAX_HTML_BYTES);
          }
        } else {
          rawHtml = await readTextCapped(fetched.response, MAX_HTML_BYTES);

          // Automatically unwrap HTML meta-refresh, JS redirects, literal cookie-gates, and
          // "Please visit https://..." / anti-bot challenge stubs (up to 3 safe hops + Headless Browser failover)
          const ephemeralJar = fetched.cookieJar || new Map();
          const visitedHtmlHops = new Set([finalUrl]);
          for (let hHop = 0; hHop < 3; hHop += 1) {
            const stub = detectInterstitialOrRedirect(rawHtml, finalUrl);
            if (!stub) break;

            // Attach any literal cookies from a cookie-gate page to this request's ephemeral jar only
            if (stub.cookies?.length) {
              try {
                const hName = new URL(finalUrl).hostname.toLowerCase();
                const map = ephemeralJar.get(hName) || new Map();
                for (const kv of stub.cookies) {
                  const eq = kv.indexOf('=');
                  if (eq > 0) map.set(kv.slice(0, eq).trim(), kv.slice(eq + 1).trim());
                }
                ephemeralJar.set(hName, map);
              } catch {
                // ignore
              }
            }

            const targetIsNew = stub.targetUrl && !visitedHtmlHops.has(stub.targetUrl);
            if (stub.kind !== 'antibot-challenge' && (targetIsNew || stub.kind === 'cookie-gate')) {
              const nextTarget = stub.targetUrl || finalUrl;
              visitedHtmlHops.add(nextTarget);
              try {
                const nextFetched = await fetchWithSafeRedirects(nextTarget, {
                  node: hHop === 0 ? node : 'proxy-stealth',
                  timeoutMs: DEFAULT_TIMEOUT_MS,
                  referer: finalUrl,
                  cookieJar: ephemeralJar,
                });
                finalUrl = nextFetched.finalUrl;
                statusCode = nextFetched.response.status;
                if (statusCode >= 200 && statusCode < 400) {
                  rawHtml = await readTextCapped(nextFetched.response, MAX_HTML_BYTES);
                  continue;
                }
              } catch {
                // Fall through to headless anti-bot mirror below
              }
            }

            // Still stuck on "Please visit https://..." loop or anti-bot JS challenge -> Headless Browser Mirror!
            const mirror = await fetchViaFallbackMirror(stub.targetUrl || finalUrl, 'multi-hop-auto');
            if (mirror.ok) {
              rawHtml = mirror.html;
              finalUrl = stub.targetUrl || finalUrl;
              relayUsed = `${mirror.relayUsed} (Anti-Redirect Auto)`;
              usedFallback = true;
              statusCode = 200;
            }
            break;
          }
        }
      } catch (directErr) {
        const mirror = await fetchViaFallbackMirror(validation.url, 'multi-hop-auto');
        if (mirror.ok) {
          rawHtml = mirror.html;
          relayUsed = `${mirror.relayUsed} (Failover)`;
          usedFallback = true;
        } else {
          return jsonResponse(
            {
              ok: false,
              error:
                directErr instanceof Error
                  ? directErr.message
                  : 'Situs tujuan tidak dapat dijangkau saat ini. Coba ganti ke Mode VPN Relay atau Reader Anti-Bot.',
            },
            502
          );
        }
      }
    }

    const meta = extractTitleAndFavicon(rawHtml, finalUrl);
    const media = extractMediaFromHtml(rawHtml, finalUrl, meta.title);
    const textSnippet = extractPlainTextSnippet(rawHtml);
    const sanitized = sanitizeAndRewriteHtml(rawHtml, finalUrl, {
      adBlock,
      antiTrack,
      darkTheme,
      proxyOrigin,
      detectedMedia: media,
    });
    const totalTrackersBlocked = sanitized.blockedTrackers + validation.strippedTrackers.length;
    const security = buildSecurityAudit(finalUrl, {
      blockedAds: sanitized.blockedAds,
      blockedTrackers: totalTrackersBlocked,
      contentType,
    });

    return jsonResponse({
      ok: true,
      mode: 'browse',
      finalUrl,
      hostname: new URL(finalUrl).hostname,
      statusCode,
      contentType,
      title: meta.title,
      description: meta.description,
      favicon: meta.favicon,
      relayUsed,
      usedFallback,
      latencyMs: Date.now() - startedAt,
      blockedAds: sanitized.blockedAds,
      blockedTrackers: totalTrackersBlocked,
      strippedQueryTrackers: validation.strippedTrackers,
      security,
      media,
      textSnippet,
      html: sanitized.sanitizedHtml,
      privacy: {
        zeroLogs: true,
        sandboxed: true,
        referrerStripped: true,
        cookiesStripped: true,
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Terjadi kesalahan internal pada proxy.',
      },
      500
    );
  }
}

export async function onRequestGet(context) {
  return handleWebProxyRequest(context.request);
}

export async function onRequestHead(context) {
  return handleWebProxyRequest(context.request);
}

export async function onRequestPost(context) {
  return handleWebProxyRequest(context.request);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Cache-Control': 'no-store',
    },
  });
}
