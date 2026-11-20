/**
 * Manifest AI — Runtime Multi-Model Ensemble & Live Registry Engine (v60)
 * Combines free keyless CORS-enabled gateways (Puter.js per-user SDK, Pollinations,
 * LLM7, Siputzx DuckAI) AND unlimited simultaneous user BYOK API keys (Gemini,
 * OpenAI, DeepSeek, Claude, Grok, Meta/Groq, Qwen, Mistral, OpenRouter, Custom).
 * Auto-syncs live flagship models from OpenRouter, Models.dev, Pollinations & LLM7.
 */

import {
  MANIFEST_AI_STORAGE_KEYS,
  buildConversationMemorySummary,
  buildEnsembleSynthesisMessages,
  buildUnifiedContextMessages,
  getProviderMeta,
  mergeLiveModelCatalog,
  normalizeByokKeys,
  normalizeLimitMap,
  planEnsembleExecution,
  recordProviderCooldown,
  synthesizeEnsembleResponses,
} from './manifest-ai-logic.js?v=60';

const MODEL_SYNC_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours auto-refresh
const REQUEST_TIMEOUT_MS = 28000;
const FREE_GATEWAY_TIMEOUT_MS = 12000;
const ENSEMBLE_GRACE_AFTER_FIRST_MS = 4500;
const REGISTRY_TIMEOUT_MS = 7500;

let cachedRegistry = null;
let puterLoadPromise = null;

function safeReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWriteJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadStoredLimitMap() {
  return normalizeLimitMap(safeReadJson(MANIFEST_AI_STORAGE_KEYS.limits, {}));
}

export function saveStoredLimitMap(map) {
  const clean = normalizeLimitMap(map);
  safeWriteJson(MANIFEST_AI_STORAGE_KEYS.limits, clean);
  return clean;
}

export function loadStoredByokKeys() {
  return normalizeByokKeys(safeReadJson(MANIFEST_AI_STORAGE_KEYS.byok, []));
}

export function saveStoredByokKeys(keys) {
  const clean = normalizeByokKeys(keys);
  safeWriteJson(MANIFEST_AI_STORAGE_KEYS.byok, clean);
  return clean;
}

export function loadStoredPrefs() {
  const raw = safeReadJson(MANIFEST_AI_STORAGE_KEYS.prefs, {});
  return {
    mode: raw?.mode === 'single' ? 'single' : 'ensemble',
    focusProviderId: String(raw?.focusProviderId || 'gemini'),
    combineByokWithFree: raw?.combineByokWithFree !== false,
    usePuterFreeSdk: raw?.usePuterFreeSdk !== false,
  };
}

export function saveStoredPrefs(prefs) {
  safeWriteJson(MANIFEST_AI_STORAGE_KEYS.prefs, prefs);
}

async function fetchJsonTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS, externalSignal = null) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onExternalAbort = () => ctrl.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new Error('ABORTED');
    }
    externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, headers: res.headers, json, text };
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

/**
 * Synchronizes real-time latest models across all providers from live CORS-enabled registries
 * (OpenRouter, Models.dev, Pollinations, LLM7) so Manifest AI automatically upgrades to each
 * lab's newest flagship release without manual intervention.
 */
export async function syncLiveModelRegistry({ force = false } = {}) {
  if (!force && cachedRegistry && Date.now() - cachedRegistry.syncedAt < MODEL_SYNC_TTL_MS) {
    return cachedRegistry;
  }

  if (!force) {
    const stored = safeReadJson(MANIFEST_AI_STORAGE_KEYS.models, null);
    if (stored && stored.providers && Date.now() - Number(stored.syncedAt || 0) < MODEL_SYNC_TTL_MS) {
      cachedRegistry = stored;
      return stored;
    }
  }

  const [orRes, mdRes, genPollRes, llm7Res] = await Promise.allSettled([
    fetchJsonTimeout('https://openrouter.ai/api/v1/models', {}, REGISTRY_TIMEOUT_MS),
    fetchJsonTimeout('https://models.dev/api.json', {}, REGISTRY_TIMEOUT_MS),
    fetchJsonTimeout('https://gen.pollinations.ai/text/models', {}, REGISTRY_TIMEOUT_MS),
    fetchJsonTimeout('https://api.llm7.io/v1/models', {}, REGISTRY_TIMEOUT_MS),
  ]);

  const openRouterModels =
    orRes.status === 'fulfilled' && orRes.value.ok && Array.isArray(orRes.value.json?.data)
      ? orRes.value.json.data
      : [];
  const modelsDevJson =
    mdRes.status === 'fulfilled' && mdRes.value.ok && mdRes.value.json && typeof mdRes.value.json === 'object'
      ? mdRes.value.json
      : null;
  const genPollinationsModels =
    genPollRes.status === 'fulfilled' && genPollRes.value.ok && Array.isArray(genPollRes.value.json)
      ? genPollRes.value.json
      : [];
  const llm7Models =
    llm7Res.status === 'fulfilled' && llm7Res.value.ok && Array.isArray(llm7Res.value.json?.data)
      ? llm7Res.value.json.data
      : [];

  const merged = mergeLiveModelCatalog({
    openRouterModels,
    modelsDevJson,
    pollinationsModels: genPollinationsModels,
    genPollinationsModels,
    llm7Models,
    syncedAt: Date.now(),
  });

  cachedRegistry = merged;
  safeWriteJson(MANIFEST_AI_STORAGE_KEYS.models, merged);
  return merged;
}

