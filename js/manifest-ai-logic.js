/**
 * Manifest AI — Pure Logic Module (v60)
 * Multi-model ensemble planning, real-time latest-model catalog auto-upgrader,
 * grounded conversation memory builder (anti-hallucination across model switches),
 * per-user limit/cooldown tracker, multi-BYOK key vault helpers, chat history store,
 * and safe Markdown renderer.
 */

export const MANIFEST_AI_STORAGE_KEYS = Object.freeze({
  chats: 'manifestudio_ai_chats_v1',
  byok: 'manifestudio_ai_byok_v1',
  models: 'manifestudio_ai_models_v1',
  limits: 'manifestudio_ai_limits_v1',
  prefs: 'manifestudio_ai_prefs_v1',
});

export const MANIFEST_AI_SYSTEM_PROMPT = [
  'Kamu adalah Manifest AI, asisten kecerdasan buatan terpadu milik Manifestudio.',
  'Aturan utama:',
  '1. Jawab dalam bahasa yang sama dengan pengguna (utamakan Bahasa Indonesia yang natural, jelas, rapi, dan langsung ke inti bila pengguna berbahasa Indonesia).',
  '2. Jaga konsistensi penuh dengan seluruh riwayat percakapan dan ringkasan memori yang diberikan. Jangan pernah mengarang fakta, angka, tautan, atau kejadian yang tidak ada di riwayat maupun pengetahuan terverifikasi.',
  '3. Jika suatu informasi tidak pasti atau membutuhkan data terbaru di luar konteks, nyatakan dengan jujur secara singkat.',
  '4. Gunakan struktur Markdown yang bersih (daftar, tabel, atau blok kode dengan nama bahasa) hanya bila benar-benar membantu keterbacaan.',
].join('\n');

