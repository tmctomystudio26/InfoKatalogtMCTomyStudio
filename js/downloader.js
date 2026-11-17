/**
 * Client-side API adapters for No-Watermark Media Downloader
 * Supports TikTok (HD/SD/MP3 No Watermark + Photo Carousel + Story),
 * YouTube (Direct MP4 + MP3 dual parallel fetch without 3P redirects),
 * Facebook (HD/SD Video + Photo Post + Story),
 * & Instagram (Reels, Single Photo, Multi-Photo Carousel, Story, & Copy Caption).
 * Includes real-time conversion/fetch progress and streaming download progress callbacks.
 */

import {
  detectDownloaderContentType,
  detectDownloaderPlatform,
  formatBytes,
  isBlockedRedirectDownloadUrl,
  normalizeDownloaderResult,
  parseYouTubeVideoId,
} from './tools-logic.js?v=26';

const COBALT_ENDPOINT = 'https://cobaltapi.cjs.nz/';
const TIOO_BACKENDS = [
  'https://backend1.tioo.eu.org',
  'https://backend2.tioo.eu.org',
  'https://backend3.tioo.eu.org',
  'https://backend4.tioo.eu.org',
];

const CIRCUIT_COOLDOWN_MS = 180000; // 3 minutes cooldown per failing mirror host
const nodeCircuitMap = new Map();

function isNodeCircuitOpen(url) {
  try {
    const origin = new URL(url).origin;
    const state = nodeCircuitMap.get(origin);
    if (!state) return false;
    if (state.failures >= 2 && Date.now() - state.lastFailedAt < CIRCUIT_COOLDOWN_MS) {
      return true;
    }
    if (Date.now() - state.lastFailedAt >= CIRCUIT_COOLDOWN_MS) {
      nodeCircuitMap.delete(origin);
    }
  } catch {
    // Ignore URL parse error
  }
  return false;
}

function recordNodeOutcome(url, ok) {
  try {
    const origin = new URL(url).origin;
    if (ok) {
      nodeCircuitMap.delete(origin);
      return;
    }
    const prev = nodeCircuitMap.get(origin) || { failures: 0, lastFailedAt: 0 };
    nodeCircuitMap.set(origin, {
      failures: prev.failures + 1,
      lastFailedAt: Date.now(),
    });
  } catch {
    // Ignore
  }
}

function sanitizeInputUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function fetchJsonWithTimeout(url, timeoutMs = 9500, fetchOpts = {}) {
  if (isNodeCircuitOpen(url) && !fetchOpts.bypassCircuit) {
    throw new Error('Node mirror sedang cooldown sementara');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      ...fetchOpts,
    });
    if (!res.ok) {
      if (res.status >= 500 || res.status === 429 || res.status === 403) {
        recordNodeOutcome(url, false);
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    recordNodeOutcome(url, true);
    return data;
  } catch (err) {
    if (err?.name === 'AbortError' || /failed to fetch|network/i.test(String(err?.message || ''))) {
      recordNodeOutcome(url, false);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCobaltMedia(mediaUrl, options = {}, timeoutMs = 13000) {
  return fetchJsonWithTimeout(COBALT_ENDPOINT, timeoutMs, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: mediaUrl,
      ...options,
    }),
  });
}

function hasTiooMediaContent(data, routePath) {
  if (!data || typeof data !== 'object') return false;
  if (routePath === 'youtube') {
    return Boolean(data.mp4 || data.mp3 || data.url);
  }
  if (routePath === 'ttdl') {
    return Boolean(
      (Array.isArray(data.video) && data.video.length > 0) ||
        (Array.isArray(data.audio) && data.audio.length > 0) ||
        (Array.isArray(data.images) && data.images.length > 0) ||
        typeof data.video === 'string'
    );
  }
  if (routePath === 'igdl') {
    return Boolean(
      (Array.isArray(data) && data.length > 0) ||
        (Array.isArray(data.result) && data.result.length > 0) ||
        (Array.isArray(data.data) && data.data.length > 0) ||
        data.url
    );
  }
  if (routePath === 'fbdown') {
    return Boolean(data.hd || data.sd || data.HD || data.Normal_video || data.url || data.result);
  }
  return Boolean(data.status || data.result || data.data || data.url);
}

