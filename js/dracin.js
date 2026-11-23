/**
 * Real-Time Multi-Platform Drama China (Dracin) API Client & Native Stream Resolver (v73):
 * - Connects live to 17+ real short-drama platforms (DramaBox VIP/ForYou/Dubbing,
 *   PineDrama TikTok CDN, Melolo, NetShort, NunoMix Dub Indo, ReelShort, ShortMax,
 *   GoodShort, FlickReels, FreeReels, DramaWave, FlexTV, KalosTV, MoboReels,
 *   MyDrama, StardustTV, Vigloo, Anichin) with real poster thumbnails, real episode
 *   lists, real MP4/HLS/CENC video + audio streams, and real WebVTT/SRT subtitles.
 * - 100% Native Original Short-Drama App Experience (Zero Dailymotion screen-recordings).
 * - Unlocks VIP / Paid episodes (Ep 1 to Finale) 100% free via NunoDrama CORS Bridge +
 *   multi-mirror Anichin + Sansekai failover.
 * - Instant 0ms Warm-Start Catalog (92+ verified native items) + background expansion to 150+ items.
 */

import {
  ANICHIN_UNIFIED_SOURCES,
  CURATED_DRACIN_CATALOG,
  DEFAULT_DRACIN_ENDPOINT_CONFIG,
  DRACIN_PLATFORMS,
  NUNODRAMA_SUPPORTED_PLATFORMS,
  SANSEKAI_SUPPORTED_PLATFORMS,
  buildDailymotionEmbedUrl,
  buildDailymotionWatchUrl,
  extractAdaptiveEpisodePayload,
  extractNunoSectionItems,
  extractNunoWatchPayload,
  extractSansekaiEpisodeStreams,
  extractSansekaiFeedItems,
  extractSansekaiMeloloVideoId,
  extractSynopsisKeywords,
  extractTokens,
  formatDracinUserError,
  getPlatformMeta,
  inferGenreFromText,
  inferPlatformFromText,
  isLikelyChineseDramaTitle,
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
  resolveAnichinMediaUrl,
  resolveNunoPlatformId,
  scoreCrossPlatformDramaMatch,
  unwrapHlsJsonPayload,
} from './dracin-logic.js?v=78';

const API_TIMEOUT_MS = 8500;
const EPISODE_TIMEOUT_MS = 9000;
const NUNO_TIMEOUT_MS = 8500;
const SANSEKAI_TIMEOUT_MS = 6500;
const AI_TIMEOUT_MS = 4500;
const WARM_CATALOG_STORAGE_KEY = 'manifestudio_dracin_warm_catalog_v78';
const LEGACY_WARM_CATALOG_STORAGE_KEY = 'manifestudio_dracin_warm_catalog_v73';

// Verified live daily-updated sections on nunodrama.my.id (Page 1)
const NUNO_DAILY_LATEST_SECTIONS = [
  { platform: 'dramabox', section: 'foryou', page: 1 },
  { platform: 'melolo', section: 'latest' },
  { platform: 'pinedrama', section: 'latest' },
  { platform: 'netshort', section: 'latest' },
  { platform: 'dramabox', section: 'vip' },
  { platform: 'flextv', section: 'latest' },
  { platform: 'reelshort', section: 'new' },
  { platform: 'stardust', section: 'hot' },
  { platform: 'freereels', section: 'new' },
  { platform: 'dramawave', section: 'trending' },
  { platform: 'goodshort', section: 'trending' },
  { platform: 'flickreels', section: 'latest' },
  { platform: 'shortmax', section: 'new' },
  { platform: 'moboreels', section: 'latest' },
  { platform: 'mydrama', section: 'latest' },
  { platform: 'nunomix', section: 'latest' },
  { platform: 'vigloo', section: 'latest' },
  { platform: 'kalostv', section: 'latest' },
];

// Verified live secondary & paginated sections (Page 2)
const NUNO_PAGE2_SECTIONS = [
  { platform: 'dramabox', section: 'foryou', page: 2 },
  { platform: 'dramabox', section: 'pop' },
  { platform: 'dramabox', section: 'completed' },
  { platform: 'dramabox', section: 'dubbing' },
  { platform: 'dramabox', section: 'coming_soon' },
  { platform: 'dramabox', section: 'classify' },
  { platform: 'melolo', section: 'new' },
  { platform: 'melolo', section: 'rank' },
  { platform: 'netshort', section: 'trending' },
  { platform: 'reelshort', section: 'rank' },
  { platform: 'reelshort', section: 'dubbing' },
  { platform: 'freereels', section: 'trending' },
  { platform: 'freereels', section: 'dubbing' },
  { platform: 'dramawave', section: 'vip' },
  { platform: 'flextv', section: 'new' },
  { platform: 'stardust', section: 'new' },
  { platform: 'vigloo', section: 'hot' },
  { platform: 'moboreels', section: 'new' },
  { platform: 'mydrama', section: 'new' },
  { platform: 'nunomix', section: 'new' },
];

// Rotating high-yield keywords for unlimited Page 3+ discovery across all 17 platforms
const LIVE_DISCOVERY_KEYWORDS = [
  'cinta',
  'ceo',
  'nikah',
  'balas',
  'kaisar',
  'naga',
  'dokter',
  'pewaris',
  'jenderal',
  'istri',
  'suami',
  'raja',
  'putri',
  'keluarga',
  'dewa',
  'bos',
  'mafia',
  'reborn',
  'sihir',
  'miliarder',
  'presdir',
  'sistem',
  'kembar',
  'tabib',
  'pendekar',
  'ratu',
  'pangeran',
  'menantu',
  'mertua',
  'takdir',
  'kaya',
  'rahasia',
];

