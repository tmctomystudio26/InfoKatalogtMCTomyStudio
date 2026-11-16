/**
 * Client-side API adapters for No-Watermark Media Downloader
 * Supports TikTok (HD/SD/MP3 No Watermark + Photo Carousel + Story),
 * YouTube (Direct MP4/MP3 without 3P redirects),
 * Facebook (HD/SD Video + Photo Post + Story),
 * & Instagram (Reels, Single Photo, Multi-Photo Carousel, Story, & Copy Caption).
 */

import {
  detectDownloaderContentType,
  detectDownloaderPlatform,
  isBlockedRedirectDownloadUrl,
  normalizeDownloaderResult,
} from './tools-logic.js';

const COBALT_ENDPOINT = 'https://cobaltapi.cjs.nz/';

function sanitizeInputUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function fetchJsonWithTimeout(url, timeoutMs = 11000, fetchOpts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      ...fetchOpts,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
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

export async function fetchMediaDownload(rawUrl) {
  const cleanUrl = sanitizeInputUrl(rawUrl);
  const platform = detectDownloaderPlatform(cleanUrl);
  if (!platform) {
    throw new Error('Link tidak dikenali. Gunakan tautan TikTok, YouTube, Instagram, atau Facebook.');
  }

  const contentType = detectDownloaderContentType(cleanUrl);
  const encoded = encodeURIComponent(cleanUrl);

  if (platform === 'tiktok') {
    // 1. Primary: TikWM HD No Watermark API (supports Video, Story, and Photo Mode Carousels via d.images)
    try {
      const json = await fetchJsonWithTimeout(`https://www.tikwm.com/api/?url=${encoded}&hd=1`, 9500);
      const normalized = normalizeDownloaderResult(json, 'tiktok', cleanUrl);
      if (normalized && (normalized.links.length > 0 || normalized.photos?.length > 0)) {
        return normalized;
      }
    } catch {
      // Fall through
    }

    // 2. Secondary: Cobalt direct stream / picker (supports TikTok photo slideshows & stories)
    try {
      const json = await fetchCobaltMedia(cleanUrl, { videoQuality: '1080' }, 11000);
      const normalized = normalizeDownloaderResult(json, 'tiktok', cleanUrl);
      if (normalized && (normalized.links.length > 0 || normalized.photos?.length > 0)) {
        return normalized;
      }
    } catch {
      // Fall through
    }

    // 3. Last fallback: DavidCyril TikTok
    try {
      const json = await fetchJsonWithTimeout(
        `https://apis.davidcyriltech.my.id/download/tiktok?url=${encoded}`,
        11000
      );
      const normalized = normalizeDownloaderResult(json, 'tiktok', cleanUrl);
      if (normalized && (normalized.links.length > 0 || normalized.photos?.length > 0)) {
        return normalized;
      }
    } catch {
      // Handled below
    }

    throw new Error(
      'Gagal memproses postingan/story TikTok. Pastikan postingan bersifat publik lalu coba lagi.'
    );
  }

  if (platform === 'youtube') {
    const [oembedRes, cobaltVideoRes, cobaltAudioRes, tiooRes] = await Promise.allSettled([
      fetchJsonWithTimeout(`https://www.youtube.com/oembed?url=${encoded}&format=json`, 6000),
      fetchCobaltMedia(cleanUrl, { videoQuality: '720' }, 13500),
      fetchCobaltMedia(
        cleanUrl,
        { downloadMode: 'audio', audioFormat: 'mp3', audioBitrate: '128' },
        13500
      ),
      fetchJsonWithTimeout(`https://backend1.tioo.eu.org/youtube?url=${encoded}`, 13000),
    ]);

    let mp4Fallback = null;
    const hasVideoFromPrimary =
      (cobaltVideoRes.status === 'fulfilled' && cobaltVideoRes.value?.url) ||
      (tiooRes.status === 'fulfilled' && tiooRes.value?.mp4);

    if (!hasVideoFromPrimary) {
      try {
        mp4Fallback = await fetchJsonWithTimeout(
          `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encoded}`,
          10000
        );
      } catch {
        // Optional fallback failed
      }
    }

    const normalized = normalizeDownloaderResult(
      {
        oembed: oembedRes.status === 'fulfilled' ? oembedRes.value : null,
        cobaltVideo: cobaltVideoRes.status === 'fulfilled' ? cobaltVideoRes.value : null,
        cobaltAudio: cobaltAudioRes.status === 'fulfilled' ? cobaltAudioRes.value : null,
        tioo: tiooRes.status === 'fulfilled' ? tiooRes.value : null,
        mp4: mp4Fallback,
      },
      'youtube',
      cleanUrl
    );

    if (normalized && normalized.links.length > 0) {
      return normalized;
    }
    throw new Error('Gagal memproses tautan YouTube. Coba salin ulang link video/Shorts yang publik.');
  }

  if (platform === 'facebook') {
    // 1. Primary: Cobalt direct Facebook tunnel (supports video, photo posts, & stories)
    try {
      const json = await fetchCobaltMedia(cleanUrl, { videoQuality: '1080' }, 12000);
      const normalized = normalizeDownloaderResult(json, 'facebook', cleanUrl);
      if (normalized && (normalized.links.length > 0 || normalized.photos?.length > 0)) {
        return normalized;
      }
    } catch {
      // Fall through
    }

    // 2. Secondary: Tioo Facebook API
    try {
      const json = await fetchJsonWithTimeout(`https://backend1.tioo.eu.org/fbdown?url=${encoded}`, 11000);
      const normalized = normalizeDownloaderResult(json, 'facebook', cleanUrl);
      if (normalized && (normalized.links.length > 0 || normalized.photos?.length > 0)) {
        return normalized;
      }
    } catch {
      // Fall through
    }

    // 3. Fallback: DavidCyril Facebook
    try {
      const json = await fetchJsonWithTimeout(
        `https://apis.davidcyriltech.my.id/facebook?url=${encoded}`,
        11000
      );
      const normalized = normalizeDownloaderResult(json, 'facebook', cleanUrl);
      if (normalized && (normalized.links.length > 0 || normalized.photos?.length > 0)) {
        return normalized;
      }
    } catch {
      // Handled below
    }

    throw new Error('Postingan/Story Facebook tidak ditemukan atau bersifat privat.');
  }

  if (platform === 'instagram') {
    // Run Tioo IG (supports single photo, carousel array, reels, & stories) and Cobalt in parallel for speed & resilience
    const [tiooSettled, cobaltSettled, ryzenSettled] = await Promise.allSettled([
      fetchJsonWithTimeout(`https://backend1.tioo.eu.org/igdl?url=${encoded}`, 16000),
      fetchCobaltMedia(cleanUrl, { videoQuality: '1080' }, 12500),
      fetchJsonWithTimeout(`https://api.ryzendesu.vip/api/downloader/igdl?url=${encoded}`, 12500),
    ]);

    const candidates = [];
    if (tiooSettled.status === 'fulfilled' && tiooSettled.value) {
      const norm = normalizeDownloaderResult(tiooSettled.value, 'instagram', cleanUrl);
      if (norm && (norm.links.length > 0 || norm.photos?.length > 0)) candidates.push(norm);
    }
    if (cobaltSettled.status === 'fulfilled' && cobaltSettled.value) {
      const norm = normalizeDownloaderResult(cobaltSettled.value, 'instagram', cleanUrl);
      if (norm && (norm.links.length > 0 || norm.photos?.length > 0)) candidates.push(norm);
    }
    if (ryzenSettled.status === 'fulfilled' && ryzenSettled.value) {
      const norm = normalizeDownloaderResult(ryzenSettled.value, 'instagram', cleanUrl);
      if (norm && (norm.links.length > 0 || norm.photos?.length > 0)) candidates.push(norm);
    }

    if (candidates.length > 0) {
      // Pick the candidate with the richest photo/link set + caption
      candidates.sort((a, b) => {
        const scoreA = (a.photos?.length || 0) * 3 + (a.links?.length || 0) * 2 + (a.caption ? 2 : 0);
        const scoreB = (b.photos?.length || 0) * 3 + (b.links?.length || 0) * 2 + (b.caption ? 2 : 0);
        return scoreB - scoreA;
      });
      const best = candidates[0];
      // Merge caption if another candidate extracted a caption while best didn't
      if (!best.caption) {
        const withCaption = candidates.find((c) => Boolean(c.caption));
        if (withCaption) best.caption = withCaption.caption;
      }
      return best;
    }

    // 4. Last fallback: DavidCyril IG
    try {
      const json = await fetchJsonWithTimeout(
        `https://apis.davidcyriltech.my.id/instagram?url=${encoded}`,
        11000
      );
      const normalized = normalizeDownloaderResult(json, 'instagram', cleanUrl);
      if (normalized && (normalized.links.length > 0 || normalized.photos?.length > 0)) {
        return normalized;
      }
    } catch {
      // Never leak raw HTTP 500 error codes to user
    }

    throw new Error(
      contentType.isStory
        ? 'Story Instagram tidak tersedia atau akun bersifat privat.'
        : 'Postingan Foto / Carousel / Reels Instagram tidak tersedia atau akun bersifat privat.'
    );
  }

  throw new Error('Platform belum didukung.');
}

export async function triggerDirectMediaSave(fileUrl, baseName = 'manifestudio-media', ext = 'mp4') {
  if (isBlockedRedirectDownloadUrl(fileUrl)) {
    throw new Error('Tautan dialihkan ke halaman pihak ketiga dan diblokir.');
  }

  const safeName =
    String(baseName || 'manifestudio-media')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'manifestudio-media';
  const filename = `${safeName}.${ext || 'mp4'}`;

  let htmlDetected = false;
  try {
    const res = await fetch(fileUrl);
    if (res.ok) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        htmlDetected = true;
      } else {
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
        return true;
      }
    }
  } catch {
    // Fallback to direct anchor download when remote CDN disallows CORS blob reads
  }

  if (htmlDetected) {
    throw new Error('Tautan tidak menyediakan berkas media langsung (halaman HTML terdeteksi).');
  }

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
    onProgress({ current: i + 1, total: list.length });
    await triggerDirectMediaSave(
      item.url,
      `${baseTitle}-foto-${i + 1}`,
      item.ext || 'jpg'
    );
    completed += 1;
    if (i < list.length - 1) {
      await new Promise((r) => setTimeout(r, 380));
    }
  }
  return completed;
}