async function fetchTiooWithFailover(routePath, encodedUrl, timeoutMs = 11000) {
  const settled = await Promise.allSettled(
    TIOO_BACKENDS.map((host) =>
      fetchJsonWithTimeout(`${host}/${routePath}?url=${encodedUrl}`, timeoutMs)
    )
  );
  const valid = settled
    .filter((r) => r.status === 'fulfilled' && hasTiooMediaContent(r.value, routePath))
    .map((r) => r.value);

  if (valid.length === 0) return null;

  if (routePath === 'youtube') {
    const merged = { ...valid[0] };
    for (let i = 1; i < valid.length; i += 1) {
      const alt = valid[i];
      if (!merged.mp4 && alt.mp4) merged.mp4 = alt.mp4;
      if (!merged.mp3 && alt.mp3) merged.mp3 = alt.mp3;
      if (!merged.title && alt.title) merged.title = alt.title;
      if (!merged.author && alt.author) merged.author = alt.author;
      if (!merged.thumbnail && alt.thumbnail) merged.thumbnail = alt.thumbnail;
    }
    return merged;
  }

  return valid[0];
}

function appendAudioExtractFallbackIfMissing(result) {
  if (!result || !Array.isArray(result.links)) return result;
  if (result.links.some((l) => l.isAudio)) return result;
  const videoLink = result.links.find((l) => !l.isAudio && !l.isImage && l.url);
  if (!videoLink) return result;
  const isCorsBlockedGoogle = /^https?:\/\/[^/]*\.?googlevideo\.com\//i.test(videoLink.url);
  if (isCorsBlockedGoogle) return result;

  result.links.push({
    label: 'Ekstrak Audio dari Video (WAV)',
    quality: 'AUDIO',
    ext: 'wav',
    url: videoLink.url,
    extractAudioFromVideo: true,
    isAudio: true,
    isImage: false,
  });
  return result;
}

function mergeCandidateResults(candidates = []) {
  const valid = candidates.filter((c) => c && (c.links?.length > 0 || c.photos?.length > 0));
  if (valid.length === 0) return null;

  const primary = { ...valid[0], links: [...(valid[0].links || [])], photos: [...(valid[0].photos || [])] };
  const seenUrls = new Set(primary.links.map((l) => l.url));

  for (let i = 1; i < valid.length; i += 1) {
    const other = valid[i];
    if (!primary.title && other.title) primary.title = other.title;
    if (!primary.caption && other.caption) primary.caption = other.caption;
    if (!primary.thumbnail && other.thumbnail) primary.thumbnail = other.thumbnail;
    if ((!primary.author || primary.author === 'TikTok' || primary.author === 'Instagram') && other.author) {
      primary.author = other.author;
    }
    if (!primary.durationSec && other.durationSec) primary.durationSec = other.durationSec;

    for (const l of other.links || []) {
      if (!l?.url || seenUrls.has(l.url)) continue;
      const alreadyHasAudio = primary.links.some((x) => x.isAudio);
      const alreadyHasVideo = primary.links.some((x) => !x.isAudio && !x.isImage);
      // Prioritize filling missing MP3 or missing MP4, plus any unique items
      if ((l.isAudio && !alreadyHasAudio) || (!l.isAudio && !l.isImage && !alreadyHasVideo) || (!l.isImage && primary.links.length < 6)) {
        seenUrls.add(l.url);
        const duplicateLabel = primary.links.some((x) => x.label === l.label);
        primary.links.push(duplicateLabel ? { ...l, label: `${l.label} (Mirror ${i + 1})` } : l);
      }
    }

    if ((other.photos?.length || 0) > (primary.photos?.length || 0)) {
      primary.photos = [...other.photos];
    }
  }

  return primary;
}

