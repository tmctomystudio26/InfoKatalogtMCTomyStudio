/**
 * Manifest AI — Instant Streaming Multi-Model Engine (v66)
 * - 4 independent keyless CORS streaming networks: LLM7 + Pollinations (45s reset) + OVHcloud (14+ flagship models) + HF Spaces
 * - Silent real-time CORS web research grounding (Wikipedia ID/EN + Wikivoyage + DuckDuckGo) to prevent factual hallucinations
 * - Strict zero-leak owner privacy guard + instant deterministic footer guide for direct owner-contact queries
 * - Real-time SSE token streaming (instant ChatGPT/Gemini feel) across BYOK, Puter & keyless gateways
 * - Live Manifestudio catalog.json grounding (knows Tomy, products & 12 utilities — zero hallucination)
 * - Smart Staggered Hedging: sends ONLY 1 free request first & hedges only if slow/failing
 * - Per-model OVH buckets, 45s Pollinations auto-wait fallback & shared ZeroGPU bucket awareness
 */

import {
  MANIFEST_AI_STORAGE_KEYS,
  buildLocalManifestudioFallback,
  buildOwnerContactPrivacyReply,
  buildResearchSearchQueries,
  buildUnifiedContextMessages,
  detectManifestAiSiteMode,
  formatResearchContextBlock,
  getCooldownRemainingMs,
  getProviderMeta,
  getVoiceProfileById,
  isDirectOwnerContactQuery,
  isRestrictedManifestudioQuery,
  mergeLiveModelCatalog,
  normalizeByokKeys,
  normalizeLimitMap,
  planEnsembleExecution,
  recordProviderCooldown,
  redactSensitiveOwnerData,
  shouldPerformWebResearch,
} from './manifest-ai-logic.js?v=91';

const MODEL_SYNC_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours auto-refresh
const RESEARCH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes live research cache
const RESEARCH_TIMEOUT_MS = 2600; // Crisp upper bound so chat stays fast & snappy
const REQUEST_TIMEOUT_MS = 26000;
const FREE_CONNECT_TIMEOUT_MS = 10500;
const FREE_HEDGE_DELAY_MS = 3400; // Only launch 2nd free provider if 1st fails or stalls >3.4s (saves 3x quota!)
const POLLINATIONS_RESET_MS = 46000; // Pollinations Classic resets every 45s per IP
const POLLINATIONS_AUTO_WAIT_MAX_MS = 22000; // Smoothly wait up to 22s for Pollinations reset instead of throwing limit error
const OVH_PER_MODEL_COOLDOWN_MS = 12 * 60 * 60 * 1000; // OVH anonymous allows 1 call per model — roll cleanly to next model!
const REGISTRY_TIMEOUT_MS = 7000;

const researchCache = new Map(); // normalizedQuery -> { ts, block }

let cachedRegistry = null;
let cachedCatalogData = null;
let catalogLoadPromise = null;
let puterLoadPromise = null;
let freeTurnCounter = 0;

/**
 * Loads live Manifestudio catalog.json once so Manifest AI always knows real products,
 * prices, utilities, and creator Tomy's contact info with zero hallucination.
 */
