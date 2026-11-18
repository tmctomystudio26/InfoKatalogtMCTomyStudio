/**
 * Real Browser Media Transcoder & Compression Engine
 * Uses:
 * 1. Open-Source FFmpeg WebAssembly (@ffmpeg/ffmpeg local wrapper + @ffmpeg/core@0.12.6 single-thread)
 *    with persistent CacheStorage caching & real download/encoding progress (%).
 * 2. Pure-JS LAME MP3 Encoder (./vendor/lame.min.js) + WebAudio decodeAudioData for fast offline MP3/WAV extraction.
 * 3. HTML5 <video> + <canvas> + MediaRecorder real-time transcoding fallback for video compression.
 * 4. Open-Source PDF.js (pdfjs-dist) for pixel-accurate PDF-to-Image rendering & compressed PDF text extraction.
 */

const FFMPEG_CORE_CANDIDATES = [
  {
    coreJs: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasm: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
  },
  {
    coreJs: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    wasm: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
  },
];

const PDFJS_MODULE_URLS = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs',
  'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.min.mjs',
];

const PDFJS_WORKER_URLS = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs',
  'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs',
];

const FFMPEG_CACHE_NAME = 'manifestudio-ffmpeg-core-v1';

let cachedFfmpegInstance = null;
let cachedFfmpegLoadPromise = null;
let cachedLameLoaded = false;
let cachedPdfJs = null;

/**
 * Pure helper: builds exact FFmpeg CLI arguments for real audio/video format conversion.
 */
