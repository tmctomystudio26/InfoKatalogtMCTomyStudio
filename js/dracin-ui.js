/**
 * Drama China (Dracin) Gratis Tanpa Iklan — Real-Time Multi-Platform Short-Drama UI Controller.
 * Features:
 * - Real-time catalogs & real poster thumbnails from 16+ short-drama platforms
 *   (DramaBox, Melolo, ReelShort, ShortMax, NetShort, GoodShort, DramaWave,
 *   FlickReels, FreeReels, iDrama, DramaBite, MoboReels, StardustTV, etc.)
 * - Real HTML5 <video> + self-hosted HLS.js + WebCrypto CENC-AES-CTR decryptor (Melolo)
 *   + Dailymotion HD failover with real audio, real seekable timeline, speed control,
 *   and real WebVTT/SRT subtitle sync
 * - Fullscreen vertical swipe/wheel/keyboard episode navigation + Fullscreen Clean Screen
 *   ("Layar Bersih") mode that hides all floating icons without interrupting video playback
 */

import {
  DRACIN_GENRES,
  DRACIN_PLATFORMS,
  DRACIN_PLAYBACK_SPEEDS,
  DRACIN_SUBTITLE_LANGS,
  buildEpisodeList,
  buildEpisodeRanges,
  clampEpisodeNumber,
  computePreloadEpisodeTargets,
  filterDracinCatalog,
  filterDracinPlatforms,
  formatDracinUserError,
  getActiveSubtitleCue,
  getGenreLabel,
  getNextPrevEpisode,
  pickBestPlaybackServer,
  resolveAutoSubtitleLang,
  resolveCleanScreenState,
  resolveNextMuteState,
  shouldPreserveFullscreenOnEpisodeChange,
  toggleFavoriteDramaId,
  upsertWatchHistory,
} from './dracin-logic.js?v=55';
import {
  fetchAiDramaInsights,
  fetchDramaDetail,
  fetchUnifiedDracinCatalog,
  findCrossPlatformDramaMatches,
  getEpisodeSubtitles,
  identifyDracinFromMedia,
  prefetchEpisodePlayback,
  resolveEpisodePlayback,
  searchDailymotionEpisodeBackup,
} from './dracin.js?v=55';
import {
  attachClearKeyEme,
  fetchAndDecryptCencMp4,
} from './dracin-cenc.js?v=55';

const HISTORY_STORAGE_KEY = 'manifestudio_dracin_history_v1';
const FAVORITES_STORAGE_KEY = 'manifestudio_dracin_favorites_v1';

let hlsScriptPromise = null;

function ensureHlsLibrary() {
  if (typeof window !== 'undefined' && window.Hls) {
    return Promise.resolve(window.Hls);
  }
  if (hlsScriptPromise) return hlsScriptPromise;
  hlsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './js/vendor/hls.min.js?v=55';
    script.async = true;
    script.onload = () => resolve(window.Hls || null);
    script.onerror = () => {
      hlsScriptPromise = null;
      reject(new Error('Gagal memuat mesin HLS'));
    };
    document.head.appendChild(script);
  });
  return hlsScriptPromise;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readStorageJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStorageJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota
  }
}

