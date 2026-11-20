/**
 * Pure Audio Editor Studio DSP, Metadata (ID3v2.3 & RIFF INFO), WAV Encoder,
 * Multi-Track Mixer Math, Stem Separation Math, and Multi-AI Mastering Parser.
 * Zero DOM dependencies — 100% deterministic & unit-testable via node:test.
 */

export const AUDIO_EQ_BANDS = [
  { freq: 32, label: '32', unit: 'Hz', role: 'Sub Bass' },
  { freq: 64, label: '64', unit: 'Hz', role: 'Deep Bass' },
  { freq: 125, label: '125', unit: 'Hz', role: 'Punch' },
  { freq: 250, label: '250', unit: 'Hz', role: 'Warmth' },
  { freq: 500, label: '500', unit: 'Hz', role: 'Body' },
  { freq: 1000, label: '1K', unit: 'Hz', role: 'Mid' },
  { freq: 2000, label: '2K', unit: 'Hz', role: 'Presence' },
  { freq: 4000, label: '4K', unit: 'Hz', role: 'Vocal Air' },
  { freq: 8000, label: '8K', unit: 'Hz', role: 'Brilliance' },
  { freq: 16000, label: '16K', unit: 'Hz', role: 'Sparkle' },
];

export const AUDIO_EQ_PRESETS = [
  { id: 'flat', label: 'Flat (Netral)', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: 'studio-master', label: 'Studio Master', gains: [2.5, 3, 1.5, 0, -0.5, 1, 2, 3, 2.5, 2] },
  { id: 'vocal-clarity', label: 'Vokal Jernih', gains: [-3, -2, -1, 0, 1.5, 3, 4.5, 4, 2.5, 1] },
  { id: 'podcast', label: 'Podcast Broadcast', gains: [-6, -3, 1, 2, 1, 1.5, 3.5, 4, 2, -1] },
  { id: 'bass-boost', label: 'Bass Boost HD', gains: [6.5, 5.5, 3.5, 1.5, 0, 0, 1, 1.5, 1, 0.5] },
  { id: 'acoustic', label: 'Akustik Hangat', gains: [1, 2, 2.5, 2, 1, 0.5, 2, 3, 2.5, 1.5] },
  { id: 'treble-air', label: 'Tajam & Detail', gains: [-1, 0, 0, 0, 0.5, 1.5, 3, 4.5, 5, 4] },
  { id: 'lofi', label: 'Lo-Fi Radio', gains: [-5, -3, 2, 3.5, 2, 1, -2, -5, -7, -9] },
];

export const AUDIO_VOICE_PRESETS = [
  { id: 'normal', label: 'Asli (Normal)', pitch: 0, speed: 1, formantShift: 0, robot: false, radio: false, reverb: 0, echo: 0 },
  { id: 'chipmunk', label: 'Chipmunk (Tinggi)', pitch: 7, speed: 1.18, formantShift: 5, robot: false, radio: false, reverb: 0, echo: 0 },
  { id: 'deep-bass', label: 'Suara Berat / Bass', pitch: -5, speed: 0.94, formantShift: -4, robot: false, radio: false, reverb: 12, echo: 0 },
  { id: 'robot', label: 'Robotik Futuristik', pitch: -1, speed: 1, formantShift: 0, robot: true, radio: false, reverb: 18, echo: 15 },
  { id: 'radio', label: 'Radio Klasik AM', pitch: 0, speed: 1, formantShift: 1, robot: false, radio: true, reverb: 8, echo: 0 },
  { id: 'cathedral', label: 'Gema Katedral', pitch: 0, speed: 0.98, formantShift: 0, robot: false, radio: false, reverb: 68, echo: 30 },
  { id: 'nightcore', label: 'Nightcore Enerjik', pitch: 4, speed: 1.22, formantShift: 2, robot: false, radio: false, reverb: 10, echo: 0 },
  { id: 'slowed-reverb', label: 'Slowed + Reverb', pitch: -3, speed: 0.84, formantShift: -2, robot: false, radio: false, reverb: 58, echo: 22 },
  { id: 'telephone', label: 'Efek Telepon', pitch: 0, speed: 1, formantShift: 0, robot: false, radio: true, reverb: 0, echo: 0 },
];

export const AUDIO_STEM_MODES = [
  { id: 'original', label: 'Campuran Asli', desc: 'Audio penuh tanpa pemisahan kanal vokal atau instrumen.' },
  { id: 'vocal-isolate', label: 'Isolasi Vokal (Acapella)', desc: 'Mengekstrak sinyal vokal di kanal tengah (Mid 260Hz–4.2kHz) dan menekan instrumen stereo.' },
  { id: 'instrumental', label: 'Hapus Vokal (Karaoke / Musik)', desc: 'Mengurangi vokal tengah dengan phase-cancellation Mid-Side sambil menjaga bass & musik stereo.' },
  { id: 'bass-focus', label: 'Fokus Bass & Drum', desc: 'Menonjolkan fondasi frekuensi rendah (<240Hz) dengan kompresi rapat.' },
  { id: 'stereo-wide', label: 'Pelebar Panggung Stereo', desc: 'Memperluas separasi instrumen kiri-kanan tanpa mengorbankan kejernihan vokal tengah.' },
];

export const AUDIO_EXPORT_FORMATS = [
  { id: 'mp3', label: 'MP3', ext: 'mp3', mime: 'audio/mpeg', desc: 'Universal + Tag ID3v2 & Cover Art', engine: 'LAME MP3 / FFmpeg' },
  { id: 'wav', label: 'WAV', ext: 'wav', mime: 'audio/wav', desc: 'Lossless PCM 16-bit + RIFF INFO', engine: 'Native PCM Studio' },
  { id: 'm4a', label: 'M4A (AAC)', ext: 'm4a', mime: 'audio/mp4', desc: 'Tajam & ringan untuk iOS/Sosmed', engine: 'FFmpeg WASM AAC' },
  { id: 'ogg', label: 'OGG Vorbis', ext: 'ogg', mime: 'audio/ogg', desc: 'Open-source streaming efisiensi tinggi', engine: 'FFmpeg WASM Vorbis' },
  { id: 'flac', label: 'FLAC', ext: 'flac', mime: 'audio/flac', desc: 'Lossless arsip studio tanpa penurunan', engine: 'FFmpeg WASM FLAC' },
  { id: 'webm', label: 'WebM Opus', ext: 'webm', mime: 'audio/webm', desc: 'Web modern & latensi rendah', engine: 'FFmpeg WASM / WebAudio' },
];

export const AUDIO_AI_ENGINES = [
  { id: 'consensus', label: 'Auto Multi-AI Konsensus', subtitle: 'Gabungan ChatGPT, Claude, Gemini, DeepSeek & Grok', models: ['gpt-oss:20b', 'mistral-Nemo-Instruct-2407', 'openai-fast'] },
  { id: 'chatgpt', label: 'ChatGPT (GPT Engine)', subtitle: 'Seimbang untuk mastering & penulisan ulang metadata', models: ['gpt-oss:20b', 'gpt-oss:120b', 'openai-fast'] },
  { id: 'claude', label: 'Claude-Class Studio AI', subtitle: 'Presisi vokal, podcast & detail dinamika halus', models: ['mistral-Nemo-Instruct-2407', 'claude'] },
  { id: 'gemini', label: 'Gemini Audio Advisor', subtitle: 'Analisis spektrum cepat & penjernihan multi-band', models: ['gemini', 'gpt-oss:20b'] },
  { id: 'deepseek', label: 'DeepSeek Audio DSP AI', subtitle: 'Perhitungan matematis EQ, noise gate & de-clipping', models: ['deepseek', 'kimi-k2.7-code'] },
  { id: 'grok', label: 'Grok / MiniMax Studio AI', subtitle: 'Punchy mastering untuk TikTok, Reels & EDM/Pop', models: ['minimax-m3', 'gpt-oss:120b'] },
];

