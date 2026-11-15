const CACHE_NAME = 'manifestudio-cache-v3';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './admin.html',
  './data/catalog.json',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/styles.css',
  './js/data.js',
  './js/store.js',
  './js/receipt.js',
  './js/pwa.js',
  './js/app.js',
  './js/admin.js',
  './assets/hero-banner.jpg',
  './assets/icons/brand-icon.svg',
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

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  // Always prefer fresh catalog.json from network so Admin Panel updates show immediately
  if (url.pathname.endsWith('/data/catalog.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./data/catalog.json', clone));
          }
          return response;
        })
        .catch(() => caches.match('./data/catalog.json'))
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
