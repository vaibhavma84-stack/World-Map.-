// Map extras, all working offline:
//   * night mode: a dark map, or red to keep night vision on the bridge,
//     or dark by itself from sunset to sunrise where the ship is;
//   * day and night on the map: the night side and the three twilights,
//     moving in real time;
//   * time zones at sea: the nautical zones (±1 … ±12) and the date line;
//   * a measuring tool: great-circle and rhumb-line distance and course;
//   * share or save the view as a picture.

const RAD = Math.PI / 180;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ----------------------------------------------------------------- the Sun
// Where the Sun is overhead (good to a few minutes of arc, plenty for the
// shading).
export function subsolar(date = new Date()) {
  const d = date.getTime() / 86400000 - 10957.5; // days from J2000.0
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / RAD;
  const dec = Math.asin(Math.sin(e) * Math.sin(L)) / RAD;
  const gmst = (280.46061837 + 360.98564736629 * d) % 360;
  return { lat: dec, lon: ((ra - gmst + 540) % 360 + 360) % 360 - 180 };
}
export function sunAltitude(lat, lon, date = new Date()) {
  const s = subsolar(date);
  const H = (lon - s.lon) * RAD;
  return Math.asin(Math.sin(lat * RAD) * Math.sin(s.lat * RAD) + Math.cos(lat * RAD) * Math.cos(s.lat * RAD) * Math.cos(H)) / RAD;
}

// The part of the world where the Sun is below `h0` degrees.
function darkPolygon(h0, date) {
  const s = subsolar(date);
  const sd = Math.sin(s.lat * RAD), cd = Math.cos(s.lat * RAD);
  const pole = s.lat >= 0 ? -90 : 90; // the pole in the dark
  const ring = [];
  for (let lon = -180; lon <= 180; lon += 2) {
    const a = sd, b = cd * Math.cos((lon - s.lon) * RAD);
    const R = Math.hypot(a, b);
    const x = Math.sin(h0 * RAD) / R;
    let lat;
    if (x >= 1) lat = -pole; // the Sun never that high on this meridian: all dark
    else if (x <= -1) lat = pole; // never that low: none dark
    else {
      const al = Math.atan2(b, a), t = Math.asin(x);
      const f1 = (t - al) / RAD, f2 = (Math.PI - t - al) / RAD;
      lat = Math.abs(f1) <= 90 ? f1 : f2 > 180 ? f2 - 360 : f2 < -180 ? f2 + 360 : f2;
    }
    ring.push([lon, Math.max(-85, Math.min(85, lat))]);
  }
  ring.push([180, pole > 0 ? 85 : -85], [-180, pole > 0 ? 85 : -85], ring[0]);
  return { type: 'Feature', properties: { h: h0 }, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export function addDayNight(map, before) {
  const data = () => ({ type: 'FeatureCollection', features: [0, -6, -12, -18].map((h) => darkPolygon(h, new Date())) });
  map.addSource('daynight', { type: 'geojson', data: data() });
  map.addLayer({
    id: 'daynight', type: 'fill', source: 'daynight',
    paint: { 'fill-color': '#0b1a3a', 'fill-opacity': 0.1, 'fill-antialias': false },
  }, before);
  const sun = subsolar();
  map.addSource('sunpoint', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [sun.lon, sun.lat] } } });
  map.addLayer({
    id: 'sunpoint', type: 'symbol', source: 'sunpoint',
    layout: { 'text-field': '☀', 'text-size': 22, 'text-allow-overlap': true, 'text-font': ['OpenSans-Regular'] },
    paint: { 'text-color': '#f6ad1b', 'text-halo-color': '#fff', 'text-halo-width': 1 },
  });
  setInterval(() => {
    if (document.hidden) return;
    map.getSource('daynight')?.setData(data());
    const p = subsolar();
    map.getSource('sunpoint')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } });
  }, 60000);
}

