var CACHE_NAME = "upkeep-v11-seven-original-cutout-atlases";
// Only the true app shell is precached at install time. exercises.json
// (a large data file) and gym.js are deliberately left out of cache.addAll:
// precaching them here competes with the page's own fetch for the same
// URL on first load and can abort one of the two requests (confirmed via
// net::ERR_ABORTED in testing). They still get cached lazily the first
// time the fetch handler below sees them succeed over the network.
// Original lossless coach pose strips are cached lazily on first display
// to keep install fast on mobile. Five cropped portraits are precached.
var SHELL_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./pixel-theme.css",
  "./pixel-theme.js",
  "./pixel-room-scenes.js",
  "./pixel-room-scenes.css",
  "./pixel-coach-sprites.js",
  "./pixel-assets/cutouts/atlas-portrait.png",
  "./pixel-assets/cutouts/pixel-portrait.png",
  "./pixel-assets/cutouts/mira-portrait.png",
  "./pixel-assets/cutouts/rex-portrait.png",
  "./pixel-assets/cutouts/luna-portrait.png",
  "./pixel-assets/cutouts/outdoor-coach-portrait.png",
  "./pixel-assets/cutouts/red-hoodie-coach-portrait.png",
  "./pixel-assets/atlas-portrait.png",
  "./pixel-assets/pixel-portrait.png",
  "./pixel-assets/mira-portrait.png",
  "./pixel-assets/rex-portrait.png",
  "./pixel-assets/luna-portrait.png",
  "./pixel-assets/room-empty.webp",
  "./pixel-assets/room-desktop.webp",
  "./pixel-assets/room-mobile.webp",
  "./pixel-assets/sidebar-landscape.webp",
  "./app.js",
  "./firebase-config.js",
  "./manifest.json",
  "./icon.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(SHELL_FILES); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  // Never cache Firebase traffic — auth/Firestore need live network calls,
  // and caching them would serve stale data or break sign-in.
  if (req.url.indexOf("googleapis.com") !== -1 || req.url.indexOf("gstatic.com") !== -1 || req.url.indexOf("firebaseio.com") !== -1) return;

  // Network-first: always try the latest version, fall back to cache when
  // offline (same tradeoff Artifact 2 made — avoids a stale shell sticking
  // around after an update).
  event.respondWith(
    fetch(req)
      .then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
        return res;
      })
      .catch(function () {
        return caches.match(req);
      })
  );
});
