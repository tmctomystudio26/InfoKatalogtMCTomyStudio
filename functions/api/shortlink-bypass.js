/**
 * Cloudflare Pages Edge Function: /api/shortlink-bypass (v87)
 *
 * Collaborative Multi-Engine Shortlink Bypass & Anti-Malware Edge Resolver:
 *  1. Strict SSRF & scheme protection on input AND every single redirect hop
 *     (blocks private IPv4/IPv6, loopback, link-local, cloud metadata, .local/.internal).
 *  2. Safe HTTP Redirect Chain Tracer (up to 10 hops) + HTML/JS/Meta-Refresh/Canonical/Safelink
 *     payload inspector (reads capped <= 180 KB HTML without executing untrusted scripts).
 *  3. Parallel Fan-Out across Open-Source & Public Community Bypass APIs:
 *     - bypass.vip (open-source community shortlink/ad-wall bypass API)
 *     - bypass.pm (open-source community bypass2 API)
 *     - unshorten.me (public redirect unshortener API)
 *     - unshorten.it / expandurl (public link expander fallback)
 *  4. Returns unified consensus candidates, redirect trail, extracted page title,
 *     and safe HTML snippet hints for client-side Multi-AI Ensemble security analysis.
 */

const MAX_HOPS = 10;
const HOP_TIMEOUT_MS = 4500;
const API_TIMEOUT_MS = 5500;
const MAX_HTML_BYTES = 180 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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

  // Block decimal/octal/hex obfuscated IPv4 literals (e.g. http://2130706433 or 0x7f000001)
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
  if (clean.length < 12 || clean.length > 1024 || !/^[A-Za-z0-9+/=]+$/.test(clean)) return '';
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