export const MANIFEST_AI_PROVIDERS = Object.freeze([
  {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    vendor: 'Google',
    color: '#2563eb',
    defaultModel: 'gemini-2.5-pro',
    fastModel: 'gemini-2.5-flash',
    fallbackModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
    byokEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    byokProtocol: 'gemini',
    keyPlaceholder: 'AIzaSy...',
    keyDocsUrl: 'https://aistudio.google.com/apikey',
    openRouterPrefix: 'google/gemini',
    modelsDevKey: 'google',
    puterPreferred: ['gemini-2.5-pro', 'gemini-2.5-flash', 'google/gemini-2.5-flash'],
    freeSupported: true,
    role: 'Analisis mendalam, penalaran multimodal & riset',
  },
  {
    id: 'openai',
    name: 'OpenAI ChatGPT',
    shortName: 'ChatGPT',
    vendor: 'OpenAI',
    color: '#059669',
    defaultModel: 'gpt-5',
    fastModel: 'gpt-4.1-mini',
    fallbackModels: ['gpt-5', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'],
    byokEndpoint: 'https://api.openai.com/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'sk-proj-...',
    keyDocsUrl: 'https://platform.openai.com/api-keys',
    openRouterPrefix: 'openai/gpt',
    modelsDevKey: 'openai',
    puterPreferred: ['gpt-5-nano', 'gpt-4.1-mini', 'gpt-4o-mini'],
    freeSupported: true,
    role: 'Penalaran umum, penulisan presisi & pemrograman',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    vendor: 'DeepSeek',
    color: '#4f46e5',
    defaultModel: 'deepseek-reasoner',
    fastModel: 'deepseek-chat',
    fallbackModels: ['deepseek-reasoner', 'deepseek-chat', 'deepseek/deepseek-r1', 'deepseek/deepseek-chat-v3'],
    byokEndpoint: 'https://api.deepseek.com',
    byokProtocol: 'openai',
    keyPlaceholder: 'sk-...',
    keyDocsUrl: 'https://platform.deepseek.com/api_keys',
    openRouterPrefix: 'deepseek/deepseek',
    modelsDevKey: 'deepseek',
    puterPreferred: ['deepseek-chat', 'deepseek-reasoner'],
    freeSupported: true,
    role: 'Logika matematika, algoritma & struktur kode',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    shortName: 'Claude',
    vendor: 'Anthropic',
    color: '#d97706',
    defaultModel: 'claude-sonnet-4-20250514',
    fastModel: 'claude-3-5-haiku-latest',
    fallbackModels: ['claude-sonnet-4-20250514', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
    byokEndpoint: 'https://api.anthropic.com/v1',
    byokProtocol: 'anthropic',
    keyPlaceholder: 'sk-ant-...',
    keyDocsUrl: 'https://console.anthropic.com/settings/keys',
    openRouterPrefix: 'anthropic/claude',
    modelsDevKey: 'anthropic',
    puterPreferred: ['claude-sonnet-4', 'claude-3-7-sonnet', 'claude-3-5-haiku'],
    freeSupported: true,
    role: 'Nuansa bahasa, penyuntingan & arsitektur software',
  },
  {
    id: 'grok',
    name: 'xAI Grok',
    shortName: 'Grok',
    vendor: 'xAI',
    color: '#0f172a',
    defaultModel: 'grok-3',
    fastModel: 'grok-3-mini',
    fallbackModels: ['grok-4', 'grok-3', 'grok-3-mini', 'grok-2-latest'],
    byokEndpoint: 'https://api.x.ai/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'xai-...',
    keyDocsUrl: 'https://console.x.ai/',
    openRouterPrefix: 'x-ai/grok',
    modelsDevKey: 'xai',
    puterPreferred: ['x-ai/grok-3-mini', 'x-ai/grok-3'],
    freeSupported: true,
    role: 'Sintesis cepat, analisis tren & jawaban lugas',
  },
  {
    id: 'meta',
    name: 'Meta Llama',
    shortName: 'Meta AI',
    vendor: 'Meta',
    color: '#0284c7',
    defaultModel: 'meta-llama/llama-4-maverick',
    fastModel: 'meta-llama/llama-4-scout',
    fallbackModels: ['meta-llama/llama-4-maverick', 'meta-llama/llama-4-scout', 'meta-llama/llama-3.3-70b-instruct'],
    byokEndpoint: 'https://api.groq.com/openai/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'gsk_... (via Groq / Together)',
    keyDocsUrl: 'https://console.groq.com/keys',
    openRouterPrefix: 'meta-llama/llama',
    modelsDevKey: 'groq',
    puterPreferred: ['meta-llama/llama-4-maverick', 'meta-llama/llama-3.3-70b-instruct'],
    freeSupported: true,
    role: 'Open-weight kecepatan tinggi & verifikasi silang',
  },
  {
    id: 'qwen',
    name: 'Alibaba Qwen',
    shortName: 'Qwen',
    vendor: 'Alibaba',
    color: '#7c3aed',
    defaultModel: 'qwen/qwen3-235b-a22b',
    fastModel: 'qwen/qwen3-32b',
    fallbackModels: ['qwen/qwen3-235b-a22b', 'qwen/qwen-2.5-72b-instruct', 'qwen/qwen-2.5-coder-32b-instruct'],
    byokEndpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'sk-...',
    keyDocsUrl: 'https://dashscope.console.aliyun.com/',
    openRouterPrefix: 'qwen/qwen',
    modelsDevKey: 'alibaba',
    puterPreferred: ['qwen/qwen3-32b', 'qwen/qwen-2.5-72b-instruct'],
    freeSupported: true,
    role: 'Multibahasa Asia, pemrograman & ringkasan terstruktur',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    shortName: 'Mistral',
    vendor: 'Mistral',
    color: '#ea580c',
    defaultModel: 'mistral-large-latest',
    fastModel: 'mistral-small-latest',
    fallbackModels: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
    byokEndpoint: 'https://api.mistral.ai/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'Mistral API Key...',
    keyDocsUrl: 'https://console.mistral.ai/api-keys/',
    openRouterPrefix: 'mistralai/mistral',
    modelsDevKey: 'mistral',
    puterPreferred: ['mistral-large-latest', 'mistral-small-latest'],
    freeSupported: true,
    role: 'Efisiensi penulisan & penalaran ringkas',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (Multi-Lab)',
    shortName: 'OpenRouter',
    vendor: 'OpenRouter',
    color: '#0d9488',
    defaultModel: 'google/gemini-2.5-flash',
    fastModel: 'openai/gpt-4o-mini',
    fallbackModels: ['google/gemini-2.5-pro', 'openai/gpt-5', 'anthropic/claude-sonnet-4', 'deepseek/deepseek-r1'],
    byokEndpoint: 'https://openrouter.ai/api/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'sk-or-v1-...',
    keyDocsUrl: 'https://openrouter.ai/keys',
    openRouterPrefix: '',
    modelsDevKey: 'openrouter',
    puterPreferred: [],
    freeSupported: false,
    role: 'Satu kunci untuk semua model flagship lintas penyedia',
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    shortName: 'Groq',
    vendor: 'Groq',
    color: '#e11d48',
    defaultModel: 'llama-3.3-70b-versatile',
    fastModel: 'llama-3.1-8b-instant',
    fallbackModels: ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'qwen-qwq-32b'],
    byokEndpoint: 'https://api.groq.com/openai/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'gsk_...',
    keyDocsUrl: 'https://console.groq.com/keys',
    openRouterPrefix: '',
    modelsDevKey: 'groq',
    puterPreferred: [],
    freeSupported: false,
    role: 'Inferensi ultra-cepat untuk Meta Llama, DeepSeek & Qwen',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    shortName: 'Custom API',
    vendor: 'Custom',
    color: '#475569',
    defaultModel: 'gpt-4o-mini',
    fastModel: 'gpt-4o-mini',
    fallbackModels: ['gpt-4o-mini'],
    byokEndpoint: 'https://api.openai.com/v1',
    byokProtocol: 'openai',
    keyPlaceholder: 'Bearer API Key...',
    keyDocsUrl: '',
    openRouterPrefix: '',
    modelsDevKey: '',
    puterPreferred: [],
    freeSupported: false,
    role: 'Endpoint proxy / self-hosted pribadi kompatibel OpenAI',
  },
]);

export const CORE_COUNCIL_PROVIDER_IDS = Object.freeze([
  'gemini',
  'openai',
  'deepseek',
  'claude',
  'grok',
  'meta',
  'qwen',
  'mistral',
]);

export function getProviderMeta(providerId = '') {
  const id = String(providerId || '').trim().toLowerCase();
  return MANIFEST_AI_PROVIDERS.find((p) => p.id === id) || MANIFEST_AI_PROVIDERS[0];
}

const EXCLUDED_MODEL_SUBSTRINGS = [
  'embed',
  'whisper',
  'tts',
  'dall-e',
  'imagen',
  'veo',
  'audio-preview',
  'realtime',
  'moderation',
  'guard',
  'vision-only',
  'transcribe',
  'speech',
  'sora',
  'flux',
  ':free',
  ':extended',
  ':nitro',
  ':floor',
  'deprecated',
  'computer-use',
  'image-preview',
  'robotics',
  'deep-research',
  '-tts',
];

/**
 * Scores a candidate model ID for a given provider so the real-time auto-upgrader
 * consistently promotes the newest flagship chat/reasoning release over legacy or utility models.
 */
export function scoreModelFreshness(modelId = '', createdTs = 0, providerId = '') {
  const raw = String(modelId || '').trim();
  const lower = raw.toLowerCase();
  if (!lower) return -1e9;

  for (const bad of EXCLUDED_MODEL_SUBSTRINGS) {
    if (lower.includes(bad)) return -1e6;
  }

  let score = 0;

  // Strip calendar date suffixes (e.g. -2024-11-20, -20250514, -05-06, -0528) before parsing versions
  const versionText = lower
    .replace(/[-_](?:20\d{2}[-_]?\d{2}[-_]?\d{2}|(?:0[1-9]|1[0-2])[-_](?:0[1-9]|[12]\d|3[01])|(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?=$|[-_/.:])/g, '')
    .replace(/[-_]20\d{2}(?=$|[-_/.:])/g, '');

  // Extract semantic version pairs like 2.5, 3.7, 4.1, 5.2, 4, 3
  const verMatches = [...versionText.matchAll(/(?:^|[-_/v])(\d+)(?:\.(\d+))?(?=$|[-_/.])/g)];
  let bestVer = 0;
  for (const m of verMatches) {
    const major = Number(m[1] || 0);
    const minor = Number(m[2] || 0);
    if (major >= 1 && major <= 20) {
      const val = major * 100 + minor * 10;
      if (val > bestVer) bestVer = val;
    }
  }
  score += bestVer * 12;

  // Prefer flagship chat/reasoning tiers over nano/tiny/mini for primary slot
  if (/(?:pro|sonnet|opus|reasoner|maverick|large|max|r1|v3)/i.test(lower)) score += 180;
  if (/(?:flash|chat|versatile|scout|medium)/i.test(lower)) score += 90;
  if (/(?:mini|haiku|small|lite|nano|8b|7b|3b|1\.5b)/i.test(lower)) score -= 60;
  if (/(?:preview|beta|exp|experimental)/i.test(lower)) score -= 35;

  // Provider-specific flagship boosts
  if (providerId === 'gemini' && /gemini-\d/.test(lower)) score += 200;
  if (providerId === 'openai' && /(?:^|\/)(?:gpt-5|gpt-4\.1|gpt-4o|o[34])/.test(lower)) score += 200;
  if (providerId === 'claude' && /claude-(?:sonnet-4|opus-4|4|3\.7|3-7|3\.5)/.test(lower)) score += 200;
  if (providerId === 'deepseek' && /deepseek-(?:r1|v3|reasoner|chat)/.test(lower)) score += 200;
  if (providerId === 'grok' && /grok-[345]/.test(lower)) score += 200;
  if (providerId === 'meta' && /llama-[34]/.test(lower)) score += 200;
  if (providerId === 'qwen' && /qwen-?[23]/.test(lower)) score += 200;
  if (providerId === 'mistral' && /mistral-(?:large|medium|small)/.test(lower)) score += 200;

  // Recency tie-breaker from unix timestamp (supports seconds or ms)
  const tsSec = Number(createdTs) > 1e12 ? Math.floor(Number(createdTs) / 1000) : Number(createdTs) || 0;
  if (tsSec > 1650000000) {
    score += Math.min(250, Math.floor((tsSec - 1650000000) / 86400) * 0.25);
  }

  return Math.round(score);
}

/**
 * Strips vendor prefix (e.g. "google/gemini-2.5-pro" -> "gemini-2.5-pro") when preparing
 * a model ID for a direct provider API (Gemini, OpenAI, Anthropic, DeepSeek, Grok, Mistral).
 */
export function normalizeDirectModelId(providerId = '', rawModelId = '') {
  const clean = String(rawModelId || '').trim();
  if (!clean) return '';
  if (providerId === 'openrouter' || providerId === 'meta' || providerId === 'qwen' || providerId === 'custom') {
    return clean;
  }
  const slashIdx = clean.indexOf('/');
  if (slashIdx > 0) {
    return clean.slice(slashIdx + 1);
  }
  return clean;
}

/**
 * Merges real-time model listings from OpenRouter, Models.dev, Pollinations, and LLM7
 * into a unified, auto-upgraded registry so every provider always points to its latest
 * official flagship model without manual code edits.
 */
export function mergeLiveModelCatalog({
  openRouterModels = [],
  modelsDevJson = null,
  pollinationsModels = [],
  genPollinationsModels = [],
  llm7Models = [],
  syncedAt = Date.now(),
} = {}) {
  const providers = {};

  for (const p of MANIFEST_AI_PROVIDERS) {
    const candidates = [];
    const seen = new Set();

    const addCandidate = (id, name = '', created = 0, source = 'fallback') => {
      const cleanId = String(id || '').trim();
      if (!cleanId) return;
      const directId = normalizeDirectModelId(p.id, cleanId);
      const dedupeKey = directId.toLowerCase();
      if (seen.has(dedupeKey)) return;
      const score = scoreModelFreshness(cleanId, created, p.id);
      if (score < -500000) return;
      seen.add(dedupeKey);
      candidates.push({
        id: cleanId,
        directId,
        label: String(name || directId).trim(),
        created: Number(created) || 0,
        source,
        score,
      });
    };

    // 1. OpenRouter live catalog (covers Google, OpenAI, Anthropic, DeepSeek, xAI, Meta, Qwen, Mistral)
    if (Array.isArray(openRouterModels) && p.openRouterPrefix) {
      const prefix = p.openRouterPrefix.toLowerCase();
      for (const m of openRouterModels) {
        const mid = String(m?.id || '').trim();
        if (mid.toLowerCase().startsWith(prefix)) {
          addCandidate(mid, m?.name || mid, m?.created || 0, 'openrouter-live');
        }
      }
    }

    // 2. Models.dev live registry (official direct model IDs per lab)
    if (modelsDevJson && typeof modelsDevJson === 'object' && p.modelsDevKey) {
      const labBlock = modelsDevJson[p.modelsDevKey];
      const labModels = labBlock?.models && typeof labBlock.models === 'object' ? Object.values(labBlock.models) : [];
      for (const m of labModels) {
        const mid = String(m?.id || '').trim();
        if (!mid) continue;
        const lowMid = mid.toLowerCase();
        if (p.id === 'qwen' && !lowMid.includes('qwen')) continue;
        if (p.id === 'gemini' && !lowMid.includes('gemini')) continue;
        if (p.id === 'claude' && !lowMid.includes('claude')) continue;
        if (p.id === 'deepseek' && !lowMid.includes('deepseek')) continue;
        if (p.id === 'grok' && !lowMid.includes('grok')) continue;
        if (p.id === 'mistral' && !lowMid.includes('mistral')) continue;
        const relDate = m?.release_date ? Date.parse(String(m.release_date)) : 0;
        addCandidate(mid, m?.name || mid, Number.isFinite(relDate) ? relDate : 0, 'models-dev-live');
      }
    }

    // 3. Gen Pollinations live catalog (helps verify newest OpenAI/Gemini/Claude/DeepSeek/Grok IDs)
    if (Array.isArray(genPollinationsModels) && p.openRouterPrefix) {
      const vendorPrefix = p.openRouterPrefix.split('/')[0].toLowerCase();
      for (const m of genPollinationsModels) {
        const mid = String(m?.name || '').trim();
        if (mid.toLowerCase().startsWith(`${vendorPrefix}/`) || String(m?.publisher || '').toLowerCase() === p.vendor.toLowerCase()) {
          addCandidate(mid, m?.description || mid, syncedAt, 'pollinations-live');
        }
      }
    }

    // 4. Built-in defaults as guaranteed safe baseline
    for (const fb of p.fallbackModels) {
      addCandidate(fb, fb, 0, 'baseline');
    }

    candidates.sort((a, b) => b.score - a.score);
    const liveCandidates = candidates.filter((c) => c.source !== 'baseline');
    const best = liveCandidates[0] || candidates[0];
    const fast =
      candidates.find((c) => /(?:flash|mini|haiku|scout|small|fast|chat|instant)/i.test(c.directId)) ||
      candidates[1] ||
      best;

    providers[p.id] = {
      providerId: p.id,
      latestModel: best ? best.directId : p.defaultModel,
      latestOpenRouterId: best ? best.id : p.defaultModel,
      fastModel: fast ? fast.directId : p.fastModel,
      availableModels: candidates.slice(0, 12).map((c) => c.directId),
      liveVerified: liveCandidates.length > 0,
      source: best ? best.source : 'baseline',
    };
  }

  // Extract live free gateway models (Pollinations & LLM7) so we NEVER send deprecated 404 model IDs
  const freePollinationsModels = (Array.isArray(pollinationsModels) ? pollinationsModels : [])
    .filter((m) => m && typeof m === 'object' && m.name)
    .map((m) => ({
      id: String(m.name).trim(),
      label: String(m.description || m.name).trim(),
      tier: String(m.tier || 'anonymous'),
      aliases: Array.isArray(m.aliases) ? m.aliases.map(String) : [],
    }));

  const freeLlm7Models = (Array.isArray(llm7Models) ? llm7Models : [])
    .filter((m) => m && typeof m === 'object' && m.id && !m.usage_based_only && (!m.model_type || m.model_type === 'chat'))
    .sort((a, b) => {
      const rank = (t) => (t === 'free' || t === 'turbo' ? 0 : 1);
      return rank(String(a.tier || 'free').toLowerCase()) - rank(String(b.tier || 'free').toLowerCase());
    })
    .map((m) => ({
      id: String(m.id).trim(),
      tier: String(m.tier || 'free'),
    }));

  const syncedSources = [];
  if (Array.isArray(openRouterModels) && openRouterModels.length > 0) syncedSources.push('OpenRouter');
  if (modelsDevJson && typeof modelsDevJson === 'object' && Object.keys(modelsDevJson).length > 0) {
    syncedSources.push('Models.dev');
  }
  if (freePollinationsModels.length > 0 || (Array.isArray(genPollinationsModels) && genPollinationsModels.length > 0)) {
    syncedSources.push('Pollinations');
  }
  if (freeLlm7Models.length > 0) syncedSources.push('LLM7');

  return {
    version: 60,
    syncedAt,
    syncedSources,
    providers,
    freeGateways: {
      pollinations: freePollinationsModels.length > 0 ? freePollinationsModels : [{ id: 'openai-fast', label: 'GPT-OSS Reasoning', tier: 'anonymous', aliases: ['openai'] }],
      llm7: freeLlm7Models.length > 0 ? freeLlm7Models : [{ id: 'default', tier: 'free' }],
    },
  };
}

/**
 * Extracts a compact grounded memory summary from older turns beyond the verbatim window
 * so switching models mid-conversation or combining models NEVER loses prior facts or topic.
 */
export function buildConversationMemorySummary(olderMessages = [], maxChars = 900) {
  if (!Array.isArray(olderMessages) || olderMessages.length === 0) return '';

  const bullets = [];
  for (const msg of olderMessages) {
    if (!msg || typeof msg.content !== 'string') continue;
    const roleLabel = msg.role === 'user' ? 'Pengguna' : 'Manifest AI';
    const cleaned = msg.content
      .replace(/```[\s\S]*?```/g, '[blok kode]')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) continue;
    const clipped = cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned;
    bullets.push(`- ${roleLabel}: ${clipped}`);
  }

  let summary = '';
  for (const line of bullets) {
    if ((summary + '\n' + line).length > maxChars) break;
    summary = summary ? `${summary}\n${line}` : line;
  }
  return summary;
}

/**
 * Builds the unified, anti-hallucination message array sent to EVERY participating model
 * (and any failover model) so every AI shares the exact same conversation history & memory.
 */
export function buildUnifiedContextMessages(
  history = [],
  currentUserPrompt = '',
  {
    maxVerbatimTurns = 12,
    maxTotalChars = 16000,
    customSystemPrompt = '',
  } = {}
) {
  const cleanHistory = (Array.isArray(history) ? history : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }));

  const cutoff = Math.max(0, cleanHistory.length - maxVerbatimTurns);
  const older = cleanHistory.slice(0, cutoff);
  let recent = cleanHistory.slice(cutoff);

  // Respect total character budget by folding excess recent messages into memory summary
  const charCount = (arr) => arr.reduce((sum, m) => sum + m.content.length, 0);
  const foldedOlder = [...older];
  while (recent.length > 2 && charCount(recent) > maxTotalChars) {
    foldedOlder.push(recent.shift());
  }

  const memorySummary = buildConversationMemorySummary(foldedOlder);
  const systemParts = [customSystemPrompt || MANIFEST_AI_SYSTEM_PROMPT];
  if (memorySummary) {
    systemParts.push(
      `Ringkasan Memori Percakapan Sebelumnya (WAJIB dijadikan acuan agar jawaban tetap nyambung dan bebas halusinasi):\n${memorySummary}`
    );
  }

  const messages = [{ role: 'system', content: systemParts.join('\n\n') }, ...recent];

  const promptClean = String(currentUserPrompt || '').trim();
  if (promptClean) {
    const last = messages[messages.length - 1];
    if (!(last && last.role === 'user' && last.content === promptClean)) {
      messages.push({ role: 'user', content: promptClean });
    }
  }

  return messages;
}

