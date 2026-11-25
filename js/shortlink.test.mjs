import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_ENSEMBLE_MODELS,
  detectShortlinkService,
  evaluateUrlSafety,
  mergeAiSafetyConsensus,
  mergeBypassEngineResults,
  normalizeAndValidateUrl,
  parseAiSecurityReply,
  parseBatchUrls,
  runLocalInstantBypass,
  stripTrackingParams,
  upsertShortlinkHistory,
} from './shortlink-logic.js';

test('normalizeAndValidateUrl strictly blocks dangerous schemes and internal/private network addresses', () => {
  const blocked = [
    '',
    '   ',
    'javascript:alert(1)',
    'JAVASCRIPT:fetch("https://evil.com")',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
    'http://localhost/admin',
    'http://localhost:3000/api/secret',
    'http://127.0.0.1/test',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/router',
    'http://192.168.1.1/login',
    'http://172.16.0.1/internal',
    'http://[::1]/secret',
    'http://2130706433/',
    'https://user:pass@example.com/path',
    'http://service.internal/keys',
  ];

  for (const input of blocked) {
    const res = normalizeAndValidateUrl(input);
    assert.equal(res.valid, false, `Expected "${input}" to be rejected`);
  }

  // Valid URLs & auto-https normalization
  const bare = normalizeAndValidateUrl('bit.ly/demo-link');
  assert.equal(bare.valid, true);
  assert.equal(bare.url, 'https://bit.ly/demo-link');

  const embedded = normalizeAndValidateUrl('Coba cek link ini: https://tinyurl.com/abc123 ya!');
  assert.equal(embedded.valid, true);
  assert.equal(embedded.url, 'https://tinyurl.com/abc123');
});

