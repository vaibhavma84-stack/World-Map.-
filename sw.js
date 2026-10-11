// Keeps the whole app, map data included, on the phone so it opens at sea.
// Bump VERSION whenever any file changes; the new copy is fetched in the
// background and used from the next launch.
const VERSION = 'wm-1';
const FONTS = ['OpenSans-Regular', 'OpenSans-Semibold', 'OpenSans-Italic', 'OpenSans-Bold'];
const RANGES = ['0-255', '256-511', '512-767', '8192-8447'];
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/countries.js', 'js/time.js',
  'vendor/maplibre-gl.js', 'vendor/maplibre-gl.css',
  'data/countries.json', 'data/borders.json', 'data/labels.json', 'data/rivers.json', 'data/river-names.json',
  'data/lakes.json', 'data/ports.json', 'data/details.json', 'data/pilots.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  ...FONTS.flatMap((f) => RANGES.map((r) => `fonts/${f}/${r}.pbf`)),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
