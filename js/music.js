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
  buildAudiusLookupQueries,
  buildCleanAudioLookupQuery,
  clampMusicFabPosition,
  computeSafeResumeSeconds,
  createUserPlaylist,
  dedupeMatchingAltTracks,
  deleteUserPlaylist,
  extractYouTubeVideoId,
  filterFullLengthTracks,
  filterPresetCategoryTracks,
  formatAudioTime,
  getLoadingProgressMeta,
  getPopoverAnchorClasses,
  getSilentHoldPcmSample,
  getValidCachedStreamUrl,
  hasPendingSeekSettled,
  isBlockedAudioWrapperUrl,
  isInstantAudioPreviewUrl,
  isMobileTouchPlatform,
  isStrictAudioMatch,
  isStrictSongMetadataMatch,
  isTrackInWatchLater,
  mergeRealtimeTrendCategories,
  needsCorsAnonymousAudio,
  normalizeItunesTrack,
  normalizeMusicLibraryState,
  normalizeRepeatMode,
  normalizeYtMusicTrack,
  parseSavedVolume,
  pickBackgroundSafeNextTrack,
  pickPrewarmQueueCandidates,
  pickShuffledViralTrack,
  pruneAndSerializeStreamCache,
  rankSearchResults,
  removeTrackFromPlaylist,
  renameUserPlaylist,
  resolvePipHeadsetStateTransition,
  scoreSearchRelevance,
  selectTiooAudioStreamCandidates,
  selectUmmyAudioStreamCandidates,
  serializeMusicTrack,
  shouldAutoSkipOnPlaybackError,
  shouldIgnoreTimeUpdateDuringPendingSeek,
  shouldKeepSilentHoldBridgeActive,
  shouldPoisonExactYoutubeIdOnError,
  shouldStopSilentHoldAndPauseNotification,
  shuffleTracksFisherYates,
  toggleTrackInWatchLater,
} from './music-logic.js?v=60';

const MUSIC_POS_KEY = 'manifestudio_music_pos_v2';
const MUSIC_VOL_KEY = 'manifestudio_music_vol_v2';
const MUSIC_SHUFFLE_KEY = 'manifestudio_music_shuffle_v2';
const MUSIC_REPEAT_KEY = 'manifestudio_music_repeat_v2';
const MUSIC_SESSION_KEY = 'manifestudio_music_session_v1';
const MUSIC_CLICK_PLAY_KEY = 'manifestudio_music_clickplay_v1';
const LEGACY_MUSIC_STREAM_CACHE_KEY = 'manifestudio_music_stream_cache_v1';
const MUSIC_STREAM_CACHE_KEY = 'manifestudio_music_stream_cache_v2';
const MUSIC_HEADSET_MODE_KEY = 'manifestudio_music_headset_v1';

// Community open-source YT Music / YouTube search API endpoints + parallel Tioo/Ummy audio stream resolvers
const SIPUTZX_YT_SEARCH_URL = 'https://api.siputzx.my.id/api/s/youtube';
const SIPUTZX_UMMY_URL = 'https://api.siputzx.my.id/api/d/ummy';
const TIOO_BACKENDS = [
  'https://backend1.tioo.eu.org',
  'https://backend2.tioo.eu.org',
  'https://backend3.tioo.eu.org',
  'https://backend4.tioo.eu.org',
];
const AUDIUS_API_BASE = 'https://api.audius.co/v1';
const ytExactStreamCache = new Map();
const ytExactInFlight = new Map();
const trackStreamInFlight = new Map();
const failedExactVideoIds = new Set();
const failedStreamUrls = new Set();
const failedYtIframeVideoIds = new Set();
let activeUserResolveCount = 0;

function readPersistedStreamCacheMap() {
  try {
    localStorage.removeItem(LEGACY_MUSIC_STREAM_CACHE_KEY);
    const raw = localStorage.getItem(MUSIC_STREAM_CACHE_KEY);
    if (!raw) return {};
    return pruneAndSerializeStreamCache(JSON.parse(raw));
  } catch {
    return {};
  }
}

function writePersistedStreamCacheMap(mapObj) {
  try {
    const pruned = pruneAndSerializeStreamCache(mapObj);
    localStorage.setItem(MUSIC_STREAM_CACHE_KEY, JSON.stringify(pruned));
    return pruned;
  } catch {
    return mapObj || {};
  }
}

function getCachedStreamUrl(videoId) {
  const cleanId = extractYouTubeVideoId(videoId);
  if (!cleanId) return '';
  if (ytExactStreamCache.has(cleanId)) {
    const memUrl = ytExactStreamCache.get(cleanId) || '';
    const validMem = getValidCachedStreamUrl({ [cleanId]: { url: memUrl, savedAt: Date.now() } }, cleanId);
    if (validMem && !failedStreamUrls.has(validMem)) return validMem;
    ytExactStreamCache.delete(cleanId);
  }
  const persisted = readPersistedStreamCacheMap();
  const validPersisted = getValidCachedStreamUrl(persisted, cleanId);
  if (validPersisted && !failedStreamUrls.has(validPersisted)) {
    ytExactStreamCache.set(cleanId, validPersisted);
    return validPersisted;
  }
  return '';
}

function persistResolvedStreamUrl(videoId, streamUrl) {
  const cleanId = extractYouTubeVideoId(videoId);
  const url = String(streamUrl || '').trim();
  if (!cleanId || !url || failedStreamUrls.has(url) || isBlockedAudioWrapperUrl(url)) return;
  ytExactStreamCache.set(cleanId, url);
  const persisted = readPersistedStreamCacheMap();
  persisted[cleanId] = { url, savedAt: Date.now() };
  writePersistedStreamCacheMap(persisted);
}

function invalidateCachedStreamUrl(videoId, streamUrl = '') {
  const cleanId = extractYouTubeVideoId(videoId);
  if (streamUrl) failedStreamUrls.add(streamUrl);
  if (cleanId && (!streamUrl || ytExactStreamCache.get(cleanId) === streamUrl)) {
    ytExactStreamCache.delete(cleanId);
    const persisted = readPersistedStreamCacheMap();
    if (persisted[cleanId]) {
      delete persisted[cleanId];
      writePersistedStreamCacheMap(persisted);
    }
  }
}

function hydrateTrackStreamFromCache(track) {
  if (!track || typeof track !== 'object') return track;
  if (track.streamUrl && (isBlockedAudioWrapperUrl(track.streamUrl) || isInstantAudioPreviewUrl(track.streamUrl))) {
    track.streamUrl = '';
  }
  if (track.streamUrl && !failedStreamUrls.has(track.streamUrl)) {
    return track;
  }
  if (track.videoId) {
    const cached = getCachedStreamUrl(track.videoId);
    if (cached) {
      track.streamUrl = cached;
    }
  }
  return track;
}

const MUSIC_NODE_COOLDOWN_MS = 180000;
const musicNodeCircuit = new Map();

