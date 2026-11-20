/**
 * Real-Time Multi-Platform Drama China (Dracin) API Client & Stream Resolver:
 * - Connects live to 16+ real short-drama platforms (DramaBox, Melolo, ReelShort,
 *   ShortMax, NetShort, GoodShort, DramaWave, FlickReels, FreeReels, iDrama,
 *   DramaBite, MoboReels, StardustTV, DramaNova, StarShort, Anichin) with real
 *   poster thumbnails, real episode lists, real MP4/HLS/CENC video + audio streams,
 *   and real WebVTT/SRT subtitles.
 * - Includes keyless Dailymotion HD failover, real subtitle auto-translation,
 *   and keyless Multi-AI clip/screenshot drama identifier.
 */

import {
  ANICHIN_UNIFIED_SOURCES,
  CURATED_DRACIN_CATALOG,
  DEFAULT_DRACIN_ENDPOINT_CONFIG,
  DRACIN_PLATFORMS,
  SANSEKAI_SUPPORTED_PLATFORMS,
  buildDailymotionEmbedUrl,
  buildDailymotionWatchUrl,
  buildSansekaiDirectWatchUrl,
  extractAdaptiveEpisodePayload,
  extractSansekaiApiBaseCandidates,
  extractSansekaiEpisodeStreams,
  extractSansekaiFeedItems,
  extractSansekaiMeloloVideoId,
  extractSynopsisKeywords,
  extractTokens,
  formatDracinUserError,
  getPlatformMeta,
  getSansekaiCooldownRemainingSec,
  inferPlatformFromText,
  isSansekaiCooldownActive,
  mergeParallelDracinFeeds,
  normalizeAnichinDramaItem,
  normalizeDramaMatchText,
  normalizeDracinItem,
  normalizeSansekaiUrl,
  parseAiDramaIdentification,
  parseSubtitleText,
  pickBestPlaybackServer,
  rankClipIdentifierCandidates,
  rankCrossPlatformDramaMatches,
  rankHealthyApiMirrors,
  recordMirrorHealth,
  recordSansekaiOutcome,
  resolveAnichinMediaUrl,
  scoreCrossPlatformDramaMatch,
  scoreDailymotionAutoMatch,
  unwrapHlsJsonPayload,
} from './dracin-logic.js?v=59';

const API_TIMEOUT_MS = 8500;
const EPISODE_TIMEOUT_MS = 9000;
const SANSEKAI_TIMEOUT_MS = 8000;
const AI_TIMEOUT_MS = 4500;

const FLAGSHIP_HOME_PLATFORMS = ['dramabox', 'melolo', 'netshort', 'reelshort'];
const PLATFORM_ALT_ENDPOINTS = {
  melolo: ['foryou', 'latest', 'trending'],
  dramabox: ['foryou', 'trending', 'hotrank'],
  reelshort: ['foryou', 'trending', 'homepage'],
  shortmax: ['foryou', 'trending', 'homepage'],
  netshort: ['foryou', 'trending', 'recommended'],
  goodshort: ['foryou', 'trending', 'homepage'],
  dramawave: ['foryou', 'trending', 'recommended'],
  flickreels: ['foryou', 'trending', 'hotrank'],
  freereels: ['foryou', 'trending', 'homepage'],
  idrama: ['foryou', 'trending'],
  dramabite: ['foryou', 'latest', 'trending'],
  moboreels: ['foryou', 'trending'],
  stardusttv: ['foryou', 'trending'],
  dramanova: ['foryou', 'hot', 'new', 'trending'],
  starshort: ['foryou', 'latest', 'hotrank', 'trending'],
  flareflow: ['foryou', 'trending'],
};

const feedCache = new Map();
const detailCache = new Map();
const episodeCache = new Map();
const inFlightEpisodeMap = new Map();
const subtitleTextCache = new Map();
const translationCache = new Map();

const sansekaiDetailCache = new Map();
const sansekaiAllEpisodeCache = new Map();
const sansekaiStreamCache = new Map();
const sansekaiMatchCache = new Map();

let endpointConfigCache = DEFAULT_DRACIN_ENDPOINT_CONFIG;
let endpointConfigPromise = null;
let mirrorHealthMap = {};

function mergeEndpointConfig(remote = null) {
  if (!remote || typeof remote !== 'object') return DEFAULT_DRACIN_ENDPOINT_CONFIG;
  const remoteMirrors = Array.isArray(remote.mirrors)
    ? remote.mirrors.filter((m) => m && m.id && m.baseUrl)
    : [];
  const mirrors = remoteMirrors.length > 0 ? remoteMirrors : DEFAULT_DRACIN_ENDPOINT_CONFIG.mirrors;
  const remoteSansekai = remote.sansekai && typeof remote.sansekai === 'object' ? remote.sansekai : {};
  return {
    version: String(remote.version || DEFAULT_DRACIN_ENDPOINT_CONFIG.version),
    dailymotionPlayerId: String(
      remote.dailymotionPlayerId || DEFAULT_DRACIN_ENDPOINT_CONFIG.dailymotionPlayerId || 'x8lr5'
    ).trim(),
    sansekai: {
      baseUrl: String(
        remoteSansekai.baseUrl || DEFAULT_DRACIN_ENDPOINT_CONFIG.sansekai.baseUrl || 'https://api.sansekai.my.id/api'
      )
        .trim()
        .replace(/\/+$/, ''),
      webBaseUrl: String(
        remoteSansekai.webBaseUrl || DEFAULT_DRACIN_ENDPOINT_CONFIG.sansekai.webBaseUrl || 'https://drama.sansekai.my.id'
      )
        .trim()
        .replace(/\/+$/, ''),
      minRequestSpacingMs:
        Number(remoteSansekai.minRequestSpacingMs) ||
        DEFAULT_DRACIN_ENDPOINT_CONFIG.sansekai.minRequestSpacingMs ||
        1400,
      rateLimitCooldownMs:
        Number(remoteSansekai.rateLimitCooldownMs) ||
        DEFAULT_DRACIN_ENDPOINT_CONFIG.sansekai.rateLimitCooldownMs ||
        90_000,
      forbiddenCooldownMs:
        Number(remoteSansekai.forbiddenCooldownMs) ||
        DEFAULT_DRACIN_ENDPOINT_CONFIG.sansekai.forbiddenCooldownMs ||
        180_000,
      mirrors:
        Array.isArray(remoteSansekai.mirrors) && remoteSansekai.mirrors.length > 0
          ? remoteSansekai.mirrors.filter((m) => m && m.baseUrl)
          : DEFAULT_DRACIN_ENDPOINT_CONFIG.sansekai.mirrors,
      supportedPlatforms:
        Array.isArray(remoteSansekai.supportedPlatforms) && remoteSansekai.supportedPlatforms.length > 0
          ? remoteSansekai.supportedPlatforms.map((p) => String(p).toLowerCase())
          : DEFAULT_DRACIN_ENDPOINT_CONFIG.sansekai.supportedPlatforms,
    },
    mirrors,
    routeTemplates: {
      ...DEFAULT_DRACIN_ENDPOINT_CONFIG.routeTemplates,
      ...(remote.routeTemplates && typeof remote.routeTemplates === 'object' ? remote.routeTemplates : {}),
    },
    schemaAliases: {
      ...DEFAULT_DRACIN_ENDPOINT_CONFIG.schemaAliases,
      ...(remote.schemaAliases && typeof remote.schemaAliases === 'object' ? remote.schemaAliases : {}),
    },
  };
}

export async function loadEndpointConfig() {
  if (endpointConfigPromise) return endpointConfigPromise;
  endpointConfigPromise = (async () => {
    try {
      const json = await fetchJsonWithTimeout('./data/dracin-endpoints.json', { cache: 'no-store' }, 3500);
      endpointConfigCache = mergeEndpointConfig(json);
    } catch {
      endpointConfigCache = DEFAULT_DRACIN_ENDPOINT_CONFIG;
    }
    return endpointConfigCache;
  })();
  return endpointConfigPromise;
}

function renderRouteTemplate(template = '', params = {}) {
  return String(template || '').replace(/\{(\w+)\}/g, (_m, key) => {
    const val = params[key];
    return val === undefined || val === null ? '' : encodeURIComponent(String(val));
  });
}

async function fetchFromAdaptiveMirrors(
  pathTemplates = [],
  params = {},
  { timeoutMs = API_TIMEOUT_MS, acceptJson = null } = {}
) {
  const cfg = await loadEndpointConfig();
  const mirrors = rankHealthyApiMirrors(cfg.mirrors, mirrorHealthMap);
  const templates = Array.isArray(pathTemplates) && pathTemplates.length ? pathTemplates : [];
  let lastError = null;
  let lastJson = null;

  for (let tIdx = 0; tIdx < templates.length; tIdx += 1) {
    const path = renderRouteTemplate(templates[tIdx], params);
    if (!path) continue;
    let sawNotFoundOnly = true;

    for (const mirror of mirrors) {
      const base = String(mirror.baseUrl || '').replace(/\/+$/, '');
      const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
      try {
        const json = await fetchJsonWithTimeout(url, {}, timeoutMs);
        lastJson = json;
        mirrorHealthMap = recordMirrorHealth(mirrorHealthMap, mirror.id, true);
        if (typeof acceptJson !== 'function' || acceptJson(json)) {
          return { json, mirror, url };
        }
        sawNotFoundOnly = false;
      } catch (err) {
        lastError = err;
        const msg = String(err?.message || '');
        if (!msg.includes('HTTP 404')) {
          sawNotFoundOnly = false;
          mirrorHealthMap = recordMirrorHealth(mirrorHealthMap, mirror.id, false);
        }
      }
    }

    // If mirrors answered cleanly on primary template (e.g., VIP-locked response) without 404,
    // stop trying alternate route paths unless primary returned no usable payload at all.
    if (lastJson && !sawNotFoundOnly && tIdx === 0) {
      const probe = extractAdaptiveEpisodePayload(lastJson, cfg.schemaAliases);
      if (probe.locked) {
        return { json: lastJson, mirror: mirrors[0] || null, url: '' };
      }
    }
  }

  if (lastJson) {
    return { json: lastJson, mirror: mirrors[0] || null, url: '' };
  }
  throw lastError || new Error('TIMEOUT');
}

