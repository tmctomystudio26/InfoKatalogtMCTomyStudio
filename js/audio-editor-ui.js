/**
 * Manifestudio Audio Editor Studio UI Controller
 * Interactive Waveform & Live Spectrum, Trim & Volume, 10-Band EQ, Voice Changer & FX,
 * Noise Stabilizer & Audio Repair, Vocal/Music Stem Separator, Multi-Track Mixer,
 * Identity & Metadata Editor (iTunes + MusicBrainz + ID3v2.3/RIFF), Multi-AI Mastering
 * (ChatGPT, Claude, Gemini, DeepSeek, Grok), and Multi-Format Export (MP3/WAV/M4A/OGG/FLAC/WebM).
 */

import {
  AUDIO_AI_ENGINES,
  AUDIO_AI_GOALS,
  AUDIO_EQ_BANDS,
  AUDIO_EQ_PRESETS,
  AUDIO_EXPORT_FORMATS,
  AUDIO_STEM_MODES,
  AUDIO_VOICE_PRESETS,
  clampNum,
  clampTrimRange,
  createDefaultAudioEditorState,
  extractWaveformPeaks,
  formatTimecode,
  gainToDb,
  volumePctToGain,
} from './audio-editor-logic.js?v=58';
import {
  consultMultiAiAudioEngineer,
  createDemoStudioAudio,
  decodeAnyAudioFile,
  exportRenderedAudio,
  fetchCoverUrlAsDataUrl,
  getAudioContext,
  lookupOfficialAudioMetadata,
  renderProcessedAudio,
} from './audio-editor-engine.js?v=58';
import { formatBytes } from './tools-logic.js?v=58';