export function getCachedModelRegistry() {
  if (cachedRegistry) return cachedRegistry;
  const stored = safeReadJson(MANIFEST_AI_STORAGE_KEYS.models, null);
  if (stored && stored.providers) {
    cachedRegistry = stored;
    return stored;
  }
  return mergeLiveModelCatalog();
}

/**
 * Checks whether Puter.js v2 SDK is loaded AND the user has explicitly signed in.
 * Prevents unexpected browser login popups or hanging Promises during free keyless chat.
 */
export function isPuterAiReady() {
  try {
    return Boolean(
      typeof window !== 'undefined' &&
        window.puter?.ai?.chat &&
        typeof window.puter?.auth?.isSignedIn === 'function' &&
        window.puter.auth.isSignedIn() === true
    );
  } catch {
    return false;
  }
}

/**
 * Lazy-loads Puter.js v2 SDK on demand when the user opts into Puter's per-user free tier.
 */
export function ensurePuterSdkLoaded(timeoutMs = 6000) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(false);
  if (window.puter?.ai?.chat) return Promise.resolve(true);
  if (puterLoadPromise) return puterLoadPromise;

  puterLoadPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://js.puter.com/v2/';
    script.async = true;
    const timer = setTimeout(() => resolve(Boolean(window.puter?.ai?.chat)), timeoutMs);
    script.onload = () => {
      clearTimeout(timer);
      resolve(Boolean(window.puter?.ai?.chat));
    };
    script.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return puterLoadPromise;
}

/**
 * Explicitly activates and signs into Puter.js per-user free AI quota ONLY on user click.
 */
export async function signInPuterSdk(timeoutMs = 7000) {
  const loaded = await ensurePuterSdkLoaded(timeoutMs);
  if (!loaded) return false;
  if (isPuterAiReady()) return true;
  if (typeof window.puter?.auth?.signIn === 'function') {
    try {
      await window.puter.auth.signIn();
    } catch {
      return false;
    }
  }
  return isPuterAiReady();
}

function parseRetryAfterMs(headers, bodyText = '', status = 0) {
  const retryHeader = headers?.get?.('retry-after');
  if (retryHeader) {
    const asNum = Number(retryHeader);
    if (Number.isFinite(asNum) && asNum > 0) return Math.min(3600000, asNum * 1000);
  }
  const secMatch = String(bodyText || '').match(/(?:retry\s*(?:after|in)|wait)\s*(\d+)\s*(?:s|sec|seconds?)/i);
  if (secMatch) {
    return Math.min(3600000, Math.max(15000, Number(secMatch[1]) * 1000));
  }
  if (status === 402 || status === 429) return 60000;
  return 0;
}

function extractOpenAiContent(json) {
  const choice = json?.choices?.[0];
  if (!choice) return '';
  const msg = choice.message || choice.delta || {};
  if (typeof msg.content === 'string' && msg.content.trim()) return msg.content.trim();
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('')
      .trim();
  }
  if (typeof choice.text === 'string') return choice.text.trim();
  return '';
}

