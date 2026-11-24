/**
 * Manifestudio Multi-Layer Server-Side Store Access Vault Core (v83)
 *
 * Pure Web Crypto + Fetch + KV implementation that runs identically on:
 *  - Cloudflare Pages Edge Functions (`functions/api/store-access/*.js`)
 *  - Node.js 20+ (local dev preview & deterministic `node:test` verification)
 *
 * Security Architecture (Defense-in-Depth):
 *  1. Zero Secrets in Client/GitHub: Access key is NEVER stored in HTML, JS, JSON, or Git.
 *  2. PBKDF2-SHA256 (100,000 iterations + 128-bit random salt) + constant-time verify.
 *  3. HMAC-SHA256 Signed `HttpOnly; Secure; SameSite=Lax` Pass Cookie bound to host & keyVersion.
 *  4. Server-Side Redirect Gateway (`/api/store-access/go`): Store target URL is never sent to
 *     unverified Manifestudio clients and is only issued as an HTTP 302 after valid pass check.
 *  5. Distributed KV Rate Limiting & Lockout (5 failed attempts -> 15-minute cooldown).
 *  6. Server-Verified Admin Auth: Verifies GitHub repo push permission live against GitHub API
 *     (or optional Cloudflare Secret `ADMIN_MASTER_SECRET` in constant time).
 */

export const VAULT_CONSTANTS = Object.freeze({
  kvConfigKey: 'vault:config:v1',
  kvSigningSecretKey: 'vault:signing_secret:v1',
  rateLimitPrefixVerify: 'rl:verify:',
  rateLimitPrefixAdmin: 'rl:admin:',
  pbkdf2Iterations: 100000,
  minKeyLength: 6,
  maxKeyLength: 64,
  passTtlSeconds: 1800, // 30 minutes
  verifyMaxFails: 5,
  verifyWindowSeconds: 900, // 15 minutes
  verifyLockoutSeconds: 900, // 15 minutes
  adminMaxFails: 5,
  adminLockoutSeconds: 900,
  csrfHeaderName: 'x-requested-with',
  csrfHeaderValue: 'Manifestudio-Vault',
  defaultGithubRepo: 'tmctomystudio26/InfoKatalogtMCTomyStudio',
  defaultStoreOrigin: 'https://manifestore.my.id',
  httpsPassCookieName: '__Host-ms_store_pass',
  httpPassCookieName: 'ms_store_pass',
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Per-isolate fallback rate-limit & secret map (only used if KV is temporarily unavailable)
const isolateMemoryStore = new Map();
let volatileFallbackSecret = null;

/* ============================================================================
 * 1. Binary, Base64Url & Constant-Time Helpers
 * ============================================================================ */
export function bytesToBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.length; i += 1) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const clean = String(b64 || '').trim();
  if (!clean) return new Uint8Array(0);
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function base64UrlToBytes(b64u) {
  const clean = String(b64u || '')
    .trim()
    .replaceAll('-', '+')
    .replaceAll('_', '/');
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) {
    throw new Error('Invalid base64url');
  }
  const padLen = (4 - (clean.length % 4)) % 4;
  return base64ToBytes(clean + '='.repeat(padLen));
}

