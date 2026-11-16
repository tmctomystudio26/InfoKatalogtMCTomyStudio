import { createToolsHubController } from './tools-ui.js?v=20';
import { initMusicPlayer } from './music.js?v=20';
import { loadCatalogData } from './data.js?v=20';
import { normalizeBrandConfig } from './store.js?v=20';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';
const VALID_TABS = new Set(['prayer', 'weather', 'worldclock', 'speedtest', 'downloader', 'compressor']);

const TAB_META = {
  prayer: {
    title: 'Jadwal Sholat Indonesia',
    subtitle: 'Waktu Imsak hingga Isya resmi Kemenag RI sesuai lokasimu.',
  },
  weather: {
    title: 'Prakiraan Cuaca Presisi',
    subtitle: 'Deteksi hujan lebat real-time, intensitas mm/jam, suhu, dan angin hingga 7 hari.',
  },
  worldclock: {
    title: 'Jam Dunia & Bola Dunia',
    subtitle: 'Standar UTC internasional, konversi WIB/WITA/WIT, dan globe interaktif.',
  },
  speedtest: {
    title: 'Speedtest Internet',
    subtitle: 'Ukur ping, jitter, download, upload, server, ISP, dan info perangkat.',
  },
  downloader: {
    title: 'Downloader Video, Foto, Carousel & Story',
    subtitle: 'Unduh video HD, postingan foto, slide carousel, story, & salin caption dari TikTok, IG, YT, dan FB.',
  },
  compressor: {
    title: 'Kompres Foto & Video HD (Anti-Pecah Sosmed)',
    subtitle: 'Optimalkan ukuran & bitstream tanpa mengurangi kualitas sedikitpun agar unggahan TikTok, IG, & WA tetap jernih.',
  },
};

let currentTheme = 'dark';
let toolsHub = null;
let toastTimer = null;

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

function syncActiveTabChrome(tab) {
  const safeTab = VALID_TABS.has(tab) ? tab : 'prayer';
  const meta = TAB_META[safeTab] || TAB_META.prayer;

  const titleEl = document.getElementById('tools-page-title');
  const subEl = document.getElementById('tools-page-subtitle');
  if (titleEl) titleEl.textContent = meta.title;
  if (subEl) subEl.textContent = meta.subtitle;
  document.title = `${meta.title} — Manifestudio`;

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

  const initialTab = readInitialTab();
  const root = document.getElementById('tools-hub-root');

  if (root) {
    toolsHub = createToolsHubController({
      rootEl: root,
      onToast: showToast,
      onSubTabChange: (nextTab) => {
        syncActiveTabChrome(nextTab);
      },
    });
    toolsHub.mount(initialTab);
    syncActiveTabChrome(initialTab);
  }

  document.querySelectorAll('[data-tools-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-tools-nav');
      if (!next || !VALID_TABS.has(next)) return;
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
  } catch {
    // Ignore
  }
}

bootstrap();

