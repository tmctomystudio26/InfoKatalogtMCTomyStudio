/**
 * Network, Media Detection (VidMate), Multi-AI, and 100% Local Privacy Storage Orchestrator
 * for Manifestudio Peramban Proxy (v91).
 */

import {
  appendPrivateHistoryRecord,
  buildBrowserAiSystemPrompt,
  isSocialVideoPlatformUrl,
  mergeDetectedMediaLists,
} from './webproxy-logic.js?v=91';

const PREFS_STORAGE_KEY = 'manifestudio_wpb_prefs_v1';
const HISTORY_STORAGE_KEY = 'manifestudio_wpb_history_v1';
const BOOKMARKS_STORAGE_KEY = 'manifestudio_wpb_bookmarks_v1';

let _downloaderMod = null;
let _manifestAiMod = null;

async function getDownloaderModule() {
  if (_downloaderMod) return _downloaderMod;
  _downloaderMod = await import('./downloader.js?v=79');
  return _downloaderMod;
}

async function getManifestAiModule() {
  if (_manifestAiMod) return _manifestAiMod;
  _manifestAiMod = await import('./manifest-ai.js?v=87');
  return _manifestAiMod;
}

export function loadWebProxyPrefs() {
  const defaults = {
    themeId: 'cyber-owl',
    routingMode: 'proxy-stealth',
    searchEngine: 'duckduckgo',
    incognitoMode: true, // Default 100% zero history
    adBlock: true,
    antiTrack: true,
    aiModelId: 'ensemble',
  };
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;
    return {
      themeId: typeof parsed.themeId === 'string' ? parsed.themeId : defaults.themeId,
      routingMode: typeof parsed.routingMode === 'string' ? parsed.routingMode : defaults.routingMode,
      searchEngine: typeof parsed.searchEngine === 'string' ? parsed.searchEngine : defaults.searchEngine,
      incognitoMode: parsed.incognitoMode !== false,
      adBlock: parsed.adBlock !== false,
      antiTrack: parsed.antiTrack !== false,
      aiModelId: typeof parsed.aiModelId === 'string' ? parsed.aiModelId : defaults.aiModelId,
    };
  } catch {
    return defaults;
  }
}

export function saveWebProxyPrefs(prefs) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPrivateLocalHistory(incognitoMode = true) {
  if (incognitoMode) return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 60) : [];
  } catch {
    return [];
  }
}

export function recordPrivateLocalHistory(record, incognitoMode = true) {
  if (incognitoMode) {
    // Guarantee zero trace when Incognito is ON
    return [];
  }
  const current = loadPrivateLocalHistory(false);
  const next = appendPrivateHistoryRecord(current, record, { incognitoMode: false });
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage error
  }
  return next;
}

export function wipePrivateLocalHistory() {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore
  }
  return [];
}

export function loadSavedBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(list) {
  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 24) : []));
  } catch {
    // Ignore
  }
}

/**
 * Fetch a website through the integrated multi-relay Web Proxy Edge API.
 */
export async function fetchProxiedPage(url, { node = 'proxy-stealth', adBlock = true, antiTrack = true, darkTheme = false, signal = null } = {}) {
  const res = await fetch('/api/web-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit', // Zero cookies transmitted
    cache: 'no-store',
    signal,
    body: JSON.stringify({
      mode: 'browse',
      url,
      node,
      adBlock,
      antiTrack,
      darkTheme,
    }),
  });

  const data = await res.json().catch(() => ({ ok: false, error: 'Respons proxy tidak valid.' }));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `Gagal memuat halaman melalui proxy (HTTP ${res.status}).`);
  }
  return data;
}

/**
 * Execute a 100% private web search via integrated free search relays.
 */
export async function fetchPrivacySearch(query, { engine = 'duckduckgo', signal = null } = {}) {
  const res = await fetch('/api/web-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'omit',
    cache: 'no-store',
    signal,
    body: JSON.stringify({
      mode: 'search',
      q: query,
      engine,
    }),
  });

  const data = await res.json().catch(() => ({ ok: false, error: 'Gagal menghubungi mesin pencarian privat.' }));
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || 'Pencarian privat gagal diproses.');
  }
  return data;
}

/**
 * VidMate-style automatic media detector for social video platforms (YouTube, TikTok, IG, FB)
 * combined with direct HTML media extraction.
 */
