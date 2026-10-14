// Live weather and sea state from Open-Meteo (free, no account), for the part
// of the world on screen: wind, pressure with isobars, air and sea
// temperature, waves, swell and surface current, for the next three days.
// Needs a connection; the last download is kept and shown, with its age, at sea.
// Not for navigation: it is model output, not an official forecast.

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const MARINE = 'https://marine-api.open-meteo.com/v1/marine';
const HOURS = 72;
const KNOT_PER_KMH = 1 / 1.852;

export const KINDS = {
  wind: { label: 'Wind', unit: 'kn' },
  pressure: { label: 'Pressure', unit: 'hPa' },
  temp: { label: 'Air temp', unit: '°C' },
  waves: { label: 'Waves', unit: 'm' },
  swell: { label: 'Swell', unit: 'm' },
  current: { label: 'Current', unit: 'kn' },
  sst: { label: 'Sea temp', unit: '°C' },
};

const store = {
  get(k, d) { try { const v = localStorage.getItem(`wm.wx.${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`wm.wx.${k}`, JSON.stringify(v)); } catch { /* full or private */ } },
};

// ------------------------------------------------------------------ fetching
// Points to ask about, evenly over the screen. Longitudes are kept running
// on past ±180 so lines drawn across the date line stay whole; they are
// wrapped only when asking the server.
function grid(bounds, width, height) {
  let w = bounds.getWest(), e = bounds.getEast();
  if (e - w > 360) { w = -180; e = 180; }
  const s = Math.max(bounds.getSouth(), -76), n = Math.min(bounds.getNorth(), 80);
  const nx = 13;
  const ny = Math.max(7, Math.min(18, Math.round(nx * height / width)));
  const lats = [], lons = [];
  for (let j = 0; j < ny; j++) lats.push(+(s + (n - s) * (j + 0.5) / ny).toFixed(2));
  for (let i = 0; i < nx; i++) lons.push(+(w + (e - w) * (i + 0.5) / nx).toFixed(2));
  return { lats, lons, nx, ny };
}
const wrap = (lon) => +((((lon + 180) % 360) + 360) % 360 - 180).toFixed(2);

async function getJson(url, params) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const res = await fetch(`${url}?${new URLSearchParams(params)}`, { signal: ctl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  } finally { clearTimeout(t); }
}

async function download(g) {
  const lat = [], lon = [];
  for (const la of g.lats) for (const lo of g.lons) { lat.push(la); lon.push(lo); }
  const common = { latitude: lat.join(','), longitude: lon.map(wrap).join(','), forecast_hours: HOURS, timezone: 'GMT' };
  const [air, sea] = await Promise.all([
    getJson(FORECAST, { ...common, hourly: 'wind_speed_10m,wind_direction_10m,pressure_msl,temperature_2m', wind_speed_unit: 'kn' }),
    getJson(MARINE, {
      ...common, cell_selection: 'sea',
      hourly: 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction,sea_surface_temperature',
    }).catch(() => null), // the marine model can be busy; air still shows
  ]);
  const airs = Array.isArray(air) ? air : [air];
  const seas = sea ? (Array.isArray(sea) ? sea : [sea]) : [];
  const times = airs[0].hourly.time.map((t) => Date.parse(`${t}Z`));
  const currentUnit = seas[0]?.hourly_units?.ocean_current_velocity || 'km/h';
  const toKnots = /kn/.test(currentUnit) ? 1 : /m\/s/.test(currentUnit) ? 1.943844 : KNOT_PER_KMH;
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const points = airs.map((a, k) => {
    const m = seas[k]?.hourly || {};
    const h = a.hourly;
    return {
      lat: lat[k], lon: lon[k],
      wind: h.wind_speed_10m.map(r1), windDir: h.wind_direction_10m,
      pressure: h.pressure_msl.map(r1), temp: h.temperature_2m.map(r1),
      waves: (m.wave_height || []).map(r1), wavesDir: m.wave_direction || [], wavesPer: (m.wave_period || []).map(r1),
      swell: (m.swell_wave_height || []).map(r1), swellDir: m.swell_wave_direction || [], swellPer: (m.swell_wave_period || []).map(r1),
      current: (m.ocean_current_velocity || []).map((v) => (v == null ? null : r1(v * toKnots))), currentDir: m.ocean_current_direction || [],
      sst: (m.sea_surface_temperature || []).map(r1),
    };
  });
  return { at: Date.now(), times, nx: g.nx, ny: g.ny, points, marine: seas.length > 0 };
}

// ------------------------------------------------------------------ isobars
// Contours of pressure by marching squares on the grid (refined 4× by
// bilinear interpolation first, so the lines are smooth), joined into lines.
function isobars(data, step, every = 4) {
  const { nx, ny, points } = data;
  const val = (i, j) => points[j * nx + i].pressure[step];
  const R = 4;
  const W = (nx - 1) * R + 1, H = (ny - 1) * R + 1;
  const f = new Float64Array(W * H);
  const lon = new Float64Array(W), lat = new Float64Array(H);
  for (let x = 0; x < W; x++) {
    const i = Math.min(nx - 2, Math.floor(x / R)), t = x / R - i;
    lon[x] = points[i].lon + (points[i + 1].lon - points[i].lon) * t;
  }
  for (let y = 0; y < H; y++) {
    const j = Math.min(ny - 2, Math.floor(y / R)), t = y / R - j;
    lat[y] = points[j * nx].lat + (points[(j + 1) * nx].lat - points[j * nx].lat) * t;
  }
  for (let y = 0; y < H; y++) {
    const j = Math.min(ny - 2, Math.floor(y / R)), v = y / R - j;
    for (let x = 0; x < W; x++) {
      const i = Math.min(nx - 2, Math.floor(x / R)), u = x / R - i;
      const a = val(i, j), b = val(i + 1, j), c = val(i, j + 1), d = val(i + 1, j + 1);
      f[y * W + x] = (a == null || b == null || c == null || d == null) ? NaN
        : a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }
  }
  let min = Infinity, max = -Infinity;
  for (const v of f) if (!Number.isNaN(v)) { min = Math.min(min, v); max = Math.max(max, v); }
  const features = [];
  for (let level = Math.ceil(min / every) * every; level <= max; level += every) {
    const segs = [];
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const q = [f[y * W + x], f[y * W + x + 1], f[(y + 1) * W + x + 1], f[(y + 1) * W + x]];
        if (q.some(Number.isNaN)) continue;
        const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]];
        const cross = [];
        for (let e = 0; e < 4; e++) {
          const a = q[e], b = q[(e + 1) % 4];
          if ((a < level) !== (b < level)) {
            const t = (level - a) / (b - a);
            const [x0, y0] = corners[e], [x1, y1] = corners[(e + 1) % 4];
            cross.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
          }
        }
        if (cross.length === 2) segs.push(cross);
        else if (cross.length === 4) { segs.push([cross[0], cross[1]]); segs.push([cross[2], cross[3]]); }
      }
    }
    for (const line of join(segs)) {
      features.push({
        type: 'Feature', properties: { level, label: String(level) },
        geometry: {
          type: 'LineString',
          coordinates: line.map(([x, y]) => {
            const xi = Math.min(W - 2, Math.floor(x)), yi = Math.min(H - 2, Math.floor(y));
            return [lon[xi] + (lon[xi + 1] - lon[xi]) * (x - xi), lat[yi] + (lat[yi + 1] - lat[yi]) * (y - yi)];
          }),
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

function join(segs) {
  const key = ([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`;
  const ends = new Map();
  segs.forEach((s, n) => { for (const p of s) { const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(n); } });
  const used = new Uint8Array(segs.length);
  const lines = [];
  for (let n = 0; n < segs.length; n++) {
    if (used[n]) continue;
    used[n] = 1;
    const line = [...segs[n]];
    for (const atEnd of [true, false]) {
      for (;;) {
        const tip = atEnd ? line[line.length - 1] : line[0];
        const next = (ends.get(key(tip)) || []).find((m) => !used[m]);
        if (next == null) break;
        used[next] = 1;
        const [a, b] = segs[next];
        const other = key(a) === key(tip) ? b : a;
        if (atEnd) line.push(other); else line.unshift(other);
      }
    }
    if (line.length > 3) lines.push(line);
  }
  return lines;
}

// ------------------------------------------------------------------ drawing
function arrowImage(color, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  g.beginPath();
  g.moveTo(0, -size * 0.42);
  g.lineTo(size * 0.2, -size * 0.1);
  g.lineTo(size * 0.07, -size * 0.1);
  g.lineTo(size * 0.07, size * 0.42);
  g.lineTo(-size * 0.07, size * 0.42);
  g.lineTo(-size * 0.07, -size * 0.1);
  g.lineTo(-size * 0.2, -size * 0.1);
  g.closePath();
  g.fillStyle = color;
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = size * 0.05;
  g.stroke();
  g.fill();
  return g.getImageData(0, 0, size, size);
}

/** An arrowhead pointing right, for marks placed along a line. */
export function flowImage(color, size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.beginPath();
  g.moveTo(size * 0.82, size / 2);
  g.lineTo(size * 0.25, size * 0.22);
  g.lineTo(size * 0.4, size / 2);
  g.lineTo(size * 0.25, size * 0.78);
  g.closePath();
  g.fillStyle = color;
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = size * 0.05;
  g.stroke();
  g.fill();
  return g.getImageData(0, 0, size, size);
}

const halo = { 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.5 };
const ARROWS = {
  // which way to point: wind and waves are given as where they come FROM,
  // so the arrow points the other way, where they go; current is given as
  // where it sets TO.
  wind: { color: '#33415c', value: 'wind', dir: 'windDir', flip: true, fmt: (p) => `${Math.round(p.v)} kn` },
  waves: { color: '#1d6fa5', value: 'waves', dir: 'wavesDir', flip: true, fmt: (p) => `${p.v} m${p.per ? ` · ${Math.round(p.per)} s` : ''}` },
  swell: { color: '#6a4fb3', value: 'swell', dir: 'swellDir', flip: true, fmt: (p) => `${p.v} m${p.per ? ` · ${Math.round(p.per)} s` : ''}` },
  current: { color: '#c0392b', value: 'current', dir: 'currentDir', flip: false, fmt: (p) => `${p.v.toFixed(1)} kn` },
};

const tempColor = ['interpolate', ['linear'], ['get', 'v'],
  -10, '#5e60ce', 0, '#48bfe3', 10, '#72efdd', 18, '#b5e48c', 24, '#ffd166', 29, '#f8961e', 34, '#d62828'];

export function setupWeather(map, ui) {
  let data = store.get('data', null);
  let step = 0;
  let on = store.get('on', false);
  let kinds = new Set(store.get('kinds', ['wind', 'pressure']));
  let busy = false;
  let lastKey = '';

  for (const [k, a] of Object.entries(ARROWS)) map.addImage(`arrow-${k}`, arrowImage(a.color), { pixelRatio: 2 });

  const empty = { type: 'FeatureCollection', features: [] };
  map.addSource('wx-points', { type: 'geojson', data: empty });
  map.addSource('wx-isobars', { type: 'geojson', data: empty });
  const before = map.getLayer('ports-0') ? 'ports-0' : undefined;

  map.addLayer({
    id: 'wx-temp', type: 'circle', source: 'wx-points', filter: ['==', ['get', 'k'], 'temp'],
    paint: { 'circle-radius': 15, 'circle-color': tempColor, 'circle-opacity': 0.55, 'circle-blur': 0.3 },
  }, before);
  map.addLayer({
    id: 'wx-sst', type: 'circle', source: 'wx-points', filter: ['==', ['get', 'k'], 'sst'],
    paint: { 'circle-radius': 13, 'circle-color': tempColor, 'circle-opacity': 0.5, 'circle-stroke-color': '#1d6fa5', 'circle-stroke-width': 1 },
  }, before);
  map.addLayer({
    id: 'wx-isobars', type: 'line', source: 'wx-isobars',
    paint: {
      'line-color': '#3d3d5c',
      'line-width': ['case', ['==', ['%', ['get', 'level'], 20], 0], 1.8, 1.1],
      'line-opacity': 0.85,
    },
  }, before);
  map.addLayer({
    id: 'wx-isobar-labels', type: 'symbol', source: 'wx-isobars',
    layout: { 'symbol-placement': 'line', 'symbol-spacing': 260, 'text-field': ['get', 'label'], 'text-font': ['OpenSans-Semibold'], 'text-size': 11, 'text-keep-upright': true },
    paint: { 'text-color': '#3d3d5c', ...halo },
  }, before);
  for (const k of Object.keys(ARROWS)) {
    map.addLayer({
      id: `wx-${k}`, type: 'symbol', source: 'wx-points', filter: ['==', ['get', 'k'], k],
      layout: {
        'icon-image': `arrow-${k}`, 'icon-rotate': ['get', 'dir'], 'icon-rotation-alignment': 'map',
        'icon-size': ['interpolate', ['linear'], ['get', 'v'], 0, 0.45, k === 'wind' ? 40 : k === 'current' ? 3 : 8, 1.1],
        'icon-allow-overlap': true, 'icon-ignore-placement': true,
        'text-field': ['get', 'label'], 'text-font': ['OpenSans-Semibold'], 'text-size': 10.5,
        'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-allow-overlap': false,
      },
      paint: { 'text-color': ARROWS[k].color, ...halo },
    }, before);
  }
  for (const k of ['temp', 'sst', 'pressure']) {
    if (k === 'pressure') continue;
    map.addLayer({
      id: `wx-${k}-labels`, type: 'symbol', source: 'wx-points', filter: ['==', ['get', 'k'], k],
      layout: { 'text-field': ['get', 'label'], 'text-font': ['OpenSans-Bold'], 'text-size': 11, 'text-allow-overlap': false },
      paint: { 'text-color': '#1d2b36', ...halo },
    }, before);
  }

  function render() {
    const vis = (id, show) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', show ? 'visible' : 'none');
    for (const k of Object.keys(ARROWS)) vis(`wx-${k}`, on && kinds.has(k));
    vis('wx-temp', on && kinds.has('temp')); vis('wx-temp-labels', on && kinds.has('temp'));
    vis('wx-sst', on && kinds.has('sst')); vis('wx-sst-labels', on && kinds.has('sst'));
    vis('wx-isobars', on && kinds.has('pressure')); vis('wx-isobar-labels', on && kinds.has('pressure'));
    ui.bar.hidden = !on;
    if (!on || !data) { status(); return; }
    step = Math.min(step, data.times.length - 1);

    // Each kind of arrow sits at its own corner of the grid cell, so wind,
    // waves, swell and current at one place do not hide one another.
    const dLon = data.nx > 1 ? data.points[1].lon - data.points[0].lon : 1;
    const dLat = data.ny > 1 ? data.points[data.nx].lat - data.points[0].lat : 1;
    const SHIFT = { wind: [0, 0], waves: [0.33, 0.2], swell: [-0.33, 0.2], current: [0, -0.33], temp: [0.25, -0.25], sst: [-0.25, -0.25] };
    const feats = [];
    for (const p of data.points) {
      for (const k of kinds) {
        if (k === 'pressure') continue;
        const v = p[k]?.[step];
        if (v == null) continue;
        const f = { k, v, label: '' };
        const a = ARROWS[k];
        if (a) {
          const d = p[a.dir]?.[step];
          if (d == null) continue;
          f.dir = (d + (a.flip ? 180 : 0)) % 360;
          f.per = p[`${k}Per`]?.[step];
          f.label = a.fmt(f);
        } else {
          f.label = `${Math.round(v)}°`;
        }
        const [sx, sy] = SHIFT[k] || [0, 0];
        feats.push({ type: 'Feature', properties: f, geometry: { type: 'Point', coordinates: [p.lon + sx * dLon, p.lat + sy * dLat] } });
      }
    }
    map.getSource('wx-points').setData({ type: 'FeatureCollection', features: feats });
    map.getSource('wx-isobars').setData(kinds.has('pressure') ? isobars(data, step) : empty);
    status();
  }

  function status(msg) {
    const t = data?.times?.[step];
    ui.time.textContent = t
      ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(t) + ' UTC'
      : '—';
    const age = data ? Math.round((Date.now() - data.at) / 60000) : null;
    ui.status.textContent = msg || (busy ? 'Downloading…'
      : !data ? 'No weather yet: needs a connection'
        : `${age < 90 ? `${age} min` : `${Math.round(age / 60)} h`} old${data.marine ? '' : ' · sea state unavailable'}`);
  }

  async function refresh(force = false) {
    if (!on || busy) return;
    const c = map.getCanvas();
    const g = grid(map.getBounds(), c.clientWidth, c.clientHeight);
    const key = `${g.lats[0]},${g.lons[0]},${g.lats.at(-1)},${g.lons.at(-1)}`;
    const fresh = data && Date.now() - data.at < 30 * 60000;
    if (!force && key === lastKey && fresh) return;
    busy = true; status();
    try {
      const firstTime = data?.times?.[step];
      data = await download(g);
      lastKey = key;
      store.set('data', data);
      // Keep showing the same hour after a new download.
      const i = firstTime ? data.times.findIndex((t) => t >= firstTime) : 0;
      step = i < 0 ? 0 : i;
      if (!firstTime) step = Math.max(0, data.times.findIndex((t) => t >= Date.now() - 3600000));
      ui.slider.max = String(data.times.length - 1);
      ui.slider.value = String(step);
    } catch (e) {
      status(navigator.onLine === false ? 'Offline: showing last download' : `Could not download (${e.message})`);
      busy = false;
      render();
      return;
    }
    busy = false;
    render();
  }

  let timer = null;
  map.on('moveend', () => { clearTimeout(timer); timer = setTimeout(() => refresh(), 900); });

  // Controls
  for (const box of ui.kinds) {
    box.checked = kinds.has(box.dataset.kind);
    box.onchange = () => {
      if (box.checked) kinds.add(box.dataset.kind); else kinds.delete(box.dataset.kind);
      store.set('kinds', [...kinds]);
      render();
    };
  }
  ui.slider.oninput = () => { step = +ui.slider.value; render(); };
  ui.reload.onclick = () => refresh(true);

  if (data) {
    ui.slider.max = String(data.times.length - 1);
    step = Math.max(0, data.times.findIndex((t) => t >= Date.now() - 3600000));
    ui.slider.value = String(step);
  }

  return {
    setOn(v) { on = v; store.set('on', v); render(); if (v) refresh(); },
    isOn: () => on,
    render,
  };
}

// ------------------------------------------------------------------ tides
// Sea level at a port from Open-Meteo's marine model (tide plus surge), with
// high and low waters picked from the hourly curve. A model, not the
// official tide tables.
export async function tideAt(lat, lon) {
  const key = `tide.${lat.toFixed(2)},${lon.toFixed(2)}`;
  const saved = store.get(key, null);
  try {
    const j = await getJson(MARINE, {
      latitude: lat, longitude: lon, hourly: 'sea_level_height_msl', past_days: 1, forecast_days: 3,
      timezone: 'GMT', cell_selection: 'sea',
    });
    const times = j.hourly.time.map((t) => Date.parse(`${t}Z`));
    const h = j.hourly.sea_level_height_msl;
    if (!h || h.every((v) => v == null)) throw new Error('no tide here');
    const out = { at: Date.now(), times, h, dist: j.latitude != null ? [j.latitude, j.longitude] : null };
    store.set(key, out);
    return out;
  } catch (e) {
    if (saved) return { ...saved, stale: true };
    throw e;
  }
}

/** High and low waters: turning points of the hourly curve, refined by a parabola. */
export function turningPoints({ times, h }) {
  const out = [];
  for (let i = 1; i < h.length - 1; i++) {
    const [a, b, c] = [h[i - 1], h[i], h[i + 1]];
    if (a == null || b == null || c == null) continue;
    const high = b > a && b >= c, low = b < a && b <= c;
    if (!high && !low) continue;
    const denom = a - 2 * b + c;
    const off = denom ? (a - c) / (2 * denom) : 0;
    const t = times[i] + off * 3600000;
    const v = b - ((a - c) * off) / 4;
    out.push({ t, v, high });
  }
  return out;
}

// ---------------------------------------------------------- weather on a track
// The forecast at given places and times (the ship's projected positions):
// for each { lat, lon, t }, the hour nearest t. One request for the air, one
// for the sea, for all the points together.
export async function weatherAlong(points) {
  const lat = points.map((p) => p.lat.toFixed(3)).join(',');
  const lon = points.map((p) => ((((p.lon + 180) % 360) + 360) % 360 - 180).toFixed(3)).join(',');
  const common = { latitude: lat, longitude: lon, past_days: 2, forecast_days: 7, timezone: 'GMT' };
  const [air, sea] = await Promise.all([
    getJson(FORECAST, {
      ...common, wind_speed_unit: 'kn',
      hourly: 'wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,visibility,temperature_2m,weather_code',
    }),
    getJson(MARINE, {
      ...common, cell_selection: 'sea',
      hourly: 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,ocean_current_direction',
    }).catch(() => null),
  ]);
  const airs = Array.isArray(air) ? air : [air];
  const seas = sea ? (Array.isArray(sea) ? sea : [sea]) : [];
  const currentUnit = seas[0]?.hourly_units?.ocean_current_velocity || 'km/h';
  const toKnots = /kn/.test(currentUnit) ? 1 : /m\/s/.test(currentUnit) ? 1.943844 : KNOT_PER_KMH;
  return points.map((p, k) => {
    const a = airs[k]?.hourly, m = seas[k]?.hourly || {};
    if (!a) return null;
    const times = a.time.map((t) => Date.parse(`${t}Z`));
    let i = 0;
    for (let j = 1; j < times.length; j++) if (Math.abs(times[j] - p.t) < Math.abs(times[i] - p.t)) i = j;
    if (Math.abs(times[i] - p.t) > 2 * 3600000) return null; // outside the forecast
    const at = (arr) => (arr && arr[i] != null ? arr[i] : null);
    return {
      wind: at(a.wind_speed_10m), windDir: at(a.wind_direction_10m), gust: at(a.wind_gusts_10m),
      pressure: at(a.pressure_msl), visibility: at(a.visibility), temp: at(a.temperature_2m), code: at(a.weather_code),
      waves: at(m.wave_height), wavesDir: at(m.wave_direction), wavesPer: at(m.wave_period),
      swell: at(m.swell_wave_height), swellDir: at(m.swell_wave_direction), swellPer: at(m.swell_wave_period),
      current: at(m.ocean_current_velocity) == null ? null : at(m.ocean_current_velocity) * toKnots,
      currentDir: at(m.ocean_current_direction),
    };
  });
}
