// The view from space: zoom out past the whole world and see the Earth and
// the Moon where they are now, the Sun's direction, then the planets round
// the Sun. Looking down on the plane of the Earth's orbit from the north;
// positions from Astronomy Engine. Distances to scale; the Earth and Moon
// drawn larger than life unless “true sizes” is ticked.

const AU_KM = 149597870.7;
const EARTH_R = 6371 / AU_KM, MOON_R = 1737.4 / AU_KM, SUN_R = 695700 / AU_KM;
const PLANETS = [
  ['Mercury', 0.387, '#b5b0a8'], ['Venus', 0.723, '#e8d6a0'], ['Mars', 1.524, '#e07a50'], ['Jupiter', 5.203, '#d9b38c'],
  ['Saturn', 9.537, '#e6d08a'], ['Uranus', 19.19, '#9fd6e0'], ['Neptune', 30.07, '#6f8fe0'],
];
const OBLIQUITY = 23.4393 * Math.PI / 180;

async function loadAstronomy() {
  if (window.Astronomy) return;
  await new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'vendor/astronomy.min.js';
    s.onload = ok;
    s.onerror = fail;
    document.head.appendChild(s);
  });
}

// The land, coarsely: a few points per coast, enough for a small globe.
function coarseLand(countries) {
  const rings = [];
  for (const f of countries.features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      const ring = poly[0];
      let minX = 180, maxX = -180, minY = 90, maxY = -90;
      for (const [x, y] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      if ((maxX - minX) * (maxY - minY) < 0.5) continue;
      const step = Math.max(1, Math.floor(ring.length / 80));
      const out = [];
      for (let i = 0; i < ring.length; i += step) out.push(ring[i]);
      rings.push(out);
    }
  }
  return rings;
}

