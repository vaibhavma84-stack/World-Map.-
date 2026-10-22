import { COUNTRIES, countryName, currencyName, currencySymbol, flag } from './countries.js';
import { PHRASES, LANGUAGES, TERMS, languageName } from './languages.js';
import { setupWeather, tideAt, turningPoints, flowImage } from './weather.js';
import { currentFeatures } from './currents.js';
import { setupVoyage, project } from './voyage.js';
import { addZones, zonesAt, zonesCard } from './zones.js';
import { addCityDetail, addHills, setup3D, ensureDem, CITY_GROUPS } from './city.js';
import { addCityPlaces, placeCard, KINDS as PLACE_KINDS, PLACE_GROUPS } from './places.js';
import { setupMyPlaces, loadMyPlaces } from './myplaces.js';
import { openSky } from './sky.js';
import { setupVoyages } from './voyages.js';
import { openLearn, ialaRegion } from './learn.js';
import { openSpace } from './space.js';
import { addDiscover, discoverCard, DISCOVER_GROUPS } from './discover.js';
import {
  offsetMinutes, zonedToUtc, formatOffset, formatSpan, clock, longDate, shipClock,
  nextClockChange, sun, position,
} from './time.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ------------------------------------------------------------------ settings
const store = {
  get(k, d) { try { const v = localStorage.getItem(`wm.${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`wm.${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};
const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const settings = {
  homeTz: store.get('homeTz', deviceZone),
  homeName: store.get('homeName', 'Home'),
  ship: store.get('ship', null), // minutes ahead of UTC, or null when not set
};

// 15 light pastels. Each country carries a number 0–14 from the data build,
// chosen so no two countries that share a border share a colour.
const PASTELS = [
  '#f6cfcf', '#fadbc3', '#fcebbf', '#f1f3c2', '#dcefc5',
  '#c9ebd2', '#c4e7e1', '#d4dcf3', '#ddd3f2', '#ecd0ee',
  '#f6d3e4', '#eadbca', '#d8e4cf', '#f2e1d8', '#e2d8e8',
];
const SEA = '#b7d7ec';
const RANK_NAMES = ['Large port', 'Medium port', 'Small port', 'Very small port', 'Port'];

// ---------------------------------------------------------------------- data
const load = (f) => fetch(`data/${f}.json`).then((r) => {
  if (!r.ok) throw new Error(`${f}: ${r.status}`);
  return r.json();
});
const [countries, borders, labels, rivers, riverNames, lakes, portRows] = await Promise.all(
  ['countries', 'borders', 'labels', 'rivers', 'river-names', 'lakes', 'ports'].map(load),
);
// LNG and LPG terminals, gathered by a job on GitHub from Wikidata and
// OpenStreetMap: [lon, lat, name, kind, operator, source].
const terminalRows = await fetch('data/terminals.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
const terminals = terminalRows.map(([lon, lat, name, kind, operator, source], i) => ({ i, lon, lat, name, kind, operator, source }));

// Exchange rates against the US dollar: the copy saved into the app by a
// daily job on GitHub, replaced by a fresh one whenever there is a connection.
let rates = await fetch('data/rates.json').then((r) => r.json()).catch(() => ({ date: null, rates: {} }));
const savedRates = store.get('rates', null);
if (savedRates?.date && (!rates.date || savedRates.date > rates.date)) rates = savedRates;
(async () => {
  try {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 6000);
    const r = await fetch('https://open.er-api.com/v6/latest/USD', { signal: ctl.signal });
    const j = await r.json();
    if (j.result === 'success') {
      const fresh = { date: new Date(j.time_last_update_unix * 1000).toISOString(), rates: j.rates, live: true };
      if (!rates.date || fresh.date >= rates.date) { rates = fresh; store.set('rates', fresh); }
    }
  } catch { /* at sea: keep the saved rates */ }
})();

let details = null;
const loadDetails = () => (details ??= load('details'));

const ports = portRows.map(([name, lon, lat, cc, locode, rank, tz, detail], i) => ({
  i, name, lon, lat, cc, locode, rank, tz, detail,
}));
const portFeatures = {
  type: 'FeatureCollection',
  features: ports.map((p) => ({
    type: 'Feature', id: p.i,
    geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    properties: { i: p.i, name: p.name, rank: p.rank },
  })),
};

function graticule() {
  const lines = [];
  for (let lon = -180; lon <= 180; lon += 10) {
    const c = [];
    for (let lat = -85; lat <= 85; lat += 5) c.push([lon, lat]);
    lines.push({ type: 'Feature', properties: { major: lon % 30 === 0 }, geometry: { type: 'LineString', coordinates: c } });
  }
  for (let lat = -80; lat <= 80; lat += 10) {
    const c = [];
    for (let lon = -180; lon <= 180; lon += 5) c.push([lon, lat]);
    lines.push({ type: 'Feature', properties: { major: lat % 30 === 0 }, geometry: { type: 'LineString', coordinates: c } });
  }
  return { type: 'FeatureCollection', features: lines };
}

// ----------------------------------------------------------------------- map
const here = new URL('.', location.href).href;
const halo = { 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 };
const zoomed = (pairs) => ['interpolate', ['linear'], ['zoom'], ...pairs.flat()];

// Ports appear by size as you zoom in: big ones first, every one by zoom 6.
const PORT_ZOOM = [1.5, 3, 4, 5, 5.5];
const PORT_LAYERS = PORT_ZOOM.flatMap((_, r) => [`ports-${r}`, `port-names-${r}`]);

// Letters for labels. The fonts carry Latin (and a little more); a name in
// Devanagari or another script would ask for letters that are not there, and
// a failed request throws away the whole map piece (streets, buildings and
// all). So missing letters come back empty: the rest still draws.
maplibregl.addProtocol('glyphs', async (params) => {
  const [stack, range] = params.url.slice('glyphs://'.length).split('/');
  try {
    const res = await fetch(`${here}fonts/${stack.split(',')[0]}/${range}.pbf`);
    if (res.ok) return { data: await res.arrayBuffer() };
  } catch { /* offline and not kept */ }
  return { data: new ArrayBuffer(0) };
});

const style = {
  version: 8,
  glyphs: 'glyphs://{fontstack}/{range}',
  sources: {
    countries: { type: 'geojson', data: countries, tolerance: 0.05, maxzoom: 14 },
    borders: { type: 'geojson', data: borders, tolerance: 0.05, maxzoom: 14 },
    labels: { type: 'geojson', data: labels },
    rivers: { type: 'geojson', data: rivers, tolerance: 0.05, maxzoom: 14 },
    riverNames: { type: 'geojson', data: riverNames, maxzoom: 10 },
    lakes: { type: 'geojson', data: lakes, tolerance: 0.05, maxzoom: 14 },
    detail: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, tolerance: 0.1, maxzoom: 16 },
    grid: { type: 'geojson', data: graticule() },
    ports: { type: 'geojson', data: portFeatures, maxzoom: 12, buffer: 64 },
    // OpenSeaMap's chart symbols: traffic separation schemes, recommended
    // tracks and routes, lights, buoys and beacons. Drawn by OpenSeaMap and
    // fetched when there is a connection; tiles seen once are kept on the phone.
    seamarks: {
      type: 'raster', tileSize: 256, minzoom: 4, maxzoom: 18,
      tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
      attribution: 'Seamarks © <a href="https://openseamap.org">OpenSeaMap</a> contributors',
    },
    picked: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
    me: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
  },
  layers: [
    { id: 'sea', type: 'background', paint: { 'background-color': SEA } },
    {
      id: 'grid', type: 'line', source: 'grid',
      paint: {
        'line-color': '#ffffff',
        'line-opacity': ['case', ['get', 'major'], 0.55, 0.3],
        'line-width': ['case', ['get', 'major'], 0.8, 0.5],
      },
    },
    {
      id: 'land', type: 'fill', source: 'countries',
      paint: { 'fill-color': ['to-color', ['at', ['get', 'c'], ['literal', PASTELS]]], 'fill-antialias': true },
    },
    {
      id: 'coast', type: 'line', source: 'countries',
      paint: { 'line-color': '#6f97b3', 'line-width': zoomed([[1, 0.4], [6, 0.9], [10, 1.4]]) },
    },
    // Round the ports, from zoom 8: OpenStreetMap's coastline, good to a few
    // metres, laid over Natural Earth's. The mask clears the coarse land in
    // the covered circle; the detailed land and its shoreline go on top.
    { id: 'detail-mask', type: 'fill', source: 'detail', minzoom: 8, filter: ['==', ['get', 'kind'], 'mask'], paint: { 'fill-color': SEA, 'fill-antialias': false } },
    {
      id: 'detail-land', type: 'fill', source: 'detail', minzoom: 8, filter: ['==', ['get', 'kind'], 'land'],
      paint: { 'fill-color': ['to-color', ['at', ['get', 'c'], ['literal', PASTELS]]], 'fill-antialias': true },
    },
    {
      id: 'detail-shore', type: 'line', source: 'detail', minzoom: 8, filter: ['==', ['get', 'kind'], 'shore'],
      paint: { 'line-color': '#6f97b3', 'line-width': zoomed([[8, 0.8], [12, 1.3], [16, 2]]) },
    },
    { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': SEA, 'fill-outline-color': '#6f97b3' } },
    // Rivers by importance (Natural Earth scalerank: 0 the greatest).
    ...[[0, 5, 0], [6, 8, 2.5], [9, 99, 4]].map(([lo, hi, minzoom]) => ({
      id: `rivers-${lo}`, type: 'line', source: 'rivers', minzoom,
      filter: ['all', ['>=', ['get', 'scalerank'], lo], ['<=', ['get', 'scalerank'], hi]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#5b9bd0',
        'line-width': zoomed([[minzoom, lo ? 0.5 : 0.8], [6, lo ? 1 : 1.6], [10, lo ? 2 : 3]]),
      },
    })),
    {
      id: 'borders', type: 'line', source: 'borders',
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#7b6a86', 'line-width': zoomed([[1, 0.6], [6, 1.2], [10, 2]]), 'line-dasharray': [3, 1.5] },
    },
    ...[[0, 4, 3], [5, 8, 4], [9, 99, 5]].map(([lo, hi, minzoom]) => ({
      id: `river-names-${lo}`, type: 'symbol', source: 'riverNames', minzoom,
      filter: ['all', ['has', 'name'], ['>=', ['get', 'scalerank'], lo], ['<=', ['get', 'scalerank'], hi]],
      layout: {
        'symbol-placement': 'line', 'symbol-spacing': 350, 'text-field': ['get', 'name'],
        'text-font': ['OpenSans-Italic'], 'text-size': zoomed([[3, 10.5], [8, 13.5]]), 'text-max-angle': 70,
        'text-letter-spacing': 0.05, 'text-padding': 1,
      },
      paint: { 'text-color': '#2a6aa0', ...halo },
    })),
    {
      id: 'lake-names', type: 'symbol', source: 'lakes', minzoom: 3.5,
      filter: ['has', 'name'],
      layout: { 'text-field': ['get', 'name'], 'text-font': ['OpenSans-Italic'], 'text-size': 11 },
      paint: { 'text-color': '#2a6aa0', ...halo },
    },
    {
      id: 'country-names', type: 'symbol', source: 'labels',
      layout: {
        'text-field': ['get', 'name'], 'text-font': ['OpenSans-Semibold'],
        // By the size of the country, on a log scale: tiny states stay small.
        'text-size': ['interpolate', ['linear'], ['zoom'],
          1, ['interpolate', ['linear'], ['ln', ['max', ['get', 'area'], 1]], 6, 7, 16.5, 14],
          6, ['interpolate', ['linear'], ['ln', ['max', ['get', 'area'], 1]], 6, 10, 16.5, 22]],
        'text-transform': 'uppercase', 'text-letter-spacing': 0.08, 'text-max-width': 7,
        'symbol-sort-key': ['-', ['get', 'area']],
      },
      paint: { 'text-color': '#4c4458', 'text-opacity': zoomed([[6, 1], [8, 0.55]]), ...halo },
    },
    // One layer per port size, each from its own zoom, so labels for the
    // bigger ports win the space and the rest appear as you zoom in.
    ...PORT_ZOOM.map((minzoom, rank) => ({
      id: `ports-${rank}`, type: 'circle', source: 'ports', minzoom,
      filter: ['==', ['get', 'rank'], rank],
      paint: {
        'circle-color': ['#0e3a5c', '#1f5f8b', '#3d7aa6', '#5b8fb5', '#7a8f9e'][rank],
        'circle-radius': zoomed([[1, rank ? 1.8 : 2.6], [8, [5, 4.5, 4, 3.5, 3.5][rank]]]),
        'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1,
      },
    })),
    ...PORT_ZOOM.map((minzoom, rank) => ({
      id: `port-names-${rank}`, type: 'symbol', source: 'ports', minzoom,
      filter: ['==', ['get', 'rank'], rank],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': [rank ? 'OpenSans-Regular' : 'OpenSans-Bold'],
        'text-size': [12.5, 11.5, 11, 11, 10.5][rank],
        'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.55,
        'text-justify': 'auto', 'text-max-width': 9,
      },
      paint: { 'text-color': '#12324a', ...halo },
    })),
    { id: 'seamarks', type: 'raster', source: 'seamarks', minzoom: 5, layout: { visibility: 'none' } },
    {
      id: 'picked', type: 'circle', source: 'picked',
      paint: { 'circle-radius': 9, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#d2462f', 'circle-stroke-width': 3 },
    },
    {
      id: 'me', type: 'circle', source: 'me',
      paint: { 'circle-radius': 7, 'circle-color': '#2b7de9', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 },
    },
  ],
};

const map = new maplibregl.Map({
  container: 'map',
  style,
  center: store.get('center', [70, 15]),
  zoom: store.get('zoom', 1.6),
  minZoom: 0.5,
  // Past zoom 12 the coastline is Natural Earth's and only approximate, but
  // the chart marks need the room to show every buoy.
  maxZoom: 18,
  maxPitch: 75,
  attributionControl: false,
  dragRotate: false,
  pitchWithRotate: false,
  touchPitch: false,
  renderWorldCopies: true,
  fadeDuration: 150,
  // Draw at least at twice the screen's pixels: crisp lines and text even on
  // screens that report a low pixel ratio.
  pixelRatio: Math.max(2, window.devicePixelRatio || 1),
  antialias: true,
});
window.wmMap = map; // for checks from outside (tools/diag-site.mjs)
map.touchZoomRotate.disableRotation();
map.addControl(new maplibregl.AttributionControl({
  compact: true,
  customAttribution: 'Natural Earth · © OpenStreetMap · NGA World Port Index · UN/LOCODE',
}), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'nautical', maxWidth: 90 }), 'bottom-left');

map.on('moveend', () => {
  const c = map.getCenter();
  store.set('center', [+c.lng.toFixed(3), +c.lat.toFixed(3)]);
  store.set('zoom', +map.getZoom().toFixed(2));
});
map.on('mousemove', (e) => { $('#coords').textContent = position(e.lngLat.lat, ((e.lngLat.lng + 540) % 360) - 180); });
map.getCanvas().addEventListener('mouseleave', () => { $('#coords').textContent = ''; });

// Tap a port, or near one: fingers are wider than dots.
let myPlaces = null;
let myVoyages = null;
let discoverPlaces = [];
let cityPlaces = [];
map.on('click', (e) => {
  if (myPlaces?.justHeld()) return;
  if (voyage?.click(e)) return;
  const pad = 12;
  const box = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
  if (map.getLayer('voyage-ship') && map.queryRenderedFeatures(box, { layers: ['voyage-ship', 'voyage-ahead'] })[0]) { voyage.open(); return; }
  const mine = myPlaces?.hit(box);
  if (mine) { myPlaces.show(mine.properties.id); return; }
  const callHit = shown.voyages && map.getLayer('voyages-calls') && map.queryRenderedFeatures(box, { layers: ['voyages-calls'] })[0];
  if (callHit) { myVoyages.show(); return; }
  const discLayers = Object.values(DISCOVER_GROUPS).flat().filter((id) => map.getLayer(id));
  const discHit = discLayers.length && map.queryRenderedFeatures(box, { layers: discLayers })[0];
  if (discHit) {
    const [lon, lat] = discHit.geometry.coordinates;
    openPanel(discoverCard(discHit.properties, position(lat, lon)));
    return;
  }
  const poiLayers = Object.values(PLACE_GROUPS).flat().filter((id) => map.getLayer(id));
  const placeHit = poiLayers.length && map.queryRenderedFeatures(box, { layers: poiLayers })[0];
  if (placeHit) {
    const [lon, lat] = placeHit.geometry.coordinates;
    openPanel(placeCard(placeHit.properties, position(lat, lon)));
    return;
  }
  const gasHit = shown.terminals && map.getLayer('terminals') && map.queryRenderedFeatures(box, { layers: ['terminals'] })[0];
  const currentHit = shown.currents && map.getLayer('currents-line') && map.queryRenderedFeatures(box, { layers: ['currents-line'] })[0];
  const hits = map.queryRenderedFeatures(box, { layers: PORT_LAYERS });
  if (gasHit) {
    showTerminal(terminals[gasHit.properties.i]);
  } else if (!hits.length && currentHit) {
    showCurrent(currentHit.properties);
  } else if (hits.length) {
    const best = hits
      .map((f) => ports[f.properties.i])
      .sort((a, b) => dist2(e, a) - dist2(e, b))[0];
    showPort(best);
  } else {
    const land = map.queryRenderedFeatures(e.point, { layers: ['land'] })[0];
    if (land) showCountry(land.properties);
    else if (shown.eca || shown.marpol || shown.loadline) showZones(e.lngLat);
    else closePanel();
  }
});
const dist2 = (e, p) => {
  const q = map.project([p.lon, p.lat]);
  return (q.x - e.point.x) ** 2 + (q.y - e.point.y) ** 2;
};
for (const layer of [...PORT_LAYERS, 'terminals']) {
  map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
}

// ------------------------------------------------------- detailed coastlines
// Built by a job on GitHub into data/coast/, one file per 1° square near a
// port. Loaded for the squares on screen from zoom 8; the phone keeps each
// one it has fetched (and Settings can save them all for sea).
const coastIndex = await fetch('data/coast/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
const coastCells = new Map();
const coastUrl = (k) => `data/coast/${k}.json?v=${coastIndex.built}`;
let coastBusy = false;
async function loadCoast() {
  if (!coastIndex || coastBusy || map.getZoom() < 7.5) return;
  const b = map.getBounds();
  const want = [];
  for (let y = Math.floor(b.getSouth()); y <= Math.floor(b.getNorth()); y++) {
    for (let x = Math.floor(b.getWest()); x <= Math.floor(b.getEast()); x++) {
      const k = `${y}_${((x + 180) % 360 + 360) % 360 - 180}`;
      if (coastIndex.cells[k] && !coastCells.has(k)) want.push(k);
    }
  }
  if (!want.length || want.length > 40) return;
  coastBusy = true;
  await Promise.all(want.map((k) => fetch(coastUrl(k)).then((r) => r.json())
    .then((fc) => coastCells.set(k, fc.features)).catch(() => {})));
  // Keep the most recent few hundred squares in memory.
  while (coastCells.size > 300) coastCells.delete(coastCells.keys().next().value);
  map.getSource('detail').setData({ type: 'FeatureCollection', features: [...coastCells.values()].flat() });
  coastBusy = false;
}
map.on('moveend', loadCoast);
map.on('load', loadCoast);

// -------------------------------------------------------------------- layers
const LAYER_GROUPS = {
  seamarks: ['seamarks'],
  currents: ['currents-line', 'currents-arrows', 'currents-names'],
  terminals: ['terminals'],
  tss: ['tss-zone', 'tss-area-edge', 'tss-line', 'tss-lane', 'tss-track', 'tss-arrows'],
  osmwater: ['osm-water', 'osm-water-edge', 'osm-waterway'],
  rivers: ['rivers-hydro', 'rivers-hydro-names', 'rivers-0', 'rivers-6', 'rivers-9', 'river-names-0', 'river-names-5', 'river-names-9', 'lakes', 'lake-names'],
  grid: ['grid'],
  roads: ['roads-3', 'roads-2', 'roads-1-case', 'roads-1', 'osm-roads-case', 'osm-roads', 'osm-road-refs', 'cities', 'city-names'],
  eca: ['zones-eca-fill', 'zones-eca-line', 'zones-eca-labels'],
  marpol: ['zones-marpol-line', 'zones-marpol-labels'],
  loadline: ['zones-ll-fill', 'zones-ll-line', 'zones-ll-labels'],
  ...CITY_GROUPS,
  ...PLACE_GROUPS,
  myplaces: ['my-places'],
  voyages: ['voyages-legs', 'voyages-calls'],
  ...DISCOVER_GROUPS,
};
const shown = { depth: true, myplaces: true, voyages: true, wrecks: true, history: true, marinelife: true, hills: true, ...Object.fromEntries(Object.keys(PLACE_GROUPS).map((g) => [g, true])), cityroads: true, cityrail: true, citybuildings: true, citygreen: true, cityplaces: true, roads: true, eca: true, marpol: true, loadline: true, tss: true, seamarks: true, osmwater: true, terminals: true, currents: true, rivers: true, grid: true, weather: false, ...store.get('layers', {}) };
let wx = null;
// Only change what differs: each change makes the map reload that layer's
// source, and a reload racing a download left the city detail empty.
function setVisible(id, on) {
  if (!map.getLayer(id)) return;
  const want = on ? 'visible' : 'none';
  if ((map.getLayoutProperty(id, 'visibility') || 'visible') !== want) map.setLayoutProperty(id, 'visibility', want);
}
function applyLayers() {
  const want = {};
  for (const [group, ids] of Object.entries(LAYER_GROUPS)) for (const id of ids) want[id] = !!shown[group];
  // Buildings: flat, or raised in 3D.
  want['city-buildings'] = shown.citybuildings && !threeD?.isOn();
  want['city-buildings-3d'] = shown.citybuildings && !!threeD?.isOn();
  for (const [id, on] of Object.entries(want)) setVisible(id, on);
  wx?.setOn(shown.weather);
}
let threeD = null;

// Traffic separation schemes and routeing measures, from data/tss.json (kept
// up to date by tools/fetch-tss.mjs), in chart magenta and shown offline.
const TSS_COLOUR = '#c2189b';
async function addTss() {
  const data = await fetch('data/tss.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!data?.features?.length) return;
  map.addImage('tss-arrow', flowImage(TSS_COLOUR), { pixelRatio: 2 });
  map.addSource('tss', { type: 'geojson', data, tolerance: 0.2 });
  const kind = (...k) => ['in', ['get', 'k'], ['literal', k]];
  const before = 'borders';
  map.addLayer({
    id: 'tss-zone', type: 'fill', source: 'tss', minzoom: 3,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], kind('zone')],
    paint: { 'fill-color': TSS_COLOUR, 'fill-opacity': 0.28 },
  }, before);
  map.addLayer({
    id: 'tss-area-edge', type: 'line', source: 'tss', minzoom: 5,
    filter: ['all', ['==', ['geometry-type'], 'Polygon'], kind('itz', 'precaution')],
    paint: { 'line-color': TSS_COLOUR, 'line-width': 1.2, 'line-dasharray': [4, 3], 'line-opacity': 0.8 },
  }, before);
  map.addLayer({
    id: 'tss-line', type: 'line', source: 'tss', minzoom: 3,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], kind('line', 'zone')],
    paint: { 'line-color': TSS_COLOUR, 'line-width': zoomed([[3, 1.5], [10, 5]]), 'line-opacity': 0.45 },
  }, before);
  map.addLayer({
    id: 'tss-lane', type: 'line', source: 'tss', minzoom: 5,
    filter: kind('boundary', 'itz', 'precaution', 'crossing'),
    paint: { 'line-color': TSS_COLOUR, 'line-width': 1.2, 'line-dasharray': [4, 3], 'line-opacity': 0.8 },
  }, before);
  map.addLayer({
    id: 'tss-track', type: 'line', source: 'tss', minzoom: 4,
    filter: kind('track', 'dw', 'twoway'),
    paint: { 'line-color': TSS_COLOUR, 'line-width': 1.4, 'line-dasharray': [6, 3], 'line-opacity': 0.85 },
  }, before);
  // Arrows the way traffic goes: lanes are drawn in their direction of travel.
  map.addLayer({
    id: 'tss-arrows', type: 'symbol', source: 'tss', minzoom: 5,
    filter: ['all', ['==', ['geometry-type'], 'LineString'], kind('lane', 'track', 'dw')],
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 110, 'icon-image': 'tss-arrow', 'icon-size': zoomed([[5, 0.5], [10, 0.8]]),
      'icon-allow-overlap': true, 'icon-ignore-placement': true,
    },
  }, before);
  applyLayers();
}

