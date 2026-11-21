/**
 * Manifest AI — Chat Workspace UI Controller (v66)
 * Multi-Model AI Ensemble, Live Web Research Grounding, Fullscreen Workspace Mode,
 * Fast Low-Latency Natural Single-Speaker Voice Reader (31 Unique Male & Female Neural Voices),
 * Zero-Leak Owner Privacy Shield, Responsive Markdown Tables & Persistent History.
 */

import {
  MANIFEST_AI_PROVIDERS,
  MANIFEST_AI_STORAGE_KEYS,
  MANIFEST_AI_VOICE_CATALOG,
  createChatThread,
  deleteChatThread,
  deriveThreadTitle,
  escapeAiHtml,
  exportThreadMarkdown,
  formatCooldownShort,
  getCooldownRemainingMs,
  getProviderMeta,
  getVoiceProfileById,
  maskApiKey,
  normalizeChatThreads,
  redactSensitiveOwnerData,
  renderMarkdownSafe,
  upsertByokKey,
  upsertChatThread,
} from './manifest-ai-logic.js?v=67';
import {
  getCachedModelRegistry,
  isPuterAiReady,
  loadManifestudioCatalogData,
  loadStoredByokKeys,
  loadStoredLimitMap,
  loadStoredPrefs,
  saveStoredByokKeys,
  saveStoredLimitMap,
  saveStoredPrefs,
  sendManifestAiMessage,
  signInPuterSdk,
  syncLiveModelRegistry,
  testByokKeyConnection,
} from './manifest-ai.js?v=67';
import { createManifestAiVoicePlayer } from './manifest-ai-voice.js?v=67';

const STARTER_PROMPTS = Object.freeze([
  {
    title: 'Bandingkan & rancang strategi konten',
    sub: 'Gabungkan sudut pandang multi-model untuk ide konten viral 7 hari',
    prompt:
      'Buatkan rencana strategi konten video pendek selama 7 hari untuk brand studio kreatif digital, lengkap dengan hook 3 detik pertama dan CTA yang natural.',
  },
  {
    title: 'Bantu tulis & optimalkan kode',
    sub: 'Buat fungsi bersih beserta penjelasan kompleksitas dan edge case',
    prompt:
      'Buatkan fungsi JavaScript untuk rate-limiter token bucket yang ringan tanpa dependency eksternal, lengkap dengan contoh penggunaan dan penjelasan cara kerjanya.',
  },
  {
    title: 'Ringkas & susun proposal bisnis',
    sub: 'Kerangka penawaran profesional yang langsung siap dikirim ke klien',
    prompt:
      'Bantu saya menyusun kerangka proposal penawaran jasa pembuatan website & manajemen media sosial untuk UMKM agar ringkas, meyakinkan, dan jelas rincian paketnya.',
  },
  {
    title: 'Belajar konsep rumit secara sederhana',
    sub: 'Penjelasan terstruktur bertahap dengan analogi kehidupan nyata',
    prompt:
      'Jelaskan cara kerja arsitektur Transformer pada AI modern menggunakan analogi sederhana yang mudah dipahami pemula, lalu berikan ringkasan poin pentingnya.',
  },
]);

function readStoredThreads() {
  try {
    const raw = localStorage.getItem(MANIFEST_AI_STORAGE_KEYS.chats);
    if (!raw) return [];
    const cleaned = normalizeChatThreads(JSON.parse(raw));
    // Re-persist scrubbed threads so any pre-v66 cached leaked numbers are wiped permanently
    const serialized = JSON.stringify(cleaned);
    if (serialized !== raw) {
      localStorage.setItem(MANIFEST_AI_STORAGE_KEYS.chats, serialized);
    }
    return cleaned;
  } catch {
    return [];
  }
}

function writeStoredThreads(threads) {
  try {
    localStorage.setItem(MANIFEST_AI_STORAGE_KEYS.chats, JSON.stringify(normalizeChatThreads(threads)));
  } catch {
    // Ignore storage quota errors
  }
}

function formatRelativeTime(ts) {
  const diff = Math.max(0, Date.now() - Number(ts || 0));
  if (diff < 60_000) return 'Baru saja';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} mnt lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  const d = new Date(ts);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

function formatSyncTime(ts) {
  if (!ts) return 'Belum disinkronkan';
  try {
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Baru saja';
  }
}