export async function enrichVidmateMediaForUrl(url, pageMedia = []) {
  const cleanUrl = String(url || '').trim();
  if (!cleanUrl || !isSocialVideoPlatformUrl(cleanUrl)) {
    return Array.isArray(pageMedia) ? pageMedia : [];
  }

  try {
    const dlMod = await getDownloaderModule();
    if (typeof dlMod.fetchMediaDownload !== 'function') {
      return pageMedia;
    }
    const dlResult = await dlMod.fetchMediaDownload(cleanUrl);
    const socialItems = [];
    const title = dlResult?.title || 'Video Sosial Media';
    const links = Array.isArray(dlResult?.links) ? dlResult.links : [];
    for (let i = 0; i < links.length; i += 1) {
      const link = links[i];
      if (!link?.url || link.isClientExtract) continue;
      socialItems.push({
        id: `vidmate-social-${i + 1}`,
        url: link.url,
        kind: link.isAudio ? 'audio' : 'video',
        format: link.isAudio ? 'MP3' : 'MP4',
        quality: link.label || (link.isAudio ? 'Audio MP3' : 'HD Video'),
        mime: link.isAudio ? 'audio/mpeg' : 'video/mp4',
        title,
        source: `VidMate Engine (${dlResult?.platform || 'Social'})`,
        proxyDownloadUrl: `/api/web-proxy?mode=download&url=${encodeURIComponent(link.url)}`,
        directDownload: true,
      });
    }
    return mergeDetectedMediaLists(pageMedia, socialItems);
  } catch {
    return Array.isArray(pageMedia) ? pageMedia : [];
  }
}

/**
 * Trigger direct file download for detected VidMate media items.
 */
export async function triggerVidmateDownload(mediaItem) {
  if (!mediaItem?.url) return false;
  const href = mediaItem.directDownload ? mediaItem.url : mediaItem.proxyDownloadUrl || mediaItem.url;
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  const ext = String(mediaItem.format || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const safeName = String(mediaItem.title || 'manifestudio-media')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  a.download = `${safeName || 'manifestudio-media'}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

/**
 * Ask the integrated Multi-AI Browser Assistant (Gemini, ChatGPT, DeepSeek, Grok, Meta Llama)
 * about the currently browsed webpage, safety audit, or general questions.
 */
export async function askBrowserMultiAi({
  prompt,
  history = [],
  activeTab = null,
  aiModelId = 'ensemble',
  onDelta = () => {},
  signal = null,
} = {}) {
  const customSystemPrompt = buildBrowserAiSystemPrompt(activeTab);
  const mode = aiModelId === 'ensemble' ? 'ensemble' : 'single';
  const focusMap = {
    gemini: 'gemini',
    chatgpt: 'openai',
    deepseek: 'deepseek',
    grok: 'grok',
    meta: 'meta',
    ensemble: 'gemini',
  };
  const focusProviderId = focusMap[aiModelId] || 'gemini';

  const buildLocalFallback = () => {
    const title = activeTab?.title || 'Beranda Peramban Proxy';
    const url = activeTab?.url || '-';
    const sec = activeTab?.security || { label: 'Aman & Privat', score: 100, warnings: [] };
    const mediaCount = Array.isArray(activeTab?.media) ? activeTab.media.length : 0;
    const snippet = String(activeTab?.textSnippet || '').slice(0, 420);
    return [
      `Ringkasan cepat untuk **${title}** (${url}):`,
      `- **Status Keamanan**: ${sec.label} (Skor ${sec.score}/100).`,
      sec.warnings?.length ? `- **Catatan Proteksi**: ${sec.warnings.join(' ')}` : '- Tidak ditemukan pola phishing/malware mencurigakan pada alamat ini.',
      `- **Deteksi Media (VidMate)**: ${mediaCount} media siap unduh terdeteksi pada tab ini.`,
      snippet ? `\nCuplikan konten utama:\n"${snippet}..."` : '\nBuka situs web terlebih dahulu agar AI dapat meringkas isi halaman secara langsung.',
    ].join('\n');
  };

  try {
    const aiMod = await getManifestAiModule();
    if (typeof aiMod.sendManifestAiMessage !== 'function') {
      const fb = buildLocalFallback();
      onDelta(fb);
      return { content: fb, providerLabel: 'AI Lokal Peramban' };
    }

    const res = await aiMod.sendManifestAiMessage({
      history,
      prompt,
      mode,
      focusProviderId,
      customSystemPrompt,
      disableWebResearch: true,
      signal,
      onDelta,
      localFallbackBuilder: buildLocalFallback,
    });
    return {
      content: res?.content || buildLocalFallback(),
      providerLabel: res?.meta?.providerId || aiModelId,
    };
  } catch (err) {
    if (signal?.aborted) throw err;
    const fb = buildLocalFallback();
    onDelta(fb);
    return { content: fb, providerLabel: 'Analisis Keamanan Lokal' };
  }
}