// Major roads and cities, offline (Natural Earth): motorways from zoom 3.5,
// main roads from 5.5, the rest from 6.5; cities by size. Closer in, the
// OpenStreetMap roads with their numbers (NH 48, E40…) take over when online.
const ROAD = { 1: '#d9622b', 2: '#e39a3b', 3: '#c8a46e' };
async function addRoads() {
  const [roads, cities] = await Promise.all(['roads', 'cities'].map((n) =>
    fetch(`data/${n}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
  if (roads) {
    map.addSource('roads', { type: 'geojson', data: roads, tolerance: 0.6 });
    const road = (id, k, min, width, extra = {}) => map.addLayer({
      id, type: 'line', source: 'roads', minzoom: min, maxzoom: 10.5,
      filter: ['all', ['==', ['get', 'k'], k], ['<=', ['get', 'z'], ['+', ['zoom'], 2.5]]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ROAD[k], 'line-width': width, ...extra },
    }, 'borders');
    road('roads-3', 3, 6.5, zoomed([[6.5, 0.4], [10, 1.2]]), { 'line-opacity': 0.8 });
    road('roads-2', 2, 5.5, zoomed([[5.5, 0.7], [10, 1.8]]));
    road('roads-1-case', 1, 3.5, zoomed([[3.5, 1.8], [10, 4.4]]));
    map.setPaintProperty('roads-1-case', 'line-color', 'rgba(255,255,255,0.85)');
    road('roads-1', 1, 3.5, zoomed([[3.5, 1.1], [10, 2.8]]));
  }
  if (cities) {
    map.addSource('cities', { type: 'geojson', data: cities });
    const visible = ['<=', ['get', 'z'], ['+', ['zoom'], 1]];
    map.addLayer({
      id: 'cities', type: 'circle', source: 'cities', minzoom: 2, filter: visible,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'p'], 100000, 2.2, 1000000, 3.2, 10000000, 4.5],
        'circle-color': '#ffffff', 'circle-stroke-color': '#3a3a3a', 'circle-stroke-width': ['case', ['==', ['get', 'cap'], 1], 2, 1.2],
      },
    }, PORT_LAYERS[0]);
    map.addLayer({
      id: 'city-names', type: 'symbol', source: 'cities', minzoom: 2, filter: visible,
      layout: {
        'text-field': ['get', 'n'], 'text-font': ['OpenSans-Semibold'],
        'text-size': ['interpolate', ['linear'], ['get', 'p'], 100000, 11, 1000000, 12.5, 10000000, 14],
        'text-anchor': 'top', 'text-offset': [0, 0.5], 'text-max-width': 8, 'symbol-sort-key': ['-', 0, ['get', 'p']],
        'text-optional': true,
      },
      paint: { 'text-color': '#222831', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.5 },
    }, PORT_LAYERS[0]);
  }
  applyLayers();
}

// The great ocean currents: warm in red, cold in blue, arrows the way they set.
function addCurrents() {
  map.addImage('flow-warm', flowImage('#d1495b'), { pixelRatio: 2 });
  map.addImage('flow-cold', flowImage('#2e86de'), { pixelRatio: 2 });
  map.addSource('currents', { type: 'geojson', data: currentFeatures() });
  const before = 'borders';
  const tint = ['case', ['get', 'warm'], '#d1495b', '#2e86de'];
  map.addLayer({
    id: 'currents-line', type: 'line', source: 'currents',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': tint, 'line-opacity': 0.45, 'line-width': zoomed([[1, 3], [5, 7]]), 'line-blur': 1 },
  }, before);
  map.addLayer({
    id: 'currents-arrows', type: 'symbol', source: 'currents',
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 90, 'icon-image': ['case', ['get', 'warm'], 'flow-warm', 'flow-cold'],
      'icon-size': zoomed([[1, 0.6], [5, 0.9]]), 'icon-allow-overlap': true, 'icon-ignore-placement': true,
    },
  }, before);
  map.addLayer({
    id: 'currents-names', type: 'symbol', source: 'currents', minzoom: 1.5,
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 600, 'text-field': ['get', 'label'],
      'text-font': ['OpenSans-Italic'], 'text-size': zoomed([[1.5, 10], [5, 12.5]]), 'text-max-angle': 40,
      'text-offset': [0, -1.1],
    },
    paint: { 'text-color': ['case', ['get', 'warm'], '#a3243b', '#1f5f9e'], ...halo },
  }, before);
}

// OpenStreetMap's water everywhere (rivers, channels, docks, lakes, sea) from
// OpenFreeMap's vector tiles: online, and kept on the phone once seen. Added
// only once the map has loaded, so at sea with no connection it cannot hold
// the map up.
// OpenStreetMap's vector tiles (OpenFreeMap): detailed water, docks and
// roads. Read through the app's own store, the same on iPhone and Android:
// a tile seen once is kept (the most recent 30,000), and tiles of an area
// saved for use at sea are kept apart and never cleared. Tiles go to zoom
// 12 and are magnified beyond, so a saved area is complete at any zoom.
const OFM_SEEN = 'wm-ofm-seen', OFM_SAVED = 'wm-ofm-saved', OFM_MAX = 12;
const ofmKey = (z, x, y) => `https://ofm.cache/${z}/${x}/${y}.pbf`;
let ofmTemplate = null;
async function ofmTileJson() {
  try {
    const r = await fetch('https://tiles.openfreemap.org/planet');
    if (r.ok) {
      const j = await r.json();
      try { localStorage.setItem('wm.ofm.tilejson', JSON.stringify(j)); } catch { /* full */ }
      return j;
    }
  } catch { /* offline */ }
  try { return JSON.parse(localStorage.getItem('wm.ofm.tilejson')); } catch { return null; }
}
async function ofmFetch(z, x, y, signal) {
  const res = await fetch(ofmTemplate.replace('{z}', z).replace('{x}', x).replace('{y}', y), { signal, cache: 'no-store' });
  if (res.status === 204 || res.status === 404) return new ArrayBuffer(0);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.arrayBuffer();
}
const hasCaches = typeof caches !== 'undefined';
maplibregl.addProtocol('ofm', async (params, abort) => {
  const [z, x, y] = params.url.slice('ofm://'.length).split('/').map(Number);
  const key = ofmKey(z, x, y);
  if (hasCaches) {
    for (const name of [OFM_SAVED, OFM_SEEN]) {
      try { const hit = await (await caches.open(name)).match(key); if (hit) return { data: await hit.arrayBuffer() }; } catch { /* go on */ }
    }
  }
  const data = await ofmFetch(z, x, y, abort.signal);
  // Copy before handing it over: the map moves the original to its worker.
  if (hasCaches) {
    const copy = data.slice(0);
    caches.open(OFM_SEEN).then((c) => c.put(key, new Response(copy))).catch(() => {});
  }
  return { data };
});
// Terrain (hill shading and the 3D ground), kept the same way so a saved
// city has its hills at sea too.
const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const demKey = (z, x, y) => `https://dem.cache/${z}/${x}/${y}.png`;
async function demFetch(z, x, y, signal) {
  const res = await fetch(DEM_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y), { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.arrayBuffer();
}
maplibregl.addProtocol('dem', async (params, abort) => {
  const [z, x, y] = params.url.slice('dem://'.length).split('/').map(Number);
  const key = demKey(z, x, y);
  if (hasCaches) {
    for (const name of [OFM_SAVED, OFM_SEEN]) {
      try { const hit = await (await caches.open(name)).match(key); if (hit) return { data: await hit.arrayBuffer() }; } catch { /* go on */ }
    }
  }
  const data = await demFetch(z, x, y, abort.signal);
  if (hasCaches) {
    const copy = data.slice(0);
    caches.open(OFM_SEEN).then((c) => c.put(key, new Response(copy))).catch(() => {});
  }
  return { data };
});
// Keep the everyday store to its most recent 30,000 tiles.
if (hasCaches) setTimeout(async () => {
  try {
    const c = await caches.open(OFM_SEEN);
    const keys = await c.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - 30000))) await c.delete(k);
  } catch { /* fine */ }
}, 20000);

async function addOsmWater() {
  const tj = await ofmTileJson();
  if (!tj?.tiles?.[0]) return;
  ofmTemplate = tj.tiles[0];
  map.addSource('osm', { type: 'vector', tiles: ['ofm://{z}/{x}/{y}'], minzoom: 0, maxzoom: OFM_MAX, attribution: '© OpenStreetMap · OpenFreeMap' });
  for (const layer of OSM_WATER_LAYERS) map.addLayer(layer, 'rivers-0');
  const main = ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], true, false];
  const colour = ['match', ['get', 'class'], 'motorway', ROAD[1], 'trunk', ROAD[1], ROAD[2]];
  map.addLayer({
    id: 'osm-roads-case', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 9, filter: main,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': 'rgba(255,255,255,0.85)', 'line-width': zoomed([[9, 2.2], [14, 7]]) },
  }, 'borders');
  map.addLayer({
    id: 'osm-roads', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 9, filter: main,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': colour, 'line-width': zoomed([[9, 1.3], [14, 4.5]]) },
  }, 'borders');
  map.addLayer({
    id: 'osm-road-refs', type: 'symbol', source: 'osm', 'source-layer': 'transportation_name', minzoom: 9,
    filter: ['all', main, ['has', 'ref']],
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 400, 'text-field': ['get', 'ref'], 'text-font': ['OpenSans-Bold'],
      'text-size': 10.5, 'text-rotation-alignment': 'viewport', 'text-padding': 30,
    },
    paint: { 'text-color': '#7a2e0b', 'text-halo-color': '#fff6e0', 'text-halo-width': 2.2 },
  });
  addCityDetail(map, { before: 'borders', labelsBefore: PORT_LAYERS[0] });
  addHills(map, PORT_LAYERS[0]);
  addCityPlaces(map, PORT_LAYERS[0]).then((data) => { cityPlaces = data?.features || []; applyLayers(); });
}
const OSM_WATER_LAYERS = [
  {
    id: 'osm-water', type: 'fill', source: 'osm', 'source-layer': 'water', minzoom: 8,
    // Docks, rivers and lakes; the open sea is left to the depth shades.
    filter: ['!=', ['get', 'class'], 'ocean'],
    paint: { 'fill-color': SEA, 'fill-antialias': true },
  },
  {
    id: 'osm-water-edge', type: 'line', source: 'osm', 'source-layer': 'water', minzoom: 9,
    filter: ['!=', ['get', 'class'], 'ocean'],
    paint: { 'line-color': '#6f97b3', 'line-width': zoomed([[9, 0.4], [14, 1]]) },
  },
  {
    id: 'osm-waterway', type: 'line', source: 'osm', 'source-layer': 'waterway', minzoom: 9,
    filter: ['match', ['get', 'class'], ['river', 'canal'], true, false],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#5b9bd0', 'line-width': zoomed([[9, 0.8], [14, 2.5]]) },
  },
];