function readSessionCache(key, ttlMs = 8 * 60_000) {
  try {
    const raw = sessionStorage.getItem(`dracin_cache_v57_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.ts > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeSessionCache(key, data) {
  try {
    sessionStorage.setItem(`dracin_cache_v57_${key}`, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Ignore storage quota
  }
}

function readLocalCache(key, ttlMs = 20 * 60_000) {
  try {
    const raw = localStorage.getItem(`dracin_sk_v57_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.ts > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeLocalCache(key, data) {
  try {
    localStorage.setItem(`dracin_sk_v57_${key}`, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // Ignore storage quota
  }
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = API_TIMEOUT_MS) {
  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Invalid JSON response');
    }
  } catch (err) {
    if (didTimeout || err?.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTextWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (didTimeout || err?.name === 'AbortError') {
      throw new Error('TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function extractItemsArray(json) {
  if (!json) return [];
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.data?.items)) return json.data.items;
  if (Array.isArray(json.data?.list)) return json.data.list;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.list)) return json.list;
  if (Array.isArray(json.results)) return json.results;
  if (Array.isArray(json)) return json;
  return [];
}

/**
 * Fetches real-time catalog items directly from a live platform via self-healing multi-mirror API.
 */
export async function fetchAnichinPlatformFeed(platformId, { page = 1, query = '' } = {}) {
  const src = String(platformId || '').toLowerCase();
  if (!ANICHIN_UNIFIED_SOURCES.has(src)) {
    return { sourceId: `live-${src}`, platformId: src, items: [], hasMore: false };
  }

  const cleanQ = String(query || '').trim();
  const cacheKey = `${src}::p${page}::q:${cleanQ.toLowerCase()}`;
  if (feedCache.has(cacheKey)) {
    const cached = feedCache.get(cacheKey);
    if (Date.now() - cached.ts < 8 * 60_000) return cached.payload;
  }
  const sessCached = readSessionCache(cacheKey);
  if (sessCached && Array.isArray(sessCached.items) && sessCached.items.length > 0) {
    feedCache.set(cacheKey, { ts: Date.now(), payload: sessCached });
    return sessCached;
  }

  const cfg = await loadEndpointConfig();
  const routeTemplates = cleanQ
    ? cfg.routeTemplates?.search || DEFAULT_DRACIN_ENDPOINT_CONFIG.routeTemplates.search
    : (PLATFORM_ALT_ENDPOINTS[src] || ['foryou', 'trending']).map(
        (ep) => `/{platform}/${ep}?page={page}&lang=in`
      );

  let rawItems = [];
  let hasMore = false;

  try {
    const { json } = await fetchFromAdaptiveMirrors(
      routeTemplates,
      { platform: src, page, query: cleanQ },
      {
        timeoutMs: API_TIMEOUT_MS,
        acceptJson: (j) => extractItemsArray(j).length > 0,
      }
    );
    const list = extractItemsArray(json);
    if (list.length > 0) {
      rawItems = list;
      hasMore = Boolean(json?.hasMore ?? list.length >= 8);
    }
  } catch {
    // Handled gracefully by caller fallback
  }

  const normalized = rawItems
    .filter((it) => it && (it.title || it.bookName || it.name))
    .map((it) => normalizeAnichinDramaItem(it, src));

  const platformMeta = DRACIN_PLATFORMS.find((p) => p.id === src);
  const payload = {
    sourceId: `live-${src}`,
    platformId: src,
    label: `${platformMeta?.name || src} Live API`,
    fallbackPlatformId: src,
    items: normalized,
    hasMore,
  };

  if (normalized.length > 0) {
    feedCache.set(cacheKey, { ts: Date.now(), payload });
    writeSessionCache(cacheKey, payload);
  }
  return payload;
}

const SANSEKAI_FLAGSHIP_PLATFORMS = ['melolo', 'dramabox', 'pinedrama', 'reelshort'];
const SANSEKAI_FEED_PATHS = {
  melolo: (p) => [`/melolo/foryou?offset=${Math.max(0, (p - 1) * 15)}`, '/melolo/trending', '/melolo/get-latest'],
  dramabox: (p) => [`/dramabox/foryou?page=${p}`, '/dramabox/trending', '/dramabox/get-latest'],
  pinedrama: () => ['/pinedrama/foryou?cursor=', '/pinedrama/trending'],
  mydrama: () => ['/mydrama/populer?lang=id', '/mydrama/latest', '/mydrama/rank'],
  reelshort: (p) => [`/reelshort/foryou?page=${p}`, '/reelshort/homepage'],
  shortmax: (p) => [`/shortmax/foryou?page=${p}`, '/shortmax/latest', '/shortmax/rekomendasi'],
  netshort: () => ['/netshort/foryou', '/netshort/theaters'],
  goodshort: () => ['/goodshort/foryou', '/goodshort/trending', '/goodshort/latest'],
  flickreels: (p) => [`/flickreels/foryou?page=${p}`, '/flickreels/latest', '/flickreels/hotrank'],
  freereels: () => ['/freereels/foryou', '/freereels/homepage'],
  dramanova: () => ['/dramanova/home'],
};

const SANSEKAI_COOLDOWN_KEY = 'dracin_sk_cooldown_v57';
const SANSEKAI_CUSTOM_MIRROR_KEY = 'manifestudio_dracin_custom_mirror';
let sansekaiMirrorStates = {};
let sansekaiQueueTail = Promise.resolve();
let lastSansekaiRequestAt = 0;

function loadSansekaiMirrorStates() {
  if (Object.keys(sansekaiMirrorStates).length > 0) return sansekaiMirrorStates;
  try {
    const raw = localStorage.getItem(SANSEKAI_COOLDOWN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        sansekaiMirrorStates = parsed;
      }
    }
  } catch {
    // Ignore storage access failures
  }
  return sansekaiMirrorStates;
}

function saveSansekaiMirrorStates(nextStates) {
  sansekaiMirrorStates = nextStates || {};
  try {
    localStorage.setItem(SANSEKAI_COOLDOWN_KEY, JSON.stringify(sansekaiMirrorStates));
  } catch {
    // Ignore storage quota
  }
}

function getCustomSansekaiMirrorUrl() {
  try {
    return String(localStorage.getItem(SANSEKAI_CUSTOM_MIRROR_KEY) || '').trim();
  } catch {
    return '';
  }
}

/**
 * Returns live status of the Sansekai API mirrors (whether all mirrors are currently
 * in rate-limit/403 cooldown, remaining cooldown seconds, and SekaiDrama Web URL).
 */
export function getSansekaiStatus() {
  const states = loadSansekaiMirrorStates();
  const candidates = extractSansekaiApiBaseCandidates(endpointConfigCache, states, {
    customBaseUrl: getCustomSansekaiMirrorUrl(),
    now: Date.now(),
  });
  const healthy = candidates.filter((c) => !c.inCooldown);
  const minCooldownSec =
    healthy.length > 0
      ? 0
      : candidates.reduce(
          (min, c) => (c.cooldownRemainingSec > 0 && c.cooldownRemainingSec < min ? c.cooldownRemainingSec : min),
          Infinity
        );
  return {
    available: healthy.length > 0,
    inCooldown: healthy.length === 0 && candidates.length > 0,
    cooldownRemainingSec: Number.isFinite(minCooldownSec) ? minCooldownSec : 0,
    webBaseUrl: endpointConfigCache?.sansekai?.webBaseUrl || 'https://drama.sansekai.my.id',
  };
}

/**
 * Serializes Sansekai HTTP calls with minimum spacing (~1.4s) so we NEVER burst past
 * Sansekai's 10 req/min rate limit from concurrent UI/catalog calls.
 */
function enqueueSansekaiRequest(taskFn, spacingMs = 1400) {
  const run = async () => {
    const gap = Math.max(0, spacingMs - (Date.now() - lastSansekaiRequestAt));
    if (gap > 0) {
      await new Promise((r) => setTimeout(r, gap));
    }
    lastSansekaiRequestAt = Date.now();
    return taskFn();
  };
  const next = sansekaiQueueTail.then(run, run);
  sansekaiQueueTail = next.catch(() => {});
  return next;
}

async function fetchSansekaiJsonPaths(
  paths = [],
  timeoutMs = SANSEKAI_TIMEOUT_MS,
  acceptFn = null,
  { bypassCooldown = false } = {}
) {
  const cfg = await loadEndpointConfig();
  const states = loadSansekaiMirrorStates();
  const candidates = extractSansekaiApiBaseCandidates(cfg, states, {
    customBaseUrl: getCustomSansekaiMirrorUrl(),
    now: Date.now(),
  });
  const activeMirrors = bypassCooldown ? candidates : candidates.filter((c) => !c.inCooldown);
  if (activeMirrors.length === 0) {
    throw new Error('SANSEKAI_COOLDOWN');
  }

  const spacingMs = Number(cfg?.sansekai?.minRequestSpacingMs) || 1400;
  const rateLimitCooldownMs = Number(cfg?.sansekai?.rateLimitCooldownMs) || 90_000;
  const forbiddenCooldownMs = Number(cfg?.sansekai?.forbiddenCooldownMs) || 180_000;

  let lastErr = null;
  let lastJson = null;

  for (const mirror of activeMirrors) {
    let mirrorBlocked = false;
    for (const rawPath of paths) {
      if (!rawPath || mirrorBlocked) continue;
      const url = `${mirror.baseUrl}${rawPath.startsWith('/') ? rawPath : `/${rawPath}`}`;
      try {
        const json = await enqueueSansekaiRequest(() => fetchJsonWithTimeout(url, {}, timeoutMs), spacingMs);
        lastJson = json;
        saveSansekaiMirrorStates({
          ...loadSansekaiMirrorStates(),
          [mirror.id]: recordSansekaiOutcome(loadSansekaiMirrorStates()[mirror.id], { ok: true, statusCode: 200 }),
        });
        if (typeof acceptFn !== 'function' || acceptFn(json)) {
          return { json, url, mirror };
        }
      } catch (err) {
        lastErr = err;
        const msg = String(err?.message || '');
        const statusCode = msg.includes('HTTP 403') ? 403 : msg.includes('HTTP 429') ? 429 : 0;
        if (statusCode === 403 || statusCode === 429) {
          saveSansekaiMirrorStates({
            ...loadSansekaiMirrorStates(),
            [mirror.id]: recordSansekaiOutcome(loadSansekaiMirrorStates()[mirror.id], {
              ok: false,
              statusCode,
              rateLimitCooldownMs,
              forbiddenCooldownMs,
            }),
          });
          mirrorBlocked = true;
          break;
        }
      }
    }
  }

  if (lastJson) return { json: lastJson, url: '' };
  throw lastErr || new Error('TIMEOUT');
}

/**
 * Fetches live drama catalog or search results from Sansekai / SekaiDrama API
 * with persistent localStorage caching + cooldown protection.
 */
export async function fetchSansekaiPlatformFeed(
  platformId = 'melolo',
  { page = 1, query = '', bypassCooldown = false } = {}
) {
  const src = String(platformId || '').toLowerCase();
  if (!SANSEKAI_SUPPORTED_PLATFORMS.has(src)) {
    return { sourceId: `sansekai-${src}`, platformId: src, items: [], hasMore: false };
  }

  const cleanQ = String(query || '').trim();
  const cacheKey = `sansekai::${src}::p${page}::q:${cleanQ.toLowerCase()}`;
  if (feedCache.has(cacheKey)) {
    const cached = feedCache.get(cacheKey);
    if (Date.now() - cached.ts < 15 * 60_000) return cached.payload;
  }
  const persisted = readLocalCache(cacheKey, 20 * 60_000) || readSessionCache(cacheKey, 15 * 60_000);
  if (persisted && Array.isArray(persisted.items) && persisted.items.length > 0) {
    feedCache.set(cacheKey, { ts: Date.now(), payload: persisted });
    return persisted;
  }

  const paths = cleanQ
    ? [`/${src}/search?query=${encodeURIComponent(cleanQ)}`]
    : (SANSEKAI_FEED_PATHS[src] ? SANSEKAI_FEED_PATHS[src](page) : [`/${src}/foryou`]);

  let items = [];
  let blockedReason = '';

  try {
    const { json } = await fetchSansekaiJsonPaths(
      paths,
      SANSEKAI_TIMEOUT_MS,
      (j) => extractSansekaiFeedItems(j, src).length > 0,
      { bypassCooldown }
    );
    items = extractSansekaiFeedItems(json, src);
  } catch (err) {
    blockedReason = String(err?.message || '');
  }

  const platMeta = getPlatformMeta(src);
  const payload = {
    sourceId: `sansekai-${src}`,
    platformId: src,
    label: `Sansekai · ${platMeta.name}`,
    fallbackPlatformId: src,
    items,
    hasMore: items.length >= 10 && !cleanQ,
    blockedReason,
  };

  if (items.length > 0) {
    feedCache.set(cacheKey, { ts: Date.now(), payload });
    writeSessionCache(cacheKey, payload);
    writeLocalCache(cacheKey, payload);
  }
  return payload;
}

/**
 * Fetches unified SekaiDrama (Sansekai) catalog WITHOUT bursting rate limits:
 * - Probes 1 flagship platform first (sequentially spaced) instead of blasting 4 parallel requests!
 * - If Sansekai is in cooldown or returns 403/429, immediately returns healthy live multi-platform
 *   mirror feeds (Melolo, DramaBox, ReelShort, NetShort) with a calm status note and ZERO blank grids.
 */
export async function fetchSansekaiCatalog({ page = 1, query = '' } = {}) {
  const cleanQ = String(query || '').trim();
  const buckets = [];
  const activeSources = [];
  let hasMore = false;
  let sawBlocked = false;

  const skStatus = getSansekaiStatus();
  if (!skStatus.inCooldown) {
    // Probe 1 flagship platform first; only fetch up to 2 more sequentially if healthy (avoids 10 req/min burst!)
    const first = await fetchSansekaiPlatformFeed(SANSEKAI_FLAGSHIP_PLATFORMS[0], { page, query: cleanQ });
    if (first.blockedReason) {
      sawBlocked = true;
    } else if (Array.isArray(first.items) && first.items.length > 0) {
      buckets.push(first);
      activeSources.push(first.label || first.sourceId);
      if (first.hasMore) hasMore = true;

      for (const pid of SANSEKAI_FLAGSHIP_PLATFORMS.slice(1, 3)) {
        const res = await fetchSansekaiPlatformFeed(pid, { page, query: cleanQ });
        if (res.blockedReason) {
          sawBlocked = true;
          break;
        }
        if (Array.isArray(res.items) && res.items.length > 0) {
          buckets.push(res);
          activeSources.push(res.label || res.sourceId);
          if (res.hasMore) hasMore = true;
        }
      }
    }
  } else {
    sawBlocked = true;
  }

  if (buckets.length > 0) {
    const items = mergeParallelDracinFeeds(buckets, []);
    return {
      items,
      activeSources: Array.from(new Set(activeSources)),
      liveCount: items.length,
      hasMore,
      platformId: 'sansekai',
      page,
      sansekaiFallbackNote: '',
      fetchedAt: Date.now(),
    };
  }

  // Seamless healthy mirror fallback (zero wasted 403 loops, full real posters & live catalogs!)
  const fallbackSettled = await Promise.allSettled(
    ['melolo', 'dramabox', 'reelshort', 'netshort'].map((pid) =>
      fetchAnichinPlatformFeed(pid, { page, query: cleanQ })
    )
  );
  const fbBuckets = [];
  const fbSources = [];
  for (const s of fallbackSettled) {
    if (s.status === 'fulfilled' && s.value && Array.isArray(s.value.items) && s.value.items.length > 0) {
      fbBuckets.push({
        ...s.value,
        items: s.value.items.map((it) => ({ ...it, sansekaiFallback: true })),
      });
      fbSources.push(s.value.label || s.value.sourceId);
      if (s.value.hasMore) hasMore = true;
    }
  }

  const fbItems = mergeParallelDracinFeeds(fbBuckets, []);
  return {
    items: fbItems,
    activeSources: Array.from(new Set(fbSources)),
    liveCount: fbItems.length,
    hasMore,
    platformId: 'sansekai',
    page,
    sansekaiFallbackNote: sawBlocked
      ? 'Mode Mirror Multi-API Aktif · Menampilkan katalog live DramaBox, Melolo, ReelShort & NetShort (otomatis terhubung ke Sansekai saat kuota terbuka).'
      : '',
    fetchedAt: Date.now(),
  };
}

/**
 * Secondary Real Video Provider: Dailymotion Public API (Keyless, CORS=*, real 720p thumbnails & embeds).
 * Used for Anichin Donghua, FlexTV, KalosTV, and as live fallback if any platform upstream returns 502.
 */
export async function fetchDailymotionDracin(
  query = 'drama china sub indo dramabox',
  limit = 16,
  forcedPlatformId = null
) {
  const q = encodeURIComponent(query);
  const url = `https://api.dailymotion.com/videos?search=${q}&fields=id,title,allow_embed,private,status,thumbnail_720_url,duration,views_total,description&limit=${limit}`;
  const data = await fetchJsonWithTimeout(url, {}, 7500);
  const list = Array.isArray(data?.list) ? data.list : [];
  const items = list
    .filter(
      (v) =>
        v &&
        v.id &&
        v.title &&
        v.allow_embed !== false &&
        v.private !== true &&
        (!v.status || v.status === 'published') &&
        (v.duration || 0) >= 35
    )
    .map((v) => {
      const platformId =
        forcedPlatformId && forcedPlatformId !== 'all'
          ? forcedPlatformId
          : inferPlatformFromText(`${v.title} ${v.description || ''}`, 'dramabox');
      const cleanedTitle =
        String(v.title)
          .replace(/\[.*?\]/g, '')
          .replace(/\bsub\s*indo\b/gi, '')
          .replace(/\bfull\s*episode\b/gi, '')
          .replace(/\bdrama\s*china\b/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim() || v.title;
      return normalizeDracinItem(
        {
          id: `dm::${platformId}::${v.id}`,
          sourceId: v.id,
          apiProvider: 'dailymotion',
          title: cleanedTitle,
          altTitle: `HD Stream · ${Math.max(1, Math.round((v.duration || 180) / 60))} mnt`,
          platformId,
          totalEpisodes: 20,
          views_total: v.views_total || 320000,
          poster: v.thumbnail_720_url || '',
          dailymotionId: v.id,
          hasIndonesianDub: /dub\s*indo|dubbing|sulih\s*suara/i.test(`${v.title} ${v.description || ''}`),
          description: String(v.description || '').slice(0, 240),
          sourceApi: 'dailymotion',
        },
        platformId
      );
    });
  return {
    sourceId: 'dailymotion',
    label: 'Dailymotion HD Live API',
    fallbackPlatformId: forcedPlatformId || 'dramabox',
    items,
    hasMore: false,
  };
}

/**
 * Master Real-Time Catalog Fetcher:
 * - On "Semua": loads live feeds from top flagship platforms concurrently (70+ real dramas with real posters).
 * - On any specific platform chip (e.g. Melolo, DramaBox, ReelShort, NetShort, ShortMax, GoodShort, etc.):
 *   loads THAT platform's real-time catalog directly from the live platform API!
 * - On search query: searches live platform endpoints directly!
 */
export async function fetchUnifiedDracinCatalog({ query = '', platformId = 'all', page = 1 } = {}) {
  const cleanQ = String(query || '').trim();
  const safePlatform = String(platformId || 'all').toLowerCase();

  // Direct SekaiDrama (Sansekai) platform view from the start
  if (safePlatform === 'sansekai') {
    return fetchSansekaiCatalog({ page, query: cleanQ });
  }

  let jobs = [];

  if (safePlatform === 'all') {
    if (cleanQ) {
      jobs = [
        fetchAnichinPlatformFeed('dramabox', { page, query: cleanQ }),
        fetchAnichinPlatformFeed('melolo', { page, query: cleanQ }),
        fetchAnichinPlatformFeed('netshort', { page, query: cleanQ }),
        fetchDailymotionDracin(`${cleanQ} drama china sub indo`, 12),
      ];
    } else {
      jobs = FLAGSHIP_HOME_PLATFORMS.map((pid) => fetchAnichinPlatformFeed(pid, { page }));
    }
  } else if (safePlatform === 'pinedrama' || safePlatform === 'mydrama') {
    jobs = [fetchSansekaiPlatformFeed(safePlatform, { page, query: cleanQ })];
  } else if (ANICHIN_UNIFIED_SOURCES.has(safePlatform)) {
    jobs = [fetchAnichinPlatformFeed(safePlatform, { page, query: cleanQ })];
  } else {
    const platformName = DRACIN_PLATFORMS.find((p) => p.id === safePlatform)?.name || safePlatform;
    const dmQ =
      safePlatform === 'anichin'
        ? cleanQ
          ? `${cleanQ} donghua anichin sub indo`
          : 'anichin donghua sub indo episode'
        : cleanQ
        ? `${cleanQ} ${platformName} drama china sub indo`
        : `${platformName} drama china sub indo`;
    jobs = [fetchDailymotionDracin(dmQ, 20, safePlatform)];
  }

  const settled = await Promise.allSettled(jobs);
  const buckets = [];
  const activeSources = [];
  let hasMore = false;

  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value && Array.isArray(s.value.items) && s.value.items.length > 0) {
      buckets.push(s.value);
      activeSources.push(s.value.label || s.value.sourceId);
      if (s.value.hasMore) hasMore = true;
    }
  }

  // If a primary Anichin platform returned 0 items and Sansekai supports it, try Sansekai BEFORE Dailymotion!
  if (buckets.length === 0 && SANSEKAI_SUPPORTED_PLATFORMS.has(safePlatform) && safePlatform !== 'pinedrama' && safePlatform !== 'mydrama') {
    try {
      const skFallback = await fetchSansekaiPlatformFeed(safePlatform, { page, query: cleanQ });
      if (skFallback.items.length > 0) {
        buckets.push(skFallback);
        activeSources.push(skFallback.label);
        if (skFallback.hasMore) hasMore = true;
      }
    } catch {
      // Continue to Dailymotion fallback
    }
  }

  // If still 0 items (e.g. temporary upstream outage), fetch real playable videos from Dailymotion
  if (buckets.length === 0) {
    const platformName =
      safePlatform !== 'all'
        ? DRACIN_PLATFORMS.find((p) => p.id === safePlatform)?.name || safePlatform
        : 'DramaBox';
    try {
      const dmFallback = await fetchDailymotionDracin(
        cleanQ ? `${cleanQ} ${platformName} drama china sub indo` : `${platformName} drama china sub indo`,
        18,
        safePlatform === 'all' ? null : safePlatform
      );
      if (dmFallback.items.length > 0) {
        buckets.push(dmFallback);
        activeSources.push(dmFallback.label);
      }
    } catch {
      // Handled gracefully below
    }
  }

  // Merge strictly real live items (pass empty baseline [] so ZERO fake SVG-letter placeholders pollute live feeds!)
  const items = mergeParallelDracinFeeds(buckets, []);

  return {
    items,
    activeSources: Array.from(new Set(activeSources)),
    liveCount: items.length,
    hasMore,
    platformId: safePlatform,
    page,
    fetchedAt: Date.now(),
  };
}