function buildCompactPromptForGetGateway(messages = []) {
  const sys = messages.find((m) => m.role === 'system')?.content || '';
  const turns = messages.filter((m) => m.role !== 'system').slice(-6);
  const parts = [];
  if (sys) {
    const memIdx = sys.indexOf('Ringkasan Memori');
    if (memIdx >= 0) {
      parts.push(sys.slice(memIdx, memIdx + 500));
    }
  }
  for (const t of turns) {
    parts.push(`${t.role === 'user' ? 'User' : 'Assistant'}: ${t.content}`);
  }
  return parts.join('\n').slice(0, 1800);
}

/**
 * Executes a single target (either a user BYOK key or a free keyless gateway).
 */
export async function executeModelTarget(target, messages = [], { signal = null } = {}) {
  const startedAt = Date.now();

  if (target.channel === 'byok') {
    const endpoint = String(target.customEndpoint || getProviderMeta(target.providerId).byokEndpoint).replace(/\/+$/, '');

    // 1. Google Gemini Native REST API
    if (target.protocol === 'gemini') {
      const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
      const contents = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      const modelPath = target.model.startsWith('models/') ? target.model : `models/${target.model}`;
      const url = `${endpoint}/${modelPath}:generateContent?key=${encodeURIComponent(target.apiKey)}`;
      const body = {
        contents,
        ...(sysMsg ? { systemInstruction: { parts: [{ text: sysMsg }] } } : {}),
        generationConfig: { temperature: 0.5 },
      };
      const res = await fetchJsonTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
        REQUEST_TIMEOUT_MS,
        signal
      );
      if (!res.ok) {
        const errMsg = res.json?.error?.message || `HTTP ${res.status}`;
        const err = new Error(errMsg);
        err.status = res.status;
        err.retryAfterMs = parseRetryAfterMs(res.headers, res.text, res.status);
        throw err;
      }
      const text = (res.json?.candidates?.[0]?.content?.parts || [])
        .map((p) => p?.text || '')
        .join('')
        .trim();
      if (!text) throw new Error('Gemini mengembalikan respons kosong');
      return {
        ...target,
        content: text,
        latencyMs: Date.now() - startedAt,
      };
    }

    // 2. Anthropic Claude Native REST API (browser direct CORS header)
    if (target.protocol === 'anthropic') {
      const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
      const anthMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));
      const url = `${endpoint}/messages`;
      const res = await fetchJsonTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': target.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: target.model,
            max_tokens: 2048,
            ...(sysMsg ? { system: sysMsg } : {}),
            messages: anthMessages,
          }),
        },
        REQUEST_TIMEOUT_MS,
        signal
      );
      if (!res.ok) {
        const errMsg = res.json?.error?.message || `HTTP ${res.status}`;
        const err = new Error(errMsg);
        err.status = res.status;
        err.retryAfterMs = parseRetryAfterMs(res.headers, res.text, res.status);
        throw err;
      }
      const text = (res.json?.content || [])
        .map((b) => (b?.type === 'text' ? b.text : ''))
        .join('')
        .trim();
      if (!text) throw new Error('Claude mengembalikan respons kosong');
      return {
        ...target,
        content: text,
        latencyMs: Date.now() - startedAt,
      };
    }

    // 3. OpenAI-Compatible APIs (OpenAI, DeepSeek, xAI Grok, Groq, OpenRouter, Mistral, Qwen, Custom)
    const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${target.apiKey}`,
    };
    if (target.providerId === 'openrouter') {
      headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://manifestudio.my.id';
      headers['X-Title'] = 'Manifest AI';
    }
    const res = await fetchJsonTimeout(
      url,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: target.model,
          messages,
          temperature: 0.5,
        }),
      },
      REQUEST_TIMEOUT_MS,
      signal
    );
    if (!res.ok) {
      const errMsg = res.json?.error?.message || res.json?.message || `HTTP ${res.status}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.retryAfterMs = parseRetryAfterMs(res.headers, res.text, res.status);
      throw err;
    }
    const text = extractOpenAiContent(res.json);
    if (!text) throw new Error(`${target.providerName} mengembalikan respons kosong`);
    return {
      ...target,
      content: text,
      latencyMs: Date.now() - startedAt,
    };
  }

  // Free Gateway A: Puter.js Client SDK (per-user browser quota, strictly signed-in & timeout-guarded)
  if (target.channel === 'free-puter') {
    if (!isPuterAiReady()) throw new Error('Puter SDK belum aktif');
    const resp = await new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('ABORTED'));
        return;
      }
      let settled = false;
      const done = (fn, val) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
        fn(val);
      };
      const onAbort = () => done(reject, new Error('ABORTED'));
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => done(reject, new Error('Puter AI timeout')), REQUEST_TIMEOUT_MS);
      Promise.resolve(window.puter.ai.chat(messages, { model: target.model }))
        .then((val) => done(resolve, val))
        .catch((err) => done(reject, err));
    });
    const text =
      typeof resp === 'string'
        ? resp.trim()
        : String(resp?.message?.content || resp?.text || resp?.choices?.[0]?.message?.content || '').trim();
    if (!text) throw new Error('Puter AI mengembalikan respons kosong');
    return {
      ...target,
      content: text,
      latencyMs: Date.now() - startedAt,
    };
  }

  // Free Gateway B: Pollinations Text API (CORS: *, keyless browser-safe GET without Turnstile block)
  if (target.channel === 'free-pollinations') {
    const compact = buildCompactPromptForGetGateway(messages);
    const sysRaw = messages.find((m) => m.role === 'system')?.content || '';
    const sysShort = sysRaw.replace(/\s+/g, ' ').trim().slice(0, 420);
    const params = new URLSearchParams({
      model: target.model || 'openai',
      seed: String(Math.floor(Math.random() * 100000)),
    });
    if (sysShort) params.set('system', sysShort);
    const url = `https://text.pollinations.ai/${encodeURIComponent(compact)}?${params.toString()}`;
    const res = await fetchJsonTimeout(url, { method: 'GET' }, FREE_GATEWAY_TIMEOUT_MS, signal);
    if (!res.ok) {
      const errMsg = res.json?.error?.message || (res.text ? res.text.slice(0, 140) : `HTTP ${res.status}`);
      const err = new Error(errMsg);
      err.status = res.status;
      err.retryAfterMs = parseRetryAfterMs(res.headers, res.text, res.status);
      throw err;
    }
    const text = res.json ? extractOpenAiContent(res.json) : String(res.text || '').trim();
    if (!text) throw new Error('Pollinations mengembalikan respons kosong');
    const actualModel = res.headers?.get?.('x-model-used') || target.model;
    return {
      ...target,
      model: actualModel,
      content: text,
      latencyMs: Date.now() - startedAt,
    };
  }

  // Free Gateway C: LLM7 OpenAI-compatible (CORS: *, per-user IP quota via Bearer unused)
  if (target.channel === 'free-llm7') {
    const res = await fetchJsonTimeout(
      'https://api.llm7.io/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer unused',
        },
        body: JSON.stringify({
          model: target.model || 'default',
          messages,
        }),
      },
      FREE_GATEWAY_TIMEOUT_MS,
      signal
    );
    if (!res.ok) {
      const errMsg = res.json?.error?.message || `HTTP ${res.status}`;
      const err = new Error(errMsg);
      err.status = res.status;
      err.retryAfterMs = parseRetryAfterMs(res.headers, res.text, res.status);
      throw err;
    }
    const text = extractOpenAiContent(res.json);
    if (!text) throw new Error('LLM7 mengembalikan respons kosong');
    return {
      ...target,
      content: text,
      latencyMs: Date.now() - startedAt,
    };
  }

  // Free Gateway D: Siputzx DuckAI Multi-Model Gateway (CORS: *, keyless)
  if (target.channel === 'free-duckai') {
    const compact = buildCompactPromptForGetGateway(messages);
    const url = `https://api.siputzx.my.id/api/ai/duckai?message=${encodeURIComponent(compact)}&model=${encodeURIComponent(
      target.model || 'claude-3-5-haiku-latest'
    )}`;
    const res = await fetchJsonTimeout(url, {}, FREE_GATEWAY_TIMEOUT_MS, signal);
    if (!res.ok || res.json?.status === false) {
      const errMsg = res.json?.error || `HTTP ${res.status}`;
      const err = new Error(errMsg);
      err.status = res.status || 503;
      err.retryAfterMs = parseRetryAfterMs(res.headers, res.text, res.status);
      throw err;
    }
    const text = String(res.json?.data || res.json?.result || res.json?.response || '').trim();
    if (!text) throw new Error('DuckAI mengembalikan respons kosong');
    return {
      ...target,
      content: text,
      latencyMs: Date.now() - startedAt,
    };
  }

  throw new Error('Channel AI tidak dikenali');
}

