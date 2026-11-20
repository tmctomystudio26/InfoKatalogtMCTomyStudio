/**
 * Manifest AI — Natural Multilingual & Code-Switching Voice Engine (v64)
 * - Studio-grade human neural voices via Microsoft Edge Neural TTS (319 voices, cpu-basic)
 * - Automatic mixed-language (code-switching) pronunciation: Indonesian spans use native
 *   Indonesian voices while English / Japanese / Korean / Mandarin / Arabic spans seamlessly
 *   switch to matching-gender native neural voices with lookahead pre-fetching.
 * - 3-layer zero-failure playback: Edge Neural TTS -> TikTok Neural TTS -> Web Speech API.
 */

import {
  cleanTextForSpeech,
  getVoiceProfileById,
  resolveVoiceForSegment,
  segmentMultilingualSpeech,
} from './manifest-ai-logic.js?v=64';

const EDGE_TTS_HOST = 'https://innoai-edge-tts-text-to-speech.hf.space';
const TIKTOK_TTS_URL = 'https://tiktok-tts.weilnet.workers.dev/api/generation';
const TTS_TIMEOUT_MS = 11000;
const MAX_AUDIO_CACHE = 40;

const STYLE_PROSODY = Object.freeze({
  natural: { rateOffset: 0, pitchOffset: 0 },
  ekspresif: { rateOffset: 4, pitchOffset: 3 },
  tenang: { rateOffset: -6, pitchOffset: -2 },
});

function base64ToBlobUrl(b64, mime = 'audio/mpeg') {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function createAbortWithTimeout(parentSignal, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onParent = () => ctrl.abort();
  if (parentSignal) {
    if (parentSignal.aborted) {
      clearTimeout(timer);
      ctrl.abort();
    } else {
      parentSignal.addEventListener('abort', onParent, { once: true });
    }
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (parentSignal) parentSignal.removeEventListener('abort', onParent);
    },
  };
}

/**
 * Fetches an MP3 audio URL from Microsoft Edge Neural TTS Space (`cpu-basic`, zero GPU limits).
 */
async function synthesizeEdgeNeuralTts(text, voiceProfile, { ratePct = 0, pitchHz = 0, signal = null } = {}) {
  const linked = createAbortWithTimeout(signal, TTS_TIMEOUT_MS);
  try {
    const r1 = await fetch(`${EDGE_TTS_HOST}/gradio_api/call/tts_interface`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          text,
          voiceProfile.edgeVoice,
          Math.round(clamp(ratePct, -35, 45)),
          Math.round(clamp(pitchHz, -15, 15)),
        ],
      }),
      signal: linked.signal,
    });
    if (!r1.ok) throw new Error(`EDGE_POST_${r1.status}`);
    const j1 = await r1.json();
    if (!j1?.event_id) throw new Error('EDGE_NO_EVENT_ID');

    const r2 = await fetch(`${EDGE_TTS_HOST}/gradio_api/call/tts_interface/${encodeURIComponent(j1.event_id)}`, {
      signal: linked.signal,
    });
    if (!r2.ok) throw new Error(`EDGE_SSE_${r2.status}`);
    const sse = await r2.text();

    // Parse Gradio SSE complete event for FileData URL
    let audioUrl = '';
    const lines = sse.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === 'null') continue;
      try {
        const parsed = JSON.parse(payload);
        const first = Array.isArray(parsed) ? parsed[0] : parsed;
        if (first && typeof first === 'object' && typeof first.url === 'string' && first.url.startsWith('http')) {
          audioUrl = first.url;
        } else if (first && typeof first === 'object' && typeof first.path === 'string') {
          audioUrl = `${EDGE_TTS_HOST}/gradio_api/file=${first.path}`;
        }
      } catch {
        // Ignore non-JSON chunk
      }
    }

    if (!audioUrl) throw new Error('EDGE_NO_AUDIO_URL');

    // Fetch MP3 bytes into a local Blob URL so playback is gapless and replayable without network hiccups
    const ar = await fetch(audioUrl, { signal: linked.signal });
    if (!ar.ok) throw new Error(`EDGE_MP3_${ar.status}`);
    const blob = await ar.blob();
    if (!blob || blob.size < 128) throw new Error('EDGE_EMPTY_AUDIO');
    return URL.createObjectURL(blob);
  } finally {
    linked.cleanup();
  }
}

