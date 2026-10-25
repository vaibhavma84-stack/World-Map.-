// Things at sea, offline: lighthouses and major lights (with their light
// played as it flashes), named undersea features, submarine cables and
// pipelines (separate switches), and oil and gas platforms and wind farms.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const SEA_GROUPS = {
  lights: ['sea-lights', 'sea-lights-names'],
  seabed: ['sea-seabed'],
  telecom: ['sea-telecom'],
  pipelines: ['sea-pipelines', 'sea-power'],
  offshore: ['sea-offshore'],
};
const LIGHT_COLOUR = { W: '#fff6b0', R: '#ff3b30', G: '#2ecc40', Y: '#ffcc00', B: '#4d79ff', O: '#ff9f1a', V: '#b37dff' };

const load = (f) => fetch(`data/${f}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);

function flareImage() {
  // The chart's light flare: a magenta teardrop.
  const s = 2, w = 18 * s, h = 18 * s;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.translate(w / 2, h / 2); g.rotate(Math.PI / 4);
  g.beginPath(); g.moveTo(0, 7 * s); g.quadraticCurveTo(-5 * s, -2 * s, 0, -7 * s); g.quadraticCurveTo(5 * s, -2 * s, 0, 7 * s);
  g.fillStyle = '#d6249f'; g.strokeStyle = '#fff'; g.lineWidth = 1.2 * s; g.fill(); g.stroke();
  return g.getImageData(0, 0, w, h);
}
function rigImage(wind) {
  const s = 2, w = 16 * s, h = 16 * s;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.strokeStyle = wind ? '#2b6cb0' : '#444'; g.fillStyle = '#fff'; g.lineWidth = 1.6 * s;
  if (wind) {
    g.beginPath(); g.moveTo(w / 2, h - s); g.lineTo(w / 2, h / 2); g.stroke();
    for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * 6.5 * s, h / 2 + Math.sin(a) * 6.5 * s); g.stroke(); }
  } else {
    g.fillRect(3 * s, 3 * s, w - 6 * s, h - 6 * s); g.strokeRect(3 * s, 3 * s, w - 6 * s, h - 6 * s);
    g.beginPath(); g.arc(w / 2, h / 2, 2 * s, 0, 2 * Math.PI); g.fillStyle = '#444'; g.fill();
  }
  return g.getImageData(0, 0, w, h);
}

export async function addSeaFeatures(map, before, labelsBefore) {
  const [lights, seabed, cables, offshore] = await Promise.all(['lights', 'seabed', 'cables', 'offshore'].map(load));
  if (cables?.features?.length) {
    map.addSource('sea-cables', { type: 'geojson', data: cables, tolerance: 0.6 });
    map.addLayer({ id: 'sea-telecom', type: 'line', source: 'sea-cables', minzoom: 1.5, filter: ['==', ['get', 'k'], 'telecom'], paint: { 'line-color': '#9f7aea', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 8, 1.2], 'line-opacity': 0.4 } }, before);
    map.addLayer({ id: 'sea-pipelines', type: 'line', source: 'sea-cables', minzoom: 4, filter: ['==', ['get', 'k'], 'pipeline'], paint: { 'line-color': '#c05621', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 10, 2.2], 'line-dasharray': [3, 1.5] } }, before);
    map.addLayer({ id: 'sea-power', type: 'line', source: 'sea-cables', minzoom: 4, filter: ['==', ['get', 'k'], 'power'], paint: { 'line-color': '#d69e2e', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.8], 'line-dasharray': [1, 1.5] } }, before);
  }
  if (offshore?.features?.length) {
    map.addImage('sea-rig', rigImage(false), { pixelRatio: 2 });
    map.addImage('sea-wind', rigImage(true), { pixelRatio: 2 });
    map.addSource('sea-offshore', { type: 'geojson', data: offshore });
    map.addLayer({
      id: 'sea-offshore', type: 'symbol', source: 'sea-offshore', minzoom: 5,
      layout: { 'icon-image': ['match', ['get', 'k'], 'wind', 'sea-wind', 'sea-rig'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.55, 10, 1], 'icon-allow-overlap': true,
        'text-field': ['step', ['zoom'], '', 9, ['get', 'n']], 'text-font': ['OpenSans-Regular'], 'text-size': 10, 'text-offset': [0, 1.1], 'text-optional': true },
      paint: { 'text-color': '#2d3748', 'text-halo-color': '#fff', 'text-halo-width': 1.4 },
    }, labelsBefore);
  }
  if (seabed?.features?.length) {
    map.addSource('sea-seabed', { type: 'geojson', data: seabed });
    map.addLayer({
      id: 'sea-seabed', type: 'symbol', source: 'sea-seabed', minzoom: 2,
      filter: ['any', ['>=', ['zoom'], 5], ['match', ['get', 'k'], ['trench', 'ridge', 'abyssal plain', 'basin', 'plateau', 'fracture zone'], true, false]],
      layout: { 'text-field': ['get', 'n'], 'text-font': ['OpenSans-Italic'], 'text-size': ['interpolate', ['linear'], ['zoom'], 2, 10, 7, 12.5], 'text-max-width': 8, 'text-padding': 6, 'text-letter-spacing': 0.04 },
      paint: { 'text-color': '#1c3d6e', 'text-halo-color': 'rgba(210,230,245,0.85)', 'text-halo-width': 1.3 },
    }, labelsBefore);
  }
  if (lights?.features?.length) {
    map.addImage('sea-flare', flareImage(), { pixelRatio: 2 });
    map.addSource('sea-lights', { type: 'geojson', data: lights });
    map.addLayer({
      id: 'sea-lights', type: 'symbol', source: 'sea-lights', minzoom: 5,
      // Major lights from zoom 5, minor ones from zoom 9.
      filter: ['any', ['==', ['get', 'maj'], 1], ['>=', ['zoom'], 9]],
      layout: { 'icon-image': 'sea-flare', 'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 11, 1], 'icon-allow-overlap': true, 'icon-anchor': 'bottom-left' },
    }, labelsBefore);
    map.addLayer({
      id: 'sea-lights-names', type: 'symbol', source: 'sea-lights', minzoom: 8, filter: ['all', ['has', 'ch'], ['any', ['==', ['get', 'maj'], 1], ['>=', ['zoom'], 11]]],
      layout: { 'text-field': ['get', 'ch'], 'text-font': ['OpenSans-Semibold'], 'text-size': 10.5, 'text-anchor': 'left', 'text-offset': [1, -0.6], 'text-optional': true },
      paint: { 'text-color': '#97266d', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
    }, labelsBefore);
  }
}

// -------------------------------------------------------- the light, played
// On/off steps (seconds) for one period of a light's character.
export function rhythm(ch, group, period) {
  const c = (ch || '').replace(/\./g, '');
  const groups = String(group || '1').split('+').map((n) => Number(n) || 1);
  const steps = [];
  const flashes = (n, on, off) => { for (let i = 0; i < n; i++) steps.push([1, on], [0, off]); };
  if (/^F$/.test(c)) return [[1, 1]];
  const m = c.match(/^Mo\(?([A-Z0-9])/);
  if (m) {
    const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', U2: '' };
    for (const d of MORSE[m[1]] || '.-') steps.push([1, d === '.' ? 0.5 : 1.5], [0, 0.5]);
  } else if (/^Iso/.test(c)) {
    const p = period || 4;
    return [[1, p / 2], [0, p / 2]];
  } else if (/^Oc/.test(c)) {
    groups.forEach((n, gi) => { for (let i = 0; i < n; i++) steps.push([0, 1], [1, 1]); if (gi < groups.length - 1) steps.push([1, 2]); });
    const used = steps.reduce((t, s) => t + s[1], 0);
    steps.unshift([1, Math.max(1, (period || used + 3) - used)]);
    return steps;
  } else if (/^VQ/.test(c)) {
    groups.forEach((n, gi) => { flashes(n, 0.2, 0.3); if (gi < groups.length - 1) steps.push([0, 1.5]); });
    if (/LFl/.test(c)) steps.push([1, 2], [0, 1]);
  } else if (/^Q/.test(c)) {
    groups.forEach((n, gi) => { flashes(n, 0.3, 0.7); if (gi < groups.length - 1) steps.push([0, 1.5]); });
    if (/LFl/.test(c)) steps.push([1, 2], [0, 1]);
  } else if (/^LFl/.test(c)) {
    groups.forEach((n, gi) => { flashes(n, 2, 1.5); if (gi < groups.length - 1) steps.push([0, 2]); });
  } else {
    // Fl and anything else: short flashes.
    groups.forEach((n, gi) => { flashes(n, 0.5, 1); if (gi < groups.length - 1) steps.push([0, 2]); });
  }
  const used = steps.reduce((t, s) => t + s[1], 0);
  const p = period || (/^(VQ|Q)/.test(c) && groups.length === 1 && groups[0] === 1 ? used : used + 2);
  if (p > used) steps.push([0, p - used]);
  return steps;
}

export function lightCard(p, position) {
  return `<h1>🗼 ${esc(p.n || 'Light')}</h1>
    <p class="sub">${p.maj ? 'Lighthouse / major light' : 'Light'} · ${esc(position)}</p>
    <div class="cards"><div class="card light-card">
      <canvas id="light-show" width="160" height="160" aria-label="The light as it shows"></canvas>
      <div><div class="big">${esc(p.ch || 'Character not recorded')}</div>
      <div class="note">Played in real time from its character${p.p ? ` (period ${p.p} s)` : ''}. From OpenStreetMap’s seamarks; check the List of Lights and the chart.</div></div>
    </div></div>`;
}
export function playLight(p) {
  const canvas = document.getElementById('light-show');
  if (!canvas || !p.c) return;
  const g = canvas.getContext('2d');
  const steps = rhythm(p.c, p.gr, p.p);
  const total = steps.reduce((t, s) => t + s[1], 0);
  const colours = (p.col || 'W').match(/Bu|Or|Vi|[WRGY]/g) || ['W'];
  const alternate = /^Al/.test(p.c || '');
  const start = performance.now();
  const frame = (now) => {
    if (!document.body.contains(canvas)) return;
    const t = ((now - start) / 1000) % total;
    const cycle = Math.floor((now - start) / 1000 / total);
    let acc = 0, on = false, idx = 0;
    for (const [state, d] of steps) { if (t < acc + d) { on = !!state; break; } acc += d; if (state) idx++; }
    const colour = LIGHT_COLOUR[(alternate ? colours[(idx + cycle) % colours.length] : colours[0])[0]] || LIGHT_COLOUR.W;
    g.fillStyle = '#071226'; g.fillRect(0, 0, 160, 160);
    if (on) {
      const glow = g.createRadialGradient(80, 80, 4, 80, 80, 70);
      glow.addColorStop(0, colour); glow.addColorStop(0.25, colour); glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(80, 80, 70, 0, 2 * Math.PI); g.fill();
    } else {
      g.fillStyle = '#1b2740'; g.beginPath(); g.arc(80, 80, 10, 0, 2 * Math.PI); g.fill();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function seaFeatureCard(layer, p, position) {
  if (layer === 'sea-offshore') {
    return `<h1>${p.k === 'wind' ? '🌬️' : '🛢️'} ${esc(p.n || (p.k === 'wind' ? 'Offshore wind farm' : 'Offshore platform'))}</h1>
      <p class="sub">${p.k === 'wind' ? 'Offshore wind farm' : 'Oil or gas platform'} · ${esc(position)}</p>
      <div class="cards"><div class="card"><table class="facts">${[['Operator', p.op], ['Product', p.pr]].filter(([, v]) => v).map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('') || '<tr><td>No more details recorded.</td></tr>'}</table>
      <div class="note">From OpenStreetMap. Platforms usually have a 500 m safety zone: keep clear.</div></div></div>`;
  }
  if (layer === 'sea-seabed') {
    return `<h1>${esc(p.n)}</h1><p class="sub">Undersea feature: ${esc(p.k)} · ${esc(position)}</p>
      <div class="cards"><div class="card"><div class="note">Named feature of the seafloor (Wikidata). See the depth shading for its shape.</div></div></div>`;
  }
  const kind = { telecom: 'Submarine telecom cable', pipeline: 'Submarine pipeline', power: 'Submarine power cable' }[p.k] || 'Cable';
  return `<h1>${esc(p.n || kind)}</h1><p class="sub">${kind}${p.pr ? ` · ${esc(p.pr)}` : ''}</p>
    <div class="cards"><div class="card"><div class="note">Do not anchor or trawl near submarine cables and pipelines. Routes as published (TeleGeography for telecom cables, OpenStreetMap for pipelines and power cables), approximate: use the chart.</div></div></div>`;
}
