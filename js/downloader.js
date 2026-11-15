/**
 * Client-side API adapters for No-Watermark Media Downloader
 * Supports TikTok (HD/SD/MP3 No Watermark), YouTube (MP4/MP3), Facebook (HD/SD), & Instagram (Reels/Post).
 */

import { detectDownloaderPlatform, normalizeDownloaderResult } from './tools-logic.js';

function sanitizeInputUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function fetchJsonWithTimeout(url, timeoutMs = 11000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMediaDownload(rawUrl) {
  const cleanUrl = sanitizeInputUrl(rawUrl);
  const platform = detectDownloaderPlatform(cleanUrl);
  if (!platform) {
    throw new Error('Link tidak dikenali. Gunakan tautan TikTok, YouTube, Instagram, atau Facebook.');
  }

  const encoded = encodeURIComponent(cleanUrl);

  if (platform === 'tiktok') {
    // Primary: TikWM HD No Watermark API
    try {
      const json = await fetchJsonWithTimeout(`https://www.tikwm.com/api/?url=${encoded}&hd=1`, 9000);
      const normalized = normalizeDownloaderResult(json, 'tiktok');
      if (normalized && normalized.links.length > 0) {
        return normalized;
      }
    } catch {
      // Fall through to backup endpoint
    }

    // Fallback: DavidCyril TikTok No Watermark API
    try {
      const json = await fetchJsonWithTimeout(
        `https://apis.davidcyriltech.my.id/download/tiktok?url=${encoded}`,
        11000
      );
      const normalized = normalizeDownloaderResult(json, 'tiktok');
      if (normalized && normalized.links.length > 0) {
        return normalized;
      }
    } catch {
      // Handled below
    }

    throw new Error('Gagal memproses video TikTok. Pastikan video bersifat publik lalu coba lagi.');
  }

  if (platform === 'youtube') {
    const [mp4Res, mp3Res] = await Promise.allSettled([
      fetchJsonWithTimeout(`https://apis.davidcyriltech.my.id/download/ytmp4?url=${encoded}`, 13000),
      fetchJsonWithTimeout(`https://apis.davidcyriltech.my.id/download/ytmp3?url=${encoded}`, 13000),
    ]);

    const normalized = normalizeDownloaderResult(
      {
        mp4: mp4Res.status === 'fulfilled' ? mp4Res.value : null,
        mp3: mp3Res.status === 'fulfilled' ? mp3Res.value : null,
      },
      'youtube'
    );
    if (normalized && normalized.links.length > 0) {
      return normalized;
    }
    throw new Error('Gagal memproses tautan YouTube. Coba salin ulang link video/Shorts yang publik.');
  }

  if (platform === 'facebook') {
    const json = await fetchJsonWithTimeout(
      `https://apis.davidcyriltech.my.id/facebook?url=${encoded}`,
      12000
    );
    const normalized = normalizeDownloaderResult(json, 'facebook');
    if (normalized && normalized.links.length > 0) {
      return normalized;
    }
    throw new Error('Video Facebook tidak ditemukan atau bersifat privat.');
  }

  if (platform === 'instagram') {
    const json = await fetchJsonWithTimeout(
      `https://apis.davidcyriltech.my.id/instagram?url=${encoded}`,
      12000
    );
    const normalized = normalizeDownloaderResult(json, 'instagram');
    if (normalized && normalized.links.length > 0) {
      return normalized;
    }
    throw new Error(json?.message || 'Reels / Post Instagram tidak tersedia atau akun bersifat privat.');
  }

  throw new Error('Platform belum didukung.');
}

export async function triggerDirectMediaSave(fileUrl, baseName = 'manifestudio-media', ext = 'mp4') {
  const safeName =
    String(baseName || 'manifestudio-media')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'manifestudio-media';
  const filename = `${safeName}.${ext || 'mp4'}`;

  try {
    const res = await fetch(fileUrl);
    if (res.ok) {
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
  } catch {
    // Fallback to direct anchor download when remote CDN disallows CORS blob reads
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