export function bytesToHex(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let hex = '';
  for (let i = 0; i < arr.length; i += 1) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Constant-time comparison for byte arrays to avoid timing side-channels.
 */
export function timingSafeEqualBytes(a, b) {
  const ua = a instanceof Uint8Array ? a : encoder.encode(String(a || ''));
  const ub = b instanceof Uint8Array ? b : encoder.encode(String(b || ''));
  const maxLen = Math.max(ua.length, ub.length, 1);
  let diff = ua.length ^ ub.length;
  for (let i = 0; i < maxLen; i += 1) {
    const ba = i < ua.length ? ua[i] : 0;
    const bb = i < ub.length ? ub[i] : 0;
    diff |= ba ^ bb;
  }
  return diff === 0;
}

export function randomBytes(length = 16) {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

/* ============================================================================
 * 2. Input Validation & Normalization
 * ============================================================================ */
export function normalizeAccessKeyInput(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

export function validateNewAccessKey(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'Kunci akses harus berupa teks.' };
  }
  const trimmed = raw.trim();
  if (trimmed.length < VAULT_CONSTANTS.minKeyLength) {
    return {
      ok: false,
      reason: `Kunci akses minimal ${VAULT_CONSTANTS.minKeyLength} karakter agar aman dari tebakan.`,
    };
  }
  if (trimmed.length > VAULT_CONSTANTS.maxKeyLength) {
    return {
      ok: false,
      reason: `Kunci akses maksimal ${VAULT_CONSTANTS.maxKeyLength} karakter.`,
    };
  }
  if (/[\r\n\0]/.test(trimmed)) {
    return { ok: false, reason: 'Kunci akses tidak boleh mengandung karakter kontrol.' };
  }
  return { ok: true, normalized: trimmed.toLowerCase(), rawTrimmed: trimmed };
}

/**
 * Strict validator for Store target redirect URL (blocks javascript:, data:, credentials, etc.).
 * Allows https:// URLs in production and http://localhost or http://127.0.0.1 in local dev.
 */
export function validateStoreTargetUrl(rawUrl, { allowLocalHttp = false } = {}) {
  const clean = String(rawUrl || '').trim();
  if (!clean) {
    return { ok: false, reason: 'URL tujuan Store tidak boleh kosong.' };
  }
  let parsed;
  try {
    parsed = new URL(clean);
  } catch {
    return { ok: false, reason: 'Format URL tujuan Store tidak valid.' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URL tujuan Store tidak boleh mengandung kredensial.' };
  }
  const host = parsed.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  if (parsed.protocol === 'https:') {
    if (isLocal && !allowLocalHttp) {
      return { ok: false, reason: 'URL tujuan Store produksi tidak boleh mengarah ke localhost.' };
    }
    const normalized =
      parsed.pathname === '/' && !parsed.search && !parsed.hash
        ? `${parsed.origin}/`
        : parsed.toString();
    return { ok: true, url: normalized };
  }
  if (allowLocalHttp && parsed.protocol === 'http:' && isLocal) {
    return { ok: true, url: parsed.toString() };
  }
  return { ok: false, reason: 'URL tujuan Store wajib menggunakan protokol HTTPS.' };
}

/* ============================================================================
 * 3. PBKDF2-SHA256 Hashing & HMAC-SHA256 Pass Tokens
 * ============================================================================ */
export async function hashAccessKey(
  plainKey,
  { saltBytes = null, iterations = VAULT_CONSTANTS.pbkdf2Iterations } = {}
) {
  const normalized = normalizeAccessKeyInput(plainKey);
  if (!normalized) {
    throw new Error('Cannot hash empty access key');
  }
  const salt = saltBytes instanceof Uint8Array ? saltBytes : randomBytes(16);
  const safeIterations = Math.min(100000, Math.max(10000, Number(iterations) || 100000));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(normalized),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: safeIterations,
    },
    keyMaterial,
    256
  );
  return {
    keyHash: bytesToBase64(new Uint8Array(derivedBits)),
    salt: bytesToBase64(salt),
    iterations: safeIterations,
  };
}

export async function verifyAccessKeyHash(enteredKey, storedRecord) {
  const normalized = normalizeAccessKeyInput(enteredKey);
  if (!normalized || !storedRecord?.keyHash || !storedRecord?.salt) {
    return false;
  }
  try {
    const saltBytes = base64ToBytes(storedRecord.salt);
    const expectedHashBytes = base64ToBytes(storedRecord.keyHash);
    if (saltBytes.length < 8 || expectedHashBytes.length !== 32) {
      return false;
    }
    const candidate = await hashAccessKey(normalized, {
      saltBytes,
      iterations: storedRecord.iterations || VAULT_CONSTANTS.pbkdf2Iterations,
    });
    const candidateBytes = base64ToBytes(candidate.keyHash);
    return timingSafeEqualBytes(candidateBytes, expectedHashBytes);
  } catch {
    return false;
  }
}

