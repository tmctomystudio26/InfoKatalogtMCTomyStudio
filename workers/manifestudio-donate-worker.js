/**
 * Manifestudio Please Donate — Cloudflare Worker + D1 SQL Backend (v102)
 *
 * Deployment (Cloudflare Dashboard -> Workers & Pages -> manifestudio-donate -> Edit code):
 *  1. Paste this entire file into worker.js and click Deploy.
 *  2. Required Binding:
 *       - D1 Database -> Variable name: DB (database: manifestudio-donate)
 *  3. Required Secrets (Settings -> Variables and Secrets -> Type: Secret):
 *       - SAWERIA_STREAM_KEY        (from saweria.co -> Overlay -> streamKey=...)
 *       - SOCIABUZZ_WEBHOOK_TOKEN   (from sociabuzz.com/proaccount/tribe -> Integrasi -> Webhook)
 *       - ADMIN_KEY                 (optional secret password for deleting test/spam rows)
 *  4. Custom Domain:
 *       - https://donate-api.manifestudio.my.id
 *  5. Webhook URLs:
 *       - Saweria   : https://donate-api.manifestudio.my.id/webhook/saweria
 *       - SociaBuzz : https://donate-api.manifestudio.my.id/webhook/sociabuzz
 */

const ALLOWED_ORIGINS = new Set([
  'https://manifestudio.my.id',
  'https://www.manifestudio.my.id',
  'https://manifestore.my.id',
  'https://www.manifestore.my.id',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

// Fallback IDR conversion rates per 1 unit of foreign currency (used ONLY if all 3 live FX APIs are simultaneously unreachable)
const FALLBACK_TO_IDR = Object.freeze({
  IDR: 1,
  USD: 16500,
  SGD: 12300,
  MYR: 3750,
  EUR: 17800,
  GBP: 20800,
  AUD: 10700,
  JPY: 110,
  KRW: 12,
  PHP: 285,
  THB: 480,
  BND: 12300,
  HKD: 2120,
  TWD: 510,
  CAD: 11800,
  NZD: 9700,
  SAR: 4400,
  AED: 4490,
  CNY: 2280,
  INR: 195,
  VND: 0.65,
  CHF: 18600,
});

const CURRENCY_ALIASES = Object.freeze({
  RP: 'IDR',
  IDR: 'IDR',
  RUPIAH: 'IDR',
  RM: 'MYR',
  MYR: 'MYR',
  RINGGIT: 'MYR',
  SGD: 'SGD',
  'S$': 'SGD',
  USD: 'USD',
  US$: 'USD',
  $: 'USD',
  EUR: 'EUR',
  '€': 'EUR',
  GBP: 'GBP',
  '£': 'GBP',
  AUD: 'AUD',
  A$: 'AUD',
  AU$: 'AUD',
  JPY: 'JPY',
  '¥': 'JPY',
  YEN: 'JPY',
  KRW: 'KRW',
  '₩': 'KRW',
  WON: 'KRW',
  PHP: 'PHP',
  '₱': 'PHP',
  THB: 'THB',
  '฿': 'THB',
  BND: 'BND',
  B$: 'BND',
  HKD: 'HKD',
  HK$: 'HKD',
  TWD: 'TWD',
  NT$: 'TWD',
  NTD: 'TWD',
  CAD: 'CAD',
  C$: 'CAD',
  CA$: 'CAD',
  NZD: 'NZD',
  NZ$: 'NZD',
  SAR: 'SAR',
  SR: 'SAR',
  AED: 'AED',
  DHS: 'AED',
  CNY: 'CNY',
  RMB: 'CNY',
  INR: 'INR',
  '₹': 'INR',
  VND: 'VND',
  '₫': 'VND',
  CHF: 'CHF',
});

const PROFANITY_REGEX =
  /\b(anjing|anjg|anjir|bangsat|bgst|kontol|kntl|memek|mmk|ngentot|ngentod|entot|pepek|peler|jembut|jancok|jancuk|cok|cuk|asu|bajingan|keparat|brengsek|tolol|goblok|goblog|bego|bodoh|pantek|puki|pukimak|kimak|lonte|pelacur|babi|monyet|setan|iblis|fuck|f\*ck|shit|bitch|asshole|dick|pussy|cunt|motherfucker|bastard|porn|bokep|judi|slot\s*gacor|maxwin|zeus\s*slot|togel|pragmatic|sbobet)\b/gi;

const URL_SPAM_REGEX =
  /(?:https?:\/\/[^\s]+|www\.[^\s]+|\b(?:bit\.ly|tinyurl\.com|s\.id|t\.me|wa\.me|linktr\.ee|shorturl\.at)\/[^\s]*|\b[a-z0-9-]{2,}\.(?:com|net|org|id|co\.id|my\.id|xyz|site|online|vip|top|shop|info|biz|io|gg|me|tv|cc)(?:\/[^\s]*)?)/gi;

const FX_TTL_MS = 15 * 60 * 1000; // Refresh live FX rates every 15 minutes
let schemaReadyPromise = null;
let fxCache = {
  ratesToIdr: { ...FALLBACK_TO_IDR },
  fetchedAt: 0,
  source: 'fallback',
  updatedAt: '',
};

function getCorsHeaders(request, { allowPublicFallback = true } = {}) {
  const origin = request.headers.get('Origin') || '';
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (allowPublicFallback && !origin) {
    headers['Access-Control-Allow-Origin'] = 'https://manifestudio.my.id';
  }
  return headers;
}

function jsonResponse(data, status = 200, request = null, opts = {}) {
  const cors = request ? getCorsHeaders(request, opts) : {};
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...cors,
    },
  });
}

