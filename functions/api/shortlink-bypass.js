/**
 * Cloudflare Pages Edge Function: /api/shortlink-bypass (v89)
 *
 * Collaborative Multi-Engine Shortlink Bypass & Anti-Malware Edge Resolver:
 *  1. Strict SSRF & scheme protection on input AND every single redirect hop
 *     (blocks private IPv4/IPv6, loopback, link-local, cloud metadata, .local/.internal).
 *  2. Cookie-Jar Multi-Hop HTTP Redirect + Auto-Submit <form> + HTML/JS/Safelink/MediaFire/Sfile
 *     payload inspector (reads capped <= 220 KB HTML without executing untrusted scripts).
 *  3. Universal & Native Open-Source Service Solvers:
 *     - SafelinkU v3 / Semawur / Khaddavi / Tutwuri Native Session+Verify+Go Solver
 *       (auto-detected by HTML signature on ANY custom WordPress safelink domain)
 *     - Universal AdLinkFly HTML-Signature AJAX Solver (_csrfToken + ad_form_data on ANY domain)
 *     - Ouo.io / Ouo.press Native Solver (dynamic Google reCAPTCHA v3 anchor/reload x-token + /go/ POST)
 *     - Rekonise Direct JSON Unlock API (api.rekonise.com)
 *     - Bicolink Nonce + Go-Link Native Solver
 *  4. Collaborative Community & Public Bypass APIs (runs on ALL unresolved/shortener URLs,
 *     never gated by a narrow whitelist; filters out dead/shutdown/portal URLs):
 *     - TRW Community Bypass API (active across Linkvertise, LootLabs, Rekonise, MBoost, Shorteners)
 *     - BypassX Open Community API (68 services / 109+ domains)
 *     - Unshorten.me Public Redirect API
 *     - Jina Headless Reader Inspector (fallback for JS/bot-wall pages)
 *  5. Automatic Multi-Stage Chaining (up to 2 extra chained stages when Stage 1 lands on
 *     another shortener/ad-wall, e.g. bit.ly -> semawur.com -> sfl.gl -> destination).
 */

const MAX_HOPS = 12;
const HOP_TIMEOUT_MS = 4500;
const FAST_API_TIMEOUT_MS = 4500;
const ADWALL_API_TIMEOUT_MS = 6500;
const FAST_RACE_GRACE_MS = 1400;
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
  'link-target.org', 'file-link.net', 'up-to-down.net', 'filemail.com',
  'ouo.io', 'ouo.press', 'shrinkme.io', 'shrinke.me', 'shrinkearn.com', 'exe.io', 'exey.io', 'fc.lc',
  'gplinks.co', 'gplinks.in', 'droplink.co', 'safelinku.com', 'safelinkku.com', 'safelinkblogger.com',
  'sfl.gl', 'sfl.ink', 'duit.cc', 'semawur.com', 'khaddavi.net', 'cararegistrasi.com', 'tutwuri.id',
  'adf.ly', 'adfly.com', 'bc.vc', 'sh.st', 'za.gl', 'clk.sh', 'clk.kim', 'clicksfly.com',
  'aylink.co', 'ay.live', 'loot-link.com', 'lootdest.org', 'lootdest.com', 'lootdest.info',
  'lootdest.net', 'loots.gg', 'loot-reward.com', 'lootlabs.gg', 'work.ink', 'workink.net',
  'sub2unlock.com', 'sub2unlock.io', 'sub2unlock.me', 'sub2unlock.net', 'sub2unlock.xyz',
  'sub4unlock.com', 'sub4unlock.io', 'sub4unlock.me', 'sub4unlock.pro', 'subunlock.com', 'link2unlock.com',
  'boost.ink', 'bst.gg', 'bst.wtf', 'booo.st', 'boostylink.com', 'mboost.me', 'move2link.com',
  'rekonise.com', 'social-unlock.com', 'socialwolvez.com', 'scwz.me', 'link-unlock.com', 'linkunlocker.com',
  'paster.so', 'paster.gg', 'adfoc.us', 'bicolink.net', 'bicolink.com', 'bico.link',
  'cuty.io', 'arolinks.com', 'vplink.in', 'bstlar.com', 'link4m.com', 'tpi.li',
  'lockr.net', 'lockr.so', 'lockr.to', 'bstshrt.com', 'linkpays.in', 'publicearn.net',
  'get.publicearn.net', 'shortxlinks.in', 'shortxlinks.com', 'lnbz.la', 'rinku.pro',
  'gaterlnk.com', 'subnise.com', 'vipshort.in', 'link4sub.com', 'sub2s.com', 'unlocknow.net',
  'oke.io', 'tny.so', 'v2links.com', 'modijiurl.com', 'shareus.io', 'link1s.com', 'adrinolinks.in',
  'yorurl.com', 'payskip.org', 'short.am', 'du-link.in', 'stfly.me', 'earnl.xyz',
]);