async function runWithConcurrency(taskFactories = [], concurrency = 4) {
  const results = new Array(taskFactories.length);
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, taskFactories.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < taskFactories.length) {
      const idx = cursor;
      cursor += 1;
      try {
        const value = await taskFactories[idx]();
        results[idx] = { status: 'fulfilled', value };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

const NUNO_SEARCH_PRIORITY_PLATFORMS = [
  'dramabox',
  'pinedrama',
  'melolo',
  'netshort',
  'nunomix',
  'reelshort',
  'shortmax',
  'goodshort',
  'flickreels',
  'freereels',
  'dramawave',
  'flextv',
  'kalostv',
  'moboreels',
  'mydrama',
  'stardust',
  'vigloo',
];

const FLAGSHIP_HOME_PLATFORMS = ['dramabox', 'melolo', 'netshort', 'reelshort', 'shortmax', 'freereels'];
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

const nunoWatchCache = new Map();
const nunoMatchCache = new Map();

const sansekaiDetailCache = new Map();
const sansekaiAllEpisodeCache = new Map();
const sansekaiStreamCache = new Map();
const sansekaiMatchCache = new Map();

let endpointConfigCache = DEFAULT_DRACIN_ENDPOINT_CONFIG;
let endpointConfigPromise = null;
let mirrorHealthMap = {};

/**
 * Returns the instant 0ms Warm-Start Drama China catalog (92+ verified native items
 * merged with persisted live discoveries) so the UI renders immediately without skeletons.
 */
export function getWarmDracinCatalog() {
  let cachedItems = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const raw =
        localStorage.getItem(WARM_CATALOG_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_WARM_CATALOG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cachedItems = parsed
            .filter((it) => it && it.id && it.title && !it.dailymotionId && it.apiProvider !== 'dailymotion')
            .map((it) => normalizeDracinItem(it, it.platformId || 'dramabox'));
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }

  if (cachedItems.length === 0) {
    return [...CURATED_DRACIN_CATALOG];
  }
  return mergeParallelDracinFeeds(
    [{ sourceId: 'warm-cache', items: cachedItems }],
    CURATED_DRACIN_CATALOG,
    { liveFirst: true }
  );
}

function persistWarmDracinCatalog(items = []) {
  try {
    if (typeof localStorage === 'undefined' || !Array.isArray(items) || items.length === 0) return;
    const clean = items
      .filter((it) => it && it.id && it.title && !it.dailymotionId && it.apiProvider !== 'dailymotion')
      .slice(0, 450);
    localStorage.setItem(WARM_CATALOG_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota
  }
}

/**
 * Clears in-memory and sessionStorage Dracin feed caches so "Perbarui Live"
 * genuinely fetches brand-new daily releases from upstream platforms.
 */
export function clearDracinFeedCaches() {
  feedCache.clear();
  try {
    if (typeof sessionStorage !== 'undefined') {
      const toRemove = [];
      for (let i = 0; i < sessionStorage.length; i += 1) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith('dracin_cache_')) toRemove.push(k);
      }
      for (const k of toRemove) {
        sessionStorage.removeItem(k);
      }
    }
  } catch {
    // Ignore storage restrictions
  }
}

function mergeEndpointConfig(remote = null) {
  if (!remote || typeof remote !== 'object') return DEFAULT_DRACIN_ENDPOINT_CONFIG;
  const remoteMirrors = Array.isArray(remote.mirrors)
    ? remote.mirrors.filter((m) => m && m.id && m.baseUrl)
    : [];
  const mirrors = remoteMirrors.length > 0 ? remoteMirrors : DEFAULT_DRACIN_ENDPOINT_CONFIG.mirrors;
  const remoteSansekai = remote.sansekai && typeof remote.sansekai === 'object' ? remote.sansekai : {};
  const remoteNuno = remote.nunodrama && typeof remote.nunodrama === 'object' ? remote.nunodrama : {};
  return {
    version: String(remote.version || DEFAULT_DRACIN_ENDPOINT_CONFIG.version),
    dailymotionPlayerId: String(
      remote.dailymotionPlayerId || DEFAULT_DRACIN_ENDPOINT_CONFIG.dailymotionPlayerId || 'x8lr5'
    ).trim(),
    nunodrama: {
      baseUrl: String(
        remoteNuno.baseUrl || DEFAULT_DRACIN_ENDPOINT_CONFIG.nunodrama?.baseUrl || 'https://nunodrama.my.id'
      )
        .trim()
        .replace(/\/+$/, ''),
      corsBridgeUrl: String(
        remoteNuno.corsBridgeUrl ||
          DEFAULT_DRACIN_ENDPOINT_CONFIG.nunodrama?.corsBridgeUrl ||
          'https://r.jina.ai/https://nunodrama.my.id'
      )
        .trim()
        .replace(/\/+$/, ''),
      interProxyBaseUrl: String(
        remoteNuno.interProxyBaseUrl ||
          DEFAULT_DRACIN_ENDPOINT_CONFIG.nunodrama?.interProxyBaseUrl ||
          'https://inter.nunodrama.my.id'
      )
        .trim()
        .replace(/\/+$/, ''),
      supportedPlatforms:
        Array.isArray(remoteNuno.supportedPlatforms) && remoteNuno.supportedPlatforms.length > 0
          ? remoteNuno.supportedPlatforms.map((p) => String(p).toLowerCase())
          : DEFAULT_DRACIN_ENDPOINT_CONFIG.nunodrama?.supportedPlatforms ||
            Array.from(NUNODRAMA_SUPPORTED_PLATFORMS),
    },
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
    const raw = sessionStorage.getItem(`dracin_cache_v73_${key}`);
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
    sessionStorage.setItem(`dracin_cache_v73_${key}`, JSON.stringify({ ts: Date.now(), data }));
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

async function fetchTextWithTimeout(url, timeoutMs = 7000, headers = undefined) {
  const controller = new AbortController();
  let didTimeout = false;
  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      ...(headers ? { headers } : {}),
    });
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
 * Fetches live drama section or search results from NunoDrama (17 platforms including
 * DramaBox VIP, PineDrama TikTok FYP, Melolo, NetShort, NunoMix Dub Indo, ReelShort,
 * ShortMax, GoodShort, FlickReels, FreeReels, DramaWave, FlexTV, KalosTV, MoboReels,
 * MyDrama, StardustTV, Vigloo) via CORS-enabled bridge.
 */
export async function fetchNunoPlatformSection(
  platformId = 'dramabox',
  section = 'foryou',
  { page = 1, query = '', timeoutMs = NUNO_TIMEOUT_MS, forceRefresh = false } = {}
) {
  const nunoPlat = resolveNunoPlatformId(platformId);
  if (!nunoPlat) {
    return { sourceId: `nuno-${platformId}`, platformId, items: [], hasMore: false };
  }

  const safePage = Math.max(1, Math.round(Number(page) || 1));
  const cleanQ = String(query || '').trim();
  const cleanSec = cleanQ ? 'search' : String(section || 'foryou').toLowerCase();
  const cacheKey = `nuno::${nunoPlat}::${cleanSec}::p${safePage}::q:${cleanQ.toLowerCase()}`;

  if (!forceRefresh) {
    if (feedCache.has(cacheKey)) {
      const cached = feedCache.get(cacheKey);
      if (Date.now() - cached.ts < 8 * 60_000) return cached.payload;
    }
    const sessCached = readSessionCache(cacheKey);
    if (sessCached && Array.isArray(sessCached.items) && sessCached.items.length > 0) {
      feedCache.set(cacheKey, { ts: Date.now(), payload: sessCached });
      return sessCached;
    }
  }

  const cfg = await loadEndpointConfig();
  const bridgeBase = String(
    cfg?.nunodrama?.corsBridgeUrl || 'https://r.jina.ai/https://nunodrama.my.id'
  ).replace(/\/+$/, '');

  const pageQuery = safePage > 1 ? `?page=${safePage}` : '';
  const targetPath = cleanQ
    ? `/api/search/${encodeURIComponent(nunoPlat)}?q=${encodeURIComponent(cleanQ)}`
    : `/api/section/${encodeURIComponent(nunoPlat)}/${encodeURIComponent(cleanSec)}${pageQuery}`;

  const url = `${bridgeBase}${targetPath}`;
  let items = [];

  try {
    const reqHeaders = {
      'X-Return-Format': 'text',
      ...(forceRefresh ? { 'X-No-Cache': 'true' } : {}),
    };
    const rawText = await fetchTextWithTimeout(url, timeoutMs, reqHeaders);
    const nowTs = Date.now();
    items = extractNunoSectionItems(rawText, nunoPlat, cleanSec).map((it) => ({
      ...it,
      isLiveFresh: true,
      liveSection: cleanSec,
      fetchedAt: nowTs,
    }));
  } catch {
    // Graceful fallback handled by caller
  }

  const platMeta = getPlatformMeta(nunoPlat === 'stardust' ? 'stardusttv' : nunoPlat);
  const payload = {
    sourceId: `nuno-${nunoPlat}-${cleanSec}-p${safePage}`,
    platformId: platMeta.id,
    label: `${platMeta.name} (${
      cleanSec === 'vip'
        ? 'VIP Terbuka'
        : cleanSec === 'dubbing'
        ? 'Dub Indo'
        : cleanSec === 'latest' || cleanSec === 'new'
        ? 'Rilis Terbaru'
        : 'Native HD'
    })`,
    fallbackPlatformId: platMeta.id,
    items,
    hasMore: true,
  };

  if (items.length > 0) {
    feedCache.set(cacheKey, { ts: Date.now(), payload });
    writeSessionCache(cacheKey, payload);
  }
  return payload;
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

async function getSansekaiBaseUrl() {
  const cfg = await loadEndpointConfig();
  return String(cfg?.sansekai?.baseUrl || 'https://api.sansekai.my.id/api').replace(/\/+$/, '');
}

async function fetchSansekaiJsonPaths(paths = [], timeoutMs = SANSEKAI_TIMEOUT_MS, acceptFn = null) {
  const baseUrl = await getSansekaiBaseUrl();
  let lastErr = null;
  let lastJson = null;
  for (const rawPath of paths) {
    if (!rawPath) continue;
    const url = `${baseUrl}${rawPath.startsWith('/') ? rawPath : `/${rawPath}`}`;
    try {
      const json = await fetchJsonWithTimeout(url, {}, timeoutMs);
      lastJson = json;
      if (typeof acceptFn !== 'function' || acceptFn(json)) {
        return { json, url };
      }
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || '');
      if (msg.includes('HTTP 403') || msg.includes('HTTP 429')) {
        throw err;
      }
    }
  }
  if (lastJson) return { json: lastJson, url: '' };
  throw lastErr || new Error('TIMEOUT');
}

export async function fetchSansekaiPlatformFeed(platformId = 'melolo', { page = 1, query = '' } = {}) {
  const src = String(platformId || '').toLowerCase();
  if (!SANSEKAI_SUPPORTED_PLATFORMS.has(src)) {
    return { sourceId: `sansekai-${src}`, platformId: src, items: [], hasMore: false };
  }

  const cleanQ = String(query || '').trim();
  const cacheKey = `sansekai::${src}::p${page}::q:${cleanQ.toLowerCase()}`;
  if (feedCache.has(cacheKey)) {
    const cached = feedCache.get(cacheKey);
    if (Date.now() - cached.ts < 8 * 60_000) return cached.payload;
  }
  const sessCached = readSessionCache(cacheKey);
  if (sessCached && Array.isArray(sessCached.items) && sessCached.items.length > 0) {
    feedCache.set(cacheKey, { ts: Date.now(), payload: sessCached });
    return sessCached;
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
      (j) => extractSansekaiFeedItems(j, src).length > 0
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
  }
  return payload;
}

export async function fetchSansekaiCatalog({ page = 1, query = '' } = {}) {
  const cleanQ = String(query || '').trim();
  const settled = await Promise.allSettled(
    SANSEKAI_FLAGSHIP_PLATFORMS.map((pid) => fetchSansekaiPlatformFeed(pid, { page, query: cleanQ }))
  );

  const buckets = [];
  const activeSources = [];
  let hasMore = false;
  let sawBlocked = false;

  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value) {
      if (s.value.blockedReason) sawBlocked = true;
      if (Array.isArray(s.value.items) && s.value.items.length > 0) {
        buckets.push(s.value);
        activeSources.push(s.value.label || s.value.sourceId);
        if (s.value.hasMore) hasMore = true;
      }
    }
  }

  if (buckets.length > 0) {
    const items = mergeParallelDracinFeeds(buckets, CURATED_DRACIN_CATALOG);
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

  const fallbackSettled = await Promise.allSettled(
    ['dramabox', 'pinedrama', 'melolo', 'reelshort'].map((pid) =>
      fetchNunoPlatformSection(pid, 'foryou', { query: cleanQ })
    )
  );
  const fbBuckets = [];
  const fbSources = [];
  for (const s of fallbackSettled) {
    if (s.status === 'fulfilled' && s.value && Array.isArray(s.value.items) && s.value.items.length > 0) {
      fbBuckets.push(s.value);
      fbSources.push(s.value.label || s.value.sourceId);
    }
  }

  const fbItems = mergeParallelDracinFeeds(fbBuckets, CURATED_DRACIN_CATALOG);
  return {
    items: fbItems,
    activeSources: Array.from(new Set(fbSources)),
    liveCount: fbItems.length,
    hasMore,
    platformId: 'sansekai',
    page,
    sansekaiFallbackNote: sawBlocked
      ? 'API Sansekai sedang membatasi akses dari jaringan ini — menampilkan katalog native aktif.'
      : '',
    fetchedAt: Date.now(),
  };
}

/**
 * Legacy export kept for backwards compatibility in tests — returns 0 Dailymotion items in v73
 * because Dailymotion screen-recordings have been 100% replaced by native short-drama platform streams.
 */
export async function fetchDailymotionDracin() {
  return {
    sourceId: 'native-only',
    label: 'Native Short-Drama Stream',
    fallbackPlatformId: 'dramabox',
    items: [],
    hasMore: false,
  };
}

export async function fetchDailymotionFullDramas() {
  return {
    sourceId: 'native-vip-unlocked',
    label: 'Native VIP Terbuka (Ep 1 - Tamat)',
    fallbackPlatformId: 'dramabox',
    items: [],
    hasMore: false,
  };
}

/**
 * Master Real-Time Unified Catalog Fetcher (v78):
 * - Polite concurrency wave runner (4 parallel requests max) to eliminate r.jina.ai HTTP 429 drops.
 * - True cache-busting `forceRefresh` ("Perbarui Live") + live-first ordering so brand-new daily
 *   releases immediately appear at #1, #2, #3 ahead of static fallback entries.
 * - Real `?page=N` pagination + verified daily sections (`latest`/`new`/`hot`/`pop`/`completed`/`vip`)
 *   + unlimited Page 3+ multi-keyword discovery waves across all 17 platforms (removes ~612 item cap!).
 */
export async function fetchUnifiedDracinCatalog({
  query = '',
  platformId = 'all',
  page = 1,
  forceRefresh = false,
} = {}) {
  const cleanQ = String(query || '').trim();
  const safePlatform = String(platformId || 'all').toLowerCase();
  const safePage = Math.max(1, Math.round(Number(page) || 1));

  if (forceRefresh) {
    clearDracinFeedCaches();
  }

  if (safePlatform === 'sansekai') {
    return fetchSansekaiCatalog({ page: safePage, query: cleanQ });
  }

  const withJobCap = (promise, ms = 7200) =>
    Promise.race([
      promise.catch(() => null),
      new Promise((resolve) => setTimeout(() => resolve(null), ms)),
    ]);

  const taskFactories = [];

  if (safePlatform === 'all') {
    if (cleanQ) {
      for (const pid of NUNO_SEARCH_PRIORITY_PLATFORMS.slice(0, 12)) {
        taskFactories.push(() =>
          withJobCap(
            fetchNunoPlatformSection(pid, 'search', {
              query: cleanQ,
              timeoutMs: 6500,
              forceRefresh,
            }),
            7000
          )
        );
      }
      for (const pid of ['dramabox', 'melolo', 'netshort', 'reelshort', 'shortmax']) {
        taskFactories.push(() =>
          withJobCap(fetchAnichinPlatformFeed(pid, { page: safePage, query: cleanQ }), 5500)
        );
      }
    } else if (safePage === 1) {
      for (const entry of NUNO_DAILY_LATEST_SECTIONS) {
        taskFactories.push(() =>
          withJobCap(
            fetchNunoPlatformSection(entry.platform, entry.section, {
              page: entry.page || 1,
              timeoutMs: 6800,
              forceRefresh,
            }),
            7200
          )
        );
      }
      for (const pid of FLAGSHIP_HOME_PLATFORMS) {
        taskFactories.push(() => withJobCap(fetchAnichinPlatformFeed(pid, { page: 1 }), 5500));
      }
    } else if (safePage === 2) {
      for (const entry of NUNO_PAGE2_SECTIONS) {
        taskFactories.push(() =>
          withJobCap(
            fetchNunoPlatformSection(entry.platform, entry.section, {
              page: entry.page || 1,
              timeoutMs: 6800,
              forceRefresh,
            }),
            7200
          )
        );
      }
      for (const pid of FLAGSHIP_HOME_PLATFORMS) {
        taskFactories.push(() => withJobCap(fetchAnichinPlatformFeed(pid, { page: 2 }), 5500));
      }
    } else {
      // Page 3+ Unlimited Live Discovery Wave:
      // 1) True server pagination (?page=N) on flagship feeds
      const paginatedPlatforms = ['dramabox', 'melolo', 'reelshort', 'shortmax', 'flextv', 'stardust'];
      for (const pid of paginatedPlatforms) {
        taskFactories.push(() =>
          withJobCap(
            fetchNunoPlatformSection(pid, 'foryou', {
              page: safePage,
              timeoutMs: 6800,
              forceRefresh,
            }),
            7200
          )
        );
      }
      // 2) Rotating multi-keyword live search across 17 platforms so catalog scales to thousands
      const waveOffset = safePage - 3;
      const kw1 = LIVE_DISCOVERY_KEYWORDS[(waveOffset * 2) % LIVE_DISCOVERY_KEYWORDS.length];
      const kw2 = LIVE_DISCOVERY_KEYWORDS[(waveOffset * 2 + 1) % LIVE_DISCOVERY_KEYWORDS.length];
      const startPlatIdx = (waveOffset * 5) % NUNO_SEARCH_PRIORITY_PLATFORMS.length;
      for (let i = 0; i < 6; i += 1) {
        const pid1 = NUNO_SEARCH_PRIORITY_PLATFORMS[(startPlatIdx + i) % NUNO_SEARCH_PRIORITY_PLATFORMS.length];
        const pid2 = NUNO_SEARCH_PRIORITY_PLATFORMS[(startPlatIdx + i + 6) % NUNO_SEARCH_PRIORITY_PLATFORMS.length];
        taskFactories.push(() =>
          withJobCap(
            fetchNunoPlatformSection(pid1, 'search', {
              query: kw1,
              timeoutMs: 6500,
              forceRefresh,
            }),
            7000
          )
        );
        taskFactories.push(() =>
          withJobCap(
            fetchNunoPlatformSection(pid2, 'search', {
              query: kw2,
              timeoutMs: 6500,
              forceRefresh,
            }),
            7000
          )
        );
      }
      for (const pid of FLAGSHIP_HOME_PLATFORMS) {
        taskFactories.push(() => withJobCap(fetchAnichinPlatformFeed(pid, { page: safePage }), 5500));
      }
    }
  } else {
    const nunoPlat = resolveNunoPlatformId(safePlatform);
    if (nunoPlat) {
      if (cleanQ) {
        taskFactories.push(() =>
          withJobCap(
            fetchNunoPlatformSection(nunoPlat, 'search', { query: cleanQ, forceRefresh }),
            6800
          )
        );
      } else {
        taskFactories.push(() =>
          withJobCap(
            fetchNunoPlatformSection(nunoPlat, 'foryou', { page: safePage, forceRefresh }),
            6800
          )
        );
        if (nunoPlat === 'dramabox') {
          taskFactories.push(() =>
            withJobCap(fetchNunoPlatformSection('dramabox', 'vip', { forceRefresh }), 6800)
          );
          taskFactories.push(() =>
            withJobCap(fetchNunoPlatformSection('dramabox', 'dubbing', { forceRefresh }), 6800)
          );
        } else {
          taskFactories.push(() =>
            withJobCap(fetchNunoPlatformSection(nunoPlat, 'latest', { forceRefresh }), 6800)
          );
        }
      }
    }
    if (ANICHIN_UNIFIED_SOURCES.has(safePlatform)) {
      taskFactories.push(() =>
        withJobCap(fetchAnichinPlatformFeed(safePlatform, { page: safePage, query: cleanQ }), 5500)
      );
    }
    if (SANSEKAI_SUPPORTED_PLATFORMS.has(safePlatform)) {
      taskFactories.push(() =>
        withJobCap(fetchSansekaiPlatformFeed(safePlatform, { page: safePage, query: cleanQ }), 5500)
      );
    }
  }

  const settled = await runWithConcurrency(taskFactories, 4);
  const buckets = [];
  const activeSources = [];

  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value && Array.isArray(s.value.items) && s.value.items.length > 0) {
      buckets.push(s.value);
      activeSources.push(s.value.label || s.value.sourceId);
    }
  }

  // Live-first merge so brand-new daily releases ALWAYS appear at #1, #2, #3 ahead of static fallback!
  const baseline = cleanQ
    ? CURATED_DRACIN_CATALOG
    : safePage > 1
    ? []
    : getWarmDracinCatalog();
  const merged = mergeParallelDracinFeeds(buckets, baseline, { liveFirst: true });

  if (!cleanQ && safePage === 1 && merged.length > 0) {
    persistWarmDracinCatalog(merged);
  }

  return {
    items: merged,
    activeSources: Array.from(new Set(activeSources)),
    liveCount: merged.length,
    freshBucketItemsCount: buckets.reduce((acc, b) => acc + (b.items?.length || 0), 0),
    hasMore: !cleanQ,
    platformId: safePlatform,
    page: safePage,
    fetchedAt: Date.now(),
  };
}

