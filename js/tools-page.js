import { createToolsHubController } from './tools-ui.js';
import { initMusicPlayer } from './music.js';

const THEME_STORAGE_KEY = 'manifestudio_theme_v1';
const VALID_TABS = new Set(['prayer', 'weather', 'worldclock', 'speedtest']);

const TAB_META = {
  prayer: {
    title: 'Jadwal Sholat Indonesia',
    subtitle: 'Waktu Imsak hingga Isya resmi Kemenag RI sesuai lokasimu.',
  },
  weather: {
    title: 'Prakiraan Cuaca',
    subtitle: 'Suhu, kecepatan angin, dan peluang hujan per jam hingga 7 hari.',
  },
  worldclock: {
    title: 'Jam Dunia & Bola Dunia',
    subtitle: 'Standar UTC internasional, konversi WIB/WITA/WIT, dan globe interaktif.',
  },
  speedtest: {
    title: 'Speedtest Internet',
    subtitle: 'Ukur ping, jitter, download, upload, server, ISP, dan info perangkat.',
  },
};

let currentTheme = 'dark';
let toolsHub = null;
let toastTimer = null;

function readInitialTab() {
  const params = new URLSearchParams(window.location.search);
  const tab = (params.get('tab') || '').toLowerCase();
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

function bootstrap() {
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
}

bootstrap();
