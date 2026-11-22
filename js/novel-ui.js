/**
 * Manifestudio Novel Hub — Play Store / App Store Inspired Reader & Unified Catalog UI (v72)
 * Features:
 * - Instant 0ms warm-start rendering (`getInstantNovelCatalog`) + progressive live source streaming (`onPartialUpdate`)
 * - Single unified 14+ platform real-time catalog (no separated platform tabs) with 200+ novels & VIP-to-Free mirrors
 * - Hero Spotlight, Continue Reading shelf, Genre filters (including Eks-VIP → Gratis Full), Top Trending #1..#10, Real-time Grid
 * - Book Detail modal with searchable Chapter List & multi-page chapter loading
 * - Unified Search + Excerpt / Screenshot (OCR) / File Novel Matcher (up to 100%) + Direct Local Reader
 * - Reading History & Bookmarks shelf
 * - Immersive Fullscreen Reader with Paged & Scroll modes, Page Jump, Chapter Jump
 * - 122+ Themes Studio (Eye-care, Modern, Illustrated, 26 Live Animated Canvas Particle themes,
 *   Genre themes, Open Palette API sync, Custom Wallpaper/JSON Upload, & AI Theme Request)
 * - Natural Audiobook Voice Mode powered by manifest-ai-voice.js (31 voices, paragraph highlight, auto-next)
 */

import {
  NOVEL_GENRES,
  escapeNovelHtml,
  formatReadsCompact,
  formatRelativeUpdate,
  paginateChapterParagraphs,
} from './novel-logic.js?v=72';
import {
  READER_FONTS,
  THEME_CATEGORIES,
  TOTAL_BUILTIN_THEMES,
  buildCustomUploadedTheme,
  buildIllustrationSvgUri,
} from './novel-themes.js?v=72';
import {
  clearNovelHistory,
  deleteCustomNovelTheme,
  fetchChapterContent,
  fetchNovelChapters,
  fetchUnifiedNovelFeed,
  generateAiNovelTheme,
  generateOpenApiPaletteTheme,
  getAllAvailableNovelThemes,
  getInstantNovelCatalog,
  isNovelBookmarked,
  loadNovelBookmarks,
  loadNovelHistory,
  loadReaderPrefs,
  lookupVerifiedCoverForTitle,
  matchNovelFromInput,
  removeNovelHistoryEntry,
  resolveNovelThemeById,
  saveCustomNovelTheme,
  saveNovelHistoryEntry,
  saveReaderPrefs,
  searchUnifiedNovels,
  toggleNovelBookmark,
} from './novel-engine.js?v=72';
import { MANIFEST_AI_VOICE_CATALOG } from './manifest-ai-logic.js?v=72';
import { createManifestAiVoicePlayer } from './manifest-ai-voice.js?v=72';

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/* ============================================================================
 * LIVE ANIMATED CANVAS PARTICLE ENGINE (10 EFFECTS FOR ANIMATED READER THEMES)
 * ========================================================================== */

