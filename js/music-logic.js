/**
 * Pure logic for Manifestudio YT Music Player (Hub + Minimal Floating Dock).
 * - Uses community open-source YT Music API normalization & pure Fisher-Yates shuffle.
 * - Zero dependency on user search history or play-frequency weighting.
 * - Strictly prioritizes Indonesian Viral tracks during automatic shuffled playback.
 */

export const MIN_FULL_TRACK_SECONDS = 75;
export const REPEAT_MODES = ['all', 'one', 'off'];
export const MUSIC_MODES = ['yt-music'];

export function normalizeMusicMode(mode) {
  const clean = String(mode || '').trim().toLowerCase();
  return MUSIC_MODES.includes(clean) ? clean : 'yt-music';
}

export function normalizeRepeatMode(mode) {
  const clean = String(mode || '').trim().toLowerCase();
  return REPEAT_MODES.includes(clean) ? clean : 'all';
}

export function extractYouTubeVideoId(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^aud-/i.test(value)) return '';
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  const queryMatch = value.match(/[?&]v=([a-zA-Z0-9_-]{11})(?:[&#?/]|$)/);
  if (queryMatch) return queryMatch[1];

  const pathMatch = value.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed|shorts|live)\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})(?:[&#?/]|$)/i
  );
  if (pathMatch) return pathMatch[1];

  return '';
}