export const AUDIO_AI_GOALS = [
  { id: 'studio-master', label: 'Mastering Studio Seimbang', desc: 'Optimalkan loudness -14 LUFS, EQ halus, & jernihkan detail.' },
  { id: 'podcast-clean', label: 'Podcast & Voiceover Jernih', desc: 'Hilangkan noise latar, dengung 50/60Hz, & tonjolkan artikulasi suara.' },
  { id: 'audio-repair', label: 'Perbaikan Rekaman Rusak', desc: 'Pulihkan clipping, hilangkan DC offset, noise berat, & stabilkan volume.' },
  { id: 'social-punch', label: 'Sosmed / TikTok / Reels Punchy', desc: 'Suara keras tapi bersih, bass padat, vokal menonjol di speaker HP.' },
  { id: 'vocal-karaoke', label: 'Siapkan Karaoke / Pisah Musik', desc: 'Kurangi vokal tengah & jaga instrumen stereo tetap penuh.' },
  { id: 'metadata-polish', label: 'Tulis Ulang Identitas & Tag', desc: 'Rapikan judul, artis, album, genre, & deskripsi audio secara profesional.' },
];

export function createDefaultAudioEditorState() {
  return {
    trimStart: 0,
    trimEnd: 0,
    fadeIn: 0,
    fadeOut: 0,
    volumePct: 100, // 0..300%
    normalizeEnabled: false,
    targetLufs: -14,
    pan: 0, // -1..1
    speed: 1, // 0.5..2.0
    pitchSemitones: 0, // -12..12
    reverse: false,
    voicePreset: 'normal',
    robotEffect: false,
    radioEffect: false,
    reverbMix: 0, // 0..100
    echoMix: 0, // 0..100
    eqPreset: 'flat',
    eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    noiseReduction: 0, // 0..100
    noiseGateDb: -70, // -70 (off) .. -24
    clarityAmount: 0, // 0..100
    deEsserAmount: 0, // 0..100
    repairDeclip: false,
    repairDcOffset: true,
    repairHumFilter: false,
    humFreqHz: 50,
    stemMode: 'original',
    stemStrength: 80, // 0..100
    mixMode: 'overlay', // 'overlay' | 'concat'
    metadata: {
      title: '',
      artist: '',
      album: '',
      year: String(new Date().getFullYear()),
      genre: 'Pop',
      track: '1',
      comment: 'Edited with Manifestudio Audio Editor',
      coverDataUrl: '',
    },
    exportFormat: 'mp3',
    exportBitrate: 192,
    exportSampleRate: 44100,
    aiEngine: 'consensus',
    aiGoal: 'studio-master',
    aiCustomPrompt: '',
  };
}

export function clampNum(val, min, max, fallback = min) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function clampTrimRange(start, end, duration) {
  const safeDur = Math.max(0, Number(duration) || 0);
  if (safeDur <= 0) return { trimStart: 0, trimEnd: 0, trimDuration: 0 };
  const minGap = Math.min(0.1, safeDur);
  let s = clampNum(start, 0, Math.max(0, safeDur - minGap), 0);
  let e = clampNum(end > 0 ? end : safeDur, s + minGap, safeDur, safeDur);
  if (e - s < minGap) {
    e = Math.min(safeDur, s + minGap);
    s = Math.max(0, e - minGap);
  }
  return {
    trimStart: Number(s.toFixed(3)),
    trimEnd: Number(e.toFixed(3)),
    trimDuration: Number((e - s).toFixed(3)),
  };
}

