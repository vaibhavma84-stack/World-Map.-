// Ships from the ship's own AIS, offline: the Android app listens to the AIS
// receiver's NMEA feed on the bridge network (TCP or UDP, often port 10110,
// from the AIS unit, a pilot plug Wi-Fi bridge or a multiplexer) and this
// decodes it: positions (types 1, 2, 3, 18, 19), names and voyage data
// (types 5, 24). Ships not heard for 20 minutes are dropped.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ------------------------------------------------------------- the decoder
function bits(payload) {
  let out = '';
  for (const ch of payload) {
    let v = ch.charCodeAt(0) - 48;
    if (v > 40) v -= 8;
    out += v.toString(2).padStart(6, '0');
  }
  return out;
}
const uint = (b, start, len) => parseInt(b.substr(start, len), 2);
const int = (b, start, len) => {
  const v = uint(b, start, len);
  return b[start] === '1' ? v - 2 ** len : v;
};
const text = (b, start, len) => {
  let s = '';
  for (let i = 0; i + 6 <= len; i += 6) {
    const c = uint(b, start + i, 6);
    s += String.fromCharCode(c < 32 ? c + 64 : c);
  }
  return s.replace(/@+$/, '').trim();
};
const TYPES = { 30: 'Fishing', 31: 'Towing', 32: 'Towing (large)', 33: 'Dredging', 34: 'Diving', 35: 'Military', 36: 'Sailing', 37: 'Pleasure craft', 50: 'Pilot', 51: 'Search and rescue', 52: 'Tug', 53: 'Port tender', 55: 'Law enforcement', 58: 'Medical' };
export function shipType(t) {
  if (!t) return '';
  if (TYPES[t]) return TYPES[t];
  const tens = Math.floor(t / 10);
  return { 2: 'Wing in ground', 4: 'High-speed craft', 6: 'Passenger', 7: 'Cargo', 8: 'Tanker', 9: 'Other' }[tens] || '';
}
const STATUS = ['Under way using engine', 'At anchor', 'Not under command', 'Restricted manoeuvrability', 'Constrained by draught', 'Moored', 'Aground', 'Engaged in fishing', 'Under way sailing'];

export function decode(b) {
  const type = uint(b, 0, 6);
  const mmsi = uint(b, 8, 30);
  const pos = (lonAt, latAt) => {
    const lon = int(b, lonAt, 28) / 600000, lat = int(b, latAt, 27) / 600000;
    return Math.abs(lon) <= 180 && Math.abs(lat) <= 90 ? { lon, lat } : null;
  };
  if (type >= 1 && type <= 3) {
    const p = pos(61, 89);
    const cog = uint(b, 116, 12) / 10, hdg = uint(b, 128, 9), sog = uint(b, 50, 10) / 10;
    return { mmsi, ...p, sog: sog < 102.3 ? sog : null, cog: cog < 360 ? cog : null, hdg: hdg < 360 ? hdg : null, status: STATUS[uint(b, 38, 4)] || '' };
  }
  if (type === 18 || type === 19) {
    const p = pos(57, 85);
    const cog = uint(b, 112, 12) / 10, hdg = uint(b, 124, 9), sog = uint(b, 46, 10) / 10;
    const out = { mmsi, ...p, sog: sog < 102.3 ? sog : null, cog: cog < 360 ? cog : null, hdg: hdg < 360 ? hdg : null, cls: 'B' };
    if (type === 19 && b.length >= 301) { out.name = text(b, 143, 120); out.type = uint(b, 263, 8); }
    return out;
  }
  if (type === 5 && b.length >= 420) {
    return {
      mmsi, imo: uint(b, 40, 30) || null, call: text(b, 70, 42), name: text(b, 112, 120), type: uint(b, 232, 8),
      len: uint(b, 240, 9) + uint(b, 249, 9), beam: uint(b, 258, 6) + uint(b, 264, 6),
      draught: uint(b, 294, 8) / 10, dest: text(b, 302, 120),
      eta: (() => { const mo = uint(b, 274, 4), d = uint(b, 278, 5), h = uint(b, 283, 5), mi = uint(b, 288, 6); return mo && d ? `${String(d).padStart(2, '0')}/${String(mo).padStart(2, '0')} ${String(h).padStart(2, '0')}${String(mi).padStart(2, '0')} UTC` : ''; })(),
    };
  }
  if (type === 24) {
    const part = uint(b, 38, 2);
    if (part === 0) return { mmsi, name: text(b, 40, 120), cls: 'B' };
    return { mmsi, type: uint(b, 40, 8), call: text(b, 90, 42), len: uint(b, 132, 9) + uint(b, 141, 9), beam: uint(b, 150, 6) + uint(b, 156, 6), cls: 'B' };
  }
  return null;
}