export function parseDurationSeconds(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  const str = String(raw || '').trim();
  if (!str) return 0;
  if (/^\d+$/.test(str)) {
    return Math.max(0, Number(str));
  }
  const parts = str.split(':').map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

export function normalizeYtMusicTrack(item, options = {}) {
  if (!item || typeof item !== 'object') return null;
  const videoId =
    extractYouTubeVideoId(item.videoId) ||
    extractYouTubeVideoId(item.url) ||
    extractYouTubeVideoId(item.id);
  const directStreamUrl = String(item.streamUrl || '').trim();
  const customId = String(item.id || '').trim();
  if (!videoId && !directStreamUrl) return null;

  const title = String(item.title || '').trim();
  if (!title) return null;

  const duration = parseDurationSeconds(
    item.duration ?? item.seconds ?? item.lengthSeconds ?? item.timestamp
  );
  const artist = String(
    item.uploaderName ||
      item.artist ||
      item.author?.name ||
      item.author ||
      item.channel ||
      'Artis YT Music'
  )
    .replace(/\s*-\s*Topic$/i, '')
    .trim();

  const fallbackThumb = videoId
    ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    : './assets/icons/brand-icon.svg';
  const rawThumb = String(item.thumbnail || item.artwork || item.image || '').trim();
  const artwork = rawThumb.startsWith('http') ? rawThumb : fallbackThumb;
  const isIndo =
    typeof options.isIndonesianViral === 'boolean'
      ? options.isIndonesianViral
      : typeof item.isIndonesianViral === 'boolean'
      ? item.isIndonesianViral
      : true;
  const genre = String(options.genre || item.genre || (isIndo ? 'Viral Indonesia' : 'YT Music')).trim();
  const sourceLabel = String(options.sourceLabel || item.sourceLabel || 'YT Music API').trim();
  const resolvedId = videoId ? `yt-${videoId}` : customId || `aud-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return {
    id: resolvedId,
    videoId: videoId || '',
    title,
    artist: artist || 'Artis YT Music',
    genre,
    tags: `${title} ${artist} ${genre} ${isIndo ? 'indonesia viral yt music' : 'yt music'}`.trim(),
    duration,
    artwork,
    artworkFallback: fallbackThumb,
    watchUrl: videoId
      ? `https://music.youtube.com/watch?v=${videoId}`
      : item.watchUrl || `https://music.youtube.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
    isIndonesianViral: isIndo,
    sourceLabel,
    streamUrl: directStreamUrl,
  };
}

export function filterFullLengthTracks(tracks = [], minSeconds = MIN_FULL_TRACK_SECONDS) {
  const minDur = Math.max(0, Number(minSeconds) || 0);
  if (!Array.isArray(tracks)) return [];
  return tracks.filter(
    (t) =>
      t &&
      t.id &&
      Boolean(t.videoId || t.streamUrl) &&
      Number(t.duration || 0) >= minDur
  );
}

export function tokenizeText(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

export function shuffleTracksFisherYates(tracks = [], rng = Math.random) {
  if (!Array.isArray(tracks)) return [];
  const copy = [...tracks];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const r = Math.min(0.999999, Math.max(0, Number(rng?.() ?? Math.random())));
    const j = Math.floor(r * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Picks a track purely at random (no user search or play history bias),
 * strictly prioritizing Indonesian Viral tracks (`isIndonesianViral === true`)
 * while avoiding the current & recently played tracks when alternatives exist.
 */
export function pickShuffledViralTrack(tracks = [], options = {}) {
  const {
    currentTrackId = null,
    recentTrackIds = [],
    prioritizeIndonesianViral = true,
    blockedVideoIds = null,
    minSeconds = MIN_FULL_TRACK_SECONDS,
    rng = Math.random,
  } = options || {};

  if (!Array.isArray(tracks) || tracks.length === 0) return null;

  const isNotBlocked = (t) => {
    if (!t || !t.id || !(t.videoId || t.streamUrl)) return false;
    if (blockedVideoIds && t.videoId && blockedVideoIds.has(t.videoId)) return false;
    return true;
  };

  const fullOnly = filterFullLengthTracks(tracks, minSeconds).filter(isNotBlocked);
  const validFallback = tracks.filter(isNotBlocked);
  const basePool = fullOnly.length > 0 ? fullOnly : validFallback;
  if (basePool.length === 0) return null;

  const recentSet = new Set(Array.isArray(recentTrackIds) ? recentTrackIds : []);

  const withoutCurrent =
    basePool.length > 1 && currentTrackId
      ? basePool.filter((t) => t.id !== currentTrackId)
      : basePool;

  const viralCandidates = prioritizeIndonesianViral
    ? withoutCurrent.filter((t) => Boolean(t.isIndonesianViral))
    : [];

  const preferredPool = viralCandidates.length > 0 ? viralCandidates : withoutCurrent;
  const freshPool = preferredPool.filter((t) => !recentSet.has(t.id));
  const finalPool = freshPool.length > 0 ? freshPool : preferredPool;

  const r = Math.min(0.999999, Math.max(0, Number(rng?.() ?? Math.random())));
  const idx = Math.floor(r * finalPool.length);
  return finalPool[idx] || finalPool[0];
}

export function scoreSearchRelevance(track, query) {
  if (!track || !(track.videoId || track.streamUrl)) return 0;
  const cleanQuery = String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanQuery) return 0;

  const title = String(track.title || '').toLowerCase();
  const artist = String(track.artist || '').toLowerCase();
  const tags = String(track.tags || '').toLowerCase();
  const combined = `${title} ${artist}`.trim();
  const tokens = tokenizeText(cleanQuery);
  if (tokens.length === 0) return 0;

  let score = 0;
  let titleOrArtistTokenHits = 0;

  if (title === cleanQuery) score += 80;
  else if (title.includes(cleanQuery)) score += 50;

  if (artist === cleanQuery) score += 55;
  else if (artist.includes(cleanQuery)) score += 35;

  if (combined.includes(cleanQuery)) score += 25;

  for (const token of tokens) {
    const inTitle = title.includes(token);
    const inArtist = artist.includes(token);
    if (inTitle) score += 16;
    if (inArtist) score += 12;
    if (inTitle || inArtist) {
      titleOrArtistTokenHits += 1;
    } else if (tags.includes(token)) {
      score += 3;
    }
  }

  const minRequiredHits = tokens.length === 1 ? 1 : Math.ceil(tokens.length * 0.5);
  if (titleOrArtistTokenHits < minRequiredHits && !combined.includes(cleanQuery)) {
    return 0;
  }

  const dur = Number(track.duration || 0);
  if (dur > 0 && dur < MIN_FULL_TRACK_SECONDS) {
    score = Math.max(0, score - 22);
  }
  if (/\b(parody|parodi|lucu|shorts|#shorts|prank|sound effect|reaction)\b/i.test(combined)) {
    score = Math.max(0, score - 25);
  }

  if (score <= 0) return 0;
  if (track.isIndonesianViral) score += 2;
  return Number(score.toFixed(2));
}

export function rankSearchResults(tracks = [], query = '', minSeconds = MIN_FULL_TRACK_SECONDS) {
  if (!Array.isArray(tracks) || tracks.length === 0) return [];
  const fullOnly = filterFullLengthTracks(tracks, minSeconds);
  const candidates =
    fullOnly.length > 0
      ? fullOnly
      : tracks.filter((t) => t && t.id && (t.videoId || t.streamUrl) && Number(t.duration || 0) >= 45);

  return candidates
    .map((track) => ({ track, relevance: scoreSearchRelevance(track, query) }))
    .filter((entry) => entry.relevance > 0)
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      const aNorm = a.track.duration <= 420 ? 1 : 0;
      const bNorm = b.track.duration <= 420 ? 1 : 0;
      if (bNorm !== aNorm) return bNorm - aNorm;
      return (b.track.duration || 0) - (a.track.duration || 0);
    })
    .map((entry) => entry.track);
}

export function formatAudioTime(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function clampMusicFabPosition({
  x,
  y,
  viewportWidth,
  viewportHeight,
  fabSize = 44,
  margin = 10,
}) {
  const vw = Math.max(fabSize + margin * 2, Number(viewportWidth) || 390);
  const vh = Math.max(fabSize + margin * 2, Number(viewportHeight) || 844);
  const maxX = Math.max(margin, vw - fabSize - margin);
  const maxY = Math.max(margin, vh - fabSize - margin);
  return {
    x: Math.round(Math.min(maxX, Math.max(margin, Number(x) || margin))),
    y: Math.round(Math.min(maxY, Math.max(margin, Number(y) || margin))),
  };
}

export function getPopoverAnchorClasses({
  x,
  y,
  viewportWidth,
  viewportHeight,
  fabSize = 44,
  margin = 16,
}) {
  const vw = Math.max(320, Number(viewportWidth) || 390);
  const vh = Math.max(480, Number(viewportHeight) || 844);
  const fabX = Number(x) || 0;
  const centerX = fabX + fabSize / 2;
  const centerY = (Number(y) || 0) + fabSize / 2;
  const horizontal = centerX > vw * 0.52 ? 'align-right' : 'align-left';
  const vertical = centerY < vh * 0.48 ? 'open-down' : 'open-up';

  const popWidth = Math.min(316, vw - margin * 2);
  const idealLeft = horizontal === 'align-right' ? fabX + fabSize - popWidth : fabX;
  const maxLeft = Math.max(margin, vw - popWidth - margin);
  const clampedLeft = Math.min(maxLeft, Math.max(margin, idealLeft));
  const offsetX = Math.round(clampedLeft - fabX);

  return {
    horizontal,
    vertical,
    offsetX,
  };
}

export function parseSavedVolume(raw, fallback = 0.72) {
  if (raw === null || raw === undefined) return fallback;
  const str = String(raw).trim();
  if (!str) return fallback;
  const num = Number(str);
  if (Number.isFinite(num) && num >= 0 && num <= 1) return num;
  return fallback;
}
