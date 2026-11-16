/**
 * Real Internet Speedtest Engine & Animated Canvas Speedometer
 * Uses Cloudflare Global Edge Speed API (`speed.cloudflare.com`), `ipwho.is` / `ipapi.co`
 * for ISP/IP metadata, and high-DPI 60fps spring-damped Canvas rendering.
 */

import {
  calculatePingStats,
  computeMbps,
  computeSustainedAverageMbps,
  describeCloudflareColo,
  evaluateConnectionQuality,
  parseDeviceTelemetry,
  speedToGaugeRatio,
} from './tools-logic.js';

const CF_DOWN_URL = 'https://speed.cloudflare.com/__down';
const CF_UP_URL = 'https://speed.cloudflare.com/__up';
const CF_TRACE_URL = 'https://speed.cloudflare.com/cdn-cgi/trace';

export function readClientDeviceTelemetry() {
  if (typeof navigator === 'undefined') {
    return parseDeviceTelemetry({});
  }
  const conn =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  return parseDeviceTelemetry({
    userAgent: navigator.userAgent,
    userAgentData: navigator.userAgentData,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    screenWidth: typeof screen !== 'undefined' ? screen.width : 0,
    screenHeight: typeof screen !== 'undefined' ? screen.height : 0,
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    connection: conn
      ? {
          type: conn.type,
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
        }
      : null,
  });
}

