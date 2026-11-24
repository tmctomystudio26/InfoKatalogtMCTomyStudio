import { createToolsHubController } from './tools-ui.js?v=80';
import { loadCatalogData } from './data.js?v=80';
import { normalizeBrandConfig, normalizeUtilityConfig } from './store.js?v=80';
import { initPerformanceClass, scheduleIdleTask } from './perf-guard.js?v=80';
import { initPwaManager } from './pwa.js?v=80';
import {
  DOMAIN_CONFIG,
  applyDomainPwaMeta,
  buildStoreUrl,
  normalizeStoreAccessConfig,
  resolveDisplayBrand,
  resolveSiteContext,
  verifyStoreAccessKey,
} from './domain-router.js?v=80';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';
const VALID_TABS = new Set([
  'prayer',
  'weather',
  'worldclock',
  'speedtest',
  'downloader',
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

let currentTheme = 'dark';
let toolsHub = null;
let toastTimer = null;
let activeUtilities = normalizeUtilityConfig();
let activeBrand = normalizeBrandConfig();
let currentTab = 'prayer';

function getSiteContext() {
  return resolveSiteContext({
    isToolsPage: true,
    storeAccess: activeBrand?.storeAccess,
  });
}

function getStoreAccessCfg() {
  return normalizeStoreAccessConfig(activeBrand?.storeAccess || {});
}

function isStoreGateSessionUnlocked() {
  const cfg = getStoreAccessCfg();
  if (!cfg.enabled) return true;
  try {
    return sessionStorage.getItem(DOMAIN_CONFIG.storeGateSessionKey) === cfg.accessKeyEncoded;
  } catch {
    return false;
  }
}

function saveStoreGateSessionUnlocked() {
  const cfg = getStoreAccessCfg();
  try {
    sessionStorage.setItem(DOMAIN_CONFIG.storeGateSessionKey, cfg.accessKeyEncoded);
  } catch {
    // Ignore storage error
  }
}

function getEnabledUtilityItems() {
  const enabled = (activeUtilities.items || []).filter((it) => it.enabled !== false);
  return enabled.length > 0 ? enabled : activeUtilities.items || [];
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
      label: 'Jadwal Sholat',
      pageTitle: 'Jadwal Sholat Indonesia',
      pageSubtitle: 'Waktu Imsak hingga Isya resmi Kemenag RI sesuai lokasimu.',
    };
  return {
    label: item.label,
    title: item.pageTitle,
    subtitle: item.pageSubtitle,
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

function readInitialTab() {
  const params = new URLSearchParams(window.location.search);
  const tab = (params.get('tab') || params.get('tool') || '').toLowerCase();
  return VALID_TABS.has(tab) ? tab : 'prayer';
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

function closeStoreAccessModal() {
  const root = document.getElementById('store-access-modal-root');
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
}

function openStoreAccessModal() {
  const root = document.getElementById('store-access-modal-root');
  if (!root) return;
  const ctx = getSiteContext();
  const cfg = getStoreAccessCfg();
  const storeName = cfg.storeBrandName || DOMAIN_CONFIG.storeBrandName;

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
            <h2 id="store-gate-title">${escapeHtml(cfg.promptTitle || `Akses Khusus ${storeName}`)}</h2>
            <p class="modal-subtitle">Area terproteksi dari ${escapeHtml(cfg.utilitiesBrandName || 'Manifestudio')}</p>
          </div>
        </div>
        <button type="button" class="icon-close-btn" id="close-store-gate-btn" aria-label="Tutup dialog kunci akses">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <form id="store-access-form" class="store-gate-form" novalidate>
        <p class="store-gate-desc">
          ${escapeHtml(
            cfg.promptDescription ||
              `Masukkan kunci akses khusus dari Admin untuk berpindah ke halaman ${storeName}.`
          )}
        </p>

        <div class="form-field">
          <label for="store-access-key-field">Kunci Akses Store <span class="req">*</span></label>
          <div class="store-gate-input-row">
            <input
              type="password"
              id="store-access-key-field"
              name="storeAccessKey"
              placeholder="Masukkan kunci akses"
              autocomplete="off"
              spellcheck="false"
              required
            />
            <button type="button" id="toggle-store-gate-key-btn" class="btn btn-secondary btn-sm">
              Lihat
            </button>
          </div>
        </div>

        <div id="store-gate-error" class="form-error" role="alert" hidden></div>

        <div class="store-gate-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="cancel-store-gate-btn">Batal</button>
          <button type="submit" class="btn btn-primary btn-sm" id="submit-store-gate-btn">
            Buka ${escapeHtml(storeName)} →
          </button>
        </div>
      </form>
    </div>
  `;

  const keyInput = root.querySelector('#store-access-key-field');
  const errorBox = root.querySelector('#store-gate-error');
  const toggleBtn = root.querySelector('#toggle-store-gate-key-btn');

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

  root.querySelector('#store-access-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const entered = keyInput?.value || '';
    const check = verifyStoreAccessKey(entered, cfg);
    if (!check.ok) {
      if (errorBox) {
        errorBox.textContent =
          check.reason === 'empty'
            ? 'Masukkan kunci akses terlebih dahulu.'
            : 'Kunci akses tidak valid. Hubungi Admin jika Anda memiliki akses.';
        errorBox.hidden = false;
      }
      keyInput?.focus();
      return;
    }

    saveStoreGateSessionUnlocked();
    closeStoreAccessModal();
    showToast(`Akses terverifikasi — membuka ${storeName}...`);
    const targetUrl = buildStoreUrl(ctx);
    window.location.href = targetUrl;
  });

  requestAnimationFrame(() => keyInput?.focus());
}

function handleStoreNavigationRequest() {
  const ctx = getSiteContext();
  if (!ctx.requiresStoreGate || isStoreGateSessionUnlocked()) {
    window.location.href = buildStoreUrl(ctx);
    return;
  }
  openStoreAccessModal();
}

function syncStoreTriggerButtons() {
  const ctx = getSiteContext();
  const cfg = getStoreAccessCfg();
  const storeName = cfg.storeBrandName || DOMAIN_CONFIG.storeBrandName;
  const requiresGate = Boolean(ctx.requiresStoreGate);

  const brandLink = document.getElementById('tools-brand-link');
  const footerBrand = document.getElementById('footer-brand-name');
  if (ctx.isSplitDomain && ctx.mode === 'utilities') {
    brandLink?.setAttribute('href', '#top');
    footerBrand?.setAttribute('href', '#top');
  } else {
    const storeHref = buildStoreUrl(ctx);
    brandLink?.setAttribute('href', storeHref);
    footerBrand?.setAttribute('href', storeHref);
  }

  const headerStoreBtn = document.getElementById('tools-store-btn');
  if (headerStoreBtn) {
    headerStoreBtn.setAttribute(
      'aria-label',
      requiresGate ? `Akses ${storeName} (butuh kunci akses)` : `Buka katalog ${storeName}`
    );
    headerStoreBtn.innerHTML = requiresGate
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>Store</span>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Katalog</span>`;
  }

  const headBackBtn = document.getElementById('tools-back-store-btn');
  if (headBackBtn) {
    headBackBtn.textContent = requiresGate ? 'Akses Store 🔒' : '← Menu Utama';
    headBackBtn.setAttribute(
      'aria-label',
      requiresGate ? `Buka ${storeName} dengan kunci akses` : 'Kembali ke menu utama'
    );
  }
}

const CONCISE_HEADER_NAV_LABELS = {
  prayer: 'Jadwal Sholat',
  weather: 'Cuaca',
  worldclock: 'Jam Dunia',
  speedtest: 'Speedtest',
  downloader: 'Downloader',
  compressor: 'Kompresor HD',
  converter: 'Konversi File',
  songfinder: 'Cari Lagu',
  music: 'Musik YT',
  dracin: 'Drama Pendek',
  audioeditor: 'Audio Editor',
  manifestai: 'Manifest AI',
  plagiarism: 'Cek Plagiarisme',
  novel: 'Novel',
  callerid: 'Cek Nomor',
};

function renderHeaderNavFromUtilities() {
  const navEl = document.getElementById('tools-header-nav') || document.querySelector('.header-nav');
  if (!navEl) return;
  const ctx = getSiteContext();
  const enabledItems = getEnabledUtilityItems();
  const buttonsHtml = enabledItems
    .map((item) => {
      const rawLabel = String(item.label || '').trim();
      const label =
        rawLabel.length <= 24 ? rawLabel : CONCISE_HEADER_NAV_LABELS[item.id] || rawLabel;
      const isActive = item.id === currentTab;
      return `<button type="button" class="header-nav-link ${isActive ? 'is-active' : ''}" data-tools-nav="${escapeHtml(
        item.id
      )}" aria-current="${isActive ? 'page' : 'false'}">${escapeHtml(label)}</button>`;
    })
    .join('');

  const storeTriggerHtml = ctx.requiresStoreGate
    ? `<button type="button" class="header-nav-link is-cross-link" data-store-gate-trigger="nav">Store 🔒</button>`
    : `<button type="button" class="header-nav-link" data-store-gate-trigger="nav">Katalog</button>`;

  navEl.innerHTML = `${storeTriggerHtml}${buttonsHtml}`;
  navEl.querySelectorAll('[data-tools-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-tools-nav');
      if (!next || !VALID_TABS.has(next)) return;
      currentTab = resolveEnabledTab(next);
      toolsHub?.mount(currentTab);
      syncActiveTabChrome(currentTab);
    });
  });
}

