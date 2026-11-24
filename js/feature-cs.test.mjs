import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FEATURE_CS_KNOWLEDGE_BASE,
  buildFeatureCsGreetingReply,
  buildFeatureCsLocalFallback,
  buildFeatureCsOffTopicReply,
  buildFeatureCsRestrictedReply,
  buildFeatureCsSystemPrompt,
  classifyFeatureCsIntent,
  sanitizeFeatureCsReply,
} from './feature-cs-logic.js';
import {
  buildOwnerContactPrivacyReply,
  buildUnifiedContextMessages,
  isRestrictedManifestudioQuery,
  redactSensitiveOwnerData,
} from './manifest-ai-logic.js';

test('FEATURE_CS_KNOWLEDGE_BASE covers all 15 Manifestudio utilities', () => {
  assert.equal(FEATURE_CS_KNOWLEDGE_BASE.length, 15);
  const ids = new Set(FEATURE_CS_KNOWLEDGE_BASE.map((f) => f.id));
  for (const expected of [
    'manifestai',
    'plagiarism',
    'novel',
    'dracin',
    'music',
    'audioeditor',
    'songfinder',
    'downloader',
    'compressor',
    'converter',
    'prayer',
    'weather',
    'worldclock',
    'speedtest',
    'callerid',
  ]) {
    assert.ok(ids.has(expected), `Missing feature KB entry: ${expected}`);
  }
});

test('classifyFeatureCsIntent separates greeting, restricted_leak, feature_support, and off_topic', () => {
  assert.equal(classifyFeatureCsIntent('Halo'), 'greeting');
  assert.equal(classifyFeatureCsIntent('P'), 'greeting');

  assert.equal(classifyFeatureCsIntent('Berapa harga Netflix Premium di Manifestore?'), 'restricted_leak');
  assert.equal(classifyFeatureCsIntent('Minta nomor WhatsApp admin dong'), 'restricted_leak');
  assert.equal(classifyFeatureCsIntent('Apa kode akses store?'), 'restricted_leak');
  assert.equal(classifyFeatureCsIntent('Apa Instagram dan TikTok admin?'), 'restricted_leak');

  assert.equal(classifyFeatureCsIntent('Cara download video TikTok tanpa watermark?'), 'feature_support');
  assert.equal(classifyFeatureCsIntent('Kenapa jadwal sholat GPS saya tidak akurat?'), 'feature_support');
  assert.equal(classifyFeatureCsIntent('Ada fitur apa saja di Manifestudio?'), 'feature_support');
  assert.equal(classifyFeatureCsIntent('Kompres video biar tidak pecah gimana?'), 'feature_support');

  assert.equal(classifyFeatureCsIntent('Buatkan resep nasi goreng kampung yang enak'), 'off_topic');
  assert.equal(classifyFeatureCsIntent('Siapa presiden Indonesia pertama?'), 'off_topic');
  assert.equal(classifyFeatureCsIntent('Buatkan kode Python sorting quicksort'), 'off_topic');
});

test('Tanya Fitur replies & fallback never leak Manifestore, contacts, or raw system strings', () => {
  const samples = [
    buildFeatureCsGreetingReply(),
    buildFeatureCsRestrictedReply(),
    buildFeatureCsOffTopicReply(),
    buildFeatureCsLocalFallback('Cara pakai Downloader tanpa watermark'),
    buildFeatureCsLocalFallback('Ada fitur apa saja di sini?'),
    buildFeatureCsLocalFallback('Cara cek plagiarisme PDF'),
    sanitizeFeatureCsReply(
      'Buka manifestore.my.id atau hubungi 6285122936027 @tmctomystudio lewat Cloudflare KV PBKDF2 admin.html'
    ),
  ];

  for (const text of samples) {
    assert.doesNotMatch(text, /manifestore\.my\.id/i);
    assert.doesNotMatch(text, /6285122936027/);
    assert.doesNotMatch(text, /tmctomystudio/i);
    assert.doesNotMatch(text, /Cloudflare KV|STORE_ACCESS_KV|PBKDF2|HMAC|admin\.html|catalog\.json/i);
  }
});

test('buildFeatureCsSystemPrompt grounds all 15 features and enforces CS role', () => {
  const prompt = buildFeatureCsSystemPrompt('downloader');
  assert.match(prompt, /Customer Service/i);
  assert.match(prompt, /Downloader/i);
  assert.match(prompt, /DILARANG/i);
});

test('Manifest AI utilities mode isolates Manifestudio from Store/Manifestore/Contacts', () => {
  assert.equal(isRestrictedManifestudioQuery('Berapa harga CapCut Pro?'), true);
  assert.equal(isRestrictedManifestudioQuery('Link Manifestore apa?'), true);
  assert.equal(isRestrictedManifestudioQuery('Minta WA owner Manifestudio'), true);
  assert.equal(isRestrictedManifestudioQuery('Jelaskan teori relativitas Einstein'), false);
  assert.equal(isRestrictedManifestudioQuery('Buatkan kode React counter'), false);

  const privacyReply = buildOwnerContactPrivacyReply('utilities');
  assert.doesNotMatch(privacyReply, /manifestore/i);
  assert.doesNotMatch(privacyReply, /6285122936027|tmctomystudio/i);

  const cleaned = redactSensitiveOwnerData(
    'Kunjungi https://manifestore.my.id atau STORE_ACCESS_KV di admin.html',
    {},
    { siteMode: 'utilities' }
  );
  assert.doesNotMatch(cleaned, /manifestore\.my\.id/i);
  assert.doesNotMatch(cleaned, /STORE_ACCESS_KV/i);
  assert.doesNotMatch(cleaned, /admin\.html/i);

  const msgs = buildUnifiedContextMessages([], 'Siapa Manifestudio?', {
    catalogData: {
      products: [{ name: 'Netflix Premium', price: 25000 }],
      brand: { whatsappNumber: '6285122936027', socials: [{ label: '@tmctomystudio' }] },
    },
    siteMode: 'utilities',
  });
  const sysContent = msgs.find((m) => m.role === 'system')?.content || '';
  assert.doesNotMatch(sysContent, /Netflix Premium/i);
  assert.doesNotMatch(sysContent, /6285122936027|tmctomystudio/i);
});
