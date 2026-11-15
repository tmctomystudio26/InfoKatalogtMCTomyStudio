/**
 * Ad-Free Smart Music Player Widget
 * - Triggers playback smoothly when any interactive button is clicked (unless user paused).
 * - Recommends songs randomly weighted by what the user searches & frequently plays.
 * - Floating compact dock icon + non-intrusive player popover with Play/Pause, Next, Seek Progress & Music Search.
 */

import {
  createDefaultMusicPrefs,
  formatAudioTime,
  getTopSearchKeywords,
  pickWeightedRandomTrack,
  recordMusicPreference,
  scoreTrackForUser,
} from './music-logic.js';

const MUSIC_PREFS_KEY = 'manifestudio_music_prefs_v1';
const MUSIC_STATE_KEY = 'manifestudio_music_session_v1';
const AUDIUS_API_BASE = 'https://api.audius.co/v1';

// Built-in backup curated royalty-free CC0 chill/lofi/electronic streams if API fails
const FALLBACK_TRACKS = [
  {
    id: 'cc-lofi-1',
    title: 'Midnight Study Beat',
    artist: 'FreePD Ambient',
    genre: 'Lo-Fi Chill',
    duration: 148,
    artwork: '',
    streamUrl: 'https://freepd.com/music/Aerosol%20of%20My%20Love.mp3',
  },
  {
    id: 'cc-synth-2',
    title: 'Neon Horizon',
    artist: 'FreePD Electronic',
    genre: 'Synthwave',
    duration: 132,
    artwork: '',
    streamUrl: 'https://freepd.com/music/Neon%20Laser%20Horizon.mp3',
  },
  {
    id: 'cc-chill-3',
    title: 'City Lights Coffee',
    artist: 'FreePD Chillhop',
    genre: 'Chill',
    duration: 160,
    artwork: '',
    streamUrl: 'https://freepd.com/music/Study%20and%20Relax.mp3',
  },
];

let singletonInitialized = false;

function readPrefs() {
  try {
    const raw = localStorage.getItem(MUSIC_PREFS_KEY);
    if (!raw) return createDefaultMusicPrefs();
    return { ...createDefaultMusicPrefs(), ...JSON.parse(raw) };
  } catch {
    return createDefaultMusicPrefs();
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(MUSIC_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota
  }
}

function readSessionState() {
  try {
    const raw = localStorage.getItem(MUSIC_STATE_KEY);
    if (!raw) return { userPaused: false, lastTrackId: null };
    const parsed = JSON.parse(raw);
    return {
      userPaused: Boolean(parsed?.userPaused),
      lastTrackId: parsed?.lastTrackId || null,
    };
  } catch {
    return { userPaused: false, lastTrackId: null };
  }
}

function saveSessionState(sess) {
  try {
    localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(sess));
  } catch {
    // Ignore
  }
}

function mapAudiusTrack(item) {
  if (!item || !item.id) return null;
  const art =
    item.artwork?.['150x150'] || item.artwork?.['480x480'] || item.user?.profile_picture?.['150x150'] || '';
  return {
    id: String(item.id),
    title: String(item.title || 'Lagu Tanpa Judul'),
    artist: String(item.user?.name || 'Artis Indie'),
    genre: String(item.genre || 'Music'),
    tags: String(item.tags || ''),
    duration: Number(item.duration || 0),
    artwork: art,
    streamUrl: `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(item.id)}/stream?app_name=Manifestudio`,
  };
}

