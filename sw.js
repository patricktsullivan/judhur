/* Judhūr service worker — offline app shell + audio cache.
   Strategy:
   - navigations / index.html: network-first, cache fallback (updates apply on
     next online load; offline still works)
   - everything else (audio, icons, manifest, Google Fonts): cache-first,
     filled on first fetch — playing a clip or running the Progress tab's
     coverage check pulls audio into the offline cache
   Bump VERSION on deploys that change precached files. */
var VERSION = 'judhur-sw-v1';
var CORE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png'
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

function cacheable(res) { return res && (res.ok || res.type === 'opaque'); }
function wanted(url) {
  return url.origin === self.location.origin ||
         /(^|\.)fonts\.googleapis\.com$/.test(url.hostname) ||
         /(^|\.)fonts\.gstatic\.com$/.test(url.hostname);
}

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
