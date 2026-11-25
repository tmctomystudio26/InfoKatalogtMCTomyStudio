/**
 * Cloudflare Pages Edge Function: /api/shortlink-bypass (v88)
 *
 * Collaborative Multi-Engine Shortlink Bypass & Anti-Malware Edge Resolver:
 *  1. Strict SSRF & scheme protection on input AND every single redirect hop
 *     (blocks private IPv4/IPv6, loopback, link-local, cloud metadata, .local/.internal).
 *  2. Cookie-Jar Multi-Hop HTTP Redirect Tracer + Deep HTML/JS/Safelink/MediaFire/Sfile
 *     payload inspector (reads capped <= 220 KB HTML without executing untrusted scripts).
 *  3. Native Open-Source Service Solvers:
 *     - Ouo.io / Ouo.press Native Solver (dynamic Google reCAPTCHA v3 anchor/reload x-token + /go/ POST)
 *     - Rekonise Direct JSON Unlock API (api.rekonise.com)
 *     - AdLinkFly Hidden Form / AJAX Solver (exe.io, fc.lc, shrinkme, clk.sh, gplinks, aylink, bicolink)
 *     - Work.ink / Boost.ink / Mboost.me / Paster.so embedded payload extractor
 *  4. Collaborative Community & Public Bypass APIs (all active, shutdown/parked URLs filtered out):
 *     - BypassX Open Community API (68 services / 109 domains: Linkvertise, LootLabs, Work.ink, Rekonise, Ouo, etc.)
 *     - TRW Open Community Bypass API (keyless Linkvertise/Lootlink/Work.ink/Ad-wall resolver)
 *     - Unshorten.me Public Redirect API
 *     - Jina Headless Reader Fallback (when origin blocks plain fetch with JS/403 challenge)
 *  5. Automatic Post-Resolution Chaining: if a resolved link is still another shortener/wrapper,
 *     automatically traces up to 2 extra chained hops toward the real final destination.
 */

const MAX_HOPS = 12;
const HOP_TIMEOUT_MS = 5500;
const FAST_API_TIMEOUT_MS = 7000;
const ADWALL_API_TIMEOUT_MS = 18000;
const MAX_HTML_BYTES = 220 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

const PRIVATE_HOST_PATTERNS = [
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
  /^\[?::ffff:(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[0-1])\.|169\.254\.)/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i,
  /^metadata\.google\.internal$/i,
];

const AD_WALL_HOST_SET = new Set([
  'linkvertise.com', 'linkvertise.net', 'linkvertise.download', 'link-to.net',
  'direct-link.net', 'link-center.net', 'link-hub.net', 'link-target.net',
  'link-target.org', 'file-link.net', 'up-to-down.net',
  'ouo.io', 'ouo.press', 'shrinkme.io', 'shrinke.me', 'exe.io', 'exey.io', 'fc.lc',
  'gplinks.co', 'gplinks.in', 'droplink.co', 'safelinku.com', 'safelinkblogger.com',
  'sfl.gl', 'duit.cc', 'semawur.com', 'cararegistrasi.com', 'adf.ly', 'adfly.com',
  'bc.vc', 'sh.st', 'za.gl', 'clk.sh', 'aylink.co', 'ay.live', 'loot-link.com',
  'lootdest.org', 'lootdest.com', 'lootlabs.gg', 'work.ink', 'sub2unlock.com',
  'sub2unlock.io', 'sub2unlock.net', 'sub4unlock.com', 'sub4unlock.io', 'boost.ink',
  'bst.gg', 'bst.wtf', 'mboost.me', 'rekonise.com', 'social-unlock.com',
  'paster.so', 'paster.gg', 'adfoc.us', 'bicolink.net', 'bicolink.com',
  'cuty.io', 'arolinks.com', 'vplink.in', 'bstlar.com', 'link4m.com', 'tpi.li',
]);

const SHORTENER_HOST_SET = new Set([
  ...AD_WALL_HOST_SET,
  'bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'v.gd',
  'buff.ly', 'rebrand.ly', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc', 'bl.ink',
  's.id', 's.shopee.co.id', 'shope.ee', 'vt.tiktok.com', 'vm.tiktok.com', 'youtu.be',
  'l.facebook.com', 'lm.facebook.com', 'l.instagram.com', 'out.reddit.com',
  'sfile.mobi', 'mediafire.com',
]);

const BOGUS_HOSTS = new Set([
  'bypass.vip',
  'www.bypass.vip',
  'api.bypass.vip',
  'bypass.pm',
  'ww17.bypass.pm',
  'bypassx-omega.vercel.app',
  'trw.lat',
  'r.jina.ai',
  'unshorten.me',
  'challenges.cloudflare.com',
]);

function isPublicSafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    return { safe: false, reason: 'Format tautan tidak valid.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Hanya tautan HTTP atau HTTPS yang diperbolehkan.' };
  }

  const hostname = String(parsed.hostname || '').trim().toLowerCase();
  if (!hostname || hostname.length > 253) {
    return { safe: false, reason: 'Nama domain tidak valid.' };
  }

  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'Tautan dengan kredensial tertanam diblokir demi keamanan.' };
  }

  if (/^(?:0x[0-9a-f]+|0[0-7]+|\d+)$/i.test(hostname)) {
    return { safe: false, reason: 'Alamat numerik tersamar diblokir demi keamanan.' };
  }

  for (const re of PRIVATE_HOST_PATTERNS) {
    if (re.test(hostname)) {
      return { safe: false, reason: 'Akses ke alamat jaringan lokal atau internal diblokir.' };
    }
  }

  return { safe: true, url: parsed.toString(), hostname };
}

function normalizeHost(hostname = '') {
  return String(hostname || '').toLowerCase().replace(/^www\./, '');
}

function hostMatchesSet(hostname = '', set) {
  const h = normalizeHost(hostname);
  if (!h) return false;
  for (const d of set) {
    if (h === d || h.endsWith(`.${d}`)) return true;
  }
  return false;
}

function isAdWallHost(urlStr = '') {
  try {
    return hostMatchesSet(new URL(urlStr).hostname, AD_WALL_HOST_SET);
  } catch {
    return false;
  }
}

function isShortenerLikeUrl(urlStr = '') {
  try {
    const u = new URL(urlStr);
    if (hostMatchesSet(u.hostname, SHORTENER_HOST_SET)) return true;
    const h = normalizeHost(u.hostname);
    return h.includes('safelink') || u.pathname.startsWith('/go/');
  } catch {
    return false;
  }
}