function extractRedirectFromHtml(html = '', baseUrl = '') {
  const source = String(html || '');
  if (!source) return { nextUrl: '', title: '', signals: [] };

  const signals = [];
  const titleMatch = source.match(/<title[^>]*>([\s\S]{1,180}?)<\/title>/i);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].replace(/\s+/g, ' ')) : '';

  const resolveCandidate = (raw) => {
    const cleaned = decodeHtmlEntities(String(raw || '').trim().replace(/^['"]|['"]$/g, ''));
    if (!cleaned || cleaned.startsWith('#') || /^javascript:/i.test(cleaned)) return '';
    try {
      const abs = new URL(cleaned, baseUrl).toString();
      const check = isPublicSafeUrl(abs);
      if (!check.safe) return '';
      if (check.url === baseUrl) return '';
      return check.url;
    } catch {
      return '';
    }
  };

  // Detect common ad-wall / countdown / captcha / popup scripts for safety report
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

  // 2. Direct JS redirect patterns: window.location / location.href / location.replace
  const jsPatterns = [
    /(?:window\.|top\.|self\.)?location(?:\.href)?\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i,
    /(?:window\.|top\.|self\.)?location\.replace\(\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']\s*\)/i,
    /(?:window\.|top\.|self\.)?location\.assign\(\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']\s*\)/i,
    /atob\(\s*["']([A-Za-z0-9+/=_-]{16,512})["']\s*\)/i,
  ];

  for (let i = 0; i < jsPatterns.length; i += 1) {
    const m = source.match(jsPatterns[i]);
    if (!m?.[1]) continue;
    const candidate = i === 3 ? tryBase64DecodeUrl(m[1]) : resolveCandidate(m[1]);
    if (candidate) return { nextUrl: candidate, method: i === 3 ? 'js-base64' : 'js-redirect', title, signals };
  }

  // 3. Common Safelink / Get-Link button attributes (data-url, data-href, a#get-link)
  const safelinkBtn = source.match(
    /<a[^>]+(?:id|class)\s*=\s*["'][^"']*(?:get[-_]?link|skip[-_]?ad|go[-_]?link|btn[-_]?download|direct[-_]?link)[^"']*["'][^>]+href\s*=\s*["'](https?:\/\/[^"'<>\\\s]{6,})["']/i
  );
  if (safelinkBtn?.[1]) {
    const candidate = resolveCandidate(safelinkBtn[1]);
    if (candidate) return { nextUrl: candidate, method: 'safelink-anchor', title, signals };
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

async function traceSafeRedirects(startUrl) {
  const hops = [];
  const signals = new Set();
  let current = startUrl;
  let finalTitle = '';
  let finalContentType = '';
  let finalStatus = 0;

  for (let i = 0; i < MAX_HOPS; i += 1) {
    const check = isPublicSafeUrl(current);
    if (!check.safe) {
      signals.add('blocked_private_hop');
      break;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HOP_TIMEOUT_MS);
    try {
      const res = await fetch(check.url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      clearTimeout(timer);

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

      // Non-redirect response: inspect HTML safely if text/html
      if (finalContentType.includes('text/html') || finalContentType.includes('application/xhtml')) {
        const html = await readTextCapped(res, MAX_HTML_BYTES);
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
      } else {
        // Cancel binary/download stream immediately so we never pull large binaries
        if (res.body) await res.body.cancel().catch(() => {});
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
    name: 'Edge Redirect & HTML Inspector',
    category: 'edge',
    ok: hops.length > 0 && current !== startUrl,
    reachable: finalStatus > 0,
    resolvedUrl: current,
    status: finalStatus,
    contentType: finalContentType,
    pageTitle: finalTitle,
    hops,
    signals: [...signals],
  };
}

async function fetchJsonSafe(url, timeoutMs = API_TIMEOUT_MS, init = {}) {
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

async function queryBypassVip(targetUrl) {
  const started = Date.now();
  try {
    const res = await fetchJsonSafe(
      `https://api.bypass.vip/bypass?url=${encodeURIComponent(targetUrl)}`,
      API_TIMEOUT_MS
    );
    const candidate = String(res.json?.result || res.json?.destination || '').trim();
    const check = candidate ? isPublicSafeUrl(candidate) : { safe: false };
    return {
      engineId: 'bypass-vip',
      name: 'Bypass.VIP Open API',
      category: 'open-source',
      ok: Boolean(res.ok && check.safe && check.url !== targetUrl),
      resolvedUrl: check.safe ? check.url : '',
      latencyMs: Date.now() - started,
      note: check.safe ? 'Berhasil melewati halaman iklan' : 'Tidak tersedia untuk domain ini',
    };
  } catch {
    return {
      engineId: 'bypass-vip',
      name: 'Bypass.VIP Open API',
      category: 'open-source',
      ok: false,
      resolvedUrl: '',
      latencyMs: Date.now() - started,
      note: 'Mesin sedang sibuk',
    };
  }
}

async function queryBypassPm(targetUrl) {
  const started = Date.now();
  try {
    const res = await fetchJsonSafe(
      `https://bypass.pm/bypass2?url=${encodeURIComponent(targetUrl)}`,
      API_TIMEOUT_MS
    );
    const candidate = String(res.json?.destination || res.json?.result || '').trim();
    const check = candidate ? isPublicSafeUrl(candidate) : { safe: false };
    return {
      engineId: 'bypass-pm',
      name: 'Bypass.PM Community API',
      category: 'open-source',
      ok: Boolean(res.ok && check.safe && check.url !== targetUrl),
      resolvedUrl: check.safe ? check.url : '',
      latencyMs: Date.now() - started,
      note: check.safe ? 'Tautan tujuan ditemukan' : 'Domain belum didukung',
    };
  } catch {
    return {
      engineId: 'bypass-pm',
      name: 'Bypass.PM Community API',
      category: 'open-source',
      ok: false,
      resolvedUrl: '',
      latencyMs: Date.now() - started,
      note: 'Mesin sedang sibuk',
    };
  }
}

async function queryUnshortenMe(targetUrl) {
  const started = Date.now();
  try {
    const res = await fetchJsonSafe(
      `https://unshorten.me/json/${encodeURIComponent(targetUrl)}`,
      API_TIMEOUT_MS
    );
    const candidate = String(res.json?.resolved_url || '').trim();
    const check = candidate ? isPublicSafeUrl(candidate) : { safe: false };
    return {
      engineId: 'unshorten-me',
      name: 'Unshorten.me Public API',
      category: 'public-api',
      ok: Boolean(res.ok && res.json?.success && check.safe && check.url !== targetUrl),
      resolvedUrl: check.safe ? check.url : '',
      latencyMs: Date.now() - started,
      note: check.safe ? 'Redirect berhasil diurai' : 'Tidak ada pengalihan tambahan',
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

async function queryUnshortenIt(targetUrl) {
  const started = Date.now();
  try {
    const res = await fetchJsonSafe(
      `https://unshorten.it/api/v1/unshorten?shortURL=${encodeURIComponent(targetUrl)}&responseFormat=json`,
      API_TIMEOUT_MS
    );
    const candidate = String(res.json?.fullurl || res.json?.resolved_url || '').trim();
    const check = candidate ? isPublicSafeUrl(candidate) : { safe: false };
    return {
      engineId: 'unshorten-it',
      name: 'Unshorten.it Resolver',
      category: 'public-api',
      ok: Boolean(res.ok && check.safe && check.url !== targetUrl),
      resolvedUrl: check.safe ? check.url : '',
      latencyMs: Date.now() - started,
      note: check.safe ? 'URL lengkap berhasil diperiksa' : 'Tidak ada pengalihan tambahan',
    };
  } catch {
    return {
      engineId: 'unshorten-it',
      name: 'Unshorten.it Resolver',
      category: 'public-api',
      ok: false,
      resolvedUrl: '',
      latencyMs: Date.now() - started,
      note: 'Mesin sedang sibuk',
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

  // Run Edge Tracer + Open-Source & Public Bypass APIs collaboratively in parallel
  const [edgeTrace, vipRes, pmRes, unMeRes, unItRes] = await Promise.all([
    traceSafeRedirects(check.url),
    queryBypassVip(check.url),
    queryBypassPm(check.url),
    queryUnshortenMe(check.url),
    queryUnshortenIt(check.url),
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
        : edgeTrace.reachable
        ? 'Tautan diakses langsung tanpa pengalihan tambahan'
        : 'Situs asal membatasi akses otomatis',
    },
    vipRes,
    pmRes,
    unMeRes,
    unItRes,
  ];

  return jsonResponse({
    ok: true,
    inputUrl: check.url,
    edgeTrace: {
      resolvedUrl: edgeTrace.resolvedUrl,
      status: edgeTrace.status,
      contentType: edgeTrace.contentType,
      pageTitle: edgeTrace.pageTitle,
      hops: edgeTrace.hops,
      signals: edgeTrace.signals,
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
