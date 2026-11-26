import { createToolsHubController } from './tools-ui.js?v=98';
import { getDefaultCatalogSnapshot, loadCatalogData } from './data.js?v=85';
import {
  inferBannerUtilityId,
  normalizeBanners,
  normalizeBrandConfig,
  normalizeUtilityConfig,
} from './store.js?v=98';
import {
  computeBannerHydrationWindow,
  initPerformanceClass,
  resolveBannerTransition,
} from './perf-guard.js?v=85';
import { initPwaManager } from './pwa.js?v=98';
import {
  DOMAIN_CONFIG,
  STORE_VAULT_API,
  applyDomainPwaMeta,
  normalizeStoreAccessConfig,
  resolveDisplayBrand,
  resolveSiteContext,
} from './domain-router.js?v=87';
import {
  STUDIO_CATEGORIES,
  STUDIO_FAQ_ITEMS,
  STUDIO_FEATURE_META,
  STUDIO_VALUE_PILLARS,
  buildStudioFeatureDirectory,
  buildStudioHeroBanners,
  buildStudioRouteUrl,
  filterStudioFeatures,
  groupStudioFeaturesByCategory,
  parseStudioRoute,
} from './studio-home.js?v=98';
import { createFeatureCsController } from './feature-cs-ui.js?v=98';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';
const VALID_TABS = new Set([
  'prayer',
  'weather',
  'worldclock',
  'speedtest',
  'downloader',
  'shortlink',
  'sshvpn',
  'compressor',
  'converter',
  'songfinder',
  'music',
  'dracin',
  'audioeditor',
  'manifestai',
  'plagiarism',
  'novel',
  'callerid',
]);

const VAULT_TARGET_LABELS = Object.freeze({
  store: { label: 'Store', actionText: 'Verifikasi & Buka Store →', defaultTitle: 'Akses Khusus Store' },
  whatsapp: { label: 'WhatsApp', actionText: 'Verifikasi & Buka WhatsApp →', defaultTitle: 'Akses Kontak WhatsApp' },
  instagram: { label: 'Instagram', actionText: 'Verifikasi & Buka Instagram →', defaultTitle: 'Akses Instagram Resmi' },
  tiktok: { label: 'TikTok', actionText: 'Verifikasi & Buka TikTok →', defaultTitle: 'Akses TikTok Resmi' },
});

const defaultSnap = getDefaultCatalogSnapshot();

let currentTheme = 'dark';
let toolsHub = null;
let featureCs = null;
let toastTimer = null;
let activeUtilities = normalizeUtilityConfig(defaultSnap.utilities);
let activeBrand = normalizeBrandConfig(defaultSnap.brand);
let activeCatalogBanners = normalizeBanners(defaultSnap.banners);
let currentViewMode = 'home'; // 'home' | 'tool'
let currentTab = null;

// Standalone Homepage UI state
let activeBannerSlide = 0;
let applyStudioBannerSlideFn = null;
let activeDirectoryCategory = 'all';
let directoryQuery = '';
let openFaqIndex = 0;
let pickerQuery = '';

function getSiteContext() {
  return resolveSiteContext({
    isToolsPage: true,
    storeAccess: activeBrand?.storeAccess,
  });
}

function getStoreAccessCfg() {
  return normalizeStoreAccessConfig(activeBrand?.storeAccess || {});
}

function formatCooldownText(seconds) {
  const safe = Math.max(1, Math.ceil(Number(seconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins <= 0) return `${secs} detik`;
  return secs > 0 ? `${mins} menit ${secs} detik` : `${mins} menit`;
}

async function fetchStoreVaultStatus() {
  try {
    const res = await fetch(STORE_VAULT_API.statusUrl, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!res.ok) {
      return { ok: false, unreachable: true };
    }
    return await res.json();
  } catch {
    return { ok: false, unreachable: true };
  }
}

function getEnabledUtilityItems() {
  const enabled = (activeUtilities.items || []).filter((it) => it.enabled !== false);
  return enabled.length > 0 ? enabled : activeUtilities.items || [];
}

function getEnabledUtilityIds() {
  return getEnabledUtilityItems().map((it) => it.id);
}

function resolveEnabledTab(tab) {
  const enabled = getEnabledUtilityItems();
  if (VALID_TABS.has(tab) && enabled.some((it) => it.id === tab)) {
    return tab;
  }
  return enabled[0]?.id || 'prayer';
}

function getTabMeta(tab) {
  const safeTab = resolveEnabledTab(tab);
  const enabled = getEnabledUtilityItems();
  const item =
    enabled.find((it) => it.id === safeTab) ||
    enabled[0] || {
      id: 'prayer',
      label: 'Jadwal Sholat',
      icon: './assets/icons/tool-prayer.svg',
      pageTitle: 'Jadwal Sholat & Imsakiyah',
      pageSubtitle: 'Waktu sholat resmi Kemenag RI sesuai lokasi Anda.',
    };
  const featMeta = STUDIO_FEATURE_META[safeTab] || { categoryLabel: 'Utilitas' };
  return {
    id: item.id,
    label: item.label,
    icon: item.icon || `./assets/icons/tool-${safeTab}.svg`,
    categoryLabel: featMeta.categoryLabel || 'Utilitas',
    title: item.pageTitle || item.label,
    subtitle: item.pageSubtitle || '',
  };
}

function escapeHtml(str) {
  return String(str || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function readCurrentRoute() {
  return parseStudioRoute(window.location.search, getEnabledUtilityIds());
}

function showToast(message) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.hidden = true;
  }, 2600);
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      currentTheme = saved;
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      currentTheme = 'light';
    }
  } catch {
    // Ignore storage error
  }
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', currentTheme === 'dark' ? '#090D16' : '#F8FAFC');
  }
  const btn = document.getElementById('theme-toggle-btn');
  if (btn) {
    const isDark = currentTheme === 'dark';
    btn.setAttribute('aria-label', isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap');
    btn.innerHTML = isDark
      ? `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg><span class="hide-xs">Terang</span>`
      : `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg><span class="hide-xs">Gelap</span>`;
  }
  toolsHub?.redrawTheme();
}

function ensureToolsHubInstance() {
  if (toolsHub) return toolsHub;
  const root = document.getElementById('tools-hub-root');
  if (!root) return null;
  toolsHub = createToolsHubController({
    rootEl: root,
    utilitiesConfig: activeUtilities,
    hideSubnav: true,
    onToast: showToast,
    onSubTabChange: (nextTab) => {
      if (nextTab && nextTab !== currentTab) {
        enterToolView(nextTab, { pushState: true });
      }
    },
  });
  return toolsHub;
}

