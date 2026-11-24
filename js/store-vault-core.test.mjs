import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VAULT_CONSTANTS,
  handleAdminRequest,
  handleGoRequest,
  handleStatusRequest,
  handleVerifyRequest,
  hashAccessKey,
  signPassToken,
  validateStoreTargetUrl,
  verifyAccessKeyHash,
  verifyPassToken,
} from '../functions/_lib/store-vault-core.js';

function createMemoryKv() {
  const store = new Map();
  return {
    _store: store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, String(value));
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

function createMockGitHubFetch({ allowPush = true, validToken = 'ghp_valid_owner_token_123456' } = {}) {
  return async (url, init = {}) => {
    const auth = init.headers?.Authorization || '';
    if (auth !== `Bearer ${validToken}`) {
      return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
    }
    return new Response(
      JSON.stringify({
        full_name: 'tmctomystudio26/InfoKatalogtMCTomyStudio',
        owner: { login: 'tmctomystudio26' },
        permissions: { push: allowPush, admin: allowPush },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };
}

test('PBKDF2-SHA256 hashing & HMAC-SHA256 pass tokens enforce constant-time check, expiry, host binding & keyVersion revocation', async () => {
  const hashed = await hashAccessKey('VIP-TOMY-2026');
  assert.ok(hashed.keyHash && hashed.salt);
  assert.equal(hashed.iterations, 100000);
  assert.notEqual(hashed.keyHash, 'VIP-TOMY-2026');

  assert.equal(await verifyAccessKeyHash('vip-tomy-2026', hashed), true);
  assert.equal(await verifyAccessKeyHash('  VIP-TOMY-2026  ', hashed), true);
  assert.equal(await verifyAccessKeyHash('WRONG-KEY-999', hashed), false);

  const secret = new Uint8Array(32).fill(42);
  const nowSec = 1800000000;
  const token = await signPassToken(
    { iat: nowSec, exp: nowSec + 1800, kv: 2, host: 'manifestudio.my.id', jti: 'abc123' },
    secret
  );

  // Valid token passes
  const ok = await verifyPassToken(token, secret, {
    expectedKeyVersion: 2,
    expectedHost: 'manifestudio.my.id',
    nowSec: nowSec + 60,
  });
  assert.equal(ok.ok, true);

  // Tampered payload rejected
  const tampered = token.slice(0, -3) + 'AAA';
  assert.equal(
    (await verifyPassToken(tampered, secret, { expectedKeyVersion: 2, expectedHost: 'manifestudio.my.id', nowSec })).ok,
    false
  );

  // Expired token rejected
  assert.equal(
    (await verifyPassToken(token, secret, { expectedKeyVersion: 2, expectedHost: 'manifestudio.my.id', nowSec: nowSec + 2000 })).reason,
    'expired'
  );

  // Revoked keyVersion rejected immediately
  assert.equal(
    (await verifyPassToken(token, secret, { expectedKeyVersion: 3, expectedHost: 'manifestudio.my.id', nowSec: nowSec + 10 })).reason,
    'revoked_version'
  );

  // Host mismatch rejected
  assert.equal(
    (await verifyPassToken(token, secret, { expectedKeyVersion: 2, expectedHost: 'evil.example.com', nowSec: nowSec + 10 })).reason,
    'host_mismatch'
  );
});

test('validateStoreTargetUrl strictly blocks javascript:, data:, http:// non-localhost, and credentials', () => {
  assert.equal(validateStoreTargetUrl('https://manifestore.my.id').ok, true);
  assert.equal(validateStoreTargetUrl('javascript:alert(1)').ok, false);
  assert.equal(validateStoreTargetUrl('data:text/html,<h1>x</h1>').ok, false);
  assert.equal(validateStoreTargetUrl('http://manifestore.my.id').ok, false);
  assert.equal(validateStoreTargetUrl('https://user:pass@manifestore.my.id').ok, false);
  assert.equal(validateStoreTargetUrl('http://localhost:3000/site/index.html', { allowLocalHttp: false }).ok, false);
  assert.equal(validateStoreTargetUrl('http://localhost:3000/site/index.html', { allowLocalHttp: true }).ok, true);
});

test('End-to-end 6-layer Store Access Vault: fail-closed -> GitHub PAT admin setup -> zero plaintext in KV -> brute-force lockout -> HttpOnly pass -> 302 redirect -> instant revocation', async () => {
  const kv = createMemoryKv();
  const env = { STORE_ACCESS_KV: kv };
  const ghFetch = createMockGitHubFetch({ allowPush: true });
  const nowSec = 1800001000;

  // 1. Fail-closed before Admin initializes key in KV
  const statusBefore = await handleStatusRequest(
    new Request('https://manifestudio.my.id/api/store-access/status'),
    env,
    { nowSec }
  );
  const statusJsonBefore = await statusBefore.json();
  assert.equal(statusJsonBefore.configured, false);
  assert.equal(statusJsonBefore.kvBound, true);
  assert.equal('storeOrigin' in statusJsonBefore, false);

  const verifyUnconfigured = await handleVerifyRequest(
    new Request('https://manifestudio.my.id/api/store-access/verify', {
      method: 'POST',
      headers: {
        Origin: 'https://manifestudio.my.id',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({ key: 'ANYTHING' }),
    }),
    env,
    { nowSec }
  );
  assert.equal(verifyUnconfigured.status, 503);

  // 2. Unauthorized / forged Admin attempt blocked (403)
  const badAdminRes = await handleAdminRequest(
    new Request('https://manifestudio.my.id/api/store-access/admin', {
      method: 'POST',
      headers: {
        Origin: 'https://manifestudio.my.id',
        Authorization: 'Bearer ghp_forged_attacker_token',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({ action: 'update', enabled: true, newKey: 'HACKED-123' }),
    }),
    env,
    { nowSec, fetchImpl: ghFetch }
  );
  assert.equal(badAdminRes.status, 403);

  // 3. Valid Admin (GitHub repo push PAT) sets Store Access Key in Cloudflare KV
  const okAdminRes = await handleAdminRequest(
    new Request('https://manifestudio.my.id/api/store-access/admin', {
      method: 'POST',
      headers: {
        Origin: 'https://manifestudio.my.id',
        Authorization: 'Bearer ghp_valid_owner_token_123456',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({
        action: 'update',
        enabled: true,
        newKey: 'RAHASIA-TOMY-88',
        storeOrigin: 'https://manifestore.my.id',
      }),
    }),
    env,
    { nowSec, fetchImpl: ghFetch }
  );
  assert.equal(okAdminRes.status, 200);
  const okAdminJson = await okAdminRes.json();
  assert.equal(okAdminJson.configured, true);
  assert.equal(okAdminJson.keyVersion, 1);

  // Verify plaintext key is NEVER saved in KV!
  const storedRaw = await kv.get(VAULT_CONSTANTS.kvConfigKey);
  assert.ok(storedRaw);
  assert.equal(/RAHASIA-TOMY-88/i.test(storedRaw), false);

  // 4. CSRF check blocks cross-origin POST without header or from evil Origin
  const csrfBlocked = await handleVerifyRequest(
    new Request('https://manifestudio.my.id/api/store-access/verify', {
      method: 'POST',
      headers: {
        Origin: 'https://evil-phish.example',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({ key: 'RAHASIA-TOMY-88' }),
    }),
    env,
    { nowSec }
  );
  assert.equal(csrfBlocked.status, 403);

  // 5. Direct /go bypass without valid HttpOnly pass cookie is blocked and never leaks Store URL!
  const bypassGo = await handleGoRequest(
    new Request('https://manifestudio.my.id/api/store-access/go', {
      headers: { Cookie: '__Host-ms_store_pass=v1.forged.signature' },
    }),
    env,
    { nowSec }
  );
  assert.equal(bypassGo.status, 302);
  assert.equal(bypassGo.headers.get('location'), 'https://manifestudio.my.id/?gate=required');

  // 6. Brute-force rate limiting: 5 wrong attempts from attacker IP -> 429 Lockout
  for (let i = 1; i <= 5; i += 1) {
    const failRes = await handleVerifyRequest(
      new Request('https://manifestudio.my.id/api/store-access/verify', {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '203.0.113.99',
          Origin: 'https://manifestudio.my.id',
          'Content-Type': 'application/json',
          [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
        },
        body: JSON.stringify({ key: `GUESS-${i}` }),
      }),
      env,
      { nowSec }
    );
    if (i < 5) {
      assert.equal(failRes.status, 401);
      const j = await failRes.json();
      assert.equal(j.attemptsRemaining, 5 - i);
    } else {
      assert.equal(failRes.status, 429);
      assert.ok(Number(failRes.headers.get('retry-after')) >= 800);
    }
  }

  // Even correct key from locked attacker IP is rejected during 15-min cooldown
  const lockedEvenIfRight = await handleVerifyRequest(
    new Request('https://manifestudio.my.id/api/store-access/verify', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '203.0.113.99',
        Origin: 'https://manifestudio.my.id',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({ key: 'RAHASIA-TOMY-88' }),
    }),
    env,
    { nowSec: nowSec + 10 }
  );
  assert.equal(lockedEvenIfRight.status, 429);

  // 7. Legitimate visitor IP submits valid key -> receives HttpOnly Secure SameSite=Lax cookie
  const validRes = await handleVerifyRequest(
    new Request('https://manifestudio.my.id/api/store-access/verify', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '198.51.100.25',
        Origin: 'https://manifestudio.my.id',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({ key: '  rahasia-tomy-88  ' }),
    }),
    env,
    { nowSec: nowSec + 15 }
  );
  assert.equal(validRes.status, 200);
  const setCookie = validRes.headers.get('set-cookie') || '';
  assert.ok(setCookie.startsWith('__Host-ms_store_pass=v1.'));
  assert.ok(setCookie.includes('HttpOnly'));
  assert.ok(setCookie.includes('Secure'));
  assert.ok(setCookie.includes('SameSite=Lax'));
  const validJson = await validRes.json();
  assert.equal(validJson.goUrl, '/api/store-access/go');
  assert.equal(JSON.stringify(validJson).includes('manifestore.my.id'), false);

  const cookiePair = setCookie.split(';')[0];

  // 8. Visiting /api/store-access/go with valid HttpOnly cookie redirects 302 to Store!
  const goAllowed = await handleGoRequest(
    new Request('https://manifestudio.my.id/api/store-access/go', {
      headers: { Cookie: cookiePair },
    }),
    env,
    { nowSec: nowSec + 20 }
  );
  assert.equal(goAllowed.status, 302);
  assert.equal(goAllowed.headers.get('location'), 'https://manifestore.my.id/');
  assert.ok((goAllowed.headers.get('cache-control') || '').includes('no-store'));

  // 9. Admin revokes all active sessions -> previously valid cookie is INSTANTLY rejected!
  const revokeRes = await handleAdminRequest(
    new Request('https://manifestudio.my.id/api/store-access/admin', {
      method: 'POST',
      headers: {
        Origin: 'https://manifestudio.my.id',
        Authorization: 'Bearer ghp_valid_owner_token_123456',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({ action: 'revoke_sessions' }),
    }),
    env,
    { nowSec: nowSec + 25, fetchImpl: ghFetch }
  );
  assert.equal(revokeRes.status, 200);
  assert.equal((await revokeRes.json()).keyVersion, 2);

  const goAfterRevoke = await handleGoRequest(
    new Request('https://manifestudio.my.id/api/store-access/go', {
      headers: { Cookie: cookiePair },
    }),
    env,
    { nowSec: nowSec + 30 }
  );
  assert.equal(goAfterRevoke.status, 302);
  assert.equal(goAfterRevoke.headers.get('location'), 'https://manifestudio.my.id/?gate=required');
});

test('Contact Access Vault gates WhatsApp, Instagram, and TikTok with separate key, zero status leak, and HttpOnly pass redirect', async () => {
  const kv = createMemoryKv();
  const env = { STORE_ACCESS_KV: kv };
  const ghFetch = createMockGitHubFetch({ allowPush: true });
  const nowSec = 1800005000;

  // Admin configures Store key + separate Contact key + secret WA/IG/TikTok URLs
  const saveRes = await handleAdminRequest(
    new Request('https://manifestudio.my.id/api/store-access/admin', {
      method: 'POST',
      headers: {
        Origin: 'https://manifestudio.my.id',
        Authorization: 'Bearer ghp_valid_owner_token_123456',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({
        action: 'update',
        enabled: true,
        newKey: 'STORE-KEY-777',
        storeOrigin: 'https://manifestore.my.id',
        contactEnabled: true,
        contactSameAsStoreKey: false,
        newContactKey: 'KONTAK-VIP-99',
        whatsappNumber: '6285122936027',
        instagramUrl: 'https://www.instagram.com/tmctomystudio',
        tiktokUrl: 'https://www.tiktok.com/@tmctomystudio',
      }),
    }),
    env,
    { nowSec, fetchImpl: ghFetch }
  );
  assert.equal(saveRes.status, 200);

  // Public status MUST NOT leak raw WA number, IG handle, or TikTok handle
  const statusRes = await handleStatusRequest(
    new Request('https://manifestudio.my.id/api/store-access/status'),
    env,
    { nowSec }
  );
  const statusJson = await statusRes.json();
  assert.equal(statusJson.contactEnabled, true);
  assert.equal(statusJson.contactsConfigured.whatsapp, true);
  assert.equal(statusJson.contactsConfigured.instagram, true);
  assert.equal(statusJson.contactsConfigured.tiktok, true);
  const statusStr = JSON.stringify(statusJson);
  assert.equal(statusStr.includes('6285122936027'), false);
  assert.equal(statusStr.includes('tmctomystudio'), false);

  // Unauthorized /go?target=whatsapp redirects back cleanly without leaking WA URL
  const blockedWa = await handleGoRequest(
    new Request('https://manifestudio.my.id/api/store-access/go?target=whatsapp'),
    env,
    { nowSec }
  );
  assert.equal(blockedWa.status, 302);
  assert.equal(blockedWa.headers.get('location'), 'https://manifestudio.my.id/?gate=required&target=whatsapp');

  // Submitting Store key for Contact target when separate Contact key is enabled MUST fail
  const wrongKeyForContact = await handleVerifyRequest(
    new Request('https://manifestudio.my.id/api/store-access/verify', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '198.51.100.40',
        Origin: 'https://manifestudio.my.id',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({ key: 'STORE-KEY-777', target: 'whatsapp' }),
    }),
    env,
    { nowSec }
  );
  assert.equal(wrongKeyForContact.status, 401);

  // Submitting valid Contact key sets __Host-ms_contact_pass HttpOnly cookie
  const okContact = await handleVerifyRequest(
    new Request('https://manifestudio.my.id/api/store-access/verify', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '198.51.100.40',
        Origin: 'https://manifestudio.my.id',
        'Content-Type': 'application/json',
        [VAULT_CONSTANTS.csrfHeaderName]: VAULT_CONSTANTS.csrfHeaderValue,
      },
      body: JSON.stringify({ key: 'kontak-vip-99', target: 'whatsapp' }),
    }),
    env,
    { nowSec: nowSec + 5 }
  );
  assert.equal(okContact.status, 200);
  const setCookie = okContact.headers.get('set-cookie') || '';
  assert.ok(setCookie.startsWith('__Host-ms_contact_pass=v1.'));
  assert.ok(setCookie.includes('HttpOnly'));
  const okContactJson = await okContact.json();
  assert.equal(okContactJson.goUrl, '/api/store-access/go?target=whatsapp');
  assert.equal(JSON.stringify(okContactJson).includes('6285122936027'), false);

  const cookiePair = setCookie.split(';')[0];

  // Valid contact pass redirects to WhatsApp, Instagram, and TikTok
  const goWa = await handleGoRequest(
    new Request('https://manifestudio.my.id/api/store-access/go?target=whatsapp', {
      headers: { Cookie: cookiePair },
    }),
    env,
    { nowSec: nowSec + 10 }
  );
  assert.equal(goWa.status, 302);
  assert.equal(goWa.headers.get('location'), 'https://wa.me/6285122936027');

  const goIg = await handleGoRequest(
    new Request('https://manifestudio.my.id/api/store-access/go?target=instagram', {
      headers: { Cookie: cookiePair },
    }),
    env,
    { nowSec: nowSec + 12 }
  );
  assert.equal(goIg.status, 302);
  assert.equal(goIg.headers.get('location'), 'https://www.instagram.com/tmctomystudio');

  const goTt = await handleGoRequest(
    new Request('https://manifestudio.my.id/api/store-access/go?target=tiktok', {
      headers: { Cookie: cookiePair },
    }),
    env,
    { nowSec: nowSec + 14 }
  );
  assert.equal(goTt.status, 302);
  assert.equal(goTt.headers.get('location'), 'https://www.tiktok.com/@tmctomystudio');
});

