// Moving streamlines over the map: wind, waves or current flowing, from the
// weather forecast kept on the phone (so it plays at sea from the last
// download), and a Play button that runs through the 3 days.

const RAD = Math.PI / 180;
const SCALE = {
  wind: { stops: [[0, '#7ec8e3'], [10, '#56b870'], [20, '#f2c94c'], [30, '#f2994a'], [40, '#eb5757'], [60, '#9b51e0']], speed: 0.08 },
  waves: { stops: [[0, '#7ec8e3'], [1, '#56b870'], [2.5, '#f2c94c'], [4, '#f2994a'], [6, '#eb5757'], [9, '#9b51e0']], speed: 0.5 },
  current: { stops: [[0, '#a0d8ef'], [0.5, '#56b870'], [1, '#f2c94c'], [2, '#f2994a'], [3, '#eb5757']], speed: 1.5 },
};
function colour(kind, v) {
  const s = SCALE[kind].stops;
  for (let i = s.length - 1; i >= 0; i--) if (v >= s[i][0]) return s[i][1];
  return s[0][1];
}

export function setupFlow(map, wx, { button, kindSelect, playButton }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'flow-canvas';
  map.getCanvasContainer().appendChild(canvas);
  const g = canvas.getContext('2d');
  let on = false, kind = 'wind', particles = [], raf = 0, playing = null, frac = 0;

  const size = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = map.getCanvas().getBoundingClientRect();
    canvas.width = r.width * dpr; canvas.height = r.height * dpr;
    canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  // The flow at a place: bilinear on the forecast grid, between two hours.
  const field = () => {
    const d = wx.data();
    if (!d?.points?.length) return null;
    const { nx, ny, points } = d;
    const lon0 = points[0].lon, lat0 = points[0].lat;
    const dLon = nx > 1 ? points[1].lon - lon0 : 1, dLat = ny > 1 ? points[nx].lat - lat0 : 1;
    const key = kind === 'wind' ? ['wind', 'windDir', true] : kind === 'waves' ? ['waves', 'wavesDir', true] : ['current', 'currentDir', false];
    const s0 = wx.step(), s1 = Math.min(d.times.length - 1, s0 + 1);
    const vec = (p, s) => {
      const v = p[key[0]]?.[s], dir = p[key[1]]?.[s];
      if (v == null || dir == null) return null;
      const to = (key[2] ? dir + 180 : dir) * RAD; // wind and waves are given as where they come from
      return [v * Math.sin(to), v * Math.cos(to), v];
    };
    return (lon, lat) => {
      let x = (lon - lon0) / dLon, y = (lat - lat0) / dLat;
      if (x < 0 || y < 0 || x > nx - 1 || y > ny - 1) return null;
      const i = Math.min(nx - 2, Math.floor(x)), j = Math.min(ny - 2, Math.floor(y));
      const u = x - i, w = y - j;
      let ue = 0, vn = 0, sp = 0, wt = 0;
      for (const [di, dj, k] of [[0, 0, (1 - u) * (1 - w)], [1, 0, u * (1 - w)], [0, 1, (1 - u) * w], [1, 1, u * w]]) {
        const p = points[(j + dj) * nx + (i + di)];
        if (!p) continue;
        const a = vec(p, s0), b = vec(p, s1);
        if (!a) continue;
        const m = b ? [a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac, a[2] + (b[2] - a[2]) * frac] : a;
        ue += m[0] * k; vn += m[1] * k; sp += m[2] * k; wt += k;
      }
      return wt > 0.25 ? [ue / wt, vn / wt, sp / wt] : null;
    };
  };

  const seed = () => {
    const r = map.getCanvas().getBoundingClientRect();
    const n = Math.round(Math.min(2500, (r.width * r.height) / 260));
    particles = Array.from({ length: n }, () => ({ x: Math.random() * r.width, y: Math.random() * r.height, age: Math.random() * 80 }));
  };

  let f = null;
  const frame = () => {
    raf = requestAnimationFrame(frame);
    if (!f) return;
    const r = map.getCanvas().getBoundingClientRect();
    // Fade the trails.
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = 'rgba(0,0,0,0.92)';
    g.fillRect(0, 0, r.width, r.height);
    g.globalCompositeOperation = 'source-over';
    g.lineWidth = 1.3;
    // A steady speed on the screen: so many pixels a frame per knot (or metre of wave).
    const k = SCALE[kind].speed;
    for (const p of particles) {
      const ll = map.unproject([p.x, p.y]);
      const v = f(ll.lng, ll.lat);
      p.age++;
      if (!v || p.age > 90) { p.x = Math.random() * r.width; p.y = Math.random() * r.height; p.age = 0; continue; }
      const nx = p.x + v[0] * k;
      const ny = p.y - v[1] * k;
      g.strokeStyle = colour(kind, v[2]);
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(nx, ny); g.stroke();
      p.x = nx; p.y = ny;
      if (p.x < 0 || p.y < 0 || p.x > r.width || p.y > r.height) { p.x = Math.random() * r.width; p.y = Math.random() * r.height; p.age = 0; }
    }
  };
  const restart = () => { g.clearRect(0, 0, canvas.width, canvas.height); f = field(); };

  const set = (v) => {
    on = v;
    button.classList.toggle('active', on);
    canvas.hidden = !on;
    cancelAnimationFrame(raf);
    if (!on) { stopPlay(); return; }
    if (!wx.data()) { alert('No forecast on this phone yet: turn the weather on once with a connection; it is kept for use at sea.'); set(false); return; }
    size(); seed(); restart(); frame();
  };
  const stopPlay = () => { clearInterval(playing); playing = null; if (playButton) playButton.textContent = '▶ Play 3 days'; };
  map.on('movestart', () => { if (on) g.clearRect(0, 0, canvas.width, canvas.height); });
  map.on('moveend', () => { if (on) { size(); seed(); restart(); } });
  addEventListener('resize', () => { if (on) { size(); seed(); } });
  button.onclick = () => set(!on);
  kindSelect.onchange = () => { kind = kindSelect.value; if (on) restart(); };
  if (playButton) {
    playButton.onclick = () => {
      if (playing) { stopPlay(); return; }
      if (!on) set(true);
      const d = wx.data();
      if (!d) return;
      playButton.textContent = '❚❚ Pause';
      const last = Math.min(d.times.length - 1, 71);
      playing = setInterval(() => {
        frac += 0.1;
        if (frac >= 1) {
          frac = 0;
          const next = wx.step() + 1 > last ? 0 : wx.step() + 1;
          wx.setStep(next);
        }
        f = field();
      }, 100);
    };
  }
  return { set, isOn: () => on };
}