/**
 * Backup Neural TTS via TikTok Workers (`CORS: *`, fast base64 MP3).
 */
async function synthesizeTikTokTts(text, voiceProfile, { signal = null } = {}) {
  const voiceCode = voiceProfile.tiktokVoice || 'id_001';
  const linked = createAbortWithTimeout(signal, 7000);
  try {
    const r = await fetch(TIKTOK_TTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 260), voice: voiceCode }),
      signal: linked.signal,
    });
    if (!r.ok) throw new Error(`TIKTOK_${r.status}`);
    const j = await r.json();
    if (!j?.success || !j?.data) throw new Error('TIKTOK_EMPTY');
    return base64ToBlobUrl(j.data, 'audio/mpeg');
  } finally {
    linked.cleanup();
  }
}

/**
 * Picks the best available local browser voice for Web Speech API offline fallback.
 */
function pickBrowserVoice(langCode = 'id-ID', gender = 'female') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  const base = String(langCode || 'id-ID').toLowerCase().split('-')[0];
  const matchesLang = voices.filter((v) => String(v.lang || '').toLowerCase().startsWith(base));
  const pool = matchesLang.length > 0 ? matchesLang : voices;

  const genderHintRe =
    gender === 'male'
      ? /\b(ardi|male|pria|andrew|brian|guy|ryan|david|daniel|thomas|mark|keita|yunxi|hamed|conrad|osman|remy)\b/i
      : /\b(gadis|female|wanita|ava|emma|jenny|sonia|aria|samantha|zira|nanami|sunhi|xiaoxiao|zariyah|yasmin|vivienne|elvira)\b/i;

  const naturalRe = /\b(natural|neural|online|google|enhanced|premium)\b/i;

  const scored = pool
    .map((v) => {
      let score = 0;
      if (String(v.lang || '').toLowerCase() === String(langCode).toLowerCase()) score += 20;
      if (naturalRe.test(v.name)) score += 30;
      if (genderHintRe.test(v.name)) score += 25;
      return { v, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.v || null;
}

/**
 * Offline / instant Web Speech API utterance playback for a single segment.
 */
function speakBrowserFallback(text, voiceProfile, { rate = 1.0, style = 'natural', signal = null } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance !== 'function') {
      reject(new Error('SPEECH_UNSUPPORTED'));
      return;
    }
    if (signal?.aborted) {
      reject(new Error('ABORTED'));
      return;
    }

    const utt = new window.SpeechSynthesisUtterance(text);
    utt.lang = voiceProfile.lang || 'id-ID';
    const picked = pickBrowserVoice(utt.lang, voiceProfile.gender);
    if (picked) utt.voice = picked;
    const prosody = STYLE_PROSODY[style] || STYLE_PROSODY.natural;
    utt.rate = clamp(Number(rate || 1.0) + prosody.rateOffset * 0.008, 0.75, 1.45);
    utt.pitch = clamp(1.0 + ((voiceProfile.defaultPitch || 0) + prosody.pitchOffset) * 0.025, 0.8, 1.25);

    const onAbort = () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
      reject(new Error('ABORTED'));
    };

    if (signal) signal.addEventListener('abort', onAbort, { once: true });

    utt.onend = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    };
    utt.onerror = (ev) => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (signal?.aborted || ev?.error === 'canceled' || ev?.error === 'interrupted') {
        reject(new Error('ABORTED'));
      } else {
        reject(new Error(`SPEECH_${ev?.error || 'ERR'}`));
      }
    };

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    } catch (err) {
      if (signal) signal.removeEventListener('abort', onAbort);
      reject(err);
    }
  });
}

/**
 * Creates a reusable natural voice player instance for Manifest AI.
 */