test('runLocalInstantBypass unwraps Base64 safelinks, wrapper redirects, ROT13, double encoding, and cleans trackers', () => {
  // 1. Base64 Safelink + UTM/fbclid cleaning
  const b64Payload = Buffer.from('https://github.com/google?utm_source=ads&fbclid=12345').toString('base64');
  const safelinkRes = runLocalInstantBypass(`https://safelinku.com/go?u=${encodeURIComponent(b64Payload)}`);
  assert.equal(safelinkRes.ok, true);
  assert.equal(safelinkRes.unwrapped, true);
  assert.equal(safelinkRes.cleanUrl, 'https://github.com/google');
  assert.ok(safelinkRes.removedParams.includes('utm_source'));
  assert.ok(safelinkRes.removedParams.includes('fbclid'));

  // 2. Facebook redirect wrapper + UTM cleaning
  const fbRes = runLocalInstantBypass(
    'https://l.facebook.com/l.php?u=https%3A%2F%2Fid.wikipedia.org%2Fwiki%2FIndonesia%3Futm_source%3Dfb%26fbclid%3Dabc999'
  );
  assert.equal(fbRes.unwrapped, true);
  assert.equal(fbRes.cleanUrl, 'https://id.wikipedia.org/wiki/Indonesia');

  // 3. ROT13 encoded URL
  const rotRes = runLocalInstantBypass('https://safelinkblogger.com/go?target=uggcf://rknzcyr.pbz/svyr');
  assert.equal(rotRes.unwrapped, true);
  assert.equal(rotRes.cleanUrl, 'https://example.com/file');

  // 4. YouTube functional params (v= and t=) are preserved while si/utm are stripped
  const ytClean = stripTrackingParams('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&si=abc123&utm_campaign=share');
  assert.equal(ytClean.cleanUrl, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s');
  assert.ok(ytClean.removedParams.includes('si'));
  assert.ok(ytClean.removedParams.includes('utm_campaign'));
});

test('evaluateUrlSafety accurately distinguishes safe official links, suspicious HTTP/TLD links, and dangerous phishing .APK links', () => {
  const safeOfficial = evaluateUrlSafety('https://github.com/google');
  assert.equal(safeOfficial.level, 'safe');
  assert.equal(safeOfficial.isOfficial, true);
  assert.ok(safeOfficial.trustScore >= 90);

  const phishingApk = evaluateUrlSafety('http://bri-verifikasi-hadiah.xyz/unduh-resi.apk');
  assert.equal(phishingApk.level, 'danger');
  assert.ok(phishingApk.riskScore >= 55);
  assert.ok(phishingApk.findings.some((f) => /\.apk/i.test(f.text)));
  assert.ok(phishingApk.findings.some((f) => /phishing/i.test(f.text)));

  const warnHttpSuspicious = evaluateUrlSafety('http://promo-unik.xyz/page');
  assert.equal(warnHttpSuspicious.level, 'warn');
  assert.ok(warnHttpSuspicious.riskScore >= 22 && warnHttpSuspicious.riskScore < 55);

  const serviceAdWall = detectShortlinkService('https://ouo.io/abc123');
  assert.equal(serviceAdWall.kind, 'ad-wall');
});

test('mergeBypassEngineResults ranks direct non-shortener consensus over unresolved shortlink and tracks agreeing engines', () => {
  const inputUrl = 'https://ouo.io/abc123';
  const localResult = runLocalInstantBypass(inputUrl);
  const edgeResponse = {
    engines: [
      {
        engineId: 'edge-redirect',
        name: 'Pelacak Redirect & Inspektor Safelink',
        category: 'edge',
        ok: false,
        resolvedUrl: inputUrl,
        note: 'Masih di halaman iklan',
      },
      {
        engineId: 'bypass-vip',
        name: 'Bypass.VIP (Open Community API)',
        category: 'open-source',
        ok: true,
        resolvedUrl: 'https://github.com/google?utm_source=ouo',
        note: 'Berhasil dilewati',
      },
      {
        engineId: 'bypass-pm',
        name: 'Bypass.PM (Public Bypass API)',
        category: 'open-source',
        ok: true,
        resolvedUrl: 'https://github.com/google',
        note: 'Berhasil dilewati',
      },
    ],
    edgeTrace: {
      hops: [{ hop: 1, type: 'http', status: 302, target: 'https://github.com/google' }],
      pageTitle: 'Google · GitHub',
      signals: ['ad_countdown_wall'],
    },
  };

  const merged = mergeBypassEngineResults({ inputUrl, localResult, edgeResponse });
  assert.equal(merged.finalUrl, 'https://github.com/google');
  assert.equal(merged.bypassed, true);
  assert.ok(merged.agreeingCount >= 2);
  assert.equal(merged.pageTitle, 'Google · GitHub');
  assert.ok(merged.removedParams.includes('utm_source'));
});

test('parseAiSecurityReply & mergeAiSafetyConsensus integrate Gemini, ChatGPT, Claude, Grok, and DeepSeek verdicts', () => {
  assert.equal(AI_ENSEMBLE_MODELS.length, 5);

  const jsonParsed = parseAiSecurityReply(
    '```json\n{"verdict":"danger","summary":"Terindikasi malware APK berkedok hadiah bank.","advice":"Jangan unduh berkas ini.","extractedUrl":""}\n```'
  );
  assert.equal(jsonParsed.verdict, 'danger');
  assert.match(jsonParsed.summary, /malware/i);

  const baseSafe = evaluateUrlSafety('https://example-download-mirror.com/promo');
  assert.equal(baseSafe.level, 'safe');

  const elevated = mergeAiSafetyConsensus(baseSafe, [
    { modelId: 'gemini', label: 'Gemini', parsed: { verdict: 'danger', summary: 'Domain penipuan baru.', advice: 'Hindari.' } },
    { modelId: 'deepseek', label: 'DeepSeek', parsed: { verdict: 'danger', summary: 'Pola redirect phishing.', advice: 'Jangan klik.' } },
  ]);
  assert.equal(elevated.aiConsensusUsed, true);
  assert.equal(elevated.level, 'danger');
  assert.equal(elevated.aiModelsParticipated.length, 2);

  // Batch parsing & history upsert
  const batch = parseBatchUrls('https://bit.ly/a\nhttps://bit.ly/a\njavascript:alert(1)\nhttps://tinyurl.com/b', 10);
  assert.equal(batch.length, 3);
  assert.equal(batch[0].valid, true);
  assert.equal(batch[1].valid, false);
  assert.equal(batch[2].valid, true);

  const hist = upsertShortlinkHistory([], {
    inputUrl: 'https://bit.ly/a',
    finalUrl: 'https://github.com/google',
    safetyLevel: 'safe',
    safetyLabel: 'Aman Dibuka',
    bypassed: true,
  });
  assert.equal(hist.length, 1);
  assert.equal(hist[0].finalUrl, 'https://github.com/google');
});

test('mergeBypassEngineResults & evaluateUrlSafety reject bogus API banner URLs and honestly report Cloudflare/anti-bot blocks', () => {
  const inputUrl = 'https://ouo.io/0xljQ6';
  const localResult = runLocalInstantBypass(inputUrl);
  const edgeResponse = {
    edgeTrace: {
      resolvedUrl: inputUrl,
      hops: [{ step: 1, url: inputUrl, status: 403, type: 'cloudflare-challenge', target: inputUrl }],
      pageTitle: 'Just a moment...',
      signals: ['cloudflare_block', 'captcha_challenge'],
      cfBlocked: true,
    },
    engines: [
      {
        engineId: 'legacy-bad',
        name: 'Legacy API',
        category: 'open-source',
        ok: true,
        resolvedUrl: 'https://bypass.vip/discord',
        note: 'Shut down banner',
      },
      {
        engineId: 'parked-bad',
        name: 'Parked API',
        category: 'open-source',
        ok: true,
        resolvedUrl: 'http://ww17.bypass.pm/bypass2?url=foo',
        note: 'Parked',
      },
    ],
  };

  const merged = mergeBypassEngineResults({ inputUrl, localResult, edgeResponse });
  assert.equal(merged.finalUrl, inputUrl);
  assert.equal(merged.reachedDestination, false);
  assert.equal(merged.stillOnShortener, true);
  assert.equal(merged.cfBlocked, true);
  assert.equal(
    merged.engineRows.filter((r) => r.engineId !== 'local-decoder').every((r) => r.resolvedUrl === ''),
    true
  );

  const safety = evaluateUrlSafety(merged.finalUrl, {
    inputUrl,
    hopsCount: merged.hops.length,
    edgeSignals: merged.edgeSignals,
  });
  assert.equal(safety.level, 'warn');
  assert.equal(safety.unresolvedAdWall, true);
  assert.match(safety.label, /Belum Tembus/i);
});