export function buildFfmpegTranscodeArgs(inName, outName, targetFormat = 'mp3') {
  const fmt = String(targetFormat || 'mp3').toLowerCase();
  if (fmt === 'mp3') {
    return ['-i', inName, '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', '-y', outName];
  }
  if (fmt === 'm4a' || fmt === 'mp4a') {
    return ['-i', inName, '-vn', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-movflags', '+faststart', '-f', 'ipod', '-y', outName];
  }
  if (fmt === 'aac') {
    return ['-i', inName, '-vn', '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-f', 'adts', '-y', outName];
  }
  if (fmt === 'wav') {
    return ['-i', inName, '-vn', '-c:a', 'pcm_s16le', '-ar', '44100', '-ac', '2', '-y', outName];
  }
  if (fmt === 'ogg') {
    return ['-i', inName, '-vn', '-c:a', 'libvorbis', '-q:a', '5', '-y', outName];
  }
  if (fmt === 'flac') {
    return ['-i', inName, '-vn', '-c:a', 'flac', '-y', outName];
  }
  if (fmt === 'webm') {
    return ['-i', inName, '-c:v', 'libvpx', '-b:v', '1200k', '-deadline', 'realtime', '-cpu-used', '4', '-c:a', 'libvorbis', '-q:a', '4', '-y', outName];
  }
  if (fmt === 'mp4') {
    return ['-i', inName, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', outName];
  }
  if (fmt === 'gif') {
    return ['-i', inName, '-t', '8', '-vf', 'fps=10,scale=480:-1:flags=lanczos', '-loop', '0', '-y', outName];
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(fmt)) {
    return ['-ss', '00:00:00.100', '-i', inName, '-frames:v', '1', '-q:v', '2', '-y', outName];
  }
  return ['-i', inName, '-y', outName];
}

/**
 * Pure helper: builds exact FFmpeg CLI arguments for genuine video compression (libx264 + AAC).
 */
export function buildFfmpegVideoCompressArgs(
  inName,
  outName,
  {
    methodId = 'social-shield',
    targetWidth = 1080,
    targetHeight = 1920,
    targetVideoMbps = 5.0,
    tighterPass = false,
  } = {}
) {
  let crf = 25;
  let audioBitrate = '128k';
  if (methodId === 'lossless-strip') {
    crf = tighterPass ? 26 : 21;
  } else if (methodId === 'pixel-lock') {
    crf = tighterPass ? 28 : 23;
  } else if (methodId === 'social-shield') {
    crf = tighterPass ? 31 : 25;
  } else {
    crf = tighterPass ? 33 : 28;
    audioBitrate = '96k';
  }

  const maxKbps = Math.max(450, Math.round((Number(targetVideoMbps) || 4.0) * (tighterPass ? 650 : 900)));
  const bufKbps = maxKbps * 2;
  const safeW = Math.max(2, Math.round(Number(targetWidth) / 2) * 2);
  const safeH = Math.max(2, Math.round(Number(targetHeight) / 2) * 2);

  return [
    '-i',
    inName,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-vf',
    `scale=w='min(iw,${safeW})':h='min(ih,${safeH})':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`,
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-crf',
    String(crf),
    '-maxrate',
    `${maxKbps}k`,
    '-bufsize',
    `${bufKbps}k`,
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    audioBitrate,
    '-movflags',
    '+faststart',
    '-y',
    outName,
  ];
}

async function fetchWithCacheAndProgress(url, contentType, onChunkProgress) {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(FFMPEG_CACHE_NAME);
      const cached = await cache.match(url);
      if (cached && cached.ok) {
        onChunkProgress(1);
        const ab = await cached.arrayBuffer();
        return URL.createObjectURL(new Blob([ab], { type: contentType }));
      }
    } catch {
      // Ignore cache read error
    }
  }

  const resp = await fetch(url, { mode: 'cors' });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} saat memuat ${url}`);
  }

  const totalHeader = Number(resp.headers.get('content-length')) || 0;
  let finalBuffer;

  if (resp.body && typeof resp.body.getReader === 'function') {
    const reader = resp.body.getReader();
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      if (totalHeader > 0) {
        onChunkProgress(Math.min(1, received / totalHeader));
      } else {
        onChunkProgress(Math.min(0.95, received / (32 * 1024 * 1024)));
      }
    }
    const merged = new Uint8Array(received);
    let pos = 0;
    for (const c of chunks) {
      merged.set(c, pos);
      pos += c.byteLength;
    }
    finalBuffer = merged.buffer;
  } else {
    finalBuffer = await resp.arrayBuffer();
    onChunkProgress(1);
  }

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(FFMPEG_CACHE_NAME);
      await cache.put(
        url,
        new Response(finalBuffer.slice(0), {
          status: 200,
          headers: { 'Content-Type': contentType },
        })
      );
    } catch {
      // Ignore CacheStorage quota limits
    }
  }

  return URL.createObjectURL(new Blob([finalBuffer], { type: contentType }));
}

/**
 * Loads and caches single-thread FFmpeg WebAssembly engine in the browser.
 */
export async function getFfmpegEngine(onProgress = () => {}) {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    throw new Error('FFmpeg WebAssembly hanya berjalan di lingkungan browser.');
  }
  if (cachedFfmpegInstance && cachedFfmpegInstance.loaded) {
    return cachedFfmpegInstance;
  }
  if (cachedFfmpegLoadPromise) {
    return cachedFfmpegLoadPromise;
  }

  cachedFfmpegLoadPromise = (async () => {
    const { FFmpeg } = await import('./vendor/ffmpeg/index.js');
    const ffmpeg = new FFmpeg();

    let lastErr = null;
    for (const cdn of FFMPEG_CORE_CANDIDATES) {
      try {
        onProgress({
          phase: 'wasm-init',
          percent: 12,
          label: 'Menyiapkan mesin transcode FFmpeg WebAssembly...',
        });
        const coreURL = await fetchWithCacheAndProgress(cdn.coreJs, 'text/javascript', () => {});
        const wasmURL = await fetchWithCacheAndProgress(cdn.wasm, 'application/wasm', (ratio) => {
          const pct = Math.round(14 + ratio * 28);
          onProgress({
            phase: 'wasm-download',
            percent: pct,
            label:
              ratio >= 0.99
                ? 'Menginisialisasi FFmpeg WebAssembly (siap)...'
                : `Memuat mesin FFmpeg WASM (${Math.round(ratio * 100)}%)...`,
          });
        });

        await ffmpeg.load({ coreURL, wasmURL });
        cachedFfmpegInstance = ffmpeg;
        return ffmpeg;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Gagal memuat mesin transcode FFmpeg WebAssembly.');
  })();

  try {
    return await cachedFfmpegLoadPromise;
  } catch (err) {
    cachedFfmpegLoadPromise = null;
    throw err;
  }
}

/**
 * Transcodes any real audio or video file buffer using FFmpeg WebAssembly.
 */
export async function transcodeWithFfmpeg({
  arrayBuffer,
  sourceExt = 'mp4',
  targetFormat = 'mp3',
  onProgress = () => {},
} = {}) {
  const ffmpeg = await getFfmpegEngine(onProgress);
  const cleanSrcExt = String(sourceExt || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const fmt = String(targetFormat || 'mp3').toLowerCase();
  const ffOutExt = fmt === 'mp4a' ? 'm4a' : fmt === 'jpeg' ? 'jpg' : fmt;
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const inName = `in_${uid}.${cleanSrcExt}`;
  const outName = `out_${uid}.${ffOutExt}`;

  const logs = [];
  const logHandler = ({ message }) => {
    if (message) logs.push(String(message));
  };
  const progressHandler = ({ progress }) => {
    const p = Number(progress);
    if (Number.isFinite(p) && p >= 0 && p <= 1) {
      const pct = Math.min(94, Math.max(46, Math.round(46 + p * 48)));
      onProgress({
        phase: 'ffmpeg-transcode',
        percent: pct,
        label: `Mengonversi bitstream media ke .${fmt.toUpperCase()} (${Math.round(p * 100)}%)...`,
      });
    }
  };

  ffmpeg.on('log', logHandler);
  ffmpeg.on('progress', progressHandler);

  try {
    onProgress({
      phase: 'ffmpeg-write',
      percent: 45,
      label: `Menyiapkan data ke FFmpeg (${fmt.toUpperCase()})...`,
    });
    await ffmpeg.writeFile(inName, new Uint8Array(arrayBuffer));

    const args = buildFfmpegTranscodeArgs(inName, outName, fmt);
    const exitCode = await ffmpeg.exec(args);

    const logJoined = logs.join('\n');
    if (exitCode !== 0) {
      if (/does not contain any stream/i.test(logJoined)) {
        throw new Error('Berkas sumber tidak memiliki jalur audio/video yang dapat dikonversi.');
      }
      throw new Error(`FFmpeg gagal mengonversi ke .${fmt.toUpperCase()} (kode ${exitCode}).`);
    }

    const outData = await ffmpeg.readFile(outName);
    if (!(outData instanceof Uint8Array) || outData.byteLength < 64) {
      throw new Error('Hasil konversi FFmpeg kosong atau tidak valid.');
    }
    return outData.slice().buffer;
  } finally {
    ffmpeg.off('log', logHandler);
    ffmpeg.off('progress', progressHandler);
    try {
      await ffmpeg.deleteFile(inName);
    } catch {
      // Ignore cleanup error
    }
    try {
      await ffmpeg.deleteFile(outName);
    } catch {
      // Ignore cleanup error
    }
  }
}

/**
 * Loads pure-JS LAME MP3 encoder from local vendor script (./js/vendor/lame.min.js).
 */
async function ensureLameEncoderLoaded() {
  if (typeof window === 'undefined') return null;
  if (cachedLameLoaded && window.lamejs?.Mp3Encoder) {
    return window.lamejs;
  }
  await new Promise((resolve, reject) => {
    if (window.lamejs?.Mp3Encoder) {
      cachedLameLoaded = true;
      resolve();
      return;
    }
    const existing = document.querySelector('script[data-manifestudio-lame="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Gagal memuat lamejs.')), { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = './js/vendor/lame.min.js';
    s.async = true;
    s.setAttribute('data-manifestudio-lame', '1');
    s.onload = () => {
      cachedLameLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error('Gagal memuat encoder MP3 lokal (lamejs).'));
    document.head.appendChild(s);
  });
  return window.lamejs;
}

/**
 * Fast real audio extraction via WebAudio decodeAudioData + pure-JS lamejs MP3 encoder (no fake headers).
 */
export async function transcodeAudioWithWebAudioAndLame({
  arrayBuffer,
  targetFormat = 'mp3',
  encodeWavFn,
  onProgress = () => {},
} = {}) {
  const AudioCtx =
    typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null;
  if (!AudioCtx) {
    throw new Error('WebAudio API tidak tersedia di lingkungan ini.');
  }

  const fmt = String(targetFormat || 'mp3').toLowerCase();
  if (fmt !== 'mp3' && fmt !== 'wav') {
    throw new Error(`Format ${fmt} memerlukan mesin FFmpeg.`);
  }

  let ctx = null;
  try {
    onProgress({
      phase: 'webaudio-decode',
      percent: 24,
      label: 'Mendekode trek audio asli dari berkas media...',
    });
    ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const numChannels = Math.min(2, Math.max(1, audioBuffer.numberOfChannels || 1));
    const sampleRate = audioBuffer.sampleRate || 44100;
    const channels = [];
    for (let ch = 0; ch < numChannels; ch += 1) {
      channels.push(audioBuffer.getChannelData(ch));
    }

    if (fmt === 'wav') {
      onProgress({
        phase: 'wav-encode',
        percent: 78,
        label: 'Menyusun PCM 16-bit RIFF WAVE...',
      });
      return encodeWavFn(channels, sampleRate);
    }

    const lamejs = await ensureLameEncoderLoaded();
    if (!lamejs || typeof lamejs.Mp3Encoder !== 'function') {
      throw new Error('Encoder MP3 lokal tidak tersedia.');
    }

    const toInt16 = (floatArr) => {
      const i16 = new Int16Array(floatArr.length);
      for (let i = 0; i < floatArr.length; i += 1) {
        const s = Math.max(-1, Math.min(1, floatArr[i]));
        i16[i] = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      }
      return i16;
    };

    const leftI16 = toInt16(channels[0]);
    const rightI16 = numChannels > 1 ? toInt16(channels[1]) : leftI16;
    const encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 192);
    const mp3Chunks = [];
    const blockSize = 1152;
    const totalSamples = leftI16.length;

    for (let i = 0; i < totalSamples; i += blockSize) {
      const lChunk = leftI16.subarray(i, i + blockSize);
      const rChunk = rightI16.subarray(i, i + blockSize);
      const encoded =
        numChannels === 2
          ? encoder.encodeBuffer(lChunk, rChunk)
          : encoder.encodeBuffer(lChunk);
      if (encoded.length > 0) {
        mp3Chunks.push(new Uint8Array(encoded));
      }
      if ((i / blockSize) % 40 === 0) {
        const ratio = i / Math.max(1, totalSamples);
        onProgress({
          phase: 'lame-encode',
          percent: Math.min(92, Math.max(35, Math.round(35 + ratio * 57))),
          label: `Mengodekan frame MPEG-1 Layer III (.mp3) ${Math.round(ratio * 100)}%...`,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const tail = encoder.flush();
    if (tail.length > 0) {
      mp3Chunks.push(new Uint8Array(tail));
    }

    const totalBytes = mp3Chunks.reduce((acc, c) => acc + c.byteLength, 0);
    if (totalBytes < 128) {
      throw new Error('Hasil MP3 kosong.');
    }
    const out = new Uint8Array(totalBytes);
    let pos = 0;
    for (const c of mp3Chunks) {
      out.set(c, pos);
      pos += c.byteLength;
    }
    return out.buffer;
  } finally {
    if (ctx && typeof ctx.close === 'function') {
      try {
        await ctx.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Real video compression via FFmpeg WASM (H.264 + AAC faststart), with MediaRecorder fallback.
 */
export async function compressVideoWithRealEngine(file, plan, onProgress = () => {}) {
  const rawBuffer = await file.arrayBuffer();
  const extMatch = String(file.name || '').match(/\.([a-z0-9]+)$/i);
  const srcExt = extMatch ? extMatch[1].toLowerCase() : 'mp4';

  try {
    const ffmpeg = await getFfmpegEngine(onProgress);
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const inName = `comp_in_${uid}.${srcExt}`;
    const outName = `comp_out_${uid}.mp4`;

    const progressHandler = ({ progress }) => {
      const p = Number(progress);
      if (Number.isFinite(p) && p >= 0 && p <= 1) {
        const pct = Math.min(94, Math.max(46, Math.round(46 + p * 48)));
        onProgress({
          phase: 'ffmpeg-compress',
          percent: pct,
          label: `Mengompresi frame video H.264 (${Math.round(p * 100)}%)...`,
        });
      }
    };

    ffmpeg.on('progress', progressHandler);
    try {
      await ffmpeg.writeFile(inName, new Uint8Array(rawBuffer));
      let args = buildFfmpegVideoCompressArgs(inName, outName, {
        methodId: plan.methodId,
        targetWidth: plan.targetWidth,
        targetHeight: plan.targetHeight,
        targetVideoMbps: plan.targetVideoMbps,
        tighterPass: false,
      });

      let exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg video compression gagal (kode ${exitCode})`);
      }

      let outBytes = await ffmpeg.readFile(outName);
      if (outBytes instanceof Uint8Array && outBytes.byteLength >= file.size) {
        onProgress({
          phase: 'ffmpeg-compress-pass2',
          percent: 78,
          label: 'Video sudah padat — menjalankan optimasi bitrate lanjutan...',
        });
        args = buildFfmpegVideoCompressArgs(inName, outName, {
          methodId: plan.methodId,
          targetWidth: plan.targetWidth,
          targetHeight: plan.targetHeight,
          targetVideoMbps: Math.max(1.2, (plan.targetVideoMbps || 4) * 0.6),
          tighterPass: true,
        });
        exitCode = await ffmpeg.exec(args);
        if (exitCode === 0) {
          const pass2Bytes = await ffmpeg.readFile(outName);
          if (pass2Bytes instanceof Uint8Array && pass2Bytes.byteLength > 256 && pass2Bytes.byteLength < outBytes.byteLength) {
            outBytes = pass2Bytes;
          }
        }
      }

      if (!(outBytes instanceof Uint8Array) || outBytes.byteLength < 256) {
        throw new Error('Output kompresi video tidak valid.');
      }

      const finalBuffer = outBytes.slice().buffer;
      const finalBlob = new Blob([finalBuffer], { type: 'video/mp4' });
      const playable = await verifyPlayableMediaBlob(finalBlob, 'video');
      if (!playable) {
        throw new Error('Verifikasi pemutaran video hasil kompresi gagal.');
      }
      return {
        blob: finalBlob,
        ext: 'mp4',
        engineLabel: 'FFmpeg WebAssembly H.264 / AAC Real Transcoder',
      };
    } finally {
      ffmpeg.off('progress', progressHandler);
      try {
        await ffmpeg.deleteFile(inName);
      } catch {
        // Ignore
      }
      try {
        await ffmpeg.deleteFile(outName);
      } catch {
        // Ignore
      }
    }
  } catch (ffmpegErr) {
    // Fallback to real HTML5 Canvas + MediaRecorder re-encoding when FFmpeg WASM fails/offline
    if (typeof document !== 'undefined' && typeof MediaRecorder !== 'undefined') {
      return await compressVideoWithMediaRecorderFallback(file, plan, onProgress, ffmpegErr);
    }
    throw ffmpegErr;
  }
}