export function openSpace({ countries, here, onClose }) {
  let land = null;
  const box = document.createElement('div');
  box.className = 'space';
  box.innerHTML = `<canvas></canvas>
    <div class="space-top"><button type="button" class="primary" data-act="back">‹ Back to the map</button><span class="space-title">The Earth, Moon and Sun now</span></div>
    <div class="space-info"></div>
    <div class="space-bottom">
      <input type="range" min="-720" max="720" step="1" value="0" aria-label="Time, hours from now">
      <div class="space-row"><button type="button" class="secondary" data-act="now">Now</button><button type="button" class="secondary" data-act="play">▶ Play</button>
        <label><input type="checkbox" data-act="true"> True sizes</label>
        <button type="button" class="secondary" data-act="out">−</button><button type="button" class="secondary" data-act="in">+</button></div>
    </div>`;
  document.body.appendChild(box);
  const canvas = box.querySelector('canvas');
  const g = canvas.getContext('2d');
  const info = box.querySelector('.space-info');
  const slider = box.querySelector('input[type=range]');
  let hours = 0, playing = null, trueSize = false;
  // Pixels per AU, on a log scale from the Earth and Moon to beyond Neptune.
  const MAX = 1.6e5, MIN = 9;
  let scale = 1.1e5;
  let fitted = false;
  const stars = Array.from({ length: 260 }, () => [Math.random(), Math.random(), Math.random() * 1.3 + 0.2]);

  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  function draw() {
    const A = window.Astronomy;
    const date = new Date(Date.now() + hours * 3600000);
    const rot = A.Rotation_EQJ_ECL();
    const ecl = (v) => A.RotateVector(rot, v);
    const earth = ecl(A.HelioVector(A.Body.Earth, date));
    const moonGeo = ecl(A.GeoMoon(date));
    const W = innerWidth, H = innerHeight;
    // Start with the Moon's whole orbit on the screen.
    if (!fitted) { fitted = true; scale = Math.min(MAX, 0.4 * Math.min(W, H) / Math.hypot(moonGeo.x, moonGeo.y)); }
    // Centre on the Earth close in, on the Sun far out.
    const t = Math.min(1, Math.max(0, (Math.log(scale) - Math.log(400)) / (Math.log(30000) - Math.log(400))));
    const cx = earth.x * t, cy = earth.y * t;
    const P = (x, y) => [W / 2 + (x - cx) * scale, H / 2 - (y - cy) * scale];

    g.fillStyle = '#02040a';
    g.fillRect(0, 0, W, H);
    for (const [x, y, r] of stars) { g.fillStyle = `rgba(255,255,255,${0.25 + r * 0.4})`; g.fillRect(x * W, y * H, r, r); }

    // Orbits and planets.
    const [sx, sy] = P(0, 0);
    g.lineWidth = 1;
    for (const [name, a, colour] of [...PLANETS.slice(0, 2), ['Earth', 1.0, '#5aa0ff'], ...PLANETS.slice(2)]) {
      const r = a * scale;
      if (r < 6 || r > 40 * Math.max(W, H)) continue;
      g.strokeStyle = name === 'Earth' ? 'rgba(90,160,255,0.35)' : 'rgba(255,255,255,0.12)';
      g.beginPath(); g.arc(sx, sy, r, 0, 2 * Math.PI); g.stroke();
      if (name === 'Earth') continue;
      const v = ecl(A.HelioVector(A.Body[name], date));
      const [x, y] = P(v.x, v.y);
      g.fillStyle = colour; g.beginPath(); g.arc(x, y, name === 'Jupiter' || name === 'Saturn' ? 5 : 3.5, 0, 2 * Math.PI); g.fill();
      if (name === 'Saturn') { g.strokeStyle = colour; g.beginPath(); g.ellipse(x, y, 9, 3, -0.4, 0, 2 * Math.PI); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '12px sans-serif'; g.textAlign = 'left'; g.fillText(name, x + 7, y - 6);
    }
    // The Sun, or an arrow towards it when it is off the screen.
    const sunPx = Math.max(SUN_R * scale, 7);
    if (sx > -sunPx && sx < W + sunPx && sy > -sunPx && sy < H + sunPx) {
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, sunPx * 3);
      glow.addColorStop(0, 'rgba(255,230,140,1)'); glow.addColorStop(0.33, 'rgba(255,200,80,0.9)'); glow.addColorStop(1, 'rgba(255,160,40,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(sx, sy, sunPx * 3, 0, 2 * Math.PI); g.fill();
      g.fillStyle = 'rgba(255,240,200,0.85)'; g.font = '13px sans-serif'; g.textAlign = 'center'; g.fillText('Sun', sx, sy + sunPx + 16);
    } else {
      const ang = Math.atan2(sy - H / 2, sx - W / 2);
      const ex = W / 2 + Math.cos(ang) * (Math.min(W, H) / 2 - 40), ey = H / 2 + Math.sin(ang) * (Math.min(W, H) / 2 - 40);
      g.fillStyle = 'rgba(255,214,90,0.9)';
      g.save(); g.translate(ex, ey); g.rotate(ang);
      g.beginPath(); g.moveTo(14, 0); g.lineTo(-6, -8); g.lineTo(-6, 8); g.closePath(); g.fill(); g.restore();
      g.font = '13px sans-serif'; g.textAlign = 'center'; g.fillText('to the Sun', ex - Math.cos(ang) * 30, ey - Math.sin(ang) * 30);
    }

    // The Moon's orbit, the Earth and the Moon.
    const [exp, eyp] = P(earth.x, earth.y);
    const moonDist = Math.hypot(moonGeo.x, moonGeo.y);
    const big = trueSize ? 1 : 10; // larger than life, but still well inside the Moon's orbit
    const er = Math.max(EARTH_R * scale * big, 2.5), mr = Math.max(MOON_R * scale * big, 1.5);
    if (moonDist * scale > 12) {
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.setLineDash([4, 5]);
      g.beginPath(); g.arc(exp, eyp, moonDist * scale, 0, 2 * Math.PI); g.stroke(); g.setLineDash([]);
    }
    const toSun = Math.atan2(-earth.y, -earth.x); // direction to the Sun, in the ecliptic
    drawEarth(exp, eyp, er, toSun, date);
    if (moonDist * scale > er + 4) {
      const [mx, my] = P(earth.x + moonGeo.x, earth.y + moonGeo.y);
      drawLit(mx, my, mr, toSun, '#d8d4c8', '#25231f');
      g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillText('Moon', mx + mr + 6, my + 4);
    }
    if (scale < 3000) { g.fillStyle = 'rgba(160,200,255,0.9)'; g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillText('Earth', exp + er + 6, eyp + 4); }

    // What is shown.
    const phase = A.MoonPhase(date);
    const lit = A.Illumination(A.Body.Moon, date).phase_fraction;
    const km = Math.round(Math.hypot(moonGeo.x, moonGeo.y, moonGeo.z) * AU_KM);
    const sunKm = Math.hypot(earth.x, earth.y, earth.z) * AU_KM;
    info.innerHTML = `<b>${date.toISOString().slice(0, 16).replace('T', ' ')} UTC</b>${hours ? ` <small>(${hours > 0 ? '+' : ''}${Math.round(hours)} h)</small>` : ''}<br>
      Moon ${km.toLocaleString()} km away, ${Math.round(lit * 100)}% lit (${phaseName(phase)})<br>
      Sun ${(sunKm / 1e6).toFixed(1)} million km away<br>
      <small>${trueSize ? 'True sizes' : 'Earth and Moon drawn larger than life'}; distances to scale. Pinch or scroll to zoom out to the planets.</small>`;
  }

  function drawLit(x, y, r, toSun, day, night) {
    g.fillStyle = night; g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill();
    // Seen from above, the line between day and night is a diameter.
    const a = -toSun; // screen y is down
    g.fillStyle = day; g.beginPath(); g.arc(x, y, r, a - Math.PI / 2, a + Math.PI / 2); g.closePath(); g.fill();
  }

  // The Earth as seen from above the north of its orbit, turned to the time.
  function drawEarth(x, y, r, toSun, date) {
    const A = window.Astronomy;
    g.fillStyle = '#1f5fa8'; g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill();
    if (r > 10 && land) {
      const gast = A.SiderealTime(date) * 15 * Math.PI / 180;
      const cosE = Math.cos(OBLIQUITY), sinE = Math.sin(OBLIQUITY);
      const pt = (lon, lat) => {
        const la = lat * Math.PI / 180, lo = lon * Math.PI / 180 + gast;
        const ex = Math.cos(la) * Math.cos(lo), ey = Math.cos(la) * Math.sin(lo), ez = Math.sin(la);
        const yy = ey * cosE + ez * sinE, zz = -ey * sinE + ez * cosE;
        return [x + ex * r, y - yy * r, zz];
      };
      g.save(); g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.clip();
      g.fillStyle = '#7fa86a';
      for (const ring of land) {
        g.beginPath();
        let any = false;
        for (const [lon, lat] of ring) {
          const [px, py, pz] = pt(lon, lat);
          if (pz < -0.05) continue;
          if (any) g.lineTo(px, py); else { g.moveTo(px, py); any = true; }
        }
        if (any) g.fill();
      }
      // Where you are.
      if (here) {
        const [hx, hy, hz] = pt(here.lon, here.lat);
        if (hz > 0) { g.fillStyle = '#ff3b6b'; g.beginPath(); g.arc(hx, hy, Math.max(3, r / 30), 0, 2 * Math.PI); g.fill(); }
      }
      g.restore();
    }
    // Night side.
    const a = -toSun;
    g.fillStyle = 'rgba(0,4,16,0.62)';
    g.beginPath(); g.arc(x, y, r, a + Math.PI / 2, a + 3 * Math.PI / 2); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(140,190,255,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r + 1, 0, 2 * Math.PI); g.stroke();
  }

  const zoom = (f) => {
    scale = Math.max(MIN, Math.min(MAX * 1.6, scale * f));
    if (scale > MAX * 1.5) { close(); return; } // zoomed back in: return to the map
    draw();
  };
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.exp(-e.deltaY * 0.002)); }, { passive: false });
  let pinch = null;
  canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !pinch) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    zoom(d / pinch);
    pinch = d;
  }, { passive: true });
  canvas.addEventListener('touchend', () => { pinch = null; }, { passive: true });

  const close = () => {
    clearInterval(playing);
    removeEventListener('resize', onResize);
    box.remove();
    onClose?.();
  };
  const onResize = () => { size(); draw(); };
  addEventListener('resize', onResize);
  box.querySelector('[data-act=back]').onclick = close;
  box.querySelector('[data-act=now]').onclick = () => { hours = 0; slider.value = 0; draw(); };
  box.querySelector('[data-act=in]').onclick = () => zoom(2.5);
  box.querySelector('[data-act=out]').onclick = () => zoom(0.4);
  box.querySelector('[data-act=true]').onchange = (e) => { trueSize = e.target.checked; draw(); };
  slider.oninput = () => { hours = +slider.value; draw(); };
  box.querySelector('[data-act=play]').onclick = (e) => {
    if (playing) { clearInterval(playing); playing = null; e.target.textContent = '▶ Play'; return; }
    e.target.textContent = '❚❚ Pause';
    playing = setInterval(() => {
      hours = hours >= 720 ? -720 : hours + 2;
      slider.value = hours;
      draw();
    }, 50);
  };

  size();
  info.textContent = 'Loading…';
  loadAstronomy().then(() => {
    land = coarseLand(countries);
    draw();
  }, () => { info.textContent = 'Could not load the astronomy data.'; });
  return { close };
}

function phaseName(p) {
  if (p < 10 || p > 350) return 'new';
  if (p < 80) return 'waxing crescent';
  if (p < 100) return 'first quarter';
  if (p < 170) return 'waxing gibbous';
  if (p < 190) return 'full';
  if (p < 260) return 'waning gibbous';
  if (p < 280) return 'last quarter';
  return 'waning crescent';
}
