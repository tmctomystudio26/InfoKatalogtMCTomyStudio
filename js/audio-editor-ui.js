/**
 * Manifestudio Audio Editor Studio UI Controller (v59)
 * Tactile DAW-Style Audio Editor inspired by modern mobile/desktop audio studios:
 * - Top App Header with active tool title, quick source loader, Undo/Redo stack, & gradient SIMPAN/EKSPOR CTA
 * - Precision Timecode Steppers (- 00:00.0 + | Total | - 00:08.0 +)
 * - High-DPI Interactive Waveform Canvas with Time Ruler, Pointer-Draggable Trim Handles (< / >),
 *   Draggable Orange Playhead, Pangkas vs Potong Tengah (Cut Middle) mode, & Zoom In/Out (1x–8x)
 * - Circular Transport Controls (Jump Start, Play/Pause, Jump End) + Loop + A/B Compare + Telemetry
 * - Equalizer View with Now-Playing Card, Connected SVG Curve 10-Band Rack, & Interactive Rotary
 *   "Peningkat Bass" + "Virtualizer" Circular Dials
 * - Horizontally-Scrollable Bottom Icon Dock Bar (11 icon tools with active-effect indicators)
 * - "Simpan sebagai" Export Modal (Filename, Standard/Pro Format Picker, Bitrate Quality Cards,
 *   Live Estimated File Size, Progress Bar, Audio Preview & Direct Download)
 */

import {
  AUDIO_AI_ENGINES,
  AUDIO_AI_GOALS,
  AUDIO_EQ_BANDS,
  AUDIO_EQ_PRESETS,
  AUDIO_EXPORT_FORMATS,
  AUDIO_EXPORT_QUALITIES,
  AUDIO_STEM_MODES,
  AUDIO_VOICE_PRESETS,
  clampNum,
  clampTrimRange,
  computeTrimmedDuration,
  createDefaultAudioEditorState,
  createEditorHistory,
  estimateExportFileSizeRange,
  extractWaveformPeaks,
  formatTimecode,
  gainToDb,
  pushEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
  volumePctToGain,
} from './audio-editor-logic.js?v=59';
import {
  consultMultiAiAudioEngineer,
  createDemoStudioAudio,
  decodeAnyAudioFile,
  exportRenderedAudio,
  fetchCoverUrlAsDataUrl,
  getAudioContext,
  lookupOfficialAudioMetadata,
  renderProcessedAudio,
} from './audio-editor-engine.js?v=59';
import { formatBytes } from './tools-logic.js?v=59';