export async function fetchSpeedtestEnvironment(signal) {
  let cfTrace = { ip: '', colo: '', loc: '', http: '', tls: '' };
  let ispInfo = {
    ip: '',
    isp: '',
    org: '',
    asn: '',
    city: '',
    region: '',
    country: '',
  };

  const traceTask = (async () => {
    try {
      const res = await fetch(`${CF_TRACE_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        signal,
      });
      if (!res.ok) return;
      const text = await res.text();
      for (const line of text.split('\n')) {
        const idx = line.indexOf('=');
        if (idx <= 0) continue;
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k in cfTrace) cfTrace[k] = v;
      }
    } catch {
      // Optional trace
    }
  })();

  const ispTask = (async () => {
    try {
      const res = await fetch('https://ipwho.is/', { cache: 'no-store', signal });
      if (res.ok) {
        const j = await res.json();
        if (j && j.success !== false) {
          ispInfo = {
            ip: j.ip || '',
            isp: j.connection?.isp || j.connection?.org || '',
            org: j.connection?.org || '',
            asn: j.connection?.asn ? `AS${j.connection.asn}` : '',
            city: j.city || '',
            region: j.region || '',
            country: j.country || '',
          };
          return;
        }
      }
    } catch {
      // Fall through to backup IP provider
    }

    try {
      const res = await fetch('https://ipapi.co/json/', { cache: 'no-store', signal });
      if (res.ok) {
        const j = await res.json();
        if (j && !j.error) {
          ispInfo = {
            ip: j.ip || '',
            isp: j.org || '',
            org: j.org || '',
            asn: j.asn || '',
            city: j.city || '',
            region: j.region || '',
            country: j.country_name || '',
          };
        }
      }
    } catch {
      // Offline / blocked fallback
    }
  })();

  await Promise.all([traceTask, ispTask]);

  return {
    ip: ispInfo.ip || cfTrace.ip || 'Tidak terdeteksi',
    isp: ispInfo.isp || ispInfo.org || 'Jaringan Publik',
    asn: ispInfo.asn || '',
    coloCode: cfTrace.colo || '',
    serverLabel: cfTrace.colo
      ? `Cloudflare Edge · ${describeCloudflareColo(cfTrace.colo)}`
      : 'Cloudflare Speed Edge',
    protocol: [cfTrace.http, cfTrace.tls].filter(Boolean).join(' / ') || 'HTTPS',
    networkCity: [ispInfo.city, ispInfo.region, ispInfo.country].filter(Boolean).join(', '),
  };
}

async function measureSinglePing(url, signal) {
  const start = performance.now();
  const res = await fetch(url, { cache: 'no-store', signal });
  await res.arrayBuffer();
  return performance.now() - start;
}

async function runLatencyPhase(signal, onSample) {
  const samples = [];
  let endpointMode = 'cloudflare';

  // Warmup probe (absorbs initial TLS/DNS handshake)
  try {
    await measureSinglePing(`${CF_DOWN_URL}?bytes=0&measId=w${Date.now()}`, signal);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    endpointMode = 'origin';
  }

  const probeCount = 8;
  for (let i = 0; i < probeCount; i += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const probeUrl =
      endpointMode === 'cloudflare'
        ? `${CF_DOWN_URL}?bytes=0&measId=p${Date.now()}-${i}`
        : `./manifest.webmanifest?ping=${Date.now()}-${i}`;
    try {
      const rtt = await measureSinglePing(probeUrl, signal);
      samples.push(rtt);
      onSample?.(calculatePingStats(samples), rtt, (i + 1) / probeCount);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  if (samples.length === 0) {
    throw new Error('Gagal mengukur ping ke server.');
  }

  return {
    stats: calculatePingStats(samples),
    endpointMode,
  };
}

async function streamDownloadStage(bytes, signal, onTick) {
  const url = `${CF_DOWN_URL}?bytes=${bytes}&measId=d${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const tStart = performance.now();
  const res = await fetch(url, { cache: 'no-store', signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  let received = 0;
  let lastTickAt = tStart;
  let lastTickBytes = 0;

  if (res.body?.getReader) {
    const reader = res.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      const now = performance.now();
      const dtWindow = now - lastTickAt;
      if (dtWindow >= 90) {
        const totalElapsed = now - tStart;
        const instantMbps = computeMbps(received - lastTickBytes, dtWindow);
        const avgStageMbps = computeMbps(received, totalElapsed);
        onTick?.({
          received,
          elapsedMs: totalElapsed,
          mbps: avgStageMbps > 0 ? Number((avgStageMbps * 0.65 + instantMbps * 0.35).toFixed(2)) : instantMbps,
        });
        lastTickAt = now;
        lastTickBytes = received;
      }
    }
  } else {
    const buf = await res.arrayBuffer();
    received = buf.byteLength;
  }

  const totalMs = Math.max(1, performance.now() - tStart);
  return {
    bytes: received,
    durationMs: totalMs,
    mbps: computeMbps(received, totalMs),
  };
}

async function runDownloadPhase(signal, onProgress) {
  const stageSizes = [250_000, 1_500_000, 5_000_000, 10_000_000];
  let totalBytes = 0;
  let totalMs = 0;
  const stageResults = [];
  const waveSamples = [];

  for (let i = 0; i < stageSizes.length; i += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const targetBytes = stageSizes[i];
    const stageStartGlobal = i / stageSizes.length;

    const result = await streamDownloadStage(targetBytes, signal, ({ received, mbps }) => {
      const stageFrac = Math.min(1, received / targetBytes);
      waveSamples.push(mbps);
      if (waveSamples.length > 36) waveSamples.shift();
      onProgress?.({
        mbps,
        progress: stageStartGlobal + stageFrac / stageSizes.length,
        samples: [...waveSamples],
      });
    });

    totalBytes += result.bytes;
    totalMs += result.durationMs;
    stageResults.push({
      bytes: result.bytes,
      durationMs: result.durationMs,
      mbps: result.mbps,
    });
    waveSamples.push(result.mbps);
    if (waveSamples.length > 36) waveSamples.shift();

    onProgress?.({
      mbps: result.mbps,
      progress: (i + 1) / stageSizes.length,
      samples: [...waveSamples],
    });

    // Skip final 10MB download if connection is under ~6 Mbps so test stays responsive on slow mobile
    if (i === 1 && result.mbps > 0 && result.mbps < 6) {
      break;
    }
  }

  return {
    mbps: computeSustainedAverageMbps({ stages: stageResults, samples: waveSamples }),
    samples: waveSamples,
  };
}

function createRandomPayload(byteLength) {
  const arr = new Uint8Array(byteLength);
  // Fill pattern fast (pseudo-random prevents transparent proxy compression without crypto 64KB chunk limit)
  let seed = 0x9e3779b9;
  for (let i = 0; i < arr.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    arr[i] = seed & 0xff;
    if (i + 1 < arr.length) arr[i + 1] = (seed >>> 8) & 0xff;
    if (i + 2 < arr.length) arr[i + 2] = (seed >>> 16) & 0xff;
    if (i + 3 < arr.length) arr[i + 3] = (seed >>> 24) & 0xff;
  }
  return arr;
}

function uploadStageXhr(bytes, signal, onTick) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const payload = createRandomPayload(bytes);
    let tStart = 0;
    let lastTick = 0;
    let lastLoaded = 0;

    const onAbort = () => {
      try {
        xhr.abort();
      } catch {
        // Ignore
      }
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    xhr.open('POST', `${CF_UP_URL}?measId=u${Date.now()}`, true);
    xhr.timeout = 20000;

    xhr.upload.onprogress = (evt) => {
      if (!tStart) {
        tStart = performance.now();
        lastTick = tStart;
      }
      if (!evt.lengthComputable) return;
      const now = performance.now();
      const dt = now - lastTick;
      if (dt >= 95 && evt.loaded > lastLoaded) {
        const instantMbps = computeMbps(evt.loaded - lastLoaded, dt);
        const avgMbps = computeMbps(evt.loaded, Math.max(1, now - tStart));
        onTick?.({
          loaded: evt.loaded,
          total: evt.total,
          mbps: avgMbps > 0 ? Number((avgMbps * 0.65 + instantMbps * 0.35).toFixed(2)) : instantMbps,
        });
        lastTick = now;
        lastLoaded = evt.loaded;
      }
    };

    xhr.onload = () => {
      signal?.removeEventListener('abort', onAbort);
      const totalMs = Math.max(1, performance.now() - (tStart || performance.now() - 10));
      if (xhr.status >= 200 && xhr.status < 400) {
        resolve({
          bytes,
          durationMs: totalMs,
          mbps: computeMbps(bytes, totalMs),
        });
      } else {
        reject(new Error(`Upload HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Koneksi upload gagal'));
    };

    xhr.ontimeout = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('Timeout pengukuran upload'));
    };

    tStart = performance.now();
    lastTick = tStart;
    xhr.send(payload);
  });
}

async function runUploadPhase(signal, onProgress) {
  const stageSizes = [250_000, 1_000_000, 2_500_000];
  let totalBytes = 0;
  let totalMs = 0;
  const stageResults = [];
  const waveSamples = [];

  for (let i = 0; i < stageSizes.length; i += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const targetBytes = stageSizes[i];
    const baseProgress = i / stageSizes.length;

    const result = await uploadStageXhr(targetBytes, signal, ({ loaded, total, mbps }) => {
      const frac = total > 0 ? Math.min(1, loaded / total) : 0;
      waveSamples.push(mbps);
      if (waveSamples.length > 36) waveSamples.shift();
      onProgress?.({
        mbps,
        progress: baseProgress + frac / stageSizes.length,
        samples: [...waveSamples],
      });
    });

    totalBytes += result.bytes;
    totalMs += result.durationMs;
    stageResults.push({
      bytes: result.bytes,
      durationMs: result.durationMs,
      mbps: result.mbps,
    });
    waveSamples.push(result.mbps);
    if (waveSamples.length > 36) waveSamples.shift();

    onProgress?.({
      mbps: result.mbps,
      progress: (i + 1) / stageSizes.length,
      samples: [...waveSamples],
    });

    if (i === 1 && result.mbps > 0 && result.mbps < 5) {
      break;
    }
  }

  return {
    mbps: computeSustainedAverageMbps({ stages: stageResults, samples: waveSamples }),
    samples: waveSamples,
  };
}

export async function runInternetSpeedtest({ signal, onUpdate }) {
  const envPromise = fetchSpeedtestEnvironment(signal);

  onUpdate?.({ phase: 'ping', phaseLabel: 'Mengukur Ping & Jitter...', liveMbps: 0, progress: 0.05 });
  const latency = await runLatencyPhase(signal, (stats, latestRtt, pct) => {
    onUpdate?.({
      phase: 'ping',
      phaseLabel: `Mengukur Ping (${stats.sampleCount}/8)...`,
      pingMs: stats.avgMs,
      minPingMs: stats.minMs,
      jitterMs: stats.jitterMs,
      liveMbps: Math.round(latestRtt),
      progress: 0.05 + pct * 0.15,
    });
  });

  onUpdate?.({
    phase: 'download',
    phaseLabel: 'Mengukur Kecepatan Download...',
    pingMs: latency.stats.avgMs,
    minPingMs: latency.stats.minMs,
    jitterMs: latency.stats.jitterMs,
    liveMbps: 0,
    progress: 0.22,
    samples: [],
  });

  let dlTail = [];
  const download = await runDownloadPhase(signal, ({ mbps, progress, samples }) => {
    dlTail = samples.slice(-16);
    onUpdate?.({
      phase: 'download',
      phaseLabel: 'Mengukur Kecepatan Download...',
      pingMs: latency.stats.avgMs,
      minPingMs: latency.stats.minMs,
      jitterMs: latency.stats.jitterMs,
      downloadMbps: mbps,
      liveMbps: mbps,
      progress: 0.22 + progress * 0.42,
      samples,
    });
  });

  // Measure loaded latency right after heavy download
  let loadedLatencyMs = latency.stats.avgMs;
  try {
    const loadedRtt = await measureSinglePing(`${CF_DOWN_URL}?bytes=0&measId=l${Date.now()}`, signal);
    loadedLatencyMs = Math.round(loadedRtt);
  } catch {
    // Keep idle ping
  }

  onUpdate?.({
    phase: 'upload',
    phaseLabel: 'Mengukur Kecepatan Upload...',
    pingMs: latency.stats.avgMs,
    minPingMs: latency.stats.minMs,
    loadedLatencyMs,
    jitterMs: latency.stats.jitterMs,
    downloadMbps: download.mbps,
    liveMbps: 0,
    progress: 0.66,
    samples: dlTail,
  });

  const upload = await runUploadPhase(signal, ({ mbps, progress, samples }) => {
    onUpdate?.({
      phase: 'upload',
      phaseLabel: 'Mengukur Kecepatan Upload...',
      pingMs: latency.stats.avgMs,
      minPingMs: latency.stats.minMs,
      loadedLatencyMs,
      jitterMs: latency.stats.jitterMs,
      downloadMbps: download.mbps,
      uploadMbps: mbps,
      liveMbps: mbps,
      progress: 0.66 + progress * 0.32,
      samples: [...dlTail, ...samples].slice(-28),
    });
  });

  const env = await envPromise;
  const quality = evaluateConnectionQuality({
    downloadMbps: download.mbps,
    uploadMbps: upload.mbps,
    pingMs: latency.stats.avgMs,
    jitterMs: latency.stats.jitterMs,
  });

  return {
    phase: 'done',
    phaseLabel: 'Pengujian Selesai',
    pingMs: latency.stats.avgMs,
    minPingMs: latency.stats.minMs,
    loadedLatencyMs,
    jitterMs: latency.stats.jitterMs,
    downloadMbps: download.mbps,
    uploadMbps: upload.mbps,
    liveMbps: download.mbps,
    progress: 1,
    env,
    quality,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Animated 240-degree High-DPI Speedometer Canvas Gauge
 */
export function createSpeedometerGauge(canvas) {
  const ctx = canvas.getContext('2d');
  let targetValue = 0;
  let currentValue = 0;
  let currentMode = 'idle'; // 'idle' | 'ping' | 'download' | 'upload' | 'done'
  let rafId = null;
  let destroyed = false;

  const START_ANGLE = Math.PI * 0.78;
  const END_ANGLE = Math.PI * 2.22;
  const SWEEP = END_ANGLE - START_ANGLE;
  const TICKS = [0, 5, 10, 25, 50, 100, 250, 500, 1000];

  function getPalette() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const accentColor =
      currentMode === 'upload'
        ? '#10B981'
        : currentMode === 'ping'
        ? '#F59E0B'
        : '#38BDF8';
    const accentGlow =
      currentMode === 'upload'
        ? 'rgba(16, 185, 129, 0.34)'
        : currentMode === 'ping'
        ? 'rgba(245, 158, 11, 0.34)'
        : 'rgba(56, 189, 248, 0.34)';

    return {
      isLight,
      track: isLight ? 'rgba(15, 23, 42, 0.09)' : 'rgba(248, 250, 252, 0.09)',
      tick: isLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(226, 232, 240, 0.35)',
      label: isLight ? '#475569' : '#94A3B8',
      valueInk: isLight ? '#0F172A' : '#F8FAFC',
      unitInk: isLight ? '#64748B' : '#94A3B8',
      needle: isLight ? '#0F172A' : '#F8FAFC',
      centerCap: isLight ? '#E2E8F0' : '#1E293B',
      accent: accentColor,
      accentGlow,
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(240, Math.round(rect.width || 300));
    const h = Math.max(195, Math.round(rect.height || 235));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function draw() {
    if (destroyed) return;
    const { w, h } = resize();
    const pal = getPalette();
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.56;
    const radius = Math.min(w * 0.41, h * 0.48);

    // Ratio: ping animates softly between 0..150ms -> 0..0.45 so user sees motion cleanly
    const ratio =
      currentMode === 'ping'
        ? Math.min(0.6, Math.max(0.06, currentValue / 140))
        : speedToGaugeRatio(currentValue);

    // Outer muted track
    ctx.beginPath();
    ctx.arc(cx, cy, radius, START_ANGLE, END_ANGLE);
    ctx.strokeStyle = pal.track;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active glowing progress arc
    if (ratio > 0.002) {
      const valAngle = START_ANGLE + SWEEP * ratio;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, START_ANGLE, valAngle);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.shadowColor = pal.accentGlow;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
    }

    // Scale ticks + labels
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const segments = TICKS.length - 1;
    for (let i = 0; i < TICKS.length; i += 1) {
      const angle = START_ANGLE + (SWEEP * i) / segments;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const rInner = radius - 17;
      const rOuter = radius - 11;
      ctx.beginPath();
      ctx.moveTo(cx + cos * rInner, cy + sin * rInner);
      ctx.lineTo(cx + cos * rOuter, cy + sin * rOuter);
      ctx.strokeStyle = pal.tick;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      const rLabel = radius - 29;
      ctx.fillStyle = pal.label;
      ctx.fillText(String(TICKS[i]), cx + cos * rLabel, cy + sin * rLabel);
    }

    // Spring needle
    const needleAngle = START_ANGLE + SWEEP * ratio;
    const tipR = radius - 16;
    const tailR = 12;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(needleAngle) * tailR, cy - Math.sin(needleAngle) * tailR);
    ctx.lineTo(cx + Math.cos(needleAngle) * tipR, cy + Math.sin(needleAngle) * tipR);
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Hub cap
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = pal.centerCap;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = pal.accent;
    ctx.stroke();
    ctx.restore();

    // Primary digital readout inside lower-center cavity
    const formatted =
      currentMode === 'ping'
        ? String(Math.round(currentValue))
        : currentValue >= 100
        ? currentValue.toFixed(0)
        : currentValue.toFixed(1);
    const unit = currentMode === 'ping' ? 'ms (Ping)' : 'Mbps';

    ctx.fillStyle = pal.valueInk;
    ctx.font = '800 32px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(formatted, cx, cy + radius * 0.42);

    ctx.fillStyle = pal.unitInk;
    ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(unit, cx, cy + radius * 0.66);
  }

  function step() {
    if (destroyed) return;
    const diff = targetValue - currentValue;
    if (Math.abs(diff) > 0.08) {
      currentValue += diff * 0.18;
      draw();
      rafId = requestAnimationFrame(step);
    } else {
      currentValue = targetValue;
      draw();
      rafId = null;
    }
  }

  function ensureAnim() {
    if (!rafId && !destroyed) {
      rafId = requestAnimationFrame(step);
    }
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => draw()) : null;
  ro?.observe(canvas);
  draw();

  return {
    setValue(val, mode = currentMode) {
      targetValue = Math.max(0, Number(val) || 0);
      currentMode = mode;
      ensureAnim();
    },
    redraw() {
      draw();
    },
    destroy() {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      ro?.disconnect();
    },
  };
}
