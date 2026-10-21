// The night sky at the ship (or wherever the map is): stars, the four
// navigational planets, the Moon and Sun, drawn as on a star finder (zenith
// in the middle, horizon round the edge, north up). Tap a star for its
// altitude and bearing. Twilight times for the day, and the navigational
// stars well placed for sights at evening and morning twilight.
//
// Positions from Astronomy Engine (Don Cross, MIT), within about a minute of
// arc: for planning, not for working sights (use the Nautical Almanac).

let starsData = null;
async function load() {
  if (!window.Astronomy) {
    await new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = 'vendor/astronomy.min.js';
      s.onload = ok;
      s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  if (!starsData) starsData = await fetch('data/stars.json').then((r) => r.json());
}

const PLANETS = [['Venus', '#fff6c8'], ['Mars', '#ff8a5c'], ['Jupiter', '#ffe0a8'], ['Saturn', '#f2d68a']];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const deg = (v) => `${Math.floor(Math.abs(v))}°${(Math.abs(v) % 1 * 60).toFixed(1).padStart(4, '0')}′`;
const altText = (a) => `${a < 0 ? '−' : ''}${deg(a)}`;
const bvColour = (bv) => (bv < 0 ? '#aac8ff' : bv < 0.4 ? '#e6eeff' : bv < 0.8 ? '#fff8e8' : bv < 1.3 ? '#ffe2b8' : '#ffc89a');

// Zone time from longitude, as kept at sea: zone −5 is UTC+5.
const zoneOf = (lon) => Math.round(lon / 15);
function zt(date, zone) {
  const d = new Date(date.getTime() + zone * 3600000);
  return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
}
const zoneName = (z) => (z === 0 ? 'Z' : `${z > 0 ? '−' : '+'}${Math.abs(z)}`);

// Everything in the sky at one time and place.
function compute(date, lat, lon) {
  const A = window.Astronomy;
  const obs = new A.Observer(lat, lon, 0);
  const rot = A.Rotation_EQJ_EQD(date);
  const gha = (A.SiderealTime(date) * 15) % 360;
  const out = [];
  for (const [ra, dec, mag, bv, name, nav] of starsData.stars) {
    const eq = A.EquatorFromVector(A.RotateVector(rot, A.VectorFromSphere(new A.Spherical(dec, ra, 1), date)));
    const h = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
    out.push({ kind: 'star', name, nav, mag, bv, alt: h.altitude, az: h.azimuth, sha: (360 - eq.ra * 15 + 360) % 360, dec: eq.dec });
  }
  const body = (name, colour) => {
    const eq = A.Equator(A.Body[name], date, obs, true, true);
    const h = A.Horizon(date, obs, eq.ra, eq.dec, 'normal');
    return { kind: 'body', name, colour, alt: h.altitude, az: h.azimuth, gha: (gha - eq.ra * 15 + 720) % 360, dec: eq.dec, mag: A.Illumination(A.Body[name], date).mag };
  };
  const bodies = PLANETS.map(([n, c]) => body(n, c));
  const moon = body('Moon', '#f4f1e6');
  moon.phase = A.MoonPhase(date);
  moon.lit = A.Illumination(A.Body.Moon, date).phase_fraction;
  const sun = body('Sun', '#ffd75e');
  return { stars: out, bodies, moon, sun, ghaAries: gha };
}

// Twilight and sun and moon rise and set for the day (zone time) of `date`.
function day(date, lat, lon) {
  const A = window.Astronomy;
  const obs = new A.Observer(lat, lon, 0);
  const zone = zoneOf(lon);
  const local = new Date(date.getTime() + zone * 3600000);
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - zone * 3600000);
  const t = (r) => (r ? r.date : null);
  // Where a body is at a moment: altitude and true bearing.
  const at = (body, when) => {
    if (!when) return null;
    const eq = A.Equator(body, when, obs, true, true);
    const h = A.Horizon(when, obs, eq.ra, eq.dec, 'normal');
    return { time: when, alt: h.altitude, az: h.azimuth };
  };
  const transit = (body) => {
    const e = A.SearchHourAngle(body, obs, 0, start, +1);
    const when = e?.time?.date;
    return when && when - start < 86400000 ? { time: when, alt: e.hor.altitude, az: e.hor.azimuth } : null;
  };
  const rs = (body, dir) => at(body, t(A.SearchRiseSet(body, obs, dir, start, 1)));
  // The next four phases of the Moon.
  const phases = [];
  let q = A.SearchMoonQuarter(date);
  for (let i = 0; i < 4; i++) { phases.push({ quarter: q.quarter, time: q.time.date }); q = A.NextMoonQuarter(q); }
  return {
    sunRise: rs(A.Body.Sun, +1), sunSet: rs(A.Body.Sun, -1), sunTransit: transit(A.Body.Sun),
    moonRise: rs(A.Body.Moon, +1), moonSet: rs(A.Body.Moon, -1), moonTransit: transit(A.Body.Moon),
    phases,
    zone, start,
    nautMorning: t(A.SearchAltitude(A.Body.Sun, obs, +1, start, 1, -12)),
    civilMorning: t(A.SearchAltitude(A.Body.Sun, obs, +1, start, 1, -6)),
    sunrise: t(A.SearchRiseSet(A.Body.Sun, obs, +1, start, 1)),
    sunset: t(A.SearchRiseSet(A.Body.Sun, obs, -1, start, 1)),
    civilEvening: t(A.SearchAltitude(A.Body.Sun, obs, -1, start, 1, -6)),
    nautEvening: t(A.SearchAltitude(A.Body.Sun, obs, -1, start, 1, -12)),
    moonrise: t(A.SearchRiseSet(A.Body.Moon, obs, +1, start, 1)),
    moonset: t(A.SearchRiseSet(A.Body.Moon, obs, -1, start, 1)),
  };
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const compass = (az) => POINTS[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
function moonPath(d) {
  const r = d.moonRise, s = d.moonSet, h = d.moonTransit;
  if (!r && !s) return 'No moonrise or moonset today.';
  const side = h ? (h.az > 90 && h.az < 270 ? 'the south' : 'the north') : 'the sky';
  if (r && s) return `Rises in the ${compass(r.az)} (${r.az.toFixed(0)}°), crosses ${side}${h ? ` at ${altText(h.alt).split('°')[0]}°` : ''} and sets in the ${compass(s.az)} (${s.az.toFixed(0)}°).`;
  if (r) return `Rises in the ${compass(r.az)} (${r.az.toFixed(0)}°) and crosses ${side}.`;
  return `Sets in the ${compass(s.az)} (${s.az.toFixed(0)}°).`;
}

function moonName(phase) {
  if (phase < 10 || phase > 350) return 'New Moon';
  if (phase < 80) return 'Waxing crescent';
  if (phase < 100) return 'First quarter';
  if (phase < 170) return 'Waxing gibbous';
  if (phase < 190) return 'Full Moon';
  if (phase < 260) return 'Waning gibbous';
  if (phase < 280) return 'Last quarter';
  return 'Waning crescent';
}

export function openSky({ openPanel, place }) {
  const where = place();
  openPanel(`<h1>Night sky</h1><p class="sub">Loading the stars…</p>`);
  load().then(() => render(openPanel, place), () => openPanel('<h1>Night sky</h1><p class="sub">Could not load the star data.</p>'));
  return where;
}

function render(openPanel, place) {
  let { lat, lon, label } = place();
  let offset = 0; // minutes from now
  let picked = null;
  let view = 'up'; // or the bearing faced: 0, 90, 180, 270
  const base = new Date();
  openPanel(`<h1>Night sky</h1>
    <p class="sub" id="sky-where"></p>
    <div class="sky-views" role="group" aria-label="Look">
      <button type="button" data-view="up" class="active">Overhead</button><button type="button" data-view="0">North</button><button type="button" data-view="90">East</button><button type="button" data-view="180">South</button><button type="button" data-view="270">West</button>
    </div>
    <div class="sky-wrap"><canvas id="sky-canvas" width="720" height="720" aria-label="Sky chart: zenith in the middle, horizon round the edge, north up"></canvas></div>
    <div class="sky-pick" id="sky-pick">Tap a star or planet for its altitude and bearing.</div>
    <div class="sky-time">
      <input type="range" id="sky-slider" min="-720" max="1440" step="5" value="0" aria-label="Time">
      <div class="sky-buttons">
        <button type="button" class="secondary" data-go="morning">Morning twilight</button>
        <button type="button" class="secondary" data-go="now">Now</button>
        <button type="button" class="secondary" data-go="evening">Evening twilight</button>
      </div>
      <label class="sky-check"><input type="checkbox" id="sky-names" checked> Names of the navigational stars</label>
    </div>
    <div class="cards"><div class="card" id="sky-day"></div><div class="card" id="sky-list"></div></div>
    <p class="note">Positions from Astronomy Engine, within about 1′. For planning sights; work them from the Nautical Almanac.</p>`);
  const canvas = document.getElementById('sky-canvas');
  const g = canvas.getContext('2d');
  const slider = document.getElementById('sky-slider');
  let state = null, today = null, todayKey = '';

  const when = () => new Date(base.getTime() + offset * 60000);
  const R = 330, C = 360;
  const xy = (alt, az) => {
    const r = R * (90 - alt) / 90, a = az * Math.PI / 180;
    return [C + r * Math.sin(a), C - r * Math.cos(a)];
  };
  // Facing one way: 130° across, horizon to 80° up.
  const HALF = 65, TOP = 80, SX = 360 / HALF, SY = 600 / TOP, HZ = 650;
  const proj = (alt, az) => {
    if (view === 'up') return alt < -0.5 ? null : xy(Math.max(alt, 0), az);
    const d = ((az - view + 540) % 360) - 180;
    if (Math.abs(d) > HALF || alt < -1 || alt > TOP) return null;
    return [C + d * SX, HZ - Math.max(alt, 0) * SY];
  };

  function draw() {
    const date = when();
    state = compute(date, lat, lon);
    const sunAlt = state.sun.alt;
    const sky = sunAlt > 0 ? '#6fa8dc' : sunAlt > -6 ? '#2b4a78' : sunAlt > -12 ? '#16284a' : '#0a1226';
    g.clearRect(0, 0, 720, 720);
    g.fillStyle = sky;
    if (view === 'up') {
      g.beginPath(); g.arc(C, C, R, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      for (const a of [30, 60]) { g.beginPath(); g.arc(C, C, R * (90 - a) / 90, 0, 2 * Math.PI); g.stroke(); }
      for (let z = 0; z < 360; z += 30) { const [x, y] = xy(0, z); g.beginPath(); g.moveTo(C, C); g.lineTo(x, y); g.stroke(); }
      g.fillStyle = '#c9d6ea'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const [t, z] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) { const [x, y] = xy(-6.5, z); g.fillText(t, x, y); }
    } else {
      g.fillRect(0, 0, 720, HZ);
      g.fillStyle = '#0b2a3a'; g.fillRect(0, HZ, 720, 720 - HZ);
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
      g.fillStyle = '#c9d6ea'; g.font = '14px sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
      for (const a of [15, 30, 45, 60, 75]) { const y = HZ - a * SY; g.beginPath(); g.moveTo(0, y); g.lineTo(720, y); g.stroke(); g.fillText(`${a}°`, 4, y - 9); }
      g.textAlign = 'center';
      for (let d = -60; d <= 60; d += 10) {
        const z = (view + d + 360) % 360, x = C + d * SX;
        g.beginPath(); g.moveTo(x, HZ); g.lineTo(x, HZ + (d % 30 ? 6 : 12)); g.stroke();
        const card = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[z];
        g.font = card ? 'bold 22px sans-serif' : '14px sans-serif';
        if (card || d % 30 === 0) g.fillText(card || `${String(z).padStart(3, '0')}°`, x, HZ + 34);
      }
      g.strokeStyle = 'rgba(200,220,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, HZ); g.lineTo(720, HZ); g.stroke();
    }
    // Constellation figures.
    const A = window.Astronomy, obs = new A.Observer(lat, lon, 0), rot = A.Rotation_EQJ_EQD(date);
    const hz = (ra, dec) => { const eq = A.EquatorFromVector(A.RotateVector(rot, A.VectorFromSphere(new A.Spherical(dec, ra, 1), date))); return A.Horizon(date, obs, eq.ra, eq.dec); };
    g.strokeStyle = 'rgba(160,190,240,0.28)'; g.lineWidth = 1.2;
    for (const f of starsData.figures) for (const part of f.l) {
      g.beginPath();
      let pen = false;
      for (const [ra, dec] of part) {
        const h = hz(ra, dec);
        const pt = h.altitude < 0 ? null : proj(h.altitude, h.azimuth);
        if (!pt) { pen = false; continue; }
        const [x, y] = pt;
        if (pen) g.lineTo(x, y); else g.moveTo(x, y);
        pen = true;
      }
      g.stroke();
    }
    // Stars.
    const names = document.getElementById('sky-names').checked;
    for (const s of state.stars) {
      const pt = s.alt < 0 ? null : proj(s.alt, s.az);
      if (!pt) continue;
      const [x, y] = pt;
      const r = Math.max(0.8, 4.2 - s.mag * 0.75);
      g.fillStyle = bvColour(s.bv);
      g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill();
      if (s.nav != null && names) {
        g.fillStyle = 'rgba(235,242,255,0.9)'; g.font = '15px sans-serif'; g.textAlign = 'left';
        g.fillText(`${s.name}${s.nav ? ` ${s.nav}` : ''}`, x + r + 3, y);
      }
    }
    // Planets, Moon, Sun.
    for (const b of [...state.bodies, state.moon, state.sun]) {
      const pt = proj(b.alt, b.az);
      if (!pt) continue;
      const [x, y] = pt;
      const r = b.name === 'Moon' || b.name === 'Sun' ? 11 : 5.5;
      g.fillStyle = b.colour;
      g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill();
      if (b.name === 'Moon') {
        // Shade the dark part (roughly).
        g.fillStyle = 'rgba(10,18,38,0.85)';
        g.beginPath(); g.ellipse(x + (b.phase < 180 ? -1 : 1) * r * b.lit, y, r * Math.abs(1 - 2 * b.lit) || 0.1, r, 0, 0, 2 * Math.PI);
        if (b.lit < 0.5) g.fill();
      }
      g.fillStyle = b.colour; g.font = 'bold 16px sans-serif'; g.textAlign = 'left';
      g.fillText(b.name, x + r + 4, y);
    }
    if (picked) {
      const p = [...state.stars, ...state.bodies, state.moon, state.sun].find((s) => s.name === picked.name && s.kind === picked.kind && (s.kind === 'body' || (s.sha - picked.sha) ** 2 < 0.01));
      const pt = p && proj(p.alt, p.az);
      if (pt) {
        const [x, y] = pt;
        g.strokeStyle = '#ffd75e'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 14, 0, 2 * Math.PI); g.stroke();
      }
      showPick(p);
    }
    const z = zoneOf(lon);
    document.getElementById('sky-where').textContent = `${label} · ${zt(date, z)} ZT (zone ${zoneName(z)}) · ${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    const key = `${date.toISOString().slice(0, 10)}|${lat.toFixed(1)}|${lon.toFixed(1)}`;
    if (key !== todayKey) { todayKey = key; today = day(date, lat, lon); showDay(); }
    showList();
  }

  function showPick(p) {
    const el = document.getElementById('sky-pick');
    if (!p) { el.textContent = 'Tap a star or planet for its altitude and bearing.'; return; }
    const what = p.kind === 'star' ? (p.nav ? `navigational star ${p.nav}` : p.nav === 0 ? 'the pole star' : 'star') : p.name === 'Moon' ? `${moonName(p.phase)}, ${Math.round(p.lit * 100)}% lit` : p.name === 'Sun' ? 'the Sun' : 'navigational planet';
    const pos = p.kind === 'star' ? `SHA ${deg(p.sha)} · Dec ${p.dec < 0 ? 'S' : 'N'} ${deg(p.dec)}` : `GHA ${deg(p.gha)} · Dec ${p.dec < 0 ? 'S' : 'N'} ${deg(p.dec)}`;
    el.innerHTML = `<b>${esc(p.name || 'Star')}</b> <small>${esc(what)} · mag ${p.mag.toFixed(1)}</small><br>Hc ${altText(p.alt)} · Zn ${p.az.toFixed(1).padStart(5, '0')}° <small>${pos}</small>`;
  }

  function showDay() {
    const d = today, z = d.zone, f = (t) => (t ? zt(t, z) : '—');
    const pt = (x) => (x ? `${f(x.time)} <small>${x.az.toFixed(0).padStart(3, '0')}° ${compass(x.az)}</small>` : '<small>none today</small>');
    const QUARTERS = ['New Moon', 'First quarter', 'Full Moon', 'Last quarter'];
    const dayFmt = (t) => new Date(t.getTime() + z * 3600000).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    const m = state.moon;
    const soon = compute(new Date(when().getTime() + 600000), lat, lon).moon;
    const moving = m.alt > -0.5 ? `${soon.alt > m.alt ? 'climbing' : 'going down'} towards ${compass(soon.az > m.az ? Math.min(m.az + 45, 359) : Math.max(m.az - 45, 0))}` : 'below the horizon';
    // The Moon's path today, in time order.
    const path = [['Rises', d.moonRise], ['Highest', d.moonTransit], ['Sets', d.moonSet]].filter(([, x]) => x).sort((a, b) => a[1].time - b[1].time);
    document.getElementById('sky-day').innerHTML = `<div class="label">Sun today (zone ${zoneName(z)})</div>
      <table class="facts">
        <tr><th>Nautical twilight</th><td>${f(d.nautMorning)} · ${f(d.nautEvening)}</td></tr>
        <tr><th>Civil twilight</th><td>${f(d.civilMorning)} · ${f(d.civilEvening)}</td></tr>
        <tr><th>Sunrise</th><td>${pt(d.sunRise)}</td></tr>
        <tr><th>Noon (meridian passage)</th><td>${d.sunTransit ? `${f(d.sunTransit.time)} <small>altitude ${altText(d.sunTransit.alt)}, bearing ${d.sunTransit.az.toFixed(0).padStart(3, '0')}°</small>` : '—'}</td></tr>
        <tr><th>Sunset</th><td>${pt(d.sunSet)}</td></tr>
      </table>
      <div class="label">Moon</div>
      <table class="facts">
        <tr><th>Phase</th><td>${moonName(m.phase)}, ${Math.round(m.lit * 100)}% lit</td></tr>
        <tr><th>Now</th><td>${m.alt > -0.5 ? `altitude ${altText(m.alt)}, bearing ${m.az.toFixed(0).padStart(3, '0')}°, ${moving}` : 'below the horizon'}</td></tr>
        ${path.map(([what, x]) => `<tr><th>${what}</th><td>${what === 'Highest' ? `${f(x.time)} <small>${altText(x.alt)} up, bearing ${x.az.toFixed(0).padStart(3, '0')}° ${compass(x.az)}</small>` : pt(x)}</td></tr>`).join('')}
        <tr><th>Path</th><td><small>${moonPath(d)}</small></td></tr>
        ${d.phases.map((p) => `<tr><th>${QUARTERS[p.quarter]}</th><td>${dayFmt(p.time)} ${f(p.time)}</td></tr>`).join('')}
      </table>
      <div class="note">Times in zone time, bearings true. The Moon rises about 50 minutes later each day and moves east among the stars by about 13° a day.</div>`;
  }

  // Navigational stars and planets well placed for sights (15° to 70°).
  function showList() {
    const rows = [...state.stars.filter((s) => s.nav), ...state.bodies]
      .filter((s) => s.alt >= 15 && s.alt <= 70 && (view === 'up' || Math.abs(((s.az - view + 540) % 360) - 180) <= HALF))
      .sort((a, b) => a.az - b.az);
    document.getElementById('sky-list').innerHTML = `<div class="label">Good for sights now (15° to 70°${view === 'up' ? '' : `, looking ${{ 0: 'north', 90: 'east', 180: 'south', 270: 'west' }[view]}`})</div>${rows.length
      ? `<table class="facts sky-table"><tr><th>Body</th><th>Hc</th><th>Zn</th><th>Mag</th></tr>${rows.map((s) => `<tr><td>${esc(s.name)}${s.nav ? ` <small>${s.nav}</small>` : ''}</td><td>${altText(s.alt)}</td><td>${s.az.toFixed(0).padStart(3, '0')}°</td><td>${s.mag.toFixed(1)}</td></tr>`).join('')}</table>`
      : '<div class="note">None at this time.</div>'}`;
  }

  slider.oninput = () => { offset = +slider.value; draw(); };
  for (const b of document.querySelectorAll('[data-go]')) {
    b.onclick = () => {
      const go = b.dataset.go;
      let t = null;
      if (go === 'evening' && today.civilEvening && today.nautEvening) t = new Date((today.civilEvening.getTime() + today.nautEvening.getTime()) / 2);
      if (go === 'morning' && today.civilMorning && today.nautMorning) t = new Date((today.civilMorning.getTime() + today.nautMorning.getTime()) / 2);
      if (go === 'morning' && t && t < base) {
        // Tomorrow's morning twilight.
        const next = day(new Date(base.getTime() + 86400000), lat, lon);
        if (next.civilMorning && next.nautMorning) t = new Date((next.civilMorning.getTime() + next.nautMorning.getTime()) / 2);
      }
      offset = t ? Math.round((t - base) / 60000) : 0;
      slider.value = Math.max(-720, Math.min(1440, offset));
      draw();
    };
  }
  document.getElementById('sky-names').onchange = draw;
  for (const b of document.querySelectorAll('[data-view]')) {
    b.onclick = () => {
      view = b.dataset.view === 'up' ? 'up' : +b.dataset.view;
      for (const o of document.querySelectorAll('[data-view]')) o.classList.toggle('active', o === b);
      draw();
    };
  }
  canvas.onclick = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * 720 / r.width, y = (e.clientY - r.top) * 720 / r.height;
    let best = null, bestD = 30 ** 2;
    for (const s of [...state.stars, ...state.bodies, state.moon, state.sun]) {
      const pt = s.alt < 0 ? null : proj(s.alt, s.az);
      if (!pt) continue;
      const [sx, sy] = pt;
      const d = (sx - x) ** 2 + (sy - y) ** 2 - (s.kind === 'body' || s.nav ? 200 : 0);
      if (d < bestD) { bestD = d; best = s; }
    }
    picked = best;
    draw();
  };
  draw();
}
