const CACHE_NAME = 'manifestudio-cache-v38';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './tools.html',
  './order.html',
  './admin.html',
  './data/catalog.json',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/styles.css',
  './js/data.js',
  './js/store.js',
  './js/tools-logic.js',
  './js/location.js',
  './js/globe-data.js',
  './js/globe.js',
  './js/speedtest.js',
  './js/downloader.js',
  './js/compressor.js',
  './js/tools-ui.js',
  './js/tools-page.js',
  './js/music-logic.js',
  './js/music.js',
  './js/receipt.js',
  './js/vault.js',
  './js/pwa.js',
  './js/app.js',
  './js/order.js',
  './js/admin.js',
  './assets/hero-banner.jpg',
  './assets/og-manifestudio.jpg',
  './assets/banner-prayer.jpg',
  './assets/banner-weather.jpg',
  './assets/banner-worldclock.jpg',
  './assets/banner-speedtest.jpg',
  './assets/icons/brand-icon.svg',
  './assets/icons/menu-utilitas.svg',
  './assets/icons/social-whatsapp.svg',
  './assets/icons/social-tiktok.svg',
  './assets/icons/social-instagram.svg',
  './assets/icons/social-telegram.svg',
  './assets/icons/social-globe.svg',
  './assets/icons/tool-prayer.svg',
  './assets/icons/tool-weather.svg',
  './assets/icons/tool-world.svg',
  './assets/icons/tool-speed.svg',
  './assets/icons/tool-downloader.svg',
  './assets/icons/tool-compressor.svg',
  './assets/icons/tool-music.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/logos/netflix.svg',
  './assets/logos/youtube.svg',
  './assets/logos/spotify.svg',
  './assets/logos/canva.svg',
  './assets/logos/viu.svg',
  './assets/logos/vidio.svg',
  './assets/logos/alight-motion.svg',
  './assets/logos/wetv.svg',
  './assets/logos/prime-video.svg',
  './assets/logos/custom-request.svg',
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
          .filter((key) => key !== CACHE_NAME)
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
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