export async function fetchMediaDownload(rawUrl, onProgress = () => {}) {
  const emitProgress = (percent, label, stage = 'processing') => {
    try {
      onProgress({ percent: Math.max(0, Math.min(100, Math.round(percent))), label, stage });
    } catch {
      // Ignore UI callback error
    }
  };

  emitProgress(12, 'Menganalisis tautan & mendeteksi platform...', 'analyzing');

  const cleanUrl = sanitizeInputUrl(rawUrl);
  const platform = detectDownloaderPlatform(cleanUrl);
  if (!platform) {
    throw new Error('Link tidak dikenali. Gunakan tautan TikTok, YouTube, Instagram, atau Facebook.');
  }

  const contentType = detectDownloaderContentType(cleanUrl);
  const encoded = encodeURIComponent(cleanUrl);

  if (platform === 'tiktok') {
    emitProgress(35, 'Menghubungi server TikTok untuk Video HD, Foto & Audio MP3...', 'fetching');

    const [tiooVal, tikwmSettled, cobaltVidSettled, cobaltAudSettled] = await Promise.allSettled([
      fetchTiooWithFailover('ttdl', encoded, 10000),
      fetchJsonWithTimeout(`https://www.tikwm.com/api/?url=${encoded}&hd=1`, 9500),
      fetchCobaltMedia(cleanUrl, { videoQuality: '1080' }, 10500),
      fetchCobaltMedia(cleanUrl, { downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' }, 10500),
    ]);

    emitProgress(68, 'Mengonversi & menggabungkan aliran Video MP4 dan Audio MP3...', 'converting');

    const candidates = [];
    if (tikwmSettled.status === 'fulfilled' && tikwmSettled.value) {
      const n = normalizeDownloaderResult(tikwmSettled.value, 'tiktok', cleanUrl);
      if (n) candidates.push(n);
    }
    if (tiooVal.status === 'fulfilled' && tiooVal.value) {
      const n = normalizeDownloaderResult(tiooVal.value, 'tiktok', cleanUrl);
      if (n) candidates.push(n);
    }
    if (cobaltVidSettled.status === 'fulfilled' && cobaltVidSettled.value) {
      const rawCo = {
        ...cobaltVidSettled.value,
        ...(cobaltAudSettled.status === 'fulfilled' && cobaltAudSettled.value?.url
          ? { audioUrl: cobaltAudSettled.value.url }
          : {}),
      };
      const n = normalizeDownloaderResult(rawCo, 'tiktok', cleanUrl);
      if (n) candidates.push(n);
    }

    let merged = mergeCandidateResults(candidates);

    // Fallback to DavidCyril only if no valid links or missing audio on video post
    const missingLinks = !merged || (merged.links.length === 0 && (merged.photos?.length || 0) === 0);
    const missingAudio = merged && !merged.links.some((l) => l.isAudio) && (merged.photos?.length || 0) === 0;
    if (missingLinks || missingAudio) {
      emitProgress(84, 'Mengambil opsi cadangan MP4/MP3 TikTok...', 'converting');
      try {
        const dcJson = await fetchJsonWithTimeout(
          `https://apis.davidcyriltech.my.id/download/tiktok?url=${encoded}`,
          10000
        );
        const dcNorm = normalizeDownloaderResult(dcJson, 'tiktok', cleanUrl);
        if (dcNorm) {
          merged = mergeCandidateResults(merged ? [merged, dcNorm] : [dcNorm]);
        }
      } catch {
        // Optional fallback failed
      }
    }

    if (merged && (merged.links.length > 0 || (merged.photos?.length || 0) > 0)) {
      appendAudioExtractFallbackIfMissing(merged);
      emitProgress(100, 'Media TikTok siap diunduh!', 'ready');
      return merged;
    }

    throw new Error(
      'Gagal memproses postingan/story TikTok. Pastikan postingan bersifat publik lalu coba lagi.'
    );
  }

  if (platform === 'youtube') {
    const ytParsed = parseYouTubeVideoId(cleanUrl);
    if (ytParsed.truncated) {
      throw new Error(
        `Tautan YouTube terlihat terpotong (ID "${ytParsed.videoId}" hanya ${ytParsed.videoId.length} karakter). Salin ulang link lengkap YouTube/Shorts lalu coba lagi.`
      );
    }

    emitProgress(32, 'Mengambil stream Video MP4 & mengonversi Audio MP3 YouTube...', 'fetching');

    const [oembedRes, cobaltVideoRes, cobaltAudioRes, tiooRes, ummyRes] = await Promise.allSettled([
      fetchJsonWithTimeout(`https://www.youtube.com/oembed?url=${encoded}&format=json`, 6000),
      fetchCobaltMedia(cleanUrl, { videoQuality: '720' }, 12000),
      fetchCobaltMedia(
        cleanUrl,
        { downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' },
        12000
      ),
      fetchTiooWithFailover('youtube', encoded, 11500),
      fetchJsonWithTimeout(`https://api.siputzx.my.id/api/d/ummy?url=${encoded}`, 13000),
    ]);

    emitProgress(66, 'Memeriksa kelengkapan format MP4 & MP3...', 'converting');

    let tiooData = tiooRes.status === 'fulfilled' ? tiooRes.value : null;
    const ummyPayload = ummyRes.status === 'fulfilled' && ummyRes.value?.status ? ummyRes.value : null;
    const ummyUrls = Array.isArray(ummyPayload?.data?.url) ? ummyPayload.data.url : [];

    const hasUmmyVideo = ummyUrls.some(
      (u) =>
        u?.url &&
        !isBlockedRedirectDownloadUrl(u.url) &&
        String(u.ext || '').toLowerCase() === 'mp4' &&
        (u.no_audio === false || !/dash/i.test(String(u.type || '')))
    );
    const hasUmmyAudio = ummyUrls.some(
      (u) =>
        u?.url &&
        !isBlockedRedirectDownloadUrl(u.url) &&
        (u.audio === true || /audio|m4a|mp3|opus/i.test(`${u.type || ''} ${u.ext || ''}`))
    );

    const hasTrueAudioFromPrimary = Boolean(
      (cobaltAudioRes.status === 'fulfilled' && cobaltAudioRes.value?.url) ||
        tiooData?.mp3 ||
        hasUmmyAudio
    );

    // Wave 2 retry across Tioo nodes if audio stream is still missing
    if (!hasTrueAudioFromPrimary) {
      emitProgress(76, 'Mencoba ulang server cadangan Audio YouTube...', 'converting');
      try {
        const retryTioo = await fetchTiooWithFailover('youtube', encoded, 10000);
        if (retryTioo) {
          tiooData = tiooData
            ? {
                ...tiooData,
                mp4: tiooData.mp4 || retryTioo.mp4,
                mp3: tiooData.mp3 || retryTioo.mp3,
              }
            : retryTioo;
        }
      } catch {
        // Ignore retry error
      }
    }

    const hasVideoFromPrimary = Boolean(
      (cobaltVideoRes.status === 'fulfilled' && cobaltVideoRes.value?.url) ||
        tiooData?.mp4 ||
        hasUmmyVideo
    );
    const hasAnyAudioAfterRetry = Boolean(hasTrueAudioFromPrimary || tiooData?.mp3);

    let mp4Fallback = null;
    let mp3Fallback = null;

    if (!hasVideoFromPrimary || !hasAnyAudioAfterRetry) {
      emitProgress(86, 'Melengkapi tautan Video MP4 & Musik MP3 cadangan...', 'converting');
      const [dcMp4, dcMp3v2, dcMp3] = await Promise.allSettled([
        !hasVideoFromPrimary
          ? fetchJsonWithTimeout(`https://apis.davidcyriltech.my.id/download/ytmp4?url=${encoded}`, 10000)
          : Promise.resolve(null),
        !hasAnyAudioAfterRetry
          ? fetchJsonWithTimeout(`https://apis.davidcyriltech.my.id/download/ytmp3v2?url=${encoded}`, 10000)
          : Promise.resolve(null),
        !hasAnyAudioAfterRetry
          ? fetchJsonWithTimeout(`https://apis.davidcyriltech.my.id/download/ytmp3?url=${encoded}`, 10000)
          : Promise.resolve(null),
      ]);
      if (dcMp4.status === 'fulfilled') mp4Fallback = dcMp4.value;
      if (dcMp3v2.status === 'fulfilled' && dcMp3v2.value?.result?.download_url) {
        mp3Fallback = dcMp3v2.value;
      } else if (dcMp3.status === 'fulfilled') {
        mp3Fallback = dcMp3.value;
      }
    }

    const normalized = normalizeDownloaderResult(
      {
        oembed: oembedRes.status === 'fulfilled' ? oembedRes.value : null,
        cobaltVideo: cobaltVideoRes.status === 'fulfilled' ? cobaltVideoRes.value : null,
        cobaltAudio: cobaltAudioRes.status === 'fulfilled' ? cobaltAudioRes.value : null,
        tioo: tiooData,
        ummy: ummyPayload,
        mp4: mp4Fallback,
        mp3: mp3Fallback,
      },
      'youtube',
      cleanUrl
    );

    if (normalized && normalized.links.length > 0) {
      appendAudioExtractFallbackIfMissing(normalized);
      emitProgress(100, 'Video MP4 & Audio MP3 YouTube siap!', 'ready');
      return normalized;
    }
    throw new Error('Gagal memproses tautan YouTube. Coba salin ulang link video/Shorts yang publik.');
  }

  if (platform === 'facebook') {
    emitProgress(38, 'Menghubungi server Facebook untuk Video HD, Foto & Audio...', 'fetching');

    const [cobaltVidRes, cobaltAudRes, tiooFbRes, dcFbRes] = await Promise.allSettled([
      fetchCobaltMedia(cleanUrl, { videoQuality: '1080' }, 12000),
      fetchCobaltMedia(cleanUrl, { downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' }, 12000),
      fetchTiooWithFailover('fbdown', encoded, 11000),
      fetchJsonWithTimeout(`https://apis.davidcyriltech.my.id/facebook?url=${encoded}`, 11000),
    ]);

    emitProgress(78, 'Mengonversi & menyusun opsi kualitas HD/SD Facebook...', 'converting');

    const candidates = [];
    if (cobaltVidRes.status === 'fulfilled' && cobaltVidRes.value) {
      const n = normalizeDownloaderResult(cobaltVidRes.value, 'facebook', cleanUrl);
      if (n) candidates.push(n);
    }
    if (dcFbRes.status === 'fulfilled' && dcFbRes.value) {
      const n = normalizeDownloaderResult(dcFbRes.value, 'facebook', cleanUrl);
      if (n) candidates.push(n);
    }
    if (tiooFbRes.status === 'fulfilled' && tiooFbRes.value) {
      const n = normalizeDownloaderResult(tiooFbRes.value, 'facebook', cleanUrl);
      if (n) candidates.push(n);
    }

    const merged = mergeCandidateResults(candidates);
    if (merged && (merged.links.length > 0 || (merged.photos?.length || 0) > 0)) {
      if (cobaltAudRes.status === 'fulfilled' && cobaltAudRes.value?.url && !merged.links.some((l) => l.isAudio)) {
        merged.links.push({
          label: 'Audio / Suara Facebook (MP3)',
          quality: 'MP3',
          ext: 'mp3',
          url: String(cobaltAudRes.value.url),
          isAudio: true,
          isImage: false,
        });
      }
      appendAudioExtractFallbackIfMissing(merged);
      emitProgress(100, 'Media Facebook siap diunduh!', 'ready');
      return merged;
    }

    throw new Error('Postingan/Story Facebook tidak ditemukan atau bersifat privat.');
  }

  if (platform === 'instagram') {
    emitProgress(35, 'Mengambil Foto, Slide Carousel, Reels, Story & Caption IG...', 'fetching');

    const [sssSettled, ummyIgSettled, cobaltSettled, cobaltAudSettled, tiooSettled] = await Promise.allSettled([
      fetchJsonWithTimeout(`https://api.siputzx.my.id/api/d/sssinstagram?url=${encoded}`, 14000),
      fetchJsonWithTimeout(`https://api.siputzx.my.id/api/d/ummy?url=${encoded}`, 14000),
      fetchCobaltMedia(cleanUrl, { videoQuality: '1080' }, 11500),
      fetchCobaltMedia(cleanUrl, { downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' }, 11500),
      fetchTiooWithFailover('igdl', encoded, 11000),
    ]);

    emitProgress(72, 'Mengonversi hasil media & merapikan caption...', 'converting');

    const candidates = [];
    for (const settled of [sssSettled, ummyIgSettled, cobaltSettled, tiooSettled]) {
      if (settled.status === 'fulfilled' && settled.value) {
        const norm = normalizeDownloaderResult(settled.value, 'instagram', cleanUrl);
        if (norm) candidates.push(norm);
      }
    }

    let best = null;
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        const scoreA = (a.photos?.length || 0) * 3 + (a.links?.length || 0) * 2 + (a.caption ? 2 : 0);
        const scoreB = (b.photos?.length || 0) * 3 + (b.links?.length || 0) * 2 + (b.caption ? 2 : 0);
        return scoreB - scoreA;
      });
      best = mergeCandidateResults(candidates);
    } else {
      emitProgress(86, 'Mencoba server cadangan Instagram...', 'fetching');
      const [fastdlSettled, igramSettled, dcIgSettled] = await Promise.allSettled([
        fetchJsonWithTimeout(`https://api.siputzx.my.id/api/d/fastdl?url=${encoded}`, 11000),
        fetchJsonWithTimeout(`https://api.siputzx.my.id/api/d/igram?url=${encoded}`, 11000),
        fetchJsonWithTimeout(`https://apis.davidcyriltech.my.id/instagram?url=${encoded}`, 11000),
      ]);
      const fbCandidates = [];
      for (const settled of [fastdlSettled, igramSettled, dcIgSettled]) {
        if (settled.status === 'fulfilled' && settled.value) {
          const norm = normalizeDownloaderResult(settled.value, 'instagram', cleanUrl);
          if (norm) fbCandidates.push(norm);
        }
      }
      if (fbCandidates.length > 0) {
        best = mergeCandidateResults(fbCandidates);
      }
    }

    if (best && (best.links.length > 0 || (best.photos?.length || 0) > 0)) {
      if (
        cobaltAudSettled.status === 'fulfilled' &&
        cobaltAudSettled.value?.url &&
        !best.links.some((l) => l.isAudio) &&
        best.links.some((l) => !l.isAudio && !l.isImage)
      ) {
        best.links.push({
          label: 'Audio Reels / Instagram (MP3)',
          quality: 'MP3',
          ext: 'mp3',
          url: String(cobaltAudSettled.value.url),
          isAudio: true,
          isImage: false,
        });
      }
      appendAudioExtractFallbackIfMissing(best);
      emitProgress(100, 'Media Instagram siap diunduh!', 'ready');
      return best;
    }

    throw new Error(
      contentType.isStory
        ? 'Story Instagram tidak tersedia atau akun bersifat privat.'
        : 'Postingan Foto / Carousel / Reels Instagram tidak tersedia atau akun bersifat privat.'
    );
  }

  throw new Error('Platform belum didukung.');
}

export async function triggerDirectMediaSave(
  fileUrl,
  baseName = 'manifestudio-media',
  ext = 'mp4',
  onProgress = () => {}
) {
  if (isBlockedRedirectDownloadUrl(fileUrl)) {
    throw new Error('Tautan dialihkan ke halaman pihak ketiga dan diblokir.');
  }

  const emit = (stage, percent, label, loadedBytes = 0, totalBytes = 0) => {
    try {
      onProgress({
        stage,
        percent: Math.max(0, Math.min(100, Math.round(percent))),
        label,
        loadedBytes,
        totalBytes,
      });
    } catch {
      // Ignore callback error
    }
  };

  const safeName =
    String(baseName || 'manifestudio-media')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'manifestudio-media';
  const filename = `${safeName}.${ext || 'mp4'}`;

  let htmlDetected = false;
  emit('connecting', 10, `Menghubungkan & menyiapkan file ${filename}...`);

  try {
    const res = await fetch(fileUrl);
    if (res.ok) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        htmlDetected = true;
      } else {
        const totalBytes = Number(res.headers.get('content-length')) || 0;
        let blob;

        if (res.body && typeof res.body.getReader === 'function') {
          emit('converting', 18, `Sedang dikonversi & diunduh (${filename})...`, 0, totalBytes);
          const reader = res.body.getReader();
          const chunks = [];
          let loadedBytes = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              loadedBytes += value.byteLength;
              const pct =
                totalBytes > 0
                  ? Math.min(96, 18 + Math.round((loadedBytes / totalBytes) * 78))
                  : Math.min(92, 22 + Math.round(loadedBytes / 120000));
              const statusTxt =
                totalBytes > 0
                  ? `Sedang didownload: ${formatBytes(loadedBytes)} / ${formatBytes(totalBytes)} (${pct}%)`
                  : `Sedang didownload: ${formatBytes(loadedBytes)}...`;
              emit('downloading', pct, statusTxt, loadedBytes, totalBytes);
            }
          }
          blob = new Blob(chunks, { type: contentType || undefined });
        } else {
          emit('downloading', 55, `Sedang didownload (${filename})...`);
          blob = await res.blob();
        }

        emit('done', 100, `Selesai! Menyimpan ${filename} (${formatBytes(blob.size)})`, blob.size, blob.size);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        return true;
      }
    }
  } catch {
    // Fallback to direct anchor download when remote CDN disallows CORS blob reads
  }

  if (htmlDetected) {
    throw new Error('Tautan tidak menyediakan berkas media langsung (halaman HTML terdeteksi).');
  }

  emit('redirect', 100, `Mengunduh langsung via browser (${filename})...`);
  const a = document.createElement('a');
  a.href = fileUrl;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
  return false;
}

