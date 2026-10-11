import { COUNTRIES, countryName, currencyName, currencySymbol, flag } from './countries.js';
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
// Pilot boarding places from OpenSeaMap, fetched by a job on GitHub. The app
// works without them; the file may be empty until that job has run.
const pilotRows = await fetch('data/pilots.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
const pilots = pilotRows.map(([lon, lat, name, category, channel, info], i) => ({ i, lon, lat, name, category, channel, info }));
const pilotFeatures = {
  type: 'FeatureCollection',
  features: pilots.map((b) => ({
    type: 'Feature', geometry: { type: 'Point', coordinates: [b.lon, b.lat] },
    properties: { i: b.i, label: b.name ? `Pilot · ${b.name}` : 'Pilot' },
  })),
};

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

const style = {
  version: 8,
  glyphs: `${here}fonts/{fontstack}/{range}.pbf`,
  sources: {
    countries: { type: 'geojson', data: countries, tolerance: 0.2, maxzoom: 12 },
    borders: { type: 'geojson', data: borders, tolerance: 0.2, maxzoom: 12 },
    labels: { type: 'geojson', data: labels },
    rivers: { type: 'geojson', data: rivers, tolerance: 0.2, maxzoom: 12 },
    riverNames: { type: 'geojson', data: riverNames, maxzoom: 10 },
    lakes: { type: 'geojson', data: lakes, tolerance: 0.2, maxzoom: 12 },
    grid: { type: 'geojson', data: graticule() },
    ports: { type: 'geojson', data: portFeatures, maxzoom: 12, buffer: 64 },
    pilots: { type: 'geojson', data: pilotFeatures },
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
    // Pilot boarding places: magenta, as on the chart.
    {
      id: 'pilots', type: 'circle', source: 'pilots', minzoom: 4,
      paint: {
        'circle-color': '#b0187a', 'circle-radius': zoomed([[4, 4], [10, 8]]),
        'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5,
      },
    },
    {
      id: 'pilot-p', type: 'symbol', source: 'pilots', minzoom: 6,
      layout: {
        'text-field': 'P', 'text-font': ['OpenSans-Bold'], 'text-size': zoomed([[6, 8], [10, 11]]),
        'text-allow-overlap': true, 'text-ignore-placement': true,
      },
      paint: { 'text-color': '#ffffff' },
    },
    {
      id: 'pilot-names', type: 'symbol', source: 'pilots', minzoom: 8,
      layout: {
        'text-field': ['get', 'label'], 'text-font': ['OpenSans-Semibold'], 'text-size': 11,
        'text-anchor': 'top', 'text-offset': [0, 0.9], 'text-max-width': 10,
      },
      paint: { 'text-color': '#8e1062', ...halo },
    },
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
  maxZoom: 12,
  attributionControl: false,
  dragRotate: false,
  pitchWithRotate: false,
  touchPitch: false,
  renderWorldCopies: true,
  fadeDuration: 150,
});
map.touchZoomRotate.disableRotation();
map.addControl(new maplibregl.AttributionControl({
  compact: true,
  customAttribution: 'Natural Earth · NGA World Port Index · UN/LOCODE',
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
map.on('click', (e) => {
  const pad = 12;
  const box = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
  const pilotHit = map.queryRenderedFeatures(box, { layers: ['pilots'] })[0];
  const hits = map.queryRenderedFeatures(box, { layers: PORT_LAYERS });
  if (pilotHit && (!hits.length || map.getZoom() >= 8)) {
    showPilot(pilots[pilotHit.properties.i]);
  } else if (hits.length) {
    const best = hits
      .map((f) => ports[f.properties.i])
      .sort((a, b) => dist2(e, a) - dist2(e, b))[0];
    showPort(best);
  } else {
    const land = map.queryRenderedFeatures(e.point, { layers: ['land'] })[0];
    if (land) showCountry(land.properties, e.lngLat);
    else closePanel();
  }
});
const dist2 = (e, p) => {
  const q = map.project([p.lon, p.lat]);
  return (q.x - e.point.x) ** 2 + (q.y - e.point.y) ** 2;
};
for (const layer of [...PORT_LAYERS, 'pilots']) {
  map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
}

$('#world').onclick = () => map.flyTo({ center: [70, 15], zoom: 1.6 });

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
  return scored.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name)).slice(0, 60).map((x) => x[1]);
}

function renderResults() {
  if (!q.value.trim()) { results.hidden = true; return; }
  results.hidden = false;
  results.innerHTML = found.length
    ? found.map((p, n) => `<li role="option" data-n="${n}" aria-selected="${n === cursor}">
        <span class="name">${flag(p.cc)} ${esc(p.name)}</span>
        <span class="meta">${esc(p.locode || countryName(p.cc))}</span></li>`).join('')
    : '<li class="none">No port by that name</li>';
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

function showCountry(props, lngLat) {
  clearInterval(ticker);
  current = null;
  map.getSource('picked').setData({ type: 'FeatureCollection', features: [] });
  const cc = props.iso && props.iso !== '-99' ? props.iso : null;
  const count = cc ? ports.filter((p) => p.cc === cc).length : 0;
  const money = cc && COUNTRIES[cc];
  openPanel(`
    <h1>${cc ? flag(cc) : ''} ${esc(props.name)}</h1>
    <p class="sub">${position(lngLat.lat, ((lngLat.lng + 540) % 360) - 180)}</p>
    <div class="cards">
      ${money ? moneyCards(money) : ''}
      <div class="card"><h3>Ports</h3><div class="big">${count.toLocaleString('en')}</div>
        <div class="note">Zoom in to see them all; tap one for its local time and particulars.</div></div>
    </div>`);
}

function moneyCards([code, dial]) {
  const sym = currencySymbol(code);
  return `<div class="two">
    <div class="card"><h3>Currency</h3><div class="big">${esc(code)}${sym ? ` · ${esc(sym)}` : ''}</div><div class="note">${esc(currencyName(code))}</div></div>
    <div class="card"><h3>Dialling code</h3><div class="big">+${esc(dial)}</div><div class="note">From abroad</div></div>
  </div>`;
}

function showPort(p) {
  current = p;
  map.getSource('picked').setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: {} });
  const money = COUNTRIES[p.cc];
  const chips = [RANK_NAMES[p.rank], p.locode].filter(Boolean);
  openPanel(`
    <h1>${esc(p.name)}</h1>
    <p class="sub">${flag(p.cc)} ${esc(countryName(p.cc))} · ${position(p.lat, p.lon)}</p>
    <div class="chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
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
      ${pilotCard(p)}
      <div id="c-facts"></div>
    </div>
    <p class="source">${p.detail >= 0 ? 'NGA World Port Index' : 'UN/LOCODE'} · ${esc(p.tz)} · Not for navigation.</p>`);

  const eta = $('#eta');
  eta.value = store.get(`eta.${p.locode || p.i}`, '');
  eta.addEventListener('input', () => { store.set(`eta.${p.locode || p.i}`, eta.value); renderEta(p); });

  tick();
  clearInterval(ticker);
  ticker = setInterval(tick, 1000);
  renderEta(p);
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
  const brg = ((Math.atan2(y, x) / r) + 360) % 360;
  return { nm, brg };
}