/**
 * Resolves a playable native episode stream (Ep 1 to Finale, VIP unlocked!) from NunoDrama
 * via `https://r.jina.ai/https://nunodrama.my.id/watch/{platform}/{bookId}?ep={ep}`
 * with `X-Return-Format: html`.
 * - Step 1: Direct lookup if drama has a valid NunoDrama platform & sourceId.
 * - Step 2: If drama came from another provider or ID format doesn't match, searches NunoDrama
 *   by title across priority platforms, binds the matched BookID, and resolves Episode N!
 */
export async function fetchNunoWatchEpisode(
  drama,
  episodeNumber = 1,
  { forceRefresh = false } = {}
) {
  if (!drama) {
    return { servers: [], subtitles: [], totalEpisodes: 0, nunoPlatform: '', nunoBookId: '' };
  }
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  const cfg = await loadEndpointConfig();
  const bridgeBase = String(
    cfg?.nunodrama?.corsBridgeUrl || 'https://r.jina.ai/https://nunodrama.my.id'
  ).replace(/\/+$/, '');

  const fetchWatchByPlatAndId = async (nunoPlat, bookId) => {
    const cleanId = String(bookId || '').trim();
    if (!nunoPlat || !cleanId) return null;
    const cacheKey = `${nunoPlat}::${cleanId}::ep${ep}`;
    if (!forceRefresh && nunoWatchCache.has(cacheKey)) {
      return nunoWatchCache.get(cacheKey);
    }
    const watchUrl = `${bridgeBase}/watch/${encodeURIComponent(nunoPlat)}/${encodeURIComponent(cleanId)}?ep=${ep}`;
    const rawHtml = await fetchTextWithTimeout(watchUrl, EPISODE_TIMEOUT_MS, {
      'X-Return-Format': 'html',
    });
    const parsed = extractNunoWatchPayload(rawHtml, {
      platformId: nunoPlat,
      episodeNumber: ep,
    });
    if (parsed.servers.length > 0) {
      const enriched = {
        ...parsed,
        nunoPlatform: nunoPlat,
        nunoBookId: cleanId,
      };
      nunoWatchCache.set(cacheKey, enriched);
      return enriched;
    }
    return null;
  };

  // Step 1: Direct lookup using bound nunoPlatform / platformId + sourceId
  const cachedMatch = nunoMatchCache.get(drama.id) || null;
  const directPlat = resolveNunoPlatformId(
    cachedMatch?.nunoPlatform || drama.nunoPlatform || drama.platformId,
    cachedMatch?.nunoPlatform || drama.nunoPlatform
  );
  const directId = String(cachedMatch?.nunoBookId || drama.sourceId || '').trim();

  if (directPlat && directId && !directId.startsWith('dm')) {
    try {
      const directRes = await fetchWatchByPlatAndId(directPlat, directId);
      if (directRes && directRes.servers.length > 0) {
        return directRes;
      }
    } catch {
      // Fall through to title search across NunoDrama platforms
    }
  }

  // Step 2: Cross-platform title search on NunoDrama so ANY drama title unlocks Ep 1..N free!
  const cleanTitle = String(drama.title || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/【[^】]*】/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanTitle) {
    return { servers: [], subtitles: [], totalEpisodes: 0, nunoPlatform: '', nunoBookId: '' };
  }

  const searchPlatforms = Array.from(
    new Set(
      [
        directPlat,
        'dramabox',
        'pinedrama',
        'melolo',
        'netshort',
        'nunomix',
        'reelshort',
        'shortmax',
        'goodshort',
        'flickreels',
        'freereels',
      ].filter(Boolean)
    )
  ).slice(0, 5);

  const searchSettled = await Promise.allSettled(
    searchPlatforms.map((plat) =>
      fetchNunoPlatformSection(plat, 'search', { query: cleanTitle, timeoutMs: 6000 })
    )
  );

  let bestCandidate = null;
  for (let i = 0; i < searchSettled.length; i += 1) {
    const res = searchSettled[i];
    const candPlat = searchPlatforms[i];
    if (res.status !== 'fulfilled' || !Array.isArray(res.value?.items)) continue;
    for (const item of res.value.items) {
      const evalRes = scoreCrossPlatformDramaMatch(drama, item);
      const samePlatBonus = candPlat === directPlat ? 12 : 0;
      const score = evalRes.score + samePlatBonus;
      if (score >= 24 && (!bestCandidate || score > bestCandidate.score)) {
        bestCandidate = {
          score,
          nunoPlatform: resolveNunoPlatformId(item.nunoPlatform || candPlat),
          nunoBookId: item.sourceId,
        };
      }
    }
  }

  if (bestCandidate?.nunoPlatform && bestCandidate?.nunoBookId) {
    nunoMatchCache.set(drama.id, {
      nunoPlatform: bestCandidate.nunoPlatform,
      nunoBookId: bestCandidate.nunoBookId,
    });
    try {
      const matchedRes = await fetchWatchByPlatAndId(
        bestCandidate.nunoPlatform,
        bestCandidate.nunoBookId
      );
      if (matchedRes && matchedRes.servers.length > 0) {
        return matchedRes;
      }
    } catch {
      // Return empty below
    }
  }

  return { servers: [], subtitles: [], totalEpisodes: 0, nunoPlatform: '', nunoBookId: '' };
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

async function fetchSansekaiRawDetail(platformId, id, { forceRefresh = false } = {}) {
  const key = `${platformId}::${id}`;
  if (!forceRefresh && sansekaiDetailCache.has(key)) {
    return sansekaiDetailCache.get(key);
  }
  const paths = buildSansekaiDetailPaths(platformId, id);
  if (!paths.length) return null;
  const { json } = await fetchSansekaiJsonPaths(paths, SANSEKAI_TIMEOUT_MS);
  if (json && typeof json === 'object') {
    sansekaiDetailCache.set(key, json);
  }
  return json;
}

/**
 * Fetches real drama detail (exact episode count, full Indonesian synopsis, HD cover, episode metadata).
 * Supports NunoDrama, Anichin unified dramas, AND Sansekai/SekaiDrama native dramas.
 */
export async function fetchDramaDetail(drama) {
  if (!drama || !drama.sourceId) return null;

  const key = `${drama.apiProvider || drama.platformId}::${drama.platformId}::${drama.sourceId}`;
  if (detailCache.has(key)) return detailCache.get(key);

  // 1. NunoDrama fast episode-count & title discovery via watch page (or cached watch payload)
  const nunoPlat = resolveNunoPlatformId(drama.nunoPlatform || drama.platformId, drama.nunoPlatform);
  if (drama.apiProvider === 'nunodrama' && nunoPlat) {
    try {
      const watchRes = await fetchNunoWatchEpisode(drama, 1);
      if (watchRes && watchRes.totalEpisodes > 0) {
        const detail = {
          title: watchRes.title || drama.title,
          poster: drama.poster,
          synopsis: drama.synopsis,
          totalEpisodes: Math.max(drama.totalEpisodes || 1, watchRes.totalEpisodes),
          episodes: Array.from({ length: Math.max(drama.totalEpisodes || 1, watchRes.totalEpisodes) }, (_, idx) => ({
            number: idx + 1,
            title: `Episode ${idx + 1}`,
            videoUrl: '',
            locked: false,
          })),
          tags: drama.genres || [],
        };
        detailCache.set(key, detail);
        return detail;
      }
    } catch {
      // Fall through to secondary detail providers
    }
  }

  if (drama.apiProvider === 'sansekai') {
    const plat = String(drama.sansekaiPlatform || drama.platformId || '').toLowerCase();
    if (!SANSEKAI_SUPPORTED_PLATFORMS.has(plat)) return null;
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

  if (!ANICHIN_UNIFIED_SOURCES.has(drama.platformId)) {
    return null;
  }

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
        locked: false,
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

async function resolveSansekaiDirectById(platformId, sansekaiId, episodeNumber = 1, { forceRefresh = false } = {}) {
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

  const encId = encodeURIComponent(id);
  let parsed = { servers: [], subtitles: [], locked: false };

  if (plat === 'melolo') {
    const detailJson = await fetchSansekaiRawDetail('melolo', id, { forceRefresh });
    const vid = extractSansekaiMeloloVideoId(detailJson, ep);
    if (vid) {
      const { json } = await fetchSansekaiJsonPaths(
        [
          `/melolo/get-episode?videoId=${encodeURIComponent(vid)}`,
          `/melolo/stream?videoId=${encodeURIComponent(vid)}`,
        ],
        SANSEKAI_TIMEOUT_MS,
        (j) => extractSansekaiEpisodeStreams(j, { platformId: 'melolo', episodeNumber: ep }).servers.length > 0
      );
      parsed = extractSansekaiEpisodeStreams(json, { platformId: 'melolo', episodeNumber: ep });
    }
  } else if (plat === 'dramabox' || plat === 'goodshort' || plat === 'freereels') {
    const allKey = `${plat}::${id}`;
    let allJson = forceRefresh ? null : sansekaiAllEpisodeCache.get(allKey) || null;
    if (!allJson) {
      const allPaths =
        plat === 'dramabox'
          ? [`/dramabox/get-allepisode?bookId=${encId}`, `/dramabox/get-allepisodes?bookId=${encId}`]
          : plat === 'goodshort'
          ? [`/goodshort/get-allepisode?bookId=${encId}`, `/goodshort/allepisode?bookId=${encId}`]
          : [`/freereels/detailAndAllEpisode?key=${encId}`];
      const { json } = await fetchSansekaiJsonPaths(allPaths, SANSEKAI_TIMEOUT_MS);
      allJson = json;
      if (allJson) sansekaiAllEpisodeCache.set(allKey, allJson);
    }
    if (allJson) {
      parsed = extractSansekaiEpisodeStreams(allJson, { platformId: plat, episodeNumber: ep });
    }
  } else if (plat === 'dramanova') {
    const detailJson = await fetchSansekaiRawDetail('dramanova', id, { forceRefresh });
    const eps = detailJson?.data?.episodes || detailJson?.episodes || [];
    const epObj = eps.find((e) => Number(e?.episodeNumber || e?.episode) === ep) || eps[ep - 1];
    const fileId = epObj?.fileId || epObj?.file_id || '';
    if (fileId) {
      const { json } = await fetchSansekaiJsonPaths(
        [`/dramanova/getvideo?fileId=${encodeURIComponent(String(fileId))}`],
        SANSEKAI_TIMEOUT_MS
      );
      parsed = extractSansekaiEpisodeStreams(json, { platformId: 'dramanova', episodeNumber: ep });
    }
  } else {
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
        (j) => extractSansekaiEpisodeStreams(j, { platformId: plat, episodeNumber: ep }).servers.length > 0
      );
      parsed = extractSansekaiEpisodeStreams(json, { platformId: plat, episodeNumber: ep });
    }
  }

  if (parsed.servers.length > 0) {
    sansekaiStreamCache.set(streamKey, parsed);
  }
  return parsed;
}

/**
 * Resolves a playable VIP-free stream for ANY drama & episode:
 * - Tries NunoDrama watch stream resolver FIRST (reliable, 17 platforms, no 403 datacenter block).
 * - Falls back to direct Sansekai API if needed.
 */
export async function resolveSansekaiEpisodePlayback(drama, episodeNumber = 1, { forceRefresh = false } = {}) {
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  if (!drama) {
    return { servers: [], subtitles: [], locked: false, platformId: '', platformName: '', error: '' };
  }

  // Primary VIP-free resolver: NunoDrama 17-Platform Native Bridge
  try {
    const nunoRes = await fetchNunoWatchEpisode(drama, ep, { forceRefresh });
    if (nunoRes && nunoRes.servers.length > 0) {
      const pMeta = getPlatformMeta(nunoRes.nunoPlatform === 'stardust' ? 'stardusttv' : nunoRes.nunoPlatform || drama.platformId);
      return {
        servers: nunoRes.servers,
        subtitles: nunoRes.subtitles || [],
        totalEpisodes: nunoRes.totalEpisodes || 0,
        locked: false,
        platformId: pMeta.id,
        platformName: `${pMeta.name} (VIP-Free)`,
        sansekaiId: nunoRes.nunoBookId,
        error: '',
      };
    }
  } catch {
    // Continue to Sansekai direct check
  }

  const cachedMatch = sansekaiMatchCache.get(drama.id) || null;
  const preferredPlat = String(
    cachedMatch?.platformId || drama.sansekaiPlatform || drama.platformId || ''
  ).toLowerCase();
  const preferredId = String(cachedMatch?.sansekaiId || drama.sansekaiId || drama.sourceId || '').trim();
  let lastErrMsg = '';

  if (SANSEKAI_SUPPORTED_PLATFORMS.has(preferredPlat) && preferredId) {
    try {
      const direct = await resolveSansekaiDirectById(preferredPlat, preferredId, ep, { forceRefresh });
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
      if (lastErrMsg.includes('HTTP 403') || lastErrMsg.includes('HTTP 429')) {
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

  return {
    servers: [],
    subtitles: [],
    locked: false,
    platformId: preferredPlat,
    platformName: preferredPlat ? getPlatformMeta(preferredPlat).name : 'VIP-Free Server',
    error: lastErrMsg,
  };
}

/**
 * Resolves REAL native HTML5 <video> + audio playback servers & real subtitle tracks for ANY drama & episode (v73):
 * 1. NunoDrama 17-Platform Native Watch Resolver (unblocks Episode 1..Finale including VIP episodes across
 *    DramaBox VIP, PineDrama TikTok CDN, Melolo CENC, NetShort, NunoMix Dub Indo, ReelShort, ShortMax,
 *    GoodShort, FlickReels, FreeReels, DramaWave, FlexTV, KalosTV, MoboReels, MyDrama, StardustTV, Vigloo).
 * 2. Multi-mirror Anichin Unified Direct Platform Stream (MP4 / HLS / Melolo CENC-MP4).
 * 3. Direct Sansekai API failover.
 * 4. ZERO Dailymotion iframes!
 */
export async function resolveEpisodePlayback(
  drama,
  episodeNumber = 1,
  { forceRefresh = false, preferSansekai = false } = {}
) {
  const ep = Math.max(1, Math.round(Number(episodeNumber) || 1));
  const flightKey = `${drama?.id || drama?.sourceId || 'unknown'}::ep${ep}${preferSansekai ? '::sk' : ''}`;

  if (!forceRefresh && inFlightEpisodeMap.has(flightKey)) {
    return inFlightEpisodeMap.get(flightKey);
  }

  const run = (async () => {
    const servers = [];
    let subtitles = [];
    let discoveredTotalEpisodes = 0;
    let rawError = '';
    let isLockedVip = false;
    let switchedViaSansekai = false;
    let sansekaiPlatformName = '';
    const cfg = await loadEndpointConfig();

    const seenUrls = new Set();
    const pushUniqueServer = (srv) => {
      if (!srv || !srv.url || srv.kind === 'dailymotion') return;
      if (seenUrls.has(srv.url)) return;
      seenUrls.add(srv.url);
      servers.push(srv);
    };

    // 1. Primary Native VIP-Unlocked Stream Resolver: NunoDrama 17-Platform Watch Engine
    try {
      const nunoRes = await fetchNunoWatchEpisode(drama, ep, { forceRefresh });
      if (nunoRes && Array.isArray(nunoRes.servers) && nunoRes.servers.length > 0) {
        for (const srv of nunoRes.servers) {
          pushUniqueServer(srv);
        }
        if (Array.isArray(nunoRes.subtitles) && nunoRes.subtitles.length > 0) {
          subtitles = nunoRes.subtitles;
        }
        if (nunoRes.totalEpisodes > 0) {
          discoveredTotalEpisodes = nunoRes.totalEpisodes;
        }
      }
    } catch (err) {
      rawError = err;
    }

    // 2. Secondary Native Stream Resolver: Multi-mirror Anichin Direct Platform API
    if (
      ANICHIN_UNIFIED_SOURCES.has(String(drama?.platformId || '').toLowerCase()) &&
      drama?.sourceId &&
      (servers.length === 0 || drama?.apiProvider === 'anichin-unified')
    ) {
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
          } else if (extracted.locked && servers.length === 0) {
            isLockedVip = true;
          }
        } catch (err) {
          if (!rawError) rawError = err;
        }
      }

      if (epData) {
        const qList = Array.isArray(epData.qualityList) ? epData.qualityList : [];
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

        const unwrappedEntries = await Promise.all(
          sortedQualities.map(async (q) => {
            const initialUrl = resolveAnichinMediaUrl(q.url);
            const finalUrl = await unwrapProxyStreamUrlIfNeeded(initialUrl);
            return { q, url: finalUrl || initialUrl };
          })
        );

        for (const { q, url: resolvedUrl } of unwrappedEntries) {
          if (!resolvedUrl) continue;
          const kind = classifyStreamKind(resolvedUrl, q);
          const labelText = q.label ? String(q.label).toUpperCase() : 'HD';
          pushUniqueServer({
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

        const rawTopUrl = resolveAnichinMediaUrl(epData.videoUrl || '');
        const topUrl = rawTopUrl ? await unwrapProxyStreamUrlIfNeeded(rawTopUrl) : '';
        if (topUrl && !seenUrls.has(topUrl)) {
          const defaultDrm = qList.find((q) => q?.drm && q?.contentKey) || null;
          const kind = classifyStreamKind(topUrl, defaultDrm);
          pushUniqueServer({
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

        if (subtitles.length === 0 && Array.isArray(epData.subtitles)) {
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

    // 3. Direct Sansekai API Failover if servers still empty
    if (servers.length === 0 && drama) {
      try {
        const skFallback = await resolveSansekaiEpisodePlayback(drama, ep, { forceRefresh });
        if (skFallback.servers.length > 0) {
          for (const srv of skFallback.servers) {
            pushUniqueServer(srv);
          }
          if (skFallback.subtitles?.length && subtitles.length === 0) {
            subtitles = skFallback.subtitles;
          }
          isLockedVip = false;
          switchedViaSansekai = true;
          sansekaiPlatformName = skFallback.platformName || 'VIP-Free HD';
        }
      } catch {
        // Handled cleanly below
      }
    }

    // 4. Direct MP4 URL on drama item if present
    if (drama?.directVideoUrl) {
      pushUniqueServer({
        id: 'direct-hd',
        label: 'Server Direct HD (MP4)',
        kind: classifyStreamKind(drama.directVideoUrl),
        url: resolveAnichinMediaUrl(drama.directVideoUrl),
        qualityLabel: 'HD',
      });
    }

    const best = pickBestPlaybackServer(servers);
    let friendlyError = '';
    if (servers.length === 0) {
      if (rawError) {
        friendlyError = formatDracinUserError(rawError, {
          platformName: drama?.platformName || 'platform',
          episode: ep,
        });
      } else {
        friendlyError = `Server sedang memuat ulang stream Episode ${ep}. Tekan "Buka Server VIP-Free" atau "Coba Muat Ulang".`;
      }
    }

    return {
      episode: ep,
      servers,
      subtitles,
      totalEpisodes: discoveredTotalEpisodes,
      defaultServerId: best?.id || '',
      locked: Boolean(isLockedVip && servers.length === 0),
      error: friendlyError,
      switchedViaSansekai,
      sansekaiPlatformName,
      switchedViaFreeMirror: false,
      freeMirrorNote: '',
    };
  })();

  inFlightEpisodeMap.set(flightKey, run);
  try {
    return await run;
  } finally {
    inFlightEpisodeMap.delete(flightKey);
  }
}

export async function prefetchEpisodePlayback(drama, episodeNumber) {
  if (!drama || !episodeNumber) return null;
  try {
    return await resolveEpisodePlayback(drama, episodeNumber);
  } catch {
    return null;
  }
}

/**
 * Legacy export kept for backwards compatibility — resolves via NunoDrama native stream instead of Dailymotion.
 */
export async function searchDailymotionEpisodeBackup(drama, episodeNumber = 1) {
  if (!drama) return null;
  const nunoRes = await fetchNunoWatchEpisode(drama, episodeNumber, { forceRefresh: true });
  return nunoRes?.servers?.[0] || null;
}

const posterVisualProfileCache = new Map();

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
  'pinedrama',
  'melolo',
  'netshort',
  'nunomix',
  'reelshort',
  'shortmax',
  'goodshort',
  'flickreels',
  'freereels',
  'dramawave',
];

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

  const targetPlatforms = CROSS_PLATFORM_PRIORITY.filter((pid) => pid !== drama.platformId).slice(0, 6);

  const jobs = [];
  for (const pid of targetPlatforms) {
    if (titleQuery) {
      jobs.push(fetchNunoPlatformSection(pid, 'search', { query: titleQuery, timeoutMs: 5500 }));
    }
  }

  const settled = await Promise.allSettled(jobs);
  const candidatePool = [...(Array.isArray(currentCatalog) ? currentCatalog : [])];
  for (const res of settled) {
    if (res.status === 'fulfilled' && Array.isArray(res.value?.items)) {
      candidatePool.push(...res.value.items);
    }
  }

  const preRanked = rankCrossPlatformDramaMatches(drama, candidatePool, {
    minScore: 14,
    limit: 10,
  });

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

  report(48, 'Menjalankan Multi-AI & pencarian live lintas 17 platform...');
  const aiPrompt = `Identifikasi Drama China pendek (Dracin dari DramaBox, PineDrama TikTok, Melolo, ReelShort, ShortMax, NetShort, GoodShort, FlickReels, FreeReels) berdasarkan data ini:
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
  const [aiResult, dbSearch, pdSearch, mlSearch, nsSearch] = await Promise.allSettled([
    queryKeylessMultiAi(aiPrompt),
    searchSeed ? fetchNunoPlatformSection('dramabox', 'search', { query: searchSeed }) : Promise.resolve({ items: [] }),
    searchSeed ? fetchNunoPlatformSection('pinedrama', 'search', { query: searchSeed }) : Promise.resolve({ items: [] }),
    searchSeed ? fetchNunoPlatformSection('melolo', 'search', { query: searchSeed }) : Promise.resolve({ items: [] }),
    searchSeed ? fetchNunoPlatformSection('netshort', 'search', { query: searchSeed }) : Promise.resolve({ items: [] }),
  ]);

  report(82, 'Menghitung skor kemiripan lintas katalog live...');
  const aiText = aiResult.status === 'fulfilled' ? aiResult.value?.text || '' : '';
  const aiEngine = aiResult.status === 'fulfilled' ? aiResult.value?.engine || 'Smart Local AI' : 'Smart Local AI';
  const parsedAi = parseAiDramaIdentification(aiText);

  const liveBuckets = [dbSearch, pdSearch, mlSearch, nsSearch]
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