function formatClockTime(sec = 0) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function createDracinController({ onToast = () => {} } = {}) {
  const state = {
    view: 'discover', // 'discover' | 'player' | 'clip' | 'history' | 'favorites'
    catalog: [],
    platformCatalogs: {}, // platformId -> { items, page, hasMore }
    activeSources: [],
    loadingFeed: true,
    loadingMore: false,
    feedError: '',
    platformId: 'all',
    genreId: 'all',
    searchQuery: '',
    platformDropdownOpen: false,
    platformSearchQuery: '',
    continueDropdownOpen: false,

    // Active player state
    activeDrama: null,
    activeDramaId: null,
    currentEpisode: 1,
    epRangeStart: 1,
    isPlaying: false,
    elapsedSec: 0,
    durationSec: 0,
    playbackSpeed: 1,
    autoNext: true,
    userMuted: false,
    isMuted: false,
    autoplayMutedNotice: false,
    isFullscreen: false,
    cleanScreen: false,
    fullscreenDrawerOpen: false,
    swipeHintText: '',

    // Playback servers & real media state
    servers: [],
    activeServerId: '',
    apiSubtitles: [],
    resolvingStream: false,
    streamStatusText: '',
    streamError: '',
    streamLocked: false,
    searchingBackupMirror: false,
    triedServerIds: new Set(),

    // Multi-language subtitles
    userSubtitleOverride: null,
    subtitleLang: 'id',
    subtitleReason: '',
    subtitleCues: [],
    subtitleIsReal: false,

    // AI Drama insights & Multi-Signal Cross-Platform Matcher
    aiInsightsMap: {},
    aiInsightsLoading: false,
    crossMatchesLoading: false,
    crossMatchesDramaId: '',
    crossMatchesResult: null,
    crossMatchesError: '',

    // Clip / Screenshot AI Identifier state
    clipFile: null,
    clipFileName: '',
    clipPreviewUrl: '',
    clipClue: '',
    clipLoading: false,
    clipProgress: 0,
    clipProgressLabel: '',
    clipResult: null,
    clipError: '',

    // Persisted history & favorites
    history: readStorageJson(HISTORY_STORAGE_KEY, []),
    favorites: readStorageJson(FAVORITES_STORAGE_KEY, []),
  };

  let hostEl = null;
  let swipeHintTimer = null;
  let wheelLockUntil = 0;
  let touchStartY = null;
  let hasInitialFetched = false;
  let globalListenersBound = false;
  let activeHls = null;
  let activeBlobUrl = '';
  let activeEmeCleanup = null;
  let activeMediaAbort = null;
  let streamSessionToken = 0;

  // Background dual-video preloader & Melolo CENC LRU decrypted blob cache
  let preloadHls = null;
  let preloadAbort = null;
  let preloadSessionToken = 0;
  let preloadSlot = null;
  const decryptedBlobCache = new Map();

  function getBlobCacheKey(dramaId, ep, url) {
    return `${dramaId}::ep${ep}::${url}`;
  }

  function isBlobInUse(blobUrl) {
    if (!blobUrl) return false;
    const activeVid = hostEl?.querySelector('#dracin-html5-video');
    const standbyVid = hostEl?.querySelector('#dracin-preload-video');
    return (
      activeBlobUrl === blobUrl ||
      preloadSlot?.blobUrl === blobUrl ||
      activeVid?.currentSrc === blobUrl ||
      activeVid?.src === blobUrl ||
      standbyVid?.currentSrc === blobUrl ||
      standbyVid?.src === blobUrl
    );
  }

  function storeDecryptedBlob(key, blobUrl) {
    if (!key || !blobUrl) return;
    if (decryptedBlobCache.has(key)) {
      decryptedBlobCache.delete(key);
    }
    decryptedBlobCache.set(key, blobUrl);
    while (decryptedBlobCache.size > 3) {
      let evicted = false;
      for (const [k, url] of decryptedBlobCache.entries()) {
        if (!isBlobInUse(url)) {
          decryptedBlobCache.delete(k);
          try {
            URL.revokeObjectURL(url);
          } catch {
            // Ignore
          }
          evicted = true;
          break;
        }
      }
      if (!evicted) break;
    }
  }

  function clearDecryptedBlobCache() {
    for (const url of decryptedBlobCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    }
    decryptedBlobCache.clear();
  }

  function destroyPreloadEngine() {
    preloadSessionToken += 1;
    if (preloadAbort) {
      try {
        preloadAbort.abort();
      } catch {
        // Ignore
      }
      preloadAbort = null;
    }
    if (preloadHls) {
      try {
        preloadHls.destroy();
      } catch {
        // Ignore
      }
      preloadHls = null;
    }
    preloadSlot = null;
    const standby = hostEl?.querySelector('#dracin-preload-video');
    if (standby) {
      try {
        standby.pause();
        standby.removeAttribute('src');
        standby.removeAttribute('data-preload-episode');
        standby.load();
      } catch {
        // Ignore
      }
    }
  }

  function destroyActiveMediaEngine({ resetVideoElement = true } = {}) {
    if (activeMediaAbort) {
      try {
        activeMediaAbort.abort();
      } catch {
        // Ignore
      }
      activeMediaAbort = null;
    }
    if (activeHls) {
      try {
        activeHls.destroy();
      } catch {
        // Ignore
      }
      activeHls = null;
    }
    if (activeEmeCleanup) {
      try {
        activeEmeCleanup();
      } catch {
        // Ignore
      }
      activeEmeCleanup = null;
    }
    if (activeBlobUrl) {
      const stillCached = Array.from(decryptedBlobCache.values()).includes(activeBlobUrl);
      if (!stillCached) {
        try {
          URL.revokeObjectURL(activeBlobUrl);
        } catch {
          // Ignore
        }
      }
      activeBlobUrl = '';
    }
    if (resetVideoElement) {
      const vid = hostEl?.querySelector('#dracin-html5-video');
      if (vid) {
        try {
          vid.pause();
          vid.removeAttribute('src');
          vid.load();
        } catch {
          // Ignore
        }
      }
    }
  }

  function getActiveDrama() {
    if (state.activeDrama) return state.activeDrama;
    if (!state.activeDramaId) return state.catalog[0] || null;
    return state.catalog.find((d) => d.id === state.activeDramaId) || state.catalog[0] || null;
  }

  function upsertDramaInCatalog(drama) {
    if (!drama || !drama.id) return;
    const idx = state.catalog.findIndex((d) => d.id === drama.id);
    if (idx >= 0) {
      state.catalog[idx] = { ...state.catalog[idx], ...drama };
    } else {
      state.catalog.unshift(drama);
    }
    if (state.activeDrama && state.activeDrama.id === drama.id) {
      state.activeDrama = { ...state.activeDrama, ...drama };
    }
  }

  function persistHistory(drama, episodeNumber, progressPercent = 10) {
    if (!drama) return;
    state.history = upsertWatchHistory(state.history, {
      dramaId: drama.id,
      sourceId: drama.sourceId || '',
      apiProvider: drama.apiProvider || '',
      title: drama.title,
      platformId: drama.platformId,
      platformName: drama.platformName,
      poster: drama.poster || drama.fallbackPoster,
      episode: episodeNumber,
      totalEpisodes: drama.totalEpisodes,
      progressPercent,
      subtitleLang: state.subtitleLang,
      updatedAt: Date.now(),
    });
    writeStorageJson(HISTORY_STORAGE_KEY, state.history);
  }

  function showSwipeHint(msg) {
    state.swipeHintText = msg;
    clearTimeout(swipeHintTimer);
    const pill = hostEl?.querySelector('#dracin-swipe-toast');
    if (pill) {
      pill.textContent = msg;
      pill.hidden = false;
    }
    swipeHintTimer = setTimeout(() => {
      state.swipeHintText = '';
      const p = hostEl?.querySelector('#dracin-swipe-toast');
      if (p) p.hidden = true;
    }, 1800);
  }

  function syncPlayerLiveDom() {
    if (!hostEl || state.view !== 'player') return;
    const subEl = hostEl.querySelector('#dracin-live-subtitle');
    const progFill = hostEl.querySelector('#dracin-progress-fill');
    const timeLabel = hostEl.querySelector('#dracin-time-label');
    const playBtn = hostEl.querySelector('#dracin-toggle-play-btn');

    if (subEl) {
      if (state.subtitleLang === 'off' || !state.subtitleIsReal || state.subtitleCues.length === 0) {
        subEl.hidden = true;
      } else {
        const cue = getActiveSubtitleCue(state.subtitleCues, state.elapsedSec, { loop: false });
        subEl.hidden = !cue?.text;
        if (cue?.text) subEl.textContent = cue.text;
      }
    }

    const dur = Math.max(1, state.durationSec || 0);
    const pct = state.durationSec > 0 ? Math.min(100, (state.elapsedSec / dur) * 100) : 0;
    if (progFill) progFill.style.width = `${pct.toFixed(2)}%`;
    if (timeLabel) {
      timeLabel.textContent =
        state.durationSec > 0
          ? `${formatClockTime(state.elapsedSec)} / ${formatClockTime(state.durationSec)}`
          : `${formatClockTime(state.elapsedSec)} / --:--`;
    }
    if (playBtn) {
      playBtn.setAttribute('aria-label', state.isPlaying ? 'Jeda video' : 'Putar video');
      playBtn.classList.toggle('is-playing', state.isPlaying);
      playBtn.innerHTML = state.isPlaying
        ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
        : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
    }
  }

  function syncMuteUiInPlace() {
    const muteBtn = hostEl?.querySelector('#dracin-rail-mute-btn');
    const unmuteBanner = hostEl?.querySelector('#dracin-unmute-banner');
    if (muteBtn) {
      muteBtn.classList.toggle('is-active', !state.isMuted);
      muteBtn.setAttribute('aria-label', state.isMuted ? 'Nyalakan suara' : 'Bisukan suara');
      muteBtn.innerHTML = state.isMuted
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg><span>Bisu</span>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg><span>Suara</span>`;
    }
    if (unmuteBanner) {
      unmuteBanner.hidden = !state.autoplayMutedNotice || !state.isMuted;
    }
  }

  function syncStageChromeInPlace() {
    const stageEl = hostEl?.querySelector('#dracin-player-stage');
    if (!stageEl) return;
    stageEl.classList.toggle('is-fullscreen', state.isFullscreen);
    stageEl.classList.toggle('is-clean-screen', state.isFullscreen && state.cleanScreen);
    stageEl.setAttribute('data-fullscreen', state.isFullscreen ? 'true' : 'false');
    stageEl.setAttribute('data-clean-screen', state.isFullscreen && state.cleanScreen ? 'true' : 'false');

    const fsBtn = hostEl?.querySelector('#dracin-fs-toggle-top');
    if (fsBtn) {
      fsBtn.textContent = state.isFullscreen ? 'Keluar Full' : 'Layar Penuh';
    }
    const cleanTopBtn = hostEl?.querySelector('#dracin-clean-fs-btn');
    if (cleanTopBtn) {
      cleanTopBtn.hidden = !state.isFullscreen;
    }
    const railCleanBtn = hostEl?.querySelector('#dracin-rail-clean-btn');
    if (railCleanBtn) {
      railCleanBtn.hidden = !state.isFullscreen;
      railCleanBtn.classList.toggle('is-active', state.cleanScreen);
    }
    const restoreBtn = hostEl?.querySelector('#dracin-restore-hud-btn');
    if (restoreBtn) {
      restoreBtn.hidden = !(state.isFullscreen && state.cleanScreen);
    }
    const railFsBtn = hostEl?.querySelector('#dracin-rail-fs-btn');
    if (railFsBtn) {
      const span = railFsBtn.querySelector('span');
      if (span) span.textContent = state.isFullscreen ? 'Kecilkan' : 'Full';
    }
    const metaSwipe = hostEl?.querySelector('#dracin-fs-swipe-hint');
    if (metaSwipe) {
      metaSwipe.hidden = !state.isFullscreen;
    }
  }

  function setStatusOverlay(loading, message = '', isError = false) {
    state.resolvingStream = loading;
    state.streamStatusText = loading ? message : '';
    state.streamError = isError ? message : '';
    const loader = hostEl?.querySelector('#dracin-media-loader');
    const errBox = hostEl?.querySelector('#dracin-media-error');
    if (loader) {
      loader.hidden = !loading;
      const txt = loader.querySelector('span');
      if (txt && message) txt.textContent = message;
    }
    if (errBox) {
      errBox.hidden = !isError;
      const txt = errBox.querySelector('p');
      if (txt && isError) txt.textContent = message;
      const prevErrBtn = errBox.querySelector('#dracin-error-prev-ep-btn');
      if (prevErrBtn) prevErrBtn.hidden = state.currentEpisode <= 1;
      const dmBtn = errBox.querySelector('#dracin-search-dm-mirror-btn');
      if (dmBtn) {
        dmBtn.disabled = state.searchingBackupMirror;
        dmBtn.textContent = state.searchingBackupMirror ? 'Mencari Mirror...' : 'Cari Mirror Dailymotion';
      }
      const crossBtn = errBox.querySelector('#dracin-find-cross-platform-btn');
      if (crossBtn) {
        crossBtn.disabled = state.crossMatchesLoading;
        crossBtn.textContent = state.crossMatchesLoading
          ? 'Mencocokkan Platform...'
          : 'Cari di Platform Lain';
      }
    }
  }

  function setCleanScreenMode(forceVal = null) {
    state.cleanScreen = resolveCleanScreenState(state.cleanScreen, state.isFullscreen, forceVal);
    if (state.cleanScreen) {
      state.fullscreenDrawerOpen = false;
      const drawer = hostEl?.querySelector('.dracin-fs-drawer');
      if (drawer) drawer.remove();
    }
    syncStageChromeInPlace();
    if (state.cleanScreen) {
      showSwipeHint('Mode Layar Bersih aktif · Ketuk layar untuk kembalikan menu');
    }
  }

  function primeVideoAudioGesture() {
    const vid = hostEl?.querySelector('#dracin-html5-video');
    if (vid) {
      vid.defaultMuted = false;
      vid.muted = Boolean(state.userMuted);
      vid.volume = 1;
    }
    // Warm up AudioContext silently inside user gesture so mobile browsers preserve unmuted playback
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!window.__dracinAudioUnlockCtx) {
          window.__dracinAudioUnlockCtx = new AudioCtx();
        }
        if (window.__dracinAudioUnlockCtx.state === 'suspended') {
          window.__dracinAudioUnlockCtx.resume().catch(() => {});
        }
      }
    } catch {
      // Ignore if AudioContext unavailable
    }
  }

  function armOneShotAutoUnmute() {
    if (!hostEl || state.userMuted) return;
    const onNextTap = () => {
      if (state.userMuted) return;
      const vid = hostEl?.querySelector('#dracin-html5-video');
      if (vid) {
        vid.defaultMuted = false;
        vid.muted = false;
        vid.volume = 1;
        if (vid.paused) vid.play().catch(() => {});
      }
      state.isMuted = false;
      state.autoplayMutedNotice = false;
      syncMuteUiInPlace();
    };
    hostEl.addEventListener('pointerdown', onNextTap, { once: true, capture: true });
  }

  async function attemptPlayVideo(videoEl) {
    if (!videoEl) return;
    videoEl.playbackRate = state.playbackSpeed;
    videoEl.defaultMuted = false;
    videoEl.volume = 1;
    const initialMute = resolveNextMuteState({ userMuted: state.userMuted, autoplayBlocked: false });
    videoEl.muted = initialMute.effectiveMuted;
    state.isMuted = initialMute.effectiveMuted;
    state.autoplayMutedNotice = false;

    try {
      await videoEl.play();
      state.isPlaying = true;
      if (!state.userMuted) {
        videoEl.muted = false;
        videoEl.volume = 1;
        state.isMuted = false;
      }
      state.autoplayMutedNotice = false;
      syncPlayerLiveDom();
      syncMuteUiInPlace();
    } catch {
      // Browser autoplay policy blocked unmuted play -> start muted temporarily WITHOUT overwriting userMuted!
      if (!state.userMuted) {
        const blocked = resolveNextMuteState({ userMuted: state.userMuted, autoplayBlocked: true });
        videoEl.muted = blocked.effectiveMuted;
        state.isMuted = blocked.effectiveMuted;
        state.autoplayMutedNotice = blocked.showUnmuteNotice;
        try {
          await videoEl.play();
          state.isPlaying = true;
        } catch {
          state.isPlaying = false;
        }
        armOneShotAutoUnmute();
        syncPlayerLiveDom();
        syncMuteUiInPlace();
      } else {
        state.isPlaying = false;
        syncPlayerLiveDom();
      }
    }
  }

  function renderServerButtonsHtml(activeServer) {
    if (!state.servers.length) {
      return `<span class="dracin-toolbar-note">${state.resolvingStream ? 'Mengambil link video HD...' : 'Belum ada server aktif'}</span>`;
    }
    return state.servers
      .map(
        (srv) => `
      <button
        type="button"
        class="dracin-server-btn ${activeServer?.id === srv.id ? 'is-active' : ''}"
        data-dracin-server="${escapeHtml(srv.id)}"
      >
        ${escapeHtml(srv.label)}
      </button>
    `
      )
      .join('');
  }

  function bindServerSwitchButtons(container) {
    if (!container) return;
    container.querySelectorAll('[data-dracin-server]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const srvId = btn.getAttribute('data-dracin-server');
        if (!srvId || srvId === state.activeServerId) return;
        primeVideoAudioGesture();
        const prevSrv = state.servers.find((s) => s.id === state.activeServerId);
        const nextSrv = state.servers.find((s) => s.id === srvId);
        state.activeServerId = srvId;
        state.triedServerIds = new Set();
        onToast(`Beralih ke ${btn.textContent?.trim() || 'server lain'}`);
        const switchingSurface =
          (prevSrv?.kind === 'dailymotion') !== (nextSrv?.kind === 'dailymotion');
        if (switchingSurface || !hostEl?.querySelector('#dracin-player-stage')) {
          render();
        } else {
          syncPlayerEpisodeUiInPlace(getActiveDrama());
        }
        attachMediaToActiveStage();
      });
    });
  }

  /**
   * Updates all episode & server labels/controls IN-PLACE without detaching
   * #dracin-player-stage or #dracin-html5-video — preserving native Fullscreen
   * and unlocked unmuted audio seamlessly across episode changes!
   */
  function syncPlayerEpisodeUiInPlace(drama) {
    if (!hostEl || !drama) return;
    const stageEl = hostEl.querySelector('#dracin-player-stage');
    if (!stageEl) return;
    const nav = getNextPrevEpisode(state.currentEpisode, drama.totalEpisodes);
    const activeServer =
      state.servers.find((s) => s.id === state.activeServerId) || pickBestPlaybackServer(state.servers);

    stageEl.setAttribute('data-episode', String(state.currentEpisode));

    const epHead = stageEl.querySelector('.dracin-stage-ep-label');
    if (epHead) epHead.textContent = `Ep ${state.currentEpisode} / ${drama.totalEpisodes}`;

    const titleEl = stageEl.querySelector('.dracin-stage-title');
    if (titleEl) titleEl.textContent = drama.title;

    const railEpSpan = stageEl.querySelector('#dracin-rail-episodes-btn span');
    if (railEpSpan) railEpSpan.textContent = `Ep ${state.currentEpisode}`;

    const srvLabelEl = stageEl.querySelector('#dracin-stage-server-label');
    if (srvLabelEl) srvLabelEl.textContent = activeServer?.label || 'Streaming HD';

    const prevBtn = stageEl.querySelector('#dracin-prev-ep-btn');
    if (prevBtn) prevBtn.disabled = !nav.hasPrev;

    const nextBtn = stageEl.querySelector('#dracin-next-ep-btn');
    if (nextBtn) nextBtn.disabled = !nav.hasNext;

    const playerTabBtn = hostEl.querySelector('[data-dracin-view="player"]');
    if (playerTabBtn) {
      playerTabBtn.textContent = `Pemutar · Ep ${state.currentEpisode}`;
    }

    const vid = stageEl.querySelector('#dracin-html5-video');
    if (vid && (drama.poster || drama.fallbackPoster)) {
      vid.poster = drama.poster || drama.fallbackPoster;
    }

    const srvRowInner = hostEl.querySelector('#dracin-server-row-inner');
    if (srvRowInner) {
      srvRowInner.innerHTML = renderServerButtonsHtml(activeServer);
      bindServerSwitchButtons(srvRowInner);
    }

    const pickerWrap = hostEl.querySelector('#dracin-side-ep-wrap');
    if (pickerWrap) {
      pickerWrap.innerHTML = renderEpisodePickerGrid(drama, false);
      bindEpisodePickerEvents(pickerWrap);
    }

    const drawerBody = stageEl.querySelector('.dracin-fs-drawer-body');
    if (drawerBody) {
      drawerBody.innerHTML = renderEpisodePickerGrid(drama, true);
      bindEpisodePickerEvents(drawerBody);
    }

    syncStageChromeInPlace();
    syncMuteUiInPlace();
    syncPlayerLiveDom();
  }

  function tryFailoverToNextServer(failedServerId, reasonMsg = '') {
    state.triedServerIds.add(failedServerId);
    const prevServer = state.servers.find((s) => s.id === failedServerId);
    const nextServer = state.servers.find((s) => !state.triedServerIds.has(s.id));
    if (nextServer) {
      state.activeServerId = nextServer.id;
      onToast(`Beralih otomatis ke ${nextServer.label}`);
      const switchingSurface =
        (prevServer?.kind === 'dailymotion') !== (nextServer.kind === 'dailymotion');
      if (switchingSurface || !hostEl?.querySelector('#dracin-player-stage')) {
        render();
      } else {
        syncPlayerEpisodeUiInPlace(getActiveDrama());
      }
      attachMediaToActiveStage();
      return true;
    }
    setStatusOverlay(
      false,
      reasonMsg || 'Video gagal diputar di browser ini. Coba pilih kualitas/server lain atau episode berikutnya.',
      true
    );
    return false;
  }

  /**
   * Silently preloads upcoming episodes (Ep N+1 video buffer + Ep N+2 API metadata)
   * into the standby #dracin-preload-video element so scroll/auto-next switches instantaneously!
   */
  async function preloadUpcomingEpisodes(drama, currentEp) {
    if (!hostEl || !drama || state.view !== 'player') return;
    const targets = computePreloadEpisodeTargets(currentEp, drama.totalEpisodes, 2);
    if (!targets.length) return;
    const nextEp = targets[0];

    // Skip if Ep N+1 is already preloading or ready for this exact drama
    if (preloadSlot && preloadSlot.dramaId === drama.id && preloadSlot.episode === nextEp) {
      return;
    }

    destroyPreloadEngine();
    const myPreloadToken = ++preloadSessionToken;
    const abortCtrl = new AbortController();
    preloadAbort = abortCtrl;

    // Warm Ep N+2 metadata in background concurrently without blocking Ep N+1 buffer
    if (targets[1]) {
      prefetchEpisodePlayback(drama, targets[1]).catch(() => {});
    }

    const streamRes = await prefetchEpisodePlayback(drama, nextEp);
    if (
      myPreloadToken !== preloadSessionToken ||
      abortCtrl.signal.aborted ||
      state.view !== 'player' ||
      state.activeDramaId !== drama.id
    ) {
      return;
    }
    if (!streamRes || !Array.isArray(streamRes.servers) || streamRes.servers.length === 0) {
      return;
    }

    const best = pickBestPlaybackServer(streamRes.servers);
    if (!best || best.kind === 'dailymotion') return;

    const standbyEl = hostEl?.querySelector('#dracin-preload-video');
    if (!standbyEl) return;

    const slot = {
      dramaId: drama.id,
      episode: nextEp,
      streamRes,
      server: best,
      ready: false,
      blobUrl: '',
    };
    preloadSlot = slot;

    standbyEl.muted = true;
    standbyEl.defaultMuted = true;
    standbyEl.playsInline = true;
    standbyEl.preload = 'auto';
    standbyEl.setAttribute('data-preload-episode', String(nextEp));
    if (drama.poster || drama.fallbackPoster) {
      standbyEl.poster = drama.poster || drama.fallbackPoster;
    }

    const markReady = () => {
      if (preloadSlot === slot) slot.ready = true;
    };
    standbyEl.addEventListener('loadeddata', markReady, { once: true, signal: abortCtrl.signal });
    standbyEl.addEventListener('canplay', markReady, { once: true, signal: abortCtrl.signal });

    try {
      if (best.kind === 'cenc-mp4') {
        const cacheKey = getBlobCacheKey(drama.id, nextEp, best.url);
        let blobUrl = decryptedBlobCache.get(cacheKey) || '';
        if (!blobUrl) {
          blobUrl = await fetchAndDecryptCencMp4(best.url, best.contentKey, abortCtrl.signal);
          if (myPreloadToken !== preloadSessionToken || abortCtrl.signal.aborted) {
            URL.revokeObjectURL(blobUrl);
            return;
          }
          storeDecryptedBlob(cacheKey, blobUrl);
        }
        slot.blobUrl = blobUrl;
        standbyEl.src = blobUrl;
        standbyEl.load();
        return;
      }

      if (best.kind === 'hls') {
        let HlsLib = null;
        try {
          HlsLib = await ensureHlsLibrary();
        } catch {
          HlsLib = null;
        }
        if (myPreloadToken !== preloadSessionToken || abortCtrl.signal.aborted) return;

        if (HlsLib && HlsLib.isSupported()) {
          const hls = new HlsLib({
            enableWorker: true,
            lowLatencyMode: false,
            maxBufferLength: 8,
            maxMaxBufferLength: 14,
            backBufferLength: 5,
          });
          preloadHls = hls;
          hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
            if (myPreloadToken !== preloadSessionToken) return;
            if (Array.isArray(hls.audioTracks) && hls.audioTracks.length > 0 && hls.audioTrack < 0) {
              hls.audioTrack = 0;
            }
            slot.ready = true;
          });
          hls.on(HlsLib.Events.ERROR, (_evt, data) => {
            if (data?.fatal && preloadHls === hls) {
              try {
                hls.destroy();
              } catch {
                // Ignore
              }
              preloadHls = null;
              if (preloadSlot === slot) preloadSlot = null;
            }
          });
          hls.loadSource(best.url);
          hls.attachMedia(standbyEl);
        } else if (
          standbyEl.canPlayType('application/vnd.apple.mpegurl') ||
          standbyEl.canPlayType('application/x-mpegURL')
        ) {
          standbyEl.removeAttribute('crossorigin');
          standbyEl.src = best.url;
          standbyEl.load();
        }
        return;
      }

      // Direct MP4 background buffer
      standbyEl.src = best.url;
      standbyEl.load();
    } catch {
      if (preloadSlot === slot) preloadSlot = null;
    }
  }

  /**
   * Binds HTML5 <video> lifecycle listeners to the active video element using an AbortController
   * so both fresh stream attachment and zero-wait instant dual-video swap share identical behavior.
   */
  function bindActiveVideoListeners(videoEl, activeServer, token) {
    const abortCtrl = new AbortController();
    activeMediaAbort = abortCtrl;
    const listenerOpts = { signal: abortCtrl.signal };
    let videoDimensionCheckTimer = null;
    let triggeredPreload = false;

    const triggerNextPreloadOnce = () => {
      if (triggeredPreload || token !== streamSessionToken) return;
      triggeredPreload = true;
      const drama = getActiveDrama();
      if (drama) preloadUpcomingEpisodes(drama, state.currentEpisode);
    };

    const onLoadedMeta = () => {
      if (token !== streamSessionToken) return;
      if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
        state.durationSec = videoEl.duration;
      }
      videoEl.playbackRate = state.playbackSpeed;
      if (!state.userMuted && !state.autoplayMutedNotice) {
        videoEl.muted = false;
        videoEl.volume = 1;
      }
      setStatusOverlay(false);
      syncPlayerLiveDom();
    };
    const onCanPlay = () => {
      if (token !== streamSessionToken) return;
      setStatusOverlay(false);
      triggerNextPreloadOnce();
      if (videoEl.paused && state.isPlaying) {
        attemptPlayVideo(videoEl);
      }
    };
    const onTimeUpdate = () => {
      if (token !== streamSessionToken) return;
      state.elapsedSec = videoEl.currentTime || 0;
      if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
        state.durationSec = videoEl.duration;
      }
      syncPlayerLiveDom();
    };
    const onPlay = () => {
      if (token !== streamSessionToken) return;
      state.isPlaying = true;
      setStatusOverlay(false);
      syncPlayerLiveDom();
    };
    const onPause = () => {
      if (token !== streamSessionToken) return;
      state.isPlaying = false;
      syncPlayerLiveDom();
    };
    const onEnded = () => {
      if (token !== streamSessionToken) return;
      state.isPlaying = false;
      syncPlayerLiveDom();
      const drama = getActiveDrama();
      const nav = getNextPrevEpisode(state.currentEpisode, drama?.totalEpisodes || 40);
      if (state.autoNext && nav.hasNext) {
        selectEpisode(nav.next, { announce: `Auto-lanjut ke Episode ${nav.next}` });
      }
    };
    const onWaiting = () => {
      if (token !== streamSessionToken) return;
      setStatusOverlay(true, 'Buffering video HD...');
    };
    const onPlaying = () => {
      if (token !== streamSessionToken) return;
      setStatusOverlay(false);
      state.isPlaying = true;
      if (!state.userMuted && !state.autoplayMutedNotice) {
        videoEl.muted = false;
        videoEl.volume = 1;
      }
      syncPlayerLiveDom();
      syncMuteUiInPlace();
      triggerNextPreloadOnce();

      // Guard against black-screen codec (e.g. HEVC audio-only decode on devices without HEVC video)
      clearTimeout(videoDimensionCheckTimer);
      if (videoEl.videoWidth === 0 && activeServer.kind === 'cenc-mp4') {
        videoDimensionCheckTimer = setTimeout(() => {
          if (token !== streamSessionToken) return;
          if (!videoEl.paused && videoEl.currentTime > 0.3 && videoEl.videoWidth === 0) {
            tryFailoverToNextServer(
              activeServer.id,
              'Codec video ini (HEVC) tidak menampilkan gambar di perangkat ini — mencoba kualitas lain...'
            );
          }
        }, 1200);
      }
    };
    const onError = () => {
      if (token !== streamSessionToken) return;
      clearTimeout(videoDimensionCheckTimer);
      const errCode = videoEl.error?.code;
      const msg =
        errCode === 4
          ? 'Format video tidak didukung oleh browser ini (mencoba kualitas/server lain)...'
          : 'Koneksi stream terputus, mencoba server lain...';
      tryFailoverToNextServer(activeServer.id, msg);
    };

    videoEl.addEventListener('loadedmetadata', onLoadedMeta, listenerOpts);
    videoEl.addEventListener('canplay', onCanPlay, listenerOpts);
    videoEl.addEventListener('timeupdate', onTimeUpdate, listenerOpts);
    videoEl.addEventListener('play', onPlay, listenerOpts);
    videoEl.addEventListener('pause', onPause, listenerOpts);
    videoEl.addEventListener('ended', onEnded, listenerOpts);
    videoEl.addEventListener('waiting', onWaiting, listenerOpts);
    videoEl.addEventListener('playing', onPlaying, listenerOpts);
    videoEl.addEventListener('error', onError, listenerOpts);

    abortCtrl.signal.addEventListener('abort', () => clearTimeout(videoDimensionCheckTimer), { once: true });
    return { abortCtrl, triggerNextPreloadOnce };
  }

  /**
   * Attaches the REAL media stream (Direct MP4, HLS.js with native CORS fallback,
   * Melolo CENC WebCrypto MP4 with LRU cache, or Dailymotion embed) to the mounted stage element.
   */
  async function attachMediaToActiveStage() {
    if (!hostEl || state.view !== 'player') return;
    const token = ++streamSessionToken;
    destroyActiveMediaEngine();

    const activeServer =
      state.servers.find((s) => s.id === state.activeServerId) || pickBestPlaybackServer(state.servers);

    if (!activeServer) {
      if (!state.resolvingStream) {
        setStatusOverlay(
          false,
          state.streamError || 'Sumber video untuk episode ini sedang tidak tersedia dari server platform.',
          true
        );
      }
      return;
    }

    if (activeServer.kind === 'dailymotion') {
      setStatusOverlay(false);
      state.isPlaying = true;
      return;
    }

    const videoEl = hostEl.querySelector('#dracin-html5-video');
    if (!videoEl) return;

    const { abortCtrl } = bindActiveVideoListeners(videoEl, activeServer, token);
    const drama = getActiveDrama();

    try {
      if (activeServer.kind === 'cenc-mp4') {
        const cacheKey = getBlobCacheKey(drama?.id || '', state.currentEpisode, activeServer.url);
        const cachedBlob = decryptedBlobCache.get(cacheKey);
        if (cachedBlob) {
          activeBlobUrl = cachedBlob;
          videoEl.src = cachedBlob;
          videoEl.load();
          await attemptPlayVideo(videoEl);
          return;
        }

        // Melolo encrypted CENC-AES-CTR MP4 -> client-side WebCrypto decrypt into native Blob MP4
        setStatusOverlay(true, `Menyiapkan & mendekripsi video ${activeServer.label}...`);
        try {
          const blobUrl = await fetchAndDecryptCencMp4(
            activeServer.url,
            activeServer.contentKey,
            abortCtrl.signal
          );
          if (token !== streamSessionToken) {
            URL.revokeObjectURL(blobUrl);
            return;
          }
          storeDecryptedBlob(cacheKey, blobUrl);
          activeBlobUrl = blobUrl;
          videoEl.src = blobUrl;
          videoEl.load();
          await attemptPlayVideo(videoEl);
        } catch (decErr) {
          if (token !== streamSessionToken || abortCtrl.signal.aborted) return;
          // Fallback to native W3C ClearKey EME directly on the CDN URL
          if (activeServer.kid && activeServer.contentKey) {
            activeEmeCleanup = attachClearKeyEme(videoEl, activeServer.kid, activeServer.contentKey);
            videoEl.src = activeServer.url;
            videoEl.load();
            await attemptPlayVideo(videoEl);
          } else {
            tryFailoverToNextServer(
              activeServer.id,
              formatDracinUserError(decErr, {
                platformName: drama?.platformName || 'Melolo',
                episode: state.currentEpisode,
              })
            );
          }
        }
        return;
      }

      if (activeServer.kind === 'hls') {
        setStatusOverlay(true, `Memuat stream HLS ${activeServer.label}...`);
        const canNativeHls = Boolean(
          videoEl.canPlayType('application/vnd.apple.mpegurl') ||
            videoEl.canPlayType('application/x-mpegURL')
        );
        const startNativeHlsFallback = async () => {
          if (token !== streamSessionToken) return;
          videoEl.removeAttribute('crossorigin');
          videoEl.src = activeServer.url;
          videoEl.load();
          await attemptPlayVideo(videoEl);
        };

        let HlsLib = null;
        try {
          HlsLib = await ensureHlsLibrary();
        } catch {
          HlsLib = null;
        }
        if (token !== streamSessionToken) return;

        // ALWAYS try HLS.js FIRST when supported (fixes Android Chrome canPlayType('maybe') error on /api/*/hls!)
        // and cleanly fall back to native <video src> on CORS-blocked CDNs if native HLS is supported!
        if (HlsLib && HlsLib.isSupported()) {
          let mediaRecoveryAttempts = 0;
          const hls = new HlsLib({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
          });
          activeHls = hls;
          hls.on(HlsLib.Events.MANIFEST_PARSED, () => {
            if (token !== streamSessionToken) return;
            if (Array.isArray(hls.audioTracks) && hls.audioTracks.length > 0 && hls.audioTrack < 0) {
              hls.audioTrack = 0;
            }
            setStatusOverlay(false);
            attemptPlayVideo(videoEl);
          });
          hls.on(HlsLib.Events.AUDIO_TRACKS_UPDATED, () => {
            if (token !== streamSessionToken) return;
            if (Array.isArray(hls.audioTracks) && hls.audioTracks.length > 0 && hls.audioTrack < 0) {
              hls.audioTrack = 0;
            }
          });
          hls.on(HlsLib.Events.ERROR, (_evt, data) => {
            if (token !== streamSessionToken) return;
            if (data?.fatal) {
              if (data.type === HlsLib.ErrorTypes.MEDIA_ERROR && mediaRecoveryAttempts < 1) {
                mediaRecoveryAttempts += 1;
                hls.recoverMediaError();
                return;
              }
              try {
                hls.destroy();
              } catch {
                // Ignore
              }
              activeHls = null;

              // If CDN blocked XHR via CORS (acao=null) on Android Chrome / iOS Safari, native <video> plays without CORS!
              if (data.type === HlsLib.ErrorTypes.NETWORK_ERROR && canNativeHls) {
                setStatusOverlay(true, `Beralih ke pemutar HLS native (${activeServer.label})...`);
                startNativeHlsFallback();
                return;
              }
              tryFailoverToNextServer(
                activeServer.id,
                'Stream HLS diblokir oleh CDN asal — mencoba server/kualitas lain...'
              );
            }
          });
          hls.loadSource(activeServer.url);
          hls.attachMedia(videoEl);
        } else if (canNativeHls) {
          await startNativeHlsFallback();
        } else {
          tryFailoverToNextServer(activeServer.id, 'Browser tidak mendukung HLS untuk stream ini.');
        }
        return;
      }

      // Direct standard MP4 video stream (DramaBox, NetShort, etc.)
      setStatusOverlay(true, `Memuat video ${activeServer.label}...`);
      videoEl.src = activeServer.url;
      videoEl.load();
      await attemptPlayVideo(videoEl);
    } catch (err) {
      if (token !== streamSessionToken || abortCtrl.signal.aborted) return;
      tryFailoverToNextServer(
        activeServer.id,
        formatDracinUserError(err, {
          platformName: drama?.platformName || 'platform',
          episode: state.currentEpisode,
        })
      );
    }
  }

  async function loadSubtitlesForActiveEpisode(drama, ep, langOverride = null, apiSubtitles = null) {
    if (!drama) return;
    const resolved = resolveAutoSubtitleLang(drama, langOverride ?? state.userSubtitleOverride);
    state.subtitleLang = resolved.lang;
    const tracks = apiSubtitles ?? state.apiSubtitles;
    const subRes = await getEpisodeSubtitles(drama, ep, resolved.lang, tracks);
    state.subtitleCues = subRes.cues || [];
    state.subtitleIsReal = Boolean(subRes.isRealTrack);
    state.subtitleReason = subRes.reason || resolved.reason;
    syncPlayerLiveDom();
    const subMeta = hostEl?.querySelector('#dracin-sub-status');
    if (subMeta) subMeta.textContent = state.subtitleReason;
  }

  async function selectEpisode(epNumber, { announce = '', forceRefresh = false } = {}) {
    const drama = getActiveDrama();
    if (!drama) return;
    const safeEp = clampEpisodeNumber(epNumber, drama.totalEpisodes);

    // Prime audio gesture synchronously BEFORE async fetch or instant swap so browser keeps audio unlocked!
    primeVideoAudioGesture();

    // Remove fullscreen drawer if open without tearing down stage
    const openDrawer = hostEl?.querySelector('.dracin-fs-drawer');
    if (openDrawer) openDrawer.remove();

    // Check ZERO-WAIT INSTANT DUAL-VIDEO SWAP (preloaded Ep N+1 ready in standby slot!)
    const activeVidNow = hostEl?.querySelector('#dracin-html5-video');
    const standbyVidNow = hostEl?.querySelector('#dracin-preload-video');
    const canInstantSwap =
      !forceRefresh &&
      Boolean(
        activeVidNow &&
          standbyVidNow &&
          preloadSlot &&
          preloadSlot.dramaId === drama.id &&
          preloadSlot.episode === safeEp &&
          preloadSlot.server &&
          preloadSlot.streamRes?.servers?.length > 0 &&
          (standbyVidNow.readyState >= 1 || Boolean(preloadHls) || Boolean(preloadSlot.blobUrl))
      );

    if (canInstantSwap) {
      const slot = preloadSlot;
      const promotedHls = preloadHls;
      const token = ++streamSessionToken;
      preloadSessionToken += 1;
      if (preloadAbort) {
        try {
          preloadAbort.abort();
        } catch {
          // Ignore
        }
        preloadAbort = null;
      }
      preloadHls = null;
      preloadSlot = null;

      // Clean up old active video engine without touching the promoted standby video
      destroyActiveMediaEngine({ resetVideoElement: true });

      // Swap video roles IN-PLACE (zero DOM detach -> Fullscreen & audio lock persist seamlessly!)
      activeVidNow.id = 'dracin-preload-video';
      activeVidNow.removeAttribute('data-testid');
      activeVidNow.classList.add('is-preload-standby');
      activeVidNow.muted = true;
      activeVidNow.defaultMuted = true;

      standbyVidNow.id = 'dracin-html5-video';
      standbyVidNow.setAttribute('data-testid', 'dracin-html5-video');
      standbyVidNow.classList.remove('is-preload-standby');
      standbyVidNow.removeAttribute('data-preload-episode');

      activeHls = promotedHls;
      activeBlobUrl = slot.blobUrl || '';

      state.currentEpisode = safeEp;
      state.epRangeStart = Math.floor((safeEp - 1) / 20) * 20 + 1;
      state.elapsedSec = 0;
      state.durationSec = Number.isFinite(standbyVidNow.duration) ? standbyVidNow.duration : 0;
      state.isPlaying = true;
      state.fullscreenDrawerOpen = false;
      state.servers = slot.streamRes.servers || [];
      state.activeServerId = slot.server.id;
      state.apiSubtitles = slot.streamRes.subtitles || [];
      state.subtitleCues = [];
      state.subtitleIsReal = false;
      state.triedServerIds = new Set();
      state.streamLocked = false;
      state.searchingBackupMirror = false;
      state.resolvingStream = false;
      state.streamError = '';

      persistHistory(drama, safeEp, 15);
      syncPlayerEpisodeUiInPlace(drama);
      setStatusOverlay(false);
      if (announce) showSwipeHint(announce);

      const { triggerNextPreloadOnce } = bindActiveVideoListeners(standbyVidNow, slot.server, token);
      try {
        if (standbyVidNow.readyState >= 1 && standbyVidNow.currentTime > 0.2) {
          standbyVidNow.currentTime = 0;
        }
      } catch {
        // Ignore seek before metadata
      }
      attemptPlayVideo(standbyVidNow);
      loadSubtitlesForActiveEpisode(drama, safeEp, null, state.apiSubtitles);
      triggerNextPreloadOnce();
      return;
    }

    // Standard path (first load, manual jump to distant episode, or retry)
    destroyPreloadEngine();
    state.currentEpisode = safeEp;
    state.epRangeStart = Math.floor((safeEp - 1) / 20) * 20 + 1;
    state.elapsedSec = 0;
    state.durationSec = 0;
    state.isPlaying = true;
    state.fullscreenDrawerOpen = false;
    state.resolvingStream = true;
    state.streamStatusText = `Memuat stream Episode ${safeEp} dari ${drama.platformName}...`;
    state.streamError = '';
    state.streamLocked = false;
    state.searchingBackupMirror = false;
    state.servers = [];
    state.activeServerId = '';
    state.apiSubtitles = [];
    state.subtitleCues = [];
    state.subtitleIsReal = false;
    state.triedServerIds = new Set();

    destroyActiveMediaEngine();
    persistHistory(drama, safeEp, 15);

    const existingStage = hostEl?.querySelector('#dracin-player-stage');
    const existingVideo = hostEl?.querySelector('#dracin-html5-video');
    const canKeepStageInPlace =
      Boolean(existingStage && existingVideo) ||
      shouldPreserveFullscreenOnEpisodeChange({
        isFullscreen: state.isFullscreen,
        stageMounted: Boolean(existingStage),
      });

    if (canKeepStageInPlace) {
      // NEVER call render() here! Keep #dracin-player-stage & <video> mounted so Fullscreen NEVER exits!
      syncPlayerEpisodeUiInPlace(drama);
      setStatusOverlay(true, state.streamStatusText, false);
    } else {
      render();
      primeVideoAudioGesture();
    }

    if (announce) showSwipeHint(announce);

    const mySession = streamSessionToken;
    const streamRes = await resolveEpisodePlayback(drama, safeEp, { forceRefresh });
    if (mySession !== streamSessionToken || state.view !== 'player') return;

    state.servers = streamRes.servers || [];
    state.apiSubtitles = streamRes.subtitles || [];
    state.streamLocked = Boolean(streamRes.locked);
    const best = pickBestPlaybackServer(state.servers);
    state.activeServerId = best?.id || '';
    state.streamError = streamRes.error || '';
    state.resolvingStream = Boolean(best);

    const needsIframe = best?.kind === 'dailymotion';
    const hasVideoNow = Boolean(hostEl?.querySelector('#dracin-html5-video'));
    const hasStageNow = Boolean(hostEl?.querySelector('#dracin-player-stage'));

    if (!hasStageNow || (needsIframe && hasVideoNow) || (!needsIframe && !hasVideoNow)) {
      render();
    } else {
      syncPlayerEpisodeUiInPlace(drama);
      if (best) {
        setStatusOverlay(true, `Menyiapkan ${best.label}...`, false);
      } else {
        setStatusOverlay(false, state.streamError, true);
      }
    }

    // Load real subtitles in parallel with real video attachment!
    loadSubtitlesForActiveEpisode(drama, safeEp, null, state.apiSubtitles);
    attachMediaToActiveStage();
  }

  async function openDrama(dramaId, episodeNumber = null) {
    let found = state.catalog.find((d) => d.id === dramaId);
    if (!found) {
      // Allow resuming directly from saved history even if platform tab hasn't loaded yet
      const histItem = state.history.find((h) => h.dramaId === dramaId);
      if (histItem) {
        found = {
          id: histItem.dramaId,
          sourceId: histItem.sourceId || (histItem.dramaId.includes('::') ? histItem.dramaId.split('::')[1] : ''),
          apiProvider: histItem.apiProvider || (histItem.dramaId.includes('::') ? 'anichin-unified' : 'dailymotion'),
          title: histItem.title,
          platformId: histItem.platformId,
          platformName: histItem.platformName,
          poster: histItem.poster,
          fallbackPoster: histItem.poster,
          totalEpisodes: histItem.totalEpisodes || 40,
          genre: 'trending',
          genres: ['trending'],
          year: 2026,
          rating: 9.5,
          viewsLabel: 'HD',
          hasIndonesianDub: false,
          synopsis: '',
          cast: [],
        };
        upsertDramaInCatalog(found);
      }
    }
    if (!found) return;

    if (state.activeDramaId && state.activeDramaId !== found.id) {
      destroyPreloadEngine();
      clearDecryptedBlobCache();
    }
    state.activeDrama = { ...found };
    state.activeDramaId = found.id;
    state.view = 'player';
    const hist = state.history.find((h) => h.dramaId === found.id);
    const startEp = episodeNumber ?? hist?.episode ?? 1;

    // Kick off real detail fetch concurrently with Episode playback so exact episode count & synopsis load live!
    const detailPromise = fetchDramaDetail(found).then((detail) => {
      if (!detail) return;
      const updated = {
        ...state.activeDrama,
        title: detail.title || state.activeDrama.title,
        poster: detail.poster || state.activeDrama.poster,
        synopsis: detail.synopsis || state.activeDrama.synopsis,
        totalEpisodes: detail.totalEpisodes || state.activeDrama.totalEpisodes,
        hasKnownEpisodeCount: true,
        altTitle: detail.tags?.length ? detail.tags.slice(0, 4).join(' · ') : state.activeDrama.altTitle,
      };
      upsertDramaInCatalog(updated);
      // Update episode picker & drama info in-place WITHOUT tearing down the running <video>!
      if (state.view === 'player' && state.activeDramaId === updated.id) {
        const pickerWrap = hostEl?.querySelector('#dracin-side-ep-wrap');
        if (pickerWrap) {
          pickerWrap.innerHTML = renderEpisodePickerGrid(updated, false);
          bindEpisodePickerEvents(pickerWrap);
        }
        const epHead = hostEl?.querySelector('.dracin-stage-ep-label');
        if (epHead) epHead.textContent = `Ep ${state.currentEpisode} / ${updated.totalEpisodes}`;
        const synEl = hostEl?.querySelector('.dracin-synopsis');
        if (synEl && updated.synopsis) synEl.textContent = updated.synopsis;
      }
    });

    await selectEpisode(startEp);
    detailPromise.catch(() => {});
  }

  async function refreshLiveCatalog({
    query = state.searchQuery,
    platformId = state.platformId,
    page = 1,
    append = false,
  } = {}) {
    if (append) {
      state.loadingMore = true;
    } else {
      state.loadingFeed = true;
      state.feedError = '';
    }
    render();

    try {
      const res = await fetchUnifiedDracinCatalog({ query, platformId, page });
      if (res && Array.isArray(res.items) && res.items.length > 0) {
        if (append) {
          const existingIds = new Set(state.catalog.map((d) => d.id));
          const fresh = res.items.filter((d) => !existingIds.has(d.id));
          state.catalog = [...state.catalog, ...fresh];
        } else {
          // Merge into global catalog while keeping previously loaded platforms accessible for favorites/history
          const incomingIds = new Set(res.items.map((d) => d.id));
          const kept = state.catalog.filter(
            (d) => !incomingIds.has(d.id) && (platformId === 'all' ? false : d.platformId !== platformId)
          );
          state.catalog = [...res.items, ...kept];
        }
        state.platformCatalogs[platformId] = {
          page,
          hasMore: Boolean(res.hasMore),
          count: res.items.length,
        };
        if (res.activeSources?.length) {
          state.activeSources = Array.from(new Set([...res.activeSources, ...state.activeSources])).slice(0, 6);
        }
      } else if (!append) {
        state.feedError = 'Server platform sedang padat. Coba tekan Muat Ulang atau pilih platform lain.';
      }
    } catch {
      if (!append) {
        state.feedError = 'Gagal menghubungi API drama live. Periksa koneksi lalu coba lagi.';
      }
    } finally {
      state.loadingFeed = false;
      state.loadingMore = false;
      render();
    }
  }

  async function toggleFullscreenMode(forceValue = null) {
    const next = typeof forceValue === 'boolean' ? forceValue : !state.isFullscreen;
    state.isFullscreen = next;
    state.fullscreenDrawerOpen = false;
    if (!next) {
      state.cleanScreen = false;
    }
    document.body.classList.toggle('dracin-fs-lock', next);
    // Update fullscreen & clean screen classes IN-PLACE so video & audio NEVER stutter or reload!
    syncStageChromeInPlace();
    const drawer = hostEl?.querySelector('.dracin-fs-drawer');
    if (drawer) drawer.remove();

    try {
      const stageEl = hostEl?.querySelector('#dracin-player-stage');
      if (next && stageEl?.requestFullscreen && !document.fullscreenElement) {
        await stageEl.requestFullscreen();
      } else if (!next && document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Fixed-viewport cinema fullscreen fallback remains seamlessly active
    }
  }

  function handleEpisodeStep(direction) {
    const drama = getActiveDrama();
    if (!drama) return;
    const nav = getNextPrevEpisode(state.currentEpisode, drama.totalEpisodes);
    if (direction > 0) {
      if (nav.hasNext) {
        selectEpisode(nav.next, { announce: `Episode ${nav.next} / ${nav.total}` });
      } else {
        showSwipeHint('Ini adalah episode terakhir');
      }
    } else if (direction < 0) {
      if (nav.hasPrev) {
        selectEpisode(nav.prev, { announce: `Episode ${nav.prev} / ${nav.total}` });
      } else {
        showSwipeHint('Ini adalah Episode 1');
      }
    }
  }

  function togglePlayPauseInPlace() {
    const videoEl = hostEl?.querySelector('#dracin-html5-video');
    if (!videoEl) return;
    if (videoEl.paused) {
      attemptPlayVideo(videoEl);
    } else {
      videoEl.pause();
      state.isPlaying = false;
      syncPlayerLiveDom();
    }
  }

  function onGlobalKeydown(e) {
    if (!hostEl || state.view !== 'player') return;
    const tag = String(e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.key === 'Escape' && state.isFullscreen) {
      e.preventDefault();
      if (state.cleanScreen) {
        setCleanScreenMode(false);
      } else {
        toggleFullscreenMode(false);
      }
    } else if ((e.key === 'c' || e.key === 'C') && state.isFullscreen && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      setCleanScreenMode();
    } else if (e.key === 'ArrowDown' && state.isFullscreen) {
      e.preventDefault();
      handleEpisodeStep(1);
    } else if (e.key === 'ArrowUp' && state.isFullscreen) {
      e.preventDefault();
      handleEpisodeStep(-1);
    } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleFullscreenMode();
    } else if (e.key === ' ' && state.isFullscreen) {
      e.preventDefault();
      togglePlayPauseInPlace();
    }
  }

  function onNativeFullscreenChange() {
    if (!document.fullscreenElement && state.isFullscreen) {
      state.isFullscreen = false;
      state.cleanScreen = false;
      state.fullscreenDrawerOpen = false;
      document.body.classList.remove('dracin-fs-lock');
      syncStageChromeInPlace();
      const drawer = hostEl?.querySelector('.dracin-fs-drawer');
      if (drawer) drawer.remove();
    }
  }

  function onDocumentClick(e) {
    if (!state.platformDropdownOpen || !hostEl) return;
    const dropdown = hostEl.querySelector('#dracin-platform-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
      state.platformDropdownOpen = false;
      dropdown.classList.remove('is-open');
      const btn = hostEl.querySelector('#dracin-platform-dropdown-btn');
      const panel = hostEl.querySelector('#dracin-platform-dropdown-panel');
      if (btn) btn.setAttribute('aria-expanded', 'false');
      if (panel) panel.hidden = true;
    }
  }

  function bindGlobalListeners() {
    if (globalListenersBound) return;
    globalListenersBound = true;
    document.addEventListener('keydown', onGlobalKeydown);
    document.addEventListener('fullscreenchange', onNativeFullscreenChange);
    document.addEventListener('click', onDocumentClick);
  }

  function unbindGlobalListeners() {
    if (!globalListenersBound) return;
    globalListenersBound = false;
    document.removeEventListener('keydown', onGlobalKeydown);
    document.removeEventListener('fullscreenchange', onNativeFullscreenChange);
    document.removeEventListener('click', onDocumentClick);
    document.body.classList.remove('dracin-fs-lock');
  }

  async function handleRunClipIdentification() {
    if (!state.clipFile && !state.clipClue.trim()) {
      state.clipError = 'Unggah file klip video/screenshot atau tulis petunjuk adegan terlebih dahulu.';
      render();
      return;
    }
    state.clipError = '';
    state.clipLoading = true;
    state.clipProgress = 12;
    state.clipProgressLabel = 'Memulai analisis cuplikan...';
    render();

    try {
      const result = await identifyDracinFromMedia({
        file: state.clipFile,
        clueText: state.clipClue,
        catalog: state.catalog,
        onProgress: (pct, label) => {
          state.clipProgress = pct;
          state.clipProgressLabel = label;
          const bar = hostEl?.querySelector('#dracin-clip-bar-fill');
          const lbl = hostEl?.querySelector('#dracin-clip-status-label');
          if (bar) bar.style.width = `${pct}%`;
          if (lbl) lbl.textContent = `${label} (${pct}%)`;
        },
      });
      state.clipResult = result;
      if (result?.visualProfile?.previewDataUrl) {
        state.clipPreviewUrl = result.visualProfile.previewDataUrl;
      }
      // Make sure matched live dramas are added to catalog so clicking them opens cleanly
      for (const m of result.matches || []) {
        if (m?.drama) upsertDramaInCatalog(m.drama);
      }
      onToast(`Ditemukan ${result.matches.length} drama mirip via ${result.aiEngine}`);
    } catch (err) {
      state.clipError = err?.message || 'Gagal menganalisis file cuplikan.';
    } finally {
      state.clipLoading = false;
      render();
    }
  }

  async function handleLoadAiInsights(drama) {
    if (!drama || state.aiInsightsLoading) return;
    state.aiInsightsLoading = true;
    const btn = hostEl?.querySelector('#dracin-ai-insight-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Menganalisis...';
    }
    try {
      const res = await fetchAiDramaInsights(drama, state.catalog);
      state.aiInsightsMap[drama.id] = res;
      const aiBox = hostEl?.querySelector('#dracin-ai-card-box');
      if (aiBox) {
        aiBox.innerHTML = renderAiInsightCardInner(drama);
        bindAiInsightEvents(aiBox, drama);
      }
    } finally {
      state.aiInsightsLoading = false;
    }
  }

  function renderCrossPlatformMatchesInner(drama) {
    if (!drama) return '';
    const hasResult =
      state.crossMatchesDramaId === drama.id && state.crossMatchesResult !== null;
    const result = hasResult ? state.crossMatchesResult : null;
    const matches = result?.matches || [];

    return `
      <div class="dracin-cross-head">
        <div class="dracin-cross-head-copy">
          <strong>Pencocokan Multi-Sinyal Lintas Platform</strong>
          <span class="dracin-toolbar-note">
            Cocokkan judul, sinopsis/alur, visual poster, & jumlah episode di platform lain.
          </span>
        </div>
        <button
          type="button"
          class="btn btn-secondary btn-xs"
          id="dracin-cross-toolbar-btn"
          ${state.crossMatchesLoading ? 'disabled' : ''}
        >
          ${state.crossMatchesLoading ? 'Mencocokkan...' : hasResult ? 'Scan Ulang' : 'Cari di Platform Lain'}
        </button>
      </div>
      ${
        state.crossMatchesLoading
          ? `<div class="dracin-cross-status">Memindai katalog live lintas platform (judul, sinopsis, visual poster & metadata)...</div>`
          : state.crossMatchesError && state.crossMatchesDramaId === drama.id
          ? `<div class="dracin-cross-status is-error">${escapeHtml(state.crossMatchesError)}</div>`
          : hasResult
          ? matches.length === 0
            ? `<div class="dracin-cross-status">Belum ditemukan drama identik di platform lain untuk "${escapeHtml(drama.title)}". Coba gunakan tab Cari Klip AI atau Mirror Dailymotion.</div>`
            : `
          <div class="dracin-cross-summary">
            Ditemukan ${matches.length} kandidat teratas lintas platform${
              result.visualComparedCount > 0
                ? ` · ${result.visualComparedCount} poster dibandingkan secara visual`
                : ''
            }
          </div>
          <div class="dracin-cross-list" data-testid="dracin-cross-match-list">
            ${matches
              .map(
                (m) => `
              <article class="dracin-cross-item">
                <img
                  src="${escapeHtml(m.drama.poster || m.drama.fallbackPoster)}"
                  alt="${escapeHtml(m.drama.title)}"
                  class="dracin-cross-poster"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                  onerror="this.onerror=null;this.src='${escapeHtml(m.drama.fallbackPoster)}'"
                />
                <div class="dracin-cross-info">
                  <div class="dracin-cross-title-row">
                    <strong>${escapeHtml(m.drama.title)}</strong>
                    <span class="dracin-cross-score">${m.confidence}% Cocok</span>
                  </div>
                  <div class="dracin-cross-meta">
                    <span class="dracin-cross-platform">${escapeHtml(m.drama.platformName)}</span>
                    <span aria-hidden="true">·</span>
                    <span>${m.drama.totalEpisodes} Ep</span>
                  </div>
                  <p class="dracin-cross-reasons">${escapeHtml(m.reasons.join(' · '))}</p>
                  <div class="dracin-cross-actions">
                    <button
                      type="button"
                      class="btn btn-primary btn-xs"
                      data-dracin-cross-open="${escapeHtml(m.drama.id)}"
                      data-dracin-cross-ep="${Math.min(state.currentEpisode, m.drama.totalEpisodes || state.currentEpisode)}"
                    >
                      Buka Ep ${Math.min(state.currentEpisode, m.drama.totalEpisodes || state.currentEpisode)} di ${escapeHtml(m.drama.platformName)}
                    </button>
                    <button
                      type="button"
                      class="btn btn-secondary btn-xs"
                      data-dracin-cross-open="${escapeHtml(m.drama.id)}"
                      data-dracin-cross-ep="1"
                    >
                      Ep 1
                    </button>
                  </div>
                </div>
              </article>
            `
              )
              .join('')}
          </div>
        `
          : ''
      }
    `;
  }

  function bindCrossPlatformEvents(container, drama) {
    if (!container || !drama) return;
    container.querySelector('#dracin-cross-toolbar-btn')?.addEventListener('click', () => {
      handleSearchCrossPlatformMatches(drama, { scrollToPanel: false });
    });
    container.querySelectorAll('[data-dracin-cross-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        primeVideoAudioGesture();
        const id = btn.getAttribute('data-dracin-cross-open');
        const ep = Number(btn.getAttribute('data-dracin-cross-ep')) || 1;
        if (id) openDrama(id, ep);
      });
    });
  }

  async function handleSearchCrossPlatformMatches(drama, { scrollToPanel = false } = {}) {
    if (!drama || state.crossMatchesLoading) return;
    if (scrollToPanel && state.isFullscreen) {
      toggleFullscreenMode(false);
    }
    state.crossMatchesLoading = true;
    state.crossMatchesDramaId = drama.id;
    state.crossMatchesError = '';
    setStatusOverlay(state.resolvingStream, state.streamError || state.streamStatusText, Boolean(state.streamError));

    const box = hostEl?.querySelector('#dracin-cross-platform-box');
    if (box) {
      box.innerHTML = renderCrossPlatformMatchesInner(drama);
      if (scrollToPanel) {
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    try {
      const res = await findCrossPlatformDramaMatches(drama, state.catalog, { limit: 5 });
      state.crossMatchesResult = res;
      for (const m of res.matches || []) {
        if (m?.drama) upsertDramaInCatalog(m.drama);
      }
      if (res.matches.length > 0) {
        onToast(`Ditemukan ${res.matches.length} drama cocok di platform lain`);
      } else {
        onToast('Belum ditemukan kecocokan kuat di platform lain');
      }
    } catch {
      state.crossMatchesError = 'Gagal memindai platform lain saat ini. Silakan coba lagi.';
    } finally {
      state.crossMatchesLoading = false;
      setStatusOverlay(state.resolvingStream, state.streamError || state.streamStatusText, Boolean(state.streamError));
      const updatedBox = hostEl?.querySelector('#dracin-cross-platform-box');
      if (updatedBox) {
        updatedBox.innerHTML = renderCrossPlatformMatchesInner(drama);
        bindCrossPlatformEvents(updatedBox, drama);
        if (scrollToPanel) {
          updatedBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }

  function renderDramaCard(drama) {
    const isFav = state.favorites.includes(drama.id);
    const hist = state.history.find((h) => h.dramaId === drama.id);
    const epBadge = drama.hasKnownEpisodeCount ? `${drama.totalEpisodes} Ep · HD` : 'Live HD';
    return `
      <article class="dracin-card" data-dracin-card="${escapeHtml(drama.id)}">
        <button type="button" class="dracin-card-poster-btn" data-dracin-open="${escapeHtml(drama.id)}" aria-label="Tonton ${escapeHtml(drama.title)}">
          <img
            src="${escapeHtml(drama.poster || drama.fallbackPoster)}"
            alt="Poster ${escapeHtml(drama.title)}"
            class="dracin-card-poster"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='${escapeHtml(drama.fallbackPoster)}'"
          />
          <div class="dracin-card-scrim" aria-hidden="true"></div>
          <span class="dracin-card-platform">${escapeHtml(drama.platformName)}</span>
          <span class="dracin-card-epcount">${epBadge}</span>
          ${hist ? `<span class="dracin-card-resume">Lanjut Ep ${hist.episode}</span>` : ''}
        </button>
        <div class="dracin-card-body">
          <button type="button" class="dracin-card-title-btn" data-dracin-open="${escapeHtml(drama.id)}">
            ${escapeHtml(drama.title)}
          </button>
          <div class="dracin-card-meta">
            <span>${escapeHtml(getGenreLabel(drama.genre))}</span>
            <span aria-hidden="true">·</span>
            <span>${drama.hasIndonesianDub ? 'Dub Indo' : 'Sub Indo'}</span>
          </div>
          <div class="dracin-card-actions">
            <button type="button" class="btn btn-primary btn-xs dracin-watch-btn" data-dracin-open="${escapeHtml(drama.id)}">
              ${hist ? `Lanjut Ep ${hist.episode}` : 'Tonton Gratis'}
            </button>
            <button
              type="button"
              class="dracin-icon-btn ${isFav ? 'is-fav' : ''}"
              data-dracin-fav="${escapeHtml(drama.id)}"
              aria-label="${isFav ? 'Hapus dari favorit' : 'Simpan ke favorit'} ${escapeHtml(drama.title)}"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function renderSkeletonGrid() {
    return `
      <div class="dracin-catalog-grid" aria-busy="true" aria-label="Memuat daftar drama live">
        ${Array.from({ length: 8 })
          .map(
            () => `
          <div class="dracin-card dracin-skeleton-card">
            <div class="dracin-skeleton-poster"></div>
            <div class="dracin-card-body">
              <div class="dracin-skeleton-line"></div>
              <div class="dracin-skeleton-line is-short"></div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  }

  function renderPlatformOptionsHtml(query = '') {
    const matches = filterDracinPlatforms(query, DRACIN_PLATFORMS);
    if (!matches.length) {
      return `<div class="dracin-dropdown-empty">Platform "${escapeHtml(query)}" tidak ditemukan.</div>`;
    }
    return matches
      .map(
        (p) => `
      <button
        type="button"
        role="option"
        aria-selected="${state.platformId === p.id ? 'true' : 'false'}"
        class="dracin-dropdown-item ${state.platformId === p.id ? 'is-active' : ''}"
        data-dracin-platform="${escapeHtml(p.id)}"
      >
        <span class="dracin-dropdown-dot" style="background:${escapeHtml(p.accent || '#e11d48')}" aria-hidden="true"></span>
        <span class="dracin-dropdown-item-name">${escapeHtml(p.name)}</span>
        <span class="dracin-dropdown-item-region">${escapeHtml(p.region || '')}</span>
        ${state.platformId === p.id ? `<span class="dracin-dropdown-check" aria-hidden="true">✓</span>` : ''}
      </button>
    `
      )
      .join('');
  }

  function renderDiscoverView() {
    const filtered = filterDracinCatalog(state.catalog, {
      platformId: state.platformId,
      genreId: state.genreId,
      query: state.searchQuery,
    });
    const recentHistory = state.history.slice(0, 6);
    const activePlatformMeta =
      DRACIN_PLATFORMS.find((p) => p.id === state.platformId) || DRACIN_PLATFORMS[0];
    const platPageInfo = state.platformCatalogs[state.platformId] || { page: 1, hasMore: false };

    return `
      <div class="dracin-discover">
        <form id="dracin-search-form" class="dracin-search-row" role="search">
          <div class="dracin-search-input-wrap">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              type="search"
              id="dracin-search-input"
              class="dracin-search-input"
              value="${escapeHtml(state.searchQuery)}"
              placeholder="Cari judul drama asli di ${escapeHtml(activePlatformMeta?.name || 'Semua Platform')}..."
              aria-label="Cari judul drama China"
            />
            ${
              state.searchQuery
                ? `<button type="button" id="dracin-search-clear" class="dracin-search-clear" aria-label="Hapus pencarian">✕</button>`
                : ''
            }
          </div>
          <button type="submit" class="btn btn-primary btn-sm dracin-search-submit">Cari Live</button>
          <button type="button" class="btn btn-secondary btn-sm" data-dracin-view="clip">
            Cari dari Klip
          </button>
        </form>

        <div class="dracin-filter-section">
          <div class="dracin-filter-head">
            <span class="dracin-filter-label">Platform Short Drama Real-Time</span>
            <span class="dracin-filter-meta" data-testid="dracin-catalog-count">
              ${
                state.loadingFeed
                  ? `Menghubungkan ${escapeHtml(activePlatformMeta?.name || 'platform live')}...`
                  : `${escapeHtml(activePlatformMeta?.name || 'Semua')} · ${filtered.length} drama asli`
              }
            </span>
          </div>

          <div class="dracin-platform-dropdown ${state.platformDropdownOpen ? 'is-open' : ''}" id="dracin-platform-dropdown">
            <button
              type="button"
              id="dracin-platform-dropdown-btn"
              class="dracin-dropdown-trigger"
              aria-haspopup="listbox"
              aria-expanded="${state.platformDropdownOpen ? 'true' : 'false'}"
              aria-controls="dracin-platform-dropdown-panel"
            >
              <span class="dracin-dropdown-trigger-left">
                <span class="dracin-dropdown-dot" style="background:${escapeHtml(activePlatformMeta.accent || '#e11d48')}" aria-hidden="true"></span>
                <span class="dracin-dropdown-trigger-label">${escapeHtml(activePlatformMeta.name)}</span>
                <span class="dracin-dropdown-trigger-sub">${escapeHtml(activePlatformMeta.region || '')}</span>
              </span>
              <svg class="dracin-dropdown-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </button>

            <div
              id="dracin-platform-dropdown-panel"
              class="dracin-dropdown-menu"
              ${state.platformDropdownOpen ? '' : 'hidden'}
            >
              <div class="dracin-dropdown-search-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                <input
                  type="search"
                  id="dracin-platform-search-input"
                  class="dracin-dropdown-search"
                  value="${escapeHtml(state.platformSearchQuery)}"
                  placeholder="Cari platform (Melolo, DramaBox, ReelShort...)"
                  aria-label="Cari platform drama"
                  autocomplete="off"
                />
              </div>
              <div
                id="dracin-platform-options"
                class="dracin-dropdown-list"
                role="listbox"
                aria-label="Daftar platform short drama"
              >
                ${renderPlatformOptionsHtml(state.platformSearchQuery)}
              </div>
            </div>
          </div>

          <div class="dracin-genre-strip" role="group" aria-label="Filter genre drama">
            ${DRACIN_GENRES.map(
              (g) => `
              <button
                type="button"
                class="dracin-genre-btn ${state.genreId === g.id ? 'is-active' : ''}"
                data-dracin-genre="${escapeHtml(g.id)}"
              >
                ${escapeHtml(g.label)}
              </button>
            `
            ).join('')}
          </div>
        </div>

        ${
          recentHistory.length > 0 && !state.searchQuery
            ? `
          <section class="dracin-continue-dropdown ${state.continueDropdownOpen ? 'is-open' : ''}" id="dracin-continue-dropdown" aria-label="Lanjutkan menonton">
            <button
              type="button"
              id="dracin-continue-toggle"
              class="dracin-continue-trigger"
              aria-expanded="${state.continueDropdownOpen ? 'true' : 'false'}"
              aria-controls="dracin-continue-panel"
            >
              <span class="dracin-continue-trigger-left">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <strong>Lanjutkan Menonton</strong>
                <span class="dracin-continue-badge">${state.history.length}</span>
              </span>
              <span class="dracin-continue-trigger-right">
                <span class="dracin-continue-preview">${escapeHtml(recentHistory[0].title)} · Ep ${recentHistory[0].episode}</span>
                <svg class="dracin-dropdown-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
              </span>
            </button>
            <div id="dracin-continue-panel" class="dracin-continue-menu" ${state.continueDropdownOpen ? '' : 'hidden'}>
              <div class="dracin-continue-list">
                ${recentHistory
                  .map(
                    (h) => `
                  <button type="button" class="dracin-continue-row" data-dracin-resume="${escapeHtml(h.dramaId)}" data-dracin-resume-ep="${h.episode}">
                    <img src="${escapeHtml(h.poster)}" alt="" class="dracin-continue-thumb" referrerpolicy="no-referrer" />
                    <div class="dracin-continue-copy">
                      <strong>${escapeHtml(h.title)}</strong>
                      <span>${escapeHtml(h.platformName)} · Ep ${h.episode} dari ${h.totalEpisodes}</span>
                    </div>
                    <span class="dracin-continue-action">Lanjut →</span>
                  </button>
                `
                  )
                  .join('')}
              </div>
              <div class="dracin-continue-footer">
                <button type="button" class="dracin-text-link" data-dracin-view="history">
                  Lihat Semua Riwayat (${state.history.length})
                </button>
              </div>
            </div>
          </section>
        `
            : ''
        }

        ${
          state.loadingFeed && filtered.length === 0
            ? renderSkeletonGrid()
            : filtered.length === 0
            ? `
          <div class="dracin-empty-state">
            <p>${escapeHtml(
              state.feedError ||
                `Belum ditemukan drama di ${activePlatformMeta?.name || 'platform ini'} untuk filter atau kata kunci "${state.searchQuery}".`
            )}</p>
            <div class="dracin-empty-actions">
              <button type="button" class="btn btn-primary btn-sm" id="dracin-retry-feed">Muat Ulang Live</button>
              <button type="button" class="btn btn-secondary btn-sm" id="dracin-reset-filters">Tampilkan Semua Platform</button>
            </div>
          </div>
        `
            : `
          <div class="dracin-catalog-grid" data-testid="dracin-catalog-grid">
            ${filtered.map(renderDramaCard).join('')}
          </div>
          ${
            platPageInfo.hasMore && state.genreId === 'all'
              ? `
            <div class="dracin-load-more-wrap">
              <button type="button" class="btn btn-secondary btn-sm" id="dracin-load-more-btn" ${state.loadingMore ? 'disabled' : ''}>
                ${
                  state.loadingMore
                    ? 'Memuat halaman berikutnya...'
                    : `Muat Lebih Banyak Drama ${escapeHtml(activePlatformMeta?.short || '')}`
                }
              </button>
            </div>
          `
              : ''
          }
        `
        }
      </div>
    `;
  }

  function renderEpisodePickerGrid(drama, compact = false) {
    const episodes = buildEpisodeList(drama);
    const ranges = buildEpisodeRanges(drama.totalEpisodes, 20);
    const start = Math.min(state.epRangeStart, ranges[ranges.length - 1]?.start || 1);
    const end = Math.min(drama.totalEpisodes, start + 19);
    const visibleEps = episodes.slice(start - 1, end);

    return `
      <div class="dracin-ep-picker ${compact ? 'is-compact' : ''}">
        <div class="dracin-ep-picker-head">
          <div>
            <strong>Pilih Episode (Gratis & Terbuka)</strong>
            <span class="dracin-ep-picker-sub">Ep 1–${drama.totalEpisodes} · Bebas lompat episode</span>
          </div>
          <form class="dracin-jump-form" data-dracin-jump-form>
            <input
              type="number"
              min="1"
              max="${drama.totalEpisodes}"
              value="${state.currentEpisode}"
              class="dracin-jump-input"
              aria-label="Lompat ke nomor episode"
              data-dracin-jump-input
            />
            <button type="submit" class="btn btn-primary btn-xs">Lompat</button>
          </form>
        </div>

        <div class="dracin-ep-ranges" role="tablist" aria-label="Rentang episode">
          ${ranges
            .map(
              (r) => `
            <button
              type="button"
              class="dracin-range-btn ${start === r.start ? 'is-active' : ''}"
              data-dracin-range="${r.start}"
            >
              ${r.label}
            </button>
          `
            )
            .join('')}
        </div>

        <div class="dracin-ep-grid" data-testid="dracin-episode-grid">
          ${visibleEps
            .map(
              (ep) => `
            <button
              type="button"
              class="dracin-ep-btn ${ep.number === state.currentEpisode ? 'is-active' : ''}"
              data-dracin-ep="${ep.number}"
              aria-label="Putar Episode ${ep.number}"
            >
              <span>${ep.number}</span>
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  function renderAiInsightCardInner(drama) {
    const aiInsight = state.aiInsightsMap[drama.id];
    return `
      <div class="dracin-ai-card-head">
        <strong>Asisten AI Dracin</strong>
        <button type="button" class="btn btn-secondary btn-xs" id="dracin-ai-insight-btn" ${state.aiInsightsLoading ? 'disabled' : ''}>
          ${state.aiInsightsLoading ? 'Menganalisis...' : aiInsight ? 'Perbarui Analisis AI' : 'Ringkasan & Rekomendasi AI'}
        </button>
      </div>
      ${
        aiInsight
          ? `
        <p class="dracin-ai-text">${escapeHtml(aiInsight.insight)}</p>
        <span class="dracin-ai-engine">Sumber: ${escapeHtml(aiInsight.engine)}</span>
        ${
          aiInsight.similar?.length
            ? `
          <div class="dracin-similar-row">
            ${aiInsight.similar
              .map(
                (sim) => `
              <button type="button" class="dracin-similar-btn" data-dracin-open="${escapeHtml(sim.id)}">
                <span>${escapeHtml(sim.title)}</span>
                <small>${escapeHtml(sim.platformName)} · ${sim.totalEpisodes} Ep</small>
              </button>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }
      `
          : `<p class="dracin-ai-hint">Klik tombol di atas untuk ringkasan tanpa spoiler & rekomendasi drama mirip.</p>`
      }
    `;
  }

  function renderPlayerView() {
    const drama = getActiveDrama();
    if (!drama) return renderDiscoverView();
    const nav = getNextPrevEpisode(state.currentEpisode, drama.totalEpisodes);
    const isFav = state.favorites.includes(drama.id);
    const activeServer =
      state.servers.find((s) => s.id === state.activeServerId) || pickBestPlaybackServer(state.servers);
    const activeCue = state.subtitleIsReal
      ? getActiveSubtitleCue(state.subtitleCues, state.elapsedSec, { loop: false })
      : null;
    const pct = state.durationSec > 0 ? Math.min(100, (state.elapsedSec / state.durationSec) * 100) : 0;
    const isDailymotion = activeServer?.kind === 'dailymotion';

    let mediaSurfaceHtml = '';
    if (isDailymotion && activeServer.embedUrl) {
      mediaSurfaceHtml = `
        <iframe
          class="dracin-stage-iframe"
          src="${escapeHtml(activeServer.embedUrl)}"
          title="${escapeHtml(drama.title)} Episode ${state.currentEpisode}"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          loading="eager"
          referrerpolicy="strict-origin-when-cross-origin"
        ></iframe>
      `;
    } else {
      mediaSurfaceHtml = `
        <video
          id="dracin-html5-video"
          class="dracin-stage-video"
          poster="${escapeHtml(drama.poster || drama.fallbackPoster)}"
          playsinline
          webkit-playsinline
          preload="auto"
          data-testid="dracin-html5-video"
        ></video>
        <video
          id="dracin-preload-video"
          class="dracin-stage-video is-preload-standby"
          muted
          playsinline
          webkit-playsinline
          preload="auto"
          aria-hidden="true"
        ></video>
        <div id="dracin-stage-tap-layer" class="dracin-stage-tap-layer" aria-hidden="true"></div>
      `;
    }

    return `
      <div class="dracin-player-layout">
        <div class="dracin-player-col">
          <div
            id="dracin-player-stage"
            class="dracin-stage ${state.isFullscreen ? 'is-fullscreen' : ''} ${state.isFullscreen && state.cleanScreen ? 'is-clean-screen' : ''}"
            data-testid="dracin-player-stage"
            data-episode="${state.currentEpisode}"
            data-fullscreen="${state.isFullscreen ? 'true' : 'false'}"
            data-clean-screen="${state.isFullscreen && state.cleanScreen ? 'true' : 'false'}"
          >
            ${mediaSurfaceHtml}

            <!-- Real Buffering / Decrypting Loader -->
            <div id="dracin-media-loader" class="dracin-media-loader" ${state.resolvingStream ? '' : 'hidden'}>
              <div class="dracin-spinner" aria-hidden="true"></div>
              <span>${escapeHtml(state.streamStatusText || 'Memuat video HD...')}</span>
            </div>

            <!-- Real Stream Error / VIP Lock Overlay with Instant Retry, Cross-Platform Match & Mirror Lookup -->
            <div id="dracin-media-error" class="dracin-media-error" ${state.streamError ? '' : 'hidden'}>
              <p>${escapeHtml(state.streamError || 'Gagal memuat video.')}</p>
              <div class="dracin-error-actions">
                <button type="button" class="btn btn-primary btn-xs" id="dracin-retry-stream-btn">Coba Muat Ulang</button>
                <button type="button" class="btn btn-secondary btn-xs" id="dracin-find-cross-platform-btn" ${state.crossMatchesLoading ? 'disabled' : ''}>
                  ${state.crossMatchesLoading ? 'Mencocokkan Platform...' : 'Cari di Platform Lain'}
                </button>
                <button type="button" class="btn btn-secondary btn-xs" id="dracin-search-dm-mirror-btn" ${state.searchingBackupMirror ? 'disabled' : ''}>
                  ${state.searchingBackupMirror ? 'Mencari Mirror...' : 'Cari Mirror Dailymotion'}
                </button>
                <button type="button" class="btn btn-secondary btn-xs" id="dracin-error-prev-ep-btn" ${state.currentEpisode > 1 ? '' : 'hidden'}>
                  ← Ep Sebelumnya
                </button>
              </div>
            </div>

            <!-- Autoplay Muted Unmute Pill (only if browser policy forced muted start) -->
            <button
              type="button"
              id="dracin-unmute-banner"
              class="dracin-unmute-banner"
              ${state.autoplayMutedNotice && state.isMuted ? '' : 'hidden'}
            >
              🔊 Ketuk untuk Aktifkan Suara
            </button>

            <!-- Top Overlay Bar -->
            <div class="dracin-stage-topbar">
              <button type="button" class="dracin-stage-pill-btn" id="dracin-back-discover">
                ← Daftar
              </button>
              <div class="dracin-stage-title-wrap">
                <span class="dracin-stage-ep-label">Ep ${state.currentEpisode} / ${drama.totalEpisodes}</span>
                <strong class="dracin-stage-title">${escapeHtml(drama.title)}</strong>
              </div>
              <div class="dracin-stage-top-actions">
                <button
                  type="button"
                  class="dracin-stage-pill-btn dracin-clean-btn"
                  id="dracin-clean-fs-btn"
                  data-testid="dracin-clean-fs-btn"
                  ${state.isFullscreen ? '' : 'hidden'}
                >
                  Layar Bersih
                </button>
                <button type="button" class="dracin-stage-pill-btn" id="dracin-fs-toggle-top">
                  ${state.isFullscreen ? 'Keluar Full' : 'Layar Penuh'}
                </button>
              </div>
            </div>

            <!-- Swipe / Episode Switch Toast -->
            <div id="dracin-swipe-toast" class="dracin-swipe-toast" role="status" ${state.swipeHintText ? '' : 'hidden'}>
              ${escapeHtml(state.swipeHintText)}
            </div>

            <!-- Clean Screen Minimal Restore Button (Visible ONLY in Fullscreen Clean Screen) -->
            <button
              type="button"
              id="dracin-restore-hud-btn"
              class="dracin-restore-hud-btn"
              data-testid="dracin-restore-hud-btn"
              aria-label="Tampilkan kembali menu pemutar"
              ${state.isFullscreen && state.cleanScreen ? '' : 'hidden'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Tampilkan Menu</span>
            </button>

            <!-- Right Vertical Short-Drama Action Rail -->
            <div class="dracin-action-rail" aria-label="Kontrol cepat pemutar">
              <button type="button" class="dracin-rail-btn ${isFav ? 'is-active' : ''}" data-dracin-fav="${escapeHtml(drama.id)}" aria-label="Favoritkan drama">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                <span>${isFav ? 'Disimpan' : 'Favorit'}</span>
              </button>

              ${
                !isDailymotion
                  ? `
                <button type="button" class="dracin-rail-btn ${!state.isMuted ? 'is-active' : ''}" id="dracin-rail-mute-btn" aria-label="${state.isMuted ? 'Nyalakan suara' : 'Bisukan suara'}">
                  ${
                    state.isMuted
                      ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg><span>Bisu</span>`
                      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg><span>Suara</span>`
                  }
                </button>
              `
                  : ''
              }

              <button type="button" class="dracin-rail-btn" id="dracin-rail-episodes-btn" aria-label="Pilih episode">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                <span>Ep ${state.currentEpisode}</span>
              </button>

              <button type="button" class="dracin-rail-btn" id="dracin-rail-sub-btn" aria-label="Ganti bahasa subtitle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 13h4"/><path d="M15 13h2"/><path d="M7 16h2"/><path d="M13 16h4"/></svg>
                <span>Sub ${escapeHtml(state.subtitleLang.toUpperCase())}</span>
              </button>

              ${
                !isDailymotion
                  ? `
                <button type="button" class="dracin-rail-btn" id="dracin-rail-speed-btn" aria-label="Kecepatan putar">
                  <span class="dracin-rail-speed-val">${state.playbackSpeed}x</span>
                  <span>Cepat</span>
                </button>
              `
                  : ''
              }

              <button
                type="button"
                class="dracin-rail-btn ${state.cleanScreen ? 'is-active' : ''}"
                id="dracin-rail-clean-btn"
                aria-label="Aktifkan mode layar bersih tanpa ikon"
                ${state.isFullscreen ? '' : 'hidden'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
                <span>Bersih</span>
              </button>

              <button type="button" class="dracin-rail-btn" id="dracin-rail-fs-btn" aria-label="${state.isFullscreen ? 'Keluar layar penuh' : 'Layar penuh'}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
                <span>${state.isFullscreen ? 'Kecilkan' : 'Full'}</span>
              </button>

              <button type="button" class="dracin-rail-btn" id="dracin-rail-share-btn" aria-label="Bagikan link episode">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg>
                <span>Bagikan</span>
              </button>
            </div>

            <!-- Real Synced Subtitle Overlay (Always visible even in Clean Screen if real external subtitles exist) -->
            <div
              id="dracin-live-subtitle"
              class="dracin-live-subtitle"
              data-testid="dracin-live-subtitle"
              ${state.subtitleLang === 'off' || !state.subtitleIsReal || !activeCue?.text ? 'hidden' : ''}
            >
              ${escapeHtml(activeCue?.text || '')}
            </div>

            <!-- Bottom Controls Bar -->
            ${
              !isDailymotion
                ? `
              <div class="dracin-stage-bottom">
                <div class="dracin-stage-meta-line">
                  <span>${escapeHtml(drama.platformName)}</span>
                  <span aria-hidden="true">·</span>
                  <span id="dracin-stage-server-label">${escapeHtml(activeServer?.label || 'Streaming HD')}</span>
                  <span id="dracin-fs-swipe-hint" ${state.isFullscreen ? '' : 'hidden'}>· Geser / Scroll ↑↓ pindah ep</span>
                </div>

                <div
                  id="dracin-progress-track"
                  class="dracin-progress-track is-seekable"
                  role="slider"
                  aria-label="Progres video"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow="${Math.round(pct)}"
                  tabindex="0"
                >
                  <div id="dracin-progress-fill" class="dracin-progress-fill" style="width:${pct}%"></div>
                </div>

                <div class="dracin-stage-controls-row">
                  <button type="button" class="dracin-ep-step-btn" id="dracin-prev-ep-btn" ${nav.hasPrev ? '' : 'disabled'}>
                    ↑ Ep Sblm
                  </button>
                  <button type="button" class="dracin-inline-play-btn ${state.isPlaying ? 'is-playing' : ''}" id="dracin-toggle-play-btn" aria-label="${state.isPlaying ? 'Jeda video' : 'Putar video'}">
                    ${
                      state.isPlaying
                        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`
                    }
                  </button>
                  <span id="dracin-time-label" class="dracin-time-label">
                    ${state.durationSec > 0 ? `${formatClockTime(state.elapsedSec)} / ${formatClockTime(state.durationSec)}` : '0:00 / --:--'}
                  </span>
                  <button type="button" class="dracin-ep-step-btn" id="dracin-next-ep-btn" ${nav.hasNext ? '' : 'disabled'}>
                    ↓ Ep Lanjut
                  </button>
                </div>
              </div>
            `
                : ''
            }
          </div>

          <!-- Quality / Server Switcher & Subtitle Controls -->
          <div class="dracin-player-toolbar">
            <div class="dracin-toolbar-group">
              <label for="dracin-sub-select" class="dracin-toolbar-label">Subtitle & Audio</label>
              <select id="dracin-sub-select" class="dracin-select" aria-label="Pilih bahasa subtitle">
                ${DRACIN_SUBTITLE_LANGS.map(
                  (l) => `<option value="${l.code}" ${state.subtitleLang === l.code ? 'selected' : ''}>${escapeHtml(l.label)}</option>`
                ).join('')}
              </select>
              <span id="dracin-sub-status" class="dracin-toolbar-note">${escapeHtml(state.subtitleReason)}</span>
            </div>

            <div class="dracin-toolbar-group">
              <span class="dracin-toolbar-label">Kualitas Video & Server Live</span>
              <div class="dracin-server-row">
                <div id="dracin-server-row-inner" class="dracin-server-row-inner">
                  ${renderServerButtonsHtml(activeServer)}
                </div>
                ${
                  isDailymotion && activeServer?.watchUrl
                    ? `<a href="${escapeHtml(activeServer.watchUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-xs dracin-dm-ext-link">Buka di Dailymotion ↗</a>`
                    : ''
                }
                <label class="dracin-autonext-toggle">
                  <input type="checkbox" id="dracin-autonext-check" ${state.autoNext ? 'checked' : ''} />
                  <span>Auto-Lanjut Ep</span>
                </label>
              </div>
            </div>
          </div>

          <div id="dracin-cross-platform-box" class="dracin-cross-box">
            ${renderCrossPlatformMatchesInner(drama)}
          </div>
        </div>

        <!-- Right Column: Episode Picker + Drama Info + AI Insights -->
        <aside class="dracin-side-col">
          <div id="dracin-side-ep-wrap">
            ${renderEpisodePickerGrid(drama, false)}
          </div>

          <div class="dracin-info-box">
            <div class="dracin-info-head">
              <h3>${escapeHtml(drama.title)}</h3>
              <p class="dracin-info-alt">${escapeHtml(drama.altTitle || drama.platformName)}</p>
            </div>
            <div class="dracin-info-meta">
              <span>${escapeHtml(drama.platformName)}</span>
              <span aria-hidden="true">·</span>
              <span>${escapeHtml(getGenreLabel(drama.genre))}</span>
              <span aria-hidden="true">·</span>
              <span>${drama.totalEpisodes} Episode</span>
            </div>
            <p class="dracin-synopsis">${escapeHtml(drama.synopsis)}</p>
            ${
              drama.cast?.length
                ? `<p class="dracin-cast"><strong>Pemeran:</strong> ${escapeHtml(drama.cast.join(', '))}</p>`
                : ''
            }
            <div class="dracin-ai-card" id="dracin-ai-card-box">
              ${renderAiInsightCardInner(drama)}
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  function renderClipIdentifierView() {
    const res = state.clipResult;
    return `
      <div class="dracin-clip-view">
        <div class="dracin-clip-card">
          <h3>Cari Judul Drama dari Klip Video atau Screenshot</h3>
          <p class="dracin-clip-desc">
            Unggah potongan video pendek (MP4/MOV/WebM) atau gambar screenshot cuplikan (JPG/PNG/WebP).
            Sistem membaca sidik visual & rasio frame lalu menggabungkan Multi-AI dengan pencarian live platform short drama.
          </p>

          <div class="dracin-clip-upload-zone">
            <label for="dracin-clip-file-input" class="dracin-clip-drop-label">
              ${
                state.clipPreviewUrl
                  ? `<img src="${escapeHtml(state.clipPreviewUrl)}" alt="Pratinjau cuplikan" class="dracin-clip-preview-thumb" />`
                  : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`
              }
              <div class="dracin-clip-drop-copy">
                <strong>${state.clipFileName ? escapeHtml(state.clipFileName) : 'Pilih Screenshot atau Klip Video Cuplikan'}</strong>
                <span>Mendukung JPG, PNG, WebP, MP4, MOV, WebM</span>
              </div>
            </label>
            <input type="file" id="dracin-clip-file-input" accept="image/*,video/*" class="dracin-sr-file" />
          </div>

          <div class="dracin-clip-clue-group">
            <label for="dracin-clip-clue-input" class="dracin-toolbar-label">
              Petunjuk Adegan / Dialog / Subtitle di Cuplikan (Opsional)
            </label>
            <input
              type="text"
              id="dracin-clip-clue-input"
              class="dracin-text-input"
              value="${escapeHtml(state.clipClue)}"
              placeholder="Contoh: CEO menantu dihina di pesta, sistem cinta, dokter jenius..."
            />
          </div>

          ${state.clipError ? `<p class="dracin-error-text" role="alert">${escapeHtml(state.clipError)}</p>` : ''}

          ${
            state.clipLoading
              ? `
            <div class="dracin-clip-progress">
              <span id="dracin-clip-status-label">${escapeHtml(state.clipProgressLabel)} (${state.clipProgress}%)</span>
              <div class="dracin-progress-track">
                <div id="dracin-clip-bar-fill" class="dracin-progress-fill" style="width:${state.clipProgress}%"></div>
              </div>
            </div>
          `
              : ''
          }

          <div class="dracin-clip-actions">
            <button type="button" class="btn btn-primary" id="dracin-run-clip-btn" ${state.clipLoading ? 'disabled' : ''}>
              ${state.clipLoading ? 'Mengidentifikasi Cuplikan...' : 'Identifikasi Drama Sekarang'}
            </button>
            ${
              state.clipFile || state.clipResult || state.clipClue
                ? `<button type="button" class="btn btn-secondary" id="dracin-reset-clip-btn">Reset</button>`
                : ''
            }
          </div>
        </div>

        ${
          res
            ? `
          <div class="dracin-clip-results" data-testid="dracin-clip-results">
            <div class="dracin-ai-summary-banner">
              <strong>Hasil Analisis · ${escapeHtml(res.aiEngine)}</strong>
              <p>${escapeHtml(res.aiSummary)}</p>
              ${
                res.visualProfile
                  ? `<span class="dracin-visual-meta">Frame: ${res.visualProfile.width}×${res.visualProfile.height}px · Rasio ${res.visualProfile.aspectRatio} · Warna dominan ${escapeHtml(res.visualProfile.dominantHex)}</span>`
                  : ''
              }
            </div>

            <div class="dracin-match-list">
              ${res.matches
                .map(
                  (m, idx) => `
                <article class="dracin-match-row">
                  <img
                    src="${escapeHtml(m.drama.poster || m.drama.fallbackPoster)}"
                    alt="${escapeHtml(m.drama.title)}"
                    class="dracin-match-poster"
                    referrerpolicy="no-referrer"
                    onerror="this.onerror=null;this.src='${escapeHtml(m.drama.fallbackPoster)}'"
                  />
                  <div class="dracin-match-info">
                    <div class="dracin-match-head">
                      <span class="dracin-match-rank">#${idx + 1}</span>
                      <strong>${escapeHtml(m.drama.title)}</strong>
                      <span class="dracin-match-score">${m.confidence}% Mirip</span>
                    </div>
                    <div class="dracin-card-meta">
                      <span>${escapeHtml(m.drama.platformName)}</span>
                      <span aria-hidden="true">·</span>
                      <span>Perkiraan sekitar Ep ${m.estimatedEpisode}</span>
                      <span aria-hidden="true">·</span>
                      <span>${m.drama.totalEpisodes} Episode</span>
                    </div>
                    <p class="dracin-match-reason">${escapeHtml(m.reasons.join(' · '))}</p>
                    <div class="dracin-match-actions">
                      <button type="button" class="btn btn-primary btn-xs" data-dracin-resume="${escapeHtml(m.drama.id)}" data-dracin-resume-ep="${m.estimatedEpisode}">
                        Tonton Ep ${m.estimatedEpisode}
                      </button>
                      <button type="button" class="btn btn-secondary btn-xs" data-dracin-open="${escapeHtml(m.drama.id)}">
                        Mulai dari Ep 1
                      </button>
                    </div>
                  </div>
                </article>
              `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  function renderHistoryView() {
    return `
      <div class="dracin-list-view">
        <div class="dracin-section-row">
          <div>
            <h3 class="dracin-section-heading">Riwayat Menonton (${state.history.length})</h3>
            <p class="dracin-section-sub">Episode terakhir tersimpan otomatis di perangkat Anda.</p>
          </div>
          ${
            state.history.length > 0
              ? `<button type="button" class="btn btn-secondary btn-xs" id="dracin-clear-history-btn">Hapus Semua Riwayat</button>`
              : ''
          }
        </div>
        ${
          state.history.length === 0
            ? `
          <div class="dracin-empty-state">
            <p>Belum ada riwayat menonton drama. Mulai tonton drama pendek gratis sekarang.</p>
            <button type="button" class="btn btn-primary btn-sm" data-dracin-view="discover">Jelajahi Platform</button>
          </div>
        `
            : `
          <div class="dracin-history-list" data-testid="dracin-history-list">
            ${state.history
              .map(
                (h) => `
              <article class="dracin-history-item">
                <img src="${escapeHtml(h.poster)}" alt="" class="dracin-history-poster" referrerpolicy="no-referrer" />
                <div class="dracin-history-copy">
                  <strong>${escapeHtml(h.title)}</strong>
                  <span>${escapeHtml(h.platformName)} · Terakhir di Episode ${h.episode} dari ${h.totalEpisodes}</span>
                </div>
                <button type="button" class="btn btn-primary btn-xs" data-dracin-resume="${escapeHtml(h.dramaId)}" data-dracin-resume-ep="${h.episode}">
                  Lanjut Ep ${h.episode}
                </button>
              </article>
            `
              )
              .join('')}
          </div>
        `
        }
      </div>
    `;
  }

  function renderFavoritesView() {
    const favDramas = state.catalog.filter((d) => state.favorites.includes(d.id));
    return `
      <div class="dracin-list-view">
        <div class="dracin-section-row">
          <div>
            <h3 class="dracin-section-heading">Daftar Favorit (${favDramas.length})</h3>
            <p class="dracin-section-sub">Drama pendek pilihan yang Anda simpan untuk ditonton nanti.</p>
          </div>
        </div>
        ${
          favDramas.length === 0
            ? `
          <div class="dracin-empty-state">
            <p>Belum ada drama di daftar favorit. Klik ikon hati pada drama mana saja untuk menyimpannya.</p>
            <button type="button" class="btn btn-primary btn-sm" data-dracin-view="discover">Cari Drama Favorit</button>
          </div>
        `
            : `
          <div class="dracin-catalog-grid">
            ${favDramas.map(renderDramaCard).join('')}
          </div>
        `
        }
      </div>
    `;
  }

  function bindEpisodePickerEvents(container) {
    if (!container) return;
    const drama = getActiveDrama();
    container.querySelectorAll('[data-dracin-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.epRangeStart = Math.max(1, Number(btn.getAttribute('data-dracin-range')) || 1);
        if (drama) {
          container.innerHTML = renderEpisodePickerGrid(drama, container.classList.contains('dracin-fs-drawer-body'));
          bindEpisodePickerEvents(container);
        }
      });
    });
    container.querySelectorAll('[data-dracin-ep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ep = Number(btn.getAttribute('data-dracin-ep')) || 1;
        selectEpisode(ep, { announce: `Episode ${ep}` });
      });
    });
    container.querySelectorAll('[data-dracin-jump-form]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('[data-dracin-jump-input]');
        const ep = Number(input?.value) || 1;
        selectEpisode(ep, { announce: `Episode ${ep}` });
      });
    });
  }

  function bindAiInsightEvents(container, drama) {
    if (!container) return;
    container.querySelector('#dracin-ai-insight-btn')?.addEventListener('click', () => {
      handleLoadAiInsights(drama);
    });
    container.querySelectorAll('[data-dracin-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-dracin-open');
        if (id) openDrama(id);
      });
    });
  }

  function toggleFullscreenEpisodeDrawer() {
    const stageEl = hostEl?.querySelector('#dracin-player-stage');
    const drama = getActiveDrama();
    if (!stageEl || !drama) return;
    const existing = stageEl.querySelector('.dracin-fs-drawer');
    if (existing) {
      existing.remove();
      state.fullscreenDrawerOpen = false;
      return;
    }
    state.fullscreenDrawerOpen = true;
    const drawer = document.createElement('div');
    drawer.className = 'dracin-fs-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Pilih episode layar penuh');
    drawer.innerHTML = `
      <div class="dracin-fs-drawer-head">
        <strong>Pilih Episode (${escapeHtml(drama.title)})</strong>
        <button type="button" class="dracin-stage-pill-btn" id="dracin-close-fs-drawer">Tutup</button>
      </div>
      <div class="dracin-fs-drawer-body">
        ${renderEpisodePickerGrid(drama, true)}
      </div>
    `;
    stageEl.appendChild(drawer);
    drawer.querySelector('#dracin-close-fs-drawer')?.addEventListener('click', () => {
      drawer.remove();
      state.fullscreenDrawerOpen = false;
    });
    bindEpisodePickerEvents(drawer.querySelector('.dracin-fs-drawer-body'));
  }

  function bindEvents() {
    if (!hostEl) return;

    // Top view switcher tabs
    hostEl.querySelectorAll('[data-dracin-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextView = btn.getAttribute('data-dracin-view');
        if (!nextView) return;
        if (nextView === 'player' && !state.activeDramaId) {
          if (state.catalog[0]) openDrama(state.catalog[0].id, 1);
          else onToast('Tunggu daftar drama selesai dimuat');
          return;
        }
        if (nextView !== 'player') {
          if (state.isFullscreen) toggleFullscreenMode(false);
          destroyPreloadEngine();
          destroyActiveMediaEngine();
        }
        state.view = nextView;
        render();
        if (nextView === 'player') attachMediaToActiveStage();
      });
    });

    // Search form
    hostEl.querySelector('#dracin-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = hostEl.querySelector('#dracin-search-input');
      state.searchQuery = String(input?.value || '').trim();
      refreshLiveCatalog({ query: state.searchQuery, platformId: state.platformId, page: 1 });
    });

    hostEl.querySelector('#dracin-search-input')?.addEventListener('input', (e) => {
      state.searchQuery = String(e.target.value || '');
      if (!state.searchQuery) {
        refreshLiveCatalog({ query: '', platformId: state.platformId, page: 1 });
      }
    });

    hostEl.querySelector('#dracin-search-clear')?.addEventListener('click', () => {
      state.searchQuery = '';
      refreshLiveCatalog({ query: '', platformId: state.platformId, page: 1 });
    });

    // Searchable Platform Dropdown -> FETCH REAL-TIME CATALOG FOR SELECTED PLATFORM!
    const bindPlatformOptionClicks = (container) => {
      if (!container) return;
      container.querySelectorAll('[data-dracin-platform]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const nextPlat = btn.getAttribute('data-dracin-platform') || 'all';
          state.platformId = nextPlat;
          state.genreId = 'all';
          state.platformDropdownOpen = false;
          state.platformSearchQuery = '';
          const alreadyLoaded = state.platformCatalogs[nextPlat];
          if (!alreadyLoaded || state.searchQuery) {
            refreshLiveCatalog({ query: state.searchQuery, platformId: nextPlat, page: 1 });
          } else {
            render();
          }
        });
      });
    };

    const platDropdown = hostEl.querySelector('#dracin-platform-dropdown');
    const platBtn = hostEl.querySelector('#dracin-platform-dropdown-btn');
    const platPanel = hostEl.querySelector('#dracin-platform-dropdown-panel');
    const platSearch = hostEl.querySelector('#dracin-platform-search-input');
    const platOptions = hostEl.querySelector('#dracin-platform-options');

    if (platBtn && platPanel && platDropdown) {
      platBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.platformDropdownOpen = !state.platformDropdownOpen;
        platDropdown.classList.toggle('is-open', state.platformDropdownOpen);
        platBtn.setAttribute('aria-expanded', state.platformDropdownOpen ? 'true' : 'false');
        platPanel.hidden = !state.platformDropdownOpen;
        if (state.platformDropdownOpen && platSearch) {
          setTimeout(() => platSearch.focus(), 10);
        }
      });
    }

    if (platSearch && platOptions) {
      platSearch.addEventListener('input', (e) => {
        state.platformSearchQuery = String(e.target.value || '');
        platOptions.innerHTML = renderPlatformOptionsHtml(state.platformSearchQuery);
        bindPlatformOptionClicks(platOptions);
      });
      platSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          state.platformDropdownOpen = false;
          if (platDropdown) platDropdown.classList.remove('is-open');
          if (platBtn) platBtn.setAttribute('aria-expanded', 'false');
          if (platPanel) platPanel.hidden = true;
          platBtn?.focus();
        }
      });
    }

    bindPlatformOptionClicks(platOptions);

    // Collapsible "Lanjutkan Menonton" Dropdown (toggles IN-PLACE)
    const continueDropdown = hostEl.querySelector('#dracin-continue-dropdown');
    const continueBtn = hostEl.querySelector('#dracin-continue-toggle');
    const continuePanel = hostEl.querySelector('#dracin-continue-panel');
    if (continueBtn && continuePanel && continueDropdown) {
      continueBtn.addEventListener('click', () => {
        state.continueDropdownOpen = !state.continueDropdownOpen;
        continueDropdown.classList.toggle('is-open', state.continueDropdownOpen);
        continueBtn.setAttribute('aria-expanded', state.continueDropdownOpen ? 'true' : 'false');
        continuePanel.hidden = !state.continueDropdownOpen;
      });
    }

    // Genre filter tabs
    hostEl.querySelectorAll('[data-dracin-genre]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.genreId = btn.getAttribute('data-dracin-genre') || 'all';
        render();
      });
    });

    hostEl.querySelector('#dracin-retry-feed')?.addEventListener('click', () => {
      refreshLiveCatalog({ query: state.searchQuery, platformId: state.platformId, page: 1 });
    });

    hostEl.querySelector('#dracin-reset-filters')?.addEventListener('click', () => {
      state.platformId = 'all';
      state.genreId = 'all';
      state.searchQuery = '';
      state.platformDropdownOpen = false;
      state.platformSearchQuery = '';
      refreshLiveCatalog({ query: '', platformId: 'all', page: 1 });
    });

    hostEl.querySelector('#dracin-load-more-btn')?.addEventListener('click', () => {
      const info = state.platformCatalogs[state.platformId] || { page: 1 };
      refreshLiveCatalog({
        query: state.searchQuery,
        platformId: state.platformId,
        page: (info.page || 1) + 1,
        append: true,
      });
    });

    // Open drama cards
    hostEl.querySelectorAll('[data-dracin-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        primeVideoAudioGesture();
        const id = btn.getAttribute('data-dracin-open');
        if (id) openDrama(id);
      });
    });

    // Resume specific drama + episode
    hostEl.querySelectorAll('[data-dracin-resume]').forEach((btn) => {
      btn.addEventListener('click', () => {
        primeVideoAudioGesture();
        const id = btn.getAttribute('data-dracin-resume');
        const ep = Number(btn.getAttribute('data-dracin-resume-ep')) || 1;
        if (id) openDrama(id, ep);
      });
    });

    // Favorite toggles (in-place on player so video doesn't restart!)
    hostEl.querySelectorAll('[data-dracin-fav]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-dracin-fav');
        if (!id) return;
        const wasFav = state.favorites.includes(id);
        state.favorites = toggleFavoriteDramaId(state.favorites, id);
        writeStorageJson(FAVORITES_STORAGE_KEY, state.favorites);
        onToast(wasFav ? 'Dihapus dari daftar favorit' : 'Disimpan ke daftar favorit');
        if (state.view === 'player') {
          btn.classList.toggle('is-active', !wasFav);
          const span = btn.querySelector('span');
          if (span) span.textContent = !wasFav ? 'Disimpan' : 'Favorit';
          const svg = btn.querySelector('svg');
          if (svg) svg.setAttribute('fill', !wasFav ? 'currentColor' : 'none');
        } else {
          render();
        }
      });
    });

    // Player controls
    hostEl.querySelector('#dracin-back-discover')?.addEventListener('click', () => {
      if (state.isFullscreen) toggleFullscreenMode(false);
      destroyPreloadEngine();
      destroyActiveMediaEngine();
      state.view = 'discover';
      render();
    });

    hostEl.querySelector('#dracin-retry-stream-btn')?.addEventListener('click', () => {
      selectEpisode(state.currentEpisode, {
        announce: `Memuat ulang Episode ${state.currentEpisode}`,
        forceRefresh: true,
      });
    });

    hostEl.querySelector('#dracin-error-prev-ep-btn')?.addEventListener('click', () => {
      handleEpisodeStep(-1);
    });

    hostEl.querySelector('#dracin-find-cross-platform-btn')?.addEventListener('click', () => {
      handleSearchCrossPlatformMatches(getActiveDrama(), { scrollToPanel: true });
    });

    hostEl.querySelector('#dracin-search-dm-mirror-btn')?.addEventListener('click', async () => {
      const drama = getActiveDrama();
      if (!drama || state.searchingBackupMirror) return;
      state.searchingBackupMirror = true;
      setStatusOverlay(false, state.streamError, true);
      try {
        const dmSrv = await searchDailymotionEpisodeBackup(drama, state.currentEpisode);
        state.searchingBackupMirror = false;
        if (dmSrv) {
          state.servers = [dmSrv, ...state.servers.filter((s) => s.id !== dmSrv.id)];
          state.activeServerId = dmSrv.id;
          state.streamError = '';
          state.streamLocked = false;
          onToast(`Mirror ditemukan: ${dmSrv.label}`);
          render();
          attachMediaToActiveStage();
        } else {
          setStatusOverlay(false, state.streamError, true);
          onToast('Belum ditemukan mirror Dailymotion untuk episode ini');
        }
      } catch {
        state.searchingBackupMirror = false;
        setStatusOverlay(false, state.streamError, true);
        onToast('Gagal mencari mirror Dailymotion saat ini');
      }
    });

    hostEl.querySelector('#dracin-toggle-play-btn')?.addEventListener('click', togglePlayPauseInPlace);

    hostEl.querySelector('#dracin-stage-tap-layer')?.addEventListener('click', () => {
      if (state.isFullscreen && state.cleanScreen) {
        setCleanScreenMode(false);
        return;
      }
      togglePlayPauseInPlace();
    });

    hostEl.querySelector('#dracin-unmute-banner')?.addEventListener('click', () => {
      const videoEl = hostEl?.querySelector('#dracin-html5-video');
      state.userMuted = false;
      state.isMuted = false;
      state.autoplayMutedNotice = false;
      if (videoEl) {
        videoEl.defaultMuted = false;
        videoEl.muted = false;
        videoEl.volume = 1;
        if (videoEl.paused) videoEl.play().catch(() => {});
      }
      syncMuteUiInPlace();
      onToast('Suara video aktif');
    });

    hostEl.querySelector('#dracin-rail-mute-btn')?.addEventListener('click', () => {
      const videoEl = hostEl?.querySelector('#dracin-html5-video');
      const nextMuted = !state.isMuted;
      state.userMuted = nextMuted;
      state.isMuted = nextMuted;
      state.autoplayMutedNotice = false;
      if (videoEl) {
        videoEl.defaultMuted = false;
        videoEl.muted = nextMuted;
        if (!nextMuted) {
          videoEl.volume = 1;
          if (videoEl.paused && state.isPlaying) videoEl.play().catch(() => {});
        }
      }
      syncMuteUiInPlace();
      onToast(nextMuted ? 'Suara dibisukan' : 'Suara video aktif');
    });

    // Seekable progress track
    const progressTrack = hostEl.querySelector('#dracin-progress-track');
    if (progressTrack) {
      progressTrack.addEventListener('click', (e) => {
        const videoEl = hostEl?.querySelector('#dracin-html5-video');
        if (!videoEl || !Number.isFinite(videoEl.duration) || videoEl.duration <= 0) return;
        const rect = progressTrack.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
        videoEl.currentTime = ratio * videoEl.duration;
        state.elapsedSec = videoEl.currentTime;
        syncPlayerLiveDom();
      });
    }

    hostEl.querySelector('#dracin-prev-ep-btn')?.addEventListener('click', () => handleEpisodeStep(-1));
    hostEl.querySelector('#dracin-next-ep-btn')?.addEventListener('click', () => handleEpisodeStep(1));

    // Fullscreen & Clean Screen ("Layar Bersih") controls — all IN-PLACE (zero video reload!)
    hostEl.querySelector('#dracin-fs-toggle-top')?.addEventListener('click', () => toggleFullscreenMode());
    hostEl.querySelector('#dracin-rail-fs-btn')?.addEventListener('click', () => toggleFullscreenMode());
    hostEl.querySelector('#dracin-clean-fs-btn')?.addEventListener('click', () => setCleanScreenMode(true));
    hostEl.querySelector('#dracin-rail-clean-btn')?.addEventListener('click', () => setCleanScreenMode());
    hostEl.querySelector('#dracin-restore-hud-btn')?.addEventListener('click', () => setCleanScreenMode(false));

    hostEl.querySelector('#dracin-rail-episodes-btn')?.addEventListener('click', () => {
      if (state.isFullscreen) {
        toggleFullscreenEpisodeDrawer();
      } else {
        hostEl.querySelector('.dracin-ep-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    hostEl.querySelector('#dracin-rail-sub-btn')?.addEventListener('click', async () => {
      const idx = DRACIN_SUBTITLE_LANGS.findIndex((l) => l.code === state.subtitleLang);
      const next = DRACIN_SUBTITLE_LANGS[(idx + 1) % DRACIN_SUBTITLE_LANGS.length];
      state.userSubtitleOverride = next.code;
      await loadSubtitlesForActiveEpisode(getActiveDrama(), state.currentEpisode, next.code);
      const railSpan = hostEl?.querySelector('#dracin-rail-sub-btn span');
      if (railSpan) railSpan.textContent = `Sub ${next.code.toUpperCase()}`;
      const sel = hostEl?.querySelector('#dracin-sub-select');
      if (sel) sel.value = next.code;
      onToast(`Subtitle: ${next.label}`);
    });

    hostEl.querySelector('#dracin-sub-select')?.addEventListener('change', async (e) => {
      const code = String(e.target.value || 'id');
      state.userSubtitleOverride = code;
      await loadSubtitlesForActiveEpisode(getActiveDrama(), state.currentEpisode, code);
      const railSpan = hostEl?.querySelector('#dracin-rail-sub-btn span');
      if (railSpan) railSpan.textContent = `Sub ${code.toUpperCase()}`;
    });

    hostEl.querySelector('#dracin-rail-speed-btn')?.addEventListener('click', () => {
      const idx = DRACIN_PLAYBACK_SPEEDS.indexOf(state.playbackSpeed);
      state.playbackSpeed = DRACIN_PLAYBACK_SPEEDS[(idx + 1) % DRACIN_PLAYBACK_SPEEDS.length];
      const videoEl = hostEl.querySelector('#dracin-html5-video');
      if (videoEl) videoEl.playbackRate = state.playbackSpeed;
      const valEl = hostEl.querySelector('.dracin-rail-speed-val');
      if (valEl) valEl.textContent = `${state.playbackSpeed}x`;
      onToast(`Kecepatan putar ${state.playbackSpeed}x`);
    });

    hostEl.querySelector('#dracin-rail-share-btn')?.addEventListener('click', async () => {
      const drama = getActiveDrama();
      if (!drama) return;
      const shareUrl = `${window.location.origin}${window.location.pathname}?tab=dracin&id=${encodeURIComponent(drama.id)}&ep=${state.currentEpisode}`;
      try {
        await navigator.clipboard?.writeText(shareUrl);
        onToast(`Link Ep ${state.currentEpisode} disalin!`);
      } catch {
        onToast(`Bagikan: ${drama.title} Ep ${state.currentEpisode}`);
      }
    });

    hostEl.querySelector('#dracin-autonext-check')?.addEventListener('change', (e) => {
      state.autoNext = Boolean(e.target.checked);
    });

    // Server / quality switcher (in-place when staying on HTML5 video!)
    bindServerSwitchButtons(hostEl.querySelector('#dracin-server-row-inner'));

    // Episode picker, AI card & Multi-Signal Cross-Platform Matcher
    bindEpisodePickerEvents(hostEl.querySelector('#dracin-side-ep-wrap'));
    bindAiInsightEvents(hostEl.querySelector('#dracin-ai-card-box'), getActiveDrama());
    bindCrossPlatformEvents(hostEl.querySelector('#dracin-cross-platform-box'), getActiveDrama());

    // Fullscreen wheel & vertical touch swipe episode switching
    const stageEl = hostEl.querySelector('#dracin-player-stage');
    if (stageEl) {
      stageEl.addEventListener(
        'wheel',
        (e) => {
          if (!state.isFullscreen || state.fullscreenDrawerOpen) return;
          if (Math.abs(e.deltaY) < 28) return;
          e.preventDefault();
          const now = Date.now();
          if (now < wheelLockUntil) return;
          wheelLockUntil = now + 520;
          handleEpisodeStep(e.deltaY > 0 ? 1 : -1);
        },
        { passive: false }
      );

      stageEl.addEventListener(
        'touchstart',
        (e) => {
          if (!state.isFullscreen || state.fullscreenDrawerOpen) return;
          touchStartY = e.touches?.[0]?.clientY ?? null;
        },
        { passive: true }
      );

      stageEl.addEventListener(
        'touchend',
        (e) => {
          if (!state.isFullscreen || state.fullscreenDrawerOpen || touchStartY === null) return;
          const endY = e.changedTouches?.[0]?.clientY ?? touchStartY;
          const delta = touchStartY - endY;
          touchStartY = null;
          if (Math.abs(delta) >= 54) {
            handleEpisodeStep(delta > 0 ? 1 : -1);
          }
        },
        { passive: true }
      );
    }

    // Clip / Screenshot identifier controls
    hostEl.querySelector('#dracin-clip-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      state.clipFile = file;
      state.clipFileName = file.name;
      state.clipError = '';
      state.clipPreviewUrl = /^image\//i.test(file.type) ? URL.createObjectURL(file) : '';
      render();
    });

    hostEl.querySelector('#dracin-clip-clue-input')?.addEventListener('input', (e) => {
      state.clipClue = String(e.target.value || '');
    });

    hostEl.querySelector('#dracin-run-clip-btn')?.addEventListener('click', handleRunClipIdentification);

    hostEl.querySelector('#dracin-reset-clip-btn')?.addEventListener('click', () => {
      state.clipFile = null;
      state.clipFileName = '';
      state.clipPreviewUrl = '';
      state.clipClue = '';
      state.clipResult = null;
      state.clipError = '';
      render();
    });

    // Clear history
    hostEl.querySelector('#dracin-clear-history-btn')?.addEventListener('click', () => {
      state.history = [];
      writeStorageJson(HISTORY_STORAGE_KEY, []);
      onToast('Riwayat menonton dibersihkan');
      render();
    });
  }

  function render() {
    if (!hostEl) return;
    const activeDrama = getActiveDrama();
    const contentHtml =
      state.view === 'player'
        ? renderPlayerView()
        : state.view === 'clip'
        ? renderClipIdentifierView()
        : state.view === 'history'
        ? renderHistoryView()
        : state.view === 'favorites'
        ? renderFavoritesView()
        : renderDiscoverView();

    hostEl.innerHTML = `
      <div class="dracin-app" data-dracin-view-active="${escapeHtml(state.view)}">
        <div class="dracin-topbar-tabs" role="tablist" aria-label="Menu Drama China">
          <button type="button" role="tab" class="dracin-nav-tab ${state.view === 'discover' ? 'is-active' : ''}" data-dracin-view="discover" aria-selected="${state.view === 'discover'}">
            Jelajah
          </button>
          <button type="button" role="tab" class="dracin-nav-tab ${state.view === 'player' ? 'is-active' : ''}" data-dracin-view="player" aria-selected="${state.view === 'player'}">
            ${activeDrama && state.activeDramaId ? `Pemutar · Ep ${state.currentEpisode}` : 'Pemutar'}
          </button>
          <button type="button" role="tab" class="dracin-nav-tab ${state.view === 'clip' ? 'is-active' : ''}" data-dracin-view="clip" aria-selected="${state.view === 'clip'}">
            Cari Klip AI
          </button>
          <button type="button" role="tab" class="dracin-nav-tab ${state.view === 'history' ? 'is-active' : ''}" data-dracin-view="history" aria-selected="${state.view === 'history'}">
            Riwayat (${state.history.length})
          </button>
          <button type="button" role="tab" class="dracin-nav-tab ${state.view === 'favorites' ? 'is-active' : ''}" data-dracin-view="favorites" aria-selected="${state.view === 'favorites'}">
            Favorit (${state.favorites.length})
          </button>
        </div>

        <div class="dracin-body">
          ${contentHtml}
        </div>
      </div>
    `;

    bindEvents();
  }

  return {
    mount(targetEl) {
      hostEl = targetEl;
      bindGlobalListeners();
      render();

      if (!hasInitialFetched) {
        hasInitialFetched = true;
        refreshLiveCatalog({ platformId: state.platformId, page: 1 }).then(() => {
          // Support deep-linking ?tab=dracin&id=...&ep=...
          try {
            const params = new URLSearchParams(window.location.search);
            const deepId = params.get('id');
            const deepEp = Number(params.get('ep')) || 1;
            if (deepId && !state.activeDramaId) {
              openDrama(deepId, deepEp);
            }
          } catch {
            // Ignore malformed URL params
          }
        });
      } else if (state.view === 'player') {
        attachMediaToActiveStage();
      }
    },
    unmount() {
      destroyPreloadEngine();
      destroyActiveMediaEngine();
      clearDecryptedBlobCache();
      unbindGlobalListeners();
      hostEl = null;
    },
  };
}
