import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import {
  DONATE_CONFIG,
  aggregateDonationsToLeaderboard,
  convertToIdr,
  filterLeaderboardEntries,
  formatOriginalCurrency,
  formatRupiahDonate,
  formatWibMonthLabel,
  getWibMonthKey,
  normalizeLeaderboardPayload,
  sanitizeDonorMessage,
  sanitizeDonorName,
} from './donate-logic.js';
import donateWorker from '../workers/manifestudio-donate-worker.js';

test('v102: DONATE_CONFIG points to live donate-api.manifestudio.my.id, Saweria, and SociaBuzz Tribe', () => {
  assert.equal(DONATE_CONFIG.apiBaseUrl, 'https://donate-api.manifestudio.my.id');
  assert.equal(DONATE_CONFIG.saweriaUrl, 'https://saweria.co/manifestudio');
  assert.equal(DONATE_CONFIG.sociabuzzUrl, 'https://sociabuzz.com/manifestudio/tribe');
});

test('v105: getWibMonthKey & formatWibMonthLabel automatically roll over at 00:00 WIB (UTC+7) every new month & year', () => {
  // 23:59:59 WIB on 30 Nov 2026 = 16:59:59 UTC on 30 Nov 2026
  const endOfNovWib = getWibMonthKey('2026-11-30T16:59:59.000Z');
  assert.equal(endOfNovWib, '2026-11');
  assert.equal(formatWibMonthLabel(endOfNovWib), 'November 2026');

  // 00:00:00 WIB on 1 Dec 2026 = 17:00:00 UTC on 30 Nov 2026
  const startOfDecWib = getWibMonthKey('2026-11-30T17:00:00.000Z');
  assert.equal(startOfDecWib, '2026-12');
  assert.equal(formatWibMonthLabel(startOfDecWib), 'Desember 2026');

  // 00:00:00 WIB on 1 Jan 2027 = 17:00:00 UTC on 31 Dec 2026
  const startOfJan2027Wib = getWibMonthKey('2026-12-31T17:00:00.000Z');
  assert.equal(startOfJan2027Wib, '2027-01');
  assert.equal(formatWibMonthLabel(startOfJan2027Wib), 'Januari 2027');
});

test('v102: sanitizeDonorName & sanitizeDonorMessage strip XSS tags, redact spam URLs, and mask profanity', () => {
  assert.equal(sanitizeDonorName('<script>alert(1)</script>  Budi Santoso  '), 'alert(1) Budi Santoso');
  assert.equal(sanitizeDonorName('   '), 'Anonim');

  const cleanedMsg = sanitizeDonorMessage(
    'Semangat bang! Cek https://spam-judi.xyz dan bit.ly/scam jangan jadi anjing ya <img src=x onerror=alert(1)>'
  );
  assert.equal(cleanedMsg.includes('<img'), false);
  assert.equal(cleanedMsg.includes('https://'), false);
  assert.equal(cleanedMsg.includes('bit.ly'), false);
  assert.equal(cleanedMsg.includes('[tautan disensor]'), true);
  assert.equal(/\banjing\b/i.test(cleanedMsg), false);
  assert.equal(cleanedMsg.includes('Semangat bang!'), true);
});

test('v102: convertToIdr & formatOriginalCurrency convert foreign SociaBuzz currencies to IDR accurately', () => {
  assert.equal(convertToIdr(50000, 'IDR'), 50000);
  assert.equal(convertToIdr(10, 'USD', { USD: 16000 }), 160000);
  assert.equal(convertToIdr(5, 'SGD', { SGD: 12000 }), 60000);
  assert.equal(formatRupiahDonate(160000), 'Rp160.000');
  assert.equal(formatOriginalCurrency(10, 'USD'), 'USD 10');
  assert.equal(formatOriginalCurrency(25000, 'IDR'), 'Rp25.000');
});