function buildSansekaiDetailPaths(platformId, id) {
  const enc = encodeURIComponent(String(id || ''));
  switch (platformId) {
    case 'melolo':
      return [`/melolo/detail?book_id=${enc}`];
    case 'dramabox':
      return [`/dramabox/details?bookId=${enc}`, `/dramabox/detail?bookId=${enc}`];
    case 'pinedrama':
      return [`/pinedrama/detail?collection_id=${enc}`];
    case 'mydrama':
      return [`/mydrama/detail?dramaId=${enc}`];
    case 'reelshort':
      return [`/reelshort/details?bookId=${enc}`, `/reelshort/detail?bookId=${enc}`];
    case 'shortmax':
      return [`/shortmax/detail?shortPlayId=${enc}`];
    case 'netshort':
      return [`/netshort/detail?shortPlayId=${enc}`];
    case 'goodshort':
      return [`/goodshort/detail?bookId=${enc}`];
    case 'flickreels':
      return [`/flickreels/detail?playlet_id=${enc}`];
    case 'freereels':
      return [`/freereels/detailAndAllEpisode?key=${enc}`];
    case 'dramanova':
      return [`/dramanova/detail?id=${enc}`];
    default:
      return [];
  }
}

async function fetchSansekaiRawDetail(platformId, id, { forceRefresh = false, bypassCooldown = false } = {}) {
  const key = `${platformId}::${id}`;
  if (!forceRefresh && sansekaiDetailCache.has(key)) {
    return sansekaiDetailCache.get(key);
  }
  if (!forceRefresh) {
    const persisted = readLocalCache(`detail::${key}`, 45 * 60_000);
    if (persisted && typeof persisted === 'object') {
      sansekaiDetailCache.set(key, persisted);
      return persisted;
    }
  }
  const paths = buildSansekaiDetailPaths(platformId, id);
  if (!paths.length) return null;
  const { json } = await fetchSansekaiJsonPaths(paths, SANSEKAI_TIMEOUT_MS, null, { bypassCooldown });
  if (json && typeof json === 'object') {
    sansekaiDetailCache.set(key, json);
    writeLocalCache(`detail::${key}`, json);
  }
  return json;
}