// Gas terminals: a badge saying LNG or LPG, the name once zoomed in.
const TERMINAL_COLOUR = { LNG: '#e07a1f', LPG: '#2a9d5b', 'LNG/LPG': '#8a5cc2' };
function badge(text, colour) {
  const s = 2, w = (text.length * 8 + 10) * s, h = 18 * s;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = colour;
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2 * s;
  g.beginPath();
  g.roundRect(s, s, w - 2 * s, h - 2 * s, 5 * s);
  g.fill(); g.stroke();
  g.fillStyle = '#ffffff';
  g.font = `bold ${11 * s}px -apple-system, Roboto, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + s / 2);
  return g.getImageData(0, 0, w, h);
}
function addTerminals() {
  for (const [kind, colour] of Object.entries(TERMINAL_COLOUR)) map.addImage(`gas-${kind}`, badge(kind, colour), { pixelRatio: 2 });
  map.addSource('terminals', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: terminals.map((t) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [t.lon, t.lat] }, properties: { i: t.i, kind: t.kind, name: t.name } })),
    },
  });
  map.addLayer({
    id: 'terminals', type: 'symbol', source: 'terminals', minzoom: 6,
    layout: {
      'icon-image': ['concat', 'gas-', ['get', 'kind']], 'icon-allow-overlap': true, 'icon-size': zoomed([[6, 0.8], [10, 1]]),
      'text-field': ['step', ['zoom'], '', 10, ['get', 'name']], 'text-font': ['OpenSans-Semibold'], 'text-size': 11,
      'text-anchor': 'top', 'text-offset': [0, 1.1], 'text-max-width': 10, 'text-optional': true,
    },
    paint: { 'text-color': '#5a3a12', ...halo },
  }, 'picked');
}

// ---------------------------------------------------- the world's coastline
// The whole world's detailed coast (OpenStreetMap land, coloured by country)
// in one file, data/land.pmtiles, read a piece at a time. From zoom 8 it
// replaces Natural Earth's coarse outline everywhere, port or not. Android
// carries the file; the iPhone keeps each piece it has read (or the whole
// file, from Settings). Used only if the file can be reached at start.
const WORLD_LAND = new URL('data/land.pmtiles', location.href).href;
const worldReady = (async () => {
  try {
    // Only where pieces of it can be read (206): a whole-file answer means a
    // server that cannot serve the map from it.
    const r = await fetch(WORLD_LAND, { headers: { Range: 'bytes=0-126' } });
    r.body?.cancel();
    return r.status === 206;
  } catch { return false; }
})();
let pmtilesOn = false;
function usePmtiles() {
  if (pmtilesOn || typeof pmtiles === 'undefined') return pmtilesOn;
  maplibregl.addProtocol('pmtiles', new pmtiles.Protocol().tile);
  pmtilesOn = true;
  return true;
}

// Rivers and their tributaries everywhere, with names (OpenStreetMap), from
// data/rivers.pmtiles where the app carries it: under Natural Earth's main
// rivers, named along their length as you zoom in.
const RIVERS_FILE = new URL('data/rivers.pmtiles', location.href).href;
async function addHydroRivers() {
  try {
    const r = await fetch(RIVERS_FILE, { headers: { Range: 'bytes=0-126' } });
    r.body?.cancel();
    if (r.status !== 206 || !usePmtiles()) return;
  } catch { return; }
  map.addSource('hydro', { type: 'vector', url: `pmtiles://${RIVERS_FILE}`, maxzoom: 10 });
  map.addLayer({
    id: 'rivers-hydro', type: 'line', source: 'hydro', 'source-layer': 'rivers', minzoom: 4,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#5b9bd0', 'line-width': zoomed([[4, 0.4], [7, 0.9], [10, 1.6], [13, 2.4]]), 'line-opacity': 0.9 },
  }, 'rivers-0');
  map.addLayer({
    id: 'rivers-hydro-names', type: 'symbol', source: 'hydro', 'source-layer': 'rivers', minzoom: 7,
    filter: ['has', 'n'],
    layout: {
      'symbol-placement': 'line', 'symbol-spacing': 350, 'text-field': ['get', 'n'], 'text-font': ['OpenSans-Italic'],
      'text-size': 11, 'text-padding': 20, 'text-max-angle': 30,
    },
    paint: { 'text-color': '#2f6f9f', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 },
  });
  applyLayers();
}

