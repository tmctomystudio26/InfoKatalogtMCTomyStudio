/**
 * Drama China (Dracin) Gratis Tanpa Iklan — Full Short-Drama App UI Controller.
 * Supports 18+ platforms, parallel multi-API aggregation & failover, vertical 9:16 cinema
 * player, true fullscreen with touch-swipe / mouse-wheel / arrow-key episode switching,
 * free unlimited episode jumping & range picker, auto multi-language subtitles (auto-ID),
 * watch history & favorites persistence, title search, and AI clip/screenshot identifier.
 */

import {
  CURATED_DRACIN_CATALOG,
  DRACIN_GENRES,
  DRACIN_PLATFORMS,
  DRACIN_PLAYBACK_SPEEDS,
  DRACIN_SUBTITLE_LANGS,
  buildEpisodeList,
  buildEpisodeRanges,
  clampEpisodeNumber,
  filterDracinCatalog,
  getActiveSubtitleCue,
  getGenreLabel,
  getNextPrevEpisode,
  mergeParallelDracinFeeds,
  resolveAutoSubtitleLang,
  toggleFavoriteDramaId,
  upsertWatchHistory,
} from './dracin-logic.js?v=51';
import {
  fetchAiDramaInsights,
  fetchUnifiedDracinCatalog,
  getEpisodeSubtitles,
  identifyDracinFromMedia,
  resolveEpisodePlayback,
} from './dracin.js?v=51';

