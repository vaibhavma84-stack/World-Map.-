// Keeps the whole app, map data included, on the phone so it opens at sea.
// Bump VERSION whenever any file changes; the new copy is fetched in the
// background and used from the next launch.
const VERSION = 'wm-1';
const FONTS = ['OpenSans-Regular', 'OpenSans-Semibold', 'OpenSans-Italic', 'OpenSans-Bold'];
const RANGES = ['0-255', '256-511', '512-767', '8192-8447'];
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/countries.js', 'js/languages.js', 'js/time.js', 'js/weather.js', 'js/currents.js', 'js/voyage.js', 'js/zones.js',
  'vendor/maplibre-gl.js', 'vendor/maplibre-gl.css',
  'data/countries.json', 'data/borders.json', 'data/labels.json', 'data/rivers.json', 'data/river-names.json',
  'data/lakes.json', 'data/ports.json', 'data/details.json', 'data/terminals.json', 'data/tss.json', 'data/zones.json', 'data/rates.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  ...FONTS.flatMap((f) => RANGES.map((r) => `fonts/${f}/${r}.pbf`)),
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    // The coastline index exists once the coastline job has run.
    .then((c) => c.addAll(FILES).then(() => c.add('data/coast/index.json').catch(() => {})))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== TILES && k !== COAST && k !== OFM && k !== WORLD).map((k) => caches.delete(k))))
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

// Detailed harbour coastlines: each square kept once fetched. The address
// carries the data's build date, so a rebuilt set is fetched afresh.
const COAST = 'wm-coast';
async function coastSquare(request) {
  const cache = await caches.open(COAST);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

// OpenFreeMap's vector tiles (detailed water): kept once seen, so a river or
// harbour looked at with a connection is still detailed at sea. The tile set's
// description is fetched fresh when possible, as it names the current tiles.
const OFM = 'wm-ofm';
const OFM_LIMIT = 20000;
async function ofmTile(request) {
  const cache = await caches.open(OFM);
  const isIndex = !new URL(request.url).pathname.endsWith('.pbf');
  if (isIndex) {
    try {
      const res = await fetch(request);
      if (res.ok) await cache.put(request, res.clone());
      return res;
    } catch {
      return (await cache.match(request)) || Response.error();
    }
  }
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - OFM_LIMIT))) await cache.delete(k);
  }
  return res;
}

// The world coastline file is read a piece at a time (HTTP ranges). Each
// piece read is kept; if the whole file has been saved (Settings), pieces are
// cut from it, so the whole world's detailed coast works at sea.
// Named after the file it holds (stamped by the Pages build), so pieces of an
// older coastline file are never mixed with a newer one: a new file, a new
// cache, and the old one is cleared when this version takes over.
const WORLD_ID = 'dev';
const WORLD = `wm-world-${WORLD_ID}`;
let worldBlob = null;
async function worldPiece(request) {
  const cache = await caches.open(WORLD);
  const url = new URL(request.url);
  url.search = '';
  const range = request.headers.get('Range');
  if (!range) {
    // The whole file: saved once, from Settings.
    const hit = await cache.match(url.href);
    if (hit) return hit;
    const res = await fetch(url.href);
    if (res.ok) { await cache.put(url.href, res.clone()); worldBlob = null; }
    return res;
  }
  // The app's own "save" reads (cache: no-store) keep their pieces themselves.
  if (request.cache === 'no-store') return fetch(request);
  const m = range.match(/bytes=(\d+)-(\d*)/);
  const start = +m[1];
  if (!worldBlob) {
    const full = await cache.match(url.href);
    if (full) worldBlob = await full.blob();
  }
  const piece = (body, from, total) => new Response(body, {
    status: 206,
    headers: {
      'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${from}-${from + body.size - 1}/${total}`, 'Content-Length': String(body.size),
    },
  });
  if (worldBlob) {
    const end = m[2] ? Math.min(+m[2], worldBlob.size - 1) : worldBlob.size - 1;
    return piece(worldBlob.slice(start, end + 1), start, worldBlob.size);
  }
  const key = `${url.href}?bytes=${start}-${m[2]}`;
  const hit = await cache.match(key);
  if (hit) return piece(await hit.blob(), start, hit.headers.get('X-Total') || '*');
  const res = await fetch(request);
  if (res.status === 206) {
    const total = (res.headers.get('Content-Range') || '').split('/')[1] || '*';
    await cache.put(key, new Response(await res.clone().blob(), { headers: { 'X-Total': total } }));
  }
  return res;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).pathname.endsWith('/land.pmtiles')) { e.respondWith(worldPiece(e.request)); return; }
  if (new URL(e.request.url).host === 'tiles.openfreemap.org') { e.respondWith(ofmTile(e.request)); return; }
  const url = new URL(e.request.url);
  if (url.origin === location.origin && url.pathname.includes('/data/coast/') && !url.pathname.endsWith('index.json')) {
    e.respondWith(coastSquare(e.request));
    return;
  }
  if (new URL(e.request.url).host === 'tiles.openseamap.org') { e.respondWith(seamarkTile(e.request)); return; }
  if (new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