test('v102: aggregateDonationsToLeaderboard sums repeat donors across Saweria + SociaBuzz and separates WIB months', () => {
  const sample = [
    {
      donorName: 'Raka Pratama',
      platform: 'saweria',
      amountIdr: 50000,
      message: 'Mantap webnya!',
      createdAt: '2026-10-15T10:00:00.000Z',
      monthWib: '2026-10',
    },
    {
      donorName: 'raka pratama',
      platform: 'sociabuzz',
      amountIdr: 80000,
      message: 'Nambah lagi buat kopi!',
      createdAt: '2026-11-20T12:00:00.000Z',
      monthWib: '2026-11',
    },
    {
      donorName: 'Sinta Dewi',
      platform: 'saweria',
      amountIdr: 100000,
      message: 'Sukses selalu!',
      createdAt: '2026-11-22T09:00:00.000Z',
      monthWib: '2026-11',
    },
  ];

  const allTime = aggregateDonationsToLeaderboard(sample);
  assert.equal(allTime.length, 2);
  assert.equal(allTime[0].donorName, 'raka pratama');
  assert.equal(allTime[0].totalIdr, 130000);
  assert.equal(allTime[0].donationCount, 2);
  assert.deepEqual(allTime[0].platforms.sort(), ['saweria', 'sociabuzz']);
  assert.equal(allTime[0].latestMessage, 'Nambah lagi buat kopi!');

  const novOnly = aggregateDonationsToLeaderboard(sample, { monthKey: '2026-11' });
  assert.equal(novOnly[0].donorName, 'Sinta Dewi');
  assert.equal(novOnly[0].totalIdr, 100000);
  assert.equal(novOnly[1].totalIdr, 80000);

  const filtered = filterLeaderboardEntries(allTime, { query: 'kopi', platform: 'sociabuzz' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].totalIdr, 130000);

  const normalized = normalizeLeaderboardPayload({ ok: true, allTime, monthly: novOnly, recent: [] });
  assert.equal(normalized.allTime[0].totalIdr, 130000);
});

