/**
 * Manifest AI — Instant Streaming Multi-Model Engine (v61)
 * - Real-time SSE token streaming (instant ChatGPT/Gemini feel) across BYOK & keyless gateways
 * - Fastest-first parallel race: first healthy model streams tokens immediately with zero wait stalls
 * - Silent background failover with unified grounded conversation memory
 * - Auto-syncs live flagship models from OpenRouter, Models.dev, Pollinations & LLM7
 */

import {
  MANIFEST_AI_STORAGE_KEYS,
  buildUnifiedContextMessages,
  getProviderMeta,
  mergeLiveModelCatalog,
  normalizeByokKeys,
  normalizeLimitMap,
  planEnsembleExecution,
  recordProviderCooldown,
} from './manifest-ai-logic.js?v=61';

const MODEL_SYNC_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours auto-refresh
const REQUEST_TIMEOUT_MS = 26000;
const FREE_CONNECT_TIMEOUT_MS = 9500;
const REGISTRY_TIMEOUT_MS = 7000;

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

function createLinkedController(externalSignal, timeoutMs) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = timeoutMs > 0
    ? setTimeout(() => {
        timedOut = true;
        ctrl.abort();
      }, timeoutMs)
    : null;

  const onExternalAbort = () => ctrl.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      if (timer) clearTimeout(timer);
      ctrl.abort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: ctrl.signal,
    abort: () => ctrl.abort(),
    wasTimedOut: () => timedOut,
    clearTimer: () => {
      if (timer) clearTimeout(timer);
    },
    cleanup: () => {
      if (timer) clearTimeout(timer);
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
    },
  };
}

async function fetchJsonTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS, externalSignal = null) {
  const linked = createLinkedController(externalSignal, timeoutMs);
  if (externalSignal?.aborted) {
    linked.cleanup();
    throw new Error('ABORTED');
  }
  try {
    const res = await fetch(url, { ...options, signal: linked.signal });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, headers: res.headers, json, text };
  } catch (err) {
    if (externalSignal?.aborted) throw new Error('ABORTED');
    if (linked.wasTimedOut()) throw new Error('TIMEOUT');
    throw err;
  } finally {
    linked.cleanup();
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
  if (/zerogpu|quota/i.test(String(bodyText || ''))) return 300000;
  if (status === 402 || status === 429) return 60000;
  return 0;
}

function extractOpenAiContent(json) {
  const choice = json?.choices?.[0];
  if (!choice) return '';
  const msg = choice.message || choice.delta || {};
  if (typeof msg.content === 'string' && msg.content) return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }
  if (typeof choice.text === 'string') return choice.text;
  return '';
}

function buildConversationPromptForSingleTurn(messages = []) {
  const turns = messages.filter((m) => m.role !== 'system').slice(-8);
  if (turns.length === 1 && turns[0].role === 'user') {
    return turns[0].content;
  }
  return turns
    .map((t) => `${t.role === 'user' ? 'Pengguna' : 'Asisten'}: ${t.content}`)
    .join('\n\n');
}

function extractGradioText(parsed) {
  if (typeof parsed === 'string') return parsed;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === 'string' && item.trim()) return item;
      if (Array.isArray(item) && item.length > 0) {
        const last = item[item.length - 1];
        if (typeof last === 'string' && last.trim()) return last;
        if (Array.isArray(last) && typeof last[1] === 'string' && last[1].trim()) return last[1];
        if (last && typeof last === 'object' && typeof last.content === 'string') return last.content;
      }
      if (item && typeof item === 'object') {
        if (typeof item.text === 'string' && item.text.trim()) return item.text;
        if (typeof item.content === 'string' && item.content.trim()) return item.content;
      }
    }
  }
  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.text === 'string') return parsed.text;
    if (typeof parsed.content === 'string') return parsed.content;
  }
  return '';
}

/**
 * Streams an OpenAI-compatible SSE response (`stream: true`), gracefully falling back
 * to JSON parsing if the upstream returns a non-streamed JSON body.
 */
