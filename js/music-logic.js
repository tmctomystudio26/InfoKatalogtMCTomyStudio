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
  const rawStreamUrl = String(item.streamUrl || '').trim();
  const directStreamUrl =
    rawStreamUrl && !isBlockedAudioWrapperUrl(rawStreamUrl) && !isInstantAudioPreviewUrl(rawStreamUrl)
      ? rawStreamUrl
      : '';
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

const SONG_NOISE_TOKENS = new Set([
  'official',
  'music',
  'video',
  'mv',
  'lyric',
  'lyrics',
  'lirik',
  'audio',
  'hd',
  'hq',
  'kbps',
  '128kbps',
  '320kbps',
  'ft',
  'feat',
  'featuring',
  'remix',
  'cover',
  'live',
  'mp3',
  'youtube',
  'topic',
  'version',
  'ver',
  'edit',
  'mix',
  'y2mate',
  'com',
  'net',
  'lagu',
  'terbaru',
  'viral',
]);

export function normalizeMatchString(raw) {
  return String(raw || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0430]/g, 'a')
    .replace(/[\u0435]/g, 'e')
    .replace(/[\u043e]/g, 'o')
    .replace(/[\u0440]/g, 'p')
    .replace(/[\u0441]/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeText(raw) {
  return normalizeMatchString(raw)
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

const DASH_SEPARATOR_RE = /\s+[-–—]\s+/;
const PIPE_NOISE_SUFFIX_RE = /\s*\|\s*(?:official|lirik|lyrics?|audio|video|hd|hq|full|music).*$/i;
const PAREN_NOISE_RE = /\([^)]*(?:official|music|video|mv|lyric|lyrics|lirik|audio|live|cover|remix|ver\.?|version|hd|hq|kbps|feat\.?|ft\.?)[^)]*\)|\[[^\]]*(?:official|music|video|mv|lyric|lyrics|lirik|audio|live|cover|remix|ver\.?|version|hd|hq|kbps|feat\.?|ft\.?)[^\]]*\]/gi;

export function extractCoreSongTokens(title) {
  const tokens = tokenizeText(title).filter((w) => !SONG_NOISE_TOKENS.has(w));
  return [...new Set(tokens.length > 0 ? tokens : tokenizeText(title))];
}

function buildSongTitleHypotheses(rawTitle, rawArtist = '') {
  const genericArtists = new Set(['artis', 'music', 'youtube', 'topic', 'viral', 'indonesia', 'indo']);
  const baseArtistTokens = tokenizeText(rawArtist).filter((w) => !genericArtists.has(w));
  const fullCore = extractCoreSongTokens(rawTitle);
  const cleanedTitle = String(rawTitle || '')
    .replace(PIPE_NOISE_SUFFIX_RE, '')
    .replace(PAREN_NOISE_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (DASH_SEPARATOR_RE.test(cleanedTitle)) {
    const parts = cleanedTitle.split(DASH_SEPARATOR_RE).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const leftRaw = parts[0];
      const rightRaw = parts.slice(1).join(' ');
      const leftCore = extractCoreSongTokens(leftRaw);
      const rightCore = extractCoreSongTokens(rightRaw);
      if (leftCore.length > 0 && rightCore.length > 0) {
        const artistSet = new Set(baseArtistTokens);
        const leftHasArtist = leftCore.some((tok) => artistSet.has(tok));
        const rightHasArtist = rightCore.some((tok) => artistSet.has(tok));

        if (leftHasArtist && !rightHasArtist) {
          return [
            {
              songTokens: rightCore,
              artistTokens: [...new Set([...baseArtistTokens, ...leftCore])],
            },
          ];
        }
        if (rightHasArtist && !leftHasArtist) {
          return [
            {
              songTokens: leftCore,
              artistTokens: [...new Set([...baseArtistTokens, ...rightCore])],
            },
          ];
        }
        return [
          {
            songTokens: rightCore,
            artistTokens: [...new Set([...baseArtistTokens, ...leftCore])],
          },
          {
            songTokens: leftCore,
            artistTokens: [...new Set([...baseArtistTokens, ...rightCore])],
          },
        ];
      }
    }
  }

  return [{ songTokens: fullCore, artistTokens: baseArtistTokens }];
}