function syncToolSwitcherTrigger(selectedId = null) {
  const iconEl = document.getElementById('studio-switcher-trigger-icon');
  const labelEl = document.getElementById('studio-switcher-trigger-label');
  if (!labelEl) return;
  const meta = getTabMeta(selectedId || currentTab || 'manifestai');
  if (iconEl) iconEl.src = meta.icon;
  labelEl.textContent = meta.label;
}

function closeFeaturePickerSheet() {
  const root = document.getElementById('studio-switcher-sheet-root');
  const trigger = document.getElementById('studio-switcher-trigger');
  if (root) {
    root.hidden = true;
    root.innerHTML = '';
  }
  trigger?.setAttribute('aria-expanded', 'false');
  pickerQuery = '';
}

function renderFeaturePickerList() {
  const listEl = document.getElementById('studio-picker-list');
  if (!listEl) return;
  const allFeatures = buildStudioFeatureDirectory(activeUtilities);
  const filtered = filterStudioFeatures(allFeatures, {
    category: 'all',
    query: pickerQuery,
  });

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="studio-picker-empty">
        <p>Fitur tidak ditemukan untuk "${escapeHtml(pickerQuery)}".</p>
      </div>
    `;
    return;
  }

  const groups = groupStudioFeaturesByCategory(filtered);
  listEl.innerHTML = groups
    .map(
      (grp) => `
      <div class="studio-picker-group">
        <div class="studio-picker-group-label">${escapeHtml(grp.label)}</div>
        <div class="studio-picker-items">
          ${grp.items
            .map((feat) => {
              const isActive = feat.id === currentTab;
              return `
                <button
                  type="button"
                  class="studio-picker-item ${isActive ? 'is-active' : ''}"
                  data-picker-tool-id="${escapeHtml(feat.id)}"
                  aria-current="${isActive ? 'page' : 'false'}"
                >
                  <img src="${escapeHtml(feat.icon)}" alt="" width="34" height="34" decoding="async" class="studio-picker-item-icon" />
                  <span class="studio-picker-item-label">${escapeHtml(feat.label)}</span>
                  ${
                    isActive
                      ? `<span class="studio-picker-check" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`
                      : `<span class="studio-picker-arrow" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>`
                  }
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `
    )
    .join('');

  listEl.querySelectorAll('[data-picker-tool-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextTab = btn.getAttribute('data-picker-tool-id');
      closeFeaturePickerSheet();
      if (nextTab && nextTab !== currentTab) {
        enterToolView(nextTab, { pushState: true });
      }
    });
  });
}

function openFeaturePickerSheet() {
  const root = document.getElementById('studio-switcher-sheet-root');
  const trigger = document.getElementById('studio-switcher-trigger');
  if (!root) return;
  pickerQuery = '';
  root.hidden = false;
  trigger?.setAttribute('aria-expanded', 'true');
  root.innerHTML = `
    <div class="studio-picker-backdrop" id="studio-picker-backdrop"></div>
    <div
      id="studio-switcher-sheet"
      class="studio-picker-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-picker-title"
    >
      <div class="studio-picker-handle" aria-hidden="true"></div>
      <div class="studio-picker-head">
        <h2 id="studio-picker-title" class="studio-picker-title">Pilih Fitur</h2>
        <button type="button" class="icon-close-btn" id="studio-picker-close-btn" aria-label="Tutup daftar fitur">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="studio-picker-search-wrap">
        <svg class="studio-picker-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          type="search"
          id="studio-picker-search-input"
          class="studio-picker-search-input"
          placeholder="Cari fitur cepat..."
          autocomplete="off"
          aria-label="Cari fitur di daftar pindah cepat"
        />
      </div>
      <div id="studio-picker-list" class="studio-picker-list"></div>
    </div>
  `;

  root.querySelector('#studio-picker-backdrop')?.addEventListener('click', closeFeaturePickerSheet);
  root.querySelector('#studio-picker-close-btn')?.addEventListener('click', closeFeaturePickerSheet);
  const searchEl = root.querySelector('#studio-picker-search-input');
  searchEl?.addEventListener('input', (e) => {
    pickerQuery = e.target.value;
    renderFeaturePickerList();
  });

  renderFeaturePickerList();
}

function renderToolSwitcherOptions(selectedId = null) {
  syncToolSwitcherTrigger(selectedId);
}

function syncHeaderNavState(activeKey) {
  document.querySelectorAll('[data-studio-section-link]').forEach((el) => {
    const key = el.getAttribute('data-studio-section-link');
    el.classList.toggle('is-active', key === activeKey);
  });
}