// ------------------------------------------------------- time zones at sea
// Nautical zones are 15° wide, centred on the meridians every 15°: zone −5
// keeps UTC+5 between 67½°E and 82½°E. The date line as drawn is
// approximate, kept clear of island groups as they keep their dates.
const DATE_LINE = [[180, 85], [180, 75], [191, 68.25], [191, 65.5], [170, 52.5], [180, 47.5], [180, 5], [210, 5], [210, -11],
  [189, -11], [189, -15], [187.5, -15], [187.5, -45], [180, -51.2], [180, -85]];
export function addSeaZones(map, before) {
  const features = [];
  for (let k = -12; k <= 12; k++) {
    if (k !== 12) {
      const lon = k * 15 + 7.5;
      if (lon < 180) features.push({ type: 'Feature', properties: { kind: 'edge' }, geometry: { type: 'LineString', coordinates: [[lon, -85], [lon, 85]] } });
    }
    const centre = k * 15;
    const zone = -k; // east longitude keeps a minus zone
    const label = zone === 0 ? 'Zone 0 (UTC)' : `Zone ${zone > 0 ? '+' : '-'}${Math.abs(zone)} (UTC${zone > 0 ? '-' : '+'}${Math.abs(zone)})`; // plain hyphens: the map's fonts have no minus sign
    for (const lat of [55, 20, -25, -55]) {
      if (Math.abs(centre) === 180) continue;
      features.push({ type: 'Feature', properties: { kind: 'label', n: label }, geometry: { type: 'Point', coordinates: [centre, lat] } });
    }
  }
  features.push({ type: 'Feature', properties: { kind: 'dateline', n: 'International Date Line (approximate)' }, geometry: { type: 'LineString', coordinates: DATE_LINE } });
  for (const [lon, lat] of [[180, 30], [180, -30]]) features.push({ type: 'Feature', properties: { kind: 'label', n: 'Zone ±12' }, geometry: { type: 'Point', coordinates: [lon + (lat > 0 ? -3.5 : 3.5), lat] } });
  map.addSource('seazones', { type: 'geojson', data: { type: 'FeatureCollection', features } });
  map.addLayer({
    id: 'seazones-edges', type: 'line', source: 'seazones', filter: ['==', ['get', 'kind'], 'edge'],
    paint: { 'line-color': '#7b5ea7', 'line-width': 1, 'line-dasharray': [4, 3], 'line-opacity': 0.6 },
  }, before);
  map.addLayer({
    id: 'seazones-dateline', type: 'line', source: 'seazones', filter: ['==', ['get', 'kind'], 'dateline'],
    paint: { 'line-color': '#c53030', 'line-width': 2, 'line-opacity': 0.8 },
  }, before);
  map.addLayer({
    id: 'seazones-labels', type: 'symbol', source: 'seazones', filter: ['==', ['get', 'kind'], 'label'], minzoom: 1.5,
    layout: { 'text-field': ['get', 'n'], 'text-font': ['OpenSans-Semibold'], 'text-size': 11, 'text-allow-overlap': false, 'text-padding': 30 },
    paint: { 'text-color': '#5b3f8c', 'text-halo-color': 'rgba(255,255,255,0.85)', 'text-halo-width': 1.4 },
  });
  map.addLayer({
    id: 'seazones-dateline-name', type: 'symbol', source: 'seazones', filter: ['==', ['get', 'kind'], 'dateline'], minzoom: 2,
    layout: { 'symbol-placement': 'line', 'text-field': ['get', 'n'], 'text-font': ['OpenSans-Semibold'], 'text-size': 11, 'symbol-spacing': 500 },
    paint: { 'text-color': '#c53030', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 },
  });
}
export const EXTRA_GROUPS = {
  daynight: ['daynight', 'sunpoint'],
  seazones: ['seazones-edges', 'seazones-dateline', 'seazones-labels', 'seazones-dateline-name'],
};