function formatLatency(ms) {
  const n = Number(ms) || 0;
  if (n <= 0) return '';
  if (n < 1000) return `${n} md`;
  return `${(n / 1000).toFixed(1)} dtk`;
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function createManifestAiController({ onToast = () => {} } = {}) {
  let hostEl = null;
  let mounted = false;
  let activeAbort = null;

  const storedThreads = readStoredThreads();
  const initialThread = storedThreads[0] || createChatThread('Percakapan Baru');

  const voicePlayer = createManifestAiVoicePlayer();
  let savedScrollY = 0;

  const state = {
    threads: storedThreads.length > 0 ? storedThreads : [initialThread],
    activeThreadId: initialThread.id,
    historyQuery: '',
    drawerOpen: false,
    isFullscreen: false,
    activeModal: null, // 'models' | 'byok' | 'voice' | null
    confirmClearAll: false,
    renamingThreadId: null,
    renameDraft: '',

    prefs: loadStoredPrefs(),
    byokKeys: loadStoredByokKeys(),
    limitMap: loadStoredLimitMap(),
    registry: getCachedModelRegistry(),
    catalogData: null,
    syncingRegistry: false,
    puterLoading: false,
    puterReady: isPuterAiReady(),

    // Natural Multilingual Voice Reader state
    voice: {
      msgId: null,
      isLoading: false,
      isPlaying: false,
      langBadge: '',
      voiceName: '',
      genderFilter: 'all',
      langFilter: 'all',
    },

    // BYOK form state
    byokForm: {
      providerId: 'gemini',
      label: '',
      apiKey: '',
      model: '',
      baseUrl: '',
      autoLatest: true,
    },
    testingKeyId: null,
    keyTestFeedback: {},

    // Composer & streaming state
    draft: '',
    sending: false,
    streamingText: '',
    lastError: null,
    lastFailedPrompt: '',
  };

  function getActiveThread() {
    let found = state.threads.find((t) => t.id === state.activeThreadId);
    if (!found) {
      found = state.threads[0] || createChatThread('Percakapan Baru');
      if (state.threads.length === 0) state.threads = [found];
      state.activeThreadId = found.id;
    }
    return found;
  }

  function persistThreads() {
    writeStoredThreads(state.threads);
  }

  function persistPrefs() {
    saveStoredPrefs(state.prefs);
  }

  function persistByok() {
    state.byokKeys = saveStoredByokKeys(state.byokKeys);
  }

  function scrollMessagesToBottom() {
    const stream = hostEl?.querySelector('.mai-messages-scroll');
    if (!stream) return;
    requestAnimationFrame(() => {
      stream.scrollTop = stream.scrollHeight;
    });
  }

  function autoResizeTextarea(ta) {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(180, Math.max(44, ta.scrollHeight))}px`;
  }

  function syncFullscreenBodyClass() {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('mai-fullscreen-open', Boolean(state.isFullscreen));
  }

  function enterFullscreen() {
    if (state.isFullscreen) return;
    savedScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    state.isFullscreen = true;
    syncFullscreenBodyClass();
    render();
    scrollMessagesToBottom();
    // Optional native Fullscreen API on documentElement (persistent across re-renders so modals & toasts remain visible)
    try {
      const target = document.documentElement;
      if (target && typeof target.requestFullscreen === 'function' && !document.fullscreenElement) {
        Promise.resolve(target.requestFullscreen()).catch(() => {});
      }
    } catch {
      // CSS fixed 100vw x 100dvh fullscreen already active
    }
  }

  function exitFullscreen({ fromNativeEvent = false } = {}) {
    if (!state.isFullscreen) return;
    state.isFullscreen = false;
    syncFullscreenBodyClass();
    if (!fromNativeEvent && typeof document !== 'undefined' && document.fullscreenElement) {
      try {
        Promise.resolve(document.exitFullscreen()).catch(() => {});
      } catch {
        // Ignore
      }
    }
    if (mounted) {
      render();
      if (typeof window !== 'undefined' && savedScrollY > 0) {
        requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
      }
    }
  }

  function toggleFullscreen() {
    if (state.isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }

  const handleNativeFullscreenChange = () => {
    if (!mounted) return;
    if (!document.fullscreenElement && state.isFullscreen) {
      // Only exit if the shell itself was the native fullscreen target and user pressed Esc natively
      exitFullscreen({ fromNativeEvent: true });
    }
  };

  function handleVoiceStateUpdate(nextVoice) {
    state.voice.msgId = nextVoice.msgId;
    state.voice.isLoading = nextVoice.isLoading;
    state.voice.isPlaying = nextVoice.isPlaying;
    state.voice.langBadge = nextVoice.langBadge || '';
    state.voice.voiceName = nextVoice.voiceName || '';
    if (mounted) {
      // Update speak buttons & playback bar smoothly without losing input focus!
      syncVoiceControlsInDom();
    }
  }

  function syncVoiceControlsInDom() {
    if (!hostEl) return;
    const activeId = state.voice.msgId;
    const isBusy = state.voice.isLoading || state.voice.isPlaying;

    hostEl.querySelectorAll('[data-mai-speak-msg]').forEach((btn) => {
      const mid = btn.getAttribute('data-mai-speak-msg');
      const isThis = mid && mid === activeId && isBusy;
      btn.classList.toggle('is-speaking', Boolean(isThis));
      btn.setAttribute('aria-pressed', isThis ? 'true' : 'false');
      if (isThis) {
        btn.textContent = state.voice.isLoading
          ? 'Memuat suara...'
          : `Berhenti${state.voice.langBadge ? ` · ${state.voice.langBadge}` : ''}`;
      } else {
        btn.textContent = 'Dengarkan';
      }
    });

    hostEl.querySelectorAll('[data-mai-preview-voice]').forEach((btn) => {
      const vid = btn.getAttribute('data-mai-preview-voice');
      const isThis = activeId === `preview:${vid}` && isBusy;
      btn.classList.toggle('is-speaking', Boolean(isThis));
      btn.textContent = isThis ? (state.voice.isLoading ? 'Memuat...' : 'Berhenti') : 'Coba';
    });

    const topVoiceBtn = hostEl.querySelector('[data-mai-action="open-voice"]');
    if (topVoiceBtn) {
      topVoiceBtn.classList.toggle('is-accent', Boolean(isBusy || state.prefs.voiceAutoRead));
    }

    const bar = hostEl.querySelector('#mai-voice-now-playing');
    if (bar) {
      const showBar = Boolean(isBusy && activeId && !String(activeId).startsWith('preview:'));
      bar.hidden = !showBar;
      if (showBar) {
        const vp = getVoiceProfileById(state.prefs.voiceId);
        const speakerName = state.voice.voiceName || vp.name;
        const labelEl = bar.querySelector('[data-mai-voice-bar-label]');
        if (labelEl) {
          labelEl.textContent = state.voice.isLoading
            ? `Menyiapkan suara ${speakerName}...`
            : `Membacakan (${speakerName}${state.voice.langBadge ? ` · ${state.voice.langBadge}` : ''})`;
        }
      }
    }
  }

  function stopVoicePlayback() {
    voicePlayer.stop(handleVoiceStateUpdate);
  }

  function speakMessage(msgId, text) {
    if (!text || !String(text).trim()) return;
    if (state.voice.msgId === msgId && (state.voice.isLoading || state.voice.isPlaying)) {
      stopVoicePlayback();
      return;
    }
    voicePlayer.play({
      msgId,
      text,
      catalogData: state.catalogData,
      voiceId: state.prefs.voiceId,
      rate: state.prefs.voiceRate,
      style: state.prefs.voiceStyle,
      codeSwitch: state.prefs.voiceCodeSwitch,
      onStateChange: handleVoiceStateUpdate,
      onError: (msg) => onToast(msg),
    });
  }

  function previewVoiceProfile(voiceId) {
    const previewKey = `preview:${voiceId}`;
    if (state.voice.msgId === previewKey && (state.voice.isLoading || state.voice.isPlaying)) {
      stopVoicePlayback();
      return;
    }
    const vp = getVoiceProfileById(voiceId);
    const sampleByGroup = {
      id: `Halo! Saya ${vp.name}. Pak Salim membeli buku, The King Of Madagascar and Island, di perpustakaan yang melelang buku.`,
      multi: `Halo! Saya ${vp.name}. Pak Salim membeli buku, The King Of Madagascar and Island, di perpustakaan yang melelang buku.`,
      en: `Hello, I'm ${vp.name}. Pak Salim bought The King Of Madagascar and Island at a relaxed pace with natural voice flow.`,
      ms: `Helo, saya ${vp.name}. Selamat datang ke Manifest AI dengan gaya pertuturan yang santai dan semula jadi.`,
      asia:
        vp.baseLang === 'ja'
          ? `こんにちは、${vp.name}です。Manifest AIへようこそ。自然な声でお話しします。`
          : vp.baseLang === 'ko'
            ? `안녕하세요, 저는 ${vp.name}입니다. Manifest AI와 함께 자연스럽게 대화해 보세요.`
            : `你好，我是${vp.name}。欢迎使用 Manifest AI，我可以为您自然朗读回答。`,
      ar: 'مرحباً بك في مانيفست إيه آي، أقرأ لك الإجابات بصوت طبيعي وواضح.',
      eu:
        vp.baseLang === 'fr'
          ? `Bonjour, je suis ${vp.name}. Bienvenue sur Manifest AI, pak Salim membeli buku The King Of Madagascar.`
          : vp.baseLang === 'es'
            ? `¡Hola! Soy ${vp.name}. Bienvenido a Manifest AI con una voz muy natural.`
            : `Hallo, ich bin ${vp.name}. Willkommen bei Manifest AI mit einer natürlichen Stimme.`,
    };
    const sampleText = sampleByGroup[vp.langGroup] || sampleByGroup.multi;
    voicePlayer.play({
      msgId: previewKey,
      text: sampleText,
      catalogData: state.catalogData,
      voiceId: vp.id,
      rate: state.prefs.voiceRate,
      style: state.prefs.voiceStyle,
      codeSwitch: state.prefs.voiceCodeSwitch,
      onStateChange: handleVoiceStateUpdate,
      onError: (msg) => onToast(msg),
    });
  }

  async function refreshRegistry(force = false) {
    if (state.syncingRegistry) return;
    state.syncingRegistry = true;
    if (state.activeModal === 'models') render();
    try {
      const next = await syncLiveModelRegistry({ force });
      state.registry = next;
      if (force) {
        onToast('Daftar model terbaru berhasil disinkronkan real-time.');
      }
    } catch {
      if (force) onToast('Sinkronisasi sebagian menggunakan katalog terbaru tersimpan.');
    } finally {
      state.syncingRegistry = false;
      if (mounted) render();
    }
  }

  async function activatePuterSdk(showFeedback = true) {
    if (state.puterLoading) return;
    state.puterLoading = true;
    if (mounted) render();
    try {
      const ok = await signInPuterSdk(7000);
      state.puterReady = ok;
      if (showFeedback) {
        onToast(
          ok
            ? 'Jalur Gratis Puter Multi-Model (kuota per pengguna) aktif!'
            : 'Aktivasi Puter dibatalkan atau tidak terjangkau; jalur gratis lain tetap aktif.'
        );
      }
    } finally {
      state.puterLoading = false;
      if (mounted) render();
    }
  }

  function createNewChat() {
    const existingEmpty = state.threads.find((t) => (t.messages || []).length === 0);
    if (existingEmpty) {
      state.activeThreadId = existingEmpty.id;
      state.drawerOpen = false;
      state.lastError = null;
      render();
      hostEl?.querySelector('#mai-prompt-input')?.focus();
      return;
    }
    const fresh = createChatThread('Percakapan Baru');
    state.threads = upsertChatThread(state.threads, fresh);
    state.activeThreadId = fresh.id;
    state.drawerOpen = false;
    state.lastError = null;
    persistThreads();
    render();
    hostEl?.querySelector('#mai-prompt-input')?.focus();
  }

  function selectThread(threadId) {
    if (state.sending) return;
    const exists = state.threads.find((t) => t.id === threadId);
    if (!exists) return;
    state.activeThreadId = exists.id;
    state.drawerOpen = false;
    state.lastError = null;
    state.renamingThreadId = null;
    render();
    scrollMessagesToBottom();
  }

  function removeThread(threadId) {
    if (state.sending) return;
    state.threads = deleteChatThread(state.threads, threadId);
    if (state.threads.length === 0) {
      const fresh = createChatThread('Percakapan Baru');
      state.threads = [fresh];
      state.activeThreadId = fresh.id;
    } else if (state.activeThreadId === threadId) {
      state.activeThreadId = state.threads[0].id;
    }
    persistThreads();
    render();
    onToast('Riwayat percakapan dihapus.');
  }

  function clearAllHistory() {
    if (state.sending) return;
    const fresh = createChatThread('Percakapan Baru');
    state.threads = [fresh];
    state.activeThreadId = fresh.id;
    state.confirmClearAll = false;
    state.drawerOpen = false;
    state.lastError = null;
    persistThreads();
    render();
    onToast('Seluruh riwayat chat telah dibersihkan.');
  }

  function downloadActiveMarkdown() {
    const thread = getActiveThread();
    if (!thread.messages?.length) {
      onToast('Belum ada pesan untuk diekspor.');
      return;
    }
    const md = exportThreadMarkdown(thread);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = String(thread.title || 'manifest-ai')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);
    a.download = `manifest-ai-${slug || 'chat'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast('Riwayat percakapan diekspor ke Markdown (.md).');
  }

  function stopGeneration() {
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
    // Preserve partial streamed text if already generated
    const partial = String(state.streamingText || '').trim();
    if (partial) {
      const thread = getActiveThread();
      const partialMsg = {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: partial,
        createdAt: Date.now(),
      };
      state.threads = upsertChatThread(state.threads, {
        ...thread,
        updatedAt: Date.now(),
        messages: [...(thread.messages || []), partialMsg],
      });
      persistThreads();
    }
    state.sending = false;
    state.streamingText = '';
    render();
  }

  async function handleSendPrompt(overridePrompt = null, { regenerate = false } = {}) {
    if (state.sending) return;
    const thread = getActiveThread();
    let promptText = typeof overridePrompt === 'string' ? overridePrompt.trim() : state.draft.trim();

    if (regenerate) {
      // Drop last assistant message and re-send last user prompt
      const msgs = [...(thread.messages || [])];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
        msgs.pop();
      }
      const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
      if (!lastUser) return;
      promptText = lastUser.content;
      // History excludes the last user turn we are regenerating
      const cutIdx = msgs.lastIndexOf(lastUser);
      thread.messages = msgs.slice(0, cutIdx);
    }

    if (!promptText) return;

    const historyBeforeTurn = [...(thread.messages || [])];

    const userMsg = {
      id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: promptText,
      createdAt: Date.now(),
    };

    const nextTitle =
      historyBeforeTurn.length === 0 || thread.title === 'Percakapan Baru'
        ? deriveThreadTitle(promptText)
        : thread.title;

    const updatedThread = {
      ...thread,
      title: nextTitle,
      updatedAt: Date.now(),
      messages: [...historyBeforeTurn, userMsg],
    };

    state.threads = upsertChatThread(state.threads, updatedThread);
    state.activeThreadId = updatedThread.id;
    state.draft = '';
    state.sending = true;
    state.streamingText = '';
    state.lastError = null;
    state.lastFailedPrompt = promptText;
    persistThreads();
    render();
    scrollMessagesToBottom();

    const ctrl = new AbortController();
    activeAbort = ctrl;
    let rafPending = false;

    const flushStreamingDom = () => {
      rafPending = false;
      if (!mounted || !hostEl || !state.sending) return;
      const liveWrap = hostEl.querySelector('#mai-stream-content');
      if (!liveWrap) return;
      if (state.streamingText) {
        liveWrap.innerHTML = `${renderMarkdownSafe(state.streamingText)}<span class="mai-stream-cursor" aria-hidden="true"></span>`;
      }
      const stream = hostEl.querySelector('.mai-messages-scroll');
      if (stream) {
        const nearBottom = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 140;
        if (nearBottom) stream.scrollTop = stream.scrollHeight;
      }
    };

    try {
      const response = await sendManifestAiMessage({
        history: historyBeforeTurn,
        prompt: promptText,
        mode: state.prefs.mode,
        focusProviderId: state.prefs.focusProviderId,
        byokKeys: state.byokKeys,
        combineByokWithFree: state.prefs.combineByokWithFree,
        liveRegistry: state.registry,
        signal: ctrl.signal,
        onDelta: (partialText) => {
          state.streamingText = partialText;
          if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(flushStreamingDom);
          }
        },
      });

      state.limitMap = response.limitMap || loadStoredLimitMap();
      const assistantMsg = {
        id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: response.content,
        createdAt: Date.now(),
        meta: response.meta,
      };

      const latestThread = getActiveThread();
      const finishedThread = {
        ...latestThread,
        updatedAt: Date.now(),
        messages: [...(latestThread.messages || []), assistantMsg],
      };
      state.threads = upsertChatThread(state.threads, finishedThread);
      state.lastError = null;
      persistThreads();

      // Auto-read finished AI response when user enabled Auto-Baca Suara
      if (state.prefs.voiceAutoRead && mounted && assistantMsg.content) {
        setTimeout(() => {
          if (mounted) speakMessage(assistantMsg.id, assistantMsg.content);
        }, 120);
      }
    } catch (err) {
      if (err?.message !== 'ABORTED' && !ctrl.signal.aborted) {
        state.limitMap = err?.limitMap || loadStoredLimitMap();
        state.lastError = String(err?.message || 'Koneksi ke layanan AI sedang sibuk sementara. Silakan coba lagi.');
      }
    } finally {
      if (activeAbort === ctrl) activeAbort = null;
      state.sending = false;
      state.streamingText = '';
      if (mounted) {
        render();
        scrollMessagesToBottom();
      }
    }
  }

  function handleAddByokKey(e) {
    e.preventDefault();
    const providerId = state.byokForm.providerId || 'gemini';
    const rawKey = String(state.byokForm.apiKey || '').trim();
    if (!rawKey || rawKey.length < 8) {
      onToast('Masukkan API Key yang valid terlebih dahulu.');
      return;
    }
    if (providerId === 'custom' && !String(state.byokForm.baseUrl || '').trim()) {
      onToast('Masukkan Base URL endpoint OpenAI-compatible untuk provider Custom.');
      return;
    }

    const meta = getProviderMeta(providerId);
    const label = String(state.byokForm.label || '').trim() || `${meta.shortName} Pribadi`;
    const modelVal = state.byokForm.autoLatest ? 'auto' : String(state.byokForm.model || '').trim() || 'auto';

    state.byokKeys = upsertByokKey(state.byokKeys, {
      providerId,
      label,
      apiKey: rawKey,
      model: modelVal,
      customEndpoint: providerId === 'custom' ? String(state.byokForm.baseUrl || '').trim() : '',
      enabled: true,
    });
    persistByok();
    state.byokForm = {
      ...state.byokForm,
      label: '',
      apiKey: '',
      model: '',
      baseUrl: '',
    };
    render();
    onToast(`API Key ${meta.shortName} disimpan lokal di browser Anda.`);
  }

  async function handleTestByokKey(keyId) {
    const entry = state.byokKeys.find((k) => k.id === keyId);
    if (!entry) return;
    state.testingKeyId = keyId;
    state.keyTestFeedback[keyId] = { status: 'loading', text: 'Menguji koneksi...' };
    render();
    try {
      const res = await testByokKeyConnection(entry, state.registry);
      state.keyTestFeedback[keyId] = {
        status: 'ok',
        text: `Terhubung · ${res.model} · ${formatLatency(res.latencyMs)}`,
      };
      onToast(`Koneksi ${entry.label} berhasil (${res.model}).`);
    } catch (err) {
      state.keyTestFeedback[keyId] = {
        status: 'err',
        text: String(err?.message || 'Koneksi ditolak'),
      };
      onToast(`Uji ${entry.label} gagal.`);
    } finally {
      state.testingKeyId = null;
      if (mounted) render();
    }
  }

  function renderSidebarInner() {
    const query = state.historyQuery.trim().toLowerCase();
    const filtered = state.threads.filter((t) => {
      if (!query) return true;
      if ((t.title || '').toLowerCase().includes(query)) return true;
      return (t.messages || []).some((m) => String(m.content || '').toLowerCase().includes(query));
    });

    return `
      <div class="mai-sidebar-head">
        <button type="button" class="btn btn-primary mai-new-chat-btn" data-mai-action="new-chat">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          <span>Chat Baru</span>
        </button>
        <button type="button" class="mai-icon-btn mai-drawer-close" data-mai-action="close-drawer" aria-label="Tutup riwayat chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div class="mai-sidebar-search">
        <input
          type="search"
          id="mai-history-search"
          class="mai-input"
          placeholder="Cari riwayat percakapan..."
          value="${escapeAiHtml(state.historyQuery)}"
          aria-label="Cari riwayat percakapan"
        />
      </div>

      <div class="mai-thread-list" role="list" aria-label="Daftar riwayat chat">
        ${
          filtered.length === 0
            ? `<div class="mai-thread-empty">Tidak ada percakapan yang cocok.</div>`
            : filtered
                .map((t) => {
                  const isActive = t.id === state.activeThreadId;
                  const msgCount = (t.messages || []).length;
                  const isRenaming = state.renamingThreadId === t.id;
                  if (isRenaming) {
                    return `
                      <form class="mai-thread-rename-form" data-mai-rename-form="${escapeAiHtml(t.id)}">
                        <input type="text" class="mai-input mai-rename-input" data-mai-rename-input value="${escapeAiHtml(state.renameDraft)}" maxlength="80" aria-label="Ubah judul percakapan" />
                        <button type="submit" class="mai-mini-btn">Simpan</button>
                      </form>
                    `;
                  }
                  return `
                    <div class="mai-thread-item ${isActive ? 'is-active' : ''}" role="listitem">
                      <button type="button" class="mai-thread-select" data-mai-select-thread="${escapeAiHtml(t.id)}">
                        <span class="mai-thread-title">${escapeAiHtml(t.title || 'Percakapan Baru')}</span>
                        <span class="mai-thread-meta">${msgCount} pesan · ${escapeAiHtml(formatRelativeTime(t.updatedAt))}</span>
                      </button>
                      <div class="mai-thread-actions">
                        <button type="button" class="mai-thread-act-btn" data-mai-rename-thread="${escapeAiHtml(t.id)}" title="Ubah judul" aria-label="Ubah judul percakapan">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                        </button>
                        <button type="button" class="mai-thread-act-btn is-danger" data-mai-delete-thread="${escapeAiHtml(t.id)}" title="Hapus" aria-label="Hapus percakapan">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </div>
                  `;
                })
                .join('')
        }
      </div>

      <div class="mai-sidebar-foot">
        <button type="button" class="mai-foot-btn" data-mai-action="export-md">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          <span>Ekspor .md</span>
        </button>
        ${
          state.confirmClearAll
            ? `
              <button type="button" class="mai-foot-btn is-danger" data-mai-action="confirm-clear-all">Yakin Hapus?</button>
              <button type="button" class="mai-foot-btn" data-mai-action="cancel-clear-all">Batal</button>
            `
            : `
              <button type="button" class="mai-foot-btn is-danger" data-mai-action="ask-clear-all">Hapus Semua</button>
            `
        }
      </div>
    `;
  }

  function renderWelcomeView() {
    const activeByok = state.byokKeys.filter((k) => k.enabled).length;
    const providerListText = 'Gemini · ChatGPT · DeepSeek · Claude · Grok · Meta · Qwen · Mistral';

    return `
      <div class="mai-welcome">
        <div class="mai-welcome-brand">
          <img src="./assets/icons/tool-manifestai.svg" alt="Manifest AI" width="52" height="52" class="mai-welcome-logo" />
          <h2 class="mai-welcome-title">Manifest AI</h2>
          <p class="mai-welcome-sub">
            Asisten multi-model terpadu dengan pembaruan model real-time, memori percakapan utuh anti-halusinasi, dan failover otomatis.
          </p>
          <p class="mai-welcome-meta">
            ${escapeAiHtml(providerListText)}${activeByok > 0 ? ` · ${activeByok} API Key Pribadi Aktif` : ' · Gratis Tanpa API Key'}
          </p>
        </div>

        <div class="mai-starter-grid">
          ${STARTER_PROMPTS.map(
            (s, idx) => `
              <button type="button" class="mai-starter-card" data-mai-starter="${idx}">
                <span class="mai-starter-title">${escapeAiHtml(s.title)}</span>
                <span class="mai-starter-sub">${escapeAiHtml(s.sub)}</span>
              </button>
            `
          ).join('')}
        </div>
      </div>
    `;
  }

  function renderMessageItem(msg, isLastAssistant) {
    if (msg.role === 'user') {
      return `
        <article class="mai-msg mai-msg-user" aria-label="Pesan Anda">
          <div class="mai-user-bubble">${escapeAiHtml(msg.content).replace(/\n/g, '<br />')}</div>
        </article>
      `;
    }

    const isSpeakingThis = state.voice.msgId === msg.id && (state.voice.isLoading || state.voice.isPlaying);
    const speakLabel = isSpeakingThis
      ? state.voice.isLoading
        ? 'Memuat suara...'
        : `Berhenti${state.voice.langBadge ? ` · ${state.voice.langBadge}` : ''}`
      : 'Dengarkan';

    const safeContent = redactSensitiveOwnerData(msg.content, state.catalogData);
    return `
      <article class="mai-msg mai-msg-assistant" aria-label="Jawaban Manifest AI">
        <div class="mai-assistant-avatar" aria-hidden="true">
          <img src="./assets/icons/tool-manifestai.svg" alt="" width="28" height="28" />
        </div>
        <div class="mai-assistant-body">
          <div class="mai-md-content" data-mai-msg-content="${escapeAiHtml(msg.id)}">
            ${renderMarkdownSafe(safeContent)}
          </div>

          <div class="mai-msg-footer">
            <div class="mai-msg-actions">
              <button
                type="button"
                class="mai-msg-act-btn mai-speak-btn ${isSpeakingThis ? 'is-speaking' : ''}"
                data-mai-speak-msg="${escapeAiHtml(msg.id)}"
                aria-pressed="${isSpeakingThis ? 'true' : 'false'}"
                aria-label="${isSpeakingThis ? 'Hentikan pembacaan suara' : 'Dengarkan jawaban AI dengan suara natural'}"
              >${escapeAiHtml(speakLabel)}</button>
              <button type="button" class="mai-msg-act-btn" data-mai-copy-msg="${escapeAiHtml(msg.id)}">Salin</button>
              ${
                isLastAssistant && !state.sending
                  ? `<button type="button" class="mai-msg-act-btn" data-mai-action="regenerate">Buat Ulang</button>`
                  : ''
              }
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function renderVoiceModal() {
    const selectedProfile = getVoiceProfileById(state.prefs.voiceId);
    const filteredVoices = MANIFEST_AI_VOICE_CATALOG.filter((v) => {
      if (state.voice.genderFilter !== 'all' && v.gender !== state.voice.genderFilter) return false;
      if (state.voice.langFilter !== 'all' && v.langGroup !== state.voice.langFilter) return false;
      return true;
    });

    return `
      <div class="mai-modal-backdrop" data-mai-action="close-modal">
        <div class="mai-modal mai-voice-modal" role="dialog" aria-modal="true" aria-labelledby="mai-voice-modal-title">
          <div class="mai-modal-head">
            <div>
              <h3 id="mai-voice-modal-title" class="mai-modal-title">Mode Suara AI Natural (1 Suara Konsisten)</h3>
              <p class="mai-modal-sub">
                Suara aktif: <strong>${escapeAiHtml(selectedProfile.label)}</strong> · ${MANIFEST_AI_VOICE_CATALOG.length} suara neural unik Pria & Wanita
              </p>
            </div>
            <button type="button" class="mai-icon-btn" data-mai-action="close-modal" aria-label="Tutup pengaturan suara">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div class="mai-modal-body">
            <div class="mai-voice-settings-grid">
              <label class="mai-check-row">
                <input type="checkbox" id="mai-voice-codeswitch" ${state.prefs.voiceCodeSwitch ? 'checked' : ''} />
                <span><strong>1 Suara Konsisten Campuran Bahasa</strong> — kalimat campuran Indonesia & Inggris tetap dibacakan oleh 1 suara yang sama tanpa berganti orang; aksara Arab/Jepang/Korea/Mandarin tetap dilafalkan alami.</span>
              </label>

              <label class="mai-check-row">
                <input type="checkbox" id="mai-voice-autoread" ${state.prefs.voiceAutoRead ? 'checked' : ''} />
                <span><strong>Bacakan Jawaban AI Otomatis</strong> setiap kali Manifest AI selesai menjawab.</span>
              </label>

              <div class="mai-voice-sliders">
                <label class="mai-field">
                  <span class="mai-field-label">Kecepatan Bicara (<strong id="mai-voice-rate-val">${Number(state.prefs.voiceRate || 1.0).toFixed(2)}×</strong>)</span>
                  <input
                    type="range"
                    id="mai-voice-rate"
                    min="0.80"
                    max="1.35"
                    step="0.05"
                    value="${Number(state.prefs.voiceRate || 1.0).toFixed(2)}"
                  />
                </label>

                <label class="mai-field">
                  <span class="mai-field-label">Gaya Intonasi Suara</span>
                  <select id="mai-voice-style" class="mai-select">
                    <option value="natural" ${state.prefs.voiceStyle === 'natural' ? 'selected' : ''}>Natural Santai (Seperti Manusia Asli)</option>
                    <option value="ekspresif" ${state.prefs.voiceStyle === 'ekspresif' ? 'selected' : ''}>Ekspresif & Hangat</option>
                    <option value="tenang" ${state.prefs.voiceStyle === 'tenang' ? 'selected' : ''}>Tenang & Narator Jelas</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="mai-voice-filters">
              <div class="mai-mode-switch" role="group" aria-label="Filter gender suara">
                <button type="button" class="mai-mode-btn ${state.voice.genderFilter === 'all' ? 'is-active' : ''}" data-mai-voice-gender="all">Semua (${MANIFEST_AI_VOICE_CATALOG.length})</button>
                <button type="button" class="mai-mode-btn ${state.voice.genderFilter === 'female' ? 'is-active' : ''}" data-mai-voice-gender="female">Wanita</button>
                <button type="button" class="mai-mode-btn ${state.voice.genderFilter === 'male' ? 'is-active' : ''}" data-mai-voice-gender="male">Pria</button>
              </div>

              <select id="mai-voice-lang-filter" class="mai-select mai-voice-lang-select" aria-label="Filter bahasa suara">
                <option value="all" ${state.voice.langFilter === 'all' ? 'selected' : ''}>Semua Bahasa (${MANIFEST_AI_VOICE_CATALOG.length})</option>
                <option value="multi" ${state.voice.langFilter === 'multi' ? 'selected' : ''}>Multibahasa V2 (Fasih Indo & Inggris)</option>
                <option value="id" ${state.voice.langFilter === 'id' ? 'selected' : ''}>Indonesia Asli</option>
                <option value="en" ${state.voice.langFilter === 'en' ? 'selected' : ''}>Inggris (US, UK & AU)</option>
                <option value="ms" ${state.voice.langFilter === 'ms' ? 'selected' : ''}>Melayu</option>
                <option value="asia" ${state.voice.langFilter === 'asia' ? 'selected' : ''}>Jepang, Korea & Mandarin</option>
                <option value="ar" ${state.voice.langFilter === 'ar' ? 'selected' : ''}>Arab</option>
                <option value="eu" ${state.voice.langFilter === 'eu' ? 'selected' : ''}>Prancis, Spanyol & Jerman</option>
              </select>
            </div>

            <div class="mai-voice-grid" role="list" aria-label="Daftar pilihan suara AI">
              ${
                filteredVoices.length === 0
                  ? `<p class="mai-empty-note">Tidak ada suara yang cocok dengan filter ini.</p>`
                  : filteredVoices
                      .map((v) => {
                        const isSelected = v.id === state.prefs.voiceId;
                        const isPreviewing =
                          state.voice.msgId === `preview:${v.id}` && (state.voice.isLoading || state.voice.isPlaying);
                        return `
                          <div class="mai-voice-card ${isSelected ? 'is-selected' : ''}" role="listitem">
                            <div class="mai-voice-card-info">
                              <div class="mai-voice-card-head">
                                <strong>${escapeAiHtml(v.name)}</strong>
                                <span class="mai-voice-tag">${v.gender === 'male' ? 'Pria' : 'Wanita'} · ${escapeAiHtml(v.langLabel)}</span>
                              </div>
                              <p class="mai-voice-card-style">${escapeAiHtml(v.style)}</p>
                            </div>
                            <div class="mai-voice-card-actions">
                              <button
                                type="button"
                                class="mai-mini-btn ${isPreviewing ? 'is-speaking' : ''}"
                                data-mai-preview-voice="${escapeAiHtml(v.id)}"
                              >${isPreviewing ? (state.voice.isLoading ? 'Memuat...' : 'Berhenti') : 'Coba'}</button>
                              <button
                                type="button"
                                class="mai-mini-btn ${isSelected ? 'is-primary' : ''}"
                                data-mai-select-voice="${escapeAiHtml(v.id)}"
                              >${isSelected ? 'Aktif' : 'Pilih'}</button>
                            </div>
                          </div>
                        `;
                      })
                      .join('')
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderModelsModal() {
    const reg = state.registry || getCachedModelRegistry();
    const providers = reg.providers || {};
    const activeCooldowns = Object.entries(state.limitMap || {})
      .map(([key, entry]) => ({
        key,
        remainingMs: getCooldownRemainingMs(state.limitMap, key),
        reason: entry?.reason || 'Limit sementara',
      }))
      .filter((c) => c.remainingMs > 0);

    return `
      <div class="mai-modal-backdrop" data-mai-action="close-modal">
        <div class="mai-modal" role="dialog" aria-modal="true" aria-labelledby="mai-models-modal-title">
          <div class="mai-modal-head">
            <div>
              <h3 id="mai-models-modal-title" class="mai-modal-title">Katalog Model Real-Time & Status Limit</h3>
              <p class="mai-modal-sub">
                Disinkronkan otomatis dari OpenRouter, Models.dev, LLM7 & OVHcloud · Terakhir: ${escapeAiHtml(formatSyncTime(reg.syncedAt))}
              </p>
            </div>
            <button type="button" class="mai-icon-btn" data-mai-action="close-modal" aria-label="Tutup modal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div class="mai-modal-body">
            <div class="mai-sync-bar">
              <div class="mai-sync-info">
                <strong>Jalur Gratis Multi-Model per Pengguna</strong>
                <span>
                  ${
                    state.puterReady
                      ? 'Puter Multi-AI SDK aktif (kuota gratis terpisah per akun) + LLM7 + Pollinations (reset 45 dtk) + OVHcloud AI (14+ model) + HF Spaces.'
                      : '4 jaringan gratis independen aktif (LLM7, Pollinations reset 45 dtk, OVHcloud AI 14+ model flagship, HF Spaces). Aktifkan Kuota Puter (Gratis) untuk batas unlimited per akun Anda.'
                  }
                </span>
              </div>
              <div class="mai-sync-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-mai-action="sync-models" ${state.syncingRegistry ? 'disabled' : ''}>
                  ${state.syncingRegistry ? 'Menyinkronkan...' : 'Sinkron Sekarang'}
                </button>
                ${
                  !state.puterReady
                    ? `<button type="button" class="btn btn-primary btn-sm" data-mai-action="enable-puter" ${state.puterLoading ? 'disabled' : ''}>${state.puterLoading ? 'Memuat...' : 'Aktifkan Kuota Puter'}</button>`
                    : ''
                }
              </div>
            </div>

            <div class="mai-model-grid">
              ${MANIFEST_AI_PROVIDERS.filter((p) => p.id !== 'custom')
                .map((p) => {
                  const info = providers[p.id] || { latestModel: p.defaultModel, fastModel: p.fastModel, models: p.fallbackModels };
                  const userKeyCount = state.byokKeys.filter((k) => k.providerId === p.id && k.enabled).length;
                  return `
                    <div class="mai-model-row">
                      <div class="mai-model-row-top">
                        <strong>${escapeAiHtml(p.name)}</strong>
                        <span class="mai-model-vendor">${escapeAiHtml(p.vendor)}${userKeyCount > 0 ? ` · ${userKeyCount} Key Aktif` : ''}</span>
                      </div>
                      <div class="mai-model-id-line">
                        <code>${escapeAiHtml(info.latestModel || p.defaultModel)}</code>
                      </div>
                      <p class="mai-model-role">${escapeAiHtml(p.role)}</p>
                    </div>
                  `;
                })
                .join('')}
            </div>

            <div class="mai-limit-box">
              <div class="mai-limit-head">
                <strong>Status Cooldown Limit (Per Pengguna di Perangkat Ini)</strong>
                ${
                  activeCooldowns.length > 0
                    ? `<button type="button" class="mai-mini-btn" data-mai-action="reset-limits">Reset Timer Lokal</button>`
                    : ''
                }
              </div>
              ${
                activeCooldowns.length === 0
                  ? `<p class="mai-limit-ok">Semua jalur model aktif siap digunakan tanpa jeda cooldown.</p>`
                  : `<ul class="mai-limit-list">${activeCooldowns
                      .map(
                        (c) =>
                          `<li><span>${escapeAiHtml(c.key)}</span><span>${escapeAiHtml(c.reason)} · Reset dalam ${escapeAiHtml(formatCooldownShort(c.remainingMs))}</span></li>`
                      )
                      .join('')}</ul>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderByokModal() {
    const selectedProvider = getProviderMeta(state.byokForm.providerId);
    const liveProviderInfo = state.registry?.providers?.[selectedProvider.id];
    const suggestedModels = Array.isArray(liveProviderInfo?.models) && liveProviderInfo.models.length > 0
      ? liveProviderInfo.models
      : selectedProvider.fallbackModels;

    return `
      <div class="mai-modal-backdrop" data-mai-action="close-modal">
        <div class="mai-modal" role="dialog" aria-modal="true" aria-labelledby="mai-byok-modal-title">
          <div class="mai-modal-head">
            <div>
              <h3 id="mai-byok-modal-title" class="mai-modal-title">API Key Saya (Multi-Penyedia & Gabungan Paralel)</h3>
              <p class="mai-modal-sub">
                Tambahkan 1 atau beberapa API Key sekaligus (Gemini, ChatGPT, DeepSeek, Claude, Grok, OpenRouter, dll.). Semua kunci aktif bekerja paralel & tetap terintegrasi memorinya.
              </p>
            </div>
            <button type="button" class="mai-icon-btn" data-mai-action="close-modal" aria-label="Tutup modal API Key">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div class="mai-modal-body">
            <form class="mai-byok-form" id="mai-byok-form">
              <div class="mai-form-grid">
                <label class="mai-field">
                  <span>Penyedia AI</span>
                  <select class="mai-select" id="mai-byok-provider">
                    ${MANIFEST_AI_PROVIDERS.map(
                      (p) =>
                        `<option value="${escapeAiHtml(p.id)}" ${p.id === state.byokForm.providerId ? 'selected' : ''}>${escapeAiHtml(p.name)} (${escapeAiHtml(p.vendor)})</option>`
                    ).join('')}
                  </select>
                </label>

                <label class="mai-field">
                  <span>Label Kunci (Opsional)</span>
                  <input
                    type="text"
                    class="mai-input"
                    id="mai-byok-label"
                    placeholder="Contoh: Gemini Kerja / OpenAI Pribadi"
                    value="${escapeAiHtml(state.byokForm.label)}"
                  />
                </label>
              </div>

              <label class="mai-field">
                <span>API Key (${escapeAiHtml(selectedProvider.shortName)})</span>
                <input
                  type="password"
                  class="mai-input"
                  id="mai-byok-key"
                  placeholder="${escapeAiHtml(selectedProvider.keyPlaceholder)}"
                  value="${escapeAiHtml(state.byokForm.apiKey)}"
                  autocomplete="off"
                />
              </label>

              ${
                selectedProvider.id === 'custom'
                  ? `
                    <label class="mai-field">
                      <span>Base URL Endpoint (OpenAI-Compatible)</span>
                      <input
                        type="url"
                        class="mai-input"
                        id="mai-byok-baseurl"
                        placeholder="https://api.contoh.com/v1"
                        value="${escapeAiHtml(state.byokForm.baseUrl)}"
                      />
                    </label>
                  `
                  : ''
              }

              <div class="mai-form-row-inline">
                <label class="mai-checkbox-label">
                  <input type="checkbox" id="mai-byok-autolatest" ${state.byokForm.autoLatest ? 'checked' : ''} />
                  <span>Gunakan model terbaru otomatis (${escapeAiHtml(liveProviderInfo?.latestModel || selectedProvider.defaultModel)})</span>
                </label>
              </div>

              ${
                !state.byokForm.autoLatest
                  ? `
                    <label class="mai-field">
                      <span>Pilih atau Ketik ID Model</span>
                      <input
                        type="text"
                        class="mai-input"
                        id="mai-byok-model"
                        list="mai-model-suggestions"
                        placeholder="${escapeAiHtml(selectedProvider.defaultModel)}"
                        value="${escapeAiHtml(state.byokForm.model)}"
                      />
                      <datalist id="mai-model-suggestions">
                        ${suggestedModels.map((m) => `<option value="${escapeAiHtml(m)}"></option>`).join('')}
                      </datalist>
                    </label>
                  `
                  : ''
              }

              <div class="mai-byok-form-actions">
                <button type="submit" class="btn btn-primary btn-sm">Simpan & Aktifkan API Key</button>
                <span class="mai-privacy-note">Disimpan 100% lokal di browser Anda, tidak pernah dikirim ke server Manifestudio.</span>
              </div>
            </form>

            <div class="mai-byok-combine-row">
              <label class="mai-checkbox-label">
                <input type="checkbox" id="mai-combine-free-toggle" ${state.prefs.combineByokWithFree ? 'checked' : ''} />
                <span>Gabungkan API Key pribadi dengan jalur AI Gratis (otomatis cadangan jika salah satu limit)</span>
              </label>
            </div>

            <div class="mai-byok-list-section">
              <h4 class="mai-sub-heading">Daftar API Key Tersimpan (${state.byokKeys.length})</h4>
              ${
                state.byokKeys.length === 0
                  ? `<p class="mai-empty-note">Belum ada API Key pribadi tersimpan. Saat ini Manifest AI berjalan penuh menggunakan gabungan API AI gratis.</p>`
                  : `
                    <div class="mai-byok-list">
                      ${state.byokKeys
                        .map((k) => {
                          const pMeta = getProviderMeta(k.providerId);
                          const liveModel = state.registry?.providers?.[k.providerId]?.latestModel || pMeta.defaultModel;
                          const effectiveModel = !k.model || k.model === 'auto' ? `${liveModel} (Auto Terbaru)` : k.model;
                          const fb = state.keyTestFeedback[k.id];
                          const isTesting = state.testingKeyId === k.id;
                          return `
                            <div class="mai-byok-card ${k.enabled ? '' : 'is-disabled'}">
                              <div class="mai-byok-card-main">
                                <div class="mai-byok-card-top">
                                  <strong>${escapeAiHtml(k.label)}</strong>
                                  <span class="mai-byok-provider-meta">${escapeAiHtml(pMeta.name)} · <code>${escapeAiHtml(maskApiKey(k.apiKey))}</code></span>
                                </div>
                                <div class="mai-byok-model-line">Model: <code>${escapeAiHtml(effectiveModel)}</code></div>
                                ${
                                  fb
                                    ? `<div class="mai-byok-feedback ${fb.status === 'ok' ? 'is-ok' : fb.status === 'err' ? 'is-err' : ''}">${escapeAiHtml(fb.text)}</div>`
                                    : ''
                                }
                              </div>
                              <div class="mai-byok-card-actions">
                                <button type="button" class="mai-mini-btn" data-mai-toggle-key="${escapeAiHtml(k.id)}">${k.enabled ? 'Aktif' : 'Nonaktif'}</button>
                                <button type="button" class="mai-mini-btn" data-mai-test-key="${escapeAiHtml(k.id)}" ${isTesting ? 'disabled' : ''}>${isTesting ? 'Menguji...' : 'Uji Koneksi'}</button>
                                <button type="button" class="mai-mini-btn is-danger" data-mai-remove-key="${escapeAiHtml(k.id)}">Hapus</button>
                              </div>
                            </div>
                          `;
                        })
                        .join('')}
                    </div>
                  `
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    if (!hostEl || !mounted) return;
    const thread = getActiveThread();
    const messages = thread.messages || [];
    const activeByokCount = state.byokKeys.filter((k) => k.enabled).length;
    const lastAssistantIdx = [...messages].map((m) => m.role).lastIndexOf('assistant');
    const statusMetaText =
      activeByokCount > 0
        ? `Manifest AI · ${activeByokCount} API Key Pribadi Aktif`
        : 'Manifest AI · Gratis · Model diperbarui otomatis';

    const activeVoice = getVoiceProfileById(state.prefs.voiceId);
    const voiceBusy = Boolean((state.voice.isLoading || state.voice.isPlaying) && state.voice.msgId && !String(state.voice.msgId).startsWith('preview:'));

    hostEl.innerHTML = `
      <div class="mai-shell ${state.isFullscreen ? 'is-fullscreen' : ''}">
        <aside class="mai-sidebar ${state.drawerOpen ? 'is-open' : ''}" aria-label="Riwayat Chat Manifest AI">
          ${renderSidebarInner()}
        </aside>
        ${state.drawerOpen ? `<div class="mai-drawer-backdrop" data-mai-action="close-drawer"></div>` : ''}

        <div class="mai-main">
          <header class="mai-topbar">
            <div class="mai-topbar-left">
              <button type="button" class="mai-icon-btn mai-menu-trigger" data-mai-action="open-drawer" aria-label="Buka riwayat percakapan">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
              </button>
              <div class="mai-topbar-title-wrap">
                <span class="mai-topbar-title">${escapeAiHtml(thread.title || 'Percakapan Baru')}</span>
                <span class="mai-topbar-sub">${messages.length} pesan · ${state.prefs.mode === 'ensemble' ? 'Multi-Model Aktif' : escapeAiHtml(getProviderMeta(state.prefs.focusProviderId).name)}</span>
              </div>
            </div>

            <div class="mai-topbar-controls">
              <div class="mai-mode-switch" role="group" aria-label="Mode orkestrasi AI">
                <button type="button" class="mai-mode-btn ${state.prefs.mode === 'ensemble' ? 'is-active' : ''}" data-mai-mode="ensemble">Gabungan AI</button>
                <button type="button" class="mai-mode-btn ${state.prefs.mode === 'single' ? 'is-active' : ''}" data-mai-mode="single">1 Model</button>
              </div>

              ${
                state.prefs.mode === 'single'
                  ? `
                    <select class="mai-select mai-focus-select" id="mai-focus-provider" aria-label="Pilih penyedia model AI">
                      ${MANIFEST_AI_PROVIDERS.filter((p) => p.id !== 'custom')
                        .map(
                          (p) =>
                            `<option value="${escapeAiHtml(p.id)}" ${p.id === state.prefs.focusProviderId ? 'selected' : ''}>${escapeAiHtml(p.shortName)}</option>`
                        )
                        .join('')}
                    </select>
                  `
                  : ''
              }

              <button type="button" class="mai-top-btn ${voiceBusy || state.prefs.voiceAutoRead ? 'is-accent' : ''}" data-mai-action="open-voice" aria-label="Pengaturan suara AI">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                <span>Suara</span>
              </button>

              <button type="button" class="mai-top-btn" data-mai-action="open-models">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                <span>Model Live</span>
              </button>

              <button type="button" class="mai-top-btn ${activeByokCount > 0 ? 'is-accent' : ''}" data-mai-action="open-byok">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                <span>API Key${activeByokCount > 0 ? ` (${activeByokCount})` : ''}</span>
              </button>

              <button
                type="button"
                class="mai-top-btn ${state.isFullscreen ? 'is-accent' : ''}"
                data-mai-action="toggle-fullscreen"
                aria-pressed="${state.isFullscreen ? 'true' : 'false'}"
                aria-label="${state.isFullscreen ? 'Keluar dari layar penuh' : 'Buka layar penuh'}"
              >
                ${
                  state.isFullscreen
                    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg><span>Keluar Full</span>`
                    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg><span>Layar Penuh</span>`
                }
              </button>
            </div>
          </header>

          <div class="mai-voice-bar" id="mai-voice-now-playing" ${voiceBusy ? '' : 'hidden'}>
            <span class="mai-voice-bar-dot" aria-hidden="true"></span>
            <span class="mai-voice-bar-text" data-mai-voice-bar-label>
              ${
                state.voice.isLoading
                  ? `Menyiapkan suara ${escapeAiHtml(state.voice.voiceName || activeVoice.name)}...`
                  : `Membacakan (${escapeAiHtml(state.voice.voiceName || activeVoice.name)}${state.voice.langBadge ? ` · ${escapeAiHtml(state.voice.langBadge)}` : ''})`
              }
            </span>
            <button type="button" class="mai-mini-btn" data-mai-action="stop-voice">Berhenti</button>
          </div>

          <div class="mai-messages-scroll" role="log" aria-live="polite" aria-label="Percakapan Manifest AI">
            <div class="mai-messages-inner">
              ${
                messages.length === 0
                  ? renderWelcomeView()
                  : messages.map((m, idx) => renderMessageItem(m, idx === lastAssistantIdx)).join('')
              }

              ${
                state.sending
                  ? `
                    <article class="mai-msg mai-msg-assistant mai-msg-streaming" aria-label="Manifest AI sedang menjawab">
                      <div class="mai-assistant-avatar" aria-hidden="true">
                        <img src="./assets/icons/tool-manifestai.svg" alt="" width="28" height="28" />
                      </div>
                      <div class="mai-assistant-body">
                        <div class="mai-md-content" id="mai-stream-content">
                          ${
                            state.streamingText
                              ? `${renderMarkdownSafe(state.streamingText)}<span class="mai-stream-cursor" aria-hidden="true"></span>`
                              : `<div class="mai-typing-dots" aria-label="Mengetik jawaban"><span></span><span></span><span></span></div>`
                          }
                        </div>
                      </div>
                    </article>
                  `
                  : ''
              }

              ${
                state.lastError && !state.sending
                  ? `
                    <div class="mai-error-box" role="alert">
                      <p class="mai-error-msg">${escapeAiHtml(state.lastError)}</p>
                      <div class="mai-error-actions">
                        <button type="button" class="btn btn-primary btn-sm" data-mai-action="retry-last">Coba Kirim Ulang</button>
                        ${
                          !state.puterReady
                            ? `<button type="button" class="btn btn-secondary btn-sm" data-mai-action="enable-puter">Aktifkan Kuota Puter (Gratis)</button>`
                            : ''
                        }
                        <button type="button" class="btn btn-secondary btn-sm" data-mai-action="open-byok">Pasang API Key Saya</button>
                      </div>
                    </div>
                  `
                  : ''
              }
            </div>
          </div>

          <div class="mai-composer-wrap">
            <form class="mai-composer-form" id="mai-composer-form">
              <textarea
                id="mai-prompt-input"
                class="mai-composer-input"
                rows="1"
                placeholder="Tulis pertanyaan, kode, ide, atau lanjutkan topik sebelumnya..."
                aria-label="Ketik pesan untuk Manifest AI"
                ${state.sending ? 'disabled' : ''}
              >${escapeAiHtml(state.draft)}</textarea>
              ${
                state.sending
                  ? `
                    <button type="button" class="btn btn-secondary mai-send-btn" data-mai-action="stop-gen" aria-label="Hentikan generasi">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                      <span>Hentikan</span>
                    </button>
                  `
                  : `
                    <button type="submit" class="btn btn-primary mai-send-btn" id="mai-send-btn" aria-label="Kirim pesan">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                      <span>Kirim</span>
                    </button>
                  `
              }
            </form>
            <div class="mai-status-strip">${escapeAiHtml(statusMetaText)}</div>
          </div>
        </div>
      </div>

      ${state.activeModal === 'models' ? renderModelsModal() : ''}
      ${state.activeModal === 'byok' ? renderByokModal() : ''}
      ${state.activeModal === 'voice' ? renderVoiceModal() : ''}
    `;

    bindEvents();
  }

  function bindEvents() {
    if (!hostEl) return;

    const promptInput = hostEl.querySelector('#mai-prompt-input');
    if (promptInput) {
      autoResizeTextarea(promptInput);
      promptInput.addEventListener('input', () => {
        state.draft = promptInput.value;
        autoResizeTextarea(promptInput);
      });
      promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendPrompt();
        }
      });
    }

    hostEl.querySelector('#mai-composer-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendPrompt();
    });

    hostEl.querySelector('#mai-history-search')?.addEventListener('input', (e) => {
      state.historyQuery = e.target.value;
      const listEl = hostEl.querySelector('.mai-sidebar');
      if (listEl) {
        const cursorPos = e.target.selectionStart || state.historyQuery.length;
        render();
        const nextInput = hostEl.querySelector('#mai-history-search');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(cursorPos, cursorPos);
        }
      }
    });

    hostEl.querySelector('#mai-focus-provider')?.addEventListener('change', (e) => {
      state.prefs.focusProviderId = e.target.value;
      persistPrefs();
      render();
    });

    hostEl.querySelectorAll('[data-mai-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextMode = btn.getAttribute('data-mai-mode') === 'single' ? 'single' : 'ensemble';
        if (state.prefs.mode === nextMode) return;
        state.prefs.mode = nextMode;
        persistPrefs();
        render();
      });
    });

    hostEl.querySelectorAll('[data-mai-starter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-mai-starter'));
        const item = STARTER_PROMPTS[idx];
        if (!item) return;
        handleSendPrompt(item.prompt);
      });
    });

    hostEl.querySelectorAll('[data-mai-select-thread]').forEach((btn) => {
      btn.addEventListener('click', () => selectThread(btn.getAttribute('data-mai-select-thread')));
    });

    hostEl.querySelectorAll('[data-mai-delete-thread]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeThread(btn.getAttribute('data-mai-delete-thread'));
      });
    });

    hostEl.querySelectorAll('[data-mai-rename-thread]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = btn.getAttribute('data-mai-rename-thread');
        const found = state.threads.find((t) => t.id === tid);
        if (!found) return;
        state.renamingThreadId = tid;
        state.renameDraft = found.title || '';
        render();
        hostEl.querySelector('[data-mai-rename-input]')?.focus();
      });
    });

    hostEl.querySelectorAll('[data-mai-rename-form]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const tid = form.getAttribute('data-mai-rename-form');
        const input = form.querySelector('[data-mai-rename-input]');
        const nextTitle = String(input?.value || '').trim();
        if (nextTitle) {
          const found = state.threads.find((t) => t.id === tid);
          if (found) {
            state.threads = upsertChatThread(state.threads, { ...found, title: nextTitle });
            persistThreads();
          }
        }
        state.renamingThreadId = null;
        render();
      });
    });

    // Copy assistant message
    hostEl.querySelectorAll('[data-mai-copy-msg]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const mid = btn.getAttribute('data-mai-copy-msg');
        const found = (getActiveThread().messages || []).find((m) => m.id === mid);
        if (!found) return;
        const ok = await copyText(found.content);
        onToast(ok ? 'Jawaban disalin ke clipboard.' : 'Gagal menyalin jawaban.');
      });
    });

    // Copy code blocks inside Markdown
    hostEl.querySelectorAll('[data-mai-copy-code]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const block = btn.closest('.mai-code-block');
        const codeEl = block?.querySelector('code');
        if (!codeEl) return;
        const ok = await copyText(codeEl.textContent || '');
        if (ok) {
          btn.textContent = 'Tersalin';
          setTimeout(() => {
            if (btn.isConnected) btn.textContent = 'Salin kode';
          }, 1600);
        }
      });
    });

    // Modal & general actions
    hostEl.querySelectorAll('[data-mai-action]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const action = el.getAttribute('data-mai-action');
        if (el.classList.contains('mai-modal-backdrop') && e.target !== el) return;
        switch (action) {
          case 'new-chat':
            createNewChat();
            break;
          case 'open-drawer':
            state.drawerOpen = true;
            render();
            break;
          case 'close-drawer':
            state.drawerOpen = false;
            render();
            break;
          case 'open-models':
            state.limitMap = loadStoredLimitMap();
            state.activeModal = 'models';
            render();
            break;
          case 'open-byok':
            state.activeModal = 'byok';
            render();
            break;
          case 'open-voice':
            state.activeModal = 'voice';
            render();
            break;
          case 'stop-voice':
            stopVoicePlayback();
            break;
          case 'toggle-fullscreen':
            toggleFullscreen();
            break;
          case 'close-modal':
            state.activeModal = null;
            render();
            break;
          case 'sync-models':
            refreshRegistry(true);
            break;
          case 'enable-puter':
            activatePuterSdk(true);
            break;
          case 'reset-limits':
            state.limitMap = saveStoredLimitMap({});
            render();
            onToast('Timer cooldown lokal telah direset.');
            break;
          case 'export-md':
            downloadActiveMarkdown();
            break;
          case 'ask-clear-all':
            state.confirmClearAll = true;
            render();
            break;
          case 'cancel-clear-all':
            state.confirmClearAll = false;
            render();
            break;
          case 'confirm-clear-all':
            clearAllHistory();
            break;
          case 'stop-gen':
            stopGeneration();
            break;
          case 'regenerate':
            handleSendPrompt(null, { regenerate: true });
            break;
          case 'retry-last':
            if (state.lastFailedPrompt) {
              // Remove duplicate last user turn if already appended
              const th = getActiveThread();
              const msgs = [...(th.messages || [])];
              if (msgs.length > 0 && msgs[msgs.length - 1].role === 'user' && msgs[msgs.length - 1].content === state.lastFailedPrompt) {
                msgs.pop();
                th.messages = msgs;
              }
              handleSendPrompt(state.lastFailedPrompt);
            }
            break;
          default:
            break;
        }
      });
    });

    // BYOK Modal bindings
    const byokForm = hostEl.querySelector('#mai-byok-form');
    if (byokForm) {
      byokForm.addEventListener('submit', handleAddByokKey);
      hostEl.querySelector('#mai-byok-provider')?.addEventListener('change', (e) => {
        state.byokForm.providerId = e.target.value;
        state.byokForm.model = '';
        render();
      });
      hostEl.querySelector('#mai-byok-label')?.addEventListener('input', (e) => {
        state.byokForm.label = e.target.value;
      });
      hostEl.querySelector('#mai-byok-key')?.addEventListener('input', (e) => {
        state.byokForm.apiKey = e.target.value;
      });
      hostEl.querySelector('#mai-byok-baseurl')?.addEventListener('input', (e) => {
        state.byokForm.baseUrl = e.target.value;
      });
      hostEl.querySelector('#mai-byok-model')?.addEventListener('input', (e) => {
        state.byokForm.model = e.target.value;
      });
      hostEl.querySelector('#mai-byok-autolatest')?.addEventListener('change', (e) => {
        state.byokForm.autoLatest = Boolean(e.target.checked);
        render();
      });
    }

    hostEl.querySelector('#mai-combine-free-toggle')?.addEventListener('change', (e) => {
      state.prefs.combineByokWithFree = Boolean(e.target.checked);
      persistPrefs();
      render();
    });

    hostEl.querySelectorAll('[data-mai-toggle-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kid = btn.getAttribute('data-mai-toggle-key');
        state.byokKeys = state.byokKeys.map((k) => (k.id === kid ? { ...k, enabled: !k.enabled } : k));
        persistByok();
        render();
      });
    });

    hostEl.querySelectorAll('[data-mai-test-key]').forEach((btn) => {
      btn.addEventListener('click', () => handleTestByokKey(btn.getAttribute('data-mai-test-key')));
    });

    // Per-message Listen / Stop Voice button
    hostEl.querySelectorAll('[data-mai-speak-msg]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const msgId = btn.getAttribute('data-mai-speak-msg');
        const msg = (getActiveThread().messages || []).find((m) => m.id === msgId);
        if (msg) speakMessage(msg.id, msg.content);
      });
    });

    // Voice Modal controls
    hostEl.querySelector('#mai-voice-codeswitch')?.addEventListener('change', (e) => {
      state.prefs.voiceCodeSwitch = Boolean(e.target.checked);
      persistPrefs();
    });

    hostEl.querySelector('#mai-voice-autoread')?.addEventListener('change', (e) => {
      state.prefs.voiceAutoRead = Boolean(e.target.checked);
      persistPrefs();
      syncVoiceControlsInDom();
    });

    hostEl.querySelector('#mai-voice-rate')?.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      if (Number.isFinite(val)) {
        state.prefs.voiceRate = val;
        persistPrefs();
        const label = hostEl.querySelector('#mai-voice-rate-val');
        if (label) label.textContent = `${val.toFixed(2)}×`;
      }
    });

    hostEl.querySelector('#mai-voice-style')?.addEventListener('change', (e) => {
      state.prefs.voiceStyle = e.target.value;
      persistPrefs();
    });

    hostEl.querySelectorAll('[data-mai-voice-gender]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.voice.genderFilter = btn.getAttribute('data-mai-voice-gender') || 'all';
        render();
      });
    });

    hostEl.querySelector('#mai-voice-lang-filter')?.addEventListener('change', (e) => {
      state.voice.langFilter = e.target.value || 'all';
      render();
    });

    hostEl.querySelectorAll('[data-mai-preview-voice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vid = btn.getAttribute('data-mai-preview-voice');
        if (vid) previewVoiceProfile(vid);
      });
    });

    hostEl.querySelectorAll('[data-mai-select-voice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vid = btn.getAttribute('data-mai-select-voice');
        if (!vid) return;
        if (state.voice.isLoading || state.voice.isPlaying) {
          stopVoicePlayback();
        }
        const vp = getVoiceProfileById(vid);
        state.prefs.voiceId = vp.id;
        persistPrefs();
        render();
        onToast(`Suara diubah ke ${vp.label}.`);
      });
    });

    hostEl.querySelectorAll('[data-mai-remove-key]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const kid = btn.getAttribute('data-mai-remove-key');
        state.byokKeys = state.byokKeys.filter((k) => k.id !== kid);
        delete state.keyTestFeedback[kid];
        persistByok();
        render();
        onToast('API Key dihapus dari perangkat ini.');
      });
    });
  }

  const handleGlobalKeydown = (e) => {
    if (!mounted) return;
    if (e.key === 'Escape') {
      if (state.activeModal) {
        state.activeModal = null;
        render();
      } else if (state.drawerOpen) {
        state.drawerOpen = false;
        render();
      } else if (state.isFullscreen) {
        exitFullscreen();
      }
    }
  };

  return {
    mount(containerEl) {
      hostEl = containerEl;
      mounted = true;
      document.addEventListener('keydown', handleGlobalKeydown);
      document.addEventListener('fullscreenchange', handleNativeFullscreenChange);
      render();
      scrollMessagesToBottom();
      // Background auto-upgrade of flagship models & live Manifestudio catalog grounding
      refreshRegistry(false);
      loadManifestudioCatalogData().then((data) => {
        state.catalogData = data;
      });
    },
    unmount() {
      mounted = false;
      document.removeEventListener('keydown', handleGlobalKeydown);
      document.removeEventListener('fullscreenchange', handleNativeFullscreenChange);
      if (state.isFullscreen) {
        state.isFullscreen = false;
        syncFullscreenBodyClass();
      }
      voicePlayer.destroy();
      if (activeAbort) {
        activeAbort.abort();
        activeAbort = null;
      }
      if (hostEl) hostEl.innerHTML = '';
      hostEl = null;
    },
    redrawTheme() {
      // Uses semantic tokens from tokens.css; no canvas redraw needed
    },
  };
}