/**
 * Per-user cooldown & rate-limit tracker helpers (client-side localStorage state).
 */
export function normalizeLimitMap(raw = {}) {
  if (!raw || typeof raw !== 'object') return {};
  const now = Date.now();
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object') continue;
    const resetAt = Number(v.resetAt) || 0;
    if (resetAt > now) {
      out[k] = {
        resetAt,
        reason: String(v.reason || 'Batas permintaan sementara'),
        hits: Math.max(1, Number(v.hits) || 1),
      };
    }
  }
  return out;
}

export function recordProviderCooldown(limitMap = {}, targetKey = '', cooldownMs = 60000, reason = 'Rate limit sementara', now = Date.now()) {
  const next = normalizeLimitMap(limitMap);
  const key = String(targetKey || '').trim();
  if (!key) return next;
  const prevHits = Number(next[key]?.hits || 0);
  const safeMs = Math.max(5000, Math.min(3600000, Number(cooldownMs) || 60000));
  next[key] = {
    resetAt: now + safeMs,
    reason: String(reason || 'Rate limit sementara'),
    hits: prevHits + 1,
  };
  return next;
}

export function getCooldownRemainingMs(limitMap = {}, targetKey = '', now = Date.now()) {
  const entry = limitMap?.[targetKey];
  if (!entry || !entry.resetAt) return 0;
  return Math.max(0, Number(entry.resetAt) - now);
}

