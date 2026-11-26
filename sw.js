const CACHE_NAME = 'manifestudio-cache-v100';

// Lean core shell precache (< 270 KB) so first-time visitors on slow mobile connections
// NEVER get bandwidth-starved downloading 100+ unused files. All other utilities, icons,
// vendor engines, and mascot banners are cached automatically on first use.
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './tools.html',
  './data/catalog.json',
  './manifest.webmanifest',
  './manifest-store.webmanifest',
  './manifest-utilities.webmanifest',
  './css/tokens.css',
  './css/styles.css',
  './js/perf-guard.js',
  './js/domain-router.js',
  './js/studio-home.js',
  './js/feature-cs-logic.js',
  './js/feature-cs-ui.js',
  './js/data.js',
  './js/store.js',
  './js/pwa.js',
  './js/app.js',
  './js/tools-page.js',
  './js/tools-ui.js',
  './js/tools-logic.js',
  './js/location.js',
  './assets/banners/banner-katalog.jpg',
  './assets/icons/brand-icon.svg',
  './assets/icons/menu-utilitas.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== 'manifestudio-ffmpeg-core-v1')
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const isCodeOrData =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json');

  // Network-first for HTML, JS, CSS, and JSON so updates appear immediately without stale SW cache
  if (isCodeOrData) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request, { ignoreSearch: true })
            .then((m) => m || (event.request.mode === 'navigate' ? caches.match('./index.html') : undefined))
        )
    );
    return;
  }

  // Cache-first with automatic runtime fill for images, SVG icons, banners, and vendor bundles
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
