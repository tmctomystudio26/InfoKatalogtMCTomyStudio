/**
 * Ad-Free Full-Length Smart Music Player Widget
 * - Draggable / movable music icon (persists user-selected coordinates cleanly).
 * - Full-length Indonesian Viral 2026 Gen-Z songs, DJ remixes, & covers (zero 30s previews).
 * - Multi-source support inside popover: Full Audio (Audius Full Tracks), SoundCloud Player, & Spotify Embed.
 * - Auto-triggers Full Audio playback when any interactive button is clicked (unless user paused).
 * - Learns from user search terms & frequent plays for weighted random picks.
 */

import {
  MIN_FULL_TRACK_SECONDS,
  buildMusicEmbedUrl,
  clampMusicFabPosition,
  createDefaultMusicPrefs,
  filterFullLengthTracks,
  formatAudioTime,
  getPopoverAnchorClasses,
  getTopSearchKeywords,
  normalizeMusicMode,
  pickWeightedRandomTrack,
  rankSearchResults,
  recordMusicPreference,
  scoreTrackForUser,
} from './music-logic.js';

const MUSIC_PREFS_KEY = 'manifestudio_music_prefs_v1';
const MUSIC_STATE_KEY = 'manifestudio_music_session_v1';
const MUSIC_POS_KEY = 'manifestudio_music_pos_v1';
const MUSIC_MODE_KEY = 'manifestudio_music_mode_v1';
const AUDIUS_API_BASE = 'https://api.audius.co/v1';

// Verified queries returning full-length (>75s) Indonesian Viral Gen-Z, DJ & Cover tracks
const AUDIUS_INDO_FULL_QUERIES = [
  'Garam dan Madu',
  'Bernadya',
  'Whisnu Santika',
  'Weird Genius',
  'Feel Koplo',
  'Hindia',
  'Tulus',
  'Pamungkas',
  'Dangdut Remix',
  'Lagu Indonesia',
];

const SOUNDCLOUD_STATIONS = [
  {
    id: 'sc-feelkoplo',
    label: 'Feel Koplo (DJ Indo)',
    url: 'https://soundcloud.com/feelkoplo',
  },
  {
    id: 'sc-weird',
    label: 'Weird Genius',
    url: 'https://soundcloud.com/weirdgenius',
  },
  {
    id: 'sc-hindia',
    label: 'Hindia (Indie Indo)',
    url: 'https://soundcloud.com/hindia',
  },
];

const SPOTIFY_STATIONS = [
  {
    id: 'sp-top50id',
    label: 'Top 50 Indonesia',
    playlistId: '37i9dQZEVXbObFQZ3JLcXt',
  },
  {
    id: 'sp-viralid',
    label: 'Hits Viral Indo',
    playlistId: '37i9dQZF1DXa2PvUpywmrr',
  },
];

// Full-length royalty-free backup tracks if offline
const FALLBACK_TRACKS = [
  {
    id: 'cc-lofi-1',
    title: 'Midnight Chill Full Mix (Offline)',
    artist: 'FreePD Ambient',
    genre: 'Lo-Fi Chill',
    duration: 148,
    artwork: '',
    isIndonesianViral: false,
    sourceLabel: 'Full Version Offline',
    streamUrl: 'https://freepd.com/music/Aerosol%20of%20My%20Love.mp3',
  },
  {
    id: 'cc-synth-2',
    title: 'Neon Horizon Full Mix (Offline)',
    artist: 'FreePD Electronic',
    genre: 'Synthwave',
    duration: 132,
    artwork: '',
    isIndonesianViral: false,
    sourceLabel: 'Full Version Offline',
    streamUrl: 'https://freepd.com/music/Neon%20Laser%20Horizon.mp3',
  },
];

let singletonInitialized = false;
let scApiPromise = null;