function timingSafeEqualStr(a = '', b = '') {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (!s1 || !s2 || s1.length !== s2.length) return false;
  let diff = 0;
  for (let i = 0; i < s1.length; i += 1) {
    diff |= s1.charCodeAt(i) ^ s2.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(message)));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function stripTagsAndControls(input = '') {
  return String(input ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeDonorName(rawName = '') {
  let clean = stripTagsAndControls(rawName);
  clean = clean.replace(URL_SPAM_REGEX, '[disensor]');
  clean = clean.replace(PROFANITY_REGEX, (m) => `${m[0]}***`);
  clean = clean.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Anonim';
  return clean.slice(0, 60);
}

function normalizeDonorKey(displayName = '') {
  const key = String(displayName || 'anonim')
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
    .trim();
  return key || 'anonim';
}

function sanitizeDonorMessage(rawMsg = '') {
  let clean = stripTagsAndControls(rawMsg);
  if (!clean) return '';
  clean = clean.replace(URL_SPAM_REGEX, '[tautan disensor]');
  clean = clean.replace(PROFANITY_REGEX, (m) => `${m[0]}${'*'.repeat(Math.max(2, m.length - 1))}`);
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean.slice(0, 240);
}

function normalizeCurrencyCode(rawCurrency = '', rawAmountValue = '') {
  const raw = String(rawCurrency ?? '').trim().toUpperCase();
  if (raw && CURRENCY_ALIASES[raw]) return CURRENCY_ALIASES[raw];
  if (/^[A-Z]{3}$/.test(raw)) return raw;

  // Also inspect prefix/suffix in raw amount string if currency field was omitted (e.g. "MYR 10", "RM15", "SGD 20", "$5")
  const amountStr = String(rawAmountValue ?? '').trim().toUpperCase();
  if (amountStr) {
    const prefixMatch = amountStr.match(/^([A-Z]{2,3}|RM|RP|S\$|US\$|AU\$|A\$|HK\$|NT\$|NZ\$|C\$|\$|€|£|¥|₩|₱|฿)\b/);
    if (prefixMatch) {
      const token = prefixMatch[1];
      if (CURRENCY_ALIASES[token]) return CURRENCY_ALIASES[token];
      if (/^[A-Z]{3}$/.test(token)) return token;
    }
  }
  return 'IDR';
}

function parseNumericAmount(val) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  const cleaned = String(val ?? '')
    .replace(/[^\d.,-]/g, '')
    .trim();
  if (!cleaned) return 0;
  // Handle Indonesian thousand separator style e.g. "50.000" vs decimal "10.50"
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, '')) || 0;
  }
  if (/^\d{1,3}(,\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/,/g, '')) || 0;
  }
  return Number(cleaned.replace(/,/g, '.')) || 0;
}