function syncActiveTabChrome(tab) {
  const safeTab = resolveEnabledTab(tab);
  currentTab = safeTab;
  const meta = getTabMeta(safeTab);
  const ctx = getSiteContext();
  const utilName = getStoreAccessCfg().utilitiesBrandName || DOMAIN_CONFIG.utilitiesBrandName;

  const titleEl = document.getElementById('tools-page-title');
  const subEl = document.getElementById('tools-page-subtitle');
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.subtitle;
  document.title = `${meta.title} — ${utilName}`;

  applyDomainPwaMeta(ctx);
  syncStoreTriggerButtons();
  renderHeaderNavFromUtilities();

  const url = new URL(window.location.href);
  url.searchParams.set('tab', safeTab);
  window.history.replaceState({}, '', url.toString());
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
    const socialsHtml = (activeBrand.socials || [])
      .map(
        (soc) => `
        <a
          href="${escapeHtml(soc.url || '#')}"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link-btn"
        >
          ${
            soc.logo
              ? `<img src="${escapeHtml(soc.logo)}" alt="" width="18" height="18" class="footer-social-icon" />`
              : ''
          }
          <span>${escapeHtml(soc.label || soc.platform || 'Sosmed')}</span>
        </a>
      `
      )
      .join('');
    const storeFooterLabel = ctx.requiresStoreGate ? 'Akses Store 🔒' : 'Katalog Utama';
    socialContainer.innerHTML = `
      <button type="button" class="footer-link-btn" data-store-gate-trigger="footer">${escapeHtml(storeFooterLabel)}</button>
      ${socialsHtml}
    `;
    if (installBtn) {
      socialContainer.appendChild(installBtn);
    }
  }
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
    appDesc: 'Akses 15 fitur utilitas gratis lebih cepat dari layar utama & tetap nyaman dibuka offline.',
  });

  // Global delegated click handler for all gated Store triggers (header, nav, page head, footer)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest?.('[data-store-gate-trigger]');
    if (!trigger) return;
    e.preventDefault();
    handleStoreNavigationRequest();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modalRoot = document.getElementById('store-access-modal-root');
      if (modalRoot && !modalRoot.hidden) {
        closeStoreAccessModal();
      }
    }
  });

  currentTab = readInitialTab();
  const root = document.getElementById('tools-hub-root');

  if (root) {
    toolsHub = createToolsHubController({
      rootEl: root,
      utilitiesConfig: activeUtilities,
      onToast: showToast,
      onSubTabChange: (nextTab) => {
        currentTab = resolveEnabledTab(nextTab);
        syncActiveTabChrome(currentTab);
      },
    });
    toolsHub.mount(currentTab);
    syncActiveTabChrome(currentTab);
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

  // Load floating YT Music bundle lazily when idle (or immediately if opening tab=music or resuming active audio)
  let wasMusicPlaying = false;
  try {
    const raw = sessionStorage.getItem('manifestudio_music_session_v1');
    if (raw) {
      const s = JSON.parse(raw);
      wasMusicPlaying = Boolean(s?.wasPlaying && !s?.explicitPaused);
    }
  } catch {
    // Ignore
  }
  const isVideoOrAudioTab =
    currentTab === 'dracin' ||
    currentTab === 'audioeditor' ||
    currentTab === 'songfinder' ||
    currentTab === 'downloader';
  const bootMusicLazy = () => {
    import('./music.js?v=80')
      .then((m) => m.initMusicPlayer?.())
      .catch(() => {});
  };
  if (currentTab === 'music' || (wasMusicPlaying && !isVideoOrAudioTab)) {
    bootMusicLazy();
  } else {
    scheduleIdleTask(bootMusicLazy, 2500);
  }

  try {
    const loaded = await loadCatalogData({ allowLocalPreview: true });
    if (loaded?.data?.brand) {
      applyBrandToToolsPage(loaded.data.brand);
    }
    if (loaded?.data?.utilities) {
      activeUtilities = normalizeUtilityConfig(loaded.data.utilities);
      const nextSafeTab = resolveEnabledTab(currentTab);
      toolsHub?.setUtilitiesConfig?.(activeUtilities);
      if (nextSafeTab !== currentTab) {
        currentTab = nextSafeTab;
        toolsHub?.mount(currentTab);
      }
      syncActiveTabChrome(currentTab);
    }
  } catch {
    // Ignore
  }
}

bootstrap();
