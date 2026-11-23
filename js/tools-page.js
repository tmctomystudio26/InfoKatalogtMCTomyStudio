import { createToolsHubController } from './tools-ui.js?v=77';
import { loadCatalogData } from './data.js?v=77';
import { normalizeBrandConfig, normalizeUtilityConfig } from './store.js?v=77';
import { initPerformanceClass, scheduleIdleTask } from './perf-guard.js?v=77';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';
const VALID_TABS = new Set(['prayer', 'weather', 'worldclock', 'speedtest', 'downloader', 'compressor', 'converter', 'songfinder', 'music', 'dracin', 'audioeditor', 'manifestai', 'plagiarism', 'novel', 'callerid']);

let currentTheme = 'dark';
let toolsHub = null;
let toastTimer = null;
let activeUtilities = normalizeUtilityConfig();
let currentTab = 'prayer';

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
  dracin: 'Drama China',
  audioeditor: 'Audio Editor',
  manifestai: 'Manifest AI',
  plagiarism: 'Cek Plagiarisme',
  novel: 'Novel',
  callerid: 'Cek Nomor',
};

function renderHeaderNavFromUtilities() {
  const navEl = document.getElementById('tools-header-nav') || document.querySelector('.header-nav');
  if (!navEl) return;
  const enabledItems = getEnabledUtilityItems();
  const buttonsHtml = enabledItems
    .map((item) => {
      const rawLabel = String(item.label || '').trim();
      const label = rawLabel.length <= 24 ? rawLabel : CONCISE_HEADER_NAV_LABELS[item.id] || rawLabel;
      const isActive = item.id === currentTab;
      return `<button type="button" class="header-nav-link ${isActive ? 'is-active' : ''}" data-tools-nav="${escapeHtml(
        item.id
      )}" aria-current="${isActive ? 'page' : 'false'}">${escapeHtml(label)}</button>`;
    })
    .join('');

  navEl.innerHTML = `<a href="./index.html" class="header-nav-link">Katalog</a>${buttonsHtml}`;
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

  const titleEl = document.getElementById('tools-page-title');
  const subEl = document.getElementById('tools-page-subtitle');
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.subtitle;
  document.title = `${meta.title} — Manifestudio`;

  renderHeaderNavFromUtilities();

  const url = new URL(window.location.href);
  url.searchParams.set('tab', safeTab);
  window.history.replaceState({}, '', url.toString());
}

function applyBrandToToolsPage(brandRaw) {
  const brand = normalizeBrandConfig(brandRaw || {});
  const logoEl = document.getElementById('header-brand-logo');
  if (logoEl && brand.logo) logoEl.src = brand.logo;
  const nameEl = document.getElementById('header-brand-name');
  if (nameEl && brand.name) nameEl.textContent = brand.name;
  const taglineEl = document.getElementById('header-brand-tagline');
  if (taglineEl && brand.tagline) taglineEl.textContent = brand.tagline;
  const footerNameEl = document.getElementById('footer-brand-name');
  if (footerNameEl && brand.name) footerNameEl.textContent = brand.name;
  const footerCopyEl = document.getElementById('footer-copy-text');
  if (footerCopyEl && brand.footerText) footerCopyEl.textContent = brand.footerText;

  const socialContainer = document.getElementById('footer-social-links');
  if (socialContainer) {
    const socialsHtml = (brand.socials || [])
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
    socialContainer.innerHTML = `
      <a href="./index.html" class="footer-link-btn">Katalog Utama</a>
      ${socialsHtml}
    `;
  }
}

async function bootstrap() {
  initPerformanceClass();
  loadTheme();
  applyTheme();

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
    import('./music.js?v=77')
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