function pilotsNear(p, maxNm = 40, max = 4) {
  return pilots
    .filter((b) => Math.abs(b.lat - p.lat) < 1 && Math.abs(((b.lon - p.lon + 540) % 360) - 180) < 1.5)
    .map((b) => ({ b, ...legFrom(p, b) }))
    .filter((x) => x.nm <= maxNm)
    .sort((a, z) => a.nm - z.nm)
    .slice(0, max);
}

function pilotCard(p) {
  if (!pilots.length) {
    return `<div class="card"><h3>Pilot boarding</h3><div class="note">Pilot boarding places have not been downloaded yet.</div></div>`;
  }
  const near = pilotsNear(p);
  if (!near.length) {
    return `<div class="card"><h3>Pilot boarding</h3><div class="note">None mapped within 40 nm in OpenSeaMap. Check ALRS Vol. 6 or the agent.</div></div>`;
  }
  return `<div class="card"><h3>Pilot boarding</h3><ul class="pilots">${near.map(({ b, nm, brg }) => `
    <li><button type="button" data-pilot="${b.i}">
      <span class="pos">${position(b.lat, b.lon)}</span>
      <span class="note">${nm.toFixed(1)} nm ${String(Math.round(brg) % 360).padStart(3, '0')}° from the port${b.name ? ` · ${esc(b.name)}` : ''}${b.channel ? ` · VHF ${esc(b.channel)}` : ''}</span>
    </button></li>`).join('')}</ul>
    <div class="note">OpenSeaMap; check ALRS Vol. 6 before relying on it.</div></div>`;
}

function showPilot(b) {
  clearInterval(ticker);
  current = null;
  map.getSource('picked').setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.lon, b.lat] }, properties: {} });
  const nearest = ports
    .filter((p) => Math.abs(p.lat - b.lat) < 1 && Math.abs(p.lon - b.lon) < 1.5)
    .map((p) => ({ p, ...legFrom(b, p) }))
    .sort((a, z) => a.nm - z.nm)[0];
  const rows = [
    ['Position', position(b.lat, b.lon)], ['Name', b.name], ['Category', b.category],
    ['VHF', b.channel], ['Information', b.info],
    ['Nearest port', nearest ? `${nearest.p.name} · ${nearest.nm.toFixed(1)} nm` : ''],
  ].filter(([, v]) => v);
  openPanel(`
    <h1>Pilot boarding</h1>
    <p class="sub">${esc(b.name || 'OpenSeaMap pilot boarding place')}</p>
    <div class="cards"><div class="card"><table class="facts">${
      rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table></div>
      ${nearest ? `<button type="button" class="card linkish" data-port="${nearest.p.i}">Open ${esc(nearest.p.name)} →</button>` : ''}
    </div>
    <p class="source">© OpenStreetMap contributors (OpenSeaMap), ODbL. Not for navigation; check ALRS Vol. 6.</p>`);
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

function openSettings() {
  tzSelect.value = settings.homeTz;
  $('#home-name').value = settings.homeName === 'Home' ? '' : settings.homeName;
  shipSelect.value = settings.ship == null ? '' : String(settings.ship);
  dialog.showModal();
}
$('#settings-btn').onclick = openSettings;
body.addEventListener('click', (e) => {
  if (e.target.closest('[data-settings]')) { e.preventDefault(); openSettings(); }
  const pb = e.target.closest('[data-pilot]');
  if (pb) {
    const b = pilots[+pb.dataset.pilot];
    showPilot(b);
    map.flyTo({ center: [b.lon, b.lat], zoom: Math.max(map.getZoom(), 10), padding: clearOfPanel() });
  }
  const pp = e.target.closest('[data-port]');
  if (pp) choose(ports[+pp.dataset.port]);
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
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
