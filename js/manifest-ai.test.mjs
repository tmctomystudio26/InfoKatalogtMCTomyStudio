import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_MANIFESTUDIO_PROFILE,
  HF_GRADIO_FREE_SPACES,
  MANIFEST_AI_SYSTEM_PROMPT,
  buildLocalManifestudioFallback,
  buildManifestudioKnowledgeBlock,
  buildUnifiedContextMessages,
  detectTopicShift,
  isManifestudioQuery,
  planEnsembleExecution,
  recordProviderCooldown,
  renderMarkdownSafe,
  sanitizeConversationHistory,
} from './manifest-ai-logic.js';

const liveCatalog = JSON.parse(
  fs.readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8')
);

test('Manifest AI v62 knows its creator Tomy, real Manifestudio products & 12 utilities (anti-hallucination)', () => {
  assert.ok(MANIFEST_AI_SYSTEM_PROMPT.includes('Tomy'));
  assert.ok(MANIFEST_AI_SYSTEM_PROMPT.includes('@tmctomystudio'));
  assert.ok(MANIFEST_AI_SYSTEM_PROMPT.includes('manifestudio.my.id'));
  assert.ok(MANIFEST_AI_SYSTEM_PROMPT.includes('JANGAN pernah mengarang'));

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
  assert.ok(knowledge.includes('6285122936027'));

  // Local fallback handles casual "P" greeting and Manifestudio identity queries accurately
  const pingReply = buildLocalManifestudioFallback('P', liveCatalog);
  assert.ok(pingReply.includes('Manifest AI'));
  assert.ok(pingReply.includes('Tomy'));

  const brandReply = buildLocalManifestudioFallback('Ada apa aja di manefestudio?', liveCatalog);
  assert.ok(brandReply.includes('Manifestudio'));
  assert.ok(brandReply.includes('Tomy'));
  assert.ok(brandReply.includes('Menu Utilitas'));
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

test('Manifest AI v62 conserves free quota via distinct bucket selection, turn rotation, and shared ZeroGPU cooldown', () => {
  const now = 1_760_000_000_000;
  assert.ok(HF_GRADIO_FREE_SPACES.length >= 4);

  // Turn 0 starts with LLM7 + 1 HF Space (2 distinct quota buckets, NOT 3 simultaneous calls!)
  const plan0 = planEnsembleExecution({
    mode: 'ensemble',
    byokKeys: [],
    puterAvailable: false,
    limitMap: {},
    turnIndex: 0,
    now,
  });
  assert.equal(plan0.primary.length, 2);
  assert.equal(plan0.primary[0].channel, 'free-llm7');
  assert.equal(plan0.primary[1].channel, 'free-hf-gradio');
  assert.notEqual(plan0.primary[0].quotaBucket, plan0.primary[1].quotaBucket);
  assert.notEqual(plan0.primary[0].model, 'gpt-oss:20b', 'Prefers token-efficient chat model over heavy reasoning model');

  // Turn 1 rotates to HF Space first, then LLM7 — spreading load evenly!
  const plan1 = planEnsembleExecution({
    mode: 'ensemble',
    byokKeys: [],
    puterAvailable: false,
    limitMap: {},
    turnIndex: 1,
    now,
  });
  assert.equal(plan1.primary[0].channel, 'free-hf-gradio');
  assert.equal(plan1.primary[1].channel, 'free-llm7');

  // Shared ZeroGPU bucket cooldown skips ALL 5 ZeroGPU spaces cleanly instead of wasting 4 doomed calls
  const cooledZeroGpu = recordProviderCooldown({}, 'free:hf-zerogpu', 300000, 'ZeroGPU quota', now);
  const afterZeroGpu = planEnsembleExecution({
    mode: 'ensemble',
    byokKeys: [],
    puterAvailable: false,
    limitMap: cooledZeroGpu,
    turnIndex: 1,
    now: now + 5000,
  });
  assert.equal(afterZeroGpu.primary.length, 1);
  assert.equal(afterZeroGpu.primary[0].channel, 'free-llm7');
  assert.equal(afterZeroGpu.backups.length, 0);

  // Markdown XSS safety still holds
  const html = renderMarkdownSafe('**Manifestudio** <script>alert(1)</script>');
  assert.ok(html.includes('<strong>Manifestudio</strong>') && !html.includes('<script>'));
  assert.ok(DEFAULT_MANIFESTUDIO_PROFILE.utilities.length === 12);
});
