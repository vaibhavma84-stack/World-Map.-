// Regulatory sea areas from data/zones.json (built by tools/build-zones.py):
// emission control areas, MARPOL special areas and load line zones. Drawn on
// the map, and looked up for a position (a tapped point, or the ship's
// position ahead). Approximate: not for navigation.

let data = null;
const loading = fetch('data/zones.json').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => { data = d; return d; });
export const zonesReady = loading;

const SEASON = { T: 'Tropical', S: 'Summer', W: 'Winter' };
export const seasonName = (s) => SEASON[s] || s;

// Whether a point is inside a ring (ray casting) and so in the polygon.
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inPolygon(x, y, rings) {
  if (!inRing(x, y, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) if (inRing(x, y, rings[i])) return false;
  return true;
}
function contains(geom, x, y) {
  if (geom.type === 'Polygon') return inPolygon(x, y, geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some((p) => inPolygon(x, y, p));
  return false;
}

// The season a period list gives for a date (periods as [season, 'MM-DD', 'MM-DD']).
export function seasonOn(periods, date) {
  const md = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const num = (s) => { const [m, d] = s.split('-').map(Number); return m * 100 + d; };
  for (const [s, from, to] of periods) {
    const a = num(from), b = num(to);
    if (a <= b ? md >= a && md <= b : md >= a || md <= b) return s;
  }
  return null;
}

// Everything at a position: { eca: [...], marpol: [...], ll: {...} or null }.
// Load line: the zone or area there; Summer Zone where none is drawn.
export function zonesAt(lon, lat, date = new Date()) {
  const out = { eca: [], marpol: [], ll: null, small: null };
  if (!data) return out;
  const x = ((lon + 540) % 360) - 180;
  for (const f of data.features) {
    if (!contains(f.geometry, x, lat)) continue;
    const p = f.properties;
    if (p.k === 'eca') out.eca.push(p);
    else if (p.k === 'marpol') out.marpol.push(p);
    else if (p.k === 'll') {
      const entry = { ...p, season: seasonOn(p.periods, date) };
      if (p.small) out.small = entry; else out.ll = entry;
    }
  }
  return out;
}

// A short line for tables: "ECA · Winter (N Atlantic Zone II)".
export function zonesBrief(z) {
  const bits = [];
  if (z.eca.length) bits.push(`ECA (${z.eca.map((e) => e.controls).join('; ')})`);
  if (z.marpol.length) bits.push(`MARPOL special area: ${z.marpol.map((m) => m.name).join(', ')}`);
  const ll = z.ll ? `${seasonName(z.ll.season)} (${z.ll.name.replace(/^Seasonal Tropical Area: /, 'Seasonal Tropical, ')})` : 'Summer Zone';
  bits.push(`Load line: ${ll}${z.small ? `; ≤100 m: ${seasonName(z.small.season)}` : ''}`);
  return bits.join(' · ');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = (s) => { const [m, d] = s.split('-').map(Number); return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}`; };
const periodsText = (periods) => periods.map(([s, a, b]) => `${seasonName(s)} ${fmtDate(a)} – ${fmtDate(b)}`).join(' · ');

// The card for a tapped point at sea.
export function zonesCard(z, position) {
  const parts = [`<h1>At sea</h1><p class="sub">${esc(position)}</p><div class="cards">`];
  const ll = z.ll;
  parts.push(`<div class="card"><h3>Load line</h3>
    <div class="big">${ll ? `${seasonName(ll.season)} now` : 'Summer'}</div>
    <div>${esc(ll ? ll.name : 'Summer Zone')}</div>
    ${ll ? `<div class="note">${periodsText(ll.periods)}</div>` : ''}
    ${ll?.note ? `<div class="note">${esc(ll.note)}</div>` : ''}
    ${z.small ? `<div class="note"><b>Ships of 100 m and under:</b> ${esc(z.small.name)}: ${seasonName(z.small.season)} now (${periodsText(z.small.periods)})</div>` : ''}
  </div>`);
  if (z.eca.length) {
    for (const e of z.eca) {
      parts.push(`<div class="card"><h3>Emission control area</h3>
        <div class="big">${esc(e.name)}</div>
        <div>Controls: ${esc(e.controls)}</div>
        <div class="note">Fuel sulphur 0.10% m/m max (or an approved scrubber).${e.tier3 ? ` NOx Tier III for engines on ships built (keel laid) on or after ${e.tier3.slice(0, 4)}.` : ' Not a NOx (Tier III) area.'}</div>
      </div>`);
    }
  } else {
    parts.push('<div class="card"><h3>Emission control area</h3><div>None here: global fuel sulphur limit 0.50% m/m.</div></div>');
  }
  for (const m of z.marpol) {
    parts.push(`<div class="card"><h3>MARPOL special area</h3>
      <div class="big">${esc(m.name)}</div><div>Annex ${esc(m.annexes)}</div>
      ${m.rules.map((r) => `<div class="note">${esc(r)}</div>`).join('')}
      ${m.note ? `<div class="note">${esc(m.note)}</div>` : ''}
    </div>`);
  }
  parts.push('</div><p class="hint small">Areas drawn from the MARPOL and Load Line Convention texts and Marine Regions (CC BY 4.0); approximate, not for navigation. Check the official charts and current regulations.</p>');
  return parts.join('');
}

// Map layers: ECAs in green, special areas in brown, load line zones tinted.
export async function addZones(map, before) {
  const d = await loading;
  if (!d) return false;
  map.addSource('zones', { type: 'geojson', data: d, tolerance: 0.3 });
  const kind = (k) => ['==', ['get', 'k'], k];
  const LL = ['match', ['get', 'zone'], 'tropical', '#ff7043', 'seasonal', '#ffb300', 'winter', '#1e88e5', '#7e57c2'];
  map.addLayer({ id: 'zones-ll-fill', type: 'fill', source: 'zones', filter: kind('ll'), paint: { 'fill-color': LL, 'fill-opacity': 0.09 } }, before);
  map.addLayer({ id: 'zones-ll-line', type: 'line', source: 'zones', filter: kind('ll'), paint: { 'line-color': LL, 'line-width': 1, 'line-opacity': 0.55 } }, before);
  map.addLayer({ id: 'zones-eca-fill', type: 'fill', source: 'zones', filter: kind('eca'), paint: { 'fill-color': '#2e9e5b', 'fill-opacity': 0.12 } }, before);
  map.addLayer({ id: 'zones-eca-line', type: 'line', source: 'zones', filter: kind('eca'), paint: { 'line-color': '#1f7a45', 'line-width': 1.6, 'line-dasharray': [4, 2] } }, before);
  map.addLayer({ id: 'zones-marpol-line', type: 'line', source: 'zones', filter: kind('marpol'), paint: { 'line-color': '#9c5a1a', 'line-width': 1.3, 'line-dasharray': [1, 2] } }, before);
  const label = (id, k, colour, min) => map.addLayer({
    id, type: 'symbol', source: 'zones', filter: kind(k), minzoom: min,
    layout: { 'text-field': ['get', 'name'], 'text-font': ['OpenSans-Semibold'], 'text-size': 11, 'text-max-width': 10, 'text-padding': 20 },
    paint: { 'text-color': colour, 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.4 },
  });
  label('zones-ll-labels', 'll', '#33449a', 2.5);
  label('zones-eca-labels', 'eca', '#1f6e3f', 2.5);
  label('zones-marpol-labels', 'marpol', '#7a4512', 3.5);
  return true;
}
