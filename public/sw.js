// Minimal service worker for PWA install-støtte + basisk offline-fallback
// Ingen aggressiv caching (app-en trenger Supabase online).

const CACHE = 'familyhub-v1';
const OFFLINE_URLS = ['/app.html', '/'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Kun fange requester for samme origin, og bare HTML-navigasjon
  if (event.request.mode !== 'navigate') return;
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match('/app.html') || caches.match('/'))
  );
});
