/**
 * Service Worker for Progressive Web App (PWA)
 */
const CACHE_NAME = 'chungcu-ai-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/css/style.css',
  '/js/chatbox.js',
  '/js/socket-client.js',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Chiến lược Network-First: Luôn tải bản mới nhất từ server trước khi F5
  if (event.request.method === 'GET' && (
    event.request.url.includes('/css/') ||
    event.request.url.includes('/js/') ||
    event.request.url.includes('/manifest.json')
  )) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
