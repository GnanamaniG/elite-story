// 7SQ Business Platform — Service Worker
// Enables "Install" as a desktop/mobile app. Network-first: always
// tries the live server first so deployed updates are seen immediately;
// only falls back to cache when there's genuinely no connection.
const CACHE_NAME = '7sq-shell-v1';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  // Supabase calls have their own offline queue (IndexedDB) built into the app —
  // let those fail naturally so that logic handles it, don't intercept here.
  if (request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached => {
          if (cached) return cached;
          if (request.destination === 'document') return caches.match('/index.html');
        })
      )
  );
});
