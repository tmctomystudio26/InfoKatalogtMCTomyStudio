import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FEATURE_CS_KNOWLEDGE_BASE,
  buildFeatureCsCourtesyReply,
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
  renderMarkdownSafe,
} from './manifest-ai-logic.js';
import {
  computeDracinVerticalDragOffset,
  decideDracinVerticalSwipeOutcome,
} from './dracin-logic.js';

test('FEATURE_CS_KNOWLEDGE_BASE covers all 17 Manifestudio utilities including Shortlink Bypass & SSH & VPN', () => {
  assert.equal(FEATURE_CS_KNOWLEDGE_BASE.length, 17);
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
    'shortlink',
    'sshvpn',
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

test('classifyFeatureCsIntent handles courtesy, follow-ups, greeting, restricted_leak, feature_support, and off_topic', () => {
  assert.equal(classifyFeatureCsIntent('Halo'), 'greeting');
  assert.equal(classifyFeatureCsIntent('P'), 'greeting');

  // Natural courtesies (including multi-word Indonesian thank-yous) must NEVER trigger off_topic!
  for (const msg of [
    'Terimakasih',
    'Terimakasih atas informasinya',
    'Terima kasih banyak infonya min',
    'Makasih ya bantuannya!',
    'Oke siap',
    'Mantap berhasil!',
    'Done work',
  ]) {
    assert.equal(classifyFeatureCsIntent(msg), 'courtesy', `Expected courtesy for "${msg}"`);
  }

  // Real user complaints from screenshots MUST route to feature_support (never off_topic!)
  assert.equal(classifyFeatureCsIntent('Ngelag ketika menonton drama'), 'feature_support');
  assert.equal(classifyFeatureCsIntent('Drama tidak lengkap'), 'feature_support');
  assert.equal(classifyFeatureCsIntent('Cara pakai Shortlink Bypass biar aman dari malware'), 'feature_support');
  assert.equal(classifyFeatureCsIntent('Cara buat akun SSH VMess VLess WireGuard gratis'), 'feature_support');

  // Context-aware follow-up questions remain inside feature_support
  assert.equal(classifyFeatureCsIntent('Terus caranya gimana?', { hasContext: true }), 'feature_support');
  assert.equal(classifyFeatureCsIntent('Kalau masih gagal?', { hasContext: true }), 'feature_support');

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

  // Verify dedicated local troubleshooting fallbacks for drama lag, incomplete episodes, and shortlink bypass
  const lagReply = buildFeatureCsLocalFallback('Ngelag ketika menonton drama');
  assert.match(lagReply, /540P|480P|buffering|server/i);
  assert.doesNotMatch(lagReply, /Mohon maaf, menu \*\*Tanya Fitur\*\* dirancang khusus/i);

  const incompleteReply = buildFeatureCsLocalFallback('Drama tidak lengkap');
  assert.match(incompleteReply, /ongoing|episode|platform|Refresh/i);
  assert.doesNotMatch(incompleteReply, /Mohon maaf, menu \*\*Tanya Fitur\*\* dirancang khusus/i);

  const slbReply = buildFeatureCsLocalFallback('Cara pakai Shortlink Bypass');
  assert.match(slbReply, /Shortlink Bypass/i);

  const sshReply = buildFeatureCsLocalFallback('Cara buat akun SSH VMess VLess gratis');
  assert.match(sshReply, /SSH & VPN/i);
});

test('Tanya Fitur courtesy reply is warm & human and sanitization cleans raw <br> tags for Markdown tables', () => {
  const courtesy = buildFeatureCsCourtesyReply('Terimakasih');
  assert.match(courtesy, /sama-sama/i);
  assert.doesNotMatch(courtesy, /mohon maaf/i);

  const rawTable = '| # | Fitur | Cara Kerja |\n|---|---|---|\n| 1 | **Manifest AI** | Chat AI.<br>- Cepat<br/>- Gratis |';
  const cleaned = sanitizeFeatureCsReply(rawTable);
  assert.doesNotMatch(cleaned, /<br\s*\/?>/i);

  const html = renderMarkdownSafe(cleaned);
  assert.match(html, /<table class="mai-md-table">/);
  assert.doesNotMatch(html, /\|---\|/);
  assert.doesNotMatch(html, /&lt;br/i);
});

test('Tanya Fitur replies & fallback never leak Manifestore, contacts, or raw system strings', () => {
  const samples = [
    buildFeatureCsGreetingReply(),
    buildFeatureCsCourtesyReply('Makasih'),
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

test('Drama Pendek TikTok vertical swipe physics tracks 1:1, rubber-bands at edges, and never jumps abruptly on slight drag', () => {
  // 1:1 tracking when adjacent episode exists
  assert.equal(
    computeDracinVerticalDragOffset({ rawDeltaY: -120, stageHeight: 640, hasPrev: true, hasNext: true }),
    -120
  );
  // Rubber-band resistance on Episode 1 when pulling down
  const ep1Bounce = computeDracinVerticalDragOffset({ rawDeltaY: 200, stageHeight: 640, hasPrev: false, hasNext: true });
  assert.ok(ep1Bounce > 0 && ep1Bounce < 80, `Expected damped rubber-band bounce, got ${ep1Bounce}`);

  // Small/slow scroll snaps back smoothly instead of abruptly jumping scene
  assert.deepEqual(
    decideDracinVerticalSwipeOutcome({ deltaY: -65, velocityPxPerMs: -0.1, stageHeight: 640, hasPrev: true, hasNext: true }),
    { action: 'snap_back', direction: 0 }
  );

  // Dragging past 24% height commits to next episode
  assert.deepEqual(
    decideDracinVerticalSwipeOutcome({ deltaY: -180, velocityPxPerMs: -0.15, stageHeight: 640, hasPrev: true, hasNext: true }),
    { action: 'next', direction: 1 }
  );

  // Intentional fast flick up commits to next episode
  assert.deepEqual(
    decideDracinVerticalSwipeOutcome({ deltaY: -62, velocityPxPerMs: -0.7, stageHeight: 640, hasPrev: true, hasNext: true }),
    { action: 'next', direction: 1 }
  );

  // Dragging down past threshold commits to prev episode
  assert.deepEqual(
    decideDracinVerticalSwipeOutcome({ deltaY: 185, velocityPxPerMs: 0.2, stageHeight: 640, hasPrev: true, hasNext: true }),
    { action: 'prev', direction: -1 }
  );

  // Cannot commit prev when hasPrev is false
  assert.deepEqual(
    decideDracinVerticalSwipeOutcome({ deltaY: 200, velocityPxPerMs: 0.8, stageHeight: 640, hasPrev: false, hasNext: true }),
    { action: 'snap_back', direction: 0 }
  );
});