export function formatTimecode(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  const tenths = Math.floor((s - Math.floor(s)) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export function volumePctToGain(volumePct) {
  return clampNum(volumePct, 0, 300, 100) / 100;
}

export function gainToDb(gain) {
  const g = Math.max(1e-6, Number(gain) || 1e-6);
  return Number((20 * Math.log10(g)).toFixed(1));
}

/**
 * Computes real acoustic health diagnostics from PCM float samples.
 */
export function computeAudioAcousticStats(samples, sampleRate = 44100) {
  if (!samples || !samples.length) {
    return {
      peak: 0,
      peakDb: -96,
      rms: 0,
      rmsDb: -96,
      estimatedLufs: -96,
      crestFactorDb: 0,
      dcOffset: 0,
      clippedSamples: 0,
      clippedRatio: 0,
      noiseFloorDb: -96,
      durationSec: 0,
      issues: [],
    };
  }

  const len = samples.length;
  let sum = 0;
  let sumSq = 0;
  let peak = 0;
  let clippedSamples = 0;

  // Frame RMS for noise-floor estimation (10th percentile frame energy)
  const frameSize = Math.max(256, Math.min(2048, Math.floor(sampleRate * 0.04)));
  const frameRmsList = [];
  let frameSq = 0;
  let frameCount = 0;

  for (let i = 0; i < len; i += 1) {
    const v = samples[i];
    sum += v;
    const abs = Math.abs(v);
    if (abs > peak) peak = abs;
    if (abs >= 0.992) clippedSamples += 1;
    const sq = v * v;
    sumSq += sq;
    frameSq += sq;
    frameCount += 1;
    if (frameCount >= frameSize) {
      frameRmsList.push(Math.sqrt(frameSq / frameCount));
      frameSq = 0;
      frameCount = 0;
    }
  }
  if (frameCount > 0) {
    frameRmsList.push(Math.sqrt(frameSq / frameCount));
  }

  const dcOffset = sum / len;
  const rms = Math.sqrt(sumSq / len);
  const peakDb = peak > 1e-6 ? Number((20 * Math.log10(peak)).toFixed(1)) : -96;
  const rmsDb = rms > 1e-6 ? Number((20 * Math.log10(rms)).toFixed(1)) : -96;
  const estimatedLufs = Number(Math.max(-96, rmsDb - 0.8).toFixed(1));
  const crestFactorDb = Number(Math.max(0, peakDb - rmsDb).toFixed(1));
  const clippedRatio = clippedSamples / len;

  frameRmsList.sort((a, b) => a - b);
  const p10 = frameRmsList[Math.floor(frameRmsList.length * 0.1)] || 1e-5;
  const noiseFloorDb = p10 > 1e-6 ? Number((20 * Math.log10(p10)).toFixed(1)) : -96;

  const issues = [];
  if (clippedSamples > 12 || clippedRatio > 0.0005) {
    issues.push('clipping');
  }
  if (Math.abs(dcOffset) > 0.01) {
    issues.push('dc-offset');
  }
  if (noiseFloorDb > -46 && noiseFloorDb < -8 && peakDb - noiseFloorDb < 38) {
    issues.push('background-noise');
  }
  if (rmsDb < -24 && rmsDb > -85) {
    issues.push('low-volume');
  }
  if (crestFactorDb > 18) {
    issues.push('wide-dynamics');
  }

  return {
    peak: Number(peak.toFixed(4)),
    peakDb,
    rms: Number(rms.toFixed(4)),
    rmsDb,
    estimatedLufs,
    crestFactorDb,
    dcOffset: Number(dcOffset.toFixed(5)),
    clippedSamples,
    clippedRatio: Number(clippedRatio.toFixed(6)),
    noiseFloorDb,
    durationSec: Number((len / Math.max(1, sampleRate)).toFixed(3)),
    issues,
  };
}

/**
 * Extracts normalized waveform peak buckets for fast canvas visualization.
 */
export function extractWaveformPeaks(channelData, buckets = 180) {
  const count = Math.max(16, Math.min(1000, Math.round(buckets)));
  const out = new Float32Array(count);
  if (!channelData || !channelData.length) return out;
  const step = channelData.length / count;
  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(i * step);
    const end = Math.max(start + 1, Math.min(channelData.length, Math.floor((i + 1) * step)));
    let maxVal = 0;
    const stride = Math.max(1, Math.floor((end - start) / 48));
    for (let j = start; j < end; j += stride) {
      const a = Math.abs(channelData[j]);
      if (a > maxVal) maxVal = a;
    }
    out[i] = Math.min(1, maxVal);
  }
  return out;
}

/**
 * Simple 2nd-order biquad filter processor in pure JS for offline DSP passes
 * (bandpass, notch, lowpass, highpass).
 */
export function applyBiquadFilter(samples, sampleRate, type, freqHz, q = 1.0, gainDb = 0) {
  const out = new Float32Array(samples.length);
  const sr = Math.max(8000, Number(sampleRate) || 44100);
  const fc = clampNum(freqHz, 20, sr * 0.45, 1000);
  const w0 = (2 * Math.PI * fc) / sr;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * Math.max(0.1, q));
  const A = Math.pow(10, gainDb / 40);

  let b0 = 1;
  let b1 = 0;
  let b2 = 0;
  let a0 = 1;
  let a1 = 0;
  let a2 = 0;

  if (type === 'lowpass') {
    b0 = (1 - cosW0) / 2;
    b1 = 1 - cosW0;
    b2 = (1 - cosW0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosW0) / 2;
    b1 = -(1 + cosW0);
    b2 = (1 + cosW0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  } else if (type === 'bandpass') {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  } else if (type === 'notch') {
    b0 = 1;
    b1 = -2 * cosW0;
    b2 = 1;
    a0 = 1 + alpha;
    a1 = -2 * cosW0;
    a2 = 1 - alpha;
  } else if (type === 'peaking') {
    b0 = 1 + alpha * A;
    b1 = -2 * cosW0;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cosW0;
    a2 = 1 - alpha / A;
  }

  const nb0 = b0 / a0;
  const nb1 = b1 / a0;
  const nb2 = b2 / a0;
  const na1 = a1 / a0;
  const na2 = a2 / a0;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let i = 0; i < samples.length; i += 1) {
    const x0 = samples[i];
    const y0 = nb0 * x0 + nb1 * x1 + nb2 * x2 - na1 * y1 - na2 * y2;
    out[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return out;
}

/**
 * Pure Mid-Side + Frequency-Selective Stem Separator (Vocal Isolation, Karaoke Instrumental,
 * Bass Focus, Stereo Widener). Operates on stereo Float32Arrays.
 */
export function processSamplesStemSeparation(leftIn, rightIn, mode = 'original', strengthPct = 80, sampleRate = 44100) {
  const len = Math.min(leftIn.length, rightIn.length);
  const outL = new Float32Array(len);
  const outR = new Float32Array(len);
  const mix = clampNum(strengthPct, 0, 100, 80) / 100;

  if (mode === 'original' || mix <= 0.001) {
    outL.set(leftIn.subarray(0, len));
    outR.set(rightIn.subarray(0, len));
    return { left: outL, right: outR };
  }

  const mid = new Float32Array(len);
  const side = new Float32Array(len);
  for (let i = 0; i < len; i += 1) {
    mid[i] = 0.5 * (leftIn[i] + rightIn[i]);
    side[i] = 0.5 * (leftIn[i] - rightIn[i]);
  }

  if (mode === 'instrumental') {
    // Keep low-end bass (<190Hz) from Mid + full Side, cancel vocal mid band (240Hz..4500Hz)
    const bassMid = applyBiquadFilter(mid, sampleRate, 'lowpass', 190, 0.707);
    const airMid = applyBiquadFilter(mid, sampleRate, 'highpass', 5800, 0.707);
    for (let i = 0; i < len; i += 1) {
      const residualMid = mid[i] * (1 - mix) + (bassMid[i] * 0.92 + airMid[i] * 0.55) * mix;
      const boostedSide = side[i] * (1 + 0.35 * mix);
      outL[i] = clampNum(residualMid + boostedSide, -1, 1, 0);
      outR[i] = clampNum(residualMid - boostedSide, -1, 1, 0);
    }
    return { left: outL, right: outR };
  }

  if (mode === 'vocal-isolate') {
    // Isolate center vocal band (250Hz..4400Hz) and attenuate side-channel instrumentation
    const hp = applyBiquadFilter(mid, sampleRate, 'highpass', 230, 0.8);
    const vocalCenter = applyBiquadFilter(hp, sampleRate, 'lowpass', 4600, 0.8);
    const presence = applyBiquadFilter(vocalCenter, sampleRate, 'peaking', 2600, 1.1, 3.5);
    for (let i = 0; i < len; i += 1) {
      const sideKeep = side[i] * (1 - 0.92 * mix);
      const v = mid[i] * (1 - mix) + presence[i] * (1.28 * mix);
      outL[i] = clampNum(v + sideKeep, -1, 1, 0);
      outR[i] = clampNum(v - sideKeep, -1, 1, 0);
    }
    return { left: outL, right: outR };
  }

  if (mode === 'bass-focus') {
    const lowL = applyBiquadFilter(leftIn, sampleRate, 'lowpass', 240, 0.75);
    const lowR = applyBiquadFilter(rightIn, sampleRate, 'lowpass', 240, 0.75);
    for (let i = 0; i < len; i += 1) {
      outL[i] = clampNum(leftIn[i] * (1 - mix * 0.72) + lowL[i] * (1.35 * mix), -1, 1, 0);
      outR[i] = clampNum(rightIn[i] * (1 - mix * 0.72) + lowR[i] * (1.35 * mix), -1, 1, 0);
    }
    return { left: outL, right: outR };
  }

  if (mode === 'stereo-wide') {
    const sideGain = 1 + 0.85 * mix;
    for (let i = 0; i < len; i += 1) {
      outL[i] = clampNum(mid[i] + side[i] * sideGain, -1, 1, 0);
      outR[i] = clampNum(mid[i] - side[i] * sideGain, -1, 1, 0);
    }
    return { left: outL, right: outR };
  }

  outL.set(leftIn.subarray(0, len));
  outR.set(rightIn.subarray(0, len));
  return { left: outL, right: outR };
}

/**
 * Pure Audio Repair, Noise Stabilizer, De-Clipper, DC-Offset Removal,
 * Hum 50/60Hz Notch, Vocal Clarity Exciter, and Loudness Normalizer.
 */
export function processSamplesNoiseAndRepair(samplesIn, sampleRate = 44100, opts = {}) {
  const len = samplesIn.length;
  let data = new Float32Array(samplesIn);

  // 1. DC Offset Removal
  if (opts.repairDcOffset) {
    let mean = 0;
    for (let i = 0; i < len; i += 1) mean += data[i];
    mean /= Math.max(1, len);
    if (Math.abs(mean) > 1e-5) {
      for (let i = 0; i < len; i += 1) data[i] -= mean;
    }
  }

  // 2. Electrical 50Hz / 60Hz Hum & 2nd Harmonic Notch Filter
  if (opts.repairHumFilter) {
    const baseHum = Number(opts.humFreqHz) === 60 ? 60 : 50;
    data = applyBiquadFilter(data, sampleRate, 'notch', baseHum, 12);
    data = applyBiquadFilter(data, sampleRate, 'notch', baseHum * 2, 14);
  }

  // 3. Soft De-Clipper (restores flattened peaks smoothly using neighborhood interpolation)
  if (opts.repairDeclip) {
    const threshold = 0.985;
    let i = 0;
    while (i < len) {
      if (Math.abs(data[i]) >= threshold) {
        const start = i;
        const sign = data[i] >= 0 ? 1 : -1;
        while (i < len && Math.abs(data[i]) >= threshold && i - start < 24) {
          i += 1;
        }
        const span = i - start;
        if (span >= 2 && start > 0 && i < len) {
          for (let k = 0; k < span; k += 1) {
            const t = (k + 1) / (span + 1);
            const arch = Math.sin(Math.PI * t) * 0.085 * sign;
            data[start + k] = (data[start + k] * 0.88) + arch;
          }
        }
      } else {
        i += 1;
      }
    }
  }

  // 4. Adaptive Noise Reduction & Noise Gate Stabilizer
  const nrStrength = clampNum(opts.noiseReduction, 0, 100, 0) / 100;
  const gateDb = clampNum(opts.noiseGateDb, -70, -24, -70);
  if (nrStrength > 0.01 || gateDb > -69) {
    // High-pass sub-rumble (<75Hz) proportional to noise reduction
    if (nrStrength > 0.15) {
      const hp = applyBiquadFilter(data, sampleRate, 'highpass', 65 + nrStrength * 45, 0.707);
      for (let i = 0; i < len; i += 1) {
        data[i] = data[i] * (1 - nrStrength * 0.65) + hp[i] * (nrStrength * 0.65);
      }
    }
    // Smooth envelope expander / noise gate
    const gateThresh = gateDb > -69 ? Math.pow(10, gateDb / 20) : 0.008 + nrStrength * 0.024;
    const attack = Math.exp(-1 / (sampleRate * 0.004));
    const release = Math.exp(-1 / (sampleRate * 0.055));
    let env = 0;
    let gainEnv = 1;
    const floorGain = Math.max(0.06, 1 - nrStrength * 0.82);

    for (let i = 0; i < len; i += 1) {
      const a = Math.abs(data[i]);
      env = a > env ? attack * env + (1 - attack) * a : release * env + (1 - release) * a;
      const targetGain = env >= gateThresh ? 1 : Math.max(floorGain, Math.pow(env / Math.max(1e-5, gateThresh), 1.4));
      gainEnv = targetGain > gainEnv
        ? 0.92 * gainEnv + 0.08 * targetGain
        : 0.995 * gainEnv + 0.005 * targetGain;
      data[i] *= gainEnv;
    }
  }

  // 5. De-Esser (tame harsh 6.5kHz sibilance)
  const deEss = clampNum(opts.deEsserAmount, 0, 100, 0) / 100;
  if (deEss > 0.01) {
    data = applyBiquadFilter(data, sampleRate, 'peaking', 6600, 2.4, -deEss * 7.5);
  }

  // 6. Penjernih Audio (Presence & Harmonic Air Exciter)
  const clarity = clampNum(opts.clarityAmount, 0, 100, 0) / 100;
  if (clarity > 0.01) {
    data = applyBiquadFilter(data, sampleRate, 'peaking', 3200, 1.1, clarity * 4.2);
    data = applyBiquadFilter(data, sampleRate, 'peaking', 9500, 0.9, clarity * 3.0);
    // Subtle soft-saturation harmonic sheen
    const drive = 1 + clarity * 0.45;
    for (let i = 0; i < len; i += 1) {
      const x = data[i];
      data[i] = Math.tanh(x * drive) / Math.tanh(drive);
    }
  }

  // 7. Loudness Normalizer (target LUFS with true-peak soft limiter)
  if (opts.normalizeEnabled) {
    let sq = 0;
    for (let i = 0; i < len; i += 1) sq += data[i] * data[i];
    const rms = Math.sqrt(sq / Math.max(1, len));
    const currentDb = rms > 1e-6 ? 20 * Math.log10(rms) : -96;
    const targetDb = clampNum(opts.targetLufs, -24, -6, -14);
    if (currentDb > -75) {
      const neededGain = Math.min(6, Math.pow(10, (targetDb - currentDb) / 20));
      for (let i = 0; i < len; i += 1) {
        const s = data[i] * neededGain;
        // Transparent soft-knee peak limiter at -0.5 dBFS (~0.944)
        data[i] = Math.abs(s) > 0.92 ? Math.sign(s) * (0.92 + 0.065 * Math.tanh((Math.abs(s) - 0.92) / 0.2)) : s;
      }
    }
  }

  return data;
}

/**
 * Pure Voice FX processor (Robot ring-modulator + Radio/Telephone bandpass + Echo).
 */
export function processSamplesVoiceFx(samplesIn, sampleRate = 44100, opts = {}) {
  let data = new Float32Array(samplesIn);
  const len = data.length;

  if (opts.robotEffect) {
    const carrierHz = 85;
    const step = (2 * Math.PI * carrierHz) / Math.max(8000, sampleRate);
    for (let i = 0; i < len; i += 1) {
      const mod = 0.45 + 0.55 * Math.sin(i * step);
      data[i] = Math.tanh(data[i] * mod * 1.45);
    }
  }

  if (opts.radioEffect) {
    data = applyBiquadFilter(data, sampleRate, 'highpass', 420, 1.1);
    data = applyBiquadFilter(data, sampleRate, 'lowpass', 3100, 1.1);
    for (let i = 0; i < len; i += 1) {
      data[i] = Math.tanh(data[i] * 1.8) * 0.82;
    }
  }

  const echoMix = clampNum(opts.echoMix, 0, 100, 0) / 100;
  if (echoMix > 0.01) {
    const delaySamples = Math.max(1, Math.round(sampleRate * 0.24));
    const fb = 0.36 * echoMix;
    const wet = new Float32Array(len);
    for (let i = 0; i < len; i += 1) {
      const delayed = i >= delaySamples ? wet[i - delaySamples] : 0;
      wet[i] = data[i] + delayed * fb;
      data[i] = clampNum(data[i] * (1 - echoMix * 0.25) + delayed * (echoMix * 0.55), -1, 1, 0);
    }
  }

  const reverbMix = clampNum(opts.reverbMix, 0, 100, 0) / 100;
  if (reverbMix > 0.01) {
    // Lightweight 3-tap Schroeder comb reverb in pure JS (guaranteed offline parity)
    const taps = [
      Math.round(sampleRate * 0.031),
      Math.round(sampleRate * 0.053),
      Math.round(sampleRate * 0.089),
    ];
    const acc = new Float32Array(len);
    for (const d of taps) {
      const buf = new Float32Array(len);
      for (let i = 0; i < len; i += 1) {
        buf[i] = data[i] + (i >= d ? buf[i - d] * 0.48 : 0);
        acc[i] += buf[i] / taps.length;
      }
    }
    for (let i = 0; i < len; i += 1) {
      data[i] = clampNum(data[i] * (1 - reverbMix * 0.35) + acc[i] * (reverbMix * 0.65), -1, 1, 0);
    }
  }

  return data;
}

/**
 * Pure multi-track mixer: merges primary track + extra tracks in either
 * 'overlay' (mix together with offset + gain) or 'concat' (join sequentially).
 */
export function mixStereoTracksPure(primary, extras = [], mode = 'overlay', sampleRate = 44100) {
  const safeExtras = Array.isArray(extras) ? extras.filter((t) => t && t.left && t.left.length > 0) : [];
  if (safeExtras.length === 0) {
    return {
      left: new Float32Array(primary.left),
      right: new Float32Array(primary.right),
    };
  }

  if (mode === 'concat') {
    const totalLen =
      primary.left.length + safeExtras.reduce((sum, t) => sum + t.left.length, 0);
    const outL = new Float32Array(totalLen);
    const outR = new Float32Array(totalLen);
    outL.set(primary.left, 0);
    outR.set(primary.right, 0);
    let cursor = primary.left.length;
    for (const track of safeExtras) {
      const gain = clampNum(track.volumePct ?? 100, 0, 200, 100) / 100;
      const len = track.left.length;
      const rSrc = track.right || track.left;
      for (let i = 0; i < len; i += 1) {
        outL[cursor + i] = clampNum(track.left[i] * gain, -1, 1, 0);
        outR[cursor + i] = clampNum(rSrc[i] * gain, -1, 1, 0);
      }
      cursor += len;
    }
    return { left: outL, right: outR };
  }

  // Overlay mode
  let totalLen = primary.left.length;
  for (const track of safeExtras) {
    const offsetSamples = Math.max(0, Math.round((Number(track.offsetSec) || 0) * sampleRate));
    totalLen = Math.max(totalLen, offsetSamples + track.left.length);
  }
  const outL = new Float32Array(totalLen);
  const outR = new Float32Array(totalLen);
  outL.set(primary.left, 0);
  outR.set(primary.right, 0);

  for (const track of safeExtras) {
    const offsetSamples = Math.max(0, Math.round((Number(track.offsetSec) || 0) * sampleRate));
    const gain = clampNum(track.volumePct ?? 80, 0, 200, 80) / 100;
    const len = track.left.length;
    const rSrc = track.right || track.left;
    for (let i = 0; i < len; i += 1) {
      const idx = offsetSamples + i;
      if (idx < totalLen) {
        outL[idx] += track.left[i] * gain;
        outR[idx] += rSrc[i] * gain;
      }
    }
  }

  // Soft ceiling limiter to prevent digital clipping after summing tracks
  for (let i = 0; i < totalLen; i += 1) {
    if (Math.abs(outL[i]) > 0.96) outL[i] = Math.tanh(outL[i]);
    if (Math.abs(outR[i]) > 0.96) outR[i] = Math.tanh(outR[i]);
  }
  return { left: outL, right: outR };
}

function encodeUtf8Bytes(str) {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(String(str || ''));
  }
  const s = String(str || '');
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) arr[i] = s.charCodeAt(i) & 0xff;
  return arr;
}