async function compressVideoWithMediaRecorderFallback(file, plan, onProgress, primaryErr) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(primaryErr || new Error('Timeout membaca video sumber.')), 8000);
      video.onloadedmetadata = () => {
        clearTimeout(t);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(t);
        reject(primaryErr || new Error('Video tidak dapat didekode oleh browser.'));
      };
    });

    const w = plan.targetWidth || video.videoWidth || 720;
    const h = plan.targetHeight || video.videoHeight || 1280;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');

    const stream = canvas.captureStream(30);
    if (typeof video.captureStream === 'function') {
      const vStream = video.captureStream();
      vStream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    }

    const mimeCandidate = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(
      (m) => MediaRecorder.isTypeSupported(m)
    );
    if (!mimeCandidate) {
      throw primaryErr || new Error('Codec perekam video tidak didukung di browser ini.');
    }

    const recorder = new MediaRecorder(stream, {
      mimeType: mimeCandidate,
      videoBitsPerSecond: Math.max(800_000, Math.min(6_000_000, plan.videoBitrateBps || 2_500_000)),
      audioBitsPerSecond: 128_000,
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const donePromise = new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeCandidate.split(';')[0] }));
    });

    const dur = Math.max(0.5, Number(video.duration) || 5);
    recorder.start(250);
    await video.play();

    let rafId = 0;
    const drawLoop = () => {
      if (video.paused || video.ended) return;
      ctx.drawImage(video, 0, 0, w, h);
      const pct = Math.min(94, Math.max(40, Math.round(40 + (video.currentTime / dur) * 54)));
      onProgress({
        phase: 'mediarecorder-compress',
        percent: pct,
        label: `Mengompresi video via Canvas Transcoder (${Math.round((video.currentTime / dur) * 100)}%)...`,
      });
      rafId = requestAnimationFrame(drawLoop);
    };
    drawLoop();

    await new Promise((resolve) => {
      video.onended = resolve;
      setTimeout(resolve, Math.min(120000, Math.round(dur * 1000) + 2000));
    });
    cancelAnimationFrame(rafId);
    if (recorder.state !== 'inactive') recorder.stop();
    const outBlob = await donePromise;
    return {
      blob: outBlob,
      ext: mimeCandidate.includes('mp4') ? 'mp4' : 'webm',
      engineLabel: 'Browser Canvas + MediaRecorder Real Transcoder',
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Verifies in-browser that an encoded audio or video Blob actually loads and decodes cleanly.
 */
export async function verifyPlayableMediaBlob(blob, mediaKind = 'audio') {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return Boolean(blob && blob.size > 64);
  }
  if (!blob || blob.size < 64) return false;

  const objUrl = URL.createObjectURL(blob);
  const el = document.createElement(mediaKind === 'video' ? 'video' : 'audio');
  el.preload = 'metadata';
  el.muted = true;
  let metaOk = false;
  try {
    metaOk = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 4500);
      el.onloadedmetadata = () => {
        clearTimeout(timer);
        if (mediaKind === 'video') {
          resolve((el.videoWidth || 0) > 0 || (Number.isFinite(el.duration) && el.duration > 0));
        } else {
          resolve(Number.isFinite(el.duration) && el.duration > 0);
        }
      };
      el.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      el.src = objUrl;
    });
  } finally {
    URL.revokeObjectURL(objUrl);
  }
  if (metaOk) return true;

  // Secondary check via WebAudio decodeAudioData (handles raw ADTS AAC / WAV / MP3 when HTMLAudioElement lacks container hint)
  if (mediaKind === 'audio') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      let ctx = null;
      try {
        ctx = new AudioCtx();
        const ab = await blob.arrayBuffer();
        const decoded = await ctx.decodeAudioData(ab);
        return Boolean(decoded && decoded.duration > 0.05 && decoded.numberOfChannels >= 1);
      } catch {
        return false;
      } finally {
        if (ctx && typeof ctx.close === 'function') {
          try {
            await ctx.close();
          } catch {
            // Ignore
          }
        }
      }
    }
  }
  return false;
}