test('v102: Cloudflare Worker verifies Saweria HMAC-SHA256 & SociaBuzz token, rejects forged requests, and serves D1 leaderboard', async () => {
  // Lightweight in-memory D1 mock supporting our exact prepared statements
  const rows = [];
  let autoId = 1;

  const mockDb = {
    prepare(sql) {
      let params = [];
      const stmt = {
        bind(...args) {
          params = args;
          return stmt;
        },
        async run() {
          if (/INSERT OR IGNORE INTO donations/i.test(sql)) {
            const isSaweria = /'saweria'/.test(sql);
            const [tx_id, donor_name, donor_key, amount_idr, original_amount, original_currency, message, created_at, month_wib, is_test] = params;
            if (!rows.some((r) => r.tx_id === tx_id)) {
              rows.push({
                id: autoId++,
                tx_id,
                platform: isSaweria ? 'saweria' : 'sociabuzz',
                donor_name,
                donor_key,
                amount_idr,
                original_amount,
                original_currency,
                message,
                created_at,
                month_wib,
                is_test,
                is_hidden: 0,
              });
            }
            return { success: true, meta: { changes: 1 } };
          }
          return { success: true, meta: { changes: 0 } };
        },
        async first() {
          const monthFilter = /month_wib = \?/.test(sql) ? params[0] : null;
          const active = rows.filter((r) => !r.is_hidden && (!monthFilter || r.month_wib === monthFilter));
          return {
            total_idr: active.reduce((s, r) => s + r.amount_idr, 0),
            total_count: active.length,
            unique_donors: new Set(active.map((r) => r.donor_key)).size,
          };
        },
        async all() {
          if (/GROUP BY donor_key/i.test(sql)) {
            const monthFilter = /AND month_wib = \?|WHERE is_hidden = 0 AND month_wib = \?/i.test(sql) ? params[0] : null;
            const grouped = aggregateDonationsToLeaderboard(
              rows.map((r) => ({
                donorName: r.donor_name,
                platform: r.platform,
                amountIdr: r.amount_idr,
                message: r.message,
                createdAt: r.created_at,
                monthWib: r.month_wib,
                isHidden: Boolean(r.is_hidden),
              })),
              { monthKey: monthFilter }
            );
            return {
              results: grouped.map((g) => ({
                donor_key: g.donorKey,
                donor_name: g.donorName,
                total_idr: g.totalIdr,
                donation_count: g.donationCount,
                platforms_csv: g.platforms.join(','),
                latest_message: g.latestMessage,
                latest_at: g.latestAt,
              })),
            };
          }
          return { results: [...rows].reverse() };
        },
      };
      return stmt;
    },
  };

  const env = {
    DB: mockDb,
    SAWERIA_STREAM_KEY: 'test-saweria-secret-key',
    SOCIABUZZ_WEBHOOK_TOKEN: 'sbwhook-test-token-123',
    ADMIN_KEY: 'super-admin-pass',
  };

  // 1. Forged Saweria webhook MUST return 401
  const badSaweria = await donateWorker.fetch(
    new Request('https://donate-api.manifestudio.my.id/webhook/saweria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Saweria-Callback-Signature': 'deadbeef' },
      body: JSON.stringify({ id: 'tx-1', version: '2022.01', amount_raw: 50000, donator_name: 'Hacker', donator_email: 'a@b.c' }),
    }),
    env
  );
  assert.equal(badSaweria.status, 401);

  // 2. Valid HMAC-SHA256 Saweria webhook MUST return 200 and insert
  const sawPayload = {
    version: '2022.01',
    id: 'saw-tx-001',
    amount_raw: 75000,
    donator_name: 'Dina Putri',
    donator_email: 'dina@example.com',
    message: 'Keren banget alatnya! https://spam.com',
    created_at: new Date().toISOString(),
  };
  const sawSig = crypto
    .createHmac('sha256', env.SAWERIA_STREAM_KEY)
    .update(`${sawPayload.version}${sawPayload.id}${sawPayload.amount_raw}${sawPayload.donator_name}${sawPayload.donator_email}`)
    .digest('hex');

  const okSaweria = await donateWorker.fetch(
    new Request('https://donate-api.manifestudio.my.id/webhook/saweria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Saweria-Callback-Signature': sawSig },
      body: JSON.stringify(sawPayload),
    }),
    env
  );
  assert.equal(okSaweria.status, 200);

  // 3. Forged SociaBuzz webhook MUST return 401
  const badSb = await donateWorker.fetch(
    new Request('https://donate-api.manifestudio.my.id/webhook/sociabuzz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sociabuzz-webhook-token': 'wrong-token' },
      body: JSON.stringify({ id: 'sb-1', supporter: 'Fake', amount: 100000, currency: 'IDR' }),
    }),
    env
  );
  assert.equal(badSb.status, 401);

  // 4. Valid SociaBuzz Tribe USD webhook via official sb-webhook-token MUST convert to IDR & aggregate with same donor
  const okSb = await donateWorker.fetch(
    new Request('https://donate-api.manifestudio.my.id/webhook/sociabuzz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'sb-webhook-token': env.SOCIABUZZ_WEBHOOK_TOKEN },
      body: JSON.stringify({
        id: 'sb-tx-002',
        supporter: 'Dina Putri',
        amount: 5,
        currency: 'USD',
        message: 'Support from abroad!',
        created_at: new Date().toISOString(),
      }),
    }),
    env
  );
  assert.equal(okSb.status, 200);
  const okSbJson = await okSb.json();
  assert.ok(okSbJson.amountIdr >= 50000);
  assert.equal(okSbJson.originalCurrency, 'USD');
  assert.ok(okSbJson.rateUsed > 10000);

  // 4b. Valid SociaBuzz webhook via JSON body webhook_token MUST also succeed
  const okSbBodyToken = await donateWorker.fetch(
    new Request('https://donate-api.manifestudio.my.id/webhook/sociabuzz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'sb-tx-003',
        webhook_token: env.SOCIABUZZ_WEBHOOK_TOKEN,
        supporter: 'Rizky Hidayat',
        amount_raw: 25000,
        currency: 'IDR',
        message: 'Mantap!',
      }),
    }),
    env
  );
  assert.equal(okSbBodyToken.status, 200);

  // 4c. GET /fx endpoint returns live exchange rates for major currencies to IDR
  const fxRes = await donateWorker.fetch(
    new Request('https://donate-api.manifestudio.my.id/fx', { method: 'GET' }),
    env
  );
  assert.equal(fxRes.status, 200);
  const fxJson = await fxRes.json();
  assert.equal(fxJson.ok, true);
  assert.equal(fxJson.base, 'IDR');
  assert.ok(fxJson.ratesToIdr.USD > 10000);
  assert.ok(fxJson.ratesToIdr.MYR > 2500);
  assert.ok(fxJson.ratesToIdr.SGD > 8000);

  // 5. GET /leaderboard returns aggregated donor, sanitized message, and NO email leak!
  const lbRes = await donateWorker.fetch(
    new Request('https://donate-api.manifestudio.my.id/leaderboard', {
      method: 'GET',
      headers: { Origin: 'https://manifestudio.my.id' },
    }),
    env
  );
  assert.equal(lbRes.status, 200);
  assert.equal(lbRes.headers.get('Access-Control-Allow-Origin'), 'https://manifestudio.my.id');
  const lb = await lbRes.json();
  assert.equal(lb.ok, true);
  assert.equal(lb.allTime.length, 2);
  assert.equal(lb.allTime[0].donorName, 'Dina Putri');
  assert.equal(lb.allTime[0].donationCount, 2);
  assert.equal(JSON.stringify(lb).includes('dina@example.com'), false);
  assert.equal(JSON.stringify(lb).includes('https://spam.com'), false);

  // 6. Admin routes reject wrong key (403) and accept valid ADMIN_KEY for /admin/verify & /admin/clear-tests
  const badAdmin = await donateWorker.fetch(
    new Request('https://donate-api.manifestudio.my.id/admin/verify', {
      method: 'GET',
      headers: { 'X-Admin-Key': 'wrong-admin-key' },
    }),
    env
  );
  assert.equal(badAdmin.status, 403);

  const okAdminVerify = await donateWorker.fetch(
    new Request('https://donate-api.manifestudio.my.id/admin/verify', {
      method: 'GET',
      headers: { 'X-Admin-Key': env.ADMIN_KEY },
    }),
    env
  );
  assert.equal(okAdminVerify.status, 200);

  // 7. Repeated SociaBuzz Test Notifikasi with fixed ID 6116050460 inserts new test rows every time
  for (let i = 0; i < 2; i += 1) {
    const sbTestRes = await donateWorker.fetch(
      new Request('https://donate-api.manifestudio.my.id/webhook/sociabuzz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'sb-webhook-token': env.SOCIABUZZ_WEBHOOK_TOKEN },
        body: JSON.stringify({
          id: '6116050460',
          supporter: 'Jessica',
          amount: 10000,
          currency: 'IDR',
          message: 'Ini hanya test notifikasi',
        }),
      }),
      env
    );
    assert.equal(sbTestRes.status, 200);
  }
  const lbAfterSbTest = await (
    await donateWorker.fetch(new Request('https://donate-api.manifestudio.my.id/leaderboard'), env)
  ).json();
  const jessicaRow = lbAfterSbTest.allTime.find((r) => r.donorName === 'Jessica');
  assert.ok(jessicaRow);
  assert.equal(jessicaRow.donationCount, 2);
  assert.equal(jessicaRow.totalIdr, 20000);
});