async function streamOpenAiCompatible(url, headers, bodyObj, { timeoutMs, signal, onDelta }) {
  const linked = createLinkedController(signal, timeoutMs);
  if (signal?.aborted) {
    linked.cleanup();
    throw new Error('ABORTED');
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...bodyObj, stream: true }),
      signal: linked.signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      let json = null;
      try {
        json = txt ? JSON.parse(txt) : null;
      } catch {
        json = null;
      }
      const err = new Error(json?.error?.message || json?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.retryAfterMs = parseRetryAfterMs(res.headers, txt, res.status);
      throw err;
    }

    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (!res.body || contentType.includes('application/json')) {
      const txt = await res.text();
      const json = txt ? JSON.parse(txt) : null;
      const content = extractOpenAiContent(json).trim();
      if (!content) throw new Error('EMPTY');
      if (onDelta) onDelta(content);
      return content;
    }

    // Connected! Clear connect timeout and allow smooth streaming up to total limit
    linked.clearTimer();
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let acc = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          const piece = extractOpenAiContent(parsed);
          if (piece) {
            acc += piece;
            if (onDelta) onDelta(acc);
          }
        } catch {
          // Ignore partial or heartbeat lines
        }
      }
    }

    const finalText = acc.trim();
    if (!finalText) throw new Error('EMPTY');
    return finalText;
  } catch (err) {
    if (signal?.aborted) throw new Error('ABORTED');
    if (linked.wasTimedOut()) throw new Error('TIMEOUT');
    throw err;
  } finally {
    linked.cleanup();
  }
}

/**
 * Streams a native Google Gemini SSE response (`streamGenerateContent?alt=sse`).
 */