// The sea in shades of blue by depth (Natural Earth bathymetry: 0, 200,
// 1000 … 10,000 m), lighter where shallower, from data/bathymetry.pmtiles
// (offline); and the shape of the seafloor, shaded from the terrain tiles
// (online; kept once seen, or saved from Settings).
const DEPTHS = [
  [0, SEA], [200, '#a5cbe6'], [1000, '#93bfdf'], [2000, '#82b2d8'], [3000, '#72a5d0'], [4000, '#6398c7'],
  [5000, '#558abd'], [6000, '#487cb2'], [7000, '#3d6ea6'], [8000, '#335f98'], [9000, '#2a518a'], [10000, '#22447b'],
];
const DEPTH_FILE = new URL('data/bathymetry.pmtiles', location.href).href;
const DEPTH_LAYERS = [];
async function addDepths() {
  try {
    const r = await fetch(DEPTH_FILE, { headers: { Range: 'bytes=0-126' } });
    r.body?.cancel();
    if (r.status !== 206 || !usePmtiles()) return;
  } catch { return; }
  map.addSource('depth', { type: 'vector', url: `pmtiles://${DEPTH_FILE}`, maxzoom: 7 });
  // Under Natural Earth's land up to zoom 8, then under the detailed land.
  const high = map.getLayer('world-land') ? 'world-land' : 'detail-mask';
  for (const [d, colour] of DEPTHS) {
    for (const [suffix, before, range] of [['', 'grid', { maxzoom: 8 }], ['-hi', high, { minzoom: 8 }]]) {
      const id = `depth-${d}${suffix}`;
      map.addLayer({ id, type: 'fill', source: 'depth', 'source-layer': 'depth', ...range, filter: ['==', ['get', 'd'], d], paint: { 'fill-color': colour, 'fill-antialias': false } }, before);
      DEPTH_LAYERS.push(id);
    }
  }
  // The seafloor's ridges, trenches and seamounts (the hills shading takes
  // over from zoom 5).
  ensureDem(map);
  map.addLayer({
    id: 'sea-relief', type: 'hillshade', source: 'dem', maxzoom: 5,
    paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': '#1d3557', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#1d3557' },
  }, 'grid');
  DEPTH_LAYERS.push('sea-relief');
  LAYER_GROUPS.depth = DEPTH_LAYERS;
  applyLayers();
}

async function addWorldCoast() {
  if (!(await worldReady) || !usePmtiles()) return;
  map.addSource('world', { type: 'vector', url: `pmtiles://${WORLD_LAND}`, maxzoom: 11 });
  // Sea over Natural Earth's land, then the detailed land: both from zoom 8.
  map.addLayer({ id: 'world-sea', type: 'background', minzoom: 8, paint: { 'background-color': SEA } }, 'detail-mask');
  map.addLayer({
    id: 'world-land', type: 'fill', source: 'world', 'source-layer': 'land', minzoom: 8,
    paint: { 'fill-color': ['to-color', ['at', ['get', 'c'], ['literal', PASTELS]]], 'fill-antialias': false },
  }, 'detail-mask');
}

map.on('load', () => {
  addWorldCoast().then(addDepths);
  addOsmWater().then(applyLayers);
  addTerminals();
  addTss();
  addRoads();
  addHydroRivers();
  addZones(map, 'borders').then(applyLayers);
  addCurrents();
  wx = setupWeather(map, {
    bar: $('#wx-bar'), slider: $('#wx-slider'), time: $('#wx-time'), status: $('#wx-status'),
    reload: $('#wx-reload'), kinds: [...document.querySelectorAll('#wx-bar [data-kind]')],
  });
  voyage = setupVoyage(map, { openPanel, closePanel, $, hint, padding: clearOfPanel });
  myVoyages = setupVoyages(map, { openPanel, closePanel, findPorts: (t) => search(t).filter((p) => !p.place), countryName, flag });
  myPlaces = setupMyPlaces(map, { openPanel, closePanel, position });
  myVoyages.onPlacesLoaded(() => myPlaces.refresh());
  addDiscover(map, 'voyages-legs').then((f) => { discoverPlaces = f || []; applyLayers(); });
  $('#add-place').onclick = () => { layersBox.hidden = true; myPlaces.addAtCentre(); };
  applyLayers();
});
const layersBox = $('#layers');
$('#poi-switches').innerHTML = Object.entries(PLACE_KINDS).map(([k, d]) =>
  `<label><input type="checkbox" data-layer="poi-${k}"> ${d.icon} ${d.label}</label>`).join('');
for (const box of layersBox.querySelectorAll('[data-layer]')) {
  box.checked = shown[box.dataset.layer];
  box.onchange = () => { shown[box.dataset.layer] = box.checked; store.set('layers', shown); applyLayers(); };
}
$('#layers-btn').onclick = () => {
  layersBox.hidden = !layersBox.hidden;
  $('#layers-btn').setAttribute('aria-expanded', String(!layersBox.hidden));
};
map.on('click', () => { layersBox.hidden = true; moreBox.hidden = true; });

// More: the night sky, the view from space, my voyages, learn.
const moreBox = $('#more');
$('#more-btn').onclick = () => { moreBox.hidden = !moreBox.hidden; layersBox.hidden = true; };
// Where the sky is seen from: the ship, by dead reckoning from her last
// position, or else the middle of the map.
function skyPlace() {
  try {
    const v = JSON.parse(localStorage.getItem('wm.voyage'));
    if (v && Number.isFinite(v.lat)) {
      const hours = Math.max(0, (Date.now() - Date.parse(v.time)) / 3600000);
      const p = project(v, hours);
      return { lat: p.lat, lon: p.lon, label: `The ship (${position(p.lat, p.lon)}, by DR)` };
    }
  } catch { /* none */ }
  const c = map.getCenter();
  return { lat: c.lat, lon: ((c.lng + 540) % 360) - 180, label: `Middle of the map (${position(c.lat, ((c.lng + 540) % 360) - 180)}). Set the ship's position for the sky at the ship.` };
}
let space = null;
function goToSpace() {
  if (space) return;
  moreBox.hidden = true;
  const p = skyPlace();
  space = openSpace({ countries, here: p, onClose: () => { space = null; if (map.getZoom() < 1) map.easeTo({ zoom: 1.3 }); } });
}
for (const b of moreBox.querySelectorAll('[data-more]')) {
  b.onclick = () => {
    moreBox.hidden = true;
    const what = b.dataset.more;
    if (what === 'sky') openSky({ openPanel, place: skyPlace });
    if (what === 'space') goToSpace();
    if (what === 'voyages') myVoyages?.show();
    if (what === 'learn') openLearn({ openPanel });
  };
}
// Zooming out past the whole world goes on into space.
{
  let push = 0, pinchStart = 0;
  // The whole world in view: the map can go no further out (about zoom 0.75
  // on a phone, held by the world's height).
  const atMin = () => map.getZoom() < 1.05;
  map.getCanvasContainer().addEventListener('wheel', (e) => {
    if (atMin() && e.deltaY > 0) { push += e.deltaY; if (push > 400) { push = 0; goToSpace(); } } else push = 0;
  }, { passive: true });
  const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  map.getCanvasContainer().addEventListener('touchstart', (e) => { pinchStart = e.touches.length === 2 && atMin() ? dist(e.touches) : 0; }, { passive: true });
  map.getCanvasContainer().addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2) return;
    if (!pinchStart && atMin()) pinchStart = dist(e.touches);
    if (pinchStart && atMin() && dist(e.touches) < pinchStart * 0.6) { pinchStart = 0; goToSpace(); }
  }, { passive: true });
}

