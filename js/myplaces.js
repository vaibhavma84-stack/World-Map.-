// My places: your own marks on the map, kept on this phone (and working at
// sea). Press and hold the map to add one, name it and pick a kind; tap it
// to see, change or delete it. Search finds them too.

import { KINDS, iconImage } from './places.js';

const KEY = 'wm.myplaces';
const OTHER = { label: 'Other', icon: '⭐' };
const kindOf = (k) => KINDS[k] || OTHER;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function loadMyPlaces() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}
function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { alert('This phone has no room left to keep the place.'); }
}

export function myPlacesGeoJson(list = loadMyPlaces()) {
  return {
    type: 'FeatureCollection',
    features: list.map((p) => ({ type: 'Feature', properties: { id: p.id, n: p.n, k: p.k, mine: 1 }, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })),
  };
}

export function setupMyPlaces(map, { openPanel, closePanel, position, before }) {
  const icon = (k) => {
    const id = `mine-${k}`;
    if (!map.hasImage(id)) map.addImage(id, iconImage(kindOf(k).icon, '#d53f8c', true), { pixelRatio: 2 });
    return id;
  };
  const refresh = () => {
    const list = loadMyPlaces();
    for (const p of list) icon(p.k);
    map.getSource('myplaces')?.setData(myPlacesGeoJson(list));
  };
  icon('other');
  map.addSource('myplaces', { type: 'geojson', data: myPlacesGeoJson() });
  map.addLayer({
    id: 'my-places', type: 'symbol', source: 'myplaces',
    layout: {
      'icon-image': ['concat', 'mine-', ['get', 'k']], 'icon-allow-overlap': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 12, 1],
      'text-field': ['step', ['zoom'], '', 11, ['get', 'n']], 'text-font': ['OpenSans-Semibold'], 'text-size': 12,
      'text-anchor': 'top', 'text-offset': [0, 1.2], 'text-optional': true, 'text-max-width': 9,
    },
    paint: { 'text-color': '#97266d', 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.6 },
  }, before);
  refresh();

  const form = (p) => {
    const kinds = [...Object.entries(KINDS).filter(([k]) => k !== 'signals'), ['other', OTHER]];
    openPanel(`<h1>${p.id ? 'Change my place' : 'Add to my places'}</h1>
      <p class="sub">${esc(position(p.lat, p.lon))}</p>
      <form class="myplace-form">
        <label>Name <input name="n" required maxlength="80" value="${esc(p.n || '')}" placeholder="e.g. Trilogy"></label>
        <label>Kind <select name="k">${kinds.map(([k, d]) => `<option value="${k}"${k === (p.k || 'other') ? ' selected' : ''}>${d.icon} ${esc(d.label)}</option>`).join('')}</select></label>
        <label>Notes <textarea name="note" rows="3" maxlength="1000" placeholder="Who, when, what to order…">${esc(p.note || '')}</textarea></label>
        <div class="row-end">${p.id ? '<button type="button" class="secondary" data-act="delete">Delete</button>' : ''}<button class="primary">Save</button></div>
      </form>`);
    const f = document.querySelector('.myplace-form');
    if (!p.id) setTimeout(() => f.n.focus(), 50);
    f.onsubmit = (e) => {
      e.preventDefault();
      const list = loadMyPlaces();
      const item = { ...p, n: f.n.value.trim(), k: f.k.value, note: f.note.value.trim() };
      if (!item.n) return;
      if (item.id) list[list.findIndex((x) => x.id === item.id)] = item;
      else list.push({ ...item, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, t: new Date().toISOString() });
      save(list);
      refresh();
      show(list.find((x) => x.id === (item.id || list[list.length - 1].id)));
    };
    f.querySelector('[data-act="delete"]')?.addEventListener('click', () => {
      if (!confirm(`Delete “${p.n}” from my places?`)) return;
      save(loadMyPlaces().filter((x) => x.id !== p.id));
      refresh();
      closePanel();
    });
  };

  const show = (p) => {
    if (!p) return;
    const d = kindOf(p.k);
    openPanel(`<h1>${d.icon} ${esc(p.n)}</h1>
      <p class="sub">My place · ${esc(d.label)} · ${esc(position(p.lat, p.lon))}</p>
      <div class="cards"><div class="card">
        ${p.note ? `<p class="myplace-note">${esc(p.note).replace(/\n/g, '<br>')}</p>` : '<div class="note">No notes.</div>'}
        <div class="note">Added ${new Date(p.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}; kept on this phone.</div>
        <div class="row-end"><a class="secondary button" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}">Directions</a><button type="button" class="primary" id="myplace-edit">Change</button></div>
      </div></div>`);
    document.getElementById('myplace-edit').onclick = () => form(p);
  };

  // Press and hold (or right-click) to add.
  const add = (lngLat) => form({ lon: Math.round(lngLat.lng * 1e6) / 1e6, lat: Math.round(lngLat.lat * 1e6) / 1e6 });
  map.on('contextmenu', (e) => add(e.lngLat));
  let hold = null, start = null, held = 0;
  const cancel = () => { clearTimeout(hold); hold = null; };
  const canvas = map.getCanvasContainer();
  canvas.addEventListener('touchstart', (e) => {
    cancel();
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    start = [t.clientX, t.clientY];
    hold = setTimeout(() => {
      hold = null;
      held = Date.now();
      const r = map.getCanvas().getBoundingClientRect();
      navigator.vibrate?.(20);
      add(map.unproject([start[0] - r.left, start[1] - r.top]));
    }, 650);
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (hold && (e.touches.length !== 1 || Math.hypot(t.clientX - start[0], t.clientY - start[1]) > 10)) cancel();
  }, { passive: true });
  canvas.addEventListener('touchend', cancel, { passive: true });
  canvas.addEventListener('touchcancel', cancel, { passive: true });
  map.on('movestart', (e) => { if (e.originalEvent) cancel(); });

  return {
    // The tap that ends a press-and-hold is not a tap on the map.
    justHeld: () => Date.now() - held < 1500,
    hit: (box) => map.queryRenderedFeatures(box, { layers: ['my-places'] })[0],
    show: (id) => show(loadMyPlaces().find((x) => x.id === id)),
    addAtCentre: () => add(map.getCenter()),
    refresh,
  };
}