function decodeTextBytes(bytes) {
  if (typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
      // Fallback
    }
  }
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return s;
}

function writeAscii(view, offset, str) {
  for (let i = 0; i < str.length; i += 1) {
    view.setUint8(offset + i, str.charCodeAt(i) & 0xff);
  }
}

/**
 * Encodes stereo/mono Float32 channels into a standard 16-bit PCM RIFF WAV
 * with an embedded LIST/INFO chunk carrying rewritten title/artist/album/year/genre/comment.
 */
export function encodeWavWithMetadata(channels, sampleRate = 44100, metadata = {}) {
  const numChannels = Math.max(1, Math.min(2, channels.length));
  const numFrames = channels[0]?.length || 0;
  const sr = Math.max(8000, Math.round(Number(sampleRate) || 44100));
  const bytesPerSample = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;

  // Build LIST/INFO subchunks if metadata provided
  const infoMap = [
    ['INAM', metadata?.title],
    ['IART', metadata?.artist],
    ['IPRD', metadata?.album],
    ['ICRD', metadata?.year],
    ['IGNR', metadata?.genre],
    ['ICMT', metadata?.comment],
    ['ITRK', metadata?.track],
  ].filter(([, val]) => String(val || '').trim().length > 0);

  const infoSubchunks = infoMap.map(([tag, val]) => {
    const raw = encodeUtf8Bytes(`${String(val).trim()}\0`);
    const paddedLen = raw.length + (raw.length % 2);
    const chunk = new Uint8Array(8 + paddedLen);
    const dv = new DataView(chunk.buffer);
    writeAscii(dv, 0, tag);
    dv.setUint32(4, raw.length, true);
    chunk.set(raw, 8);
    return chunk;
  });

  const infoPayloadSize = infoSubchunks.reduce((s, c) => s + c.byteLength, 0);
  const listChunkSize = infoPayloadSize > 0 ? 12 + infoPayloadSize : 0;

  const totalSize = 44 + dataSize + listChunkSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, totalSize - 8, true);
  writeAscii(view, 8, 'WAVE');

  // fmt chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);

  // data chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sample = clampNum(channels[ch][i], -1, 1, 0);
      const int16 = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  // LIST INFO chunk
  if (listChunkSize > 0) {
    writeAscii(view, offset, 'LIST');
    view.setUint32(offset + 4, 4 + infoPayloadSize, true);
    writeAscii(view, offset + 8, 'INFO');
    offset += 12;
    for (const sub of infoSubchunks) {
      u8.set(sub, offset);
      offset += sub.byteLength;
    }
  }

  return buffer;
}