/**
 * Tests a user's BYOK key directly against its official provider endpoint.
 */
export async function testByokKeyConnection(keyEntry, liveRegistry = null) {
  const reg = liveRegistry || getCachedModelRegistry();
  const provider = getProviderMeta(keyEntry.providerId);
  const model =
    keyEntry.model && keyEntry.model !== 'auto'
      ? keyEntry.model
      : reg.providers?.[provider.id]?.latestModel || provider.defaultModel;

  const target = {
    id: `test:${keyEntry.id}`,
    channel: 'byok',
    keyId: keyEntry.id,
    providerId: provider.id,
    providerName: keyEntry.label || provider.name,
    shortName: provider.shortName,
    model,
    apiKey: keyEntry.apiKey,
    customEndpoint: keyEntry.customEndpoint || provider.byokEndpoint,
    protocol: provider.byokProtocol,
  };

  const result = await executeModelTarget(
    target,
    [{ role: 'user', content: 'Balas dengan satu kata: OK' }]
  );
  return {
    ok: true,
    model,
    latencyMs: result.latencyMs,
    reply: result.content.slice(0, 60),
  };
}

/**
 * Sends a prompt through the Manifest AI Multi-Model Ensemble with:
 * - Unified grounded conversation memory shared across every model
 * - Parallel multi-model collaboration (BYOK multi-key and/or free multi-gateway)
 * - Automatic per-user rate-limit cooldown tracking & seamless failover to backup models
 * - Grounded synthesis pass when 2+ models respond so the user gets 1 coherent answer
 */
