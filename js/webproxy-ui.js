/**
 * Manifestudio Peramban Proxy (Web Proxy Browser) UI Controller — v91
 *
 * Full-featured, user-friendly privacy browser experience:
 *  - Multi-tab bar + Back/Forward/Reload/Home + Omnibox (URL or Privacy Search)
 *  - Mode Proxy, Mode VPN Relay, Mode Reader Anti-Bot, Auto Multi-Engine
 *  - 100% Privacy by default (Incognito ON, zero history stored) + opt-in local-only History with 1-click wipe
 *  - Ad-Blocker, Tracker-Blocker, Anti-Malware/Anti-Phishing Shield & Sandboxed Iframe (no allow-same-origin)
 *  - Fullscreen Mode (`Layar Penuh`) with dedicated Quick Shortcuts Bar
 *  - Automatic Media Detector (VidMate-style) with live count badge & download drawer
 *  - Integrated Multi-AI Browser Assistant (Gemini, ChatGPT, DeepSeek, Grok, Meta Llama)
 *  - 108+ Visual Browser Themes Studio with live search & category filters
 */

import {
  BROWSER_AI_MODELS,
  DEFAULT_SPEED_DIAL_SITES,
  PRIVACY_SEARCH_ENGINES,
  PROXY_ROUTING_MODES,
  canTabGoBack,
  canTabGoForward,
  createBrowserTab,
  normalizeProxyInput,
  pushTabHistoryEntry,
} from './webproxy-logic.js?v=91';
import {
  WEBPROXY_THEME_CATEGORIES,
  WEBPROXY_THEMES,
  filterWebProxyThemes,
  getWebProxyThemeById,
} from './webproxy-themes.js?v=91';
import {
  askBrowserMultiAi,
  enrichVidmateMediaForUrl,
  fetchPrivacySearch,
  fetchProxiedPage,
  loadPrivateLocalHistory,
  loadSavedBookmarks,
  loadWebProxyPrefs,
  recordPrivateLocalHistory,
  saveBookmarks,
  saveWebProxyPrefs,
  triggerVidmateDownload,
  wipePrivateLocalHistory,
} from './webproxy.js?v=91';

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatShortTime(isoStr) {
  try {
    return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(
      new Date(isoStr)
    );
  } catch {
    return '';
  }
}