function encodeSynchsafe32(size) {
  return [
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f,
  ];
}

function makeId3TextFrame(frameId, text) {
  const clean = String(text || '').trim();
  if (!clean) return null;
  const payload = encodeUtf8Bytes(clean);
  const frameSize = 1 + payload.length; // encoding byte 0x03 (UTF-8) + text
  const out = new Uint8Array(10 + frameSize);
  const dv = new DataView(out.buffer);
  writeAscii(dv, 0, frameId);
  dv.setUint32(4, frameSize, false);
  dv.setUint16(8, 0, false);
  out[10] = 0x03; // UTF-8
  out.set(payload, 11);
  return out;
}

function makeId3CommFrame(comment) {
  const clean = String(comment || '').trim();
  if (!clean) return null;
  const payload = encodeUtf8Bytes(clean);
  const frameSize = 1 + 3 + 1 + payload.length; // enc + 'eng' + shortDesc\0 + text
  const out = new Uint8Array(10 + frameSize);
  const dv = new DataView(out.buffer);
  writeAscii(dv, 0, 'COMM');
  dv.setUint32(4, frameSize, false);
  dv.setUint16(8, 0, false);
  out[10] = 0x03;
  writeAscii(dv, 11, 'ind');
  out[14] = 0x00;
  out.set(payload, 15);
  return out;
}

