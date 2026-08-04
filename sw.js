/* Judhūr service worker — offline app shell + audio cache.
   Strategy:
   - navigations / index.html: network-first, cache fallback (updates apply on
     next online load; offline still works)
   - everything else (audio, icons, manifest): cache-first, filled on first
     fetch — playing a clip or running the Progress tab's coverage check pulls
     audio into the offline cache
   Fonts are precached rather than filled on demand: [R-11] wants the study
   loop working with no network, and Arabic in a fallback face is a broken
   study loop, not a cosmetic downgrade. They are same-origin now, so the
   cross-origin allowance for Google Fonts is gone.
   Bump VERSION on deploys that change precached files. */
var VERSION = 'judhur-sw-v2';
var CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
  'fonts/inter-latin.woff2',
  'fonts/fraunces-latin.woff2',
  'fonts/noto-naskh-arabic.woff2',
  'fonts/noto-naskh-latin.woff2'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function cacheable(res) { return res && res.ok; }
function wanted(url) { return url.origin === self.location.origin; }

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // navigations: network-first so deployed updates arrive
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put('index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('index.html');
      })
    );
    return;
  }

  // assets: cache-first, fill from network
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (cacheable(res) && wanted(url)) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
