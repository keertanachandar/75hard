// Bump this version string whenever any cached asset changes, so the
// activate handler purges the old cache and users get the new files.
const CACHE = '75hard-v10';
const ASSETS = [
  './', './index.html', './css/styles.css',
  './js/app.js', './js/data.js', './js/auth.js', './js/config.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only handle our own origin; Firebase/gstatic traffic goes straight to the network.
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
