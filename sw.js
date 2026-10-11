// Keeps the whole app, map data included, on the phone so it opens at sea.
// Bump VERSION whenever any file changes; the new copy is fetched in the
// background and used from the next launch.
const VERSION = 'wm-1';
const FONTS = ['OpenSans-Regular', 'OpenSans-Semibold', 'OpenSans-Italic', 'OpenSans-Bold'];
const RANGES = ['0-255', '256-511', '512-767', '8192-8447'];
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/countries.js', 'js/languages.js', 'js/time.js',
  'vendor/maplibre-gl.js', 'vendor/maplibre-gl.css',
  'data/countries.json', 'data/borders.json', 'data/labels.json', 'data/rivers.json', 'data/river-names.json',
  'data/lakes.json', 'data/ports.json', 'data/details.json', 'data/pilots.json', 'data/rates.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  ...FONTS.flatMap((f) => RANGES.map((r) => `fonts/${f}/${r}.pbf`)),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== TILES).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Chart-mark tiles from OpenSeaMap: kept once seen, so an area looked at in
// port with a connection is still there at sea. Oldest dropped past a limit.
const TILES = 'wm-seamarks';
const TILE_LIMIT = 6000;
async function seamarkTile(request) {
  const cache = await caches.open(TILES);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - TILE_LIMIT))) await cache.delete(k);
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).host === 'tiles.openseamap.org') { e.respondWith(seamarkTile(e.request)); return; }
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
