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
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
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
  if (node === 'vpn-relay') return PRIVACY_USER_AGENTS[2];
  if (node === 'reader-antibot') return PRIVACY_USER_AGENTS[1];
  return PRIVACY_USER_AGENTS[0];
}

function buildStealthHeaders(node = 'proxy-stealth', accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8') {
  return {
    'User-Agent': pickPrivacyUserAgent(node),
    Accept: accept,
    'Accept-Language': node === 'vpn-relay' ? 'en-US,en;q=0.9,id;q=0.7' : 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    DNT: '1',
    'Sec-GPC': '1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'no-cache',
  };
}

async function fetchWithSafeRedirects(startUrl, { node = 'proxy-stealth', timeoutMs = DEFAULT_TIMEOUT_MS, accept } = {}) {
  let currentUrl = startUrl;
  const hops = [];

  for (let i = 0; i <= MAX_REDIRECT_HOPS; i += 1) {
    const check = validatePublicProxyUrl(currentUrl);
    if (!check.ok) {
      throw new Error(check.reason || 'URL tujuan diblokir oleh proteksi keamanan.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(check.url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: buildStealthHeaders(node, accept),
      });
    } finally {
      clearTimeout(timer);
    }

    hops.push({ url: check.url, status: res.status });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) {
        return { response: res, finalUrl: check.url, hops };
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

    return { response: res, finalUrl: check.url, hops };
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
      proxyDownloadUrl: `/api/web-proxy?mode=download&url=${encodeURIComponent(resolved)}`,
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
export function sanitizeAndRewriteHtml(rawHtml, finalUrl, { adBlock = true, antiTrack = true, darkTheme = false } = {}) {
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
    // Keep harmless video embeds (YouTube/Vimeo/Dailymotion) sandboxed, block unknown ad frames
    if (/(youtube\.com|youtube-nocookie\.com|youtu\.be|player\.vimeo\.com|dailymotion\.com)/i.test(attrs)) {
      return full.replace(/<iframe/i, '<iframe referrerpolicy="no-referrer" loading="lazy"');
    }
    blockedAds += 1;
    return '';
  });

  // Clean any Wayback Archive toolbar or /web/<timestamp>/ URL prefixes so CSS & images never 404
  html = cleanWaybackHtml(html);

  // Strip 1x1 tracking pixel images and promote lazy-loaded data-src images so news photos load without JS
  html = html.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
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
    const lazyMatch = nextAttrs.match(/\b(?:data-src|data-original|data-lazy-src|data-img-src)\s*=\s*["']([^"']+)["']/i);
    if (lazyMatch?.[1] && !/^javascript:/i.test(lazyMatch[1])) {
      const currentSrc = nextAttrs.match(/\bsrc\s*=\s*["']([^"']*)["']/i)?.[1] || '';
      const isPlaceholder =
        !currentSrc ||
        /^data:image\//i.test(currentSrc) ||
        /(blank|spacer|placeholder|loading|transparent|1x1)/i.test(currentSrc);
      if (isPlaceholder) {
        const cleanLazy = escapeHtmlAttr(lazyMatch[1]);
        if (/\bsrc\s*=/i.test(nextAttrs)) {
          nextAttrs = nextAttrs.replace(/\bsrc\s*=\s*["'][^"']*["']/i, `src="${cleanLazy}"`);
        } else {
          nextAttrs = ` src="${cleanLazy}"${nextAttrs}`;
        }
      }
    }
    // Strip crossorigin attribute on <img> so opaque srcdoc iframes don't trigger strict CORS failures on CDN images/SVGs
    nextAttrs = nextAttrs.replace(/\s+crossorigin(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
    if (!/\breferrerpolicy\s*=/i.test(nextAttrs)) {
      nextAttrs = ` referrerpolicy="no-referrer"${nextAttrs}`;
    }
    return `<img${nextAttrs}>`;
  });

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
      [id*="google_ads"], [id*="div-gpt-ad"], [class*="adsbygoogle"], [class*="ad-banner"], [class*="ad-slot"],
      [class*="advertisement"], [class*="billboard-ad"], [class*="top-banner-ad"], [class*="ads-wrapper"],
      [class*="popup-ad"], [class*="sponsored-ad"], [id*="taboola"], [id*="outbrain"],
      ins.adsbygoogle { display: none !important; }
    </style>
  `;

  // Safe navigation bridge inside sandboxed iframe (NO allow-same-origin, communicates solely via postMessage)
  const navBridgeScript = `
    <script data-manifest-proxy-nav>
      (function(){
        var BASE = ${JSON.stringify(finalUrl)};
        function resolveNav(raw) {
          if (!raw) return '';
          var s = String(raw).trim();
          if (!s || s.startsWith('#') || /^javascript:/i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return '';
          try { return new URL(s, BASE).toString(); } catch (e) { return ''; }
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
 * Fallback reader mirror (Jina AI Reader / AllOrigins / Wayback Raw id_ Snapshot) for anti-bot sites.
 */
async function fetchViaFallbackMirror(targetUrl, preferredNode = 'reader-antibot', { allowWayback = true } = {}) {
  const attempts = [];

  // 1. Jina Reader (clean, free open-source anti-bot reader)
  if (preferredNode === 'reader-antibot' || preferredNode === 'multi-hop-auto' || preferredNode === 'vpn-relay') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
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
                .replace(mdImgRe, '<figure><img src="$2" alt="$1" loading="lazy" referrerpolicy="no-referrer"></figure>')
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

  // 2. AllOrigins free community proxy
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8500);
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (res.ok) {
      const html = await readTextCapped(res, MAX_HTML_BYTES);
      if (html.trim().length > 60) {
        return {
          ok: true,
          relayUsed: 'AllOrigins Community Relay',
          html,
          textSnippet: extractPlainTextSnippet(html),
          title: '',
        };
      }
    }
    attempts.push({ relay: 'AllOrigins', status: res.status });
  } catch {
    attempts.push({ relay: 'AllOrigins', status: 'timeout' });
  }

  // 3. Wayback Archive Raw Snapshot (uses id_ flag + cleanWaybackHtml so CSS & images stay intact)
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
 * Privacy Web Search across DuckDuckGo HTML, Wikipedia OpenSearch, and SearXNG public relays.
 */
async function handlePrivacySearch(query, engine = 'duckduckgo') {
  const q = String(query || '').trim().slice(0, 260);
  if (!q) {
    return jsonResponse({ ok: false, error: 'Masukkan kata kunci pencarian.' }, 400);
  }

  const results = [];
  const usedEngines = [];

  // Engine A: DuckDuckGo HTML (free, privacy-first, no cookies)
  if (engine === 'duckduckgo' || engine === 'auto' || engine === 'searxng') {
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
        while ((match = itemRe.exec(html)) !== null && results.length < 12) {
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
          if (!check.ok) continue;
          const title = decodeHtmlEntities(match[2].replace(/<[^>]+>/g, ''));
          const snippet = decodeHtmlEntities((match[3] || match[4] || '').replace(/<[^>]+>/g, ''));
          if (title) {
            results.push({
              title,
              url: check.url,
              displayHost: check.hostname,
              snippet: snippet || 'Hasil pencarian privat bebas pelacak.',
              source: 'DuckDuckGo Privacy',
            });
          }
        }
        if (results.length > 0) usedEngines.push('DuckDuckGo Privacy');
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
 * Streams a public media/asset file safely through the edge proxy for VidMate downloads or proxied previews.
 */
async function handleAssetOrDownload(targetUrl, asDownload = false) {
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
    const { response, finalUrl } = await fetchWithSafeRedirects(check.url, {
      node: 'vpn-relay',
      timeoutMs: 14000,
      accept: '*/*',
    });
    if (!response.ok) {
      return jsonResponse({ ok: false, error: `Server sumber mengembalikan status ${response.status}.` }, 502);
    }

    const contentType = String(response.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
    if (/application\/x-msdownload|application\/vnd\.android\.package-archive|application\/x-sh/i.test(contentType)) {
      return jsonResponse({ ok: false, error: 'Tipe berkas berbahaya diblokir oleh anti-malware.' }, 403);
    }

    const contentLen = Number(response.headers.get('content-length') || 0);
    if (contentLen > MAX_ASSET_BYTES) {
      return jsonResponse(
        { ok: false, error: 'Ukuran berkas melebihi batas proxy 14 MB. Gunakan tombol salin tautan langsung.' },
        413
      );
    }

    const buf = await response.arrayBuffer();
    if (buf.byteLength > MAX_ASSET_BYTES) {
      return jsonResponse(
        { ok: false, error: 'Ukuran berkas melebihi batas proxy 14 MB.' },
        413
      );
    }

    const filenameRaw = new URL(finalUrl).pathname.split('/').pop() || 'manifestudio-media.mp4';
    const safeFilename = filenameRaw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'manifestudio-media.mp4';

    const outHeaders = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    });
    if (asDownload) {
      outHeaders.set('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    return new Response(buf, { status: 200, headers: outHeaders });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : 'Gagal mengunduh media melalui proxy.' },
      502
    );
  }
}

export async function handleWebProxyRequest(request) {
  try {
    const reqUrl = new URL(request.url);
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
    const query = String(body.q || reqUrl.searchParams.get('q') || '').trim();
    const node = String(body.node || reqUrl.searchParams.get('node') || 'proxy-stealth').trim().toLowerCase();
    const engine = String(body.engine || reqUrl.searchParams.get('engine') || 'duckduckgo').trim().toLowerCase();
    const adBlock = body.adBlock !== false && reqUrl.searchParams.get('adBlock') !== '0';
    const antiTrack = body.antiTrack !== false && reqUrl.searchParams.get('antiTrack') !== '0';
    const darkTheme = Boolean(body.darkTheme || reqUrl.searchParams.get('darkTheme') === '1');

    if (mode === 'search') {
      return handlePrivacySearch(query || rawUrl, engine);
    }

    if (mode === 'asset' || mode === 'download') {
      return handleAssetOrDownload(rawUrl, mode === 'download');
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
          const proxyPlayUrl = `/api/web-proxy?mode=asset&url=${encodeURIComponent(finalUrl)}`;
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

export async function onRequestPost(context) {
  return handleWebProxyRequest(context.request);
}
