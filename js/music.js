/**
 * Ad-Free Smart Music Player Widget
 * - Draggable / movable music icon (persists user-selected coordinates cleanly).
 * - Prioritizes Viral Indonesia 2026 Gen-Z songs, DJ remixes, & covers (ad-free streams).
 * - Auto-triggers playback when any interactive button is clicked (unless user paused).
 * - Learns from user search terms & frequent plays for weighted random picks.
 */

import {
  clampMusicFabPosition,
  createDefaultMusicPrefs,
  formatAudioTime,
  getPopoverAnchorClasses,
  getTopSearchKeywords,
  pickWeightedRandomTrack,
  recordMusicPreference,
  scoreTrackForUser,
} from './music-logic.js';

const MUSIC_PREFS_KEY = 'manifestudio_music_prefs_v1';
const MUSIC_STATE_KEY = 'manifestudio_music_session_v1';
const MUSIC_POS_KEY = 'manifestudio_music_pos_v1';
const AUDIUS_API_BASE = 'https://api.audius.co/v1';

// Curated Viral Indonesia 2025-2026 Gen-Z hits, DJ edits & Acoustic/Koplo covers
const VIRAL_INDO_2026_QUERIES = [
  'tabola bale silet open up',
  'garam dan madu tenxi naykilla',
  'mangu whisnu santika',
  'stecu stecu faris adam',
  'pica pica juan reza',
  'everything u are hindia',
  'bunga maaf the lantis',
  'bergema sampai selamanya nadhif',
  'satu bulan bernadya',
  'sialan juicy luicy',
  'terbuang dalam waktu barasuara',
  'calon mantu idaman koplo',
];

const AUDIUS_INDO_DJ_QUERIES = [
  'Whisnu Santika',
  'Weird Genius',
  'Feel Koplo',
  'Dipha Barus',
];