function createReaderParticleCanvas(canvasEl) {
  let rafId = 0;
  let particles = [];
  let activeType = 'none';
  let activeColor = '#ffffff';
  let activeAccent = '#3b82f6';
  let width = 0;
  let height = 0;
  let tick = 0;

  const prefersReducedMotion = () =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const resize = () => {
    if (!canvasEl) return;
    const rect = canvasEl.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, Math.floor(rect.width));
    height = Math.max(320, Math.floor(rect.height));
    canvasEl.width = Math.floor(width * dpr);
    canvasEl.height = Math.floor(height * dpr);
    const ctx = canvasEl.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const spawnParticle = (type, randomY = true) => {
    const x = Math.random() * width;
    const y = randomY ? Math.random() * height : type === 'embers' || type === 'bubbles' ? height + 16 : -16;
    if (type === 'rain') {
      return { x, y, vx: -1.4, vy: 8 + Math.random() * 5, len: 14 + Math.random() * 14, alpha: 0.25 + Math.random() * 0.35 };
    }
    if (type === 'matrix') {
      const chars = '01アイウエオカキクケコMANIFESTNOVEL';
      return {
        x: Math.floor(Math.random() * Math.max(12, Math.floor(width / 22))) * 22,
        y,
        vy: 1.8 + Math.random() * 2.4,
        char: chars[Math.floor(Math.random() * chars.length)],
        alpha: 0.2 + Math.random() * 0.4,
      };
    }
    if (type === 'stars') {
      return { x, y, r: 0.8 + Math.random() * 2.1, phase: Math.random() * Math.PI * 2, speed: 0.015 + Math.random() * 0.03 };
    }
    if (type === 'fireflies') {
      return {
        x,
        y,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.6,
        r: 2 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
      };
    }
    if (type === 'embers' || type === 'bubbles') {
      return {
        x,
        y,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -(0.7 + Math.random() * 1.4),
        r: type === 'bubbles' ? 4 + Math.random() * 10 : 1.5 + Math.random() * 3,
        alpha: 0.25 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
      };
    }
    // sakura, snow, autumn
    return {
      x,
      y,
      vx: (Math.random() - 0.3) * 0.8,
      vy: 0.6 + Math.random() * 1.3,
      r: type === 'snow' ? 1.8 + Math.random() * 3.5 : 4 + Math.random() * 5,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.04,
      alpha: 0.35 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    };
  };

  const stop = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (canvasEl) {
      const ctx = canvasEl.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, width || canvasEl.width, height || canvasEl.height);
    }
  };

  let lastFrameAt = 0;

  const isLitePerf = () =>
    typeof document !== 'undefined' && document.documentElement.dataset.perf === 'lite';

  const renderFrame = (nowTs = 0) => {
    if (!canvasEl || activeType === 'none') return;
    if (typeof document !== 'undefined' && document.hidden) {
      rafId = requestAnimationFrame(renderFrame);
      return;
    }
    const lite = isLitePerf();
    if (lite && nowTs && nowTs - lastFrameAt < 48) {
      rafId = requestAnimationFrame(renderFrame);
      return;
    }
    lastFrameAt = nowTs || performance.now();

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    tick += 1;

    if (activeType === 'aurora') {
      const grad1 = ctx.createLinearGradient(0, 0, width, height * 0.6);
      const shift = Math.sin(tick * 0.01) * 0.12;
      grad1.addColorStop(0, 'rgba(0,0,0,0)');
      grad1.addColorStop(Math.max(0.1, 0.35 + shift), `${activeColor}33`);
      grad1.addColorStop(Math.min(0.9, 0.65 - shift), `${activeAccent}2b`);
      grad1.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad1;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.25);
      const stepX = lite ? 90 : 60;
      for (let x = 0; x <= width; x += stepX) {
        const y = height * 0.22 + Math.sin(x * 0.008 + tick * 0.018) * 42 + Math.cos(x * 0.004 - tick * 0.012) * 28;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      rafId = requestAnimationFrame(renderFrame);
      return;
    }

    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      ctx.save();

      if (activeType === 'rain') {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y > height + 20) Object.assign(p, spawnParticle('rain', false));
        ctx.strokeStyle = activeColor;
        ctx.globalAlpha = p.alpha;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 2, p.y + p.len);
        ctx.stroke();
      } else if (activeType === 'matrix') {
        p.y += p.vy;
        if (p.y > height + 20) Object.assign(p, spawnParticle('matrix', false));
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = p.alpha;
        ctx.font = '13px monospace';
        ctx.fillText(p.char, p.x, p.y);
      } else if (activeType === 'stars') {
        p.phase += p.speed;
        const twinkle = 0.25 + Math.abs(Math.sin(p.phase)) * 0.65;
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (activeType === 'fireflies') {
        p.phase += 0.035;
        p.x += p.vx + Math.sin(p.phase) * 0.35;
        p.y += p.vy + Math.cos(p.phase * 0.8) * 0.3;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        const glow = 0.2 + Math.abs(Math.sin(p.phase)) * 0.65;
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = glow;
        if (!lite) {
          ctx.shadowColor = activeColor;
          ctx.shadowBlur = 12;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else if (activeType === 'embers' || activeType === 'bubbles') {
        p.phase += 0.03;
        p.x += p.vx + Math.sin(p.phase) * 0.4;
        p.y += p.vy;
        if (p.y < -20) Object.assign(p, spawnParticle(activeType, false));
        ctx.globalAlpha = p.alpha;
        if (activeType === 'bubbles') {
          ctx.strokeStyle = activeColor;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = activeColor;
          if (!lite) {
            ctx.shadowColor = activeColor;
            ctx.shadowBlur = 8;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // sakura, snow, autumn
        p.phase += 0.02;
        p.x += p.vx + Math.sin(p.phase) * 0.5;
        p.y += p.vy;
        p.rot += p.vrot;
        if (p.y > height + 20) Object.assign(p, spawnParticle(activeType, false));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = activeColor;
        ctx.globalAlpha = p.alpha;
        if (activeType === 'snow') {
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Petal / Autumn leaf ellipse
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    rafId = requestAnimationFrame(renderFrame);
  };

  const start = (type = 'none', color = '#ffffff', accent = '#3b82f6') => {
    stop();
    activeType = type || 'none';
    activeColor = color || '#ffffff';
    activeAccent = accent || '#3b82f6';
    if (!canvasEl || activeType === 'none' || prefersReducedMotion()) return;
    resize();
    const baseCount =
      activeType === 'aurora'
        ? 0
        : activeType === 'rain'
          ? 42
          : activeType === 'stars'
            ? 56
            : activeType === 'matrix'
              ? 30
              : 26;
    const count = isLitePerf() ? Math.ceil(baseCount * 0.5) : baseCount;
    particles = Array.from({ length: count }, () => spawnParticle(activeType, true));
    lastFrameAt = 0;
    rafId = requestAnimationFrame(renderFrame);
  };

  return { start, stop, resize };
}

/* ============================================================================
 * MAIN NOVEL HUB CONTROLLER
 * ========================================================================== */

export function createNovelController(container) {
  let destroyed = false;
  let activeSubTab = 'explore'; // 'explore' | 'search' | 'library'
  let activeGenre = 'all';
  let activeSort = 'trending';
  let visibleGridCount = 48;

  // Catalog state
  let feedLoading = true;
  let feedRefreshing = false;
  let feedError = '';
  let allNovels = [];
  let filteredNovels = [];
  let activeSourcesCount = 0;
  let lastUpdatedAt = 0;

  // Search & Matcher state
  let searchQuery = '';
  let searchLoading = false;
  let searchResults = [];
  let hasSearched = false;
  let matcherMode = 'text'; // 'text' | 'screenshot' | 'file'
  let matcherText = '';
  let matcherFile = null;
  let matcherRunning = false;
  let matcherProgress = { pct: 0, label: '' };
  let matcherResult = null;

  // Detail modal state
  let detailNovel = null;
  let detailChapters = [];
  let detailTotalChapters = 0;
  let detailTotalPages = 1;
  let detailLoadedPage = 1;
  let detailLoading = false;
  let detailChapterFilter = '';

  // Reader state
  let readerOpen = false;
  let readerFullscreen = false;
  let readerNovel = null;
  let readerChapters = [];
  let readerTotalChapters = 0;
  let readerTotalChapterPages = 1;
  let readerLoadedChapterPage = 1;
  let readerChapterIndex = 0;
  let readerChapterTitle = '';
  let readerParagraphs = [];
  let readerPages = [{ pageNumber: 1, paragraphs: [], startParaIndex: 0 }];
  let readerPageIndex = 0;
  let readerLoading = false;
  let readerError = '';
  let activeDrawer = null; // null | 'chapters' | 'pagejump' | 'themes' | 'typography' | 'voice'
  let themeDrawerCategory = 'all';
  let themeSearchQuery = '';
  let aiThemePrompt = '';
  let aiThemeBusy = false;
  let aiThemeStatus = '';
  let drawerChapterFilter = '';

  // Preferences & Audio state
  let prefs = loadReaderPrefs();
  let voicePlayer = createManifestAiVoicePlayer();
  let audioActive = false;
  let audioPaused = false;
  let audioParagraphIndex = -1;
  let audioStatusText = '';
  let audioSessionToken = 0;

  let particleEngine = null;
  let autoRefreshTimer = null;
  let feedAbortCtrl = null;
  let matcherAbortCtrl = null;

  const getFontStack = (fontId) => {
    const found = READER_FONTS.find((f) => f.id === fontId) || READER_FONTS[0];
    return found.family;
  };

  /* --------------------------------------------------------------------------
   * SHELL MARKUP & EVENT DELEGATION
   * ------------------------------------------------------------------------ */

  const renderShell = () => {
    container.innerHTML = `
      <div class="nvl-app" data-nvl-root>
        <div class="nvl-topbar">
          <div class="nvl-topbar-head">
            <div>
              <h2 class="nvl-title">Novel Terpadu</h2>
              <p class="nvl-subtitle" data-nvl-live-meta>Menyinkronkan katalog novel gratis real-time...</p>
            </div>
            <button type="button" class="nvl-refresh-btn" data-nvl-action="refresh-feed" title="Perbarui rilis novel terbaru secara real-time">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>
              <span>Perbarui Live</span>
            </button>
          </div>
          <div class="nvl-subtabs" role="tablist" aria-label="Menu Novel">
            <button type="button" role="tab" class="nvl-subtab is-active" data-nvl-subtab="explore" aria-selected="true">Jelajah</button>
            <button type="button" role="tab" class="nvl-subtab" data-nvl-subtab="search" aria-selected="false">Cari &amp; Match</button>
            <button type="button" role="tab" class="nvl-subtab" data-nvl-subtab="library" aria-selected="false">Riwayat <span class="nvl-tab-count" data-nvl-lib-count></span></button>
          </div>
        </div>

        <div class="nvl-body" data-nvl-body></div>
        <div class="nvl-modal-host" data-nvl-modal-host></div>
        <div class="nvl-reader-host" data-nvl-reader-host></div>
      </div>
    `;
  };

  const updateTopMeta = () => {
    const metaEl = container.querySelector('[data-nvl-live-meta]');
    const libCountEl = container.querySelector('[data-nvl-lib-count]');
    const refreshBtn = container.querySelector('[data-nvl-action="refresh-feed"]');
    if (metaEl) {
      if (feedLoading && allNovels.length === 0) {
        metaEl.textContent = 'Menghubungkan 14+ platform & mirror novel gratis secara real-time...';
      } else {
        const timeStr = lastUpdatedAt
          ? new Date(lastUpdatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          : 'baru saja';
        metaEl.textContent = `Update Real-Time ${timeStr} · ${allNovels.length} novel dari ${Math.max(12, activeSourcesCount)} sumber terpadu · 100% Gratis Penuh`;
      }
    }
    if (libCountEl) {
      const totalSaved = loadNovelHistory().length + loadNovelBookmarks().length;
      libCountEl.textContent = totalSaved > 0 ? `(${totalSaved})` : '';
    }
    if (refreshBtn) {
      refreshBtn.classList.toggle('is-spinning', feedRefreshing);
      refreshBtn.disabled = feedRefreshing;
    }
    container.querySelectorAll('[data-nvl-subtab]').forEach((btn) => {
      const isAct = btn.getAttribute('data-nvl-subtab') === activeSubTab;
      btn.classList.toggle('is-active', isAct);
      btn.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });
  };

  /* --------------------------------------------------------------------------
   * REUSABLE BOOK CARD TEMPLATE (CRISP 2:3 COVER + GUARANTEED FALLBACK)
   * ------------------------------------------------------------------------ */

  const renderBookCardHtml = (novel, { rank = 0, compact = false } = {}) => {
    const poolCover = lookupVerifiedCoverForTitle(novel.title, novel.genre, true);
    const coverSrc = novel.cover || poolCover || novel.fallbackCover;
    const rawAttr = escapeNovelHtml(novel.rawCover || '');
    const poolAttr = escapeNovelHtml(poolCover || '');
    const fallbackAttr = escapeNovelHtml(novel.fallbackCover || '');
    const chLabel = novel.chapterCount > 1 ? `${novel.chapterCount} Bab` : 'Lengkap';
    const badgeLabel = novel.isVipMirror ? 'Eks-VIP Gratis' : 'Gratis';
    return `
      <article class="nvl-book-card ${compact ? 'is-compact' : ''}" data-nvl-open-detail="${escapeNovelHtml(novel.id)}" tabindex="0" role="button" aria-label="Buka detail novel ${escapeNovelHtml(novel.title)}">
        <div class="nvl-cover-wrap">
          <img
            src="${escapeNovelHtml(coverSrc)}"
            alt="${escapeNovelHtml(novel.title)}"
            class="nvl-cover-img"
            loading="lazy"
            referrerpolicy="no-referrer"
            onerror="if(this.dataset.raw&&!this.dataset.triedRaw){this.dataset.triedRaw='1';this.src=this.dataset.raw;}else if(this.dataset.pool&&!this.dataset.triedPool&&this.src!==this.dataset.pool){this.dataset.triedPool='1';this.src=this.dataset.pool;}else if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;}"
            data-raw="${rawAttr}"
            data-pool="${poolAttr}"
            data-fb="${fallbackAttr}"
          />
          ${rank > 0 ? `<span class="nvl-rank-badge">#${rank}</span>` : ''}
          <span class="nvl-free-tag">${escapeNovelHtml(badgeLabel)}</span>
          <span class="nvl-rating-tag">★ ${Number(novel.rating || 4.7).toFixed(1)}</span>
        </div>
        <div class="nvl-card-info">
          <h4 class="nvl-card-title">${escapeNovelHtml(novel.title)}</h4>
          <p class="nvl-card-meta">${escapeNovelHtml(novel.genreLabel)} · ${escapeNovelHtml(chLabel)}</p>
        </div>
      </article>
    `;
  };

  /* --------------------------------------------------------------------------
   * VIEW 1: JELAJAH (TOP-5 PLAY STORE / APP STORE NOVEL APP LAYOUT)
   * ------------------------------------------------------------------------ */

  const renderExploreView = () => {
    if (feedLoading && allNovels.length === 0) {
      return `
        <div class="nvl-loading-state">
          <div class="nvl-skeleton-hero"></div>
          <div class="nvl-skeleton-grid">
            ${Array.from({ length: 8 }, () => '<div class="nvl-skeleton-card"></div>').join('')}
          </div>
        </div>
      `;
    }

    if (feedError && allNovels.length === 0) {
      return `
        <div class="nvl-empty-box">
          <h3>Belum dapat memuat katalog novel</h3>
          <p>${escapeNovelHtml(feedError)}</p>
          <button type="button" class="nvl-btn-primary" data-nvl-action="refresh-feed">Coba Muat Ulang</button>
        </div>
      `;
    }

    const history = loadNovelHistory();
    const spotlight =
      filteredNovels.find((n) => n.cover && n.cover !== n.fallbackCover) ||
      filteredNovels[0] ||
      allNovels[0];
    const trendingTop = (activeGenre === 'all' ? allNovels : filteredNovels).slice(0, 10);
    const catalogSlice = filteredNovels.slice(0, visibleGridCount);
    const hasMore = filteredNovels.length > visibleGridCount;

    const heroHtml = spotlight
      ? `
        <section class="nvl-hero" aria-label="Sorotan Novel Pilihan">
          <div class="nvl-hero-cover-col">
            <img
              src="${escapeNovelHtml(spotlight.cover || spotlight.fallbackCover)}"
              alt="${escapeNovelHtml(spotlight.title)}"
              class="nvl-hero-cover"
              referrerpolicy="no-referrer"
              onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;}"
              data-fb="${escapeNovelHtml(spotlight.fallbackCover || '')}"
            />
          </div>
          <div class="nvl-hero-content">
            <p class="nvl-hero-eyebrow">Sorotan Terpopuler · Gratis Penuh Tanpa Kunci VIP</p>
            <h3 class="nvl-hero-title">${escapeNovelHtml(spotlight.title)}</h3>
            <p class="nvl-hero-meta">
              ${escapeNovelHtml(spotlight.author)} · ${escapeNovelHtml(spotlight.genreLabel)} · ${spotlight.chapterCount} Bab · ★ ${Number(spotlight.rating || 4.8).toFixed(1)} · ${formatReadsCompact(spotlight.reads)} dibaca
            </p>
            <p class="nvl-hero-synopsis">${escapeNovelHtml(spotlight.synopsis || 'Baca novel lengkap tanpa batas dan tanpa kunci VIP.')}</p>
            <div class="nvl-hero-actions">
              <button type="button" class="nvl-btn-primary" data-nvl-quick-read="${escapeNovelHtml(spotlight.id)}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                <span>Baca Sekarang</span>
              </button>
              <button type="button" class="nvl-btn-secondary" data-nvl-open-detail="${escapeNovelHtml(spotlight.id)}">Daftar Bab &amp; Detail</button>
            </div>
          </div>
        </section>
      `
      : '';

    const resumeHtml =
      history.length > 0
        ? `
        <section class="nvl-section">
          <div class="nvl-section-head">
            <h3 class="nvl-section-title">Lanjutkan Membaca</h3>
            <button type="button" class="nvl-link-btn" data-nvl-subtab="library">Lihat Semua (${history.length})</button>
          </div>
          <div class="nvl-resume-shelf">
            ${history
              .slice(0, 6)
              .map((h) => {
                const n = h.novel;
                return `
                  <article class="nvl-resume-card" data-nvl-resume-id="${escapeNovelHtml(n.id)}" role="button" tabindex="0">
                    <img
                      src="${escapeNovelHtml(n.cover || n.fallbackCover)}"
                      alt="${escapeNovelHtml(n.title)}"
                      class="nvl-resume-cover"
                      loading="lazy"
                      referrerpolicy="no-referrer"
                      onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;}"
                      data-fb="${escapeNovelHtml(n.fallbackCover || '')}"
                    />
                    <div class="nvl-resume-info">
                      <h4 class="nvl-resume-title">${escapeNovelHtml(n.title)}</h4>
                      <p class="nvl-resume-sub">${escapeNovelHtml(h.chapterTitle)}</p>
                      <div class="nvl-mini-progress">
                        <span style="width:${Math.max(5, h.progressPct || 10)}%"></span>
                      </div>
                      <p class="nvl-resume-time">${h.progressPct || 0}% · ${formatRelativeUpdate(h.readAt)}</p>
                    </div>
                  </article>
                `;
              })
              .join('')}
          </div>
        </section>
      `
        : '';

    const genreFilterHtml = `
      <div class="nvl-filter-bar">
        <div class="nvl-genre-strip" role="group" aria-label="Filter Genre Novel">
          ${NOVEL_GENRES.map(
            (g) => `
              <button type="button" class="nvl-genre-btn ${activeGenre === g.id ? 'is-active' : ''}" data-nvl-genre="${g.id}">
                ${escapeNovelHtml(g.label)}
              </button>
            `
          ).join('')}
        </div>
        <label class="nvl-sort-wrap">
          <span class="sr-only">Urutkan novel</span>
          <select class="nvl-sort-select" data-nvl-sort>
            <option value="trending" ${activeSort === 'trending' ? 'selected' : ''}>Terpopuler</option>
            <option value="latest" ${activeSort === 'latest' ? 'selected' : ''}>Update Terbaru</option>
            <option value="chapters" ${activeSort === 'chapters' ? 'selected' : ''}>Bab Terbanyak</option>
          </select>
        </label>
      </div>
    `;

    const trendingShelfHtml =
      trendingTop.length > 0
        ? `
        <section class="nvl-section">
          <div class="nvl-section-head">
            <h3 class="nvl-section-title">Sedang Tren &amp; Terpopuler</h3>
            <span class="nvl-section-note">Top ${trendingTop.length} Pilihan Pembaca</span>
          </div>
          <div class="nvl-horizontal-shelf">
            ${trendingTop.map((n, idx) => renderBookCardHtml(n, { rank: idx + 1, compact: true })).join('')}
          </div>
        </section>
      `
        : '';

    const gridHtml = `
      <section class="nvl-section">
        <div class="nvl-section-head">
          <h3 class="nvl-section-title">Katalog Novel Terpadu · Update Real-Time</h3>
          <span class="nvl-section-note">${filteredNovels.length} judul gratis penuh</span>
        </div>
        ${
          catalogSlice.length > 0
            ? `<div class="nvl-book-grid">${catalogSlice.map((n) => renderBookCardHtml(n)).join('')}</div>`
            : `<div class="nvl-empty-box"><p>Belum ada novel di genre ini. Pilih "Semua Genre" atau gunakan pencarian.</p></div>`
        }
        ${
          hasMore
            ? `<div class="nvl-loadmore-wrap"><button type="button" class="nvl-btn-secondary" data-nvl-action="load-more">Muat Lebih Banyak (${filteredNovels.length - visibleGridCount} lainnya)</button></div>`
            : ''
        }
      </section>
    `;

    return `${heroHtml}${resumeHtml}${genreFilterHtml}${trendingShelfHtml}${gridHtml}`;
  };

  /* --------------------------------------------------------------------------
   * VIEW 2: CARI & COCOKKAN (UNIFIED SEARCH + EXCERPT/SCREENSHOT/FILE MATCHER)
   * ------------------------------------------------------------------------ */

  const renderSearchAndMatchView = () => {
    const matcherResultsHtml = matcherResult
      ? `
        <div class="nvl-match-results">
          ${matcherResult.error ? `<p class="nvl-alert-warn">${escapeNovelHtml(matcherResult.error)}</p>` : ''}
          ${
            matcherResult.localReadableNovel
              ? `
              <div class="nvl-local-reader-banner">
                <div>
                  <strong>${escapeNovelHtml(matcherResult.localReadableNovel.title)}</strong>
                  <p>Naskah file Anda (${matcherResult.localReadableNovel.chapterCount} bab) siap dibaca langsung di Pembaca Novel dengan 122+ tema &amp; mode suara!</p>
                </div>
                <button type="button" class="nvl-btn-primary" data-nvl-open-local-match>Baca File Ini</button>
              </div>
            `
              : ''
          }
          ${
            matcherResult.extractedText
              ? `<p class="nvl-extracted-preview"><strong>Cuplikan terbaca (${escapeNovelHtml(matcherResult.extractedSourceLabel)}):</strong> “${escapeNovelHtml(matcherResult.extractedText.slice(0, 180))}${matcherResult.extractedText.length > 180 ? '...' : ''}”</p>`
              : ''
          }
          ${
            matcherResult.matches && matcherResult.matches.length > 0
              ? `
                <div class="nvl-match-list">
                  ${matcherResult.matches
                    .map((m) => {
                      const pctClass = m.scorePct >= 80 ? 'is-high' : m.scorePct >= 45 ? 'is-mid' : 'is-low';
                      return `
                        <article class="nvl-match-card">
                          <img
                            src="${escapeNovelHtml(m.novel.cover || m.novel.fallbackCover)}"
                            alt="${escapeNovelHtml(m.novel.title)}"
                            class="nvl-match-cover"
                            referrerpolicy="no-referrer"
                            onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;}"
                            data-fb="${escapeNovelHtml(m.novel.fallbackCover || '')}"
                          />
                          <div class="nvl-match-body">
                            <div class="nvl-match-head">
                              <h4>${escapeNovelHtml(m.novel.title)}</h4>
                              <span class="nvl-match-score ${pctClass}">${m.scorePct}% Cocok</span>
                            </div>
                            <p class="nvl-card-meta">${escapeNovelHtml(m.novel.author)} · ${escapeNovelHtml(m.novel.genreLabel)} · ${escapeNovelHtml(m.novel.sourceName)}</p>
                            <p class="nvl-match-reason">${escapeNovelHtml(m.reason)}${m.matchedChapterTitle ? ` · ${escapeNovelHtml(m.matchedChapterTitle)}` : ''}</p>
                            <div class="nvl-match-actions">
                              <button type="button" class="nvl-btn-primary nvl-btn-sm" data-nvl-quick-read="${escapeNovelHtml(m.novel.id)}">Baca Novel Ini</button>
                              <button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-open-detail="${escapeNovelHtml(m.novel.id)}">Detail</button>
                            </div>
                          </div>
                        </article>
                      `;
                    })
                    .join('')}
                </div>
              `
              : !matcherResult.error
                ? `<div class="nvl-empty-box"><p>Belum ditemukan novel dengan kemiripan tinggi untuk cuplikan ini. Coba masukkan kalimat yang lebih spesifik atau nama tokoh utama.</p></div>`
                : ''
          }
        </div>
      `
      : '';

    return `
      <div class="nvl-search-layout">
        <section class="nvl-panel">
          <h3 class="nvl-panel-title">Cari Novel di Semua Platform Terpadu</h3>
          <p class="nvl-panel-desc">Cari berdasarkan judul, topik, genre, atau nama penulis secara serentak di seluruh sumber novel gratis.</p>
          <form class="nvl-search-form" data-nvl-search-form>
            <input
              type="search"
              class="nvl-input"
              placeholder="Contoh: Shadow Slave, Martial Peak, Romansa, Isekai, Sitti Nurbaya..."
              value="${escapeNovelHtml(searchQuery)}"
              data-nvl-search-input
            />
            <button type="submit" class="nvl-btn-primary" ${searchLoading ? 'disabled' : ''}>
              ${searchLoading ? 'Mencari...' : 'Cari Novel'}
            </button>
          </form>
          ${
            searchLoading
              ? `<p class="nvl-status-inline">Mencari di semua platform terpadu...</p>`
              : hasSearched
                ? searchResults.length > 0
                  ? `<div class="nvl-book-grid nvl-mt-md">${searchResults.slice(0, 24).map((n) => renderBookCardHtml(n)).join('')}</div>`
                  : `<div class="nvl-empty-box nvl-mt-md"><p>Tidak ada hasil untuk “${escapeNovelHtml(searchQuery)}”. Coba kata kunci yang lebih singkat.</p></div>`
                : ''
          }
        </section>

        <section class="nvl-panel">
          <h3 class="nvl-panel-title">Cocokkan Novel dari Potongan Naskah, Screenshot, atau File (Hingga 100%)</h3>
          <p class="nvl-panel-desc">Punya potongan cerita, tangkapan layar bab novel, atau file novel? Sistem akan memindai &amp; mencocokkan kemiripan hingga 100% di katalog terpadu.</p>

          <div class="nvl-mode-seg" role="group" aria-label="Metode Pencocokan Novel">
            <button type="button" class="nvl-seg-btn ${matcherMode === 'text' ? 'is-active' : ''}" data-nvl-matcher-mode="text">Potongan Teks</button>
            <button type="button" class="nvl-seg-btn ${matcherMode === 'screenshot' ? 'is-active' : ''}" data-nvl-matcher-mode="screenshot">Screenshot (OCR)</button>
            <button type="button" class="nvl-seg-btn ${matcherMode === 'file' ? 'is-active' : ''}" data-nvl-matcher-mode="file">File Novel</button>
          </div>

          ${
            matcherMode === 'text'
              ? `
              <textarea
                class="nvl-textarea"
                rows="4"
                placeholder="Tempel 1–3 kalimat potongan novel, dialog karakter, atau paragraf yang ingin dicari judul aslinya..."
                data-nvl-matcher-text
              >${escapeNovelHtml(matcherText)}</textarea>
            `
              : `
              <label class="nvl-dropzone">
                <input
                  type="file"
                  class="sr-only"
                  data-nvl-matcher-file
                  accept="${matcherMode === 'screenshot' ? 'image/*' : '.txt,.pdf,.docx,.epub,.rtf,.html,.htm,.md'}"
                />
                <span class="nvl-dropzone-title">
                  ${
                    matcherFile
                      ? `File siap: ${escapeNovelHtml(matcherFile.name)} (${Math.max(1, Math.round(matcherFile.size / 1024))} KB)`
                      : matcherMode === 'screenshot'
                        ? 'Pilih Screenshot Halaman Novel (JPG, PNG, WEBP)'
                        : 'Pilih File Novel (TXT, PDF, DOCX, EPUB, RTF, HTML)'
                  }
                </span>
                <span class="nvl-dropzone-sub">
                  ${matcherMode === 'screenshot' ? 'OCR otomatis mendukung Bahasa Indonesia & Inggris' : 'Cocokkan judul asli sekaligus bisa langsung dibaca di Pembaca Novel'}
                </span>
              </label>
            `
          }

          ${
            matcherRunning
              ? `
              <div class="nvl-progress-box">
                <div class="nvl-progress-track"><span style="width:${matcherProgress.pct}%"></span></div>
                <p class="nvl-progress-label">${matcherProgress.pct}% · ${escapeNovelHtml(matcherProgress.label)}</p>
              </div>
            `
              : ''
          }

          <div class="nvl-matcher-actions">
            <button type="button" class="nvl-btn-primary" data-nvl-action="run-matcher" ${matcherRunning ? 'disabled' : ''}>
              ${matcherRunning ? 'Mencocokkan...' : 'Temukan Novel Cocok'}
            </button>
            ${
              matcherResult || matcherFile || matcherText
                ? `<button type="button" class="nvl-btn-secondary" data-nvl-action="reset-matcher">Reset</button>`
                : ''
            }
          </div>

          ${matcherResultsHtml}
        </section>
      </div>
    `;
  };

  /* --------------------------------------------------------------------------
   * VIEW 3: RIWAYAT & RAK (READING HISTORY + BOOKMARKS)
   * ------------------------------------------------------------------------ */

  const renderLibraryView = () => {
    const history = loadNovelHistory();
    const bookmarks = loadNovelBookmarks();

    return `
      <div class="nvl-library-layout">
        <section class="nvl-panel">
          <div class="nvl-section-head">
            <h3 class="nvl-panel-title">Riwayat Membaca (${history.length})</h3>
            ${
              history.length > 0
                ? `<button type="button" class="nvl-link-btn nvl-danger-link" data-nvl-action="clear-history">Hapus Semua</button>`
                : ''
            }
          </div>
          ${
            history.length > 0
              ? `
              <div class="nvl-history-list">
                ${history
                  .map((h) => {
                    const n = h.novel;
                    return `
                      <article class="nvl-history-row">
                        <img
                          src="${escapeNovelHtml(n.cover || n.fallbackCover)}"
                          alt="${escapeNovelHtml(n.title)}"
                          class="nvl-history-cover"
                          referrerpolicy="no-referrer"
                          onerror="if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;}"
                          data-fb="${escapeNovelHtml(n.fallbackCover || '')}"
                        />
                        <div class="nvl-history-info">
                          <h4>${escapeNovelHtml(n.title)}</h4>
                          <p class="nvl-card-meta">${escapeNovelHtml(h.chapterTitle)} · Halaman ${h.pageIndex + 1}/${Math.max(1, h.totalPages)} · ${formatRelativeUpdate(h.readAt)}</p>
                          <div class="nvl-mini-progress"><span style="width:${Math.max(5, h.progressPct || 10)}%"></span></div>
                        </div>
                        <div class="nvl-history-actions">
                          <button type="button" class="nvl-btn-primary nvl-btn-sm" data-nvl-resume-id="${escapeNovelHtml(n.id)}">Lanjutkan</button>
                          <button type="button" class="nvl-icon-btn" data-nvl-del-history="${escapeNovelHtml(n.id)}" title="Hapus dari riwayat" aria-label="Hapus dari riwayat">✕</button>
                        </div>
                      </article>
                    `;
                  })
                  .join('')}
              </div>
            `
              : `<div class="nvl-empty-box"><p>Belum ada riwayat bacaan. Mulai baca novel favorit Anda dari tab Jelajah!</p></div>`
          }
        </section>

        <section class="nvl-panel">
          <div class="nvl-section-head">
            <h3 class="nvl-panel-title">Rak Tersimpan / Bookmark (${bookmarks.length})</h3>
          </div>
          ${
            bookmarks.length > 0
              ? `<div class="nvl-book-grid">${bookmarks.map((b) => renderBookCardHtml(b)).join('')}</div>`
              : `<div class="nvl-empty-box"><p>Belum ada novel disimpan di rak. Klik "Simpan Rak" pada detail novel untuk menyimpan.</p></div>`
          }
        </section>
      </div>
    `;
  };

  const renderBody = () => {
    const bodyEl = container.querySelector('[data-nvl-body]');
    if (!bodyEl) return;
    if (activeSubTab === 'explore') {
      bodyEl.innerHTML = renderExploreView();
    } else if (activeSubTab === 'search') {
      bodyEl.innerHTML = renderSearchAndMatchView();
    } else {
      bodyEl.innerHTML = renderLibraryView();
    }
    updateTopMeta();
  };

  /* --------------------------------------------------------------------------
   * BOOK DETAIL MODAL WITH SEARCHABLE CHAPTER LIST
   * ------------------------------------------------------------------------ */

  const renderDetailModal = () => {
    const host = container.querySelector('[data-nvl-modal-host]');
    if (!host) return;
    if (!detailNovel) {
      host.innerHTML = '';
      return;
    }

    const saved = isNovelBookmarked(detailNovel.id);
    const historyItem = loadNovelHistory().find((h) => h.novel?.id === detailNovel.id);
    const filterLower = detailChapterFilter.trim().toLowerCase();
    const visibleChapters = filterLower
      ? detailChapters.filter((c, i) => c.title.toLowerCase().includes(filterLower) || String(i + 1).includes(filterLower))
      : detailChapters;

    host.innerHTML = `
      <div class="nvl-modal-backdrop" data-nvl-modal-backdrop>
        <div class="nvl-detail-modal" role="dialog" aria-modal="true" aria-label="Detail Novel">
          <div class="nvl-detail-header">
            <h3>Detail Novel</h3>
            <button type="button" class="nvl-icon-btn" data-nvl-close-detail aria-label="Tutup detail">✕</button>
          </div>
          <div class="nvl-detail-scroll">
            <div class="nvl-detail-top">
              <div class="nvl-detail-head-row">
                <img
                  src="${escapeNovelHtml(detailNovel.cover || lookupVerifiedCoverForTitle(detailNovel.title, detailNovel.genre, true) || detailNovel.fallbackCover)}"
                  alt="${escapeNovelHtml(detailNovel.title)}"
                  class="nvl-detail-cover"
                  referrerpolicy="no-referrer"
                  onerror="if(this.dataset.raw&&!this.dataset.triedRaw){this.dataset.triedRaw='1';this.src=this.dataset.raw;}else if(this.dataset.pool&&!this.dataset.triedPool&&this.src!==this.dataset.pool){this.dataset.triedPool='1';this.src=this.dataset.pool;}else if(this.dataset.fb&&this.src!==this.dataset.fb){this.src=this.dataset.fb;}"
                  data-raw="${escapeNovelHtml(detailNovel.rawCover || '')}"
                  data-pool="${escapeNovelHtml(lookupVerifiedCoverForTitle(detailNovel.title, detailNovel.genre, true) || '')}"
                  data-fb="${escapeNovelHtml(detailNovel.fallbackCover || '')}"
                />
                <div class="nvl-detail-head-meta">
                  <h2 class="nvl-detail-title">${escapeNovelHtml(detailNovel.title)}</h2>
                  <p class="nvl-detail-meta">
                    ${escapeNovelHtml(detailNovel.author)} · ${escapeNovelHtml(detailNovel.genreLabel)}${detailNovel.vipOriginPlatform ? ` · Mirror Gratis dari ${escapeNovelHtml(detailNovel.vipOriginPlatform)}` : ''}
                  </p>
                  <p class="nvl-detail-badges">
                    <span>★ ${Number(detailNovel.rating || 4.7).toFixed(1)}</span>
                    <span>·</span>
                    <span>${Math.max(detailTotalChapters, detailNovel.chapterCount || 1)} Bab</span>
                    <span>·</span>
                    <span class="nvl-detail-free-pill">${detailNovel.isVipMirror ? 'Eks-VIP · 100% Gratis Penuh' : '100% Gratis'}</span>
                  </p>
                </div>
              </div>
              <div class="nvl-detail-info">
                <p class="nvl-detail-synopsis">${escapeNovelHtml(detailNovel.synopsis || 'Novel gratis tanpa kunci VIP siap dibaca penuh.')}</p>
                <div class="nvl-detail-actions">
                  <button type="button" class="nvl-btn-primary" data-nvl-start-read="${historyItem ? historyItem.chapterIndex : 0}">
                    ${historyItem ? `Lanjutkan (${escapeNovelHtml(historyItem.chapterTitle.slice(0, 26))})` : 'Mulai Baca Bab 1'}
                  </button>
                  <button type="button" class="nvl-btn-secondary ${saved ? 'is-saved' : ''}" data-nvl-toggle-bookmark>
                    ${saved ? '★ Tersimpan di Rak' : '☆ Simpan ke Rak'}
                  </button>
                </div>
              </div>
            </div>

            <div class="nvl-chapters-section">
              <div class="nvl-chapters-head">
                <h4>Daftar Bab (${Math.max(detailTotalChapters, detailChapters.length)})</h4>
                <input
                  type="search"
                  class="nvl-input nvl-input-sm"
                  placeholder="Cari nomor atau judul bab..."
                  value="${escapeNovelHtml(detailChapterFilter)}"
                  data-nvl-detail-ch-filter
                />
              </div>
              ${
                detailLoading
                  ? `<p class="nvl-status-inline">Memuat daftar bab lengkap...</p>`
                  : visibleChapters.length > 0
                    ? `
                    <div class="nvl-chapter-list">
                      ${visibleChapters
                        .map(
                          (ch) => `
                          <button type="button" class="nvl-chapter-row ${historyItem && historyItem.chapterIndex === ch.index ? 'is-current' : ''}" data-nvl-start-read="${ch.index}">
                            <span class="nvl-ch-num">${ch.index + 1}</span>
                            <span class="nvl-ch-title">${escapeNovelHtml(ch.title)}</span>
                            <span class="nvl-ch-free">Gratis</span>
                          </button>
                        `
                        )
                        .join('')}
                    </div>
                    ${
                      detailLoadedPage < detailTotalPages
                        ? `<div class="nvl-loadmore-wrap"><button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-load-more-detail-ch>Muat 100 Bab Berikutnya (Halaman ${detailLoadedPage + 1}/${detailTotalPages})</button></div>`
                        : ''
                    }
                  `
                    : `<p class="nvl-status-inline">Daftar bab tidak ditemukan untuk kata kunci tersebut.</p>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
  };

  /* --------------------------------------------------------------------------
   * IMMERSIVE FULLSCREEN READER + 122+ THEMES + PAGE JUMP + AUDIOBOOK VOICE
   * ------------------------------------------------------------------------ */

  const computeThemeCssVars = (theme) => {
    const bgStyle = theme.customImage
      ? `url("${theme.customImage}") center/cover no-repeat`
      : theme.bgCss || theme.bg;
    const patternBg = !theme.customImage && theme.patternSvg ? theme.patternSvg : '';
    const patternSize = theme.patternSize || '240px';
    const sheetBg = theme.customImage
      ? theme.isDark
        ? 'rgba(12, 16, 28, 0.86)'
        : 'rgba(255, 255, 255, 0.88)'
      : theme.surface;

    return {
      bgStyle,
      patternBg,
      patternSize,
      sheetBg,
      styleAttr: [
        `--nvl-r-bg:${theme.bg}`,
        `--nvl-r-surface:${sheetBg}`,
        `--nvl-r-text:${theme.text}`,
        `--nvl-r-muted:${theme.muted}`,
        `--nvl-r-accent:${theme.accent}`,
        `--nvl-r-border:${theme.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.12)'}`,
        `--nvl-r-font:${getFontStack(prefs.fontId)}`,
        `--nvl-r-size:${prefs.fontSize}px`,
        `--nvl-r-lh:${prefs.lineHeight}`,
        `--nvl-r-align:${prefs.textAlign}`,
        `filter:brightness(${Math.max(60, Math.min(115, Number(prefs.brightness || 100)))}%)`,
      ].join(';'),
    };
  };

  const renderActiveDrawerHtml = (currentTheme) => {
    if (!activeDrawer) return '';

    if (activeDrawer === 'chapters') {
      const f = drawerChapterFilter.trim().toLowerCase();
      const list = f
        ? readerChapters.filter((c) => c.title.toLowerCase().includes(f) || String(c.index + 1).includes(f))
        : readerChapters;
      return `
        <div class="nvl-drawer">
          <div class="nvl-drawer-head">
            <h4>Daftar Bab &amp; Loncat Bab (${Math.max(readerTotalChapters, readerChapters.length)})</h4>
            <button type="button" class="nvl-icon-btn" data-nvl-drawer="close" aria-label="Tutup">✕</button>
          </div>
          <div class="nvl-drawer-jump-row">
            <input type="search" class="nvl-input nvl-input-sm" placeholder="Cari bab..." value="${escapeNovelHtml(drawerChapterFilter)}" data-nvl-drawer-ch-filter />
            <input type="number" min="1" max="${Math.max(1, readerChapters.length)}" class="nvl-input nvl-input-num" value="${readerChapterIndex + 1}" data-nvl-jump-ch-num aria-label="Nomor bab" />
            <button type="button" class="nvl-btn-primary nvl-btn-sm" data-nvl-action="jump-chapter">Loncat</button>
          </div>
          <div class="nvl-drawer-list">
            ${list
              .map(
                (ch) => `
                <button type="button" class="nvl-chapter-row ${ch.index === readerChapterIndex ? 'is-current' : ''}" data-nvl-goto-ch="${ch.index}">
                  <span class="nvl-ch-num">${ch.index + 1}</span>
                  <span class="nvl-ch-title">${escapeNovelHtml(ch.title)}</span>
                </button>
              `
              )
              .join('')}
          </div>
          ${
            readerLoadedChapterPage < readerTotalChapterPages
              ? `<button type="button" class="nvl-btn-secondary nvl-btn-sm nvl-full-btn" data-nvl-load-more-reader-ch>Muat 100 Bab Berikutnya</button>`
              : ''
          }
        </div>
      `;
    }

    if (activeDrawer === 'pagejump') {
      const totalP = Math.max(1, readerPages.length);
      return `
        <div class="nvl-drawer">
          <div class="nvl-drawer-head">
            <h4>Mode Baca &amp; Loncat Halaman</h4>
            <button type="button" class="nvl-icon-btn" data-nvl-drawer="close" aria-label="Tutup">✕</button>
          </div>
          <div class="nvl-drawer-section">
            <span class="nvl-drawer-label">Mode Halaman</span>
            <div class="nvl-mode-seg">
              <button type="button" class="nvl-seg-btn ${prefs.readingMode === 'paged' ? 'is-active' : ''}" data-nvl-pref-mode="paged">Per Halaman (Loncat)</button>
              <button type="button" class="nvl-seg-btn ${prefs.readingMode === 'scroll' ? 'is-active' : ''}" data-nvl-pref-mode="scroll">Gulir Vertikal</button>
            </div>
          </div>
          <div class="nvl-drawer-section">
            <span class="nvl-drawer-label">Loncat Halaman Langsung (Halaman ${readerPageIndex + 1} dari ${totalP})</span>
            <div class="nvl-page-jump-controls">
              <input type="range" min="1" max="${totalP}" value="${readerPageIndex + 1}" class="nvl-range" data-nvl-page-slider />
              <div class="nvl-page-jump-inline">
                <input type="number" min="1" max="${totalP}" value="${readerPageIndex + 1}" class="nvl-input nvl-input-num" data-nvl-page-input aria-label="Nomor halaman" />
                <button type="button" class="nvl-btn-primary nvl-btn-sm" data-nvl-action="jump-page">Loncat Halaman</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (activeDrawer === 'themes') {
      const allThemes = getAllAvailableNovelThemes();
      const q = themeSearchQuery.trim().toLowerCase();
      const filtered = allThemes.filter((t) => {
        const catOk = themeDrawerCategory === 'all' || t.category === themeDrawerCategory;
        const qOk = !q || t.name.toLowerCase().includes(q) || (t.category || '').toLowerCase().includes(q);
        return catOk && qOk;
      });
      return `
        <div class="nvl-drawer nvl-drawer-tall">
          <div class="nvl-drawer-head">
            <h4>Studio Tema Halaman (${allThemes.length} Tema Tersedia)</h4>
            <button type="button" class="nvl-icon-btn" data-nvl-drawer="close" aria-label="Tutup">✕</button>
          </div>

          <div class="nvl-theme-tools-grid">
            <div class="nvl-ai-theme-box">
              <label class="nvl-drawer-label" for="nvlAiThemeInput">Request Tema ke AI (Otomatis Warna, Ilustrasi &amp; Animasi)</label>
              <div class="nvl-ai-theme-row">
                <input id="nvlAiThemeInput" type="text" class="nvl-input nvl-input-sm" placeholder="Contoh: malam hujan di kyoto dengan sakura lembut..." value="${escapeNovelHtml(aiThemePrompt)}" data-nvl-ai-theme-input />
                <button type="button" class="nvl-btn-primary nvl-btn-sm" data-nvl-action="gen-ai-theme" ${aiThemeBusy ? 'disabled' : ''}>
                  ${aiThemeBusy ? 'Meracik...' : 'Buat AI'}
                </button>
              </div>
              ${aiThemeStatus ? `<p class="nvl-mini-status">${escapeNovelHtml(aiThemeStatus)}</p>` : ''}
            </div>

            <div class="nvl-custom-theme-actions">
              <label class="nvl-btn-secondary nvl-btn-sm nvl-upload-lbl">
                <input type="file" class="sr-only" accept="image/*,.json" data-nvl-upload-theme />
                Upload Wallpaper / JSON
              </label>
              <button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-action="sync-api-theme">Tema API Publik</button>
              <button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-action="export-theme">Ekspor JSON</button>
            </div>
          </div>

          <div class="nvl-theme-filter-row">
            <div class="nvl-theme-cats">
              ${THEME_CATEGORIES.map(
                (c) => `
                <button type="button" class="nvl-cat-btn ${themeDrawerCategory === c.id ? 'is-active' : ''}" data-nvl-theme-cat="${c.id}">
                  ${escapeNovelHtml(c.label)}
                </button>
              `
              ).join('')}
            </div>
            <input type="search" class="nvl-input nvl-input-sm" placeholder="Cari dari ${allThemes.length} tema..." value="${escapeNovelHtml(themeSearchQuery)}" data-nvl-theme-search />
          </div>

          <div class="nvl-theme-grid" data-nvl-theme-grid>
            ${filtered
              .map((t) => {
                const isActive = t.id === currentTheme.id;
                const badge = t.animation && t.animation !== 'none' ? 'Anim' : t.patternSvg ? 'Art' : t.category === 'custom' ? 'AI/Kustom' : '';
                const swatchBg = t.customImage ? `url('${t.customImage}') center/cover` : t.bgCss || t.bg;
                return `
                  <div class="nvl-theme-item ${isActive ? 'is-active' : ''}">
                    <button
                      type="button"
                      class="nvl-theme-swatch"
                      data-nvl-select-theme="${escapeNovelHtml(t.id)}"
                      style="background:${swatchBg};color:${t.text};border-color:${isActive ? t.accent : 'transparent'}"
                      title="${escapeNovelHtml(t.name)}"
                    >
                      <span class="nvl-swatch-aa" style="color:${t.text}">Aa</span>
                      <span class="nvl-swatch-dot" style="background:${t.accent}"></span>
                      ${badge ? `<span class="nvl-swatch-tag">${badge}</span>` : ''}
                    </button>
                    <div class="nvl-theme-label-row">
                      <span class="nvl-theme-name">${escapeNovelHtml(t.name)}</span>
                      ${t.category === 'custom' ? `<button type="button" class="nvl-theme-del" data-nvl-del-theme="${escapeNovelHtml(t.id)}" title="Hapus tema kustom">✕</button>` : ''}
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </div>
      `;
    }

    if (activeDrawer === 'typography') {
      return `
        <div class="nvl-drawer">
          <div class="nvl-drawer-head">
            <h4>Tampilan Huruf &amp; Kenyamanan Mata</h4>
            <button type="button" class="nvl-icon-btn" data-nvl-drawer="close" aria-label="Tutup">✕</button>
          </div>
          <div class="nvl-typo-grid">
            <div class="nvl-drawer-section">
              <span class="nvl-drawer-label">Ukuran Huruf (${prefs.fontSize}px)</span>
              <div class="nvl-stepper">
                <button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-font-delta="-2">A-</button>
                <span>${prefs.fontSize}px</span>
                <button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-font-delta="2">A+</button>
              </div>
            </div>
            <div class="nvl-drawer-section">
              <span class="nvl-drawer-label">Spasi Baris (${prefs.lineHeight})</span>
              <div class="nvl-stepper">
                <button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-lh-delta="-0.15">Rapat</button>
                <span>${Number(prefs.lineHeight).toFixed(2)}</span>
                <button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-lh-delta="0.15">Lega</button>
              </div>
            </div>
            <div class="nvl-drawer-section">
              <span class="nvl-drawer-label">Jenis Huruf</span>
              <div class="nvl-font-pills">
                ${READER_FONTS.map(
                  (f) => `
                  <button type="button" class="nvl-seg-btn ${prefs.fontId === f.id ? 'is-active' : ''}" data-nvl-font-id="${f.id}">${escapeNovelHtml(f.label)}</button>
                `
                ).join('')}
              </div>
            </div>
            <div class="nvl-drawer-section">
              <span class="nvl-drawer-label">Kecerahan Halaman (${prefs.brightness}%)</span>
              <input type="range" min="65" max="110" value="${prefs.brightness}" class="nvl-range" data-nvl-brightness />
            </div>
          </div>
        </div>
      `;
    }

    if (activeDrawer === 'voice') {
      const idVoices = MANIFEST_AI_VOICE_CATALOG.filter((v) => v.baseLang === 'id' || v.isMultilingual);
      const otherVoices = MANIFEST_AI_VOICE_CATALOG.filter((v) => v.baseLang !== 'id' && !v.isMultilingual);
      return `
        <div class="nvl-drawer">
          <div class="nvl-drawer-head">
            <h4>Mode Suara / Audiobook Novel (${MANIFEST_AI_VOICE_CATALOG.length} Suara Natural)</h4>
            <button type="button" class="nvl-icon-btn" data-nvl-drawer="close" aria-label="Tutup">✕</button>
          </div>
          <div class="nvl-voice-controls">
            <div class="nvl-voice-transport">
              <button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-voice-action="prev">⏮ Paragraf</button>
              <button type="button" class="nvl-btn-primary nvl-btn-sm" data-nvl-voice-action="toggle">
                ${audioActive && !audioPaused ? '⏸ Jeda Baca' : audioPaused ? '▶ Lanjutkan' : '▶ Dengarkan Bab Ini'}
              </button>
              <button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-voice-action="next">Paragraf ⏭</button>
              ${audioActive || audioPaused ? `<button type="button" class="nvl-btn-secondary nvl-btn-sm" data-nvl-voice-action="stop">⏹ Stop</button>` : ''}
            </div>
            ${audioStatusText ? `<p class="nvl-mini-status">${escapeNovelHtml(audioStatusText)}</p>` : ''}
            <div class="nvl-voice-settings-grid">
              <label class="nvl-voice-field">
                <span>Pilih Pembaca (Pria &amp; Wanita)</span>
                <select class="nvl-sort-select" data-nvl-voice-id>
                  <optgroup label="Rekomendasi Indonesia &amp; Multibahasa (Natural)">
                    ${idVoices
                      .map(
                        (v) =>
                          `<option value="${escapeNovelHtml(v.id)}" ${prefs.voiceId === v.id ? 'selected' : ''}>${escapeNovelHtml(v.name)} (${v.gender === 'male' ? 'Pria' : 'Wanita'})</option>`
                      )
                      .join('')}
                  </optgroup>
                  <optgroup label="Suara Internasional Lainnya">
                    ${otherVoices
                      .map(
                        (v) =>
                          `<option value="${escapeNovelHtml(v.id)}" ${prefs.voiceId === v.id ? 'selected' : ''}>${escapeNovelHtml(v.name)} (${v.gender === 'male' ? 'Pria' : 'Wanita'})</option>`
                      )
                      .join('')}
                  </optgroup>
                </select>
              </label>
              <label class="nvl-voice-field">
                <span>Kecepatan (${Number(prefs.voiceRate).toFixed(2)}x)</span>
                <select class="nvl-sort-select" data-nvl-voice-rate>
                  ${[0.8, 0.9, 1.0, 1.1, 1.25, 1.4]
                    .map((r) => `<option value="${r}" ${Number(prefs.voiceRate) === r ? 'selected' : ''}>${r.toFixed(2)}x</option>`)
                    .join('')}
                </select>
              </label>
              <label class="nvl-voice-check">
                <input type="checkbox" ${prefs.autoNextChapter ? 'checked' : ''} data-nvl-voice-autonext />
                <span>Otomatis lanjut ke bab berikutnya saat selesai</span>
              </label>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  };

  const renderReader = () => {
    const host = container.querySelector('[data-nvl-reader-host]');
    if (!host) return;
    if (!readerOpen || !readerNovel) {
      if (particleEngine) {
        particleEngine.stop();
        particleEngine = null;
      }
      host.innerHTML = '';
      document.body.classList.remove('nvl-reader-locked');
      return;
    }

    document.body.classList.add('nvl-reader-locked');
    const theme = resolveNovelThemeById(prefs.themeId);
    const { bgStyle, patternBg, patternSize, styleAttr } = computeThemeCssVars(theme);
    const totalPages = Math.max(1, readerPages.length);
    const safePageIdx = Math.min(totalPages - 1, Math.max(0, readerPageIndex));
    const currentPageObj = readerPages[safePageIdx] || { paragraphs: [], startParaIndex: 0 };
    const pageParagraphs = prefs.readingMode === 'paged' ? currentPageObj.paragraphs || [] : readerParagraphs;
    const pageGlobalOffset = prefs.readingMode === 'paged' ? Number(currentPageObj.startParaIndex || 0) : 0;

    const hasPrevChapter = readerChapterIndex > 0;
    const hasNextChapter = readerChapterIndex + 1 < readerChapters.length;

    host.innerHTML = `
      <div class="nvl-reader-overlay ${readerFullscreen ? 'is-fullscreen' : ''} ${theme.isDark ? 'is-dark-theme' : 'is-light-theme'}" style="${styleAttr};background:${bgStyle}" data-nvl-reader-overlay>
        ${patternBg ? `<div class="nvl-reader-motif" style="background-image:${patternBg};background-size:${patternSize}"></div>` : ''}
        <canvas class="nvl-reader-canvas" data-nvl-particle-canvas aria-hidden="true"></canvas>

        <header class="nvl-reader-topbar">
          <div class="nvl-reader-top-left">
            <button type="button" class="nvl-r-btn" data-nvl-action="close-reader" title="Kembali ke katalog">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
              <span>Kembali</span>
            </button>
            <div class="nvl-reader-titles">
              <strong class="nvl-r-book-title">${escapeNovelHtml(readerNovel.title)}</strong>
              <span class="nvl-r-ch-title">${escapeNovelHtml(readerChapterTitle || `Bab ${readerChapterIndex + 1}`)}</span>
            </div>
          </div>
          <div class="nvl-reader-top-right">
            <button type="button" class="nvl-r-btn ${audioActive ? 'is-active' : ''}" data-nvl-drawer="voice" title="Mode Suara / Audiobook">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              <span>Suara</span>
            </button>
            <button type="button" class="nvl-r-btn ${readerFullscreen ? 'is-active' : ''}" data-nvl-action="toggle-fullscreen" title="Layar Penuh">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" aria-hidden="true">
                ${
                  readerFullscreen
                    ? '<polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>'
                    : '<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>'
                }
              </svg>
              <span>${readerFullscreen ? 'Keluar Full' : 'Layar Penuh'}</span>
            </button>
          </div>
        </header>

        <main class="nvl-reader-stage" data-nvl-reader-stage>
          <article class="nvl-reader-paper">
            ${
              readerLoading
                ? `<div class="nvl-reader-loading"><div class="nvl-spinner"></div><p>Memuat isi bab penuh (100% gratis tanpa kunci)...</p></div>`
                : readerError
                  ? `<div class="nvl-reader-loading"><p>${escapeNovelHtml(readerError)}</p><button type="button" class="nvl-btn-primary nvl-btn-sm" data-nvl-goto-ch="${readerChapterIndex}">Coba Muat Ulang</button></div>`
                  : `
                  <div class="nvl-chapter-heading-wrap">
                    <p class="nvl-chapter-kicker">Bab ${readerChapterIndex + 1} dari ${Math.max(readerTotalChapters, readerChapters.length)} · ${escapeNovelHtml(theme.name)}</p>
                    <h1 class="nvl-chapter-heading">${escapeNovelHtml(readerChapterTitle)}</h1>
                  </div>
                  <div class="nvl-chapter-paragraphs">
                    ${
                      pageParagraphs.length > 0
                        ? pageParagraphs
                            .map((para, localIdx) => {
                              const globalIdx = pageGlobalOffset + localIdx;
                              const isSpeaking = audioActive && audioParagraphIndex === globalIdx;
                              return `<p class="nvl-para ${isSpeaking ? 'is-speaking' : ''}" data-nvl-para-idx="${globalIdx}">${escapeNovelHtml(para)}</p>`;
                            })
                            .join('')
                        : `<p class="nvl-para">Isi bab kosong atau sedang diperbarui oleh sumber. Silakan pilih bab berikutnya.</p>`
                    }
                  </div>

                  <div class="nvl-reader-nav-footer">
                    ${
                      prefs.readingMode === 'paged' && totalPages > 1
                        ? `
                        <div class="nvl-page-turn-bar">
                          <button type="button" class="nvl-r-nav-btn" data-nvl-page-step="-1" ${safePageIdx <= 0 && !hasPrevChapter ? 'disabled' : ''}>← Halaman Sebelumnya</button>
                          <button type="button" class="nvl-r-page-pill" data-nvl-drawer="pagejump">Hal ${safePageIdx + 1} / ${totalPages}</button>
                          <button type="button" class="nvl-r-nav-btn" data-nvl-page-step="1" ${safePageIdx >= totalPages - 1 && !hasNextChapter ? 'disabled' : ''}>Halaman Berikutnya →</button>
                        </div>
                      `
                        : ''
                    }
                    <div class="nvl-chapter-turn-bar">
                      <button type="button" class="nvl-r-nav-btn" data-nvl-goto-ch="${readerChapterIndex - 1}" ${!hasPrevChapter ? 'disabled' : ''}>⏮ Bab Sebelumnya</button>
                      <button type="button" class="nvl-r-nav-btn" data-nvl-drawer="chapters">Daftar Bab</button>
                      <button type="button" class="nvl-r-nav-btn is-primary" data-nvl-goto-ch="${readerChapterIndex + 1}" ${!hasNextChapter ? 'disabled' : ''}>Bab Berikutnya ⏭</button>
                    </div>
                  </div>
                `
            }
          </article>
        </main>

        ${renderActiveDrawerHtml(theme)}

        <nav class="nvl-reader-bottombar" aria-label="Kontrol Pembaca Novel">
          <button type="button" class="nvl-r-tab ${activeDrawer === 'chapters' ? 'is-active' : ''}" data-nvl-drawer="chapters">
            <span>Bab</span>
          </button>
          <button type="button" class="nvl-r-tab ${activeDrawer === 'pagejump' ? 'is-active' : ''}" data-nvl-drawer="pagejump">
            <span>${prefs.readingMode === 'paged' ? `Hal ${safePageIdx + 1}/${totalPages}` : 'Halaman'}</span>
          </button>
          <button type="button" class="nvl-r-tab ${activeDrawer === 'themes' ? 'is-active' : ''}" data-nvl-drawer="themes">
            <span>Tema (${TOTAL_BUILTIN_THEMES}+)</span>
          </button>
          <button type="button" class="nvl-r-tab ${activeDrawer === 'typography' ? 'is-active' : ''}" data-nvl-drawer="typography">
            <span>Aa</span>
          </button>
          <button type="button" class="nvl-r-tab ${activeDrawer === 'voice' || audioActive ? 'is-active' : ''}" data-nvl-drawer="voice">
            <span>${audioActive && !audioPaused ? 'Suara ●' : 'Suara'}</span>
          </button>
        </nav>
      </div>
    `;

    // Start live particle animation if active theme has animation
    const canvasEl = host.querySelector('[data-nvl-particle-canvas]');
    if (canvasEl) {
      particleEngine = createReaderParticleCanvas(canvasEl);
      particleEngine.start(theme.animation || 'none', theme.animColor || theme.accent, theme.animColor2 || theme.accent);
    }

    // Auto-scroll active spoken paragraph into view
    if (audioActive && audioParagraphIndex >= 0) {
      const speakingEl = host.querySelector(`[data-nvl-para-idx="${audioParagraphIndex}"]`);
      if (speakingEl) {
        speakingEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  /* --------------------------------------------------------------------------
   * AUDIOBOOK VOICE ENGINE LOOP (NATURAL MULTILINGUAL PARAGRAPH STREAMING)
   * ------------------------------------------------------------------------ */

  const stopAudiobook = ({ resetIndex = true } = {}) => {
    audioSessionToken += 1;
    audioActive = false;
    audioPaused = false;
    if (resetIndex) audioParagraphIndex = -1;
    audioStatusText = '';
    try {
      voicePlayer.stop();
    } catch {
      // Ignore
    }
    if (readerOpen) renderReader();
  };

  const pauseAudiobook = () => {
    audioSessionToken += 1;
    audioActive = false;
    audioPaused = true;
    audioStatusText = `Dijeda di paragraf ${Math.max(1, audioParagraphIndex + 1)}`;
    try {
      voicePlayer.stop();
    } catch {
      // Ignore
    }
    if (readerOpen) renderReader();
  };

  const syncPageForParagraph = (paraIdx) => {
    if (prefs.readingMode !== 'paged' || readerPages.length <= 1) return;
    for (let p = 0; p < readerPages.length; p += 1) {
      const pg = readerPages[p];
      const start = Number(pg?.startParaIndex || 0);
      const len = Array.isArray(pg?.paragraphs) ? pg.paragraphs.length : 0;
      if (paraIdx >= start && paraIdx < start + len) {
        if (readerPageIndex !== p) {
          readerPageIndex = p;
        }
        return;
      }
    }
  };

  const startAudiobookFrom = async (startIdx = 0) => {
    if (!readerOpen || readerParagraphs.length === 0) return;
    const myToken = ++audioSessionToken;
    audioActive = true;
    audioPaused = false;
    const clampedStart = Math.max(0, Math.min(readerParagraphs.length - 1, startIdx));

    for (let idx = clampedStart; idx < readerParagraphs.length; idx += 1) {
      if (myToken !== audioSessionToken || !readerOpen || destroyed) return;
      audioParagraphIndex = idx;
      syncPageForParagraph(idx);
      audioStatusText = `Membacakan paragraf ${idx + 1} / ${readerParagraphs.length}...`;
      renderReader();

      const text = readerParagraphs[idx];
      if (!text || text.length < 2) continue;

      await new Promise((resolve) => {
        voicePlayer
          .play({
            msgId: `nvl-${readerChapterIndex}-${idx}`,
            text,
            voiceId: prefs.voiceId || 'multi-ava',
            rate: Number(prefs.voiceRate || 1.0),
            style: prefs.voiceStyle || 'natural',
            codeSwitch: true,
            onStateChange: (st) => {
              if (myToken !== audioSessionToken) return;
              if (st.voiceName) {
                audioStatusText = st.isLoading
                  ? `Menyiapkan suara ${st.voiceName} (Paragraf ${idx + 1}/${readerParagraphs.length})...`
                  : `Membacakan: ${st.voiceName} · Paragraf ${idx + 1}/${readerParagraphs.length}`;
                const statusEl = container.querySelector('.nvl-drawer .nvl-mini-status');
                if (statusEl) statusEl.textContent = audioStatusText;
              }
            },
            onError: () => {
              // Fall through gracefully
            },
          })
          .finally(resolve);
      });
    }

    if (myToken !== audioSessionToken || !readerOpen || destroyed) return;

    // Auto-advance to next chapter when enabled!
    if (prefs.autoNextChapter && readerChapterIndex + 1 < readerChapters.length) {
      audioStatusText = 'Melanjutkan otomatis ke bab berikutnya...';
      renderReader();
      await loadReaderChapter(readerChapterIndex + 1, { startPage: 0 });
      if (myToken === audioSessionToken && readerOpen && !destroyed) {
        startAudiobookFrom(0);
      }
    } else {
      stopAudiobook({ resetIndex: true });
    }
  };

  /* --------------------------------------------------------------------------
   * ACTIONS & DATA LOADING
   * ------------------------------------------------------------------------ */

  const applyFilterAndSort = () => {
    let list = [...allNovels];
    if (activeGenre === 'vip-free') {
      list = list.filter((n) => Boolean(n.isVipMirror || n.vipOriginPlatform));
    } else if (activeGenre !== 'all') {
      list = list.filter((n) => n.genre === activeGenre);
    }
    if (activeSort === 'latest') {
      list.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    } else if (activeSort === 'chapters') {
      list.sort((a, b) => (b.chapterCount || 0) - (a.chapterCount || 0));
    } else {
      list.sort((a, b) => (b.reads || 0) - (a.reads || 0));
    }
    filteredNovels = list;
  };

  const loadFeed = async ({ forceRefresh = false } = {}) => {
    if (feedAbortCtrl) feedAbortCtrl.abort();
    feedAbortCtrl = new AbortController();

    // Instant 0ms warm-start: populate synchronously from local cache + VIP-free mirror seed catalog
    // so the user never sees blank gray skeleton cards waiting on slow network sources!
    if (allNovels.length === 0) {
      const warm = getInstantNovelCatalog({ genre: 'all', sortBy: 'trending' });
      if (warm && Array.isArray(warm.allNovels) && warm.allNovels.length > 0) {
        allNovels = warm.allNovels;
        activeSourcesCount = warm.activeSourcesCount || 12;
        lastUpdatedAt = warm.fetchedAt || Date.now();
        feedLoading = false;
        applyFilterAndSort();
      } else {
        feedLoading = true;
      }
    }

    feedRefreshing = true;
    feedError = '';
    updateTopMeta();
    renderBody();

    try {
      const res = await fetchUnifiedNovelFeed({
        forceRefresh,
        genre: 'all',
        sortBy: 'trending',
        signal: feedAbortCtrl.signal,
        onPartialUpdate: (partial) => {
          if (destroyed || !partial || !Array.isArray(partial.allNovels)) return;
          if (partial.allNovels.length >= allNovels.length) {
            allNovels = partial.allNovels;
            activeSourcesCount = Math.max(activeSourcesCount, partial.activeSourcesCount || 12);
            lastUpdatedAt = partial.fetchedAt || Date.now();
            feedLoading = false;
            applyFilterAndSort();
            updateTopMeta();
            const activeEl = document.activeElement;
            const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
            if (activeSubTab === 'explore' && !readerOpen && !detailNovel && !isTyping) {
              renderBody();
            }
          }
        },
      });
      if (destroyed) return;
      allNovels = res.allNovels || res.novels || allNovels;
      activeSourcesCount = res.activeSourcesCount || activeSourcesCount;
      lastUpdatedAt = res.fetchedAt || Date.now();
      applyFilterAndSort();
    } catch (err) {
      if (destroyed || err?.name === 'AbortError') return;
      if (allNovels.length === 0) {
        feedError = 'Koneksi ke katalog novel sementara terganggu. Klik Perbarui Live untuk mencoba lagi.';
      }
    } finally {
      if (!destroyed) {
        feedLoading = false;
        feedRefreshing = false;
        updateTopMeta();
        const activeEl = document.activeElement;
        const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
        if (!readerOpen && !detailNovel && !isTyping) {
          renderBody();
        }
      }
    }
  };

  const findNovelById = (id) => {
    return (
      allNovels.find((n) => n.id === id) ||
      searchResults.find((n) => n.id === id) ||
      matcherResult?.matches?.find((m) => m.novel?.id === id)?.novel ||
      loadNovelHistory().find((h) => h.novel?.id === id)?.novel ||
      loadNovelBookmarks().find((b) => b.id === id) ||
      null
    );
  };

  const openBookDetail = async (novel) => {
    if (!novel) return;
    detailNovel = novel;
    detailChapters = [];
    detailTotalChapters = novel.chapterCount || 1;
    detailTotalPages = 1;
    detailLoadedPage = 1;
    detailChapterFilter = '';
    detailLoading = true;
    renderDetailModal();

    try {
      const res = await fetchNovelChapters(novel, { page: 1 });
      if (destroyed || detailNovel?.id !== novel.id) return;
      detailChapters = res.chapters || [];
      detailTotalChapters = Math.max(res.totalChapters || 0, detailChapters.length);
      detailTotalPages = res.totalPages || 1;
      if (res.synopsis && res.synopsis.length > (detailNovel.synopsis || '').length) {
        detailNovel.synopsis = res.synopsis;
      }
      if (res.cover && !detailNovel.cover) {
        detailNovel.cover = res.cover;
      }
    } finally {
      if (!destroyed && detailNovel?.id === novel.id) {
        detailLoading = false;
        renderDetailModal();
      }
    }
  };

  const persistReadingProgress = () => {
    if (!readerNovel) return;
    const totalCh = Math.max(1, readerTotalChapters, readerChapters.length);
    const totalP = Math.max(1, readerPages.length);
    const chProgress = (readerChapterIndex + (readerPageIndex + 1) / totalP) / totalCh;
    saveNovelHistoryEntry({
      novel: readerNovel,
      chapterIndex: readerChapterIndex,
      chapterTitle: readerChapterTitle || `Bab ${readerChapterIndex + 1}`,
      totalChapters: totalCh,
      pageIndex: readerPageIndex,
      totalPages: totalP,
      progressPct: Math.max(2, Math.round(chProgress * 100)),
    });
    updateTopMeta();
  };

  const loadReaderChapter = async (targetIdx, { startPage = 0 } = {}) => {
    if (!readerNovel) return;
    const clampedIdx = Math.max(0, Math.min(Math.max(0, readerChapters.length - 1), targetIdx));
    const chapter = readerChapters[clampedIdx];
    if (!chapter) return;

    readerChapterIndex = clampedIdx;
    readerChapterTitle = chapter.title || `Bab ${clampedIdx + 1}`;
    readerLoading = true;
    readerError = '';
    readerPageIndex = 0;
    renderReader();

    try {
      const data = await fetchChapterContent(readerNovel, chapter);
      if (destroyed || !readerOpen) return;
      readerChapterTitle = data.title || chapter.title;
      readerParagraphs = data.paragraphs || [];
      readerPages = paginateChapterParagraphs(readerParagraphs, 1300);
      readerPageIndex = Math.max(0, Math.min(readerPages.length - 1, startPage));
      persistReadingProgress();

      // Silent prefetch of next chapter for zero-wait chapter turns!
      const nextCh = readerChapters[clampedIdx + 1];
      if (nextCh) {
        fetchChapterContent(readerNovel, nextCh).catch(() => {});
      }
    } catch {
      if (!destroyed && readerOpen) {
        readerError = 'Gagal memuat teks bab ini. Pastikan koneksi internet aktif lalu coba lagi.';
      }
    } finally {
      if (!destroyed && readerOpen) {
        readerLoading = false;
        renderReader();
        const stage = container.querySelector('[data-nvl-reader-stage]');
        if (stage) stage.scrollTop = 0;
      }
    }
  };

  const openReaderForNovel = async (novel, { chapterIndex = 0, pageIndex = 0, preloadedChapters = null } = {}) => {
    if (!novel) return;
    stopAudiobook({ resetIndex: true });
    detailNovel = null;
    renderDetailModal();

    readerOpen = true;
    readerNovel = novel;
    readerChapters = Array.isArray(preloadedChapters) && preloadedChapters.length > 0 ? preloadedChapters : [];
    readerTotalChapters = novel.chapterCount || 1;
    readerTotalChapterPages = 1;
    readerLoadedChapterPage = 1;
    readerChapterIndex = Math.max(0, chapterIndex);
    readerChapterTitle = `Bab ${readerChapterIndex + 1}`;
    readerParagraphs = [];
    readerPages = [{ pageNumber: 1, paragraphs: [], startParaIndex: 0 }];
    readerPageIndex = pageIndex;
    readerLoading = true;
    readerError = '';
    activeDrawer = null;
    renderReader();

    if (readerChapters.length === 0) {
      const chRes = await fetchNovelChapters(novel, { page: 1 });
      if (destroyed || !readerOpen) return;
      readerChapters = chRes.chapters || [];
      readerTotalChapters = Math.max(chRes.totalChapters || 0, readerChapters.length);
      readerTotalChapterPages = chRes.totalPages || 1;
    }

    if (readerChapters.length === 0) {
      readerLoading = false;
      readerError = 'Bab untuk novel ini belum tersedia dari sumber.';
      renderReader();
      return;
    }

    await loadReaderChapter(readerChapterIndex, { startPage: pageIndex });
  };

  const toggleFullscreen = async () => {
    const overlay = container.querySelector('[data-nvl-reader-overlay]');
    if (!readerFullscreen) {
      readerFullscreen = true;
      try {
        if (overlay && overlay.requestFullscreen && !document.fullscreenElement) {
          await overlay.requestFullscreen();
        }
      } catch {
        // CSS fixed-inset fullscreen works reliably even inside restricted iframes!
      }
    } else {
      readerFullscreen = false;
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch {
        // Ignore
      }
    }
    renderReader();
  };

  const closeReader = () => {
    stopAudiobook({ resetIndex: true });
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    readerFullscreen = false;
    readerOpen = false;
    activeDrawer = null;
    renderReader();
    renderBody();
  };

  /* --------------------------------------------------------------------------
   * UNIFIED EVENT HANDLERS
   * ------------------------------------------------------------------------ */

  const onKeyDown = (e) => {
    if (!readerOpen && detailNovel && e.key === 'Escape') {
      detailNovel = null;
      renderDetailModal();
      return;
    }
    if (!readerOpen) return;
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.key === 'Escape') {
      if (activeDrawer) {
        activeDrawer = null;
        renderReader();
      } else if (readerFullscreen) {
        toggleFullscreen();
      } else {
        closeReader();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      stepReaderPage(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      stepReaderPage(-1);
    }
  };

  const stepReaderPage = (delta) => {
    if (!readerOpen || readerLoading) return;
    if (prefs.readingMode === 'paged' && readerPages.length > 1) {
      const next = readerPageIndex + delta;
      if (next >= 0 && next < readerPages.length) {
        readerPageIndex = next;
        persistReadingProgress();
        renderReader();
        const stage = container.querySelector('[data-nvl-reader-stage]');
        if (stage) stage.scrollTop = 0;
        return;
      }
    }
    const targetCh = readerChapterIndex + (delta > 0 ? 1 : -1);
    if (targetCh >= 0 && targetCh < readerChapters.length) {
      stopAudiobook({ resetIndex: true });
      loadReaderChapter(targetCh, { startPage: 0 });
    }
  };

  const onFullscreenChange = () => {
    if (!document.fullscreenElement && readerFullscreen && readerOpen) {
      // Keep reader open, just reflect native fullscreen exit
      readerFullscreen = false;
      renderReader();
    }
  };

  const onResize = () => {
    if (particleEngine && readerOpen) {
      particleEngine.resize();
    }
  };

  const handleClick = async (e) => {
    // Backdrop click outside the detail modal closes it cleanly
    if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-nvl-modal-backdrop')) {
      detailNovel = null;
      renderDetailModal();
      return;
    }

    const target = e.target.closest('button, [data-nvl-open-detail], [data-nvl-resume-id], [data-nvl-close-detail], [data-nvl-para-idx]');
    if (!target) return;

    // 1. Sub-tabs
    const subtab = target.getAttribute('data-nvl-subtab');
    if (subtab) {
      activeSubTab = subtab;
      renderBody();
      return;
    }

    // 2. Genre filter
    const genre = target.getAttribute('data-nvl-genre');
    if (genre) {
      activeGenre = genre;
      visibleGridCount = 48;
      applyFilterAndSort();
      renderBody();
      return;
    }

    // 3. Quick read novel (start chapter 1 or resume from history)
    const quickReadId = target.getAttribute('data-nvl-quick-read');
    if (quickReadId) {
      e.stopPropagation();
      const novel = findNovelById(quickReadId);
      const hist = loadNovelHistory().find((h) => h.novel?.id === quickReadId);
      if (novel) {
        openReaderForNovel(novel, {
          chapterIndex: hist ? hist.chapterIndex : 0,
          pageIndex: hist ? hist.pageIndex : 0,
        });
      }
      return;
    }

    // 4. Resume from reading history
    const resumeId = target.getAttribute('data-nvl-resume-id');
    if (resumeId) {
      const hist = loadNovelHistory().find((h) => h.novel?.id === resumeId);
      if (hist?.novel) {
        openReaderForNovel(hist.novel, {
          chapterIndex: hist.chapterIndex || 0,
          pageIndex: hist.pageIndex || 0,
        });
      }
      return;
    }

    // 5. Open book detail modal
    const detailId = target.getAttribute('data-nvl-open-detail');
    if (detailId) {
      const novel = findNovelById(detailId);
      if (novel) openBookDetail(novel);
      return;
    }

    if (target.hasAttribute('data-nvl-close-detail')) {
      detailNovel = null;
      renderDetailModal();
      return;
    }

    // 6. Start reading specific chapter from detail modal
    const startReadIdx = target.getAttribute('data-nvl-start-read');
    if (startReadIdx !== null && detailNovel) {
      openReaderForNovel(detailNovel, {
        chapterIndex: Number(startReadIdx) || 0,
        preloadedChapters: detailChapters,
      });
      return;
    }

    // 7. Toggle bookmark
    if (target.hasAttribute('data-nvl-toggle-bookmark') && detailNovel) {
      toggleNovelBookmark(detailNovel);
      renderDetailModal();
      updateTopMeta();
      return;
    }

    // 8. Load more chapters in detail modal
    if (target.hasAttribute('data-nvl-load-more-detail-ch') && detailNovel) {
      detailLoading = true;
      renderDetailModal();
      const nextP = detailLoadedPage + 1;
      const res = await fetchNovelChapters(detailNovel, { page: nextP });
      detailChapters = res.chapters || detailChapters;
      detailLoadedPage = nextP;
      detailLoading = false;
      renderDetailModal();
      return;
    }

    // 9. Matcher mode switch
    const mMode = target.getAttribute('data-nvl-matcher-mode');
    if (mMode) {
      matcherMode = mMode;
      matcherFile = null;
      renderBody();
      return;
    }

    // 10. Open uploaded local file directly in Novel Reader
    if (target.hasAttribute('data-nvl-open-local-match') && matcherResult?.localReadableNovel) {
      openReaderForNovel(matcherResult.localReadableNovel, { chapterIndex: 0 });
      return;
    }

    // 11. Delete single history entry
    const delHistId = target.getAttribute('data-nvl-del-history');
    if (delHistId) {
      removeNovelHistoryEntry(delHistId);
      renderBody();
      return;
    }

    // 12. Reader drawer toggle
    const drawerName = target.getAttribute('data-nvl-drawer');
    if (drawerName) {
      if (drawerName === 'close') {
        activeDrawer = null;
      } else {
        activeDrawer = activeDrawer === drawerName ? null : drawerName;
      }
      renderReader();
      return;
    }

    // 13. Reader chapter jump
    const gotoCh = target.getAttribute('data-nvl-goto-ch');
    if (gotoCh !== null) {
      const idx = Number(gotoCh);
      if (idx >= 0 && idx < readerChapters.length) {
        stopAudiobook({ resetIndex: true });
        activeDrawer = null;
        loadReaderChapter(idx, { startPage: 0 });
      }
      return;
    }

    if (target.hasAttribute('data-nvl-load-more-reader-ch') && readerNovel) {
      const nextP = readerLoadedChapterPage + 1;
      const res = await fetchNovelChapters(readerNovel, { page: nextP });
      readerChapters = res.chapters || readerChapters;
      readerLoadedChapterPage = nextP;
      renderReader();
      return;
    }

    // 14. Reader page step
    const pageStep = target.getAttribute('data-nvl-page-step');
    if (pageStep !== null) {
      stepReaderPage(Number(pageStep));
      return;
    }

    // 15. Reading mode switch (paged | scroll)
    const prefMode = target.getAttribute('data-nvl-pref-mode');
    if (prefMode) {
      prefs = saveReaderPrefs({ readingMode: prefMode });
      renderReader();
      return;
    }

    // 16. Theme Studio controls
    const themeCat = target.getAttribute('data-nvl-theme-cat');
    if (themeCat) {
      themeDrawerCategory = themeCat;
      renderReader();
      return;
    }

    const selectThemeId = target.getAttribute('data-nvl-select-theme');
    if (selectThemeId) {
      prefs = saveReaderPrefs({ themeId: selectThemeId });
      renderReader();
      return;
    }

    const delThemeId = target.getAttribute('data-nvl-del-theme');
    if (delThemeId) {
      deleteCustomNovelTheme(delThemeId);
      if (prefs.themeId === delThemeId) {
        prefs = saveReaderPrefs({ themeId: 'classic-sepia' });
      }
      renderReader();
      return;
    }

    // 17. Typography controls
    const fontDelta = target.getAttribute('data-nvl-font-delta');
    if (fontDelta) {
      const nextSize = Math.max(13, Math.min(28, Number(prefs.fontSize || 18) + Number(fontDelta)));
      prefs = saveReaderPrefs({ fontSize: nextSize });
      renderReader();
      return;
    }

    const lhDelta = target.getAttribute('data-nvl-lh-delta');
    if (lhDelta) {
      const nextLh = Math.max(1.35, Math.min(2.4, Number((Number(prefs.lineHeight || 1.85) + Number(lhDelta)).toFixed(2))));
      prefs = saveReaderPrefs({ lineHeight: nextLh });
      renderReader();
      return;
    }

    const fontId = target.getAttribute('data-nvl-font-id');
    if (fontId) {
      prefs = saveReaderPrefs({ fontId });
      renderReader();
      return;
    }

    // 18. Audiobook voice actions
    const voiceAct = target.getAttribute('data-nvl-voice-action');
    if (voiceAct) {
      if (voiceAct === 'toggle') {
        if (audioActive && !audioPaused) {
          pauseAudiobook();
        } else {
          const resumeIdx = audioPaused && audioParagraphIndex >= 0 ? audioParagraphIndex : 0;
          startAudiobookFrom(resumeIdx);
        }
      } else if (voiceAct === 'stop') {
        stopAudiobook({ resetIndex: true });
      } else if (voiceAct === 'next') {
        const nextIdx = Math.min(readerParagraphs.length - 1, Math.max(0, audioParagraphIndex + 1));
        startAudiobookFrom(nextIdx);
      } else if (voiceAct === 'prev') {
        const prevIdx = Math.max(0, audioParagraphIndex - 1);
        startAudiobookFrom(prevIdx);
      }
      return;
    }

    // Tap any paragraph while voice drawer or audio is active to jump reading right there!
    const paraIdxAttr = target.getAttribute('data-nvl-para-idx');
    if (paraIdxAttr !== null && (audioActive || activeDrawer === 'voice')) {
      startAudiobookFrom(Number(paraIdxAttr));
      return;
    }

    // 19. General named actions
    const action = target.getAttribute('data-nvl-action');
    if (!action) return;

    if (action === 'refresh-feed') {
      loadFeed({ forceRefresh: true });
    } else if (action === 'load-more') {
      visibleGridCount += 48;
      renderBody();
    } else if (action === 'clear-history') {
      clearNovelHistory();
      renderBody();
    } else if (action === 'close-reader') {
      closeReader();
    } else if (action === 'toggle-fullscreen') {
      toggleFullscreen();
    } else if (action === 'jump-page') {
      const inp = container.querySelector('[data-nvl-page-input]');
      const targetP = Math.max(1, Math.min(readerPages.length, Number(inp?.value || 1))) - 1;
      readerPageIndex = targetP;
      prefs = saveReaderPrefs({ readingMode: 'paged' });
      activeDrawer = null;
      persistReadingProgress();
      renderReader();
    } else if (action === 'jump-chapter') {
      const inp = container.querySelector('[data-nvl-jump-ch-num]');
      const targetCh = Math.max(1, Math.min(readerChapters.length, Number(inp?.value || 1))) - 1;
      activeDrawer = null;
      stopAudiobook({ resetIndex: true });
      loadReaderChapter(targetCh, { startPage: 0 });
    } else if (action === 'gen-ai-theme') {
      const inp = container.querySelector('[data-nvl-ai-theme-input]');
      aiThemePrompt = inp?.value || aiThemePrompt;
      aiThemeBusy = true;
      aiThemeStatus = 'AI sedang meracik tema novel yang nyaman dibaca...';
      renderReader();
      try {
        const created = await generateAiNovelTheme(aiThemePrompt);
        if (destroyed) return;
        prefs = saveReaderPrefs({ themeId: created.id });
        aiThemeStatus = `Tema "${created.name}" berhasil dibuat & diterapkan!`;
      } finally {
        if (!destroyed) {
          aiThemeBusy = false;
          renderReader();
        }
      }
    } else if (action === 'sync-api-theme') {
      aiThemeStatus = 'Mengambil palet warna harmonis dari Open Palette API...';
      renderReader();
      const apiTheme = await generateOpenApiPaletteTheme();
      if (!destroyed && apiTheme) {
        prefs = saveReaderPrefs({ themeId: apiTheme.id });
        aiThemeStatus = `Palet API "${apiTheme.name}" diterapkan!`;
        renderReader();
      }
    } else if (action === 'export-theme') {
      const cur = resolveNovelThemeById(prefs.themeId);
      const blob = new Blob([JSON.stringify(cur, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tema-novel-${cur.id || 'kustom'}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (action === 'run-matcher') {
      if (matcherAbortCtrl) matcherAbortCtrl.abort();
      matcherAbortCtrl = new AbortController();
      matcherRunning = true;
      matcherProgress = { pct: 5, label: 'Memulai pemindaian kecocokan novel...' };
      matcherResult = null;
      renderBody();
      try {
        const res = await matchNovelFromInput({
          text: matcherMode === 'text' ? matcherText : '',
          file: matcherMode !== 'text' ? matcherFile : null,
          signal: matcherAbortCtrl.signal,
          onProgress: (p) => {
            matcherProgress = p;
            const track = container.querySelector('.nvl-progress-track span');
            const lbl = container.querySelector('.nvl-progress-label');
            if (track) track.style.width = `${p.pct}%`;
            if (lbl) lbl.textContent = `${p.pct}% · ${p.label}`;
          },
        });
        if (!destroyed) {
          matcherResult = res;
        }
      } catch (err) {
        if (!destroyed && err?.name !== 'AbortError') {
          matcherResult = { error: 'Gagal memproses pencocokan novel. Coba lagi.', matches: [] };
        }
      } finally {
        if (!destroyed) {
          matcherRunning = false;
          renderBody();
        }
      }
    } else if (action === 'reset-matcher') {
      matcherText = '';
      matcherFile = null;
      matcherResult = null;
      renderBody();
    }
  };

  const handleInput = (e) => {
    const t = e.target;
    if (t.matches('[data-nvl-search-input]')) {
      searchQuery = t.value;
    } else if (t.matches('[data-nvl-matcher-text]')) {
      matcherText = t.value;
    } else if (t.matches('[data-nvl-detail-ch-filter]')) {
      detailChapterFilter = t.value;
      renderDetailModal();
      const el = container.querySelector('[data-nvl-detail-ch-filter]');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    } else if (t.matches('[data-nvl-drawer-ch-filter]')) {
      drawerChapterFilter = t.value;
      renderReader();
      const el = container.querySelector('[data-nvl-drawer-ch-filter]');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    } else if (t.matches('[data-nvl-theme-search]')) {
      themeSearchQuery = t.value;
      renderReader();
      const el = container.querySelector('[data-nvl-theme-search]');
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    } else if (t.matches('[data-nvl-ai-theme-input]')) {
      aiThemePrompt = t.value;
    } else if (t.matches('[data-nvl-page-slider]')) {
      const nextP = Math.max(0, Math.min(readerPages.length - 1, Number(t.value) - 1));
      readerPageIndex = nextP;
      const numInp = container.querySelector('[data-nvl-page-input]');
      if (numInp) numInp.value = String(nextP + 1);
      prefs = saveReaderPrefs({ readingMode: 'paged' });
      persistReadingProgress();
      renderReader();
    } else if (t.matches('[data-nvl-brightness]')) {
      prefs = saveReaderPrefs({ brightness: Number(t.value) });
      const overlay = container.querySelector('[data-nvl-reader-overlay]');
      if (overlay) overlay.style.filter = `brightness(${prefs.brightness}%)`;
    }
  };

  const handleChange = async (e) => {
    const t = e.target;
    if (t.matches('[data-nvl-sort]')) {
      activeSort = t.value;
      applyFilterAndSort();
      renderBody();
    } else if (t.matches('[data-nvl-matcher-file]')) {
      matcherFile = t.files?.[0] || null;
      renderBody();
    } else if (t.matches('[data-nvl-upload-theme]')) {
      const file = t.files?.[0];
      if (!file) return;
      if (/\.json$/i.test(file.name)) {
        try {
          const parsed = JSON.parse(await file.text());
          const custom = buildCustomUploadedTheme({ fileName: file.name, jsonObj: parsed });
          saveCustomNovelTheme(custom);
          prefs = saveReaderPrefs({ themeId: custom.id });
          aiThemeStatus = `Tema JSON "${custom.name}" berhasil dimuat!`;
          renderReader();
        } catch {
          aiThemeStatus = 'File JSON tema tidak valid.';
          renderReader();
        }
      } else if (/^image\//i.test(file.type)) {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          const custom = buildCustomUploadedTheme({ fileName: file.name, imageDataUrl: dataUrl, isDark: true });
          saveCustomNovelTheme(custom);
          prefs = saveReaderPrefs({ themeId: custom.id });
          aiThemeStatus = `Wallpaper "${custom.name}" berhasil diterapkan!`;
          renderReader();
        };
        reader.readAsDataURL(file);
      }
    } else if (t.matches('[data-nvl-voice-id]')) {
      prefs = saveReaderPrefs({ voiceId: t.value });
      if (audioActive) startAudiobookFrom(Math.max(0, audioParagraphIndex));
    } else if (t.matches('[data-nvl-voice-rate]')) {
      prefs = saveReaderPrefs({ voiceRate: Number(t.value) || 1.0 });
      if (audioActive) startAudiobookFrom(Math.max(0, audioParagraphIndex));
    } else if (t.matches('[data-nvl-voice-autonext]')) {
      prefs = saveReaderPrefs({ autoNextChapter: Boolean(t.checked) });
    }
  };

  const handleSubmit = async (e) => {
    if (!e.target.matches('[data-nvl-search-form]')) return;
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    searchLoading = true;
    hasSearched = true;
    renderBody();
    try {
      searchResults = await searchUnifiedNovels(q);
    } finally {
      if (!destroyed) {
        searchLoading = false;
        renderBody();
      }
    }
  };

  /* --------------------------------------------------------------------------
   * LIFECYCLE MOUNT / UNMOUNT
   * ------------------------------------------------------------------------ */

  renderShell();
  container.addEventListener('click', handleClick);
  container.addEventListener('input', handleInput);
  container.addEventListener('change', handleChange);
  container.addEventListener('submit', handleSubmit);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('resize', onResize);
  document.addEventListener('fullscreenchange', onFullscreenChange);

  // Initial live real-time load + 5-minute auto-update loop
  loadFeed({ forceRefresh: false });
  autoRefreshTimer = setInterval(() => {
    if (!destroyed && !readerOpen) {
      loadFeed({ forceRefresh: true });
    }
  }, AUTO_REFRESH_INTERVAL_MS);

  return {
    unmount() {
      destroyed = true;
      if (autoRefreshTimer) clearInterval(autoRefreshTimer);
      if (feedAbortCtrl) feedAbortCtrl.abort();
      if (matcherAbortCtrl) matcherAbortCtrl.abort();
      if (particleEngine) particleEngine.stop();
      stopAudiobook({ resetIndex: true });
      voicePlayer.destroy();
      document.body.classList.remove('nvl-reader-locked');
      container.removeEventListener('click', handleClick);
      container.removeEventListener('input', handleInput);
      container.removeEventListener('change', handleChange);
      container.removeEventListener('submit', handleSubmit);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      container.innerHTML = '';
    },
    redrawTheme() {
      if (readerOpen) renderReader();
    },
  };
}