function makeId3ApicFrame(coverDataUrl) {
  const raw = String(coverDataUrl || '').trim();
  const match = raw.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  const mime = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const b64 = match[2];
  let imgBytes;
  try {
    if (typeof atob === 'function') {
      const bin = atob(b64);
      imgBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) imgBytes[i] = bin.charCodeAt(i);
    } else if (typeof Buffer !== 'undefined') {
      imgBytes = new Uint8Array(Buffer.from(b64, 'base64'));
    } else {
      return null;
    }
  } catch {
    return null;
  }
  const mimeBytes = encodeUtf8Bytes(mime);
  const frameSize = 1 + mimeBytes.length + 1 + 1 + 1 + imgBytes.length;
  const out = new Uint8Array(10 + frameSize);
  const dv = new DataView(out.buffer);
  writeAscii(dv, 0, 'APIC');
  dv.setUint32(4, frameSize, false);
  dv.setUint16(8, 0, false);
  let pos = 10;
  out[pos++] = 0x00; // ISO-8859-1
  out.set(mimeBytes, pos);
  pos += mimeBytes.length;
  out[pos++] = 0x00; // MIME terminator
  out[pos++] = 0x03; // Cover (front)
  out[pos++] = 0x00; // Empty description terminator
  out.set(imgBytes, pos);
  return out;
}

/**
 * Builds a compliant ID3v2.3 binary header with UTF-8 frames (TIT2, TPE1, TALB, TYER, TCON, TRCK, COMM, APIC).
 */
export function buildId3v2TagBytes(metadata = {}) {
  const frames = [
    makeId3TextFrame('TIT2', metadata?.title),
    makeId3TextFrame('TPE1', metadata?.artist),
    makeId3TextFrame('TALB', metadata?.album),
    makeId3TextFrame('TYER', metadata?.year),
    makeId3TextFrame('TCON', metadata?.genre),
    makeId3TextFrame('TRCK', metadata?.track),
    makeId3CommFrame(metadata?.comment),
    makeId3ApicFrame(metadata?.coverDataUrl),
  ].filter(Boolean);

  if (frames.length === 0) return new Uint8Array(0);
  const bodySize = frames.reduce((sum, f) => sum + f.byteLength, 0);
  const tag = new Uint8Array(10 + bodySize);
  tag[0] = 0x49; // I
  tag[1] = 0x44; // D
  tag[2] = 0x33; // 3
  tag[3] = 0x03; // v2.3
  tag[4] = 0x00;
  tag[5] = 0x00;
  const synch = encodeSynchsafe32(bodySize);
  tag[6] = synch[0];
  tag[7] = synch[1];
  tag[8] = synch[2];
  tag[9] = synch[3];

  let cursor = 10;
  for (const frame of frames) {
    tag.set(frame, cursor);
    cursor += frame.byteLength;
  }
  return tag;
}

/**
 * Prepends rewritten ID3v2.3 metadata to MP3 bytes (stripping any previous ID3v2 header cleanly).
 */
export function prependId3v2ToMp3(mp3Bytes, metadata = {}) {
  const src = mp3Bytes instanceof Uint8Array ? mp3Bytes : new Uint8Array(mp3Bytes);
  let audioStart = 0;
  if (src.length >= 10 && src[0] === 0x49 && src[1] === 0x44 && src[2] === 0x33) {
    const oldSize =
      ((src[6] & 0x7f) << 21) |
      ((src[7] & 0x7f) << 14) |
      ((src[8] & 0x7f) << 7) |
      (src[9] & 0x7f);
    audioStart = Math.min(src.length, 10 + oldSize);
  }
  const tag = buildId3v2TagBytes(metadata);
  const audioPayload = src.subarray(audioStart);
  const out = new Uint8Array(tag.byteLength + audioPayload.byteLength);
  out.set(tag, 0);
  out.set(audioPayload, tag.byteLength);
  return out;
}

/**
 * Parses existing ID3v2.3/2.4 tags (MP3) or RIFF LIST/INFO tags (WAV) from an ArrayBuffer.
 */
export function parseId3v2OrWavMetadata(arrayBuffer) {
  const result = {};
  if (!arrayBuffer || arrayBuffer.byteLength < 12) return result;
  const bytes = new Uint8Array(arrayBuffer);

  // 1) ID3v2 parser
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    const tagSize =
      ((bytes[6] & 0x7f) << 21) |
      ((bytes[7] & 0x7f) << 14) |
      ((bytes[8] & 0x7f) << 7) |
      (bytes[9] & 0x7f);
    const limit = Math.min(bytes.length, 10 + tagSize);
    const version = bytes[3];
    let pos = 10;
    const frameMap = {
      TIT2: 'title',
      TPE1: 'artist',
      TALB: 'album',
      TYER: 'year',
      TDRC: 'year',
      TCON: 'genre',
      TRCK: 'track',
    };
    while (pos + 10 <= limit) {
      const id = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const dv = new DataView(bytes.buffer, bytes.byteOffset + pos + 4, 4);
      const size =
        version === 4
          ? ((bytes[pos + 4] & 0x7f) << 21) |
            ((bytes[pos + 5] & 0x7f) << 14) |
            ((bytes[pos + 6] & 0x7f) << 7) |
            (bytes[pos + 7] & 0x7f)
          : dv.getUint32(0, false);
      if (size <= 0 || pos + 10 + size > limit) break;
      const body = bytes.subarray(pos + 10, pos + 10 + size);
      if (frameMap[id] && body.length > 1) {
        const enc = body[0];
        let text = '';
        if (enc === 1 || enc === 2) {
          // UTF-16 basic decode
          const start = body[1] === 0xff && body[2] === 0xfe ? 3 : 1;
          for (let k = start; k + 1 < body.length; k += 2) {
            const code = body[k] | (body[k + 1] << 8);
            if (code > 0) text += String.fromCharCode(code);
          }
        } else {
          text = decodeTextBytes(body.subarray(1));
        }
        result[frameMap[id]] = text.replace(/\0+/g, '').trim();
      } else if (id === 'COMM' && body.length > 5) {
        // skip encoding (1) + lang (3) + short desc until 0x00
        let idx = 4;
        while (idx < body.length && body[idx] !== 0) idx += 1;
        const text = decodeTextBytes(body.subarray(idx + 1)).replace(/\0+/g, '').trim();
        if (text) result.comment = text;
      }
      pos += 10 + size;
    }
    return result;
  }

  // 2) RIFF WAV LIST/INFO parser
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    const dv = new DataView(arrayBuffer);
    let pos = 12;
    const infoMap = {
      INAM: 'title',
      IART: 'artist',
      IPRD: 'album',
      ICRD: 'year',
      IGNR: 'genre',
      ICMT: 'comment',
      ITRK: 'track',
    };
    while (pos + 8 <= bytes.length) {
      const chunkId = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
      const chunkSize = dv.getUint32(pos + 4, true);
      const nextPos = pos + 8 + chunkSize + (chunkSize % 2);
      if (chunkId === 'LIST' && pos + 12 <= bytes.length) {
        const listType = String.fromCharCode(bytes[pos + 8], bytes[pos + 9], bytes[pos + 10], bytes[pos + 11]);
        if (listType === 'INFO') {
          let sub = pos + 12;
          const end = Math.min(bytes.length, pos + 8 + chunkSize);
          while (sub + 8 <= end) {
            const subId = String.fromCharCode(bytes[sub], bytes[sub + 1], bytes[sub + 2], bytes[sub + 3]);
            const subSize = dv.getUint32(sub + 4, true);
            if (infoMap[subId] && sub + 8 + subSize <= end) {
              const txt = decodeTextBytes(bytes.subarray(sub + 8, sub + 8 + subSize)).replace(/\0+/g, '').trim();
              if (txt) result[infoMap[subId]] = txt;
            }
            sub += 8 + subSize + (subSize % 2);
          }
        }
      }
      if (nextPos <= pos) break;
      pos = nextPos;
    }
  }

  return result;
}

