import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_MANIFESTUDIO_PROFILE,
  HF_GRADIO_FREE_SPACES,
  MANIFEST_AI_SYSTEM_PROMPT,
  MANIFEST_AI_VOICE_CATALOG,
  OVH_FREE_DEFAULT_MODELS,
  buildLocalManifestudioFallback,
  buildManifestudioKnowledgeBlock,
  buildUnifiedContextMessages,
  cleanTextForSpeech,
  detectTopicShift,
  getVoiceProfileById,
  isManifestudioQuery,
  mergeLiveModelCatalog,
  planEnsembleExecution,
  recordProviderCooldown,
  redactSensitiveOwnerData,
  renderMarkdownSafe,
  resolveVoiceForSegment,
  sanitizeConversationHistory,
  segmentMultilingualSpeech,
} from './manifest-ai-logic.js';

const liveCatalog = JSON.parse(
  fs.readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8')
);

test('Manifest AI v64 knows its creator Tomy & real Manifestudio products while strictly protecting sensitive owner contacts', () => {
  assert.ok(MANIFEST_AI_SYSTEM_PROMPT.includes('Tomy'));
  assert.ok(MANIFEST_AI_SYSTEM_PROMPT.includes('manifestudio.my.id'));
  assert.ok(MANIFEST_AI_SYSTEM_PROMPT.includes('footer'));
  assert.ok(MANIFEST_AI_SYSTEM_PROMPT.includes('62xxxxxxxxxx'));
  assert.ok(MANIFEST_AI_SYSTEM_PROMPT.includes('JANGAN pernah mengarang'));
  // Privacy rule: system prompt must NEVER embed raw WhatsApp numbers or raw social handles
  assert.equal(MANIFEST_AI_SYSTEM_PROMPT.includes('6285122936027'), false);
  assert.equal(MANIFEST_AI_SYSTEM_PROMPT.includes('851-2293-6027'), false);
  assert.equal(MANIFEST_AI_SYSTEM_PROMPT.includes('@tmctomystudio'), false);

  // Recognizes exact spelling AND common typos like "manefestudio"
  assert.equal(isManifestudioQuery('Ada apa aja di manefestudio'), true);
  assert.equal(isManifestudioQuery('Siapa tuan Manifestudio?'), true);
  assert.equal(isManifestudioQuery('Cara membuat kopi tubruk'), false);

  const knowledge = buildManifestudioKnowledgeBlock(liveCatalog);
  assert.ok(knowledge.includes('Tomy'));
  assert.ok(knowledge.includes('Capcut Pro') || knowledge.includes('CapCut Pro'));
  assert.ok(knowledge.includes('Netflix Premium'));
  assert.ok(knowledge.includes('Drama China'));
  assert.ok(knowledge.includes('Audio Editor'));
  assert.ok(knowledge.includes('footer'));
  assert.ok(knowledge.includes('62xxxxxxxxxx'));
  // Raw owner phone/social must NOT be exposed in knowledge block
  assert.equal(knowledge.includes('6285122936027'), false);
  assert.equal(knowledge.includes('@tmctomystudio'), false);

  // Local fallback handles casual "P" greeting and Manifestudio identity queries accurately
  const pingReply = buildLocalManifestudioFallback('P', liveCatalog);
  assert.ok(pingReply.includes('Manifest AI'));
  assert.ok(pingReply.includes('Tomy'));

  const brandReply = buildLocalManifestudioFallback('Ada apa aja di manefestudio?', liveCatalog);
  assert.ok(brandReply.includes('Manifestudio'));
  assert.ok(brandReply.includes('Tomy'));
  assert.ok(brandReply.includes('Menu Utilitas'));
  assert.ok(brandReply.includes('footer'));
  assert.equal(brandReply.includes('6285122936027'), false);
  assert.equal(brandReply.includes('@tmctomystudio'), false);
  assert.equal(/AR\/VR|studio kreatif.*game/i.test(brandReply), false);

  // Unrelated general queries do NOT hijack normal LLM routing
  assert.equal(buildLocalManifestudioFallback('Cara membuat kopi espresso', liveCatalog), '');
});

