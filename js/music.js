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
  MUSIC_LIBRARY_STORAGE_KEY,
  addTrackToPlaylist,
  clampMusicFabPosition,
  createUserPlaylist,
  deleteUserPlaylist,
  extractYouTubeVideoId,
  filterFullLengthTracks,
  formatAudioTime,
  getPopoverAnchorClasses,
  isStrictAudioMatch,
  isTrackInWatchLater,
  normalizeMusicLibraryState,
  normalizeRepeatMode,
  normalizeYtMusicTrack,
  parseSavedVolume,
  pickShuffledViralTrack,
  rankSearchResults,
  removeTrackFromPlaylist,
  renameUserPlaylist,
  scoreSearchRelevance,
  shuffleTracksFisherYates,
  toggleTrackInWatchLater,
} from './music-logic.js?v=29';

const MUSIC_POS_KEY = 'manifestudio_music_pos_v2';
const MUSIC_VOL_KEY = 'manifestudio_music_vol_v2';
const MUSIC_SHUFFLE_KEY = 'manifestudio_music_shuffle_v2';
const MUSIC_REPEAT_KEY = 'manifestudio_music_repeat_v2';
const MUSIC_SESSION_KEY = 'manifestudio_music_session_v1';
const MUSIC_CLICK_PLAY_KEY = 'manifestudio_music_clickplay_v1';

// Community open-source YT Music / YouTube search API endpoints + Audius direct stream API (CORS *)
const PIPED_API_HOSTS = [
  'https://api.piped.private.coffee',
  'https://pipedapi.ducks.party',
];
const SIPUTZX_YT_SEARCH_URL = 'https://api.siputzx.my.id/api/s/youtube';
const AUDIUS_API_BASE = 'https://api.audius.co/v1';
const TIOO_AUDIO_BACKENDS = [
  'https://backend3.tioo.eu.org',
  'https://backend4.tioo.eu.org',
  'https://backend1.tioo.eu.org',
  'https://backend2.tioo.eu.org',
];
const ytExactStreamCache = new Map();
const ytExactInFlight = new Map();
const failedExactVideoIds = new Set();
const failedStreamUrls = new Set();
const failedYtIframeVideoIds = new Set();

const MUSIC_NODE_COOLDOWN_MS = 180000;
const musicNodeCircuit = new Map();

function isMusicNodeOpen(url) {
  try {
    const origin = new URL(url).origin;
    const entry = musicNodeCircuit.get(origin);
    if (!entry) return false;
    if (entry.failures >= 2 && Date.now() - entry.lastFailedAt < MUSIC_NODE_COOLDOWN_MS) {
      return true;
    }
    if (Date.now() - entry.lastFailedAt >= MUSIC_NODE_COOLDOWN_MS) {
      musicNodeCircuit.delete(origin);
    }
  } catch {
    // Ignore
  }
  return false;
}

function recordMusicNodeResult(url, ok) {
  try {
    const origin = new URL(url).origin;
    if (ok) {
      musicNodeCircuit.delete(origin);
      return;
    }
    const prev = musicNodeCircuit.get(origin) || { failures: 0, lastFailedAt: 0 };
    musicNodeCircuit.set(origin, {
      failures: prev.failures + 1,
      lastFailedAt: Date.now(),
    });
  } catch {
    // Ignore
  }
}

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