/**
 * Builds real FFmpeg WASM CLI arguments for exporting edited audio to MP3/M4A/OGG/FLAC/WebM/WAV
 * with embedded audio identity & metadata tags.
 */
export function buildAudioExportFfmpegArgs(inName, outName, opts = {}) {
  const fmt = String(opts.format || 'mp3').toLowerCase();
  const bitrate = clampNum(opts.bitrate, 64, 320, 192);
  const sampleRate = clampNum(opts.sampleRate, 22050, 96000, 44100);
  const meta = opts.metadata || {};

  const metaArgs = [];
  const metaFields = [
    ['title', meta.title],
    ['artist', meta.artist],
    ['album', meta.album],
    ['date', meta.year],
    ['genre', meta.genre],
    ['track', meta.track],
    ['comment', meta.comment],
  ];
  for (const [k, v] of metaFields) {
    const clean = String(v || '').trim();
    if (clean) {
      metaArgs.push('-metadata', `${k}=${clean}`);
    }
  }

  const base = ['-i', inName, '-vn', '-ar', String(sampleRate), '-ac', '2'];
  if (fmt === 'mp3') {
    return [...base, '-c:a', 'libmp3lame', '-b:a', `${bitrate}k`, '-id3v2_version', '3', ...metaArgs, '-y', outName];
  }
  if (fmt === 'm4a') {
    return [...base, '-c:a', 'aac', '-b:a', `${bitrate}k`, '-movflags', '+faststart', '-f', 'ipod', ...metaArgs, '-y', outName];
  }
  if (fmt === 'ogg') {
    const q = bitrate >= 256 ? '7' : bitrate >= 192 ? '5' : '4';
    return [...base, '-c:a', 'libvorbis', '-q:a', q, ...metaArgs, '-y', outName];
  }
  if (fmt === 'flac') {
    return [...base, '-c:a', 'flac', ...metaArgs, '-y', outName];
  }
  if (fmt === 'webm') {
    return [...base, '-c:a', 'libvorbis', '-b:a', `${bitrate}k`, ...metaArgs, '-y', outName];
  }
  return [...base, '-c:a', 'pcm_s16le', ...metaArgs, '-y', outName];
}

/**
 * Deterministic On-Device Neural-DSP Mastering Planner — always produces valid,
 * musically sound studio recommendations based on actual acoustic telemetry + goal.
 */
export function computeLocalAiMasteringPlan(stats = {}, goal = 'studio-master', metadata = {}) {
  const issues = Array.isArray(stats.issues) ? stats.issues : [];
  const hasNoise = issues.includes('background-noise') || (Number(stats.noiseFloorDb) || -70) > -46;
  const hasClip = issues.includes('clipping') || (Number(stats.clippedSamples) || 0) > 12;
  const isQuiet = issues.includes('low-volume') || (Number(stats.rmsDb) || -18) < -23;

  let plan = {
    summary: 'Analisis spektrum selesai: pengaturan EQ seimbang, loudness -14 LUFS, & kejernihan studio diterapkan.',
    volumePct: isQuiet ? 145 : 108,
    normalizeEnabled: true,
    targetLufs: -14,
    eqPreset: 'studio-master',
    eqGains: [2, 2.5, 1, 0, -0.5, 1, 2.5, 3, 2, 1.5],
    noiseReduction: hasNoise ? 52 : 18,
    noiseGateDb: hasNoise ? -48 : -64,
    clarityAmount: 36,
    deEsserAmount: 22,
    repairDeclip: hasClip,
    repairDcOffset: true,
    repairHumFilter: hasNoise,
    stemMode: 'original',
    stemStrength: 80,
    suggestedMetadata: null,
  };

  if (goal === 'podcast-clean') {
    plan = {
      ...plan,
      summary: 'Preset Podcast Broadcast aktif: pemotongan rumble sub-bass, penekan noise latar, de-esser, & fokus vokal 2–4kHz.',
      volumePct: isQuiet ? 155 : 115,
      targetLufs: -16,
      eqPreset: 'podcast',
      eqGains: [-6, -3, 1, 2, 1, 1.5, 3.5, 4, 2, -1],
      noiseReduction: Math.max(55, hasNoise ? 74 : 55),
      noiseGateDb: -46,
      clarityAmount: 54,
      deEsserAmount: 40,
      repairHumFilter: true,
    };
  } else if (goal === 'audio-repair') {
    plan = {
      ...plan,
      summary: 'Mesin Perbaikan Audio aktif: De-Clipper, pembersih DC Offset, filter dengung 50/60Hz, dan penstabil noise adaptif.',
      volumePct: isQuiet ? 150 : 100,
      targetLufs: -15,
      eqPreset: 'vocal-clarity',
      eqGains: [-4, -2, 0, 0.5, 1, 2, 3, 3.5, 2, 0.5],
      noiseReduction: 68,
      noiseGateDb: -44,
      clarityAmount: 42,
      deEsserAmount: 30,
      repairDeclip: true,
      repairDcOffset: true,
      repairHumFilter: true,
    };
  } else if (goal === 'social-punch') {
    plan = {
      ...plan,
      summary: 'Mastering Sosmed Punchy (-12 LUFS): bass padat untuk speaker HP, vokal tajam, dan limiter anti-pecah.',
      volumePct: 122,
      targetLufs: -12,
      eqPreset: 'bass-boost',
      eqGains: [4.5, 4.5, 2.5, 0.5, 0, 1, 3, 3.5, 2.5, 2],
      noiseReduction: hasNoise ? 40 : 15,
      clarityAmount: 50,
      deEsserAmount: 28,
    };
  } else if (goal === 'vocal-karaoke') {
    plan = {
      ...plan,
      summary: 'Mode Karaoke / Pemisah Musik aktif: mengurangi vokal tengah Mid-Side sambil menjaga instrumen & bass stereo.',
      volumePct: 112,
      normalizeEnabled: true,
      targetLufs: -14,
      eqPreset: 'studio-master',
      eqGains: [2.5, 2, 0.5, 0, -1.5, -1, 1.5, 2, 2.5, 2],
      noiseReduction: 12,
      clarityAmount: 25,
      stemMode: 'instrumental',
      stemStrength: 88,
    };
  } else if (goal === 'metadata-polish') {
    const rawTitle = String(metadata?.title || 'Track Audio Studio')
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const titleCased = rawTitle
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    plan = {
      ...plan,
      summary: 'Identitas audio & metadata dirapikan otomatis (format judul standar, tag artis/album bersih, & komentar studio).',
      suggestedMetadata: {
        title: titleCased || 'Rekaman Studio HD',
        artist: String(metadata?.artist || '').trim() || 'Manifestudio Creator',
        album: String(metadata?.album || '').trim() || 'Single Mastered Edition',
        year: String(metadata?.year || new Date().getFullYear()).trim(),
        genre: String(metadata?.genre || '').trim() || 'Pop',
        comment: 'Mastered & tagged via Manifestudio Multi-AI Audio Studio',
      },
    };
  }

  return plan;
}