test('Manifest AI v62 isolates new topics cleanly while preserving memory on follow-ups and topic returns', () => {
  const coffeeHistory = [
    { role: 'user', content: 'Buatkan kopi' }, // orphaned unanswered turn from failed send
    { role: 'user', content: 'Cara membuat kopi' },
    { role: 'assistant', content: 'Pilih jenis kopi yang ingin dibuat: seduh manual, espresso, atau kapuccino?' },
  ];

  // Sanitizer removes consecutive orphaned user message cleanly
  const sanitized = sanitizeConversationHistory(coffeeHistory);
  assert.equal(sanitized.length, 2);
  assert.equal(sanitized[0].content, 'Cara membuat kopi');
  assert.equal(sanitized[1].role, 'assistant');

  // 1. Follow-up on same topic keeps coffee history intact
  assert.equal(detectTopicShift(sanitized, 'Pilih espresso dong').shifted, false);
  assert.equal(detectTopicShift(sanitized, 'Lanjutkan resepnya').shifted, false);

  const followUpMsgs = buildUnifiedContextMessages(coffeeHistory, 'Pilih espresso dong', {
    catalogData: liveCatalog,
  });
  assert.ok(followUpMsgs.length >= 4);
  assert.ok(followUpMsgs.some((m) => m.content.includes('Cara membuat kopi')));

  // 2. Switching to Manifestudio or identity question ISOLATES new topic (zero coffee baggage!)
  assert.equal(detectTopicShift(sanitized, 'Ada apa aja si Manifestudio').shifted, true);
  assert.equal(detectTopicShift(sanitized, 'Halo kamu siapa').shifted, true);
  assert.equal(detectTopicShift(sanitized, 'Bukan nanya kopi').shifted, true);

  const switchedMsgs = buildUnifiedContextMessages(coffeeHistory, 'Ada apa aja di manefestudio', {
    catalogData: liveCatalog,
  });
  assert.equal(switchedMsgs.length, 2); // ONLY [system (with live catalog!), latest user prompt]
  assert.equal(switchedMsgs[0].role, 'system');
  assert.ok(switchedMsgs[0].content.includes('DATA RESMI TERVERIFIKASI'));
  assert.ok(switchedMsgs[0].content.includes('Netflix Premium'));
  assert.equal(switchedMsgs.some((m) => m.role !== 'system' && /kopi/i.test(m.content)), false);
  assert.equal(switchedMsgs[1].content, 'Ada apa aja di manefestudio');

  // 3. Returning to an earlier topic in a longer thread restores memory
  const multiTopicHistory = [
    { role: 'user', content: 'Cara membuat kopi espresso' },
    { role: 'assistant', content: 'Gunakan 18g bubuk kopi halus dan ekstraksi 25-30 detik.' },
    { role: 'user', content: 'Ada apa aja di Manifestudio' },
    { role: 'assistant', content: 'Manifestudio menyediakan katalog akun premium dan 12 fitur utilitas.' },
  ];
  assert.equal(detectTopicShift(multiTopicHistory, 'Kembali ke takaran kopi espresso tadi').shifted, false);
});

test('Manifest AI v63 rotates across 4 independent free networks and survives full LLM7 + HF ZeroGPU CGNAT block', () => {
  const now = 1_760_000_000_000;
  assert.ok(HF_GRADIO_FREE_SPACES.length >= 2);
  assert.ok(OVH_FREE_DEFAULT_MODELS.length >= 14);

  // Live OVH catalog filter keeps real chat LLMs and drops TTS/Whisper/Embedding/Guard utility models
  const merged = mergeLiveModelCatalog({
    ovhModels: [
      { id: 'nvr-tts-en-us' },
      { id: 'whisper-large-v3' },
      { id: 'bge-m3' },
      { id: 'Qwen3Guard-Gen-8B' },
      { id: 'DeepSeek-V4.1-Flash-1017' },
      { id: 'gemma-4-26b-a4b' },
      { id: 'Qwen3.8-27B' },
    ],
  });
  assert.deepEqual(
    merged.freeGateways.ovh.map((m) => m.id),
    ['DeepSeek-V4.1-Flash-1017', 'gemma-4-26b-a4b', 'Qwen3.8-27B']
  );

  // Turn 0, 1, 2 rotate across LLM7 -> Pollinations -> OVHcloud (3 distinct independent networks!)
  const plan0 = planEnsembleExecution({ mode: 'ensemble', byokKeys: [], puterAvailable: false, limitMap: {}, turnIndex: 0, now });
  const plan1 = planEnsembleExecution({ mode: 'ensemble', byokKeys: [], puterAvailable: false, limitMap: {}, turnIndex: 1, now });
  const plan2 = planEnsembleExecution({ mode: 'ensemble', byokKeys: [], puterAvailable: false, limitMap: {}, turnIndex: 2, now });

  assert.equal(plan0.primary[0].channel, 'free-llm7');
  assert.equal(plan0.primary[1].channel, 'free-pollinations');
  assert.equal(plan1.primary[0].channel, 'free-pollinations');
  assert.equal(plan1.primary[1].channel, 'free-llm7');
  assert.equal(plan2.primary[0].channel, 'free-ovh');
  assert.notEqual(plan0.primary[0].quotaBucket, plan0.primary[1].quotaBucket);

  // 4G CGNAT scenario: BOTH LLM7 AND HF ZeroGPU are 100% rate-limited!
  // Manifest AI MUST still have Pollinations + all 14 OVHcloud flagship models healthy & ready!
  let cgnatLimits = recordProviderCooldown({}, 'free:llm7', 120000, 'Limit LLM7', now);
  cgnatLimits = recordProviderCooldown(cgnatLimits, 'free:hf-zerogpu', 300000, 'ZeroGPU quota', now);
  const cgnatPlan = planEnsembleExecution({
    mode: 'ensemble',
    byokKeys: [],
    puterAvailable: false,
    limitMap: cgnatLimits,
    turnIndex: 0,
    now: now + 3000,
  });
  assert.equal(cgnatPlan.primary.length, 2);
  assert.equal(cgnatPlan.primary[0].channel, 'free-pollinations');
  assert.equal(cgnatPlan.primary[1].channel, 'free-ovh');
  assert.ok(cgnatPlan.backups.length >= 13, 'Still has 13+ independent fresh OVHcloud flagship models as backups');

  // Cooling down 1 OVH model ONLY cools down that model — the next OVH model immediately takes over!
  const firstOvhId = cgnatPlan.primary[1].id;
  const afterFirstOvh = recordProviderCooldown(cgnatLimits, firstOvhId, 12 * 60 * 60 * 1000, 'OVH model used', now + 5000);
  const nextOvhPlan = planEnsembleExecution({
    mode: 'ensemble',
    byokKeys: [],
    puterAvailable: false,
    limitMap: afterFirstOvh,
    turnIndex: 2,
    now: now + 6000,
  });
  assert.equal(nextOvhPlan.primary[0].channel, 'free-ovh');
  assert.notEqual(nextOvhPlan.primary[0].id, firstOvhId);

  // Markdown XSS safety still holds
  const html = renderMarkdownSafe('**Manifestudio** <script>alert(1)</script>');
  assert.ok(html.includes('<strong>Manifestudio</strong>') && !html.includes('<script>'));
  assert.ok(DEFAULT_MANIFESTUDIO_PROFILE.utilities.length === 12);
});