function isMusicNodeOpen(url) {
  try {
    const origin = new URL(url).origin;
    // Never circuit-break core multi-track APIs on per-video 404/503 responses
    if (
      origin.includes('siputzx.my.id') ||
      origin.includes('itunes.apple.com') ||
      origin.includes('audius.co')
    ) {
      return false;
    }
    const entry = musicNodeCircuit.get(origin);
    if (!entry) return false;
    const threshold = origin.includes('vidsnap.app') ? 1 : 2;
    if (entry.failures >= threshold && Date.now() - entry.lastFailedAt < MUSIC_NODE_COOLDOWN_MS) {
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
    if (
      origin.includes('siputzx.my.id') ||
      origin.includes('itunes.apple.com') ||
      origin.includes('audius.co')
    ) {
      return;
    }
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

// Curated YT Music categories (auto-enriched in real time from YT Music & Audius live trends)
export const MUSIC_PRESET_CATEGORIES = [
  {
    id: 'trending-live',
    label: 'Sedang Tren',
    iconKey: 'flame',
    badge: 'Live',
    keywords: ['trending', 'viral', 'terbaru', 'hits', 'chart', '2026'],
    queries: [
      'Lagu Trending YouTube Music Indonesia Hari Ini',
      'Top Charts Music Indonesia 2026',
    ],
  },
  {
    id: 'viral-indo',
    label: 'Viral Indonesia',
    iconKey: 'sparkles',
    badge: 'Top',
    keywords: ['viral', 'tiktok', 'indonesia', 'fvp'],
    queries: [
      'Lagu Viral Indonesia 2026',
      'Top Hits Indonesia Terpopuler',
      'Lagu Viral TikTok Indonesia 2026',
    ],
  },
  {
    id: 'pop-galau',
    label: 'Pop & Galau Indo',
    iconKey: 'heart',
    keywords: ['galau', 'pop', 'bernadya', 'hindia', 'tulus', 'mahalini', 'lyodra'],
    queries: [
      'Pop Indonesia Bernadya Hindia Tulus',
      'Lagu Galau Indonesia Populer Full',
    ],
  },
  {
    id: 'dj-remix',
    label: 'DJ Remix & JJ',
    iconKey: 'disc',
    keywords: ['dj', 'remix', 'jedag', 'jedug', 'bass', 'electronic', 'edm'],
    queries: [
      'DJ Remix Viral TikTok Indonesia Full Bass',
      'Whisnu Santika Feel Koplo Remix',
    ],
  },
  {
    id: 'koplo-dangdut',
    label: 'Koplo & Dangdut',
    iconKey: 'music',
    keywords: ['koplo', 'dangdut', 'jawa', 'denny', 'caknan', 'ndx', 'campursari'],
    queries: [
      'NDX AKA Denny Caknan Guyon Waton',
      'Dangdut Koplo Viral Indonesia Terbaru',
    ],
  },
  {
    id: 'indie-akustik',
    label: 'Indie & Akustik',
    iconKey: 'guitar',
    keywords: ['indie', 'akustik', 'acoustic', 'folk', 'senja', 'fourtwnty', 'hindia'],
    queries: [
      'Musik Indie Indonesia Hindia Raim Laode Batas Senja',
      'Lagu Akustik Indonesia Viral',
    ],
  },
  {
    id: 'western-global',
    label: 'Hits Global',
    iconKey: 'globe',
    keywords: ['english', 'western', 'billboard', 'global', 'bruno', 'taylor', 'billie'],
    queries: [
      'Top Global English Hits 2026 Full Audio',
      'Bruno Mars Lady Gaga Billie Eilish Pop Hits',
    ],
  },
  {
    id: 'kpop-asian',
    label: 'K-Pop & Asian',
    iconKey: 'star',
    keywords: ['kpop', 'k-pop', 'korea', 'jpop', 'anime', 'bts', 'blackpink', 'aespa'],
    queries: [
      'K-Pop Viral Hits 2026 Full Audio',
      'J-Pop Yoasobi Fujii Kaze Popular Songs',
    ],
  },
  {
    id: 'hiphop-rnb',
    label: 'Hip-Hop & R&B',
    iconKey: 'mic',
    keywords: ['hip-hop', 'hiphop', 'rap', 'r&b', 'rnb', 'trap'],
    queries: [
      'Hip Hop R&B Indonesia Viral Full',
      'Chill R&B Rap Global Hits',
    ],
  },
  {
    id: 'rock-alt',
    label: 'Rock & Alternatif',
    iconKey: 'bolt',
    keywords: ['rock', 'band', 'alternatif', 'alternative', 'metal', 'punk'],
    queries: [
      'Band Rock Pop Alternatif Indonesia Sheila On 7 Dewa 19',
      'Last Child For Revenge Lagu Band Populer',
    ],
  },
  {
    id: 'religi-sholawat',
    label: 'Religi & Sholawat',
    iconKey: 'moon',
    keywords: ['sholawat', 'religi', 'islami', 'nissa', 'maher', 'hadroh'],
    queries: [
      'Sholawat Penyejuk Hati Merdu Terbaru',
      'Lagu Religi Islami Populer Indonesia',
    ],
  },
  {
    id: 'lofi-focus',
    label: 'Lo-Fi & Fokus',
    iconKey: 'headphones',
    keywords: ['lofi', 'lo-fi', 'chill', 'belajar', 'kerja', 'instrumental', 'santai'],
    queries: [
      'Lofi Chill Beats Study Focus Full Mix',
      'Instrumental Santai Kerja Kopi Musik',
    ],
  },
  {
    id: 'nostalgia-indo',
    label: 'Nostalgia 90s–00s',
    iconKey: 'clock',
    keywords: ['nostalgia', '90an', '2000an', 'lawas', 'peterpan', 'ungu', 'kangen'],
    queries: [
      'Lagu Indonesia 2000an Terbaik Peterpan Ungu Armada',
      'Tembang Nostalgia Pop Indonesia Terbaik',
    ],
  },
  {
    id: 'daerah-timur',
    label: 'Lagu Timur & Daerah',
    iconKey: 'compass',
    keywords: ['timur', 'amq', 'ambon', 'papua', 'batak', 'sunda', 'minang'],
    queries: [
      'Lagu Timur Viral Indonesia Ambon Papua Full',
      'Lagu Minang Batak Sunda Viral Terbaru',
    ],
  },
];

// Pre-seeded real Viral Indonesia catalog: 30 verified 100% full-length (156s–354s) tracks
// with verified real YouTube videoIds + direct full-length audio streams (zero 30-second previews!)
export const SEED_VIRAL_INDO_TRACKS = [
  normalizeYtMusicTrack({
    videoId: 'k0ubS6BhHu4',
    title: 'Garam & Madu (Sakit Dadaku)',
    artist: 'Tenxi, Naykilla & Jemsii',
    duration: 251,
    genre: 'Viral Indonesia',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/Nlzyaxp/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'JENpTmMQBQY',
    title: 'Mangu',
    artist: 'Fourtwnty',
    duration: 262,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/7O8YZgj/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'yjnSX_iUFVo',
    title: 'Satu Bulan',
    artist: 'Bernadya',
    duration: 200,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
  }),
  normalizeYtMusicTrack({
    videoId: 's6H6ffS6zJI',
    title: 'Nanti Kita Seperti Ini',
    artist: 'Batas Senja',
    duration: 210,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
  }),
  normalizeYtMusicTrack({
    videoId: 'JPVhHpE1gog',
    title: 'Betty (feat. White Chorus)',
    artist: 'Hindia',
    duration: 265,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/MoPA5xm/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'Wh66ThpxvI4',
    title: 'Sisa Rasa',
    artist: 'Mahalini',
    duration: 328,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/6xM2m/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'Svz5F8J1Ap0',
    title: 'Melawan Restu',
    artist: 'Mahalini',
    duration: 260,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/mWgk2/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'aHPUWgYgees',
    title: 'Tukar Jiwa',
    artist: 'Tulus',
    duration: 230,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/bl5QX/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: '_N6vSc_mT6I',
    title: 'Hati-Hati di Jalan',
    artist: 'Tulus',
    duration: 242,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/Oxg4V/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'QqJ-Vp8mvbk',
    title: 'Monokrom',
    artist: 'Tulus',
    duration: 208,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/82Yvv/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'kcc9Kfip2uw',
    title: 'Secukupnya',
    artist: 'Hindia',
    duration: 263,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/KxAdo/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: '-9qV_tSpS9c',
    title: 'Evakuasi',
    artist: 'Hindia',
    duration: 218,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/Byxgj/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'bGsMkd8qHWI',
    title: 'Serana',
    artist: 'For Revenge',
    duration: 243,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/52rE1/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: '5k6IkftDRwE',
    title: 'Rumah Singgah',
    artist: 'Fabio Asher',
    duration: 245,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/aZ5g38A/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'oIYWenB637c',
    title: 'To The Bone',
    artist: 'Pamungkas',
    duration: 318,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/82Nw9/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'zgSfpOOuI6Q',
    title: 'Widodari (feat. Guyon Waton)',
    artist: 'Denny Caknan',
    duration: 296,
    genre: 'Koplo & Dangdut',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/8YdyW/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'yIesFy7fVPQ',
    title: 'Wegah Pisah (Hiphop Dangdut)',
    artist: 'NDX A.K.A.',
    duration: 346,
    genre: 'Koplo & Dangdut',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/dWGyv/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'p3_RV_c6O9M',
    title: 'Jump (Whisnu Santika & Adnan Veron Edit)',
    artist: 'Whisnu Santika & Adnan Veron',
    duration: 156,
    genre: 'DJ Remix TikTok',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/7YM4OJ7/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'ywg5Vg5xiXk',
    title: 'Feel Koplo Edit — Awas Dangdut Viral',
    artist: 'Feel Koplo',
    duration: 206,
    genre: 'DJ Remix TikTok',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/aPgMr/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'pz9bGfyVlXQ',
    title: 'Dulu — Lagu Viral Indonesia',
    artist: 'Danar Widianto',
    duration: 215,
    genre: 'Viral Indonesia',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/ZRrjQ/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: '4tAg2H7tqD0',
    title: 'Sephia',
    artist: 'Sheila On 7',
    duration: 294,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/NbP3YZ/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: '1-U3I5jRf6A',
    title: 'Waktu Yang Salah',
    artist: 'Fiersa Besari',
    duration: 324,
    genre: 'Indie Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/REWzj/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 's9NoBV_7yVI',
    title: 'Bukti',
    artist: 'Virgoun',
    duration: 305,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/1dBdW/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: '0pu9khqEpi4',
    title: 'Percayalah',
    artist: 'Last Child',
    duration: 224,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/p9WJG/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: '8zwz2fVgfVM',
    title: 'Duka',
    artist: 'Last Child',
    duration: 339,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/ZRpd4/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'Ske9Nwk-TmA',
    title: 'Seluruh Nafas Ini (feat. Giselle)',
    artist: 'Last Child',
    duration: 294,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/dW1ry/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'PlK_crOqt64',
    title: 'Lagu Galau',
    artist: 'Al Ghazali',
    duration: 248,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
  }),
  normalizeYtMusicTrack({
    videoId: 'QrupIQIGIqI',
    title: 'Dua Cincin',
    artist: 'Hello',
    duration: 276,
    genre: 'Pop & Galau Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
  }),
  normalizeYtMusicTrack({
    videoId: 'b5ZQob-mDGM',
    title: 'Hingga Tua Bersama',
    artist: 'Rizky Febian',
    duration: 266,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/aa3kQ/stream?app_name=Manifestudio',
  }),
  normalizeYtMusicTrack({
    videoId: 'SWcMwUySDvI',
    title: 'Mungkin Nanti',
    artist: 'Peterpan',
    duration: 269,
    genre: 'Pop Viral Indo',
    isIndonesianViral: true,
    sourceLabel: 'YT Music · Full Audio',
    streamUrl: 'https://api.audius.co/v1/tracks/BygGA/stream?app_name=Manifestudio',
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
        const restoredTrack = parsed.lastTrack ? normalizeYtMusicTrack(parsed.lastTrack) : null;
        return {
          explicitPaused: Boolean(parsed.explicitPaused),
          wasPlaying: Boolean(parsed.wasPlaying),
          lastTrackId: String(parsed.lastTrackId || restoredTrack?.id || ''),
          lastTrack: restoredTrack,
          currentTime: Math.max(0, Number(parsed.currentTime) || 0),
          trackSelectionSource: parsed.trackSelectionSource === 'user' ? 'user' : 'auto',
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
    lastTrack: null,
    currentTime: 0,
    trackSelectionSource: 'auto',
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
  if (partial.lastTrack) {
    next.lastTrack = serializeMusicTrack(partial.lastTrack) || prev.lastTrack || null;
  }
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
      4500
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

async function fetchAudiusTrendingTracks(limit = 8) {
  try {
    const json = await fetchJsonTimeout(
      `${AUDIUS_API_BASE}/tracks/trending?app_name=Manifestudio&limit=${limit}`,
      4200
    );
    const items = Array.isArray(json?.data) ? json.data : [];
    return items
      .map((item) => {
        if (!item?.id || !item?.title) return null;
        return {
          id: `aud-${item.id}`,
          title: item.title,
          artist: item.user?.name || item.user?.handle || '',
          genre: item.genre || '',
          duration: Number(item.duration || 0),
          streamUrl:
            item.is_streamable !== false && Number(item.duration || 0) >= MIN_FULL_TRACK_SECONDS
              ? `${AUDIUS_API_BASE}/tracks/${encodeURIComponent(item.id)}/stream?app_name=Manifestudio`
              : '',
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function probeAudioElementMetadata(url, timeoutMs = 4500) {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined' || (typeof document !== 'undefined' && document.hidden)) {
      resolve(false);
      return;
    }
    let settled = false;
    const probe = new Audio();
    probe.dataset.musicInternal = 'true';
    probe.preload = 'metadata';
    probe.muted = true;
    if (needsCorsAnonymousAudio(url)) {
      probe.crossOrigin = 'anonymous';
    }
    const cleanup = () => {
      probe.onloadedmetadata = null;
      probe.oncanplay = null;
      probe.onerror = null;
      try {
        probe.pause();
        probe.removeAttribute('src');
        probe.load();
      } catch {
        // Ignore cleanup errors
      }
    };
    const finish = (ok, markFailed = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (!ok && markFailed) {
        failedStreamUrls.add(url);
      }
      cleanup();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false, false), timeoutMs);
    probe.onloadedmetadata = () => finish(true, false);
    probe.oncanplay = () => finish(true, false);
    probe.onerror = () => finish(false, true);
    try {
      probe.src = url;
    } catch {
      finish(false, true);
    }
  });
}

async function probePlayableAudioStream(url, timeoutMs = 3800) {
  const clean = String(url || '').trim();
  if (!clean || isBlockedAudioWrapperUrl(clean) || failedStreamUrls.has(clean)) {
    return false;
  }
  if (/vidsnap\.app/i.test(clean) && isMusicNodeOpen('https://api.vidsnap.app/')) {
    return false;
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(clean, {
      headers: { Range: 'bytes=0-128' },
      cache: 'no-store',
      signal: ac.signal,
    });
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    if ((res.ok || res.status === 206) && !ct.includes('text/html')) {
      if (/vidsnap\.app/i.test(clean)) recordMusicNodeResult('https://api.vidsnap.app/', true);
      try {
        await res.body?.cancel?.();
      } catch {
        // Ignore stream cancel error
      }
      return true;
    }
    if (/vidsnap\.app/i.test(clean) && (res.status === 403 || res.status >= 500)) {
      recordMusicNodeResult('https://api.vidsnap.app/', false);
    }
    if (res.status === 403 || res.status === 404 || res.status === 410 || ct.includes('text/html')) {
      failedStreamUrls.add(clean);
    }
    return false;
  } catch (err) {
    if (err?.name === 'AbortError') {
      return false;
    }
    if (needsCorsAnonymousAudio(clean) && typeof document !== 'undefined' && !document.hidden) {
      return probeAudioElementMetadata(clean, Math.min(timeoutMs, 3000));
    }
    failedStreamUrls.add(clean);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function resolveFirstTruthy(promises) {
  return new Promise((resolve) => {
    if (!Array.isArray(promises) || promises.length === 0) {
      resolve('');
      return;
    }
    let settled = 0;
    let done = false;
    for (const p of promises) {
      Promise.resolve(p)
        .then((val) => {
          if (!done && val) {
            done = true;
            resolve(val);
          }
        })
        .catch(() => {})
        .finally(() => {
          settled += 1;
          if (!done && settled >= promises.length) {
            resolve('');
          }
        });
    }
  });
}

function browserSupportsOpusAudio() {
  try {
    if (typeof Audio === 'undefined') return true;
    const testEl = new Audio();
    const res = testEl.canPlayType('audio/webm; codecs="opus"') || testEl.canPlayType('audio/ogg; codecs="opus"');
    return Boolean(res && res !== 'no');
  } catch {
    return true;
  }
}

async function resolveSiputzxUmmyAudioStream(ytUrl) {
  const canPlayOpus = browserSupportsOpusAudio();
  if (isMusicNodeOpen('https://api.vidsnap.app/')) return '';
  try {
    const data = await fetchJsonTimeout(`${SIPUTZX_UMMY_URL}?url=${encodeURIComponent(ytUrl)}`, 10500);
    const allCandidates = selectUmmyAudioStreamCandidates(data, { canPlayOpus });
    if (allCandidates.length === 0) return '';
    const safeCandidates = allCandidates
      .filter((c) => {
        try {
          return !decodeURIComponent(c).includes('gcr=id');
        } catch {
          return true;
        }
      })
      .slice(0, 2);
    for (const cand of safeCandidates.length > 0 ? safeCandidates : allCandidates.slice(0, 1)) {
      if (failedStreamUrls.has(cand)) continue;
      if (/vidsnap\.app/i.test(cand) && isMusicNodeOpen('https://api.vidsnap.app/')) continue;
      const ok = await probePlayableAudioStream(cand, 2600).catch(() => false);
      if (ok) return cand;
    }
  } catch {
    // Ignore transient Ummy timeout
  }
  return '';
}

async function resolveTiooAudioStream(ytUrl) {
  if (isMusicNodeOpen('https://api.vidsnap.app/')) return '';
  const encoded = encodeURIComponent(ytUrl);
  for (const host of TIOO_BACKENDS.slice(0, 2)) {
    if (isMusicNodeOpen('https://api.vidsnap.app/')) break;
    const endpoint = `${host}/youtube?url=${encoded}`;
    try {
      const data = await fetchJsonTimeout(endpoint, 5800);
      const candidates = selectTiooAudioStreamCandidates(data);
      if (candidates.length === 0) continue;
      const nonIdCandidates = candidates.filter((c) => {
        try {
          const decoded = decodeURIComponent(c);
          return !/[?&]gcr=id(?:[&#]|$)/i.test(decoded);
        } catch {
          return true;
        }
      });
      const prioritized = nonIdCandidates.length > 0 ? nonIdCandidates : candidates;
      for (const cand of prioritized.slice(0, 1)) {
        if (failedStreamUrls.has(cand)) continue;
        if (/vidsnap\.app/i.test(cand) && isMusicNodeOpen('https://api.vidsnap.app/')) continue;
        const ok = await probePlayableAudioStream(cand, 2400).catch(() => false);
        if (ok) return cand;
      }
    } catch {
      // Try next backend cleanly
    }
  }
  return '';
}

async function resolveExactYoutubeAudioStream(videoId, { bypassCache = false } = {}) {
  const cleanId = extractYouTubeVideoId(videoId);
  if (!cleanId) return '';
  if (!bypassCache && failedExactVideoIds.has(cleanId)) return '';
  if (!bypassCache) {
    const cached = getCachedStreamUrl(cleanId);
    if (cached) return cached;
  }
  if (!bypassCache && ytExactInFlight.has(cleanId)) {
    return ytExactInFlight.get(cleanId);
  }
  if (isMusicNodeOpen('https://api.vidsnap.app/')) return '';

  const ytUrl = `https://www.youtube.com/watch?v=${cleanId}`;

  const job = (async () => {
    try {
      // Race Tioo extractor against Siputzx Ummy cleanly
      const winner = await resolveFirstTruthy([
        resolveTiooAudioStream(ytUrl),
        resolveSiputzxUmmyAudioStream(ytUrl),
      ]);

      if (winner && !failedStreamUrls.has(winner)) {
        failedExactVideoIds.delete(cleanId);
        persistResolvedStreamUrl(cleanId, winner);
        return winner;
      }
    } finally {
      ytExactInFlight.delete(cleanId);
    }
    return '';
  })();

  ytExactInFlight.set(cleanId, job);
  return job;
}

async function fetchSiputzxYoutubeItems(query, timeoutMs = 10500) {
  const q = String(query || '').trim();
  if (!q) return [];
  const url = `${SIPUTZX_YT_SEARCH_URL}?query=${encodeURIComponent(q)}`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const json = await fetchJsonTimeout(url, timeoutMs);
      const items = Array.isArray(json?.data) ? json.data : [];
      if (items.length > 0) return items;
    } catch {
      // Retry after brief pause on transient timeout/rate-limit hiccup
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 550 * (attempt + 1)));
    }
  }
  return [];
}

async function fetchRawYoutubeCandidates(query, limit = 12) {
  const q = String(query || '').trim();
  if (!q) return [];
  const results = [];
  const seenIds = new Set();
  const pushItem = (item) => {
    const norm = normalizeYtMusicTrack(item, { sourceLabel: 'YT Music API', fromYtSearch: true });
    if (norm?.videoId && !seenIds.has(norm.videoId)) {
      seenIds.add(norm.videoId);
      results.push(norm);
    }
  };

  const items = await fetchSiputzxYoutubeItems(q, 9000);
  items.slice(0, limit).forEach(pushItem);

  return results;
}

async function resolveBackgroundStreamForTrack(track, { allowAltYt = true, bypassCache = false, priority = false } = {}) {
  if (!track) return '';
  if (!bypassCache) {
    hydrateTrackStreamFromCache(track);
    if (track.streamUrl && !failedStreamUrls.has(track.streamUrl)) {
      return track.streamUrl;
    }
    track.streamUrl = '';
  }

  const inflightKey = `${track.id || track.videoId || track.title}:${allowAltYt ? 'alt' : 'exact'}`;
  if (!bypassCache && trackStreamInFlight.has(inflightKey)) {
    return trackStreamInFlight.get(inflightKey);
  }

  if (priority) activeUserResolveCount += 1;
  const job = (async () => {
    try {
      const seedMatch = SEED_VIRAL_INDO_TRACKS.find(
        (s) =>
          s.streamUrl &&
          !failedStreamUrls.has(s.streamUrl) &&
          ((track.videoId && s.videoId === track.videoId) || isStrictAudioMatch(track, s))
      );
      if (seedMatch?.streamUrl) {
        track.streamUrl = seedMatch.streamUrl;
        if (track.videoId) persistResolvedStreamUrl(track.videoId, seedMatch.streamUrl);
        return track.streamUrl;
      }

      const audiusQueries = buildAudiusLookupQueries(track);
      const cleanQuery = audiusQueries[0] || buildCleanAudioLookupQuery(track) || `${track.title || ''} ${track.artist || ''}`.trim();

      // 1. Try full-length (>=75s) Audius direct stream first (zero 403 proxy dependency)
      if (audiusQueries.length > 0) {
        const candidatePool = [];
        if (track._audiusCandidateUrl && !failedStreamUrls.has(track._audiusCandidateUrl)) {
          candidatePool.push({ streamUrl: track._audiusCandidateUrl });
        }
        for (const aq of audiusQueries) {
          const matches = await fetchAudiusDirectTracks(aq, {
            genre: track.genre || 'Viral Indonesia',
            isIndonesianViral: Boolean(track.isIndonesianViral),
            limit: 12,
          }).catch(() => []);
          for (const a of matches) {
            if (a.streamUrl && !failedStreamUrls.has(a.streamUrl) && isStrictAudioMatch(track, a)) {
              if (!candidatePool.some((c) => c.streamUrl === a.streamUrl)) {
                candidatePool.push(a);
              }
            }
          }
          for (const hit of candidatePool.slice(0, 3)) {
            const ok = await probePlayableAudioStream(hit.streamUrl, 2800).catch(() => false);
            if (ok) {
              track.streamUrl = hit.streamUrl;
              if (track.videoId) persistResolvedStreamUrl(track.videoId, hit.streamUrl);
              return hit.streamUrl;
            }
          }
        }
      }

      // 2. Fallback to exact YouTube audio extractor only when Audius had no verified stream
      if (
        track.videoId &&
        (bypassCache || !failedExactVideoIds.has(track.videoId)) &&
        !isMusicNodeOpen('https://api.vidsnap.app/')
      ) {
        const exactWinner = await resolveExactYoutubeAudioStream(track.videoId, { bypassCache }).catch(() => '');
        if (exactWinner && !failedStreamUrls.has(exactWinner) && !isBlockedAudioWrapperUrl(exactWinner)) {
          track.streamUrl = exactWinner;
          persistResolvedStreamUrl(track.videoId, exactWinner);
          return exactWinner;
        }
      }

      if (allowAltYt && cleanQuery && !isMusicNodeOpen('https://api.vidsnap.app/')) {
        const fetchedAlts = await fetchRawYoutubeCandidates(cleanQuery, 8).catch(() => []);
        const matchingAlts = dedupeMatchingAltTracks(track, [...SEED_VIRAL_INDO_TRACKS, ...fetchedAlts], {
          failedIds: failedExactVideoIds,
          maxAlts: 2,
        });
        if (matchingAlts.length > 0) {
          const altWinner = await resolveFirstTruthy(
            matchingAlts.map((alt) => resolveExactYoutubeAudioStream(alt.videoId))
          );
          if (altWinner && !failedStreamUrls.has(altWinner) && !isBlockedAudioWrapperUrl(altWinner)) {
            track.streamUrl = altWinner;
            if (track.videoId) persistResolvedStreamUrl(track.videoId, altWinner);
            return altWinner;
          }
        }
      }

      return '';
    } finally {
      if (priority) activeUserResolveCount = Math.max(0, activeUserResolveCount - 1);
      trackStreamInFlight.delete(inflightKey);
    }
  })();

  trackStreamInFlight.set(inflightKey, job);
  return job;
}

async function fetchYtMusicSearch(query, { genre = 'YT Music', isIndonesianViral = true, limit = 24 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  // Run full-length Audius Direct and Siputzx YT Search in PARALLEL (never 30s iTunes previews!)
  const [audiusItems, siputzxItems] = await Promise.all([
    fetchAudiusDirectTracks(q, { genre, isIndonesianViral, limit: 12 }).catch(() => []),
    fetchSiputzxYoutubeItems(q, 10500)
      .then((items) => {
        const normalized = items
          .map((item) =>
            normalizeYtMusicTrack(item, {
              genre,
              isIndonesianViral,
              sourceLabel: 'YT Music API',
              fromYtSearch: true,
            })
          )
          .filter(Boolean);
        const full = filterFullLengthTracks(normalized, MIN_FULL_TRACK_SECONDS);
        return (full.length > 0 ? full : normalized).slice(0, Math.max(limit, 24));
      })
      .catch(() => []),
  ]);

  const ytMap = new Map();
  for (const item of siputzxItems) {
    const key = item?.videoId ? `yt-${item.videoId}` : item?.id;
    if (key && !ytMap.has(key)) {
      hydrateTrackStreamFromCache(item);
      ytMap.set(key, item);
    }
  }
  const rawYtItems = [...ytMap.values()];
  const rankedYtItems = rankSearchResults(rawYtItems, q, MIN_FULL_TRACK_SECONDS, {
    allowYoutubeSearchOrder: true,
  });
  const ytItems = (
    rankedYtItems.length > 0 ? rankedYtItems : filterFullLengthTracks(rawYtItems, MIN_FULL_TRACK_SECONDS)
  ).slice(0, limit);

  // Attach verified full-length native <audio> streamUrl from curated Seed tracks immediately,
  // and store Audius search hits as unverified candidates so prewarm/resolve probes them cleanly without 403/429 spam!
  for (let i = 0; i < ytItems.length; i += 1) {
    const yt = ytItems[i];
    if (yt.streamUrl) continue;
    const seedHit = SEED_VIRAL_INDO_TRACKS.find(
      (s) => s.streamUrl && ((yt.videoId && s.videoId === yt.videoId) || isStrictAudioMatch(yt, s))
    );
    if (seedHit?.streamUrl) {
      yt.streamUrl = seedHit.streamUrl;
      persistResolvedStreamUrl(yt.videoId, seedHit.streamUrl);
      continue;
    }
    const strictAudMatch = audiusItems.find((a) => isStrictAudioMatch(yt, a));
    if (strictAudMatch?.streamUrl) {
      yt._audiusCandidateUrl = strictAudMatch.streamUrl;
    }
  }

  const combined = [...ytItems];
  const relevantDirect = rankSearchResults(audiusItems, q, MIN_FULL_TRACK_SECONDS, {
    allowYoutubeSearchOrder: false,
  });
  for (const dirItem of relevantDirect) {
    if (
      !combined.some(
        (c) =>
          c.id === dirItem.id ||
          (dirItem.streamUrl && c.streamUrl === dirItem.streamUrl) ||
          isStrictAudioMatch(c, dirItem)
      )
    ) {
      combined.push(dirItem);
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
  const existingGlobal = typeof window !== 'undefined' ? window.__manifestudioMusic || null : null;
  if (controllerSingleton || existingGlobal || typeof document === 'undefined') {
    return controllerSingleton || existingGlobal;
  }

  // Native HTML5 <audio> Background-Safe Engine & YouTube IFrame Engine shell
  // Do NOT set crossOrigin='anonymous' on <audio> so redirected streams never fail CORS checks
  // Do NOT set audio.hidden=true (display:none) so mobile browsers never deprioritize background playback
  const audio = new Audio();
  audio.id = 'music-audio-el';
  audio.className = 'music-bg-audio-el';
  audio.dataset.musicInternal = 'true';
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
  SEED_VIRAL_INDO_TRACKS.forEach(hydrateTrackStreamFromCache);
  musicLibrary.watchLater.forEach(hydrateTrackStreamFromCache);
  musicLibrary.playlists.forEach((pl) => {
    if (Array.isArray(pl.tracks)) pl.tracks.forEach(hydrateTrackStreamFromCache);
  });
  let tracks = shuffleTracksFisherYates(SEED_VIRAL_INDO_TRACKS);
  let poolLoaded = false;
  let poolPromise = null;
  let activeCategory = 'viral-indo';
  let liveCategories = MUSIC_PRESET_CATEGORIES.map((c) => ({ ...c }));
  let liveTrendChips = [];
  let trendUpdatedAt = 0;
  let isSyncingTrends = false;
  let activeQueueMode = 'catalog'; // 'catalog' | 'watch-later' | 'playlist'
  let activeQueuePlaylistId = '';
  const restoredLibraryTracks = [
    ...musicLibrary.watchLater,
    ...musicLibrary.playlists.flatMap((pl) => pl.tracks || []),
  ];
  const restoredPoolMatch =
    (initialSession.lastTrackId &&
      [...SEED_VIRAL_INDO_TRACKS, ...restoredLibraryTracks].find(
        (t) => t.id === initialSession.lastTrackId || t.videoId === initialSession.lastTrackId
      )) ||
    null;
  let currentTrack = restoredPoolMatch
    ? {
        ...restoredPoolMatch,
        streamUrl: initialSession.lastTrack?.streamUrl || restoredPoolMatch.streamUrl || '',
      }
    : initialSession.lastTrack || null;
  if (currentTrack) hydrateTrackStreamFromCache(currentTrack);
  let trackSelectionSource = currentTrack && initialSession.trackSelectionSource === 'user' ? 'user' : 'auto';
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
  let loadingPhase = 'idle';
  let loadingProgress = 0;
  let loadingLabel = '';
  let loadingTicker = null;
  let isSeeking = false;
  let isSwitchingSource = false;
  let isSilentHold = false;
  let audioElUnlocked = false;
  let isUnlockingAudio = false;
  let suppressNextFabClick = false;
  let lastError = '';
  let consecutiveErrors = 0;
  let currentTime = Number(initialSession.currentTime) || 0;
  let duration = currentTrack?.duration || 0;
  let pendingSeekSeconds = 0;
  let pendingYtSeekSeconds = 0;
  let lastGoodTrackId = currentTrack?.id || '';
  let lastGoodPositionSec = Math.max(0, Number(initialSession.currentTime) || 0);
  let lastSessionSaveAt = 0;
  let pendingPlayTrack = null;
  let pendingPlayStartSeconds = 0;
  let activeEngine = 'audio-el';
  let requestSerial = 0;
  let backgroundHandoffInFlight = false;
  let pausedDueToBackgroundWait = false;
  let backgroundAttemptDoneForTrackId = '';
  let hiddenTransitionAt = 0;
  let isPipOpen = false;
  let pipHeadsetMode = false;
  try {
    pipHeadsetMode = localStorage.getItem(MUSIC_HEADSET_MODE_KEY) === 'true';
  } catch {
    pipHeadsetMode = false;
  }
  let pipStatusMessage = '';
  let pipCanvas = null;
  let pipVideo = null;
  let pipArtImg = null;
  let pipArtLoadedSrc = '';
  const recentTrackIds = [];
  const playHistory = [];
  const blockedVideoIds = new Set();
  const subscribers = new Set();

  let ytPlayer = null;
  let ytReady = false;
  let timeTicker = null;
  let bgWatchdogTimer = null;
  let silentAudioCtx = null;
  let silentOscillator = null;
  let silentWavUrl = '';
  let lastAutoNextAt = 0;
  let lastFocusTransitionAt = 0;
  let autoResumeAttempts = 0;

  const isDesktopBrowser =
    typeof navigator !== 'undefined'
      ? !isMobileTouchPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)
      : true;

  function getYtPlayerStateSafe() {
    if (!ytReady || !ytPlayer || typeof ytPlayer.getPlayerState !== 'function') return -1;
    try {
      const s = Number(ytPlayer.getPlayerState());
      return Number.isFinite(s) ? s : -1;
    } catch {
      return -1;
    }
  }

  audio.volume = volume;

  function beginLoadingProgress(phase, label, initialPct = 22) {
    if (loadingTicker) {
      clearInterval(loadingTicker);
      loadingTicker = null;
    }
    loadingPhase = phase;
    loadingLabel = label;
    loadingProgress = Math.max(10, Math.min(92, initialPct));
    loadingTicker = setInterval(() => {
      if (!isSearching && !isLoading && !isSyncingTrends) {
        clearInterval(loadingTicker);
        loadingTicker = null;
        return;
      }
      if (loadingProgress < 90) {
        const step = loadingProgress < 55 ? 9 : loadingProgress < 78 ? 5 : 2;
        loadingProgress = Math.min(92, loadingProgress + step);
        notifySubscribers('progress');
        renderLoadingMiniIndicator();
      }
    }, 340);
  }

  function advanceLoadingProgress(pct, label = '') {
    loadingProgress = Math.max(loadingProgress, Math.min(96, pct));
    if (label) loadingLabel = label;
    notifySubscribers('progress');
    renderLoadingMiniIndicator();
  }

  function finishLoadingProgress() {
    if (loadingTicker) {
      clearInterval(loadingTicker);
      loadingTicker = null;
    }
    loadingPhase = 'idle';
    loadingProgress = 0;
    loadingLabel = '';
  }

  function renderLoadingMiniIndicator() {
    const strip = root.querySelector('#music-mini-loader-strip');
    if (!strip) return;
    const meta = getLoadingProgressMeta({
      isSearching,
      isLoading,
      isSyncingTrends,
      phase: loadingPhase,
      label: loadingLabel,
      progress: loadingProgress,
    });
    if (!meta.active) {
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    const lbl = strip.querySelector('.ytm-mini-loader-label');
    const pctEl = strip.querySelector('.ytm-mini-loader-pct');
    const fill = strip.querySelector('.ytm-mini-loader-fill');
    if (lbl) lbl.textContent = meta.label;
    if (pctEl) pctEl.textContent = `${meta.percent}%`;
    if (fill) fill.style.width = `${meta.percent}%`;
  }

  function getSilentHoldWavUrl() {
    if (silentWavUrl) return silentWavUrl;
    try {
      // Build a 10-second 8kHz mono 8-bit PCM WAV with sub-perceptual 40Hz micro-dither (+/-1 PCM step ~ -42 dBFS)
      // Inaudible to human ears, yet satisfies Android/iOS OS audibility checks to preserve lock-screen background audio focus.
      const sampleRate = 8000;
      const numSamples = 80000;
      const buffer = new ArrayBuffer(44 + numSamples);
      const view = new DataView(buffer);
      const writeStr = (offset, s) => {
        for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
      };
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numSamples, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true);
      writeStr(36, 'data');
      view.setUint32(40, numSamples, true);
      const pcm = new Uint8Array(buffer, 44);
      for (let i = 0; i < numSamples; i += 1) {
        pcm[i] = getSilentHoldPcmSample(i, sampleRate);
      }
      silentWavUrl = URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
      return silentWavUrl;
    } catch {
      return 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    }
  }

  function configureAudioCors(url) {
    if (needsCorsAnonymousAudio(url)) {
      audio.crossOrigin = 'anonymous';
    } else {
      audio.removeAttribute('crossorigin');
    }
  }

  function recordGoodPosition(track, sec, { force = false } = {}) {
    if (!track?.id) return;
    const val = Math.max(0, Number(sec) || 0);
    if (force || track.id !== lastGoodTrackId) {
      lastGoodTrackId = track.id;
      lastGoodPositionSec = val;
    } else if (val > 0.5) {
      lastGoodPositionSec = val;
    }
  }

  function getResumeSecondsForTrack(track = currentTrack) {
    if (!track?.id) return 0;
    const saved = readMusicSession();
    const sameSaved =
      saved.lastTrackId === track.id || (Boolean(track.videoId) && saved.lastTrack?.videoId === track.videoId);
    const sameGood = lastGoodTrackId === track.id;
    return computeSafeResumeSeconds({
      currentTime,
      sessionTime: sameSaved ? saved.currentTime : 0,
      lastGoodTime: sameGood ? lastGoodPositionSec : 0,
      sameTrack: true,
      duration: duration || track.duration || 0,
    });
  }

  function applyPendingAudioSeek() {
    if (isSilentHold || activeEngine !== 'audio-el' || pendingSeekSeconds <= 0.5) return;
    if (audio.readyState < 1) return;
    const dur =
      Number.isFinite(audio.duration) && audio.duration > 4
        ? audio.duration
        : duration || currentTrack?.duration || 0;
    const target = dur > 4 ? Math.min(pendingSeekSeconds, Math.max(0, dur - 1.5)) : pendingSeekSeconds;
    if (target <= 0.5) {
      pendingSeekSeconds = 0;
      return;
    }
    if (Math.abs((audio.currentTime || 0) - target) <= 2.5) {
      pendingSeekSeconds = 0;
      return;
    }
    try {
      audio.currentTime = target;
      currentTime = target;
      recordGoodPosition(currentTrack, target);
    } catch {
      // Retry when loadedmetadata/canplay/durationchange fires
    }
  }

  function ensureBackgroundAudioKeepAlive() {
    if (typeof window === 'undefined') return;
    try {
      if (typeof navigator !== 'undefined' && 'audioSession' in navigator && navigator.audioSession) {
        navigator.audioSession.type = 'playback';
      }
    } catch {
      // Ignore audioSession assignment error
    }
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

  function startSilentHoldForBackgroundTransition({ force = false } = {}) {
    if (explicitPaused) return;
    const holdUrl = getSilentHoldWavUrl();
    const hasActiveRealAudioStream =
      activeEngine === 'audio-el' &&
      !isSilentHold &&
      Boolean(audio.src) &&
      audio.src !== holdUrl &&
      !audio.paused &&
      !audio.error;
    if (
      !force &&
      !shouldKeepSilentHoldBridgeActive({
        activeEngine,
        isPlaying: isPlaying || true,
        isLoading: isLoading || true,
        explicitPaused,
        hasActiveRealAudioStream,
      })
    ) {
      return;
    }
    try {
      isSilentHold = true;
      audioElUnlocked = true;
      audio.removeAttribute('crossorigin');
      audio.loop = true;
      audio.muted = false;
      // Keep non-zero OS-audible volume (~0.08–0.18 with -42dBFS PCM dither -> -64dBFS effective)
      // so mobile Android/iOS MediaSession never drops background focus during fast resolve transitions
      audio.volume = isMuted ? 0 : Math.max(0.08, Math.min(0.18, volume));
      if (audio.src !== holdUrl) {
        audio.src = holdUrl;
      }
      if (audio.paused) {
        const p = audio.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            if (isSilentHold) {
              isSilentHold = false;
              audioElUnlocked = false;
            }
          });
        }
      }
    } catch {
      isSilentHold = false;
      audioElUnlocked = false;
    }
  }

  function stopSilentHold({ clearSrc = false } = {}) {
    if (isSilentHold) {
      isSilentHold = false;
    }
    audio.loop = false;
    if (clearSrc && activeEngine !== 'audio-el') {
      try {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      } catch {
        // Ignore clear errors
      }
    }
  }

  function stopSilentHoldAndSyncPaused({ pauseYt = true } = {}) {
    stopSilentHold({ clearSrc: activeEngine !== 'audio-el' || isSilentHold });
    if (activeEngine !== 'audio-el' && !audio.paused) {
      try {
        audio.pause();
      } catch {
        // Ignore audio pause error
      }
    }
    if (pauseYt && ytReady && ytPlayer?.pauseVideo) {
      try {
        ytPlayer.pauseVideo();
      } catch {
        // Ignore YT pause error
      }
    }
    stopTimeTicker();
    stopBackgroundWatchdog();
    if (silentAudioCtx && silentAudioCtx.state === 'running') {
      silentAudioCtx.suspend().catch(() => {});
    }
    syncMediaPositionState();
  }

  function pauseSilentHoldOnBackgroundFailure(reason = 'bg-unavailable') {
    const ytState = getYtPlayerStateSafe();
    if (isDesktopBrowser && activeEngine === 'yt-iframe' && (ytState === 1 || ytState === 3 || ytReady)) {
      stopSilentHold({ clearSrc: true });
      if (ytPlayer?.playVideo && ytState !== 1 && ytState !== 3 && !explicitPaused) {
        try {
          ytPlayer.playVideo();
        } catch {
          // Ignore
        }
      }
      isPlaying = true;
      isLoading = false;
      startTimeTicker();
      renderWidget();
      notifySubscribers('play');
      return;
    }
    const resumeSec = getResumeSecondsForTrack(currentTrack);
    currentTime = resumeSec;
    recordGoodPosition(currentTrack, resumeSec);
    if (currentTrack?.id) {
      backgroundAttemptDoneForTrackId = currentTrack.id;
    }
    pausedDueToBackgroundWait = true;
    isPlaying = false;
    isLoading = false;
    stopSilentHoldAndSyncPaused({ pauseYt: true });
    saveMusicSession({
      explicitPaused: false,
      wasPlaying: false,
      lastTrackId: currentTrack?.id || '',
      lastTrack: currentTrack,
      currentTime: resumeSec,
      trackSelectionSource,
    });
    lastError =
      reason === 'bg-timeout'
        ? 'Audio latar belakang lagu ini lambat merespons. Ketuk Putar untuk coba lagi atau buka di YT.'
        : 'Audio latar belakang lagu ini sedang dibatasi server. Ketuk Putar saat di layar utama.';
    renderWidget();
    notifySubscribers('pause');
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
    const progressMeta = getLoadingProgressMeta({
      isSearching,
      isLoading,
      isSyncingTrends,
      phase: loadingPhase,
      label: loadingLabel,
      progress: loadingProgress,
    });
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
      categories: liveCategories,
      liveTrendChips,
      trendUpdatedAt,
      isSyncingTrends,
      loadingPhase: progressMeta.phase,
      loadingProgress: progressMeta.percent,
      loadingLabel: progressMeta.label,
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
      isSilentHold,
      isPipOpen,
      pipHeadsetMode,
      pipStatusMessage,
      ytReady,
      canPrev: playHistory.length > 1 || activeList.length > 1,
      watchLater: musicLibrary.watchLater,
      playlists: musicLibrary.playlists,
    };
  }

  function ensurePipVideoElement() {
    if (typeof document === 'undefined') return null;
    if (pipVideo && pipCanvas) return pipVideo;
    try {
      pipCanvas = document.createElement('canvas');
      pipCanvas.width = 480;
      pipCanvas.height = 270;
      pipVideo = document.createElement('video');
      pipVideo.id = 'ytm-pip-video';
      pipVideo.className = 'ytm-pip-video-hidden';
      pipVideo.dataset.musicInternal = 'true';
      pipVideo.muted = true;
      pipVideo.playsInline = true;
      pipVideo.setAttribute('playsinline', '');
      pipVideo.setAttribute('webkit-playsinline', '');
      pipVideo.setAttribute('aria-hidden', 'true');
      if ('autoPictureInPicture' in pipVideo) {
        pipVideo.autoPictureInPicture = !pipHeadsetMode;
      }
      document.body.appendChild(pipVideo);
      drawPipCanvasFrame();
      if (typeof pipCanvas.captureStream === 'function') {
        const stream = pipCanvas.captureStream(10);
        pipVideo.srcObject = stream;
      }
      pipVideo.addEventListener('leavepictureinpicture', () => {
        if (!pipHeadsetMode && isPipOpen) {
          // Keep floating web PiP card synchronized or close cleanly
          renderWidget();
          notifySubscribers('pip');
        }
      });
    } catch {
      // Ignore PiP canvas init error
    }
    return pipVideo;
  }

  function drawPipCanvasFrame() {
    if (!pipCanvas) return;
    try {
      const ctx = pipCanvas.getContext('2d');
      if (!ctx) return;
      const active = currentTrack || tracks[0] || SEED_VIRAL_INDO_TRACKS[0];
      const w = pipCanvas.width;
      const h = pipCanvas.height;
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.55, '#1e1b4b');
      grad.addColorStop(1, '#31102f');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const artUrl = active?.artwork || active?.artworkFallback || '';
      if (artUrl && pipArtLoadedSrc !== artUrl && typeof Image !== 'undefined') {
        pipArtLoadedSrc = artUrl;
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          pipArtImg = img;
        };
        img.src = artUrl;
      }
      if (pipArtImg && pipArtImg.complete && pipArtImg.naturalWidth > 0) {
        try {
          ctx.drawImage(pipArtImg, 24, 38, 150, 150);
        } catch {
          // Ignore cross-origin draw error
        }
      } else {
        ctx.fillStyle = '#ff0033';
        ctx.fillRect(24, 38, 150, 150);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 54px sans-serif';
        ctx.fillText('♪', 82, 132);
      }

      ctx.fillStyle = '#fda4af';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('MANIFESTUDIO YT MUSIC • GAMBAR DALAM GAMBAR', 194, 58);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';
      const titleStr = String(active?.title || 'YT Music Viral Indonesia').slice(0, 26);
      ctx.fillText(titleStr, 194, 98);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '600 16px sans-serif';
      const artistStr = String(active?.artist || 'Artis Indonesia').slice(0, 30);
      ctx.fillText(artistStr, 194, 128);

      ctx.fillStyle = '#7dd3fc';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('🎧 Klik Headset untuk sembunyikan PiP (musik tetap jalan)', 194, 168);

      const durSec = duration || active?.duration || 180;
      const curSec = Math.min(durSec, Math.max(0, currentTime || 0));
      const pct = durSec > 0 ? Math.min(1, curSec / durSec) : 0;
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(24, 218, w - 48, 8);
      ctx.fillStyle = '#ff0033';
      ctx.fillRect(24, 218, Math.round((w - 48) * pct), 8);
    } catch {
      // Ignore canvas draw error
    }
  }

  function applyPipHeadsetTransition(action) {
    const nextState = resolvePipHeadsetStateTransition({
      isPipOpen,
      pipHeadsetMode,
      isPlaying: isPlaying || isLoading,
      action,
    });
    isPipOpen = nextState.isPipOpen;
    pipHeadsetMode = nextState.pipHeadsetMode;
    try {
      localStorage.setItem(MUSIC_HEADSET_MODE_KEY, String(pipHeadsetMode));
    } catch {
      // Ignore storage error
    }
    if (pipVideo && 'autoPictureInPicture' in pipVideo) {
      pipVideo.autoPictureInPicture = !pipHeadsetMode;
    }
    if (nextState.shouldExitNativePip && typeof document !== 'undefined' && document.pictureInPictureElement) {
      try {
        document.exitPictureInPicture?.().catch(() => {});
      } catch {
        // Ignore
      }
    }
    // CRITICAL mobile background stability: NEVER create/play a muted <video> element during
    // `auto-pip-background` (visibilitychange), as spawning a <video> interrupts native <audio> focus on Android/iOS!
    if (isPipOpen && !pipHeadsetMode && action === 'enter-pip') {
      const vid = ensurePipVideoElement();
      drawPipCanvasFrame();
      if (vid && typeof vid.requestPictureInPicture === 'function' && document.pictureInPictureEnabled) {
        vid
          .play()
          .then(() => vid.requestPictureInPicture?.())
          .catch(() => {});
      }
    }
    if (nextState.shouldKeepPlaying && !explicitPaused) {
      ensureBackgroundAudioKeepAlive();
      if (activeEngine === 'audio-el' && audio.paused && !audio.ended && audio.src && !isSwitchingSource) {
        audio.play().catch(() => {});
      }
    }
    pipStatusMessage = pipHeadsetMode
      ? '🎧 Mode Headset aktif: Gambar dalam Gambar disembunyikan & lagu tetap berputar.'
      : isPipOpen
      ? 'Gambar dalam Gambar (PiP) aktif.'
      : '';
    renderWidget();
    notifySubscribers('pip');
    return nextState;
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
      if (isSilentHold && (explicitPaused || (!isPlaying && !isLoading))) {
        stopSilentHoldAndSyncPaused({ pauseYt: false });
        return;
      }
      if (explicitPaused || (!isPlaying && !isLoading)) return;
      if (isSilentHold && audio.paused && !isSwitchingSource) {
        ensureBackgroundAudioKeepAlive();
        audio.play().catch(() => {});
      }
      if (activeEngine === 'yt-iframe') {
        // Proactively upgrade yt-iframe to native <audio> as soon as a streamUrl is ready (even in foreground!)
        if (
          currentTrack?.streamUrl &&
          !failedStreamUrls.has(currentTrack.streamUrl) &&
          !backgroundHandoffInFlight
        ) {
          handoffToBackgroundSafeAudio('fg-watchdog-upgrade');
          return;
        }
        const isHidden = typeof document !== 'undefined' && document.hidden;
        if (isHidden) {
          if (!hiddenTransitionAt) hiddenTransitionAt = Date.now();
          const ytState = getYtPlayerStateSafe();
          if (
            !isDesktopBrowser &&
            isSilentHold &&
            !backgroundHandoffInFlight &&
            ytState !== 1 &&
            ytState !== 3 &&
            Date.now() - hiddenTransitionAt > 20000
          ) {
            pauseSilentHoldOnBackgroundFailure('bg-timeout');
            return;
          }
          if (
            !backgroundHandoffInFlight &&
            currentTrack &&
            backgroundAttemptDoneForTrackId !== currentTrack.id
          ) {
            handoffToBackgroundSafeAudio('bg-watchdog-upgrade');
          }
        } else if (!isSilentHold) {
          // Ensure silent-hold bridge remains active while yt-iframe plays in foreground
          startSilentHoldForBackgroundTransition({ force: true });
        }
        return;
      }
      if (activeEngine === 'audio-el' && !isSilentHold) {
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
          applyPendingAudioSeek();
          audio.play().catch(() => {});
        }
        syncMediaPositionState();
      }
    }, 1200);
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
        if (isSilentHold || isSwitchingSource) return;
        const rawCur = Number.isFinite(audio.currentTime) ? audio.currentTime : cur;
        if (shouldIgnoreTimeUpdateDuringPendingSeek({ pendingSeekSeconds, reportedTime: rawCur })) {
          applyPendingAudioSeek();
          return;
        }
        if (hasPendingSeekSettled({ pendingSeekSeconds, reportedTime: rawCur })) {
          pendingSeekSeconds = 0;
        }
        // Protect against accidental 0 clobber while audio buffer reloads after background transition
        if (
          rawCur < 0.8 &&
          lastGoodTrackId === currentTrack?.id &&
          lastGoodPositionSec > 3 &&
          Date.now() - lastFocusTransitionAt < 5000
        ) {
          pendingSeekSeconds = lastGoodPositionSec;
          applyPendingAudioSeek();
          return;
        }
        cur = rawCur;
        if (Number.isFinite(audio.duration) && audio.duration > 0) dur = audio.duration;
      } else if (ytReady && ytPlayer) {
        try {
          const ytCur = ytPlayer.getCurrentTime?.();
          const ytDur = ytPlayer.getDuration?.();
          if (pendingYtSeekSeconds > 1.5) {
            if (Number.isFinite(ytCur) && Math.abs(ytCur - pendingYtSeekSeconds) <= 3) {
              pendingYtSeekSeconds = 0;
              cur = ytCur;
            } else {
              return;
            }
          } else if (Number.isFinite(ytCur)) {
            // Never overwrite valid saved progress with 0 if iframe paused/reset during focus transition
            if (ytCur < 0.8 && lastGoodTrackId === currentTrack?.id && lastGoodPositionSec > 2.5) {
              return;
            }
            if (ytCur >= 0) cur = ytCur;
          }
          if (Number.isFinite(ytDur) && ytDur > 0) dur = ytDur;
        } catch {
          // Ignore YT read error
        }
      }
      if (Math.abs(cur - currentTime) >= 0.25 || Math.abs(dur - duration) >= 1) {
        currentTime = cur;
        duration = dur;
        recordGoodPosition(currentTrack, cur);
        const nowTick = Date.now();
        if (nowTick - lastSessionSaveAt >= 2500) {
          lastSessionSaveAt = nowTick;
          saveMusicSession({
            explicitPaused,
            wasPlaying: isPlaying,
            lastTrackId: currentTrack?.id || '',
            lastTrack: currentTrack,
            currentTime,
          });
        }
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
      try {
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const offset = Number(details?.seekOffset) || 10;
          controller.seekToSeconds(Math.max(0, (currentTime || 0) - offset));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const offset = Number(details?.seekOffset) || 10;
          const maxDur = duration || currentTrack?.duration || 300;
          controller.seekToSeconds(Math.min(maxDur, (currentTime || 0) + offset));
        });
      } catch {
        // Ignore if seekbackward/seekforward unsupported
      }
      try {
        navigator.mediaSession.setActionHandler('enterpictureinpicture', () => {
          controller.enterPiP();
        });
      } catch {
        // Ignore if enterpictureinpicture action is unsupported
      }
      syncMediaPositionState();
    } catch {
      // Ignore unsupported mediaSession handlers
    }
  }

  async function handoffToBackgroundSafeAudio(reason = 'background', explicitResumeSec = null) {
    if (explicitPaused || backgroundHandoffInFlight) return false;
    backgroundHandoffInFlight = true;
    try {
      const target = currentTrack;
      if (!target) return false;
      if (target.streamUrl && failedStreamUrls.has(target.streamUrl)) {
        target.streamUrl = '';
      }
      if (!target.streamUrl) {
        await resolveBackgroundStreamForTrack(target, { allowAltYt: true, priority: true });
      }
      // Strictly abort handoff if user changed track or paused while resolving,
      // and NEVER replace user's chosen track with a random catalog track!
      if (
        explicitPaused ||
        currentTrack?.id !== target.id ||
        !target.streamUrl ||
        failedStreamUrls.has(target.streamUrl)
      ) {
        backgroundAttemptDoneForTrackId = target.id;
        const isHiddenNow = typeof document !== 'undefined' && Boolean(document.hidden);
        if (
          currentTrack?.id === target.id &&
          shouldStopSilentHoldAndPauseNotification({
            activeEngine,
            isSilentHold,
            resolvedStreamUrl: target.streamUrl,
            isHidden: isHiddenNow,
            explicitPaused,
            timedOutOrFailed: true,
            isDesktopBrowser,
            ytPlayerState: getYtPlayerStateSafe(),
          })
        ) {
          pauseSilentHoldOnBackgroundFailure('bg-unavailable');
        }
        return false;
      }

      let liveSec =
        explicitResumeSec !== null && Number.isFinite(Number(explicitResumeSec))
          ? Math.max(0, Number(explicitResumeSec))
          : getResumeSecondsForTrack(target);
      if (activeEngine === 'yt-iframe' && ytReady && ytPlayer?.getCurrentTime) {
        try {
          const ytSec = ytPlayer.getCurrentTime();
          if (Number.isFinite(ytSec) && ytSec > 0.8) {
            liveSec = Math.max(liveSec, ytSec);
          }
        } catch {
          // Ignore YT read error
        }
      }
      const prevEngine = activeEngine;
      const resumeSec = liveSec > 1 ? liveSec : 0;
      currentTrack = target;
      currentTime = resumeSec;
      pendingSeekSeconds = resumeSec > 1 ? resumeSec : 0;
      pendingYtSeekSeconds = 0;
      pausedDueToBackgroundWait = false;
      backgroundAttemptDoneForTrackId = '';
      recordGoodPosition(target, resumeSec, { force: true });
      activeEngine = 'audio-el';
      isSwitchingSource = true;
      stopSilentHold();
      audio.loop = false;
      configureAudioCors(target.streamUrl);
      if (audio.src !== target.streamUrl) {
        audio.src = target.streamUrl;
      }
      audio.muted = isMuted;
      audio.volume = isMuted ? 0 : volume;
      ensureBackgroundAudioKeepAlive();
      const playProm = audio.play();
      isSwitchingSource = false;
      try {
        await playProm;
      } catch (playErr) {
        // If native <audio> play failed while yt-iframe can stay alive (foreground or desktop/laptop), keep yt-iframe alive
        const isHiddenNow = typeof document !== 'undefined' && Boolean(document.hidden);
        if ((isDesktopBrowser || !isHiddenNow) && prevEngine === 'yt-iframe' && ytReady && ytPlayer) {
          invalidateCachedStreamUrl(target.videoId, target.streamUrl);
          target.streamUrl = '';
          activeEngine = 'yt-iframe';
          startSilentHoldForBackgroundTransition({ force: true });
          try {
            if (getYtPlayerStateSafe() !== 1 && ytPlayer.playVideo) ytPlayer.playVideo();
          } catch {
            // Ignore
          }
          return false;
        }
        throw playErr;
      }
      try {
        if (ytReady && ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
      } catch {
        // Ignore
      }
      applyPendingAudioSeek();
      isPlaying = true;
      isLoading = false;
      lastError = '';
      consecutiveErrors = 0;
      startTimeTicker();
      syncMediaSession(target);
      saveMusicSession({
        explicitPaused: false,
        wasPlaying: true,
        lastTrackId: target.id,
        lastTrack: target,
        currentTime: resumeSec,
        trackSelectionSource,
      });
      renderWidget();
      notifySubscribers('play');
      return true;
    } catch {
      isSwitchingSource = false;
      const isHiddenNow = typeof document !== 'undefined' && Boolean(document.hidden);
      if (
        shouldStopSilentHoldAndPauseNotification({
          activeEngine,
          isSilentHold,
          resolvedStreamUrl: '',
          isHidden: isHiddenNow,
          explicitPaused,
          timedOutOrFailed: true,
          isDesktopBrowser,
          ytPlayerState: getYtPlayerStateSafe(),
        })
      ) {
        pauseSilentHoldOnBackgroundFailure('bg-unavailable');
      }
      return false;
    } finally {
      backgroundHandoffInFlight = false;
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
                const startSec =
                  pendingPlayStartSeconds > 0
                    ? pendingPlayStartSeconds
                    : getResumeSecondsForTrack(target);
                pendingPlayTrack = null;
                pendingPlayStartSeconds = 0;
                executePlaybackNow(target, { startSeconds: startSec });
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
                if (pendingYtSeekSeconds > 2) {
                  try {
                    const ytCurNow = Number(ytPlayer.getCurrentTime?.() || 0);
                    if (ytCurNow < Math.max(1.5, pendingYtSeekSeconds - 4)) {
                      ytPlayer.seekTo?.(pendingYtSeekSeconds, true);
                    }
                  } catch {
                    // Ignore YT seek error
                  }
                  pendingYtSeekSeconds = 0;
                }
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
                  lastTrack: currentTrack,
                  currentTime,
                  trackSelectionSource,
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
                // Mobile OS often fires YTState.PAUSED 50-300ms BEFORE visibilitychange/hidden flips true.
                // Never replace the user's chosen song with another song — resolve and hand off the EXACT same track!
                if (!explicitPaused) {
                  const isHiddenOrBlurred =
                    (typeof document !== 'undefined' && (document.hidden || !document.hasFocus?.())) ||
                    Date.now() - lastFocusTransitionAt < 5000;
                  if (isDesktopBrowser && ytReady && ytPlayer?.playVideo) {
                    try {
                      ytPlayer.playVideo();
                    } catch {
                      // Ignore
                    }
                  }
                  if (isHiddenOrBlurred) {
                    handoffToBackgroundSafeAudio('yt-hidden-pause').then((switched) => {
                      if (
                        switched ||
                        explicitPaused ||
                        pausedDueToBackgroundWait ||
                        activeEngine !== 'yt-iframe'
                      ) {
                        return;
                      }
                      if (ytReady && ytPlayer?.playVideo) {
                        try {
                          ytPlayer.playVideo();
                        } catch {
                          // Ignore
                        }
                      }
                    });
                    return;
                  }
                  setTimeout(() => {
                    if (
                      !explicitPaused &&
                      !pausedDueToBackgroundWait &&
                      activeEngine === 'yt-iframe' &&
                      typeof document !== 'undefined' &&
                      (document.hidden || !document.hasFocus?.())
                    ) {
                      handoffToBackgroundSafeAudio('yt-delayed-hidden-pause');
                    }
                  }, 140);
                  return;
                }
                if (!isLoading) {
                  isPlaying = false;
                  stopSilentHoldAndSyncPaused({ pauseYt: false });
                  renderWidget();
                  notifySubscribers('pause');
                }
              } else if (state === YTState.ENDED) {
                if (activeEngine !== 'yt-iframe') return;
                isPlaying = false;
                isLoading = false;
                stopSilentHoldAndSyncPaused({ pauseYt: false });
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
              // Try resolving an exact streamUrl (or strictly-matching alt upload of the EXACT same song) first!
              if (failedTrack && !explicitPaused) {
                isLoading = true;
                renderWidget();
                notifySubscribers('loading');
                const resolved = await resolveBackgroundStreamForTrack(failedTrack, {
                  allowAltYt: true,
                  priority: true,
                }).catch(() => '');
                if (
                  resolved &&
                  !failedStreamUrls.has(resolved) &&
                  currentTrack?.id === failedTrack.id &&
                  !explicitPaused
                ) {
                  executePlaybackNow(failedTrack, {
                    startSeconds: getResumeSecondsForTrack(failedTrack),
                  });
                  return;
                }
              }
              if (failedId && trackSelectionSource !== 'user') {
                blockedVideoIds.add(failedId);
                tracks = tracks.filter((t) => t.videoId !== failedId);
              }
              isPlaying = false;
              isLoading = false;
              consecutiveErrors += 1;
              if (
                !explicitPaused &&
                shouldAutoSkipOnPlaybackError({ trackSelectionSource, consecutiveErrors }) &&
                tracks.length > 0
              ) {
                lastError = 'Mengganti ke lagu YT Music lain yang tersedia...';
                controller.playNext({ reason: 'error-skip' });
              } else {
                stopSilentHoldAndSyncPaused({ pauseYt: true });
                lastError =
                  trackSelectionSource === 'user'
                    ? 'Sumber audio lagu ini sedang sibuk atau dibatasi. Ketuk Putar untuk coba lagi atau buka di YT.'
                    : 'Pemutar YT Music sedang menunggu koneksi atau memilih lagu lain.';
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
    const targetSec = Math.max(0, Number(startSec) || 0);
    pendingYtSeekSeconds = targetSec > 1.5 ? targetSec : 0;
    // Keep #music-audio-el actively playing the inaudible silent-hold bridge so the browser
    // never revokes background audio permission while yt-iframe is playing!
    startSilentHoldForBackgroundTransition({ force: true });
    if (!track?.videoId) return;
    if (ytReady && ytPlayer?.loadVideoById) {
      pendingPlayTrack = null;
      pendingPlayStartSeconds = 0;
      isLoading = true;
      renderWidget();
      notifySubscribers('loading');
      try {
        if (isMuted) ytPlayer.mute?.();
        else ytPlayer.unMute?.();
        ytPlayer.setVolume?.(Math.round(volume * 100));
        ytPlayer.loadVideoById({ videoId: track.videoId, startSeconds: targetSec });
        startTimeTicker();
      } catch {
        isLoading = false;
        renderWidget();
        notifySubscribers('error');
      }
    } else {
      pendingPlayTrack = track;
      pendingPlayStartSeconds = targetSec;
      isLoading = true;
      renderWidget();
      notifySubscribers('loading');
    }
  }

  let prewarmLoopRunning = false;
  let prewarmPendingTrigger = false;

  function propagateResolvedStreamToPools(targetTrack, resolvedUrl) {
    if (!targetTrack || !resolvedUrl || failedStreamUrls.has(resolvedUrl)) return;
    targetTrack.streamUrl = resolvedUrl;
    if (targetTrack.videoId) {
      persistResolvedStreamUrl(targetTrack.videoId, resolvedUrl);
    }
    const patchList = (list) => {
      if (!Array.isArray(list)) return;
      for (const item of list) {
        if (
          item &&
          (item.id === targetTrack.id || (targetTrack.videoId && item.videoId === targetTrack.videoId)) &&
          !item.streamUrl
        ) {
          item.streamUrl = resolvedUrl;
        }
      }
    };
    patchList(tracks);
    patchList(searchResults);
    patchList(SEED_VIRAL_INDO_TRACKS);
  }

  function scheduleStreamPrewarm(delayMs = 200) {
    prewarmPendingTrigger = true;
    if (prewarmLoopRunning) return;
    setTimeout(async () => {
      if (prewarmLoopRunning) return;
      prewarmLoopRunning = true;
      try {
        while (prewarmPendingTrigger) {
          prewarmPendingTrigger = false;
          const candidates = pickPrewarmQueueCandidates({
            currentTrack,
            activeQueue: getActiveQueueList(),
            searchResults,
            watchLater: musicLibrary.watchLater,
            playlists: musicLibrary.playlists,
            seedTracks: tracks,
            failedIds: failedExactVideoIds,
            failedUrls: failedStreamUrls,
            limit: 6,
          });
          // Serialized spaced prewarm (1 worker) so Audius never throws 429 rate-limit spikes
          for (const cand of candidates) {
            if (!cand) continue;
            if (activeUserResolveCount > 0) {
              prewarmPendingTrigger = true;
              await new Promise((r) => setTimeout(r, 950));
              continue;
            }
            hydrateTrackStreamFromCache(cand);
            if (cand.streamUrl && !failedStreamUrls.has(cand.streamUrl)) {
              propagateResolvedStreamToPools(cand, cand.streamUrl);
              continue;
            }
            const resolved = await resolveBackgroundStreamForTrack(cand, {
              allowAltYt: true,
              priority: false,
            }).catch(() => '');
            if (resolved) {
              propagateResolvedStreamToPools(cand, resolved);
            }
            await new Promise((r) => setTimeout(r, 380));
          }
        }
      } finally {
        prewarmLoopRunning = false;
      }
    }, delayMs);
  }

  function executePlaybackNow(track, { startSeconds = 0 } = {}) {
    if (!track) return;
    hydrateTrackStreamFromCache(track);
    const isSameTrackRestart = currentTrack?.id === track.id;
    const targetStart = Math.max(0, Number(startSeconds) || 0);
    currentTrack = track;
    currentTime = targetStart;
    duration = Number(track.duration || 0);
    pendingSeekSeconds = targetStart > 1 ? targetStart : 0;
    pendingYtSeekSeconds = targetStart > 1.5 ? targetStart : 0;
    pausedDueToBackgroundWait = false;
    backgroundAttemptDoneForTrackId = '';
    hiddenTransitionAt = typeof document !== 'undefined' && document.hidden ? Date.now() : 0;
    recordGoodPosition(track, targetStart, { force: true });
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
      lastTrack: track,
      currentTime,
      trackSelectionSource,
    });

    // Always prefer native HTML5 <audio> whenever a valid direct streamUrl exists so playback
    // NEVER stops when locking the screen, minimizing the browser, or switching tabs!
    if (track.streamUrl && !failedStreamUrls.has(track.streamUrl)) {
      activeEngine = 'audio-el';
      pendingPlayTrack = null;
      pendingPlayStartSeconds = 0;
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
      stopSilentHold();
      audio.loop = false;
      configureAudioCors(targetStreamUrl);
      const alreadyLoadedSameStream =
        isSameTrackRestart && audio.src === targetStreamUrl && !audio.error && audio.readyState >= 1;
      if (!alreadyLoadedSameStream) {
        audio.src = targetStreamUrl;
      } else if (targetStart >= 0 && Math.abs((audio.currentTime || 0) - targetStart) > 2) {
        pendingSeekSeconds = targetStart;
      } else {
        pendingSeekSeconds = 0;
      }
      audio.muted = isMuted;
      audio.volume = isMuted ? 0 : volume;
      renderWidget();
      notifySubscribers('loading');
      const playPromise = audio.play();
      isSwitchingSource = false;
      playPromise
        .then(() => {
          applyPendingAudioSeek();
          isPlaying = true;
          isLoading = false;
          consecutiveErrors = 0;
          startTimeTicker();
          syncMediaPositionState();
          renderWidget();
          notifySubscribers('play');
          // Pre-warm upcoming queue + playlist tracks cleanly in background
          scheduleStreamPrewarm(600);
        })
        .catch((err) => {
          if (explicitPaused || currentTrack?.id !== track.id) return;
          const fallbackResumeSec = getResumeSecondsForTrack(track);
          if (err?.name === 'NotAllowedError') {
            // Browser autoplay policy blocked unattended playback before a user tap:
            // keep the valid streamUrl and saved position intact so the first tap resumes it cleanly!
            isPlaying = false;
            isLoading = false;
            pendingSeekSeconds = fallbackResumeSec > 0.5 ? fallbackResumeSec : 0;
            stopSilentHoldAndSyncPaused({ pauseYt: false });
            renderWidget();
            notifySubscribers('pause');
            return;
          }
          invalidateCachedStreamUrl(track.videoId, targetStreamUrl);
          if (
            track.videoId &&
            shouldPoisonExactYoutubeIdOnError({
              videoId: track.videoId,
              failedStreamUrl: targetStreamUrl,
            })
          ) {
            failedExactVideoIds.add(track.videoId);
          }
          // Clear broken streamUrl on this track and resolve a fresh background stream (or play via YT IFrame while upgrading)
          track.streamUrl = '';
          const isTabHidden = typeof document !== 'undefined' && document.hidden;
          if (track.videoId && !failedYtIframeVideoIds.has(track.videoId) && !isTabHidden) {
            startYoutubePlaybackForTrack(track, fallbackResumeSec);
            resolveBackgroundStreamForTrack(track, {
              allowAltYt: true,
              bypassCache: true,
              priority: true,
            })
              .then((freshUrl) => {
                if (
                  freshUrl &&
                  !failedStreamUrls.has(freshUrl) &&
                  !isBlockedAudioWrapperUrl(freshUrl)
                ) {
                  propagateResolvedStreamToPools(track, freshUrl);
                  if (!explicitPaused && currentTrack?.id === track.id && activeEngine === 'yt-iframe') {
                    handoffToBackgroundSafeAudio('error-recovery-upgrade');
                  }
                }
              })
              .catch(() => {});
          } else {
            resolveBackgroundStreamForTrack(track, {
              allowAltYt: true,
              bypassCache: true,
              priority: true,
            })
              .then((freshUrl) => {
                if (
                  freshUrl &&
                  !failedStreamUrls.has(freshUrl) &&
                  !isBlockedAudioWrapperUrl(freshUrl) &&
                  !explicitPaused &&
                  currentTrack?.id === track.id
                ) {
                  propagateResolvedStreamToPools(track, freshUrl);
                  executePlaybackNow(track, { startSeconds: getResumeSecondsForTrack(track) });
                  return;
                }
                consecutiveErrors += 1;
                if (shouldAutoSkipOnPlaybackError({ trackSelectionSource, consecutiveErrors }) && tracks.length > 0) {
                  controller.playNext({ reason: 'error-skip' });
                } else {
                  isPlaying = false;
                  isLoading = false;
                  stopSilentHoldAndSyncPaused({ pauseYt: true });
                  lastError = 'Sumber audio lagu ini sedang bermasalah. Ketuk Putar untuk coba lagi.';
                  renderWidget();
                  notifySubscribers('error');
                }
              })
              .catch(() => {});
          }
        });
      return;
    }
    if (track.streamUrl && (failedStreamUrls.has(track.streamUrl) || isBlockedAudioWrapperUrl(track.streamUrl))) {
      track.streamUrl = '';
    }

    // Track does not have a cached direct streamUrl yet:
    // Unlock native <audio> inside the user gesture and race parallel Tioo/Ummy/Audius direct stream (3.6s window)
    // so mobile browsers lock onto native <audio> MediaSession inside the original user gesture!
    activeEngine = 'audio-el';
    isLoading = true;
    isPlaying = true;
    if (!isSearching) {
      beginLoadingProgress('buffering', 'Menyiapkan stream audio anti-henti...', 28);
    }
    startSilentHoldForBackgroundTransition({ force: true });
    renderWidget();
    notifySubscribers('loading');

    const bgPromise = resolveBackgroundStreamForTrack(track, { allowAltYt: true, priority: true });
    const isHiddenAtStart = typeof document !== 'undefined' && Boolean(document.hidden);
    const racePromise =
      (isDesktopBrowser || !isHiddenAtStart) && track.videoId && !failedYtIframeVideoIds.has(track.videoId)
        ? Promise.race([
            bgPromise,
            new Promise((resolve) => setTimeout(() => resolve('__YT_FAST_FALLBACK__'), 3600)),
          ])
        : bgPromise;

    racePromise
      .then((raceResult) => {
        if (explicitPaused || currentTrack?.id !== track.id) return;
        if (!isSearching) finishLoadingProgress();
        if (
          raceResult &&
          raceResult !== '__YT_FAST_FALLBACK__' &&
          !failedStreamUrls.has(raceResult) &&
          !isBlockedAudioWrapperUrl(raceResult)
        ) {
          propagateResolvedStreamToPools(track, raceResult);
          executePlaybackNow(track, { startSeconds: getResumeSecondsForTrack(track) });
          return;
        }
        const isHiddenNow = typeof document !== 'undefined' && Boolean(document.hidden);
        if (raceResult === '__YT_FAST_FALLBACK__' && isHiddenNow && !isDesktopBrowser) {
          bgPromise
            .then((lateUrl) => {
              if (explicitPaused || currentTrack?.id !== track.id) return;
              if (lateUrl && !failedStreamUrls.has(lateUrl) && !isBlockedAudioWrapperUrl(lateUrl)) {
                propagateResolvedStreamToPools(track, lateUrl);
                executePlaybackNow(track, { startSeconds: getResumeSecondsForTrack(track) });
              } else {
                pauseSilentHoldOnBackgroundFailure('bg-unavailable');
              }
            })
            .catch(() => {
              if (!explicitPaused && currentTrack?.id === track.id) {
                pauseSilentHoldOnBackgroundFailure('bg-unavailable');
              }
            });
          return;
        }
        // Start full-length YouTube IFrame (always allowed on desktop/laptop even in background tab, or foreground on mobile)
        if ((isDesktopBrowser || !isHiddenNow) && track.videoId && !failedYtIframeVideoIds.has(track.videoId)) {
          startYoutubePlaybackForTrack(track, getResumeSecondsForTrack(track));
          bgPromise
            .then((lateUrl) => {
              if (lateUrl && !failedStreamUrls.has(lateUrl) && !isBlockedAudioWrapperUrl(lateUrl)) {
                propagateResolvedStreamToPools(track, lateUrl);
                if (!explicitPaused && currentTrack?.id === track.id && activeEngine === 'yt-iframe') {
                  handoffToBackgroundSafeAudio('late-resolved-upgrade');
                }
              } else if (!explicitPaused && currentTrack?.id === track.id && activeEngine === 'yt-iframe') {
                setTimeout(() => {
                  if (explicitPaused || currentTrack?.id !== track.id || track.streamUrl) return;
                  resolveBackgroundStreamForTrack(track, {
                    allowAltYt: true,
                    bypassCache: true,
                    priority: true,
                  })
                    .then((retryUrl) => {
                      if (retryUrl && !failedStreamUrls.has(retryUrl) && !isBlockedAudioWrapperUrl(retryUrl)) {
                        propagateResolvedStreamToPools(track, retryUrl);
                        if (!explicitPaused && currentTrack?.id === track.id && activeEngine === 'yt-iframe') {
                          handoffToBackgroundSafeAudio('retry-resolved-upgrade');
                        }
                      }
                    })
                    .catch(() => {});
                }, 2000);
              }
            })
            .catch(() => {});
        } else {
          pauseSilentHoldOnBackgroundFailure('bg-unavailable');
        }
        scheduleStreamPrewarm(300);
      })
      .catch(() => {
        if (!isSearching) finishLoadingProgress();
        if (explicitPaused || currentTrack?.id !== track.id) return;
        if (track.videoId && !failedYtIframeVideoIds.has(track.videoId)) {
          startYoutubePlaybackForTrack(track, getResumeSecondsForTrack(track));
        }
      });
  }

  async function refreshRealtimeCategories({ force = false } = {}) {
    if (isSyncingTrends) return liveCategories;
    if (!force && trendUpdatedAt > 0 && Date.now() - trendUpdatedAt < 600000) {
      return liveCategories;
    }
    isSyncingTrends = true;
    notifySubscribers('trends');
    try {
      const [ytTrendItems, audiusTrending] = await Promise.all([
        fetchYtMusicSearch('Lagu Trending YouTube Music Indonesia Hari Ini', {
          genre: 'Sedang Tren',
          isIndonesianViral: true,
          limit: 10,
        }).catch(() => []),
        fetchAudiusTrendingTracks(8).catch(() => []),
      ]);
      const merged = mergeRealtimeTrendCategories(MUSIC_PRESET_CATEGORIES, {
        ytTrendItems,
        audiusTrending,
        syncedAt: Date.now(),
      });
      liveCategories = merged.categories;
      liveTrendChips = merged.trendChips;
      trendUpdatedAt = merged.updatedAt || Date.now();
    } catch {
      // Keep previous live categories cleanly
    } finally {
      isSyncingTrends = false;
      notifySubscribers('trends');
    }
    return liveCategories;
  }

  async function ensureTrackPool() {
    if (poolPromise) return poolPromise;
    poolPromise = (async () => {
      try {
        await new Promise((r) => setTimeout(r, 900));
        if (isSearching || activeUserResolveCount > 0) {
          poolLoaded = true;
          return tracks;
        }
        const preset = liveCategories.find((c) => c.id === activeCategory) || liveCategories[0];
        const primaryQuery = preset.queries[0] || 'Lagu Viral Indonesia 2026';
        const fetchedGroup = await fetchYtMusicSearch(primaryQuery, {
          genre: preset.label || 'Viral Indonesia',
          isIndonesianViral: true,
          limit: 16,
        }).catch(() => []);
        const merged = new Map(
          SEED_VIRAL_INDO_TRACKS.map((t) => [t.id, hydrateTrackStreamFromCache(t)])
        );
        const filteredFetched = filterPresetCategoryTracks(fetchedGroup, {
          minSeconds: MIN_FULL_TRACK_SECONDS,
          maxSeconds: 900,
        });
        for (const item of filteredFetched) {
          const key = item?.videoId ? `yt-${item.videoId}` : item?.id;
          if (key && (!item.videoId || !blockedVideoIds.has(item.videoId)) && !merged.has(key)) {
            merged.set(key, hydrateTrackStreamFromCache(item));
          }
        }
        const singlesOnly = filterPresetCategoryTracks([...merged.values()], {
          minSeconds: MIN_FULL_TRACK_SECONDS,
          maxSeconds: 900,
        });
        tracks = shuffleTracksFisherYates(singlesOnly.length > 0 ? singlesOnly : [...merged.values()]);
        poolLoaded = true;
        notifySubscribers('pool');
        scheduleStreamPrewarm(250);
        // Quietly sync real-time YT Music & Audius trending categories in background
        refreshRealtimeCategories().catch(() => {});
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
    drawPipCanvasFrame();
    const dur = duration || currentTrack?.duration || 180;
    const cur = Math.min(dur, Math.max(0, currentTime || 0));
    const pct = dur > 0 ? Math.min(100, (cur / dur) * 100) : 0;
    const pipFillEl = root.querySelector('#music-pip-progress-fill');
    const pipTimeEl = root.querySelector('#music-pip-time-label');
    if (pipFillEl) pipFillEl.style.width = `${pct}%`;
    if (pipTimeEl) pipTimeEl.textContent = `${formatAudioTime(cur)} / ${formatAudioTime(dur)}`;
    if (!isOpen || isSeeking) return;
    const slider = root.querySelector('#music-seek-slider');
    const timeEl = root.querySelector('#music-time-label');
    const fillEl = root.querySelector('#music-mini-progress-fill');
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
        id="music-pip-card"
        data-testid="music-pip-card"
        class="music-pip-card"
        role="region"
        aria-label="Gambar dalam Gambar (Picture-in-Picture) Pemutar Musik"
        ${isPipOpen && !pipHeadsetMode ? '' : 'hidden'}
      >
        <div class="music-pip-head">
          <span class="music-pip-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="11" y="11" width="9" height="7" rx="1" fill="currentColor"/></svg>
            <span>Gambar dalam Gambar</span>
          </span>
          <div class="music-pip-head-actions">
            <button
              type="button"
              id="music-pip-headset-btn"
              data-testid="music-pip-headset-btn"
              class="music-pip-headset-btn"
              data-music-control="true"
              title="Sembunyikan Gambar dalam Gambar namun lagu tetap berputar (Mode Headset)"
              aria-label="Mode Headset: Sembunyikan Gambar dalam Gambar namun lagu tetap berputar"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
              <span>Headset</span>
            </button>
            <button
              type="button"
              id="music-pip-close-btn"
              class="music-pip-close-btn"
              data-music-control="true"
              title="Tutup Gambar dalam Gambar"
              aria-label="Tutup Gambar dalam Gambar"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="music-pip-body">
          <div class="music-pip-art-wrap">
            ${
              active?.artwork
                ? `<img src="${escapeHtml(active.artwork)}" alt="" width="52" height="52" class="music-pip-art-img" onerror="this.src='${escapeHtml(active.artworkFallback || '')}'" />`
                : `<span class="music-art-fallback" aria-hidden="true">♪</span>`
            }
          </div>
          <div class="music-pip-meta">
            <strong class="music-pip-title" id="music-pip-title">${escapeHtml(currentTrack ? currentTrack.title : active?.title || 'YT Music Viral Indonesia')}</strong>
            <span class="music-pip-artist" id="music-pip-artist">${escapeHtml(currentTrack ? currentTrack.artist : active?.artist || 'Artis Indonesia')}</span>
          </div>
          <div class="music-pip-controls">
            <button
              type="button"
              id="music-pip-play-btn"
              class="music-pip-ctrl-btn is-primary"
              data-music-control="true"
              aria-label="${isPlaying ? 'Jeda lagu di PiP' : 'Putar lagu di PiP'}"
            >
              ${playIcon}
            </button>
            <button
              type="button"
              id="music-pip-next-btn"
              class="music-pip-ctrl-btn"
              data-music-control="true"
              aria-label="Lagu berikutnya di PiP"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><rect x="16.6" y="4" width="2.4" height="16" rx="1"/></svg>
            </button>
          </div>
        </div>

        <div class="music-pip-progress" aria-hidden="true">
          <div id="music-pip-progress-fill" class="music-pip-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="music-pip-foot-tip">
          <span>Ketuk 🎧 Headset agar PiP sembunyi &amp; musik tetap jalan</span>
          <span class="mono-num" id="music-pip-time-label">${formatAudioTime(curSec)} / ${formatAudioTime(durSec)}</span>
        </div>
      </div>

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
              class="music-icon-mini-btn ${isPipOpen && !pipHeadsetMode ? 'is-active' : ''}"
              id="music-mini-pip-btn"
              data-music-control="true"
              title="Gambar dalam Gambar (Picture-in-Picture)"
              aria-label="Buka atau tutup Gambar dalam Gambar"
              aria-pressed="${Boolean(isPipOpen && !pipHeadsetMode)}"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><rect x="11" y="11" width="9" height="7" rx="1" fill="currentColor"/></svg>
            </button>
            <button
              type="button"
              class="music-icon-mini-btn ${pipHeadsetMode ? 'is-headset-active' : ''}"
              id="music-mini-headset-btn"
              data-music-control="true"
              title="Mode Headset: Sembunyikan Gambar dalam Gambar namun lagu tetap berputar"
              aria-label="Aktifkan Mode Headset"
              aria-pressed="${Boolean(pipHeadsetMode)}"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
            </button>
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

        ${(() => {
          const loader = getLoadingProgressMeta({
            isSearching,
            isLoading,
            isSyncingTrends,
            phase: loadingPhase,
            label: loadingLabel,
            progress: loadingProgress,
          });
          return `
            <div id="music-mini-loader-strip" class="ytm-mini-loader-strip" ${loader.active ? '' : 'hidden'} role="status">
              <div class="ytm-mini-loader-head">
                <span class="ytm-mini-loader-label">${escapeHtml(loader.label || 'Memuat...')}</span>
                <span class="ytm-mini-loader-pct mono-num">${loader.percent}%</span>
              </div>
              <div class="ytm-mini-loader-track"><div class="ytm-mini-loader-fill" style="width: ${loader.percent}%"></div></div>
            </div>
          `;
        })()}

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

    root.querySelector('#music-pip-headset-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.activateHeadsetMode();
    });

    root.querySelector('#music-pip-close-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.closePiP();
    });

    root.querySelector('#music-pip-play-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.togglePlayPause();
    });

    root.querySelector('#music-pip-next-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.playNext({ userInitiated: true });
    });

    root.querySelector('#music-mini-pip-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.togglePiP();
    });

    root.querySelector('#music-mini-headset-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      controller.toggleHeadsetMode();
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

    enterPiP() {
      const next = applyPipHeadsetTransition('enter-pip');
      return next.isPipOpen;
    },

    closePiP() {
      const next = applyPipHeadsetTransition('close-pip');
      return next.isPipOpen;
    },

    togglePiP() {
      const next = applyPipHeadsetTransition('toggle-pip');
      return next.isPipOpen;
    },

    activateHeadsetMode() {
      const next = applyPipHeadsetTransition('activate-headset');
      return next.pipHeadsetMode;
    },

    toggleHeadsetMode() {
      const action = isPipOpen ? 'activate-headset' : 'toggle-headset';
      const next = applyPipHeadsetTransition(action);
      return next.pipHeadsetMode;
    },

    playTrack(track, { startSeconds = 0, queueMode = null, playlistId = '', selectionSource = 'user' } = {}) {
      if (!track) return;
      trackSelectionSource = selectionSource === 'auto' ? 'auto' : 'user';
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
      hydrateTrackStreamFromCache(target);
      const res = toggleTrackInWatchLater(musicLibrary, target);
      musicLibrary = saveMusicLibrary(res.library);
      if (res.added) scheduleStreamPrewarm(200);
      renderWidget();
      notifySubscribers('library');
      return res.added;
    },

    createPlaylist(name, initialTrack = null) {
      if (initialTrack) hydrateTrackStreamFromCache(initialTrack);
      const res = createUserPlaylist(musicLibrary, name, initialTrack);
      musicLibrary = saveMusicLibrary(res.library);
      if (initialTrack) scheduleStreamPrewarm(200);
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
      hydrateTrackStreamFromCache(target);
      const res = addTrackToPlaylist(musicLibrary, playlistId, target);
      musicLibrary = saveMusicLibrary(res.library);
      if (res.added) scheduleStreamPrewarm(200);
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
      pausedDueToBackgroundWait = false;
      backgroundAttemptDoneForTrackId = '';
      if (!currentTrack) {
        this.playNext({ userInitiated: true });
        return;
      }
      const resumeSec = getResumeSecondsForTrack(currentTrack);
      currentTime = resumeSec;
      saveMusicSession({
        explicitPaused: false,
        wasPlaying: true,
        lastTrackId: currentTrack?.id || '',
        lastTrack: currentTrack,
        currentTime: resumeSec,
        trackSelectionSource,
      });
      ensureBackgroundAudioKeepAlive();
      hydrateTrackStreamFromCache(currentTrack);
      if (activeEngine === 'audio-el' || currentTrack.streamUrl) {
        activeEngine = 'audio-el';
        isSwitchingSource = true;
        stopSilentHold();
        audio.loop = false;
        if (currentTrack.streamUrl) {
          configureAudioCors(currentTrack.streamUrl);
          if (audio.src !== currentTrack.streamUrl || audio.error) {
            audio.src = currentTrack.streamUrl;
          }
        }
        audio.muted = isMuted;
        audio.volume = isMuted ? 0 : volume;
        if (resumeSec > 1 && Math.abs((audio.currentTime || 0) - resumeSec) > 2.5) {
          pendingSeekSeconds = resumeSec;
          applyPendingAudioSeek();
        }
        const p = audio.play();
        isSwitchingSource = false;
        p.then(() => {
          applyPendingAudioSeek();
          isPlaying = true;
          isLoading = false;
          startTimeTicker();
          syncMediaPositionState();
          renderWidget();
          notifySubscribers('play');
        }).catch(() =>
          this.playTrack(currentTrack, {
            startSeconds: resumeSec,
            selectionSource: trackSelectionSource,
          })
        );
      } else if (ytReady && ytPlayer?.playVideo) {
        try {
          startSilentHoldForBackgroundTransition();
          if (isMuted) ytPlayer.mute?.();
          else ytPlayer.unMute?.();
          ytPlayer.setVolume?.(Math.round(volume * 100));
          const ytCur = Number(ytPlayer.getCurrentTime?.() || 0);
          if (resumeSec > 2 && ytCur < Math.max(1.5, resumeSec - 4)) {
            pendingYtSeekSeconds = resumeSec;
            ytPlayer.seekTo?.(resumeSec, true);
          }
          ytPlayer.playVideo();
          isPlaying = true;
          startTimeTicker();
          syncMediaPositionState();
          renderWidget();
          notifySubscribers('play');
          // Also retry background audio resolution so subsequent lock/switch swaps seamlessly
          resolveBackgroundStreamForTrack(currentTrack, { allowAltYt: true, priority: true })
            .then((resolvedUrl) => {
              if (resolvedUrl) propagateResolvedStreamToPools(currentTrack, resolvedUrl);
              if (
                resolvedUrl &&
                currentTrack &&
                !explicitPaused &&
                activeEngine === 'yt-iframe'
              ) {
                handoffToBackgroundSafeAudio('play-retry-upgrade');
              }
            })
            .catch(() => {});
        } catch {
          this.playTrack(currentTrack, {
            startSeconds: resumeSec,
            selectionSource: trackSelectionSource,
          });
        }
      } else {
        this.playTrack(currentTrack, {
          startSeconds: resumeSec,
          selectionSource: trackSelectionSource,
        });
      }
    },

    pause({ external = false } = {}) {
      explicitPaused = true;
      pausedDueToBackgroundWait = false;
      pendingPlayTrack = null;
      stopSilentHold({ clearSrc: activeEngine !== 'audio-el' });
      const preservedSec = getResumeSecondsForTrack(currentTrack);
      currentTime = preservedSec;
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
        lastTrack: currentTrack,
        currentTime: preservedSec,
        trackSelectionSource,
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

      if (reason === 'any-button-click' || reason === 'fab-open') {
        activeQueueMode = 'catalog';
        activeQueuePlaylistId = '';
      }
      const nextSelectionSource =
        reason === 'any-button-click' || reason === 'fab-open' || reason === 'error-skip'
          ? 'auto'
          : userInitiated
          ? 'user'
          : trackSelectionSource;

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
            this.playTrack(picked, {
              queueMode: activeQueueMode,
              playlistId: activeQueuePlaylistId,
              selectionSource: 'user',
            });
            return;
          }
        }
      }

      const activePool = searchResults.length > 0 && reason === 'ended' && !shuffleEnabled ? searchResults : tracks;
      if (!poolLoaded && !poolPromise) {
        ensureTrackPool();
      }

      const isHiddenNow = !isDesktopBrowser && typeof document !== 'undefined' && Boolean(document.hidden);
      const nextTrack = pickBackgroundSafeNextTrack({
        currentTrack,
        queue: activePool.length > 0 ? activePool : tracks.length > 0 ? tracks : SEED_VIRAL_INDO_TRACKS,
        fallbackPool: [...tracks, ...SEED_VIRAL_INDO_TRACKS],
        isHidden: isHiddenNow,
        shuffle:
          shuffleEnabled ||
          reason === 'any-button-click' ||
          reason === 'fab-open' ||
          reason === 'error-skip' ||
          activePool === tracks,
        repeatMode,
        recentTrackIds,
        blockedVideoIds,
        failedUrls: failedStreamUrls,
      });

      if (nextTrack) {
        this.playTrack(nextTrack, { queueMode: 'catalog', selectionSource: nextSelectionSource });
      } else if (userInitiated && tracks.length > 0) {
        this.playTrack(tracks[0], { queueMode: 'catalog', selectionSource: nextSelectionSource });
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
      recordGoodPosition(currentTrack, targetSec, { force: true });
      if (activeEngine === 'audio-el') {
        if (Number.isFinite(audio.duration) && audio.duration > 0 && audio.readyState >= 1) {
          audio.currentTime = targetSec;
          pendingSeekSeconds = 0;
        } else {
          pendingSeekSeconds = targetSec;
          applyPendingAudioSeek();
        }
      } else if (ytReady && ytPlayer?.seekTo) {
        try {
          pendingYtSeekSeconds = targetSec;
          ytPlayer.seekTo(targetSec, true);
        } catch {
          // Ignore seek error
        }
      }
      saveMusicSession({
        explicitPaused,
        wasPlaying: isPlaying,
        lastTrackId: currentTrack?.id || '',
        lastTrack: currentTrack,
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

    async refreshCategories() {
      return refreshRealtimeCategories({ force: true });
    },

    async loadPresetPlaylist(presetId) {
      const preset = liveCategories.find((p) => p.id === presetId) || liveCategories[0] || MUSIC_PRESET_CATEGORIES[0];
      activeCategory = preset.id;
      isSearching = true;
      searchQuery = '';
      searchResults = [];
      searchFeedback = '';
      beginLoadingProgress('category', `Memuat kategori "${preset.label}" dari YT Music...`, 24);
      renderWidget();
      notifySubscribers('search');
      try {
        const jobs = (preset.queries || []).map((q) =>
          fetchYtMusicSearch(q, {
            genre: preset.label,
            isIndonesianViral: /indo|koplo|dj|galau|religi|nostalgia|daerah|trending/i.test(preset.id),
            limit: 14,
          }).catch(() => [])
        );
        const settled = await Promise.all(jobs);
        advanceLoadingProgress(76, `Menyusun daftar putar "${preset.label}"...`);
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
          if (
            preset.id === 'viral-indo' ||
            preset.id === 'trending-live' ||
            seed.genre.toLowerCase().includes(preset.id.split('-')[0])
          ) {
            if (!merged.has(seed.id)) merged.set(seed.id, seed);
          }
        }
        const combinedRaw = [...merged.values()];
        const combined = filterPresetCategoryTracks(combinedRaw, {
          minSeconds: MIN_FULL_TRACK_SECONDS,
          maxSeconds: 900,
        });
        if (combined.length > 0) {
          combined.forEach(hydrateTrackStreamFromCache);
          tracks = shuffleTracksFisherYates(combined);
        }
      } catch {
        // Keep existing pool on transient failure
      }
      isSearching = false;
      finishLoadingProgress();
      renderWidget();
      notifySubscribers('pool');
      scheduleStreamPrewarm(160);
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
      beginLoadingProgress('searching', `Mencari "${q}" di YouTube Music...`, 22);
      renderWidget();
      notifySubscribers('search');

      try {
        const directId = extractYouTubeVideoId(q);
        let fetched = [];
        if (directId) {
          advanceLoadingProgress(48, 'Membaca metadata tautan YouTube...');
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
            limit: 26,
          });
        }

        if (mySerial !== requestSerial) return;
        advanceLoadingProgress(82, 'Menyaring & mengurutkan hasil terbaik...');

        const poolMatches = rankSearchResults([...SEED_VIRAL_INDO_TRACKS, ...tracks], q, 45, {
          allowYoutubeSearchOrder: false,
        });
        const exactReadyPoolMatches = poolMatches.filter(
          (r) =>
            r &&
            (Boolean(r.streamUrl) || SEED_VIRAL_INDO_TRACKS.some((s) => s.id === r.id)) &&
            scoreSearchRelevance(r, q, { allowYoutubeSearchOrder: false }) >= 50
        );
        const byId = new Map();
        for (const r of [...exactReadyPoolMatches, ...fetched, ...poolMatches]) {
          const key = r?.videoId ? `yt-${r.videoId}` : r?.id;
          if (key && (!r.videoId || !blockedVideoIds.has(r.videoId)) && !byId.has(key)) {
            byId.set(key, r);
          }
        }
        const finalResults = [...byId.values()];
        searchResults = finalResults;

        if (finalResults.length > 0) {
          finalResults.forEach(hydrateTrackStreamFromCache);
          const allMap = new Map(tracks.map((t) => [t.id, t]));
          for (const item of finalResults) {
            if (!allMap.has(item.id)) allMap.set(item.id, item);
          }
          tracks = [...allMap.values()];
          searchFeedback = '';
          scheduleStreamPrewarm(120);
          if (autoPlayFirst) {
            this.playTrack(finalResults[0], { selectionSource: 'user' });
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
      finishLoadingProgress();
      renderWidget();
      notifySubscribers('search');
    },

    clearSearch() {
      searchQuery = '';
      searchResults = [];
      searchFeedback = '';
      isSearching = false;
      finishLoadingProgress();
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
  ['loadedmetadata', 'durationchange', 'canplay'].forEach((evName) => {
    audio.addEventListener(evName, () => {
      if (isSilentHold || isUnlockingAudio || activeEngine !== 'audio-el') return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        // Runtime guard: reject any short preview stream (< 75s) and switch to full-length track
        if (audio.duration < MIN_FULL_TRACK_SECONDS && currentTrack) {
          const badSrc = audio.src || currentTrack.streamUrl || '';
          invalidateCachedStreamUrl(currentTrack.videoId, badSrc);
          currentTrack.streamUrl = '';
          const isHiddenNow = typeof document !== 'undefined' && Boolean(document.hidden);
          if (!isHiddenNow && currentTrack.videoId && !failedYtIframeVideoIds.has(currentTrack.videoId)) {
            startYoutubePlaybackForTrack(currentTrack, 0);
          } else {
            controller.playNext({ reason: 'short-stream-skip' });
          }
          return;
        }
        duration = audio.duration;
      }
      applyPendingAudioSeek();
    });
  });

  audio.addEventListener('play', () => {
    if (isSilentHold || isUnlockingAudio || activeEngine !== 'audio-el') return;
    audioElUnlocked = true;
    autoResumeAttempts = 0;
    isPlaying = true;
    isLoading = false;
    ensureBackgroundAudioKeepAlive();
    applyPendingAudioSeek();
    startTimeTicker();
    syncMediaPositionState();
    renderWidget();
    notifySubscribers('play');
  });

  audio.addEventListener('playing', () => {
    if (isSilentHold || isUnlockingAudio || activeEngine !== 'audio-el') return;
    applyPendingAudioSeek();
  });

  // Native timeupdate fires even when setInterval is throttled in background tabs or locked screens!
  // We also trigger auto-next 0.8s before track end so mobile OS audio focus never drops between tracks.
  audio.addEventListener('timeupdate', () => {
    if (isSilentHold || isUnlockingAudio || activeEngine !== 'audio-el' || isSeeking || isSwitchingSource) {
      return;
    }
    const cur = Number.isFinite(audio.currentTime) ? audio.currentTime : currentTime;
    const dur =
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : duration || currentTrack?.duration || 0;

    if (shouldIgnoreTimeUpdateDuringPendingSeek({ pendingSeekSeconds, reportedTime: cur })) {
      applyPendingAudioSeek();
      return;
    }
    if (hasPendingSeekSettled({ pendingSeekSeconds, reportedTime: cur })) {
      pendingSeekSeconds = 0;
    }

    if (dur > 10 && cur >= dur - 0.8 && !explicitPaused) {
      triggerSeamlessAutoNext('ended');
      return;
    }

    if (Math.abs(cur - currentTime) >= 0.35 || Math.abs(dur - duration) >= 1) {
      currentTime = cur;
      if (dur > 0) duration = dur;
      recordGoodPosition(currentTrack, cur);
      const now = Date.now();
      if (now - lastSessionSaveAt >= 1800) {
        lastSessionSaveAt = now;
        saveMusicSession({
          explicitPaused,
          wasPlaying: true,
          lastTrackId: currentTrack?.id || '',
          lastTrack: currentTrack,
          currentTime: cur,
          trackSelectionSource,
        });
      }
      syncMediaPositionState();
      syncPopoverProgressDom();
      notifySubscribers('time');
    }
  });

  audio.addEventListener('pause', () => {
    if (isUnlockingAudio || isSwitchingSource) return;
    if (isSilentHold) {
      if (!explicitPaused && (isPlaying || isLoading)) {
        ensureBackgroundAudioKeepAlive();
        audio.play().catch(() => {});
      }
      return;
    }
    if (activeEngine !== 'audio-el') return;
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration || 0;
    // If paused right at the end of track while in background, advance immediately
    if (!explicitPaused && (audio.ended || (dur > 10 && audio.currentTime >= dur - 1.2))) {
      triggerSeamlessAutoNext('ended');
      return;
    }
    const recentlyTransitioned = Date.now() - lastFocusTransitionAt < 6500;
    const isHiddenNow = typeof document !== 'undefined' && (document.hidden || !document.hasFocus?.());
    // Whenever user did NOT click Pause (explicitPaused === false) and audio stopped transiently
    // due to screen lock, tab switch, or app exit, auto-resume cleanly & keep watchdog alive!
    if (!explicitPaused && !audio.ended && audio.src && (isHiddenNow || recentlyTransitioned || isLoading || autoResumeAttempts < 12)) {
      autoResumeAttempts += 1;
      ensureBackgroundAudioKeepAlive();
      startBackgroundWatchdog();
      const attemptResume = () => {
        if (!explicitPaused && activeEngine === 'audio-el' && !isSilentHold && audio.paused && !audio.ended && audio.src && !isSwitchingSource) {
          ensureBackgroundAudioKeepAlive();
          audio.play().catch(() => {});
        }
      };
      audio.play().catch((err) => {
        if (err?.name === 'NotAllowedError' && !isHiddenNow && !recentlyTransitioned) {
          isPlaying = false;
          stopTimeTicker();
          renderWidget();
          notifySubscribers('pause');
        }
      });
      setTimeout(attemptResume, 180);
      setTimeout(attemptResume, 560);
      setTimeout(attemptResume, 1250);
      return;
    }
    isPlaying = false;
    stopTimeTicker();
    syncMediaPositionState();
    renderWidget();
    notifySubscribers('pause');
  });

  audio.addEventListener('ended', () => {
    if (isSilentHold || isUnlockingAudio || activeEngine !== 'audio-el') return;
    triggerSeamlessAutoNext('ended');
  });

  audio.addEventListener('stalled', () => {
    if (isSilentHold || isUnlockingAudio || activeEngine !== 'audio-el' || explicitPaused) return;
    ensureBackgroundAudioKeepAlive();
    if (audio.paused && isPlaying) {
      audio.play().catch(() => {});
    }
  });

  audio.addEventListener('error', async () => {
    if (isSilentHold || isUnlockingAudio || activeEngine !== 'audio-el' || explicitPaused) return;
    const failedTrack = currentTrack;
    const resumeSec = getResumeSecondsForTrack(failedTrack);
    const failedSrc = failedTrack?.streamUrl || audio.currentSrc || audio.src || '';
    if (failedSrc) {
      failedStreamUrls.add(failedSrc);
    }
    if (failedTrack?.videoId) {
      const vid = failedTrack.videoId;
      if (ytExactStreamCache.get(vid) === failedSrc) {
        ytExactStreamCache.delete(vid);
      }
      if (shouldPoisonExactYoutubeIdOnError({ videoId: vid, failedStreamUrl: failedSrc })) {
        failedExactVideoIds.add(vid);
      }
    }
    if (failedTrack) {
      failedTrack.streamUrl = '';
    }
    // Attempt resolving another exact verified stream for THIS SAME song first before fallback
    if (failedTrack && !explicitPaused) {
      const altResolved = await resolveBackgroundStreamForTrack(failedTrack, {
        allowAltYt: true,
        bypassCache: true,
        priority: true,
      }).catch(() => '');
      if (altResolved && !failedStreamUrls.has(altResolved) && currentTrack?.id === failedTrack.id && !explicitPaused) {
        executePlaybackNow(failedTrack, { startSeconds: resumeSec });
        return;
      }
    }
    if (
      failedTrack?.videoId &&
      !failedYtIframeVideoIds.has(failedTrack.videoId) &&
      (isDesktopBrowser || typeof document === 'undefined' || !document.hidden)
    ) {
      startYoutubePlaybackForTrack(failedTrack, resumeSec);
      return;
    }
    if (failedTrack?.videoId && trackSelectionSource !== 'user') {
      blockedVideoIds.add(failedTrack.videoId);
      tracks = tracks.filter((t) => t.videoId !== failedTrack.videoId);
    }
    consecutiveErrors += 1;
    if (shouldAutoSkipOnPlaybackError({ trackSelectionSource, consecutiveErrors }) && tracks.length > 0) {
      lastError = 'Mengganti ke lagu YT Music lain yang tersedia...';
      controller.playNext({ reason: 'error-skip' });
    } else {
      isPlaying = false;
      isLoading = false;
      stopSilentHoldAndSyncPaused({ pauseYt: true });
      lastError =
        trackSelectionSource === 'user'
          ? 'Sumber audio lagu ini sedang bermasalah. Ketuk Putar untuk coba lagi atau buka di YT.'
          : 'Pemutar YT Music sedang menunggu koneksi atau memilih lagu lain.';
      renderWidget();
      notifySubscribers('error');
    }
  });

  function keepAudioAliveOnLifecycle(reason = 'visibility') {
    lastFocusTransitionAt = Date.now();
    hiddenTransitionAt = Date.now();
    if (explicitPaused) return;
    ensureBackgroundAudioKeepAlive();
    if (isPlaying || isLoading) {
      const resumeSec = getResumeSecondsForTrack(currentTrack);
      saveMusicSession({
        explicitPaused: false,
        wasPlaying: true,
        lastTrackId: currentTrack?.id || '',
        lastTrack: currentTrack,
        currentTime: resumeSec,
        trackSelectionSource,
      });
      if (!pipHeadsetMode) {
        applyPipHeadsetTransition('auto-pip-background');
      }
      if (activeEngine === 'yt-iframe') {
        if (isDesktopBrowser) {
          // On desktop/laptop browsers, YT IFrame keeps playing natively when minimized, tab-switched, or blurred.
          // Only silently upgrade to <audio> if a verified streamUrl resolves; NEVER pause or swap away from YT IFrame!
          const ytState = getYtPlayerStateSafe();
          if (ytReady && ytPlayer && ytState !== 1 && ytState !== 3) {
            try {
              ytPlayer.playVideo?.();
            } catch {
              // Ignore
            }
          }
          if (currentTrack?.streamUrl && !failedStreamUrls.has(currentTrack.streamUrl)) {
            handoffToBackgroundSafeAudio(reason, resumeSec);
          } else if (currentTrack && backgroundAttemptDoneForTrackId !== currentTrack.id) {
            handoffToBackgroundSafeAudio(reason, resumeSec);
          }
        } else {
          startSilentHoldForBackgroundTransition({ force: true });
          if (currentTrack && backgroundAttemptDoneForTrackId === currentTrack.id && !currentTrack.streamUrl) {
            if (trackSelectionSource !== 'user' && tracks.some((t) => Boolean(t.streamUrl) && !failedStreamUrls.has(t.streamUrl))) {
              controller.playNext({ reason: 'bg-fallback' });
              return;
            }
            pauseSilentHoldOnBackgroundFailure('bg-unavailable');
            return;
          }
          // Resolve and hand off the EXACT user song to <audio>; ONLY auto-advance to another bgReady song if playback was automatic radio!
          handoffToBackgroundSafeAudio(reason, resumeSec).then((ok) => {
            if (
              !ok &&
              !explicitPaused &&
              document.hidden &&
              trackSelectionSource !== 'user' &&
              tracks.some((t) => Boolean(t.streamUrl) && !failedStreamUrls.has(t.streamUrl))
            ) {
              controller.playNext({ reason: 'bg-fallback' });
            }
          });
        }
      } else if (audio.ended) {
        triggerSeamlessAutoNext('ended');
      } else if (audio.paused && audio.src && !isSwitchingSource) {
        if (!isSilentHold && audio.currentTime < 1.5 && resumeSec > 2) {
          pendingSeekSeconds = resumeSec;
          applyPendingAudioSeek();
        }
        audio.play().then(() => applyPendingAudioSeek()).catch(() => {});
      }
      syncMediaPositionState();
    }
  }

  function resumePlaybackOnForegroundReturn(reason = 'return-visible') {
    lastFocusTransitionAt = Date.now();
    hiddenTransitionAt = 0;
    autoResumeAttempts = 0;
    const saved = readMusicSession();
    if (
      explicitPaused ||
      (!saved.wasPlaying && !isPlaying && !isLoading && !pausedDueToBackgroundWait) ||
      !currentTrack
    ) {
      return;
    }
    const wasPausedOnBgWait = pausedDueToBackgroundWait;
    pausedDueToBackgroundWait = false;
    const resumeSec = getResumeSecondsForTrack(currentTrack);
    if (activeEngine === 'audio-el') {
      if (audio.ended) {
        triggerSeamlessAutoNext('ended');
      } else if (audio.error || !audio.src || isSilentHold) {
        executePlaybackNow(currentTrack, { startSeconds: resumeSec });
      } else {
        if (audio.currentTime < 1.5 && resumeSec > 2) {
          pendingSeekSeconds = resumeSec;
          applyPendingAudioSeek();
        }
        if (audio.paused && !isSwitchingSource) {
          ensureBackgroundAudioKeepAlive();
          audio
            .play()
            .then(() => applyPendingAudioSeek())
            .catch(() => executePlaybackNow(currentTrack, { startSeconds: resumeSec }));
        }
      }
    } else if (activeEngine === 'yt-iframe') {
      hydrateTrackStreamFromCache(currentTrack);
      if (currentTrack.streamUrl) {
        handoffToBackgroundSafeAudio(reason, resumeSec);
        return;
      }
      // Resume YT IFrame cleanly at saved timestamp immediately while foreground is back
      if (ytReady && ytPlayer?.playVideo) {
        try {
          if (wasPausedOnBgWait || !isPlaying || !isSilentHold) {
            startSilentHoldForBackgroundTransition({ force: true });
          }
          const ytCur = Number(ytPlayer.getCurrentTime?.() || 0);
          if (resumeSec > 2 && ytCur < Math.max(1.5, resumeSec - 4)) {
            pendingYtSeekSeconds = resumeSec;
            ytPlayer.seekTo?.(resumeSec, true);
          }
          ytPlayer.playVideo();
          isPlaying = true;
          lastError = '';
          startTimeTicker();
          syncMediaPositionState();
          renderWidget();
          notifySubscribers('play');
        } catch {
          // Ignore YT resume error
        }
      }
    }
  }

  // Keep music alive when switching tabs, minimizing browser, or locking screen
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        keepAudioAliveOnLifecycle('visibility-hidden');
      } else {
        resumePlaybackOnForegroundReturn('return-visible');
      }
    });

    document.addEventListener('resume', () => resumePlaybackOnForegroundReturn('page-resume'));
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('blur', () => {
      lastFocusTransitionAt = Date.now();
      if (!explicitPaused && (isPlaying || isLoading)) {
        const resumeSec = getResumeSecondsForTrack(currentTrack);
        saveMusicSession({
          explicitPaused: false,
          wasPlaying: true,
          lastTrackId: currentTrack?.id || '',
          lastTrack: currentTrack,
          currentTime: resumeSec,
          trackSelectionSource,
        });
        ensureBackgroundAudioKeepAlive();
        if (activeEngine === 'yt-iframe') {
          if (isDesktopBrowser) {
            // Switching desktop apps does not suspend YT IFrame; only upgrade seamlessly if streamUrl is already cached
            if (currentTrack?.streamUrl && !failedStreamUrls.has(currentTrack.streamUrl)) {
              handoffToBackgroundSafeAudio('window-blur', resumeSec);
            }
          } else {
            startSilentHoldForBackgroundTransition({ force: true });
            handoffToBackgroundSafeAudio('window-blur', resumeSec);
          }
        } else if (activeEngine === 'audio-el') {
          if (audio.paused && !audio.ended && audio.src && !isSwitchingSource) {
            audio.play().catch(() => {});
          }
        }
      }
    });

    window.addEventListener('pageshow', () => resumePlaybackOnForegroundReturn('pageshow'));

    window.addEventListener('pagehide', () => {
      lastFocusTransitionAt = Date.now();
      const resumeSec = getResumeSecondsForTrack(currentTrack);
      saveMusicSession({
        explicitPaused,
        wasPlaying: isPlaying,
        lastTrackId: currentTrack?.id || '',
        lastTrack: currentTrack,
        currentTime: resumeSec,
        trackSelectionSource,
      });
      if (!explicitPaused && (isPlaying || isLoading)) {
        ensureBackgroundAudioKeepAlive();
        if (activeEngine === 'yt-iframe') {
          startSilentHoldForBackgroundTransition({ force: true });
          handoffToBackgroundSafeAudio('pagehide', resumeSec);
        } else if (activeEngine === 'audio-el' && audio.paused && !audio.ended && audio.src) {
          audio.play().catch(() => {});
        }
      }
    });
  }

  // Pause site music whenever external <video>/<audio> (e.g. Downloader video/audio preview) plays
  document.addEventListener(
    'play',
    (e) => {
      const target = e.target;
      if (target === audio || target === pipVideo || target?.dataset?.musicInternal === 'true') return;
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
        (el) =>
          el !== audio &&
          el !== pipVideo &&
          el.dataset?.musicInternal !== 'true' &&
          !el.paused &&
          !el.ended
      );
      if (externalMediaPlaying) return;
      if (!isPlaying && !isLoading) {
        const resumeSec = getResumeSecondsForTrack(currentTrack);
        if (currentTrack && (resumeSec > 0 || trackSelectionSource === 'user')) {
          controller.play();
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
        const resumeSec = getResumeSecondsForTrack(currentTrack);
        executePlaybackNow(currentTrack, { startSeconds: resumeSec });
      }
    }, 180);
  }

  scheduleStreamPrewarm(1500);

  return controller;
}