export async function loadManifestudioCatalogData() {
  if (cachedCatalogData) return cachedCatalogData;
  if (typeof fetch !== 'function') return null;
  if (catalogLoadPromise) return catalogLoadPromise;

  catalogLoadPromise = fetch('./data/catalog.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      if (json && typeof json === 'object') cachedCatalogData = json;
      return cachedCatalogData;
    })
    .catch(() => null);

  return catalogLoadPromise;
}

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
  const validRate = Number(raw?.voiceRate);
  const voiceStyle = ['natural', 'ekspresif', 'tenang'].includes(raw?.voiceStyle) ? raw.voiceStyle : 'natural';
  const resolvedVoice = getVoiceProfileById(String(raw?.voiceId || 'multi-ava'));
  return {
    mode: raw?.mode === 'single' ? 'single' : 'ensemble',
    focusProviderId: String(raw?.focusProviderId || 'gemini'),
    combineByokWithFree: raw?.combineByokWithFree !== false,
    usePuterFreeSdk: raw?.usePuterFreeSdk !== false,
    voiceId: resolvedVoice.id,
    voiceRate: Number.isFinite(validRate) ? Math.max(0.8, Math.min(1.35, validRate)) : 1.0,
    voiceStyle,
    voiceCodeSwitch: raw?.voiceCodeSwitch !== false,
    voiceAutoRead: raw?.voiceAutoRead === true,
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

function stripHtmlTags(raw = '') {
  return String(raw || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRelevantSection(fullText = '', sectionRe = /==\s*(?:Eat|Makan|Kuliner|See|Lihat|Drink|Minum)\s*==/i, maxLen = 650) {
  const txt = String(fullText || '').trim();
  if (!txt) return '';
  const match = txt.match(sectionRe);
  if (match && typeof match.index === 'number') {
    const start = match.index;
    const afterHeading = txt.slice(start + match[0].length);
    const nextSection = afterHeading.search(/\n==\s*[^=]+\s*==/);
    const body = nextSection >= 0 ? afterHeading.slice(0, nextSection) : afterHeading;
    const cleanBody = body.replace(/\s+/g, ' ').trim();
    if (cleanBody.length >= 30) {
      return cleanBody.slice(0, maxLen);
    }
  }
  return txt.replace(/\s+/g, ' ').trim().slice(0, Math.min(360, maxLen));
}

function scoreResearchRelevance(title = '', snippet = '', entityTokens = [], queryTokens = []) {
  const hay = `${title} ${snippet}`.toLowerCase();
  // Filter out noisy Wikipedia citation-maintenance fragments
  if (/pemeliharaan cs1|diarsipkan dari versi aslinya/i.test(snippet) && snippet.length < 180) {
    return -10;
  }
  let score = 0;
  for (const tok of entityTokens) {
    if (tok.length >= 3 && hay.includes(tok)) score += 6;
  }
  for (const tok of queryTokens) {
    if (tok.length >= 3 && hay.includes(tok)) score += 2;
  }
  return score;
}

/**
 * Performs fast, silent, keyless CORS web research across Wikipedia ID/EN, Wikivoyage EN/ID,
 * and DuckDuckGo Instant Answer (~0.5–2.6s max) to ground Manifest AI answers in verified real facts.
 */
export async function fetchLiveWebResearch(prompt = '', { signal = null, timeoutMs = RESEARCH_TIMEOUT_MS } = {}) {
  if (typeof fetch !== 'function') return '';
  const { primaryQuery, entityQuery, isCulinaryOrTravel } = buildResearchSearchQueries(prompt);
  if (!primaryQuery) return '';

  const cacheKey = `${primaryQuery.toLowerCase()}|${entityQuery.toLowerCase()}|${isCulinaryOrTravel ? '1' : '0'}`;
  const cached = researchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RESEARCH_CACHE_TTL_MS) {
    return cached.block;
  }

  const entityTokens = entityQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);
  const queryTokens = primaryQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  const tasks = [
    // 1. Wikipedia Indonesia full-text search snippets (fast & rich for regional Indonesia facts)
    fetchJsonTimeout(
      `https://id.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(primaryQuery)}&srlimit=6&srprop=snippet&format=json&origin=*`,
      {},
      timeoutMs,
      signal
    ).then((r) => ({ kind: 'wiki-id-search', res: r })),

    // 2. Wikipedia Indonesia lead extracts
    fetchJsonTimeout(
      `https://id.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(primaryQuery)}&gsrlimit=4&prop=extracts&exintro=1&explaintext=1&exchars=420&format=json&origin=*`,
      {},
      timeoutMs,
      signal
    ).then((r) => ({ kind: 'wiki-id-extract', res: r })),

    // 3. Wikipedia English extracts (great for global, tech, science, history & travel facts)
    fetchJsonTimeout(
      `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(primaryQuery)}&gsrlimit=3&prop=extracts&exintro=1&explaintext=1&exchars=360&format=json&origin=*`,
      {},
      timeoutMs,
      signal
    ).then((r) => ({ kind: 'wiki-en-extract', res: r })),

    // 4. DuckDuckGo Instant Answer API (native CORS *)
    fetchJsonTimeout(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(primaryQuery)}&format=json&no_html=1&skip_disambig=1`,
      {},
      timeoutMs,
      signal
    ).then((r) => ({ kind: 'ddg', res: r })),
  ];

  // 5 & 6. Wikivoyage EN + ID travel/culinary guides when query references a city, region, food, or tourism
  if (entityQuery && isCulinaryOrTravel) {
    const titleCaseEntity = entityQuery
      .split(/\s+/)
      .map((w) => (w ? `${w[0].toUpperCase()}${w.slice(1)}` : ''))
      .join(' ');
    tasks.push(
      fetchJsonTimeout(
        `https://en.wikivoyage.org/w/api.php?action=query&titles=${encodeURIComponent(titleCaseEntity)}&redirects=1&prop=extracts&explaintext=1&format=json&origin=*`,
        {},
        timeoutMs,
        signal
      ).then((r) => ({ kind: 'wikivoyage-en', res: r })),
      fetchJsonTimeout(
        `https://id.wikivoyage.org/w/api.php?action=query&titles=${encodeURIComponent(titleCaseEntity)}&redirects=1&prop=extracts&explaintext=1&format=json&origin=*`,
        {},
        timeoutMs,
        signal
      ).then((r) => ({ kind: 'wikivoyage-id', res: r }))
    );
  }

  const settled = await Promise.allSettled(tasks);
  if (signal?.aborted) return '';

  const candidates = [];
  const seenKeys = new Set();

  const pushCandidate = (source, title, rawSnippet, bonus = 0) => {
    const snippet = stripHtmlTags(rawSnippet);
    if (snippet.length < 25) return;
    const dedupeKey = `${String(title || '').toLowerCase()}|${snippet.slice(0, 60).toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) return;
    const rel = scoreResearchRelevance(title, snippet, entityTokens, queryTokens) + bonus;
    // Require entity relevance when an explicit place/entity was extracted
    if (entityTokens.length > 0 && rel < 4) return;
    seenKeys.add(dedupeKey);
    candidates.push({ source, title, snippet, score: rel });
  };

  for (const outcome of settled) {
    if (outcome.status !== 'fulfilled') continue;
    const { kind, res } = outcome.value || {};
    if (!res?.ok || !res.json) continue;

    if (kind === 'wikivoyage-en' || kind === 'wikivoyage-id') {
      const pages = Object.values(res.json?.query?.pages || {});
      for (const page of pages) {
        if (!page || page.missing !== undefined || !page.extract) continue;
        const sectionRe = isCulinaryOrTravel
          ? /==\s*(?:Eat|Makan|Kuliner|Drink|Minum)\s*==/i
          : /==\s*(?:See|Lihat|Understand|Pahami)\s*==/i;
        const sec = extractRelevantSection(page.extract, sectionRe, 750);
        if (sec) {
          pushCandidate(
            kind === 'wikivoyage-en' ? 'Wikivoyage EN' : 'Wikivoyage ID',
            page.title || entityQuery,
            sec,
            12
          );
        }
      }
    } else if (kind === 'wiki-id-search') {
      const hits = Array.isArray(res.json?.query?.search) ? res.json.query.search : [];
      for (const hit of hits) {
        pushCandidate('Wikipedia ID', hit.title || '', hit.snippet || '', 4);
      }
    } else if (kind === 'wiki-id-extract' || kind === 'wiki-en-extract') {
      const pages = Object.values(res.json?.query?.pages || {}).sort((a, b) => (a.index || 99) - (b.index || 99));
      for (const page of pages) {
        if (!page?.extract) continue;
        pushCandidate(
          kind === 'wiki-id-extract' ? 'Wikipedia ID' : 'Wikipedia EN',
          page.title || '',
          page.extract,
          kind === 'wiki-id-extract' ? 5 : 2
        );
      }
    } else if (kind === 'ddg') {
      const j = res.json;
      if (j.AbstractText) {
        pushCandidate('DuckDuckGo', j.Heading || primaryQuery, j.AbstractText, 6);
      }
      if (Array.isArray(j.RelatedTopics)) {
        for (const rt of j.RelatedTopics.slice(0, 3)) {
          if (rt && typeof rt.Text === 'string') {
            pushCandidate('DuckDuckGo', j.Heading || primaryQuery, rt.Text, 2);
          }
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const block = formatResearchContextBlock(candidates, 2200);
  if (researchCache.size > 40) {
    const oldestKey = researchCache.keys().next().value;
    researchCache.delete(oldestKey);
  }
  researchCache.set(cacheKey, { ts: Date.now(), block });
  return block;
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

  const [orRes, mdRes, genPollRes, llm7Res, ovhRes] = await Promise.allSettled([
    fetchJsonTimeout('https://openrouter.ai/api/v1/models', {}, REGISTRY_TIMEOUT_MS),
    fetchJsonTimeout('https://models.dev/api.json', {}, REGISTRY_TIMEOUT_MS),
    fetchJsonTimeout('https://gen.pollinations.ai/text/models', {}, REGISTRY_TIMEOUT_MS),
    fetchJsonTimeout('https://api.llm7.io/v1/models', {}, REGISTRY_TIMEOUT_MS),
    fetchJsonTimeout('https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models', {}, REGISTRY_TIMEOUT_MS),
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
  const ovhModels =
    ovhRes.status === 'fulfilled' && ovhRes.value.ok && Array.isArray(ovhRes.value.json?.data)
      ? ovhRes.value.json.data
      : [];

  const merged = mergeLiveModelCatalog({
    openRouterModels,
    modelsDevJson,
    pollinationsModels: genPollinationsModels,
    genPollinationsModels,
    llm7Models,
    ovhModels,
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
  const turns = messages.filter((m) => m.role !== 'system').slice(-6);
  if (turns.length === 0) return '';
  if (turns.length === 1 && turns[0].role === 'user') {
    return turns[0].content;
  }
  const latest = turns[turns.length - 1];
  const prior = turns.slice(0, -1).slice(-4);
  const priorBlock = prior
    .map((t) => {
      const clipped = t.content.length > 260 ? `${t.content.slice(0, 257)}...` : t.content;
      return `${t.role === 'user' ? 'Pengguna' : 'Manifest AI'}: ${clipped}`;
    })
    .join('\n');
  return [
    '[Riwayat singkat topik ini — hanya sebagai referensi]:',
    priorBlock,
    '',
    '[Pesan terbaru pengguna yang WAJIB dijawab langsung sekarang]:',
    latest.content,
  ].join('\n');
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
  // Keep full Manifestudio identity & live catalog grounding intact (never chop at 320 chars!)
  const sysMsg = (messages.find((m) => m.role === 'system')?.content || '').slice(0, 3000);
  const prompt = buildConversationPromptForSingleTurn(messages);

  let dataPayload;
  if (target.gradioPayloadType === 'multimodal-sys') {
    dataPayload = [{ text: prompt, files: [] }, sysMsg || 'Kamu adalah Manifest AI milik Manifestudio by Tomy.', 768];
  } else if (target.gradioPayloadType === 'gemma4-chat') {
    dataPayload = [prompt, null, [], false, 768, 0, sysMsg || 'Kamu adalah Manifest AI milik Manifestudio by Tomy.', 0.55, 0.9, 50, 1.1];
  } else if (target.gradioPayloadType === 'llama2-sys') {
    dataPayload = [prompt, sysMsg || 'Kamu adalah Manifest AI milik Manifestudio by Tomy.', 768, 0.55, 0.9, 50, 1.1];
  } else {
    const combined = sysMsg ? `[Instruksi Sistem:\n${sysMsg}\n]\n\n${prompt}` : prompt;
    dataPayload = [combined, 768, 0.55, 0.9, 50, 1.1];
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
      const errTxt = await r1.text().catch(() => '');
      const err = new Error(errTxt ? `HTTP ${r1.status}: ${errTxt.slice(0, 160)}` : `HTTP ${r1.status}`);
      err.status = r1.status;
      err.retryAfterMs = parseRetryAfterMs(r1.headers, errTxt, r1.status);
      throw err;
    }
    const j1 = await r1.json();
    if (!j1?.event_id) throw new Error('NO_EVENT_ID');

    const r2 = await fetch(`${host}/gradio_api/call/${fn}/${encodeURIComponent(j1.event_id)}`, {
      signal: linked.signal,
    });
    if (!r2.ok || !r2.body) {
      const errTxt = await r2.text().catch(() => '');
      const err = new Error(errTxt ? `HTTP ${r2.status}: ${errTxt.slice(0, 160)}` : `HTTP ${r2.status}`);
      err.status = r2.status;
      err.retryAfterMs = parseRetryAfterMs(r2.headers, errTxt, r2.status);
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

  // Free Gateway B: LLM7 OpenAI-compatible streaming (1 call per turn, token-efficient max_tokens)
  if (target.channel === 'free-llm7') {
    const content = await streamOpenAiCompatible(
      'https://api.llm7.io/v1/chat/completions',
      {
        'Content-Type': 'application/json',
        Authorization: 'Bearer unused',
      },
      { model: target.model || 'gemma-3-27b', messages, max_tokens: 768, temperature: 0.55 },
      { timeoutMs: FREE_CONNECT_TIMEOUT_MS, signal, onDelta }
    );
    return { ...target, content, latencyMs: Date.now() - startedAt };
  }

  // Free Gateway C: Pollinations Classic OpenAI streaming (CORS: *, resets every 45s per IP — never locks out all day!)
  if (target.channel === 'free-pollinations') {
    const content = await streamOpenAiCompatible(
      'https://text.pollinations.ai/openai',
      {
        'Content-Type': 'application/json',
      },
      { model: target.model || 'openai', messages, temperature: 0.55 },
      { timeoutMs: FREE_CONNECT_TIMEOUT_MS + 3500, signal, onDelta }
    );
    return { ...target, content, latencyMs: Date.now() - startedAt };
  }

  // Free Gateway D: OVHcloud AI Endpoints streaming (CORS: *, 14+ distinct flagship models with independent per-model buckets!)
  if (target.channel === 'free-ovh') {
    const content = await streamOpenAiCompatible(
      'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions',
      {
        'Content-Type': 'application/json',
      },
      { model: target.model || 'DeepSeek-V4.1-Flash-1017', messages, max_tokens: 768, temperature: 0.55 },
      { timeoutMs: FREE_CONNECT_TIMEOUT_MS, signal, onDelta }
    );
    return { ...target, content, latencyMs: Date.now() - startedAt };
  }

  // Free Gateway E: Hugging Face Official Gradio SSE Spaces (native CORS, live token streaming)
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
 * Executes a batch of models with Smart Staggered Hedging:
 * - When `staggerMs > 0` (free keyless mode): starts Target #1 ONLY so normal fast replies
 *   consume ONLY 1 quota call (3x quota savings!). Launches Target #2 only if Target #1 fails
 *   OR takes longer than `staggerMs` without emitting its first token.
 * - When `staggerMs === 0` (BYOK multi-key): races targets in parallel for instant TTFT.
 */
async function raceStreamingBatch(targets, messages, { signal, onDelta, onCooldown, staggerMs = 0 }) {
  if (!targets || targets.length === 0) return { winner: null, failures: [] };

  return new Promise((resolve, reject) => {
    const controllers = new Map();
    const hedgeTimers = [];
    const failures = [];
    let winnerId = null;
    let settled = false;
    let launchedCount = 0;
    let completedCount = 0;

    const clearHedgeTimers = () => {
      while (hedgeTimers.length > 0) {
        clearTimeout(hedgeTimers.pop());
      }
    };

    const abortOthers = (keepId) => {
      clearHedgeTimers();
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

    const cleanup = () => {
      clearHedgeTimers();
      if (signal) signal.removeEventListener('abort', onOuterAbort);
    };

    const onOuterAbort = () => {
      abortOthers(null);
      if (!settled) {
        settled = true;
        cleanup();
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

    const launchTarget = (idx) => {
      if (settled || winnerId || idx >= targets.length) return;
      const target = targets[idx];
      if (controllers.has(target.id)) return;

      const localCtrl = new AbortController();
      controllers.set(target.id, localCtrl);
      launchedCount += 1;

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

          if (winnerId === target.id) {
            winnerId = null;
          }

          const status = Number(err?.status) || 0;
          const retryMs = Number(err?.retryAfterMs) || 0;
          const msgStr = String(err?.message || '');
          const isZeroGpuQuota =
            (target.quotaBucket === 'free:hf-zerogpu' && status === 429) ||
            /zerogpu|gpu\s*quota/i.test(msgStr);
          const isLimit = status === 429 || status === 402 || /rate\s*limit|quota|zerogpu|allowance|too many/i.test(msgStr);

          if (isZeroGpuQuota && target.quotaBucket === 'free:hf-zerogpu') {
            // Cool down the shared HF ZeroGPU bucket once instead of wasting consecutive ZeroGPU calls
            onCooldown('free:hf-zerogpu', retryMs || 300000, 'Kuota ZeroGPU sementara penuh');
          } else if (target.channel === 'free-pollinations' && (isLimit || status === 402 || status === 429)) {
            // Pollinations Classic always resets in 45s per IP — keep cooldown crisp at 46s!
            onCooldown('free:pollinations', POLLINATIONS_RESET_MS, 'Jeda 45 dtk Pollinations');
          } else if (target.channel === 'free-ovh' && (isLimit || status === 429)) {
            // Each OVH model has an independent free trial bucket — cool down ONLY this model so the next 13+ models stay ready!
            onCooldown(target.id, OVH_PER_MODEL_COOLDOWN_MS, 'Kuota model OVH terpakai');
          } else if (target.channel === 'free-llm7' && (isLimit || retryMs > 0)) {
            // Keep LLM7 cooldown reasonable (65s–3m) so RPM bursts recover quickly
            onCooldown('free:llm7', Math.min(retryMs || 65000, 180000), 'Limit sementara LLM7');
          } else if (isLimit || retryMs > 0) {
            onCooldown(target.id, retryMs || 45000, 'Limit sementara');
          } else if (status >= 500 || status === 404 || msgStr === 'TIMEOUT') {
            onCooldown(target.id, 25000, 'Gangguan sementara');
          }

          failures.push({ target, isLimit, isZeroGpuQuota, status });
          completedCount += 1;

          // If Target #1 failed early before hedge timer fired, launch next target IMMEDIATELY!
          if (!settled && !winnerId && launchedCount < targets.length) {
            const nextIdx = launchedCount;
            const nextTarget = targets[nextIdx];
            // Skip remaining ZeroGPU spaces in this batch if the shared ZeroGPU bucket just hit quota
            if (isZeroGpuQuota && nextTarget?.quotaBucket === 'free:hf-zerogpu') {
              completedCount += targets.length - launchedCount;
              launchedCount = targets.length;
            } else {
              launchTarget(nextIdx);
              return;
            }
          }

          if (completedCount >= targets.length && !settled) {
            settled = true;
            cleanup();
            resolve({ winner: null, failures });
          }
        });
    };

    if (staggerMs > 0 && targets.length > 1) {
      // Launch ONLY Target #1 at t=0; schedule Target #2 as slow-path hedge
      launchTarget(0);
      for (let i = 1; i < targets.length; i += 1) {
        const timer = setTimeout(() => {
          if (!settled && !winnerId) {
            launchTarget(i);
          }
        }, staggerMs * i);
        hedgeTimers.push(timer);
      }
    } else {
      for (let i = 0; i < targets.length; i += 1) {
        launchTarget(i);
      }
    }
  });
}

/**
 * Sends a prompt through Manifest AI with instant streaming, live Manifestudio catalog grounding,
 * topic-shift isolation, quota-saving staggered hedging, and silent background failover.
 */
export async function sendManifestAiMessage({
  history = [],
  prompt = '',
  mode = 'ensemble',
  focusProviderId = 'gemini',
  byokKeys = [],
  combineByokWithFree = true,
  liveRegistry = null,
  catalogData = null,
  signal = null,
  onDelta = () => {},
  customSystemPrompt = '',
  disableWebResearch = false,
  siteMode = '',
  localFallbackBuilder = null,
} = {}) {
  const effectiveSiteMode = siteMode || detectManifestAiSiteMode();
  const registry = liveRegistry || getCachedModelRegistry();
  const liveCatalog = catalogData || (await loadManifestudioCatalogData());
  let limitMap = loadStoredLimitMap();

  // Direct owner/admin contact or restricted Store/Manifestore probe on Manifestudio:
  // respond deterministically with zero leakage!
  if (
    !customSystemPrompt &&
    (isRestrictedManifestudioQuery(prompt, effectiveSiteMode) || isDirectOwnerContactQuery(prompt))
  ) {
    const safePrivacyReply = redactSensitiveOwnerData(
      buildOwnerContactPrivacyReply(effectiveSiteMode),
      liveCatalog,
      { siteMode: effectiveSiteMode }
    );
    if (onDelta) onDelta(safePrivacyReply);
    return {
      content: safePrivacyReply,
      meta: {
        mode,
        failoverUsed: false,
        providerId: 'manifestudio-privacy-guard',
        model: 'manifestudio-v85',
        latencyMs: 12,
      },
      limitMap,
    };
  }

  // Silent live web research grounding for factual, culinary, travel, local & knowledge queries
  let researchContext = '';
  if (!disableWebResearch && shouldPerformWebResearch(prompt)) {
    try {
      researchContext = await fetchLiveWebResearch(prompt, { signal, timeoutMs: RESEARCH_TIMEOUT_MS });
    } catch {
      researchContext = '';
    }
    if (signal?.aborted) throw new Error('ABORTED');
  }

  const unifiedMessages = buildUnifiedContextMessages(history, prompt, {
    catalogData: liveCatalog,
    researchContext,
    customSystemPrompt,
    siteMode: effectiveSiteMode,
  });

  const turnIndex = freeTurnCounter;
  freeTurnCounter += 1;

  const plan = planEnsembleExecution({
    mode,
    focusProviderId,
    byokKeys,
    combineByokWithFree,
    puterAvailable: isPuterAiReady(),
    liveRegistry: registry,
    limitMap,
    turnIndex,
  });

  const recordCooldown = (targetId, ms, reason) => {
    limitMap = recordProviderCooldown(limitMap, targetId, ms, reason);
    saveStoredLimitMap(limitMap);
  };

  let winner = null;
  let failoverUsed = false;
  const allFailures = [];

  const safeOnDelta = (partial) => {
    if (onDelta) {
      onDelta(redactSensitiveOwnerData(partial, liveCatalog, { siteMode: effectiveSiteMode }));
    }
  };

  // Stagger free primary calls (burns 1 request on normal replies instead of 3x!); race BYOK keys directly
  const isFreeOnlyPrimary = plan.primary.every((t) => t.channel !== 'byok');

  const primaryRes = await raceStreamingBatch(plan.primary, unifiedMessages, {
    signal,
    onDelta: safeOnDelta,
    onCooldown: recordCooldown,
    staggerMs: isFreeOnlyPrimary ? FREE_HEDGE_DELAY_MS : 0,
  });
  winner = primaryRes.winner;
  allFailures.push(...primaryRes.failures);

  // Phase 2: Silent background sequential failover through remaining healthy backups
  if (!winner && plan.backups.length > 0) {
    failoverUsed = true;
    for (const backupTarget of plan.backups) {
      if (signal?.aborted) throw new Error('ABORTED');
      // Skip targets whose own ID or shared bucket just cooled down during Phase 1
      const ownCd = limitMap?.[backupTarget.id]?.resetAt || 0;
      const bucketCd = backupTarget.quotaBucket ? limitMap?.[backupTarget.quotaBucket]?.resetAt || 0 : 0;
      if (ownCd > Date.now() || bucketCd > Date.now()) continue;

      const backupRes = await raceStreamingBatch([backupTarget], unifiedMessages, {
        signal,
        onDelta: safeOnDelta,
        onCooldown: recordCooldown,
        staggerMs: 0,
      });
      winner = backupRes.winner;
      allFailures.push(...backupRes.failures);
      if (winner) break;
    }
  }

  // Phase 2.5: If all other free networks are cooling down, smoothly wait up to 22s for Pollinations'
  // 45-second IP reset (cancellable via Stop) so the user keeps chatting without hitting a red error!
  if (!winner && !signal?.aborted) {
    const pollWaitMs = getCooldownRemainingMs(limitMap, 'free:pollinations', Date.now());
    const alreadyTriedPoll = allFailures.some((f) => f.target?.channel === 'free-pollinations');
    if (pollWaitMs > 0 && pollWaitMs <= POLLINATIONS_AUTO_WAIT_MAX_MS && !alreadyTriedPoll) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (signal) signal.removeEventListener('abort', onAbort);
          resolve();
        }, pollWaitMs + 500);
        const onAbort = () => {
          clearTimeout(timer);
          reject(new Error('ABORTED'));
        };
        if (signal) signal.addEventListener('abort', onAbort, { once: true });
      });
      if (!signal?.aborted) {
        const pollTarget = {
          id: 'free:pollinations',
          quotaBucket: 'free:pollinations',
          channel: 'free-pollinations',
          providerId: 'openai',
          providerName: 'Pollinations AI',
          shortName: 'ChatGPT',
          model: 'openai',
          cooldownMs: 0,
        };
        const pollRes = await raceStreamingBatch([pollTarget], unifiedMessages, {
          signal,
          onDelta: safeOnDelta,
          onCooldown: recordCooldown,
          staggerMs: 0,
        });
        winner = pollRes.winner;
        allFailures.push(...pollRes.failures);
      }
    }
  }

  // Phase 3: Verified zero-token local grounding fallback
  if (!winner) {
    const localReply =
      typeof localFallbackBuilder === 'function'
        ? localFallbackBuilder(prompt, liveCatalog)
        : buildLocalManifestudioFallback(prompt, liveCatalog, { siteMode: effectiveSiteMode });
    if (localReply) {
      const safeLocal = redactSensitiveOwnerData(localReply, liveCatalog, {
        siteMode: effectiveSiteMode,
      });
      if (onDelta) onDelta(safeLocal);
      return {
        content: safeLocal,
        meta: {
          mode,
          failoverUsed: true,
          providerId: 'manifestudio-local',
          model: 'manifestudio-v85',
          latencyMs: 20,
        },
        limitMap,
      };
    }

    const anyLimit = allFailures.some((f) => f.isLimit);
    const errText = anyLimit
      ? 'Layanan AI sedang ramai digunakan. Silakan kirim ulang beberapa saat lagi.'
      : 'Koneksi ke layanan AI sedang sibuk sementara. Silakan coba kirim ulang sebentar lagi.';
    const err = new Error(errText);
    err.limitMap = limitMap;
    throw err;
  }

  if (winner.channel === 'free-pollinations') {
    recordCooldown('free:pollinations', POLLINATIONS_RESET_MS, 'Jeda 45 dtk Pollinations');
  } else if (winner.channel === 'free-ovh') {
    recordCooldown(winner.id, OVH_PER_MODEL_COOLDOWN_MS, 'Kuota model OVH terpakai');
  }

  const sanitizedContent = redactSensitiveOwnerData(winner.content, liveCatalog, {
    siteMode: effectiveSiteMode,
  });

  return {
    content: sanitizedContent,
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
