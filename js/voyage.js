// The ship: its position at a time, speed, and course or route; where it will
// be in 3, 6, 9, 12 and 24 hours; and the forecast at each of those places at
// those times, with how the sea will meet the ship. Kept on the phone.
// Not for navigation.
import { weatherAlong } from './weather.js';
import { zonesAt, zonesBrief } from './zones.js';

const AHEAD = [3, 6, 9, 12, 24];
const R_NM = 3440.065;
const rad = Math.PI / 180;

const store = {
  get() { try { return JSON.parse(localStorage.getItem('wm.voyage')) || null; } catch { return null; } },
  set(v) { try { localStorage.setItem('wm.voyage', JSON.stringify(v)); } catch { /* full */ } },
};

// ------------------------------------------------------------- navigation
/** Rhumb-line distance (nm) and true course from a to b. */
export function rhumb(a, b) {
  const f1 = a.lat * rad, f2 = b.lat * rad;
  let dl = (b.lon - a.lon) * rad;
  if (Math.abs(dl) > Math.PI) dl = dl > 0 ? -(2 * Math.PI - dl) : 2 * Math.PI + dl;
  const dpsi = Math.log(Math.tan(Math.PI / 4 + f2 / 2) / Math.tan(Math.PI / 4 + f1 / 2));
  const q = Math.abs(dpsi) > 1e-12 ? (f2 - f1) / dpsi : Math.cos(f1);
  const d = Math.sqrt((f2 - f1) ** 2 + q * q * dl * dl) * R_NM;
  const brg = (Math.atan2(dl, dpsi) / rad + 360) % 360;
  return { nm: d, brg };
}

/** The point `nm` along a rhumb line from p on true course `brg`. */
export function along(p, brg, nm) {
  const d = nm / R_NM, th = brg * rad, f1 = p.lat * rad;
  let f2 = f1 + d * Math.cos(th);
  if (Math.abs(f2) > Math.PI / 2) f2 = f2 > 0 ? Math.PI - f2 : -Math.PI - f2;
  const dpsi = Math.log(Math.tan(Math.PI / 4 + f2 / 2) / Math.tan(Math.PI / 4 + f1 / 2));
  const q = Math.abs(dpsi) > 1e-12 ? (f2 - f1) / dpsi : Math.cos(f1);
  const dl = (d * Math.sin(th)) / q;
  return { lat: f2 / rad, lon: ((p.lon + dl / rad + 540) % 360) - 180 };
}

/** Where the ship will be `hours` after its fix, and its heading then. */
export function project(v, hours) {
  const dist = v.speed * hours;
  const start = { lat: v.lat, lon: v.lon };
  if (v.mode !== 'route' || !v.route?.length) {
    return { ...along(start, v.course, dist), heading: v.course, arrived: false };
  }
  let here = start, left = dist;
  for (const wp of v.route) {
    const leg = rhumb(here, wp);
    if (left <= leg.nm) return { ...along(here, leg.brg, left), heading: leg.brg, arrived: false };
    left -= leg.nm;
    here = wp;
  }
  const last = v.route.length > 1 ? rhumb(v.route.at(-2), v.route.at(-1)).brg : rhumb(start, v.route[0]).brg;
  return { ...here, heading: last, arrived: true };
}

/** How the sea (coming FROM `from`) meets a ship heading `heading`. */
function meets(from, heading) {
  if (from == null) return '';
  const r = Math.abs(((from - heading + 540) % 360) - 180); // 0 = right ahead
  if (r <= 30) return 'head';
  if (r <= 60) return 'on the bow';
  if (r <= 120) return 'on the beam';
  if (r <= 150) return 'on the quarter';
  return 'following';
}

