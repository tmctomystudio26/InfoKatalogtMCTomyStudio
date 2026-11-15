/**
 * Pure recommendation & preference-scoring logic for Ad-Free Smart Music Player.
 * Tracks searched keywords and frequently played tracks/artists/genres.
 */

export const MAX_SEARCH_TERMS = 24;
export const MAX_TRACK_STATS = 40;

export function createDefaultMusicPrefs() {
  return {
    searches: {}, // { normalizedTerm: { count, lastUsedAt } }
    trackPlays: {}, // { trackId: { count, title, artist, genre, lastPlayedAt } }
    genres: {}, // { normalizedGenre: weight }
    artists: {}, // { normalizedArtist: weight }
    skips: {}, // { trackId: skipCount }
  };
}

export function tokenizeText(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function pruneMapByRecency(mapObj, maxKeys, scoreFn) {
  const entries = Object.entries(mapObj || {});
  if (entries.length <= maxKeys) return mapObj || {};
  entries.sort((a, b) => scoreFn(b[1]) - scoreFn(a[1]));
  return Object.fromEntries(entries.slice(0, maxKeys));
}

export function recordMusicPreference(currentPrefs, event) {
  const base = createDefaultMusicPrefs();
  const prefs = {
    searches: { ...(currentPrefs?.searches || base.searches) },
    trackPlays: { ...(currentPrefs?.trackPlays || base.trackPlays) },
    genres: { ...(currentPrefs?.genres || base.genres) },
    artists: { ...(currentPrefs?.artists || base.artists) },
    skips: { ...(currentPrefs?.skips || base.skips) },
  };
  const now = Date.now();

  if (event?.type === 'search') {
    const clean = String(event.term || '').trim().toLowerCase();
    if (clean.length >= 2) {
      const prev = prefs.searches[clean] || { count: 0, lastUsedAt: 0 };
      prefs.searches[clean] = {
        count: prev.count + 1,
        lastUsedAt: now,
      };
      for (const token of tokenizeText(clean)) {
        if (token !== clean) {
          const tp = prefs.searches[token] || { count: 0, lastUsedAt: 0 };
          prefs.searches[token] = {
            count: tp.count + 0.5,
            lastUsedAt: now,
          };
        }
      }
      prefs.searches = pruneMapByRecency(
        prefs.searches,
        MAX_SEARCH_TERMS,
        (v) => (v.count || 0) * 1000 + (v.lastUsedAt || 0) / 1e9
      );
    }
  } else if (event?.type === 'play' && event.track) {
    const t = event.track;
    const id = String(t.id || '').trim();
    if (id) {
      const prev = prefs.trackPlays[id] || { count: 0 };
      prefs.trackPlays[id] = {
        count: prev.count + 1,
        title: t.title || '',
        artist: t.artist || '',
        genre: t.genre || '',
        lastPlayedAt: now,
      };
      prefs.trackPlays = pruneMapByRecency(
        prefs.trackPlays,
        MAX_TRACK_STATS,
        (v) => (v.count || 0) * 1000 + (v.lastPlayedAt || 0) / 1e9
      );
    }
    const g = String(t.genre || '').trim().toLowerCase();
    if (g) prefs.genres[g] = (prefs.genres[g] || 0) + 1;
    const a = String(t.artist || '').trim().toLowerCase();
    if (a) prefs.artists[a] = (prefs.artists[a] || 0) + 1;
  } else if (event?.type === 'skip' && event.track) {
    const id = String(event.track.id || '').trim();
    if (id) {
      prefs.skips[id] = (prefs.skips[id] || 0) + 1;
    }
  }

  return prefs;
}

export function getTopSearchKeywords(prefs, limit = 3) {
  const entries = Object.entries(prefs?.searches || {});
  if (entries.length === 0) return [];
  return entries
    .sort(
      (a, b) =>
        (b[1].count || 0) * 10 + (b[1].lastUsedAt || 0) / 1e12 -
        ((a[1].count || 0) * 10 + (a[1].lastUsedAt || 0) / 1e12)
    )
    .slice(0, limit)
    .map(([term]) => term);
}

export function scoreTrackForUser(track, prefs) {
  if (!track) return 1;
  let score = 1;
  const hay = `${track.title || ''} ${track.artist || ''} ${track.genre || ''} ${track.tags || ''}`.toLowerCase();

  // Prioritize Indonesian viral 2026 Gen-Z songs, DJ remixes, & covers
  if (track.isIndonesianViral) {
    score += 2.5;
  }
  if (/\b(remix|dj|edit|koplo|cover|acoustic|sped up|slowed|indonesia|indo)\b/i.test(hay)) {
    score += 1.4;
  }

  // Search keyword & token affinity boost
  for (const [term, meta] of Object.entries(prefs?.searches || {})) {
    if (!term || term.length < 2) continue;
    const count = Number(meta?.count || 0);
    if (hay.includes(term)) {
      score += 3.5 * Math.min(6, count);
    }
  }

  // Genre affinity
  const g = String(track.genre || '').trim().toLowerCase();
  if (g && prefs?.genres?.[g]) {
    score += 2.2 * Math.min(5, prefs.genres[g]);
  }

  // Artist affinity
  const a = String(track.artist || '').trim().toLowerCase();
  if (a && prefs?.artists?.[a]) {
    score += 3 * Math.min(5, prefs.artists[a]);
  }

  // Track play familiarity boost (sweet spot before slight cooldown)
  const plays = Number(prefs?.trackPlays?.[track.id]?.count || 0);
  if (plays > 0) {
    score += Math.min(8, plays * 2.4);
  }

  // Skip penalty
  const skips = Number(prefs?.skips?.[track.id] || 0);
  if (skips > 0) {
    score = Math.max(0.25, score / (1 + skips * 1.4));
  }

  return Number(score.toFixed(4));
}

export function pickWeightedRandomTrack(
  tracks = [],
  prefs = null,
  currentTrackId = null,
  rng = Math.random
) {
  const list = Array.isArray(tracks) ? tracks.filter((t) => t && t.id && t.streamUrl) : [];
  if (list.length === 0) return null;

  const pool =
    list.length > 1 && currentTrackId
      ? list.filter((t) => t.id !== currentTrackId)
      : list;

  const weighted = pool.map((track) => ({
    track,
    weight: Math.max(0.1, scoreTrackForUser(track, prefs)),
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);

  if (totalWeight <= 0) return pool[0];

  const r = Math.min(0.999999, Math.max(0, Number(rng?.() ?? Math.random())));
  let cursor = r * totalWeight;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.track;
  }
  return weighted[weighted.length - 1].track;
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

  const popWidth = Math.min(320, vw - margin * 2);
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