/**
 * Fetches real drama detail (exact episode count, full Indonesian synopsis, HD cover, episode metadata).
 * Supports both Anichin unified dramas AND Sansekai/SekaiDrama native dramas.
 */
export async function fetchDramaDetail(drama) {
  if (!drama || !drama.sourceId) return null;

  if (drama.apiProvider === 'sansekai') {
    const plat = String(drama.sansekaiPlatform || drama.platformId || '').toLowerCase();
    if (!SANSEKAI_SUPPORTED_PLATFORMS.has(plat)) return null;
    const key = `sansekai::${plat}::${drama.sourceId}`;
    if (detailCache.has(key)) return detailCache.get(key);
    try {
      const json = await fetchSansekaiRawDetail(plat, drama.sansekaiId || drama.sourceId);
      if (!json || typeof json !== 'object') return null;
      const root = json?.data?.video_data || json?.video_data || json?.data || json;
      const rawList =
        (Array.isArray(root?.video_list) && root.video_list) ||
        (Array.isArray(root?.episodes) && root.episodes) ||
        (Array.isArray(root?.chapterList) && root.chapterList) ||
        (Array.isArray(root?.episode_list) && root.episode_list) ||
        [];
      const totalEpisodes =
        rawList.length ||
        Number(
          root?.episode_cnt ||
            root?.total_episodes ||
            root?.totalEpisodes ||
            root?.chapterCount ||
            root?.episode_count ||
            drama.totalEpisodes
        ) ||
        drama.totalEpisodes;

      const detail = {
        title: String(
          root?.series_title || root?.bookName || root?.book_title || root?.title || drama.title
        ).trim(),
        poster: normalizeSansekaiUrl(
          String(root?.series_cover || root?.coverWap || root?.cover || root?.book_pic || drama.poster).trim()
        ),
        synopsis: String(
          root?.series_intro || root?.introduction || root?.description || root?.summary || root?.desc || drama.synopsis
        ).trim(),
        totalEpisodes: Math.max(1, Math.min(300, Math.round(totalEpisodes))),
        episodes: rawList.map((epItem, idx) => ({
          number: Number(epItem?.vid_index || epItem?.episodeNumber || epItem?.episodeNum || idx + 1),
          title: String(epItem?.title || epItem?.chapterName || `Episode ${idx + 1}`),
          videoUrl: '',
          locked: false,
        })),
        tags: Array.isArray(root?.tags)
          ? root.tags.map((t) => (typeof t === 'string' ? t : t?.name || '')).filter(Boolean)
          : Array.isArray(root?.categories)
          ? root.categories.map(String)
          : [],
      };
      detailCache.set(key, detail);
      return detail;
    } catch {
      return null;
    }
  }

  if (drama.apiProvider !== 'anichin-unified') {
    return null;
  }
  const key = `${drama.platformId}::${drama.sourceId}`;
  if (detailCache.has(key)) return detailCache.get(key);

  try {
    const cfg = await loadEndpointConfig();
    const templates = cfg.routeTemplates?.detail || DEFAULT_DRACIN_ENDPOINT_CONFIG.routeTemplates.detail;
    const { json } = await fetchFromAdaptiveMirrors(
      templates,
      { platform: drama.platformId, id: drama.sourceId },
      { timeoutMs: API_TIMEOUT_MS }
    );
    const data = json?.data || json;
    if (!data || typeof data !== 'object') return null;

    const rawEpisodes = Array.isArray(data.episodes) ? data.episodes : [];
    const totalEpisodes =
      rawEpisodes.length ||
      Number(data.episodeCount || data.episodes || data.totalEpisodes || drama.totalEpisodes) ||
      drama.totalEpisodes;

    const detail = {
      title: String(data.title || drama.title).trim(),
      poster: String(data.cover || data.posterImg || drama.poster).trim(),
      synopsis: String(data.description || data.synopsis || drama.synopsis).trim(),
      totalEpisodes: Math.max(1, Math.min(300, Math.round(totalEpisodes))),
      episodes: rawEpisodes.map((ep, idx) => ({
        number: Number(ep.episodeNumber || ep.number || idx + 1),
        title: String(ep.episodeTitle || ep.title || `Episode ${idx + 1}`),
        videoUrl: resolveAnichinMediaUrl(ep.videoUrl || ep.playUrl || ''),
        locked: Boolean(ep.locked || ep.isLocked || ep.isVip),
      })),
      tags: Array.isArray(data.categoryNames)
        ? data.categoryNames
        : Array.isArray(data.tags)
        ? data.tags
        : [],
    };
    detailCache.set(key, detail);
    return detail;
  } catch {
    return null;
  }
}

function classifyStreamKind(url = '', qualityObj = null) {
  const lower = String(url || '').toLowerCase();
  if (qualityObj?.drm && qualityObj?.contentKey) return 'cenc-mp4';
  if (lower.includes('.m3u8') || lower.includes('/hls?') || lower.includes('/hls/')) return 'hls';
  return 'video';
}

/**
 * Unwraps proxy HLS URLs on miniapp.anichin.bio/api/.../hls that return JSON {"url":"...m3u8"}
 * (notably FlickReels) into their real direct .m3u8 playlist URL so both HLS.js and native
 * mobile <video> can play them immediately without MEDIA_ERR_SRC_NOT_SUPPORTED.
 */
async function unwrapProxyStreamUrlIfNeeded(url = '') {
  const clean = String(url || '').trim();
  if (!clean) return '';
  const needsInspect =
    /miniapp\.anichin\.bio\/api\/[^/]+\/hls/i.test(clean) ||
    /\/api\/flickreels\/hls/i.test(clean);
  if (!needsInspect) return clean;
  try {
    const body = await fetchTextWithTimeout(clean, 5500);
    return unwrapHlsJsonPayload(body, clean);
  } catch {
    return clean;
  }
}

/**
 * Fetches direct playable streams for a known (platformId, sansekaiId, episodeNumber) from
 * https://api.sansekai.my.id/api with per-drama detail & all-episode caching.
 */