const DOCK_TOOLS = [
  {
    id: 'trim',
    label: 'Pangkas',
    title: 'Pangkas & Potong',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>`,
  },
  {
    id: 'volume',
    label: 'Volume',
    title: 'Volume & Tempo',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  },
  {
    id: 'fadein',
    label: 'Fade in',
    title: 'Fade In & Fade Out',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M8 12h7"/><path d="m12 9 3 3-3 3"/></svg>`,
  },
  {
    id: 'fadeout',
    label: 'Fade out',
    title: 'Fade Out & Transisi',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M16 12H9"/><path d="m12 9-3 3 3 3"/></svg>`,
  },
  {
    id: 'eq',
    label: 'Equalizer',
    title: 'Equalizer',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><circle cx="4" cy="12" r="2"/><circle cx="12" cy="10" r="2"/><circle cx="20" cy="14" r="2"/></svg>`,
  },
  {
    id: 'voice',
    label: 'Ubah Suara',
    title: 'Pengubah Suara & FX',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
  },
  {
    id: 'clean',
    label: 'Jernih & Noise',
    title: 'Penstabil Noise & Repair',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>`,
  },
  {
    id: 'stem',
    label: 'Pisah Vokal',
    title: 'Pemisah Musik & Vokal',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  },
  {
    id: 'mix',
    label: 'Mix & Gabung',
    title: 'Mixer Multi-Trek',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  },
  {
    id: 'meta',
    label: 'Identitas',
    title: 'Edit Identitas & Tag',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>`,
  },
  {
    id: 'ai',
    label: 'AI Studio',
    title: 'Asisten Mastering Multi-AI',
    icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
  },
];

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildRotaryKnobSvg(pct, labelId) {
  const safe = clampNum(pct, 0, 100, 0);
  // Arc spans 270 degrees: from 135deg (bottom-left) clockwise to 405deg (bottom-right)
  const r = 44;
  const cx = 56;
  const cy = 56;
  const startDeg = 135;
  const sweepDeg = 270;
  const endDeg = startDeg + (safe / 100) * sweepDeg;
  const toRad = (d) => (d * Math.PI) / 180;
  const pt = (deg) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  });
  const bgStart = pt(startDeg);
  const bgEnd = pt(startDeg + sweepDeg);
  const fgEnd = pt(endDeg);
  const largeBg = 1;
  const largeFg = (safe / 100) * sweepDeg > 180 ? 1 : 0;

  return `
    <svg class="ae-knob-svg" viewBox="0 0 112 112" width="112" height="112" aria-hidden="true">
      <defs>
        <linearGradient id="aeKnobGrad_${labelId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#6366f1" />
        </linearGradient>
      </defs>
      <path
        d="M ${bgStart.x.toFixed(1)} ${bgStart.y.toFixed(1)} A ${r} ${r} 0 ${largeBg} 1 ${bgEnd.x.toFixed(1)} ${bgEnd.y.toFixed(1)}"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.16"
        stroke-width="7"
        stroke-linecap="round"
      />
      ${
        safe > 0
          ? `<path
              d="M ${bgStart.x.toFixed(1)} ${bgStart.y.toFixed(1)} A ${r} ${r} 0 ${largeFg} 1 ${fgEnd.x.toFixed(1)} ${fgEnd.y.toFixed(1)}"
              fill="none"
              stroke="url(#aeKnobGrad_${labelId})"
              stroke-width="7"
              stroke-linecap="round"
            />`
          : ''
      }
      <circle cx="${fgEnd.x.toFixed(1)}" cy="${fgEnd.y.toFixed(1)}" r="6" fill="#ffffff" stroke="#38bdf8" stroke-width="2.5" />
    </svg>
  `;
}

function buildEqCurveSvg(eqGains = []) {
  const vals = Array.isArray(eqGains) && eqGains.length === 10 ? eqGains : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const points = vals.map((g, i) => {
    const x = 5 + i * 10; // centers of 10 equal columns in 0..100 viewBox
    const norm = (12 - clampNum(g, -12, 12, 0)) / 24; // 0 = +12dB top, 1 = -12dB bottom
    const y = 8 + norm * 84;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `
    <svg class="ae-eq-curve-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polyline points="${points.join(' ')}" fill="none" stroke="#38bdf8" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
    </svg>
  `;
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
  let mixTracks = [];
  let editState = createDefaultAudioEditorState();
  let history = createEditorHistory(editState, 30);
  let activeTool = 'trim';

  // Waveform zoom & drag state
  let zoomLevel = 1; // 1, 2, 4, 8
  let viewStartSec = 0;
  let dragTarget = null; // 'start' | 'end' | 'playhead' | null

  // Save/Export modal state (matches Screenshots 1 & 2)
  let saveModalOpen = false;
  let formatPickerOpen = false;

  // Playback & live Web Audio graph state
  let isPlaying = false;
  let compareOriginal = false;
  let loopSelection = false;
  let playSourceNode = null;
  let liveEqNodes = [];
  let liveBassNode = null;
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
  let lastExportResult = null;
  let aiBusy = false;
  let aiResult = null;
  let metaSearching = false;
  let metaMatches = [];

  function snapshotHistory() {
    history = pushEditorHistory(history, editState);
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    if (!hostEl) return;
    const uBtn = hostEl.querySelector('#ae-undo-btn');
    const rBtn = hostEl.querySelector('#ae-redo-btn');
    if (uBtn) uBtn.disabled = history.index <= 0;
    if (rBtn) rBtn.disabled = history.index >= history.stack.length - 1;
  }

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
    liveBassNode = null;
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
      if (cancelOnly) mediaRecorder.onstop = null;
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
    if (isPlaying && !compareOriginal) {
      if (liveGainNode) liveGainNode.gain.value = volumePctToGain(editState.volumePct);
      if (livePanNode) livePanNode.pan.value = clampNum(editState.pan, -1, 1, 0);
      if (liveBassNode) liveBassNode.gain.value = (clampNum(editState.bassBoostPct, 0, 100, 0) / 100) * 10.5;
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
      editState.trimMode === 'cut-middle' ||
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
      editState.virtualizerPct > 0 ||
      editState.normalizeEnabled ||
      editState.fadeIn > 0 ||
      editState.fadeOut > 0 ||
      mixTracks.length > 0
    );
  }

  async function startPlayback(fromSec = null) {
    if (!sourceBuffer) {
      onToast('Muat file audio atau klik "Audio Contoh" terlebih dahulu.');
      return;
    }
    stopPlayback();
    const ctx = getAudioContext();
    if (!ctx) return;

    const { trimStart, trimEnd } = clampTrimRange(editState.trimStart, editState.trimEnd, sourceBuffer.duration);
    let bufferToPlay = sourceBuffer;
    let useLiveChain = !compareOriginal;
    let startPos = fromSec !== null ? clampNum(fromSec, 0, sourceBuffer.duration - 0.02, trimStart) : currentTimeSec;
    if (editState.trimMode !== 'cut-middle' && (startPos < trimStart || startPos >= trimEnd - 0.05)) {
      startPos = trimStart;
    }

    if (!compareOriginal && needsOfflinePreviewDsp()) {
      try {
        if (renderedPreviewDirty || !renderedPreviewBuffer) {
          const rendered = await renderProcessedAudio(sourceBuffer, mixTracks, editState);
          renderedPreviewBuffer = rendered.audioBuffer;
          renderedPreviewDirty = false;
        }
        bufferToPlay = renderedPreviewBuffer;
        useLiveChain = false;
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
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 95;
      bassFilter.gain.value = (clampNum(editState.bassBoostPct, 0, 100, 0) / 100) * 10.5;
      node.connect(bassFilter);
      node = bassFilter;
      liveBassNode = bassFilter;

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
    const rate =
      !compareOriginal && liveGainNode
        ? clampNum(editState.speed * Math.pow(2, editState.pitchSemitones / 12), 0.4, 2.5, 1)
        : 1;
    const elapsed = (ctx.currentTime - playStartedAtCtx) * rate;
    const span = Math.max(0.1, trimEnd - trimStart);
    currentTimeSec = loopSelection
      ? trimStart + ((playOffsetSec - trimStart + elapsed) % span)
      : Math.min(sourceBuffer.duration, playOffsetSec + elapsed);

    updateTransportDom();
    drawWaveformCanvas();
    rafId = requestAnimationFrame(tickPlaybackVisuals);
  }

  function updateTransportDom() {
    if (!hostEl) return;
    const playBtns = hostEl.querySelectorAll('#ae-play-btn, #ae-mini-play-btn');
    playBtns.forEach((btn) => {
      btn.setAttribute('aria-pressed', String(isPlaying));
      btn.setAttribute('aria-label', isPlaying ? 'Jeda audio' : 'Putar audio');
      btn.innerHTML = isPlaying
        ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;
    });
    const timeEl = hostEl.querySelector('#ae-timecode-now');
    if (timeEl) timeEl.textContent = formatTimecode(currentTimeSec);
    const miniTime = hostEl.querySelector('#ae-mini-timecode');
    if (miniTime) miniTime.textContent = formatTimecode(currentTimeSec).slice(0, 5);
    const miniScrub = hostEl.querySelector('#ae-mini-scrub');
    if (miniScrub && sourceBuffer) {
      miniScrub.value = String(currentTimeSec.toFixed(2));
    }
  }

  function getVisibleWindow() {
    const dur = sourceBuffer ? Math.max(0.1, sourceBuffer.duration) : 1;
    const visibleDur = dur / Math.max(1, zoomLevel);
    const maxStart = Math.max(0, dur - visibleDur);
    viewStartSec = clampNum(viewStartSec, 0, maxStart, 0);
    return { dur, visibleDur, viewStart: viewStartSec, viewEnd: viewStartSec + visibleDur };
  }

  function timeToCanvasX(sec, width) {
    const { viewStart, visibleDur } = getVisibleWindow();
    return ((sec - viewStart) / Math.max(0.01, visibleDur)) * width;
  }

  function canvasXToTime(x, width) {
    const { dur, viewStart, visibleDur } = getVisibleWindow();
    const ratio = clampNum(x / Math.max(1, width), 0, 1, 0);
    return clampNum(viewStart + ratio * visibleDur, 0, dur, 0);
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
    const height = Math.max(172, Math.round(rect.height || 200));
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const rulerH = 26;
    const waveTop = rulerH + 6;
    const waveBottom = height - 18;
    const waveMidY = (waveTop + waveBottom) / 2;
    const maxAmp = (waveBottom - waveTop) * 0.42;

    const bg = isDark ? '#0b1230' : '#eef3fa';
    const rulerBg = isDark ? '#080e24' : '#e2eaf5';
    const tickColor = isDark ? 'rgba(148,163,184,0.34)' : 'rgba(51,65,85,0.28)';
    const labelColor = isDark ? 'rgba(203,213,225,0.78)' : 'rgba(51,65,85,0.78)';
    const waveActive = isDark ? '#2aa8ff' : '#0284c7';
    const waveMuted = isDark ? 'rgba(148,163,184,0.24)' : 'rgba(100,116,139,0.28)';
    const cutShade = isDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)';
    const outShade = isDark ? 'rgba(4, 8, 24, 0.52)' : 'rgba(15, 23, 42, 0.08)';

    // Background & top ruler strip
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = rulerBg;
    ctx.fillRect(0, 0, width, rulerH);

    // Subtle horizontal center line
    ctx.strokeStyle = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(15,23,42,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, waveMidY);
    ctx.lineTo(width, waveMidY);
    ctx.stroke();

    if (!sourceBuffer || !waveformPeaks) {
      ctx.fillStyle = labelColor;
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Ketuk "Pilih Audio" atau "Audio Contoh" untuk mulai mengedit gelombang', width / 2, waveMidY + 5);
      return;
    }

    const { dur, visibleDur, viewStart, viewEnd } = getVisibleWindow();

    // Time Ruler ticks & second labels (0s, 1s, 2s... or 30s, 60s...)
    const targetTicks = Math.max(5, Math.min(10, Math.floor(width / 72)));
    const rawStep = visibleDur / targetTicks;
    const niceSteps = [0.5, 1, 2, 5, 10, 15, 30, 60, 120];
    const majorStep = niceSteps.find((s) => s >= rawStep) || Math.ceil(rawStep / 60) * 60;
    const minorStep = majorStep / 5;

    ctx.strokeStyle = tickColor;
    ctx.fillStyle = labelColor;
    ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'center';

    const firstMinor = Math.floor(viewStart / minorStep) * minorStep;
    for (let t = firstMinor; t <= viewEnd + minorStep * 0.5; t += minorStep) {
      if (t < 0 || t > dur + 0.01) continue;
      const x = timeToCanvasX(t, width);
      const isMajor = Math.abs(t / majorStep - Math.round(t / majorStep)) < 0.02;
      ctx.beginPath();
      ctx.moveTo(x, rulerH);
      ctx.lineTo(x, isMajor ? rulerH + 11 : rulerH + 6);
      ctx.stroke();
      if (isMajor && x >= 16 && x <= width - 16) {
        const lbl = t >= 60 && t % 60 === 0 ? `${Math.round(t)}s` : `${Number(t.toFixed(1))}s`;
        ctx.fillText(lbl, x, 16);
      }
    }

    const { trimStart, trimEnd } = clampTrimRange(editState.trimStart, editState.trimEnd, dur);
    const startX = clampNum(timeToCanvasX(trimStart, width), 0, width, 0);
    const endX = clampNum(timeToCanvasX(trimEnd, width), 0, width, width);
    const isCutMid = editState.trimMode === 'cut-middle';

    // Live frequency spectrum ambient backdrop while playing
    if (isPlaying && liveAnalyser) {
      const freqBins = new Uint8Array(liveAnalyser.frequencyBinCount);
      liveAnalyser.getByteFrequencyData(freqBins);
      const barCount = Math.min(36, freqBins.length);
      const barW = width / barCount;
      for (let i = 0; i < barCount; i += 1) {
        const norm = freqBins[i] / 255;
        const barH = norm * (waveBottom - waveTop) * 0.45;
        ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(2, 132, 199, 0.12)';
        ctx.fillRect(i * barW + 1, waveBottom - barH, Math.max(2, barW - 2), barH);
      }
    }

    // Draw zoomed waveform bars
    const totalPeaks = waveformPeaks.length;
    const barSpacing = 4;
    const visibleBars = Math.max(48, Math.floor(width / barSpacing));
    for (let i = 0; i < visibleBars; i += 1) {
      const x = (i / visibleBars) * width;
      const tSec = canvasXToTime(x, width);
      const peakIdx = Math.min(totalPeaks - 1, Math.max(0, Math.floor((tSec / dur) * totalPeaks)));
      const amp = Math.max(2.5, waveformPeaks[peakIdx] * maxAmp);
      const insideRange = tSec >= trimStart && tSec <= trimEnd;
      const kept = isCutMid ? !insideRange : insideRange;
      ctx.fillStyle = kept ? waveActive : waveMuted;
      ctx.fillRect(x, waveMidY - amp, Math.max(1.8, barSpacing - 1.8), amp * 2);
    }

    // Shaded discarded regions
    if (isCutMid) {
      ctx.fillStyle = cutShade;
      ctx.fillRect(startX, rulerH, Math.max(0, endX - startX), height - rulerH);
    } else {
      ctx.fillStyle = outShade;
      if (startX > 0) ctx.fillRect(0, rulerH, startX, height - rulerH);
      if (endX < width) ctx.fillRect(endX, rulerH, width - endX, height - rulerH);
    }

    // Vertical blue trim boundary lines + circular < and > handles (like Screenshot 3)
    const handleColor = '#2aa8ff';
    ctx.strokeStyle = handleColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startX, rulerH);
    ctx.lineTo(startX, height);
    ctx.moveTo(endX, rulerH);
    ctx.lineTo(endX, height);
    ctx.stroke();

    // Top-left circular "<" handle
    const drawHandle = (hx, hy, dir) => {
      const cx = clampNum(hx, 13, width - 13, hx);
      ctx.fillStyle = handleColor;
      ctx.beginPath();
      ctx.arc(cx, hy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (dir === 'left') {
        ctx.moveTo(cx + 2.5, hy - 4.5);
        ctx.lineTo(cx - 2.5, hy);
        ctx.lineTo(cx + 2.5, hy + 4.5);
      } else {
        ctx.moveTo(cx - 2.5, hy - 4.5);
        ctx.lineTo(cx + 2.5, hy);
        ctx.lineTo(cx - 2.5, hy + 4.5);
      }
      ctx.stroke();
    };

    drawHandle(startX, rulerH + 18, 'left');
    drawHandle(endX, height - 24, 'right');

    // Orange playhead cursor with bottom teardrop (like Screenshot 3)
    const playX = clampNum(timeToCanvasX(currentTimeSec, width), 0, width, 0);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playX, rulerH);
    ctx.lineTo(playX, height - 10);
    ctx.stroke();

    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(playX, height - 8, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function applyLoadedProject(loaded) {
    stopPlayback();
    revokeExportUrl();
    sourceBuffer = loaded.audioBuffer;
    fileName = loaded.fileName;
    fileSize = loaded.fileSize;
    sourceFormat = loaded.format;
    sourceStats = loaded.stats;
    waveformPeaks = extractWaveformPeaks(sourceBuffer.getChannelData(0), 420);
    mixTracks = [];
    aiResult = null;
    metaMatches = [];
    renderedPreviewBuffer = null;
    renderedPreviewDirty = true;
    zoomLevel = 1;
    viewStartSec = 0;

    editState = createDefaultAudioEditorState();
    editState.trimStart = 0;
    editState.trimEnd = Number(sourceBuffer.duration.toFixed(3));
    editState.metadata = {
      ...editState.metadata,
      ...(loaded.metadata || {}),
    };
    editState.exportFileName = (editState.metadata.title || fileName.replace(/\.[^.]+$/, '') || 'audio_manifestudio').trim();
    history = createEditorHistory(editState, 30);
    currentTimeSec = 0;
    render();
  }

  async function handleFileUpload(file) {
    if (!file) return;
    loadingFile = true;
    loadingProgress = 12;
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
        if (badge) badge.textContent = formatTimecode((Date.now() - recordStartTs) / 1000);
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
    const val = renderingExport ? exportProgress : loadingProgress;
    const text = renderingExport ? exportLabel : loadingLabel;
    hostEl.querySelectorAll('.ae-progress-fill').forEach((bar) => {
      bar.style.width = `${clampNum(val, 0, 100, 0)}%`;
    });
    hostEl.querySelectorAll('.ae-progress-label-txt').forEach((lbl) => {
      lbl.textContent = text;
    });
    hostEl.querySelectorAll('.ae-progress-pct-txt').forEach((pct) => {
      pct.textContent = `${Math.round(clampNum(val, 0, 100, 0))}%`;
    });
  }

  async function handleRunAiEngineer() {
    if (!sourceBuffer) {
      onToast('Muat file audio atau klik "Audio Contoh" terlebih dahulu.');
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
      snapshotHistory();
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
      onToast('Muat file audio atau klik "Audio Contoh" terlebih dahulu.');
      return;
    }
    if (renderingExport) return;
    stopPlayback();
    revokeExportUrl();
    if (overrideFormat) editState.exportFormat = overrideFormat;

    renderingExport = true;
    exportProgress = 6;
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
      render();
      onToast(`Audio berhasil diekspor (${exported.fileName})!`);
    } catch (err) {
      renderingExport = false;
      render();
      onToast(err?.message || 'Gagal merender atau mengekspor audio.');
    }
  }

  function isToolEngaged(toolId) {
    if (!sourceBuffer) return false;
    if (toolId === 'trim') {
      return editState.trimMode === 'cut-middle' || editState.trimStart > 0.05 || (sourceBuffer && editState.trimEnd < sourceBuffer.duration - 0.05);
    }
    if (toolId === 'volume') return editState.volumePct !== 100 || editState.speed !== 1 || editState.pan !== 0 || editState.normalizeEnabled || editState.reverse;
    if (toolId === 'fadein') return editState.fadeIn > 0;
    if (toolId === 'fadeout') return editState.fadeOut > 0;
    if (toolId === 'eq') return editState.eqGains.some((g) => Math.abs(g) > 0.1) || editState.bassBoostPct > 0 || editState.virtualizerPct > 0;
    if (toolId === 'voice') return editState.pitchSemitones !== 0 || editState.reverbMix > 0 || editState.echoMix > 0 || editState.robotEffect || editState.radioEffect;
    if (toolId === 'clean') return editState.noiseReduction > 0 || editState.noiseGateDb > -69 || editState.clarityAmount > 0 || editState.deEsserAmount > 0 || editState.repairDeclip || editState.repairHumFilter;
    if (toolId === 'stem') return editState.stemMode !== 'original';
    if (toolId === 'mix') return mixTracks.length > 0;
    if (toolId === 'meta') return Boolean(editState.metadata.artist || editState.metadata.coverDataUrl);
    if (toolId === 'ai') return Boolean(aiResult);
    return false;
  }

  function updateStepperReadouts() {
    if (!hostEl || !sourceBuffer) return;
    const dur = sourceBuffer.duration;
    const trim = clampTrimRange(editState.trimStart, editState.trimEnd, dur);
    const totalOut = computeTrimmedDuration(dur, trim.trimStart, trim.trimEnd, editState.trimMode);
    const sEl = hostEl.querySelector('#ae-step-start-val');
    const eEl = hostEl.querySelector('#ae-step-end-val');
    const tEl = hostEl.querySelector('#ae-step-total-val');
    if (sEl) sEl.textContent = formatTimecode(trim.trimStart);
    if (eEl) eEl.textContent = formatTimecode(trim.trimEnd);
    if (tEl) tEl.textContent = `Total ${formatTimecode(totalOut)}`;
  }

  function renderWaveformStage() {
    const dur = sourceBuffer ? sourceBuffer.duration : 0;
    const trim = clampTrimRange(editState.trimStart, editState.trimEnd, dur);
    const totalOut = computeTrimmedDuration(dur, trim.trimStart, trim.trimEnd, editState.trimMode);

    return `
      <div class="ae-stage" id="ae-dropzone">
        <div class="ae-stepper-bar" aria-label="Pengatur waktu pangkas presisi">
          <div class="ae-time-pill">
            <button type="button" class="ae-step-btn" id="ae-start-minus" aria-label="Kurangi waktu mulai" ${!sourceBuffer ? 'disabled' : ''}>−</button>
            <span class="ae-val-mono" id="ae-step-start-val">${formatTimecode(trim.trimStart)}</span>
            <button type="button" class="ae-step-btn" id="ae-start-plus" aria-label="Tambah waktu mulai" ${!sourceBuffer ? 'disabled' : ''}>+</button>
          </div>
          <div class="ae-total-readout ae-val-mono" id="ae-step-total-val">Total ${formatTimecode(totalOut)}</div>
          <div class="ae-time-pill">
            <button type="button" class="ae-step-btn" id="ae-end-minus" aria-label="Kurangi waktu akhir" ${!sourceBuffer ? 'disabled' : ''}>−</button>
            <span class="ae-val-mono" id="ae-step-end-val">${formatTimecode(trim.trimEnd)}</span>
            <button type="button" class="ae-step-btn" id="ae-end-plus" aria-label="Tambah waktu akhir" ${!sourceBuffer ? 'disabled' : ''}>+</button>
          </div>
        </div>

        <canvas id="ae-waveform-canvas" class="ae-waveform-canvas" aria-label="Gelombang audio interaktif dengan penanda geser"></canvas>

        <div class="ae-wave-actions">
          <div class="ae-trim-mode-pills" role="group" aria-label="Mode pemotongan audio">
            <button type="button" class="ae-pill-action ${editState.trimMode === 'keep' ? 'is-active' : ''}" data-ae-trim-mode="keep" ${!sourceBuffer ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12h3M19 12h3M7 8v8M12 5v14M17 8v8"/></svg>
              <span>Pangkas</span>
            </button>
            <button type="button" class="ae-pill-action ${editState.trimMode === 'cut-middle' ? 'is-active' : ''}" data-ae-trim-mode="cut-middle" ${!sourceBuffer ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 8v8M7 5v14M17 5v14M21 8v8M10 12h4"/></svg>
              <span>Potong Tengah</span>
            </button>
          </div>

          <div class="ae-zoom-group" role="group" aria-label="Perbesar atau perkecil gelombang">
            <button type="button" class="ae-zoom-btn" id="ae-zoom-out" aria-label="Perkecil gelombang" ${!sourceBuffer || zoomLevel <= 1 ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <span class="ae-zoom-val ae-val-mono">${zoomLevel}×</span>
            <button type="button" class="ae-zoom-btn" id="ae-zoom-in" aria-label="Perbesar gelombang" ${!sourceBuffer || zoomLevel >= 8 ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
          </div>
        </div>

        <div class="ae-transport-circle-row">
          <div class="ae-transport-main">
            <button type="button" class="ae-circle-btn" id="ae-jump-start-btn" aria-label="Ke awal potongan" ${!sourceBuffer ? 'disabled' : ''}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
            </button>
            <button type="button" class="ae-circle-play" id="ae-play-btn" aria-label="${isPlaying ? 'Jeda audio' : 'Putar audio'}" aria-pressed="${isPlaying}" ${!sourceBuffer ? 'disabled' : ''}>
              ${
                isPlaying
                  ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.2"/><rect x="14" y="4" width="4" height="16" rx="1.2"/></svg>`
                  : `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`
              }
            </button>
            <button type="button" class="ae-circle-btn" id="ae-jump-end-btn" aria-label="Maju 2 detik" ${!sourceBuffer ? 'disabled' : ''}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          <div class="ae-transport-extras">
            <span class="ae-timecode ae-val-mono">
              <strong id="ae-timecode-now">${formatTimecode(currentTimeSec)}</strong> / ${formatTimecode(dur)}
            </span>
            <button type="button" class="ae-mini-chip ${loopSelection ? 'is-active' : ''}" id="ae-loop-btn" ${!sourceBuffer ? 'disabled' : ''}>Ulangi</button>
            <button type="button" class="ae-mini-chip ${compareOriginal ? 'is-active' : ''}" id="ae-ab-btn" ${!sourceBuffer ? 'disabled' : ''}>
              ${compareOriginal ? 'Suara: Asli' : 'Suara: Edit'}
            </button>
            <button type="button" class="ae-mini-chip" id="ae-reset-all-btn" ${!sourceBuffer ? 'disabled' : ''}>Reset</button>
          </div>
        </div>

        ${
          sourceStats
            ? `<div class="ae-telemetry-strip ae-val-mono" aria-label="Statistik akustik audio">
                <span>Peak: <strong>${sourceStats.peakDb} dBFS</strong></span>
                <span aria-hidden="true">·</span>
                <span>RMS: <strong>${sourceStats.rmsDb} dBFS</strong></span>
                <span aria-hidden="true">·</span>
                <span>LUFS: <strong>${sourceStats.estimatedLufs}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Noise: <strong>${sourceStats.noiseFloorDb} dB</strong></span>
                <span aria-hidden="true">·</span>
                <span>Clip: <strong>${sourceStats.clippedSamples}</strong></span>
              </div>`
            : ''
        }
      </div>
    `;
  }

  function renderMiniNowPlayingCard() {
    const dur = sourceBuffer ? sourceBuffer.duration : 0;
    return `
      <div class="ae-mini-player-card">
        <div class="ae-mini-player-top">
          <div class="ae-mini-icon-box" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="10" x2="4" y2="14"/><line x1="8" y1="7" x2="8" y2="17"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="16" y1="7" x2="16" y2="17"/><line x1="20" y1="10" x2="20" y2="14"/></svg>
          </div>
          <div class="ae-mini-meta">
            <strong>${escapeHtml(editState.metadata.title || fileName || 'Belum ada audio')}</strong>
            <span class="ae-val-mono">${sourceBuffer ? `${formatTimecode(dur).slice(0, 5)} | ${formatBytes(fileSize)} | ${escapeHtml(sourceFormat)}` : 'Klik Audio Contoh atau Pilih Audio di atas'}</span>
          </div>
          <button type="button" class="ae-circle-btn ae-mini-play-btn" id="ae-mini-play-btn" aria-label="${isPlaying ? 'Jeda audio' : 'Putar audio'}" aria-pressed="${isPlaying}" ${!sourceBuffer ? 'disabled' : ''}>
            ${
              isPlaying
                ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`
                : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
            }
          </button>
        </div>
        <div class="ae-mini-scrub-row">
          <input type="range" id="ae-mini-scrub" min="0" max="${Math.max(0.1, dur).toFixed(2)}" step="0.05" value="${currentTimeSec.toFixed(2)}" ${!sourceBuffer ? 'disabled' : ''} aria-label="Posisi putar audio" />
          <span class="ae-val-mono" id="ae-mini-timecode">${formatTimecode(currentTimeSec).slice(0, 5)}</span>
        </div>
      </div>
    `;
  }

  function renderToolDrawer() {
    const dur = sourceBuffer ? sourceBuffer.duration : 0;
    const trim = clampTrimRange(editState.trimStart, editState.trimEnd, dur);

    if (activeTool === 'trim') {
      return `
        <div class="ae-drawer-card ae-drawer-compact">
          <div class="ae-group-head">
            <h4 class="ae-group-title">Tips &amp; Presisi Pangkas Cepat</h4>
            <button type="button" class="ae-mini-chip" id="ae-reset-trim-btn" ${!sourceBuffer ? 'disabled' : ''}>Reset Penanda</button>
          </div>
          <p class="ae-hint-line">Geser langsung lingkaran biru <strong>&lt;</strong> dan <strong>&gt;</strong> di gelombang, geser garis oranye untuk memindahkan posisi putar, atau gunakan tombol <strong>− / +</strong> di atas gelombang.</p>
          <div class="ae-dual-sliders">
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
          </div>
        </div>
      `;
    }

    if (activeTool === 'volume') {
      return `
        <div class="ae-drawer-card">
          <div class="ae-group-head">
            <h4 class="ae-group-title">Penguat Volume, Panning Stereo &amp; Tempo</h4>
            <div class="ae-inline-actions">
              <button type="button" class="ae-mini-chip" data-ae-quick-vol="100">100%</button>
              <button type="button" class="ae-mini-chip" data-ae-quick-vol="150">150%</button>
              <button type="button" class="ae-mini-chip" data-ae-quick-vol="200">200%</button>
              <button type="button" class="ae-mini-chip" data-ae-quick-vol="300">Max 300%</button>
            </div>
          </div>
          <div class="ae-panel-grid">
            <div class="ae-slider-row">
              <label for="ae-volume-pct">Volume / Penguat Suara</label>
              <span class="ae-val-mono" id="ae-volume-val">${editState.volumePct}% (${gainToDb(volumePctToGain(editState.volumePct)) >= 0 ? '+' : ''}${gainToDb(volumePctToGain(editState.volumePct))} dB)</span>
              <input id="ae-volume-pct" type="range" min="0" max="300" step="1" value="${editState.volumePct}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-pan-slider">Keseimbangan Kiri / Kanan</label>
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
                <span>Auto-Normalisasi (${editState.targetLufs} LUFS + Anti-Clip)</span>
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

    if (activeTool === 'fadein' || activeTool === 'fadeout') {
      return `
        <div class="ae-drawer-card">
          <div class="ae-group-head">
            <h4 class="ae-group-title">${activeTool === 'fadein' ? 'Fade In (Masuk Halus)' : 'Fade Out (Keluar Halus)'}</h4>
            <div class="ae-inline-actions">
              <button type="button" class="ae-mini-chip" data-ae-quick-fade="0">Matikan</button>
              <button type="button" class="ae-mini-chip" data-ae-quick-fade="1.5">1.5 detik</button>
              <button type="button" class="ae-mini-chip" data-ae-quick-fade="3">3.0 detik</button>
              <button type="button" class="ae-mini-chip" data-ae-quick-fade="5">5.0 detik</button>
            </div>
          </div>
          <div class="ae-dual-sliders">
            <div class="ae-slider-row ${activeTool === 'fadein' ? 'is-focused' : ''}">
              <label for="ae-fade-in">Durasi Fade In (Awal)</label>
              <span class="ae-val-mono" id="ae-fade-in-val">${editState.fadeIn.toFixed(1)}s</span>
              <input id="ae-fade-in" type="range" min="0" max="10" step="0.1" value="${editState.fadeIn}" />
            </div>
            <div class="ae-slider-row ${activeTool === 'fadeout' ? 'is-focused' : ''}">
              <label for="ae-fade-out">Durasi Fade Out (Akhir)</label>
              <span class="ae-val-mono" id="ae-fade-out-val">${editState.fadeOut.toFixed(1)}s</span>
              <input id="ae-fade-out" type="range" min="0" max="10" step="0.1" value="${editState.fadeOut}" />
            </div>
          </div>
        </div>
      `;
    }

    if (activeTool === 'eq') {
      return `
        <div class="ae-eq-studio-shell">
          <div class="ae-eq-preset-strip" role="group" aria-label="Preset Equalizer">
            <button type="button" class="ae-eq-reset-circle" id="ae-eq-reset-btn" title="Reset Equalizer ke 0 dB" aria-label="Reset Equalizer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/></svg>
            </button>
            ${AUDIO_EQ_PRESETS.map(
              (p) => `
              <button type="button" class="ae-eq-chip ${editState.eqPreset === p.id ? 'is-active' : ''}" data-ae-eq-preset="${p.id}">
                ${escapeHtml(p.label)}
              </button>
            `
            ).join('')}
          </div>

          <div class="ae-eq-rack-visual" aria-label="Pengaturan 10 frekuensi equalizer">
            <div class="ae-eq-curve-overlay" id="ae-eq-curve-host">${buildEqCurveSvg(editState.eqGains)}</div>
            <div class="ae-eq-rack-cols">
              ${AUDIO_EQ_BANDS.map((band, idx) => {
                const val = Number(editState.eqGains[idx] || 0);
                const pctFill = ((val + 12) / 24) * 100;
                return `
                  <div class="ae-eq-col">
                    <span class="ae-eq-db ae-val-mono" data-ae-eq-val="${idx}">${val > 0 ? `+${Math.round(val)}` : Math.round(val)}</span>
                    <div class="ae-eq-slider-track">
                      <div class="ae-eq-fill-bar" data-ae-eq-fill="${idx}" style="height:${pctFill.toFixed(1)}%"></div>
                      <input
                        type="range"
                        class="ae-eq-slider-vertical"
                        data-ae-eq-band="${idx}"
                        min="-12"
                        max="12"
                        step="0.5"
                        value="${val}"
                        aria-label="Equalizer ${band.label}${band.unit}"
                      />
                    </div>
                    <span class="ae-eq-freq ae-val-mono">${band.label}</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="ae-rotary-grid">
            <div class="ae-knob-card">
              <div class="ae-knob-title">Peningkat Bass</div>
              <div class="ae-knob-dial" data-ae-knob="bass" role="slider" tabindex="0" aria-label="Peningkat Bass" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${editState.bassBoostPct}">
                ${buildRotaryKnobSvg(editState.bassBoostPct, 'bass')}
                <span class="ae-knob-val ae-val-mono" id="ae-bass-val">${editState.bassBoostPct}%</span>
              </div>
              <div class="ae-knob-step-row">
                <button type="button" class="ae-step-mini" data-ae-knob-step="bass:-10">−10%</button>
                <button type="button" class="ae-step-mini" data-ae-knob-step="bass:0">0%</button>
                <button type="button" class="ae-step-mini" data-ae-knob-step="bass:+10">+10%</button>
              </div>
            </div>

            <div class="ae-knob-card">
              <div class="ae-knob-title">Virtualizer</div>
              <div class="ae-knob-dial" data-ae-knob="virt" role="slider" tabindex="0" aria-label="Virtualizer Stereo 3D" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${editState.virtualizerPct}">
                ${buildRotaryKnobSvg(editState.virtualizerPct, 'virt')}
                <span class="ae-knob-val ae-val-mono" id="ae-virt-val">${editState.virtualizerPct}%</span>
              </div>
              <div class="ae-knob-step-row">
                <button type="button" class="ae-step-mini" data-ae-knob-step="virt:-10">−10%</button>
                <button type="button" class="ae-step-mini" data-ae-knob-step="virt:0">0%</button>
                <button type="button" class="ae-step-mini" data-ae-knob-step="virt:+10">+10%</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (activeTool === 'voice') {
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
            <h4 class="ae-group-title">Nada, Gema &amp; Efek Ruang</h4>
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
                <span>Modulasi Robotik</span>
              </label>
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-radio-chk" ${editState.radioEffect ? 'checked' : ''} />
                <span>Filter Radio AM / Telepon</span>
              </label>
            </div>
          </div>
        </div>
      `;
    }

    if (activeTool === 'clean') {
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
              <label for="ae-gate-slider">Ambang Noise Gate</label>
              <span class="ae-val-mono" id="ae-gate-val">${editState.noiseGateDb <= -69 ? 'Nonaktif' : `${editState.noiseGateDb} dB`}</span>
              <input id="ae-gate-slider" type="range" min="-70" max="-24" step="1" value="${editState.noiseGateDb}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-clarity-slider">Penjernih Vokal &amp; Detail</label>
              <span class="ae-val-mono" id="ae-clarity-val">${editState.clarityAmount}%</span>
              <input id="ae-clarity-slider" type="range" min="0" max="100" step="1" value="${editState.clarityAmount}" />
            </div>
            <div class="ae-slider-row">
              <label for="ae-deesser-slider">De-Esser (Haluskan Desis)</label>
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
                <span>De-Clipper Otomatis (Pulihkan Suara Pecah)</span>
              </label>
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-dcoffset-chk" ${editState.repairDcOffset ? 'checked' : ''} />
                <span>Pembersih DC Offset (Hilangkan Klik Awal/Akhir)</span>
              </label>
              <label class="ae-checkbox-label">
                <input type="checkbox" id="ae-hum-chk" ${editState.repairHumFilter ? 'checked' : ''} />
                <span>Filter Dengung Listrik (${editState.humFreqHz} Hz)</span>
              </label>
            </div>
            <div class="ae-inline-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="ae-hum-freq-btn">Ganti ${editState.humFreqHz === 50 ? '60Hz' : '50Hz'}</button>
              <button type="button" class="btn btn-primary btn-sm" id="ae-quick-repair-btn">Perbaikan Cepat 1-Klik</button>
            </div>
          </div>
        </div>
      `;
    }

    if (activeTool === 'stem') {
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
          <div class="ae-slider-row">
            <label for="ae-stem-strength">Kekuatan Pemisahan Kanal</label>
            <span class="ae-val-mono" id="ae-stem-strength-val">${editState.stemStrength}%</span>
            <input id="ae-stem-strength" type="range" min="10" max="100" step="1" value="${editState.stemStrength}" ${editState.stemMode === 'original' ? 'disabled' : ''} />
          </div>
        </div>
      `;
    }

    if (activeTool === 'mix') {
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
            <button type="button" class="ae-preset-btn ${editState.mixMode === 'overlay' ? 'is-active' : ''}" data-ae-mix-mode="overlay">Campur Bersamaan (Overlay)</button>
            <button type="button" class="ae-preset-btn ${editState.mixMode === 'concat' ? 'is-active' : ''}" data-ae-mix-mode="concat">Sambung Berurutan (Gabung)</button>
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

    if (activeTool === 'meta') {
      const m = editState.metadata;
      return `
        <div class="ae-control-group">
          <div class="ae-group-head">
            <h4 class="ae-group-title">Edit Identitas &amp; Metadata Audio (ID3v2.3 &amp; RIFF)</h4>
            <div class="ae-inline-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="ae-meta-lookup-btn" ${metaSearching ? 'disabled' : ''}>
                ${metaSearching ? 'Mencari...' : 'Cari Resmi (iTunes + MusicBrainz)'}
              </button>
              <button type="button" class="btn btn-primary btn-sm" id="ae-meta-ai-rewrite-btn" ${aiBusy ? 'disabled' : ''}>Tulis Ulang AI</button>
            </div>
          </div>

          ${
            metaMatches.length > 0
              ? `<div class="ae-meta-matches">
                  <p class="ae-meta-matches-head">Klik hasil resmi untuk mengisi otomatis semua tag &amp; sampul:</p>
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
            <label class="ae-field"><span>Judul Lagu (TIT2)</span><input type="text" id="ae-meta-title" value="${escapeHtml(m.title)}" placeholder="Judul lagu atau rekaman" /></label>
            <label class="ae-field"><span>Artis / Pembuat (TPE1)</span><input type="text" id="ae-meta-artist" value="${escapeHtml(m.artist)}" placeholder="Nama artis / kreator" /></label>
            <label class="ae-field"><span>Album (TALB)</span><input type="text" id="ae-meta-album" value="${escapeHtml(m.album)}" placeholder="Nama album" /></label>
            <label class="ae-field"><span>Genre (TCON)</span><input type="text" id="ae-meta-genre" value="${escapeHtml(m.genre)}" placeholder="Pop, Podcast, Acoustic..." /></label>
            <label class="ae-field"><span>Tahun (TYER)</span><input type="text" id="ae-meta-year" value="${escapeHtml(m.year)}" maxlength="4" placeholder="2026" /></label>
            <label class="ae-field"><span>Nomor Trek (TRCK)</span><input type="text" id="ae-meta-track" value="${escapeHtml(m.track)}" maxlength="8" placeholder="1" /></label>
            <label class="ae-field ae-field-wide"><span>Komentar / Kredit (COMM)</span><input type="text" id="ae-meta-comment" value="${escapeHtml(m.comment)}" /></label>
            <div class="ae-cover-row ae-field-wide">
              <div class="ae-cover-preview">
                ${m.coverDataUrl ? `<img src="${escapeHtml(m.coverDataUrl)}" alt="Sampul" width="56" height="56" />` : `<span>Sampul</span>`}
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

    // 'ai': Multi-AI Mastering Studio + Quick Open Save Modal
    return `
      <div class="ae-control-group">
        <div class="ae-group-head">
          <h4 class="ae-group-title">Asisten Mastering Multi-AI (ChatGPT, Claude, Gemini, DeepSeek, Grok)</h4>
          <button type="button" class="btn btn-secondary btn-sm" id="ae-open-save-from-ai" ${!sourceBuffer ? 'disabled' : ''}>Buka Menu Simpan / Ekspor</button>
        </div>
        <div class="ae-panel-grid">
          <label class="ae-field">
            <span>Pilih Mesin AI Penyempurna</span>
            <select id="ae-ai-engine-select">
              ${AUDIO_AI_ENGINES.map(
                (eng) => `<option value="${eng.id}" ${editState.aiEngine === eng.id ? 'selected' : ''}>${escapeHtml(eng.label)} — ${escapeHtml(eng.subtitle)}</option>`
              ).join('')}
            </select>
          </label>
          <label class="ae-field">
            <span>Target Penyempurnaan Audio</span>
            <select id="ae-ai-goal-select">
              ${AUDIO_AI_GOALS.map(
                (g) => `<option value="${g.id}" ${editState.aiGoal === g.id ? 'selected' : ''}>${escapeHtml(g.label)}</option>`
              ).join('')}
            </select>
          </label>
        </div>
        <label class="ae-field">
          <span>Instruksi Tambahan ke AI (Opsional)</span>
          <input type="text" id="ae-ai-custom-prompt" value="${escapeHtml(editState.aiCustomPrompt)}" placeholder="Contoh: Buat vokal lebih hangat seperti radio malam & kurangi desis" />
        </label>
        <div class="ae-inline-actions">
          <button type="button" class="btn btn-primary btn-sm" id="ae-run-ai-btn" ${!sourceBuffer || aiBusy ? 'disabled' : ''}>
            ${aiBusy ? 'Menganalisis dengan Multi-AI...' : 'Analisis & Terapkan dengan AI'}
          </button>
        </div>
        <p class="ae-ai-status" id="ae-ai-status-text">
          ${
            aiResult
              ? `<strong>${escapeHtml(aiResult.provider)}:</strong> ${escapeHtml(aiResult.plan.summary)}`
              : 'AI menganalisis statistik Peak, RMS, Noise Floor, & Clipping lalu langsung menyetel 10-Band EQ, Noise Stabilizer, Clarity, dan Repair.'
          }
        </p>
      </div>
    `;
  }

  function renderSaveModal() {
    if (!saveModalOpen) return '';
    const dur = sourceBuffer
      ? computeTrimmedDuration(sourceBuffer.duration, editState.trimStart, editState.trimEnd, editState.trimMode)
      : 0;
    const est = estimateExportFileSizeRange(dur, editState.exportFormat, editState.exportBitrate, editState.exportSampleRate);
    const activeFmt = AUDIO_EXPORT_FORMATS.find((f) => f.id === editState.exportFormat) || AUDIO_EXPORT_FORMATS[0];
    const standardFormats = AUDIO_EXPORT_FORMATS.filter((f) => f.tier === 'standard');
    const proFormats = AUDIO_EXPORT_FORMATS.filter((f) => f.tier === 'pro');
    const isLossless = editState.exportFormat === 'wav' || editState.exportFormat === 'flac';

    return `
      <div class="ae-modal-backdrop" id="ae-save-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ae-save-modal-title">
        <div class="ae-save-modal">
          <button type="button" class="ae-modal-close" id="ae-save-modal-close" aria-label="Tutup dialog simpan">×</button>
          <h3 class="ae-modal-title" id="ae-save-modal-title">Simpan sebagai</h3>

          <div class="ae-modal-section">
            <label class="ae-modal-label" for="ae-save-filename">Nama File</label>
            <div class="ae-filename-row">
              <input type="text" id="ae-save-filename" class="ae-filename-input" value="${escapeHtml(editState.exportFileName || editState.metadata.title || 'audio_manifestudio')}" placeholder="Nama file hasil edit" />
              <button type="button" class="ae-format-dropdown-btn" id="ae-toggle-format-picker" aria-expanded="${formatPickerOpen}">
                <span>${escapeHtml(activeFmt.label)}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="${formatPickerOpen ? 'm18 15-6-6-6 6' : 'm6 9 6 6 6-6'}"/></svg>
              </button>
            </div>
          </div>

          ${
            formatPickerOpen
              ? `<div class="ae-format-picker-sheet" id="ae-format-picker-sheet">
                  <div class="ae-modal-label">Pilih format</div>
                  <div class="ae-fmt-chip-grid">
                    ${standardFormats
                      .map((f) => {
                        const isOrig = sourceFormat.toLowerCase() === f.id;
                        return `
                          <button type="button" class="ae-fmt-chip ${editState.exportFormat === f.id ? 'is-active' : ''}" data-ae-export-fmt="${f.id}">
                            ${isOrig ? `<span class="ae-fmt-orig-tag">Asli</span>` : ''}
                            <strong>${escapeHtml(f.label)}</strong>
                          </button>
                        `;
                      })
                      .join('')}
                  </div>
                  <div class="ae-modal-label ae-fmt-pro-head">
                    <span>Format Pro</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#facc15" aria-hidden="true"><path d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>
                    <span class="ae-free-unlocked">Gratis</span>
                  </div>
                  <div class="ae-fmt-chip-grid">
                    ${proFormats
                      .map(
                        (f) => `
                        <button type="button" class="ae-fmt-chip ${editState.exportFormat === f.id ? 'is-active' : ''}" data-ae-export-fmt="${f.id}">
                          <strong>${escapeHtml(f.label)}</strong>
                        </button>
                      `
                      )
                      .join('')}
                  </div>
                </div>`
              : `<div class="ae-modal-section">
                  <div class="ae-modal-label">Kualitas</div>
                  <div class="ae-quality-strip" role="radiogroup" aria-label="Pilih kualitas bitrate audio">
                    ${AUDIO_EXPORT_QUALITIES.map(
                      (q) => `
                      <button
                        type="button"
                        class="ae-quality-card ${Number(editState.exportBitrate) === q.bitrate && !isLossless ? 'is-active' : ''}"
                        data-ae-quality-br="${q.bitrate}"
                        ${isLossless ? 'disabled' : ''}
                      >
                        <div class="ae-quality-top">
                          <strong>${escapeHtml(q.label)}</strong>
                          ${
                            q.pro
                              ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="#facc15" aria-hidden="true"><path d="M5 16 3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/></svg>`
                              : ''
                          }
                        </div>
                        <div class="ae-quality-bottom">
                          ${q.tag ? `<span class="ae-quality-tag">${escapeHtml(q.tag)}</span>` : ''}
                          <span class="ae-val-mono">${q.bitrate}kbps</span>
                        </div>
                      </button>
                    `
                    ).join('')}
                  </div>
                  <div class="ae-sr-inline-row">
                    <span>Sample Rate:</span>
                    <button type="button" class="ae-mini-chip ${Number(editState.exportSampleRate) === 44100 ? 'is-active' : ''}" data-ae-sr="44100">44.1 kHz</button>
                    <button type="button" class="ae-mini-chip ${Number(editState.exportSampleRate) === 48000 ? 'is-active' : ''}" data-ae-sr="48000">48.0 kHz</button>
                  </div>
                </div>

                <p class="ae-est-size-line" id="ae-est-size-readout">
                  Perkiraan ukuran file: <strong class="ae-val-mono">${escapeHtml(est.label)}</strong>
                  ${isLossless ? ' (Lossless tanpa kompresi)' : ''}
                </p>

                ${
                  renderingExport
                    ? `<div class="ae-progress-bar-box" role="status" aria-live="polite">
                        <div class="ae-progress-head">
                          <span class="ae-progress-label-txt">${escapeHtml(exportLabel)}</span>
                          <strong class="ae-progress-pct-txt ae-val-mono">${Math.round(exportProgress)}%</strong>
                        </div>
                        <div class="ae-progress-track">
                          <div class="ae-progress-fill" style="width:${clampNum(exportProgress, 0, 100, 0)}%"></div>
                        </div>
                      </div>`
                    : ''
                }

                <button type="button" class="ae-modal-save-btn" id="ae-export-btn" ${!sourceBuffer || renderingExport ? 'disabled' : ''}>
                  ${renderingExport ? 'MENYIMPAN AUDIO...' : 'SIMPAN'}
                </button>

                ${
                  lastExportResult
                    ? `<div class="ae-export-result" id="ae-export-result-box">
                        <div class="ae-export-result-meta">
                          <strong>${escapeHtml(lastExportResult.fileName)}</strong>
                          <span class="ae-val-mono">${escapeHtml(lastExportResult.format)} · ${formatBytes(lastExportResult.size)} · ${formatTimecode(lastExportResult.duration)} · ${escapeHtml(lastExportResult.engineUsed)}</span>
                        </div>
                        <audio controls src="${escapeHtml(lastExportResult.url)}" class="ae-result-audio"></audio>
                        <a href="${escapeHtml(lastExportResult.url)}" download="${escapeHtml(lastExportResult.fileName)}" class="ae-modal-save-btn ae-download-ready-btn" id="ae-download-exported-link">
                          UNDUH HASIL (${escapeHtml(lastExportResult.format)})
                        </a>
                      </div>`
                    : ''
                }`
          }
        </div>
      </div>
    `;
  }

  function render() {
    if (!hostEl || !mounted) return;
    const activeToolMeta = DOCK_TOOLS.find((t) => t.id === activeTool) || DOCK_TOOLS[0];
    const showEqMiniHeader = activeTool === 'eq';

    hostEl.innerHTML = `
      <div class="ae-studio">
        <div class="ae-app-header">
          <div class="ae-header-left">
            ${
              activeTool !== 'trim'
                ? `<button type="button" class="ae-icon-btn" id="ae-back-to-trim" aria-label="Kembali ke Pangkas">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>`
                : ''
            }
            <div class="ae-header-title-wrap">
              <h3 class="ae-header-title">${escapeHtml(activeToolMeta.title)}</h3>
              <span class="ae-header-sub">${sourceBuffer ? escapeHtml(editState.metadata.title || fileName) : 'Pilih audio, rekam mic, atau muat contoh'}</span>
            </div>
          </div>

          <div class="ae-header-right">
            <button type="button" class="ae-icon-btn" id="ae-undo-btn" title="Urungkan (Undo)" aria-label="Urungkan" ${history.index <= 0 ? 'disabled' : ''}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
            </button>
            <button type="button" class="ae-icon-btn" id="ae-redo-btn" title="Ulangi (Redo)" aria-label="Ulangi" ${history.index >= history.stack.length - 1 ? 'disabled' : ''}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
            </button>
            <button type="button" class="ae-save-cta-btn" id="ae-open-save-modal-btn" ${!sourceBuffer ? 'disabled' : ''}>
              SIMPAN
            </button>
          </div>
        </div>

        <div class="ae-source-strip">
          <label class="ae-source-pill is-primary" for="ae-file-input">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span>Pilih Audio / Video</span>
          </label>
          <input id="ae-file-input" type="file" accept="audio/*,video/*" hidden />
          <button type="button" class="ae-source-pill ${isRecording ? 'ae-rec-active' : ''}" id="ae-mic-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
            <span>${isRecording ? `Stop (<b id="ae-rec-elapsed" class="ae-val-mono">00:00.0</b>)` : 'Rekam Mic'}</span>
          </button>
          <button type="button" class="ae-source-pill" id="ae-demo-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <span>Audio Contoh</span>
          </button>
          ${
            lastExportResult
              ? `<button type="button" class="ae-source-pill is-success" id="ae-reopen-export-btn">
                  <span>Hasil: ${escapeHtml(lastExportResult.format)} (${formatBytes(lastExportResult.size)})</span>
                </button>`
              : ''
          }
        </div>

        ${
          loadingFile
            ? `<div class="ae-progress-bar-box" role="status" aria-live="polite">
                <div class="ae-progress-head">
                  <span class="ae-progress-label-txt">${escapeHtml(loadingLabel)}</span>
                  <strong class="ae-progress-pct-txt ae-val-mono">${Math.round(loadingProgress)}%</strong>
                </div>
                <div class="ae-progress-track">
                  <div class="ae-progress-fill" style="width:${clampNum(loadingProgress, 0, 100, 0)}%"></div>
                </div>
              </div>`
            : ''
        }

        ${showEqMiniHeader ? renderMiniNowPlayingCard() : renderWaveformStage()}

        <div class="ae-workbench-body" role="tabpanel">
          ${renderToolDrawer()}
        </div>

        <div class="ae-bottom-dock-wrap" aria-label="Bar pilihan alat edit audio">
          <button type="button" class="ae-dock-scroll-btn" id="ae-dock-left" aria-label="Geser alat ke kiri">‹</button>
          <div class="ae-bottom-dock" id="ae-bottom-dock" role="tablist">
            ${DOCK_TOOLS.map((t) => {
              const engaged = isToolEngaged(t.id);
              return `
                <button
                  type="button"
                  role="tab"
                  class="ae-dock-item ${activeTool === t.id ? 'is-active' : ''}"
                  data-ae-dock-tool="${t.id}"
                  aria-selected="${activeTool === t.id}"
                >
                  <span class="ae-dock-icon">
                    ${t.icon}
                    ${engaged ? `<i class="ae-dock-dot" aria-hidden="true"></i>` : ''}
                  </span>
                  <span class="ae-dock-label">${escapeHtml(t.label)}</span>
                </button>
              `;
            }).join('')}
          </div>
          <button type="button" class="ae-dock-scroll-btn" id="ae-dock-right" aria-label="Geser alat ke kanan">›</button>
        </div>

        ${renderSaveModal()}
      </div>
    `;

    bindEvents();
    drawWaveformCanvas();
  }

  function bindEvents() {
    if (!hostEl) return;

    // Header actions
    hostEl.querySelector('#ae-back-to-trim')?.addEventListener('click', () => {
      activeTool = 'trim';
      render();
    });

    hostEl.querySelector('#ae-undo-btn')?.addEventListener('click', () => {
      const res = undoEditorHistory(history);
      if (res.changed && res.snapshot) {
        history = res.history;
        editState = res.snapshot;
        markDirty();
        render();
        onToast('Perubahan terakhir diurungkan (Undo).');
      }
    });

    hostEl.querySelector('#ae-redo-btn')?.addEventListener('click', () => {
      const res = redoEditorHistory(history);
      if (res.changed && res.snapshot) {
        history = res.history;
        editState = res.snapshot;
        markDirty();
        render();
        onToast('Perubahan dikembalikan (Redo).');
      }
    });

    const openSaveModal = () => {
      if (!sourceBuffer) {
        onToast('Muat audio atau klik "Audio Contoh" dulu sebelum menyimpan.');
        return;
      }
      if (!editState.exportFileName) {
        editState.exportFileName = (editState.metadata.title || fileName.replace(/\.[^.]+$/, '') || 'audio_manifestudio').trim();
      }
      saveModalOpen = true;
      formatPickerOpen = false;
      render();
    };

    hostEl.querySelector('#ae-open-save-modal-btn')?.addEventListener('click', openSaveModal);
    hostEl.querySelector('#ae-reopen-export-btn')?.addEventListener('click', openSaveModal);
    hostEl.querySelector('#ae-open-save-from-ai')?.addEventListener('click', openSaveModal);

    // Source strip
    hostEl.querySelector('#ae-file-input')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) handleFileUpload(f);
    });
    hostEl.querySelector('#ae-demo-btn')?.addEventListener('click', () => {
      const demo = createDemoStudioAudio();
      applyLoadedProject(demo);
      onToast('Audio Contoh Studio (8 detik stereo) dimuat — coba geser penanda, EQ & SIMPAN!');
    });
    hostEl.querySelector('#ae-mic-btn')?.addEventListener('click', toggleMicRecording);

    // Drag & drop on stage
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
        const f = e.dataTransfer?.files?.[0];
        if (f) handleFileUpload(f);
      });
    }

    // Timecode steppers (- / + 0.2s)
    const stepTrim = (which, delta) => {
      if (!sourceBuffer) return;
      const dur = sourceBuffer.duration;
      const next =
        which === 'start'
          ? clampTrimRange(editState.trimStart + delta, editState.trimEnd, dur)
          : clampTrimRange(editState.trimStart, editState.trimEnd + delta, dur);
      editState.trimStart = next.trimStart;
      editState.trimEnd = next.trimEnd;
      markDirty();
      snapshotHistory();
      render();
    };
    hostEl.querySelector('#ae-start-minus')?.addEventListener('click', () => stepTrim('start', -0.2));
    hostEl.querySelector('#ae-start-plus')?.addEventListener('click', () => stepTrim('start', 0.2));
    hostEl.querySelector('#ae-end-minus')?.addEventListener('click', () => stepTrim('end', -0.2));
    hostEl.querySelector('#ae-end-plus')?.addEventListener('click', () => stepTrim('end', 0.2));

    // Trim mode (Pangkas vs Potong Tengah) & Zoom In/Out
    hostEl.querySelectorAll('[data-ae-trim-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editState.trimMode = btn.getAttribute('data-ae-trim-mode') || 'keep';
        markDirty();
        snapshotHistory();
        render();
      });
    });
    hostEl.querySelector('#ae-zoom-in')?.addEventListener('click', () => {
      zoomLevel = Math.min(8, zoomLevel * 2);
      if (sourceBuffer) {
        const visibleDur = sourceBuffer.duration / zoomLevel;
        viewStartSec = clampNum(currentTimeSec - visibleDur / 2, 0, Math.max(0, sourceBuffer.duration - visibleDur), 0);
      }
      render();
    });
    hostEl.querySelector('#ae-zoom-out')?.addEventListener('click', () => {
      zoomLevel = Math.max(1, Math.floor(zoomLevel / 2));
      if (zoomLevel === 1) viewStartSec = 0;
      render();
    });

    // Interactive Waveform Pointer Drag (Left < handle, Right > handle, or Playhead seek)
    const canvas = hostEl.querySelector('#ae-waveform-canvas');
    if (canvas) {
      const updateFromPointer = (clientX) => {
        if (!sourceBuffer) return;
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const sec = canvasXToTime(x, rect.width);
        const dur = sourceBuffer.duration;
        if (dragTarget === 'start') {
          const clamped = clampTrimRange(sec, editState.trimEnd, dur);
          editState.trimStart = clamped.trimStart;
          editState.trimEnd = clamped.trimEnd;
          markDirty();
          updateStepperReadouts();
          const sInp = hostEl.querySelector('#ae-trim-start');
          const sLbl = hostEl.querySelector('#ae-trim-start-val');
          if (sInp) sInp.value = String(editState.trimStart);
          if (sLbl) sLbl.textContent = formatTimecode(editState.trimStart);
        } else if (dragTarget === 'end') {
          const clamped = clampTrimRange(editState.trimStart, sec, dur);
          editState.trimStart = clamped.trimStart;
          editState.trimEnd = clamped.trimEnd;
          markDirty();
          updateStepperReadouts();
          const eInp = hostEl.querySelector('#ae-trim-end');
          const eLbl = hostEl.querySelector('#ae-trim-end-val');
          if (eInp) eInp.value = String(editState.trimEnd);
          if (eLbl) eLbl.textContent = formatTimecode(editState.trimEnd);
        } else {
          currentTimeSec = sec;
          updateTransportDom();
        }
        drawWaveformCanvas();
      };

      canvas.addEventListener('pointerdown', (e) => {
        if (!sourceBuffer) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const startX = timeToCanvasX(editState.trimStart, rect.width);
        const endX = timeToCanvasX(editState.trimEnd, rect.width);
        const distStart = Math.abs(x - startX);
        const distEnd = Math.abs(x - endX);
        if (distStart <= 20 && distStart <= distEnd) {
          dragTarget = 'start';
        } else if (distEnd <= 20) {
          dragTarget = 'end';
        } else {
          dragTarget = 'playhead';
        }
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
        updateFromPointer(e.clientX);
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!dragTarget) return;
        updateFromPointer(e.clientX);
      });

      const endDrag = () => {
        if (!dragTarget) return;
        const finished = dragTarget;
        dragTarget = null;
        if (finished === 'start' || finished === 'end') {
          snapshotHistory();
        } else if (isPlaying) {
          startPlayback(currentTimeSec);
        }
      };
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);
    }

    // Transport controls
    const togglePlay = () => {
      if (isPlaying) stopPlayback();
      else startPlayback(currentTimeSec);
    };
    hostEl.querySelector('#ae-play-btn')?.addEventListener('click', togglePlay);
    hostEl.querySelector('#ae-mini-play-btn')?.addEventListener('click', togglePlay);
    hostEl.querySelector('#ae-mini-scrub')?.addEventListener('input', (e) => {
      currentTimeSec = Number(e.target.value) || 0;
      updateTransportDom();
      if (isPlaying) startPlayback(currentTimeSec);
    });

    hostEl.querySelector('#ae-jump-start-btn')?.addEventListener('click', () => {
      if (!sourceBuffer) return;
      const trim = clampTrimRange(editState.trimStart, editState.trimEnd, sourceBuffer.duration);
      currentTimeSec = trim.trimStart;
      updateTransportDom();
      drawWaveformCanvas();
      if (isPlaying) startPlayback(currentTimeSec);
    });

    hostEl.querySelector('#ae-jump-end-btn')?.addEventListener('click', () => {
      if (!sourceBuffer) return;
      const trim = clampTrimRange(editState.trimStart, editState.trimEnd, sourceBuffer.duration);
      currentTimeSec = Math.min(trim.trimEnd - 0.1, currentTimeSec + 2);
      updateTransportDom();
      drawWaveformCanvas();
      if (isPlaying) startPlayback(currentTimeSec);
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
      const prevName = editState.exportFileName;
      editState = createDefaultAudioEditorState();
      editState.trimStart = 0;
      editState.trimEnd = Number(sourceBuffer.duration.toFixed(3));
      editState.metadata = prevMeta;
      editState.exportFileName = prevName;
      aiResult = null;
      markDirty();
      snapshotHistory();
      render();
      onToast('Semua efek & equalizer direset ke posisi awal.');
    });

    // Bottom Scrollable Icon Dock Bar
    const dock = hostEl.querySelector('#ae-bottom-dock');
    hostEl.querySelector('#ae-dock-left')?.addEventListener('click', () => {
      dock?.scrollBy({ left: -210, behavior: 'smooth' });
    });
    hostEl.querySelector('#ae-dock-right')?.addEventListener('click', () => {
      dock?.scrollBy({ left: 210, behavior: 'smooth' });
    });
    hostEl.querySelectorAll('[data-ae-dock-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.getAttribute('data-ae-dock-tool');
        if (next && next !== activeTool) {
          activeTool = next;
          render();
          // Ensure active dock item stays comfortably scrolled into view
          hostEl?.querySelector(`[data-ae-dock-tool="${next}"]`)?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
          });
        }
      });
    });

    // Helper for sliders
    const bindRange = (id, onVal, commitHistory = true) => {
      const el = hostEl.querySelector(id);
      if (!el) return;
      el.addEventListener('input', () => {
        onVal(Number(el.value));
        markDirty();
      });
      if (commitHistory) {
        el.addEventListener('change', () => snapshotHistory());
      }
    };

    // Trim & Fade & Volume
    bindRange('#ae-trim-start', (v) => {
      const clamped = clampTrimRange(v, editState.trimEnd, sourceBuffer?.duration || 0);
      editState.trimStart = clamped.trimStart;
      editState.trimEnd = clamped.trimEnd;
      const lbl = hostEl.querySelector('#ae-trim-start-val');
      if (lbl) lbl.textContent = formatTimecode(editState.trimStart);
      updateStepperReadouts();
      drawWaveformCanvas();
    });
    bindRange('#ae-trim-end', (v) => {
      const clamped = clampTrimRange(editState.trimStart, v, sourceBuffer?.duration || 0);
      editState.trimStart = clamped.trimStart;
      editState.trimEnd = clamped.trimEnd;
      const lbl = hostEl.querySelector('#ae-trim-end-val');
      if (lbl) lbl.textContent = formatTimecode(editState.trimEnd);
      updateStepperReadouts();
      drawWaveformCanvas();
    });
    hostEl.querySelector('#ae-reset-trim-btn')?.addEventListener('click', () => {
      if (!sourceBuffer) return;
      editState.trimMode = 'keep';
      editState.trimStart = 0;
      editState.trimEnd = Number(sourceBuffer.duration.toFixed(3));
      markDirty();
      snapshotHistory();
      render();
    });

    hostEl.querySelectorAll('[data-ae-quick-vol]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editState.volumePct = Number(btn.getAttribute('data-ae-quick-vol')) || 100;
        markDirty();
        snapshotHistory();
        render();
      });
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
      snapshotHistory();
    });
    hostEl.querySelector('#ae-reverse-chk')?.addEventListener('change', (e) => {
      editState.reverse = e.target.checked;
      markDirty();
      snapshotHistory();
    });

    hostEl.querySelectorAll('[data-ae-quick-fade]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = Number(btn.getAttribute('data-ae-quick-fade')) || 0;
        if (activeTool === 'fadein') editState.fadeIn = val;
        else editState.fadeOut = val;
        markDirty();
        snapshotHistory();
        render();
      });
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

    // Equalizer + Live SVG Curve + Interactive Rotary Knobs
    hostEl.querySelector('#ae-eq-reset-btn')?.addEventListener('click', () => {
      editState.eqPreset = 'flat';
      editState.eqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      editState.bassBoostPct = 0;
      editState.virtualizerPct = 0;
      markDirty();
      snapshotHistory();
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
        snapshotHistory();
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
        if (lbl) lbl.textContent = `${val > 0 ? `+${Math.round(val)}` : Math.round(val)}`;
        const fill = hostEl.querySelector(`[data-ae-eq-fill="${idx}"]`);
        if (fill) fill.style.height = `${(((val + 12) / 24) * 100).toFixed(1)}%`;
        const curveHost = hostEl.querySelector('#ae-eq-curve-host');
        if (curveHost) curveHost.innerHTML = buildEqCurveSvg(editState.eqGains);
        markDirty();
      });
      input.addEventListener('change', () => snapshotHistory());
    });

    const setKnobValue = (kind, nextPct) => {
      const clamped = Math.round(clampNum(nextPct, 0, 100, 0));
      if (kind === 'bass') editState.bassBoostPct = clamped;
      else editState.virtualizerPct = clamped;
      markDirty();
      const dial = hostEl.querySelector(`[data-ae-knob="${kind}"]`);
      if (dial) {
        dial.setAttribute('aria-valuenow', String(clamped));
        dial.innerHTML = `${buildRotaryKnobSvg(clamped, kind)}<span class="ae-knob-val ae-val-mono" id="ae-${kind}-val">${clamped}%</span>`;
      }
    };

    hostEl.querySelectorAll('[data-ae-knob]').forEach((dial) => {
      const kind = dial.getAttribute('data-ae-knob');
      let dragging = false;
      const calcFromPointer = (ev) => {
        const rect = dial.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let deg = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        // Map 135..405 degrees -> 0..100%
        let rel = deg - 135;
        if (rel < 0) rel += 360;
        if (rel > 270) rel = rel > 315 ? 0 : 270;
        setKnobValue(kind, (rel / 270) * 100);
      };
      dial.addEventListener('pointerdown', (ev) => {
        dragging = true;
        try {
          dial.setPointerCapture(ev.pointerId);
        } catch {
          // Ignore
        }
        calcFromPointer(ev);
      });
      dial.addEventListener('pointermove', (ev) => {
        if (dragging) calcFromPointer(ev);
      });
      const done = () => {
        if (dragging) {
          dragging = false;
          snapshotHistory();
        }
      };
      dial.addEventListener('pointerup', done);
      dial.addEventListener('pointercancel', done);
      dial.addEventListener('keydown', (ev) => {
        const cur = kind === 'bass' ? editState.bassBoostPct : editState.virtualizerPct;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          setKnobValue(kind, cur + 5);
          snapshotHistory();
        } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') {
          ev.preventDefault();
          setKnobValue(kind, cur - 5);
          snapshotHistory();
        }
      });
    });

    hostEl.querySelectorAll('[data-ae-knob-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [kind, rawDelta] = String(btn.getAttribute('data-ae-knob-step') || '').split(':');
        const cur = kind === 'bass' ? editState.bassBoostPct : editState.virtualizerPct;
        const next = rawDelta === '0' ? 0 : cur + Number(rawDelta);
        setKnobValue(kind, next);
        snapshotHistory();
      });
    });

    // Voice Changer
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
        snapshotHistory();
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
      snapshotHistory();
    });
    hostEl.querySelector('#ae-radio-chk')?.addEventListener('change', (e) => {
      editState.radioEffect = e.target.checked;
      markDirty();
      snapshotHistory();
    });

    // Clean, Noise & Repair
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
      snapshotHistory();
    });
    hostEl.querySelector('#ae-dcoffset-chk')?.addEventListener('change', (e) => {
      editState.repairDcOffset = e.target.checked;
      markDirty();
      snapshotHistory();
    });
    hostEl.querySelector('#ae-hum-chk')?.addEventListener('change', (e) => {
      editState.repairHumFilter = e.target.checked;
      markDirty();
      snapshotHistory();
    });
    hostEl.querySelector('#ae-hum-freq-btn')?.addEventListener('click', () => {
      editState.humFreqHz = editState.humFreqHz === 50 ? 60 : 50;
      markDirty();
      snapshotHistory();
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
      snapshotHistory();
      render();
      onToast('Perbaikan cepat & penjernihan audio diaktifkan!');
    });

    // Stem Separation
    hostEl.querySelectorAll('[data-ae-stem-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-ae-stem-mode');
        if (!mode) return;
        editState.stemMode = mode;
        markDirty();
        snapshotHistory();
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
      saveModalOpen = true;
      formatPickerOpen = false;
      handleRenderAndExport(editState.exportFormat);
    });
    hostEl.querySelector('#ae-quick-export-inst')?.addEventListener('click', () => {
      editState.stemMode = 'instrumental';
      editState.stemStrength = Math.max(85, editState.stemStrength);
      markDirty();
      saveModalOpen = true;
      formatPickerOpen = false;
      handleRenderAndExport(editState.exportFormat);
    });

    // Mix & Join
    hostEl.querySelector('#ae-mix-file-input')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (f) handleAddMixTrack(f);
    });
    hostEl.querySelector('#ae-add-demo-track-btn')?.addEventListener('click', handleAddDemoMixTrack);
    hostEl.querySelectorAll('[data-ae-mix-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editState.mixMode = btn.getAttribute('data-ae-mix-mode') || 'overlay';
        markDirty();
        snapshotHistory();
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

    // Metadata
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
    hostEl.querySelector('#ae-meta-lookup-btn')?.addEventListener('click', handleMetadataLookup);
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
        snapshotHistory();
        render();
        onToast(`Identitas "${item.title}" diterapkan dari ${item.source}.`);
      });
    });

    // AI Studio
    hostEl.querySelector('#ae-ai-engine-select')?.addEventListener('change', (e) => {
      editState.aiEngine = e.target.value;
    });
    hostEl.querySelector('#ae-ai-goal-select')?.addEventListener('change', (e) => {
      editState.aiGoal = e.target.value;
    });
    hostEl.querySelector('#ae-ai-custom-prompt')?.addEventListener('input', (e) => {
      editState.aiCustomPrompt = e.target.value;
    });
    hostEl.querySelector('#ae-run-ai-btn')?.addEventListener('click', handleRunAiEngineer);

    // Save Modal ("Simpan sebagai")
    const closeSaveModal = () => {
      saveModalOpen = false;
      formatPickerOpen = false;
      render();
    };
    hostEl.querySelector('#ae-save-modal-close')?.addEventListener('click', closeSaveModal);
    hostEl.querySelector('#ae-save-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'ae-save-modal-backdrop' && !renderingExport) {
        closeSaveModal();
      }
    });
    hostEl.querySelector('#ae-save-filename')?.addEventListener('input', (e) => {
      editState.exportFileName = e.target.value;
    });
    hostEl.querySelector('#ae-toggle-format-picker')?.addEventListener('click', () => {
      formatPickerOpen = !formatPickerOpen;
      render();
    });
    hostEl.querySelectorAll('[data-ae-export-fmt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editState.exportFormat = btn.getAttribute('data-ae-export-fmt') || 'mp3';
        formatPickerOpen = false;
        render();
      });
    });
    hostEl.querySelectorAll('[data-ae-quality-br]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editState.exportBitrate = Number(btn.getAttribute('data-ae-quality-br')) || 192;
        render();
      });
    });
    hostEl.querySelectorAll('[data-ae-sr]').forEach((btn) => {
      btn.addEventListener('click', () => {
        editState.exportSampleRate = Number(btn.getAttribute('data-ae-sr')) || 44100;
        render();
      });
    });
    hostEl.querySelector('#ae-export-btn')?.addEventListener('click', () => handleRenderAndExport());
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