async function streamGeminiNative(endpoint, apiKey, model, messages, { timeoutMs, signal, onDelta }) {
  const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  const modelPath = model.startsWith('models/') ? model : `models/${model}`;
  const url = `${endpoint}/${modelPath}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents,
    ...(sysMsg ? { systemInstruction: { parts: [{ text: sysMsg }] } } : {}),
    generationConfig: { temperature: 0.5 },
  };

  const linked = createLinkedController(signal, timeoutMs);
  if (signal?.aborted) {
    linked.cleanup();
    throw new Error('ABORTED');
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: linked.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      let json = null;
      try {
        json = txt ? JSON.parse(txt) : null;
      } catch {
        json = null;
      }
      const err = new Error(json?.error?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.retryAfterMs = parseRetryAfterMs(res.headers, txt, res.status);
      throw err;
    }

    linked.clearTimer();
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let acc = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const parsed = JSON.parse(payload);
          const piece = (parsed?.candidates?.[0]?.content?.parts || [])
            .map((p) => p?.text || '')
            .join('');
          if (piece) {
            acc += piece;
            if (onDelta) onDelta(acc);
          }
        } catch {
          // Ignore malformed keepalive
        }
      }
    }

    const finalText = acc.trim();
    if (!finalText) throw new Error('EMPTY');
    return finalText;
  } catch (err) {
    if (signal?.aborted) throw new Error('ABORTED');
    if (linked.wasTimedOut()) throw new Error('TIMEOUT');
    throw err;
  } finally {
    linked.cleanup();
  }
}

/**
 * Streams a native Anthropic Claude SSE response (`stream: true`).
 */
async function streamAnthropicNative(endpoint, apiKey, model, messages, { timeoutMs, signal, onDelta }) {
  const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
  const anthMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  const url = `${endpoint}/messages`;

  const linked = createLinkedController(signal, timeoutMs);
  if (signal?.aborted) {
    linked.cleanup();
    throw new Error('ABORTED');
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        stream: true,
        ...(sysMsg ? { system: sysMsg } : {}),
        messages: anthMessages,
      }),
      signal: linked.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      let json = null;
      try {
        json = txt ? JSON.parse(txt) : null;
      } catch {
        json = null;
      }
      const err = new Error(json?.error?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.retryAfterMs = parseRetryAfterMs(res.headers, txt, res.status);
      throw err;
    }

    linked.clearTimer();
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let acc = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const parsed = JSON.parse(payload);
          const piece = parsed?.delta?.text || '';
          if (piece) {
            acc += piece;
            if (onDelta) onDelta(acc);
          }
        } catch {
          // Ignore
        }
      }
    }

    const finalText = acc.trim();
    if (!finalText) throw new Error('EMPTY');
    return finalText;
  } catch (err) {
    if (signal?.aborted) throw new Error('ABORTED');
    if (linked.wasTimedOut()) throw new Error('TIMEOUT');
    throw err;
  } finally {
    linked.cleanup();
  }
}

/**
 * Streams from a public CORS-enabled Hugging Face Gradio Space (`/gradio_api/call/<fn>`).
 */
async function streamHfGradioSpace(target, messages, { timeoutMs, signal, onDelta }) {
  const host = String(target.gradioHost || '').replace(/\/+$/, '');
  const fn = target.gradioFn || 'generate';
  const sysMsg = (messages.find((m) => m.role === 'system')?.content || '').slice(0, 750);
  const prompt = buildConversationPromptForSingleTurn(messages);

  let dataPayload;
  if (target.gradioPayloadType === 'multimodal-sys') {
    dataPayload = [{ text: prompt, files: [] }, sysMsg || 'Kamu adalah Manifest AI, asisten berbahasa Indonesia.', 768];
  } else if (target.gradioPayloadType === 'gemma4-chat') {
    dataPayload = [prompt, null, [], false, 768, 280, sysMsg || 'Kamu adalah Manifest AI, asisten berbahasa Indonesia.', 0.6, 0.9, 50, 1.1];
  } else if (target.gradioPayloadType === 'llama2-sys') {
    dataPayload = [prompt, sysMsg || 'Kamu adalah Manifest AI, asisten berbahasa Indonesia.', 768, 0.6, 0.9, 50, 1.1];
  } else {
    const combined = sysMsg ? `[Instruksi: ${sysMsg.slice(0, 320)}]\n\n${prompt}` : prompt;
    dataPayload = [combined, 768, 0.6, 0.9, 50, 1.1];
  }

  const linked = createLinkedController(signal, timeoutMs);
  if (signal?.aborted) {
    linked.cleanup();
    throw new Error('ABORTED');
  }
  try {
    const r1 = await fetch(`${host}/gradio_api/call/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dataPayload }),
      signal: linked.signal,
    });
    if (!r1.ok) {
      const err = new Error(`HTTP ${r1.status}`);
      err.status = r1.status;
      throw err;
    }
    const j1 = await r1.json();
    if (!j1?.event_id) throw new Error('NO_EVENT_ID');

    const r2 = await fetch(`${host}/gradio_api/call/${fn}/${encodeURIComponent(j1.event_id)}`, {
      signal: linked.signal,
    });
    if (!r2.ok || !r2.body) {
      const err = new Error(`HTTP ${r2.status}`);
      err.status = r2.status;
      throw err;
    }

    const reader = r2.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let latestText = '';
    let currentEvent = '';
    let gotFirstToken = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
          continue;
        }
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === 'null') {
          if (currentEvent === 'error') {
            const err = new Error('GRADIO_ERROR');
            err.status = 503;
            throw err;
          }
          continue;
        }
        try {
          const parsed = JSON.parse(payload);
          if (currentEvent === 'error' || parsed?.error) {
            const msg = String(parsed?.error || parsed?.message || 'GRADIO_ERROR');
            const err = new Error(msg);
            err.status = /quota|zerogpu|limit/i.test(msg) ? 429 : 503;
            err.retryAfterMs = parseRetryAfterMs(null, msg, err.status);
            throw err;
          }
          const extracted = extractGradioText(parsed);
          if (extracted) {
            if (!gotFirstToken) {
              gotFirstToken = true;
              linked.clearTimer();
            }
            latestText = extracted;
            if (onDelta) onDelta(latestText);
          }
        } catch (parseErr) {
          if (parseErr?.status) throw parseErr;
        }
      }
    }

    const finalText = latestText.trim();
    if (!finalText) throw new Error('EMPTY');
    return finalText;
  } catch (err) {
    if (signal?.aborted) throw new Error('ABORTED');
    if (linked.wasTimedOut()) throw new Error('TIMEOUT');
    throw err;
  } finally {
    linked.cleanup();
  }
}

/**
 * Executes a single target with live token streaming via `onDelta(fullTextSoFar)`.
 */