export function isInstantAudioPreviewUrl(rawUrl = '') {
  const s = String(rawUrl || '').trim();
  if (!s) return false;
  return /itunes\.apple\.com|mzstatic\.com|audiopreview|cdns-preview|dzcdn\.net\/stream/i.test(s);
}

export function isBlockedAudioWrapperUrl(rawUrl = '') {
  const s = String(rawUrl || '').trim();
  if (!s || !/^https?:\/\//i.test(s)) return true;
  if (/savetube\.vip|sf-converter\.com|ytshortdown\.com|y2mate\.com|ssyoutube\.com/i.test(s)) {
    return true;
  }
  if (isInstantAudioPreviewUrl(s)) return true;
  if (/\.html(\?|#|$)/i.test(s)) return true;
  return false;
}

export function wrapMusicAudioCorsProxyIfNeeded(rawUrl = '') {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  if (/^https?:\/\/[^/]*\.?googlevideo\.com\//i.test(s)) {
    return `https://api.vidsnap.app/proxy?u=${encodeURIComponent(s)}`;
  }
  return s;
}

export function selectUmmyAudioStreamCandidates(payload) {
  const list = Array.isArray(payload?.data?.url)
    ? payload.data.url
    : Array.isArray(payload?.url)
    ? payload.url
    : [];
  const scored = [];
  const seen = new Set();

  for (const item of list) {
    const raw = String(item?.url || '').trim();
    if (!raw || isBlockedAudioWrapperUrl(raw)) continue;
    const ext = String(item?.ext || '').toLowerCase();
    const type = String(item?.type || '').toLowerCase();
    const noAudio = item?.no_audio;

    let tier = -1;
    if (ext === 'mp3' || ext === 'm4a' || ext === 'aac') {
      tier = 3;
    } else if (ext === 'opus' || item?.audio === true || /audio/i.test(type)) {
      if (noAudio === true) continue;
      tier = 2;
    } else if (ext === 'mp4' && (noAudio === false || !/dash/i.test(type))) {
      if (noAudio === true) continue;
      tier = 1;
    }
    if (tier < 0) continue;

    const finalUrl = wrapMusicAudioCorsProxyIfNeeded(raw);
    if (!finalUrl || seen.has(finalUrl)) continue;
    seen.add(finalUrl);
    const isIdBound = /[?&]gcr=id(?:[&#]|$)/i.test(raw);
    scored.push({
      url: finalUrl,
      tier: isIdBound ? tier : tier + 10,
      bitrate: Number(item?.bitrate || item?.quality || 0) || 0,
    });
  }

  scored.sort((a, b) => {
    if (b.tier !== a.tier) return b.tier - a.tier;
    return b.bitrate - a.bitrate;
  });

  return scored.map((entry) => entry.url);
}

/**
 * Strictly verifies whether a candidate track (YT alternate or Audius) genuinely matches
 * a target track's song title, artist, and duration (without requiring `streamUrl`).
 */
export function isStrictSongMetadataMatch(targetTrack, candidateTrack) {
  if (!targetTrack || !candidateTrack || !candidateTrack.title) return false;
  const candDur = Number(candidateTrack.duration || 0);
  if (candDur > 0 && (candDur < MIN_FULL_TRACK_SECONDS || candDur > 600)) return false;

  const targetDur = Number(targetTrack.duration || 0);
  if (targetDur > 0 && candDur > 0 && Math.abs(targetDur - candDur) > 95) {
    return false;
  }

  const hypotheses = buildSongTitleHypotheses(targetTrack.title, targetTrack.artist);
  if (hypotheses.length === 0) return false;

  const candTitleWords = new Set(tokenizeText(candidateTrack.title));
  const candAllWords = new Set(tokenizeText(`${candidateTrack.title} ${candidateTrack.artist || ''}`));

  return hypotheses.some(({ songTokens, artistTokens }) => {
    if (!songTokens || songTokens.length === 0) return false;
    let titleHits = 0;
    for (const tok of songTokens) {
      if (candTitleWords.has(tok)) {
        titleHits += 1;
      }
    }

    // Must match whole-word song title tokens (for 1-2 word titles like "Mangu", "Stecu", "Tanpa Cinta", 100% must match)
    const requiredTitleHits =
      songTokens.length === 1
        ? 1
        : songTokens.length === 2
        ? 2
        : Math.max(2, Math.ceil(songTokens.length * 0.75));

    if (titleHits < requiredTitleHits) return false;

    if (artistTokens.length > 0) {
      const artistMatched = artistTokens.some((tok) => candAllWords.has(tok));
      // Require artist match unless distinct non-artist song title has >= 3 matched words
      if (!artistMatched && titleHits < 3) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Picks up to `maxAlts` unique strictly-matching alternate YouTube tracks for racing audio resolution.
 */
export function dedupeMatchingAltTracks(
  targetTrack,
  candidatePools = [],
  { failedIds = new Set(), maxAlts = 4 } = {}
) {
  if (!targetTrack) return [];
  const seenIds = new Set();
  const matching = [];
  for (const alt of candidatePools) {
    if (
      alt?.videoId &&
      alt.videoId !== targetTrack.videoId &&
      !seenIds.has(alt.videoId) &&
      !failedIds.has(alt.videoId) &&
      isStrictSongMetadataMatch(targetTrack, alt)
    ) {
      seenIds.add(alt.videoId);
      matching.push(alt);
    }
  }
  matching.sort((a, b) => {
    const aScore = /\b(lyrics?|lirik|audio|topic)\b/i.test(`${a.title || ''} ${a.artist || ''}`) ? 1 : 0;
    const bScore = /\b(lyrics?|lirik|audio|topic)\b/i.test(`${b.title || ''} ${b.artist || ''}`) ? 1 : 0;
    return bScore - aScore;
  });
  return matching.slice(0, maxAlts);
}

/**
 * Determines whether the background silent-hold placeholder MUST stop and flip
 * OS media notification playbackState to 'paused' so it never plays silent loops forever.
 */
export function shouldStopSilentHoldAndPauseNotification({
  activeEngine = 'audio-el',
  isSilentHold = false,
  resolvedStreamUrl = '',
  isHidden = false,
  explicitPaused = false,
  timedOutOrFailed = false,
} = {}) {
  return Boolean(
    activeEngine === 'yt-iframe' &&
      isSilentHold &&
      !explicitPaused &&
      isHidden &&
      !resolvedStreamUrl &&
      timedOutOrFailed
  );
}

/**
 * Strictly verifies whether an audio candidate (e.g. from Audius) genuinely matches
 * a target track's song title and artist before attaching its direct `streamUrl`.
 * Prevents playing an unrelated track under another song's displayed title.
 */
export function isStrictAudioMatch(targetTrack, candidateTrack) {
  if (!candidateTrack || !candidateTrack.streamUrl) return false;
  if (isBlockedAudioWrapperUrl(candidateTrack.streamUrl) || isInstantAudioPreviewUrl(candidateTrack.streamUrl)) {
    return false;
  }
  if (Number(candidateTrack.duration || 0) < MIN_FULL_TRACK_SECONDS) return false;
  return isStrictSongMetadataMatch(targetTrack, candidateTrack);
}

export function shouldAutoSkipOnPlaybackError({
  trackSelectionSource = 'auto',
  consecutiveErrors = 0,
  maxSkips = 5,
} = {}) {
  if (trackSelectionSource === 'user') return false;
  return Number(consecutiveErrors || 0) <= Number(maxSkips || 5);
}

/**
 * Returns true when an HTML5 <audio> element MUST send CORS headers (`crossOrigin='anonymous'`)
 * so proxy hosts like api.vidsnap.app do not reject hotlink playback with HTTP 403.
 */
export function needsCorsAnonymousAudio(rawUrl = '') {
  const s = String(rawUrl || '').trim();
  if (!s) return false;
  return /^https?:\/\/(?:[^/]+\.)?vidsnap\.app\//i.test(s);
}

/**
 * Computes the safest resume position in seconds across memory state, persisted session,
 * and last known good playback time without failing when media duration is NaN/Infinity.
 */
export function computeSafeResumeSeconds({
  currentTime = 0,
  sessionTime = 0,
  lastGoodTime = 0,
  sameTrack = true,
  duration = 0,
} = {}) {
  if (!sameTrack) return 0;
  const raw = Math.max(
    0,
    Number(currentTime) || 0,
    Number(sessionTime) || 0,
    Number(lastGoodTime) || 0
  );
  if (raw <= 0) return 0;
  const dur = Number(duration);
  if (Number.isFinite(dur) && dur > 4) {
    return Math.min(raw, Math.max(0, dur - 1.5));
  }
  return raw;
}

export function shouldIgnoreTimeUpdateDuringPendingSeek({
  pendingSeekSeconds = 0,
  reportedTime = 0,
} = {}) {
  const target = Number(pendingSeekSeconds) || 0;
  const cur = Number(reportedTime) || 0;
  return target > 1 && Math.abs(cur - target) > 2.5;
}

export function hasPendingSeekSettled({
  pendingSeekSeconds = 0,
  reportedTime = 0,
} = {}) {
  const target = Number(pendingSeekSeconds) || 0;
  const cur = Number(reportedTime) || 0;
  return target <= 0 || Math.abs(cur - target) <= 2.5;
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
  const cleanQuery = normalizeMatchString(query);
  if (!cleanQuery) return 0;

  const title = normalizeMatchString(track.title);
  const artist = normalizeMatchString(track.artist);
  const titleWords = new Set(tokenizeText(track.title));
  const artistWords = new Set(tokenizeText(track.artist));
  const combined = `${title} ${artist}`.trim();
  const tokens = tokenizeText(cleanQuery);
  if (tokens.length === 0) return 0;

  let score = 0;
  let titleOrArtistTokenHits = 0;

  const phraseWordRegex = new RegExp(`(?:^|\\s)${cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
  if (title === cleanQuery) score += 80;
  else if (phraseWordRegex.test(title)) score += 50;

  if (artist === cleanQuery) score += 55;
  else if (phraseWordRegex.test(artist)) score += 35;

  if (phraseWordRegex.test(combined)) score += 25;

  for (const token of tokens) {
    const inTitle =
      titleWords.has(token) || (token.length >= 4 && [...titleWords].some((w) => w.startsWith(token)));
    const inArtist =
      artistWords.has(token) || (token.length >= 4 && [...artistWords].some((w) => w.startsWith(token)));
    if (inTitle) score += 18;
    if (inArtist) score += 14;
    if (inTitle || inArtist) {
      titleOrArtistTokenHits += 1;
    }
  }

  const minRequiredHits = tokens.length === 1 ? 1 : Math.ceil(tokens.length * 0.5);
  if (titleOrArtistTokenHits < minRequiredHits) {
    return 0;
  }

  const dur = Number(track.duration || 0);
  if (dur > 0 && dur < MIN_FULL_TRACK_SECONDS) {
    score = Math.max(0, score - 22);
  }
  const wantsLongMix = /\b(album|full album|mix|nonstop|kompilasi|playlist|1 jam)\b/i.test(cleanQuery);
  if (!wantsLongMix && dur > 720) {
    return 0;
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

export const MUSIC_LIBRARY_STORAGE_KEY = 'manifestudio_music_library_v1';

export function serializeMusicTrack(track, addedAt = '') {
  if (!track || typeof track !== 'object') return null;
  const normalized = normalizeYtMusicTrack(track, {
    genre: track.genre,
    isIndonesianViral: track.isIndonesianViral,
    sourceLabel: track.sourceLabel,
  });
  if (!normalized) return null;
  return {
    id: normalized.id,
    videoId: normalized.videoId || '',
    title: normalized.title,
    artist: normalized.artist,
    genre: normalized.genre,
    duration: normalized.duration,
    artwork: normalized.artwork,
    artworkFallback: normalized.artworkFallback,
    watchUrl: normalized.watchUrl,
    isIndonesianViral: Boolean(normalized.isIndonesianViral),
    sourceLabel: normalized.sourceLabel,
    streamUrl: normalized.streamUrl || '',
    addedAt: String(addedAt || track.addedAt || ''),
  };
}

function getTrackIdentityKey(trackOrId) {
  if (!trackOrId) return '';
  if (typeof trackOrId === 'string') return trackOrId.trim();
  return String(trackOrId.id || (trackOrId.videoId ? `yt-${trackOrId.videoId}` : '')).trim();
}

function isSameTrackItem(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id && a.id === b.id) return true;
  if (a.videoId && b.videoId && a.videoId === b.videoId) return true;
  return false;
}

export function normalizeMusicLibraryState(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const watchLaterMap = new Map();
  if (Array.isArray(src.watchLater)) {
    for (const item of src.watchLater) {
      const clean = serializeMusicTrack(item);
      if (clean && !watchLaterMap.has(clean.id)) {
        watchLaterMap.set(clean.id, clean);
      }
    }
  }

  const playlists = [];
  const seenPlaylistIds = new Set();
  if (Array.isArray(src.playlists)) {
    for (const pl of src.playlists) {
      if (!pl || typeof pl !== 'object') continue;
      const pid = String(pl.id || '').trim();
      const name = String(pl.name || '').trim().slice(0, 60);
      if (!pid || !name || seenPlaylistIds.has(pid)) continue;
      seenPlaylistIds.add(pid);
      const trackMap = new Map();
      if (Array.isArray(pl.tracks)) {
        for (const t of pl.tracks) {
          const clean = serializeMusicTrack(t);
          if (clean && !trackMap.has(clean.id)) {
            trackMap.set(clean.id, clean);
          }
        }
      }
      playlists.push({
        id: pid,
        name,
        createdAt: String(pl.createdAt || ''),
        updatedAt: String(pl.updatedAt || pl.createdAt || ''),
        tracks: [...trackMap.values()],
      });
    }
  }

  return {
    watchLater: [...watchLaterMap.values()],
    playlists,
  };
}

export function isTrackInWatchLater(library, trackOrId) {
  const lib = normalizeMusicLibraryState(library);
  const key = getTrackIdentityKey(trackOrId);
  if (!key) return false;
  return lib.watchLater.some(
    (t) => t.id === key || (typeof trackOrId === 'object' && isSameTrackItem(t, trackOrId))
  );
}

export function toggleTrackInWatchLater(library, track, nowIso = new Date().toISOString()) {
  const lib = normalizeMusicLibraryState(library);
  const clean = serializeMusicTrack(track, nowIso);
  if (!clean) {
    return { library: lib, added: false };
  }
  const existingIdx = lib.watchLater.findIndex((t) => isSameTrackItem(t, clean));
  if (existingIdx !== -1) {
    return {
      library: {
        ...lib,
        watchLater: lib.watchLater.filter((_, i) => i !== existingIdx),
      },
      added: false,
    };
  }
  return {
    library: {
      ...lib,
      watchLater: [clean, ...lib.watchLater],
    },
    added: true,
  };
}

export function createUserPlaylist(
  library,
  name,
  initialTrack = null,
  nowIso = new Date().toISOString(),
  customId = ''
) {
  const lib = normalizeMusicLibraryState(library);
  const cleanName = String(name || '').trim().slice(0, 60);
  if (!cleanName) {
    return { library: lib, playlist: null };
  }
  const id =
    String(customId || '').trim() ||
    `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const initialClean = initialTrack ? serializeMusicTrack(initialTrack, nowIso) : null;
  const playlist = {
    id,
    name: cleanName,
    createdAt: nowIso,
    updatedAt: nowIso,
    tracks: initialClean ? [initialClean] : [],
  };
  return {
    library: {
      ...lib,
      playlists: [playlist, ...lib.playlists],
    },
    playlist,
  };
}

export function renameUserPlaylist(library, playlistId, nextName, nowIso = new Date().toISOString()) {
  const lib = normalizeMusicLibraryState(library);
  const cleanName = String(nextName || '').trim().slice(0, 60);
  if (!cleanName) return lib;
  return {
    ...lib,
    playlists: lib.playlists.map((pl) =>
      pl.id === playlistId ? { ...pl, name: cleanName, updatedAt: nowIso } : pl
    ),
  };
}

export function deleteUserPlaylist(library, playlistId) {
  const lib = normalizeMusicLibraryState(library);
  return {
    ...lib,
    playlists: lib.playlists.filter((pl) => pl.id !== playlistId),
  };
}

export function addTrackToPlaylist(library, playlistId, track, nowIso = new Date().toISOString()) {
  const lib = normalizeMusicLibraryState(library);
  const clean = serializeMusicTrack(track, nowIso);
  if (!clean) return { library: lib, added: false };
  let added = false;
  const nextPlaylists = lib.playlists.map((pl) => {
    if (pl.id !== playlistId) return pl;
    if (pl.tracks.some((t) => isSameTrackItem(t, clean))) {
      return pl;
    }
    added = true;
    return {
      ...pl,
      updatedAt: nowIso,
      tracks: [...pl.tracks, clean],
    };
  });
  return {
    library: { ...lib, playlists: nextPlaylists },
    added,
  };
}

export function removeTrackFromPlaylist(library, playlistId, trackId, nowIso = new Date().toISOString()) {
  const lib = normalizeMusicLibraryState(library);
  let removed = false;
  const nextPlaylists = lib.playlists.map((pl) => {
    if (pl.id !== playlistId) return pl;
    const filtered = pl.tracks.filter((t) => t.id !== trackId && `yt-${t.videoId}` !== trackId);
    if (filtered.length !== pl.tracks.length) {
      removed = true;
      return { ...pl, updatedAt: nowIso, tracks: filtered };
    }
    return pl;
  });
  return {
    library: { ...lib, playlists: nextPlaylists },
    removed,
  };
}

/**
 * Extracts YouTube googlevideo `expire` unix timestamp in milliseconds (checks raw and ?u= proxy URLs).
 */
export function extractStreamExpiryMs(rawUrl = '') {
  const s = String(rawUrl || '').trim();
  if (!s) return 0;
  const decodeLoop = [s];
  try {
    const parsed = new URL(s);
    const proxied = parsed.searchParams.get('u');
    if (proxied) decodeLoop.push(proxied);
  } catch {
    // Ignore malformed URL
  }
  for (const candidate of decodeLoop) {
    const match = String(candidate).match(/[?&]expire=(\d{9,12})(?:&|$)/i);
    if (match) {
      const sec = Number(match[1]);
      if (Number.isFinite(sec) && sec > 1000000000) {
        return sec * 1000;
      }
    }
  }
  return 0;
}

export function getValidCachedStreamUrl(
  cacheObj = {},
  videoId = '',
  { now = Date.now(), ttlMs = 5400000 } = {}
) {
  const key = extractYouTubeVideoId(videoId) || String(videoId || '').trim();
  if (!key || !cacheObj || typeof cacheObj !== 'object') return '';
  const entry = cacheObj[key];
  const url = typeof entry === 'string' ? entry : String(entry?.url || '').trim();
  if (!url || isBlockedAudioWrapperUrl(url)) return '';
  const savedAt = Number(entry?.savedAt || 0);
  if (savedAt > 0 && now - savedAt > ttlMs) return '';
  const expiresAt = Number(entry?.expiresAt || 0) || extractStreamExpiryMs(url);
  // Require at least 3 minutes remaining before signed googlevideo URL expires
  if (expiresAt > 0 && expiresAt - now < 180000) return '';
  return url;
}

export function pruneAndSerializeStreamCache(
  entries = [],
  { now = Date.now(), maxEntries = 60, ttlMs = 5400000 } = {}
) {
  const clean = {};
  const list = Array.isArray(entries)
    ? entries
    : entries && typeof entries === 'object'
    ? Object.entries(entries).map(([k, v]) => ({
        videoId: k,
        url: typeof v === 'string' ? v : v?.url,
        savedAt: v?.savedAt,
        expiresAt: v?.expiresAt,
      }))
    : [];

  const kept = [];
  for (const item of list) {
    const vid = extractYouTubeVideoId(item?.videoId) || String(item?.videoId || '').trim();
    const url = String(item?.url || '').trim();
    if (!vid || !url || isBlockedAudioWrapperUrl(url)) continue;
    const savedAt = Number(item?.savedAt || now);
    if (now - savedAt > ttlMs) continue;
    const expiresAt = Number(item?.expiresAt || 0) || extractStreamExpiryMs(url);
    if (expiresAt > 0 && expiresAt - now < 180000) continue;
    kept.push({ vid, url, savedAt, expiresAt });
  }

  kept.sort((a, b) => b.savedAt - a.savedAt);
  for (const row of kept.slice(0, maxEntries)) {
    clean[row.vid] = {
      url: row.url,
      savedAt: row.savedAt,
      ...(row.expiresAt > 0 ? { expiresAt: row.expiresAt } : {}),
    };
  }
  return clean;
}

/**
 * Picks up to `limit` tracks lacking verified direct streamUrl in priority order:
 * current track -> upcoming queue -> top search hits -> watch later & playlists -> seed queue.
 */
export function pickPrewarmQueueCandidates({
  currentTrack = null,
  activeQueue = [],
  searchResults = [],
  watchLater = [],
  playlists = [],
  seedTracks = [],
  failedIds = new Set(),
  failedUrls = new Set(),
  limit = 14,
} = {}) {
  const out = [];
  const seen = new Set();

  const pushIfNeeded = (track) => {
    if (!track || out.length >= limit) return;
    const key = track.videoId ? `yt-${track.videoId}` : track.id;
    if (!key || seen.has(key)) return;
    seen.add(key);
    if (track.videoId && failedIds.has(track.videoId)) return;
    if (track.streamUrl && !failedUrls.has(track.streamUrl)) return;
    if (!track.videoId && !track.title) return;
    out.push(track);
  };

  pushIfNeeded(currentTrack);

  if (Array.isArray(activeQueue) && activeQueue.length > 0) {
    const idx = currentTrack
      ? activeQueue.findIndex(
          (t) => t && (t.id === currentTrack.id || (currentTrack.videoId && t.videoId === currentTrack.videoId))
        )
      : -1;
    const start = idx >= 0 ? idx + 1 : 0;
    for (let offset = 0; offset < Math.min(3, activeQueue.length); offset += 1) {
      pushIfNeeded(activeQueue[(start + offset) % activeQueue.length]);
    }
  }

  if (Array.isArray(searchResults)) {
    searchResults.slice(0, 5).forEach(pushIfNeeded);
  }
  if (Array.isArray(watchLater)) {
    watchLater.slice(0, 6).forEach(pushIfNeeded);
  }
  if (Array.isArray(playlists)) {
    for (const pl of playlists) {
      if (Array.isArray(pl?.tracks)) {
        pl.tracks.slice(0, 6).forEach(pushIfNeeded);
      }
    }
  }
  if (Array.isArray(seedTracks)) {
    seedTracks.forEach(pushIfNeeded);
  }

  return out;
}

/**
 * Deprecated/blocked 30-second preview normalizer:
 * Apple iTunes Search API only returns ~29.7s preview clips (`AudioPreview...m4a`).
 * To guarantee every song plays full-length (>= 75s), 30-second preview URLs are rejected.
 */
export function normalizeItunesTrack(item, options = {}) {
  if (!item || typeof item !== 'object') return null;
  const videoId = extractYouTubeVideoId(item.videoId);
  const previewUrl = String(item.previewUrl || item.streamUrl || '').trim();
  if (isInstantAudioPreviewUrl(previewUrl) && !videoId) {
    return null;
  }
  return normalizeYtMusicTrack(item, options);
}

/**
 * Pure state machine for Picture-in-Picture (Gambar dalam Gambar) and Headset Mode (Audio-Only background).
 * Clicking the Headset button hides PiP (`isPipOpen: false`, `pipHeadsetMode: true`) while keeping audio playing!
 */
export function resolvePipHeadsetStateTransition({
  isPipOpen = false,
  pipHeadsetMode = false,
  isPlaying = false,
  action = 'toggle-pip',
} = {}) {
  if (action === 'activate-headset') {
    return {
      isPipOpen: false,
      pipHeadsetMode: true,
      shouldExitNativePip: true,
      shouldKeepPlaying: Boolean(isPlaying),
      statusMessage:
        'Mode Headset aktif — Gambar-dalam-Gambar disembunyikan, musik tetap berputar di latar belakang.',
    };
  }
  if (action === 'toggle-headset') {
    const nextHeadset = !pipHeadsetMode;
    return {
      isPipOpen: false,
      pipHeadsetMode: nextHeadset,
      shouldExitNativePip: nextHeadset,
      shouldKeepPlaying: Boolean(isPlaying),
      statusMessage: nextHeadset
        ? 'Mode Headset aktif — Gambar-dalam-Gambar disembunyikan, musik tetap berputar di latar belakang.'
        : 'Mode Headset dinonaktifkan.',
    };
  }
  if (action === 'enter-pip') {
    return {
      isPipOpen: true,
      pipHeadsetMode: false,
      shouldExitNativePip: false,
      shouldKeepPlaying: Boolean(isPlaying),
      statusMessage: 'Gambar-dalam-Gambar (PiP) aktif — ketuk ikon Headset untuk sembunyikan layar PiP.',
    };
  }
  if (action === 'close-pip') {
    return {
      isPipOpen: false,
      pipHeadsetMode: Boolean(pipHeadsetMode),
      shouldExitNativePip: true,
      shouldKeepPlaying: Boolean(isPlaying),
      statusMessage: '',
    };
  }
  if (action === 'auto-pip-background') {
    if (pipHeadsetMode || !isPlaying) {
      return {
        isPipOpen: false,
        pipHeadsetMode: Boolean(pipHeadsetMode),
        shouldExitNativePip: false,
        shouldKeepPlaying: Boolean(isPlaying),
        statusMessage: '',
      };
    }
    return {
      isPipOpen: true,
      pipHeadsetMode: false,
      shouldExitNativePip: false,
      shouldKeepPlaying: true,
      statusMessage: 'Gambar-dalam-Gambar (PiP) otomatis aktif.',
    };
  }
  // Default: 'toggle-pip'
  if (isPipOpen) {
    return {
      isPipOpen: false,
      pipHeadsetMode: false,
      shouldExitNativePip: true,
      shouldKeepPlaying: Boolean(isPlaying),
      statusMessage: '',
    };
  }
  return {
    isPipOpen: true,
    pipHeadsetMode: false,
    shouldExitNativePip: false,
    shouldKeepPlaying: Boolean(isPlaying),
    statusMessage: 'Gambar-dalam-Gambar (PiP) aktif — ketuk ikon Headset untuk sembunyikan layar PiP.',
  };
}