export function createManifestAiVoicePlayer() {
  let audioEl = null;
  let activeSessionId = 0;
  let activeAbort = null;
  let currentMsgId = null;
  let isLoading = false;
  let isPlaying = false;
  let activeLangBadge = '';
  const audioCache = new Map(); // cacheKey -> objectUrl

  const ensureAudioElement = () => {
    if (typeof document === 'undefined') return null;
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.preload = 'auto';
      audioEl.setAttribute('playsinline', '');
    }
    return audioEl;
  };

  const cachePut = (key, blobUrl) => {
    if (audioCache.has(key)) return;
    if (audioCache.size >= MAX_AUDIO_CACHE) {
      const oldestKey = audioCache.keys().next().value;
      const oldUrl = audioCache.get(oldestKey);
      audioCache.delete(oldestKey);
      try {
        if (oldUrl) URL.revokeObjectURL(oldUrl);
      } catch {
        // Ignore
      }
    }
    audioCache.set(key, blobUrl);
  };

  const fetchSegmentAudioUrl = async (segment, voiceProfile, { rate, style, signal }) => {
    const prosody = STYLE_PROSODY[style] || STYLE_PROSODY.natural;
    const ratePct = Math.round((Number(rate || 1.0) - 1.0) * 100) + (voiceProfile.defaultRateDelta || 0) + prosody.rateOffset;
    const pitchHz = (voiceProfile.defaultPitch || 0) + prosody.pitchOffset;

    const cacheKey = `${voiceProfile.id}|${ratePct}|${pitchHz}|${segment.text}`;
    if (audioCache.has(cacheKey)) {
      return { url: audioCache.get(cacheKey), engine: 'edge-cache' };
    }

    // Layer 1: Microsoft Edge Neural TTS (highest human naturalness, 319 voices)
    try {
      const url = await synthesizeEdgeNeuralTts(segment.text, voiceProfile, { ratePct, pitchHz, signal });
      cachePut(cacheKey, url);
      return { url, engine: 'edge-neural' };
    } catch (err) {
      if (signal?.aborted) throw err;
    }

    // Layer 2: TikTok Neural TTS backup (for supported Latin/Asian languages)
    if (['id', 'en', 'ja', 'ko', 'fr', 'de', 'es'].includes(segment.lang)) {
      try {
        const url = await synthesizeTikTokTts(segment.text, voiceProfile, { signal });
        cachePut(cacheKey, url);
        return { url, engine: 'tiktok-neural' };
      } catch (err) {
        if (signal?.aborted) throw err;
      }
    }

    // Layer 3: Fallback signal for native Web Speech API
    return { url: null, engine: 'browser-speech' };
  };

  const playBlobUrl = (blobUrl, playbackRate = 1.0, signal = null) =>
    new Promise((resolve, reject) => {
      const el = ensureAudioElement();
      if (!el) return reject(new Error('NO_AUDIO_EL'));
      if (signal?.aborted) return reject(new Error('ABORTED'));

      const cleanup = () => {
        el.onended = null;
        el.onerror = null;
        if (signal) signal.removeEventListener('abort', onAbort);
      };

      const onAbort = () => {
        cleanup();
        try {
          el.pause();
          el.removeAttribute('src');
          el.load();
        } catch {
          // Ignore
        }
        reject(new Error('ABORTED'));
      };

      if (signal) signal.addEventListener('abort', onAbort, { once: true });

      el.onended = () => {
        cleanup();
        resolve();
      };
      el.onerror = () => {
        cleanup();
        reject(new Error('AUDIO_PLAY_ERR'));
      };

      el.src = blobUrl;
      el.playbackRate = clamp(Number(playbackRate || 1.0), 0.75, 1.5);
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          cleanup();
          reject(err);
        });
      }
    });

  const stop = (onStateChange = null) => {
    activeSessionId += 1;
    if (activeAbort) {
      try {
        activeAbort.abort();
      } catch {
        // Ignore
      }
      activeAbort = null;
    }
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.currentTime = 0;
      } catch {
        // Ignore
      }
    }
    try {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore
    }
    currentMsgId = null;
    isLoading = false;
    isPlaying = false;
    activeLangBadge = '';
    if (onStateChange) {
      onStateChange({ msgId: null, isLoading: false, isPlaying: false, langBadge: '' });
    }
  };

  /**
   * Speaks a message naturally with mixed-language code-switching and gapless lookahead prefetching.
   */
  const play = async ({
    msgId,
    text,
    catalogData = null,
    voiceId = 'id-gadis',
    rate = 1.0,
    style = 'natural',
    codeSwitch = true,
    onStateChange = () => {},
    onError = () => {},
  }) => {
    stop();
    const mySession = ++activeSessionId;
    const ctrl = new AbortController();
    activeAbort = ctrl;
    currentMsgId = msgId;

    const cleanSpeech = cleanTextForSpeech(text, catalogData);
    if (!cleanSpeech) {
      stop(onStateChange);
      return;
    }

    const baseProfile = getVoiceProfileById(voiceId);
    const segments = segmentMultilingualSpeech(cleanSpeech, baseProfile.baseLang, {
      maxSegmentChars: 220,
      codeSwitch,
    });
    if (segments.length === 0) {
      stop(onStateChange);
      return;
    }

    // Unlock audio element synchronously on click gesture for mobile browsers
    ensureAudioElement();

    isLoading = true;
    isPlaying = false;
    activeLangBadge = String(segments[0].lang || 'id').toUpperCase();
    onStateChange({ msgId, isLoading: true, isPlaying: false, langBadge: activeLangBadge });

    try {
      // Pre-resolve voice profile for every segment (matching gender + authentic native pronunciation!)
      const jobs = segments.map((seg) => ({
        segment: seg,
        voiceProfile: resolveVoiceForSegment(voiceId, seg.lang, codeSwitch),
      }));

      // Start fetching segment 0 immediately; prefetch segment i+1 while segment i plays!
      let nextFetchPromise = fetchSegmentAudioUrl(jobs[0].segment, jobs[0].voiceProfile, {
        rate,
        style,
        signal: ctrl.signal,
      });

      for (let i = 0; i < jobs.length; i += 1) {
        if (mySession !== activeSessionId || ctrl.signal.aborted) return;

        const currentJob = jobs[i];
        const fetched = await nextFetchPromise;
        if (mySession !== activeSessionId || ctrl.signal.aborted) return;

        // Immediately kick off lookahead prefetch for the NEXT segment while this one plays!
        if (i + 1 < jobs.length) {
          nextFetchPromise = fetchSegmentAudioUrl(jobs[i + 1].segment, jobs[i + 1].voiceProfile, {
            rate,
            style,
            signal: ctrl.signal,
          }).catch(() => ({ url: null, engine: 'browser-speech' }));
        }

        isLoading = false;
        isPlaying = true;
        activeLangBadge = String(currentJob.segment.lang || 'id').toUpperCase();
        onStateChange({ msgId, isLoading: false, isPlaying: true, langBadge: activeLangBadge });

        if (fetched.url) {
          try {
            // Note: Edge neural TTS already baked ratePct into audio; keep playbackRate 1.0 for Edge,
            // and apply user rate smoothly if TikTok backup was used.
            const htmlRate = fetched.engine === 'tiktok-neural' ? rate : 1.0;
            await playBlobUrl(fetched.url, htmlRate, ctrl.signal);
          } catch (playErr) {
            if (ctrl.signal.aborted || mySession !== activeSessionId) return;
            // Graceful fallback to browser speech if HTMLAudio playback blocked/failed
            await speakBrowserFallback(currentJob.segment.text, currentJob.voiceProfile, {
              rate,
              style,
              signal: ctrl.signal,
            });
          }
        } else {
          await speakBrowserFallback(currentJob.segment.text, currentJob.voiceProfile, {
            rate,
            style,
            signal: ctrl.signal,
          });
        }
      }

      if (mySession === activeSessionId) {
        stop(onStateChange);
      }
    } catch (err) {
      if (mySession === activeSessionId) {
        const aborted = err?.message === 'ABORTED' || ctrl.signal.aborted;
        stop(onStateChange);
        if (!aborted) {
          onError('Audio suara tidak dapat diputar di browser ini. Coba klik lagi atau pilih suara lain.');
        }
      }
    }
  };

  const destroy = () => {
    stop();
    for (const url of audioCache.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignore
      }
    }
    audioCache.clear();
    audioEl = null;
  };

  return {
    play,
    stop,
    destroy,
    getState: () => ({
      msgId: currentMsgId,
      isLoading,
      isPlaying,
      langBadge: activeLangBadge,
    }),
  };
}