// Built-in backup curated royalty-free ambient streams if offline
const FALLBACK_TRACKS = [
  {
    id: 'cc-lofi-1',
    title: 'Midnight Chill Beat (Offline)',
    artist: 'FreePD Ambient',
    genre: 'Lo-Fi Chill',
    duration: 148,
    artwork: '',
    isIndonesianViral: false,
    streamUrl: 'https://freepd.com/music/Aerosol%20of%20My%20Love.mp3',
  },
  {
    id: 'cc-synth-2',
    title: 'Neon Horizon (Offline)',
    artist: 'FreePD Electronic',
    genre: 'Synthwave',
    duration: 132,
    artwork: '',
    isIndonesianViral: false,
    streamUrl: 'https://freepd.com/music/Neon%20Laser%20Horizon.mp3',
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

function readSavedPos() {
  try {
    const raw = localStorage.getItem(MUSIC_POS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // Ignore
  }
  return null;
}

function savePos(pos) {
  try {
    if (!pos) {
      localStorage.removeItem(MUSIC_POS_KEY);
    } else {
      localStorage.setItem(MUSIC_POS_KEY, JSON.stringify(pos));
    }
  } catch {
    // Ignore
  }
}

function mapItunesTrack(item, isIndo = true) {
  if (!item || !item.trackId || !item.previewUrl) return null;
  const art = String(item.artworkUrl100 || item.artworkUrl60 || '').replace('100x100', '300x300');
  const tags = `${item.collectionName || ''} ${item.primaryGenreName || ''} indonesia viral gen z`;
  return {
    id: `it-${item.trackId}`,
    title: String(item.trackName || 'Lagu Viral Indonesia'),
    artist: String(item.artistName || 'Artis Indonesia'),
    genre: String(item.primaryGenreName || 'Indo Pop / Viral'),
    tags,
    duration: 30,
    artwork: art,
    isIndonesianViral: isIndo,
    sourceLabel: 'Viral Indonesia',
    streamUrl: String(item.previewUrl),
  };
}

function mapAudiusTrack(item, isIndo = false) {
  if (!item || !item.id) return null;
  const art =
    item.artwork?.['150x150'] ||
    item.artwork?.['480x480'] ||
    item.user?.profile_picture?.['150x150'] ||
    '';
  return {
    id: `au-${item.id}`,
    title: String(item.title || 'DJ Remix'),
    artist: String(item.user?.name || 'DJ Creator'),
    genre: String(item.genre || 'DJ / Remix'),
    tags: `${item.tags || ''} ${isIndo ? 'indonesia dj remix cover' : ''}`,
    duration: Number(item.duration || 0),
    artwork: art,
    isIndonesianViral: isIndo,
    sourceLabel: isIndo ? 'DJ / Cover Indo' : 'Musik Bebas Iklan',
    streamUrl: `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(item.id)}/stream?app_name=Manifestudio`,
  };
}

async function fetchItunesIndonesia(query, limit = 2, isIndo = true) {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&country=ID&media=music&limit=${limit}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.results || []).map((item) => mapItunesTrack(item, isIndo)).filter(Boolean);
}

async function fetchAudiusSearch(query, limit = 4, isIndo = false) {
  const q = String(query || '').trim();
  if (!q) return [];
  const res = await fetch(
    `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(q)}&app_name=Manifestudio&limit=${limit}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.data || []).map((item) => mapAudiusTrack(item, isIndo)).filter(Boolean);
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
  audio.volume = 0.65;

  let prefs = readPrefs();
  let session = readSessionState();
  let customPos = readSavedPos();
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
  let suppressNextFabClick = false;

  function applyRootPosition() {
    const fabSize = window.innerWidth <= 640 ? 40 : 44;
    if (customPos) {
      const clamped = clampMusicFabPosition({
        x: customPos.x,
        y: customPos.y,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        fabSize,
        margin: 10,
      });
      customPos = clamped;
      root.classList.add('is-custom-pos');
      root.style.left = `${clamped.x}px`;
      root.style.top = `${clamped.y}px`;
      root.style.bottom = 'auto';
      root.style.right = 'auto';
      const anchor = getPopoverAnchorClasses({
        ...clamped,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        fabSize,
      });
      root.dataset.hAnchor = anchor.horizontal;
      root.dataset.vAnchor = anchor.vertical;
      root.style.setProperty('--music-pop-offset-x', `${anchor.offsetX}px`);
    } else {
      root.classList.remove('is-custom-pos');
      root.style.left = '';
      root.style.top = '';
      root.style.bottom = '';
      root.style.right = '';
      root.style.removeProperty('--music-pop-offset-x');
      root.dataset.hAnchor = 'align-left';
      root.dataset.vAnchor = 'open-up';
    }
  }

  function updateCartOverlapOffset() {
    if (customPos) {
      root.classList.remove('is-above-mobile-cart');
      return;
    }
    const cartBar = document.getElementById('mobile-cart-bar');
    const hasCart = Boolean(cartBar && !cartBar.hidden);
    root.classList.toggle('is-above-mobile-cart', hasCart);
  }

  const cartBarEl = document.getElementById('mobile-cart-bar');
  if (cartBarEl && typeof MutationObserver !== 'undefined') {
    const mo = new MutationObserver(updateCartOverlapOffset);
    mo.observe(cartBarEl, { attributes: true, attributeFilter: ['hidden'] });
  }

  window.addEventListener('resize', () => {
    if (customPos) {
      applyRootPosition();
      savePos(customPos);
    }
  });

  applyRootPosition();
  updateCartOverlapOffset();

  async function ensureTrackPool() {
    if (poolPromise) return poolPromise;
    poolPromise = (async () => {
      try {
        // Pick a rich batch of Indonesian Viral 2026 Gen-Z + DJ/Cover tracks in parallel
        const shuffledQueries = [...VIRAL_INDO_2026_QUERIES].sort(() => Math.random() - 0.5);
        const batchQueries = shuffledQueries.slice(0, 7);
        const djQueries = [...AUDIUS_INDO_DJ_QUERIES].sort(() => Math.random() - 0.5).slice(0, 2);
        const topTerms = getTopSearchKeywords(prefs, 2);

        const itunesJobs = batchQueries.map((q) => fetchItunesIndonesia(q, 2, true).catch(() => []));
        const userTermJobs = topTerms.map((term) =>
          fetchItunesIndonesia(term, 3, true).catch(() => [])
        );
        const djJobs = djQueries.map((q) => fetchAudiusSearch(q, 2, true).catch(() => []));

        const results = await Promise.all([...userTermJobs, ...itunesJobs, ...djJobs]);
        const mergedMap = new Map();
        for (const group of results) {
          for (const t of group) {
            if (t && t.id && !mergedMap.has(t.id)) {
              mergedMap.set(t.id, t);
            }
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
    applyRootPosition();
    const score = currentTrack ? scoreTrackForUser(currentTrack, prefs) : 1;
    const matchBadge = currentTrack
      ? currentTrack.isIndonesianViral && score > 3.5
        ? 'Viral Indo · Sesuai Minatmu'
        : currentTrack.sourceLabel || 'Viral Indonesia 2026'
      : 'Viral Indonesia 2026';

    const trackTitle = currentTrack ? currentTrack.title : 'Musik Viral Indonesia';
    const trackArtist = currentTrack
      ? `${currentTrack.artist} · ${currentTrack.genre}`
      : 'Klik tombol apa saja · Geser ikon untuk pindah';
    const curSec = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const durSec =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : currentTrack?.duration || 30;
    const pct = durSec > 0 ? Math.min(100, Math.round((curSec / durSec) * 100)) : 0;

    root.innerHTML = `
      <div
        id="music-popover"
        class="music-popover"
        role="dialog"
        aria-label="Pemutar Musik Viral Indonesia Bebas Iklan"
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
          <div class="music-head-btns">
            ${
              customPos
                ? `<button type="button" class="music-reset-pos-btn" id="music-reset-pos-btn" title="Kembalikan posisi ikon" aria-label="Reset posisi ikon musik">↺</button>`
                : ''
            }
            <button
              type="button"
              class="music-close-btn"
              id="music-close-btn"
              aria-label="Tutup panel musik"
            >✕</button>
          </div>
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
            ${isLoading ? 'Memuat...' : isPlaying ? '❚❚ Jeda' : '▶ Putar'}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm music-ctrl-btn"
            id="music-next-btn"
            aria-label="Ganti lagu viral berikutnya"
          >
            ⏭ Lagu Lain
          </button>
        </div>

        <form id="music-search-form" class="music-search-row">
          <input
            type="search"
            id="music-search-input"
            class="music-search-input"
            placeholder="Cari lagu Indo, cover, atau DJ..."
            value="${escapeHtml(searchQuery)}"
            aria-label="Cari lagu Indonesia, cover, atau DJ"
          />
          <button type="submit" class="btn btn-secondary btn-sm" aria-label="Cari dan putar lagu">Cari</button>
        </form>
        <div class="music-drag-tip">Tips: Tekan &amp; geser ikon musik ke posisi mana saja.</div>
      </div>

      <button
        type="button"
        id="music-fab-btn"
        class="music-fab-btn ${isPlaying ? 'is-playing' : ''}"
        aria-label="${isOpen ? 'Tutup kontrol musik (bisa digeser)' : 'Buka atau geser ikon musik'}"
        aria-expanded="${isOpen}"
        title="Ketuk untuk kontrol · Tekan & geser untuk pindah posisi"
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
        : currentTrack?.duration || 30;
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
      // Search Indonesian iTunes hits + Audius DJ/Remix in parallel
      const [indoResults, djResults] = await Promise.all([
        fetchItunesIndonesia(q, 6, true).catch(() => []),
        fetchAudiusSearch(q, 4, false).catch(() => []),
      ]);
      const results = [...indoResults, ...djResults];
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

  function attachDragHandlers(fabBtn) {
    if (!fabBtn) return;
    let dragging = false;
    let moved = false;
    let pointerId = null;
    let startClientX = 0;
    let startClientY = 0;
    let originX = 0;
    let originY = 0;

    fabBtn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      dragging = true;
      moved = false;
      pointerId = e.pointerId;
      startClientX = e.clientX;
      startClientY = e.clientY;
      const rect = fabBtn.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      fabBtn.setPointerCapture?.(pointerId);
    });

    fabBtn.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true;
        suppressNextFabClick = true;
        fabBtn.classList.add('is-dragging');
      }
      if (!moved) return;
      const fabSize = window.innerWidth <= 640 ? 40 : 44;
      customPos = clampMusicFabPosition({
        x: originX + dx,
        y: originY + dy,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        fabSize,
        margin: 10,
      });
      applyRootPosition();
    });

    const finishDrag = (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      dragging = false;
      fabBtn.classList.remove('is-dragging');
      fabBtn.releasePointerCapture?.(pointerId);
      if (moved && customPos) {
        savePos(customPos);
        updateCartOverlapOffset();
        setTimeout(() => {
          suppressNextFabClick = false;
        }, 120);
      }
    };

    fabBtn.addEventListener('pointerup', finishDrag);
    fabBtn.addEventListener('pointercancel', finishDrag);
  }

  function bindWidgetEvents() {
    const fabBtn = root.querySelector('#music-fab-btn');
    attachDragHandlers(fabBtn);

    fabBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (suppressNextFabClick) {
        suppressNextFabClick = false;
        return;
      }
      isOpen = !isOpen;
      renderWidget();
      if (isOpen && !currentTrack) {
        ensureTrackPool();
      }
    });

    root.querySelector('#music-reset-pos-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      customPos = null;
      savePos(null);
      applyRootPosition();
      updateCartOverlapOffset();
      renderWidget();
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
          : currentTrack?.duration || 30;
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
          : currentTrack?.duration || 30;
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
    if (root.contains(target)) return;
    const clickable = target.closest(
      'button, a, [role="button"], [role="tab"], .product-tile'
    );
    if (!clickable) return;
    if (session.userPaused) return;
    if (!isPlaying && !isLoading) {
      playNextSmartTrack({ wasSkip: false });
    }
  });

  ensureTrackPool();
  renderWidget();
}