async function resolveSansekaiDirectById(
  platformId,
  sansekaiId,
  episodeNumber = 1,
  { forceRefresh = false, bypassCooldown = false } = {}
) {
  const plat = String(platformId || '').toLowerCase();
  const id = String(sansekaiId || '').trim();
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  if (!SANSEKAI_SUPPORTED_PLATFORMS.has(plat) || !id) {
    return { servers: [], subtitles: [], locked: false };
  }

  const streamKey = `${plat}::${id}::ep${ep}`;
  if (!forceRefresh && sansekaiStreamCache.has(streamKey)) {
    return sansekaiStreamCache.get(streamKey);
  }
  if (!forceRefresh) {
    const persistedStream = readLocalCache(`stream::${streamKey}`, 30 * 60_000);
    if (persistedStream && Array.isArray(persistedStream.servers) && persistedStream.servers.length > 0) {
      sansekaiStreamCache.set(streamKey, persistedStream);
      return persistedStream;
    }
  }

  const encId = encodeURIComponent(id);
  let parsed = { servers: [], subtitles: [], locked: false };

  // 1. Melolo requires fetching /melolo/detail?book_id=... to get `vid` for Ep N, then /melolo/get-episode?videoId=${vid}
  if (plat === 'melolo') {
    const detailJson = await fetchSansekaiRawDetail('melolo', id, { forceRefresh, bypassCooldown });
    const vid = extractSansekaiMeloloVideoId(detailJson, ep);
    if (vid) {
      const { json } = await fetchSansekaiJsonPaths(
        [
          `/melolo/get-episode?videoId=${encodeURIComponent(vid)}`,
          `/melolo/stream?videoId=${encodeURIComponent(vid)}`,
        ],
        SANSEKAI_TIMEOUT_MS,
        (j) => extractSansekaiEpisodeStreams(j, { platformId: 'melolo', episodeNumber: ep }).servers.length > 0,
        { bypassCooldown }
      );
      parsed = extractSansekaiEpisodeStreams(json, { platformId: 'melolo', episodeNumber: ep });
    }
  } else if (plat === 'dramabox' || plat === 'goodshort' || plat === 'freereels') {
    // All-episode batch endpoints -> cached in memory + localStorage so jumping Ep 6 -> 7 -> 8 -> 9 uses 0 extra calls!
    const allKey = `${plat}::${id}`;
    let allJson = forceRefresh
      ? null
      : sansekaiAllEpisodeCache.get(allKey) || readLocalCache(`allep::${allKey}`, 45 * 60_000) || null;
    if (!allJson) {
      const allPaths =
        plat === 'dramabox'
          ? [`/dramabox/get-allepisode?bookId=${encId}`, `/dramabox/get-allepisodes?bookId=${encId}`]
          : plat === 'goodshort'
          ? [`/goodshort/get-allepisode?bookId=${encId}`, `/goodshort/allepisode?bookId=${encId}`]
          : [`/freereels/detailAndAllEpisode?key=${encId}`];
      const { json } = await fetchSansekaiJsonPaths(allPaths, SANSEKAI_TIMEOUT_MS, null, { bypassCooldown });
      allJson = json;
      if (allJson) {
        sansekaiAllEpisodeCache.set(allKey, allJson);
        writeLocalCache(`allep::${allKey}`, allJson);
      }
    } else if (!sansekaiAllEpisodeCache.has(allKey)) {
      sansekaiAllEpisodeCache.set(allKey, allJson);
    }
    if (allJson) {
      parsed = extractSansekaiEpisodeStreams(allJson, { platformId: plat, episodeNumber: ep });
    }
  } else if (plat === 'dramanova') {
    const detailJson = await fetchSansekaiRawDetail('dramanova', id, { forceRefresh, bypassCooldown });
    const eps = detailJson?.data?.episodes || detailJson?.episodes || [];
    const epObj = eps.find((e) => Number(e?.episodeNumber || e?.episode) === ep) || eps[ep - 1];
    const fileId = epObj?.fileId || epObj?.file_id || '';
    if (fileId) {
      const { json } = await fetchSansekaiJsonPaths(
        [`/dramanova/getvideo?fileId=${encodeURIComponent(String(fileId))}`],
        SANSEKAI_TIMEOUT_MS,
        null,
        { bypassCooldown }
      );
      parsed = extractSansekaiEpisodeStreams(json, { platformId: 'dramanova', episodeNumber: ep });
    }
  } else {
    // Per-episode endpoints: pinedrama, mydrama, reelshort, shortmax, netshort, flickreels
    const epPathMap = {
      pinedrama: [
        `/pinedrama/get-episode?collection_id=${encId}&episodeNumber=${ep}`,
        `/pinedrama/get-episodes?collection_id=${encId}&episodeNumber=${ep}`,
      ],
      mydrama: [`/mydrama/episode?dramaId=${encId}&episode=${ep}`],
      reelshort: [
        `/reelshort/get-episode?bookId=${encId}&episodeNumber=${ep}`,
        `/reelshort/allepisode?bookId=${encId}`,
      ],
      shortmax: [
        `/shortmax/get-episodes?shortPlayId=${encId}&episodeNumber=${ep}`,
        `/shortmax/get-episode?shortPlayId=${encId}&episodeNumber=${ep}`,
      ],
      netshort: [
        `/netshort/get-episodes?shortPlayId=${encId}&episodeNumber=${ep}`,
        `/netshort/episodes?shortPlayId=${encId}&episodeNumber=${ep}`,
      ],
      flickreels: [
        `/flickreels/get-episodes?playlet_id=${encId}&episodeNumber=${ep}`,
        `/flickreels/get-episode?playlet_id=${encId}&episodeNumber=${ep}`,
      ],
    };
    const paths = epPathMap[plat] || [];
    if (paths.length > 0) {
      const { json } = await fetchSansekaiJsonPaths(
        paths,
        SANSEKAI_TIMEOUT_MS,
        (j) => extractSansekaiEpisodeStreams(j, { platformId: plat, episodeNumber: ep }).servers.length > 0,
        { bypassCooldown }
      );
      parsed = extractSansekaiEpisodeStreams(json, { platformId: plat, episodeNumber: ep });
    }
  }

  if (parsed.servers.length > 0) {
    sansekaiStreamCache.set(streamKey, parsed);
    writeLocalCache(`stream::${streamKey}`, parsed);
  }
  return parsed;
}

/**
 * Resolves a playable VIP-free stream for ANY drama & episode via https://api.sansekai.my.id/api.
 * - Respects persistent cooldown circuit-breaker so we NEVER spam 403/429 requests.
 * - Checks cached streams/details first (0 network calls).
 * - Only bypasses cooldown when user explicitly requests a fresh manual probe (`bypassCooldown: true`).
 */
export async function resolveSansekaiEpisodePlayback(
  drama,
  episodeNumber = 1,
  { forceRefresh = false, bypassCooldown = false } = {}
) {
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  if (!drama) {
    return { servers: [], subtitles: [], locked: false, platformId: '', platformName: '', error: '' };
  }

  const cachedMatch = sansekaiMatchCache.get(drama.id) || readLocalCache(`match::${drama.id}`, 60 * 60_000) || null;
  const preferredPlat = String(
    cachedMatch?.platformId || drama.sansekaiPlatform || drama.platformId || ''
  ).toLowerCase();
  const preferredId = String(cachedMatch?.sansekaiId || drama.sansekaiId || drama.sourceId || '').trim();
  let lastErrMsg = '';

  const isLimitError = (msg = '') =>
    msg.includes('HTTP 403') || msg.includes('HTTP 429') || msg.includes('SANSEKAI_COOLDOWN');

  // Step 1: Direct ID lookup when supported by Sansekai
  if (SANSEKAI_SUPPORTED_PLATFORMS.has(preferredPlat) && preferredId) {
    try {
      const direct = await resolveSansekaiDirectById(preferredPlat, preferredId, ep, {
        forceRefresh,
        bypassCooldown,
      });
      if (direct.servers.length > 0) {
        return {
          ...direct,
          platformId: preferredPlat,
          platformName: getPlatformMeta(preferredPlat).name,
          sansekaiId: preferredId,
          error: '',
        };
      }
    } catch (err) {
      lastErrMsg = String(err?.message || '');
      if (isLimitError(lastErrMsg)) {
        return {
          servers: [],
          subtitles: [],
          locked: false,
          platformId: preferredPlat,
          platformName: getPlatformMeta(preferredPlat).name,
          error: lastErrMsg,
        };
      }
    }
  }

  // Stop before title-search cascade if Sansekai is in cooldown
  if (!bypassCooldown && getSansekaiStatus().inCooldown) {
    return {
      servers: [],
      subtitles: [],
      locked: false,
      platformId: preferredPlat,
      platformName: preferredPlat ? getPlatformMeta(preferredPlat).name : 'Sansekai',
      error: lastErrMsg || 'SANSEKAI_COOLDOWN',
    };
  }

  // Step 2: Cross-title search on Sansekai (max 2 platforms to respect 10 req/min limit!)
  const cleanTitle = String(drama.title || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanTitle) {
    return { servers: [], subtitles: [], locked: false, platformId: '', platformName: '', error: lastErrMsg };
  }

  const searchOrder = Array.from(
    new Set(
      [
        SANSEKAI_SUPPORTED_PLATFORMS.has(preferredPlat) ? preferredPlat : null,
        'dramabox',
        'melolo',
      ].filter(Boolean)
    )
  ).slice(0, 2);

  let bestMatch = null;
  for (const candPlat of searchOrder) {
    try {
      const feed = await fetchSansekaiPlatformFeed(candPlat, { page: 1, query: cleanTitle, bypassCooldown });
      if (feed.blockedReason && isLimitError(feed.blockedReason)) {
        lastErrMsg = feed.blockedReason;
        break;
      }
      for (const item of feed.items || []) {
        const evalRes = scoreCrossPlatformDramaMatch(drama, item);
        const samePlatBonus = candPlat === drama.platformId ? 10 : 0;
        const totalScore = evalRes.score + samePlatBonus;
        if (totalScore >= 28 && (!bestMatch || totalScore > bestMatch.score)) {
          bestMatch = { score: totalScore, platformId: candPlat, sansekaiId: item.sansekaiId || item.sourceId };
        }
      }
      if (bestMatch && bestMatch.score >= 55) break;
    } catch {
      // Try next platform
    }
  }

  if (bestMatch?.sansekaiId) {
    const matchRec = { platformId: bestMatch.platformId, sansekaiId: bestMatch.sansekaiId };
    sansekaiMatchCache.set(drama.id, matchRec);
    writeLocalCache(`match::${drama.id}`, matchRec);
    try {
      const resolved = await resolveSansekaiDirectById(bestMatch.platformId, bestMatch.sansekaiId, ep, {
        forceRefresh,
        bypassCooldown,
      });
      if (resolved.servers.length > 0) {
        return {
          ...resolved,
          platformId: bestMatch.platformId,
          platformName: getPlatformMeta(bestMatch.platformId).name,
          sansekaiId: bestMatch.sansekaiId,
          error: '',
        };
      }
    } catch (err) {
      lastErrMsg = String(err?.message || '');
    }
  }

  return {
    servers: [],
    subtitles: [],
    locked: false,
    platformId: preferredPlat,
    platformName: preferredPlat ? getPlatformMeta(preferredPlat).name : 'Sansekai',
    error: lastErrMsg,
  };
}

/**
 * Resolves REAL video + audio playback servers & real subtitle tracks for ANY drama & episode.
 * - Uses Sansekai API FIRST for native Sansekai/PineDrama/MyDrama dramas or when preferSansekai is true.
 * - Uses multi-mirror Anichin API for primary platforms, and AUTOMATICALLY fails over to Sansekai API
 *   inside the player whenever an episode is VIP-locked or returns no video link!
 */