export async function triggerBatchPhotoDownload(photos = [], baseTitle = 'manifestudio-slide', onProgress = () => {}) {
  const list = Array.isArray(photos) ? photos : [];
  if (list.length === 0) return 0;

  let completed = 0;
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    const basePct = Math.round((i / list.length) * 100);
    onProgress({
      current: i + 1,
      total: list.length,
      percent: Math.max(5, basePct),
      label: `Mengunduh foto ${i + 1} dari ${list.length}...`,
    });
    await triggerDirectMediaSave(
      item.url,
      `${baseTitle}-foto-${i + 1}`,
      item.ext || 'jpg',
      (dlProg) => {
        const slideSpan = 100 / list.length;
        const combinedPct = Math.min(100, Math.round(basePct + (dlProg.percent / 100) * slideSpan));
        onProgress({
          current: i + 1,
          total: list.length,
          percent: combinedPct,
          label: `Foto ${i + 1}/${list.length}: ${dlProg.label}`,
        });
      }
    );
    completed += 1;
    if (i < list.length - 1) {
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  onProgress({
    current: list.length,
    total: list.length,
    percent: 100,
    label: `Selesai mengunduh seluruh ${list.length} foto HD!`,
  });
  return completed;
}

function encodeAudioBufferToWav(audioBuffer) {
  const numChannels = Math.min(2, audioBuffer.numberOfChannels || 1);
  const sampleRate = audioBuffer.sampleRate || 44100;
  const numSamples = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataByteLength = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataByteLength, true);

  const channels = [];
  for (let ch = 0; ch < numChannels; ch += 1) {
    channels.push(audioBuffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export async function extractAudioFromVideoUrl(
  videoUrl,
  baseName = 'manifestudio-audio',
  onProgress = () => {}
) {
  if (isBlockedRedirectDownloadUrl(videoUrl)) {
    throw new Error('Tautan dialihkan ke halaman pihak ketiga dan diblokir.');
  }

  const emit = (stage, percent, label) => {
    try {
      onProgress({
        stage,
        percent: Math.max(0, Math.min(100, Math.round(percent))),
        label,
      });
    } catch {
      // Ignore callback error
    }
  };

  const safeName =
    String(baseName || 'manifestudio-audio')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'manifestudio-audio';
  const filename = `${safeName}-audio.wav`;

  emit('connecting', 10, 'Mengambil aliran video untuk mengekstrak audio...');
  const res = await fetch(videoUrl);
  if (!res.ok) {
    throw new Error(`Server video mengembalikan HTTP ${res.status}`);
  }

  const totalBytes = Number(res.headers.get('content-length')) || 0;
  let arrayBuffer;

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.byteLength;
        const pct =
          totalBytes > 0
            ? Math.min(62, 12 + Math.round((loaded / totalBytes) * 50))
            : Math.min(58, 16 + Math.round(loaded / 200000));
        emit('downloading', pct, `Mengambil video (${formatBytes(loaded)})...`);
      }
    }
    const blob = new Blob(chunks);
    arrayBuffer = await blob.arrayBuffer();
  } else {
    emit('downloading', 45, 'Mengambil video untuk ekstraksi audio...');
    arrayBuffer = await res.arrayBuffer();
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    throw new Error('Browser tidak mendukung dekode audio lokal.');
  }

  emit('converting', 72, 'Mengekstrak & mengonversi trek audio menjadi file audio...');
  const ctx = new AudioCtx();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    emit('converting', 90, 'Menyusun berkas audio siap simpan...');
    const wavBlob = encodeAudioBufferToWav(audioBuffer);
    emit('done', 100, `Selesai! Menyimpan ${filename} (${formatBytes(wavBlob.size)})`);

    const blobUrl = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    return true;
  } finally {
    try {
      await ctx.close();
    } catch {
      // Ignore audio context close error
    }
  }
}