function enterHomeView({ pushState = true, scrollTarget = null } = {}) {
  const homeView = document.getElementById('studio-home-view');
  const toolView = document.getElementById('studio-tool-view');
  currentViewMode = 'home';
  currentTab = null;

  document.documentElement.setAttribute('data-studio-view', 'home');
  if (homeView) homeView.hidden = false;
  if (toolView) toolView.hidden = true;

  // Unmount active tool cleanly so no timers/GPS run in background on homepage
  if (toolsHub) {
    toolsHub.unmount();
  }

  const utilName = getStoreAccessCfg().utilitiesBrandName || DOMAIN_CONFIG.utilitiesBrandName;
  const enabledCount = getEnabledUtilityItems().length || 17;
  document.title = `${utilName} — Platform ${enabledCount} Utilitas Digital, AI & Hiburan Gratis`;

  if (pushState) {
    const nextUrl = buildStudioRouteUrl(window.location.href, null, {
      hash: scrollTarget && scrollTarget !== 'top' ? scrollTarget : '',
    });
    window.history.pushState({ view: 'home' }, '', nextUrl);
  }

  syncHeaderNavState(scrollTarget || 'top');

  if (scrollTarget && scrollTarget !== 'top') {
    requestAnimationFrame(() => {
      document.getElementById(scrollTarget)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function enterToolView(tabId, { pushState = true } = {}) {
  const safeTab = resolveEnabledTab(tabId);
  const homeView = document.getElementById('studio-home-view');
  const toolView = document.getElementById('studio-tool-view');

  currentViewMode = 'tool';
  currentTab = safeTab;

  document.documentElement.setAttribute('data-studio-view', 'tool');
  if (homeView) homeView.hidden = true;
  if (toolView) toolView.hidden = false;

  const hub = ensureToolsHubInstance();
  hub?.setUtilitiesConfig?.(activeUtilities);
  hub?.mount(safeTab);
  syncActiveTabChrome(safeTab);
  renderToolSwitcherOptions(safeTab);
  syncHeaderNavState('fitur');

  if (pushState) {
    const nextUrl = buildStudioRouteUrl(window.location.href, safeTab);
    window.history.pushState({ view: 'tool', tab: safeTab }, '', nextUrl);
  }

  window.scrollTo({ top: 0, behavior: 'auto' });
}

function activateUtilityAndScroll(tabId) {
  enterToolView(tabId, { pushState: true });
}

/* ============================================================================
 * 1. Flagship Multi-Banner Carousel (Studio Hero)
 * ============================================================================ */
function getStudioBannerSlides() {
  const utilName = getStoreAccessCfg().utilitiesBrandName || DOMAIN_CONFIG.utilitiesBrandName;
  return buildStudioHeroBanners(activeCatalogBanners, activeUtilities, inferBannerUtilityId, {
    brandName: utilName,
  });
}

function renderStudioBanners() {
  const track = document.getElementById('studio-banner-track');
  const dotsContainer = document.getElementById('studio-banner-dots');
  const counterEl = document.getElementById('studio-banner-counter');
  const metaCountEl = document.getElementById('studio-meta-count');
  if (!track) return;

  const slides = getStudioBannerSlides();
  if (activeBannerSlide >= slides.length) {
    activeBannerSlide = 0;
  }

  if (metaCountEl) {
    metaCountEl.textContent = `${getEnabledUtilityItems().length} Fitur Aktif`;
  }

  const hydrateWindow = new Set(computeBannerHydrationWindow(activeBannerSlide, slides.length, 1));

  track.innerHTML = slides
    .map((b, idx) => {
      const scrimClass =
        b.scrim && b.scrim !== 'default' ? `scrim-${escapeHtml(b.scrim)}` : '';
      const hasImage = Boolean(String(b.image || '').trim());
      const frameExtraClass = !hasImage ? 'banner-slide-gradient' : '';
      const btnClass = idx === 0 ? 'btn btn-primary btn-sm' : 'btn btn-outline-light btn-sm';
      const HeadingTag = idx === 0 ? 'h1' : 'h2';
      const isActive = idx === activeBannerSlide;
      const shouldHydrate = hydrateWindow.has(idx);

      return `
        <article
          class="promo-banner-frame banner-slide ${frameExtraClass} ${isActive ? 'is-active' : ''}"
          data-slide-index="${idx}"
          data-banner-id="${escapeHtml(b.id)}"
          data-banner-href="${escapeHtml(b.href || '#fitur')}"
          ${b.utilityId ? `data-banner-tool="${escapeHtml(b.utilityId)}"` : ''}
          aria-hidden="${!isActive}"
        >
          ${
            hasImage
              ? `<img
                  ${shouldHydrate ? `src="${escapeHtml(b.image)}"` : ''}
                  data-banner-src="${escapeHtml(b.image)}"
                  alt="${escapeHtml(b.heading)}"
                  class="promo-banner-img"
                  width="1200"
                  height="670"
                  decoding="async"
                  data-fallback-banner="./assets/banners/banner-manifestai.jpg"
                  ${idx === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
                />`
              : ''
          }
          <div class="promo-banner-scrim ${scrimClass}" aria-hidden="true"></div>
          <div class="promo-banner-content">
            <div class="promo-banner-copy">
              <span class="promo-kicker">${escapeHtml(b.kicker)}</span>
              <${HeadingTag} class="promo-heading">${escapeHtml(b.heading)}</${HeadingTag}>
              ${b.sub ? `<p class="promo-sub">${escapeHtml(b.sub)}</p>` : ''}
            </div>
            <div class="promo-banner-cta">
              ${
                b.utilityId
                  ? `<button type="button" class="${btnClass}" data-banner-cta-tool="${escapeHtml(b.utilityId)}">${escapeHtml(b.ctaLabel || 'Buka Fitur →')}</button>`
                  : `<a href="${escapeHtml(b.href || '#fitur')}" class="${btnClass}">${escapeHtml(b.ctaLabel || 'Jelajahi Fitur →')}</a>`
              }
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  track.querySelectorAll('[data-banner-cta-tool]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const uid = btn.getAttribute('data-banner-cta-tool');
      if (uid) activateUtilityAndScroll(uid);
    });
  });

  track.querySelectorAll('img[data-fallback-banner]').forEach((img) => {
    img.addEventListener(
      'error',
      () => {
        const fb = img.getAttribute('data-fallback-banner') || './assets/banners/banner-manifestai.jpg';
        if (img.getAttribute('src') !== fb) img.src = fb;
      },
      { once: true }
    );
  });

  if (dotsContainer) {
    dotsContainer.innerHTML = slides
      .map(
        (b, idx) => `
        <button
          type="button"
          class="banner-dot ${idx === activeBannerSlide ? 'is-active' : ''}"
          data-slide-dot="${idx}"
          aria-label="Slide ${idx + 1}: ${escapeHtml(b.heading)}"
          aria-selected="${idx === activeBannerSlide}"
        ></button>
      `
      )
      .join('');
  }

  if (counterEl) {
    counterEl.textContent = `${activeBannerSlide + 1} / ${slides.length}`;
  }

  if (typeof applyStudioBannerSlideFn === 'function') {
    applyStudioBannerSlideFn(activeBannerSlide, { immediate: true });
  }
}

function initStudioBannerCarousel() {
  const carousel = document.getElementById('studio-hero-carousel');
  const track = document.getElementById('studio-banner-track');
  const prevBtn = document.getElementById('studio-banner-prev-btn');
  const nextBtn = document.getElementById('studio-banner-next-btn');
  const dotsContainer = document.getElementById('studio-banner-dots');
  if (!carousel || !track) return;

  let autoTimer = null;
  let leaveCleanupTimer = null;
  let isInViewport = true;
  let isPointerDown = false;
  let hasMoved = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragDeltaX = 0;
  let dragDeltaY = 0;
  let dragSourceSlide = null;

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function getSlides() {
    return Array.from(track.querySelectorAll('.banner-slide'));
  }

  function hydrateAdjacentImages(slides, activeIdx) {
    const windowIndices = computeBannerHydrationWindow(activeIdx, slides.length, 1);
    for (const idx of windowIndices) {
      const img = slides[idx]?.querySelector('img[data-banner-src]');
      if (img && !img.getAttribute('src')) {
        const src = img.getAttribute('data-banner-src');
        if (src) img.setAttribute('src', src);
      }
    }
  }

  function applySlide(index, { immediate = false } = {}) {
    const slides = getSlides();
    const totalSlides = slides.length;
    if (totalSlides === 0) return;

    const prevIdx = activeBannerSlide;
    const transition = resolveBannerTransition(prevIdx, index, totalSlides);
    const wrapped = transition.to;
    activeBannerSlide = wrapped;

    hydrateAdjacentImages(slides, wrapped);

    if (leaveCleanupTimer) {
      clearTimeout(leaveCleanupTimer);
      leaveCleanupTimer = null;
    }

    const dirClass = transition.direction < 0 ? 'is-dir-prev' : 'is-dir-next';
    const shouldAnimate = !immediate && !prefersReducedMotion && prevIdx !== wrapped && Boolean(slides[prevIdx]);

    slides.forEach((slide, idx) => {
      slide.style.transform = '';
      slide.style.transition = '';
      slide.classList.remove('is-leaving', 'is-entering', 'is-dir-next', 'is-dir-prev');
      if (idx === wrapped) {
        slide.classList.add('is-active');
        slide.setAttribute('aria-hidden', 'false');
        if (shouldAnimate) slide.classList.add('is-entering', dirClass);
      } else if (shouldAnimate && idx === prevIdx) {
        slide.classList.remove('is-active');
        slide.classList.add('is-leaving', dirClass);
        slide.setAttribute('aria-hidden', 'true');
      } else {
        slide.classList.remove('is-active');
        slide.setAttribute('aria-hidden', 'true');
      }
    });

    if (shouldAnimate) {
      const nextSlideEl = slides[wrapped];
      const prevSlideEl = slides[prevIdx];
      requestAnimationFrame(() => {
        nextSlideEl?.classList.remove('is-entering');
      });
      leaveCleanupTimer = setTimeout(() => {
        prevSlideEl?.classList.remove('is-leaving', 'is-dir-next', 'is-dir-prev');
        nextSlideEl?.classList.remove('is-dir-next', 'is-dir-prev');
        leaveCleanupTimer = null;
      }, 280);
    }

    dotsContainer?.querySelectorAll('[data-slide-dot]').forEach((dot) => {
      const dotIdx = Number(dot.getAttribute('data-slide-dot'));
      const active = dotIdx === wrapped;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-selected', String(active));
    });

    const counterEl = document.getElementById('studio-banner-counter');
    if (counterEl) {
      counterEl.textContent = `${wrapped + 1} / ${totalSlides}`;
    }
  }

  applyStudioBannerSlideFn = applySlide;

  function startAutoSlide() {
    if (prefersReducedMotion) return;
    stopAutoSlide();
    autoTimer = setInterval(() => {
      if (!document.hidden && isInViewport && !isPointerDown && getSlides().length > 1) {
        applySlide(activeBannerSlide + 1);
      }
    }, 6800);
  }

  function stopAutoSlide() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver(
      (entries) => {
        isInViewport = Boolean(entries[0]?.isIntersecting);
      },
      { threshold: 0.1 }
    );
    io.observe(carousel);
  }

  function handleBannerActivate(slideEl) {
    if (!slideEl) return;
    const uid = slideEl.getAttribute('data-banner-tool');
    if (uid) {
      activateUtilityAndScroll(uid);
      return;
    }
    const href = slideEl.getAttribute('data-banner-href') || '';
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  prevBtn?.addEventListener('click', () => {
    applySlide(activeBannerSlide - 1);
    startAutoSlide();
  });

  nextBtn?.addEventListener('click', () => {
    applySlide(activeBannerSlide + 1);
    startAutoSlide();
  });

  dotsContainer?.addEventListener('click', (e) => {
    const dot = e.target.closest('[data-slide-dot]');
    if (!dot) return;
    const idx = Number(dot.getAttribute('data-slide-dot') || 0);
    applySlide(idx);
    startAutoSlide();
  });

  carousel.addEventListener('keydown', (e) => {
    const slides = getSlides();
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      applySlide(activeBannerSlide - 1);
      startAutoSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      applySlide(activeBannerSlide + 1);
      startAutoSlide();
    } else if (e.key === 'Enter' && document.activeElement === carousel) {
      e.preventDefault();
      handleBannerActivate(slides[activeBannerSlide]);
    }
  });

  carousel.addEventListener('mouseenter', stopAutoSlide);
  carousel.addEventListener('mouseleave', startAutoSlide);
  carousel.addEventListener('focusin', stopAutoSlide);
  carousel.addEventListener('focusout', startAutoSlide);

  carousel.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('button, a')) return;
    const slides = getSlides();
    isPointerDown = true;
    hasMoved = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragDeltaX = 0;
    dragDeltaY = 0;
    dragSourceSlide = e.target.closest('.banner-slide') || slides[activeBannerSlide] || null;
  });

  carousel.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;
    dragDeltaX = e.clientX - dragStartX;
    dragDeltaY = e.clientY - dragStartY;

    if (!hasMoved) {
      if (Math.hypot(dragDeltaX, dragDeltaY) <= 6) return;
      if (Math.abs(dragDeltaY) > Math.abs(dragDeltaX) + 4) {
        isPointerDown = false;
        dragSourceSlide = null;
        return;
      }
      hasMoved = true;
      stopAutoSlide();
      carousel.classList.add('is-dragging');
    }

    const activeSlide = getSlides()[activeBannerSlide];
    if (activeSlide) {
      const clampedPx = Math.max(-72, Math.min(72, dragDeltaX * 0.42));
      activeSlide.style.transition = 'none';
      activeSlide.style.transform = `translate3d(${clampedPx}px, 0, 0)`;
    }
  });

  const finishDrag = (e) => {
    if (!isPointerDown) return;
    const wasTap = !hasMoved && Math.hypot(dragDeltaX, dragDeltaY) < 8;
    const sourceSlide = dragSourceSlide;

    isPointerDown = false;
    hasMoved = false;
    dragSourceSlide = null;
    carousel.classList.remove('is-dragging');

    const activeSlide = getSlides()[activeBannerSlide];
    if (activeSlide) {
      activeSlide.style.transition = '';
      activeSlide.style.transform = '';
    }

    if (wasTap && e?.type === 'pointerup' && !e.target.closest('button, a')) {
      dragDeltaX = 0;
      dragDeltaY = 0;
      handleBannerActivate(sourceSlide);
      startAutoSlide();
      return;
    }

    const threshold = Math.min(72, Math.max(36, carousel.clientWidth * 0.14));
    if (dragDeltaX <= -threshold) {
      applySlide(activeBannerSlide + 1);
    } else if (dragDeltaX >= threshold) {
      applySlide(activeBannerSlide - 1);
    } else {
      applySlide(activeBannerSlide, { immediate: true });
    }
    dragDeltaX = 0;
    dragDeltaY = 0;
    startAutoSlide();
  };

  carousel.addEventListener('pointerup', finishDrag);
  carousel.addEventListener('pointercancel', finishDrag);
  carousel.addEventListener('pointerleave', () => {
    if (isPointerDown) finishDrag({ type: 'pointerleave', target: carousel });
  });

  renderStudioBanners();
  applySlide(0, { immediate: true });
  startAutoSlide();
}

/* ============================================================================
 * 2. Complete 15-Feature Directory, Value Pillars & FAQ
 * ============================================================================ */
function renderStudioCategoryTabs() {
  const container = document.getElementById('studio-category-tabs');
  if (!container) return;

  container.innerHTML = STUDIO_CATEGORIES.map((cat) => {
    const active = activeDirectoryCategory === cat.id;
    return `
      <button
        type="button"
        class="cat-tab ${active ? 'is-active' : ''}"
        data-studio-category="${escapeHtml(cat.id)}"
        aria-pressed="${active}"
      >
        ${escapeHtml(cat.label)}
      </button>
    `;
  }).join('');

  container.querySelectorAll('[data-studio-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeDirectoryCategory = btn.getAttribute('data-studio-category') || 'all';
      renderStudioCategoryTabs();
      renderStudioFeatureDirectory();
    });
  });
}

function renderStudioFeatureDirectory() {
  const grid = document.getElementById('studio-feature-grid');
  const countEl = document.getElementById('studio-directory-count');
  if (!grid) return;

  const allFeatures = buildStudioFeatureDirectory(activeUtilities);
  const filtered = filterStudioFeatures(allFeatures, {
    category: activeDirectoryCategory,
    query: directoryQuery,
  });

  if (countEl) {
    countEl.textContent = `${filtered.length} fitur`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state studio-empty-state">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <h3>Fitur tidak ditemukan</h3>
        <p>Coba kata kunci lain atau pilih kategori Semua Fitur.</p>
        <button type="button" class="btn btn-secondary btn-sm" id="studio-reset-dir-btn">Reset Filter</button>
      </div>
    `;
    document.getElementById('studio-reset-dir-btn')?.addEventListener('click', () => {
      activeDirectoryCategory = 'all';
      directoryQuery = '';
      const searchEl = document.getElementById('studio-feature-search');
      if (searchEl) searchEl.value = '';
      const clearBtn = document.getElementById('studio-clear-search-btn');
      if (clearBtn) clearBtn.hidden = true;
      renderStudioCategoryTabs();
      renderStudioFeatureDirectory();
    });
    return;
  }

  grid.innerHTML = filtered
    .map((feat) => {
      const toolHref = buildStudioRouteUrl(window.location.href, feat.id);
      return `
        <a
          href="${escapeHtml(toolHref)}"
          class="studio-app-tile"
          data-studio-open-tool="${escapeHtml(feat.id)}"
          aria-label="Buka ${escapeHtml(feat.label)}"
          title="${escapeHtml(feat.label)} — ${escapeHtml(feat.summary)}"
        >
          <div class="studio-app-icon-wrap">
            <img
              src="${escapeHtml(feat.icon)}"
              alt=""
              width="64"
              height="64"
              decoding="async"
              class="studio-app-icon"
            />
          </div>
          <span class="studio-app-title">${escapeHtml(feat.label)}</span>
        </a>
      `;
    })
    .join('');
}

function renderStudioValuePillars() {
  const grid = document.getElementById('studio-pillars-grid');
  if (!grid) return;

  grid.innerHTML = STUDIO_VALUE_PILLARS.map(
    (p) => `
      <article class="studio-pillar-item">
        <span class="studio-pillar-num mono-num">${escapeHtml(p.index)}.</span>
        <h3 class="studio-pillar-title">${escapeHtml(p.title)}</h3>
        <p class="studio-pillar-desc">${escapeHtml(p.description)}</p>
      </article>
    `
  ).join('');
}

function renderStudioFaq() {
  const container = document.getElementById('studio-faq-list');
  if (!container) return;

  container.innerHTML = STUDIO_FAQ_ITEMS.map((item, idx) => {
    const isOpen = openFaqIndex === idx;
    return `
      <div class="faq-item ${isOpen ? 'is-open' : ''}">
        <button
          type="button"
          class="faq-trigger"
          data-studio-faq-idx="${idx}"
          aria-expanded="${isOpen}"
        >
          <span>${escapeHtml(item.question)}</span>
          <svg class="faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="faq-panel" ${isOpen ? '' : 'hidden'}>
          <p>${escapeHtml(item.answer)}</p>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-studio-faq-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-studio-faq-idx'));
      openFaqIndex = openFaqIndex === idx ? -1 : idx;
      renderStudioFaq();
    });
  });
}

/* ============================================================================
 * 3. Server-Verified Store & Contact Access Gate Modal (Zero Client Secrets)
 * ============================================================================ */
function normalizeVaultTargetId(target) {
  const clean = String(target || 'store').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(VAULT_TARGET_LABELS, clean) ? clean : 'store';
}

function buildVaultGoUrl(target = 'store') {
  const safeTarget = normalizeVaultTargetId(target);
  return safeTarget === 'store'
    ? STORE_VAULT_API.goUrl
    : `${STORE_VAULT_API.goUrl}?target=${encodeURIComponent(safeTarget)}`;
}

function closeStoreAccessModal() {
  const root = document.getElementById('store-access-modal-root');
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
}

function openStoreAccessModal(serverStatus = null, initialAlert = '', target = 'store') {
  const root = document.getElementById('store-access-modal-root');
  if (!root) return;
  const safeTarget = normalizeVaultTargetId(target);
  const isContactTarget = safeTarget !== 'store';
  const targetMeta = VAULT_TARGET_LABELS[safeTarget];
  const cfg = getStoreAccessCfg();

  const promptTitle = isContactTarget
    ? targetMeta.defaultTitle
    : serverStatus?.promptTitle || cfg.promptTitle || targetMeta.defaultTitle;
  const promptDesc = isContactTarget
    ? serverStatus?.contactPromptDescription ||
      cfg.contactPromptDescription ||
      `Masukkan kode akses resmi untuk membuka ${targetMeta.label}.`
    : serverStatus?.promptDescription ||
      cfg.promptDescription ||
      'Masukkan kode akses resmi untuk melanjutkan ke halaman Store.';

  const isTargetUnavailable = isContactTarget
    ? Boolean(
        serverStatus &&
          serverStatus.ok &&
          (serverStatus.contactConfigured === false || !serverStatus.contactsConfigured?.[safeTarget])
      )
    : Boolean(serverStatus && serverStatus.ok && serverStatus.configured === false);
  const isLockedOut = Boolean(serverStatus?.lockedOut);
  const isUnreachable = Boolean(serverStatus?.unreachable);

  let initialErrorText = initialAlert || '';
  if (isUnreachable) {
    initialErrorText = 'Koneksi sedang bermasalah. Silakan coba beberapa saat lagi.';
  } else if (isTargetUnavailable) {
    initialErrorText = `Akses ${targetMeta.label} belum tersedia saat ini.`;
  } else if (isLockedOut) {
    initialErrorText = `Terlalu banyak percobaan salah. Silakan coba lagi dalam ${formatCooldownText(serverStatus.retryAfterSec)}.`;
  }

  const inputDisabled = isTargetUnavailable || isLockedOut;
  const fieldLabel = isContactTarget ? `Kode Akses ${targetMeta.label}` : 'Kode Akses Store';

  root.hidden = false;
  root.innerHTML = `
    <div class="modal-backdrop" id="store-gate-backdrop"></div>
    <div
      id="store-access-modal"
      class="modal-dialog store-gate-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-gate-title"
    >
      <div class="modal-header">
        <div class="store-gate-head-row">
          <div class="store-gate-lock-badge" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <h2 id="store-gate-title">${escapeHtml(promptTitle)}</h2>
            <p class="modal-subtitle">${escapeHtml(cfg.utilitiesBrandName || 'Manifestudio')}</p>
          </div>
        </div>
        <button type="button" class="icon-close-btn" id="close-store-gate-btn" aria-label="Tutup dialog kode akses">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <form id="store-access-form" class="store-gate-form" novalidate>
        <p class="store-gate-desc">${escapeHtml(promptDesc)}</p>

        <div class="form-field">
          <label for="store-access-key-field">${escapeHtml(fieldLabel)} <span class="req">*</span></label>
          <div class="store-gate-input-row">
            <input
              type="password"
              id="store-access-key-field"
              name="storeAccessKey"
              placeholder="Masukkan kode akses"
              autocomplete="off"
              spellcheck="false"
              maxlength="64"
              ${inputDisabled ? 'disabled' : ''}
              required
            />
            <button type="button" id="toggle-store-gate-key-btn" class="btn btn-secondary btn-sm" ${inputDisabled ? 'disabled' : ''}>
              Lihat
            </button>
          </div>
        </div>

        <div id="store-gate-error" class="form-error" role="alert" ${initialErrorText ? '' : 'hidden'}>${escapeHtml(initialErrorText)}</div>

        <div class="store-gate-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="cancel-store-gate-btn">Batal</button>
          <button type="submit" class="btn btn-primary btn-sm" id="submit-store-gate-btn" ${inputDisabled ? 'disabled' : ''}>
            ${escapeHtml(targetMeta.actionText)}
          </button>
        </div>
      </form>
    </div>
  `;

  const keyInput = root.querySelector('#store-access-key-field');
  const errorBox = root.querySelector('#store-gate-error');
  const toggleBtn = root.querySelector('#toggle-store-gate-key-btn');
  const submitBtn = root.querySelector('#submit-store-gate-btn');

  root.querySelector('#store-gate-backdrop')?.addEventListener('click', closeStoreAccessModal);
  root.querySelector('#close-store-gate-btn')?.addEventListener('click', closeStoreAccessModal);
  root.querySelector('#cancel-store-gate-btn')?.addEventListener('click', closeStoreAccessModal);

  toggleBtn?.addEventListener('click', () => {
    if (!keyInput) return;
    const isPass = keyInput.type === 'password';
    keyInput.type = isPass ? 'text' : 'password';
    toggleBtn.textContent = isPass ? 'Tutup' : 'Lihat';
  });

  keyInput?.addEventListener('input', () => {
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
  });

  root.querySelector('#store-access-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (inputDisabled) return;

    const entered = String(keyInput?.value || '').trim();
    if (!entered) {
      if (errorBox) {
        errorBox.textContent = 'Masukkan kode akses terlebih dahulu.';
        errorBox.hidden = false;
      }
      keyInput?.focus();
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Memeriksa...';
    }

    try {
      const res = await fetch(STORE_VAULT_API.verifyUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          [STORE_VAULT_API.csrfHeaderName]: STORE_VAULT_API.csrfHeaderValue,
        },
        body: JSON.stringify({ key: entered, target: safeTarget }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        closeStoreAccessModal();
        showToast(`Akses ${targetMeta.label} terverifikasi — mengalihkan...`);
        const nextGo =
          typeof data.goUrl === 'string' && data.goUrl.startsWith('/')
            ? data.goUrl
            : buildVaultGoUrl(safeTarget);
        window.location.assign(nextGo);
        return;
      }

      if (res.status === 429 || data?.reason === 'rate_limited') {
        if (errorBox) {
          errorBox.textContent = `Terlalu banyak percobaan salah. Silakan coba lagi dalam ${formatCooldownText(data.retryAfterSec || 900)}.`;
          errorBox.hidden = false;
        }
        if (keyInput) keyInput.disabled = true;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Dikunci Sementara';
        }
        return;
      }

      if (res.status === 503 || data?.reason === 'vault_not_configured' || data?.reason === 'target_not_configured') {
        if (errorBox) {
          errorBox.textContent = `Akses ${targetMeta.label} belum tersedia saat ini.`;
          errorBox.hidden = false;
        }
      } else {
        const rem =
          typeof data?.attemptsRemaining === 'number'
            ? ` Sisa percobaan: ${data.attemptsRemaining} kali.`
            : '';
        if (errorBox) {
          errorBox.textContent = `Kode akses tidak sesuai.${rem}`;
          errorBox.hidden = false;
        }
        if (keyInput) {
          keyInput.select();
          keyInput.focus();
        }
      }
    } catch {
      if (errorBox) {
        errorBox.textContent = 'Koneksi sedang bermasalah. Silakan coba lagi.';
        errorBox.hidden = false;
      }
    } finally {
      if (submitBtn && !keyInput?.disabled) {
        submitBtn.disabled = false;
        submitBtn.textContent = targetMeta.actionText;
      }
    }
  });

  if (!inputDisabled) {
    requestAnimationFrame(() => keyInput?.focus());
  }
}

async function handleStoreNavigationRequest(initialAlert = '', target = 'store') {
  const safeTarget = normalizeVaultTargetId(target);
  const ctx = getSiteContext();
  if (safeTarget === 'store' && !ctx.requiresStoreGate && !ctx.isProductionDomain && !ctx.isSplitDomain) {
    window.location.assign('./index.html');
    return;
  }

  const status = await fetchStoreVaultStatus();
  if (safeTarget === 'store') {
    if (status?.ok && status.configured && (status.enabled === false || status.hasActivePass)) {
      window.location.assign(buildVaultGoUrl('store'));
      return;
    }
  } else {
    const isConfigured = Boolean(status?.contactsConfigured?.[safeTarget]);
    if (status?.ok && isConfigured && (status.contactEnabled === false || status.hasActiveContactPass)) {
      window.location.assign(buildVaultGoUrl(safeTarget));
      return;
    }
  }
  openStoreAccessModal(status, initialAlert, safeTarget);
}

function syncStoreTriggerButtons() {
  const ctx = getSiteContext();
  const cfg = getStoreAccessCfg();
  const storeName = cfg.storeBrandName || DOMAIN_CONFIG.storeBrandName;
  const requiresGate = Boolean(ctx.requiresStoreGate);
  const homeHref = buildStudioRouteUrl(window.location.href, null);

  const brandLink = document.getElementById('tools-brand-link');
  const footerBrand = document.getElementById('footer-brand-name');
  brandLink?.setAttribute('href', homeHref);
  footerBrand?.setAttribute('href', homeHref);

  const headerStoreBtn = document.getElementById('tools-store-btn');
  if (headerStoreBtn) {
    headerStoreBtn.setAttribute(
      'aria-label',
      requiresGate ? `Akses ${storeName} (butuh kunci akses)` : `Buka katalog ${storeName}`
    );
    headerStoreBtn.innerHTML = requiresGate
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span class="hide-xs">Store</span>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span class="hide-xs">Store</span>`;
  }
}

function syncActiveTabChrome(tab) {
  const safeTab = resolveEnabledTab(tab);
  currentTab = safeTab;
  const meta = getTabMeta(safeTab);
  const ctx = getSiteContext();
  const utilName = getStoreAccessCfg().utilitiesBrandName || DOMAIN_CONFIG.utilitiesBrandName;

  const iconEl = document.getElementById('studio-tool-icon');
  const eyebrowEl = document.getElementById('studio-tool-eyebrow');
  const titleEl = document.getElementById('tools-page-title');
  const subEl = document.getElementById('tools-page-subtitle');

  if (iconEl) iconEl.src = meta.icon;
  if (eyebrowEl) eyebrowEl.textContent = `${meta.categoryLabel} · Gratis Tanpa Login`;
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.subtitle;
  document.title = `${utilName} — ${meta.title}`;

  applyDomainPwaMeta(ctx);
  syncStoreTriggerButtons();
}

function applyBrandToToolsPage(brandRaw) {
  activeBrand = normalizeBrandConfig(brandRaw || {});
  const ctx = getSiteContext();
  const display = resolveDisplayBrand(activeBrand, ctx);
  const utilBrandName = getStoreAccessCfg().utilitiesBrandName || activeBrand.name || 'Manifestudio';

  applyDomainPwaMeta(ctx);
  syncStoreTriggerButtons();

  const logoEl = document.getElementById('header-brand-logo');
  if (logoEl && activeBrand.logo) logoEl.src = activeBrand.logo;
  const nameEl = document.getElementById('header-brand-name');
  if (nameEl) nameEl.textContent = utilBrandName;
  const taglineEl = document.getElementById('header-brand-tagline');
  if (taglineEl) taglineEl.textContent = display.tagline;
  const footerNameEl = document.getElementById('footer-brand-name');
  if (footerNameEl) footerNameEl.textContent = utilBrandName;
  const footerCopyEl = document.getElementById('footer-copy-text');
  if (footerCopyEl && activeBrand.footerText) footerCopyEl.textContent = activeBrand.footerText;

  const socialContainer = document.getElementById('footer-social-links');
  if (socialContainer) {
    const installBtn = socialContainer.querySelector('#footer-install-link');
    const lockSvg =
      '<svg class="footer-lock-mini" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
    const csHiddenAttr = activeCatalogData?.utilities?.featureCsEnabled === false ? ' hidden' : '';
    // On Manifestudio, NEVER expose raw WhatsApp numbers or social handles in DOM — route all through Vault gate
    socialContainer.innerHTML = `
      <button type="button" id="footer-tanya-fitur-btn" class="footer-link-btn" data-open-feature-cs="true"${csHiddenAttr}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        <span>Tanya Fitur</span>
      </button>
      <button type="button" class="footer-link-btn" data-vault-target="store">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>Akses Store</span>
      </button>
      <button type="button" class="footer-link-btn" data-vault-target="whatsapp">
        <img src="./assets/icons/social-whatsapp.svg" alt="" width="18" height="18" class="footer-social-icon" />
        <span>WhatsApp</span>
        ${lockSvg}
      </button>
      <button type="button" class="footer-link-btn" data-vault-target="tiktok">
        <img src="./assets/icons/social-tiktok.svg" alt="" width="18" height="18" class="footer-social-icon" />
        <span>TikTok</span>
        ${lockSvg}
      </button>
      <button type="button" class="footer-link-btn" data-vault-target="instagram">
        <img src="./assets/icons/social-instagram.svg" alt="" width="18" height="18" class="footer-social-icon" />
        <span>Instagram</span>
        ${lockSvg}
      </button>
    `;
    if (installBtn) {
      socialContainer.appendChild(installBtn);
    }
  }
}

function bindStudioSectionEvents() {
  // Delegated click for Store/Contact Vault triggers & Dedicated Tool Page links
  document.addEventListener('click', (e) => {
    const vaultTrigger = e.target.closest?.('[data-vault-target]');
    if (vaultTrigger) {
      e.preventDefault();
      const target = vaultTrigger.getAttribute('data-vault-target') || 'store';
      handleStoreNavigationRequest('', target);
      return;
    }

    const storeTrigger = e.target.closest?.('[data-store-gate-trigger]');
    if (storeTrigger) {
      e.preventDefault();
      handleStoreNavigationRequest('', 'store');
      return;
    }

    const openFeatureCsEl = e.target.closest?.('[data-open-feature-cs]');
    if (openFeatureCsEl) {
      e.preventDefault();
      featureCs?.open?.({ restoreFloating: true });
      return;
    }

    const openToolEl = e.target.closest?.('[data-studio-open-tool]');
    if (openToolEl) {
      if (openToolEl.tagName === 'A' && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) {
        return;
      }
      e.preventDefault();
      const targetTab = openToolEl.getAttribute('data-studio-open-tool');
      if (targetTab) {
        if (targetTab === 'music') {
          import('./music.js?v=86')
            .then((m) => m.initMusicPlayer?.()?.restoreFab?.())
            .catch(() => {});
        }
        enterToolView(targetTab, { pushState: true });
      }
    }
  });

  // Back to Home Hub buttons (Logo, Footer brand, Dedicated Page Back button)
  const handleHomeBrandClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (currentViewMode === 'tool') {
      enterHomeView({ pushState: true, scrollTarget: 'top' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      syncHeaderNavState('top');
    }
  };
  document.getElementById('tools-brand-link')?.addEventListener('click', handleHomeBrandClick);
  document.getElementById('footer-brand-name')?.addEventListener('click', handleHomeBrandClick);
  document.getElementById('studio-back-home-btn')?.addEventListener('click', () => {
    enterHomeView({ pushState: true, scrollTarget: 'fitur' });
  });

  // Custom Quick-Switch Feature Picker trigger inside Dedicated Feature Page
  document.getElementById('studio-switcher-trigger')?.addEventListener('click', () => {
    openFeaturePickerSheet();
  });

  // Header navigation links (work seamlessly from both Home Hub & Dedicated Tool Page)
  document.querySelectorAll('[data-studio-section-link]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('data-studio-section-link') || 'top';
      if (currentViewMode === 'tool') {
        e.preventDefault();
        enterHomeView({ pushState: true, scrollTarget: targetId });
        return;
      }
      syncHeaderNavState(targetId);
    });
  });

  // Browser Back / Forward sync
  window.addEventListener('popstate', () => {
    closeFeaturePickerSheet();
    const route = readCurrentRoute();
    if (route.mode === 'tool' && route.tabId) {
      enterToolView(route.tabId, { pushState: false });
    } else {
      enterHomeView({ pushState: false });
    }
  });

  // Directory instant search
  const searchInput = document.getElementById('studio-feature-search');
  const clearBtn = document.getElementById('studio-clear-search-btn');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      directoryQuery = e.target.value;
      if (clearBtn) clearBtn.hidden = directoryQuery.trim().length === 0;
      renderStudioFeatureDirectory();
    });
  }
  clearBtn?.addEventListener('click', () => {
    directoryQuery = '';
    if (searchInput) searchInput.value = '';
    clearBtn.hidden = true;
    renderStudioFeatureDirectory();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const pickerRoot = document.getElementById('studio-switcher-sheet-root');
      if (pickerRoot && !pickerRoot.hidden) {
        closeFeaturePickerSheet();
        return;
      }
      const modalRoot = document.getElementById('store-access-modal-root');
      if (modalRoot && !modalRoot.hidden) {
        closeStoreAccessModal();
      }
    }
  });
}

async function bootstrap() {
  initPerformanceClass();
  loadTheme();
  applyTheme();

  const initialCtx = getSiteContext();
  applyDomainPwaMeta(initialCtx);
  syncStoreTriggerButtons();

  initPwaManager({
    appName: getStoreAccessCfg().utilitiesBrandName || 'Manifestudio',
    appDesc: 'Akses 17 fitur utilitas gratis lebih cepat dari layar utama & tetap nyaman dibuka offline.',
  });

  bindStudioSectionEvents();
  initStudioBannerCarousel();
  renderStudioCategoryTabs();
  renderStudioFeatureDirectory();
  renderStudioValuePillars();
  renderStudioFaq();
  renderToolSwitcherOptions();

  // Route cleanly between Home Hub (/) and Dedicated Feature Page (?tab=<id>)
  const initialRoute = readCurrentRoute();
  if (initialRoute.mode === 'tool' && initialRoute.tabId) {
    enterToolView(initialRoute.tabId, { pushState: false });
  } else {
    enterHomeView({ pushState: false });
  }

  // Mount floating "Tanya Fitur" Customer Service AI widget (replaces idle black music icon)
  featureCs = createFeatureCsController({
    getActiveTab: () => currentTab,
    onOpenFeature: (toolId) => {
      if (toolId) enterToolView(toolId, { pushState: true });
    },
    getConfig: () => ({
      enabled: activeUtilities?.featureAssistant?.enabled !== false,
      greeting: activeUtilities?.featureAssistant?.welcomeMessage || '',
    }),
  });

  // If redirected back from /api/store-access/go without a valid pass, show Gate notice
  try {
    const curUrl = new URL(window.location.href);
    if (curUrl.searchParams.get('gate') === 'required') {
      const gateTarget = normalizeVaultTargetId(curUrl.searchParams.get('target') || 'store');
      curUrl.searchParams.delete('gate');
      curUrl.searchParams.delete('target');
      window.history.replaceState({}, '', `${curUrl.pathname}${curUrl.search}${curUrl.hash}`);
      const targetLabel = VAULT_TARGET_LABELS[gateTarget]?.label || 'Store';
      handleStoreNavigationRequest(`Sesi berakhir. Masukkan kode akses untuk membuka ${targetLabel}.`, gateTarget);
    }
  } catch {
    // Ignore
  }

  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch {
      // Ignore
    }
    applyTheme();
  });

  // Keep floating YT Music icon available on Manifestudio (hidden only if user explicitly closed it inside popover)
  const bootMusicWidget = () => {
    import('./music.js?v=86')
      .then((m) => {
        const ctrl = m.initMusicPlayer?.();
        if (currentTab === 'music') {
          ctrl?.restoreFab?.();
        }
      })
      .catch(() => {});
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(bootMusicWidget, { timeout: 600 });
  } else {
    setTimeout(bootMusicWidget, 80);
  }

  try {
    const loaded = await loadCatalogData({ allowLocalPreview: true });
    if (loaded?.data?.brand) {
      applyBrandToToolsPage(loaded.data.brand);
    }
    if (loaded?.data?.banners) {
      activeCatalogBanners = normalizeBanners(loaded.data.banners);
    }
    if (loaded?.data?.utilities) {
      activeUtilities = normalizeUtilityConfig(loaded.data.utilities);
      toolsHub?.setUtilitiesConfig?.(activeUtilities);
      featureCs?.refreshConfig?.();
      renderToolSwitcherOptions(currentTab);
      if (currentViewMode === 'tool' && currentTab) {
        const nextSafeTab = resolveEnabledTab(currentTab);
        if (nextSafeTab !== currentTab) {
          enterToolView(nextSafeTab, { pushState: false });
        } else {
          syncActiveTabChrome(currentTab);
        }
      }
    }
    renderStudioBanners();
    renderStudioFeatureDirectory();
  } catch {
    // Ignore
  }
}

bootstrap();