function buildRatesToIdrFromUsdMap(usdRatesMap) {
  const usdToIdr = Number(usdRatesMap?.IDR ?? usdRatesMap?.idr);
  if (!Number.isFinite(usdToIdr) || usdToIdr < 5000 || usdToIdr > 50000) {
    return null;
  }
  const nextRates = { ...FALLBACK_TO_IDR, IDR: 1, USD: usdToIdr };
  for (const [rawCode, ratePerUsd] of Object.entries(usdRatesMap || {})) {
    const code = String(rawCode || '').toUpperCase();
    const r = Number(ratePerUsd);
    if (Number.isFinite(r) && r > 0 && code !== 'IDR') {
      nextRates[code] = usdToIdr / r;
    }
  }
  return nextRates;
}

async function fetchJsonWithTimeout(url, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cf: { cacheTtl: 900, cacheEverything: true },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getLiveRatesToIdr({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && fxCache.fetchedAt && now - fxCache.fetchedAt < FX_TTL_MS) {
    return fxCache.ratesToIdr;
  }

  // Multi-source real-time FX providers (160+ world currencies + ECB institutional rates)
  const providers = [
    {
      name: 'er-api-realtime',
      url: 'https://open.er-api.com/v6/latest/USD',
      extract: (json) => buildRatesToIdrFromUsdMap(json?.rates),
    },
    {
      name: 'jsdelivr-currency-api-realtime',
      url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
      extract: (json) => buildRatesToIdrFromUsdMap(json?.usd),
    },
    {
      name: 'cloudflare-pages-currency-api',
      url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
      extract: (json) => buildRatesToIdrFromUsdMap(json?.usd),
    },
    {
      name: 'frankfurter-ecb-realtime',
      url: 'https://api.frankfurter.dev/v1/latest?base=USD',
      extract: (json) => buildRatesToIdrFromUsdMap(json?.rates),
    },
  ];

  for (const provider of providers) {
    try {
      const json = await fetchJsonWithTimeout(provider.url, 4000);
      const parsedRates = provider.extract(json);
      if (parsedRates) {
        fxCache = {
          ratesToIdr: parsedRates,
          fetchedAt: now,
          source: provider.name,
          updatedAt: new Date(now).toISOString(),
        };
        return fxCache.ratesToIdr;
      }
    } catch {
      // Failover immediately to next real-time FX provider
    }
  }

  return fxCache.ratesToIdr;
}

async function convertCurrencyToIdr(amount, currency = 'IDR', rawAmountStr = '') {
  const safeAmount = Math.max(0, Number(amount) || 0);
  const code = normalizeCurrencyCode(currency, rawAmountStr);
  if (code === 'IDR') {
    return {
      amountIdr: Math.round(safeAmount),
      currency: 'IDR',
      rateUsed: 1,
      fxSource: 'native-idr',
    };
  }
  const rates = await getLiveRatesToIdr();
  const rate = Number(rates[code] || FALLBACK_TO_IDR[code] || rates.USD || FALLBACK_TO_IDR.USD);
  return {
    amountIdr: Math.max(1, Math.round(safeAmount * rate)),
    currency: code,
    rateUsed: Math.round(rate * 100) / 100,
    fxSource: fxCache.source || 'realtime',
  };
}

function getWibMonthKey(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const ts = Number.isFinite(d.getTime()) ? d.getTime() : Date.now();
  // Shift by UTC+7 (WIB)
  const wib = new Date(ts + 7 * 60 * 60 * 1000);
  const yyyy = wib.getUTCFullYear();
  const mm = String(wib.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function formatWibMonthLabel(monthKey) {
  const [y, m] = String(monthKey || '').split('-');
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  const idx = Math.max(0, Math.min(11, (Number(m) || 1) - 1));
  return `${months[idx]} ${y || new Date().getUTCFullYear()}`;
}

async function ensureSchema(db) {
  if (!db) throw new Error('D1 binding "DB" belum terpasang di Cloudflare Worker.');
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await db
        .prepare(
          `CREATE TABLE IF NOT EXISTS donations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tx_id TEXT NOT NULL UNIQUE,
            platform TEXT NOT NULL,
            donor_name TEXT NOT NULL,
            donor_key TEXT NOT NULL,
            amount_idr INTEGER NOT NULL,
            original_amount REAL NOT NULL,
            original_currency TEXT NOT NULL DEFAULT 'IDR',
            message TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            month_wib TEXT NOT NULL,
            is_test INTEGER NOT NULL DEFAULT 0,
            is_hidden INTEGER NOT NULL DEFAULT 0
          )`
        )
        .run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_donations_donor_key ON donations (donor_key)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_donations_month_wib ON donations (month_wib)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations (created_at DESC)').run();
    })().catch((err) => {
      schemaReadyPromise = null;
      throw err;
    });
  }
  await schemaReadyPromise;
}