/**
 * Captures a genuine video frame onto an HTML5 Canvas and returns the PNG/JPEG/WebP/BMP/GIF Blob/Buffer.
 */
export async function captureRealVideoFrameInBrowser(file) {
  if (typeof document === 'undefined') return null;
  const objUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  video.src = objUrl;

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout membaca frame video')), 6000);
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Gagal mendekode frame video'));
      };
    });

    const targetTime = Math.min(0.6, Math.max(0.05, (video.duration || 1) * 0.2));
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 1500);
      video.onseeked = () => {
        clearTimeout(timer);
        resolve();
      };
      try {
        video.currentTime = targetTime;
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });

    const w = Math.max(16, video.videoWidth || 640);
    const h = Math.max(16, video.videoHeight || 360);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    return blob;
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

async function getPdfJsLib() {
  if (typeof window === 'undefined') return null;
  if (cachedPdfJs) return cachedPdfJs;

  for (let i = 0; i < PDFJS_MODULE_URLS.length; i += 1) {
    try {
      const mod = await import(/* @vite-ignore */ PDFJS_MODULE_URLS[i]);
      if (mod?.getDocument) {
        if (mod.GlobalWorkerOptions) {
          mod.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URLS[i];
        }
        cachedPdfJs = mod;
        return mod;
      }
    } catch {
      // Try next CDN
    }
  }
  return null;
}

/**
 * Renders real PDF page 1 onto a high-DPI Canvas using open-source PDF.js (handles FlateDecode, fonts, images).
 */
export async function renderPdfPageToCanvasData(arrayBuffer) {
  const pdfjs = await getPdfJsLib();
  if (!pdfjs) return null;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  return { blob, width: canvas.width, height: canvas.height, numPages: doc.numPages };
}

/**
 * Extracts real multi-page UTF-8 text from compressed/uncompressed PDFs using PDF.js.
 */
export async function extractPdfTextWithPdfJs(arrayBuffer) {
  const pdfjs = await getPdfJsLib();
  if (!pdfjs) return null;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
  const lines = [];
  const maxPages = Math.min(doc.numPages, 30);
  for (let p = 1; p <= maxPages; p += 1) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const pageStr = (tc.items || [])
      .map((item) => item.str || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageStr) {
      if (maxPages > 1) lines.push(`Halaman ${p}:`);
      lines.push(pageStr);
    }
  }
  return lines.length > 0 ? lines : null;
}
