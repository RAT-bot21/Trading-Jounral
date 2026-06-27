const CACHE_NAME = 'tradelog-v1';

// Core files to cache for offline use
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// External CDN assets to cache
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.47.0/tabler-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

// ── Install: cache everything ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache core assets (must succeed)
      return cache.addAll(CORE_ASSETS).then(() => {
        // Cache CDN assets (best effort — don't fail install if CDN is down)
        return Promise.allSettled(
          CDN_ASSETS.map(url => cache.add(url).catch(() => {}))
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fall back to network ──
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Return cached version and update cache in background
        const fetchUpdate = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          }).catch(() => {});
        return cached;
      }

      // Not in cache — try network
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        // Cache the new response
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Network failed — return offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