async function verifySaweriaSignature(rawBodyText, payload, sigHeader, streamKey) {
  const secret = String(streamKey || '').trim();
  if (!secret || !sigHeader) return false;
  const sig = String(sigHeader).trim().toLowerCase();
  if (!sig) return false;

  const version = String(payload?.version ?? '');
  const id = String(payload?.id ?? '');
  const amountRaw = String(payload?.amount_raw ?? '');
  const cut = String(payload?.cut ?? '');
  const donatorName = String(payload?.donator_name ?? '');
  const donatorEmail = String(payload?.donator_email ?? '');

  // Support Saweria's documented canonical HMAC-SHA256 payload concatenation variants
  const candidates = [
    `${version}${id}${amountRaw}${donatorName}${donatorEmail}`,
    `${version}${id}${amountRaw}${cut}${donatorName}${donatorEmail}`,
    `${version}${id}${amountRaw}${donatorName}`,
    rawBodyText,
  ];

  for (const candidate of candidates) {
    const digest = await hmacSha256Hex(secret, candidate);
    if (timingSafeEqualStr(sig, digest.toLowerCase())) {
      return true;
    }
  }
  return false;
}

async function handleSaweriaWebhook(request, env) {
  if (!env.SAWERIA_STREAM_KEY) {
    return jsonResponse({ ok: false, error: 'SAWERIA_STREAM_KEY secret belum dikonfigurasi.' }, 503, request);
  }
  const rawBody = await request.text();
  let payload;
  try {
    payload = JSON.parse(rawBody || '{}');
  } catch {
    return jsonResponse({ ok: false, error: 'Payload JSON Saweria tidak valid.' }, 400, request);
  }

  const sigHeader = request.headers.get('Saweria-Callback-Signature') || request.headers.get('saweria-callback-signature') || '';
  const validSig = await verifySaweriaSignature(rawBody, payload, sigHeader, env.SAWERIA_STREAM_KEY);
  if (!validSig) {
    return jsonResponse({ ok: false, error: 'Tanda tangan Saweria-Callback-Signature tidak valid.' }, 401, request);
  }

  const rawAmountField = payload.amount_raw ?? payload.amount ?? 0;
  const amountNum = parseNumericAmount(rawAmountField);
  if (amountNum <= 0) {
    return jsonResponse({ ok: false, error: 'Nominal donasi harus lebih dari 0.' }, 400, request);
  }

  const extId = String(payload.id || '').trim();
  const isTest = extId === '00000000-0000-0000-0000-000000000000' || Boolean(payload.is_test);
  const createdAt = !isTest && payload.created_at && !Number.isNaN(Date.parse(payload.created_at))
    ? new Date(payload.created_at).toISOString()
    : new Date().toISOString();
  const txId = isTest
    ? `saweria:test:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    : `saweria:${extId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

  const donorName = sanitizeDonorName(payload.donator_name || payload.name || 'Supporter Saweria');
  const donorKey = normalizeDonorKey(donorName);
  const message = sanitizeDonorMessage(payload.message || '');
  const conv = await convertCurrencyToIdr(amountNum, payload.currency || 'IDR', rawAmountField);
  const monthWib = getWibMonthKey(createdAt);

  await ensureSchema(env.DB);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO donations
      (tx_id, platform, donor_name, donor_key, amount_idr, original_amount, original_currency, message, created_at, month_wib, is_test, is_hidden)
     VALUES (?, 'saweria', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  )
    .bind(txId, donorName, donorKey, conv.amountIdr, amountNum, conv.currency, message, createdAt, monthWib, isTest ? 1 : 0)
    .run();

  return jsonResponse({
    ok: true,
    platform: 'saweria',
    txId,
    donorName,
    amountIdr: conv.amountIdr,
    originalAmount: amountNum,
    originalCurrency: conv.currency,
    rateUsed: conv.rateUsed,
    fxSource: conv.fxSource,
    monthWib,
    isTest,
  }, 200, request);
}

async function verifySociaBuzzAuth(request, rawBody, payload, expectedSecret) {
  const secret = String(expectedSecret || '').trim();
  if (!secret) return false;

  const url = new URL(request.url);
  const candidates = [];

  // 1. Named token headers used across SociaBuzz Tribe / Shop / Xendit gateways (including official sb-webhook-token)
  const namedHeaders = [
    'sb-webhook-token',
    'x-sb-webhook-token',
    'x-callback-token',
    'x-sociabuzz-webhook-token',
    'x-sociabuzz-token',
    'x-webhook-token',
    'x-webhook-secret',
    'webhook-token',
    'token',
    'authorization',
  ];
  for (const name of namedHeaders) {
    const val = (request.headers.get(name) || '').trim();
    if (!val) continue;
    candidates.push(val);
    if (name === 'authorization' && /^bearer\s+/i.test(val)) {
      candidates.push(val.replace(/^bearer\s+/i, '').trim());
    }
  }

  // 2. Any custom header carrying a token/secret or starting with sb-/x-
  for (const [k, v] of request.headers.entries()) {
    const lower = k.toLowerCase();
    if ((lower.startsWith('sb-') || lower.startsWith('x-') || lower.includes('token') || lower.includes('secret')) && v) {
      candidates.push(String(v).trim());
    }
  }

  // 3. Query params or JSON body token fields (if provided by SociaBuzz)
  for (const qp of ['token', 'webhook_token', 'sb_webhook_token']) {
    const val = (url.searchParams.get(qp) || '').trim();
    if (val) candidates.push(val);
  }
  for (const field of [
    payload?.sb_webhook_token,
    payload?.webhook_token,
    payload?.token,
    payload?.data?.sb_webhook_token,
    payload?.data?.webhook_token,
    payload?.data?.token,
  ]) {
    if (typeof field === 'string' && field.trim()) {
      candidates.push(field.trim());
    }
  }

  // Constant-time exact token comparison
  for (const candidate of candidates) {
    if (timingSafeEqualStr(candidate, secret)) {
      return true;
    }
  }

  // 4. Optional HMAC-SHA256 signature verification if SociaBuzz sends a signature header
  const sigHeaders = ['sb-webhook-token', 'x-sociabuzz-signature', 'x-webhook-signature', 'x-hub-signature-256'];
  const expectedDigest = (await hmacSha256Hex(secret, rawBody)).toLowerCase();
  for (const name of sigHeaders) {
    const rawSig = (request.headers.get(name) || '').trim().toLowerCase().replace(/^sha256=/, '');
    if (rawSig && timingSafeEqualStr(rawSig, expectedDigest)) {
      return true;
    }
  }

  return false;
}

async function handleSociaBuzzWebhook(request, env) {
  if (!env.SOCIABUZZ_WEBHOOK_TOKEN) {
    return jsonResponse({ ok: false, error: 'SOCIABUZZ_WEBHOOK_TOKEN secret belum dikonfigurasi.' }, 503, request);
  }

  const rawBody = await request.text();
  let payload = {};
  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Fallback for application/x-www-form-urlencoded payloads
      const params = new URLSearchParams(rawBody);
      if ([...params.keys()].length > 0) {
        payload = Object.fromEntries(params.entries());
      } else {
        return jsonResponse({ ok: false, error: 'Payload SociaBuzz tidak valid.' }, 400, request);
      }
    }
  }

  const authed = await verifySociaBuzzAuth(request, rawBody, payload, env.SOCIABUZZ_WEBHOOK_TOKEN);
  if (!authed) {
    const receivedCustomHeaders = [];
    for (const [k] of request.headers.entries()) {
      const lower = k.toLowerCase();
      if (lower.startsWith('x-') || lower.includes('token') || lower.includes('sig') || lower === 'authorization') {
        receivedCustomHeaders.push(lower);
      }
    }
    return jsonResponse(
      {
        ok: false,
        error: 'Token Webhook SociaBuzz tidak cocok dengan secret SOCIABUZZ_WEBHOOK_TOKEN di Cloudflare.',
        receivedHeaders: receivedCustomHeaders,
      },
      401,
      request
    );
  }

  const body = payload?.data && typeof payload.data === 'object' ? { ...payload, ...payload.data } : payload;

  const rawAmountField =
    body.amount_raw ?? body.amount ?? body.price ?? body.gross_amount ?? body.nominal ?? body.amount_settled ?? 0;
  const amountNum = parseNumericAmount(rawAmountField);
  if (amountNum <= 0) {
    return jsonResponse({ ok: false, error: 'Nominal dukungan harus lebih dari 0.' }, 400, request);
  }

  const rawId = String(body.id || body.inv_id || body.order_id || body.transaction_id || '').trim();
  const message = sanitizeDonorMessage(body.message || body.note || body.comment || '');
  const isTest =
    Boolean(body.is_test) ||
    rawId === '6116050460' ||
    /^test/i.test(rawId) ||
    /^test/i.test(String(body.supporter || '')) ||
    /ini hanya test notifikasi/i.test(message);
  const tsRaw = body.created_at || body.timestamp;
  let createdAt = new Date().toISOString();
  if (!isTest) {
    if (typeof tsRaw === 'number' && Number.isFinite(tsRaw)) {
      const ms = tsRaw < 1e12 ? tsRaw * 1000 : tsRaw;
      createdAt = new Date(ms).toISOString();
    } else if (typeof tsRaw === 'string' && !Number.isNaN(Date.parse(tsRaw))) {
      createdAt = new Date(tsRaw).toISOString();
    }
  }

  const txId = isTest
    ? `sociabuzz:test:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    : rawId
    ? `sociabuzz:${rawId}`
    : `sociabuzz:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const donorName = sanitizeDonorName(
    body.supporter || body.supporter_name || body.donator_name || body.donatorName || body.name || 'Supporter SociaBuzz'
  );
  const donorKey = normalizeDonorKey(donorName);
  const rawCurrencyField = body.currency || body.currency_code || 'IDR';
  const conv = await convertCurrencyToIdr(amountNum, rawCurrencyField, rawAmountField);
  const monthWib = getWibMonthKey(createdAt);

  await ensureSchema(env.DB);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO donations
      (tx_id, platform, donor_name, donor_key, amount_idr, original_amount, original_currency, message, created_at, month_wib, is_test, is_hidden)
     VALUES (?, 'sociabuzz', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  )
    .bind(txId, donorName, donorKey, conv.amountIdr, amountNum, conv.currency, message, createdAt, monthWib, isTest ? 1 : 0)
    .run();

  return jsonResponse({
    ok: true,
    platform: 'sociabuzz',
    txId,
    donorName,
    amountIdr: conv.amountIdr,
    originalAmount: amountNum,
    originalCurrency: conv.currency,
    rateUsed: conv.rateUsed,
    fxSource: conv.fxSource,
    monthWib,
    isTest,
  }, 200, request);
}