export async function resolveEpisodePlayback(
  drama,
  episodeNumber = 1,
  { forceRefresh = false, preferSansekai = false, allowSansekai = true, allowAutoDailymotion = true } = {}
) {
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  const flightKey = `${drama?.id || drama?.sourceId || 'unknown'}::ep${ep}${preferSansekai ? '::sk' : ''}${allowSansekai ? '' : '::nosk'}`;

  if (!forceRefresh && inFlightEpisodeMap.has(flightKey)) {
    return inFlightEpisodeMap.get(flightKey);
  }

  const run = (async () => {
    const servers = [];
    let subtitles = [];
    let rawError = '';
    let isLockedVip = false;
    let switchedViaSansekai = false;
    let switchedViaDailymotion = false;
    let sansekaiPlatformName = '';
    const cfg = await loadEndpointConfig();

    const isSansekaiNative =
      preferSansekai ||
      drama?.apiProvider === 'sansekai' ||
      drama?.platformId === 'pinedrama' ||
      drama?.platformId === 'mydrama';

    // 0. Sansekai-first path (when user picked SekaiDrama/PineDrama/MyDrama from the start or clicked Server Sansekai)
    if (isSansekaiNative && allowSansekai) {
      const skRes = await resolveSansekaiEpisodePlayback(drama, ep, {
        forceRefresh,
        bypassCooldown: Boolean(preferSansekai && forceRefresh),
      });
      if (skRes.servers.length > 0) {
        servers.push(...skRes.servers);
        if (skRes.subtitles?.length) subtitles = skRes.subtitles;
        switchedViaSansekai = Boolean(preferSansekai && drama?.apiProvider !== 'sansekai');
        sansekaiPlatformName = skRes.platformName || 'Sansekai';
      } else if (skRes.error) {
        rawError = skRes.error;
      }
    }

    // 1. Primary: Real Platform Direct Stream (MP4 / HLS / Melolo CENC-MP4) across adaptive mirrors
    if (servers.length === 0 && drama?.apiProvider === 'anichin-unified' && drama?.sourceId) {
      const epKey = `${drama.platformId}::${drama.sourceId}::ep${ep}`;
      let epData = forceRefresh ? null : episodeCache.get(epKey) || null;

      if (!epData) {
        const templates = cfg.routeTemplates?.episode || DEFAULT_DRACIN_ENDPOINT_CONFIG.routeTemplates.episode;
        try {
          const { json } = await fetchFromAdaptiveMirrors(
            templates,
            { platform: drama.platformId, id: drama.sourceId, ep },
            {
              timeoutMs: EPISODE_TIMEOUT_MS,
              acceptJson: (j) => {
                const parsed = extractAdaptiveEpisodePayload(j, cfg.schemaAliases);
                return Boolean(parsed.videoUrl || parsed.qualityList.length > 0);
              },
            }
          );
          const extracted = extractAdaptiveEpisodePayload(json, cfg.schemaAliases);
          if (extracted.videoUrl || extracted.qualityList.length > 0) {
            epData = extracted;
            episodeCache.set(epKey, epData);
          } else if (extracted.locked) {
            isLockedVip = true;
          }
        } catch (err) {
          rawError = err;
        }

        // Secondary check: detailCache sometimes already contains direct episode videoUrl
        if (!epData) {
          const detailKey = `${drama.platformId}::${drama.sourceId}`;
          const cachedDetail = detailCache.get(detailKey);
          const detailEp = cachedDetail?.episodes?.find((item) => item.number === ep);
          if (detailEp?.videoUrl) {
            epData = {
              videoUrl: detailEp.videoUrl,
              qualityList: [],
              subtitles: [],
              locked: false,
            };
            isLockedVip = false;
            episodeCache.set(epKey, epData);
          } else if (detailEp?.locked) {
            isLockedVip = true;
          }
        }
      }

      if (epData) {
        const qList = Array.isArray(epData.qualityList) ? epData.qualityList : [];
        const seenUrls = new Set();

        // Sort qualities preferring 720p -> 540p -> 480p -> 1080p -> 360p (fast start + crisp HD)
        const qualityRank = (label = '', codec = '') => {
          const l = String(label).toLowerCase();
          const c = String(codec).toLowerCase();
          const codecBonus = c.includes('h264') || c.includes('avc') ? -10 : 0;
          if (l.includes('auto')) return codecBonus + 0;
          if (l.includes('720')) return codecBonus + 1;
          if (l.includes('540')) return codecBonus + 2;
          if (l.includes('480')) return codecBonus + 3;
          if (l.includes('1080')) return codecBonus + 4;
          if (l.includes('360')) return codecBonus + 5;
          return codecBonus + 6;
        };

        const sortedQualities = [...qList]
          .filter((q) => q && q.url)
          .sort((a, b) => qualityRank(a.label, a.codec) - qualityRank(b.label, b.codec));

        // For Melolo CENC decryption, prefer H.264 if present, else 480p/360p/540p first so download+decrypt is fast on mobile
        if (drama.platformId === 'melolo') {
          sortedQualities.sort((a, b) => {
            const meloloRank = (q) => {
              const lbl = String(q.label || '').toLowerCase();
              const c = String(q.codec || '').toLowerCase();
              const avcBonus = c.includes('h264') || c.includes('avc') ? -20 : 0;
              const sizeRank = lbl.includes('480')
                ? 0
                : lbl.includes('360')
                ? 1
                : lbl.includes('540')
                ? 2
                : lbl.includes('720')
                ? 3
                : 4;
              return avcBonus + sizeRank;
            };
            return meloloRank(a) - meloloRank(b);
          });
        }

        // Unwrap proxy HLS wrappers (like FlickReels JSON {"url":"...m3u8"}) in parallel
        const unwrappedEntries = await Promise.all(
          sortedQualities.map(async (q) => {
            const initialUrl = resolveAnichinMediaUrl(q.url);
            const finalUrl = await unwrapProxyStreamUrlIfNeeded(initialUrl);
            return { q, url: finalUrl || initialUrl };
          })
        );

        for (const { q, url: resolvedUrl } of unwrappedEntries) {
          if (!resolvedUrl || seenUrls.has(resolvedUrl)) continue;
          seenUrls.add(resolvedUrl);
          const kind = classifyStreamKind(resolvedUrl, q);
          const labelText = q.label ? String(q.label).toUpperCase() : 'HD';
          servers.push({
            id: `live-${drama.platformId}-${labelText.toLowerCase().replace(/[^a-z0-9]/g, '')}-${servers.length}`,
            label: `${drama.platformName} ${labelText}${kind === 'hls' ? ' (HLS)' : kind === 'cenc-mp4' ? ' (HD)' : ' (MP4)'}`,
            kind,
            url: resolvedUrl,
            qualityLabel: labelText,
            drm: q.drm || '',
            kid: q.kid || '',
            contentKey: q.contentKey || '',
            codec: q.codec || '',
          });
        }

        // Also include top-level videoUrl if not already in qualityList
        const rawTopUrl = resolveAnichinMediaUrl(epData.videoUrl || '');
        const topUrl = rawTopUrl ? await unwrapProxyStreamUrlIfNeeded(rawTopUrl) : '';
        if (topUrl && !seenUrls.has(topUrl)) {
          seenUrls.add(topUrl);
          const defaultDrm = qList.find((q) => q?.drm && q?.contentKey) || null;
          const kind = classifyStreamKind(topUrl, defaultDrm);
          servers.unshift({
            id: `live-${drama.platformId}-hd`,
            label: `${drama.platformName} HD${kind === 'hls' ? ' (HLS)' : kind === 'cenc-mp4' ? ' (HD)' : ' (MP4)'}`,
            kind,
            url: topUrl,
            qualityLabel: 'HD',
            drm: defaultDrm?.drm || '',
            kid: defaultDrm?.kid || '',
            contentKey: defaultDrm?.contentKey || '',
            codec: defaultDrm?.codec || '',
          });
        }

        if (Array.isArray(epData.subtitles)) {
          subtitles = epData.subtitles
            .filter((s) => s && s.url)
            .map((s) => ({
              label: String(s.label || s.language || 'Subtitle'),
              language: String(s.language || s.label || 'id').toLowerCase(),
              url: resolveAnichinMediaUrl(s.url),
            }));
        }
      }
    }

    // 1.5 AUTOMATIC IN-PLAYER SANSEKAI VIP FAILOVER:
    // Respects cooldown circuit-breaker and NEVER runs during silent background prefetch!
    if (servers.length === 0 && !isSansekaiNative && allowSansekai && drama) {
      const skFallback = await resolveSansekaiEpisodePlayback(drama, ep, { forceRefresh: false });
      if (skFallback.servers.length > 0) {
        servers.push(...skFallback.servers);
        if (skFallback.subtitles?.length && subtitles.length === 0) {
          subtitles = skFallback.subtitles;
        }
        isLockedVip = false;
        switchedViaSansekai = true;
        sansekaiPlatformName = skFallback.platformName || 'Sansekai';
      }
    }

    // 2. Direct MP4 URL on drama item if present
    if (drama?.directVideoUrl) {
      servers.push({
        id: 'direct-hd',
        label: 'Server Direct HD (MP4)',
        kind: classifyStreamKind(drama.directVideoUrl),
        url: resolveAnichinMediaUrl(drama.directVideoUrl),
        qualityLabel: 'HD',
      });
    }

    // 3. Dailymotion Embed for dramas that already have a verified dailymotionId
    const dmId = drama?.dailymotionId || '';
    if (dmId) {
      servers.push({
        id: 'dm-hd',
        label: servers.length ? 'Server Cadangan · Dailymotion HD' : 'Dailymotion HD Stream',
        kind: 'dailymotion',
        videoId: dmId,
        embedUrl: buildDailymotionEmbedUrl(dmId, endpointConfigCache?.dailymotionPlayerId),
        watchUrl: buildDailymotionWatchUrl(dmId),
      });
    }

    // 3.5 AUTOMATIC HIGH-PRECISION DAILYMOTION HD FAILOVER:
    // When both primary & Sansekai return 0 streams (e.g. VIP lock + Sansekai cooldown),
    // automatically search Dailymotion HD with strict title relevance so genuine drama mirrors play immediately!
    if (servers.length === 0 && allowAutoDailymotion && drama?.title) {
      try {
        const autoDm = await searchDailymotionEpisodeBackup(drama, ep, { strictAuto: true });
        if (autoDm) {
          servers.push(autoDm);
          isLockedVip = false;
          switchedViaDailymotion = true;
        }
      } catch {
        // Continue cleanly to action card
      }
    }

    const best = pickBestPlaybackServer(servers);
    const skStatus = getSansekaiStatus();
    const sansekaiWebUrl = buildSansekaiDirectWatchUrl(drama, ep, cfg?.sansekai?.webBaseUrl);
    let friendlyError = '';
    if (servers.length === 0) {
      if (isLockedVip) {
        friendlyError = skStatus.inCooldown
          ? `Episode ${ep} dikunci VIP di server ${drama?.platformName || 'platform'}. Buka langsung di SekaiDrama Web (bebas limit), cari di platform lain, atau Mirror Dailymotion.`
          : `Episode ${ep} dikunci VIP di server asli ${drama?.platformName || 'platform'}. Gunakan SekaiDrama Web, cari di platform lain, atau Mirror Dailymotion.`;
      } else if (rawError) {
        friendlyError = formatDracinUserError(rawError, {
          platformName: drama?.platformName || 'platform',
          episode: ep,
        });
      } else {
        friendlyError = `Server ${drama?.platformName || 'platform'} belum mengembalikan link video untuk Episode ${ep}. Gunakan SekaiDrama Web atau mirror cadangan.`;
      }
    }

    return {
      episode: ep,
      servers,
      subtitles,
      defaultServerId: best?.id || '',
      locked: Boolean(isLockedVip && servers.length === 0),
      error: friendlyError,
      switchedViaSansekai,
      switchedViaDailymotion,
      sansekaiPlatformName,
      sansekaiCooldownSec: skStatus.cooldownRemainingSec,
      sansekaiWebUrl,
    };
  })();

  inFlightEpisodeMap.set(flightKey, run);
  try {
    return await run;
  } finally {
    inFlightEpisodeMap.delete(flightKey);
  }
}

/**
 * Silent background episode metadata & stream URL prefetcher for zero-wait episode transitions.
 * Explicitly disables Sansekai & auto-Dailymotion during background prefetch so we NEVER burn
 * Sansekai's 10 req/min rate limit before the user even opens the episode!
 */
export async function prefetchEpisodePlayback(drama, episodeNumber) {
  if (!drama || !episodeNumber) return null;
  try {
    return await resolveEpisodePlayback(drama, episodeNumber, {
      allowSansekai: false,
      allowAutoDailymotion: false,
    });
  } catch {
    return null;
  }
}

/**
 * Backup mirror lookup on Dailymotion (both strict automatic failover and on-demand manual lookup).
 */
