/**
 * Manifestudio Global YT Music Controller & Modern Minimal Floating Dock
 * - Powered by Open-Source Community YT Music APIs (Piped music_songs & Siputzx YT Search)
 *   paired with YouTube IFrame Player API for seamless, ad-free catalog playback.
 * - Pure Fisher-Yates shuffled selection prioritizing Viral Indonesian songs
 *   (zero dependency on user search history or play-frequency weights).
 * - Automatically starts shuffled Viral Indonesian playback when ANY button on the web
 *   is clicked (unless explicitly paused during the active page session or an external media
 *   preview is actively playing).
 * - Exposes a single shared controller (`getMusicController`) synced with Menu Utilitas (`tools.html?tab=music`).
 */

import {
  MIN_FULL_TRACK_SECONDS,
  clampMusicFabPosition,
  extractYouTubeVideoId,
  filterFullLengthTracks,
  formatAudioTime,
  getPopoverAnchorClasses,
  normalizeRepeatMode,
  normalizeYtMusicTrack,
  parseSavedVolume,
  pickShuffledViralTrack,
  rankSearchResults,
  shuffleTracksFisherYates,
} from './music-logic.js?v=24';

const MUSIC_POS_KEY = 'manifestudio_music_pos_v2';
const MUSIC_VOL_KEY = 'manifestudio_music_vol_v2';
const MUSIC_SHUFFLE_KEY = 'manifestudio_music_shuffle_v2';
const MUSIC_REPEAT_KEY = 'manifestudio_music_repeat_v2';

// Community open-source YT Music / YouTube search API endpoints (CORS *)
const PIPED_API_HOSTS = [
  'https://api.piped.private.coffee',
  'https://pipedapi.ducks.party',
];
const SIPUTZX_YT_SEARCH_URL = 'https://api.siputzx.my.id/api/s/youtube';

// Curated Viral Indonesia YT Music preset queries (no search history dependency)
export const MUSIC_PRESET_CATEGORIES = [
  {
    id: 'viral-indo',
    label: 'Viral Indonesia',
    queries: [
      'Lagu Viral Indonesia 2026',
      'Top Hits Indonesia Terpopuler',
      'Lagu Viral TikTok Indonesia 2026',
    ],
  },
  {
    id: 'pop-galau',
    label: 'Pop & Galau Indo',
    queries: [
      'Pop Indonesia Bernadya Hindia Tulus',
      'Lagu Galau Indonesia Populer Full',
    ],
  },
  {
    id: 'dj-remix',
    label: 'DJ Remix TikTok',
    queries: [
      'DJ Remix Viral TikTok Indonesia Full Bass',
      'Whisnu Santika Feel Koplo Remix',
    ],
  },
  {
    id: 'indie-akustik',
    label: 'Indie & Akustik',
    queries: [
      'Musik Indie Indonesia Hindia Raim Laode Batas Senja',
      'Lagu Akustik Indonesia Viral',
    ],
  },
  {
    id: 'koplo-dangdut',
    label: 'Koplo & Dangdut',
    queries: [
      'NDX AKA Denny Caknan Guyon Waton',
      'Dangdut Koplo Viral Indonesia Terbaru',
    ],
  },
];

// Pre-seeded real YT Music Viral Indonesia catalog so first-click playback is instant
const SEED_VIRAL_INDO_TRACKS = [
  normalizeYtMusicTrack({
    videoId: 'En-EHqRk8yg',
    title: 'Garam & Madu (Sakit Dadaku)',
    artist: 'Tenxi, Naykilla & Jemsii',
    duration: 185,
    genre: 'Viral Indonesia',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'hc-8aB0Dkkw',
    title: 'Untungnya, Hidup Harus Tetap Berjalan',
    artist: 'Bernadya',
    duration: 183,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'Zq1Jg0H5fzc',
    title: 'everything u are',
    artist: 'Hindia',
    duration: 237,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: '-07Xbws-LB4',
    title: 'Bersenja Gurau',
    artist: 'Raim Laode',
    duration: 195,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'g6iIVyRfiUk',
    title: 'penjaga hati',
    artist: 'Nadhif Basalamah',
    duration: 261,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'lABZ_-uhC0E',
    title: 'Gala bunga matahari',
    artist: 'Sal Priadi',
    duration: 210,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'X9EDqDWza3M',
    title: 'Sialan',
    artist: 'Juicy Luicy & Adrian Khalif',
    duration: 242,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'V697wAtn6cI',
    title: 'Nanti Kita Seperti Ini',
    artist: 'BATAS SENJA',
    duration: 210,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: '2r7UutFm7qc',
    title: 'Mati-Matian',
    artist: 'Mahalini',
    duration: 245,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'E7kHvjvU6JY',
    title: 'Hati-Hati di Jalan',
    artist: 'Tulus',
    duration: 242,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'tMLV3IWfOMs',
    title: 'Nemen (Hiphop Dangdut Version)',
    artist: 'NDX A.K.A.',
    duration: 275,
    genre: 'Koplo & Dangdut',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'J1HR1_uG6VU',
    title: 'Cartel',
    artist: 'Whisnu Santika & Adnan Veron',
    duration: 183,
    genre: 'DJ Remix TikTok',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'Z3E3AamV2to',
    title: 'Sigar',
    artist: 'Denny Caknan',
    duration: 330,
    genre: 'Koplo & Dangdut',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'BoESHbOq_s8',
    title: 'Rumah Singgah',
    artist: 'Fabio Asher',
    duration: 247,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: '9YPX7WjPDp8',
    title: 'Pesan Terakhir',
    artist: 'Lyodra',
    duration: 262,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'ljSczANvbV8',
    title: 'Tabola Bale',
    artist: 'Silet Open Up',
    duration: 275,
    genre: 'Viral Indonesia',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
].filter(Boolean);

let controllerSingleton = null;
let ytApiLoadPromise = null;

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
    // Ignore storage error
  }
  return null;
}