async function fetchAudiusTrending() {
  const res = await fetch(`${AUDIUS_API_BASE}/tracks/trending?app_name=Manifestudio&limit=25`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Audius trending error');
  const json = await res.json();
  const mapped = (json?.data || []).map(mapAudiusTrack).filter(Boolean);
  if (mapped.length === 0) throw new Error('Empty Audius list');
  return mapped;
}

async function fetchAudiusSearch(query) {
  const q = String(query || '').trim();
  if (!q) return [];
  const res = await fetch(
    `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(q)}&app_name=Manifestudio&limit=12`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.data || []).map(mapAudiusTrack).filter(Boolean);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function initMusicPlayer() {
  if (singletonInitialized || typeof document === 'undefined') return;
  singletonInitialized = true;

  const root = document.createElement('div');
  root.id = 'music-widget-root';
  root.className = 'music-widget-root';
  document.body.appendChild(root);

  const audio = new Audio();
  audio.preload = 'none';
  audio.crossOrigin = 'anonymous';
  audio.volume = 0.65;

  let prefs = readPrefs();
  let session = readSessionState();
  let tracks = [...FALLBACK_TRACKS];
  let poolLoaded = false;
  let poolPromise = null;
  let currentTrack = null;
  let isPlaying = false;
  let isLoading = false;
  let isOpen = false;
  let searchQuery = '';
  let isSeeking = false;
  let searchDebounce = null;
  let playedLoggedForId = null;

  function updateCartOverlapOffset() {
    const cartBar = document.getElementById('mobile-cart-bar');
    const hasCart = Boolean(cartBar && !cartBar.hidden);
    root.classList.toggle('is-above-mobile-cart', hasCart);
  }

  const cartBarEl = document.getElementById('mobile-cart-bar');
  if (cartBarEl && typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(updateCartOverlapOffset);
    mo.observe(cartBarEl, { attributes: true, attributeFilter: ['hidden'] });
  }
  updateCartOverlapOffset();

  async function ensureTrackPool(forcePersonalFetch = false) {
    if (poolPromise && !forcePersonalFetch) return poolPromise;
    poolPromise = (async () => {
      try {
        const trending = await fetchAudiusTrending();
        const topTerms = getTopSearchKeywords(prefs, 2);
        let personalized = [];
        for (const term of topTerms) {
          const found = await fetchAudiusSearch(term).catch(() => []);
          personalized = personalized.concat(found);
        }
        const mergedMap = new Map();
        for (const t of [...personalized, ...trending]) {
          if (t && t.id && !mergedMap.has(t.id)) {
            mergedMap.set(t.id, t);
          }
        }
        if (mergedMap.size > 0) {
          tracks = [...mergedMap.values()];
        }
        poolLoaded = true;
      } catch {
        poolLoaded = true;
      }
      return tracks;
    })();
    return poolPromise;
  }

  function renderWidget() {
    const score = currentTrack ? scoreTrackForUser(currentTrack, prefs) : 1;
    const matchBadge =
      score > 2.2 ? 'Sesuai Minat & Pencarianmu' : 'Acak Bebas Iklan';
    const trackTitle = currentTrack ? currentTrack.title : 'Siap Memutar Musik';
    const trackArtist = currentTrack
      ? `${currentTrack.artist} · ${currentTrack.genre}`
      : 'Klik tombol apa saja untuk mulai';
    const curSec = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const durSec =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : currentTrack?.duration || 100;
    const pct = durSec > 0 ? Math.min(100, Math.round((curSec / durSec) * 100)) : 0;

    root.innerHTML = `
      <div
        id="music-popover"
        class="music-popover"
        role="dialog"
        aria-label="Pemutar Musik Bebas Iklan"
        ${isOpen ? '' : 'hidden'}
      >
        <div class="music-pop-head">
          <div class="music-pop-track">
            <div class="music-art-wrap">
              ${
                currentTrack?.artwork
                  ? `<img src="${escapeHtml(currentTrack.artwork)}" alt="" width="40" height="40" class="music-art-img" />`
                  : `<span class="music-art-fallback" aria-hidden="true">♪</span>`
              }
            </div>
            <div class="music-meta">
              <strong class="music-title" id="music-now-title">${escapeHtml(trackTitle)}</strong>
              <span class="music-artist" id="music-now-artist">${escapeHtml(trackArtist)}</span>
            </div>
          </div>
          <button
            type="button"
            class="music-close-btn"
            id="music-close-btn"
            aria-label="Tutup panel musik"
          >✕</button>
        </div>

        <div class="music-algo-row">
          <span class="music-algo-pill">${escapeHtml(matchBadge)}</span>
          <span class="music-time mono-num" id="music-time-label">${formatAudioTime(curSec)} / ${formatAudioTime(durSec)}</span>
        </div>

        <div class="music-progress-row">
          <input
            type="range"
            id="music-seek-slider"
            class="music-seek-slider"
            min="0"
            max="100"
            step="0.5"
            value="${pct}"
            aria-label="Geser progres lagu"
          />
        </div>

        <div class="music-controls-row">
          <button
            type="button"
            class="btn btn-primary btn-sm music-ctrl-btn"
            id="music-playpause-btn"
            aria-label="${isPlaying ? 'Jeda musik' : 'Putar musik'}"
          >
            ${
              isLoading
                ? 'Memuat...'
                : isPlaying
                ? '❚❚ Jeda'
                : '▶ Putar'
            }
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm music-ctrl-btn"
            id="music-next-btn"
            aria-label="Ganti lagu acak berikutnya"
          >
            ⏭ Lagu Lain
          </button>
        </div>

        <form id="music-search-form" class="music-search-row">
          <input
            type="search"
            id="music-search-input"
            class="music-search-input"
            placeholder="Cari lagu, artis, atau genre..."
            value="${escapeHtml(searchQuery)}"
            aria-label="Cari lagu atau genre musik"
          />
          <button type="submit" class="btn btn-secondary btn-sm" aria-label="Cari dan putar musik">Cari</button>
        </form>
      </div>

      <button
        type="button"
        id="music-fab-btn"
        class="music-fab-btn ${isPlaying ? 'is-playing' : ''}"
        aria-label="${isOpen ? 'Tutup kontrol musik' : 'Buka kontrol musik'}"
        aria-expanded="${isOpen}"
        title="Musik Bebas Iklan"
      >
        <span class="music-fab-eq" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
        <svg class="music-fab-note" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </button>
    `;

    bindWidgetEvents();
  }

  function syncProgressDomOnly() {
    if (!isOpen || isSeeking) return;
    const slider = root.querySelector('#music-seek-slider');
    const timeEl = root.querySelector('#music-time-label');
    const cur = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const dur =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : currentTrack?.duration || 100;
    if (slider && dur > 0) {
      slider.value = String(Math.min(100, (cur / dur) * 100));
    }
    if (timeEl) {
      timeEl.textContent = `${formatAudioTime(cur)} / ${formatAudioTime(dur)}`;
    }
  }

  async function playTrack(track, { recordPlay = true } = {}) {
    if (!track || !track.streamUrl) return;
    currentTrack = track;
    session.lastTrackId = track.id;
    session.userPaused = false;
    saveSessionState(session);

    isLoading = true;
    renderWidget();

    if (audio.src !== track.streamUrl) {
      audio.src = track.streamUrl;
    }

    try {
      await audio.play();
      isPlaying = true;
      isLoading = false;
      if (recordPlay && playedLoggedForId !== track.id) {
        playedLoggedForId = track.id;
        prefs = recordMusicPreference(prefs, { type: 'play', track });
        savePrefs(prefs);
      }
    } catch {
      isPlaying = false;
      isLoading = false;
    }
    renderWidget();
  }

  async function playNextSmartTrack({ wasSkip = false } = {}) {
    if (wasSkip && currentTrack) {
      prefs = recordMusicPreference(prefs, { type: 'skip', track: currentTrack });
      savePrefs(prefs);
    }
    if (!poolLoaded) {
      await ensureTrackPool();
    }
    const next = pickWeightedRandomTrack(tracks, prefs, currentTrack?.id || null);
    if (next) {
      await playTrack(next, { recordPlay: true });
    }
  }

  async function handleMusicSearch(term) {
    const q = String(term || '').trim();
    searchQuery = q;
    if (!q) return;
    prefs = recordMusicPreference(prefs, { type: 'search', term: q });
    savePrefs(prefs);

    isLoading = true;
    renderWidget();
    try {
      const results = await fetchAudiusSearch(q);
      if (results.length > 0) {
        const merged = new Map(tracks.map((t) => [t.id, t]));
        for (const r of results) merged.set(r.id, r);
        tracks = [...merged.values()];
        const picked = pickWeightedRandomTrack(results, prefs, currentTrack?.id || null);
        if (picked) {
          await playTrack(picked, { recordPlay: true });
          return;
        }
      }
    } catch {
      // Fallback to weighted local pool
    }
    await playNextSmartTrack();
  }

  function togglePlayPause() {
    if (!currentTrack) {
      playNextSmartTrack();
      return;
    }
    if (audio.paused) {
      session.userPaused = false;
      saveSessionState(session);
      audio
        .play()
        .then(() => {
          isPlaying = true;
          renderWidget();
        })
        .catch(() => {
          playTrack(currentTrack, { recordPlay: false });
        });
    } else {
      audio.pause();
      isPlaying = false;
      session.userPaused = true;
      saveSessionState(session);
      renderWidget();
    }
  }

  function bindWidgetEvents() {
    root.querySelector('#music-fab-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen = !isOpen;
      renderWidget();
      if (isOpen && !currentTrack) {
        ensureTrackPool();
      }
    });

    root.querySelector('#music-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      isOpen = false;
      renderWidget();
    });

    root.querySelector('#music-playpause-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayPause();
    });

    root.querySelector('#music-next-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      playNextSmartTrack({ wasSkip: true });
    });

    const slider = root.querySelector('#music-seek-slider');
    slider?.addEventListener('input', () => {
      isSeeking = true;
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : currentTrack?.duration || 100;
      const targetSec = (Number(slider.value) / 100) * dur;
      const timeEl = root.querySelector('#music-time-label');
      if (timeEl) {
        timeEl.textContent = `${formatAudioTime(targetSec)} / ${formatAudioTime(dur)}`;
      }
    });
    slider?.addEventListener('change', () => {
      const dur =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.duration
          : currentTrack?.duration || 100;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = (Number(slider.value) / 100) * dur;
      }
      isSeeking = false;
    });

    const searchInput = root.querySelector('#music-search-input');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
    });

    root.querySelector('#music-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleMusicSearch(searchInput?.value || '');
    });
  }

  // Audio lifecycle listeners
  audio.addEventListener('timeupdate', syncProgressDomOnly);
  audio.addEventListener('play', () => {
    isPlaying = true;
    isLoading = false;
    root.querySelector('#music-fab-btn')?.classList.add('is-playing');
  });
  audio.addEventListener('pause', () => {
    isPlaying = false;
    root.querySelector('#music-fab-btn')?.classList.remove('is-playing');
  });
  audio.addEventListener('ended', () => {
    playNextSmartTrack({ wasSkip: false });
  });
  audio.addEventListener('error', () => {
    // Seamlessly switch to next working track if a stream node fails
    if (!session.userPaused && currentTrack) {
      const prevId = currentTrack.id;
      tracks = tracks.filter((t) => t.id !== prevId);
      if (tracks.length === 0) tracks = [...FALLBACK_TRACKS];
      const next = pickWeightedRandomTrack(tracks, prefs, prevId);
      if (next && next.id !== prevId) {
        playTrack(next, { recordPlay: false });
      } else {
        isPlaying = false;
        isLoading = false;
        renderWidget();
      }
    }
  });

  // Learn silently from catalog / tools search inputs
  document.addEventListener('input', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.id === 'music-search-input') return;
    if (
      target.id === 'catalog-search' ||
      target.id === 'prayer-city-search' ||
      target.id === 'weather-city-search' ||
      target.id === 'world-country-search'
    ) {
      const val = target.value.trim();
      if (val.length < 3) return;
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        prefs = recordMusicPreference(prefs, { type: 'search', term: val });
        savePrefs(prefs);
      }, 650);
    }
  });

  // Auto-start smart music when any interactive button/tile is clicked
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (root.contains(target)) return; // Don't hijack widget controls
    const clickable = target.closest(
      'button, a, [role="button"], [role="tab"], .product-tile'
    );
    if (!clickable) return;
    if (session.userPaused) return;
    if (!isPlaying && !isLoading) {
      playNextSmartTrack({ wasSkip: false });
    }
  });

  // Warm pool quietly in background
  ensureTrackPool();
  renderWidget();
}