function ensureSoundCloudApiLoaded() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  if (scApiPromise) return scApiPromise;
  scApiPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[data-sc-widget-api="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.SC || null), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://w.soundcloud.com/player/api.js';
    script.async = true;
    script.dataset.scWidgetApi = 'true';
    script.onload = () => resolve(window.SC || null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return scApiPromise;
}

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
    if (!raw) {
      return {
        userPaused: false,
        lastTrackId: null,
        scStationId: SOUNDCLOUD_STATIONS[0].id,
        spStationId: SPOTIFY_STATIONS[0].id,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      userPaused: Boolean(parsed?.userPaused),
      lastTrackId: parsed?.lastTrackId || null,
      scStationId: parsed?.scStationId || SOUNDCLOUD_STATIONS[0].id,
      spStationId: parsed?.spStationId || SPOTIFY_STATIONS[0].id,
    };
  } catch {
    return {
      userPaused: false,
      lastTrackId: null,
      scStationId: SOUNDCLOUD_STATIONS[0].id,
      spStationId: SPOTIFY_STATIONS[0].id,
    };
  }
}

function saveSessionState(sess) {
  try {
    localStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(sess));
  } catch {
    // Ignore
  }
}

function readMusicMode() {
  try {
    return normalizeMusicMode(localStorage.getItem(MUSIC_MODE_KEY));
  } catch {
    return 'full-audio';
  }
}