const HISTORY_STORAGE_KEY = 'manifestudio_dracin_history_v1';
const FAVORITES_STORAGE_KEY = 'manifestudio_dracin_favorites_v1';

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
    catalog: mergeParallelDracinFeeds([], CURATED_DRACIN_CATALOG),
    activeSources: ['Katalog 18-Platform'],
    loadingFeed: false,
    platformId: 'all',
    genreId: 'all',
    searchQuery: '',

    // Active player state
    activeDramaId: null,
    currentEpisode: 1,
    epRangeStart: 1,
    isPlaying: true,
    elapsedSec: 0,
    durationSec: 120,
    playbackSpeed: 1,
    autoNext: true,
    isMuted: false,
    isFullscreen: false,
    fullscreenDrawerOpen: false,
    swipeHintText: '',

    // Playback servers & auto-failover
    servers: [],
    activeServerId: 'cinema-sub',
    resolvingStream: false,

    // Multi-language subtitles
    userSubtitleOverride: null,
    subtitleLang: 'id',
    subtitleReason: '',
    subtitleCues: [],
    subtitleLoading: false,

    // AI Drama insights
    aiInsightsMap: {},
    aiInsightsLoading: false,

    // Clip / Screenshot AI Identifier state
    clipFile: null,
    clipFileName: '',
    clipFileKind: '',
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
  let playbackTimer = null;
  let swipeHintTimer = null;
  let wheelLockUntil = 0;
  let touchStartY = null;
  let hasInitialFetched = false;
  let globalListenersBound = false;

  function getActiveDrama() {
    if (!state.activeDramaId) return state.catalog[0] || null;
    return state.catalog.find((d) => d.id === state.activeDramaId) || state.catalog[0] || null;
  }

  function persistHistory(drama, episodeNumber, progressPercent = 18) {
    if (!drama) return;
    state.history = upsertWatchHistory(state.history, {
      dramaId: drama.id,
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
    }, 1700);
  }

  function stopPlaybackTimer() {
    if (playbackTimer) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }
  }

  function syncPlayerLiveDom() {
    if (!hostEl || state.view !== 'player') return;
    const subEl = hostEl.querySelector('#dracin-live-subtitle');
    const progFill = hostEl.querySelector('#dracin-progress-fill');
    const timeLabel = hostEl.querySelector('#dracin-time-label');

    if (subEl) {
      if (state.subtitleLang === 'off') {
        subEl.hidden = true;
      } else {
        const cue = getActiveSubtitleCue(state.subtitleCues, state.elapsedSec);
        subEl.hidden = !cue?.text;
        if (cue?.text) subEl.textContent = cue.text;
      }
    }

    const pct = Math.min(100, Math.round((state.elapsedSec / Math.max(1, state.durationSec)) * 100));
    if (progFill) progFill.style.width = `${pct}%`;
    if (timeLabel) {
      timeLabel.textContent = `${formatClockTime(state.elapsedSec)} / ${formatClockTime(state.durationSec)}`;
    }
  }

  function startPlaybackTimer() {
    stopPlaybackTimer();
    if (state.view !== 'player' || !state.isPlaying) return;
    playbackTimer = setInterval(() => {
      if (!hostEl || state.view !== 'player' || !state.isPlaying) return;
      state.elapsedSec += 0.5 * state.playbackSpeed;
      if (state.elapsedSec >= state.durationSec) {
        const drama = getActiveDrama();
        const nav = getNextPrevEpisode(state.currentEpisode, drama?.totalEpisodes || 60);
        if (state.autoNext && nav.hasNext) {
          selectEpisode(nav.next, { announce: `Auto-lanjut ke Episode ${nav.next}` });
          return;
        }
        state.elapsedSec = 0;
      }
      syncPlayerLiveDom();
    }, 500);
  }

  async function loadSubtitlesForActiveEpisode(drama, ep, langOverride = null) {
    if (!drama) return;
    const resolved = resolveAutoSubtitleLang(drama, langOverride ?? state.userSubtitleOverride);
    state.subtitleLang = resolved.lang;
    state.subtitleReason = resolved.reason;
    state.subtitleLoading = true;
    state.subtitleCues = await getEpisodeSubtitles(drama, ep, resolved.lang);
    state.subtitleLoading = false;
    syncPlayerLiveDom();
    const subMeta = hostEl?.querySelector('#dracin-sub-status');
    if (subMeta) subMeta.textContent = state.subtitleReason;
  }

  async function selectEpisode(epNumber, { announce = '' } = {}) {
    const drama = getActiveDrama();
    if (!drama) return;
    const safeEp = clampEpisodeNumber(epNumber, drama.totalEpisodes);
    state.currentEpisode = safeEp;
    state.epRangeStart = Math.floor((safeEp - 1) / 20) * 20 + 1;
    state.elapsedSec = 0;
    state.isPlaying = true;
    const episodes = buildEpisodeList(drama);
    state.durationSec = episodes[safeEp - 1]?.durationSec || 120;
    state.fullscreenDrawerOpen = false;
    state.resolvingStream = true;

    persistHistory(drama, safeEp, 15);
    render();
    if (announce) showSwipeHint(announce);

    // Parallel stream + subtitle load so switching episodes feels instant
    const [streamRes] = await Promise.allSettled([
      resolveEpisodePlayback(drama, safeEp),
      loadSubtitlesForActiveEpisode(drama, safeEp),
    ]);

    if (streamRes.status === 'fulfilled' && streamRes.value) {
      state.servers = streamRes.value.servers;
      // Default to ad-free Cinema Mode when user is inside local preview or if chosen,
      // while offering 1-tap switch to live Multi-API Dailymotion HD Stream
      state.activeServerId =
        state.servers.find((s) => s.id === state.activeServerId)?.id ||
        streamRes.value.defaultServerId;
    } else {
      state.servers = [
        {
          id: 'cinema-sub',
          label: 'Server 1 · Mode Bioskop Tanpa Iklan',
          kind: 'cinema',
          poster: drama.poster || drama.fallbackPoster,
        },
      ];
      state.activeServerId = 'cinema-sub';
    }
    state.resolvingStream = false;
    render();
    startPlaybackTimer();
  }

  async function openDrama(dramaId, episodeNumber = null) {
    const found = state.catalog.find((d) => d.id === dramaId) || state.catalog[0];
    if (!found) return;
    state.activeDramaId = found.id;
    state.view = 'player';
    const hist = state.history.find((h) => h.dramaId === found.id);
    const startEp = episodeNumber ?? hist?.episode ?? 1;
    await selectEpisode(startEp);
  }

  async function refreshParallelCatalog({ query = state.searchQuery, platformId = state.platformId } = {}) {
    state.loadingFeed = true;
    render();
    try {
      const res = await fetchUnifiedDracinCatalog({ query, platformId });
      if (res && Array.isArray(res.items) && res.items.length > 0) {
        state.catalog = res.items;
        state.activeSources = res.activeSources || state.activeSources;
      }
    } catch {
      // Fail gracefully keeping baseline 18-platform catalog
    } finally {
      state.loadingFeed = false;
      render();
    }
  }

  async function toggleFullscreenMode(forceValue = null) {
    const next = typeof forceValue === 'boolean' ? forceValue : !state.isFullscreen;
    state.isFullscreen = next;
    state.fullscreenDrawerOpen = false;
    document.body.classList.toggle('dracin-fs-lock', next);
    render();

    try {
      if (next && hostEl && hostEl.requestFullscreen && !document.fullscreenElement) {
        await hostEl.requestFullscreen();
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

  function onGlobalKeydown(e) {
    if (!hostEl || state.view !== 'player') return;
    const tag = String(e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.key === 'Escape' && state.isFullscreen) {
      e.preventDefault();
      toggleFullscreenMode(false);
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
      state.isPlaying = !state.isPlaying;
      if (state.isPlaying) startPlaybackTimer();
      else stopPlaybackTimer();
      render();
    }
  }

  function onNativeFullscreenChange() {
    if (!document.fullscreenElement && state.isFullscreen) {
      // Keep cinema overlay exit synced when user presses Escape natively
      state.isFullscreen = false;
      state.fullscreenDrawerOpen = false;
      document.body.classList.remove('dracin-fs-lock');
      render();
    }
  }

  function bindGlobalListeners() {
    if (globalListenersBound) return;
    globalListenersBound = true;
    document.addEventListener('keydown', onGlobalKeydown);
    document.addEventListener('fullscreenchange', onNativeFullscreenChange);
  }

  function unbindGlobalListeners() {
    if (!globalListenersBound) return;
    globalListenersBound = false;
    document.removeEventListener('keydown', onGlobalKeydown);
    document.removeEventListener('fullscreenchange', onNativeFullscreenChange);
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
    render();
    try {
      const res = await fetchAiDramaInsights(drama, state.catalog);
      state.aiInsightsMap[drama.id] = res;
    } finally {
      state.aiInsightsLoading = false;
      render();
    }
  }

  function renderDramaCard(drama) {
    const isFav = state.favorites.includes(drama.id);
    const hist = state.history.find((h) => h.dramaId === drama.id);
    return `
      <article class="dracin-card" data-dracin-card="${escapeHtml(drama.id)}">
        <button type="button" class="dracin-card-poster-btn" data-dracin-open="${escapeHtml(drama.id)}" aria-label="Tonton ${escapeHtml(drama.title)}">
          <img
            src="${escapeHtml(drama.poster || drama.fallbackPoster)}"
            alt="Poster ${escapeHtml(drama.title)}"
            class="dracin-card-poster"
            loading="lazy"
            referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='${escapeHtml(drama.fallbackPoster)}'"
          />
          <div class="dracin-card-scrim" aria-hidden="true"></div>
          <span class="dracin-card-platform">${escapeHtml(drama.platformName)}</span>
          <span class="dracin-card-epcount">${drama.totalEpisodes} Ep · HD</span>
          ${
            hist
              ? `<span class="dracin-card-resume">Lanjut Ep ${hist.episode}</span>`
              : ''
          }
        </button>
        <div class="dracin-card-body">
          <button type="button" class="dracin-card-title-btn" data-dracin-open="${escapeHtml(drama.id)}">
            ${escapeHtml(drama.title)}
          </button>
          <div class="dracin-card-meta">
            <span>${escapeHtml(getGenreLabel(drama.genre))}</span>
            <span aria-hidden="true">·</span>
            <span>★ ${drama.rating.toFixed(1)}</span>
            <span aria-hidden="true">·</span>
            <span>${drama.hasIndonesianDub ? 'Dub & Sub ID' : 'Sub Indo'}</span>
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

  function renderDiscoverView() {
    const filtered = filterDracinCatalog(state.catalog, {
      platformId: state.platformId,
      genreId: state.genreId,
      query: state.searchQuery,
    });
    const recentHistory = state.history.slice(0, 4);

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
              placeholder="Cari judul drama, pemeran, CEO, balas dendam, Anichin..."
              aria-label="Cari judul drama China"
            />
            ${
              state.searchQuery
                ? `<button type="button" id="dracin-search-clear" class="dracin-search-clear" aria-label="Hapus pencarian">✕</button>`
                : ''
            }
          </div>
          <button type="submit" class="btn btn-primary btn-sm dracin-search-submit">Cari</button>
          <button type="button" class="btn btn-secondary btn-sm" data-dracin-view="clip">
            Cari dari Klip / Screenshot
          </button>
        </form>

        <div class="dracin-filter-section">
          <div class="dracin-filter-head">
            <span class="dracin-filter-label">18 Platform Short Drama Terpadu</span>
            <span class="dracin-filter-meta">
              ${state.activeSources.length} sumber API paralel aktif · ${filtered.length} judul
            </span>
          </div>
          <div class="dracin-platform-strip" role="group" aria-label="Filter platform short drama">
            ${DRACIN_PLATFORMS.map(
              (p) => `
              <button
                type="button"
                class="dracin-chip-btn ${state.platformId === p.id ? 'is-active' : ''}"
                data-dracin-platform="${escapeHtml(p.id)}"
              >
                ${escapeHtml(p.short)}
              </button>
            `
            ).join('')}
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
          <section class="dracin-continue-section" aria-label="Lanjutkan menonton">
            <div class="dracin-section-row">
              <h3 class="dracin-section-heading">Lanjutkan Menonton</h3>
              <button type="button" class="dracin-text-link" data-dracin-view="history">Lihat Semua Riwayat</button>
            </div>
            <div class="dracin-continue-grid">
              ${recentHistory
                .map(
                  (h) => `
                <button type="button" class="dracin-continue-card" data-dracin-resume="${escapeHtml(h.dramaId)}" data-dracin-resume-ep="${h.episode}">
                  <img src="${escapeHtml(h.poster)}" alt="" class="dracin-continue-thumb" referrerpolicy="no-referrer" />
                  <div class="dracin-continue-copy">
                    <strong>${escapeHtml(h.title)}</strong>
                    <span>${escapeHtml(h.platformName)} · Ep ${h.episode} dari ${h.totalEpisodes}</span>
                  </div>
                </button>
              `
                )
                .join('')}
            </div>
          </section>
        `
            : ''
        }

        ${
          state.loadingFeed
            ? `<div class="dracin-inline-notice">Menghubungkan & menggabungkan API paralel (Dailymotion, Dracin, Anichin)...</div>`
            : ''
        }

        ${
          filtered.length === 0
            ? `
          <div class="dracin-empty-state">
            <p>Belum ada drama yang cocok untuk filter atau kata kunci "${escapeHtml(state.searchQuery)}".</p>
            <div class="dracin-empty-actions">
              <button type="button" class="btn btn-primary btn-sm" id="dracin-reset-filters">Tampilkan Semua Platform</button>
              <button type="button" class="btn btn-secondary btn-sm" data-dracin-view="clip">Cari Pakai Screenshot / Klip</button>
            </div>
          </div>
        `
            : `
          <div class="dracin-catalog-grid" data-testid="dracin-catalog-grid">
            ${filtered.map(renderDramaCard).join('')}
          </div>
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
            <strong>Pilih Episode (Semua Gratis & Terbuka)</strong>
            <span class="dracin-ep-picker-sub">Ep 1–${drama.totalEpisodes} · Bebas lompat tanpa VIP & tanpa iklan</span>
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

  function renderPlayerView() {
    const drama = getActiveDrama();
    if (!drama) return renderDiscoverView();
    const nav = getNextPrevEpisode(state.currentEpisode, drama.totalEpisodes);
    const isFav = state.favorites.includes(drama.id);
    const activeServer =
      state.servers.find((s) => s.id === state.activeServerId) ||
      state.servers[0] || { id: 'cinema-sub', label: 'Mode Bioskop Tanpa Iklan', kind: 'cinema' };
    const activeCue = getActiveSubtitleCue(state.subtitleCues, state.elapsedSec);
    const aiInsight = state.aiInsightsMap[drama.id];
    const pct = Math.min(100, Math.round((state.elapsedSec / Math.max(1, state.durationSec)) * 100));

    let mediaSurfaceHtml = '';
    if (activeServer.kind === 'dailymotion' && activeServer.embedUrl) {
      mediaSurfaceHtml = `
        <iframe
          class="dracin-stage-iframe"
          src="${escapeHtml(activeServer.embedUrl)}"
          title="${escapeHtml(drama.title)} Episode ${state.currentEpisode}"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          referrerpolicy="no-referrer"
        ></iframe>
      `;
    } else if (activeServer.kind === 'video' && activeServer.url) {
      mediaSurfaceHtml = `
        <video
          id="dracin-html5-video"
          class="dracin-stage-video"
          src="${escapeHtml(activeServer.url)}"
          poster="${escapeHtml(drama.poster || drama.fallbackPoster)}"
          playsinline
          autoplay
          controls
        ></video>
      `;
    } else {
      mediaSurfaceHtml = `
        <div class="dracin-cinema-backdrop">
          <img
            src="${escapeHtml(drama.poster || drama.fallbackPoster)}"
            alt="${escapeHtml(drama.title)}"
            class="dracin-cinema-img ${state.isPlaying ? 'is-playing' : ''}"
            referrerpolicy="no-referrer"
            onerror="this.onerror=null;this.src='${escapeHtml(drama.fallbackPoster)}'"
          />
          <div class="dracin-cinema-scrim" aria-hidden="true"></div>
          <div class="dracin-cinema-center-badge">
            <button type="button" class="dracin-center-play-btn" id="dracin-toggle-play-btn" aria-label="${state.isPlaying ? 'Jeda episode' : 'Putar episode'}">
              ${
                state.isPlaying
                  ? `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                  : `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`
              }
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="dracin-player-layout">
        <div class="dracin-player-col">
          <div
            id="dracin-player-stage"
            class="dracin-stage ${state.isFullscreen ? 'is-fullscreen' : ''}"
            data-testid="dracin-player-stage"
            data-episode="${state.currentEpisode}"
            data-fullscreen="${state.isFullscreen ? 'true' : 'false'}"
          >
            ${mediaSurfaceHtml}

            <!-- Top Overlay Bar -->
            <div class="dracin-stage-topbar">
              <button type="button" class="dracin-stage-pill-btn" id="dracin-back-discover">
                ← Daftar Drama
              </button>
              <div class="dracin-stage-title-wrap">
                <span class="dracin-stage-ep-label">Ep ${state.currentEpisode} / ${drama.totalEpisodes}</span>
                <strong class="dracin-stage-title">${escapeHtml(drama.title)}</strong>
              </div>
              ${
                state.isFullscreen
                  ? `<button type="button" class="dracin-stage-pill-btn" id="dracin-exit-fs-btn">Keluar Fullscreen</button>`
                  : `<button type="button" class="dracin-stage-pill-btn" id="dracin-enter-fs-btn">Layar Penuh</button>`
              }
            </div>

            <!-- Swipe / Episode Switch Toast -->
            <div id="dracin-swipe-toast" class="dracin-swipe-toast" role="status" ${state.swipeHintText ? '' : 'hidden'}>
              ${escapeHtml(state.swipeHintText)}
            </div>

            <!-- Right Vertical Short-Drama Action Rail (TikTok/DramaBox Style) -->
            <div class="dracin-action-rail" aria-label="Kontrol cepat pemutar">
              <button type="button" class="dracin-rail-btn ${isFav ? 'is-active' : ''}" data-dracin-fav="${escapeHtml(drama.id)}" aria-label="Favoritkan drama">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                <span>${isFav ? 'Disimpan' : 'Favorit'}</span>
              </button>

              <button type="button" class="dracin-rail-btn" id="dracin-rail-episodes-btn" aria-label="Pilih episode">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                <span>Ep ${state.currentEpisode}</span>
              </button>

              <button type="button" class="dracin-rail-btn" id="dracin-rail-sub-btn" aria-label="Ganti bahasa subtitle">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 13h4"/><path d="M15 13h2"/><path d="M7 16h2"/><path d="M13 16h4"/></svg>
                <span>Sub ${escapeHtml(state.subtitleLang.toUpperCase())}</span>
              </button>

              <button type="button" class="dracin-rail-btn" id="dracin-rail-speed-btn" aria-label="Kecepatan putar">
                <span class="dracin-rail-speed-val">${state.playbackSpeed}x</span>
                <span>Cepat</span>
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

            <!-- Live Auto-Subtitle Bar -->
            <div class="dracin-stage-bottom">
              <div
                id="dracin-live-subtitle"
                class="dracin-live-subtitle"
                data-testid="dracin-live-subtitle"
                ${state.subtitleLang === 'off' || !activeCue?.text ? 'hidden' : ''}
              >
                ${escapeHtml(activeCue?.text || '')}
              </div>

              <div class="dracin-stage-meta-line">
                <span>${escapeHtml(drama.platformName)}</span>
                <span aria-hidden="true">·</span>
                <span>${drama.hasIndonesianDub ? 'Dub & Sub ID' : 'Audio Mandarin · Sub Indo Otomatis'}</span>
                ${state.isFullscreen ? `<span aria-hidden="true">·</span><span>Geser / Scroll ↑↓ pindah episode</span>` : ''}
              </div>

              <div class="dracin-progress-track" aria-hidden="true">
                <div id="dracin-progress-fill" class="dracin-progress-fill" style="width:${pct}%"></div>
              </div>

              <div class="dracin-stage-controls-row">
                <button type="button" class="dracin-ep-step-btn" id="dracin-prev-ep-btn" ${nav.hasPrev ? '' : 'disabled'}>
                  ↑ Ep Sebelumnya
                </button>
                <span id="dracin-time-label" class="dracin-time-label">${formatClockTime(state.elapsedSec)} / ${formatClockTime(state.durationSec)}</span>
                <button type="button" class="dracin-ep-step-btn" id="dracin-next-ep-btn" ${nav.hasNext ? '' : 'disabled'}>
                  ↓ Ep Berikutnya
                </button>
              </div>
            </div>

            ${
              state.isFullscreen && state.fullscreenDrawerOpen
                ? `
              <div class="dracin-fs-drawer" role="dialog" aria-label="Pilih episode layar penuh">
                <div class="dracin-fs-drawer-head">
                  <strong>Pilih Episode (${drama.title})</strong>
                  <button type="button" class="dracin-stage-pill-btn" id="dracin-close-fs-drawer">Tutup</button>
                </div>
                ${renderEpisodePickerGrid(drama, true)}
              </div>
            `
                : ''
            }
          </div>

          <!-- Server Auto-Failover & Subtitle Language Controls -->
          <div class="dracin-player-toolbar">
            <div class="dracin-toolbar-group">
              <label for="dracin-sub-select" class="dracin-toolbar-label">Subtitle Otomatis</label>
              <select id="dracin-sub-select" class="dracin-select" aria-label="Pilih bahasa subtitle">
                ${DRACIN_SUBTITLE_LANGS.map(
                  (l) => `<option value="${l.code}" ${state.subtitleLang === l.code ? 'selected' : ''}>${escapeHtml(l.label)}</option>`
                ).join('')}
              </select>
              <span id="dracin-sub-status" class="dracin-toolbar-note">${escapeHtml(state.subtitleReason)}</span>
            </div>

            <div class="dracin-toolbar-group">
              <span class="dracin-toolbar-label">Server Paralel (Auto-Failover)</span>
              <div class="dracin-server-row">
                ${(state.servers.length ? state.servers : [{ id: 'cinema-sub', label: 'Server 1 · Mode Bioskop Tanpa Iklan' }])
                  .map(
                    (srv) => `
                  <button
                    type="button"
                    class="dracin-server-btn ${activeServer.id === srv.id ? 'is-active' : ''}"
                    data-dracin-server="${escapeHtml(srv.id)}"
                  >
                    ${escapeHtml(srv.label)}
                  </button>
                `
                  )
                  .join('')}
                <label class="dracin-autonext-toggle">
                  <input type="checkbox" id="dracin-autonext-check" ${state.autoNext ? 'checked' : ''} />
                  <span>Auto-Lanjut Ep</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Episode Picker + Drama Info + Keyless Multi-AI Insights -->
        <aside class="dracin-side-col">
          ${renderEpisodePickerGrid(drama, false)}

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
              <span>${drama.year}</span>
              <span aria-hidden="true">·</span>
              <span>★ ${drama.rating.toFixed(1)}</span>
              <span aria-hidden="true">·</span>
              <span>${escapeHtml(drama.viewsLabel)} tayangan</span>
            </div>
            <p class="dracin-synopsis">${escapeHtml(drama.synopsis)}</p>
            <p class="dracin-cast"><strong>Pemeran:</strong> ${escapeHtml((drama.cast || []).join(', '))}</p>

            <div class="dracin-ai-card">
              <div class="dracin-ai-card-head">
                <strong>Asisten AI Dracin (Multi-AI Gratis Tanpa Key)</strong>
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
                  : `<p class="dracin-ai-hint">Klik tombol di atas untuk ringkasan tanpa spoiler & rekomendasi drama mirip lintas 18 platform (Gemini / ChatGPT / Claude Open).</p>`
              }
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
            Sistem membaca sidik visual & rasio frame lalu menggabungkan Multi-AI Tanpa Key (Gemini, ChatGPT, Claude/Mistral Open) dengan pencarian paralel 18 platform.
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
            <input
              type="file"
              id="dracin-clip-file-input"
              accept="image/*,video/*"
              class="dracin-sr-file"
            />
          </div>

          <div class="dracin-clip-clue-group">
            <label for="dracin-clip-clue-input" class="dracin-toolbar-label">
              Petunjuk Adegan / Dialog / Subtitle di Cuplikan (Opsional — Memperkuat Akurasi AI)
            </label>
            <input
              type="text"
              id="dracin-clip-clue-input"
              class="dracin-text-input"
              value="${escapeHtml(state.clipClue)}"
              placeholder="Contoh: CEO menantu dihina di pesta, dokter gunung giok, selir istana dingin..."
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
                      <span>${m.drama.totalEpisodes} Episode Penuh</span>
                    </div>
                    <p class="dracin-match-reason">${escapeHtml(m.reasons.join(' · '))}</p>
                    <div class="dracin-match-actions">
                      <button
                        type="button"
                        class="btn btn-primary btn-xs"
                        data-dracin-resume="${escapeHtml(m.drama.id)}"
                        data-dracin-resume-ep="${m.estimatedEpisode}"
                      >
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
            <button type="button" class="btn btn-primary btn-sm" data-dracin-view="discover">Jelajahi 18 Platform</button>
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
                  <span>${escapeHtml(h.platformName)} · Terakhir di Episode ${h.episode} dari ${h.totalEpisodes} · Sub ${escapeHtml((h.subtitleLang || 'id').toUpperCase())}</span>
                </div>
                <button
                  type="button"
                  class="btn btn-primary btn-xs"
                  data-dracin-resume="${escapeHtml(h.dramaId)}"
                  data-dracin-resume-ep="${h.episode}"
                >
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

  function bindEvents() {
    if (!hostEl) return;

    // Top view switcher tabs
    hostEl.querySelectorAll('[data-dracin-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextView = btn.getAttribute('data-dracin-view');
        if (!nextView) return;
        if (nextView === 'player' && !state.activeDramaId) {
          openDrama(state.catalog[0]?.id, 1);
          return;
        }
        state.view = nextView;
        if (nextView !== 'player') stopPlaybackTimer();
        else startPlaybackTimer();
        render();
      });
    });

    // Search form
    hostEl.querySelector('#dracin-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = hostEl.querySelector('#dracin-search-input');
      state.searchQuery = String(input?.value || '').trim();
      refreshParallelCatalog({ query: state.searchQuery, platformId: state.platformId });
    });

    hostEl.querySelector('#dracin-search-input')?.addEventListener('input', (e) => {
      state.searchQuery = String(e.target.value || '');
      if (!state.searchQuery) render();
    });

    hostEl.querySelector('#dracin-search-clear')?.addEventListener('click', () => {
      state.searchQuery = '';
      render();
    });

    // Platform filter chips
    hostEl.querySelectorAll('[data-dracin-platform]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.platformId = btn.getAttribute('data-dracin-platform') || 'all';
        render();
      });
    });

    // Genre filter tabs
    hostEl.querySelectorAll('[data-dracin-genre]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.genreId = btn.getAttribute('data-dracin-genre') || 'all';
        render();
      });
    });

    hostEl.querySelector('#dracin-reset-filters')?.addEventListener('click', () => {
      state.platformId = 'all';
      state.genreId = 'all';
      state.searchQuery = '';
      render();
    });

    // Open drama cards
    hostEl.querySelectorAll('[data-dracin-open]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-dracin-open');
        if (id) openDrama(id);
      });
    });

    // Resume specific drama + episode
    hostEl.querySelectorAll('[data-dracin-resume]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-dracin-resume');
        const ep = Number(btn.getAttribute('data-dracin-resume-ep')) || 1;
        if (id) openDrama(id, ep);
      });
    });

    // Favorite toggles
    hostEl.querySelectorAll('[data-dracin-fav]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-dracin-fav');
        if (!id) return;
        const wasFav = state.favorites.includes(id);
        state.favorites = toggleFavoriteDramaId(state.favorites, id);
        writeStorageJson(FAVORITES_STORAGE_KEY, state.favorites);
        onToast(wasFav ? 'Dihapus dari daftar favorit' : 'Disimpan ke daftar favorit');
        render();
      });
    });

    // Player controls
    hostEl.querySelector('#dracin-back-discover')?.addEventListener('click', () => {
      if (state.isFullscreen) toggleFullscreenMode(false);
      state.view = 'discover';
      stopPlaybackTimer();
      render();
    });

    hostEl.querySelector('#dracin-toggle-play-btn')?.addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      if (state.isPlaying) startPlaybackTimer();
      else stopPlaybackTimer();
      render();
    });

    hostEl.querySelector('#dracin-prev-ep-btn')?.addEventListener('click', () => handleEpisodeStep(-1));
    hostEl.querySelector('#dracin-next-ep-btn')?.addEventListener('click', () => handleEpisodeStep(1));

    hostEl.querySelector('#dracin-enter-fs-btn')?.addEventListener('click', () => toggleFullscreenMode(true));
    hostEl.querySelector('#dracin-exit-fs-btn')?.addEventListener('click', () => toggleFullscreenMode(false));
    hostEl.querySelector('#dracin-rail-fs-btn')?.addEventListener('click', () => toggleFullscreenMode());

    hostEl.querySelector('#dracin-rail-episodes-btn')?.addEventListener('click', () => {
      if (state.isFullscreen) {
        state.fullscreenDrawerOpen = !state.fullscreenDrawerOpen;
        render();
      } else {
        hostEl.querySelector('.dracin-ep-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    hostEl.querySelector('#dracin-close-fs-drawer')?.addEventListener('click', () => {
      state.fullscreenDrawerOpen = false;
      render();
    });

    hostEl.querySelector('#dracin-rail-sub-btn')?.addEventListener('click', async () => {
      const idx = DRACIN_SUBTITLE_LANGS.findIndex((l) => l.code === state.subtitleLang);
      const next = DRACIN_SUBTITLE_LANGS[(idx + 1) % DRACIN_SUBTITLE_LANGS.length];
      state.userSubtitleOverride = next.code;
      await loadSubtitlesForActiveEpisode(getActiveDrama(), state.currentEpisode, next.code);
      onToast(`Subtitle: ${next.label}`);
      render();
    });

    hostEl.querySelector('#dracin-sub-select')?.addEventListener('change', async (e) => {
      const code = String(e.target.value || 'id');
      state.userSubtitleOverride = code;
      await loadSubtitlesForActiveEpisode(getActiveDrama(), state.currentEpisode, code);
      render();
    });

    hostEl.querySelector('#dracin-rail-speed-btn')?.addEventListener('click', () => {
      const idx = DRACIN_PLAYBACK_SPEEDS.indexOf(state.playbackSpeed);
      state.playbackSpeed = DRACIN_PLAYBACK_SPEEDS[(idx + 1) % DRACIN_PLAYBACK_SPEEDS.length];
      const videoEl = hostEl.querySelector('#dracin-html5-video');
      if (videoEl) videoEl.playbackRate = state.playbackSpeed;
      onToast(`Kecepatan putar ${state.playbackSpeed}x`);
      render();
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

    // Server switcher
    hostEl.querySelectorAll('[data-dracin-server]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const srvId = btn.getAttribute('data-dracin-server');
        if (!srvId) return;
        state.activeServerId = srvId;
        onToast('Beralih server pemutar');
        render();
      });
    });

    // Episode range tabs
    hostEl.querySelectorAll('[data-dracin-range]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.epRangeStart = Math.max(1, Number(btn.getAttribute('data-dracin-range')) || 1);
        render();
      });
    });

    // Individual episode buttons
    hostEl.querySelectorAll('[data-dracin-ep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ep = Number(btn.getAttribute('data-dracin-ep')) || 1;
        selectEpisode(ep, { announce: `Melompat ke Episode ${ep}` });
      });
    });

    // Direct jump-to-episode form
    hostEl.querySelectorAll('[data-dracin-jump-form]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('[data-dracin-jump-input]');
        const ep = Number(input?.value) || 1;
        selectEpisode(ep, { announce: `Melompat ke Episode ${ep}` });
      });
    });

    // Fullscreen wheel & vertical touch swipe episode switching (Rule #4)
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

    // AI insights button
    hostEl.querySelector('#dracin-ai-insight-btn')?.addEventListener('click', () => {
      handleLoadAiInsights(getActiveDrama());
    });

    // Clip / Screenshot identifier controls
    hostEl.querySelector('#dracin-clip-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      state.clipFile = file;
      state.clipFileName = file.name;
      state.clipError = '';
      if (/^image\//i.test(file.type)) {
        state.clipPreviewUrl = URL.createObjectURL(file);
      } else {
        state.clipPreviewUrl = '';
      }
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
            Jelajah 18 Platform
          </button>
          <button type="button" role="tab" class="dracin-nav-tab ${state.view === 'player' ? 'is-active' : ''}" data-dracin-view="player" aria-selected="${state.view === 'player'}">
            ${activeDrama && state.activeDramaId ? `Pemutar · Ep ${state.currentEpisode}` : 'Pemutar Drama'}
          </button>
          <button type="button" role="tab" class="dracin-nav-tab ${state.view === 'clip' ? 'is-active' : ''}" data-dracin-view="clip" aria-selected="${state.view === 'clip'}">
            Cari Klip / Screenshot + AI
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

      // Support deep-linking ?tab=dracin&id=...&ep=...
      try {
        const params = new URLSearchParams(window.location.search);
        const deepId = params.get('id');
        const deepEp = Number(params.get('ep')) || 1;
        if (deepId && state.catalog.some((d) => d.id === deepId) && !state.activeDramaId) {
          openDrama(deepId, deepEp);
        } else {
          render();
        }
      } catch {
        render();
      }

      if (!hasInitialFetched) {
        hasInitialFetched = true;
        refreshParallelCatalog();
      }
      if (state.view === 'player') {
        startPlaybackTimer();
      }
    },
    unmount() {
      stopPlaybackTimer();
      unbindGlobalListeners();
      hostEl = null;
    },
  };
}