export async function sendManifestAiMessage({
  history = [],
  prompt = '',
  mode = 'ensemble',
  focusProviderId = 'gemini',
  byokKeys = [],
  combineByokWithFree = true,
  liveRegistry = null,
  signal = null,
  onProgress = () => {},
} = {}) {
  const registry = liveRegistry || getCachedModelRegistry();
  let limitMap = loadStoredLimitMap();
  const unifiedMessages = buildUnifiedContextMessages(history, prompt);

  const plan = planEnsembleExecution({
    mode,
    focusProviderId,
    byokKeys,
    combineByokWithFree,
    puterAvailable: isPuterAiReady(),
    liveRegistry: registry,
    limitMap,
  });

  const failedLog = [];
  const successes = [];
  let failoverUsed = false;

  const runTarget = async (target) => {
    try {
      const res = await executeModelTarget(target, unifiedMessages, { signal });
      return { ok: true, target, result: res };
    } catch (err) {
      if (signal?.aborted || err?.message === 'ABORTED') throw err;
      const status = Number(err?.status) || 0;
      const retryMs = Number(err?.retryAfterMs) || 0;
      const isLimit = status === 429 || status === 402 || /rate\s*limit|quota|allowance|too many/i.test(String(err?.message || ''));
      if (isLimit || retryMs > 0) {
        limitMap = recordProviderCooldown(
          limitMap,
          target.id,
          retryMs || 60000,
          isLimit ? 'Limit sementara tercapai' : err.message
        );
        saveStoredLimitMap(limitMap);
      } else if (status >= 500 || status === 404) {
        limitMap = recordProviderCooldown(limitMap, target.id, 30000, `Server gangguan (${status})`);
        saveStoredLimitMap(limitMap);
      }
      return { ok: false, target, error: String(err?.message || 'Gagal terhubung'), isLimit };
    }
  };

  onProgress({
    stage: 'parallel',
    label:
      plan.primary.length > 1
        ? `Menggabungkan ${plan.primary.length} model AI secara paralel (${plan.primary.map((t) => t.shortName).join(', ')})...`
        : `Menghubungi ${plan.primary[0]?.providerName || 'Manifest AI'}...`,
    targets: plan.primary.map((t) => ({ name: t.shortName, model: t.model })),
  });

  // Run primary targets in parallel, but once at least 1 model succeeds, grant slower
  // siblings a 4.5s grace window so a hanging free node never stalls the user's answer.
  const primaryOutcomes = await new Promise((resolve, reject) => {
    const outcomes = [];
    const total = plan.primary.length;
    if (total === 0) {
      resolve([]);
      return;
    }
    let settledCount = 0;
    let finished = false;
    let graceTimer = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (graceTimer) clearTimeout(graceTimer);
      resolve(outcomes);
    };

    for (const target of plan.primary) {
      runTarget(target)
        .then((out) => {
          if (finished) return;
          outcomes.push(out);
          settledCount += 1;
          if (settledCount >= total) {
            finish();
          } else if (out.ok && !graceTimer) {
            graceTimer = setTimeout(finish, ENSEMBLE_GRACE_AFTER_FIRST_MS);
          }
        })
        .catch((err) => {
          if (finished) return;
          finished = true;
          if (graceTimer) clearTimeout(graceTimer);
          reject(err);
        });
    }
  });

  for (const o of primaryOutcomes) {
    if (o.ok) {
      successes.push(o.result);
    } else {
      failedLog.push({
        providerName: o.target.providerName,
        model: o.target.model,
        error: o.error,
        isLimit: o.isLimit,
      });
    }
  }

  // Seamless Failover: if primary models all failed (or ensemble got < 1 response), step through backups with identical memory!
  if (successes.length === 0 && plan.backups.length > 0) {
    failoverUsed = true;
    for (const backupTarget of plan.backups) {
      if (signal?.aborted) throw new Error('ABORTED');
      onProgress({
        stage: 'failover',
        label: `Mengalihkan otomatis ke ${backupTarget.providerName} sambil menjaga memori percakapan...`,
        targets: [{ name: backupTarget.shortName, model: backupTarget.model }],
      });
      const out = await runTarget(backupTarget);
      if (out.ok) {
        successes.push(out.result);
        break;
      }
      failedLog.push({
        providerName: out.target.providerName,
        model: out.target.model,
        error: out.error,
        isLimit: out.isLimit,
      });
    }
  }

  if (successes.length === 0) {
    const limitReasons = failedLog.filter((f) => f.isLimit);
    const errText =
      limitReasons.length > 0
        ? 'Semua jalur AI gratis/kunci yang aktif sedang mencapai batas sementara (rate limit). Tunggu beberapa detik hingga limit reset otomatis, atau tambahkan API Key pribadi Anda (Gemini, OpenAI, DeepSeek, Grok, OpenRouter, dll.) di menu API Key Saya.'
        : `Belum ada model AI yang berhasil merespons (${failedLog[0]?.error || 'gangguan jaringan'}). Silakan coba kirim ulang atau pasang API Key pribadi Anda.`;
    const err = new Error(errText);
    err.failedLog = failedLog;
    err.limitMap = limitMap;
    throw err;
  }

  // Synthesize when 2+ models responded in parallel!
  let finalText = '';
  let synthesizedBy = '';
  const merged = synthesizeEnsembleResponses(successes);

  if (successes.length >= 2) {
    onProgress({
      stage: 'synthesizing',
      label: `Menyatukan & memverifikasi jawaban dari ${successes.length} model AI...`,
      targets: successes.map((s) => ({ name: s.shortName, model: s.model })),
    });

    // Prefer a BYOK responder as synthesizer so we don't hit free per-IP cooldowns right after primary call
    const synthTarget =
      successes.find((s) => s.channel === 'byok') ||
      successes.find((s) => s.channel === 'free-puter') ||
      null;

    if (synthTarget) {
      try {
        const olderHistory = history.slice(0, Math.max(0, history.length - 8));
        const synthMessages = buildEnsembleSynthesisMessages(
          prompt,
          successes,
          buildConversationMemorySummary(olderHistory, 500)
        );
        const synthRes = await executeModelTarget(synthTarget, synthMessages, { signal });
        if (synthRes?.content && synthRes.content.length >= 20) {
          finalText = synthRes.content;
          synthesizedBy = `${synthTarget.shortName} (${synthTarget.model})`;
        }
      } catch {
        // Gracefully fall back to deterministic highest-quality consensus
      }
    }
  }

  if (!finalText) {
    finalText = merged.finalText;
  }

  return {
    content: finalText,
    meta: {
      mode,
      failoverUsed,
      synthesized: successes.length >= 2,
      synthesizedBy,
      contributors: merged.contributors.map((c) => ({
        providerId: c.providerId,
        providerName: c.providerName,
        shortName: c.shortName,
        model: c.model,
        channel: c.channel,
        latencyMs: c.latencyMs,
        excerpt: c.content.length > 600 ? `${c.content.slice(0, 597)}...` : c.content,
      })),
      failedCount: failedLog.length,
      failedLog,
    },
    limitMap,
  };
}