export function createWebProxyController({ rootEl, onToast = () => {} }) {
  let mounted = false;
  let tabSeq = 1;
  let activeAbort = null;
  let aiAbort = null;

  const initialPrefs = loadWebProxyPrefs();
  const state = {
    prefs: initialPrefs,
    tabs: [createBrowserTab(`tab-${tabSeq++}`, { title: 'Beranda Proxy', view: 'home' })],
    activeTabId: 'tab-1',
    omniboxValue: '',
    fullscreen: false,
    activeDrawer: null, // null | 'media' | 'ai' | 'themes' | 'privacy'
    themeCategory: 'all',
    themeQuery: '',
    localHistory: loadPrivateLocalHistory(initialPrefs.incognitoMode),
    bookmarks: loadSavedBookmarks(),
    mediaManualUrl: '',
    mediaScanning: false,
    aiMessages: [],
    aiInput: '',
    aiLoading: false,
    sessionAdsBlocked: 0,
    sessionTrackersBlocked: 0,
  };

  function getActiveTab() {
    return state.tabs.find((t) => t.id === state.activeTabId) || state.tabs[0];
  }

  function updateTab(tabId, patch) {
    state.tabs = state.tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t));
  }

  function getActiveTheme() {
    return getWebProxyThemeById(state.prefs.themeId);
  }

  function applyThemeCssVars(shellEl) {
    if (!shellEl) return;
    const t = getActiveTheme();
    shellEl.style.setProperty('--wpb-chrome', t.chromeBg);
    shellEl.style.setProperty('--wpb-toolbar', t.toolbarBg);
    shellEl.style.setProperty('--wpb-surface', t.surfaceBg);
    shellEl.style.setProperty('--wpb-text', t.textColor);
    shellEl.style.setProperty('--wpb-muted', t.mutedColor);
    shellEl.style.setProperty('--wpb-accent', t.accentColor);
    shellEl.style.setProperty('--wpb-border', t.borderColor);
    shellEl.setAttribute('data-wpb-theme-dark', t.isDark ? 'true' : 'false');
    shellEl.setAttribute('data-wpb-theme-id', t.id);
  }

  async function navigateInput(rawInput, { pushHistory = true, tabId = state.activeTabId } = {}) {
    const parsed = normalizeProxyInput(rawInput);
    const targetTab = state.tabs.find((t) => t.id === tabId) || getActiveTab();
    if (!targetTab) return;

    if (parsed.type === 'empty') {
      onToast(parsed.error);
      return;
    }

    if (parsed.type === 'blocked') {
      updateTab(targetTab.id, {
        loading: false,
        view: 'error',
        error: parsed.error,
        title: 'Diblokir Keamanan',
        security: {
          level: 'danger',
          score: 10,
          label: 'Diblokir Anti-Bobol',
          warnings: [parsed.error],
        },
      });
      render();
      onToast('Tautan diblokir oleh proteksi keamanan.');
      return;
    }

    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
    const controller = new AbortController();
    activeAbort = controller;

    if (parsed.type === 'search') {
      state.omniboxValue = parsed.query;
      let nextTab = {
        ...targetTab,
        loading: true,
        error: '',
        view: 'search',
        searchQuery: parsed.query,
        url: '',
        title: `Cari: ${parsed.query}`,
      };
      if (pushHistory) {
        nextTab = pushTabHistoryEntry(nextTab, {
          type: 'search',
          value: parsed.query,
          title: `Cari: ${parsed.query}`,
        });
      }
      state.tabs = state.tabs.map((t) => (t.id === targetTab.id ? nextTab : t));
      render();

      try {
        const res = await fetchPrivacySearch(parsed.query, {
          engine: state.prefs.searchEngine,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        updateTab(targetTab.id, {
          loading: false,
          view: 'search',
          searchResults: res.results || [],
          searchEngines: res.enginesUsed || [],
          relayUsed: (res.enginesUsed || []).join(' + '),
          security: { level: 'safe', score: 100, label: 'Pencarian Privat', warnings: [] },
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        updateTab(targetTab.id, {
          loading: false,
          view: 'error',
          error: err instanceof Error ? err.message : 'Gagal menjalankan pencarian privat.',
        });
      } finally {
        if (activeAbort === controller) activeAbort = null;
        render();
      }
      return;
    }

    // Direct URL Browse
    state.omniboxValue = parsed.url;
    let nextTab = {
      ...targetTab,
      loading: true,
      error: '',
      view: 'web',
      url: parsed.url,
      title: parsed.hostname || parsed.url,
      media: [],
    };
    if (pushHistory) {
      nextTab = pushTabHistoryEntry(nextTab, {
        type: 'url',
        value: parsed.url,
        title: parsed.hostname || parsed.url,
      });
    }
    state.tabs = state.tabs.map((t) => (t.id === targetTab.id ? nextTab : t));
    render();

    try {
      const theme = getActiveTheme();
      const page = await fetchProxiedPage(parsed.url, {
        node: state.prefs.routingMode,
        adBlock: state.prefs.adBlock,
        antiTrack: state.prefs.antiTrack,
        darkTheme: theme.isDark,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      state.sessionAdsBlocked += Number(page.blockedAds || 0);
      state.sessionTrackersBlocked += Number(page.blockedTrackers || 0);

      updateTab(targetTab.id, {
        loading: false,
        view: 'web',
        url: page.finalUrl || parsed.url,
        title: page.title || page.hostname || parsed.hostname,
        html: page.html || '',
        favicon: page.favicon || '',
        relayUsed: page.relayUsed || 'Edge Proxy',
        latencyMs: Number(page.latencyMs || 0),
        blockedAds: Number(page.blockedAds || 0),
        blockedTrackers: Number(page.blockedTrackers || 0),
        security: page.security || { level: 'safe', score: 95, label: 'Aman & Privat', warnings: [] },
        media: Array.isArray(page.media) ? page.media : [],
        textSnippet: page.textSnippet || '',
      });
      state.omniboxValue = page.finalUrl || parsed.url;

      // Record local-only history ONLY if user explicitly disabled Incognito Mode
      if (!state.prefs.incognitoMode) {
        state.localHistory = recordPrivateLocalHistory(
          {
            url: page.finalUrl || parsed.url,
            title: page.title || page.hostname || parsed.hostname,
            mode: state.prefs.routingMode,
          },
          false
        );
      }

      render();

      // Background VidMate auto media enrichment for social video pages
      enrichVidmateMediaForUrl(page.finalUrl || parsed.url, page.media || []).then((enriched) => {
        if (!mounted || controller.signal.aborted) return;
        const currentTabNow = state.tabs.find((t) => t.id === targetTab.id);
        if (currentTabNow && currentTabNow.url === (page.finalUrl || parsed.url)) {
          const prevCount = currentTabNow.media?.length || 0;
          if (enriched.length !== prevCount) {
            updateTab(targetTab.id, { media: enriched });
            render();
            if (enriched.length > 0 && prevCount === 0) {
              onToast(`VidMate mendeteksi ${enriched.length} media siap unduh!`);
            }
          }
        }
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      updateTab(targetTab.id, {
        loading: false,
        view: 'error',
        error: err instanceof Error ? err.message : 'Gagal memuat situs melalui jalur proxy.',
      });
      render();
    } finally {
      if (activeAbort === controller) activeAbort = null;
    }
  }

  function goBack() {
    const tab = getActiveTab();
    if (!canTabGoBack(tab)) return;
    const prevIdx = tab.historyIndex - 1;
    const entry = tab.historyStack[prevIdx];
    updateTab(tab.id, { historyIndex: prevIdx });
    if (entry) {
      navigateInput(entry.value, { pushHistory: false, tabId: tab.id });
    }
  }

  function goForward() {
    const tab = getActiveTab();
    if (!canTabGoForward(tab)) return;
    const nextIdx = tab.historyIndex + 1;
    const entry = tab.historyStack[nextIdx];
    updateTab(tab.id, { historyIndex: nextIdx });
    if (entry) {
      navigateInput(entry.value, { pushHistory: false, tabId: tab.id });
    }
  }

  function goHome() {
    const tab = getActiveTab();
    if (!tab) return;
    if (activeAbort) {
      activeAbort.abort();
      activeAbort = null;
    }
    state.omniboxValue = '';
    updateTab(tab.id, {
      view: 'home',
      url: '',
      title: 'Beranda Proxy',
      loading: false,
      error: '',
      html: '',
      media: [],
      textSnippet: '',
      security: { level: 'safe', score: 100, label: 'Siap & Privat', warnings: [] },
    });
    render();
  }

  function reloadActiveTab() {
    const tab = getActiveTab();
    if (!tab) return;
    if (tab.view === 'web' && tab.url) {
      navigateInput(tab.url, { pushHistory: false, tabId: tab.id });
    } else if (tab.view === 'search' && tab.searchQuery) {
      navigateInput(tab.searchQuery, { pushHistory: false, tabId: tab.id });
    }
  }

  function addNewTab() {
    if (state.tabs.length >= 8) {
      onToast('Maksimal 8 tab aktif agar peramban tetap ringan.');
      return;
    }
    const id = `tab-${tabSeq++}`;
    const newTab = createBrowserTab(id, { title: 'Tab Baru', view: 'home' });
    state.tabs = [...state.tabs, newTab];
    state.activeTabId = id;
    state.omniboxValue = '';
    render();
  }

  function switchTab(tabId) {
    const found = state.tabs.find((t) => t.id === tabId);
    if (!found) return;
    state.activeTabId = found.id;
    state.omniboxValue = found.view === 'search' ? found.searchQuery : found.url;
    render();
  }

  function closeTab(tabId) {
    if (state.tabs.length <= 1) {
      goHome();
      return;
    }
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    state.tabs = state.tabs.filter((t) => t.id !== tabId);
    if (state.activeTabId === tabId) {
      const next = state.tabs[Math.max(0, idx - 1)] || state.tabs[0];
      state.activeTabId = next.id;
      state.omniboxValue = next.view === 'search' ? next.searchQuery : next.url;
    }
    render();
  }

  function toggleFullscreen(forceValue = null) {
    const next = typeof forceValue === 'boolean' ? forceValue : !state.fullscreen;
    state.fullscreen = next;
    document.documentElement.classList.toggle('wpb-fullscreen-lock', next);
    render();
    if (next) {
      onToast('Mode Layar Penuh aktif — gunakan pintasan di bilah atas atau tekan Esc untuk keluar.');
    }
  }

  function toggleDrawer(drawerName) {
    state.activeDrawer = state.activeDrawer === drawerName ? null : drawerName;
    render();
  }

  function updatePref(patch) {
    state.prefs = { ...state.prefs, ...patch };
    saveWebProxyPrefs(state.prefs);
    if (patch.incognitoMode === true) {
      state.localHistory = wipePrivateLocalHistory();
      onToast('Mode Tanpa Riwayat (100% Privat) aktif — riwayat lokal dikosongkan.');
    } else if (patch.incognitoMode === false) {
      state.localHistory = loadPrivateLocalHistory(false);
      onToast('Riwayat lokal diaktifkan (hanya tersimpan di perangkat ini, tidak pernah dikirim).');
    }
    render();
  }

  function bookmarkCurrentPage() {
    const tab = getActiveTab();
    if (!tab?.url) {
      onToast('Buka situs web terlebih dahulu untuk menyimpan pintasan.');
      return;
    }
    if (state.bookmarks.some((b) => b.url === tab.url)) {
      state.bookmarks = state.bookmarks.filter((b) => b.url !== tab.url);
      saveBookmarks(state.bookmarks);
      onToast('Pintasan dihapus dari Speed Dial.');
      render();
      return;
    }
    const glyph = (tab.title || 'W').trim().charAt(0).toUpperCase() || 'W';
    const next = [
      {
        id: `bm-${Date.now()}`,
        title: String(tab.title || tab.url).slice(0, 26),
        subtitle: new URL(tab.url).hostname,
        url: tab.url,
        accent: getActiveTheme().accentColor,
        glyph,
      },
      ...state.bookmarks,
    ].slice(0, 12);
    state.bookmarks = next;
    saveBookmarks(next);
    onToast('Situs ditambahkan ke pintasan Speed Dial.');
    render();
  }

  async function runManualMediaScan(rawUrl) {
    const target = String(rawUrl || '').trim() || getActiveTab()?.url || '';
    const check = normalizeProxyInput(target);
    if (check.type !== 'url') {
      onToast('Masukkan tautan halaman/video yang valid terlebih dahulu.');
      return;
    }
    state.mediaScanning = true;
    render();
    try {
      const [pageMedia, socialEnriched] = await Promise.allSettled([
        fetchProxiedPage(check.url, { node: state.prefs.routingMode }),
        enrichVidmateMediaForUrl(check.url, []),
      ]);
      const fromPage = pageMedia.status === 'fulfilled' ? pageMedia.value?.media || [] : [];
      const fromSocial = socialEnriched.status === 'fulfilled' ? socialEnriched.value || [] : [];
      const combined = [...fromSocial, ...fromPage.filter((p) => !fromSocial.some((s) => s.url === p.url))];
      const tab = getActiveTab();
      updateTab(tab.id, { media: combined });
      if (combined.length > 0) {
        onToast(`Ditemukan ${combined.length} aliran media siap unduh.`);
      } else {
        onToast('Tidak ada file video/audio publik yang terdeteksi pada tautan tersebut.');
      }
    } catch {
      onToast('Gagal memindai media pada tautan tersebut.');
    } finally {
      state.mediaScanning = false;
      render();
    }
  }

  async function handleAiSubmit(promptText) {
    const q = String(promptText || '').trim();
    if (!q || state.aiLoading) return;
    if (aiAbort) aiAbort.abort();
    aiAbort = new AbortController();

    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: q };
    const assistantMsg = {
      id: `a-${Date.now() + 1}`,
      role: 'assistant',
      content: 'Menganalisis halaman dengan Multi-AI...',
      streaming: true,
    };

    const historyForApi = state.aiMessages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    state.aiMessages = [...state.aiMessages, userMsg, assistantMsg];
    state.aiInput = '';
    state.aiLoading = true;
    render();

    try {
      const res = await askBrowserMultiAi({
        prompt: q,
        history: historyForApi,
        activeTab: getActiveTab(),
        aiModelId: state.prefs.aiModelId,
        signal: aiAbort.signal,
        onDelta: (chunkText) => {
          state.aiMessages = state.aiMessages.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: chunkText, streaming: true } : m
          );
          const streamEl = rootEl.querySelector(`[data-wpb-ai-msg="${assistantMsg.id}"]`);
          if (streamEl) streamEl.textContent = chunkText;
        },
      });
      state.aiMessages = state.aiMessages.map((m) =>
        m.id === assistantMsg.id
          ? { ...m, content: res.content, provider: res.providerLabel, streaming: false }
          : m
      );
    } catch {
      if (!aiAbort?.signal.aborted) {
        state.aiMessages = state.aiMessages.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: 'Gagal menghubungi mesin AI. Silakan coba lagi.', streaming: false }
            : m
        );
      }
    } finally {
      state.aiLoading = false;
      render();
    }
  }

  // Listen to safe postMessage navigation events emitted from sandboxed proxied iframe
  function handleIframeMessage(event) {
    if (!mounted) return;
    const iframe = rootEl.querySelector('#wpb-proxy-iframe');
    if (!iframe || event.source !== iframe.contentWindow) return;
    const data = event.data;
    if (!data || data.type !== 'MANIFEST_PROXY_NAV' || typeof data.url !== 'string') return;
    const check = normalizeProxyInput(data.url);
    if (check.type === 'url') {
      navigateInput(check.url, { pushHistory: true });
    } else if (check.type === 'blocked') {
      onToast(check.error);
    }
  }

  function handleKeyDown(e) {
    if (!mounted) return;
    if (e.key === 'Escape') {
      if (state.activeDrawer) {
        state.activeDrawer = null;
        render();
      } else if (state.fullscreen) {
        toggleFullscreen(false);
      }
    }
  }

  function renderDrawerContent() {
    const tab = getActiveTab();
    if (!state.activeDrawer) return '';

    if (state.activeDrawer === 'media') {
      const mediaList = Array.isArray(tab?.media) ? tab.media : [];
      return `
        <aside class="wpb-drawer" role="dialog" aria-label="Deteksi Media Otomatis VidMate" data-testid="wpb-drawer-media">
          <div class="wpb-drawer-head">
            <div>
              <h3>Deteksi Media (Mode VidMate)</h3>
              <p>Otomatis menangkap video &amp; audio dari situs yang sedang dibuka.</p>
            </div>
            <button type="button" class="wpb-icon-btn" data-wpb-close-drawer aria-label="Tutup panel media">✕</button>
          </div>
          <div class="wpb-drawer-body">
            <form class="wpb-inline-form" id="wpb-media-scan-form">
              <input
                type="url"
                id="wpb-media-scan-input"
                class="wpb-drawer-input"
                placeholder="Tempel tautan video/halaman untuk dipindai..."
                value="${escapeHtml(state.mediaManualUrl || tab?.url || '')}"
                aria-label="Tautan media untuk dipindai"
              />
              <button type="submit" class="wpb-accent-btn" ${state.mediaScanning ? 'disabled' : ''}>
                ${state.mediaScanning ? 'Memindai...' : 'Pindai'}
              </button>
            </form>

            ${
              mediaList.length === 0
                ? `<div class="wpb-empty-drawer">
                    <strong>Belum ada media video/audio terdeteksi di tab ini.</strong>
                    <p>Kunjungi situs yang memuat video (MP4, WebM, HLS, YouTube, TikTok, Instagram, Facebook, Archive.org, atau Pexels) lalu tombol unduh akan otomatis menyala.</p>
                  </div>`
                : `<div class="wpb-media-list">
                    ${mediaList
                      .map(
                        (item, idx) => `
                      <div class="wpb-media-card">
                        <div class="wpb-media-meta">
                          <span class="wpb-media-badge">${escapeHtml(item.format || 'MP4')} · ${escapeHtml(item.quality || 'Auto')}</span>
                          <strong class="wpb-media-title">${escapeHtml(item.title || `Media ${idx + 1}`)}</strong>
                          <span class="wpb-media-src">${escapeHtml(item.source || 'Stream')} · ${escapeHtml(item.kind === 'audio' ? 'Audio' : 'Video')}</span>
                        </div>
                        <div class="wpb-media-actions">
                          <button type="button" class="wpb-accent-btn wpb-btn-xs" data-wpb-dl-idx="${idx}">Unduh</button>
                          <button type="button" class="wpb-ghost-btn wpb-btn-xs" data-wpb-copy-media-idx="${idx}">Salin</button>
                        </div>
                      </div>
                    `
                      )
                      .join('')}
                  </div>`
            }
          </div>
        </aside>
      `;
    }

    if (state.activeDrawer === 'themes') {
      const filteredThemes = filterWebProxyThemes({
        category: state.themeCategory,
        query: state.themeQuery,
      });
      return `
        <aside class="wpb-drawer" role="dialog" aria-label="Galeri 108 Tema Peramban" data-testid="wpb-drawer-themes">
          <div class="wpb-drawer-head">
            <div>
              <h3>Studio Tema (${WEBPROXY_THEMES.length} Tema)</h3>
              <p>Ubah tampilan peramban secara instan sesuai selera Anda.</p>
            </div>
            <button type="button" class="wpb-icon-btn" data-wpb-close-drawer aria-label="Tutup studio tema">✕</button>
          </div>
          <div class="wpb-drawer-body">
            <input
              type="search"
              id="wpb-theme-search"
              class="wpb-drawer-input"
              placeholder="Cari tema (misal: Cyber, Sakura, Gold, Nord)..."
              value="${escapeHtml(state.themeQuery)}"
              aria-label="Cari tema peramban"
            />
            <div class="wpb-theme-cats" role="tablist" aria-label="Kategori tema peramban">
              ${WEBPROXY_THEME_CATEGORIES.map(
                (cat) => `
                <button
                  type="button"
                  class="wpb-cat-chip ${state.themeCategory === cat.id ? 'is-active' : ''}"
                  data-wpb-theme-cat="${escapeHtml(cat.id)}"
                >${escapeHtml(cat.label)}</button>
              `
              ).join('')}
            </div>
            <div class="wpb-theme-count">${filteredThemes.length} tema tersedia · Aktif: <strong>${escapeHtml(getActiveTheme().name)}</strong></div>
            <div class="wpb-theme-grid">
              ${filteredThemes
                .map(
                  (t) => `
                <button
                  type="button"
                  class="wpb-theme-card ${state.prefs.themeId === t.id ? 'is-active' : ''}"
                  data-wpb-select-theme="${escapeHtml(t.id)}"
                  aria-pressed="${state.prefs.themeId === t.id}"
                >
                  <span class="wpb-theme-swatch" style="background:${escapeHtml(t.chromeBg)};border-color:${escapeHtml(t.borderColor)};">
                    <span class="wpb-swatch-bar" style="background:${escapeHtml(t.toolbarBg)};"></span>
                    <span class="wpb-swatch-dot" style="background:${escapeHtml(t.accentColor)};"></span>
                    <span class="wpb-swatch-line" style="background:${escapeHtml(t.textColor)};"></span>
                  </span>
                  <span class="wpb-theme-name">${escapeHtml(t.name)}</span>
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        </aside>
      `;
    }

    if (state.activeDrawer === 'ai') {
      return `
        <aside class="wpb-drawer" role="dialog" aria-label="Asisten Multi-AI Peramban" data-testid="wpb-drawer-ai">
          <div class="wpb-drawer-head">
            <div>
              <h3>Asisten Multi-AI Peramban</h3>
              <p>Gabungan Gemini, ChatGPT, DeepSeek, Grok &amp; Meta Llama.</p>
            </div>
            <button type="button" class="wpb-icon-btn" data-wpb-close-drawer aria-label="Tutup panel AI">✕</button>
          </div>
          <div class="wpb-drawer-body wpb-ai-layout">
            <div class="wpb-ai-models" role="group" aria-label="Pilih mesin AI">
              ${BROWSER_AI_MODELS.map(
                (m) => `
                <button
                  type="button"
                  class="wpb-cat-chip ${state.prefs.aiModelId === m.id ? 'is-active' : ''}"
                  data-wpb-ai-model="${escapeHtml(m.id)}"
                >${escapeHtml(m.short)}</button>
              `
              ).join('')}
            </div>

            <div class="wpb-ai-quick-prompts">
              <button type="button" class="wpb-ghost-btn wpb-btn-xs" data-wpb-ai-quick="Ringkas isi halaman web yang sedang saya buka dalam poin-poin singkat.">Ringkas Halaman</button>
              <button type="button" class="wpb-ghost-btn wpb-btn-xs" data-wpb-ai-quick="Audit keamanan situs ini: apakah ada tanda phishing, penipuan, atau malware?">Audit Keamanan</button>
              <button type="button" class="wpb-ghost-btn wpb-btn-xs" data-wpb-ai-quick="Terjemahkan dan jelaskan inti informasi halaman ini ke Bahasa Indonesia yang santai.">Jelaskan Mudah</button>
            </div>

            <div class="wpb-ai-feed" id="wpb-ai-feed">
              ${
                state.aiMessages.length === 0
                  ? `<div class="wpb-empty-drawer">
                      <strong>Siap membantu penelusuran Anda.</strong>
                      <p>Tanyakan apa saja tentang situs yang sedang dibuka, minta ringkasan cepat, atau audit keamanan tautan secara langsung.</p>
                    </div>`
                  : state.aiMessages
                      .map(
                        (msg) => `
                    <div class="wpb-ai-bubble is-${msg.role}">
                      <div class="wpb-ai-bubble-text" data-wpb-ai-msg="${escapeHtml(msg.id)}">${escapeHtml(msg.content)}</div>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>

            <form class="wpb-inline-form" id="wpb-ai-form">
              <input
                type="text"
                id="wpb-ai-input"
                class="wpb-drawer-input"
                placeholder="Tanya AI tentang halaman ini..."
                value="${escapeHtml(state.aiInput)}"
                autocomplete="off"
                aria-label="Pertanyaan untuk Multi-AI Peramban"
              />
              <button type="submit" class="wpb-accent-btn" ${state.aiLoading ? 'disabled' : ''}>
                ${state.aiLoading ? '...' : 'Kirim'}
              </button>
            </form>
          </div>
        </aside>
      `;
    }

    // Privacy, Anti-Malware & Opt-in Local History Drawer
    const sec = tab?.security || { level: 'safe', score: 100, label: 'Aman & Privat', warnings: [] };
    return `
      <aside class="wpb-drawer" role="dialog" aria-label="Pusat Privasi, Anti-Malware dan Riwayat Lokal" data-testid="wpb-drawer-privacy">
        <div class="wpb-drawer-head">
          <div>
            <h3>Privasi &amp; Keamanan 100%</h3>
            <p>Aktivitas Anda tidak pernah dicatat atau dikirim ke mana pun.</p>
          </div>
          <button type="button" class="wpb-icon-btn" data-wpb-close-drawer aria-label="Tutup panel privasi">✕</button>
        </div>
        <div class="wpb-drawer-body">
          <div class="wpb-shield-summary is-${escapeHtml(sec.level)}">
            <div class="wpb-shield-score">${escapeHtml(sec.score)}/100</div>
            <div>
              <strong>${escapeHtml(sec.label)}</strong>
              <p>${escapeHtml(tab?.relayUsed || 'Jalur Edge Proxy Terenkripsi · Sandbox Aktif')}</p>
            </div>
          </div>

          <div class="wpb-stat-pair">
            <div class="wpb-stat-cell">
              <span>Iklan Diblokir</span>
              <strong>${state.sessionAdsBlocked}</strong>
            </div>
            <div class="wpb-stat-cell">
              <span>Pelacak Dihapus</span>
              <strong>${state.sessionTrackersBlocked}</strong>
            </div>
          </div>

          <div class="wpb-toggle-list">
            <label class="wpb-toggle-row">
              <div>
                <strong>Mode Tanpa Riwayat (Incognito)</strong>
                <span>Default aktif. Nol riwayat disimpan di perangkat maupun server.</span>
              </div>
              <input type="checkbox" id="wpb-toggle-incognito" ${state.prefs.incognitoMode ? 'checked' : ''} />
            </label>
            <label class="wpb-toggle-row">
              <div>
                <strong>Blokir Iklan &amp; Pop-up</strong>
                <span>Menyaring skrip iklan agresif, pop-under, dan frame berbahaya.</span>
              </div>
              <input type="checkbox" id="wpb-toggle-adblock" ${state.prefs.adBlock ? 'checked' : ''} />
            </label>
            <label class="wpb-toggle-row">
              <div>
                <strong>Anti-Pelacak &amp; Anti-Deteksi</strong>
                <span>Hapus UTM/fbclid, blokir cookie pihak ketiga &amp; piksel analitik.</span>
              </div>
              <input type="checkbox" id="wpb-toggle-antitrack" ${state.prefs.antiTrack ? 'checked' : ''} />
            </label>
          </div>

          <div class="wpb-drawer-section">
            <div class="wpb-section-head">
              <h4>Mode Koneksi Proxy / VPN</h4>
            </div>
            <div class="wpb-mode-grid">
              ${PROXY_ROUTING_MODES.map(
                (m) => `
                <button
                  type="button"
                  class="wpb-mode-option ${state.prefs.routingMode === m.id ? 'is-active' : ''}"
                  data-wpb-routing-mode="${escapeHtml(m.id)}"
                >
                  <strong>${escapeHtml(m.label)}</strong>
                  <span>${escapeHtml(m.badge)}</span>
                </button>
              `
              ).join('')}
            </div>
          </div>

          <div class="wpb-drawer-section">
            <div class="wpb-section-head">
              <h4>Riwayat Penelusuran Lokal</h4>
              ${
                !state.prefs.incognitoMode && state.localHistory.length > 0
                  ? `<button type="button" class="wpb-ghost-btn wpb-btn-xs" id="wpb-clear-history-btn">Hapus Semua</button>`
                  : ''
              }
            </div>
            ${
              state.prefs.incognitoMode
                ? `<p class="wpb-muted-note">Mode Tanpa Riwayat sedang AKTIF. Tidak ada satu pun alamat web yang dicatat. Matikan sakelar di atas jika ingin menyimpan riwayat khusus di perangkat ini saja.</p>`
                : state.localHistory.length === 0
                ? `<p class="wpb-muted-note">Riwayat lokal aktif dan 100% privat di perangkat Anda. Belum ada situs yang dikunjungi sejak diaktifkan.</p>`
                : `<div class="wpb-history-list">
                    ${state.localHistory
                      .slice(0, 15)
                      .map(
                        (h) => `
                      <button type="button" class="wpb-history-item" data-wpb-open-url="${escapeHtml(h.url)}">
                        <strong>${escapeHtml(h.title)}</strong>
                        <span>${escapeHtml(h.url)} · ${escapeHtml(formatShortTime(h.visitedAt))}</span>
                      </button>
                    `
                      )
                      .join('')}
                  </div>`
            }
          </div>
        </div>
      </aside>
    `;
  }

  function renderViewportContent(tab) {
    if (tab.loading) {
      return `
        <div class="wpb-viewport-state" role="status" aria-live="polite">
          <span class="wpb-spinner" aria-hidden="true"></span>
          <strong>Menghubungkan jalur terenkripsi...</strong>
          <p>Menyaring iklan, menghapus pelacak, dan memindai keamanan halaman tujuan.</p>
        </div>
      `;
    }

    if (tab.view === 'error') {
      return `
        <div class="wpb-viewport-state is-error" role="alert">
          <h3>Halaman Tidak Dapat Dimuat</h3>
          <p>${escapeHtml(tab.error || 'Terjadi kendala koneksi pada situs tujuan.')}</p>
          <div class="wpb-error-actions">
            <button type="button" class="wpb-accent-btn" id="wpb-retry-antibot-btn">Coba Mode Reader Anti-Bot</button>
            <button type="button" class="wpb-ghost-btn" id="wpb-retry-vpn-btn">Coba Mode VPN Relay</button>
            <button type="button" class="wpb-ghost-btn" id="wpb-back-home-btn">Kembali ke Beranda</button>
          </div>
        </div>
      `;
    }

    if (tab.view === 'search') {
      const results = Array.isArray(tab.searchResults) ? tab.searchResults : [];
      return `
        <div class="wpb-search-view" data-testid="wpb-search-results">
          <div class="wpb-search-header">
            <div>
              <h2>Hasil Pencarian Privat: "${escapeHtml(tab.searchQuery)}"</h2>
              <p>Mesin: ${escapeHtml((tab.searchEngines || ['Privacy Relay']).join(' · '))} · 0 Pelacak · Klik hasil untuk membuka di dalam Peramban Proxy.</p>
            </div>
          </div>
          ${
            results.length === 0
              ? `<div class="wpb-empty-drawer">
                  <strong>Tidak ditemukan hasil untuk kata kunci ini.</strong>
                  <p>Coba kata kunci lain atau ketik alamat website langsung di kolom atas.</p>
                </div>`
              : `<div class="wpb-search-list">
                  ${results
                    .map(
                      (r) => `
                    <article class="wpb-search-item">
                      <span class="wpb-search-host">${escapeHtml(r.displayHost)} · ${escapeHtml(r.source)}</span>
                      <button type="button" class="wpb-search-title-btn" data-wpb-open-url="${escapeHtml(r.url)}">
                        ${escapeHtml(r.title)}
                      </button>
                      <p class="wpb-search-snippet">${escapeHtml(r.snippet)}</p>
                    </article>
                  `
                    )
                    .join('')}
                </div>`
          }
        </div>
      `;
    }

    if (tab.view === 'web' && tab.html) {
      return `
        <div class="wpb-iframe-wrap">
          <div class="wpb-page-strip">
            <span class="wpb-page-relay">${escapeHtml(tab.relayUsed || 'Proxy Stealth')}</span>
            <span>${tab.blockedAds > 0 ? `${tab.blockedAds} iklan diblokir` : 'Bebas iklan'} · ${tab.blockedTrackers > 0 ? `${tab.blockedTrackers} pelacak dihapus` : 'Nol pelacak'}</span>
            ${tab.latencyMs ? `<span class="mono-num">${tab.latencyMs} ms</span>` : ''}
          </div>
          <iframe
            id="wpb-proxy-iframe"
            class="wpb-proxy-iframe"
            title="${escapeHtml(tab.title || 'Konten Peramban Proxy')}"
            sandbox="allow-forms allow-scripts"
            referrerpolicy="no-referrer"
            srcdoc="${escapeHtml(tab.html)}"
          ></iframe>
        </div>
      `;
    }

    // Home / Speed Dial Start Page
    const combinedDial = [...state.bookmarks, ...DEFAULT_SPEED_DIAL_SITES];
    return `
      <div class="wpb-home-stage" data-testid="wpb-speed-dial">
        <div class="wpb-home-hero">
          <div class="wpb-home-brand-row">
            <img src="./assets/icons/tool-webproxy.svg" alt="" width="44" height="44" />
            <div>
              <h2>Peramban Proxy Privat</h2>
              <p>Jelajah web bebas iklan, mode Proxy &amp; VPN Relay gratis, deteksi unduh media otomatis, dan privasi penuh tanpa jejak.</p>
            </div>
          </div>

          <form class="wpb-home-search-form" id="wpb-home-search-form">
            <input
              type="search"
              id="wpb-home-search-input"
              class="wpb-home-search-input"
              placeholder="Cari di web secara privat atau ketik alamat situs (cth: wikipedia.org)..."
              autocomplete="off"
              aria-label="Cari di web atau masukkan URL"
            />
            <button type="submit" class="wpb-accent-btn">Jelajah</button>
          </form>

          <div class="wpb-home-engine-row">
            <span class="wpb-engine-label">Mesin Cari:</span>
            ${PRIVACY_SEARCH_ENGINES.map(
              (eng) => `
              <button
                type="button"
                class="wpb-cat-chip ${state.prefs.searchEngine === eng.id ? 'is-active' : ''}"
                data-wpb-search-engine="${escapeHtml(eng.id)}"
              >${escapeHtml(eng.label)}</button>
            `
            ).join('')}
          </div>
        </div>

        <div class="wpb-home-section">
          <div class="wpb-section-head">
            <h3>Pintasan Cepat (Speed Dial)</h3>
            <span>Klik untuk langsung membuka lewat jalur ${escapeHtml(
              PROXY_ROUTING_MODES.find((m) => m.id === state.prefs.routingMode)?.shortLabel || 'Proxy'
            )}</span>
          </div>
          <div class="wpb-dial-grid">
            ${combinedDial
              .map(
                (site) => `
              <button
                type="button"
                class="wpb-dial-card"
                data-wpb-open-url="${escapeHtml(site.url)}"
                title="${escapeHtml(site.url)}"
              >
                <span class="wpb-dial-glyph" style="background:${escapeHtml(site.accent)};">${escapeHtml(site.glyph)}</span>
                <span class="wpb-dial-title">${escapeHtml(site.title)}</span>
                <span class="wpb-dial-sub">${escapeHtml(site.subtitle)}</span>
              </button>
            `
              )
              .join('')}
          </div>
        </div>

        <div class="wpb-home-section">
          <div class="wpb-section-head">
            <h3>Pilih Jalur Koneksi Gratis</h3>
            <span>100% tanpa biaya · Zero Logging</span>
          </div>
          <div class="wpb-routing-cards">
            ${PROXY_ROUTING_MODES.map(
              (m) => `
              <button
                type="button"
                class="wpb-routing-card ${state.prefs.routingMode === m.id ? 'is-active' : ''}"
                data-wpb-routing-mode="${escapeHtml(m.id)}"
              >
                <div class="wpb-routing-top">
                  <strong>${escapeHtml(m.label)}</strong>
                  <span class="wpb-routing-badge">${escapeHtml(m.badge)}</span>
                </div>
                <p>${escapeHtml(m.description)}</p>
              </button>
            `
            ).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    if (!mounted || !rootEl) return;
    const tab = getActiveTab();
    const activeModeObj = PROXY_ROUTING_MODES.find((m) => m.id === state.prefs.routingMode) || PROXY_ROUTING_MODES[0];
    const mediaCount = Array.isArray(tab?.media) ? tab.media.length : 0;
    const isBookmarked = Boolean(tab?.url && state.bookmarks.some((b) => b.url === tab.url));
    const secLevel = tab?.security?.level || 'safe';

    rootEl.innerHTML = `
      <div class="wpb-shell ${state.fullscreen ? 'is-fullscreen' : ''}" id="wpb-shell" data-testid="webproxy-shell">
        <!-- 1. Multi-Tab Strip -->
        <div class="wpb-tabstrip" role="tablist" aria-label="Tab Peramban Proxy">
          <div class="wpb-tabs-scroll">
            ${state.tabs
              .map(
                (t) => `
              <div class="wpb-tab ${t.id === state.activeTabId ? 'is-active' : ''}" role="tab" aria-selected="${t.id === state.activeTabId}">
                <button type="button" class="wpb-tab-main" data-wpb-switch-tab="${escapeHtml(t.id)}" title="${escapeHtml(t.title)}">
                  <span class="wpb-tab-title">${escapeHtml(t.title)}</span>
                </button>
                <button type="button" class="wpb-tab-close" data-wpb-close-tab="${escapeHtml(t.id)}" aria-label="Tutup tab ${escapeHtml(t.title)}">✕</button>
              </div>
            `
              )
              .join('')}
            <button type="button" class="wpb-new-tab-btn" id="wpb-new-tab-btn" aria-label="Buka tab baru" title="Tab Baru">+</button>
          </div>
          <div class="wpb-tabstrip-meta">
            <button
              type="button"
              class="wpb-mode-pill ${state.prefs.incognitoMode ? 'is-incognito' : ''}"
              data-wpb-drawer="privacy"
              title="Pengaturan Privasi & Mode Tanpa Riwayat"
            >
              ${state.prefs.incognitoMode ? 'Incognito · 0 Riwayat' : 'Riwayat Lokal Privat'}
            </button>
          </div>
        </div>

        <!-- 2. Familiar Browser Toolbar + Omnibox -->
        <div class="wpb-toolbar">
          <div class="wpb-nav-group">
            <button type="button" class="wpb-icon-btn" id="wpb-back-btn" aria-label="Halaman sebelumnya" ${canTabGoBack(tab) ? '' : 'disabled'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button type="button" class="wpb-icon-btn" id="wpb-fwd-btn" aria-label="Halaman berikutnya" ${canTabGoForward(tab) ? '' : 'disabled'}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>
            <button type="button" class="wpb-icon-btn" id="wpb-reload-btn" aria-label="Muat ulang halaman">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
            </button>
            <button type="button" class="wpb-icon-btn" id="wpb-home-btn" aria-label="Beranda Peramban">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </button>
          </div>

          <form class="wpb-omnibox" id="wpb-omnibox-form">
            <button
              type="button"
              class="wpb-shield-btn is-${escapeHtml(secLevel)}"
              data-wpb-drawer="privacy"
              aria-label="Status keamanan dan privasi situs"
              title="${escapeHtml(tab?.security?.label || 'Aman & Privat')}"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
            </button>
            <input
              type="text"
              id="wpb-omnibox-input"
              class="wpb-omnibox-input"
              placeholder="Ketik URL website atau kata kunci pencarian privat..."
              value="${escapeHtml(state.omniboxValue)}"
              autocomplete="off"
              spellcheck="false"
              aria-label="Kolom alamat web atau pencarian"
            />
            ${
              tab?.url
                ? `<button type="button" class="wpb-omni-star ${isBookmarked ? 'is-saved' : ''}" id="wpb-bookmark-btn" aria-label="${isBookmarked ? 'Hapus dari pintasan' : 'Simpan ke pintasan Speed Dial'}" title="Simpan Pintasan">★</button>`
                : ''
            }
            <button type="submit" class="wpb-omni-go" aria-label="Buka alamat atau cari">Buka</button>
          </form>

          <div class="wpb-tools-group">
            <button
              type="button"
              class="wpb-tool-chip"
              id="wpb-cycle-mode-btn"
              title="Ganti antara Mode Proxy, VPN Relay, Reader Anti-Bot, dan Auto"
            >
              <span>${escapeHtml(activeModeObj.shortLabel)}</span>
            </button>

            <button
              type="button"
              class="wpb-tool-chip ${mediaCount > 0 ? 'has-media' : ''} ${state.activeDrawer === 'media' ? 'is-active' : ''}"
              data-wpb-drawer="media"
              aria-label="Deteksi dan unduh media video otomatis"
              title="VidMate Auto Media Detector"
            >
              <span>Media${mediaCount > 0 ? ` (${mediaCount})` : ''}</span>
            </button>

            <button
              type="button"
              class="wpb-tool-chip ${state.activeDrawer === 'ai' ? 'is-active' : ''}"
              data-wpb-drawer="ai"
              aria-label="Buka Asisten Multi-AI Peramban"
              title="Asisten Multi-AI (Gemini, ChatGPT, DeepSeek, Grok, Meta)"
            >
              <span>AI</span>
            </button>

            <button
              type="button"
              class="wpb-tool-chip ${state.activeDrawer === 'themes' ? 'is-active' : ''}"
              data-wpb-drawer="themes"
              aria-label="Pilih dari 108 tema peramban"
              title="Studio 108+ Tema Peramban"
            >
              <span>Tema</span>
            </button>

            <button
              type="button"
              class="wpb-tool-chip ${state.fullscreen ? 'is-active' : ''}"
              id="wpb-fullscreen-btn"
              aria-label="${state.fullscreen ? 'Keluar dari mode layar penuh' : 'Aktifkan mode layar penuh'}"
              title="Mode Layar Penuh"
            >
              <span>${state.fullscreen ? 'Keluar' : 'Layar Penuh'}</span>
            </button>
          </div>
        </div>

        ${
          state.fullscreen
            ? `<div class="wpb-fs-shortcuts" role="toolbar" aria-label="Pintasan Layar Penuh" data-testid="wpb-fullscreen-shortcuts">
                <button type="button" class="wpb-fs-btn" id="wpb-fs-home">Beranda</button>
                <button type="button" class="wpb-fs-btn" id="wpb-fs-focus-url">Cari / URL</button>
                <button type="button" class="wpb-fs-btn" data-wpb-drawer="media">Unduh Media${mediaCount > 0 ? ` (${mediaCount})` : ''}</button>
                <button type="button" class="wpb-fs-btn" data-wpb-drawer="ai">Multi-AI</button>
                <button type="button" class="wpb-fs-btn" data-wpb-drawer="themes">108+ Tema</button>
                <button type="button" class="wpb-fs-btn" data-wpb-drawer="privacy">${state.prefs.incognitoMode ? 'Incognito ON' : 'Privasi'}</button>
                <button type="button" class="wpb-fs-btn is-exit" id="wpb-fs-exit">Tutup Layar Penuh</button>
              </div>`
            : ''
        }

        <!-- 3. Main Viewport + Optional Slide-Over Drawer -->
        <div class="wpb-stage-wrap">
          <div class="wpb-viewport">${renderViewportContent(tab)}</div>
          ${renderDrawerContent()}
        </div>
      </div>
    `;

    applyThemeCssVars(rootEl.querySelector('#wpb-shell'));
    bindEvents();
  }

  function bindEvents() {
    rootEl.querySelector('#wpb-new-tab-btn')?.addEventListener('click', addNewTab);
    rootEl.querySelector('#wpb-back-btn')?.addEventListener('click', goBack);
    rootEl.querySelector('#wpb-fwd-btn')?.addEventListener('click', goForward);
    rootEl.querySelector('#wpb-reload-btn')?.addEventListener('click', reloadActiveTab);
    rootEl.querySelector('#wpb-home-btn')?.addEventListener('click', goHome);
    rootEl.querySelector('#wpb-bookmark-btn')?.addEventListener('click', bookmarkCurrentPage);
    rootEl.querySelector('#wpb-fullscreen-btn')?.addEventListener('click', () => toggleFullscreen());

    rootEl.querySelector('#wpb-fs-home')?.addEventListener('click', goHome);
    rootEl.querySelector('#wpb-fs-exit')?.addEventListener('click', () => toggleFullscreen(false));
    rootEl.querySelector('#wpb-fs-focus-url')?.addEventListener('click', () => {
      const inp = rootEl.querySelector('#wpb-omnibox-input');
      inp?.focus();
      inp?.select();
    });

    rootEl.querySelector('#wpb-cycle-mode-btn')?.addEventListener('click', () => {
      const idx = PROXY_ROUTING_MODES.findIndex((m) => m.id === state.prefs.routingMode);
      const next = PROXY_ROUTING_MODES[(idx + 1) % PROXY_ROUTING_MODES.length];
      updatePref({ routingMode: next.id });
      onToast(`Mode koneksi beralih ke ${next.label} (${next.badge}).`);
    });

    rootEl.querySelector('#wpb-omnibox-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = rootEl.querySelector('#wpb-omnibox-input')?.value || '';
      navigateInput(val, { pushHistory: true });
    });

    rootEl.querySelector('#wpb-home-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = rootEl.querySelector('#wpb-home-search-input')?.value || '';
      navigateInput(val, { pushHistory: true });
    });

    rootEl.querySelectorAll('[data-wpb-switch-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-wpb-switch-tab')));
    });
    rootEl.querySelectorAll('[data-wpb-close-tab]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(btn.getAttribute('data-wpb-close-tab'));
      });
    });

    rootEl.querySelectorAll('[data-wpb-drawer]').forEach((btn) => {
      btn.addEventListener('click', () => toggleDrawer(btn.getAttribute('data-wpb-drawer')));
    });
    rootEl.querySelectorAll('[data-wpb-close-drawer]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.activeDrawer = null;
        render();
      });
    });

    rootEl.querySelectorAll('[data-wpb-open-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = btn.getAttribute('data-wpb-open-url');
        state.activeDrawer = null;
        if (u) navigateInput(u, { pushHistory: true });
      });
    });

    rootEl.querySelectorAll('[data-wpb-routing-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modeId = btn.getAttribute('data-wpb-routing-mode');
        if (modeId) {
          updatePref({ routingMode: modeId });
          const m = PROXY_ROUTING_MODES.find((x) => x.id === modeId);
          onToast(`Mode koneksi aktif: ${m?.label || modeId}.`);
        }
      });
    });

    rootEl.querySelectorAll('[data-wpb-search-engine]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const eng = btn.getAttribute('data-wpb-search-engine');
        if (eng) updatePref({ searchEngine: eng });
      });
    });

    // Error view quick retries
    rootEl.querySelector('#wpb-retry-antibot-btn')?.addEventListener('click', () => {
      updatePref({ routingMode: 'reader-antibot' });
      reloadActiveTab();
    });
    rootEl.querySelector('#wpb-retry-vpn-btn')?.addEventListener('click', () => {
      updatePref({ routingMode: 'vpn-relay' });
      reloadActiveTab();
    });
    rootEl.querySelector('#wpb-back-home-btn')?.addEventListener('click', goHome);

    // Media Drawer bindings
    rootEl.querySelector('#wpb-media-scan-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = rootEl.querySelector('#wpb-media-scan-input')?.value || '';
      state.mediaManualUrl = val;
      runManualMediaScan(val);
    });
    rootEl.querySelectorAll('[data-wpb-dl-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-wpb-dl-idx'));
        const item = getActiveTab()?.media?.[idx];
        if (item) {
          triggerVidmateDownload(item);
          onToast(`Mengunduh ${item.format || 'media'} melalui jalur aman...`);
        }
      });
    });
    rootEl.querySelectorAll('[data-wpb-copy-media-idx]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.getAttribute('data-wpb-copy-media-idx'));
        const item = getActiveTab()?.media?.[idx];
        if (!item?.url) return;
        try {
          await navigator.clipboard.writeText(item.url);
          onToast('Tautan media berhasil disalin.');
        } catch {
          onToast('Gagal menyalin tautan.');
        }
      });
    });

    // Theme Studio bindings
    rootEl.querySelector('#wpb-theme-search')?.addEventListener('input', (e) => {
      state.themeQuery = e.target.value;
      render();
      const inputNow = rootEl.querySelector('#wpb-theme-search');
      if (inputNow) {
        inputNow.focus();
        inputNow.setSelectionRange(state.themeQuery.length, state.themeQuery.length);
      }
    });
    rootEl.querySelectorAll('[data-wpb-theme-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.themeCategory = btn.getAttribute('data-wpb-theme-cat') || 'all';
        render();
      });
    });
    rootEl.querySelectorAll('[data-wpb-select-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.getAttribute('data-wpb-select-theme');
        if (tid) {
          updatePref({ themeId: tid });
          onToast(`Tema "${getWebProxyThemeById(tid).name}" diterapkan.`);
        }
      });
    });

    // Multi-AI Drawer bindings
    rootEl.querySelectorAll('[data-wpb-ai-model]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mid = btn.getAttribute('data-wpb-ai-model');
        if (mid) updatePref({ aiModelId: mid });
      });
    });
    rootEl.querySelectorAll('[data-wpb-ai-quick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-wpb-ai-quick');
        if (q) handleAiSubmit(q);
      });
    });
    rootEl.querySelector('#wpb-ai-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = rootEl.querySelector('#wpb-ai-input')?.value || '';
      handleAiSubmit(val);
    });

    // Privacy & History bindings
    rootEl.querySelector('#wpb-toggle-incognito')?.addEventListener('change', (e) => {
      updatePref({ incognitoMode: Boolean(e.target.checked) });
    });
    rootEl.querySelector('#wpb-toggle-adblock')?.addEventListener('change', (e) => {
      updatePref({ adBlock: Boolean(e.target.checked) });
    });
    rootEl.querySelector('#wpb-toggle-antitrack')?.addEventListener('change', (e) => {
      updatePref({ antiTrack: Boolean(e.target.checked) });
    });
    rootEl.querySelector('#wpb-clear-history-btn')?.addEventListener('click', () => {
      state.localHistory = wipePrivateLocalHistory();
      onToast('Seluruh riwayat lokal berhasil dihapus bersih.');
      render();
    });
  }

  return {
    mount() {
      if (mounted) return;
      mounted = true;
      window.addEventListener('message', handleIframeMessage);
      window.addEventListener('keydown', handleKeyDown);
      render();
    },
    unmount() {
      if (!mounted) return;
      mounted = false;
      if (activeAbort) {
        activeAbort.abort();
        activeAbort = null;
      }
      if (aiAbort) {
        aiAbort.abort();
        aiAbort = null;
      }
      if (state.fullscreen) {
        state.fullscreen = false;
        document.documentElement.classList.remove('wpb-fullscreen-lock');
      }
      window.removeEventListener('message', handleIframeMessage);
      window.removeEventListener('keydown', handleKeyDown);
    },
    redrawTheme() {
      applyThemeCssVars(rootEl?.querySelector('#wpb-shell'));
    },
  };
}