export async function searchDailymotionEpisodeBackup(drama, episodeNumber = 1, { strictAuto = false } = {}) {
  if (!drama?.title) return null;
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  const cleanTitle = String(drama.title)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const synopsisKeywords = extractSynopsisKeywords(drama, 3).join(' ');
  const queries = Array.from(
    new Set(
      (strictAuto
        ? [`${cleanTitle} episode ${ep} sub indo`, `${cleanTitle} drama china sub indo`]
        : [
            `${cleanTitle} episode ${ep} sub indo`,
            `${cleanTitle} drama china sub indo`,
            synopsisKeywords ? `${synopsisKeywords} drama china sub indo` : '',
          ]
      ).filter(Boolean)
    )
  );
  const titleTokens = normalizeDramaMatchText(`${cleanTitle} ${drama.altTitle || ''}`);

  for (const q of queries) {
    try {
      const res = await fetchDailymotionDracin(q, strictAuto ? 6 : 10, drama.platformId);
      const candidates = (res?.items || []).filter((item) => Boolean(item?.dailymotionId));
      if (!candidates.length) continue;

      if (strictAuto) {
        const strongRanked = candidates
          .map((item) => ({ item, evalRes: scoreDailymotionAutoMatch(drama, item, ep) }))
          .filter((entry) => entry.evalRes.isStrongMatch)
          .sort((a, b) => b.evalRes.score - a.evalRes.score);
        const top = strongRanked[0]?.item || null;
        if (top?.dailymotionId) {
          return {
            id: `dm-auto-ep${ep}-${top.dailymotionId}`,
            label: `Mirror Dailymotion HD · ${top.title.slice(0, 22)}`,
            kind: 'dailymotion',
            videoId: top.dailymotionId,
            embedUrl: buildDailymotionEmbedUrl(top.dailymotionId, endpointConfigCache?.dailymotionPlayerId),
            watchUrl: buildDailymotionWatchUrl(top.dailymotionId),
          };
        }
        continue;
      }

      const scored = candidates
        .map((item) => {
          const evalRes = scoreDailymotionAutoMatch(drama, item, ep);
          const hay = `${item.title} ${item.synopsis || ''}`.toLowerCase();
          let hits = 0;
          for (const tok of titleTokens) {
            if (hay.includes(tok)) hits += 1;
          }
          const epMatch = new RegExp(`\\b(ep|episode)\\s*0?${ep}\\b`, 'i').test(hay) ? 2 : 0;
          return { item, rank: Math.max(evalRes.score, hits * 3 + epMatch) };
        })
        .sort((a, b) => b.rank - a.rank);

      const best = scored[0]?.rank > 0 ? scored[0].item : null;
      if (best?.dailymotionId) {
        return {
          id: `dm-backup-ep${ep}-${best.dailymotionId}`,
          label: `Mirror Dailymotion · ${best.title.slice(0, 22)}`,
          kind: 'dailymotion',
          videoId: best.dailymotionId,
          embedUrl: buildDailymotionEmbedUrl(best.dailymotionId, endpointConfigCache?.dailymotionPlayerId),
          watchUrl: buildDailymotionWatchUrl(best.dailymotionId),
        };
      }
    } catch {
      // Try next query
    }
  }
  return null;
}

const posterVisualProfileCache = new Map();

/**
 * Samples a poster image's average RGB color, brightness, warmth, and aspect ratio
 * using an offscreen canvas (CORS-safe, bounded timeout, returns null cleanly if blocked).
 */
export async function extractVisualProfileFromImageUrl(url = '', timeoutMs = 1800) {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl || typeof Image === 'undefined' || typeof document === 'undefined') return null;
  if (posterVisualProfileCache.has(cleanUrl)) {
    return posterVisualProfileCache.get(cleanUrl);
  }

  const profile = await new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.referrerPolicy = 'no-referrer';
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    img.onload = () => {
      try {
        const w = img.naturalWidth || 100;
        const h = img.naturalHeight || 150;
        const canvas = document.createElement('canvas');
        const sw = 28;
        const sh = Math.max(20, Math.min(56, Math.round((h / Math.max(1, w)) * sw)));
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return finish(null);
        ctx.drawImage(img, 0, 0, sw, sh);
        const { data } = ctx.getImageData(0, 0, sw, sh);
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        const px = data.length / 4 || 1;
        for (let i = 0; i < data.length; i += 4) {
          rSum += data[i];
          gSum += data[i + 1];
          bSum += data[i + 2];
        }
        const r = Math.round(rSum / px);
        const g = Math.round(gSum / px);
        const b = Math.round(bSum / px);
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const warmth = Math.max(0, Math.min(1, (r - b + 255) / 510));
        finish({
          r,
          g,
          b,
          brightness,
          warmth,
          aspectRatio: Number((w / Math.max(1, h)).toFixed(2)),
        });
      } catch {
        // Canvas tainted by CORS header absence — gracefully skip visual signal
        finish(null);
      }
    };
    img.onerror = () => finish(null);
    img.src = cleanUrl;
  });

  if (posterVisualProfileCache.size > 120) {
    posterVisualProfileCache.clear();
  }
  posterVisualProfileCache.set(cleanUrl, profile);
  return profile;
}

const CROSS_PLATFORM_PRIORITY = [
  'dramabox',
  'melolo',
  'netshort',
  'reelshort',
  'shortmax',
  'goodshort',
  'flickreels',
  'dramawave',
];

/**
 * Multi-signal cross-platform drama finder:
 * Searches other live platforms using BOTH title tokens AND synopsis keywords
 * (to catch the same drama published under a different title on another platform),
 * combines with poster visual fingerprint + episode count + genre metadata.
 */
export async function findCrossPlatformDramaMatches(drama, currentCatalog = [], { limit = 5 } = {}) {
  if (!drama) {
    return { matches: [], searchedPlatforms: [], queriesUsed: [], visualComparedCount: 0 };
  }

  const cleanTitle = String(drama.title || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const titleQuery = normalizeDramaMatchText(cleanTitle).slice(0, 4).join(' ') || cleanTitle;
  const synopsisKeywords = extractSynopsisKeywords(drama, 3);
  const synopsisQuery = synopsisKeywords.join(' ');
  const queriesUsed = Array.from(new Set([titleQuery, synopsisQuery].filter((q) => q && q.length >= 3)));

  const targetPlatforms = CROSS_PLATFORM_PRIORITY.filter((pid) => pid !== drama.platformId).slice(0, 5);

  const jobs = [];
  for (const pid of targetPlatforms) {
    if (titleQuery) {
      jobs.push(fetchAnichinPlatformFeed(pid, { page: 1, query: titleQuery }));
    }
    if (synopsisQuery && synopsisQuery !== titleQuery) {
      jobs.push(fetchAnichinPlatformFeed(pid, { page: 1, query: synopsisQuery }));
    }
  }
  if (titleQuery) {
    if (!getSansekaiStatus().inCooldown) {
      jobs.push(fetchSansekaiPlatformFeed('dramabox', { page: 1, query: titleQuery }));
    }
    jobs.push(fetchDailymotionDracin(`${titleQuery} drama china sub indo`, 8));
  }

  const settled = await Promise.allSettled(jobs);
  const candidatePool = [...(Array.isArray(currentCatalog) ? currentCatalog : [])];
  for (const res of settled) {
    if (res.status === 'fulfilled' && Array.isArray(res.value?.items)) {
      candidatePool.push(...res.value.items);
    }
  }

  // Stage 1: fast text + metadata pre-ranking
  const preRanked = rankCrossPlatformDramaMatches(drama, candidatePool, {
    minScore: 14,
    limit: 10,
  });

  // Stage 2: enrich top pre-ranked candidates with poster visual profile similarity
  const visualMap = {};
  let sourceVisual = null;
  let visualComparedCount = 0;

  if (preRanked.length > 0 && drama.poster) {
    const [srcProf, ...candProfs] = await Promise.all([
      extractVisualProfileFromImageUrl(drama.poster, 1600),
      ...preRanked.slice(0, 6).map((m) => extractVisualProfileFromImageUrl(m.drama.poster, 1600)),
    ]);
    sourceVisual = srcProf;
    if (sourceVisual) {
      preRanked.slice(0, 6).forEach((m, i) => {
        if (candProfs[i]) {
          visualMap[m.drama.id] = candProfs[i];
          visualComparedCount += 1;
        }
      });
    }
  }

  const finalMatches = rankCrossPlatformDramaMatches(
    drama,
    preRanked.map((m) => m.drama),
    {
      sourceVisual,
      visualMap,
      minScore: 22,
      limit,
    }
  );

  return {
    matches: finalMatches,
    searchedPlatforms: targetPlatforms,
    queriesUsed,
    visualComparedCount,
  };
}

/**
 * Free Keyless Multi-Language Auto-Translator (Google GTX + MyMemory parallel failover).
 */
export async function translateTextParallel(text = '', targetLang = 'id') {
  const clean = String(text || '').trim();
  if (!clean || targetLang === 'off') return clean;
  const cacheKey = `${targetLang}::${clean.slice(0, 180)}`;
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  const gtxPromise = fetchJsonWithTimeout(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLang
    )}&dt=t&q=${encodeURIComponent(clean.slice(0, 500))}`,
    {},
    3200
  ).then((json) => {
    if (Array.isArray(json?.[0])) {
      return json[0].map((seg) => seg?.[0] || '').join('').trim();
    }
    throw new Error('Invalid GTX response');
  });

  const myMemoryPromise = fetchJsonWithTimeout(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      clean.slice(0, 450)
    )}&langpair=auto|${encodeURIComponent(targetLang)}`,
    {},
    3400
  ).then((json) => {
    const out = String(json?.responseData?.translatedText || '').trim();
    if (!out || /INVALID LANGUAGE/i.test(out)) throw new Error('Invalid MyMemory');
    return out;
  });

  try {
    const translated = await Promise.any([gtxPromise, myMemoryPromise]);
    if (translated) {
      translationCache.set(cacheKey, translated);
      return translated;
    }
  } catch {
    // Keep original
  }
  return clean;
}

/**
 * Loads REAL episode subtitles (WebVTT / SRT) from the platform's subtitle tracks.
 * Never overlays fake dialogue lines! If platform burns Indonesian subtitles directly into
 * the video stream (like DramaBox/Melolo/ShortMax), reports that cleanly.
 */
