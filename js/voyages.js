// My voyages: the ports you have called at, with dates and ships, drawn on
// the map in order as your sailing history. Kept on this phone, with a
// backup file (my voyages and my places) to save and load.

import { loadMyPlaces } from './myplaces.js';

const KEY = 'wm.voyages';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function loadCalls() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function saveCalls(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { alert('This phone has no room left to keep it.'); }
}
const sorted = (list) => [...list].sort((a, b) => (a.arr || '').localeCompare(b.arr || ''));

function nm(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
  return 2 * 3440.065 * Math.asin(Math.min(1, Math.sqrt(h)));
}
// Points along the great circle, so long legs curve as on a globe.
function arc(a, b) {
  const r = Math.PI / 180;
  const d = nm(a, b) / 3440.065;
  if (d < 1e-6) return [[a.lon, a.lat]];
  const n = Math.max(2, Math.ceil(d / 0.02));
  const out = [];
  let prevLon = null;
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(a.lat * r) * Math.cos(a.lon * r) + B * Math.cos(b.lat * r) * Math.cos(b.lon * r);
    const y = A * Math.cos(a.lat * r) * Math.sin(a.lon * r) + B * Math.cos(b.lat * r) * Math.sin(b.lon * r);
    const z = A * Math.sin(a.lat * r) + B * Math.sin(b.lat * r);
    let lon = Math.atan2(y, x) / r;
    if (prevLon != null) while (lon - prevLon > 180) lon -= 360;
    if (prevLon != null) while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    out.push([lon, Math.atan2(z, Math.hypot(x, y)) / r]);
  }
  return out;
}

function geo(list = loadCalls()) {
  const s = sorted(list);
  const features = s.map((c, i) => ({ type: 'Feature', properties: { id: c.id, n: c.port, no: i + 1 }, geometry: { type: 'Point', coordinates: [c.lon, c.lat] } }));
  for (let i = 1; i < s.length; i++) {
    features.push({ type: 'Feature', properties: { leg: 1, ship: s[i].ship === s[i - 1].ship ? s[i].ship || '' : '' }, geometry: { type: 'LineString', coordinates: arc(s[i - 1], s[i]) } });
  }
  return { type: 'FeatureCollection', features };
}