test('Manifest AI v64 strictly censors leaked owner WhatsApp, phones, socials, and emails while preserving prices & normal numbers', () => {
  const leaked = [
    'Hubungi admin Tomy di +62 851-2293-6027 atau 085122936027.',
    'Link WA: https://wa.me/6285122936027?text=Halo',
    'Sosmed resmi: @tmctomystudio, https://instagram.com/tmctomystudio, dan github.com/tmctomystudio26.',
    'Email: tomy@manifestudio.my.id.',
    'Harga Netflix Premium mulai Rp25.000, CapCut Pro Rp50.000 di tahun 2026.',
  ].join(' ');

  const safe = redactSensitiveOwnerData(leaked, liveCatalog);

  // Must NOT leak any raw owner contact or social handle
  assert.equal(safe.includes('6285122936027'), false);
  assert.equal(safe.includes('851-2293-6027'), false);
  assert.equal(safe.includes('085122936027'), false);
  assert.equal(safe.includes('wa.me/62851'), false);
  assert.equal(safe.includes('@tmctomystudio'), false);
  assert.equal(safe.includes('instagram.com/tmctomystudio'), false);
  assert.equal(safe.includes('tmctomystudio26'), false);
  assert.equal(safe.includes('tomy@manifestudio.my.id'), false);

  // Must contain masked placeholders
  assert.ok(safe.includes('62xxxxxxxxxx'));
  assert.ok(safe.includes('@t***********o'));

  // Must preserve normal prices and years untouched
  assert.ok(safe.includes('Rp25.000'));
  assert.ok(safe.includes('Rp50.000'));
  assert.ok(safe.includes('2026'));
});