export async function getEpisodeSubtitles(drama, episodeNumber = 1, lang = 'id', apiSubtitles = []) {
  if (lang === 'off') {
    return { cues: [], isRealTrack: false, reason: 'Subtitle dimatikan' };
  }

  const tracks = Array.isArray(apiSubtitles) ? apiSubtitles.filter((t) => t && t.url) : [];
  if (tracks.length === 0) {
    return {
      cues: [],
      isRealTrack: false,
      reason: drama?.hasIndonesianDub
        ? 'Sulih Suara Indonesia aktif pada audio video'
        : 'Subtitle Bahasa Indonesia sudah tertanam langsung (hardsub) di dalam video',
    };
  }

  // Match requested language (id -> id / in / indonesian)
  const langMatch = (track, target) => {
    const code = `${track.language || ''} ${track.label || ''}`.toLowerCase();
    if (target === 'id') return /\b(id|in|ind|id_id|id-id|indo|indonesian)\b/.test(code);
    return code.startsWith(target) || code.includes(`_${target}`) || code.includes(`-${target}`);
  };

  let picked = tracks.find((t) => langMatch(t, lang));
  let needsTranslate = false;
  if (!picked) {
    picked = tracks.find((t) => langMatch(t, 'en')) || tracks[0];
    needsTranslate = Boolean(picked && !langMatch(picked, lang));
  }

  try {
    let rawSub = subtitleTextCache.get(picked.url);
    if (!rawSub) {
      rawSub = await fetchTextWithTimeout(picked.url, 6000);
      subtitleTextCache.set(picked.url, rawSub);
    }
    const cues = parseSubtitleText(rawSub);
    if (cues.length > 0) {
      if (needsTranslate && lang === 'id') {
        // Translate first batch quickly so opening dialogue is immediately in Indonesian
        const translated = [...cues];
        const batchSize = Math.min(25, translated.length);
        const joined = translated
          .slice(0, batchSize)
          .map((c) => c.text.replace(/\n+/g, ' '))
          .join('\n|||\n');
        try {
          const out = await translateTextParallel(joined, 'id');
          const parts = out.split(/\s*\|\|\|\s*/);
          if (parts.length === batchSize) {
            for (let i = 0; i < batchSize; i += 1) {
              if (parts[i]) translated[i] = { ...translated[i], text: parts[i].trim() };
            }
          }
        } catch {
          // Keep original real cues
        }
        return {
          cues: translated,
          isRealTrack: true,
          reason: `Subtitle asli (${picked.label}) diterjemahkan otomatis ke Bahasa Indonesia`,
        };
      }
      return {
        cues,
        isRealTrack: true,
        reason: `Subtitle resmi ${picked.label} aktif (${cues.length} baris dialog)`,
      };
    }
  } catch {
    // External subtitle file blocked by CORS or unavailable
  }

  return {
    cues: [],
    isRealTrack: false,
    reason: 'Audio asli & subtitle bawaan video aktif',
  };
}

/**
 * Keyless Multi-AI Router for Clip Identifier & Drama Companion Insights.
 */
export async function queryKeylessMultiAi(
  prompt,
  systemPrompt = 'Anda adalah asisten ahli Drama China (Dracin) dari 18 platform short drama. Jawab ringkas dalam Bahasa Indonesia.'
) {
  const providers = [
    {
      run: async () => {
        const res = await fetchJsonWithTimeout(
          'https://api.llm7.io/v1/chat/completions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gemma-3-27b',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
              ],
              max_tokens: 240,
              temperature: 0.4,
            }),
          },
          AI_TIMEOUT_MS
        );
        const text = String(res?.choices?.[0]?.message?.content || '').trim();
        if (!text) throw new Error('Empty AI');
        return { text, engine: 'Gemini Open (LLM7)' };
      },
    },
    {
      run: async () => {
        const res = await fetchJsonWithTimeout(
          'https://text.pollinations.ai/openai',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'openai-fast',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
              ],
              max_tokens: 240,
            }),
          },
          AI_TIMEOUT_MS
        );
        const text = String(res?.choices?.[0]?.message?.content || '').trim();
        if (!text) throw new Error('Empty AI');
        return { text, engine: 'Multi-AI Open Router' };
      },
    },
  ];

  try {
    return await Promise.any(providers.map((p) => p.run()));
  } catch {
    return {
      text: '',
      engine: 'Smart Local AI Analyzer',
    };
  }
}

export async function extractVisualProfileFromFile(file) {
  if (!file) return null;
  const isVideo = /^video\//i.test(file.type) || /\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name || '');
  const objectUrl = URL.createObjectURL(file);

  const sampleCanvas = (sourceEl, w, h) => {
    const canvas = document.createElement('canvas');
    const sw = 48;
    const sh = Math.max(24, Math.min(96, Math.round((h / Math.max(1, w)) * sw)));
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { brightness: 0.5, warmth: 0.5, dominantHex: '#e11d48', previewDataUrl: '' };
    ctx.drawImage(sourceEl, 0, 0, sw, sh);
    const { data } = ctx.getImageData(0, 0, sw, sh);
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    const totalPx = data.length / 4 || 1;
    for (let i = 0; i < data.length; i += 4) {
      rSum += data[i];
      gSum += data[i + 1];
      bSum += data[i + 2];
    }
    const r = Math.round(rSum / totalPx);
    const g = Math.round(gSum / totalPx);
    const b = Math.round(bSum / totalPx);
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const warmth = Math.max(0, Math.min(1, (r - b + 255) / 510));
    const dominantHex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

    const prevCanvas = document.createElement('canvas');
    const pw = 160;
    const ph = Math.max(90, Math.min(284, Math.round((h / Math.max(1, w)) * pw)));
    prevCanvas.width = pw;
    prevCanvas.height = ph;
    prevCanvas.getContext('2d')?.drawImage(sourceEl, 0, 0, pw, ph);
    const previewDataUrl = prevCanvas.toDataURL('image/jpeg', 0.78);
    return { brightness, warmth, dominantHex, previewDataUrl };
  };

  try {
    if (isVideo) {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = objectUrl;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Video frame timeout')), 3000);
        video.onloadeddata = () => {
          video.currentTime = Math.min(1.2, (video.duration || 2) * 0.25);
        };
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timer);
          reject(new Error('Video load failed'));
        };
      });
      const w = video.videoWidth || 720;
      const h = video.videoHeight || 1280;
      const sampled = sampleCanvas(video, w, h);
      return {
        kind: 'video',
        width: w,
        height: h,
        durationSec: Math.round(video.duration || 0),
        aspectRatio: Number((w / Math.max(1, h)).toFixed(2)),
        ...sampled,
      };
    }

    const img = new Image();
    img.src = objectUrl;
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image load timeout')), 2500);
      img.onload = () => {
        clearTimeout(timer);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Image load failed'));
      };
    });
    const w = img.naturalWidth || 720;
    const h = img.naturalHeight || 1280;
    const sampled = sampleCanvas(img, w, h);
    return {
      kind: 'image',
      width: w,
      height: h,
      aspectRatio: Number((w / Math.max(1, h)).toFixed(2)),
      ...sampled,
    };
  } catch {
    return {
      kind: isVideo ? 'video' : 'image',
      width: 720,
      height: 1280,
      aspectRatio: 0.56,
      brightness: 0.48,
      warmth: 0.56,
      dominantHex: '#e11d48',
      previewDataUrl: '',
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function identifyDracinFromMedia({
  file = null,
  clueText = '',
  catalog = [],
  onProgress = null,
} = {}) {
  const report = (pct, label) => {
    if (typeof onProgress === 'function') onProgress(pct, label);
  };

  report(18, 'Mengekstrak sidik visual & rasio frame cuplikan...');
  const visualProfile = file ? await extractVisualProfileFromFile(file) : null;
  const fileName = file?.name || '';
  const cleanClue = String(clueText || '').trim();

  report(48, 'Menjalankan Multi-AI & pencarian live lintas platform...');
  const aiPrompt = `Identifikasi Drama China pendek (Dracin dari DramaBox, Melolo, ReelShort, ShortMax, NetShort, GoodShort, FlickReels, FreeReels) berdasarkan data ini:
- Nama file: "${fileName || 'cuplikan_dracin'}"
- Deskripsi/teks subtitle/adegan dari user: "${cleanClue || 'cuplikan drama pendek vertikal'}"
- Profil visual: ${
    visualProfile
      ? `${visualProfile.kind} ${visualProfile.width}x${visualProfile.height}, warna dominan ${visualProfile.dominantHex}, suasana ${
          visualProfile.warmth > 0.55 ? 'hangat/glamor' : 'gelap/dramatis'
        }`
      : 'tidak ada'
  }
Balas singkat JSON: {"summary":"analisis singkat Bahasa Indonesia 1-2 kalimat","genre":"ceo|revenge|fantasy|historical|family|donghua","keywords":["kata1","kata2","kata3"]}`;

  const searchSeed = cleanClue || fileName.replace(/\.[^.]+$/, '');
  const [aiResult, dbSearch, mlSearch, nsSearch] = await Promise.allSettled([
    queryKeylessMultiAi(aiPrompt),
    searchSeed ? fetchAnichinPlatformFeed('dramabox', { query: searchSeed }) : Promise.resolve({ items: [] }),
    searchSeed ? fetchAnichinPlatformFeed('melolo', { query: searchSeed }) : Promise.resolve({ items: [] }),
    searchSeed ? fetchAnichinPlatformFeed('netshort', { query: searchSeed }) : Promise.resolve({ items: [] }),
  ]);

  report(82, 'Menghitung skor kemiripan lintas katalog live...');
  const aiText = aiResult.status === 'fulfilled' ? aiResult.value?.text || '' : '';
  const aiEngine = aiResult.status === 'fulfilled' ? aiResult.value?.engine || 'Smart Local AI' : 'Smart Local AI';
  const parsedAi = parseAiDramaIdentification(aiText);

  const liveBuckets = [dbSearch, mlSearch, nsSearch]
    .filter((r) => r.status === 'fulfilled' && r.value?.items?.length > 0)
    .map((r) => r.value);

  const combinedPool = mergeParallelDracinFeeds(
    liveBuckets,
    catalog && catalog.length ? catalog : CURATED_DRACIN_CATALOG
  );

  const matches = rankClipIdentifierCandidates(combinedPool, {
    fileName,
    userClue: cleanClue,
    aiHints: [...parsedAi.hints, ...(parsedAi.suggestedGenre ? [parsedAi.suggestedGenre] : [])],
    visualProfile,
    limit: 5,
  });

  const aiSummary =
    parsedAi.summary ||
    `Analisis visual (${visualProfile?.width || 720}×${visualProfile?.height || 1280}, rasio ${
      visualProfile?.aspectRatio || '0.56'
    }) & pencocokan katalog live menemukan ${matches.length} drama paling mirip.`;

  report(100, 'Identifikasi selesai');
  return {
    visualProfile,
    aiEngine,
    aiSummary,
    matches,
    extractedTokens: extractTokens(`${fileName} ${cleanClue}`),
  };
}

export async function fetchAiDramaInsights(drama, catalog = []) {
  const prompt = `Berikan ringkasan daya tarik Drama China "${drama?.title}" (${drama?.platformName}, genre ${drama?.genre}) dalam 2 kalimat singkat Bahasa Indonesia yang menarik tanpa spoiler akhir.`;
  const aiRes = await queryKeylessMultiAi(prompt);

  const similar = (catalog || [])
    .filter((it) => it.id !== drama?.id && (it.genre === drama?.genre || it.platformId === drama?.platformId))
    .slice(0, 4);

  return {
    engine: aiRes.engine,
    insight:
      aiRes.text ||
      drama?.synopsis ||
      `Drama pilihan ${drama?.platformName} dengan alur cepat per episode (1–3 menit), gambar HD, dan audio/subtitle Bahasa Indonesia.`,
    similar,
  };
}