export function formatCooldownShort(ms = 0) {
  const sec = Math.ceil(Math.max(0, Number(ms) || 0) / 1000);
  if (sec <= 0) return 'Siap';
  if (sec < 60) return `${sec} dtk`;
  const min = Math.ceil(sec / 60);
  return `${min} mnt`;
}

/**
 * Multi-BYOK Key Vault normalization & masking (supports multiple simultaneous keys & providers).
 */
export function maskApiKey(rawKey = '') {
  const key = String(rawKey || '').trim();
  if (!key) return '';
  if (key.length <= 8) return `${key.slice(0, 2)}••••`;
  return `${key.slice(0, 6)}••••${key.slice(-4)}`;
}

export function normalizeByokKeys(rawList = []) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  const seenIds = new Set();
  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue;
    const providerId = String(item.providerId || '').trim().toLowerCase();
    const apiKey = String(item.apiKey || '').trim();
    if (!providerId || !apiKey) continue;
    const provider = getProviderMeta(providerId);
    const id = String(item.id || `key_${provider.id}_${out.length + 1}`).trim();
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    out.push({
      id,
      providerId: provider.id,
      label: String(item.label || `${provider.shortName} Pribadi`).trim().slice(0, 48),
      apiKey,
      model: String(item.model || 'auto').trim() || 'auto',
      customEndpoint: String(item.customEndpoint || '').trim(),
      enabled: item.enabled !== false,
      createdAt: Number(item.createdAt) || Date.now(),
      lastStatus: String(item.lastStatus || 'idle'),
    });
  }
  return out;
}