// --------------------------------------------------------------- night mode
// 'off', 'dark', 'red' or 'auto' (dark between sunset and sunrise at `where`).
export function setupNightMode(select, where) {
  const apply = () => {
    let mode = select.value;
    if (mode === 'auto') {
      const p = where();
      mode = p && sunAltitude(p.lat, p.lon) < -0.833 ? 'dark' : 'off';
    }
    document.documentElement.dataset.night = mode;
  };
  try { select.value = localStorage.getItem('wm.night') || 'off'; } catch { /* none */ }
  select.onchange = () => { try { localStorage.setItem('wm.night', select.value); } catch { /* full */ } apply(); };
  apply();
  setInterval(apply, 60000);
}

// ---------------------------------------------------------- measuring tool
function gc(a, b) {
  const [f1, f2, dl] = [a.lat * RAD, b.lat * RAD, (b.lon - a.lon) * RAD];
  const h = Math.sin((f2 - f1) / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  const nm = 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(h)));
  const brg = (Math.atan2(Math.sin(dl) * Math.cos(f2), Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)) / RAD + 360) % 360;
  return { nm, brg };
}
function rhumb(a, b) {
  const [f1, f2] = [a.lat * RAD, b.lat * RAD];
  let dl = (b.lon - a.lon) * RAD;
  if (Math.abs(dl) > Math.PI) dl = dl > 0 ? -(2 * Math.PI - dl) : 2 * Math.PI + dl;
  const dpsi = Math.log(Math.tan(Math.PI / 4 + f2 / 2) / Math.tan(Math.PI / 4 + f1 / 2));
  const q = Math.abs(dpsi) > 1e-12 ? (f2 - f1) / dpsi : Math.cos(f1);
  const nm = Math.hypot(f2 - f1, q * dl) * 3440.065;
  const brg = (Math.atan2(dl, dpsi) / RAD + 360) % 360;
  return { nm, brg };
}
function gcLine(a, b) {
  const d = gc(a, b).nm / 3440.065;
  if (d < 1e-7) return [[a.lon, a.lat]];
  const n = Math.max(2, Math.ceil(d / 0.01));
  const out = [];
  let prev = null;
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(a.lat * RAD) * Math.cos(a.lon * RAD) + B * Math.cos(b.lat * RAD) * Math.cos(b.lon * RAD);
    const y = A * Math.cos(a.lat * RAD) * Math.sin(a.lon * RAD) + B * Math.cos(b.lat * RAD) * Math.sin(b.lon * RAD);
    const z = A * Math.sin(a.lat * RAD) + B * Math.sin(b.lat * RAD);
    let lon = Math.atan2(y, x) / RAD;
    if (prev != null) { while (lon - prev > 180) lon -= 360; while (lon - prev < -180) lon += 360; }
    prev = lon;
    out.push([lon, Math.atan2(z, Math.hypot(x, y)) / RAD]);
  }
  return out;
}
export function setupMeasure(map, { button, openPanel, closePanel, position }) {
  let on = false;
  let pts = [];
  map.addSource('measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'measure-line', type: 'line', source: 'measure', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#d53f8c', 'line-width': 2.5, 'line-dasharray': [2, 1] } });
  map.addLayer({ id: 'measure-pts', type: 'circle', source: 'measure', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-color': '#d53f8c', 'circle-stroke-width': 2.5 } });
  map.addLayer({
    id: 'measure-labels', type: 'symbol', source: 'measure', filter: ['has', 'label'],
    layout: { 'text-field': ['get', 'label'], 'text-font': ['OpenSans-Semibold'], 'text-size': 12, 'text-offset': [0, -1.2], 'text-allow-overlap': true },
    paint: { 'text-color': '#97266d', 'text-halo-color': '#fff', 'text-halo-width': 2 },
  });
  const draw = () => {
    const features = pts.map((p, i) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, id: i }));
    for (let i = 1; i < pts.length; i++) {
      const line = gcLine(pts[i - 1], pts[i]);
      const g = gc(pts[i - 1], pts[i]);
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line } });
      features.push({ type: 'Feature', properties: { label: `${g.nm.toFixed(1)} nm · ${g.brg.toFixed(0).padStart(3, '0')}°` }, geometry: { type: 'Point', coordinates: line[Math.floor(line.length / 2)] } });
    }
    map.getSource('measure').setData({ type: 'FeatureCollection', features });
    let total = 0, totalRhumb = 0;
    const legs = [];
    for (let i = 1; i < pts.length; i++) {
      const g = gc(pts[i - 1], pts[i]), r = rhumb(pts[i - 1], pts[i]);
      total += g.nm; totalRhumb += r.nm;
      legs.push(`<tr><td>${i}</td><td>${g.nm.toFixed(1)} nm</td><td>${g.brg.toFixed(1).padStart(5, '0')}°</td><td>${r.nm.toFixed(1)} nm</td><td>${r.brg.toFixed(1).padStart(5, '0')}°</td></tr>`);
    }
    openPanel(`<h1>Measure</h1>
      <p class="sub">${pts.length ? `Tap the map to add points. From ${esc(position(pts[0].lat, pts[0].lon))}` : 'Tap the map to put the first point.'}</p>
      ${pts.length > 1 ? `<div class="cards"><div class="card"><table class="facts sky-table">
        <tr><th>Leg</th><th>Great circle</th><th>Initial course</th><th>Rhumb line</th><th>Course</th></tr>${legs.join('')}
        <tr><th>Total</th><th>${total.toFixed(1)} nm</th><th></th><th>${totalRhumb.toFixed(1)} nm</th><th></th></tr></table>
        <div class="note">Great circle: the shortest way, with the course changing along it (the initial course shown). Rhumb line: one steady course. Straight lines over land and sea alike.</div></div></div>` : ''}
      <div class="row-end"><button type="button" class="secondary" id="m-undo">Undo</button><button type="button" class="secondary" id="m-clear">Clear</button><button type="button" class="primary" id="m-done">Done</button></div>`);
    document.getElementById('m-undo').onclick = () => { pts.pop(); draw(); };
    document.getElementById('m-clear').onclick = () => { pts = []; draw(); };
    document.getElementById('m-done').onclick = () => stop();
  };
  const stop = () => {
    on = false;
    pts = [];
    map.getSource('measure').setData({ type: 'FeatureCollection', features: [] });
    button.classList.remove('active');
    map.getCanvas().style.cursor = '';
    closePanel();
  };
  button.onclick = () => {
    if (on) { stop(); return; }
    on = true;
    button.classList.add('active');
    map.getCanvas().style.cursor = 'crosshair';
    draw();
  };
  return {
    // A tap while measuring adds a point and is not a tap on the map.
    click(e) {
      if (!on) return false;
      pts.push({ lat: e.lngLat.lat, lon: ((e.lngLat.lng + 540) % 360) - 180 });
      draw();
      return true;
    },
  };
}

// ----------------------------------------------------------- share a view
export function shareView(map) {
  map.once('render', () => {
    const src = map.getCanvas();
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height + Math.round(28 * (window.devicePixelRatio || 1));
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    g.fillStyle = '#fff';
    g.fillRect(0, src.height, c.width, c.height - src.height);
    g.fillStyle = '#333';
    g.font = `${12 * dpr}px sans-serif`;
    const centre = map.getCenter();
    g.fillText(`World Map · ${centre.lat.toFixed(3)}, ${centre.lng.toFixed(3)} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC · © OpenStreetMap, Natural Earth · not for navigation`, 8 * dpr, src.height + 18 * dpr);
    const url = c.toDataURL('image/png');
    if (window.WorldMapApp?.shareImage) {
      const r = window.WorldMapApp.shareImage(url.split(',')[1]);
      if (r !== 'ok') alert('Could not save the picture on this phone.');
      return;
    }
    c.toBlob(async (blob) => {
      const file = new File([blob], `world-map-${Date.now()}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'World Map' }); return; } catch { /* cancelled */ return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }, 'image/png');
  });
  map.triggerRepaint();
}