test('Manifest AI v65 voice catalog has zero duplicates, keeps 1 consistent speaker across mixed Indo/English, and speaks conversational Indonesian', () => {
  // 1. Catalog must have 25+ voices with 100% unique edgeVoice IDs and zero metallic pitch shifts
  assert.ok(MANIFEST_AI_VOICE_CATALOG.length >= 25);
  const edgeVoices = MANIFEST_AI_VOICE_CATALOG.map((v) => v.edgeVoice);
  assert.equal(new Set(edgeVoices).size, edgeVoices.length, 'Every voice profile MUST use a unique neural speaker');
  assert.ok(MANIFEST_AI_VOICE_CATALOG.every((v) => v.defaultPitch === 0), 'Edge voices should use pitch 0 for natural timbre');

  const males = MANIFEST_AI_VOICE_CATALOG.filter((v) => v.gender === 'male');
  const females = MANIFEST_AI_VOICE_CATALOG.filter((v) => v.gender === 'female');
  const idVoices = MANIFEST_AI_VOICE_CATALOG.filter((v) => v.baseLang === 'id');
  assert.ok(males.length >= 10);
  assert.ok(females.length >= 10);
  assert.ok(idVoices.some((v) => v.gender === 'male'));
  assert.ok(idVoices.some((v) => v.gender === 'female'));
  assert.equal(getVoiceProfileById('id-gadis').edgeVoice, 'id-ID-GadisNeural - id-ID (Female)');
  assert.equal(getVoiceProfileById('id-ardi').edgeVoice, 'id-ID-ArdiNeural - id-ID (Male)');

  // Legacy removed pitch-clone IDs migrate cleanly to distinct real neural voices
  assert.equal(getVoiceProfileById('id-gadis-santai').id, 'multi-emma');
  assert.equal(getVoiceProfileById('id-ardi-tenang').id, 'multi-andrew');

  // 2. Mixed Indonesian + English stays in ONE unified segment (NEVER swapped mid-sentence!)
  const mixedSentence = 'pak salim membeli buku The King Of Madagascar and Island di perpustakaan yang melelang buku';
  const segments = segmentMultilingualSpeech(mixedSentence, 'multi', { codeSwitch: true, isMultilingualVoice: true });
  assert.equal(segments.length, 1);
  assert.equal(segments[0].lang, 'id+en');
  assert.equal(segments[0].text, mixedSentence);

  // Also keeps mixed Latin unified even on Latin-only native voices like id-gadis / en-sonia
  const segmentsId = segmentMultilingualSpeech(mixedSentence, 'id', { codeSwitch: true, isMultilingualVoice: false });
  assert.equal(segmentsId.length, 1);
  assert.equal(segmentsId[0].text, mixedSentence);

  // 3. Switching voice model ALWAYS changes the resolved Edge speaker (never overwritten!)
  const pickedModels = ['multi-ava', 'multi-emma', 'multi-andrew', 'id-gadis', 'id-ardi', 'en-sonia', 'ms-yasmin'];
  const resolvedEdges = pickedModels.map((id) => resolveVoiceForSegment(id, 'id+en', true).edgeVoice);
  assert.equal(new Set(resolvedEdges).size, pickedModels.length, 'Every selected model resolves to its own distinct speaker');
  assert.equal(resolveVoiceForSegment('multi-emma', 'id', true).edgeVoice, 'en-US-EmmaMultilingualNeural - en-US (Female)');
  assert.equal(resolveVoiceForSegment('multi-andrew', 'id+en', true).edgeVoice, 'en-US-AndrewMultilingualNeural - en-US (Male)');
  assert.equal(resolveVoiceForSegment('id-gadis', 'id+en', true).edgeVoice, 'id-ID-GadisNeural - id-ID (Female)');
  assert.equal(resolveVoiceForSegment('id-ardi', 'en', true).edgeVoice, 'id-ID-ArdiNeural - id-ID (Male)');

  // 4. Non-Latin handling: V2 Multilingual preserves same voice; Latin-only voices borrow matching-gender native reader
  assert.equal(resolveVoiceForSegment('multi-ava', 'ja', true).id, 'multi-ava');
  assert.equal(resolveVoiceForSegment('id-gadis', 'ja', true).id, 'ja-nanami');
  assert.equal(resolveVoiceForSegment('id-ardi', 'ar', true).id, 'ar-hamed');

  const triSegments = segmentMultilingualSpeech('Halo teman こんにちは dunia مرحبا semuanya', 'id', {
    codeSwitch: true,
    isMultilingualVoice: false,
  });
  assert.ok(triSegments.some((s) => s.lang === 'ja' && s.text.includes('こんにちは')));
  assert.ok(triSegments.some((s) => s.lang === 'ar' && s.text.includes('مرحبا')));

  // 5. cleanTextForSpeech expands Rupiah, percentages, slashes, & abbreviations naturally + masks owner contacts
  const spoken = cleanTextForSpeech(
    '**Halo!** Paket Rp25.000 diskon 50% (gratis/berbayar), fitur editing, dll. Kontak WA +62 851-2293-6027 dan ```js\nconsole.log(1)\n```',
    liveCatalog
  );
  assert.equal(spoken.includes('**'), false);
  assert.equal(spoken.includes('851-2293-6027'), false);
  assert.ok(spoken.includes('25 ribu rupiah'));
  assert.ok(spoken.includes('50 persen'));
  assert.ok(spoken.includes('gratis atau berbayar'));
  assert.ok(spoken.includes('dan lain-lain'));
  assert.ok(spoken.includes('nomor yang disensor'));
  assert.ok(spoken.includes('Potongan kode tersedia di layar'));
});