async function queryAggregatedLeaderboard(db, { monthWib = null, limit = 50 } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const whereClause = monthWib ? 'WHERE is_hidden = 0 AND month_wib = ?' : 'WHERE is_hidden = 0';
  const sql = `
    SELECT
      donor_key,
      (SELECT d2.donor_name FROM donations d2
         WHERE d2.donor_key = d.donor_key AND d2.is_hidden = 0 ${monthWib ? 'AND d2.month_wib = ?' : ''}
         ORDER BY d2.created_at DESC LIMIT 1) AS donor_name,
      SUM(amount_idr) AS total_idr,
      COUNT(*) AS donation_count,
      GROUP_CONCAT(DISTINCT platform) AS platforms_csv,
      (SELECT d3.message FROM donations d3
         WHERE d3.donor_key = d.donor_key AND d3.is_hidden = 0 AND d3.message != '' ${monthWib ? 'AND d3.month_wib = ?' : ''}
         ORDER BY d3.created_at DESC LIMIT 1) AS latest_message,
      MAX(created_at) AS latest_at
    FROM donations d
    ${whereClause}
    GROUP BY donor_key
    ORDER BY total_idr DESC, donation_count DESC, latest_at ASC
    LIMIT ?
  `;
  const stmt = db.prepare(sql);
  const bound = monthWib ? stmt.bind(monthWib, monthWib, monthWib, safeLimit) : stmt.bind(safeLimit);
  const res = await bound.all();
  return (res?.results || []).map((row, index) => ({
    rank: index + 1,
    donorKey: row.donor_key,
    donorName: row.donor_name || 'Anonim',
    totalIdr: Number(row.total_idr) || 0,
    donationCount: Number(row.donation_count) || 0,
    platforms: String(row.platforms_csv || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    latestMessage: row.latest_message || '',
    latestAt: row.latest_at || '',
  }));
}

async function handleGetLeaderboard(request, env) {
  await ensureSchema(env.DB);
  const url = new URL(request.url);
  const limit = Math.max(5, Math.min(100, Number(url.searchParams.get('limit')) || 50));
  const recentLimit = Math.max(5, Math.min(50, Number(url.searchParams.get('recentLimit')) || 30));
  const currentMonth = getWibMonthKey(new Date());

  const [allTime, monthly, recentRes, summaryAll, summaryMonth] = await Promise.all([
    queryAggregatedLeaderboard(env.DB, { monthWib: null, limit }),
    queryAggregatedLeaderboard(env.DB, { monthWib: currentMonth, limit }),
    env.DB.prepare(
      `SELECT id, platform, donor_name, amount_idr, original_amount, original_currency, message, created_at, is_test
       FROM donations
       WHERE is_hidden = 0
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
      .bind(recentLimit)
      .all(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount_idr), 0) AS total_idr,
              COUNT(*) AS total_count,
              COUNT(DISTINCT donor_key) AS unique_donors
       FROM donations
       WHERE is_hidden = 0`
    ).first(),
    env.DB.prepare(
      `SELECT COALESCE(SUM(amount_idr), 0) AS total_idr,
              COUNT(*) AS total_count,
              COUNT(DISTINCT donor_key) AS unique_donors
       FROM donations
       WHERE is_hidden = 0 AND month_wib = ?`
    )
      .bind(currentMonth)
      .first(),
  ]);

  const recent = (recentRes?.results || []).map((r) => ({
    id: r.id,
    platform: r.platform,
    donorName: r.donor_name,
    amountIdr: Number(r.amount_idr) || 0,
    originalAmount: Number(r.original_amount) || 0,
    originalCurrency: r.original_currency || 'IDR',
    message: r.message || '',
    createdAt: r.created_at || '',
    isTest: Boolean(r.is_test),
  }));

  return jsonResponse(
    {
      ok: true,
      summary: {
        totalIdrAllTime: Number(summaryAll?.total_idr) || 0,
        totalCountAllTime: Number(summaryAll?.total_count) || 0,
        uniqueDonorsAllTime: Number(summaryAll?.unique_donors) || 0,
        totalIdrMonth: Number(summaryMonth?.total_idr) || 0,
        totalCountMonth: Number(summaryMonth?.total_count) || 0,
        uniqueDonorsMonth: Number(summaryMonth?.unique_donors) || 0,
        monthKey: currentMonth,
        monthLabel: formatWibMonthLabel(currentMonth),
        updatedAt: new Date().toISOString(),
      },
      allTime,
      monthly,
      recent,
    },
    200,
    request
  );
}

function checkAdminAuth(request, env) {
  const adminKey = String(env.ADMIN_KEY || '').trim();
  if (!adminKey) return false;
  const auth = request.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerKey = (request.headers.get('X-Admin-Key') || '').trim();
  return timingSafeEqualStr(bearer || headerKey, adminKey);
}

async function handleAdminAction(request, env, pathname) {
  if (!checkAdminAuth(request, env)) {
    return jsonResponse({ ok: false, error: 'ADMIN_KEY tidak cocok atau belum dikonfigurasi.' }, 403, request, { allowPublicFallback: false });
  }
  await ensureSchema(env.DB);
  if (request.method === 'GET' && pathname === '/admin/verify') {
    return jsonResponse({ ok: true, admin: true }, 200, request, { allowPublicFallback: false });
  }
  if (request.method === 'POST' && pathname === '/admin/clear-tests') {
    const res = await env.DB.prepare(
      `DELETE FROM donations
       WHERE is_test = 1
          OR tx_id LIKE '%:test:%'
          OR tx_id = 'sociabuzz:6116050460'
          OR message LIKE '%THIS IS A FAKE MESSAGE%'
          OR message LIKE '%Ini hanya test notifikasi%'
          OR (platform = 'saweria' AND donor_key = 'someguy')
          OR (platform = 'sociabuzz' AND donor_key = 'jessica' AND amount_idr = 10000)`
    ).run();
    return jsonResponse({ ok: true, deleted: res?.meta?.changes ?? 0 }, 200, request, { allowPublicFallback: false });
  }
  const delMatch = pathname.match(/^\/admin\/donations\/(\d+)$/);
  if (request.method === 'DELETE' && delMatch) {
    const id = Number(delMatch[1]);
    const res = await env.DB.prepare('UPDATE donations SET is_hidden = 1 WHERE id = ?').bind(id).run();
    return jsonResponse({ ok: true, hidden: res?.meta?.changes ?? 0 }, 200, request, { allowPublicFallback: false });
  }
  const donorMatch = pathname.match(/^\/admin\/donors\/([^/]+)$/);
  if (request.method === 'DELETE' && donorMatch) {
    const donorKey = decodeURIComponent(donorMatch[1] || '').trim().toLowerCase();
    if (!donorKey) {
      return jsonResponse({ ok: false, error: 'Donor key tidak valid.' }, 400, request, { allowPublicFallback: false });
    }
    const res = await env.DB.prepare('UPDATE donations SET is_hidden = 1 WHERE donor_key = ?').bind(donorKey).run();
    return jsonResponse({ ok: true, hidden: res?.meta?.changes ?? 0 }, 200, request, { allowPublicFallback: false });
  }
  return jsonResponse({ ok: false, error: 'Admin route not found' }, 404, request, { allowPublicFallback: false });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    try {
      if (request.method === 'GET' && (pathname === '/' || pathname === '/health')) {
        await ensureSchema(env.DB);
        const currentMonthWib = getWibMonthKey(new Date());
        return jsonResponse(
          {
            ok: true,
            service: 'manifestudio-donate',
            dbReady: true,
            saweriaConfigured: Boolean(env.SAWERIA_STREAM_KEY),
            sociabuzzConfigured: Boolean(env.SOCIABUZZ_WEBHOOK_TOKEN),
            currentMonthWib,
            currentMonthLabel: formatWibMonthLabel(currentMonthWib),
            fxSource: fxCache.source,
            timestamp: new Date().toISOString(),
          },
          200,
          request
        );
      }

      if (request.method === 'GET' && pathname === '/fx') {
        const forceRefresh = url.searchParams.get('refresh') === '1';
        const rates = await getLiveRatesToIdr({ forceRefresh });
        const majorCurrencies = ['USD', 'MYR', 'SGD', 'EUR', 'GBP', 'AUD', 'JPY', 'SAR', 'AED', 'THB', 'PHP', 'HKD', 'TWD', 'KRW', 'CAD', 'BND', 'CNY'];
        const majorRatesToIdr = {};
        for (const code of majorCurrencies) {
          if (rates[code]) {
            majorRatesToIdr[code] = Math.round(Number(rates[code]) * 100) / 100;
          }
        }
        return jsonResponse(
          {
            ok: true,
            base: 'IDR',
            source: fxCache.source,
            updatedAt: fxCache.updatedAt || new Date().toISOString(),
            ttlSeconds: FX_TTL_MS / 1000,
            ratesToIdr: majorRatesToIdr,
          },
          200,
          request
        );
      }

      if (request.method === 'GET' && pathname === '/leaderboard') {
        return await handleGetLeaderboard(request, env);
      }

      if (request.method === 'POST' && pathname === '/webhook/saweria') {
        return await handleSaweriaWebhook(request, env);
      }

      if (request.method === 'POST' && pathname === '/webhook/sociabuzz') {
        return await handleSociaBuzzWebhook(request, env);
      }

      if (pathname.startsWith('/admin/')) {
        return await handleAdminAction(request, env, pathname);
      }

      return jsonResponse({ ok: false, error: 'Endpoint tidak ditemukan.' }, 404, request);
    } catch (err) {
      return jsonResponse(
        { ok: false, error: err instanceof Error ? err.message : 'Internal Worker Error' },
        500,
        request
      );
    }
  },
};