async function importHmacKey(secretBytes) {
  return crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export async function signPassToken(payload, secretBytes) {
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const payloadB64 = bytesToBase64Url(payloadBytes);
  const signingInput = encoder.encode(`v1.${payloadB64}`);
  const hmacKey = await importHmacKey(secretBytes);
  const sigBuf = await crypto.subtle.sign('HMAC', hmacKey, signingInput);
  const sigB64 = bytesToBase64Url(new Uint8Array(sigBuf));
  return `v1.${payloadB64}.${sigB64}`;
}

export async function verifyPassToken(
  token,
  secretBytes,
  { expectedKeyVersion, expectedHost, nowSec = Math.floor(Date.now() / 1000) } = {}
) {
  if (typeof token !== 'string' || !token.startsWith('v1.')) {
    return { ok: false, reason: 'invalid_format' };
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { ok: false, reason: 'invalid_format' };
  }
  const [, payloadB64, sigB64] = parts;
  try {
    const sigBytes = base64UrlToBytes(sigB64);
    const hmacKey = await importHmacKey(secretBytes);
    const expectedSigBuf = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      encoder.encode(`v1.${payloadB64}`)
    );
    const expectedSigBytes = new Uint8Array(expectedSigBuf);
    if (!timingSafeEqualBytes(sigBytes, expectedSigBytes)) {
      return { ok: false, reason: 'bad_signature' };
    }

    const payloadJson = decoder.decode(base64UrlToBytes(payloadB64));
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== 'object') {
      return { ok: false, reason: 'bad_payload' };
    }
    if (typeof payload.exp !== 'number' || nowSec >= payload.exp) {
      return { ok: false, reason: 'expired' };
    }
    if (typeof payload.iat !== 'number' || payload.iat > nowSec + 60) {
      return { ok: false, reason: 'invalid_iat' };
    }
    if (
      expectedKeyVersion !== undefined &&
      Number(payload.kv) !== Number(expectedKeyVersion)
    ) {
      return { ok: false, reason: 'revoked_version' };
    }
    if (
      expectedHost &&
      String(payload.host || '').toLowerCase() !== String(expectedHost).toLowerCase()
    ) {
      return { ok: false, reason: 'host_mismatch' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'decode_error' };
  }
}

export async function hashClientFingerprint(clientIp, secretBytes) {
  const hmacKey = await importHmacKey(secretBytes);
  const digest = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    encoder.encode(`ip:${String(clientIp || 'unknown')}`)
  );
  return bytesToHex(new Uint8Array(digest)).slice(0, 32);
}

/* ============================================================================
 * 4. HTTP Headers, Cookie & Request Guards
 * ============================================================================ */
export function buildSecurityHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    ...extra,
  };
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildSecurityHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    }),
  });
}

export function isHttpsRequest(request) {
  try {
    const url = new URL(request.url);
    if (url.protocol === 'https:') return true;
  } catch {
    // Ignore
  }
  const xfProto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  return xfProto === 'https';
}

export function getPassCookieName(request) {
  return isHttpsRequest(request)
    ? VAULT_CONSTANTS.httpsPassCookieName
    : VAULT_CONSTANTS.httpPassCookieName;
}

export function parseCookieHeader(cookieHeader = '') {
  const out = {};
  const str = String(cookieHeader || '');
  if (!str) return out;
  for (const part of str.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (name) out[name] = val;
  }
  return out;
}