export function upsertByokKey(existing = [], entry = {}) {
  const list = normalizeByokKeys(existing);
  const provider = getProviderMeta(entry.providerId || 'gemini');
  const apiKey = String(entry.apiKey || '').trim();
  if (!apiKey) return list;

  const id = String(entry.id || `key_${provider.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const nextItem = {
    id,
    providerId: provider.id,
    label: String(entry.label || `${provider.shortName} Pribadi`).trim().slice(0, 48),
    apiKey,
    model: String(entry.model || 'auto').trim() || 'auto',
    customEndpoint: String(entry.customEndpoint || '').trim(),
    enabled: entry.enabled !== false,
    createdAt: Number(entry.createdAt) || Date.now(),
    lastStatus: String(entry.lastStatus || 'idle'),
  };

  const idx = list.findIndex((k) => k.id === id);
  if (idx >= 0) {
    list[idx] = nextItem;
  } else {
    list.unshift(nextItem);
  }
  return list;
}

/**
 * Plans the optimal multi-model execution council for a user prompt:
 * - Prioritizes combining multiple models simultaneously (BYOK multi-key AND/OR multi-gateway free ensemble)
 * - Automatically bypasses models/gateways currently in per-user cooldown
 * - Keeps backup failover candidates ready in case any primary model errors or hits a 429/402 limit.
 */
export function planEnsembleExecution({
  mode = 'ensemble',
  focusProviderId = 'gemini',
  byokKeys = [],
  combineByokWithFree = true,
  puterAvailable = false,
  liveRegistry = null,
  limitMap = {},
  now = Date.now(),
} = {}) {
  const activeKeys = normalizeByokKeys(byokKeys).filter((k) => k.enabled);
  const registry = liveRegistry && liveRegistry.providers ? liveRegistry : mergeLiveModelCatalog();

  const resolveModelForProvider = (pid, override = 'auto') => {
    if (override && override !== 'auto') return override;
    return registry.providers?.[pid]?.latestModel || getProviderMeta(pid).defaultModel;
  };

  const byokCandidates = activeKeys.map((k) => {
    const provider = getProviderMeta(k.providerId);
    const modelId = resolveModelForProvider(k.providerId, k.model);
    const limitKey = `byok:${k.id}`;
    return {
      id: limitKey,
      channel: 'byok',
      keyId: k.id,
      providerId: k.providerId,
      providerName: k.label || provider.name,
      shortName: provider.shortName,
      model: modelId,
      apiKey: k.apiKey,
      customEndpoint: k.customEndpoint || provider.byokEndpoint,
      protocol: provider.byokProtocol,
      cooldownMs: getCooldownRemainingMs(limitMap, limitKey, now),
    };
  });

  // Free keyless gateways — each distinct gateway runs at most 1 call per turn to protect user limits
  const rawPollModel = registry.freeGateways?.pollinations?.[0]?.id || 'openai';
  const pollModel = rawPollModel.includes('/') ? 'openai' : rawPollModel;
  const llm7Pool = Array.isArray(registry.freeGateways?.llm7) && registry.freeGateways.llm7.length > 0
    ? registry.freeGateways.llm7
    : [{ id: 'default', tier: 'free' }];
  const llm7Model = llm7Pool.find((m) => /gemma|gpt-oss|deepseek|mistral|codestral|default/i.test(m.id))?.id || llm7Pool[0].id || 'default';
  const llm7SecondModel = llm7Pool.find((m) => m.id !== llm7Model && /gpt-oss|gemma|codestral|mistral|deepseek/i.test(m.id))?.id || '';

  const freeCandidates = [];

  // 1. Puter.js per-user keyless multi-model council (when browser SDK loaded & signed in)
  if (puterAvailable) {
    const puterProviders =
      mode === 'single'
        ? [focusProviderId]
        : ['gemini', 'openai', 'deepseek', 'claude', 'grok', 'meta'];
    for (const pid of puterProviders) {
      const pMeta = getProviderMeta(pid);
      const puterModel = pMeta.puterPreferred?.[0] || resolveModelForProvider(pid, 'auto');
      const limitKey = `free:puter:${pid}`;
      freeCandidates.push({
        id: limitKey,
        channel: 'free-puter',
        providerId: pid,
        providerName: `${pMeta.name} (Gratis)`,
        shortName: pMeta.shortName,
        model: puterModel,
        cooldownMs: getCooldownRemainingMs(limitMap, limitKey, now),
      });
    }
  }

  // 2. LLM7 OpenAI-compatible free gateway (CORS: *, per-user IP quota, genuinely free models)
  freeCandidates.push({
    id: 'free:llm7',
    channel: 'free-llm7',
    providerId: llm7Model.includes('gemma') ? 'gemini' : llm7Model.includes('gpt') ? 'openai' : llm7Model.includes('mistral') || llm7Model.includes('codestral') ? 'mistral' : 'deepseek',
    providerName: `${llm7Model} (LLM7 Gratis)`,
    shortName: llm7Model.includes('gemma') ? 'Gemini/Gemma' : llm7Model.includes('gpt') ? 'ChatGPT/OSS' : llm7Model.includes('mistral') || llm7Model.includes('codestral') ? 'Mistral' : 'DeepSeek',
    model: llm7Model,
    cooldownMs: getCooldownRemainingMs(limitMap, 'free:llm7', now),
  });

  if (llm7SecondModel) {
    freeCandidates.push({
      id: 'free:llm7:alt',
      channel: 'free-llm7',
      providerId: llm7SecondModel.includes('gemma') ? 'gemini' : llm7SecondModel.includes('gpt') ? 'openai' : 'mistral',
      providerName: `${llm7SecondModel} (LLM7 Gratis)`,
      shortName: llm7SecondModel.includes('gemma') ? 'Gemini/Gemma' : llm7SecondModel.includes('gpt') ? 'ChatGPT/OSS' : 'Mistral',
      model: llm7SecondModel,
      cooldownMs: getCooldownRemainingMs(limitMap, 'free:llm7:alt', now),
    });
  }

  // 3. Pollinations free text gateway (CORS: *, zero key, 1 paced call per turn)
  freeCandidates.push({
    id: 'free:pollinations',
    channel: 'free-pollinations',
    providerId: 'openai',
    providerName: 'OpenAI / GPT-OSS (Pollinations Gratis)',
    shortName: 'ChatGPT',
    model: pollModel,
    cooldownMs: getCooldownRemainingMs(limitMap, 'free:pollinations', now),
  });

  // 4. Siputzx DuckAI multi-model gateway (Claude 3.5 Haiku / Llama 4 Scout / GPT-4o-mini)
  const duckModel =
    mode === 'single' && focusProviderId === 'meta'
      ? 'meta-llama/Llama-4-Scout-17B-16E-Instruct'
      : mode === 'single' && focusProviderId === 'mistral'
      ? 'mistralai/Mistral-Small-24B-Instruct-2501'
      : 'claude-3-5-haiku-latest';
  freeCandidates.push({
    id: 'free:duckai',
    channel: 'free-duckai',
    providerId: duckModel.includes('llama') ? 'meta' : duckModel.includes('mistral') ? 'mistral' : 'claude',
    providerName: duckModel.includes('llama')
      ? 'Meta Llama 4 (DuckAI Gratis)'
      : duckModel.includes('mistral')
      ? 'Mistral Small (DuckAI Gratis)'
      : 'Claude 3.5 Haiku (DuckAI Gratis)',
    shortName: duckModel.includes('llama') ? 'Meta AI' : duckModel.includes('mistral') ? 'Mistral' : 'Claude',
    model: duckModel,
    cooldownMs: getCooldownRemainingMs(limitMap, 'free:duckai', now),
  });

  const healthyByok = byokCandidates.filter((c) => c.cooldownMs === 0);
  const healthyFree = freeCandidates.filter((c) => c.cooldownMs === 0);

  let primary = [];
  let backups = [];

  if (mode === 'single') {
    const matchingByok = healthyByok.find((c) => c.providerId === focusProviderId) || healthyByok[0];
    const matchingFree = healthyFree.find((c) => c.providerId === focusProviderId) || healthyFree[0];
    if (matchingByok) {
      primary = [matchingByok];
      backups = [
        ...healthyByok.filter((c) => c.id !== matchingByok.id),
        ...(combineByokWithFree ? healthyFree : []),
      ];
    } else if (matchingFree) {
      primary = [matchingFree];
      backups = healthyFree.filter((c) => c.id !== matchingFree.id);
    } else {
      // Everyone cooling down: pick the shortest remaining cooldown so user isn't hard-blocked
      const allSorted = [...byokCandidates, ...freeCandidates].sort((a, b) => a.cooldownMs - b.cooldownMs);
      primary = allSorted.slice(0, 1);
      backups = allSorted.slice(1);
    }
  } else {
    // Ensemble Mode: combine MULTIPLE models simultaneously!
    if (healthyByok.length >= 2) {
      // User has 2+ active personal API keys -> combine ALL active keys in parallel (up to 4)
      primary = healthyByok.slice(0, 4);
      backups = [
        ...healthyByok.slice(4),
        ...(combineByokWithFree ? healthyFree : []),
      ];
    } else if (healthyByok.length === 1) {
      if (combineByokWithFree && healthyFree.length > 0) {
        // Combine user's personal key WITH free keyless models so they collaborate!
        primary = [healthyByok[0], ...healthyFree.slice(0, 2)];
        backups = healthyFree.slice(2);
      } else {
        primary = [healthyByok[0]];
        backups = healthyFree;
      }
    } else if (healthyFree.length > 0) {
      // 100% Free Multi-Gateway Ensemble (runs up to 3 distinct healthy providers in parallel)
      primary = healthyFree.slice(0, 3);
      backups = healthyFree.slice(3);
    } else {
      const allSorted = [...byokCandidates, ...freeCandidates].sort((a, b) => a.cooldownMs - b.cooldownMs);
      primary = allSorted.slice(0, 2);
      backups = allSorted.slice(2);
    }
  }

  return {
    mode,
    primary,
    backups,
    hasActiveByok: activeKeys.length > 0,
    activeByokCount: activeKeys.length,
    coolingDownCount: [...byokCandidates, ...freeCandidates].filter((c) => c.cooldownMs > 0).length,
  };
}

/**
 * Scores response completeness & structure so ensemble consensus picks the clearest
 * anchor response when deterministic merging is needed (zero hallucination).
 */
export function scoreAssistantResponse(text = '') {
  const clean = String(text || '').trim();
  if (!clean) return -100;
  let score = Math.min(400, clean.length * 0.45);
  if (/```/.test(clean)) score += 45;
  if (/^\s*[-*•\d]+\./m.test(clean)) score += 30;
  if (/\n\n/.test(clean)) score += 20;
  if (/(?:error|rate limit|forbidden|cannot fulfill|i am unable)/i.test(clean.slice(0, 120))) score -= 180;
  return Math.round(score);
}