function savePos(pos) {
  try {
    if (!pos) localStorage.removeItem(MUSIC_POS_KEY);
    else localStorage.setItem(MUSIC_POS_KEY, JSON.stringify(pos));
  } catch {
    // Ignore
  }
}

function readSavedVolume() {
  try {
    return parseSavedVolume(localStorage.getItem(MUSIC_VOL_KEY), 0.72);
  } catch {
    return 0.72;
  }
}

function saveVolume(vol) {
  try {
    localStorage.setItem(MUSIC_VOL_KEY, String(vol));
  } catch {
    // Ignore
  }
}

function readSavedShuffle() {
  try {
    const raw = localStorage.getItem(MUSIC_SHUFFLE_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

function readSavedRepeat() {
  try {
    return normalizeRepeatMode(localStorage.getItem(MUSIC_REPEAT_KEY) || 'all');
  } catch {
    return 'all';
  }
}

async function fetchJsonTimeout(url, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYtMusicSearch(query, { genre = 'YT Music', isIndonesianViral = true, limit = 16 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  // 1. Primary: TeamPiped Community Open-Source YT Music `music_songs` API
  for (const host of PIPED_API_HOSTS) {
    try {
      const json = await fetchJsonTimeout(
        `${host}/search?q=${encodeURIComponent(q)}&filter=music_songs`,
        6500
      );
      const items = Array.isArray(json?.items) ? json.items : [];
      const normalized = items
        .map((item) =>
          normalizeYtMusicTrack(item, {
            genre,
            isIndonesianViral,
            sourceLabel: 'YT Music API',
          })
        )
        .filter(Boolean);
      const full = filterFullLengthTracks(normalized, MIN_FULL_TRACK_SECONDS);
      if (full.length > 0) return full.slice(0, limit);
      if (normalized.length > 0) return normalized.slice(0, limit);
    } catch {
      // Try next open-source host
    }
  }

  // 2. Failover: Siputzx Community YouTube Search API
  try {
    const json = await fetchJsonTimeout(`${SIPUTZX_YT_SEARCH_URL}?query=${encodeURIComponent(q)}`, 6500);
    const items = Array.isArray(json?.data) ? json.data : [];
    const normalized = items
      .map((item) =>
        normalizeYtMusicTrack(item, {
          genre,
          isIndonesianViral,
          sourceLabel: 'YT Community API',
        })
      )
      .filter(Boolean);
    const full = filterFullLengthTracks(normalized, MIN_FULL_TRACK_SECONDS);
    return (full.length > 0 ? full : normalized).slice(0, limit);
  } catch {
    return [];
  }
}

function ensureYouTubeIframeApi() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiLoadPromise) return ytApiLoadPromise;

  ytApiLoadPromise = new Promise((resolve) => {
    const prevReady = window.onYouTubeIframeAPIReady;
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve(window.YT?.Player ? window.YT : null);
    };

    window.onYouTubeIframeAPIReady = () => {
      try {
        if (typeof prevReady === 'function') prevReady();
      } catch {
        // Ignore existing callback error
      }
      finish();
    };

    const existing = document.querySelector('script[data-yt-iframe-api="true"]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.ytIframeApi = 'true';
      script.onerror = () => finish();
      document.head.appendChild(script);
    }

    setTimeout(() => {
      if (!resolved && window.YT?.Player) finish();
      else if (!resolved) finish();
    }, 9000);
  });

  return ytApiLoadPromise;
}

export function getMusicController() {
  return controllerSingleton || (typeof window !== 'undefined' ? window.__manifestudioMusic || null : null);
}

export function initMusicPlayer() {
  if (controllerSingleton || typeof document === 'undefined') {
    return controllerSingleton;
  }

  // Hidden audio fallback & persistent YouTube IFrame Audio Engine shell inside viewport
  const audio = new Audio();
  audio.id = 'music-audio-el';
  audio.preload = 'none';
  audio.hidden = true;
  document.body.appendChild(audio);

  const ytShell = document.createElement('div');
  ytShell.id = 'yt-music-engine-shell';
  ytShell.className = 'yt-music-engine-shell';
  ytShell.setAttribute('aria-hidden', 'true');
  const ytTarget = document.createElement('div');
  ytTarget.id = 'yt-music-iframe-target';
  ytShell.appendChild(ytTarget);
  document.body.appendChild(ytShell);

  const root = document.createElement('div');
  root.id = 'music-widget-root';
  root.className = 'music-widget-root';
  document.body.appendChild(root);

  let tracks = shuffleTracksFisherYates(SEED_VIRAL_INDO_TRACKS);
  let poolLoaded = false;
  let poolPromise = null;
  let activeCategory = 'viral-indo';
  let currentTrack = null;
  let isPlaying = false;
  let isLoading = false;
  let isOpen = false;
  let explicitPaused = false;
  let shuffleEnabled = readSavedShuffle();
  let repeatMode = readSavedRepeat();
  let volume = readSavedVolume();
  let isMuted = false;
  let customPos = readSavedPos();
  let searchQuery = '';
  let searchResults = [];
  let isSearching = false;
  let searchFeedback = '';
  let isSeeking = false;
  let suppressNextFabClick = false;
  let lastError = '';
  let consecutiveErrors = 0;
  let currentTime = 0;
  let duration = 0;
  let pendingPlayTrack = null;
  let activeEngine = 'yt-iframe';
  let requestSerial = 0;
  const recentTrackIds = [];
  const playHistory = [];
  const blockedVideoIds = new Set();
  const subscribers = new Set();

  let ytPlayer = null;
  let ytReady = false;
  let timeTicker = null;

  audio.volume = volume;

  function pushRecentId(id) {
    if (!id) return;
    const idx = recentTrackIds.indexOf(id);
    if (idx !== -1) recentTrackIds.splice(idx, 1);
    recentTrackIds.unshift(id);
    if (recentTrackIds.length > 10) recentTrackIds.length = 10;
  }

  function pushHistory(track) {
    if (!track || !track.id) return;
    if (playHistory[playHistory.length - 1]?.id !== track.id) {
      playHistory.push(track);
      if (playHistory.length > 30) playHistory.shift();
    }
  }

  function getSnapshot() {
    const activeList = searchResults.length > 0 ? searchResults : tracks;
    const queueIndex = currentTrack
      ? activeList.findIndex((t) => t.id === currentTrack.id)
      : -1;
    return {
      currentTrack,
      isPlaying,
      isLoading,
      explicitPaused,
      shuffleEnabled,
      repeatMode,
      volume,
      isMuted,
      activeCategory,
      tracks,
      searchQuery,
      searchResults,
      isSearching,
      searchFeedback,
      lastError,
      currentTime,
      duration: duration || currentTrack?.duration || 0,
      queueIndex,
      queueTotal: activeList.length,
      activeEngine,
      ytReady,
      canPrev: playHistory.length > 1 || activeList.length > 1,
    };
  }

  function notifySubscribers(kind = 'state') {
    const snap = getSnapshot();
    for (const cb of subscribers) {
      try {
        cb(snap, kind);
      } catch {
        // Ignore subscriber error
      }
    }
    try {
      window.dispatchEvent(new CustomEvent('manifestudio:music-state', { detail: { kind, state: snap } }));
    } catch {
      // Ignore event error
    }
  }

  function startTimeTicker() {
    if (timeTicker) return;
    timeTicker = setInterval(() => {
      if (!isPlaying && !isLoading) return;
      let cur = currentTime;
      let dur = duration || currentTrack?.duration || 0;

      if (activeEngine === 'audio-el') {
        cur = Number.isFinite(audio.currentTime) ? audio.currentTime : cur;
        if (Number.isFinite(audio.duration) && audio.duration > 0) dur = audio.duration;
      } else if (ytReady && ytPlayer) {
        try {
          const ytCur = ytPlayer.getCurrentTime?.();
          const ytDur = ytPlayer.getDuration?.();
          if (Number.isFinite(ytCur) && ytCur >= 0) cur = ytCur;
          if (Number.isFinite(ytDur) && ytDur > 0) dur = ytDur;
        } catch {
          // Ignore YT read error
        }
      }

      if (Math.abs(cur - currentTime) >= 0.25 || Math.abs(dur - duration) >= 1) {
        currentTime = cur;
        duration = dur;
        syncPopoverProgressDom();
        notifySubscribers('time');
      }
    }, 450);
  }

  function stopTimeTicker() {
    if (timeTicker) {
      clearInterval(timeTicker);
      timeTicker = null;
    }
  }

  function syncMediaSession(track) {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !track) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: `${track.genre || 'Viral Indonesia'} · Manifestudio YT Music`,
        artwork: [
          {
            src: track.artwork || track.artworkFallback,
            sizes: '480x360',
            type: 'image/jpeg',
          },
        ],
      });
      navigator.mediaSession.setActionHandler('play', () => controller.play());
      navigator.mediaSession.setActionHandler('pause', () => controller.pause());
      navigator.mediaSession.setActionHandler('nexttrack', () => controller.playNext({ userInitiated: true }));
      navigator.mediaSession.setActionHandler('previoustrack', () => controller.playPrev());
    } catch {
      // Ignore unsupported mediaSession handlers
    }
  }

  function initYouTubeEngine() {
    ensureYouTubeIframeApi().then((YT) => {
      if (!YT?.Player) return;
      try {
        ytPlayer = new YT.Player('yt-music-iframe-target', {
          width: '200',
          height: '200',
          videoId: currentTrack?.videoId || SEED_VIRAL_INDO_TRACKS[0]?.videoId || 'En-EHqRk8yg',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              ytReady = true;
              try {
                ytPlayer.setVolume(isMuted ? 0 : Math.round(volume * 100));
                if (isMuted) ytPlayer.mute();
                else ytPlayer.unMute();
              } catch {
                // Ignore
              }
              if (pendingPlayTrack && !explicitPaused) {
                const target = pendingPlayTrack;
                pendingPlayTrack = null;
                executePlaybackNow(target);
              }
              notifySubscribers('engine-ready');
            },
            onStateChange: (event) => {
              const state = event?.data;
              const YTState = window.YT?.PlayerState || {
                ENDED: 0,
                PLAYING: 1,
                PAUSED: 2,
                BUFFERING: 3,
                CUED: 5,
              };
              if (state === YTState.PLAYING) {
                isPlaying = true;
                isLoading = false;
                lastError = '';
                consecutiveErrors = 0;
                try {
                  const ytDur = ytPlayer.getDuration?.();
                  if (Number.isFinite(ytDur) && ytDur > 0) duration = ytDur;
                } catch {
                  // Ignore
                }
                startTimeTicker();
                renderWidget();
                notifySubscribers('play');
              } else if (state === YTState.BUFFERING) {
                isLoading = true;
                notifySubscribers('loading');
              } else if (state === YTState.PAUSED) {
                if (!isLoading) {
                  isPlaying = false;
                  stopTimeTicker();
                  renderWidget();
                  notifySubscribers('pause');
                }
              } else if (state === YTState.ENDED) {
                isPlaying = false;
                isLoading = false;
                stopTimeTicker();
                if (repeatMode === 'one' && currentTrack) {
                  executePlaybackNow(currentTrack);
                } else if (repeatMode === 'off' && !shuffleEnabled) {
                  renderWidget();
                  notifySubscribers('ended');
                } else {
                  controller.playNext({ reason: 'ended' });
                }
              }
            },
            onError: () => {
              const failedId = currentTrack?.videoId;
              if (failedId) {
                blockedVideoIds.add(failedId);
                tracks = tracks.filter((t) => t.videoId !== failedId);
              }
              isPlaying = false;
              isLoading = false;
              consecutiveErrors += 1;
              if (!explicitPaused && consecutiveErrors <= 5 && tracks.length > 0) {
                lastError = 'Mengganti ke lagu YT Music lain yang tersedia...';
                controller.playNext({ reason: 'error-skip' });
              } else {
                lastError = 'Pemutar YT Music sedang menunggu koneksi atau memilih lagu lain.';
                renderWidget();
                notifySubscribers('error');
              }
            },
          },
        });
      } catch {
        ytReady = false;
      }
    });
  }

  function executePlaybackNow(track) {
    if (!track) return;
    currentTrack = track;
    currentTime = 0;
    duration = Number(track.duration || 0);
    lastError = '';
    pushRecentId(track.id);
    pushHistory(track);
    syncMediaSession(track);

    if (track.streamUrl && !track.videoId) {
      activeEngine = 'audio-el';
      try {
        if (ytReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
      } catch {
        // Ignore
      }
      if (audio.src !== track.streamUrl) {
        audio.src = track.streamUrl;
      }
      audio.muted = isMuted;
      audio.volume = volume;
      isLoading = true;
      renderWidget();
      notifySubscribers('loading');
      audio
        .play()
        .then(() => {
          isPlaying = true;
          isLoading = false;
          consecutiveErrors = 0;
          startTimeTicker();
          renderWidget();
          notifySubscribers('play');
        })
        .catch(() => {
          isPlaying = false;
          isLoading = false;
          renderWidget();
          notifySubscribers('error');
        });
      return;
    }

    // YT Music VideoId playback via YouTube IFrame Player API
    activeEngine = 'yt-iframe';
    if (!audio.paused) audio.pause();
    if (!track.videoId) return;

    if (ytReady && ytPlayer?.loadVideoById) {
      pendingPlayTrack = null;
      isLoading = true;
      renderWidget();
      notifySubscribers('loading');
      try {
        if (isMuted) ytPlayer.mute?.();
        else ytPlayer.unMute?.();
        ytPlayer.setVolume?.(Math.round(volume * 100));
        ytPlayer.loadVideoById({ videoId: track.videoId, startSeconds: 0 });
        startTimeTicker();
      } catch {
        isLoading = false;
        renderWidget();
        notifySubscribers('error');
      }
    } else {
      pendingPlayTrack = track;
      isLoading = true;
      renderWidget();
      notifySubscribers('loading');
    }
  }

  async function ensureTrackPool() {
    if (poolPromise) return poolPromise;
    poolPromise = (async () => {
      try {
        const preset = MUSIC_PRESET_CATEGORIES[0];
        const jobs = preset.queries.map((q) =>
          fetchYtMusicSearch(q, { genre: 'Viral Indonesia', isIndonesianViral: true, limit: 12 }).catch(
            () => []
          )
        );
        const settled = await Promise.all(jobs);
        const merged = new Map(SEED_VIRAL_INDO_TRACKS.map((t) => [t.videoId, t]));
        for (const group of settled) {
          for (const item of group) {
            if (item?.videoId && !blockedVideoIds.has(item.videoId) && !merged.has(item.videoId)) {
              merged.set(item.videoId, item);
            }
          }
        }
        tracks = shuffleTracksFisherYates([...merged.values()]);
        poolLoaded = true;
        notifySubscribers('pool');
      } catch {
        poolLoaded = true;
      }
      return tracks;
    })();
    return poolPromise;
  }

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

  function syncPopoverProgressDom() {
    if (!isOpen || isSeeking) return;
    const slider = root.querySelector('#music-seek-slider');
    const timeEl = root.querySelector('#music-time-label');
    const dur = duration || currentTrack?.duration || 180;
    const cur = Math.min(dur, Math.max(0, currentTime || 0));
    if (slider && dur > 0) {
      slider.value = String(Math.min(100, (cur / dur) * 100));
    }
    if (timeEl) {
      timeEl.textContent = `${formatAudioTime(cur)} / ${formatAudioTime(dur)}`;
    }
  }

  function renderWidget() {
    applyRootPosition();

    const active = currentTrack || tracks[0] || SEED_VIRAL_INDO_TRACKS[0];
    const durSec = duration || active?.duration || 180;
    const curSec = Math.min(durSec, Math.max(0, currentTime || 0));
    const pct = durSec > 0 ? Math.min(100, Math.round((curSec / durSec) * 100)) : 0;
    const isOnMusicTab =
      typeof window !== 'undefined' &&
      window.location.pathname.endsWith('tools.html') &&
      new URLSearchParams(window.location.search).get('tab') === 'music';

    const playIcon = isLoading
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="M4.9 19.1 7.8 16.2"/><path d="M2 12h4"/></svg>`
      : isPlaying
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6,4 20,12 6,20"/></svg>`;

    const muteIcon =
      isMuted || volume === 0
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

    root.innerHTML = `
      <div
        id="music-popover"
        class="music-popover music-popover-modern"
        role="dialog"
        aria-label="Pemutar Musik YT Music Minimalis"
        ${isOpen ? '' : 'hidden'}
      >
        <div class="music-pop-head">
          <div class="music-pop-track">
            <div class="music-art-wrap ${isPlaying ? 'is-spinning' : ''}">
              ${
                active?.artwork
                  ? `<img src="${escapeHtml(active.artwork)}" alt="" width="42" height="42" class="music-art-img" onerror="this.src='${escapeHtml(active.artworkFallback || '')}'" />`
                  : `<span class="music-art-fallback" aria-hidden="true">♪</span>`
              }
            </div>
            <div class="music-meta">
              <strong class="music-title" id="music-now-title">${escapeHtml(currentTrack ? currentTrack.title : active?.title || 'YT Music Viral Indonesia')}</strong>
              <span class="music-artist" id="music-now-artist">${escapeHtml(currentTrack ? `${currentTrack.artist} · ${currentTrack.genre}` : 'Putar acak otomatis · Viral Indo')}</span>
            </div>
          </div>
          <div class="music-head-btns">
            ${
              customPos
                ? `<button type="button" class="music-icon-mini-btn" id="music-reset-pos-btn" data-music-control="true" title="Reset posisi ikon" aria-label="Reset posisi ikon musik"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>`
                : ''
            }
            <button
              type="button"
              class="music-icon-mini-btn"
              id="music-close-btn"
              data-music-control="true"
              aria-label="Tutup panel musik"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        <div class="music-status-mini-row">
          <span class="music-source-tag">${isPlaying ? 'YT Music · Live' : 'YT Music · Siap Acak'}</span>
          <span class="music-time mono-num" id="music-time-label">${formatAudioTime(curSec)} / ${formatAudioTime(durSec)}</span>
        </div>

        <div class="music-progress-row">
          <input
            type="range"
            id="music-seek-slider"
            class="music-seek-slider"
            data-music-control="true"
            min="0"
            max="100"
            step="0.5"
            value="${pct}"
            aria-label="Geser progres lagu"
          />
        </div>

        <div class="music-modern-controls">
          <button
            type="button"
            class="music-ctrl-icon-btn"
            id="music-prev-btn"
            data-music-control="true"
            aria-label="Lagu sebelumnya"
            title="Sebelumnya"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/></svg>
          </button>

          <button
            type="button"
            class="music-ctrl-primary-btn ${isPlaying ? 'is-playing' : ''}"
            id="music-playpause-btn"
            data-music-control="true"
            aria-label="${isPlaying ? 'Jeda musik' : 'Putar musik'}"
          >
            ${playIcon}
            <span>${isLoading ? 'Memuat...' : isPlaying ? 'Jeda' : 'Putar Acak'}</span>
          </button>

          <button
            type="button"
            class="music-ctrl-icon-btn"
            id="music-next-btn"
            data-music-control="true"
            aria-label="Putar lagu viral acak berikutnya"
            title="Lagu Acak Berikutnya"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
          </button>

          <button
            type="button"
            class="music-ctrl-icon-btn ${isMuted ? 'is-muted' : ''}"
            id="music-mute-btn"
            data-music-control="true"
            aria-label="${isMuted ? 'Nyalakan suara' : 'Bisukan suara'}"
            title="${isMuted ? 'Unmute' : 'Mute'}"
          >
            ${muteIcon}
          </button>
        </div>

        <form id="music-search-form" class="music-search-row">
          <input
            type="search"
            id="music-search-input"
            class="music-search-input"
            placeholder="Cari di YT Music..."
            value="${escapeHtml(searchQuery)}"
            aria-label="Cari lagu YT Music"
          />
          <button type="submit" class="music-search-submit-btn" data-music-control="true" aria-label="Cari lagu">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </button>
        </form>

        ${
          searchFeedback
            ? `<div class="music-search-note" role="status">${escapeHtml(searchFeedback)}</div>`
            : ''
        }

        ${
          searchResults.length > 0
            ? `<div class="music-search-results" role="listbox" aria-label="Hasil pencarian YT Music">
                ${searchResults
                  .slice(0, 4)
                  .map(
                    (t) => `
                  <button
                    type="button"
                    class="music-search-hit ${currentTrack?.id === t.id ? 'is-active' : ''}"
                    data-music-pick-id="${escapeHtml(t.id)}"
                    data-music-control="true"
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

        <div class="music-pop-footer">
          ${
            isOnMusicTab
              ? `<span class="music-drag-tip">Tampilan lengkap aktif di Menu Utilitas · Geser ikon untuk pindah</span>`
              : `<a href="./tools.html?tab=music" class="music-open-hub-link" data-music-control="true">
                  <span>Buka Player Lengkap di Utilitas</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </a>`
          }
        </div>
      </div>

      <button
        type="button"
        id="music-fab-btn"
        data-music-control="true"
        class="music-fab-btn ${isPlaying ? 'is-playing' : ''}"
        aria-label="${isOpen ? 'Tutup pemutar musik minimalis' : 'Buka pemutar musik minimalis (bisa digeser)'}"
        aria-expanded="${isOpen}"
        title="YT Music Player · Ketuk untuk buka atau tekan & geser"
      >
        <span class="music-fab-eq" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
        <svg class="music-fab-note" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </button>
    `;

    bindWidgetEvents();
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
      // If user clicks Music FAB and playback hasn't started yet & not explicitly paused, trigger viral shuffle immediately
      if (isOpen && !isPlaying && !isLoading && !explicitPaused && !currentTrack) {
        controller.playNext({ reason: 'fab-open' });
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
      controller.togglePlayPause();
    });

    root.querySelector('#music-next-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.playNext({ userInitiated: true });
    });

    root.querySelector('#music-prev-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.playPrev();
    });

    root.querySelector('#music-mute-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.toggleMute();
    });

    const slider = root.querySelector('#music-seek-slider');
    slider?.addEventListener('input', () => {
      isSeeking = true;
      const dur = duration || currentTrack?.duration || 180;
      const targetSec = (Number(slider.value) / 100) * dur;
      const timeEl = root.querySelector('#music-time-label');
      if (timeEl) {
        timeEl.textContent = `${formatAudioTime(targetSec)} / ${formatAudioTime(dur)}`;
      }
    });
    slider?.addEventListener('change', () => {
      controller.seekToPercent(Number(slider.value));
      isSeeking = false;
    });

    const searchInput = root.querySelector('#music-search-input');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
    });

    root.querySelector('#music-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      controller.search(searchInput?.value || '', { autoPlayFirst: true });
    });

    root.querySelectorAll('[data-music-pick-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pickId = btn.getAttribute('data-music-pick-id');
        controller.playTrackById(pickId);
      });
    });
  }

  const controller = {
    getState: getSnapshot,

    subscribe(cb) {
      if (typeof cb !== 'function') return () => {};
      subscribers.add(cb);
      cb(getSnapshot(), 'init');
      return () => subscribers.delete(cb);
    },

    playTrack(track) {
      if (!track) return;
      explicitPaused = false;
      requestSerial += 1;
      executePlaybackNow(track);
    },

    playTrackById(trackId) {
      const target =
        searchResults.find((t) => t.id === trackId || t.videoId === trackId) ||
        tracks.find((t) => t.id === trackId || t.videoId === trackId);
      if (target) {
        this.playTrack(target);
      }
    },

    play() {
      explicitPaused = false;
      if (!currentTrack) {
        this.playNext({ userInitiated: true });
        return;
      }
      if (activeEngine === 'audio-el') {
        audio
          .play()
          .then(() => {
            isPlaying = true;
            startTimeTicker();
            renderWidget();
            notifySubscribers('play');
          })
          .catch(() => this.playTrack(currentTrack));
      } else if (ytReady && ytPlayer?.playVideo) {
        try {
          if (isMuted) ytPlayer.mute?.();
          else ytPlayer.unMute?.();
          ytPlayer.setVolume?.(Math.round(volume * 100));
          ytPlayer.playVideo();
          isPlaying = true;
          startTimeTicker();
          renderWidget();
          notifySubscribers('play');
        } catch {
          this.playTrack(currentTrack);
        }
      } else {
        this.playTrack(currentTrack);
      }
    },

    pause({ external = false } = {}) {
      explicitPaused = true;
      pendingPlayTrack = null;
      if (!audio.paused) audio.pause();
      if (ytReady && ytPlayer?.pauseVideo) {
        try {
          ytPlayer.pauseVideo();
        } catch {
          // Ignore
        }
      }
      isPlaying = false;
      isLoading = false;
      stopTimeTicker();
      if (external) {
        lastError = '';
      }
      renderWidget();
      notifySubscribers('pause');
    },

    togglePlayPause() {
      if (isPlaying) this.pause();
      else this.play();
    },

    playNext({ userInitiated = false, reason = 'next' } = {}) {
      explicitPaused = false;
      if (userInitiated || reason === 'any-button-click' || reason === 'fab-open') {
        consecutiveErrors = 0;
      }
      const activePool = searchResults.length > 0 && reason === 'ended' && !shuffleEnabled ? searchResults : tracks;

      if (!poolLoaded && !poolPromise) {
        ensureTrackPool();
      }

      let nextTrack = null;
      if (shuffleEnabled || reason === 'any-button-click' || reason === 'fab-open' || activePool === tracks) {
        nextTrack = pickShuffledViralTrack(tracks.length > 0 ? tracks : SEED_VIRAL_INDO_TRACKS, {
          currentTrackId: currentTrack?.id || null,
          recentTrackIds,
          prioritizeIndonesianViral: true,
          blockedVideoIds,
          minSeconds: MIN_FULL_TRACK_SECONDS,
        });
      } else if (activePool.length > 0) {
        const idx = currentTrack ? activePool.findIndex((t) => t.id === currentTrack.id) : -1;
        nextTrack = activePool[(idx + 1) % activePool.length] || activePool[0];
      }

      if (nextTrack) {
        this.playTrack(nextTrack);
      } else if (userInitiated && tracks.length > 0) {
        this.playTrack(tracks[0]);
      }
    },

    playPrev() {
      explicitPaused = false;
      if (currentTime > 5) {
        this.seekToSeconds(0);
        return;
      }
      if (playHistory.length > 1) {
        playHistory.pop(); // Remove current
        const prevTrack = playHistory[playHistory.length - 1];
        if (prevTrack) {
          this.playTrack(prevTrack);
          return;
        }
      }
      this.playNext({ userInitiated: true });
    },

    seekToPercent(percent) {
      const pct = Math.max(0, Math.min(100, Number(percent) || 0));
      const dur = duration || currentTrack?.duration || 180;
      const targetSec = (pct / 100) * dur;
      this.seekToSeconds(targetSec);
    },

    seekToSeconds(sec) {
      const dur = duration || currentTrack?.duration || 180;
      const targetSec = Math.max(0, Math.min(dur, Number(sec) || 0));
      currentTime = targetSec;
      if (activeEngine === 'audio-el') {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime = targetSec;
        }
      } else if (ytReady && ytPlayer?.seekTo) {
        try {
          ytPlayer.seekTo(targetSec, true);
        } catch {
          // Ignore seek error
        }
      }
      syncPopoverProgressDom();
      notifySubscribers('seek');
    },

    setVolume(val) {
      const next = Math.max(0, Math.min(1, Number(val)));
      if (!Number.isFinite(next)) return;
      volume = next;
      isMuted = next === 0;
      saveVolume(volume);
      audio.volume = volume;
      audio.muted = isMuted;
      if (ytReady && ytPlayer) {
        try {
          ytPlayer.setVolume?.(Math.round(volume * 100));
          if (isMuted) ytPlayer.mute?.();
          else ytPlayer.unMute?.();
        } catch {
          // Ignore
        }
      }
      renderWidget();
      notifySubscribers('volume');
    },

    toggleMute() {
      isMuted = !isMuted;
      audio.muted = isMuted;
      if (ytReady && ytPlayer) {
        try {
          if (isMuted) ytPlayer.mute?.();
          else {
            ytPlayer.unMute?.();
            ytPlayer.setVolume?.(Math.round(volume * 100));
          }
        } catch {
          // Ignore
        }
      }
      renderWidget();
      notifySubscribers('volume');
    },

    toggleShuffle() {
      shuffleEnabled = !shuffleEnabled;
      try {
        localStorage.setItem(MUSIC_SHUFFLE_KEY, String(shuffleEnabled));
      } catch {
        // Ignore
      }
      notifySubscribers('mode');
    },

    cycleRepeatMode() {
      const order = ['all', 'one', 'off'];
      const idx = order.indexOf(repeatMode);
      repeatMode = order[(idx + 1) % order.length];
      try {
        localStorage.setItem(MUSIC_REPEAT_KEY, repeatMode);
      } catch {
        // Ignore
      }
      notifySubscribers('mode');
    },

    async loadPresetPlaylist(presetId) {
      const preset = MUSIC_PRESET_CATEGORIES.find((p) => p.id === presetId) || MUSIC_PRESET_CATEGORIES[0];
      activeCategory = preset.id;
      isSearching = true;
      searchQuery = '';
      searchResults = [];
      searchFeedback = '';
      notifySubscribers('search');

      try {
        const jobs = preset.queries.map((q) =>
          fetchYtMusicSearch(q, {
            genre: preset.label,
            isIndonesianViral: true,
            limit: 12,
          }).catch(() => [])
        );
        const settled = await Promise.all(jobs);
        const merged = new Map();
        for (const group of settled) {
          for (const t of group) {
            if (t?.videoId && !blockedVideoIds.has(t.videoId) && !merged.has(t.videoId)) {
              merged.set(t.videoId, t);
            }
          }
        }
        // Keep seeded matching tracks as well if preset is general viral-indo
        if (preset.id === 'viral-indo') {
          for (const seed of SEED_VIRAL_INDO_TRACKS) {
            if (!merged.has(seed.videoId)) merged.set(seed.videoId, seed);
          }
        }
        const combined = [...merged.values()];
        if (combined.length > 0) {
          tracks = shuffleTracksFisherYates(combined);
        }
      } catch {
        // Keep existing pool on transient failure
      }
      isSearching = false;
      renderWidget();
      notifySubscribers('pool');
    },

    async search(term, { autoPlayFirst = false } = {}) {
      const q = String(term || '').trim();
      searchQuery = q;
      if (!q) {
        this.clearSearch();
        return;
      }

      const mySerial = ++requestSerial;
      isSearching = true;
      searchFeedback = '';
      renderWidget();
      notifySubscribers('search');

      try {
        const directId = extractYouTubeVideoId(q);
        let fetched = [];
        if (directId) {
          const oe = await fetchJsonTimeout(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${directId}`)}&format=json`,
            5000
          ).catch(() => null);
          const directTrack = normalizeYtMusicTrack({
            videoId: directId,
            title: oe?.title || `Lagu YT (${directId})`,
            artist: oe?.author_name || 'YT Music',
            duration: 180,
            genre: 'YT Music',
            isIndonesianViral: true,
          });
          if (directTrack) fetched = [directTrack];
        } else {
          fetched = await fetchYtMusicSearch(q, {
            genre: 'Pencarian YT Music',
            isIndonesianViral: /indo|viral|dj|koplo|galau|remix|bernadya|hindia|tulus|mahalini|tenxi|nd[x]*/i.test(q),
            limit: 18,
          });
        }

        if (mySerial !== requestSerial) return;

        // Combine live API results with local pool matches ranked cleanly
        const poolMatches = rankSearchResults([...tracks, ...SEED_VIRAL_INDO_TRACKS], q, 45);
        const byId = new Map();
        for (const r of [...fetched, ...poolMatches]) {
          if (r?.videoId && !blockedVideoIds.has(r.videoId) && !byId.has(r.videoId)) {
            byId.set(r.videoId, r);
          }
        }
        const finalResults = [...byId.values()];
        searchResults = finalResults;

        if (finalResults.length > 0) {
          // Merge into tracks so next/shuffle can access them while prioritizing Viral Indo
          const allMap = new Map(tracks.map((t) => [t.videoId, t]));
          for (const item of finalResults) {
            if (!allMap.has(item.videoId)) allMap.set(item.videoId, item);
          }
          tracks = [...allMap.values()];
          searchFeedback = '';
          if (autoPlayFirst) {
            this.playTrack(finalResults[0]);
          }
        } else {
          searchFeedback = `Tidak ditemukan lagu di YT Music untuk "${q}". Coba kata kunci lain.`;
        }
      } catch {
        searchFeedback = 'Gagal menghubungi YT Music API. Periksa koneksi internet lalu coba lagi.';
      }

      isSearching = false;
      renderWidget();
      notifySubscribers('search');
    },

    clearSearch() {
      searchQuery = '';
      searchResults = [];
      searchFeedback = '';
      isSearching = false;
      renderWidget();
      notifySubscribers('search');
    },
  };

  controllerSingleton = controller;
  if (typeof window !== 'undefined') {
    window.__manifestudioMusic = controller;
  }

  // Audio element fallback lifecycle listeners
  audio.addEventListener('play', () => {
    if (activeEngine !== 'audio-el') return;
    isPlaying = true;
    isLoading = false;
    startTimeTicker();
    renderWidget();
    notifySubscribers('play');
  });
  audio.addEventListener('pause', () => {
    if (activeEngine !== 'audio-el') return;
    isPlaying = false;
    stopTimeTicker();
    renderWidget();
    notifySubscribers('pause');
  });
  audio.addEventListener('ended', () => {
    if (activeEngine !== 'audio-el') return;
    controller.playNext({ reason: 'ended' });
  });
  audio.addEventListener('error', () => {
    if (activeEngine !== 'audio-el' || explicitPaused) return;
    controller.playNext({ reason: 'error-skip' });
  });

  // Pause site music whenever external <video>/<audio> (e.g. Downloader video/audio preview) plays
  document.addEventListener(
    'play',
    (e) => {
      const target = e.target;
      if (target === audio) return;
      if (target instanceof HTMLMediaElement && !root.contains(target)) {
        controller.pause({ external: true });
      }
    },
    true
  );

  window.addEventListener('manifestudio:external-media-play', () => {
    controller.pause({ external: true });
  });

  /**
   * Capture-phase global click handler:
   * Automatically starts shuffled Viral Indonesian playback when the user presses ANY
   * interactive button/control across the entire website without exception
   * (skipping only direct player controls which manage themselves, and yielding
   * only when an external Downloader video/audio preview is actively playing).
   */
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (root.contains(target) || target.closest('[data-music-control], .music-hub-panel')) {
        return;
      }
      if (target.closest('video, audio')) return;

      const interactive = target.closest(
        'button, a, [role="button"], [role="tab"], input[type="button"], input[type="submit"], input[type="reset"], summary, label, .product-tile, [data-slide-dot], [data-tools-nav]'
      );
      if (!interactive) return;
      if (explicitPaused) return;

      const externalMediaPlaying = Array.from(document.querySelectorAll('video, audio')).some(
        (el) => el !== audio && !el.paused && !el.ended
      );
      if (externalMediaPlaying) return;

      if (!isPlaying && !isLoading) {
        controller.playNext({ reason: 'any-button-click' });
      }
    },
    true
  );

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
  renderWidget();
  initYouTubeEngine();
  ensureTrackPool();

  return controller;
}