threeD = setup3D(map, $('#btn-3d'), () => applyLayers());

$('#world').onclick = () => map.flyTo({ center: [70, 15], zoom: 1.6 });

// ------------------------------------------------------------------ my ship
// Position, time and speed, with a course or waypoints; the weather where the
// ship will be at +3, 6, 9, 12 and 24 hours.
let voyage = null;
// ------------------------------------------------------------------ updates
// Settings → Check for updates. In the Android app: find the newest APK on
// GitHub, download it with the phone's download manager and open the
// installer. On the iPhone (the web app): fetch the newest version and reload.
const RELEASES = 'https://api.github.com/repos/vaibhavma84-stack/World-Map.-/releases?per_page=30';
const androidApp = window.WorldMapApp;
const appVersion = androidApp ? androidApp.version() : null;
const verNum = (v) => Number(String(v).replace(/^.*?1\./, '')) || 0;
async function newestApk() {
  const list = await fetch(RELEASES, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
  return list
    .filter((r) => !r.draft && !r.prerelease && /^world-map-1\.\d+$/.test(r.tag_name))
    .map((r) => ({ version: r.tag_name.replace('world-map-', ''), when: r.published_at, apk: r.assets.find((a) => a.name.endsWith('.apk')) }))
    .filter((r) => r.apk)
    .sort((a, b) => verNum(b.version) - verNum(a.version))[0] || null;
}
let updateOffer = null;
async function checkUpdate(quiet) {
  const btn = $('#update-btn'), text = $('#update-text');
  if (!androidApp) {
    // Web app: the service worker brings the newest version; reload to it.
    if (quiet) return;
    btn.disabled = true;
    text.textContent = 'Checking…';
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
      if (reg?.installing || reg?.waiting) { text.textContent = 'New version found: loading it…'; setTimeout(() => location.reload(), 2500); return; }
      text.textContent = navigator.onLine === false ? 'No connection: try again when online.' : 'You have the latest version.';
    } catch { text.textContent = 'Could not check: try again when online.'; }
    btn.disabled = false;
    return;
  }
  if (!quiet) { btn.disabled = true; text.textContent = 'Checking…'; }
  try {
    const n = await newestApk();
    if (n && verNum(n.version) > verNum(appVersion)) {
      updateOffer = n;
      btn.textContent = `Download and install version ${n.version}`;
      text.textContent = `This phone has version ${appVersion}. Version ${n.version} is ready (${Math.round(n.apk.size / 1e6)} MB, mobile data or Wi-Fi). It downloads in the background; then Android asks to install it.`;
      $('#settings-btn')?.classList.add('has-update');
    } else if (!quiet) {
      text.textContent = `You have the latest version (${appVersion}).`;
    }
  } catch {
    if (!quiet) text.textContent = 'Could not check: try again when online.';
  }
  btn.disabled = false;
}
function installUpdate() {
  const btn = $('#update-btn'), text = $('#update-text');
  const n = updateOffer;
  androidApp.download(n.apk.browser_download_url, n.apk.name);
  btn.disabled = true;
  const poll = setInterval(() => {
    const p = androidApp.progress();
    if (p.startsWith('running')) {
      btn.textContent = `Downloading version ${n.version}… ${p.split(' ')[1]}%`;
      text.textContent = 'You can keep using the map; the download carries on in the background.';
    } else if (p === 'done') {
      clearInterval(poll);
      btn.disabled = false;
      btn.textContent = `Install version ${n.version}`;
      text.textContent = 'Downloaded. Tap to install; your places, voyages and settings are kept.';
      btn.onclick = () => {
        const r = androidApp.install();
        if (r === 'allow') text.textContent = 'Android asks to allow installing from World Map: switch it on, come back and tap Install again.';
        else if (r !== 'ok') text.textContent = 'The download is missing: tap Check for updates to try again.';
      };
      btn.click();
    } else if (p === 'failed') {
      clearInterval(poll);
      btn.disabled = false;
      btn.textContent = 'Try the download again';
      text.textContent = 'The download stopped (no signal?). Tap to try again.';
    }
  }, 1000);
}
$('#update-btn').onclick = () => (updateOffer && androidApp ? installUpdate() : checkUpdate(false));
if (appVersion) $('#app-version').textContent = `Version ${appVersion}`;
// Look once at start (online), quietly: Settings then shows the offer.
if (androidApp && navigator.onLine !== false) setTimeout(() => checkUpdate(true), 8000);

function hint(text) {
  $('#hint-text').textContent = text;
  $('#hint').hidden = !text;
}
$('#hint-done').onclick = () => { hint(''); voyage?.open(); };
$('#ship-btn').onclick = () => voyage?.open();

// ----------------------------------------------------------------- my place
// GPS works with no signal, so on board this shows the ship and the ports nearest.
$('#locate').onclick = () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude: lat, longitude: lon } = pos.coords;
    map.getSource('me').setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} });
    map.flyTo({ center: [lon, lat], zoom: Math.max(map.getZoom(), 7) });
  }, (err) => alert(`Position not available: ${err.message}`), { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
};

// -------------------------------------------------------------------- search
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const index = ports.map((p) => fold(`${p.name} ${p.locode}`));
const countryIndex = new Map();
for (const p of ports) {
  if (!countryIndex.has(p.cc)) countryIndex.set(p.cc, fold(countryName(p.cc)));
}

const q = $('#q');
const results = $('#results');
let found = [];
let cursor = -1;

function search(text) {
  const t = fold(text.trim());
  if (!t) return [];
  const words = t.split(/\s+/);
  const scored = [];
  for (const p of ports) {
    const hay = index[p.i];
    const country = countryIndex.get(p.cc);
    if (!words.every((w) => hay.includes(w) || country.includes(w))) continue;
    let score = p.rank;
    if (hay.startsWith(t)) score -= 10;
    else if (hay.includes(` ${t}`) || hay.includes(`(${t}`)) score -= 5;
    if (p.locode.toLowerCase() === t) score -= 20;
    scored.push([score, p]);
  }
  const portsFound = scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).slice(0, 60).map((x) => x[1]);
  // Places: my own first, then the city's (bars, clubs, hotels…).
  const places = [];
  const match = (name) => { const n = fold(name || ''); return words.every((w) => n.includes(w)) ? (n.startsWith(t) ? 0 : 1) : -1; };
  for (const p of loadMyPlaces()) {
    const m = match(p.n);
    if (m >= 0) places.push([m - 10, { place: { n: p.n, k: p.k, mine: p.id, note: p.note }, lon: p.lon, lat: p.lat }]);
  }
  for (const f of cityPlaces) {
    const m = f.properties.n ? match(f.properties.n) : -1;
    if (m >= 0) places.push([m, { place: f.properties, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }]);
  }
  const placesFound = places.sort((a, b) => a[0] - b[0]).slice(0, 25).map((x) => x[1]);
  return [...placesFound.filter((p) => p.place.mine), ...portsFound.slice(0, 40), ...placesFound.filter((p) => !p.place.mine)];
}

function renderResults() {
  if (!q.value.trim()) { results.hidden = true; return; }
  results.hidden = false;
  results.innerHTML = found.length
    ? found.map((p, n) => `<li role="option" data-n="${n}" aria-selected="${n === cursor}">${p.place
      ? `<span class="name">${(PLACE_KINDS[p.place.k] || { icon: '⭐' }).icon} ${esc(p.place.n)}</span>
        <span class="meta">${p.place.mine ? 'My place' : esc((PLACE_KINDS[p.place.k]?.label || 'Place').replace(/ \(.*\)$/, ''))}</span>`
      : `<span class="name">${flag(p.cc)} ${esc(p.name)}</span>
        <span class="meta">${esc(p.locode || countryName(p.cc))}</span>`}</li>`).join('')
    : '<li class="none">No port or place by that name. Press and hold the map to add your own.</li>';
}

q.addEventListener('input', () => {
  $('#clear').hidden = !q.value;
  found = search(q.value);
  cursor = found.length ? 0 : -1;
  renderResults();
});
q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    cursor = Math.max(0, Math.min(found.length - 1, cursor + (e.key === 'ArrowDown' ? 1 : -1)));
    renderResults();
    results.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && found[cursor]) {
    choose(found[cursor]);
  } else if (e.key === 'Escape') {
    q.value = ''; q.dispatchEvent(new Event('input'));
  }
});
results.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-n]');
  if (li) choose(found[+li.dataset.n]);
});
$('#clear').onclick = () => { q.value = ''; q.dispatchEvent(new Event('input')); q.focus(); };

function choose(p) {
  results.hidden = true;
  q.blur();
  if (p.place) {
    if (p.place.mine) myPlaces?.show(p.place.mine);
    else openPanel(placeCard(p.place, position(p.lat, p.lon)));
    map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 16), speed: 1.6, padding: clearOfPanel() });
    return;
  }
  showPort(p);
  map.flyTo({ center: [p.lon, p.lat], zoom: Math.max(map.getZoom(), 9), speed: 1.6, padding: clearOfPanel() });
}

// --------------------------------------------------------------------- panel
const panel = $('#panel');
const body = $('#panel-body');
let current = null;
let ticker = null;

$('#close').onclick = closePanel;
panel.querySelector('.grip').onclick = () => panel.classList.toggle('tall');

// Room the map leaves for the card, so a chosen port is not hidden behind it.
function clearOfPanel() {
  const r = panel.getBoundingClientRect();
  if (panel.hidden) return { top: 0, bottom: 0, left: 0, right: 0 };
  return innerWidth >= 760
    ? { top: 0, bottom: 0, left: 0, right: r.width + 12 }
    : { top: 60, bottom: r.height, left: 0, right: 0 };
}

function closePanel() {
  panel.hidden = true;
  current = null;
  clearInterval(ticker);
  map.getSource('picked')?.setData({ type: 'FeatureCollection', features: [] });
}

function openPanel(html) {
  body.innerHTML = html;
  panel.hidden = false;
  panel.scrollTop = 0;
}

function showCountry(props) {
  const cc = props.iso && props.iso !== '-99' ? props.iso : null;
  if (!cc) {
    openPanel(`<h1>${esc(props.name)}</h1>`);
    return;
  }
  openCountry(cc, props.name);
}