export async function executeModelTarget(target, messages = [], { signal = null, onDelta = null } = {}) {
  const startedAt = Date.now();

  if (target.channel === 'byok') {
    const endpoint = String(target.customEndpoint || getProviderMeta(target.providerId).byokEndpoint).replace(/\/+$/, '');
    let content = '';
    if (target.protocol === 'gemini') {
      content = await streamGeminiNative(endpoint, target.apiKey, target.model, messages, {
        timeoutMs: REQUEST_TIMEOUT_MS,
        signal,
        onDelta,
      });
    } else if (target.protocol === 'anthropic') {
      content = await streamAnthropicNative(endpoint, target.apiKey, target.model, messages, {
        timeoutMs: REQUEST_TIMEOUT_MS,
        signal,
        onDelta,
      });
    } else {
      const url = endpoint.endsWith('/chat/completions') ? endpoint : `${endpoint}/chat/completions`;
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.apiKey}`,
      };
      if (target.providerId === 'openrouter') {
        headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://manifestudio.my.id';
        headers['X-Title'] = 'Manifest AI';
      }
      content = await streamOpenAiCompatible(
        url,
        headers,
        { model: target.model, messages, temperature: 0.5 },
        { timeoutMs: REQUEST_TIMEOUT_MS, signal, onDelta }
      );
    }
    return { ...target, content, latencyMs: Date.now() - startedAt };
  }

  // Free Gateway A: Puter.js Client SDK (per-user browser quota, streaming when signed in)
  if (target.channel === 'free-puter') {
    if (!isPuterAiReady()) throw new Error('Puter SDK belum aktif');
    const resp = await new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('ABORTED'));
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
      const timer = setTimeout(() => done(reject, new Error('TIMEOUT')), FREE_CONNECT_TIMEOUT_MS);
      Promise.resolve(window.puter.ai.chat(messages, { model: target.model, stream: true }))
        .then((val) => done(resolve, val))
        .catch((err) => done(reject, err));
    });

    let acc = '';
    if (resp && typeof resp[Symbol.asyncIterator] === 'function') {
      for await (const part of resp) {
        if (signal?.aborted) throw new Error('ABORTED');
        const piece = typeof part === 'string' ? part : String(part?.text || part?.delta?.content || '');
        if (piece) {
          acc += piece;
          if (onDelta) onDelta(acc);
        }
      }
    } else {
      acc =
        typeof resp === 'string'
          ? resp.trim()
          : String(resp?.message?.content || resp?.text || resp?.choices?.[0]?.message?.content || '').trim();
      if (acc && onDelta) onDelta(acc);
    }
    const finalText = acc.trim();
    if (!finalText) throw new Error('EMPTY');
    return { ...target, content: finalText, latencyMs: Date.now() - startedAt };
  }

  // Free Gateway B: LLM7 OpenAI-compatible streaming (1 call per turn, per-user IP quota)
  if (target.channel === 'free-llm7') {
    const content = await streamOpenAiCompatible(
      'https://api.llm7.io/v1/chat/completions',
      {
        'Content-Type': 'application/json',
        Authorization: 'Bearer unused',
      },
      { model: target.model || 'gpt-oss:20b', messages },
      { timeoutMs: FREE_CONNECT_TIMEOUT_MS, signal, onDelta }
    );
    return { ...target, content, latencyMs: Date.now() - startedAt };
  }

  // Free Gateway C: Hugging Face Official Gradio SSE Spaces (native CORS, live token streaming)
  if (target.channel === 'free-hf-gradio') {
    const content = await streamHfGradioSpace(target, messages, {
      timeoutMs: FREE_CONNECT_TIMEOUT_MS,
      signal,
      onDelta,
    });
    return { ...target, content, latencyMs: Date.now() - startedAt };
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
 * Races a batch of models in parallel and immediately streams the FASTEST healthy responder
 * token-by-token (instant ChatGPT/Gemini experience, zero waiting on slower siblings).
 */
async function raceStreamingBatch(targets, messages, { signal, onDelta, onCooldown }) {
  if (!targets || targets.length === 0) return { winner: null, failures: [] };

  return new Promise((resolve, reject) => {
    const controllers = new Map();
    const failures = [];
    let winnerId = null;
    let settled = false;
    let remaining = targets.length;

    const abortOthers = (keepId) => {
      for (const [id, c] of controllers.entries()) {
        if (id !== keepId) {
          try {
            c.abort();
          } catch {
            // Ignore
          }
        }
      }
    };

    const onOuterAbort = () => {
      abortOthers(null);
      if (!settled) {
        settled = true;
        reject(new Error('ABORTED'));
      }
    };

    if (signal) {
      if (signal.aborted) {
        reject(new Error('ABORTED'));
        return;
      }
      signal.addEventListener('abort', onOuterAbort, { once: true });
    }

    const cleanup = () => {
      if (signal) signal.removeEventListener('abort', onOuterAbort);
    };

    for (const target of targets) {
      const localCtrl = new AbortController();
      controllers.set(target.id, localCtrl);

      executeModelTarget(target, messages, {
        signal: localCtrl.signal,
        onDelta: (partialText) => {
          if (settled || !partialText) return;
          if (!winnerId) {
            winnerId = target.id;
            abortOthers(target.id);
          }
          if (winnerId === target.id && onDelta) {
            onDelta(partialText);
          }
        },
      })
        .then((res) => {
          if (settled) return;
          if (!winnerId) {
            winnerId = target.id;
            abortOthers(target.id);
          }
          if (winnerId === target.id) {
            settled = true;
            cleanup();
            resolve({ winner: res, failures });
          }
        })
        .catch((err) => {
          if (signal?.aborted) return;
          if (winnerId && winnerId !== target.id) return;

          // If the claimed winner failed mid-stream, release lock so another sibling can finish if still running
          if (winnerId === target.id) {
            winnerId = null;
          }

          const status = Number(err?.status) || 0;
          const retryMs = Number(err?.retryAfterMs) || 0;
          const msgStr = String(err?.message || '');
          const isLimit = status === 429 || status === 402 || /rate\s*limit|quota|zerogpu|allowance|too many/i.test(msgStr);

          if (isLimit || retryMs > 0) {
            onCooldown(target.id, retryMs || 60000, 'Limit sementara');
          } else if (status >= 500 || status === 404 || msgStr === 'TIMEOUT') {
            onCooldown(target.id, 30000, 'Gangguan sementara');
          }

          failures.push({ target, isLimit, status });
          remaining -= 1;

          if (remaining <= 0 && !settled) {
            settled = true;
            cleanup();
            resolve({ winner: null, failures });
          }
        });
    }
  });
}

/**
 * Sends a prompt through Manifest AI with instant fastest-first streaming and
 * silent background multi-model failover with unified grounded memory.
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
  onDelta = () => {},
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

  const recordCooldown = (targetId, ms, reason) => {
    limitMap = recordProviderCooldown(limitMap, targetId, ms, reason);
    saveStoredLimitMap(limitMap);
  };

  let winner = null;
  let failoverUsed = false;
  const allFailures = [];

  // Phase 1: Race primary targets in parallel — first token streams immediately!
  const primaryRes = await raceStreamingBatch(plan.primary, unifiedMessages, {
    signal,
    onDelta,
    onCooldown: recordCooldown,
  });
  winner = primaryRes.winner;
  allFailures.push(...primaryRes.failures);

  // Phase 2: Silent background failover in parallel pairs if all primary targets failed
  if (!winner && plan.backups.length > 0) {
    failoverUsed = true;
    for (let i = 0; i < plan.backups.length && !winner; i += 2) {
      if (signal?.aborted) throw new Error('ABORTED');
      const batch = plan.backups.slice(i, i + 2);
      const backupRes = await raceStreamingBatch(batch, unifiedMessages, {
        signal,
        onDelta,
        onCooldown: recordCooldown,
      });
      winner = backupRes.winner;
      allFailures.push(...backupRes.failures);
    }
  }

  if (!winner) {
    const anyLimit = allFailures.some((f) => f.isLimit);
    const errText = anyLimit
      ? 'Batas akses gratis sementara sedang penuh di jaringan ini. Coba kirim ulang sebentar lagi, aktifkan Kuota Puter gratis, atau gunakan API Key pribadi Anda.'
      : 'Koneksi ke layanan AI sedang sibuk sementara. Silakan coba kirim ulang sebentar lagi, aktifkan Kuota Puter gratis, atau gunakan API Key pribadi Anda.';
    const err = new Error(errText);
    err.limitMap = limitMap;
    throw err;
  }

  return {
    content: winner.content,
    meta: {
      mode,
      failoverUsed,
      providerId: winner.providerId,
      model: winner.model,
      latencyMs: winner.latencyMs,
    },
    limitMap,
  };
}