export function setupVoyages(map, { openPanel, closePanel, findPorts, countryName, flag, before }) {
  map.addSource('voyages', { type: 'geojson', data: geo() });
  map.addLayer({
    id: 'voyages-legs', type: 'line', source: 'voyages', filter: ['has', 'leg'],
    paint: { 'line-color': '#6b46c1', 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.4, 8, 2.6], 'line-dasharray': [3, 2], 'line-opacity': 0.85 },
  }, before);
  map.addLayer({
    id: 'voyages-calls', type: 'circle', source: 'voyages', filter: ['has', 'no'],
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3.5, 8, 6], 'circle-color': '#6b46c1', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
  }, before);
  const refresh = () => map.getSource('voyages')?.setData(geo());

  const form = (c) => {
    openPanel(`<h1>${c.id ? 'Change port call' : 'Add a port call'}</h1>
      <form class="myplace-form" id="call-form">
        <label>Port <input name="port" required value="${esc(c.port || '')}" placeholder="Start typing a port" autocomplete="off" list="call-ports"></label>
        <datalist id="call-ports"></datalist>
        <label>Arrived <input name="arr" type="date" required value="${esc(c.arr || '')}"></label>
        <label>Sailed <input name="dep" type="date" value="${esc(c.dep || '')}"></label>
        <label>Ship <input name="ship" maxlength="60" value="${esc(c.ship || localStorage.getItem('wm.lastship') || '')}" placeholder="Ship's name"></label>
        <label>Notes <textarea name="note" rows="3" maxlength="1000" placeholder="Cargo, berth, memories…">${esc(c.note || '')}</textarea></label>
        <div class="row-end">${c.id ? '<button type="button" class="secondary" id="call-delete">Delete</button>' : ''}<button class="primary">Save</button></div>
      </form>`);
    const f = document.getElementById('call-form');
    let choices = [];
    const fill = () => {
      choices = f.port.value.trim().length >= 2 ? findPorts(f.port.value).slice(0, 12) : [];
      document.getElementById('call-ports').innerHTML = choices.map((p) => `<option value="${esc(p.name)}">${esc(countryName(p.cc))}${p.locode ? ` · ${esc(p.locode)}` : ''}</option>`).join('');
    };
    f.port.oninput = fill;
    if (!c.id && !c.port) setTimeout(() => f.port.focus(), 50);
    f.onsubmit = (e) => {
      e.preventDefault();
      fill();
      const p = choices.find((x) => x.name.toLowerCase() === f.port.value.trim().toLowerCase()) || choices[0];
      const known = c.port === f.port.value.trim() && c.lat != null;
      if (!p && !known) { alert('Pick a port from the list.'); return; }
      const where = known && (!p || p.name !== c.port) ? { port: c.port, lat: c.lat, lon: c.lon, cc: c.cc, locode: c.locode } : { port: p.name, lat: p.lat, lon: p.lon, cc: p.cc, locode: p.locode || '' };
      const item = { ...c, ...where, arr: f.arr.value, dep: f.dep.value, ship: f.ship.value.trim(), note: f.note.value.trim() };
      if (item.dep && item.dep < item.arr) { alert('Sailed is before arrived.'); return; }
      try { if (item.ship) localStorage.setItem('wm.lastship', item.ship); } catch { /* full */ }
      const list = loadCalls();
      if (item.id) list[list.findIndex((x) => x.id === item.id)] = item;
      else list.push({ ...item, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` });
      saveCalls(list);
      refresh();
      show();
    };
    document.getElementById('call-delete')?.addEventListener('click', () => {
      if (!confirm(`Delete the call at ${c.port}?`)) return;
      saveCalls(loadCalls().filter((x) => x.id !== c.id));
      refresh();
      show();
    });
  };

  const show = () => {
    const s = sorted(loadCalls());
    let miles = 0;
    for (let i = 1; i < s.length; i++) miles += nm(s[i - 1], s[i]);
    const countries = new Set(s.map((c) => c.cc).filter(Boolean));
    const ports = new Set(s.map((c) => c.port));
    const ships = new Set(s.map((c) => c.ship).filter(Boolean));
    const days = s.reduce((t, c) => t + (c.dep && c.arr ? (Date.parse(c.dep) - Date.parse(c.arr)) / 86400000 : 0), 0);
    const fmt = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
    openPanel(`<h1>My voyages</h1>
      <p class="sub">Your port calls, in order, drawn on the map. Kept on this phone.</p>
      <div class="cards">
        <div class="card"><table class="facts">
          <tr><th>Port calls</th><td>${s.length}</td></tr>
          <tr><th>Ports</th><td>${ports.size}</td></tr>
          <tr><th>Countries</th><td>${countries.size}${countries.size ? ` <span class="flags">${[...countries].map(flag).join(' ')}</span>` : ''}</td></tr>
          <tr><th>Ships</th><td>${ships.size}</td></tr>
          <tr><th>Miles between ports</th><td>${Math.round(miles).toLocaleString()} nm <small>(straight lines; the miles sailed are more)</small></td></tr>
          ${days ? `<tr><th>Days in port</th><td>${Math.round(days)}</td></tr>` : ''}
        </table>
        <div class="row-end"><button type="button" class="primary" id="call-add">Add a port call</button></div></div>
        ${s.length ? `<div class="card"><ol class="calls">${[...s].reverse().map((c) => `
          <li><button type="button" class="linkish" data-call="${esc(c.id)}">
            <b>${flag(c.cc || '')} ${esc(c.port)}</b>
            <span class="note">${fmt(c.arr)}${c.dep ? ` – ${fmt(c.dep)}` : ''}${c.ship ? ` · ${esc(c.ship)}` : ''}</span>
          </button></li>`).join('')}</ol></div>` : '<div class="card"><div class="note">No port calls yet. Add one here, or tap a port on the map and choose “Add to my voyages”.</div></div>'}
        <div class="card"><div class="label">Backup</div>
          <div class="note">Save a file with your voyages and your places, to keep somewhere safe or move to a new phone.</div>
          <div class="row-end"><label class="secondary button">Load a backup<input type="file" accept=".json,application/json" id="backup-in" hidden></label><button type="button" class="secondary" id="backup-out">Save a backup</button></div>
        </div>
      </div>`);
    document.getElementById('call-add').onclick = () => form({});
    for (const b of document.querySelectorAll('[data-call]')) {
      b.onclick = () => {
        const c = loadCalls().find((x) => x.id === b.dataset.call);
        map.flyTo({ center: [c.lon, c.lat], zoom: Math.max(map.getZoom(), 6) });
        form(c);
      };
    }
    document.getElementById('backup-out').onclick = () => {
      const data = { app: 'World Map', saved: new Date().toISOString(), voyages: loadCalls(), myplaces: loadMyPlaces() };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      a.download = `world-map-backup-${data.saved.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    document.getElementById('backup-in').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const merge = (key, have, add) => {
          const ids = new Set(have.map((x) => x.id));
          const out = [...have, ...(Array.isArray(add) ? add : []).filter((x) => x && x.id && !ids.has(x.id))];
          localStorage.setItem(key, JSON.stringify(out));
          return out.length - have.length;
        };
        const v = merge(KEY, loadCalls(), data.voyages);
        const p = merge('wm.myplaces', loadMyPlaces(), data.myplaces);
        refresh();
        onPlacesLoaded?.();
        alert(`Loaded ${v} port calls and ${p} places.`);
        show();
      } catch {
        alert('That file is not a World Map backup.');
      }
    };
  };

  let onPlacesLoaded = null;
  return {
    show,
    addPort: (p) => form({ port: p.name, lat: p.lat, lon: p.lon, cc: p.cc, locode: p.locode || '', arr: new Date().toISOString().slice(0, 10) }),
    onPlacesLoaded: (fn) => { onPlacesLoaded = fn; },
    close: closePanel,
  };
}
