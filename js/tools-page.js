import { createToolsHubController } from './tools-ui.js?v=46';
import { initMusicPlayer } from './music.js?v=46';
import { loadCatalogData } from './data.js?v=46';
import { normalizeBrandConfig, normalizeUtilityConfig } from './store.js?v=46';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';
const VALID_TABS = new Set(['prayer', 'weather', 'worldclock', 'speedtest', 'downloader', 'compressor', 'converter', 'songfinder', 'music']);

let currentTheme = 'dark';
let toolsHub = null;
let toastTimer = null;
let activeUtilities = normalizeUtilityConfig();

function getTabMeta(tab) {
  const safeTab = VALID_TABS.has(tab) ? tab : 'prayer';
  const item =
    (activeUtilities.items || []).find((it) => it.id === safeTab) ||
    activeUtilities.items?.[0] || {
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
};

function syncHeaderNavLabels() {
  document.querySelectorAll('[data-tools-nav]').forEach((btn) => {
    const target = btn.getAttribute('data-tools-nav');
    const item = (activeUtilities.items || []).find((it) => it.id === target);
    const customLabel = String(item?.label || '').trim();
    if (customLabel && customLabel.length <= 14) {
      btn.textContent = customLabel;
    } else if (CONCISE_HEADER_NAV_LABELS[target]) {
      btn.textContent = CONCISE_HEADER_NAV_LABELS[target];
    }
  });
}

function syncActiveTabChrome(tab) {
  const safeTab = VALID_TABS.has(tab) ? tab : 'prayer';
  const meta = getTabMeta(safeTab);

  const titleEl = document.getElementById('tools-page-title');
  const subEl = document.getElementById('tools-page-subtitle');
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.subtitle;
  document.title = `${meta.title} — Manifestudio`;

  syncHeaderNavLabels();

  document.querySelectorAll('[data-tools-nav]').forEach((btn) => {
    const target = btn.getAttribute('data-tools-nav');
    const isActive = target === safeTab;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

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
  loadTheme();
  applyTheme();

  let currentTab = readInitialTab();
  const root = document.getElementById('tools-hub-root');

  if (root) {
    toolsHub = createToolsHubController({
      rootEl: root,
      utilitiesConfig: activeUtilities,
      onToast: showToast,
      onSubTabChange: (nextTab) => {
        currentTab = VALID_TABS.has(nextTab) ? nextTab : 'prayer';
        syncActiveTabChrome(currentTab);
      },
    });
    toolsHub.mount(currentTab);
    syncActiveTabChrome(currentTab);
  }

  document.querySelectorAll('[data-tools-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-tools-nav');
      if (!next || !VALID_TABS.has(next)) return;
      currentTab = next;
      toolsHub?.mount(next);
      syncActiveTabChrome(next);
    });
  });

  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch {
      // Ignore
    }
    applyTheme();
  });

  initMusicPlayer();

  try {
    const loaded = await loadCatalogData({ allowLocalPreview: true });
    if (loaded?.data?.brand) {
      applyBrandToToolsPage(loaded.data.brand);
    }
    if (loaded?.data?.utilities) {
      activeUtilities = normalizeUtilityConfig(loaded.data.utilities);
      toolsHub?.setUtilitiesConfig?.(activeUtilities);
      syncActiveTabChrome(currentTab);
    }
  } catch {
    // Ignore
  }
}

bootstrap();


