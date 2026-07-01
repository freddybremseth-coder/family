// Minimal service worker — versjonsbumpet til v2 for å tvinge cache-invalidering.
// Vi cacher IKKE lenger app.html — bare gir en bare-bones offline-side.

const CACHE = 'familyhub-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then((clients) => clients.forEach(c => c.navigate(c.url)))
      .catch(() => {})
  );
});

// Ingen fetch-håndtering — la nettleseren gjøre alt selv.
// Dette hindrer at gamle bundles cacher.