function openCountry(cc, name = countryName(cc)) {
  clearInterval(ticker);
  current = null;
  map.getSource('picked').setData({ type: 'FeatureCollection', features: [] });
  const own = ports.filter((p) => p.cc === cc);
  // The country's clocks: the zones its ports keep, most ports first.
  const zoneCount = new Map();
  for (const p of own) if (!p.tz.startsWith('Etc/')) zoneCount.set(p.tz, (zoneCount.get(p.tz) || 0) + 1);
  // Zones with a real share of the ports, by local offset: one line per clock.
  const byOffset = new Map();
  for (const [z, n] of [...zoneCount.entries()].sort((a, b) => b[1] - a[1])) {
    const off = offsetMinutes(z);
    if (n >= Math.max(2, own.length * 0.03) && !byOffset.has(off)) byOffset.set(off, z);
  }
  const zones = [...byOffset.values()].slice(0, 4);
  const money = COUNTRIES[cc];
  const langs = LANGUAGES[cc] || [];

  openPanel(`
    <h1>${flag(cc)} ${esc(name)}</h1>
    <p class="sub">${own.length.toLocaleString('en')} ports · buoyage IALA Region ${ialaRegion(cc)} · zoom in to see them all</p>
    <div class="cards">
      ${zones.length ? `<div class="card" id="c-local"></div>` : ''}
      ${money ? moneyCards(money) : ''}
      ${langs.length ? `<div class="card"><h3>Language${langs.length > 1 ? 's' : ''}</h3>
        <div class="big">${langs.map((l) => esc(languageName(l))).join(' · ')}</div></div>` : ''}
      ${langs.filter((l) => PHRASES[l]).map((l, n) => `
        <details class="card phrases" ${n === 0 ? 'open' : ''}>
          <summary><h3>Useful words · ${esc(languageName(l))}</h3></summary>
          <table class="words">${PHRASES[l].map(([word, say], i) => `
            <tr><th>${TERMS[i]}</th><td><span class="word" lang="${l}">${esc(word)}</span><span class="say">${esc(say)}</span></td></tr>`).join('')}
          </table>
        </details>`).join('')}
      ${langs.length && !langs.some((l) => PHRASES[l]) && !langs.includes('en') ? '<div class="note">No phrases for this language yet.</div>' : ''}
    </div>
    <p class="source">Rates: <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">ExchangeRate-API</a>. Pronunciations are approximate.</p>`);

  if (zones.length) {
    const draw = () => {
      const el = $('#c-local');
      if (!el) return clearInterval(ticker);
      const now = new Date();
      el.innerHTML = `<h3>Local time</h3>${zones.map((z) => `
        <div class="big">${clock(z, now, true)} <span class="note">${formatOffset(offsetMinutes(z, now))}${zones.length > 1 ? ` · ${esc(z.split('/').pop().replace(/_/g, ' '))}` : ''}</span></div>`).join('')}`;
    };
    draw();
    ticker = setInterval(draw, 15000);
  }
  wireConverter();
}

function moneyCards([code, dial]) {
  const sym = currencySymbol(code);
  const rate = rates.rates?.[code];
  const fmt = (v) => v.toLocaleString('en', { maximumFractionDigits: v < 10 ? 4 : 2 });
  const when = rates.date ? new Date(rates.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return `<div class="two">
    <div class="card"><h3>Currency</h3><div class="big">${esc(code)}${sym ? ` · ${esc(sym)}` : ''}</div><div class="note">${esc(currencyName(code))}</div></div>
    <div class="card"><h3>Dialling code</h3><div class="big">+${esc(dial)}</div><div class="note">From abroad</div></div>
  </div>
  ${code === 'USD' ? '' : `<div class="card money" data-rate="${rate || ''}" data-code="${esc(code)}">
    <h3>Exchange rate</h3>
    ${rate ? `<div class="big">1 USD = ${fmt(rate)} ${esc(code)}</div>
      <div class="note">1 ${esc(code)} = ${fmt(1 / rate)} USD · ${rates.live ? 'live, ' : ''}${esc(when)}</div>
      <div class="convert">
        <label><input type="number" inputmode="decimal" min="0" step="any" data-from="usd" value="100"> USD</label>
        <span>=</span>
        <label><input type="number" inputmode="decimal" min="0" step="any" data-from="local" value="${(100 * rate).toFixed(2)}"> ${esc(code)}</label>
      </div>`
    : '<div class="note">No rate saved yet. Open the app once with a connection.</div>'}
  </div>`}`;
}

function wireConverter() {
  const box = body.querySelector('.money[data-rate]');
  const rate = +box?.dataset.rate;
  if (!rate) return;
  const usd = box.querySelector('[data-from="usd"]');
  const local = box.querySelector('[data-from="local"]');
  usd.oninput = () => { local.value = usd.value === '' ? '' : (+usd.value * rate).toFixed(2); };
  local.oninput = () => { usd.value = local.value === '' ? '' : (+local.value / rate).toFixed(2); };
}

function showPort(p) {
  current = p;
  map.getSource('picked').setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: {} });
  const money = COUNTRIES[p.cc];
  const chips = [RANK_NAMES[p.rank], p.locode].filter(Boolean);
  openPanel(`
    <h1>${esc(p.name)}</h1>
    <p class="sub"><button type="button" class="linkish inline" data-country="${esc(p.cc)}">${flag(p.cc)} ${esc(countryName(p.cc))} ›</button> · ${position(p.lat, p.lon)}</p>
    <div class="chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}<button type="button" class="chip chip-btn" id="add-call">＋ Add to my voyages</button></div>
    <div class="now"><span class="time" id="t-now"></span><span class="zone" id="t-zone"></span></div>
    <div class="date" id="t-date"></div>
    <div class="cards">
      <div class="two">
        <div class="card" id="c-ship"></div>
        <div class="card" id="c-home"></div>
      </div>
      <div class="card" id="c-change" hidden></div>
      <div class="card" id="c-sun"></div>
      ${money ? moneyCards(money) : ''}
      <div class="card eta">
        <h3>Time at ETA</h3>
        <input id="eta" type="datetime-local" aria-label="ETA in port local time">
        <div class="note">Enter the ETA in port time.</div>
        <dl id="eta-out"></dl>
      </div>
      ${gasCard(p)}
      <div class="card tide" id="c-tide"><h3>Tide</h3><div class="note">Loading…</div></div>
      <div id="c-facts"></div>
    </div>
    <p class="source">${p.detail >= 0 ? 'NGA World Port Index' : 'UN/LOCODE'} · ${esc(p.tz)} · Not for navigation.</p>`);

  $('#add-call').onclick = () => myVoyages?.addPort(p);
  const eta = $('#eta');
  eta.value = store.get(`eta.${p.locode || p.i}`, '');
  eta.addEventListener('input', () => { store.set(`eta.${p.locode || p.i}`, eta.value); renderEta(p); });

  tick();
  clearInterval(ticker);
  ticker = setInterval(tick, 1000);
  renderEta(p);
  wireConverter();
  loadTide(p);
  if (p.detail >= 0) {
    loadDetails().then((all) => { if (current === p) $('#c-facts').innerHTML = facts(all[p.detail]); });
  }
}

// Great-circle distance in nautical miles, and the initial true bearing.
function legFrom(a, b) {
  const r = Math.PI / 180;
  const [f1, f2, dl] = [a.lat * r, b.lat * r, (b.lon - a.lon) * r];
  const h = Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  const nm = 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(h)));
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return { nm, brg: ((Math.atan2(y, x) / r) + 360) % 360 };
}

function gasNear(p, maxNm = 15) {
  return terminals
    .filter((t) => Math.abs(t.lat - p.lat) < 0.5 && Math.abs(t.lon - p.lon) < 0.8)
    .map((t) => ({ t, ...legFrom(p, t) }))
    .filter((x) => x.nm <= maxNm)
    .sort((a, b) => a.nm - b.nm);
}

function gasCard(p) {
  const near = gasNear(p);
  if (!near.length) return '';
  return `<div class="card"><h3>Gas terminals nearby</h3><ul class="gas">${near.slice(0, 8).map(({ t, nm }) => `
    <li><button type="button" data-gas="${t.i}">
      <span class="tag" style="background:${TERMINAL_COLOUR[t.kind]}">${esc(t.kind)}</span>
      <span class="gname">${esc(t.name)}</span>
      <span class="note">${nm.toFixed(1)} nm${t.operator ? ` · ${esc(t.operator)}` : ''}</span>
    </button></li>`).join('')}</ul></div>`;
}

// A tap at sea: the emission control area, MARPOL special area and load
// line zone there, with the season now.
function showZones(lngLat) {
  clearInterval(ticker);
  current = null;
  const lon = ((lngLat.lng + 540) % 360) - 180;
  map.getSource('picked')?.setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lngLat.lat] }, properties: {} });
  openPanel(zonesCard(zonesAt(lon, lngLat.lat), position(lngLat.lat, lon)));
}

function showTerminal(t) {
  clearInterval(ticker);
  current = null;
  map.getSource('picked').setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [t.lon, t.lat] }, properties: {} });
  const nearest = ports
    .filter((p) => Math.abs(p.lat - t.lat) < 0.5 && Math.abs(p.lon - t.lon) < 0.8)
    .map((p) => ({ p, ...legFrom(t, p) }))
    .sort((a, b) => a.nm - b.nm)[0];
  const rows = [['Type', t.kind], ['Operator', t.operator], ['Position', position(t.lat, t.lon)],
    ['Nearest port', nearest ? `${nearest.p.name} · ${nearest.nm.toFixed(1)} nm` : '']].filter(([, v]) => v);
  openPanel(`
    <h1>${esc(t.name)}</h1>
    <p class="sub"><span class="tag" style="background:${TERMINAL_COLOUR[t.kind]}">${esc(t.kind)}</span> terminal</p>
    <div class="cards"><div class="card"><table class="facts">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>
      ${nearest ? `<button type="button" class="card linkish" data-port="${nearest.p.i}">Open ${esc(nearest.p.name)} →</button>` : ''}
    </div>
    <p class="source">From ${esc(t.source)}${t.source === 'OpenStreetMap' ? ' (© OpenStreetMap contributors)' : ''}. Not for navigation.</p>`);
}

function showCurrent(c) {
  clearInterval(ticker);
  current = null;
  map.getSource('picked').setData({ type: 'FeatureCollection', features: [] });
  openPanel(`
    <h1>${esc(c.name)}</h1>
    <p class="sub">${c.warm ? 'Warm' : 'Cold'} current</p>
    <div class="cards">
      <div class="card"><h3>Usual rate</h3><div class="big">${esc(c.rate)}</div>${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}</div>
      <div class="card"><div class="note">The line is the current's usual axis. It shifts with season and weather; turn on Weather → Current for the set and drift forecast for today.</div></div>
    </div>`);
}

function tick() {
  const p = current;
  if (!p) return;
  const now = new Date();
  const off = offsetMinutes(p.tz, now);
  $('#t-now').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: p.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now);
  $('#t-zone').textContent = formatOffset(off);
  $('#t-date').textContent = longDate(p.tz, now);

  // Ship's clock: how far to advance or retard to keep port time.
  const ship = $('#c-ship');
  if (settings.ship == null) {
    ship.innerHTML = `<h3>Ship's clock</h3><div class="note">Not set. <a href="#" data-settings>Set it</a> to see the clock change for this port.</div>`;
  } else {
    const d = off - settings.ship;
    ship.innerHTML = `<h3>Ship's clock</h3>
      <div class="big">${d === 0 ? 'No change' : `${d > 0 ? 'Advance' : 'Retard'} ${formatSpan(d)}`}</div>
      <div class="note">Ship ${shipClock(settings.ship, now)} · ${formatOffset(settings.ship)}</div>`;
  }

  const homeOff = offsetMinutes(settings.homeTz, now);
  const d = off - homeOff;
  $('#c-home').innerHTML = `<h3>${esc(settings.homeName)}</h3>
    <div class="big">${clock(settings.homeTz, now, true)}</div>
    <div class="note">${d === 0 ? 'Same time as port' : `Port is ${formatSpan(d)} ${d > 0 ? 'ahead' : 'behind'}`}</div>`;

  // Only once a minute is enough for the slower cards.
  if (now.getSeconds() === 0 || !$('#c-sun').innerHTML) {
    const change = nextClockChange(p.tz, now, 60);
    const c = $('#c-change');
    c.hidden = !change;
    if (change) {
      const delta = change.to - change.from;
      c.innerHTML = `<h3>Clocks change</h3><div class="big">${new Intl.DateTimeFormat('en-GB', { timeZone: p.tz, weekday: 'short', day: 'numeric', month: 'short' }).format(change.at)}</div>
        <div class="warn">Local clocks go ${delta > 0 ? 'forward' : 'back'} ${formatSpan(delta)} to ${formatOffset(change.to)}</div>`;
    }
    const s = sun(p.lat, p.lon, now);
    $('#c-sun').innerHTML = s.polar
      ? `<h3>Sun</h3><div class="big">${s.polar === 'day' ? 'Midnight sun' : 'Polar night'}</div>`
      : `<h3>Sunrise · Sunset (local)</h3><div class="big">${clock(p.tz, s.rise)} · ${clock(p.tz, s.set)}</div>`;
  }
}