function saveMusicMode(mode) {
  try {
    localStorage.setItem(MUSIC_MODE_KEY, normalizeMusicMode(mode));
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

function mapAudiusTrack(item, isIndo = true) {
  if (!item || !item.id || !item.is_streamable) return null;
  const duration = Number(item.duration || 0);
  if (duration < 45) return null;
  const art =
    item.artwork?.['150x150'] ||
    item.artwork?.['480x480'] ||
    item.user?.profile_picture?.['150x150'] ||
    '';
  return {
    id: `au-${item.id}`,
    title: String(item.title || 'Lagu Full Version'),
    artist: String(item.user?.name || 'Musisi Indonesia'),
    genre: String(item.genre || 'Indo Viral / DJ'),
    tags: `${item.tags || ''} ${isIndo ? 'indonesia viral dj remix cover full' : 'full'}`,
    duration,
    artwork: art,
    isIndonesianViral: isIndo,
    sourceLabel: 'Full Version',
    streamUrl: `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(item.id)}/stream?app_name=Manifestudio`,
  };
}

async function fetchAudiusSearch(query, limit = 6, isIndo = true) {
  const q = String(query || '').trim();
  if (!q) return [];
  const res = await fetch(
    `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(q)}&app_name=Manifestudio&limit=${limit}`,
    { cache: 'no-store' }
  );
  if (!res.ok) return [];
  const json = await res.json();
  const mapped = (json?.data || []).map((item) => mapAudiusTrack(item, isIndo)).filter(Boolean);
  const full = filterFullLengthTracks(mapped, MIN_FULL_TRACK_SECONDS);
  return full.length > 0 ? full : mapped;
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
  audio.id = 'music-audio-el';
  audio.preload = 'none';
  audio.volume = 0.65;
  audio.hidden = true;
  document.body.appendChild(audio);

  let prefs = readPrefs();
  let session = readSessionState();
  let musicMode = readMusicMode();
  let customPos = readSavedPos();
  let tracks = [...FALLBACK_TRACKS];
  let poolLoaded = false;
  let poolPromise = null;
  let currentTrack = null;
  let isPlaying = false;
  let isLoading = false;
  let isOpen = false;
  let searchQuery = '';
  let searchResults = [];
  let searchFeedback = '';
  let isSeeking = false;
  let searchDebounce = null;
  let playedLoggedForId = null;
  let suppressNextFabClick = false;
  let scWidget = null;
  let manualSelectionVersion = 0;

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
        const shuffled = [...AUDIUS_INDO_FULL_QUERIES].sort(() => Math.random() - 0.5);
        const batchQueries = shuffled.slice(0, 6);
        const topTerms = getTopSearchKeywords(prefs, 2);

        const userJobs = topTerms.map((term) => fetchAudiusSearch(term, 4, true).catch(() => []));
        const indoJobs = batchQueries.map((q) => fetchAudiusSearch(q, 4, true).catch(() => []));

        const results = await Promise.all([...userJobs, ...indoJobs]);
        const mergedMap = new Map();
        for (const group of results) {
          for (const t of group) {
            if (t && t.id && !mergedMap.has(t.id)) {
              mergedMap.set(t.id, t);
            }
          }
        }
        const fullTracks = filterFullLengthTracks([...mergedMap.values()], MIN_FULL_TRACK_SECONDS);
        if (fullTracks.length > 0) {
          const combined = new Map(fullTracks.map((t) => [t.id, t]));
          for (const sr of searchResults) {
            if (sr && sr.id) combined.set(sr.id, sr);
          }
          tracks = [...combined.values()];
        }
        poolLoaded = true;
      } catch {
        poolLoaded = true;
      }
      return tracks;
    })();
    return poolPromise;
  }

  function getActiveSoundCloudStation() {
    return (
      SOUNDCLOUD_STATIONS.find((s) => s.id === session.scStationId) || SOUNDCLOUD_STATIONS[0]
    );
  }

  function getActiveSpotifyStation() {
    return SPOTIFY_STATIONS.find((s) => s.id === session.spStationId) || SPOTIFY_STATIONS[0];
  }

  function renderFullAudioBody() {
    const score = currentTrack ? scoreTrackForUser(currentTrack, prefs) : 1;
    const matchBadge = currentTrack
      ? currentTrack.isIndonesianViral && score > 3.5
        ? 'Full Song · Sesuai Minatmu'
        : `${currentTrack.sourceLabel || 'Full Song'} · ${formatAudioTime(currentTrack.duration)}`
      : 'Lagu Full Version Bebas Iklan';

    const curSec = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const durSec =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : currentTrack?.duration || 180;
    const pct = durSec > 0 ? Math.min(100, Math.round((curSec / durSec) * 100)) : 0;

    return `
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
          ${isLoading ? 'Memuat...' : isPlaying ? '❚❚ Jeda' : '▶ Putar Full'}
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
          placeholder="Cari lagu Indo, cover, atau DJ full..."
          value="${escapeHtml(searchQuery)}"
          aria-label="Cari lagu Indonesia full version"
        />
        <button type="submit" class="btn btn-secondary btn-sm" aria-label="Cari dan putar lagu">Cari</button>
      </form>

      ${
        searchFeedback
          ? `<div class="music-search-note" role="status">${escapeHtml(searchFeedback)}</div>`
          : ''
      }

      ${
        searchResults.length > 0
          ? `<div class="music-search-results" role="listbox" aria-label="Hasil pencarian lagu">
              ${searchResults
                .map(
                  (t) => `
                <button
                  type="button"
                  class="music-search-hit ${currentTrack?.id === t.id ? 'is-active' : ''}"
                  data-music-pick-id="${escapeHtml(t.id)}"
                >
                  <span class="music-search-hit-title">${escapeHtml(t.title)} — ${escapeHtml(t.artist)}</span>
                  <span class="music-search-hit-dur mono-num">${formatAudioTime(t.duration)}</span>
                </button>
              `
                )
                .join('')}
            </div>`
          : ''
      }
    `;
  }

  function renderSoundCloudBody() {
    const active = getActiveSoundCloudStation();
    const embedSrc = buildMusicEmbedUrl('soundcloud', active.url);
    return `
      <div class="music-station-pills" role="group" aria-label="Pilih stasiun SoundCloud">
        ${SOUNDCLOUD_STATIONS.map(
          (st) => `
          <button
            type="button"
            class="music-station-pill ${st.id === active.id ? 'is-active' : ''}"
            data-sc-station="${escapeHtml(st.id)}"
          >
            ${escapeHtml(st.label)}
          </button>
        `
        ).join('')}
      </div>
      <div class="music-embed-wrap is-soundcloud">
        <iframe
          id="music-sc-iframe"
          class="music-embed-iframe"
          title="SoundCloud Player ${escapeHtml(active.label)}"
          scrolling="no"
          frameborder="no"
          allow="autoplay"
          src="${escapeHtml(embedSrc)}"
        ></iframe>
      </div>
    `;
  }

  function renderSpotifyBody() {
    const active = getActiveSpotifyStation();
    const embedSrc = buildMusicEmbedUrl('spotify', active.playlistId);
    return `
      <div class="music-station-pills" role="group" aria-label="Pilih playlist Spotify">
        ${SPOTIFY_STATIONS.map(
          (st) => `
          <button
            type="button"
            class="music-station-pill ${st.id === active.id ? 'is-active' : ''}"
            data-sp-station="${escapeHtml(st.id)}"
          >
            ${escapeHtml(st.label)}
          </button>
        `
        ).join('')}
      </div>
      <div class="music-embed-wrap is-spotify">
        <iframe
          id="music-sp-iframe"
          class="music-embed-iframe"
          title="Spotify Player ${escapeHtml(active.label)}"
          frameborder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          src="${escapeHtml(embedSrc)}"
        ></iframe>
      </div>
    `;
  }

  function renderWidget() {
    applyRootPosition();

    const activeSc = getActiveSoundCloudStation();
    const activeSp = getActiveSpotifyStation();

    const trackTitle =
      musicMode === 'soundcloud'
        ? activeSc.label
        : musicMode === 'spotify'
        ? activeSp.label
        : currentTrack
        ? currentTrack.title
        : 'Musik Viral Indonesia (Full)';
    const trackArtist =
      musicMode === 'soundcloud'
        ? 'SoundCloud Official Player · Full Stream'
        : musicMode === 'spotify'
        ? 'Spotify Embed Player · Playlist Indonesia'
        : currentTrack
        ? `${currentTrack.artist} · ${currentTrack.genre}`
        : 'Klik tombol apa saja · Versi penuh tanpa iklan';

    const modeBody =
      musicMode === 'soundcloud'
        ? renderSoundCloudBody()
        : musicMode === 'spotify'
        ? renderSpotifyBody()
        : renderFullAudioBody();

    root.innerHTML = `
      <div
        id="music-popover"
        class="music-popover"
        role="dialog"
        aria-label="Pemutar Musik Full Version Bebas Iklan"
        ${isOpen ? '' : 'hidden'}
      >
        <div class="music-pop-head">
          <div class="music-pop-track">
            <div class="music-art-wrap">
              ${
                musicMode === 'full-audio' && currentTrack?.artwork
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

        <div class="music-mode-tabs" role="tablist" aria-label="Pilih sumber pemutar musik">
          <button
            type="button"
            role="tab"
            class="music-mode-btn ${musicMode === 'full-audio' ? 'is-active' : ''}"
            data-music-mode="full-audio"
            aria-selected="${musicMode === 'full-audio'}"
          >
            Full Audio
          </button>
          <button
            type="button"
            role="tab"
            class="music-mode-btn ${musicMode === 'soundcloud' ? 'is-active' : ''}"
            data-music-mode="soundcloud"
            aria-selected="${musicMode === 'soundcloud'}"
          >
            SoundCloud
          </button>
          <button
            type="button"
            role="tab"
            class="music-mode-btn ${musicMode === 'spotify' ? 'is-active' : ''}"
            data-music-mode="spotify"
            aria-selected="${musicMode === 'spotify'}"
          >
            Spotify
          </button>
        </div>

        ${modeBody}

        <div class="music-drag-tip">Tekan &amp; geser ikon musik ke posisi mana saja.</div>
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
    if (!isOpen || isSeeking || musicMode !== 'full-audio') return;
    const slider = root.querySelector('#music-seek-slider');
    const timeEl = root.querySelector('#music-time-label');
    const cur = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const dur =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : currentTrack?.duration || 180;
    if (slider && dur > 0) {
      slider.value = String(Math.min(100, (cur / dur) * 100));
    }
    if (timeEl) {
      timeEl.textContent = `${formatAudioTime(cur)} / ${formatAudioTime(dur)}`;
    }
  }

  async function playTrack(track, { recordPlay = true } = {}) {
    if (!track || !track.streamUrl || musicMode !== 'full-audio') return;
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
    if (musicMode !== 'full-audio') return;
    const versionAtStart = manualSelectionVersion;
    if (wasSkip && currentTrack) {
      prefs = recordMusicPreference(prefs, { type: 'skip', track: currentTrack });
      savePrefs(prefs);
    }
    if (!poolLoaded) {
      await ensureTrackPool();
    }
    if (!wasSkip && manualSelectionVersion !== versionAtStart) {
      return;
    }
    const next = pickWeightedRandomTrack(tracks, prefs, currentTrack?.id || null);
    if (next) {
      await playTrack(next, { recordPlay: true });
    }
  }

  async function handleMusicSearch(term) {
    const q = String(term || '').trim();
    searchQuery = q;
    if (!q) {
      searchResults = [];
      searchFeedback = '';
      renderWidget();
      return;
    }
    manualSelectionVersion += 1;
    const searchVersion = manualSelectionVersion;
    prefs = recordMusicPreference(prefs, { type: 'search', term: q });
    savePrefs(prefs);

    isLoading = true;
    searchFeedback = '';
    renderWidget();
    try {
      const rawResults = await fetchAudiusSearch(q, 15, true);
      if (manualSelectionVersion !== searchVersion) return;
      const ranked = rankSearchResults(rawResults, q, MIN_FULL_TRACK_SECONDS);
      if (ranked.length > 0) {
        const merged = new Map(tracks.map((t) => [t.id, t]));
        for (const r of ranked) merged.set(r.id, r);
        tracks = [...merged.values()];
        searchResults = ranked.slice(0, 6);
        searchFeedback = '';
        await playTrack(ranked[0], { recordPlay: true });
        return;
      }
      searchResults = [];
      searchFeedback = `Tidak ditemukan lagu full yang cocok untuk "${q}". Coba judul atau artis lain.`;
    } catch {
      searchResults = [];
      searchFeedback = 'Gagal mencari lagu saat ini. Periksa koneksi lalu coba lagi.';
    }
    isLoading = false;
    renderWidget();
  }

  function pauseAllSiteMusic({ userPaused = true } = {}) {
    if (!audio.paused) {
      audio.pause();
    }
    try {
      scWidget?.pause?.();
    } catch {
      // Ignore SoundCloud pause error
    }
    // Reload active SoundCloud/Spotify iframe src to guarantee third-party embed audio stops cleanly
    const embedIframe = root.querySelector('#music-sc-iframe, #music-sp-iframe');
    if (embedIframe && embedIframe.getAttribute('src')) {
      const currentSrc = embedIframe.getAttribute('src');
      embedIframe.setAttribute('src', currentSrc);
    }
    isPlaying = false;
    isLoading = false;
    if (userPaused) {
      session.userPaused = true;
      saveSessionState(session);
    }
    root.querySelector('#music-fab-btn')?.classList.remove('is-playing');
    const playBtn = root.querySelector('#music-playpause-btn');
    if (playBtn && musicMode === 'full-audio') {
      playBtn.textContent = '▶ Putar Full';
      playBtn.setAttribute('aria-label', 'Putar musik');
    }
  }

  function togglePlayPause() {
    if (musicMode !== 'full-audio') return;
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

  async function setupSoundCloudWidgetBindings() {
    const iframe = root.querySelector('#music-sc-iframe');
    if (!iframe) return;
    const SC = await ensureSoundCloudApiLoaded();
    if (!SC?.Widget || musicMode !== 'soundcloud') return;
    try {
      scWidget = SC.Widget(iframe);
      scWidget.bind(SC.Widget.Events.PLAY, () => {
        isPlaying = true;
        root.querySelector('#music-fab-btn')?.classList.add('is-playing');
      });
      scWidget.bind(SC.Widget.Events.PAUSE, () => {
        isPlaying = false;
        root.querySelector('#music-fab-btn')?.classList.remove('is-playing');
      });
      scWidget.bind(SC.Widget.Events.FINISH, () => {
        isPlaying = false;
        root.querySelector('#music-fab-btn')?.classList.remove('is-playing');
      });
    } catch {
      scWidget = null;
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
      if (isOpen && musicMode === 'full-audio' && !currentTrack) {
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

    root.querySelectorAll('[data-music-mode]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextMode = normalizeMusicMode(btn.getAttribute('data-music-mode'));
        if (nextMode === musicMode) return;
        musicMode = nextMode;
        saveMusicMode(nextMode);
        if (nextMode !== 'full-audio' && !audio.paused) {
          audio.pause();
          isPlaying = false;
        }
        scWidget = null;
        renderWidget();
      });
    });

    root.querySelectorAll('[data-sc-station]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-sc-station');
        if (!id || id === session.scStationId) return;
        session.scStationId = id;
        saveSessionState(session);
        renderWidget();
      });
    });

    root.querySelectorAll('[data-sp-station]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-sp-station');
        if (!id || id === session.spStationId) return;
        session.spStationId = id;
        saveSessionState(session);
        renderWidget();
      });
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
          : currentTrack?.duration || 180;
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
          : currentTrack?.duration || 180;
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

    root.querySelectorAll('[data-music-pick-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pickId = btn.getAttribute('data-music-pick-id');
        const picked =
          searchResults.find((t) => t.id === pickId) || tracks.find((t) => t.id === pickId);
        if (picked) {
          manualSelectionVersion += 1;
          playTrack(picked, { recordPlay: true });
        }
      });
    });

    if (isOpen && musicMode === 'soundcloud') {
      setupSoundCloudWidgetBindings();
    }
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
    if (musicMode === 'full-audio') {
      playNextSmartTrack({ wasSkip: false });
    }
  });
  audio.addEventListener('error', () => {
    if (musicMode === 'full-audio' && !session.userPaused && currentTrack) {
      const prevId = currentTrack.id;
      const wasInSearchResults = searchResults.some((t) => t.id === prevId);
      tracks = tracks.filter((t) => t.id !== prevId);
      if (wasInSearchResults) {
        const nextSearchHit = searchResults.find((t) => t.id !== prevId && tracks.some((tr) => tr.id === t.id));
        if (nextSearchHit) {
          playTrack(nextSearchHit, { recordPlay: true });
          return;
        }
        // Keep the searched song selected instead of jumping to an unrelated random track
        isPlaying = false;
        isLoading = false;
        renderWidget();
        return;
      }
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

  // Pause all site music whenever external <video>/<audio> (e.g. Downloader preview) plays
  document.addEventListener(
    'play',
    (e) => {
      const target = e.target;
      if (target === audio) return;
      if (target instanceof HTMLMediaElement && !root.contains(target)) {
        pauseAllSiteMusic({ userPaused: true });
      }
    },
    true
  );

  window.addEventListener('manifestudio:external-media-play', () => {
    pauseAllSiteMusic({ userPaused: true });
  });

  // Auto-start smart full-version music when interactive UI buttons are clicked (skipping downloader media)
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (root.contains(target)) return;
    if (target.closest('[data-testid="downloader-panel"], video, audio, [data-dl-save-idx]')) {
      return;
    }
    const clickable = target.closest(
      'button, a, [role="button"], [role="tab"], .product-tile'
    );
    if (!clickable) return;
    if (musicMode !== 'full-audio' || session.userPaused) return;
    const externalMediaPlaying = Array.from(document.querySelectorAll('video, audio')).some(
      (el) => el !== audio && !el.paused && !el.ended
    );
    if (externalMediaPlaying) return;
    if (!isPlaying && !isLoading) {
      playNextSmartTrack({ wasSkip: false });
    }
  });

  ensureTrackPool();
  renderWidget();
}