// Pre-seeded real Viral Indonesia catalog: ONLY 100%-verified matching audio streams
// (or exact YouTube videoIds without cross-track stream mixing) so title ALWAYS matches the audio!
const SEED_VIRAL_INDO_TRACKS = [
  normalizeYtMusicTrack({
    videoId: 'En-EHqRk8yg',
    title: 'Garam & Madu (Sakit Dadaku)',
    artist: 'Tenxi, Naykilla & Jemsii',
    duration: 251,
    genre: 'Viral Indonesia',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/Nlzyaxp/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    id: 'aud-7O8YZgj',
    title: 'Mangu',
    artist: 'Fourtwnty',
    duration: 262,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/7O8YZgj/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'sc5w6h6fI7w',
    title: 'Stecu Stecu',
    artist: 'Faris Adam',
    duration: 229,
    genre: 'Viral Indonesia',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'Zq1Jg0H5fzc',
    title: 'Betty (feat. White Chorus)',
    artist: 'Hindia',
    duration: 265,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/MoPA5xm/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: '2r7UutFm7qc',
    title: 'Sisa Rasa',
    artist: 'Mahalini',
    duration: 328,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/6xM2m/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'E7kHvjvU6JY',
    title: 'Tukar Jiwa',
    artist: 'Tulus',
    duration: 230,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/bl5QX/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    id: 'aud-Oxg4V',
    title: 'Hati-Hati di Jalan',
    artist: 'Tulus',
    duration: 242,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/Oxg4V/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'tMLV3IWfOMs',
    title: 'Wegah Pisah (Hiphop Dangdut)',
    artist: 'NDX A.K.A.',
    duration: 346,
    genre: 'Koplo & Dangdut',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/dWGyv/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'J1HR1_uG6VU',
    title: 'Jump (Whisnu Santika & Adnan Veron Edit)',
    artist: 'Whisnu Santika & Adnan Veron',
    duration: 156,
    genre: 'DJ Remix TikTok',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/7YM4OJ7/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'Z3E3AamV2to',
    title: 'Widodari (feat. Guyon Waton)',
    artist: 'Denny Caknan',
    duration: 296,
    genre: 'Koplo & Dangdut',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/8YdyW/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'BoESHbOq_s8',
    title: 'Rumah Singgah',
    artist: 'Fabio Asher',
    duration: 245,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/aZ5g38A/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'g6iIVyRfiUk',
    title: 'To The Bone',
    artist: 'Pamungkas',
    duration: 318,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/82Nw9/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'X9EDqDWza3M',
    title: 'Feel Koplo Edit — Awas Dangdut Viral',
    artist: 'Feel Koplo',
    duration: 206,
    genre: 'DJ Remix TikTok',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/aPgMr/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'ljSczANvbV8',
    title: 'Dulu — Lagu Viral Indonesia',
    artist: 'Danar Widianto',
    duration: 215,
    genre: 'Viral Indonesia',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/ZRrjQ/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    id: 'aud-mWgk2',
    title: 'Melawan Restu',
    artist: 'Mahalini',
    duration: 260,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/mWgk2/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    id: 'aud-KxAdo',
    title: 'Secukupnya',
    artist: 'Hindia',
    duration: 263,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/KxAdo/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    id: 'aud-52rE1',
    title: 'Serana',
    artist: 'For Revenge',
    duration: 243,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/52rE1/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    id: 'aud-Byxgj',
    title: 'Evakuasi',
    artist: 'Hindia',
    duration: 218,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/Byxgj/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    id: 'aud-82Yvv',
    title: 'Monokrom',
    artist: 'Tulus',
    duration: 208,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Background Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/82Yvv/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'hc-8aB0Dkkw',
    title: 'Untungnya, Hidup Harus Tetap Berjalan',
    artist: 'Bernadya',
    duration: 200,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: '-07Xbws-LB4',
    title: 'Komang',
    artist: 'Raim Laode',
    duration: 263,
    genre: 'Indie Viral Indo',
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
    videoId: '9YPX7WjPDp8',
    title: 'Pesan Terakhir',
    artist: 'Lyodra',
    duration: 257,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music API',
  }),
  normalizeYtMusicTrack({
    videoId: 'lABZ_-uhC0E',
    title: 'Merasa Indah',
    artist: 'Tiara Andini',
    duration: 228,
    genre: 'Pop Viral Indo',
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

function readSavedAutoClickPlay() {
  try {
    const raw = localStorage.getItem(MUSIC_CLICK_PLAY_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

function saveAutoClickPlay(enabled) {
  try {
    localStorage.setItem(MUSIC_CLICK_PLAY_KEY, String(Boolean(enabled)));
  } catch {
    // Ignore
  }
}

function readSavedMusicLibrary() {
  try {
    const raw = localStorage.getItem(MUSIC_LIBRARY_STORAGE_KEY);
    if (!raw) return normalizeMusicLibraryState();
    return normalizeMusicLibraryState(JSON.parse(raw));
  } catch {
    return normalizeMusicLibraryState();
  }
}

function saveMusicLibrary(library) {
  const clean = normalizeMusicLibraryState(library);
  try {
    localStorage.setItem(MUSIC_LIBRARY_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Ignore storage quota error
  }
  return clean;
}

function readMusicSession() {
  const sources = [];
  try {
    sources.push(sessionStorage.getItem(MUSIC_SESSION_KEY));
  } catch {
    // Ignore
  }
  try {
    sources.push(localStorage.getItem(MUSIC_SESSION_KEY));
  } catch {
    // Ignore
  }
  for (const raw of sources) {
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          explicitPaused: Boolean(parsed.explicitPaused),
          wasPlaying: Boolean(parsed.wasPlaying),
          lastTrackId: String(parsed.lastTrackId || ''),
          currentTime: Math.max(0, Number(parsed.currentTime) || 0),
          updatedAt: Number(parsed.updatedAt) || 0,
        };
      }
    } catch {
      // Ignore malformed JSON
    }
  }
  return {
    explicitPaused: false,
    wasPlaying: false,
    lastTrackId: '',
    currentTime: 0,
    updatedAt: 0,
  };
}

function saveMusicSession(partial = {}) {
  const prev = readMusicSession();
  const next = {
    ...prev,
    ...partial,
    updatedAt: Date.now(),
  };
  const payload = JSON.stringify(next);
  try {
    sessionStorage.setItem(MUSIC_SESSION_KEY, payload);
  } catch {
    // Ignore
  }
  try {
    localStorage.setItem(MUSIC_SESSION_KEY, payload);
  } catch {
    // Ignore
  }
}

async function fetchJsonTimeout(url, timeoutMs = 5500) {
  if (isMusicNodeOpen(url)) {
    throw new Error('Music API node in cooldown');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) {
      if (res.status >= 500 || res.status === 429 || res.status === 403) {
        recordMusicNodeResult(url, false);
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    recordMusicNodeResult(url, true);
    return data;
  } catch (err) {
    if (err?.name === 'AbortError' || /failed to fetch|network/i.test(String(err?.message || ''))) {
      recordMusicNodeResult(url, false);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAudiusDirectTracks(query, { genre = 'Viral Indonesia', isIndonesianViral = true, limit = 12 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  try {
    const json = await fetchJsonTimeout(
      `${AUDIUS_API_BASE}/tracks/search?query=${encodeURIComponent(q)}&app_name=Manifestudio`,
      5500
    );
    const items = Array.isArray(json?.data) ? json.data : [];
    const normalized = items
      .map((item) => {
        if (!item?.id || !item?.title) return null;
        if (item.is_streamable === false || item.access?.stream === false) return null;
        const dur = Number(item.duration || 0);
        if (dur < MIN_FULL_TRACK_SECONDS || dur > 660) return null;
        return normalizeYtMusicTrack(
          {
            id: `aud-${item.id}`,
            title: item.title,
            artist: item.user?.name || item.user?.handle || 'Artis Indonesia',
            duration: dur,
            artwork: item.artwork?.['480x480'] || item.artwork?.['150x150'] || '',
            streamUrl: `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(item.id)}/stream?app_name=Manifestudio`,
            genre,
            isIndonesianViral,
            sourceLabel: 'YT Music · Background Audio',
          },
          { genre, isIndonesianViral, sourceLabel: 'YT Music · Background Audio' }
        );
      })
      .filter(Boolean);
    return filterFullLengthTracks(normalized, MIN_FULL_TRACK_SECONDS).slice(0, limit);
  } catch {
    return [];
  }
}

async function resolveExactYoutubeAudioStream(videoId) {
  const cleanId = extractYouTubeVideoId(videoId);
  if (!cleanId || failedExactVideoIds.has(cleanId)) return '';
  if (ytExactStreamCache.has(cleanId)) {
    const cached = ytExactStreamCache.get(cleanId) || '';
    if (cached && !failedStreamUrls.has(cached)) {
      return cached;
    }
    ytExactStreamCache.delete(cleanId);
  }
  if (ytExactInFlight.has(cleanId)) {
    return ytExactInFlight.get(cleanId);
  }
  const ytUrl = `https://www.youtube.com/watch?v=${cleanId}`;
  const encoded = encodeURIComponent(ytUrl);

  const job = (async () => {
    try {
      const winner = await Promise.any(
        TIOO_AUDIO_BACKENDS.map(async (host) => {
          const data = await fetchJsonTimeout(`${host}/youtube?url=${encoded}`, 10500);
          const candidate = String(data?.mp3 || data?.mp4 || '').trim();
          if (!/^https?:\/\//i.test(candidate)) {
            throw new Error('No audio URL');
          }
          if (/savetube\.vip|ytshortdown\.com|sf-converter\.com/i.test(candidate)) {
            throw new Error('Blocked redirect');
          }
          if (failedStreamUrls.has(candidate)) {
            throw new Error('Stream previously failed');
          }
          return candidate;
        })
      );
      if (winner && !failedStreamUrls.has(winner) && !failedExactVideoIds.has(cleanId)) {
        ytExactStreamCache.set(cleanId, winner);
        return winner;
      }
    } catch {
      // All Tioo mirrors failed or timed out for this videoId
    } finally {
      ytExactInFlight.delete(cleanId);
    }
    return '';
  })();

  ytExactInFlight.set(cleanId, job);
  return job;
}

async function resolveBackgroundStreamForTrack(track) {
  if (!track) return '';
  if (track.streamUrl) {
    if (!failedStreamUrls.has(track.streamUrl)) {
      return track.streamUrl;
    }
    track.streamUrl = '';
  }

  const seedMatch = SEED_VIRAL_INDO_TRACKS.find(
    (s) =>
      s.streamUrl &&
      !failedStreamUrls.has(s.streamUrl) &&
      ((track.videoId && s.videoId === track.videoId) || isStrictAudioMatch(track, s))
  );
  if (seedMatch?.streamUrl) {
    track.streamUrl = seedMatch.streamUrl;
    return track.streamUrl;
  }

  const query = `${track.title || ''} ${track.artist || ''}`.trim();
  if (query) {
    const audiusMatches = await fetchAudiusDirectTracks(query, {
      genre: track.genre || 'Viral Indonesia',
      isIndonesianViral: Boolean(track.isIndonesianViral),
      limit: 6,
    });
    const strictAudiusHit = audiusMatches.find(
      (a) => a.streamUrl && !failedStreamUrls.has(a.streamUrl) && isStrictAudioMatch(track, a)
    );
    if (strictAudiusHit?.streamUrl) {
      track.streamUrl = strictAudiusHit.streamUrl;
      return track.streamUrl;
    }
  }

  if (track.videoId && !failedExactVideoIds.has(track.videoId)) {
    const exactYtMp3 = await resolveExactYoutubeAudioStream(track.videoId);
    if (exactYtMp3 && !failedStreamUrls.has(exactYtMp3)) {
      track.streamUrl = exactYtMp3;
      return track.streamUrl;
    }
  }

  return '';
}

async function fetchYtMusicSearch(query, { genre = 'YT Music', isIndonesianViral = true, limit = 16 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  // Run Audius direct-stream search & Piped/Siputzx YT Music search in parallel
  const audiusPromise = fetchAudiusDirectTracks(q, { genre, isIndonesianViral, limit: 8 }).catch(() => []);

  let ytItems = [];
  // 1. Primary: TeamPiped Community Open-Source YT Music `music_songs` API
  for (const host of PIPED_API_HOSTS) {
    try {
      const json = await fetchJsonTimeout(
        `${host}/search?q=${encodeURIComponent(q)}&filter=music_songs`,
        5000
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
      if (full.length > 0) {
        ytItems = full.slice(0, limit);
        break;
      }
      if (normalized.length > 0) {
        ytItems = normalized.slice(0, limit);
        break;
      }
    } catch {
      // Try next open-source host
    }
  }

  // 2. Failover: Siputzx Community YouTube Search API
  if (ytItems.length === 0) {
    try {
      const json = await fetchJsonTimeout(`${SIPUTZX_YT_SEARCH_URL}?query=${encodeURIComponent(q)}`, 5500);
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
      ytItems = (full.length > 0 ? full : normalized).slice(0, limit);
    } catch {
      // Ignore
    }
  }

  const audiusItems = await audiusPromise;
  // ONLY attach `streamUrl` when strictly verified to be the EXACT same song title & artist!
  // Never assign another song's streamUrl by index or hash fallback!
  for (let i = 0; i < ytItems.length; i += 1) {
    const yt = ytItems[i];
    if (yt.streamUrl) continue;
    const seedHit = SEED_VIRAL_INDO_TRACKS.find(
      (s) => s.streamUrl && ((yt.videoId && s.videoId === yt.videoId) || isStrictAudioMatch(yt, s))
    );
    if (seedHit?.streamUrl) {
      yt.streamUrl = seedHit.streamUrl;
      continue;
    }
    const strictAudMatch = audiusItems.find((a) => isStrictAudioMatch(yt, a));
    if (strictAudMatch?.streamUrl) {
      yt.streamUrl = strictAudMatch.streamUrl;
    }
  }

  const combined = [...ytItems];
  // Only include genuinely query-relevant Audius tracks (never unrelated tag-noise matches)
  const relevantAudius = rankSearchResults(audiusItems, q, 45);
  for (const aud of relevantAudius) {
    if (!combined.some((c) => c.id === aud.id || (aud.streamUrl && c.streamUrl === aud.streamUrl))) {
      combined.push(aud);
    }
  }
  return combined.slice(0, limit);
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

  // Native HTML5 <audio> Background-Safe Engine & YouTube IFrame Engine shell
  // Do NOT set crossOrigin='anonymous' on <audio> so redirected streams never fail CORS checks
  // Do NOT set audio.hidden=true (display:none) so mobile browsers never deprioritize background playback
  const audio = new Audio();
  audio.id = 'music-audio-el';
  audio.className = 'music-bg-audio-el';
  audio.controls = true;
  audio.tabIndex = -1;
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
  audio.setAttribute('aria-hidden', 'true');
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

  const initialSession = readMusicSession();
  let musicLibrary = readSavedMusicLibrary();
  let tracks = shuffleTracksFisherYates(SEED_VIRAL_INDO_TRACKS);
  let poolLoaded = false;
  let poolPromise = null;
  let activeCategory = 'viral-indo';
  let activeQueueMode = 'catalog'; // 'catalog' | 'watch-later' | 'playlist'
  let activeQueuePlaylistId = '';
  const restoredLibraryTracks = [
    ...musicLibrary.watchLater,
    ...musicLibrary.playlists.flatMap((pl) => pl.tracks || []),
  ];
  let currentTrack =
    (initialSession.lastTrackId &&
      [...SEED_VIRAL_INDO_TRACKS, ...restoredLibraryTracks].find(
        (t) => t.id === initialSession.lastTrackId || t.videoId === initialSession.lastTrackId
      )) ||
    null;
  let isPlaying = false;
  let isLoading = false;
  let isOpen = false;
  let miniPlaylistPickerOpen = false;
  let miniPlaylistFeedback = '';
  let explicitPaused = Boolean(initialSession.explicitPaused);
  let autoClickPlayEnabled = readSavedAutoClickPlay();
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
  let isSwitchingSource = false;
  let audioElUnlocked = false;
  let isUnlockingAudio = false;
  let suppressNextFabClick = false;
  let lastError = '';
  let consecutiveErrors = 0;
  let currentTime = Number(initialSession.currentTime) || 0;
  let duration = currentTrack?.duration || 0;
  let pendingPlayTrack = null;
  let activeEngine = 'audio-el';
  let requestSerial = 0;
  let backgroundHandoffInFlight = false;
  const recentTrackIds = [];
  const playHistory = [];
  const blockedVideoIds = new Set();
  const subscribers = new Set();

  let ytPlayer = null;
  let ytReady = false;
  let timeTicker = null;
  let bgWatchdogTimer = null;
  let bgYtVerifyTimer = null;
  let silentAudioCtx = null;
  let silentOscillator = null;
  let lastAutoNextAt = 0;
  let lastFocusTransitionAt = 0;
  let autoResumeAttempts = 0;

  audio.volume = volume;

  function ensureBackgroundAudioKeepAlive() {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!silentAudioCtx) {
        silentAudioCtx = new AudioCtx();
      }
      if (silentAudioCtx.state === 'suspended') {
        silentAudioCtx.resume().catch(() => {});
      }
      // Create a continuous near-zero-gain oscillator so mobile OS keeps the audio session
      // alive across track transitions when screen is locked or user is in another tab/app
      if (!silentOscillator && silentAudioCtx) {
        const osc = silentAudioCtx.createOscillator();
        const gain = silentAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 30;
        gain.gain.value = 0.00008;
        osc.connect(gain);
        gain.connect(silentAudioCtx.destination);
        osc.start();
        silentOscillator = osc;
      }
    } catch {
      // Ignore AudioContext restriction
    }
  }

  function unlockNativeAudioElement() {
    if (audioElUnlocked || isUnlockingAudio || activeEngine === 'audio-el') return;
    audioElUnlocked = true;
    isUnlockingAudio = true;
    try {
      // Tiny silent WAV (~45ms) played once inside user gesture to bless #music-audio-el for mobile background playback
      const prevSrc = audio.getAttribute('src') || '';
      if (!prevSrc) {
        audio.src =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        const p = audio.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            if (isUnlockingAudio) {
              audio.pause();
              audio.removeAttribute('src');
            }
          })
            .catch(() => {
              audioElUnlocked = false;
            })
            .finally(() => {
              isUnlockingAudio = false;
            });
          return;
        }
      }
    } catch {
      audioElUnlocked = false;
    }
    isUnlockingAudio = false;
  }

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

  function findTrackInAllPools(trackId) {
    if (!trackId) return null;
    const allPools = [
      ...searchResults,
      ...tracks,
      ...SEED_VIRAL_INDO_TRACKS,
      ...musicLibrary.watchLater,
      ...musicLibrary.playlists.flatMap((pl) => pl.tracks || []),
    ];
    return allPools.find((t) => t && (t.id === trackId || t.videoId === trackId)) || null;
  }

  function getActiveQueueList() {
    if (activeQueueMode === 'watch-later') {
      return musicLibrary.watchLater;
    }
    if (activeQueueMode === 'playlist' && activeQueuePlaylistId) {
      const pl = musicLibrary.playlists.find((p) => p.id === activeQueuePlaylistId);
      if (pl) return pl.tracks || [];
    }
    return searchResults.length > 0 ? searchResults : tracks;
  }

  function getSnapshot() {
    const activeList = getActiveQueueList();
    const queueIndex = currentTrack
      ? activeList.findIndex((t) => t.id === currentTrack.id)
      : -1;
    return {
      currentTrack,
      isPlaying,
      isLoading,
      explicitPaused,
      autoClickPlayEnabled,
      shuffleEnabled,
      repeatMode,
      volume,
      isMuted,
      activeCategory,
      activeQueueMode,
      activeQueuePlaylistId,
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
      watchLater: musicLibrary.watchLater,
      playlists: musicLibrary.playlists,
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

  function syncMediaPositionState() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      if ('playbackState' in navigator.mediaSession) {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      }
      const dur = duration || currentTrack?.duration || 0;
      if (
        typeof navigator.mediaSession.setPositionState === 'function' &&
        Number.isFinite(dur) &&
        dur > 0
      ) {
        navigator.mediaSession.setPositionState({
          duration: Math.max(1, dur),
          playbackRate: 1,
          position: Math.min(Math.max(0, currentTime || 0), dur),
        });
      }
    } catch {
      // Ignore unsupported positionState values
    }
  }

  function startBackgroundWatchdog() {
    if (bgWatchdogTimer) return;
    bgWatchdogTimer = setInterval(() => {
      if (explicitPaused || (!isPlaying && !isLoading)) return;
      if (activeEngine === 'audio-el') {
        const dur =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : duration || currentTrack?.duration || 0;
        if (audio.ended || (dur > 10 && audio.currentTime >= dur - 0.8)) {
          triggerSeamlessAutoNext('ended');
          return;
        }
        if (audio.paused && !audio.ended && audio.src && !isSwitchingSource) {
          ensureBackgroundAudioKeepAlive();
          audio.play().catch(() => {});
        }
        syncMediaPositionState();
      }
    }, 1500);
  }

  function stopBackgroundWatchdog() {
    if (bgWatchdogTimer) {
      clearInterval(bgWatchdogTimer);
      bgWatchdogTimer = null;
    }
  }

  function startTimeTicker() {
    startBackgroundWatchdog();
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
        saveMusicSession({
          explicitPaused,
          wasPlaying: isPlaying,
          lastTrackId: currentTrack?.id || '',
          currentTime,
        });
        syncMediaPositionState();
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
    if (explicitPaused || (!isPlaying && !isLoading)) {
      stopBackgroundWatchdog();
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
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details && Number.isFinite(details.seekTime)) {
          controller.seekToSeconds(details.seekTime);
        }
      });
      syncMediaPositionState();
    } catch {
      // Ignore unsupported mediaSession handlers
    }
  }

  async function handoffToBackgroundSafeAudio(reason = 'background') {
    if (explicitPaused || backgroundHandoffInFlight) return false;
    backgroundHandoffInFlight = true;
    try {
      const target = currentTrack;
      if (!target) return false;
      if (target.streamUrl && failedStreamUrls.has(target.streamUrl)) {
        target.streamUrl = '';
      }
      if (!target.streamUrl) {
        // Bound background network resolution so mobile OS does not freeze timers before audio starts
        await Promise.race([
          resolveBackgroundStreamForTrack(target),
          new Promise((res) => setTimeout(res, 2200)),
        ]);
      }
      // Strictly never swap the currently displayed song to a different random track;
      // if this YT track has no exact audio stream yet, let YT IFrame keep playing it.
      if (!target.streamUrl || failedStreamUrls.has(target.streamUrl)) return false;

      const resumeSec = currentTime > 1 ? currentTime : 0;
      currentTrack = target;
      activeEngine = 'audio-el';
      try {
        if (ytReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
      } catch {
        // Ignore
      }
      isSwitchingSource = true;
      if (audio.src !== target.streamUrl) {
        audio.src = target.streamUrl;
      }
      audio.muted = isMuted;
      audio.volume = volume;
      ensureBackgroundAudioKeepAlive();
      const playProm = audio.play();
      isSwitchingSource = false;
      await playProm;
      if (resumeSec > 1 && Number.isFinite(audio.duration) && resumeSec < audio.duration - 2) {
        try {
          audio.currentTime = resumeSec;
        } catch {
          // Ignore seek before metadata
        }
      }
      isPlaying = true;
      isLoading = false;
      startTimeTicker();
      syncMediaSession(target);
      saveMusicSession({
        explicitPaused: false,
        wasPlaying: true,
        lastTrackId: target.id,
        currentTime: resumeSec,
      });
      renderWidget();
      notifySubscribers('play');
      return true;
    } catch {
      isSwitchingSource = false;
      return false;
    } finally {
      backgroundHandoffInFlight = false;
    }
  }

  function scheduleBackgroundYtVerification() {
    if (bgYtVerifyTimer) {
      clearTimeout(bgYtVerifyTimer);
      bgYtVerifyTimer = null;
    }
    if (explicitPaused || activeEngine !== 'yt-iframe') return;
    bgYtVerifyTimer = setTimeout(() => {
      bgYtVerifyTimer = null;
      if (explicitPaused || activeEngine !== 'yt-iframe') return;
      if (typeof document === 'undefined' || !document.hidden) return;
      let st = -1;
      try {
        st = ytPlayer?.getPlayerState?.() ?? -1;
      } catch {
        st = -1;
      }
      // If mobile/desktop OS still keeps cross-origin YT iframe paused in background,
      // switch cleanly to a verified background-safe native <audio> track (with updated title!)
      if (st !== 1) {
        controller.playNext({ reason: 'background-handoff' });
      }
    }, 750);
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
                if (activeEngine !== 'yt-iframe') return;
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
                saveMusicSession({
                  explicitPaused: false,
                  wasPlaying: true,
                  lastTrackId: currentTrack?.id || '',
                  currentTime,
                });
                startTimeTicker();
                syncMediaPositionState();
                renderWidget();
                notifySubscribers('play');
              } else if (state === YTState.BUFFERING) {
                if (activeEngine !== 'yt-iframe') return;
                isLoading = true;
                notifySubscribers('loading');
              } else if (state === YTState.PAUSED) {
                if (activeEngine !== 'yt-iframe') return;
                // Mobile OS often fires YTState.PAUSED 50-300ms BEFORE visibilitychange/hidden flips true!
                // If user didn't click pause (explicitPaused === false), hand off or keep recovering instead of dying.
                if (!explicitPaused) {
                  const isHiddenOrBlurred =
                    (typeof document !== 'undefined' && (document.hidden || !document.hasFocus?.())) ||
                    Date.now() - lastFocusTransitionAt < 5000;
                  if (isHiddenOrBlurred) {
                    handoffToBackgroundSafeAudio('yt-hidden-pause').then((switched) => {
                      if (switched || explicitPaused || activeEngine !== 'yt-iframe') return;
                      if (ytReady && ytPlayer?.playVideo) {
                        try {
                          ytPlayer.playVideo();
                        } catch {
                          // Ignore
                        }
                      }
                      scheduleBackgroundYtVerification();
                    });
                    return;
                  }
                  setTimeout(() => {
                    if (
                      !explicitPaused &&
                      activeEngine === 'yt-iframe' &&
                      typeof document !== 'undefined' &&
                      (document.hidden || !document.hasFocus?.())
                    ) {
                      handoffToBackgroundSafeAudio('yt-delayed-hidden-pause').then((switched) => {
                        if (!switched && !explicitPaused && activeEngine === 'yt-iframe') {
                          scheduleBackgroundYtVerification();
                        }
                      });
                    }
                  }, 140);
                  return;
                }
                if (!isLoading) {
                  isPlaying = false;
                  stopTimeTicker();
                  syncMediaPositionState();
                  renderWidget();
                  notifySubscribers('pause');
                }
              } else if (state === YTState.ENDED) {
                if (activeEngine !== 'yt-iframe') return;
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
            onError: async () => {
              if (activeEngine !== 'yt-iframe') return;
              const failedTrack = currentTrack;
              const failedId = failedTrack?.videoId;
              if (failedId) {
                failedYtIframeVideoIds.add(failedId);
              }
              // Try resolving an exact streamUrl for THIS SAME song (if not already failed) before skipping!
              if (failedTrack && !explicitPaused && (!failedId || !failedExactVideoIds.has(failedId))) {
                isLoading = true;
                renderWidget();
                notifySubscribers('loading');
                const resolved = await resolveBackgroundStreamForTrack(failedTrack).catch(() => '');
                if (
                  resolved &&
                  !failedStreamUrls.has(resolved) &&
                  currentTrack?.id === failedTrack.id &&
                  !explicitPaused
                ) {
                  executePlaybackNow(failedTrack, { startSeconds: currentTime });
                  return;
                }
              }
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

  function startYoutubePlaybackForTrack(track, startSec = 0) {
    activeEngine = 'yt-iframe';
    if (!audio.paused) audio.pause();
    if (!track?.videoId) return;
    if (ytReady && ytPlayer?.loadVideoById) {
      pendingPlayTrack = null;
      isLoading = true;
      renderWidget();
      notifySubscribers('loading');
      try {
        if (isMuted) ytPlayer.mute?.();
        else ytPlayer.unMute?.();
        ytPlayer.setVolume?.(Math.round(volume * 100));
        ytPlayer.loadVideoById({ videoId: track.videoId, startSeconds: Math.max(0, startSec) });
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

  function executePlaybackNow(track, { startSeconds = 0 } = {}) {
    if (!track) return;
    if (bgYtVerifyTimer) {
      clearTimeout(bgYtVerifyTimer);
      bgYtVerifyTimer = null;
    }
    currentTrack = track;
    currentTime = Math.max(0, Number(startSeconds) || 0);
    duration = Number(track.duration || 0);
    autoResumeAttempts = 0;
    lastError = '';
    pushRecentId(track.id);
    pushHistory(track);
    syncMediaSession(track);
    ensureBackgroundAudioKeepAlive();
    saveMusicSession({
      explicitPaused: false,
      wasPlaying: true,
      lastTrackId: track.id,
      currentTime,
    });

    // Always prefer native HTML5 <audio> whenever a valid direct streamUrl exists so playback
    // NEVER stops when locking the screen, minimizing the browser, or switching tabs!
    if (track.streamUrl && !failedStreamUrls.has(track.streamUrl)) {
      activeEngine = 'audio-el';
      pendingPlayTrack = null;
      isLoading = true;
      isPlaying = true;
      startTimeTicker();
      try {
        if (ytReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
      } catch {
        // Ignore
      }
      const targetStreamUrl = track.streamUrl;
      isSwitchingSource = true;
      if (audio.src !== targetStreamUrl) {
        audio.src = targetStreamUrl;
      }
      audio.muted = isMuted;
      audio.volume = volume;
      renderWidget();
      notifySubscribers('loading');
      const playPromise = audio.play();
      isSwitchingSource = false;
      playPromise
        .then(() => {
          if (currentTime > 1 && Number.isFinite(audio.duration) && currentTime < audio.duration - 2) {
            try {
              audio.currentTime = currentTime;
            } catch {
              // Ignore
            }
          }
          isPlaying = true;
          isLoading = false;
          consecutiveErrors = 0;
          startTimeTicker();
          syncMediaPositionState();
          renderWidget();
          notifySubscribers('play');
        })
        .catch(() => {
          if (explicitPaused || currentTrack?.id !== track.id) return;
          failedStreamUrls.add(targetStreamUrl);
          if (track.videoId && ytExactStreamCache.get(track.videoId) === targetStreamUrl) {
            ytExactStreamCache.delete(track.videoId);
            failedExactVideoIds.add(track.videoId);
          }
          // Clear broken streamUrl on this track and fall back to the EXACT same song via YT IFrame (only if YT hasn't failed for it)
          track.streamUrl = '';
          const isTabHidden = typeof document !== 'undefined' && document.hidden;
          if (track.videoId && !failedYtIframeVideoIds.has(track.videoId) && !isTabHidden) {
            startYoutubePlaybackForTrack(track, currentTime);
          } else {
            consecutiveErrors += 1;
            if (consecutiveErrors <= 5 && tracks.length > 0) {
              controller.playNext({ reason: 'error-skip' });
            } else {
              isPlaying = false;
              isLoading = false;
              lastError = 'Sumber audio lagu ini sedang tidak tersedia.';
              renderWidget();
              notifySubscribers('error');
            }
          }
        });
      return;
    }
    if (track.streamUrl && failedStreamUrls.has(track.streamUrl)) {
      track.streamUrl = '';
    }

    // Track only has videoId: bless native <audio> for background handoff, start YT IFrame, and resolve background stream
    activeEngine = 'yt-iframe';
    unlockNativeAudioElement();
    resolveBackgroundStreamForTrack(track).catch(() => {});
    startYoutubePlaybackForTrack(track, currentTime);
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
        const merged = new Map(SEED_VIRAL_INDO_TRACKS.map((t) => [t.id, t]));
        for (const group of settled) {
          for (const item of group) {
            const key = item?.videoId ? `yt-${item.videoId}` : item?.id;
            if (key && (!item.videoId || !blockedVideoIds.has(item.videoId)) && !merged.has(key)) {
              merged.set(key, item);
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
    const fillEl = root.querySelector('#music-mini-progress-fill');
    const dur = duration || currentTrack?.duration || 180;
    const cur = Math.min(dur, Math.max(0, currentTime || 0));
    const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
    if (slider && dur > 0) {
      slider.value = String(pct);
    }
    if (fillEl) {
      fillEl.style.width = `${pct}%`;
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
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="M4.9 19.1 7.8 16.2"/><path d="M2 12h4"/></svg>`
      : isPlaying
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="7,4 20,12 7,20"/></svg>`;

    const muteIcon =
      isMuted || volume === 0
        ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>`
        : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;

    root.innerHTML = `
      <div
        id="music-popover"
        class="music-popover music-popover-modern ytm-mini-popover"
        role="dialog"
        aria-label="Pemutar Musik YouTube Music Minimalis"
        ${isOpen ? '' : 'hidden'}
      >
        <div class="ytm-mini-top-progress" aria-hidden="true">
          <div id="music-mini-progress-fill" class="ytm-mini-top-progress-fill" style="width: ${pct}%"></div>
        </div>

        <div class="ytm-mini-brand-bar">
          <div class="ytm-mini-brand-badge">
            <span class="ytm-mini-logo-dot" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="8,5 19,12 8,19"/></svg>
            </span>
            <span class="ytm-mini-brand-name">Music</span>
            <span class="ytm-mini-live-pill ${isPlaying ? 'is-live' : ''}">${isPlaying ? 'Diputar' : 'Siap'}</span>
          </div>

          <div class="music-head-btns">
            <button
              type="button"
              class="music-icon-mini-btn ${autoClickPlayEnabled ? 'is-active' : ''}"
              id="music-autoclick-btn"
              data-music-control="true"
              title="${autoClickPlayEnabled ? 'Auto-putar saat klik aktif (Ketuk untuk mode tenang)' : 'Mode tenang aktif (Ketuk untuk aktifkan auto-putar saat klik)'}"
              aria-label="${autoClickPlayEnabled ? 'Nonaktifkan auto-putar saat klik' : 'Aktifkan auto-putar saat klik'}"
              aria-pressed="${autoClickPlayEnabled}"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </button>
            ${
              customPos
                ? `<button type="button" class="music-icon-mini-btn" id="music-reset-pos-btn" data-music-control="true" title="Reset posisi ikon" aria-label="Reset posisi ikon musik"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>`
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

        <div class="music-pop-head ytm-mini-track-row">
          <div class="music-pop-track">
            <div class="music-art-wrap ytm-mini-art-wrap ${isPlaying ? 'is-playing' : ''}">
              ${
                active?.artwork
                  ? `<img src="${escapeHtml(active.artwork)}" alt="" width="48" height="48" class="music-art-img" onerror="this.src='${escapeHtml(active.artworkFallback || '')}'" />`
                  : `<span class="music-art-fallback" aria-hidden="true">♪</span>`
              }
            </div>
            <div class="music-meta">
              <strong class="music-title" id="music-now-title">${escapeHtml(currentTrack ? currentTrack.title : active?.title || 'YT Music Viral Indonesia')}</strong>
              <span class="music-artist" id="music-now-artist">${escapeHtml(currentTrack ? `${currentTrack.artist} • ${currentTrack.genre || 'Viral Indo'}` : 'Artis Indonesia • Putar Otomatis')}</span>
            </div>
            <div class="ytm-mini-save-actions">
              <button
                type="button"
                class="music-icon-mini-btn ${active && isTrackInWatchLater(musicLibrary, active) ? 'is-active' : ''}"
                id="music-mini-watchlater-btn"
                data-music-control="true"
                title="${active && isTrackInWatchLater(musicLibrary, active) ? 'Hapus dari Tonton Nanti' : 'Simpan ke Tonton Nanti'}"
                aria-label="Simpan ke Tonton Nanti"
                aria-pressed="${Boolean(active && isTrackInWatchLater(musicLibrary, active))}"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${
                  active && isTrackInWatchLater(musicLibrary, active)
                    ? '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="currentColor"/><polyline points="12 7 12 12 15 14" stroke="#ffffff"/>'
                    : '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>'
                }</svg>
              </button>
              <button
                type="button"
                class="music-icon-mini-btn ${miniPlaylistPickerOpen ? 'is-active' : ''}"
                id="music-mini-playlist-btn"
                data-music-control="true"
                title="Tambah lagu ini ke Playlist"
                aria-label="Tambah ke Playlist"
                aria-expanded="${miniPlaylistPickerOpen}"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              </button>
            </div>
          </div>
        </div>

        ${
          miniPlaylistPickerOpen
            ? `<div class="ytm-mini-playlist-drawer" id="music-mini-playlist-drawer" data-music-control="true">
                <div class="ytm-mini-pl-head">
                  <strong>Simpan ke Playlist</strong>
                  <span>${musicLibrary.playlists.length} playlist</span>
                </div>
                <form id="music-mini-create-pl-form" class="ytm-mini-create-pl-form">
                  <input
                    type="text"
                    id="music-mini-new-pl-input"
                    class="music-search-input"
                    placeholder="Nama playlist baru..."
                    maxlength="60"
                    aria-label="Nama playlist baru"
                  />
                  <button type="submit" class="btn btn-primary btn-xs" data-music-control="true">Buat</button>
                </form>
                ${
                  miniPlaylistFeedback
                    ? `<div class="music-search-note" role="status">${escapeHtml(miniPlaylistFeedback)}</div>`
                    : ''
                }
                ${
                  musicLibrary.playlists.length > 0
                    ? `<div class="ytm-mini-pl-list">
                        ${musicLibrary.playlists
                          .map((pl) => {
                            const hasTrack = active && pl.tracks.some((t) => t.id === active.id);
                            return `
                            <button
                              type="button"
                              class="music-search-hit ${hasTrack ? 'is-active' : ''}"
                              data-mini-add-pl-id="${escapeHtml(pl.id)}"
                              data-music-control="true"
                            >
                              <span class="music-search-hit-title">${escapeHtml(pl.name)} (${pl.tracks.length})</span>
                              <span class="music-search-hit-dur">${hasTrack ? '✓ Tersimpan' : '+ Tambah'}</span>
                            </button>
                          `;
                          })
                          .join('')}
                      </div>`
                    : `<div class="music-search-note">Belum ada playlist. Buat di atas!</div>`
                }
              </div>`
            : ''
        }

        <div class="ytm-mini-scrubber-wrap">
          <input
            type="range"
            id="music-seek-slider"
            class="music-seek-slider ytm-mini-seek-slider"
            data-music-control="true"
            min="0"
            max="100"
            step="0.5"
            value="${pct}"
            aria-label="Geser progres lagu"
          />
          <div class="ytm-mini-time-row">
            <span class="music-time mono-num" id="music-time-label">${formatAudioTime(curSec)} / ${formatAudioTime(durSec)}</span>
            <span class="ytm-mini-repeat-tag">${repeatMode === 'one' ? 'Ulang 1' : repeatMode === 'all' ? 'Auto-Next Aktif' : 'Ulang Nonaktif'}</span>
          </div>
        </div>

        <div class="ytm-mini-toolbar" role="group" aria-label="Toolbar Pemutar YouTube Music">
          <button
            type="button"
            class="ytm-mini-tool-btn ${shuffleEnabled ? 'is-active' : ''}"
            id="music-shuffle-btn"
            data-music-control="true"
            aria-label="Acak lagu"
            aria-pressed="${shuffleEnabled}"
            title="${shuffleEnabled ? 'Acak Aktif' : 'Acak Nonaktif'}"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
          </button>

          <button
            type="button"
            class="ytm-mini-tool-btn"
            id="music-prev-btn"
            data-music-control="true"
            aria-label="Lagu sebelumnya"
            title="Sebelumnya"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><rect x="5" y="4" width="2.4" height="16" rx="1"/></svg>
          </button>

          <button
            type="button"
            class="ytm-mini-play-btn ${isPlaying ? 'is-playing' : ''}"
            id="music-playpause-btn"
            data-music-control="true"
            aria-label="${isPlaying ? 'Jeda musik' : 'Putar musik'}"
            title="${isPlaying ? 'Jeda' : 'Putar'}"
          >
            ${playIcon}
          </button>

          <button
            type="button"
            class="ytm-mini-tool-btn"
            id="music-next-btn"
            data-music-control="true"
            aria-label="Lagu berikutnya"
            title="Berikutnya"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="16.6" y="4" width="2.4" height="16" rx="1"/></svg>
          </button>

          <button
            type="button"
            class="ytm-mini-tool-btn ${repeatMode !== 'off' ? 'is-active' : ''}"
            id="music-repeat-btn"
            data-music-control="true"
            aria-label="Mode ulang lagu"
            title="Mode Ulang: ${repeatMode.toUpperCase()}"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
            ${repeatMode === 'one' ? '<span class="ytm-mini-repeat-one">1</span>' : ''}
          </button>

          <button
            type="button"
            class="ytm-mini-tool-btn ${isMuted ? 'is-muted' : ''}"
            id="music-mute-btn"
            data-music-control="true"
            aria-label="${isMuted ? 'Nyalakan suara' : 'Bisukan suara'}"
            title="${isMuted ? 'Unmute' : 'Mute'}"
          >
            ${muteIcon}
          </button>
        </div>

        <form id="music-search-form" class="music-search-row ytm-mini-search-row">
          <input
            type="search"
            id="music-search-input"
            class="music-search-input"
            placeholder="Cari lagu atau artis di YT Music..."
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
                  <div class="music-search-hit-row ${currentTrack?.id === t.id ? 'is-active' : ''}">
                    <button
                      type="button"
                      class="music-search-hit ${currentTrack?.id === t.id ? 'is-active' : ''}"
                      data-music-pick-id="${escapeHtml(t.id)}"
                      data-music-control="true"
                    >
                      <span class="music-search-hit-title">${escapeHtml(t.title)} — ${escapeHtml(t.artist)}</span>
                      <span class="music-search-hit-dur mono-num">${formatAudioTime(t.duration)}</span>
                    </button>
                    <button
                      type="button"
                      class="music-icon-mini-btn ${isTrackInWatchLater(musicLibrary, t) ? 'is-active' : ''}"
                      data-music-wl-id="${escapeHtml(t.id)}"
                      data-music-control="true"
                      title="Simpan ke Tonton Nanti"
                      aria-label="Simpan ${escapeHtml(t.title)} ke Tonton Nanti"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${
                        isTrackInWatchLater(musicLibrary, t)
                          ? '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="currentColor"/><polyline points="12 7 12 12 15 14" stroke="#ffffff"/>'
                          : '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>'
                      }</svg>
                    </button>
                  </div>
                `
                  )
                  .join('')}
              </div>`
            : ''
        }

        <div class="music-pop-footer">
          ${
            isOnMusicTab
              ? `<span class="music-drag-tip">Pemutar YouTube Music aktif · Tekan & geser tombol bulat untuk pindah posisi</span>`
              : `<a href="./tools.html?tab=music" class="music-open-hub-link ytm-mini-open-link" data-music-control="true">
                  <span>Buka Tampilan Penuh YouTube Music</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </a>`
          }
        </div>
      </div>

      <button
        type="button"
        id="music-fab-btn"
        data-music-control="true"
        class="music-fab-btn ytm-fab-btn ${isPlaying ? 'is-playing' : ''}"
        aria-label="${isOpen ? 'Tutup pemutar musik minimalis' : 'Buka pemutar musik YouTube Music (bisa digeser)'}"
        aria-expanded="${isOpen}"
        title="YouTube Music Player · Ketuk untuk buka atau tekan & geser"
      >
        <span class="music-fab-eq" aria-hidden="true">
          <span></span><span></span><span></span>
        </span>
        <svg class="music-fab-note" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm-1.5-6.75v4.5l4-2.25-4-2.25z"/></svg>
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

    root.querySelector('#music-autoclick-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.toggleAutoClickPlay();
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

    root.querySelector('#music-shuffle-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.toggleShuffle();
      renderWidget();
    });

    root.querySelector('#music-repeat-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.cycleRepeatMode();
      renderWidget();
    });

    root.querySelector('#music-mute-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.toggleMute();
    });

    const slider = root.querySelector('#music-seek-slider');
    slider?.addEventListener('input', () => {
      isSeeking = true;
      const dur = duration || currentTrack?.duration || 180;
      const pctVal = Math.max(0, Math.min(100, Number(slider.value) || 0));
      const targetSec = (pctVal / 100) * dur;
      const timeEl = root.querySelector('#music-time-label');
      const fillEl = root.querySelector('#music-mini-progress-fill');
      if (fillEl) fillEl.style.width = `${pctVal}%`;
      if (timeEl) {
        timeEl.textContent = `${formatAudioTime(targetSec)} / ${formatAudioTime(dur)}`;
      }
    });
    slider?.addEventListener('change', () => {
      controller.seekToPercent(Number(slider.value));
      isSeeking = false;
    });

    root.querySelector('#music-mini-watchlater-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const target = currentTrack || tracks[0] || SEED_VIRAL_INDO_TRACKS[0];
      if (!target) return;
      controller.toggleWatchLater(target);
    });

    root.querySelector('#music-mini-playlist-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      miniPlaylistPickerOpen = !miniPlaylistPickerOpen;
      miniPlaylistFeedback = '';
      renderWidget();
    });

    root.querySelector('#music-mini-create-pl-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = root.querySelector('#music-mini-new-pl-input');
      const name = String(input?.value || '').trim();
      const active = currentTrack || tracks[0] || SEED_VIRAL_INDO_TRACKS[0] || null;
      if (!name) return;
      const pl = controller.createPlaylist(name, active);
      if (pl) {
        miniPlaylistFeedback = active
          ? `Playlist "${pl.name}" dibuat & lagu disimpan!`
          : `Playlist "${pl.name}" berhasil dibuat!`;
        renderWidget();
      }
    });

    root.querySelectorAll('[data-mini-add-pl-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const plId = btn.getAttribute('data-mini-add-pl-id');
        const active = currentTrack || tracks[0] || SEED_VIRAL_INDO_TRACKS[0];
        if (!plId || !active) return;
        const added = controller.addTrackToPlaylist(plId, active);
        miniPlaylistFeedback = added
          ? 'Lagu ditambahkan ke playlist.'
          : 'Lagu sudah ada di playlist ini.';
        renderWidget();
      });
    });

    const searchInput = root.querySelector('#music-search-input');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
    });

    root.querySelector('#music-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Never auto-skip the currently playing song when submitting search
      controller.search(searchInput?.value || '', { autoPlayFirst: false });
    });

    root.querySelectorAll('[data-music-pick-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pickId = btn.getAttribute('data-music-pick-id');
        controller.playTrackById(pickId);
      });
    });

    root.querySelectorAll('[data-music-wl-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wlId = btn.getAttribute('data-music-wl-id');
        const target = findTrackInAllPools(wlId);
        if (target) controller.toggleWatchLater(target);
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

    playTrack(track, { startSeconds = 0, queueMode = null, playlistId = '' } = {}) {
      if (!track) return;
      if (queueMode) {
        activeQueueMode = queueMode;
        activeQueuePlaylistId = playlistId || '';
      }
      explicitPaused = false;
      requestSerial += 1;
      executePlaybackNow(track, { startSeconds });
    },

    playTrackById(trackId, options = {}) {
      const target = findTrackInAllPools(trackId);
      if (target) {
        this.playTrack(target, options);
      }
    },

    isInWatchLater(trackOrId) {
      return isTrackInWatchLater(musicLibrary, trackOrId);
    },

    toggleWatchLater(track = currentTrack) {
      const target = track || currentTrack;
      if (!target) return false;
      const res = toggleTrackInWatchLater(musicLibrary, target);
      musicLibrary = saveMusicLibrary(res.library);
      renderWidget();
      notifySubscribers('library');
      return res.added;
    },

    createPlaylist(name, initialTrack = null) {
      const res = createUserPlaylist(musicLibrary, name, initialTrack);
      musicLibrary = saveMusicLibrary(res.library);
      renderWidget();
      notifySubscribers('library');
      return res.playlist;
    },

    renamePlaylist(playlistId, nextName) {
      musicLibrary = saveMusicLibrary(renameUserPlaylist(musicLibrary, playlistId, nextName));
      renderWidget();
      notifySubscribers('library');
    },

    deletePlaylist(playlistId) {
      musicLibrary = saveMusicLibrary(deleteUserPlaylist(musicLibrary, playlistId));
      if (activeQueuePlaylistId === playlistId) {
        activeQueueMode = 'catalog';
        activeQueuePlaylistId = '';
      }
      renderWidget();
      notifySubscribers('library');
    },

    addTrackToPlaylist(playlistId, track = currentTrack) {
      const target = track || currentTrack;
      if (!playlistId || !target) return false;
      const res = addTrackToPlaylist(musicLibrary, playlistId, target);
      musicLibrary = saveMusicLibrary(res.library);
      renderWidget();
      notifySubscribers('library');
      return res.added;
    },

    removeTrackFromPlaylist(playlistId, trackId) {
      const res = removeTrackFromPlaylist(musicLibrary, playlistId, trackId);
      musicLibrary = saveMusicLibrary(res.library);
      renderWidget();
      notifySubscribers('library');
      return res.removed;
    },

    playWatchLater({ shuffle = false, startTrackId = null } = {}) {
      const list = musicLibrary.watchLater;
      if (!list || list.length === 0) return false;
      if (shuffle) {
        shuffleEnabled = true;
        try {
          localStorage.setItem(MUSIC_SHUFFLE_KEY, 'true');
        } catch {
          // Ignore
        }
      }
      const startTrack =
        (startTrackId && list.find((t) => t.id === startTrackId)) ||
        (shuffle ? list[Math.floor(Math.random() * list.length)] : list[0]);
      if (!startTrack) return false;
      this.playTrack(startTrack, { queueMode: 'watch-later' });
      return true;
    },

    playPlaylist(playlistId, { shuffle = false, startTrackId = null } = {}) {
      const pl = musicLibrary.playlists.find((p) => p.id === playlistId);
      if (!pl || !pl.tracks || pl.tracks.length === 0) return false;
      if (shuffle) {
        shuffleEnabled = true;
        try {
          localStorage.setItem(MUSIC_SHUFFLE_KEY, 'true');
        } catch {
          // Ignore
        }
      }
      const startTrack =
        (startTrackId && pl.tracks.find((t) => t.id === startTrackId)) ||
        (shuffle ? pl.tracks[Math.floor(Math.random() * pl.tracks.length)] : pl.tracks[0]);
      if (!startTrack) return false;
      this.playTrack(startTrack, { queueMode: 'playlist', playlistId: pl.id });
      return true;
    },

    play() {
      explicitPaused = false;
      saveMusicSession({
        explicitPaused: false,
        wasPlaying: true,
        lastTrackId: currentTrack?.id || '',
        currentTime,
      });
      if (!currentTrack) {
        this.playNext({ userInitiated: true });
        return;
      }
      ensureBackgroundAudioKeepAlive();
      if (activeEngine === 'audio-el' || currentTrack.streamUrl) {
        activeEngine = 'audio-el';
        isSwitchingSource = true;
        if (currentTrack.streamUrl && audio.src !== currentTrack.streamUrl) {
          audio.src = currentTrack.streamUrl;
        }
        const p = audio.play();
        isSwitchingSource = false;
        p.then(() => {
          isPlaying = true;
          isLoading = false;
          startTimeTicker();
          syncMediaPositionState();
          renderWidget();
          notifySubscribers('play');
        }).catch(() => this.playTrack(currentTrack, { startSeconds: currentTime }));
      } else if (ytReady && ytPlayer?.playVideo) {
        try {
          if (isMuted) ytPlayer.mute?.();
          else ytPlayer.unMute?.();
          ytPlayer.setVolume?.(Math.round(volume * 100));
          ytPlayer.playVideo();
          isPlaying = true;
          startTimeTicker();
          syncMediaPositionState();
          renderWidget();
          notifySubscribers('play');
        } catch {
          this.playTrack(currentTrack, { startSeconds: currentTime });
        }
      } else {
        this.playTrack(currentTrack, { startSeconds: currentTime });
      }
    },

    pause({ external = false } = {}) {
      explicitPaused = true;
      pendingPlayTrack = null;
      if (bgYtVerifyTimer) {
        clearTimeout(bgYtVerifyTimer);
        bgYtVerifyTimer = null;
      }
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
      if (silentAudioCtx && silentAudioCtx.state === 'running') {
        silentAudioCtx.suspend().catch(() => {});
      }
      saveMusicSession({
        explicitPaused: true,
        wasPlaying: false,
        lastTrackId: currentTrack?.id || '',
        currentTime,
      });
      syncMediaPositionState();
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

    toggleAutoClickPlay() {
      autoClickPlayEnabled = !autoClickPlayEnabled;
      saveAutoClickPlay(autoClickPlayEnabled);
      renderWidget();
      notifySubscribers('mode');
    },

    playNext({ userInitiated = false, reason = 'next' } = {}) {
      explicitPaused = false;
      if (userInitiated || reason === 'any-button-click' || reason === 'fab-open') {
        consecutiveErrors = 0;
      }

      if (reason === 'any-button-click' || reason === 'fab-open' || reason === 'background-handoff') {
        activeQueueMode = 'catalog';
        activeQueuePlaylistId = '';
      }

      // Custom Playlist or Watch Later queue navigation
      if (
        (activeQueueMode === 'playlist' || activeQueueMode === 'watch-later') &&
        reason !== 'error-skip'
      ) {
        const list = getActiveQueueList();
        if (list.length > 0) {
          const isHidden = typeof document !== 'undefined' && document.hidden;
          const hiddenReady = list.filter((t) => Boolean(t.streamUrl) && !failedStreamUrls.has(t.streamUrl));
          const pool = isHidden && hiddenReady.length > 0 ? hiddenReady : list;
          let picked = null;
          if (shuffleEnabled && pool.length > 1) {
            const candidates = pool.filter((t) => t.id !== currentTrack?.id);
            picked = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
          } else {
            const idx = currentTrack ? pool.findIndex((t) => t.id === currentTrack.id) : -1;
            picked = pool[(idx + 1) % pool.length] || pool[0];
          }
          if (picked) {
            this.playTrack(picked, { queueMode: activeQueueMode, playlistId: activeQueuePlaylistId });
            return;
          }
        }
      }

      const activePool = searchResults.length > 0 && reason === 'ended' && !shuffleEnabled ? searchResults : tracks;
      if (!poolLoaded && !poolPromise) {
        ensureTrackPool();
      }

      let nextTrack = null;
      if (
        shuffleEnabled ||
        reason === 'any-button-click' ||
        reason === 'fab-open' ||
        reason === 'error-skip' ||
        reason === 'background-handoff' ||
        activePool === tracks
      ) {
        // Prefer verified native background <audio> streamUrl tracks for seamless playback
        // across screen-lock, tab switching, and minimized browser sessions!
        const fullPool = tracks.length > 0 ? tracks : SEED_VIRAL_INDO_TRACKS;
        const bgReadyPool = fullPool.filter((t) => Boolean(t.streamUrl) && !failedStreamUrls.has(t.streamUrl));
        const candidatePool = bgReadyPool.length > 0 ? bgReadyPool : fullPool;

        nextTrack = pickShuffledViralTrack(candidatePool, {
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
        this.playTrack(nextTrack, { queueMode: 'catalog' });
      } else if (userInitiated && tracks.length > 0) {
        this.playTrack(tracks[0], { queueMode: 'catalog' });
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
      saveMusicSession({
        explicitPaused,
        wasPlaying: isPlaying,
        lastTrackId: currentTrack?.id || '',
        currentTime: targetSec,
      });
      syncMediaPositionState();
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
            const key = t?.videoId ? `yt-${t.videoId}` : t?.id;
            if (key && (!t.videoId || !blockedVideoIds.has(t.videoId)) && !merged.has(key)) {
              merged.set(key, t);
            }
          }
        }
        for (const seed of SEED_VIRAL_INDO_TRACKS) {
          if (preset.id === 'viral-indo' || seed.genre.toLowerCase().includes(preset.id.split('-')[0])) {
            if (!merged.has(seed.id)) merged.set(seed.id, seed);
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
          if (directTrack) {
            await resolveBackgroundStreamForTrack(directTrack).catch(() => {});
            fetched = [directTrack];
          }
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
          const key = r?.videoId ? `yt-${r.videoId}` : r?.id;
          if (key && (!r.videoId || !blockedVideoIds.has(r.videoId)) && !byId.has(key)) {
            byId.set(key, r);
          }
        }
        const finalResults = [...byId.values()];
        searchResults = finalResults;

        if (finalResults.length > 0) {
          // Merge into tracks so next/shuffle can access them while prioritizing Viral Indo
          const allMap = new Map(tracks.map((t) => [t.id, t]));
          for (const item of finalResults) {
            if (!allMap.has(item.id)) allMap.set(item.id, item);
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
        searchFeedback = 'Server pencarian utama sedang sibuk. Menampilkan koleksi lokal yang cocok.';
        const fallbackMatches = rankSearchResults([...tracks, ...SEED_VIRAL_INDO_TRACKS], q, 45);
        searchResults = fallbackMatches;
        if (fallbackMatches.length > 0 && autoPlayFirst) {
          this.playTrack(fallbackMatches[0]);
        }
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

  function triggerSeamlessAutoNext(sourceReason = 'ended') {
    if (explicitPaused) return;
    const now = Date.now();
    if (now - lastAutoNextAt < 1200) return;
    lastAutoNextAt = now;
    ensureBackgroundAudioKeepAlive();
    if (repeatMode === 'one' && currentTrack) {
      executePlaybackNow(currentTrack, { startSeconds: 0 });
    } else if (repeatMode === 'off' && !shuffleEnabled) {
      isPlaying = false;
      stopTimeTicker();
      renderWidget();
      notifySubscribers('ended');
    } else {
      controller.playNext({ reason: sourceReason });
    }
  }

  // Native HTML5 <audio> lifecycle listeners (continues playing & auto-advancing when screen is off or tab is hidden!)
  audio.addEventListener('play', () => {
    if (isUnlockingAudio || activeEngine !== 'audio-el') return;
    audioElUnlocked = true;
    autoResumeAttempts = 0;
    isPlaying = true;
    isLoading = false;
    ensureBackgroundAudioKeepAlive();
    startTimeTicker();
    syncMediaPositionState();
    renderWidget();
    notifySubscribers('play');
  });

  // Native timeupdate fires even when setInterval is throttled in background tabs or locked screens!
  // We also trigger auto-next 0.8s before track end so mobile OS audio focus never drops between tracks.
  audio.addEventListener('timeupdate', () => {
    if (isUnlockingAudio || activeEngine !== 'audio-el' || isSeeking) return;
    const cur = Number.isFinite(audio.currentTime) ? audio.currentTime : currentTime;
    const dur =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : duration || currentTrack?.duration || 0;

    if (dur > 10 && cur >= dur - 0.8 && !explicitPaused) {
      triggerSeamlessAutoNext('ended');
      return;
    }

    if (Math.abs(cur - currentTime) >= 0.35 || Math.abs(dur - duration) >= 1) {
      currentTime = cur;
      if (dur > 0) duration = dur;
      syncMediaPositionState();
      syncPopoverProgressDom();
      notifySubscribers('time');
    }
  });

  audio.addEventListener('pause', () => {
    if (isUnlockingAudio || activeEngine !== 'audio-el' || isSwitchingSource) return;
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration || 0;
    // If paused right at the end of track while in background, advance immediately
    if (!explicitPaused && (audio.ended || (dur > 10 && audio.currentTime >= dur - 1.2))) {
      triggerSeamlessAutoNext('ended');
      return;
    }
    const recentlyTransitioned = Date.now() - lastFocusTransitionAt < 5000;
    const isHiddenNow = typeof document !== 'undefined' && (document.hidden || !document.hasFocus?.());
    // Whenever user did NOT click Pause (explicitPaused === false) and audio stopped transiently
    // due to screen lock, tab switch, or app exit, auto-resume cleanly & keep watchdog alive!
    if (!explicitPaused && !audio.ended && audio.src && (isHiddenNow || recentlyTransitioned || isLoading || autoResumeAttempts < 3)) {
      autoResumeAttempts += 1;
      ensureBackgroundAudioKeepAlive();
      audio.play().catch((err) => {
        if (err?.name === 'NotAllowedError' && !document.hidden) {
          isPlaying = false;
          stopTimeTicker();
          renderWidget();
          notifySubscribers('pause');
        }
      });
      setTimeout(() => {
        if (!explicitPaused && activeEngine === 'audio-el' && audio.paused && !audio.ended && audio.src && !isSwitchingSource) {
          ensureBackgroundAudioKeepAlive();
          audio.play().catch(() => {});
        }
      }, 280);
      return;
    }
    isPlaying = false;
    stopTimeTicker();
    syncMediaPositionState();
    renderWidget();
    notifySubscribers('pause');
  });

  audio.addEventListener('ended', () => {
    if (isUnlockingAudio || activeEngine !== 'audio-el') return;
    triggerSeamlessAutoNext('ended');
  });

  audio.addEventListener('stalled', () => {
    if (isUnlockingAudio || activeEngine !== 'audio-el' || explicitPaused) return;
    ensureBackgroundAudioKeepAlive();
    if (audio.paused && isPlaying) {
      audio.play().catch(() => {});
    }
  });

  audio.addEventListener('error', () => {
    if (isUnlockingAudio || activeEngine !== 'audio-el' || explicitPaused) return;
    const failedSrc = currentTrack?.streamUrl || audio.currentSrc || audio.src || '';
    if (failedSrc) {
      failedStreamUrls.add(failedSrc);
    }
    if (currentTrack?.videoId) {
      const vid = currentTrack.videoId;
      if (ytExactStreamCache.get(vid) === failedSrc) {
        ytExactStreamCache.delete(vid);
      }
      failedExactVideoIds.add(vid);
    }
    if (currentTrack) {
      currentTrack.streamUrl = '';
    }
    if (
      currentTrack?.videoId &&
      !failedYtIframeVideoIds.has(currentTrack.videoId) &&
      (typeof document === 'undefined' || !document.hidden)
    ) {
      startYoutubePlaybackForTrack(currentTrack, currentTime);
      return;
    }
    if (currentTrack?.videoId) {
      blockedVideoIds.add(currentTrack.videoId);
      tracks = tracks.filter((t) => t.videoId !== currentTrack.videoId);
    }
    consecutiveErrors += 1;
    if (consecutiveErrors <= 5 && tracks.length > 0) {
      lastError = 'Mengganti ke lagu YT Music lain yang tersedia...';
      controller.playNext({ reason: 'error-skip' });
    } else {
      isPlaying = false;
      isLoading = false;
      lastError = 'Pemutar YT Music sedang menunggu koneksi atau memilih lagu lain.';
      renderWidget();
      notifySubscribers('error');
    }
  });

  function keepAudioAliveOnLifecycle(reason = 'visibility') {
    lastFocusTransitionAt = Date.now();
    if (explicitPaused) return;
    ensureBackgroundAudioKeepAlive();
    if (isPlaying || isLoading) {
      if (activeEngine === 'yt-iframe') {
        handoffToBackgroundSafeAudio(reason).then((switched) => {
          if (!switched && !explicitPaused && activeEngine === 'yt-iframe' && document.hidden) {
            scheduleBackgroundYtVerification();
          }
        });
      } else if (audio.ended) {
        triggerSeamlessAutoNext('ended');
      } else if (audio.paused && audio.src && !isSwitchingSource) {
        audio.play().catch(() => {});
      }
      syncMediaPositionState();
    }
  }

  // Keep music alive when switching tabs, minimizing browser, or locking screen
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        keepAudioAliveOnLifecycle('visibility-hidden');
      } else {
        if (bgYtVerifyTimer) {
          clearTimeout(bgYtVerifyTimer);
          bgYtVerifyTimer = null;
        }
        const saved = readMusicSession();
        if (!explicitPaused && (saved.wasPlaying || isPlaying) && currentTrack) {
          if (activeEngine === 'audio-el') {
            if (audio.ended) {
              triggerSeamlessAutoNext('ended');
            } else if (audio.paused && audio.src && !isSwitchingSource) {
              audio.play().catch(() => {});
            }
          }
        }
      }
    });

    document.addEventListener('resume', () => keepAudioAliveOnLifecycle('page-resume'));
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('blur', () => {
      lastFocusTransitionAt = Date.now();
      if (!explicitPaused && (isPlaying || isLoading) && activeEngine === 'audio-el') {
        ensureBackgroundAudioKeepAlive();
        if (audio.paused && !audio.ended && audio.src && !isSwitchingSource) {
          audio.play().catch(() => {});
        }
      }
    });

    window.addEventListener('pageshow', () => keepAudioAliveOnLifecycle('pageshow'));

    window.addEventListener('pagehide', () => {
      lastFocusTransitionAt = Date.now();
      saveMusicSession({
        explicitPaused,
        wasPlaying: isPlaying,
        lastTrackId: currentTrack?.id || '',
        currentTime,
      });
      if (!explicitPaused && isPlaying && activeEngine === 'audio-el' && audio.paused && !audio.ended && audio.src) {
        audio.play().catch(() => {});
      }
    });
  }

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
   * interactive button/control across the entire website (unless explicitly paused,
   * auto-click-play is disabled by user, or external media is playing).
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
      if (explicitPaused || !autoClickPlayEnabled) return;
      const externalMediaPlaying = Array.from(document.querySelectorAll('video, audio')).some(
        (el) => el !== audio && !el.paused && !el.ended
      );
      if (externalMediaPlaying) return;
      if (!isPlaying && !isLoading) {
        if (currentTrack && currentTime > 0) {
          controller.playTrack(currentTrack, { startSeconds: currentTime });
        } else {
          controller.playNext({ reason: 'any-button-click' });
        }
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

  // If user navigated from another page of the site while music was actively playing (and not paused),
  // attempt seamless auto-resume immediately!
  if (!explicitPaused && initialSession.wasPlaying && currentTrack) {
    setTimeout(() => {
      if (!explicitPaused && !isPlaying && !isLoading && currentTrack) {
        executePlaybackNow(currentTrack, { startSeconds: initialSession.currentTime || 0 });
      }
    }, 180);
  }

  return controller;
}