function isBogusBypassCandidate(candidateUrl = '', sourceUrl = '') {
  const text = String(candidateUrl || '').trim();
  if (!text) return true;
  if (/FREE\s+API\s+SHUT\s+DOWN|bypass\.vip\/discord|not\s+found|error\s+bypassing/i.test(text)) {
    return true;
  }
  const check = isPublicSafeUrl(text);
  if (!check.safe) return true;
  try {
    const cand = new URL(check.url);
    const host = cand.hostname.toLowerCase();
    if (BOGUS_HOSTS.has(host) || /^ww\d+\./i.test(host)) {
      return true;
    }
    if (cand.pathname.includes('/cdn-cgi/')) {
      return true;
    }
    if (sourceUrl && check.url === sourceUrl) {
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

function decodeHtmlEntities(str = '') {
  return String(str || '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();
}

function tryBase64DecodeUrl(token = '') {
  const clean = String(token || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  if (clean.length < 12 || clean.length > 1536 || !/^[A-Za-z0-9+/=]+$/.test(clean)) return '';
  try {
    const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
    const decoded = atob(padded).trim();
    if (/^https?:\/\/[^\s"'<>]{4,}$/i.test(decoded)) {
      const check = isPublicSafeUrl(decoded);
      return check.safe ? check.url : '';
    }
  } catch {
    // Ignore non-base64 strings
  }
  return '';
}

function isCloudflareChallengeResponse(status, headers, html = '') {
  const cfMit = String(headers?.get?.('cf-mitigated') || '').toLowerCase();
  if (cfMit === 'challenge') return true;
  if ((status === 403 || status === 429 || status === 503) && html) {
    const low = html.slice(0, 4000).toLowerCase();
    if (
      low.includes('<title>just a moment...</title>') ||
      low.includes('/cdn-cgi/challenge-platform') ||
      low.includes('cf-chl-') ||
      low.includes('performing security verification')
    ) {
      return true;
    }
  }
  return false;
}

function extractSetCookies(res, jar) {
  const rawList =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : res.headers.get('set-cookie')
      ? [res.headers.get('set-cookie')]
      : [];
  for (const raw of rawList) {
    const first = String(raw || '').split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) {
      const k = first.slice(0, eq).trim();
      const v = first.slice(eq + 1).trim();
      if (k) jar.set(k, v);
    }
  }
}

function buildCookieHeader(jar) {
  if (!jar || jar.size === 0) return '';
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function extractHiddenInputs(html = '') {
  const fields = {};
  const inputRe = /<input[^>]+>/gi;
  let m;
  while ((m = inputRe.exec(html)) !== null) {
    const tag = m[0];
    const nameMatch = tag.match(/\bname\s*=\s*["']([^"']+)["']/i);
    if (!nameMatch?.[1]) continue;
    const valMatch = tag.match(/\bvalue\s*=\s*["']([^"']*)["']/i);
    fields[nameMatch[1]] = valMatch ? decodeHtmlEntities(valMatch[1]) : '';
  }
  return fields;
}

function extractRedirectFromHtml(html = '', baseUrl = '') {
  const source = String(html || '');
  if (!source) return { nextUrl: '', method: '', title: '', signals: [] };

  const signals = [];
  const titleMatch = source.match(/<title[^>]*>([\s\S]{1,180}?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ')) : '';

  const resolveCandidate = (raw) => {
    const cleaned = decodeHtmlEntities(String(raw || '').trim().replace(/^['"]|['"]$/g, ''));
    if (!cleaned || cleaned.startsWith('#') || /^javascript:/i.test(cleaned)) return '';
    try {
      const abs = new URL(cleaned, baseUrl).toString();
      if (isBogusBypassCandidate(abs, baseUrl)) return '';
      const check = isPublicSafeUrl(abs);
      if (!check.safe) return '';
      if (check.url === baseUrl) return '';
      return check.url;
    } catch {
      return '';
    }
  };

  if (/cloudflare|turnstile|cf-challenge|g-recaptcha|hcaptcha/i.test(source)) {
    signals.push('captcha_challenge');
  }
  if (/popunder|onclick\s*=\s*["']window\.open|adsterra|propellerads|monetag|hilltopads/i.test(source)) {
    signals.push('ad_popup_script');
  }
  if (/countdown|please\s+wait|get\s+link|skip\s+ad|menunggu\s+\d+\s*detik/i.test(source)) {
    signals.push('ad_countdown_wall');
  }

  // 1. <meta http-equiv="refresh" content="0; url=...">
  const metaRefresh = source.match(
    /<meta[^>]+http-equiv\s*=\s*["']?refresh["']?[^>]+content\s*=\s*["'][^"']*url\s*=\s*([^"'\s;>]+)/i
  );
  if (metaRefresh?.[1]) {
    const candidate = resolveCandidate(metaRefresh[1]);
    if (candidate) return { nextUrl: candidate, method: 'meta-refresh', title, signals };
  }

  // 2. Direct JS redirect / target variables / Base64 atob payloads
  const jsPatterns = [
    /(?:window\.|top\.|self\.)?location(?:\.href)?\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i,
    /(?:window\.|top\.|self\.)?location\.replace\(\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']\s*\)/i,
    /(?:window\.|top\.|self\.)?location\.assign\(\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']\s*\)/i,
    /\b(?:targetUrl|finalUrl|redirectUrl|destinationUrl|link_target|go_url)\s*[:=]\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i,
    /atob\(\s*["']([A-Za-z0-9+/=_-]{16,768})["']\s*\)/i,
  ];

  for (let i = 0; i < jsPatterns.length; i += 1) {
    const m = source.match(jsPatterns[i]);
    if (!m?.[1]) continue;
    const candidate = i === 4 ? tryBase64DecodeUrl(m[1]) : resolveCandidate(m[1]);
    if (candidate && !isBogusBypassCandidate(candidate, baseUrl)) {
      return { nextUrl: candidate, method: i === 4 ? 'js-base64' : 'js-redirect', title, signals };
    }
  }

  // 3. Blogger / WordPress Safelink hidden Base64 tokens & MediaFire / Sfile / Get-Link buttons
  const safelinkInput = source.match(
    /<input[^>]+name\s*=\s*["'](?:newwpsafelink|safelink|go|u|target|link)["'][^>]+value\s*=\s*["']([^"']{12,})["']/i
  );
  if (safelinkInput?.[1]) {
    const decoded = tryBase64DecodeUrl(safelinkInput[1]) || resolveCandidate(safelinkInput[1]);
    if (decoded && !isBogusBypassCandidate(decoded, baseUrl)) {
      return { nextUrl: decoded, method: 'safelink-payload', title, signals };
    }
  }

  const anchorPatterns = [
    /<a[^>]+id\s*=\s*["']downloadButton["'][^>]+href\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i,
    /<a[^>]+(?:id|class)\s*=\s*["'][^"']*(?:get[-_]?link|skip[-_]?ad|go[-_]?link|btn[-_]?download|direct[-_]?link)[^"']*["'][^>]+href\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i,
    /<a[^>]+href\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["'][^>]+(?:id|class)\s*=\s*["'][^"']*(?:get[-_]?link|skip[-_]?ad|go[-_]?link|btn[-_]?download|direct[-_]?link)[^"']*["']/i,
  ];
  for (const re of anchorPatterns) {
    const am = source.match(re);
    if (am?.[1]) {
      const candidate = resolveCandidate(am[1]);
      if (candidate) return { nextUrl: candidate, method: 'safelink-anchor', title, signals };
    }
  }

  return { nextUrl: '', method: '', title, signals };
}

async function readTextCapped(response, maxBytes = MAX_HTML_BYTES) {
  if (!response.body) {
    const t = await response.text().catch(() => '');
    return t.slice(0, maxBytes);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (received >= maxBytes) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
  } catch {
    // Return partial read safely
  }
  return text;
}

/**
 * Cookie-jar multi-hop HTTP & HTML/Safelink tracer.
 */
async function traceSafeRedirects(startUrl) {
  const hops = [];
  const signals = new Set();
  const jar = new Map();
  let current = startUrl;
  let finalTitle = '';
  let finalContentType = '';
  let finalStatus = 0;
  let cfBlocked = false;

  for (let i = 0; i < MAX_HOPS; i += 1) {
    const check = isPublicSafeUrl(current);
    if (!check.safe) {
      signals.add('blocked_private_hop');
      break;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HOP_TIMEOUT_MS);
    try {
      const headers = {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Upgrade-Insecure-Requests': '1',
      };
      const cookieHdr = buildCookieHeader(jar);
      if (cookieHdr) headers.Cookie = cookieHdr;

      const res = await fetch(check.url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers,
      });
      clearTimeout(timer);
      extractSetCookies(res, jar);

      finalStatus = res.status;
      finalContentType = String(res.headers.get('content-type') || '').toLowerCase();
      const loc = res.headers.get('location');

      if (res.status >= 300 && res.status < 400 && loc) {
        let resolvedNext = '';
        try {
          resolvedNext = new URL(loc, check.url).toString();
        } catch {
          resolvedNext = '';
        }
        const nextCheck = isPublicSafeUrl(resolvedNext);
        hops.push({
          step: i + 1,
          url: check.url,
          status: res.status,
          type: 'http-redirect',
          target: nextCheck.safe ? nextCheck.url : '[diblokir]',
        });
        if (!nextCheck.safe || nextCheck.url === check.url) {
          if (!nextCheck.safe) signals.add('blocked_private_hop');
          break;
        }
        current = nextCheck.url;
        continue;
      }

      if (finalContentType.includes('text/html') || finalContentType.includes('application/xhtml')) {
        const html = await readTextCapped(res, MAX_HTML_BYTES);

        if (isCloudflareChallengeResponse(res.status, res.headers, html)) {
          cfBlocked = true;
          signals.add('cloudflare_block');
          signals.add('captcha_challenge');
          hops.push({
            step: i + 1,
            url: check.url,
            status: res.status,
            type: 'cloudflare-challenge',
            target: check.url,
          });
          break;
        }

        const extracted = extractRedirectFromHtml(html, check.url);
        if (extracted.title && !finalTitle) finalTitle = extracted.title;
        extracted.signals.forEach((s) => signals.add(s));

        if (extracted.nextUrl) {
          hops.push({
            step: i + 1,
            url: check.url,
            status: res.status,
            type: extracted.method || 'html-redirect',
            target: extracted.nextUrl,
          });
          current = extracted.nextUrl;
          continue;
        }
      } else if (res.body) {
        await res.body.cancel().catch(() => {});
      }

      hops.push({
        step: i + 1,
        url: check.url,
        status: res.status,
        type: 'destination',
        target: check.url,
      });
      break;
    } catch (err) {
      clearTimeout(timer);
      hops.push({
        step: i + 1,
        url: check.url,
        status: 0,
        type: err?.name === 'AbortError' ? 'timeout' : 'network-error',
        target: check.url,
      });
      break;
    }
  }

  return {
    engineId: 'edge-tracer',
    name: 'Edge Cookie-Jar & HTML Inspector',
    category: 'edge',
    ok: hops.length > 0 && current !== startUrl && !isBogusBypassCandidate(current, startUrl),
    reachable: finalStatus > 0,
    cfBlocked,
    resolvedUrl: current,
    status: finalStatus,
    contentType: finalContentType,
    pageTitle: finalTitle,
    hops,
    signals: [...signals],
  };
}

async function fetchJsonSafe(url, timeoutMs = FAST_API_TIMEOUT_MS, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/plain;q=0.9',
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------------------------------------------------
 * Native Open-Source Service Solvers (Ouo.io, Rekonise, AdLinkFly)
 * -------------------------------------------------------------------------- */

async function solveGoogleRecaptchaV3(siteKey = '6Lcr1ncUAAAAAH3cghg6cOTPGARa8adOf-y9zv2x', co = 'aHR0cHM6Ly9vdW8ucHJlc3M6NDQz') {
  let version = 'pCoGBhjs9s8EhFOHJFe8cqis';
  try {
    const apiJsRes = await fetch(`https://www.google.com/recaptcha/api.js?render=${siteKey}`, {
      signal: AbortSignal.timeout(4500),
    });
    const apiJs = await apiJsRes.text();
    const verMatch = apiJs.match(/releases\/([^/]+)\/recaptcha__/);
    if (verMatch?.[1]) version = verMatch[1];
  } catch {
    // Use fallback version hash
  }

  const anchorParams = `ar=1&k=${encodeURIComponent(siteKey)}&co=${encodeURIComponent(co)}&hl=en&v=${encodeURIComponent(version)}&size=invisible&cb=ahgyd1gkfkhe`;
  const anchorRes = await fetch(`https://www.google.com/recaptcha/api2/anchor?${anchorParams}`, {
    signal: AbortSignal.timeout(5000),
  });
  const anchorHtml = await anchorRes.text();
  const tokMatch = anchorHtml.match(/"recaptcha-token"\s+value="([^"]+)"/);
  if (!tokMatch?.[1]) return '';

  const reloadBody = `v=${encodeURIComponent(version)}&reason=q&c=${encodeURIComponent(tokMatch[1])}&k=${encodeURIComponent(siteKey)}&co=${encodeURIComponent(co)}`;
  const reloadRes = await fetch(`https://www.google.com/recaptcha/api2/reload?k=${encodeURIComponent(siteKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: reloadBody,
    signal: AbortSignal.timeout(5000),
  });
  const reloadText = await reloadRes.text();
  const rrespMatch = reloadText.match(/"rresp","([^"]+)"/);
  return rrespMatch?.[1] || '';
}

async function solveOuoNative(targetUrl) {
  const started = Date.now();
  const parsed = new URL(targetUrl);
  const pathParts = parsed.pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  const urlId = pathParts[pathParts.length - 1];
  if (!urlId) {
    return {
      engineId: 'native-solver',
      name: 'Solver Native Open-Source',
      category: 'open-source',
      ok: false,
      resolvedUrl: '',
      latencyMs: Date.now() - started,
      note: 'ID tautan ouo tidak valid',
    };
  }

  const jar = new Map();
  const baseHost = 'ouo.io';
  const entryUrl = `https://${baseHost}/${urlId}`;

  const firstRes = await fetch(entryUrl, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(5500),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.google.com/',
    },
  });
  extractSetCookies(firstRes, jar);

  const directLoc = firstRes.headers.get('location');
  if (firstRes.status >= 300 && firstRes.status < 400 && directLoc && !/ouo\.(?:io|press)/i.test(directLoc)) {
    const check = isPublicSafeUrl(directLoc);
    if (check.safe) {
      return {
        engineId: 'native-solver',
        name: 'Solver Native Open-Source',
        category: 'open-source',
        ok: true,
        resolvedUrl: check.url,
        latencyMs: Date.now() - started,
        note: 'Ouo berhasil dilewati langsung',
      };
    }
  }

  let html = await firstRes.text().catch(() => '');
  if (isCloudflareChallengeResponse(firstRes.status, firstRes.headers, html)) {
    return {
      engineId: 'native-solver',
      name: 'Solver Native Open-Source',
      category: 'open-source',
      ok: false,
      resolvedUrl: '',
      cfBlocked: true,
      latencyMs: Date.now() - started,
      note: 'Ouo.io dilindungi Cloudflare Turnstile interaktif',
    };
  }

  const xToken = await solveGoogleRecaptchaV3();
  if (!xToken) {
    return {
      engineId: 'native-solver',
      name: 'Solver Native Open-Source',
      category: 'open-source',
      ok: false,
      resolvedUrl: '',
      latencyMs: Date.now() - started,
      note: 'Gagal memperoleh token verifikasi',
    };
  }

  let nextPostUrl = `https://${baseHost}/go/${urlId}`;
  for (let step = 0; step < 2; step += 1) {
    const inputs = extractHiddenInputs(html);
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(inputs)) {
      if (k === 'cf-turnstile-response') continue;
      params.set(k, v);
    }
    params.set('x-token', xToken);

    const postRes = await fetch(nextPostUrl, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(5500),
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: `https://${baseHost}`,
        Referer: step === 0 ? entryUrl : `https://${baseHost}/go/${urlId}`,
        Cookie: buildCookieHeader(jar),
      },
      body: params.toString(),
    });
    extractSetCookies(postRes, jar);

    const loc = postRes.headers.get('location');
    if (loc) {
      const abs = new URL(loc, nextPostUrl).toString();
      if (!/\/(?:go|xreallcygo)\//i.test(abs)) {
        const check = isPublicSafeUrl(abs);
        if (check.safe) {
          return {
            engineId: 'native-solver',
            name: 'Solver Native Open-Source',
            category: 'open-source',
            ok: true,
            resolvedUrl: check.url,
            latencyMs: Date.now() - started,
            note: 'Ouo bypass berhasil (reCAPTCHA v3 token)',
          };
        }
      }
      nextPostUrl = abs;
      continue;
    }

    html = await postRes.text().catch(() => '');
    nextPostUrl = `https://${baseHost}/xreallcygo/${urlId}`;
  }

  return {
    engineId: 'native-solver',
    name: 'Solver Native Open-Source',
    category: 'open-source',
    ok: false,
    resolvedUrl: '',
    latencyMs: Date.now() - started,
    note: 'Ouo memerlukan tantangan browser interaktif',
  };
}

async function solveRekoniseNative(targetUrl) {
  const started = Date.now();
  const parsed = new URL(targetUrl);
  const slug = parsed.pathname.replace(/^\/+|\/+$/g, '');
  if (!slug) return null;

  for (const apiPath of [`/social-unlocks/${slug}/unlock`, `/social-unlocks/${slug}`]) {
    const res = await fetchJsonSafe(`https://api.rekonise.com${apiPath}`, FAST_API_TIMEOUT_MS, {
      headers: { Origin: 'https://rekonise.com', Referer: 'https://rekonise.com/' },
    }).catch(() => null);
    const dest = String(res?.json?.url || res?.json?.destination || '').trim();
    if (dest && !isBogusBypassCandidate(dest, targetUrl)) {
      const check = isPublicSafeUrl(dest);
      if (check.safe) {
        return {
          engineId: 'native-solver',
          name: 'Solver Native Open-Source',
          category: 'open-source',
          ok: true,
          resolvedUrl: check.url,
          latencyMs: Date.now() - started,
          note: 'Rekonise social gate dibuka via API',
        };
      }
    }
  }
  return {
    engineId: 'native-solver',
    name: 'Solver Native Open-Source',
    category: 'open-source',
    ok: false,
    resolvedUrl: '',
    latencyMs: Date.now() - started,
    note: 'Tautan Rekonise tidak mengembalikan tujuan',
  };
}

async function queryNativeServiceSolver(targetUrl) {
  const started = Date.now();
  let host = '';
  try {
    host = normalizeHost(new URL(targetUrl).hostname);
  } catch {
    host = '';
  }

  try {
    if (host === 'ouo.io' || host === 'ouo.press') {
      return await solveOuoNative(targetUrl);
    }
    if (host === 'rekonise.com') {
      return await solveRekoniseNative(targetUrl);
    }
    // Generic AdLinkFly check on known AdLinkFly domains
    if (/^(?:exe\.io|fc\.lc|shrinkme\.io|clk\.sh|gplinks\.co|droplink\.co|bicolink\.net|aylink\.co)$/.test(host)) {
      const jar = new Map();
      const firstRes = await fetch(targetUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(5500),
        headers: { 'User-Agent': USER_AGENT },
      });
      extractSetCookies(firstRes, jar);
      const html = await firstRes.text().catch(() => '');
      const fields = extractHiddenInputs(html);
      if (fields.ad_form_data && fields._csrfToken) {
        const formBody = new URLSearchParams(fields).toString();
        const goRes = await fetchJsonSafe(`https://${host}/links/go`, 5500, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            Referer: firstRes.url || targetUrl,
            Cookie: buildCookieHeader(jar),
          },
          body: formBody,
        });
        const dest = String(goRes?.json?.url || '').trim();
        if (dest && !isBogusBypassCandidate(dest, targetUrl)) {
          const check = isPublicSafeUrl(dest);
          if (check.safe) {
            return {
              engineId: 'native-solver',
              name: 'Solver Native Open-Source',
              category: 'open-source',
              ok: true,
              resolvedUrl: check.url,
              latencyMs: Date.now() - started,
              note: `Form AdLinkFly (${host}) berhasil diurai`,
            };
          }
        }
      }
    }
  } catch {
    // Fall through gracefully
  }

  return {
    engineId: 'native-solver',
    name: 'Solver Native Open-Source',
    category: 'open-source',
    ok: false,
    resolvedUrl: '',
    latencyMs: Date.now() - started,
    note: host ? `Siap untuk domain khusus (ouo/rekonise/adlink)` : 'Domain langsung',
  };
}

/* --------------------------------------------------------------------------
 * Collaborative Community & Public Bypass APIs (Live 2026 Endpoints)
 * -------------------------------------------------------------------------- */

async function queryBypassXApi(targetUrl, timeoutMs = ADWALL_API_TIMEOUT_MS) {
  const started = Date.now();
  try {
    const res = await fetchJsonSafe('https://bypassx-omega.vercel.app/api/bypass', timeoutMs, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://bypassx-omega.vercel.app',
        Referer: 'https://bypassx-omega.vercel.app/',
      },
      body: JSON.stringify({ url: targetUrl }),
    });
    const candidate = String(res.json?.destination || res.json?.result || '').trim();
    const valid = Boolean(
      res.ok &&
        res.json?.ok &&
        candidate &&
        !isBogusBypassCandidate(candidate, targetUrl)
    );
    const check = valid ? isPublicSafeUrl(candidate) : { safe: false };
    return {
      engineId: 'bypassx-api',
      name: 'BypassX Open Community API',
      category: 'open-source',
      ok: Boolean(valid && check.safe),
      resolvedUrl: valid && check.safe ? check.url : '',
      latencyMs: Date.now() - started,
      note:
        valid && check.safe
          ? `Berhasil dibuka via ${res.json?.site?.name || 'BypassX'}`
          : res.json?.error
          ? String(res.json.error).slice(0, 80)
          : 'Tidak ada rute bypass tambahan',
    };
  } catch {
    return {
      engineId: 'bypassx-api',
      name: 'BypassX Open Community API',
      category: 'open-source',
      ok: false,
      resolvedUrl: '',
      latencyMs: Date.now() - started,
      note: 'Melewati batas waktu / sibuk',
    };
  }
}

async function queryTrwBypassApi(targetUrl, timeoutMs = ADWALL_API_TIMEOUT_MS) {
  const started = Date.now();
  try {
    const res = await fetchJsonSafe(
      `https://trw.lat/api/bypass?url=${encodeURIComponent(targetUrl)}`,
      timeoutMs
    );
    const candidate = String(res.json?.result || res.json?.destination || '').trim();
    const valid = Boolean(
      res.ok &&
        res.json?.success &&
        candidate &&
        !isBogusBypassCandidate(candidate, targetUrl)
    );
    const check = valid ? isPublicSafeUrl(candidate) : { safe: false };
    return {
      engineId: 'trw-api',
      name: 'TRW Community Bypass API',
      category: 'open-source',
      ok: Boolean(valid && check.safe),
      resolvedUrl: valid && check.safe ? check.url : '',
      latencyMs: Date.now() - started,
      note: valid && check.safe ? 'Tautan tujuan berhasil ditemukan' : 'Domain belum didukung',
    };
  } catch {
    return {
      engineId: 'trw-api',
      name: 'TRW Community Bypass API',
      category: 'open-source',
      ok: false,
      resolvedUrl: '',
      latencyMs: Date.now() - started,
      note: 'Mesin sedang sibuk',
    };
  }
}

async function queryUnshortenMe(targetUrl, timeoutMs = FAST_API_TIMEOUT_MS) {
  const started = Date.now();
  try {
    const res = await fetchJsonSafe(
      `https://unshorten.me/json/${encodeURIComponent(targetUrl)}`,
      timeoutMs
    );
    const candidate = String(res.json?.resolved_url || '').trim();
    const valid = Boolean(
      res.ok &&
        res.json?.success &&
        candidate &&
        !isBogusBypassCandidate(candidate, targetUrl)
    );
    const check = valid ? isPublicSafeUrl(candidate) : { safe: false };
    return {
      engineId: 'unshorten-me',
      name: 'Unshorten.me Public API',
      category: 'public-api',
      ok: Boolean(valid && check.safe),
      resolvedUrl: valid && check.safe ? check.url : '',
      latencyMs: Date.now() - started,
      note: valid && check.safe ? 'Redirect berhasil diurai' : 'Tidak ada pengalihan tambahan',
    };
  } catch {
    return {
      engineId: 'unshorten-me',
      name: 'Unshorten.me Public API',
      category: 'public-api',
      ok: false,
      resolvedUrl: '',
      latencyMs: Date.now() - started,
      note: 'Mesin sedang sibuk',
    };
  }
}

async function queryJinaReaderFallback(targetUrl) {
  const started = Date.now();
  try {
    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      signal: AbortSignal.timeout(9000),
      headers: { Accept: 'text/plain' },
    });
    const txt = await res.text();
    const finalMatch = txt.match(/Final\s+URL:\s*(https?:\/\/\S+)/i) || txt.match(/URL\s+Source:\s*(https?:\/\/\S+)/i);
    const candidate = finalMatch?.[1] ? finalMatch[1].trim() : '';
    const valid = Boolean(
      res.ok &&
        candidate &&
        !isBogusBypassCandidate(candidate, targetUrl) &&
        normalizeHost(new URL(candidate).hostname) !== normalizeHost(new URL(targetUrl).hostname)
    );
    const check = valid ? isPublicSafeUrl(candidate) : { safe: false };
    return {
      engineId: 'jina-reader',
      name: 'Headless Reader Inspector',
      category: 'public-api',
      ok: Boolean(valid && check.safe),
      resolvedUrl: valid && check.safe ? check.url : '',
      latencyMs: Date.now() - started,
      note:
        valid && check.safe
          ? 'Berhasil membaca pengalihan sisi browser'
          : 'Halaman meminta verifikasi manusia',
    };
  } catch {
    return {
      engineId: 'jina-reader',
      name: 'Headless Reader Inspector',
      category: 'public-api',
      ok: false,
      resolvedUrl: '',
      latencyMs: Date.now() - started,
      note: 'Halaman dilindungi verifikasi',
    };
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function runStageEngines(targetUrl) {
  const adWall = isAdWallHost(targetUrl);
  const timeoutMs = adWall ? ADWALL_API_TIMEOUT_MS : FAST_API_TIMEOUT_MS;

  // Run Edge Tracer & Native Solver in parallel; only wait on slow ad-wall APIs when needed
  const [edgeTrace, nativeRes, bypassXRes, trwRes, unMeRes] = await Promise.all([
    traceSafeRedirects(targetUrl),
    adWall
      ? queryNativeServiceSolver(targetUrl)
      : Promise.resolve({
          engineId: 'native-solver',
          name: 'Solver Native Open-Source',
          category: 'open-source',
          ok: false,
          resolvedUrl: '',
          note: 'Domain non-adwall ditangani Edge Tracer',
        }),
    adWall
      ? queryBypassXApi(targetUrl, timeoutMs)
      : Promise.resolve({
          engineId: 'bypassx-api',
          name: 'BypassX Open Community API',
          category: 'open-source',
          ok: false,
          resolvedUrl: '',
          note: 'Tidak diperlukan untuk tautan langsung',
        }),
    adWall
      ? queryTrwBypassApi(targetUrl, timeoutMs)
      : Promise.resolve({
          engineId: 'trw-api',
          name: 'TRW Community Bypass API',
          category: 'open-source',
          ok: false,
          resolvedUrl: '',
          note: 'Tidak diperlukan untuk tautan langsung',
        }),
    queryUnshortenMe(targetUrl, FAST_API_TIMEOUT_MS),
  ]);

  const engines = [
    {
      engineId: edgeTrace.engineId,
      name: edgeTrace.name,
      category: edgeTrace.category,
      ok: edgeTrace.ok,
      resolvedUrl: edgeTrace.resolvedUrl,
      note: edgeTrace.ok
        ? `Melacak ${edgeTrace.hops.length} langkah pengalihan`
        : edgeTrace.cfBlocked
        ? 'Situs asal menerapkan tantangan Cloudflare (403)'
        : edgeTrace.reachable
        ? 'Tautan diakses langsung tanpa pengalihan tambahan'
        : 'Situs asal membatasi akses otomatis',
    },
    nativeRes,
    bypassXRes,
    trwRes,
    unMeRes,
  ];

  // If still unresolved & blocked by Cloudflare/JS on an ad-wall, try Jina headless reader once
  const anySolved = engines.some((e) => e.ok && e.resolvedUrl && !isShortenerLikeUrl(e.resolvedUrl));
  if (!anySolved && (edgeTrace.cfBlocked || adWall)) {
    const jinaRes = await queryJinaReaderFallback(targetUrl);
    engines.push(jinaRes);
  }

  return { edgeTrace, engines };
}

export async function handleShortlinkBypassRequest(request) {
  let rawUrl = '';
  try {
    if (request.method === 'GET') {
      const u = new URL(request.url);
      rawUrl = String(u.searchParams.get('url') || '').trim();
    } else if (request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      rawUrl = String(body?.url || '').trim();
    } else {
      return jsonResponse({ ok: false, error: 'Metode tidak didukung.' }, 405);
    }
  } catch {
    return jsonResponse({ ok: false, error: 'Permintaan tidak valid.' }, 400);
  }

  if (!rawUrl) {
    return jsonResponse({ ok: false, error: 'Masukkan tautan yang ingin di-bypass.' }, 400);
  }
  if (rawUrl.length > 2048) {
    return jsonResponse({ ok: false, error: 'Tautan terlalu panjang (maksimal 2048 karakter).' }, 400);
  }

  const normalizedInput = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const check = isPublicSafeUrl(normalizedInput);
  if (!check.safe) {
    return jsonResponse({ ok: false, error: check.reason, blocked: true }, 400);
  }

  // Stage 1: Initial Multi-Engine Parallel Execution
  const stage1 = await runStageEngines(check.url);
  let allHops = [...stage1.edgeTrace.hops];
  let allSignals = new Set(stage1.edgeTrace.signals);
  let finalPageTitle = stage1.edgeTrace.pageTitle;
  const engines = [...stage1.engines];

  // Check if the resolved intermediate URL landed on ANOTHER shortlink/ad-wall (e.g. bit.ly -> linkvertise)
  const solvedIntermediate =
    engines.find((e) => e.ok && e.resolvedUrl && e.resolvedUrl !== check.url)?.resolvedUrl || '';
  if (
    solvedIntermediate &&
    isShortenerLikeUrl(solvedIntermediate) &&
    solvedIntermediate !== check.url
  ) {
    const stage2 = await runStageEngines(solvedIntermediate);
    for (const h of stage2.edgeTrace.hops) {
      allHops.push({ ...h, step: allHops.length + 1 });
    }
    stage2.edgeTrace.signals.forEach((s) => allSignals.add(s));
    if (stage2.edgeTrace.pageTitle) finalPageTitle = stage2.edgeTrace.pageTitle;

    // Update engines with deeper Stage 2 resolution if they beat Stage 1
    for (const e2 of stage2.engines) {
      if (!e2.ok || !e2.resolvedUrl) continue;
      const existing = engines.find((e) => e.engineId === e2.engineId);
      if (existing) {
        existing.ok = true;
        existing.resolvedUrl = e2.resolvedUrl;
        existing.note = `${e2.note} (rantai lanjutan)`;
      } else {
        engines.push(e2);
      }
    }
  }

  const cfBlockedAny =
    stage1.edgeTrace.cfBlocked ||
    allSignals.has('cloudflare_block') ||
    engines.some((e) => e.cfBlocked);

  return jsonResponse({
    ok: true,
    inputUrl: check.url,
    edgeTrace: {
      resolvedUrl: stage1.edgeTrace.resolvedUrl,
      status: stage1.edgeTrace.status,
      contentType: stage1.edgeTrace.contentType,
      pageTitle: finalPageTitle,
      hops: allHops,
      signals: [...allSignals],
      cfBlocked: cfBlockedAny,
    },
    engines,
  });
}

export async function onRequestGet(context) {
  return handleShortlinkBypassRequest(context.request);
}

export async function onRequestPost(context) {
  return handleShortlinkBypassRequest(context.request);
}
