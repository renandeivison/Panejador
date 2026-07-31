// sw.js — Service Worker: cache do app shell para funcionamento 100% offline.
const CACHE_NAME = 'planejador-financeiro-v2.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/calc.js',
  './js/store.js',
  './js/ui.js',
  './js/charts.js',
  './js/import.js',
  './js/export.js',
  './js/forms.js',
  './js/details.js',
  './js/tests.js',
  './js/icons.js',
  './js/app.js',
  './js/views/dashboard.js',
  './js/views/transactions.js',
  './js/views/cards.js',
  './js/views/installments.js',
  './js/views/subscriptions.js',
  './js/views/people.js',
  './js/views/reports.js',
  './js/views/settings.js',
  './js/views/categories.js',
  './js/views/more.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