export function buildSetPassCookieHeader(request, token, maxAge = VAULT_CONSTANTS.passTtlSeconds) {
  const secure = isHttpsRequest(request);
  const name = getPassCookieName(request);
  const parts = [
    `${name}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAge))}`,
  ];
  if (secure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function extractClientIp(request) {
  const cfIp = (request.headers.get('cf-connecting-ip') || '').trim();
  if (cfIp) return cfIp;
  const xff = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  if (xff) return xff;
  return '127.0.0.1';
}

export function validateSameOriginMutation(request) {
  const requestedWith = (request.headers.get(VAULT_CONSTANTS.csrfHeaderName) || '').trim();
  if (requestedWith !== VAULT_CONSTANTS.csrfHeaderValue) {
    return { ok: false, reason: 'missing_csrf_header' };
  }
  const origin = (request.headers.get('origin') || '').trim();
  if (origin) {
    try {
      const reqOrigin = new URL(request.url).origin;
      const originParsed = new URL(origin).origin;
      const xfHost = (request.headers.get('x-forwarded-host') || '').split(',')[0].trim();
      const xfProto = (request.headers.get('x-forwarded-proto') || '').split(',')[0].trim();
      const forwardedOrigin = xfHost && xfProto ? `${xfProto}://${xfHost}` : '';
      if (originParsed !== reqOrigin && (!forwardedOrigin || originParsed !== forwardedOrigin)) {
        return { ok: false, reason: 'origin_mismatch' };
      }
    } catch {
      return { ok: false, reason: 'invalid_origin' };
    }
  }
  return { ok: true };
}

/* ============================================================================
 * 5. KV & Environment Secret Storage Layer
 * ============================================================================ */
function getKvNamespace(env) {
  const kv = env?.STORE_ACCESS_KV;
  if (kv && typeof kv.get === 'function' && typeof kv.put === 'function') {
    return kv;
  }
  return null;
}

export async function getEffectiveSigningSecret(env) {
  const envSecret = String(env?.VAULT_SIGNING_SECRET || '').trim();
  if (envSecret.length >= 16) {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(envSecret));
    return new Uint8Array(digest);
  }
  const kv = getKvNamespace(env);
  if (kv) {
    const existingB64 = await kv.get(VAULT_CONSTANTS.kvSigningSecretKey);
    if (existingB64) {
      const bytes = base64ToBytes(existingB64);
      if (bytes.length >= 32) return bytes;
    }
    const fresh = randomBytes(32);
    await kv.put(VAULT_CONSTANTS.kvSigningSecretKey, bytesToBase64(fresh));
    return fresh;
  }
  if (!volatileFallbackSecret) {
    volatileFallbackSecret = randomBytes(32);
  }
  return volatileFallbackSecret;
}

export async function readVaultState(env) {
  const kv = getKvNamespace(env);
  const envStoreOrigin = String(env?.STORE_ORIGIN || '').trim() || VAULT_CONSTANTS.defaultStoreOrigin;
  const envPlainKey = String(env?.STORE_ACCESS_KEY || '').trim();

  if (kv) {
    const raw = await kv.get(VAULT_CONSTANTS.kvConfigKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const hasKvKey = Boolean(parsed?.keyHash && parsed?.salt);
        if (hasKvKey || parsed?.enabled === false) {
          return {
            kvBound: true,
            source: 'kv',
            configured: true,
            enabled: parsed.enabled !== false,
            keyHash: parsed.keyHash || '',
            salt: parsed.salt || '',
            iterations: Number(parsed.iterations) || VAULT_CONSTANTS.pbkdf2Iterations,
            keyVersion: Math.max(1, Number(parsed.keyVersion) || 1),
            storeOrigin: String(parsed.storeOrigin || envStoreOrigin).trim() || envStoreOrigin,
            promptTitle: String(parsed.promptTitle || '').trim(),
            promptDescription: String(parsed.promptDescription || '').trim(),
            updatedAt: parsed.updatedAt || null,
            updatedBy: parsed.updatedBy || null,
          };
        }
      } catch {
        // Fall through safely
      }
    }
  }

  if (envPlainKey) {
    return {
      kvBound: Boolean(kv),
      source: 'env',
      configured: true,
      enabled: true,
      envPlainKey,
      keyVersion: 1,
      storeOrigin: envStoreOrigin,
      promptTitle: '',
      promptDescription: '',
      updatedAt: null,
      updatedBy: 'cloudflare-env',
    };
  }

  return {
    kvBound: Boolean(kv),
    source: 'none',
    configured: false,
    enabled: true,
    keyVersion: 1,
    storeOrigin: envStoreOrigin,
    promptTitle: '',
    promptDescription: '',
    updatedAt: null,
    updatedBy: null,
  };
}

/* ============================================================================
 * 6. Rate Limiting (KV-backed + Isolate Fallback)
 * ============================================================================ */