async function loadTide(p) {
  let t;
  try {
    t = await tideAt(p.lat, p.lon);
  } catch {
    if (current === p) $('#c-tide').innerHTML = '<h3>Tide</h3><div class="note">Needs a connection the first time; then kept for this port.</div>';
    return;
  }
  if (current !== p) return;
  const now = Date.now();
  const from = now - 6 * 3600000, to = now + 42 * 3600000;
  const idx = t.times.map((x, i) => i).filter((i) => t.times[i] >= from && t.times[i] <= to && t.h[i] != null);
  if (idx.length < 6) { $('#c-tide').innerHTML = '<h3>Tide</h3><div class="note">No tide model for this spot.</div>'; return; }
  const hs = idx.map((i) => t.h[i]);
  const lo = Math.min(...hs), hi = Math.max(...hs);
  const W = 320, H = 90, x = (tt) => ((tt - from) / (to - from)) * W, y = (v) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12);
  const path = idx.map((i, n) => `${n ? 'L' : 'M'}${x(t.times[i]).toFixed(1)},${y(t.h[i]).toFixed(1)}`).join('');
  const area = `${path}L${x(t.times[idx.at(-1)]).toFixed(1)},${H}L${x(t.times[idx[0]]).toFixed(1)},${H}Z`;
  const turns = turningPoints(t).filter((q) => q.t >= now - 3600000).slice(0, 6);
  const local = (tt) => new Intl.DateTimeFormat('en-GB', { timeZone: p.tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(tt);
  $('#c-tide').innerHTML = `<h3>Tide (model)</h3>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path class="curve" d="${area}"/>
      <line class="now" x1="${x(now)}" x2="${x(now)}" y1="0" y2="${H}"/>
    </svg>
    <ul>${turns.map((q) => `<li><b>${q.high ? 'HW' : 'LW'}</b> ${local(q.t)}  ${q.v >= 0 ? '+' : '−'}${Math.abs(q.v).toFixed(1)} m</li>`).join('')}</ul>
    <div class="note">Open-Meteo sea level (tide and surge) relative to mean sea level, local time${t.stale ? ', saved earlier' : ''}. Not the official tide tables: check the port's tables before relying on depths.</div>`;
}

function renderEta(p) {
  const out = $('#eta-out');
  const v = $('#eta').value;
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) { out.innerHTML = ''; return; }
  const at = zonedToUtc(p.tz, +m[1], +m[2], +m[3], +m[4], +m[5]);
  const rows = [['UTC', shipClock(0, at, true)]];
  if (settings.ship != null) rows.push(['Ship', shipClock(settings.ship, at, true)]);
  rows.push([settings.homeName, clock(settings.homeTz, at, true)]);
  const hours = (at - Date.now()) / 3600000;
  if (hours > 0) rows.push(['From now', hours < 48 ? `${formatSpan(Math.round(hours * 60))}` : `${(hours / 24).toFixed(1)} days`]);
  out.innerHTML = rows.map(([k, val]) => `<dt>${esc(k)}</dt><dd>${esc(val)}</dd>`).join('');
}

function facts(d) {
  const [size, type, use, water, alt, chan, anch, pier, oil, lng, tide, loa, draft,
    pilot, tugs, entry, medical, prov, water2, fuel, diesel, repairs, dock] = d;
  const metres = (v) => (v == null ? null : `${v} m`);
  const yn = (v) => (v == null ? null : v ? 'Yes' : 'No');
  const rows = [
    ['Also called', alt], ['Water body', water], ['Harbour type', type], ['Use', use],
    ['Channel depth', metres(chan)], ['Anchorage depth', metres(anch)], ['Cargo pier depth', metres(pier)],
    ['Oil terminal depth', metres(oil)], ['LNG terminal depth', metres(lng)], ['Tidal range', metres(tide)],
    ['Max length', metres(loa)], ['Max draft', metres(draft)],
    ['Pilotage compulsory', yn(pilot)], ['Tugs', yn(tugs)], ['First port of entry', yn(entry)],
    ['Medical', yn(medical)], ['Provisions', yn(prov)], ['Fresh water', yn(water2)],
    ['Fuel oil', yn(fuel)], ['Diesel', yn(diesel)], ['Repairs', repairs], ['Dry dock', dock],
  ].filter(([, v]) => v != null && v !== '');
  if (!rows.length) return '';
  return `<div class="card"><h3>Port particulars</h3><table class="facts">${
    rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>`;
}

// ------------------------------------------------------------------ settings
const dialog = $('#settings');
const tzSelect = $('#home-tz');
const shipSelect = $('#ship-offset');

const zones = (() => {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return [...new Set(ports.map((p) => p.tz))].sort(); }
})();
if (!zones.includes(settings.homeTz)) zones.unshift(settings.homeTz);
tzSelect.innerHTML = zones.map((z) => `<option value="${esc(z)}">${esc(z.replace(/_/g, ' '))} (${formatOffset(offsetMinutes(z))})</option>`).join('');

const shipOptions = ['<option value="">Not set</option>'];
for (let m = -12 * 60; m <= 14 * 60; m += 30) shipOptions.push(`<option value="${m}">${formatOffset(m)}</option>`);
shipSelect.innerHTML = shipOptions.join('');

// Save every detailed coastline square on the phone, for use at sea. The
// Android app already carries them; this is for the iPhone's saved copy.
const saveCoast = $('#save-coast');
if (!coastIndex || !('serviceWorker' in navigator) || /appassets\.androidplatform\.net/.test(location.host)) {
  saveCoast.closest('.save-coast').hidden = true;
} else {
  const keys = Object.keys(coastIndex.cells);
  const mb = (Object.values(coastIndex.cells).reduce((a, b) => a + b, 0) / 1e6).toFixed(0);
  saveCoast.textContent = `Save all harbour coastlines (${mb} MB)`;
  saveCoast.onclick = async () => {
    saveCoast.disabled = true;
    let done = 0, failed = 0;
    const next = async () => {
      while (keys.length) {
        const k = keys.shift();
        try { const r = await fetch(coastUrl(k)); if (!r.ok) failed++; await r.arrayBuffer(); } catch { failed++; }
        done++;
        if (done % 20 === 0) saveCoast.textContent = `Saving… ${done} / ${done + keys.length}`;
      }
    };
    await Promise.all([next(), next(), next(), next()]);
    saveCoast.textContent = failed ? `Saved ${done - failed}; ${failed} failed — try again with a connection` : 'All harbour coastlines saved';
    saveCoast.disabled = failed === 0;
  };
}

// Save the whole world's coastline file on the phone (iPhone; Android has it).
// Read in pieces of 4 MB, each tried again if the signal drops, so it works
// over mobile data as well as Wi-Fi; the pieces are joined and kept whole.
async function saveWorldFile(report) {
  const cache = await caches.open((await caches.keys()).find((k) => k.startsWith('wm-world')) || 'wm-world-dev');
  if (await cache.match(WORLD_LAND)) return true;
  const head = await fetch(WORLD_LAND, { headers: { Range: 'bytes=0-0' } });
  const total = +(head.headers.get('Content-Range') || '').split('/')[1];
  if (!total) throw new Error('size unknown');
  // Each finished piece is kept, so after a lost signal it carries on.
  const STEP = 4 << 20;
  const parts = [];
  for (let from = 0, i = 0; from < total; from += STEP, i++) {
    const to = Math.min(from + STEP, total) - 1;
    const key = `${WORLD_LAND}?piece=${i}&of=${total}`;
    const kept = await cache.match(key);
    if (kept) { parts.push(await kept.blob()); continue; }
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await fetch(WORLD_LAND, { headers: { Range: `bytes=${from}-${to}` }, cache: 'no-store' });
        if (r.status !== 206) throw new Error(`HTTP ${r.status}`);
        const blob = await r.blob();
        await cache.put(key, new Response(blob));
        parts.push(blob);
        break;
      } catch (e) {
        if (attempt >= 8) throw e;
        report(`Signal lost — retrying (${Math.round(from / 1e6)} of ${Math.round(total / 1e6)} MB)`);
        await new Promise((ok) => setTimeout(ok, 3000 * (attempt + 1)));
      }
    }
    report(`${Math.round((to + 1) / 1e6)} of ${Math.round(total / 1e6)} MB`, (to + 1) / total);
  }
  await cache.put(WORLD_LAND, new Response(new Blob(parts), {
    headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(total) },
  }));
  for (const req of await cache.keys()) if (req.url.includes('?piece=')) await cache.delete(req);
  return true;
}

// Every harbour coastline square; those already kept come from the phone.
async function saveHarbours(report) {
  const keys = Object.keys(coastIndex?.cells || {});
  const totalMb = Object.values(coastIndex?.cells || {}).reduce((a, b) => a + b, 0) / 1e6;
  let done = 0, failed = 0;
  const queue = [...keys];
  const next = async () => {
    while (queue.length) {
      const k = queue.shift();
      let ok = false;
      for (let attempt = 0; attempt < 4 && !ok; attempt++) {
        try { const r = await fetch(coastUrl(k)); await r.arrayBuffer(); ok = r.ok; } catch { await new Promise((w) => setTimeout(w, 2000 * (attempt + 1))); }
      }
      if (!ok) failed++;
      done++;
      if (done % 10 === 0) report(`${done} of ${keys.length} harbour areas (${Math.round(totalMb * done / keys.length)} of ${Math.round(totalMb)} MB)`, done / keys.length);
    }
  };
  await Promise.all([next(), next(), next(), next()]);
  return failed;
}

