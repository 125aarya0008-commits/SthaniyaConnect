const CACHE_NAME = 'sthaniyaconnect-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/wardpulse.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: cache the core pages so the app opens even with no signal.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: clear out any older cache versions.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - App pages (this site's own HTML/JSON/icons): network first, cache fallback.
//   This way you always get the newest version when online, but the app
//   still opens from cache when there's no signal.
// - Everything else (map tiles, Supabase, fonts, libraries): just pass
//   through to the network as normal — those need to be live and shouldn't
//   be cached stale.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) return; // let the browser handle third-party requests normally

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(cached => cached || caches.match('/wardpulse.html')))
  );
});