/**
 * Parses and strictly sanitizes JSON recommendations returned by ChatGPT / Claude /
 * Gemini / DeepSeek / Grok keyless endpoints into safe studio DSP bounds.
 */
export function parseAiAudioEngineeringResponse(rawText, fallbackPlan) {
  const clean = String(rawText || '').trim();
  const match = clean.match(/\{[\s\S]*\}/);
  if (!match) {
    return { fromRemoteAi: false, plan: fallbackPlan };
  }
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== 'object') {
      return { fromRemoteAi: false, plan: fallbackPlan };
    }
    const eqRaw = Array.isArray(parsed.eqGains) && parsed.eqGains.length === 10
      ? parsed.eqGains.map((g, idx) => Number(clampNum(g, -12, 12, fallbackPlan.eqGains[idx]).toFixed(1)))
      : fallbackPlan.eqGains;

    const validStems = new Set(AUDIO_STEM_MODES.map((m) => m.id));
    const stemMode = validStems.has(parsed.stemMode) ? parsed.stemMode : fallbackPlan.stemMode;

    const suggestedMetadata =
      parsed.suggestedMetadata && typeof parsed.suggestedMetadata === 'object'
        ? {
            title: String(parsed.suggestedMetadata.title || '').trim(),
            artist: String(parsed.suggestedMetadata.artist || '').trim(),
            album: String(parsed.suggestedMetadata.album || '').trim(),
            year: String(parsed.suggestedMetadata.year || '').trim().slice(0, 4),
            genre: String(parsed.suggestedMetadata.genre || '').trim(),
            comment: String(parsed.suggestedMetadata.comment || '').trim(),
          }
        : fallbackPlan.suggestedMetadata || null;

    return {
      fromRemoteAi: true,
      plan: {
        summary: String(parsed.summary || fallbackPlan.summary).trim().slice(0, 260),
        volumePct: Math.round(clampNum(parsed.volumePct, 50, 240, fallbackPlan.volumePct)),
        normalizeEnabled: typeof parsed.normalizeEnabled === 'boolean' ? parsed.normalizeEnabled : fallbackPlan.normalizeEnabled,
        targetLufs: Math.round(clampNum(parsed.targetLufs, -22, -9, fallbackPlan.targetLufs)),
        eqPreset: String(parsed.eqPreset || 'custom'),
        eqGains: eqRaw,
        noiseReduction: Math.round(clampNum(parsed.noiseReduction, 0, 100, fallbackPlan.noiseReduction)),
        noiseGateDb: Math.round(clampNum(parsed.noiseGateDb, -70, -28, fallbackPlan.noiseGateDb)),
        clarityAmount: Math.round(clampNum(parsed.clarityAmount, 0, 100, fallbackPlan.clarityAmount)),
        deEsserAmount: Math.round(clampNum(parsed.deEsserAmount, 0, 100, fallbackPlan.deEsserAmount)),
        repairDeclip: typeof parsed.repairDeclip === 'boolean' ? parsed.repairDeclip : fallbackPlan.repairDeclip,
        repairDcOffset: typeof parsed.repairDcOffset === 'boolean' ? parsed.repairDcOffset : fallbackPlan.repairDcOffset,
        repairHumFilter: typeof parsed.repairHumFilter === 'boolean' ? parsed.repairHumFilter : fallbackPlan.repairHumFilter,
        stemMode,
        stemStrength: Math.round(clampNum(parsed.stemStrength, 0, 100, fallbackPlan.stemStrength)),
        suggestedMetadata,
      },
    };
  } catch {
    return { fromRemoteAi: false, plan: fallbackPlan };
  }
}

/**
 * Generates a rich musical stereo demo clip (center vocal-band synth melody + stereo wide chords
 * + sub bass + subtle room noise) so users can test every feature immediately without uploading first.
 */
export function generateSyntheticDemoStereo(sampleRate = 44100, durationSec = 8) {
  const sr = Math.max(22050, Math.round(Number(sampleRate) || 44100));
  const len = Math.round(sr * clampNum(durationSec, 2, 20, 8));
  const left = new Float32Array(len);
  const right = new Float32Array(len);

  // Progression: Am -> F -> C -> G (2s each)
  const chords = [
    { bass: 110.0, padL: 220.0, padR: 329.63, lead: [440, 523.25, 659.25, 587.33] },
    { bass: 87.31, padL: 174.61, padR: 261.63, lead: [349.23, 440, 523.25, 440] },
    { bass: 130.81, padL: 261.63, padR: 392.0, lead: [523.25, 659.25, 783.99, 659.25] },
    { bass: 98.0, padL: 196.0, padR: 293.66, lead: [392.0, 493.88, 587.33, 493.88] },
  ];

  // Deterministic PRNG for subtle noise floor so denoise has something real to clean
  let seed = 133791;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  for (let i = 0; i < len; i += 1) {
    const t = i / sr;
    const barIdx = Math.floor(t / 2) % chords.length;
    const noteIdx = Math.floor((t % 2) / 0.5) % 4;
    const noteLocalT = t % 0.5;
    const chord = chords[barIdx];

    // Smooth note envelope
    const leadEnv = Math.min(1, noteLocalT / 0.03) * Math.exp(-noteLocalT * 3.2);
    const kickEnv = Math.exp(-(t % 0.5) * 18);
    const kickFreq = 54 + 90 * Math.exp(-(t % 0.5) * 28);

    // Center vocal-range lead (identical in L & R -> isolated by Mid-Side vocal extractor!)
    const leadFreq = chord.lead[noteIdx];
    const vocalLead =
      (0.26 * Math.sin(2 * Math.PI * leadFreq * t) +
        0.11 * Math.sin(2 * Math.PI * leadFreq * 2 * t) +
        0.04 * Math.sin(2 * Math.PI * leadFreq * 3 * t)) *
      leadEnv;

    // Warm bass + kick (center)
    const bass = 0.22 * Math.sin(2 * Math.PI * chord.bass * t) + 0.18 * Math.sin(2 * Math.PI * kickFreq * t) * kickEnv;

    // Wide stereo pad (panned L vs R -> preserved in Karaoke/Instrumental mode!)
    const padL = 0.16 * Math.sin(2 * Math.PI * chord.padL * t) + 0.07 * Math.sin(2 * Math.PI * chord.padL * 1.5 * t);
    const padR = 0.16 * Math.sin(2 * Math.PI * chord.padR * t) + 0.07 * Math.sin(2 * Math.PI * chord.padR * 1.25 * t);

    // Subtle analog hiss (~ -44 dB)
    const hiss = nextRand() * 0.008;

    // Gentle fade in/out at clip edges
    const edgeEnv = Math.min(1, t / 0.06, Math.max(0, (durationSec - t) / 0.08));

    left[i] = clampNum((vocalLead + bass + padL + hiss) * edgeEnv, -0.95, 0.95, 0);
    right[i] = clampNum((vocalLead + bass + padR + hiss) * edgeEnv, -0.95, 0.95, 0);
  }

  return { left, right, sampleRate: sr, durationSec: len / sr };
}