const SHORTENER_HOST_SET = new Set([
  ...AD_WALL_HOST_SET,
  'bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'v.gd',
  'buff.ly', 'rebrand.ly', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc', 'bl.ink',
  's.id', 't.ly', 'kutt.it', 'short.io', 'lnkd.in', 'dlvr.it', 'snip.ly', 'clck.ru',
  'u.to', 'qr.ae', 'trib.al', 's.shopee.co.id', 'shope.ee', 'vt.tiktok.com', 'vm.tiktok.com',
  'youtu.be', 'l.facebook.com', 'lm.facebook.com', 'l.instagram.com', 'out.reddit.com',
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
  'rip.linkvertise.lol',
  'shortlink-bypass.vercel.app',
  'api.zapi.ink',
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
    return h.includes('safelink') || h.includes('short') || u.pathname.startsWith('/go/') || u.pathname.startsWith('/ready/go');
  } catch {
    return false;
  }
}

function isBogusBypassCandidate(candidateUrl = '', sourceUrl = '') {
  const text = String(candidateUrl || '').trim();
  if (!text) return true;
  if (/FREE\s+API\s+SHUT\s+DOWN|bypass\.vip\/discord|not\s+found|error\s+bypassing|unsupported\s+url/i.test(text)) {
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
    if (
      /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|json|xml|rss)(?:$|[?#])/i.test(
        cand.pathname
      )
    ) {
      return true;
    }
    if (
      /^(?:githubassets\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|static\.cloudflareinsights\.com)$/i.test(
        host
      ) ||
      host.endsWith('.githubassets.com')
    ) {
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
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&apos;', "'")
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
    const low = html.slice(0, 5000).toLowerCase();
    if (
      low.includes('<title>just a moment...</title>') ||
      low.includes('attention required! | cloudflare') ||
      low.includes('sorry, you have been blocked') ||
      low.includes('/cdn-cgi/challenge-platform') ||
      low.includes('cf-chl-') ||
      low.includes('performing security verification') ||
      low.includes('connection check')
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
    const typeMatch = tag.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const inputType = String(typeMatch?.[1] || 'hidden').toLowerCase();
    if (['submit', 'button', 'image', 'reset', 'file'].includes(inputType)) continue;
    const valMatch = tag.match(/\bvalue\s*=\s*["']([^"']*)["']/i);
    fields[decodeHtmlEntities(nameMatch[1])] = valMatch ? decodeHtmlEntities(valMatch[1]) : '';
  }
  return fields;
}

function extractAutoSubmitForm(html = '', baseUrl = '') {
  const source = String(html || '');
  const forms = [...source.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)];
  for (const f of forms) {
    const openAttrs = f[1] || '';
    const inner = f[2] || '';
    const actionMatch = openAttrs.match(/\baction\s*=\s*["']([^"']+)["']/i);
    if (!actionMatch?.[1]) continue;
    const methodMatch = openAttrs.match(/\bmethod\s*=\s*["']?([a-z]+)/i);
    const method = String(methodMatch?.[1] || 'GET').toUpperCase();
    const fields = extractHiddenInputs(inner);
    const fieldKeys = Object.keys(fields);

    // Reject obvious search/login forms on normal destination sites
    if (
      /\b(?:search|q|query|username|password|email)\b/i.test(
        `${openAttrs} ${fieldKeys.join(' ')}`
      ) &&
      !/newwpsafelink|ad_form_data|safelink/i.test(inner)
    ) {
      continue;
    }

    const formTagMatchesSubmit =
      /id\s*=\s*["'](?:form|go-link|wpsafe-generate|safelink)["']|ad_form_data|newwpsafelink/i.test(
        `${openAttrs} ${inner}`
      ) || /\.submit\s*\(\s*\)/i.test(source);
    const hasOnlyHiddenInputs =
      fieldKeys.length > 0 &&
      !/<(?:input[^>]+type\s*=\s*["'](?:text|email|password|search|tel|url|number)["']|textarea|select)/i.test(
        inner
      ) &&
      !/search|login|signin/i.test(actionMatch[1]);

    if (!formTagMatchesSubmit && !hasOnlyHiddenInputs) continue;
    if (/ad_form_data/i.test(inner) && fields._csrfToken) {
      return { kind: 'adlinkfly', actionUrl: new URL(decodeHtmlEntities(actionMatch[1]), baseUrl).toString(), method: 'POST', fields };
    }

    try {
      const target = new URL(decodeHtmlEntities(actionMatch[1]), baseUrl);
      if (method === 'GET') {
        for (const [k, v] of Object.entries(fields)) {
          target.searchParams.set(k, v);
        }
        const check = isPublicSafeUrl(target.toString());
        if (check.safe && check.url !== baseUrl) {
          return { kind: 'get', nextUrl: check.url, fields };
        }
      } else if (method === 'POST' && fieldKeys.length > 0) {
        const check = isPublicSafeUrl(target.toString());
        if (check.safe) {
          return { kind: 'post', actionUrl: check.url, fields };
        }
      }
    } catch {
      // Ignore malformed form action
    }
  }
  return null;
}

function isSafelinkUGateHtml(html = '') {
  return (
    /<div[^>]+id\s*=\s*["']verify["']/i.test(html) &&
    (/second_open_placeholder/i.test(html) || /\/c\/assets\/[A-Za-z0-9_-]+\.js/i.test(html))
  );
}

function extractRedirectFromHtml(html = '', baseUrl = '') {
  const source = String(html || '');
  if (!source) return { nextUrl: '', method: '', title: '', signals: [] };

  const signals = [];
  const titleMatch = source.match(/<title[^>]*>([\s\S]{1,180}?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ')) : '';

  const resolveCandidate = (raw) => {
    const cleaned = decodeHtmlEntities(
      String(raw || '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\\\//g, '/')
    );
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

  // 2. Direct JS redirect / target variables
  const jsPatterns = [
    /(?:window\.|top\.|self\.|document\.)?location(?:\.href)?\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i,
    /(?:window\.|top\.|self\.)?location\.replace\(\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']\s*\)/i,
    /(?:window\.|top\.|self\.)?location\.assign\(\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']\s*\)/i,
    /\b(?:targetUrl|finalUrl|redirectUrl|destinationUrl|link_target|go_url|target_url|url_tujuan)\s*[:=]\s*["'](https?:\\?\/\\?\/[^"'<>\s]{6,})["']/i,
    /"(?:url|destination|target|redirect)"\s*:\s*"(https?:\\?\/\\?\/[^"<>\s]{8,})"/i,
  ];

  for (const re of jsPatterns) {
    const m = source.match(re);
    if (!m?.[1]) continue;
    const candidate = resolveCandidate(m[1]);
    if (candidate && !isBogusBypassCandidate(candidate, baseUrl)) {
      return { nextUrl: candidate, method: 'js-redirect', title, signals };
    }
  }

  // 3. Scan ALL atob(...) Base64 calls (avoid stopping at a non-URL first match)
  for (const m of source.matchAll(/atob\(\s*["']([A-Za-z0-9+/=_-]{16,768})["']\s*\)/gi)) {
    const candidate = tryBase64DecodeUrl(m[1]);
    if (candidate && !isBogusBypassCandidate(candidate, baseUrl)) {
      return { nextUrl: candidate, method: 'js-base64', title, signals };
    }
  }

  // 4. Blogger / WordPress Safelink hidden Base64 tokens & MediaFire / Sfile / Get-Link buttons
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
    /<a[^>]+id\s*=\s*["'](?:wpsafe-link|btn-main|btn-get-link|download)["'][^>]+href\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i,
    /<a[^>]+(?:id|class)\s*=\s*["'][^"']*(?:get[-_]?link|skip[-_]?ad|go[-_]?link|btn[-_]?download|direct[-_]?link)[^"']*["'][^>]+href\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i,
    /<a[^>]+href\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["'][^>]+(?:id|class)\s*=\s*["'][^"']*(?:get[-_]?link|skip[-_]?ad|go[-_]?link|btn[-_]?download|direct[-_]?link|wpsafe-link)[^"']*["']/i,
    /data-(?:url|href|target)\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i,
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Solves SafelinkU v3 / Semawur / Khaddavi / Tutwuri gate starting from an already-fetched gate page + CookieJar.
 */
async function solveSafelinkUGateSession(pageUrl, jar, hops) {
  const origin = new URL(pageUrl).origin;
  const fp = 'a'.repeat(64);
  const hashTag = '#' + btoa(fp);

  const makeToken = () => {
    const rawXsrf = jar.get('XSRF-TOKEN') || '';
    if (!rawXsrf) return '';
    const dec = decodeURIComponent(rawXsrf);
    return dec.slice(0, 128 - hashTag.length) + hashTag;
  };

  const apiPost = async (apiPath, payload, referer) => {
    const xsrf = decodeURIComponent(jar.get('XSRF-TOKEN') || '');
    const res = await fetch(new URL(apiPath, origin).toString(), {
      method: 'POST',
      signal: AbortSignal.timeout(6500),
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        Accept: 'application/json, */*',
        Origin: origin,
        Referer: referer,
        Cookie: buildCookieHeader(jar),
        ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
      },
      body: JSON.stringify(payload),
    });
    extractSetCookies(res, jar);
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, json };
  };

  let currentPageUrl = pageUrl;
  for (let round = 0; round < 4; round += 1) {
    const token = makeToken();
    if (!token) return { ok: false, reason: 'no_xsrf_cookie' };

    const sess = await apiPost('/api/session', { _token: token }, currentPageUrl);
    if (!sess.ok || !sess.json) {
      return { ok: false, reason: `session_${sess.status}` };
    }
    if (sess.json.captcha === 'turnstile' || sess.json.passcode) {
      return { ok: false, reason: 'turnstile_or_passcode' };
    }

    if (sess.json.step === 1) {
      let ver = await apiPost('/api/verify', { _a: 0 }, currentPageUrl);
      if (ver.status === 422) {
        await sleep(3500);
        ver = await apiPost('/api/verify', { _a: 0 }, currentPageUrl);
      }
      if (!ver.ok || !ver.json?.target) {
        return { ok: false, reason: `verify_${ver.status}` };
      }

      let nextStepUrl = new URL(ver.json.target, origin).toString();
      hops.push({
        step: hops.length + 1,
        url: currentPageUrl,
        status: ver.status,
        type: 'safelinku-verify',
        target: nextStepUrl,
      });

      // Follow redirect.php -> article step 2
      for (let rHop = 0; rHop < 4; rHop += 1) {
        const check = isPublicSafeUrl(nextStepUrl);
        if (!check.safe) return { ok: false, reason: 'unsafe_hop' };
        const res = await fetch(check.url, {
          method: 'GET',
          redirect: 'manual',
          signal: AbortSignal.timeout(HOP_TIMEOUT_MS),
          headers: {
            'User-Agent': USER_AGENT,
            Referer: currentPageUrl,
            Cookie: buildCookieHeader(jar),
          },
        });
        extractSetCookies(res, jar);
        const loc = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && loc) {
          const resolved = new URL(loc, check.url).toString();
          hops.push({
            step: hops.length + 1,
            url: check.url,
            status: res.status,
            type: 'http-redirect',
            target: resolved,
          });
          nextStepUrl = resolved;
          continue;
        }
        if (res.body) await res.body.cancel().catch(() => {});
        currentPageUrl = check.url;
        break;
      }
      continue;
    }

    if (sess.json.step === 2) {
      const a = Math.floor(Math.random() * 900) + 100;
      const size = `${(1920 + a) * 2}.${(1080 + a) * 2}`;
      let goRes = await apiPost('/api/go', { key: a, size, ado: null }, currentPageUrl);
      if (goRes.status === 422) {
        await sleep(3000);
        goRes = await apiPost('/api/go', { key: a, size, ado: null }, currentPageUrl);
      }
      const dest = String(goRes.json?.url || '').trim();
      const check = isPublicSafeUrl(dest);
      if (goRes.ok && check.safe && !isBogusBypassCandidate(check.url, currentPageUrl)) {
        hops.push({
          step: hops.length + 1,
          url: currentPageUrl,
          status: goRes.status,
          type: 'safelinku-go',
          target: check.url,
        });
        return { ok: true, resolvedUrl: check.url };
      }
      return { ok: false, reason: `go_${goRes.status}` };
    }

    return { ok: false, reason: `unknown_step_${sess.json.step}` };
  }

  return { ok: false, reason: 'max_rounds' };
}

/**
 * Solves AdLinkFly AJAX form (_csrfToken + ad_form_data -> /links/go) inside CookieJar.
 */
async function solveAdLinkFlyAjax(formInfo, pageUrl, jar, hops) {
  const bodyStr = new URLSearchParams(formInfo.fields).toString();
  const actionUrl = formInfo.actionUrl || new URL('/links/go', pageUrl).toString();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) await sleep(3500);
    const res = await fetchJsonSafe(actionUrl, 5500, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: new URL(pageUrl).origin,
        Referer: pageUrl,
        Cookie: buildCookieHeader(jar),
      },
      body: bodyStr,
    }).catch(() => null);

    const dest = String(res?.json?.url || '').trim();
    if (dest && !isBogusBypassCandidate(dest, pageUrl)) {
      const check = isPublicSafeUrl(dest);
      if (check.safe) {
        hops.push({
          step: hops.length + 1,
          url: pageUrl,
          status: res.status || 200,
          type: 'adlinkfly-go',
          target: check.url,
        });
        return { ok: true, resolvedUrl: check.url };
      }
    }
  }
  return { ok: false };
}

/**
 * Cookie-jar multi-hop HTTP + Auto-Submit <form> + SafelinkU + AdLinkFly + HTML/JS tracer.
 */
async function traceSafeRedirects(startUrl) {
  const hops = [];
  const signals = new Set();
  const jar = new Map();
  let current = startUrl;
  let prevReferer = '';
  let finalTitle = '';
  let finalContentType = '';
  let finalStatus = 0;
  let cfBlocked = false;
  let nextMethod = 'GET';
  let nextPostBody = '';

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
      if (prevReferer) headers.Referer = prevReferer;
      if (nextMethod === 'POST') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        headers.Origin = new URL(check.url).origin;
      }
      const cookieHdr = buildCookieHeader(jar);
      if (cookieHdr) headers.Cookie = cookieHdr;

      const res = await fetch(check.url, {
        method: nextMethod,
        redirect: 'manual',
        signal: controller.signal,
        headers,
        ...(nextMethod === 'POST' ? { body: nextPostBody } : {}),
      });
      nextMethod = 'GET';
      nextPostBody = '';
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
          step: hops.length + 1,
          url: check.url,
          status: res.status,
          type: 'http-redirect',
          target: nextCheck.safe ? nextCheck.url : '[diblokir]',
        });
        if (!nextCheck.safe || nextCheck.url === check.url) {
          if (!nextCheck.safe) signals.add('blocked_private_hop');
          break;
        }
        prevReferer = check.url;
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
            step: hops.length + 1,
            url: check.url,
            status: res.status,
            type: 'cloudflare-challenge',
            target: check.url,
          });
          break;
        }

        const onShortenerOrEntry = i === 0 || isShortenerLikeUrl(check.url);
        const hasExplicitSafelinkHtml =
          isSafelinkUGateHtml(html) ||
          (/ad_form_data/i.test(html) && /_csrfToken/i.test(html)) ||
          /newwpsafelink|id\s*=\s*["']wpsafe-link["']/i.test(html);

        // Check SafelinkU v3 gate (semawur / khaddavi / safelinku / sfl.gl / tutwuri)
        if (isSafelinkUGateHtml(html) && jar.has('XSRF-TOKEN')) {
          signals.add('ad_countdown_wall');
          const slOut = await solveSafelinkUGateSession(check.url, jar, hops);
          if (slOut.ok && slOut.resolvedUrl) {
            prevReferer = check.url;
            current = slOut.resolvedUrl;
            continue;
          }
          if (slOut.reason === 'turnstile_or_passcode') {
            signals.add('captcha_challenge');
          }
        }

        // Only run HTML redirect/form extraction when we are still on a shortener/entry hop
        // OR the HTML itself matches an explicit safelink/meta-refresh gate (prevents false matches on github.com/wikipedia.org!)
        const titleOnlyMatch = html.match(/<title[^>]*>([\s\S]{1,180}?)<\/title>/i);
        if (titleOnlyMatch?.[1]) {
          finalTitle = decodeHtmlEntities(titleOnlyMatch[1].replace(/\s+/g, ' '));
        }

        if (onShortenerOrEntry || hasExplicitSafelinkHtml) {
          const extracted = extractRedirectFromHtml(html, check.url);
          if (extracted.title) finalTitle = extracted.title;
          extracted.signals.forEach((s) => signals.add(s));

          if (extracted.nextUrl) {
            hops.push({
              step: hops.length + 1,
              url: check.url,
              status: res.status,
              type: extracted.method || 'html-redirect',
              target: extracted.nextUrl,
            });
            prevReferer = check.url;
            current = extracted.nextUrl;
            continue;
          }

          // Check auto-submit <form> (GET or POST) or Universal AdLinkFly AJAX form
          const formInfo = extractAutoSubmitForm(html, check.url);
          if (formInfo) {
            if (formInfo.kind === 'adlinkfly') {
              signals.add('ad_countdown_wall');
              const alf = await solveAdLinkFlyAjax(formInfo, check.url, jar, hops);
              if (alf.ok && alf.resolvedUrl) {
                prevReferer = check.url;
                current = alf.resolvedUrl;
                continue;
              }
            } else if (formInfo.kind === 'get' && formInfo.nextUrl) {
              hops.push({
                step: hops.length + 1,
                url: check.url,
                status: res.status,
                type: 'form-get',
                target: formInfo.nextUrl,
              });
              prevReferer = check.url;
              current = formInfo.nextUrl;
              continue;
            } else if (formInfo.kind === 'post' && formInfo.actionUrl) {
              hops.push({
                step: hops.length + 1,
                url: check.url,
                status: res.status,
                type: 'form-post',
                target: formInfo.actionUrl,
              });
              prevReferer = check.url;
              current = formInfo.actionUrl;
              nextMethod = 'POST';
              nextPostBody = new URLSearchParams(formInfo.fields).toString();
              continue;
            }
          }
        }
      } else if (res.body) {
        await res.body.cancel().catch(() => {});
      }

      hops.push({
        step: hops.length + 1,
        url: check.url,
        status: res.status,
        type: 'destination',
        target: check.url,
      });
      break;
    } catch (err) {
      clearTimeout(timer);
      hops.push({
        step: hops.length + 1,
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
    name: 'Edge Cookie-Jar & HTML/Form Inspector',
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
 * Native Open-Source Service Solvers (Ouo.io, Rekonise, Bicolink, AdLinkFly)
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
    // Bicolink nonce + /al/free/{slug} solver
    if (host === 'bicolink.com' || host === 'bicolink.net' || host === 'bico.link') {
      const jar = new Map();
      const origin = new URL(targetUrl).origin;
      const slug = new URL(targetUrl).pathname.replace(/^\/+|\/+$/g, '').split('/').pop() || '';
      if (slug) {
        const freeUrl = `${origin}/al/free/${slug}`;
        const p1 = await fetch(freeUrl, {
          headers: { 'User-Agent': USER_AGENT, Referer: targetUrl },
          signal: AbortSignal.timeout(5500),
        });
        extractSetCookies(p1, jar);
        const h1 = await p1.text().catch(() => '');
        if (isCloudflareChallengeResponse(p1.status, p1.headers, h1)) {
          return {
            engineId: 'native-solver',
            name: 'Solver Native Open-Source',
            category: 'open-source',
            ok: false,
            resolvedUrl: '',
            cfBlocked: true,
            latencyMs: Date.now() - started,
            note: 'Bicolink membatasi koneksi non-browser',
          };
        }
        const nonceMatch = h1.match(/var\s+nonce\s*=\s*["']([^"']+)["']/);
        if (nonceMatch?.[1]) {
          let sum = 0;
          const nonce = nonceMatch[1];
          for (let i = 0; i < nonce.length; i += 1) {
            sum = (sum * 31 + nonce.charCodeAt(i) + i) % 1000000007;
          }
          const body = `nt_fb=${encodeURIComponent(sum.toString(36))}&nt_dari=tantangan`;
          await fetch(`${origin}/al/verify/${slug}`, {
            method: 'POST',
            headers: {
              'User-Agent': USER_AGENT,
              'Content-Type': 'application/x-www-form-urlencoded',
              Referer: freeUrl,
              Cookie: buildCookieHeader(jar),
            },
            body,
            signal: AbortSignal.timeout(5500),
          });
          const p2 = await fetch(freeUrl, {
            headers: { 'User-Agent': USER_AGENT, Referer: freeUrl, Cookie: buildCookieHeader(jar) },
            signal: AbortSignal.timeout(5500),
          });
          const h2 = await p2.text().catch(() => '');
          const ext = extractRedirectFromHtml(h2, freeUrl);
          if (ext.nextUrl) {
            return {
              engineId: 'native-solver',
              name: 'Solver Native Open-Source',
              category: 'open-source',
              ok: true,
              resolvedUrl: ext.nextUrl,
              latencyMs: Date.now() - started,
              note: 'Bicolink berhasil diurai',
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
    note: host ? 'Aktif untuk pola SafelinkU/AdLinkFly/Ouo/Rekonise' : 'Domain langsung',
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
        !/Just a moment/i.test(txt.slice(0, 400)) &&
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

function raceWithGrace(promise, graceMs, fallbackObj) {
  return Promise.race([
    promise,
    sleep(graceMs).then(() => fallbackObj),
  ]);
}

async function runStageEngines(targetUrl, deadlineMs = Date.now() + 14000) {
  const adWall = isAdWallHost(targetUrl);
  const remaining = Math.max(2500, deadlineMs - Date.now());
  const timeoutMs = Math.min(adWall ? ADWALL_API_TIMEOUT_MS : FAST_API_TIMEOUT_MS, remaining);

  // Always launch all engines in parallel so custom/unlisted shortlinks are NEVER skipped!
  const edgePromise = traceSafeRedirects(targetUrl);
  const nativePromise = queryNativeServiceSolver(targetUrl);
  const trwPromise = queryTrwBypassApi(targetUrl, timeoutMs);
  const bypassXPromise = queryBypassXApi(targetUrl, timeoutMs);
  const unMePromise = queryUnshortenMe(targetUrl, FAST_API_TIMEOUT_MS);

  // Wait for Edge Tracer first: if Edge already advanced cleanly OR already resolved past a multi-hop
  // safelink onto the next stage URL, cap remaining external APIs to a quick 1.4s grace window
  // instead of burning 7-16s before Stage 2 can start!
  const edgeTrace = await edgePromise;
  const edgeAlreadyClean = Boolean(
    edgeTrace.ok &&
      !edgeTrace.cfBlocked &&
      edgeTrace.status > 0 &&
      edgeTrace.status < 400 &&
      !isShortenerLikeUrl(edgeTrace.resolvedUrl)
  );
  const edgeFoundNextStage = Boolean(
    edgeTrace.ok &&
      edgeTrace.resolvedUrl &&
      edgeTrace.resolvedUrl !== targetUrl
  );

  const [nativeRes, trwRes, bypassXRes, unMeRes] =
    edgeAlreadyClean || edgeFoundNextStage
      ? await Promise.all([
        raceWithGrace(nativePromise, FAST_RACE_GRACE_MS, {
          engineId: 'native-solver',
          name: 'Solver Native Open-Source',
          category: 'open-source',
          ok: false,
          resolvedUrl: '',
          note: 'Sudah diselesaikan Edge Tracer',
        }),
        raceWithGrace(trwPromise, FAST_RACE_GRACE_MS, {
          engineId: 'trw-api',
          name: 'TRW Community Bypass API',
          category: 'open-source',
          ok: false,
          resolvedUrl: '',
          note: 'Sudah diselesaikan Edge Tracer',
        }),
        raceWithGrace(bypassXPromise, FAST_RACE_GRACE_MS, {
          engineId: 'bypassx-api',
          name: 'BypassX Open Community API',
          category: 'open-source',
          ok: false,
          resolvedUrl: '',
          note: 'Sudah diselesaikan Edge Tracer',
        }),
        raceWithGrace(unMePromise, FAST_RACE_GRACE_MS, {
          engineId: 'unshorten-me',
          name: 'Unshorten.me Public API',
          category: 'public-api',
          ok: false,
          resolvedUrl: '',
          note: 'Sudah diselesaikan Edge Tracer',
        }),
      ])
    : await Promise.all([nativePromise, trwPromise, bypassXPromise, unMePromise]);

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
    trwRes,
    bypassXRes,
    unMeRes,
  ];

  // If still unresolved & blocked by Cloudflare/JS (and Edge didn't already advance to another stage), try Jina once if enough budget remains
  const anyProgressedTarget = engines.some((e) => e.ok && e.resolvedUrl && e.resolvedUrl !== targetUrl);
  const anyCleanTarget = engines.some(
    (e) => e.ok && e.resolvedUrl && !isShortenerLikeUrl(e.resolvedUrl)
  );
  if (
    !anyCleanTarget &&
    !anyProgressedTarget &&
    Date.now() + 3000 < deadlineMs &&
    (edgeTrace.cfBlocked || adWall || isShortenerLikeUrl(targetUrl))
  ) {
    const jinaCap = Math.min(4200, Math.max(2500, deadlineMs - Date.now()));
    const jinaRes = await raceWithGrace(queryJinaReaderFallback(targetUrl), jinaCap, {
      engineId: 'jina-reader',
      name: 'Headless Reader Inspector',
      category: 'public-api',
      ok: false,
      resolvedUrl: '',
      note: 'Halaman dilindungi verifikasi',
    });
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

  const reqStarted = Date.now();
  const reqDeadline = reqStarted + 15000;

  // Stage 1: Initial Multi-Engine Parallel Execution
  const stage1 = await runStageEngines(check.url, reqDeadline);
  const allHops = [...stage1.edgeTrace.hops];
  const allSignals = new Set(stage1.edgeTrace.signals);
  let finalPageTitle = stage1.edgeTrace.pageTitle;
  let finalEdgeResolvedUrl = stage1.edgeTrace.resolvedUrl;
  let finalEdgeStatus = stage1.edgeTrace.status;
  let finalEdgeContentType = stage1.edgeTrace.contentType;
  let cfBlockedAny = Boolean(stage1.edgeTrace.cfBlocked || allSignals.has('cloudflare_block'));
  const engines = [...stage1.engines];

  // Chain up to 2 extra stages if intermediate URL landed on ANOTHER shortener/ad-wall (within 15s total budget)
  let currentIntermediate =
    engines.find((e) => e.ok && e.resolvedUrl && e.resolvedUrl !== check.url && isShortenerLikeUrl(e.resolvedUrl))
      ?.resolvedUrl || '';
  const visitedStages = new Set([check.url]);

  for (let chainPass = 0; chainPass < 2; chainPass += 1) {
    if (!currentIntermediate || visitedStages.has(currentIntermediate)) break;
    if (Date.now() + 2500 > reqDeadline) break;
    visitedStages.add(currentIntermediate);

    const stageN = await runStageEngines(currentIntermediate, reqDeadline);
    for (const h of stageN.edgeTrace.hops) {
      allHops.push({ ...h, step: allHops.length + 1 });
    }
    stageN.edgeTrace.signals.forEach((s) => allSignals.add(s));
    if (stageN.edgeTrace.pageTitle) finalPageTitle = stageN.edgeTrace.pageTitle;
    if (stageN.edgeTrace.cfBlocked) cfBlockedAny = true;
    if (stageN.edgeTrace.ok && stageN.edgeTrace.resolvedUrl) {
      finalEdgeResolvedUrl = stageN.edgeTrace.resolvedUrl;
      finalEdgeStatus = stageN.edgeTrace.status;
      finalEdgeContentType = stageN.edgeTrace.contentType;
    }

    let nextIntermediate = '';
    for (const eN of stageN.engines) {
      if (eN.cfBlocked) cfBlockedAny = true;
      if (!eN.ok || !eN.resolvedUrl || eN.resolvedUrl === currentIntermediate) continue;
      const existing = engines.find((e) => e.engineId === eN.engineId);
      if (existing) {
        existing.ok = true;
        existing.resolvedUrl = eN.resolvedUrl;
        existing.note = `${eN.note} (rantai lanjutan)`;
      } else {
        engines.push(eN);
      }
      if (!nextIntermediate && isShortenerLikeUrl(eN.resolvedUrl)) {
        nextIntermediate = eN.resolvedUrl;
      }
    }
    currentIntermediate = nextIntermediate;
  }

  return jsonResponse({
    ok: true,
    inputUrl: check.url,
    edgeTrace: {
      resolvedUrl: finalEdgeResolvedUrl,
      status: finalEdgeStatus,
      contentType: finalEdgeContentType,
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