// --------------------------------------------------------------- reading
/** "18 57.3 N", "18°57.3'N", "-18.955", "18.955 S" → decimal degrees. */
export function parseCoord(text, isLat) {
  const t = String(text).trim().toUpperCase().replace(/[°'′"″,]/g, ' ');
  const hemi = (t.match(/[NSEW]/) || [''])[0];
  const nums = t.replace(/[NSEW]/g, ' ').trim().split(/\s+/).filter(Boolean).map(Number);
  if (!nums.length || nums.some(Number.isNaN)) return null;
  let v = Math.abs(nums[0]) + (nums[1] || 0) / 60 + (nums[2] || 0) / 3600;
  if (nums[0] < 0 || hemi === 'S' || hemi === 'W') v = -v;
  if (isLat ? Math.abs(v) > 90 : Math.abs(v) > 180) return null;
  return v;
}

const pad = (n, w) => String(n).padStart(w, '0');
export function formatCoord(v, isLat) {
  const a = Math.abs(v), d = Math.floor(a), m = (a - d) * 60;
  return `${pad(d, isLat ? 2 : 3)} ${m.toFixed(1).padStart(4, '0')} ${isLat ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'W' : 'E')}`;
}
const utc = (t, withDay = true) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', ...(withDay ? { weekday: 'short', day: 'numeric' } : {}), hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(t);
const deg = (v) => (v == null ? '—' : `${pad(Math.round(v) % 360, 3)}°`);
const one = (v) => (v == null ? '—' : v.toFixed(1));

// ----------------------------------------------------------- map drawing
function shipImage(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  g.beginPath();
  g.moveTo(0, -size * 0.44);
  g.quadraticCurveTo(size * 0.2, -size * 0.1, size * 0.16, size * 0.36);
  g.lineTo(-size * 0.16, size * 0.36);
  g.quadraticCurveTo(-size * 0.2, -size * 0.1, 0, -size * 0.44);
  g.closePath();
  g.fillStyle = '#d2462f';
  g.strokeStyle = '#ffffff';
  g.lineWidth = size * 0.06;
  g.stroke();
  g.fill();
  return g.getImageData(0, 0, size, size);
}

export function setupVoyage(map, ui) {
  let v = store.get();
  let mode = null; // 'pick' (position) or 'route' (adding waypoints)
  let ahead = null; // last forecast rows

  map.addImage('my-ship', shipImage(), { pixelRatio: 2 });
  const empty = { type: 'FeatureCollection', features: [] };
  map.addSource('voyage', { type: 'geojson', data: empty });
  map.addLayer({
    id: 'voyage-track', type: 'line', source: 'voyage', filter: ['==', ['get', 'kind'], 'track'],
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#d2462f', 'line-width': 2.2, 'line-dasharray': [2, 1.5] },
  });
  map.addLayer({
    id: 'voyage-wp', type: 'circle', source: 'voyage', filter: ['==', ['get', 'kind'], 'wp'],
    paint: { 'circle-radius': 4.5, 'circle-color': '#ffffff', 'circle-stroke-color': '#d2462f', 'circle-stroke-width': 2 },
  });
  map.addLayer({
    id: 'voyage-ahead', type: 'circle', source: 'voyage', filter: ['==', ['get', 'kind'], 'ahead'],
    paint: {
      'circle-radius': 7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2,
      'circle-color': ['match', ['get', 'level'], 2, '#c0392b', 1, '#e08e0b', '#2b7de9'],
    },
  });
  map.addLayer({
    id: 'voyage-ahead-labels', type: 'symbol', source: 'voyage', filter: ['==', ['get', 'kind'], 'ahead'],
    layout: {
      'text-field': ['get', 'label'], 'text-font': ['OpenSans-Bold'], 'text-size': 11.5,
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'], 'text-radial-offset': 0.9, 'text-justify': 'auto',
      'symbol-sort-key': ['get', 'h'], 'text-padding': 1,
    },
    paint: { 'text-color': '#7a1f12', 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.6 },
  });
  map.addLayer({
    id: 'voyage-ship', type: 'symbol', source: 'voyage', filter: ['==', ['get', 'kind'], 'ship'],
    layout: {
      'icon-image': 'my-ship', 'icon-rotate': ['get', 'heading'], 'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-size': 0.8,
    },
  });

  function level(w) {
    if (!w) return 0;
    if ((w.wind ?? 0) >= 34 || (w.gust ?? 0) >= 45 || (w.waves ?? 0) >= 4) return 2;
    if ((w.wind ?? 0) >= 22 || (w.waves ?? 0) >= 2.5 || (w.swell ?? 0) >= 3) return 1;
    return 0;
  }

  function draw() {
    if (!v) { map.getSource('voyage').setData(empty); return; }
    const feats = [];
    const start = [v.lon, v.lat];
    // The track: through the waypoints, or 24 hours ahead on the course.
    const line = [start];
    if (v.mode === 'route' && v.route?.length) for (const w of v.route) line.push([w.lon, w.lat]);
    else { const p = project(v, 24); line.push([p.lon, p.lat]); }
    // Keep the line continuous across the date line.
    for (let i = 1; i < line.length; i++) {
      while (line[i][0] - line[i - 1][0] > 180) line[i][0] -= 360;
      while (line[i][0] - line[i - 1][0] < -180) line[i][0] += 360;
    }
    feats.push({ type: 'Feature', properties: { kind: 'track' }, geometry: { type: 'LineString', coordinates: line } });
    if (v.mode === 'route') for (const w of v.route || []) feats.push({ type: 'Feature', properties: { kind: 'wp' }, geometry: { type: 'Point', coordinates: [w.lon, w.lat] } });
    const t0 = Date.parse(v.time);
    AHEAD.forEach((h, i) => {
      const p = project(v, h);
      const w = ahead?.[i + 1];
      feats.push({
        type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
        properties: { kind: 'ahead', h, level: level(w), label: `+${h}h${w?.wind != null ? ` ${Math.round(w.wind)} kn` : ''}${w?.waves != null ? ` ${one(w.waves)} m` : ''}` },
      });
    });
    const heading = v.mode === 'route' && v.route?.length ? rhumb(v, v.route[0]).brg : v.course;
    feats.push({ type: 'Feature', properties: { kind: 'ship', heading }, geometry: { type: 'Point', coordinates: start } });
    map.getSource('voyage').setData({ type: 'FeatureCollection', features: feats });
  }

  // ------------------------------------------------------------- the card
  function card() {
    const d = v || { lat: null, lon: null, time: new Date().toISOString(), speed: 12, mode: 'course', course: 0, route: [] };
    const local = d.time ? new Date(d.time).toISOString().slice(0, 16) : '';
    ui.openPanel(`
      <h1>My ship</h1>
      <p class="sub">Position, speed and course or route; the weather on the way. Not for navigation.</p>
      <form class="voyage" id="vy-form" autocomplete="off">
        <div class="two">
          <label>Latitude<input id="vy-lat" inputmode="text" placeholder="18 57.3 N" value="${d.lat != null ? formatCoord(d.lat, true) : ''}"></label>
          <label>Longitude<input id="vy-lon" inputmode="text" placeholder="072 50.1 E" value="${d.lon != null ? formatCoord(d.lon, false) : ''}"></label>
        </div>
        <div class="row-buttons">
          <button type="button" class="secondary" id="vy-gps">Use GPS</button>
          <button type="button" class="secondary" id="vy-pick">Tap the map</button>
        </div>
        <div class="two">
          <label>Time of position (UTC)<input id="vy-time" type="datetime-local" value="${local}"></label>
          <label>Speed (knots)<input id="vy-speed" type="number" inputmode="decimal" min="0" max="40" step="0.1" value="${d.speed ?? ''}"></label>
        </div>
        <div class="seg" role="radiogroup">
          <label><input type="radio" name="vy-mode" value="course" ${d.mode !== 'route' ? 'checked' : ''}> Course</label>
          <label><input type="radio" name="vy-mode" value="route" ${d.mode === 'route' ? 'checked' : ''}> Route (waypoints)</label>
        </div>
        <label id="vy-course-row" ${d.mode === 'route' ? 'hidden' : ''}>Course (true °)<input id="vy-course" type="number" inputmode="decimal" min="0" max="359.9" step="0.1" value="${d.course ?? ''}"></label>
        <div id="vy-route-row" ${d.mode === 'route' ? '' : 'hidden'}>
          <div class="note" id="vy-route-note">${(d.route || []).length} waypoints. Tap "Add waypoints", then tap the map along the route.</div>
          <div class="row-buttons">
            <button type="button" class="secondary" id="vy-route">Add waypoints</button>
            <button type="button" class="secondary" id="vy-undo">Undo last</button>
            <button type="button" class="secondary" id="vy-clear">Clear</button>
          </div>
        </div>
        <div class="row-buttons">
          <button type="submit" class="primary">Show weather ahead</button>
          ${v ? '<button type="button" class="secondary" id="vy-remove">Remove ship</button>' : ''}
        </div>
        <div class="warn" id="vy-msg"></div>
      </form>
      <div id="vy-ahead"></div>`);
    wire();
    if (ahead) table();
  }

  function read() {
    const lat = parseCoord(ui.$('#vy-lat').value, true);
    const lon = parseCoord(ui.$('#vy-lon').value, false);
    const timeStr = ui.$('#vy-time').value;
    const speed = parseFloat(ui.$('#vy-speed').value);
    const modeVal = ui.$('input[name="vy-mode"]:checked').value;
    const course = parseFloat(ui.$('#vy-course').value);
    const msg = [];
    if (lat == null) msg.push('latitude (e.g. 18 57.3 N)');
    if (lon == null) msg.push('longitude (e.g. 072 50.1 E)');
    if (!timeStr) msg.push('time of position');
    if (!(speed >= 0)) msg.push('speed');
    if (modeVal === 'course' && !(course >= 0 && course < 360)) msg.push('course 0–359');
    if (modeVal === 'route' && !(v?.route?.length)) msg.push('at least one waypoint');
    ui.$('#vy-msg').textContent = msg.length ? `Check: ${msg.join(', ')}.` : '';
    if (msg.length) return null;
    return { lat, lon, time: new Date(`${timeStr}:00Z`).toISOString(), speed, mode: modeVal, course: modeVal === 'course' ? course : v?.course ?? 0, route: v?.route || [] };
  }

  function keepPartial() {
    // Keep what has been typed so far, so tapping the map does not lose it.
    const lat = parseCoord(ui.$('#vy-lat').value, true), lon = parseCoord(ui.$('#vy-lon').value, false);
    const timeStr = ui.$('#vy-time').value;
    v = {
      ...(v || { route: [] }),
      lat: lat ?? v?.lat ?? null, lon: lon ?? v?.lon ?? null,
      time: timeStr ? new Date(`${timeStr}:00Z`).toISOString() : v?.time || new Date().toISOString(),
      speed: parseFloat(ui.$('#vy-speed').value) || v?.speed || 0,
      mode: ui.$('input[name="vy-mode"]:checked').value,
      course: parseFloat(ui.$('#vy-course').value) || v?.course || 0,
    };
  }

  function wire() {
    const form = ui.$('#vy-form');
    form.addEventListener('change', (e) => {
      if (e.target.name === 'vy-mode') {
        const route = e.target.value === 'route';
        ui.$('#vy-course-row').hidden = route;
        ui.$('#vy-route-row').hidden = !route;
      }
    });
    ui.$('#vy-gps').onclick = () => {
      if (!navigator.geolocation) return;
      ui.$('#vy-msg').textContent = 'Getting position…';
      navigator.geolocation.getCurrentPosition((pos) => {
        ui.$('#vy-lat').value = formatCoord(pos.coords.latitude, true);
        ui.$('#vy-lon').value = formatCoord(pos.coords.longitude, false);
        ui.$('#vy-time').value = new Date(pos.timestamp).toISOString().slice(0, 16);
        if (pos.coords.speed != null && pos.coords.speed > 0.5) ui.$('#vy-speed').value = (pos.coords.speed * 1.943844).toFixed(1);
        if (pos.coords.heading != null && !Number.isNaN(pos.coords.heading)) ui.$('#vy-course').value = pos.coords.heading.toFixed(0);
        ui.$('#vy-msg').textContent = '';
      }, (err) => { ui.$('#vy-msg').textContent = `GPS: ${err.message}`; }, { enableHighAccuracy: true, timeout: 20000 });
    };
    ui.$('#vy-pick').onclick = () => { keepPartial(); mode = 'pick'; ui.hint('Tap the ship\'s position on the map'); ui.closePanel(); };
    ui.$('#vy-route').onclick = () => { keepPartial(); mode = 'route'; ui.hint('Tap waypoints in order, then Done'); ui.closePanel(); draw(); };
    ui.$('#vy-undo').onclick = () => { if (v?.route?.length) { v.route.pop(); store.set(v); draw(); ui.$('#vy-route-note').textContent = `${v.route.length} waypoints.`; } };
    ui.$('#vy-clear').onclick = () => { if (v) { v.route = []; store.set(v); draw(); ui.$('#vy-route-note').textContent = '0 waypoints.'; } };
    const remove = ui.$('#vy-remove');
    if (remove) remove.onclick = () => { v = null; ahead = null; store.set(null); draw(); ui.closePanel(); };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const read_ = read();
      if (!read_) return;
      v = read_;
      store.set(v);
      ahead = null;
      draw();
      map.flyTo({ center: [v.lon, v.lat], zoom: Math.min(Math.max(map.getZoom(), 5), 7), padding: ui.padding() });
      await forecast();
    };
  }

  async function forecast() {
    const t0 = Date.parse(v.time);
    const pts = [{ lat: v.lat, lon: v.lon, t: t0, h: 0, heading: project(v, 0).heading }];
    for (const h of AHEAD) { const p = project(v, h); pts.push({ ...p, t: t0 + h * 3600000, h }); }
    const box = ui.$('#vy-ahead');
    if (box) box.innerHTML = '<div class="note">Getting the forecast…</div>';
    try {
      const w = await weatherAlong(pts);
      ahead = w;
      v.ahead = { at: Date.now(), points: pts, w };
      store.set(v);
    } catch (e) {
      const saved = v.ahead;
      if (saved?.w) ahead = saved.w;
      if (box) box.innerHTML = `<div class="warn">${saved ? 'Offline: showing the forecast saved earlier.' : `Forecast needs a connection (${e.message}).`}</div>`;
      if (!saved) { draw(); return; }
    }
    draw();
    table();
    // The whole stretch ahead in view, clear of the card.
    const lons = pts.map((p) => p.lon), lats = pts.map((p) => p.lat);
    for (let i = 1; i < lons.length; i++) {
      while (lons[i] - lons[i - 1] > 180) lons[i] -= 360;
      while (lons[i] - lons[i - 1] < -180) lons[i] += 360;
    }
    // (MapLibre adds any padding left from an earlier flight to this one.)
    const pad = ui.padding();
    map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
      padding: { top: pad.top + 70, bottom: pad.bottom + 30, left: pad.left + 30, right: pad.right + 110 }, maxZoom: 8, duration: 800,
    });
    // Scroll the card (not the page, which would shift the map) to the table.
    const pane = box?.closest('.panel');
    if (pane) pane.scrollTo({ top: box.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - 8, behavior: 'smooth' });
  }

  function table() {
    const box = ui.$('#vy-ahead');
    if (!box || !ahead) return;
    const t0 = Date.parse(v.time);
    const rows = [0, ...AHEAD].map((h, i) => {
      const p = i === 0 ? { lat: v.lat, lon: v.lon, heading: project(v, 0).heading } : project(v, h);
      const w = ahead[i];
      const lv = level(w);
      const sea = w ? meets(w.wavesDir, p.heading) : '';
      return `<tr class="lv${lv}">
        <th>${h ? `+${h}h` : 'Fix'}<span>${utc(new Date(t0 + h * 3600000))}</span><span class="pos">${formatCoord(p.lat, true)}<br>${formatCoord(p.lon, false)}</span>${p.arrived ? '<span>(route end)</span>' : ''}</th>
        <td>${w ? `
          <div><b>Wind</b> ${deg(w.windDir)} ${w.wind != null ? Math.round(w.wind) : '—'} kn${w.gust != null ? `, gusts ${Math.round(w.gust)}` : ''}</div>
          <div><b>Waves</b> ${one(w.waves)} m ${deg(w.wavesDir)}${w.wavesPer ? `, ${Math.round(w.wavesPer)} s` : ''}${sea ? ` · <i>${sea}</i>` : ''}</div>
          <div><b>Swell</b> ${one(w.swell)} m ${deg(w.swellDir)}${w.swellPer ? `, ${Math.round(w.swellPer)} s` : ''}${w.swellDir != null ? ` · <i>${meets(w.swellDir, p.heading)}</i>` : ''}</div>
          <div><b>Current</b> sets ${deg(w.currentDir)} ${w.current != null ? w.current.toFixed(1) : '—'} kn</div>
          <div><b>Pressure</b> ${w.pressure != null ? Math.round(w.pressure) : '—'} hPa${w.visibility != null ? ` · vis ${w.visibility >= 10000 ? '10+ km' : `${(w.visibility / 1000).toFixed(1)} km`}` : ''}</div>`
        : '<div class="note">Beyond the forecast</div>'}
          <div class="zone">${zonesBrief(zonesAt(p.lon, p.lat, new Date(t0 + h * 3600000)))}</div></td></tr>`;
    }).join('');
    const age = v.ahead?.at ? Math.round((Date.now() - v.ahead.at) / 60000) : 0;
    box.innerHTML = `<div class="card"><h3>Weather ahead</h3>
      <table class="ahead">${rows}</table>
      <div class="note">Directions: wind, waves and swell FROM; current TO (set). Sea relative to the ship's heading at each point.
      <span class="lv-key"><i class="k1"></i>22+ kn or 2.5+ m · <i class="k2"></i>34+ kn or 4+ m</span>
      Open-Meteo model forecast${age > 60 ? `, ${Math.round(age / 60)} h old` : ''}. Not for navigation.</div></div>`;
  }

  // Taps on the map while placing the ship or the route.
  function click(e) {
    if (!mode) return false;
    const { lat, lng } = e.lngLat;
    const lon = ((lng + 540) % 360) - 180;
    if (mode === 'pick') {
      v = { ...(v || { route: [], speed: 12, mode: 'course', course: 0, time: new Date().toISOString() }), lat, lon };
      mode = null;
      ui.hint('');
      store.set(v);
      draw();
      card();
    } else if (mode === 'route') {
      if (v?.lat == null) { v = { ...(v || {}), lat, lon, route: [], speed: v?.speed || 12, mode: 'route', time: v?.time || new Date().toISOString() }; }
      else { v.route = [...(v.route || []), { lat, lon }]; }
      v.mode = 'route';
      store.set(v);
      draw();
    }
    return true;
  }

  draw();
  return {
    open() {
      if (mode) { mode = null; ui.hint(''); }
      card();
    },
    click,
    busy: () => mode != null,
  };
}