const WORKBENCH_TABS = [
  { id: 'trim', label: 'Pangkas & Volume' },
  { id: 'eq', label: 'Equalizer' },
  { id: 'voice', label: 'Ubah Suara' },
  { id: 'clean', label: 'Jernih & Noise' },
  { id: 'stem', label: 'Pisah Vokal' },
  { id: 'mix', label: 'Mix & Gabung' },
  { id: 'meta', label: 'Identitas & Tag' },
  { id: 'export', label: 'AI & Ekspor' },
];

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function createAudioEditorController({ onToast = () => {} } = {}) {
  let hostEl = null;
  let mounted = false;
  let themeObserver = null;
  let resizeHandler = null;

  // Audio project state
  let sourceBuffer = null;
  let fileName = '';
  let fileSize = 0;
  let sourceFormat = '';
  let sourceStats = null;
  let waveformPeaks = null;
  let mixTracks = []; // [{ id, name, audioBuffer, duration, volumePct, offsetSec }]
  let editState = createDefaultAudioEditorState();
  let activeWorkbench = 'trim';

  // Playback & live Web Audio graph state
  let isPlaying = false;
  let compareOriginal = false;
  let loopSelection = false;
  let playSourceNode = null;
  let liveEqNodes = [];
  let liveGainNode = null;
  let livePanNode = null;
  let liveAnalyser = null;
  let playStartedAtCtx = 0;
  let playOffsetSec = 0;
  let currentTimeSec = 0;
  let rafId = 0;
  let renderedPreviewBuffer = null;
  let renderedPreviewDirty = true;

  // Mic recording state
  let isRecording = false;
  let mediaRecorder = null;
  let micStream = null;
  let recordedChunks = [];
  let recordStartTs = 0;
  let recordTimer = null;

  // Async operation states
  let loadingFile = false;
  let loadingProgress = 0;
  let loadingLabel = '';
  let renderingExport = false;
  let exportProgress = 0;
  let exportLabel = '';
  let lastExportResult = null; // { url, fileName, size, format, engineUsed, duration }
  let aiBusy = false;
  let aiResult = null; // { provider, mode, plan }
  let metaSearching = false;
  let metaMatches = [];

  function revokeExportUrl() {
    if (lastExportResult?.url) {
      try {
        URL.revokeObjectURL(lastExportResult.url);
      } catch {
        // Ignore
      }
    }
    lastExportResult = null;
  }

  function stopPlayback() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (playSourceNode) {
      try {
        playSourceNode.onended = null;
        playSourceNode.stop();
        playSourceNode.disconnect();
      } catch {
        // Ignore
      }
      playSourceNode = null;
    }
    liveEqNodes = [];
    liveGainNode = null;
    livePanNode = null;
    liveAnalyser = null;
    isPlaying = false;
    updateTransportDom();
    drawWaveformCanvas();
  }

  function stopMicRecording(cancelOnly = false) {
    clearInterval(recordTimer);
    recordTimer = null;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      if (cancelOnly) {
        mediaRecorder.onstop = null;
      }
      try {
        mediaRecorder.stop();
      } catch {
        // Ignore
      }
    }
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    isRecording = false;
  }

  function markDirty() {
    renderedPreviewDirty = true;
    // Also update live Web Audio nodes immediately for zero-latency EQ/Volume/Pan/Pitch preview
    if (isPlaying && !compareOriginal) {
      if (liveGainNode) {
        liveGainNode.gain.value = volumePctToGain(editState.volumePct);
      }
      if (livePanNode) {
        livePanNode.pan.value = clampNum(editState.pan, -1, 1, 0);
      }
      if (liveEqNodes.length === AUDIO_EQ_BANDS.length) {
        for (let i = 0; i < AUDIO_EQ_BANDS.length; i += 1) {
          liveEqNodes[i].gain.value = clampNum(editState.eqGains[i], -12, 12, 0);
        }
      }
      if (playSourceNode) {
        const rate = clampNum(editState.speed * Math.pow(2, editState.pitchSemitones / 12), 0.4, 2.5, 1);
        try {
          playSourceNode.playbackRate.value = rate;
        } catch {
          // Ignore
        }
      }
    }
  }

  function needsOfflinePreviewDsp() {
    return (
      editState.reverse ||
      editState.stemMode !== 'original' ||
      editState.noiseReduction > 0 ||
      editState.noiseGateDb > -69 ||
      editState.clarityAmount > 0 ||
      editState.deEsserAmount > 0 ||
      editState.repairDeclip ||
      editState.repairHumFilter ||
      editState.robotEffect ||
      editState.radioEffect ||
      editState.reverbMix > 0 ||
      editState.echoMix > 0 ||
      editState.normalizeEnabled ||
      editState.fadeIn > 0 ||
      editState.fadeOut > 0 ||
      mixTracks.length > 0
    );
  }

  async function startPlayback(fromSec = null) {
    if (!sourceBuffer) {
      onToast('Muat file audio atau klik "Muat Audio Contoh" terlebih dahulu.');
      return;
    }
    stopPlayback();
    const ctx = getAudioContext();
    if (!ctx) return;

    const { trimStart, trimEnd } = clampTrimRange(editState.trimStart, editState.trimEnd, sourceBuffer.duration);
    let bufferToPlay = sourceBuffer;
    let useLiveChain = !compareOriginal;
    let startPos = fromSec !== null ? clampNum(fromSec, trimStart, trimEnd - 0.02, trimStart) : currentTimeSec;
    if (startPos < trimStart || startPos >= trimEnd - 0.05) {
      startPos = trimStart;
    }

    // If heavy offline DSP effects are active and user is listening to edited preview, render fast offline buffer
    if (!compareOriginal && needsOfflinePreviewDsp()) {
      try {
        if (renderedPreviewDirty || !renderedPreviewBuffer) {
          const rendered = await renderProcessedAudio(sourceBuffer, mixTracks, editState);
          renderedPreviewBuffer = rendered.audioBuffer;
          renderedPreviewDirty = false;
        }
        bufferToPlay = renderedPreviewBuffer;
        useLiveChain = false; // already baked into renderedPreviewBuffer
        startPos = 0;
      } catch {
        bufferToPlay = sourceBuffer;
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = bufferToPlay;
    src.loop = loopSelection;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.78;
    liveAnalyser = analyser;

    if (useLiveChain) {
      const rate = clampNum(editState.speed * Math.pow(2, editState.pitchSemitones / 12), 0.4, 2.5, 1);
      src.playbackRate.value = rate;
      let node = src;
      liveEqNodes = AUDIO_EQ_BANDS.map((band, idx) => {
        const filter = ctx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = band.freq;
        filter.Q.value = 1.4;
        filter.gain.value = clampNum(editState.eqGains[idx], -12, 12, 0);
        node.connect(filter);
        node = filter;
        return filter;
      });
      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        panner.pan.value = clampNum(editState.pan, -1, 1, 0);
        node.connect(panner);
        node = panner;
        livePanNode = panner;
      }
      const gain = ctx.createGain();
      gain.gain.value = volumePctToGain(editState.volumePct);
      node.connect(gain);
      gain.connect(analyser);
      analyser.connect(ctx.destination);
      liveGainNode = gain;
    } else {
      src.connect(analyser);
      analyser.connect(ctx.destination);
    }

    playSourceNode = src;
    playStartedAtCtx = ctx.currentTime;
    playOffsetSec = useLiveChain || compareOriginal ? startPos : 0;
    const playDuration =
      useLiveChain || compareOriginal
        ? Math.max(0.05, trimEnd - startPos)
        : bufferToPlay.duration;

    if (loopSelection && (useLiveChain || compareOriginal)) {
      src.loopStart = trimStart;
      src.loopEnd = trimEnd;
      src.start(0, startPos);
    } else if (loopSelection) {
      src.start(0, 0);
    } else {
      src.start(0, playOffsetSec, playDuration);
    }

    isPlaying = true;
    src.onended = () => {
      if (playSourceNode === src) {
        isPlaying = false;
        playSourceNode = null;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        currentTimeSec = trimStart;
        updateTransportDom();
        drawWaveformCanvas();
      }
    };

    updateTransportDom();
    tickPlaybackVisuals();
  }

  function tickPlaybackVisuals() {
    if (!isPlaying || !sourceBuffer) return;
    const ctx = getAudioContext();
    const { trimStart, trimEnd } = clampTrimRange(editState.trimStart, editState.trimEnd, sourceBuffer.duration);
    const rate = !compareOriginal && liveGainNode ? clampNum(editState.speed * Math.pow(2, editState.pitchSemitones / 12), 0.4, 2.5, 1) : 1;
    const elapsed = (ctx.currentTime - playStartedAtCtx) * rate;
    const span = Math.max(0.1, trimEnd - trimStart);
    currentTimeSec = loopSelection
      ? trimStart + ((playOffsetSec - trimStart + elapsed) % span)
      : Math.min(trimEnd, playOffsetSec + elapsed);

    updateTransportDom();
    drawWaveformCanvas();
    rafId = requestAnimationFrame(tickPlaybackVisuals);
  }

  function updateTransportDom() {
    if (!hostEl) return;
    const playBtn = hostEl.querySelector('#ae-play-btn');
    if (playBtn) {
      playBtn.setAttribute('aria-pressed', String(isPlaying));
      playBtn.innerHTML = isPlaying
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg><span>Jeda</span>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><span>Putar</span>`;
    }
    const timeEl = hostEl.querySelector('#ae-timecode-now');
    if (timeEl) {
      timeEl.textContent = formatTimecode(currentTimeSec);
    }
  }

  function drawWaveformCanvas() {
    if (!hostEl) return;
    const canvas = hostEl.querySelector('#ae-waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(260, Math.round(rect.width || 680));
    const height = Math.max(120, Math.round(rect.height || 148));
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const bg = isDark ? '#0d1526' : '#f1f5f9';
    const gridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(15,23,42,0.08)';
    const waveMuted = isDark ? 'rgba(148,163,184,0.28)' : 'rgba(100,116,139,0.3)';
    const waveActive = isDark ? '#38bdf8' : '#2563eb';
    const waveAccent = isDark ? '#2dd4bf' : '#0d9488';
    const trimShade = isDark ? 'rgba(2,6,23,0.58)' : 'rgba(15,23,42,0.12)';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Subtle studio grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.moveTo(0, height * 0.25);
    ctx.lineTo(width, height * 0.25);
    ctx.moveTo(0, height * 0.75);
    ctx.lineTo(width, height * 0.75);
    ctx.stroke();

    if (!sourceBuffer || !waveformPeaks) {
      ctx.fillStyle = isDark ? 'rgba(148,163,184,0.55)' : 'rgba(71,85,105,0.65)';
      ctx.font = '500 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Gelombang audio akan tampil di sini setelah file dimuat', width / 2, height / 2 + 4);
      return;
    }

    const dur = Math.max(0.01, sourceBuffer.duration);
    const { trimStart, trimEnd } = clampTrimRange(editState.trimStart, editState.trimEnd, dur);
    const startX = (trimStart / dur) * width;
    const endX = (trimEnd / dur) * width;

    // Live frequency spectrum subtle backdrop while playing
    if (isPlaying && liveAnalyser) {
      const freqBins = new Uint8Array(liveAnalyser.frequencyBinCount);
      liveAnalyser.getByteFrequencyData(freqBins);
      const barCount = Math.min(36, freqBins.length);
      const barW = width / barCount;
      for (let i = 0; i < barCount; i += 1) {
        const norm = freqBins[i] / 255;
        const barH = norm * (height * 0.42);
        ctx.fillStyle = isDark ? 'rgba(45, 212, 191, 0.16)' : 'rgba(14, 165, 233, 0.14)';
        ctx.fillRect(i * barW + 1, height - barH, Math.max(2, barW - 2), barH);
      }
    }

    // Draw waveform bars
    const count = waveformPeaks.length;
    const stepW = width / count;
    const midY = height / 2;
    const maxAmp = height * 0.42;

    for (let i = 0; i < count; i += 1) {
      const x = i * stepW;
      const inTrim = x >= startX && x <= endX;
      const amp = Math.max(2, waveformPeaks[i] * maxAmp);
      ctx.fillStyle = inTrim
        ? i % 3 === 0
          ? waveAccent
          : waveActive
        : waveMuted;
      const bw = Math.max(1.5, stepW - 1.2);
      ctx.fillRect(x, midY - amp, bw, amp * 2);
    }

    // Shaded trimmed-out areas
    ctx.fillStyle = trimShade;
    if (startX > 0) ctx.fillRect(0, 0, startX, height);
    if (endX < width) ctx.fillRect(endX, 0, width - endX, height);

    // Trim handle lines
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, 0);
    ctx.lineTo(startX, height);
    ctx.moveTo(endX, 0);
    ctx.lineTo(endX, height);
    ctx.stroke();

    // Small top trim markers
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(Math.max(0, startX - 3), 0, 6, 14);
    ctx.fillRect(Math.min(width - 6, endX - 3), 0, 6, 14);

    // Playhead cursor
    const playX = clampNum((currentTimeSec / dur) * width, 0, width, 0);
    ctx.strokeStyle = isDark ? '#ffffff' : '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playX, 0);
    ctx.lineTo(playX, height);
    ctx.stroke();
  }

  function applyLoadedProject(loaded) {
    stopPlayback();
    revokeExportUrl();
    sourceBuffer = loaded.audioBuffer;
    fileName = loaded.fileName;
    fileSize = loaded.fileSize;
    sourceFormat = loaded.format;
    sourceStats = loaded.stats;
    waveformPeaks = extractWaveformPeaks(sourceBuffer.getChannelData(0), 180);
    mixTracks = [];
    aiResult = null;
    metaMatches = [];
    renderedPreviewBuffer = null;
    renderedPreviewDirty = true;

    editState = createDefaultAudioEditorState();
    editState.trimStart = 0;
    editState.trimEnd = Number(sourceBuffer.duration.toFixed(3));
    editState.metadata = {
      ...editState.metadata,
      ...(loaded.metadata || {}),
    };
    currentTimeSec = 0;
    render();
  }

  async function handleFileUpload(file) {
    if (!file) return;
    loadingFile = true;
    loadingProgress = 10;
    loadingLabel = `Memuat ${file.name}...`;
    render();
    try {
      const loaded = await decodeAnyAudioFile(file, (p) => {
        loadingProgress = p.percent || loadingProgress;
        loadingLabel = p.label || loadingLabel;
        updateProgressInline();
      });
      loadingFile = false;
      applyLoadedProject(loaded);
      onToast(`Audio "${file.name}" siap diedit.`);
    } catch (err) {
      loadingFile = false;
      render();
      onToast(err?.message || 'Gagal membaca file audio. Pastikan format didukung.');
    }
  }

  async function handleAddMixTrack(file) {
    if (!file) return;
    try {
      onToast(`Memuat trek tambahan: ${file.name}...`);
      const loaded = await decodeAnyAudioFile(file);
      mixTracks.push({
        id: `trk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        audioBuffer: loaded.audioBuffer,
        duration: loaded.audioBuffer.duration,
        volumePct: 80,
        offsetSec: 0,
      });
      markDirty();
      render();
      onToast(`Trek "${file.name}" ditambahkan ke mixer.`);
    } catch (err) {
      onToast(err?.message || 'Gagal memuat trek audio tambahan.');
    }
  }

  function handleAddDemoMixTrack() {
    if (!sourceBuffer) {
      onToast('Muat audio utama terlebih dahulu sebelum mencampur trek.');
      return;
    }
    const demo = createDemoStudioAudio();
    mixTracks.push({
      id: `trk_demo_${Date.now()}`,
      name: 'Backsound Beat Demo (8s)',
      audioBuffer: demo.audioBuffer,
      duration: demo.audioBuffer.duration,
      volumePct: 45,
      offsetSec: 0,
    });
    markDirty();
    render();
    onToast('Trek backsound demo ditambahkan ke mixer.');
  }

  async function toggleMicRecording() {
    if (isRecording) {
      stopMicRecording(false);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onToast('Browser tidak mendukung perekaman mikrofon langsung.');
      return;
    }
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(micStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
        stopMicRecording(true);
        if (blob.size > 128) {
          const recFile = new File([blob], `Rekaman_Studio_${Date.now()}.webm`, { type: blob.type });
          await handleFileUpload(recFile);
        } else {
          render();
        }
      };
      mediaRecorder.start();
      isRecording = true;
      recordStartTs = Date.now();
      render();
      recordTimer = setInterval(() => {
        const badge = hostEl?.querySelector('#ae-rec-elapsed');
        if (badge) {
          badge.textContent = formatTimecode((Date.now() - recordStartTs) / 1000);
        }
      }, 200);
      onToast('Merekam suara dari mikrofon... klik lagi untuk berhenti.');
    } catch {
      stopMicRecording(true);
      onToast('Izin mikrofon ditolak atau tidak tersedia.');
      render();
    }
  }

  function updateProgressInline() {
    if (!hostEl) return;
    const bar = hostEl.querySelector('#ae-progress-fill');
    const lbl = hostEl.querySelector('#ae-progress-label');
    const pct = hostEl.querySelector('#ae-progress-pct');
    const val = renderingExport ? exportProgress : loadingProgress;
    const text = renderingExport ? exportLabel : loadingLabel;
    if (bar) bar.style.width = `${clampNum(val, 0, 100, 0)}%`;
    if (lbl) lbl.textContent = text;
    if (pct) pct.textContent = `${Math.round(clampNum(val, 0, 100, 0))}%`;
  }

  async function handleRunAiEngineer() {
    if (!sourceBuffer) {
      onToast('Muat file audio atau audio contoh terlebih dahulu.');
      return;
    }
    if (aiBusy) return;
    aiBusy = true;
    render();
    try {
      const res = await consultMultiAiAudioEngineer({
        stats: sourceStats || {},
        editState,
        fileName,
        onProgress: (p) => {
          const st = hostEl?.querySelector('#ae-ai-status-text');
          if (st && p?.label) st.textContent = p.label;
        },
      });
      aiResult = res;
      applyAiPlanToState(res.plan);
      aiBusy = false;
      render();
      onToast(`Rekomendasi ${res.provider} diterapkan ke studio!`);
    } catch {
      aiBusy = false;
      render();
      onToast('Gagal menjalankan analisis AI. Coba lagi.');
    }
  }

  function applyAiPlanToState(plan) {
    if (!plan) return;
    editState.volumePct = clampNum(plan.volumePct, 50, 240, editState.volumePct);
    editState.normalizeEnabled = Boolean(plan.normalizeEnabled);
    editState.targetLufs = clampNum(plan.targetLufs, -22, -9, -14);
    if (Array.isArray(plan.eqGains) && plan.eqGains.length === 10) {
      editState.eqGains = [...plan.eqGains];
      editState.eqPreset = plan.eqPreset || 'custom';
    }
    editState.noiseReduction = clampNum(plan.noiseReduction, 0, 100, 0);
    editState.noiseGateDb = clampNum(plan.noiseGateDb, -70, -24, -70);
    editState.clarityAmount = clampNum(plan.clarityAmount, 0, 100, 0);
    editState.deEsserAmount = clampNum(plan.deEsserAmount, 0, 100, 0);
    editState.repairDeclip = Boolean(plan.repairDeclip);
    editState.repairDcOffset = Boolean(plan.repairDcOffset);
    editState.repairHumFilter = Boolean(plan.repairHumFilter);
    if (plan.stemMode) {
      editState.stemMode = plan.stemMode;
      editState.stemStrength = clampNum(plan.stemStrength, 0, 100, 80);
    }
    if (plan.suggestedMetadata) {
      editState.metadata = {
        ...editState.metadata,
        ...Object.fromEntries(
          Object.entries(plan.suggestedMetadata).filter(([, v]) => String(v || '').trim().length > 0)
        ),
      };
    }
    markDirty();
  }

  async function handleMetadataLookup() {
    const query =
      String(editState.metadata.title || '').trim() ||
      String(fileName || '').replace(/\.[^.]+$/, '').trim();
    if (!query) {
      onToast('Masukkan judul lagu atau nama artis di kolom Identitas terlebih dahulu.');
      return;
    }
    metaSearching = true;
    metaMatches = [];
    render();
    try {
      metaMatches = await lookupOfficialAudioMetadata(query);
      metaSearching = false;
      render();
      if (metaMatches.length === 0) {
        onToast('Tidak ditemukan kecocokan di iTunes/MusicBrainz. Coba judul yang lebih singkat.');
      } else {
        onToast(`Ditemukan ${metaMatches.length} data resmi iTunes & MusicBrainz.`);
      }
    } catch {
      metaSearching = false;
      render();
      onToast('Gagal mengakses API metadata resmi.');
    }
  }

  async function handleRenderAndExport(overrideFormat = null) {
    if (!sourceBuffer) {
      onToast('Muat file audio atau audio contoh terlebih dahulu.');
      return;
    }
    if (renderingExport) return;
    stopPlayback();
    revokeExportUrl();
    if (overrideFormat) editState.exportFormat = overrideFormat;

    renderingExport = true;
    exportProgress = 5;
    exportLabel = 'Memulai mesin DSP Audio Studio...';
    render();

    try {
      const rendered = await renderProcessedAudio(sourceBuffer, mixTracks, editState, (p) => {
        exportProgress = Math.round((p.percent || 0) * 0.55);
        exportLabel = p.label || exportLabel;
        updateProgressInline();
      });

      renderedPreviewBuffer = rendered.audioBuffer;
      renderedPreviewDirty = false;

      const exported = await exportRenderedAudio(rendered, editState, (p) => {
        exportProgress = 55 + Math.round((p.percent || 0) * 0.45);
        exportLabel = p.label || exportLabel;
        updateProgressInline();
      });

      const url = URL.createObjectURL(exported.blob);
      lastExportResult = {
        url,
        fileName: exported.fileName,
        size: exported.blob.size,
        format: exported.format,
        engineUsed: exported.engineUsed,
        duration: rendered.duration,
        stats: rendered.stats,
      };
      renderingExport = false;
      activeWorkbench = 'export';
      render();
      onToast(`Audio berhasil diekspor (${exported.fileName})!`);
    } catch (err) {
      renderingExport = false;
      render();
      onToast(err?.message || 'Gagal merender atau mengekspor audio.');
    }
  }

  function renderWorkbenchContent() {
    const dur = sourceBuffer ? sourceBuffer.duration : 0;
    const trim = clampTrimRange(editState.trimStart, editState.trimEnd, dur);

    if (activeWorkbench === 'trim') {
      return `
        <div class="ae-panel-grid">
          <div class="ae-control-group">
            <h4 class="ae-group-title">Pangkas Durasi (Trim) &amp; Fade</h4>
            <div class="ae-slider-row">
              <label for="ae-trim-start">Mulai Potong</label>
              <span class="ae-val-mono" id="ae-trim-start-val">${formatTimecode(trim.trimStart)}</span>
              <input id="ae-trim-start" type="range" min="0" max="${Math.max(0.1, dur).toFixed(2)}" step="0.05" value="${trim.trimStart}" ${!sourceBuffer ? 'disabled' : ''} />
            </div>
            <div class="ae-slider-row">
              <label for="ae-trim-end">Akhir Potong</label>
              <span class="ae-val-mono" id="ae-trim-end-val">${formatTimecode(trim.trimEnd)}</span>
              <input id="ae-trim-end" type="range" min="0" max="${Math.max(0.1, dur).toFixed(2)}" step="0.05" value="${trim.trimEnd}" ${!sourceBuffer ? 'disabled' : ''} />
            </div>
            <div class="ae-inline-metrics">
              <span>Durasi Terpilih: <strong class="ae-val-mono">${formatTimecode(trim.trimDuration)}</strong></span>
              <button type="button" class="btn btn-secondary btn-xs" id="ae-reset-trim-btn" ${!sourceBuffer ? 'disabled' : ''}>Reset Potongan</button>
            </div>
            <div class="ae-dual-sliders">
              <div class="ae-slider-row">
                <label for="ae-fade-in">Fade In</label>
                <span class="ae-val-mono" id="ae-fade-in-val">${editState.fadeIn.toFixed(1)}s</span>
                <input id="ae-fade-in" type="range" min="0" max="10" step="0.1" value="${editState.fadeIn}" />
              </div>
              <div class="ae-slider-row">
                <label for="ae-fade-out">Fade Out</label>
                <span class="ae-val-mono" id="ae-fade-out-val">${editState.fadeOut.toFixed(1)}s</span>
                <input id="ae-fade-out" type="range" min="0" max="10" step="0.1" value="${editState.fadeOut}" />
              </div>
            </div>
          </div>

          <div class="ae-control-group">
            <h4 class="ae-group-title">Penguat Volume, Panning &amp; Tempo</h4>
            <div class="ae-slider-row">
              <label for="ae-volume-pct">Volume / Penguat Suara</label>
              <span class="ae-val-mono" id="ae-volume-val">${editState.volumePct}% (${gainToDb(volumePctToGain(editState.volumePct)) >= 0 ? '+' : ''}${gainToDb(volumePctToGain(editState.volumePct))} dB)</span>
              <input id="ae-volume-pct" type="range" min="0" max="300" step="1" value="${editState.volumePct}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-pan-slider">Keseimbangan Stereo (Kiri / Kanan)</label>
              <span class="ae-val-mono" id="ae-pan-val">${editState.pan === 0 ? 'Tengah' : editState.pan < 0 ? `Kiri ${Math.round(Math.abs(editState.pan) * 100)}%` : `Kanan ${Math.round(editState.pan * 100)}%`}</span>
              <input id="ae-pan-slider" type="range" min="-1" max="1" step="0.05" value="${editState.pan}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-speed-slider">Kecepatan / Tempo</label>
              <span class="ae-val-mono" id="ae-speed-val">${editState.speed.toFixed(2)}×</span>
              <input id="ae-speed-slider" type="range" min="0.5" max="2" step="0.02" value="${editState.speed}" />
            </div>
            <div class="ae-toggle-row">
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-normalize-chk" ${editState.normalizeEnabled ? 'checked' : ''} />
                <span>Auto-Normalisasi Loudness (${editState.targetLufs} LUFS + Anti-Clip)</span>
              </label>
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-reverse-chk" ${editState.reverse ? 'checked' : ''} />
                <span>Putar Balik Audio (Reverse)</span>
              </label>
            </div>
          </div>
        </div>
      `;
    }

    if (activeWorkbench === 'eq') {
      return `
        <div class="ae-control-group">
          <div class="ae-group-head">
            <h4 class="ae-group-title">Equalizer Grafis 10-Band Studio</h4>
            <button type="button" class="btn btn-secondary btn-xs" id="ae-eq-reset-btn">Reset Flat (0 dB)</button>
          </div>
          <div class="ae-preset-bar" role="group" aria-label="Preset Equalizer">
            ${AUDIO_EQ_PRESETS.map(
              (p) => `
              <button type="button" class="ae-preset-btn ${editState.eqPreset === p.id ? 'is-active' : ''}" data-ae-eq-preset="${p.id}">
                ${escapeHtml(p.label)}
              </button>
            `
            ).join('')}
          </div>
          <div class="ae-eq-rack" aria-label="Pengaturan 10 frekuensi equalizer">
            ${AUDIO_EQ_BANDS.map((band, idx) => {
              const val = Number(editState.eqGains[idx] || 0);
              return `
                <div class="ae-eq-band">
                  <span class="ae-eq-db ae-val-mono" data-ae-eq-val="${idx}">${val > 0 ? '+' : ''}${val.toFixed(1)}</span>
                  <div class="ae-eq-slider-wrap">
                    <input
                      type="range"
                      class="ae-eq-slider"
                      data-ae-eq-band="${idx}"
                      min="-12"
                      max="12"
                      step="0.5"
                      value="${val}"
                      aria-label="Equalizer ${band.label}${band.unit} (${band.role})"
                    />
                  </div>
                  <span class="ae-eq-freq ae-val-mono">${band.label}</span>
                  <span class="ae-eq-role">${band.role}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (activeWorkbench === 'voice') {
      return `
        <div class="ae-panel-grid">
          <div class="ae-control-group">
            <h4 class="ae-group-title">Preset Pengubah Suara (Voice Changer)</h4>
            <div class="ae-choice-grid" role="group" aria-label="Preset pengubah suara">
              ${AUDIO_VOICE_PRESETS.map(
                (v) => `
                <button type="button" class="ae-choice-btn ${editState.voicePreset === v.id ? 'is-active' : ''}" data-ae-voice-preset="${v.id}">
                  <span>${escapeHtml(v.label)}</span>
                </button>
              `
              ).join('')}
            </div>
          </div>
          <div class="ae-control-group">
            <h4 class="ae-group-title">Pengaturan Nada, Gema &amp; Efek Ruang</h4>
            <div class="ae-slider-row">
              <label for="ae-pitch-slider">Pergeseran Nada (Pitch)</label>
              <span class="ae-val-mono" id="ae-pitch-val">${editState.pitchSemitones > 0 ? '+' : ''}${editState.pitchSemitones} st</span>
              <input id="ae-pitch-slider" type="range" min="-12" max="12" step="1" value="${editState.pitchSemitones}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-reverb-slider">Gema Ruangan (Reverb)</label>
              <span class="ae-val-mono" id="ae-reverb-val">${editState.reverbMix}%</span>
              <input id="ae-reverb-slider" type="range" min="0" max="100" step="1" value="${editState.reverbMix}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-echo-slider">Pantulan Suara (Echo / Delay)</label>
              <span class="ae-val-mono" id="ae-echo-val">${editState.echoMix}%</span>
              <input id="ae-echo-slider" type="range" min="0" max="100" step="1" value="${editState.echoMix}" />
            </div>
            <div class="ae-toggle-row">
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-robot-chk" ${editState.robotEffect ? 'checked' : ''} />
                <span>Modulasi Robotik (Ring Modulator)</span>
              </label>
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-radio-chk" ${editState.radioEffect ? 'checked' : ''} />
                <span>Filter Radio AM / Telepon Vintage</span>
              </label>
            </div>
          </div>
        </div>
      `;
    }

    if (activeWorkbench === 'clean') {
      const issuesText =
        sourceStats?.issues?.length > 0
          ? sourceStats.issues
              .map((k) =>
                k === 'clipping'
                  ? 'Clipping puncak terdeteksi'
                  : k === 'dc-offset'
                  ? 'DC Offset tidak seimbang'
                  : k === 'background-noise'
                  ? 'Noise latar cukup tinggi'
                  : k === 'low-volume'
                  ? 'Volume audio terlalu pelan'
                  : 'Rentang dinamika terlalu lebar'
              )
              .join(' · ')
          : sourceBuffer
          ? 'Sinyal utama sehat — siap dijernihkan sesuai selera'
          : 'Muat audio untuk melihat diagnosa sinyal otomatis';

      return `
        <div class="ae-panel-grid">
          <div class="ae-control-group">
            <h4 class="ae-group-title">Penstabil Noise &amp; Penjernih Audio</h4>
            <div class="ae-slider-row">
              <label for="ae-nr-slider">Penstabil &amp; Pengurang Noise</label>
              <span class="ae-val-mono" id="ae-nr-val">${editState.noiseReduction}%</span>
              <input id="ae-nr-slider" type="range" min="0" max="100" step="1" value="${editState.noiseReduction}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-gate-slider">Ambang Noise Gate (Senyapkan Latar)</label>
              <span class="ae-val-mono" id="ae-gate-val">${editState.noiseGateDb <= -69 ? 'Nonaktif' : `${editState.noiseGateDb} dB`}</span>
              <input id="ae-gate-slider" type="range" min="-70" max="-24" step="1" value="${editState.noiseGateDb}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-clarity-slider">Penjernih Audio &amp; Kejernihan Vokal</label>
              <span class="ae-val-mono" id="ae-clarity-val">${editState.clarityAmount}%</span>
              <input id="ae-clarity-slider" type="range" min="0" max="100" step="1" value="${editState.clarityAmount}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-deesser-slider">De-Esser (Haluskan Desis "S/Sh")</label>
              <span class="ae-val-mono" id="ae-deesser-val">${editState.deEsserAmount}%</span>
              <input id="ae-deesser-slider" type="range" min="0" max="100" step="1" value="${editState.deEsserAmount}" />
            </div>
          </div>

          <div class="ae-control-group">
            <h4 class="ae-group-title">Perbaikan Audio (Audio Repair)</h4>
            <p class="ae-diag-note">${escapeHtml(issuesText)}</p>
            <div class="ae-toggle-row ae-toggle-stack">
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-declip-chk" ${editState.repairDeclip ? 'checked' : ''} />
                <span>De-Clipper Otomatis (Pulihkan Puncak Suara Pecah)</span>
              </label>
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-dcoffset-chk" ${editState.repairDcOffset ? 'checked' : ''} />
                <span>Pembersih DC Offset (Hilangkan Letupan Klik Awal/Akhir)</span>
              </label>
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-hum-chk" ${editState.repairHumFilter ? 'checked' : ''} />
                <span>Filter Dengung Listrik (Notch 50Hz / 60Hz + Harmonik)</span>
              </label>
            </div>
            <div class="ae-inline-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="ae-hum-freq-btn">
                Frekuensi Dengung: ${editState.humFreqHz} Hz (Klik ganti)
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="ae-quick-repair-btn">
                Perbaikan Cepat 1-Klik
              </button>
            </div>
          </div>
        </div>
      `;
    }

    if (activeWorkbench === 'stem') {
      return `
        <div class="ae-control-group">
          <div class="ae-group-head">
            <h4 class="ae-group-title">Pemisah Musik &amp; Vokal (Mid-Side + Spectral DSP)</h4>
            <div class="ae-inline-actions">
              <button type="button" class="btn btn-secondary btn-xs" id="ae-quick-export-vocal" ${!sourceBuffer ? 'disabled' : ''}>Ekspor Vokal Saja</button>
              <button type="button" class="btn btn-secondary btn-xs" id="ae-quick-export-inst" ${!sourceBuffer ? 'disabled' : ''}>Ekspor Karaoke / Musik</button>
            </div>
          </div>
          <div class="ae-stem-list" role="radiogroup" aria-label="Mode pemisah vokal dan musik">
            ${AUDIO_STEM_MODES.map(
              (m) => `
              <button type="button" class="ae-stem-card ${editState.stemMode === m.id ? 'is-active' : ''}" data-ae-stem-mode="${m.id}">
                <strong>${escapeHtml(m.label)}</strong>
                <span>${escapeHtml(m.desc)}</span>
              </button>
            `
            ).join('')}
          </div>
          <div class="ae-slider-row" style="margin-top: 14px;">
            <label for="ae-stem-strength">Kekuatan Pemisahan Kanal</label>
            <span class="ae-val-mono" id="ae-stem-strength-val">${editState.stemStrength}%</span>
            <input id="ae-stem-strength" type="range" min="10" max="100" step="1" value="${editState.stemStrength}" ${editState.stemMode === 'original' ? 'disabled' : ''} />
          </div>
        </div>
      `;
    }

    if (activeWorkbench === 'mix') {
      return `
        <div class="ae-control-group">
          <div class="ae-group-head">
            <h4 class="ae-group-title">Mix &amp; Gabungkan Multi-Trek Audio</h4>
            <div class="ae-inline-actions">
              <label class="btn btn-primary btn-sm" for="ae-mix-file-input" style="cursor: pointer;">+ Tambah File Audio</label>
              <input id="ae-mix-file-input" type="file" accept="audio/*,video/*" hidden />
              <button type="button" class="btn btn-secondary btn-sm" id="ae-add-demo-track-btn">+ Backsound Demo</button>
            </div>
          </div>
          <div class="ae-mode-switch" role="group" aria-label="Mode penggabungan audio">
            <button type="button" class="ae-preset-btn ${editState.mixMode === 'overlay' ? 'is-active' : ''}" data-ae-mix-mode="overlay">
              Campur Bersamaan (Overlay / Backsound)
            </button>
            <button type="button" class="ae-preset-btn ${editState.mixMode === 'concat' ? 'is-active' : ''}" data-ae-mix-mode="concat">
              Sambung Berurutan (Gabung / Merge)
            </button>
          </div>
          ${
            mixTracks.length === 0
              ? `<p class="ae-empty-hint">Belum ada trek tambahan. Tambahkan musik latar (overlay) atau sambungkan beberapa klip audio secara berurutan.</p>`
              : `<div class="ae-mix-list">
                  ${mixTracks
                    .map(
                      (t, idx) => `
                    <div class="ae-mix-row">
                      <div class="ae-mix-info">
                        <strong>Trek ${idx + 2}: ${escapeHtml(t.name)}</strong>
                        <span class="ae-val-mono">Durasi ${formatTimecode(t.duration)}</span>
                      </div>
                      <div class="ae-mix-controls">
                        <label>
                          <span>Vol <b class="ae-val-mono">${t.volumePct}%</b></span>
                          <input type="range" min="0" max="200" step="5" value="${t.volumePct}" data-ae-mix-vol="${t.id}" />
                        </label>
                        ${
                          editState.mixMode === 'overlay'
                            ? `<label>
                                <span>Mulai <b class="ae-val-mono">${Number(t.offsetSec || 0).toFixed(1)}s</b></span>
                                <input type="range" min="0" max="${Math.max(10, Math.round(dur)).toFixed(0)}" step="0.5" value="${t.offsetSec || 0}" data-ae-mix-offset="${t.id}" />
                              </label>`
                            : ''
                        }
                        <button type="button" class="btn btn-secondary btn-xs" data-ae-mix-remove="${t.id}">Hapus</button>
                      </div>
                    </div>
                  `
                    )
                    .join('')}
                </div>`
          }
        </div>
      `;
    }

    if (activeWorkbench === 'meta') {
      const m = editState.metadata;
      return `
        <div class="ae-control-group">
          <div class="ae-group-head">
            <h4 class="ae-group-title">Penulis Ulang Identitas &amp; Metadata Audio (ID3v2.3 &amp; RIFF)</h4>
            <div class="ae-inline-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="ae-meta-lookup-btn" ${metaSearching ? 'disabled' : ''}>
                ${metaSearching ? 'Mencari di iTunes & MusicBrainz...' : 'Cari Resmi (iTunes + MusicBrainz)'}
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="ae-meta-ai-rewrite-btn" ${aiBusy ? 'disabled' : ''}>
                Tulis Ulang dengan AI
              </button>
            </div>
          </div>

          ${
            metaMatches.length > 0
              ? `<div class="ae-meta-matches">
                  <p class="ae-meta-matches-head">Klik salah satu hasil resmi untuk mengisi otomatis semua tag &amp; sampul:</p>
                  <div class="ae-meta-match-grid">
                    ${metaMatches
                      .map(
                        (item, idx) => `
                      <button type="button" class="ae-meta-match-btn" data-ae-apply-meta="${idx}">
                        ${item.artworkUrl ? `<img src="${escapeHtml(item.artworkUrl)}" alt="" width="40" height="40" referrerpolicy="no-referrer" />` : ''}
                        <div>
                          <strong>${escapeHtml(item.title)}</strong>
                          <span>${escapeHtml(item.artist)} · ${escapeHtml(item.album || item.genre)} (${escapeHtml(item.source)})</span>
                        </div>
                      </button>
                    `
                      )
                      .join('')}
                  </div>
                </div>`
              : ''
          }

          <div class="ae-meta-form-grid">
            <label class="ae-field">
              <span>Judul Audio / Lagu (TIT2)</span>
              <input type="text" id="ae-meta-title" value="${escapeHtml(m.title)}" placeholder="Contoh: Senja di Jakarta (Mastered)" />
            </label>
            <label class="ae-field">
              <span>Artis / Pembuat (TPE1)</span>
              <input type="text" id="ae-meta-artist" value="${escapeHtml(m.artist)}" placeholder="Nama artis atau kreator" />
            </label>
            <label class="ae-field">
              <span>Album / Koleksi (TALB)</span>
              <input type="text" id="ae-meta-album" value="${escapeHtml(m.album)}" placeholder="Nama album atau seri podcast" />
            </label>
            <label class="ae-field">
              <span>Genre (TCON)</span>
              <input type="text" id="ae-meta-genre" value="${escapeHtml(m.genre)}" placeholder="Pop, Podcast, Acoustic, Lo-Fi..." />
            </label>
            <label class="ae-field">
              <span>Tahun Rilis (TYER)</span>
              <input type="text" id="ae-meta-year" value="${escapeHtml(m.year)}" maxlength="4" placeholder="2026" />
            </label>
            <label class="ae-field">
              <span>Nomor Trek (TRCK)</span>
              <input type="text" id="ae-meta-track" value="${escapeHtml(m.track)}" maxlength="8" placeholder="1" />
            </label>
            <label class="ae-field ae-field-wide">
              <span>Komentar / Kredit Hak Cipta (COMM)</span>
              <input type="text" id="ae-meta-comment" value="${escapeHtml(m.comment)}" placeholder="Keterangan studio atau catatan hak cipta" />
            </label>
            <div class="ae-cover-row ae-field-wide">
              <div class="ae-cover-preview">
                ${
                  m.coverDataUrl
                    ? `<img src="${escapeHtml(m.coverDataUrl)}" alt="Sampul album" width="56" height="56" />`
                    : `<span>Sampul</span>`
                }
              </div>
              <div class="ae-cover-actions">
                <label class="btn btn-secondary btn-sm" for="ae-cover-input" style="cursor: pointer;">Pilih Gambar Sampul (APIC MP3)</label>
                <input id="ae-cover-input" type="file" accept="image/jpeg,image/png,image/webp" hidden />
                ${m.coverDataUrl ? `<button type="button" class="btn btn-secondary btn-xs" id="ae-cover-clear-btn">Hapus Sampul</button>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Default / 'export': Multi-AI Studio Engineer + Multi-Format Exporter
    return `
      <div class="ae-panel-grid">
        <div class="ae-control-group">
          <h4 class="ae-group-title">Asisten Mastering Multi-AI (ChatGPT, Claude, Gemini, DeepSeek, Grok)</h4>
          <label class="ae-field">
            <span>Pilih Mesin AI Penyempurna</span>
            <select id="ae-ai-engine-select">
              ${AUDIO_AI_ENGINES.map(
                (eng) => `<option value="${eng.id}" ${editState.aiEngine === eng.id ? 'selected' : ''}>${escapeHtml(eng.label)} — ${escapeHtml(eng.subtitle)}</option>`
              ).join('')}
            </select>
          </label>
          <label class="ae-field" style="margin-top: 10px;">
            <span>Target Penyempurnaan Audio</span>
            <select id="ae-ai-goal-select">
              ${AUDIO_AI_GOALS.map(
                (g) => `<option value="${g.id}" ${editState.aiGoal === g.id ? 'selected' : ''}>${escapeHtml(g.label)}</option>`
              ).join('')}
            </select>
          </label>
          <label class="ae-field" style="margin-top: 10px;">
            <span>Instruksi Tambahan ke AI (Opsional)</span>
            <input type="text" id="ae-ai-custom-prompt" value="${escapeHtml(editState.aiCustomPrompt)}" placeholder="Contoh: Buat vokal lebih hangat seperti radio malam & kurangi desis" />
          </label>
          <div class="ae-inline-actions" style="margin-top: 12px;">
            <button type="button" class="btn btn-primary btn-sm" id="ae-run-ai-btn" ${!sourceBuffer || aiBusy ? 'disabled' : ''}>
              ${aiBusy ? 'Menganalisis dengan Multi-AI...' : 'Analisis & Terapkan dengan AI'}
            </button>
          </div>
          <p class="ae-ai-status" id="ae-ai-status-text">
            ${
              aiResult
                ? `<strong>${escapeHtml(aiResult.provider)}:</strong> ${escapeHtml(aiResult.plan.summary)}`
                : 'AI menganalisis statistik Peak, RMS, Noise Floor, & Clipping lalu langsung menyetel EQ, Noise Stabilizer, Clarity, dan Repair.'
            }
          </p>
        </div>

        <div class="ae-control-group">
          <h4 class="ae-group-title">Ekspor &amp; Ubah Format Audio</h4>
          <div class="ae-format-grid" role="radiogroup" aria-label="Pilih format ekspor audio">
            ${AUDIO_EXPORT_FORMATS.map(
              (f) => `
              <button type="button" class="ae-format-btn ${editState.exportFormat === f.id ? 'is-active' : ''}" data-ae-export-fmt="${f.id}">
                <strong>${escapeHtml(f.label)}</strong>
                <span>${escapeHtml(f.desc)}</span>
              </button>
            `
            ).join('')}
          </div>
          <div class="ae-dual-sliders" style="margin-top: 12px;">
            <label class="ae-field">
              <span>Kualitas Bitrate</span>
              <select id="ae-bitrate-select" ${editState.exportFormat === 'wav' || editState.exportFormat === 'flac' ? 'disabled' : ''}>
                ${[128, 192, 256, 320]
                  .map((br) => `<option value="${br}" ${Number(editState.exportBitrate) === br ? 'selected' : ''}>${br} kbps ${br === 320 ? '(Studio Max)' : br === 192 ? '(Rekomendasi)' : ''}</option>`)
                  .join('')}
              </select>
            </label>
            <label class="ae-field">
              <span>Sample Rate</span>
              <select id="ae-samplerate-select">
                <option value="44100" ${Number(editState.exportSampleRate) === 44100 ? 'selected' : ''}>44.1 kHz (Standar Musik)</option>
                <option value="48000" ${Number(editState.exportSampleRate) === 48000 ? 'selected' : ''}>48.0 kHz (Standar Video/Podcast)</option>
              </select>
            </label>
          </div>
          <button type="button" class="btn btn-primary ae-export-cta" id="ae-export-btn" ${!sourceBuffer || renderingExport ? 'disabled' : ''}>
            ${renderingExport ? 'Merender & Mengekspor Audio...' : `Render & Ekspor Audio (.${editState.exportFormat.toUpperCase()})`}
          </button>

          ${
            lastExportResult
              ? `<div class="ae-export-result" id="ae-export-result-box">
                  <div class="ae-export-result-meta">
                    <strong>${escapeHtml(lastExportResult.fileName)}</strong>
                    <span class="ae-val-mono">${escapeHtml(lastExportResult.format)} · ${formatBytes(lastExportResult.size)} · ${formatTimecode(lastExportResult.duration)} · ${escapeHtml(lastExportResult.engineUsed)}</span>
                  </div>
                  <audio controls src="${escapeHtml(lastExportResult.url)}" class="ae-result-audio"></audio>
                  <div class="ae-inline-actions">
                    <a href="${escapeHtml(lastExportResult.url)}" download="${escapeHtml(lastExportResult.fileName)}" class="btn btn-primary btn-sm" id="ae-download-exported-link">
                      Unduh Hasil (${escapeHtml(lastExportResult.format)})
                    </a>
                  </div>
                </div>`
              : ''
          }
        </div>
      </div>
    `;
  }

  function render() {
    if (!hostEl || !mounted) return;
    const dur = sourceBuffer ? sourceBuffer.duration : 0;

    hostEl.innerHTML = `
      <div class="ae-studio">
        <div class="ae-topbar">
          <div class="ae-source-actions">
            <label class="btn btn-primary btn-sm" for="ae-file-input" style="cursor: pointer;">
              Pilih Audio / Video
            </label>
            <input id="ae-file-input" type="file" accept="audio/*,video/*" hidden />
            <button type="button" class="btn btn-secondary btn-sm ${isRecording ? 'ae-rec-active' : ''}" id="ae-mic-btn">
              ${isRecording ? `Stop Rekam (<span id="ae-rec-elapsed" class="ae-val-mono">00:00.0</span>)` : 'Rekam Mikrofon'}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="ae-demo-btn">
              Muat Audio Contoh
            </button>
          </div>
          ${
            sourceBuffer
              ? `<div class="ae-file-summary">
                  <strong>${escapeHtml(editState.metadata.title || fileName)}</strong>
                  <span class="ae-val-mono">${escapeHtml(sourceFormat)} · ${formatBytes(fileSize)} · ${formatTimecode(dur)} · ${(sourceBuffer.sampleRate / 1000).toFixed(1)} kHz</span>
                </div>`
              : `<div class="ae-file-summary">
                  <span>Mendukung MP3, WAV, M4A, AAC, OGG, FLAC, WebM &amp; ekstraksi audio dari Video MP4</span>
                </div>`
          }
        </div>

        ${
          loadingFile || renderingExport
            ? `<div class="ae-progress-bar-box" role="status" aria-live="polite">
                <div class="ae-progress-head">
                  <span id="ae-progress-label">${escapeHtml(renderingExport ? exportLabel : loadingLabel)}</span>
                  <strong id="ae-progress-pct" class="ae-val-mono">${Math.round(renderingExport ? exportProgress : loadingProgress)}%</strong>
                </div>
                <div class="ae-progress-track">
                  <div id="ae-progress-fill" class="ae-progress-fill" style="width: ${clampNum(renderingExport ? exportProgress : loadingProgress, 0, 100, 0)}%"></div>
                </div>
              </div>`
            : ''
        }

        <div class="ae-stage" id="ae-dropzone">
          <canvas id="ae-waveform-canvas" class="ae-waveform-canvas" aria-label="Tampilan gelombang audio interaktif"></canvas>

          <div class="ae-transport-bar">
            <div class="ae-transport-left">
              <button type="button" class="btn btn-primary btn-sm" id="ae-play-btn" ${!sourceBuffer ? 'disabled' : ''} aria-pressed="${isPlaying}">
                ${
                  isPlaying
                    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg><span>Jeda</span>`
                    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><span>Putar</span>`
                }
              </button>
              <button type="button" class="btn btn-secondary btn-sm" id="ae-stop-btn" ${!sourceBuffer ? 'disabled' : ''}>Stop</button>
              <button type="button" class="btn btn-secondary btn-sm ${loopSelection ? 'is-active' : ''}" id="ae-loop-btn" ${!sourceBuffer ? 'disabled' : ''} aria-pressed="${loopSelection}">Ulangi</button>
              <button type="button" class="btn btn-secondary btn-sm ${compareOriginal ? 'is-active' : ''}" id="ae-ab-btn" ${!sourceBuffer ? 'disabled' : ''} aria-pressed="${compareOriginal}">
                ${compareOriginal ? 'Mode: Asli' : 'Mode: Hasil Edit'}
              </button>
            </div>
            <div class="ae-transport-right">
              <span class="ae-timecode ae-val-mono">
                <strong id="ae-timecode-now">${formatTimecode(currentTimeSec)}</strong> / ${formatTimecode(dur)}
              </span>
              <button type="button" class="btn btn-secondary btn-xs" id="ae-reset-all-btn" ${!sourceBuffer ? 'disabled' : ''}>Reset Semua Efek</button>
            </div>
          </div>

          ${
            sourceStats
              ? `<div class="ae-telemetry-strip ae-val-mono" aria-label="Statistik akustik audio">
                  <span>Peak: <strong>${sourceStats.peakDb} dBFS</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>RMS: <strong>${sourceStats.rmsDb} dBFS</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Est. LUFS: <strong>${sourceStats.estimatedLufs}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Noise Floor: <strong>${sourceStats.noiseFloorDb} dB</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Clipped: <strong>${sourceStats.clippedSamples}</strong></span>
                </div>`
              : ''
          }
        </div>

        <div class="ae-workbench-tabs" role="tablist" aria-label="Menu alat Audio Editor">
          ${WORKBENCH_TABS.map(
            (t) => `
            <button
              type="button"
              role="tab"
              class="ae-wb-tab ${activeWorkbench === t.id ? 'is-active' : ''}"
              data-ae-wb-tab="${t.id}"
              aria-selected="${activeWorkbench === t.id}"
            >
              ${escapeHtml(t.label)}
            </button>
          `
          ).join('')}
        </div>

        <div class="ae-workbench-body" role="tabpanel">
          ${renderWorkbenchContent()}
        </div>
      </div>
    `;

    bindEvents();
    drawWaveformCanvas();
  }

  function bindEvents() {
    if (!hostEl) return;

    // File upload & drag/drop
    hostEl.querySelector('#ae-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
    });

    const dropzone = hostEl.querySelector('#ae-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) handleFileUpload(file);
      });
    }

    hostEl.querySelector('#ae-demo-btn')?.addEventListener('click', () => {
      const demo = createDemoStudioAudio();
      applyLoadedProject(demo);
      onToast('Audio Contoh Studio (8 detik stereo) dimuat — silakan coba semua efek!');
    });

    hostEl.querySelector('#ae-mic-btn')?.addEventListener('click', () => {
      toggleMicRecording();
    });

    // Waveform click-to-seek
    hostEl.querySelector('#ae-waveform-canvas')?.addEventListener('click', (e) => {
      if (!sourceBuffer) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = clampNum((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1, 0);
      currentTimeSec = ratio * sourceBuffer.duration;
      updateTransportDom();
      drawWaveformCanvas();
      if (isPlaying) {
        startPlayback(currentTimeSec);
      }
    });

    // Transport buttons
    hostEl.querySelector('#ae-play-btn')?.addEventListener('click', () => {
      if (isPlaying) {
        stopPlayback();
      } else {
        startPlayback(currentTimeSec);
      }
    });

    hostEl.querySelector('#ae-stop-btn')?.addEventListener('click', () => {
      stopPlayback();
      const trim = clampTrimRange(editState.trimStart, editState.trimEnd, sourceBuffer?.duration || 0);
      currentTimeSec = trim.trimStart;
      updateTransportDom();
      drawWaveformCanvas();
    });

    hostEl.querySelector('#ae-loop-btn')?.addEventListener('click', () => {
      loopSelection = !loopSelection;
      render();
    });

    hostEl.querySelector('#ae-ab-btn')?.addEventListener('click', () => {
      compareOriginal = !compareOriginal;
      const wasPlaying = isPlaying;
      stopPlayback();
      render();
      if (wasPlaying) startPlayback(currentTimeSec);
    });

    hostEl.querySelector('#ae-reset-all-btn')?.addEventListener('click', () => {
      if (!sourceBuffer) return;
      const prevMeta = { ...editState.metadata };
      editState = createDefaultAudioEditorState();
      editState.trimStart = 0;
      editState.trimEnd = Number(sourceBuffer.duration.toFixed(3));
      editState.metadata = prevMeta;
      aiResult = null;
      markDirty();
      render();
      onToast('Semua efek & equalizer direset ke posisi awal.');
    });

    // Workbench tabs
    hostEl.querySelectorAll('[data-ae-wb-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-ae-wb-tab');
        if (next && next !== activeWorkbench) {
          activeWorkbench = next;
          render();
        }
      });
    });

    // --- Tab: Trim & Volume ---
    const bindRange = (id, onVal) => {
      const el = hostEl.querySelector(id);
      if (!el) return;
      el.addEventListener('input', () => {
        onVal(Number(el.value));
        markDirty();
      });
    };

    bindRange('#ae-trim-start', (v) => {
      const clamped = clampTrimRange(v, editState.trimEnd, sourceBuffer?.duration || 0);
      editState.trimStart = clamped.trimStart;
      editState.trimEnd = clamped.trimEnd;
      const lbl = hostEl.querySelector('#ae-trim-start-val');
      if (lbl) lbl.textContent = formatTimecode(editState.trimStart);
      drawWaveformCanvas();
    });
    bindRange('#ae-trim-end', (v) => {
      const clamped = clampTrimRange(editState.trimStart, v, sourceBuffer?.duration || 0);
      editState.trimStart = clamped.trimStart;
      editState.trimEnd = clamped.trimEnd;
      const lbl = hostEl.querySelector('#ae-trim-end-val');
      if (lbl) lbl.textContent = formatTimecode(editState.trimEnd);
      drawWaveformCanvas();
    });
    hostEl.querySelector('#ae-reset-trim-btn')?.addEventListener('click', () => {
      if (!sourceBuffer) return;
      editState.trimStart = 0;
      editState.trimEnd = Number(sourceBuffer.duration.toFixed(3));
      markDirty();
      render();
    });
    bindRange('#ae-fade-in', (v) => {
      editState.fadeIn = v;
      const lbl = hostEl.querySelector('#ae-fade-in-val');
      if (lbl) lbl.textContent = `${v.toFixed(1)}s`;
    });
    bindRange('#ae-fade-out', (v) => {
      editState.fadeOut = v;
      const lbl = hostEl.querySelector('#ae-fade-out-val');
      if (lbl) lbl.textContent = `${v.toFixed(1)}s`;
    });
    bindRange('#ae-volume-pct', (v) => {
      editState.volumePct = Math.round(v);
      const db = gainToDb(volumePctToGain(editState.volumePct));
      const lbl = hostEl.querySelector('#ae-volume-val');
      if (lbl) lbl.textContent = `${editState.volumePct}% (${db >= 0 ? '+' : ''}${db} dB)`;
    });
    bindRange('#ae-pan-slider', (v) => {
      editState.pan = v;
      const lbl = hostEl.querySelector('#ae-pan-val');
      if (lbl) {
        lbl.textContent =
          v === 0 ? 'Tengah' : v < 0 ? `Kiri ${Math.round(Math.abs(v) * 100)}%` : `Kanan ${Math.round(v * 100)}%`;
      }
    });
    bindRange('#ae-speed-slider', (v) => {
      editState.speed = v;
      const lbl = hostEl.querySelector('#ae-speed-val');
      if (lbl) lbl.textContent = `${v.toFixed(2)}×`;
    });
    hostEl.querySelector('#ae-normalize-chk')?.addEventListener('change', (e) => {
      editState.normalizeEnabled = e.target.checked;
      markDirty();
    });
    hostEl.querySelector('#ae-reverse-chk')?.addEventListener('change', (e) => {
      editState.reverse = e.target.checked;
      markDirty();
    });

    // --- Tab: EQ ---
    hostEl.querySelector('#ae-eq-reset-btn')?.addEventListener('click', () => {
      editState.eqPreset = 'flat';
      editState.eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      markDirty();
      render();
    });
    hostEl.querySelectorAll('[data-ae-eq-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ae-eq-preset');
        const preset = AUDIO_EQ_PRESETS.find((p) => p.id === id);
        if (!preset) return;
        editState.eqPreset = preset.id;
        editState.eqGains = [...preset.gains];
        markDirty();
        render();
      });
    });
    hostEl.querySelectorAll('[data-ae-eq-band]').forEach((input) => {
      input.addEventListener('input', () => {
        const idx = Number(input.getAttribute('data-ae-eq-band'));
        const val = Number(input.value);
        editState.eqGains[idx] = val;
        editState.eqPreset = 'custom';
        const lbl = hostEl.querySelector(`[data-ae-eq-val="${idx}"]`);
        if (lbl) lbl.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}`;
        markDirty();
      });
    });

    // --- Tab: Voice ---
    hostEl.querySelectorAll('[data-ae-voice-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ae-voice-preset');
        const v = AUDIO_VOICE_PRESETS.find((p) => p.id === id);
        if (!v) return;
        editState.voicePreset = v.id;
        editState.pitchSemitones = v.pitch;
        editState.speed = v.speed;
        editState.robotEffect = v.robot;
        editState.radioEffect = v.radio;
        editState.reverbMix = v.reverb;
        editState.echoMix = v.echo;
        markDirty();
        render();
        onToast(`Preset suara "${v.label}" aktif.`);
      });
    });
    bindRange('#ae-pitch-slider', (v) => {
      editState.pitchSemitones = Math.round(v);
      editState.voicePreset = 'custom';
      const lbl = hostEl.querySelector('#ae-pitch-val');
      if (lbl) lbl.textContent = `${editState.pitchSemitones > 0 ? '+' : ''}${editState.pitchSemitones} st`;
    });
    bindRange('#ae-reverb-slider', (v) => {
      editState.reverbMix = Math.round(v);
      const lbl = hostEl.querySelector('#ae-reverb-val');
      if (lbl) lbl.textContent = `${editState.reverbMix}%`;
    });
    bindRange('#ae-echo-slider', (v) => {
      editState.echoMix = Math.round(v);
      const lbl = hostEl.querySelector('#ae-echo-val');
      if (lbl) lbl.textContent = `${editState.echoMix}%`;
    });
    hostEl.querySelector('#ae-robot-chk')?.addEventListener('change', (e) => {
      editState.robotEffect = e.target.checked;
      markDirty();
    });
    hostEl.querySelector('#ae-radio-chk')?.addEventListener('change', (e) => {
      editState.radioEffect = e.target.checked;
      markDirty();
    });

    // --- Tab: Clean, Noise & Repair ---
    bindRange('#ae-nr-slider', (v) => {
      editState.noiseReduction = Math.round(v);
      const lbl = hostEl.querySelector('#ae-nr-val');
      if (lbl) lbl.textContent = `${editState.noiseReduction}%`;
    });
    bindRange('#ae-gate-slider', (v) => {
      editState.noiseGateDb = Math.round(v);
      const lbl = hostEl.querySelector('#ae-gate-val');
      if (lbl) lbl.textContent = editState.noiseGateDb <= -69 ? 'Nonaktif' : `${editState.noiseGateDb} dB`;
    });
    bindRange('#ae-clarity-slider', (v) => {
      editState.clarityAmount = Math.round(v);
      const lbl = hostEl.querySelector('#ae-clarity-val');
      if (lbl) lbl.textContent = `${editState.clarityAmount}%`;
    });
    bindRange('#ae-deesser-slider', (v) => {
      editState.deEsserAmount = Math.round(v);
      const lbl = hostEl.querySelector('#ae-deesser-val');
      if (lbl) lbl.textContent = `${editState.deEsserAmount}%`;
    });
    hostEl.querySelector('#ae-declip-chk')?.addEventListener('change', (e) => {
      editState.repairDeclip = e.target.checked;
      markDirty();
    });
    hostEl.querySelector('#ae-dcoffset-chk')?.addEventListener('change', (e) => {
      editState.repairDcOffset = e.target.checked;
      markDirty();
    });
    hostEl.querySelector('#ae-hum-chk')?.addEventListener('change', (e) => {
      editState.repairHumFilter = e.target.checked;
      markDirty();
    });
    hostEl.querySelector('#ae-hum-freq-btn')?.addEventListener('click', () => {
      editState.humFreqHz = editState.humFreqHz === 50 ? 60 : 50;
      markDirty();
      render();
    });
    hostEl.querySelector('#ae-quick-repair-btn')?.addEventListener('click', () => {
      editState.noiseReduction = 58;
      editState.noiseGateDb = -48;
      editState.clarityAmount = 45;
      editState.deEsserAmount = 30;
      editState.repairDeclip = true;
      editState.repairDcOffset = true;
      editState.repairHumFilter = true;
      editState.normalizeEnabled = true;
      markDirty();
      render();
      onToast('Perbaikan cepat & penjernihan audio diaktifkan!');
    });

    // --- Tab: Stem Separation ---
    hostEl.querySelectorAll('[data-ae-stem-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-ae-stem-mode');
        if (!mode) return;
        editState.stemMode = mode;
        markDirty();
        render();
      });
    });
    bindRange('#ae-stem-strength', (v) => {
      editState.stemStrength = Math.round(v);
      const lbl = hostEl.querySelector('#ae-stem-strength-val');
      if (lbl) lbl.textContent = `${editState.stemStrength}%`;
    });
    hostEl.querySelector('#ae-quick-export-vocal')?.addEventListener('click', () => {
      editState.stemMode = 'vocal-isolate';
      editState.stemStrength = Math.max(80, editState.stemStrength);
      markDirty();
      handleRenderAndExport(editState.exportFormat);
    });
    hostEl.querySelector('#ae-quick-export-inst')?.addEventListener('click', () => {
      editState.stemMode = 'instrumental';
      editState.stemStrength = Math.max(85, editState.stemStrength);
      markDirty();
      handleRenderAndExport(editState.exportFormat);
    });

    // --- Tab: Mix & Join ---
    hostEl.querySelector('#ae-mix-file-input')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) handleAddMixTrack(f);
    });
    hostEl.querySelector('#ae-add-demo-track-btn')?.addEventListener('click', () => {
      handleAddDemoMixTrack();
    });
    hostEl.querySelectorAll('[data-ae-mix-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editState.mixMode = btn.getAttribute('data-ae-mix-mode') || 'overlay';
        markDirty();
        render();
      });
    });
    hostEl.querySelectorAll('[data-ae-mix-vol]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const id = inp.getAttribute('data-ae-mix-vol');
        const trk = mixTracks.find((t) => t.id === id);
        if (trk) {
          trk.volumePct = Math.round(Number(inp.value));
          const b = inp.parentElement?.querySelector('b');
          if (b) b.textContent = `${trk.volumePct}%`;
          markDirty();
        }
      });
    });
    hostEl.querySelectorAll('[data-ae-mix-offset]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const id = inp.getAttribute('data-ae-mix-offset');
        const trk = mixTracks.find((t) => t.id === id);
        if (trk) {
          trk.offsetSec = Number(inp.value);
          const b = inp.parentElement?.querySelector('b');
          if (b) b.textContent = `${trk.offsetSec.toFixed(1)}s`;
          markDirty();
        }
      });
    });
    hostEl.querySelectorAll('[data-ae-mix-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-ae-mix-remove');
        mixTracks = mixTracks.filter((t) => t.id !== id);
        markDirty();
        render();
      });
    });

    // --- Tab: Metadata & Identity ---
    const bindMetaField = (id, key) => {
      hostEl.querySelector(id)?.addEventListener('input', (e) => {
        editState.metadata[key] = e.target.value;
      });
    };
    bindMetaField('#ae-meta-title', 'title');
    bindMetaField('#ae-meta-artist', 'artist');
    bindMetaField('#ae-meta-album', 'album');
    bindMetaField('#ae-meta-genre', 'genre');
    bindMetaField('#ae-meta-year', 'year');
    bindMetaField('#ae-meta-track', 'track');
    bindMetaField('#ae-meta-comment', 'comment');

    hostEl.querySelector('#ae-cover-input')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        editState.metadata.coverDataUrl = String(reader.result || '');
        render();
        onToast('Gambar sampul album siap disematkan ke MP3.');
      };
      reader.readAsDataURL(f);
    });
    hostEl.querySelector('#ae-cover-clear-btn')?.addEventListener('click', () => {
      editState.metadata.coverDataUrl = '';
      render();
    });
    hostEl.querySelector('#ae-meta-lookup-btn')?.addEventListener('click', () => {
      handleMetadataLookup();
    });
    hostEl.querySelector('#ae-meta-ai-rewrite-btn')?.addEventListener('click', () => {
      editState.aiGoal = 'metadata-polish';
      handleRunAiEngineer();
    });
    hostEl.querySelectorAll('[data-ae-apply-meta]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-ae-apply-meta'));
        const item = metaMatches[idx];
        if (!item) return;
        editState.metadata.title = item.title || editState.metadata.title;
        editState.metadata.artist = item.artist || editState.metadata.artist;
        editState.metadata.album = item.album || editState.metadata.album;
        editState.metadata.year = item.year || editState.metadata.year;
        editState.metadata.genre = item.genre || editState.metadata.genre;
        editState.metadata.track = item.track || editState.metadata.track;
        if (item.artworkUrl) {
          const dataUrl = await fetchCoverUrlAsDataUrl(item.artworkUrl);
          if (dataUrl) editState.metadata.coverDataUrl = dataUrl;
        }
        render();
        onToast(`Identitas "${item.title}" diterapkan dari ${item.source}.`);
      });
    });

    // --- Tab: AI & Export ---
    hostEl.querySelector('#ae-ai-engine-select')?.addEventListener('change', (e) => {
      editState.aiEngine = e.target.value;
    });
    hostEl.querySelector('#ae-ai-goal-select')?.addEventListener('change', (e) => {
      editState.aiGoal = e.target.value;
    });
    hostEl.querySelector('#ae-ai-custom-prompt')?.addEventListener('input', (e) => {
      editState.aiCustomPrompt = e.target.value;
    });
    hostEl.querySelector('#ae-run-ai-btn')?.addEventListener('click', () => {
      handleRunAiEngineer();
    });
    hostEl.querySelectorAll('[data-ae-export-fmt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editState.exportFormat = btn.getAttribute('data-ae-export-fmt') || 'mp3';
        render();
      });
    });
    hostEl.querySelector('#ae-bitrate-select')?.addEventListener('change', (e) => {
      editState.exportBitrate = Number(e.target.value) || 192;
    });
    hostEl.querySelector('#ae-samplerate-select')?.addEventListener('change', (e) => {
      editState.exportSampleRate = Number(e.target.value) || 44100;
    });
    hostEl.querySelector('#ae-export-btn')?.addEventListener('click', () => {
      handleRenderAndExport();
    });
  }

  return {
    mount(el) {
      hostEl = el;
      mounted = true;
      if (typeof MutationObserver !== 'undefined' && !themeObserver) {
        themeObserver = new MutationObserver(() => {
          if (mounted) drawWaveformCanvas();
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        });
      }
      if (!resizeHandler) {
        resizeHandler = () => {
          if (mounted) drawWaveformCanvas();
        };
        window.addEventListener('resize', resizeHandler);
      }
      render();
    },
    unmount() {
      mounted = false;
      stopPlayback();
      stopMicRecording(true);
      revokeExportUrl();
      if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
      }
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
      }
      if (hostEl) hostEl.innerHTML = '';
      hostEl = null;
    },
    redrawTheme() {
      drawWaveformCanvas();
    },
  };
}