(async () => {
  const btn = $('#save-world');
  const all = $('#save-all');
  if (!('serviceWorker' in navigator) || /appassets\.androidplatform\.net/.test(location.host)) return;
  const world = await worldReady;
  let worldMb = 0;
  if (world) {
    try {
      const r = await fetch(WORLD_LAND, { headers: { Range: 'bytes=0-0' } });
      worldMb = Math.round(+(r.headers.get('Content-Range') || '').split('/')[1] / 1e6) || 0;
    } catch { /* size unknown */ }
    btn.textContent = `Save the whole world's coastline${worldMb ? ` (${worldMb} MB)` : ''}`;
    btn.hidden = false;
    $('#save-world-hint').hidden = false;
  }
  const harbourMb = Math.round(Object.values(coastIndex?.cells || {}).reduce((a, b) => a + b, 0) / 1e6);
  all.textContent = `Download everything for use at sea (about ${worldMb + harbourMb} MB)`;
  all.hidden = false;
  $('#save-all-hint').hidden = false;

  // Ask the phone to keep it (not clear it when space runs low).
  const keep = () => navigator.storage?.persist?.().catch(() => {});

  btn.onclick = async () => {
    btn.disabled = true;
    keep();
    try {
      await saveWorldFile((t) => { btn.textContent = `Saving… ${t}`; });
      btn.textContent = 'World coastline saved';
    } catch {
      btn.textContent = 'Stopped; tap to carry on when there is a signal';
      btn.disabled = false;
    }
  };

  all.onclick = async () => {
    if (!confirm(`This downloads about ${worldMb + harbourMb} MB, on mobile data if you are not on Wi-Fi. Keep the app open until it says done. Go ahead?`)) return;
    all.disabled = true;
    keep();
    const say = (t) => { all.textContent = t; };
    let ok = true;
    if (world) {
      try { await saveWorldFile((t) => say(`1/2 World coastline: ${t}`)); } catch { ok = false; }
    }
    const failed = await saveHarbours((t) => say(`2/2 Harbours: ${t}`));
    if (failed) ok = false;
    // The data files the app reads (TSS, zones, ports, rates…) are kept by
    // the app itself; refresh them too.
    try { (await navigator.serviceWorker.getRegistration())?.update(); } catch { /* fine */ }
    say(ok ? 'Everything saved for use at sea' : 'Some parts did not download; tap to carry on (what is saved is kept)');
    all.disabled = ok;
    if (ok) btn.textContent = 'World coastline saved';
  };
})();

// Save the area on screen for use at sea: OpenStreetMap's detailed water,
// docks, rivers and numbered roads, zoom 6 to 12 (shown magnified beyond).
function tileRange(b, z) {
  const n = 2 ** z;
  const tx = (lon) => Math.min(n - 1, Math.max(0, Math.floor((lon + 180) / 360 * n)));
  const ty = (lat) => {
    const r = Math.max(-85, Math.min(85, lat)) * Math.PI / 180;
    return Math.min(n - 1, Math.max(0, Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)));
  };
  return [tx(b.getWest()), tx(b.getEast()), ty(b.getNorth()), ty(b.getSouth())];
}
const AREA_LIMIT = 40000;
async function saveArea(button) {
  if (!hasCaches || !ofmTemplate) { alert('Saving areas needs a connection the first time the app is opened.'); return; }
  const b = map.getBounds();
  const tiles = [];
  const level = (z) => {
    const out = [];
    const [x0, x1, y0, y1] = tileRange(b, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push([z, x, y]);
    return out;
  };
  for (let z = 6; z <= OFM_MAX; z++) tiles.push(...level(z));
  // City detail (buildings, every street, stations) when the area is small
  // enough: zoom 13 and 14.
  let detail = true;
  for (const z of [13, 14]) {
    const more = level(z);
    if (tiles.length + more.length > AREA_LIMIT) { detail = false; break; }
    tiles.push(...more);
  }
  if (tiles.length > AREA_LIMIT) {
    alert(`This area is too large to save in detail (${tiles.length.toLocaleString()} pieces). Zoom in a little and save it in parts.`);
    return;
  }
  const mb = Math.max(1, Math.round(tiles.length * 0.03));
  const what = detail ? 'the full city detail: every street, railways, metro and stations, buildings, parks and places' : 'detailed rivers, docks and main roads (zoom in further to save the full city detail too)';
  if (!confirm(`Save this area for use at sea: ${what}. About ${mb} MB (${tiles.length.toLocaleString()} pieces), on mobile data or Wi-Fi. Keep the app open until it says done.`)) return;
  const r = await saveTiles(tiles.map((t) => ['ofm', ...t]), button, 'Saving area…');
  button.textContent = r.failed ? `Saved, but ${r.failed} pieces failed — tap to try again` : 'Area saved for use at sea ✓';
  if (!r.failed) setTimeout(() => { button.textContent = 'Save this area for use at sea'; }, 6000);
}
// Fetch and keep map pieces ([kind, z, x, y], kind 'ofm' or 'dem'), six at a
// time with retries. With fresh, every piece is fetched again (an update);
// otherwise pieces already kept are skipped.
async function saveTiles(tiles, button, label, fresh = false) {
  navigator.storage?.persist?.().catch(() => {});
  const old = button.textContent;
  button.disabled = true;
  const cache = await caches.open(OFM_SAVED);
  let done = 0, failed = 0, bytes = 0;
  const queue = [...tiles];
  const worker = async () => {
    while (queue.length) {
      const [kind, z, x, y] = queue.shift();
      const key = kind === 'dem' ? demKey(z, x, y) : ofmKey(z, x, y);
      let ok = !fresh && !!(await cache.match(key));
      for (let attempt = 0; !ok && attempt < 4; attempt++) {
        try {
          const data = await (kind === 'dem' ? demFetch : ofmFetch)(z, x, y);
          await cache.put(key, new Response(data));
          if (fresh) caches.open(OFM_SEEN).then((c) => c.delete(key)).catch(() => {});
          bytes += data.byteLength;
          ok = true;
        } catch { await new Promise((w) => setTimeout(w, 1500 * (attempt + 1))); }
      }
      if (!ok) failed++;
      done++;
      if (done % 10 === 0 || !queue.length) button.textContent = `${label} ${done.toLocaleString()} / ${tiles.length.toLocaleString()} (${Math.round(bytes / 1e6)} MB)`;
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  button.disabled = false;
  button.textContent = old;
  showSavedAreas();
  return { failed, bytes };
}

// Whole cities, saved or brought up to date in one go: every street,
// railway, metro line, building and place, and the hills, zoom 6 to 14.
const CITY_PACKS = [
  { name: 'Mumbai', west: 72.75, south: 18.85, east: 73.25, north: 19.45 },
];
const packTiles = (c) => {
  const b = { getWest: () => c.west, getEast: () => c.east, getNorth: () => c.north, getSouth: () => c.south };
  const out = [];
  for (let z = 6; z <= 14; z++) {
    const [x0, x1, y0, y1] = tileRange(b, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      out.push(['ofm', z, x, y]);
      if (z <= 13) out.push(['dem', z, x, y]);
    }
  }
  return out;
};
const packDate = (c) => { try { return localStorage.getItem(`wm.city.${c.name}`); } catch { return null; } };
function showCityPacks() {
  for (const c of CITY_PACKS) {
    const when = packDate(c);
    for (const b of document.querySelectorAll(`[data-city="${c.name}"]`)) {
      b.textContent = when ? `Update ${c.name} map (saved ${new Date(when).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })})` : `Download ${c.name} map for use at sea`;
    }
  }
}
async function saveCity(c, button) {
  if (!hasCaches || !ofmTemplate) { alert('Downloading a city needs a connection.'); return; }
  const tiles = packTiles(c);
  const update = !!packDate(c);
  const mb = Math.round(tiles.length * 0.06);
  if (!confirm(`${update ? 'Update' : 'Download'} the whole ${c.name} map: every street with names, railways, metro and stations, buildings (3D), parks, places and the hills. About ${mb} MB (${tiles.length.toLocaleString()} pieces), on mobile data or Wi-Fi.${update ? ' Every piece is fetched again, so it has the latest changes.' : ''} Keep the app open until it says done.`)) return;
  const r = await saveTiles(tiles, button, `${update ? 'Updating' : 'Saving'} ${c.name}…`, true);
  // The app's own data (places to go, photos list) comes with app updates.
  try { (await navigator.serviceWorker?.getRegistration())?.update(); } catch { /* fine */ }
  if (r.failed) {
    button.textContent = `${r.failed} pieces failed — tap to try again`;
    return;
  }
  try { localStorage.setItem(`wm.city.${c.name}`, new Date().toISOString()); } catch { /* full */ }
  button.textContent = `${c.name} saved ✓ (${Math.round(r.bytes / 1e6)} MB)`;
  setTimeout(showCityPacks, 6000);
}
// The seafloor shading for the whole world: terrain pieces, zoom 0 to 5.
$('#save-seafloor').onclick = async (e) => {
  const button = e.currentTarget;
  if (!hasCaches) { alert('Saving needs a connection the first time the app is opened.'); return; }
  const tiles = [];
  for (let z = 0; z <= 5; z++) for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) tiles.push(['dem', z, x, y]);
  if (!confirm(`Save the seafloor shading for the whole world: ${tiles.length.toLocaleString()} pieces, roughly 80 MB, on mobile data or Wi-Fi. Keep the app open until it says done.`)) return;
  const r = await saveTiles(tiles, button, 'Saving the seafloor…');
  button.textContent = r.failed ? `${r.failed} pieces failed — tap to try again` : `Seafloor saved ✓ (${Math.round(r.bytes / 1e6)} MB)`;
};
for (const b of document.querySelectorAll('[data-city]')) {
  const c = CITY_PACKS.find((p) => p.name === b.dataset.city);
  if (c) b.onclick = () => saveCity(c, b);
}
showCityPacks();
async function showSavedAreas() {
  const el = $('#saved-areas');
  if (!el || !hasCaches) return;
  try {
    const n = (await (await caches.open(OFM_SAVED)).keys()).length;
    el.hidden = n === 0;
    $('#saved-areas-text').textContent = `Saved areas: ${n.toLocaleString()} map pieces kept for use at sea.`;
  } catch { /* fine */ }
}
$('#save-area').onclick = (e) => saveArea(e.currentTarget);
$('#clear-areas').onclick = async () => {
  if (!confirm('Delete all saved areas? The rest of the map is not affected.')) return;
  await caches.delete(OFM_SAVED);
  showSavedAreas();
};
showSavedAreas();

function openSettings() {
  tzSelect.value = settings.homeTz;
  $('#home-name').value = settings.homeName === 'Home' ? '' : settings.homeName;
  shipSelect.value = settings.ship == null ? '' : String(settings.ship);
  dialog.showModal();
}
$('#settings-btn').onclick = openSettings;
body.addEventListener('click', (e) => {
  if (e.target.closest('[data-settings]')) { e.preventDefault(); openSettings(); }
  const gb = e.target.closest('[data-gas]');
  if (gb) {
    const t = terminals[+gb.dataset.gas];
    showTerminal(t);
    map.flyTo({ center: [t.lon, t.lat], zoom: Math.max(map.getZoom(), 12), padding: clearOfPanel() });
  }
  const pp = e.target.closest('[data-port]');
  if (pp) choose(ports[+pp.dataset.port]);
  const cb = e.target.closest('[data-country]');
  if (cb) openCountry(cb.dataset.country);
});
dialog.addEventListener('close', () => {
  settings.homeTz = tzSelect.value || deviceZone;
  settings.homeName = $('#home-name').value.trim() || 'Home';
  settings.ship = shipSelect.value === '' ? null : +shipSelect.value;
  store.set('homeTz', settings.homeTz);
  store.set('homeName', settings.homeName);
  store.set('ship', settings.ship);
  if (current) { tick(); renderEta(current); }
});

// ------------------------------------------------------------------- offline
if ('serviceWorker' in navigator && location.protocol === 'https:' && !/appassets\.androidplatform\.net/.test(location.host)) {
  // An iPhone home-screen app resumes rather than reloads, so look for a new
  // version at start and whenever it comes back to the front, and reload
  // once the new one has taken over (only if an older one was in charge).
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60000);
  }).catch(() => {});
}

// The version in use, shown in Settings (the name of the app's own cache).
(async () => {
  const keep = ['wm-seamarks', 'wm-coast', 'wm-ofm', 'wm-world', 'wm-ofm-seen', 'wm-ofm-saved'];
  try {
    const name = (await caches.keys()).find((k) => k.startsWith('wm-') && !keep.includes(k) && !k.startsWith('wm-world'));
    if (name && !window.WorldMapApp) $('#app-version').textContent = `Version ${name.slice(3)}`;
  } catch { /* no caches here */ }
})();