// Joins the parts of multi-sentence messages; returns decoded messages.
export function reader() {
  const parts = new Map();
  return (line) => {
    const m = line.trim().match(/^!..VD[MO],(\d),(\d),(\d?),\w?,([^,]*),(\d)\*?/);
    if (!m) return null;
    const [, total, n, seq, payload] = m;
    if (total === '1') return decode(bits(payload));
    const key = seq || 'x';
    const have = n === '1' ? [] : parts.get(key) || [];
    have[+n - 1] = payload;
    parts.set(key, have);
    if (have.filter(Boolean).length < +total) return null;
    parts.delete(key);
    return decode(bits(have.join('')));
  };
}

// ----------------------------------------------------------------- the map
function shipImage(colour) {
  const s = 2, w = 16 * s, h = 22 * s;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.beginPath(); g.moveTo(w / 2, s); g.lineTo(w - 3 * s, h - 3 * s); g.lineTo(w / 2, h - 7 * s); g.lineTo(3 * s, h - 3 * s); g.closePath();
  g.fillStyle = colour; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * s; g.fill(); g.stroke();
  return g.getImageData(0, 0, w, h);
}
const COLOURS = { cargo: '#2f855a', tanker: '#c53030', passenger: '#2b6cb0', fishing: '#d69e2e', tug: '#805ad5', other: '#4a5568' };
const colourOf = (t) => (t >= 70 && t < 80 ? 'cargo' : t >= 80 && t < 90 ? 'tanker' : t >= 60 && t < 70 ? 'passenger' : t === 30 ? 'fishing' : t === 52 || t === 31 || t === 32 ? 'tug' : 'other');

export function setupAis(map, { status, openPanel, position }) {
  const app = window.WorldMapApp;
  const ships = new Map();
  for (const [k, c] of Object.entries(COLOURS)) map.addImage(`ais-${k}`, shipImage(c), { pixelRatio: 2 });
  map.addSource('ais', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: 'ais-ships', type: 'symbol', source: 'ais',
    layout: {
      'icon-image': ['concat', 'ais-', ['get', 'col']], 'icon-rotate': ['get', 'rot'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 12, 1],
      'text-field': ['step', ['zoom'], '', 10, ['get', 'n']], 'text-font': ['OpenSans-Semibold'], 'text-size': 10.5, 'text-offset': [0, 1.4], 'text-optional': true,
    },
    paint: { 'text-color': '#1a365d', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
  });
  const read = reader();
  const draw = () => {
    const now = Date.now();
    for (const [k, s] of ships) if (now - s.seen > 20 * 60000) ships.delete(k);
    const features = [...ships.values()].filter((s) => s.lat != null).map((s) => ({
      type: 'Feature', properties: { mmsi: s.mmsi, n: s.name || String(s.mmsi), col: colourOf(s.type), rot: s.hdg ?? s.cog ?? 0 },
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
    }));
    map.getSource('ais')?.setData({ type: 'FeatureCollection', features });
    return features.length;
  };
  let timer = null;
  const poll = () => {
    const lines = app.aisRead();
    if (lines) {
      for (const line of lines.split('\n')) {
        const m = read(line);
        if (!m || !m.mmsi) continue;
        const s = ships.get(m.mmsi) || { mmsi: m.mmsi };
        for (const [k, v] of Object.entries(m)) if (v != null && v !== '') s[k] = v;
        s.seen = Date.now();
        ships.set(m.mmsi, s);
      }
    }
    const n = draw();
    status(`${app.aisState()} · ${n} ships`);
  };
  return {
    available: !!app?.aisConnect,
    connect(host, port, udp) {
      if (!app?.aisConnect) return;
      app.aisConnect(host, port, udp);
      clearInterval(timer);
      timer = setInterval(poll, 2000);
    },
    disconnect() { app?.aisDisconnect?.(); clearInterval(timer); status('Off'); },
    hit: (box) => map.queryRenderedFeatures(box, { layers: ['ais-ships'] })[0],
    show(mmsi) {
      const s = ships.get(mmsi);
      if (!s) return;
      const rows = [['MMSI', s.mmsi], ['IMO', s.imo], ['Call sign', s.call], ['Type', shipType(s.type)], ['Status', s.status],
        ['Speed', s.sog != null ? `${s.sog.toFixed(1)} kn` : ''], ['Course', s.cog != null ? `${s.cog.toFixed(1)}°` : ''], ['Heading', s.hdg != null ? `${s.hdg}°` : ''],
        ['Length × beam', s.len ? `${s.len} × ${s.beam} m` : ''], ['Draught', s.draught ? `${s.draught} m` : ''], ['Destination', s.dest], ['ETA', s.eta],
        ['Last heard', `${Math.round((Date.now() - s.seen) / 1000)} s ago`]].filter(([, v]) => v);
      openPanel(`<h1>🚢 ${esc(s.name || s.mmsi)}</h1><p class="sub">From the ship's AIS · ${s.lat != null ? esc(position(s.lat, s.lon)) : 'no position yet'}</p>
        <div class="cards"><div class="card"><table class="facts">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join('')}</table>
        <div class="note">As received; not for collision avoidance (use the radar and the ECDIS).</div></div></div>`);
    },
  };
}