async function readRateLimitEntry(env, fullKey, nowSec) {
  const kv = getKvNamespace(env);
  let raw = null;
  if (kv) {
    raw = await kv.get(fullKey);
  } else {
    const mem = isolateMemoryStore.get(fullKey);
    if (mem && mem.expiresAt > nowSec) {
      raw = mem.value;
    } else if (mem) {
      isolateMemoryStore.delete(fullKey);
    }
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeRateLimitEntry(env, fullKey, entry, ttlSeconds, nowSec) {
  const serialized = JSON.stringify(entry);
  const kv = getKvNamespace(env);
  if (kv) {
    await kv.put(fullKey, serialized, { expirationTtl: Math.max(60, Math.ceil(ttlSeconds)) });
  } else {
    isolateMemoryStore.set(fullKey, { value: serialized, expiresAt: nowSec + ttlSeconds });
  }
}

async function clearRateLimitEntry(env, fullKey) {
  const kv = getKvNamespace(env);
  if (kv && typeof kv.delete === 'function') {
    await kv.delete(fullKey);
  } else {
    isolateMemoryStore.delete(fullKey);
  }
}

export async function checkRateLimit(env, fullKey, nowSec = Math.floor(Date.now() / 1000)) {
  const entry = await readRateLimitEntry(env, fullKey, nowSec);
  if (!entry) {
    return { locked: false, fails: 0, retryAfterSec: 0 };
  }
  if (entry.lockedUntil && nowSec < entry.lockedUntil) {
    return {
      locked: true,
      fails: entry.fails || 0,
      retryAfterSec: Math.max(1, Math.ceil(entry.lockedUntil - nowSec)),
    };
  }
  if (entry.windowStart && nowSec - entry.windowStart > VAULT_CONSTANTS.verifyWindowSeconds) {
    return { locked: false, fails: 0, retryAfterSec: 0 };
  }
  return { locked: false, fails: Number(entry.fails) || 0, retryAfterSec: 0 };
}

export async function recordRateLimitFailure(
  env,
  fullKey,
  { maxFails = VAULT_CONSTANTS.verifyMaxFails, lockoutSec = VAULT_CONSTANTS.verifyLockoutSeconds, nowSec = Math.floor(Date.now() / 1000) } = {}
) {
  const prev = await readRateLimitEntry(env, fullKey, nowSec);
  const withinWindow =
    prev && prev.windowStart && nowSec - prev.windowStart <= VAULT_CONSTANTS.verifyWindowSeconds;
  const fails = (withinWindow ? Number(prev.fails) || 0 : 0) + 1;
  const windowStart = withinWindow ? prev.windowStart : nowSec;
  const locked = fails >= maxFails;
  const lockedUntil = locked ? nowSec + lockoutSec : 0;
  const ttl = locked ? lockoutSec + 60 : VAULT_CONSTANTS.verifyWindowSeconds + 60;

  await writeRateLimitEntry(env, fullKey, { fails, windowStart, lockedUntil }, ttl, nowSec);
  return {
    locked,
    fails,
    attemptsRemaining: Math.max(0, maxFails - fails),
    retryAfterSec: locked ? lockoutSec : 0,
  };
}

/* ============================================================================
 * 7. Server-Side Admin Authentication (GitHub Repo Push Permission / Master Secret)
 * ============================================================================ */
export async function authenticateAdminRequest(request, env, { fetchImpl = fetch } = {}) {
  const authHeader = (request.headers.get('authorization') || '').trim();
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : '';
  if (!token || token.length < 8) {
    return { ok: false, status: 401, reason: 'missing_admin_token' };
  }

  // Option 1: Optional Cloudflare Secret ADMIN_MASTER_SECRET (constant-time compare)
  const masterSecret = String(env?.ADMIN_MASTER_SECRET || '').trim();
  if (masterSecret && timingSafeEqualBytes(encoder.encode(token), encoder.encode(masterSecret))) {
    return { ok: true, actor: 'cloudflare-master-secret' };
  }

  // Option 2: Verify live GitHub Personal Access Token push permission on the exact repository
  const repoSlug = String(env?.GITHUB_REPO || VAULT_CONSTANTS.defaultGithubRepo).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repoSlug)) {
    return { ok: false, status: 500, reason: 'invalid_repo_config' };
  }

  try {
    const ghRes = await fetchImpl(`https://api.github.com/repos/${repoSlug}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Manifestudio-Store-Vault/1.0',
      },
    });

    if (ghRes.status === 401 || ghRes.status === 403 || ghRes.status === 404) {
      return { ok: false, status: 403, reason: 'github_token_unauthorized' };
    }
    if (!ghRes.ok) {
      return { ok: false, status: 502, reason: 'github_verification_unavailable' };
    }

    const repoData = await ghRes.json();
    const canPush = Boolean(repoData?.permissions?.push || repoData?.permissions?.admin);
    if (!canPush) {
      return { ok: false, status: 403, reason: 'github_push_permission_required' };
    }
    return {
      ok: true,
      actor: `github:${repoData?.owner?.login || 'admin'}`,
    };
  } catch {
    return { ok: false, status: 502, reason: 'github_verification_error' };
  }
}

/* ============================================================================
 * 8. HTTP Route Handlers (Shared by Cloudflare Pages Functions & Local Dev)
 * ============================================================================ */

/**
 * GET /api/store-access/status
 * Returns ONLY non-sensitive public gate state (never leaks key, hash, or storeOrigin).
 */
export async function handleStatusRequest(request, env, deps = {}) {
  const nowSec = deps.nowSec ?? Math.floor(Date.now() / 1000);
  const vault = await readVaultState(env);
  const secretBytes = await getEffectiveSigningSecret(env);
  const ipHash = await hashClientFingerprint(extractClientIp(request), secretBytes);
  const rl = await checkRateLimit(env, `${VAULT_CONSTANTS.rateLimitPrefixVerify}${ipHash}`, nowSec);

  let hasActivePass = false;
  if (vault.configured && vault.enabled) {
    const cookies = parseCookieHeader(request.headers.get('cookie') || '');
    const token = cookies[getPassCookieName(request)] || '';
    if (token) {
      const reqHost = new URL(request.url).hostname.toLowerCase();
      const check = await verifyPassToken(token, secretBytes, {
        expectedKeyVersion: vault.keyVersion,
        expectedHost: reqHost,
        nowSec,
      });
      hasActivePass = check.ok;
    }
  } else if (vault.configured && !vault.enabled) {
    hasActivePass = true;
  }

  return jsonResponse({
    ok: true,
    configured: vault.configured,
    kvBound: vault.kvBound,
    enabled: vault.enabled,
    hasActivePass,
    lockedOut: rl.locked,
    retryAfterSec: rl.retryAfterSec,
    promptTitle: vault.promptTitle || undefined,
    promptDescription: vault.promptDescription || undefined,
  });
}

/**
 * POST /api/store-access/verify
 * Verifies user-submitted Store Access Key server-side, enforces rate limits,
 * and issues an HttpOnly HMAC-SHA256 pass cookie. Never leaks storeOrigin in JSON!
 */
export async function handleVerifyRequest(request, env, deps = {}) {
  const nowSec = deps.nowSec ?? Math.floor(Date.now() / 1000);
  const csrf = validateSameOriginMutation(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, reason: csrf.reason }, 403);
  }

  const vault = await readVaultState(env);
  if (!vault.configured) {
    return jsonResponse(
      {
        ok: false,
        reason: 'vault_not_configured',
        message: 'Server Vault belum diaktifkan oleh Admin di Cloudflare KV.',
      },
      503
    );
  }

  const secretBytes = await getEffectiveSigningSecret(env);
  const ipHash = await hashClientFingerprint(extractClientIp(request), secretBytes);
  const rlKey = `${VAULT_CONSTANTS.rateLimitPrefixVerify}${ipHash}`;

  const rlBefore = await checkRateLimit(env, rlKey, nowSec);
  if (rlBefore.locked) {
    return jsonResponse(
      {
        ok: false,
        reason: 'rate_limited',
        retryAfterSec: rlBefore.retryAfterSec,
      },
      429,
      { 'Retry-After': String(rlBefore.retryAfterSec) }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid_json' }, 400);
  }

  const rawKey = typeof body?.key === 'string' ? body.key : '';
  const normalizedKey = normalizeAccessKeyInput(rawKey);
  if (!normalizedKey) {
    return jsonResponse({ ok: false, reason: 'empty' }, 400);
  }
  if (normalizedKey.length > VAULT_CONSTANTS.maxKeyLength) {
    return jsonResponse({ ok: false, reason: 'mismatch' }, 401);
  }

  let matched = false;
  if (!vault.enabled) {
    matched = true;
  } else if (vault.source === 'kv') {
    matched = await verifyAccessKeyHash(normalizedKey, vault);
  } else if (vault.source === 'env' && vault.envPlainKey) {
    matched = timingSafeEqualBytes(
      encoder.encode(normalizedKey),
      encoder.encode(normalizeAccessKeyInput(vault.envPlainKey))
    );
  }

  if (!matched) {
    const failState = await recordRateLimitFailure(env, rlKey, {
      maxFails: VAULT_CONSTANTS.verifyMaxFails,
      lockoutSec: VAULT_CONSTANTS.verifyLockoutSeconds,
      nowSec,
    });
    if (failState.locked) {
      return jsonResponse(
        {
          ok: false,
          reason: 'rate_limited',
          retryAfterSec: failState.retryAfterSec,
          attemptsRemaining: 0,
        },
        429,
        { 'Retry-After': String(failState.retryAfterSec) }
      );
    }
    return jsonResponse(
      {
        ok: false,
        reason: 'mismatch',
        attemptsRemaining: failState.attemptsRemaining,
      },
      401
    );
  }

  // Valid key: clear rate-limit failures and issue signed HttpOnly pass cookie
  await clearRateLimitEntry(env, rlKey);
  const reqHost = new URL(request.url).hostname.toLowerCase();
  const token = await signPassToken(
    {
      iat: nowSec,
      exp: nowSec + VAULT_CONSTANTS.passTtlSeconds,
      kv: vault.keyVersion,
      host: reqHost,
      jti: bytesToHex(randomBytes(8)),
    },
    secretBytes
  );

  return jsonResponse(
    {
      ok: true,
      goUrl: '/api/store-access/go',
      expiresInSec: VAULT_CONSTANTS.passTtlSeconds,
    },
    200,
    {
      'Set-Cookie': buildSetPassCookieHeader(request, token, VAULT_CONSTANTS.passTtlSeconds),
    }
  );
}

/**
 * GET /api/store-access/go
 * Server-side protected redirect gateway to Store.
 * Verifies HttpOnly signed pass cookie before issuing HTTP 302 Location to Store.
 */
export async function handleGoRequest(request, env, deps = {}) {
  const nowSec = deps.nowSec ?? Math.floor(Date.now() / 1000);
  const reqUrl = new URL(request.url);
  const allowLocalHttp = Boolean(deps.allowLocalHttp);
  const fallbackHome = `${reqUrl.origin}/`;

  const vault = await readVaultState(env);
  if (!vault.configured) {
    return new Response(null, {
      status: 302,
      headers: buildSecurityHeaders({ Location: fallbackHome }),
    });
  }

  let authorized = !vault.enabled;
  if (!authorized) {
    const secretBytes = await getEffectiveSigningSecret(env);
    const cookies = parseCookieHeader(request.headers.get('cookie') || '');
    const token = cookies[getPassCookieName(request)] || '';
    if (token) {
      const check = await verifyPassToken(token, secretBytes, {
        expectedKeyVersion: vault.keyVersion,
        expectedHost: reqUrl.hostname.toLowerCase(),
        nowSec,
      });
      authorized = check.ok;
    }
  }

  if (!authorized) {
    return new Response(null, {
      status: 302,
      headers: buildSecurityHeaders({
        Location: `${reqUrl.origin}/?gate=required`,
        'Set-Cookie': buildSetPassCookieHeader(request, '', 0),
      }),
    });
  }

  const targetCheck = validateStoreTargetUrl(vault.storeOrigin, { allowLocalHttp });
  if (!targetCheck.ok) {
    return new Response(null, {
      status: 302,
      headers: buildSecurityHeaders({ Location: fallbackHome }),
    });
  }

  return new Response(null, {
    status: 302,
    headers: buildSecurityHeaders({
      Location: targetCheck.url,
    }),
  });
}

/**
 * GET / POST /api/store-access/admin
 * Server-verified Admin management endpoint for Cloudflare KV Vault.
 */
export async function handleAdminRequest(request, env, deps = {}) {
  const nowSec = deps.nowSec ?? Math.floor(Date.now() / 1000);
  const allowLocalHttp = Boolean(deps.allowLocalHttp);

  if (request.method === 'POST') {
    const csrf = validateSameOriginMutation(request);
    if (!csrf.ok) {
      return jsonResponse({ ok: false, reason: csrf.reason }, 403);
    }
  }

  const secretBytes = await getEffectiveSigningSecret(env);
  const ipHash = await hashClientFingerprint(extractClientIp(request), secretBytes);
  const adminRlKey = `${VAULT_CONSTANTS.rateLimitPrefixAdmin}${ipHash}`;

  const rlBefore = await checkRateLimit(env, adminRlKey, nowSec);
  if (rlBefore.locked) {
    return jsonResponse(
      { ok: false, reason: 'rate_limited', retryAfterSec: rlBefore.retryAfterSec },
      429,
      { 'Retry-After': String(rlBefore.retryAfterSec) }
    );
  }

  const auth = await authenticateAdminRequest(request, env, {
    fetchImpl: deps.fetchImpl || fetch,
  });
  if (!auth.ok) {
    if (auth.status === 401 || auth.status === 403) {
      await recordRateLimitFailure(env, adminRlKey, {
        maxFails: VAULT_CONSTANTS.adminMaxFails,
        lockoutSec: VAULT_CONSTANTS.adminLockoutSeconds,
        nowSec,
      });
    }
    return jsonResponse({ ok: false, reason: auth.reason }, auth.status || 403);
  }

  await clearRateLimitEntry(env, adminRlKey);
  const vault = await readVaultState(env);

  if (request.method === 'GET') {
    return jsonResponse({
      ok: true,
      kvBound: vault.kvBound,
      source: vault.source,
      configured: vault.configured,
      enabled: vault.enabled,
      keyVersion: vault.keyVersion,
      hasSavedKey: vault.source === 'kv' ? Boolean(vault.keyHash) : Boolean(vault.envPlainKey),
      storeOrigin: vault.storeOrigin,
      promptTitle: vault.promptTitle || '',
      promptDescription: vault.promptDescription || '',
      updatedAt: vault.updatedAt,
      updatedBy: vault.updatedBy,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  const kv = getKvNamespace(env);
  if (!kv) {
    return jsonResponse(
      {
        ok: false,
        reason: 'kv_not_bound',
        message:
          'Cloudflare KV Namespace "STORE_ACCESS_KV" belum terhubung ke proyek Pages Anda.',
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, reason: 'invalid_json' }, 400);
  }

  const action = String(body?.action || 'update').trim();
  const prevKvRaw = await kv.get(VAULT_CONSTANTS.kvConfigKey);
  let prev = null;
  if (prevKvRaw) {
    try {
      prev = JSON.parse(prevKvRaw);
    } catch {
      prev = null;
    }
  }

  if (action === 'revoke_sessions') {
    if (!prev) {
      return jsonResponse(
        { ok: false, reason: 'vault_not_initialized', message: 'Simpan kunci akses terlebih dahulu.' },
        400
      );
    }
    const nextRecord = {
      ...prev,
      keyVersion: Math.max(1, Number(prev.keyVersion) || 1) + 1,
      updatedAt: new Date(nowSec * 1000).toISOString(),
      updatedBy: auth.actor,
    };
    await kv.put(VAULT_CONSTANTS.kvConfigKey, JSON.stringify(nextRecord));
    return jsonResponse({
      ok: true,
      action: 'revoke_sessions',
      keyVersion: nextRecord.keyVersion,
      updatedAt: nextRecord.updatedAt,
    });
  }

  // Action: 'update'
  const enabled = body?.enabled !== false;
  const newKeyRaw = typeof body?.newKey === 'string' ? body.newKey.trim() : '';
  const hasExistingHash = Boolean(prev?.keyHash && prev?.salt);

  let keyHash = prev?.keyHash || '';
  let salt = prev?.salt || '';
  let iterations = Number(prev?.iterations) || VAULT_CONSTANTS.pbkdf2Iterations;
  let keyVersion = Math.max(1, Number(prev?.keyVersion) || 1);

  if (newKeyRaw) {
    const validKey = validateNewAccessKey(newKeyRaw);
    if (!validKey.ok) {
      return jsonResponse({ ok: false, reason: 'invalid_key', message: validKey.reason }, 400);
    }
    const hashed = await hashAccessKey(validKey.normalized);
    keyHash = hashed.keyHash;
    salt = hashed.salt;
    iterations = hashed.iterations;
    keyVersion = hasExistingHash ? keyVersion + 1 : 1;
  } else if (enabled && !hasExistingHash) {
    return jsonResponse(
      {
        ok: false,
        reason: 'key_required',
        message: 'Masukkan Kunci Akses Store baru (min. 6 karakter) untuk mengaktifkan Server Vault.',
      },
      400
    );
  }

  const candidateOrigin = String(
    body?.storeOrigin || prev?.storeOrigin || vault.storeOrigin || VAULT_CONSTANTS.defaultStoreOrigin
  ).trim();
  const originCheck = validateStoreTargetUrl(candidateOrigin, { allowLocalHttp });
  if (!originCheck.ok) {
    return jsonResponse({ ok: false, reason: 'invalid_store_origin', message: originCheck.reason }, 400);
  }

  // Ensure persistent signing secret exists in KV right when Admin initializes Vault
  await getEffectiveSigningSecret(env);

  const nextRecord = {
    enabled,
    keyHash,
    salt,
    iterations,
    keyVersion,
    storeOrigin: originCheck.url,
    promptTitle: String(body?.promptTitle || prev?.promptTitle || '').trim().slice(0, 120),
    promptDescription: String(body?.promptDescription || prev?.promptDescription || '')
      .trim()
      .slice(0, 260),
    updatedAt: new Date(nowSec * 1000).toISOString(),
    updatedBy: auth.actor,
  };

  await kv.put(VAULT_CONSTANTS.kvConfigKey, JSON.stringify(nextRecord));

  return jsonResponse({
    ok: true,
    action: 'update',
    kvBound: true,
    configured: true,
    enabled: nextRecord.enabled,
    keyVersion: nextRecord.keyVersion,
    hasSavedKey: Boolean(nextRecord.keyHash),
    storeOrigin: nextRecord.storeOrigin,
    updatedAt: nextRecord.updatedAt,
    updatedBy: nextRecord.updatedBy,
  });
}