/**
 * Deterministic multi-model merger used when 2+ models succeed and an LLM synthesis pass
 * is skipped or unavailable. Deduplicates redundant lines and selects the strongest
 * primary answer while preserving unique verified insights from partner models.
 */
export function synthesizeEnsembleResponses(responses = []) {
  const valid = (Array.isArray(responses) ? responses : [])
    .filter((r) => r && typeof r.content === 'string' && r.content.trim().length > 0)
    .map((r) => ({
      ...r,
      content: r.content.trim(),
      qualityScore: scoreAssistantResponse(r.content),
    }))
    .sort((a, b) => b.qualityScore - a.qualityScore);

  if (valid.length === 0) {
    return { finalText: '', contributors: [], synthesized: false };
  }

  if (valid.length === 1) {
    return {
      finalText: valid[0].content,
      contributors: valid,
      synthesized: false,
    };
  }

  const anchor = valid[0];
  return {
    finalText: anchor.content,
    contributors: valid,
    synthesized: true,
  };
}

/**
 * Builds the grounded synthesis prompt sent to the strongest active model when 2+
 * models produce answers in parallel — ensuring one seamless, verified, hallucination-free answer.
 */
export function buildEnsembleSynthesisMessages(userPrompt = '', responses = [], memorySummary = '') {
  const draftBlocks = (Array.isArray(responses) ? responses : [])
    .map(
      (r, idx) =>
        `### Draft ${idx + 1} (${r.providerName || r.providerId} — ${r.model}):\n${String(r.content || '').trim()}`
    )
    .join('\n\n---\n\n');

  return [
    {
      role: 'system',
      content: [
        MANIFEST_AI_SYSTEM_PROMPT,
        'Tugas khusus saat ini: Kamu adalah synthesizer Manifest AI.',
        'Gabungkan beberapa draf jawaban dari beberapa model AI berikut menjadi SATU jawaban akhir yang paling akurat, runtut, lengkap, dan bebas kontradiksi.',
        'Aturan ketat anti-halusinasi:',
        '- Hanya pertahankan fakta yang konsisten atau masuk akal; buang klaim yang saling bertentangan atau meragukan.',
        '- Jangan menyebut "Draft 1", "Draft 2", atau proses internal penggabungan. Tulis langsung sebagai satu jawaban utuh dari Manifest AI.',
        memorySummary ? `Memori Percakapan:\n${memorySummary}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
    {
      role: 'user',
      content: `Pertanyaan pengguna:\n${String(userPrompt || '').trim()}\n\nDraf dari model kolaborasi:\n\n${draftBlocks}\n\nHasilkan satu jawaban terpadu terbaik:`,
    },
  ];
}

/**
 * Chat Thread History Management
 */
export function deriveThreadTitle(firstPrompt = '') {
  const clean = String(firstPrompt || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return 'Percakapan Baru';
  return clean.length > 48 ? `${clean.slice(0, 45).trim()}...` : clean;
}

export function createChatThread(title = 'Percakapan Baru') {
  const now = Date.now();
  return {
    id: `chat_${now}_${Math.random().toString(36).slice(2, 7)}`,
    title: String(title || 'Percakapan Baru').trim() || 'Percakapan Baru',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function normalizeChatThreads(raw = []) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t === 'object' && t.id)
    .map((t) => ({
      id: String(t.id),
      title: String(t.title || 'Percakapan Baru').trim() || 'Percakapan Baru',
      createdAt: Number(t.createdAt) || Date.now(),
      updatedAt: Number(t.updatedAt) || Number(t.createdAt) || Date.now(),
      messages: Array.isArray(t.messages)
        ? t.messages
            .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m) => ({
              id: String(m.id || `msg_${Math.random().toString(36).slice(2, 8)}`),
              role: m.role,
              content: m.content,
              createdAt: Number(m.createdAt) || Date.now(),
              meta: m.meta && typeof m.meta === 'object' ? m.meta : null,
            }))
        : [],
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 40);
}

export function upsertChatThread(threads = [], thread) {
  const list = normalizeChatThreads(threads);
  if (!thread || !thread.id) return list;
  const idx = list.findIndex((t) => t.id === thread.id);
  const updated = { ...thread, updatedAt: Date.now() };
  if (idx >= 0) {
    list[idx] = updated;
  } else {
    list.unshift(updated);
  }
  return list.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 40);
}

export function deleteChatThread(threads = [], threadId = '') {
  return normalizeChatThreads(threads).filter((t) => t.id !== threadId);
}

export function exportThreadMarkdown(thread) {
  if (!thread) return '';
  const lines = [`# ${thread.title || 'Manifest AI Chat'}`, ''];
  for (const m of thread.messages || []) {
    const label = m.role === 'user' ? '## Pengguna' : '## Manifest AI';
    lines.push(label, '', m.content || '', '');
  }
  return lines.join('\n').trim() + '\n';
}

/**
 * Safe, zero-XSS Markdown renderer for assistant replies (fenced code blocks with copy
 * button, inline code, headings, bold/italic, lists, links, and tables).
 */
export function escapeAiHtml(str = '') {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatInlineMarkdown(escapedLine = '') {
  let out = escapedLine;
  // Inline code
  out = out.replace(/`([^`]+)`/g, '<code class="mai-inline-code">$1</code>');
  // Bold + italic
  out = out.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  // Safe https links
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="mai-md-link">$1</a>'
  );
  return out;
}

export function renderMarkdownSafe(markdown = '') {
  const src = String(markdown || '').replace(/\r\n/g, '\n');
  if (!src.trim()) return '';

  // Extract fenced code blocks first so their contents aren't altered by inline formatting
  const codeBlocks = [];
  const tokenized = src.replace(/```([a-zA-Z0-9_+#.-]*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    const safeLang = escapeAiHtml((lang || 'kode').trim() || 'kode');
    const safeCode = escapeAiHtml(code.replace(/\n$/, ''));
    codeBlocks.push(
      `<div class="mai-code-block"><div class="mai-code-head"><span class="mai-code-lang">${safeLang}</span><button type="button" class="mai-code-copy" data-mai-copy-code="${idx}">Salin kode</button></div><pre><code>${safeCode}</code></pre></div>`
    );
    return `\n@@CODE_BLOCK_${idx}@@\n`;
  });

  const lines = tokenized.split('\n');
  const html = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      closeLists();
      continue;
    }

    const codeMatch = trimmed.match(/^@@CODE_BLOCK_(\d+)@@$/);
    if (codeMatch) {
      closeLists();
      html.push(codeBlocks[Number(codeMatch[1])] || '');
      continue;
    }

    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      closeLists();
      const level = Math.min(4, Math.max(2, hMatch[1].length + 1));
      html.push(`<h${level} class="mai-md-h">${formatInlineMarkdown(escapeAiHtml(hMatch[2]))}</h${level}>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul class="mai-md-list">');
        inUl = true;
      }
      html.push(`<li>${formatInlineMarkdown(escapeAiHtml(ulMatch[1]))}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol class="mai-md-list is-ordered">');
        inOl = true;
      }
      html.push(`<li>${formatInlineMarkdown(escapeAiHtml(olMatch[1]))}</li>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      closeLists();
      html.push(`<blockquote class="mai-md-quote">${formatInlineMarkdown(escapeAiHtml(trimmed.slice(2)))}</blockquote>`);
      continue;
    }

    closeLists();
    html.push(`<p class="mai-md-p">${formatInlineMarkdown(escapeAiHtml(trimmed))}</p>`);
  }

  closeLists();
  return html.join('');
}
