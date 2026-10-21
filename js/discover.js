// Famous wrecks, maritime history and marine life on the map, from
// data/discover.json (Wikipedia summaries and photos; built by
// tools/build-discover.mjs). Each has its own switch; tap one for its story.

import { iconImage } from './places.js';

const ICON = {
  wreck: ['⚓', '#2d3748'], history: ['🧭', '#975a16'],
  whale: ['🐋', '#2b6cb0'], turtle: ['🐢', '#2f855a'], shark: ['🦈', '#4a5568'], reef: ['🪸', '#c05621'], glow: ['✨', '#5a67d8'], life: ['🐬', '#2c7a7b'],
};
export const DISCOVER_GROUPS = { wrecks: ['disc-wreck'], history: ['disc-history'], marinelife: ['disc-life'] };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function addDiscover(map, before) {
  const data = await fetch('data/discover.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!data?.features?.length) return null;
  for (const [k, [emoji, ring]] of Object.entries(ICON)) map.addImage(`disc-${k}`, iconImage(emoji, ring), { pixelRatio: 2 });
  for (const f of data.features) f.properties.icon = `disc-${f.properties.g === 'life' ? f.properties.k || 'life' : f.properties.g}`;
  map.addSource('discover', { type: 'geojson', data });
  for (const [id, g] of [['disc-wreck', 'wreck'], ['disc-history', 'history'], ['disc-life', 'life']]) {
    map.addLayer({
      id, type: 'symbol', source: 'discover', minzoom: 1.5, filter: ['==', ['get', 'g'], g],
      layout: {
        'icon-image': ['get', 'icon'], 'icon-size': ['interpolate', ['linear'], ['zoom'], 1.5, 0.6, 6, 0.9],
        'text-field': ['step', ['zoom'], '', 4, ['get', 'n']], 'text-font': ['OpenSans-Semibold'], 'text-size': 11,
        'text-anchor': 'top', 'text-offset': [0, 1.1], 'text-optional': true, 'text-max-width': 9,
      },
      paint: { 'text-color': '#2d3748', 'text-halo-color': 'rgba(255,255,255,0.9)', 'text-halo-width': 1.5 },
    }, before);
  }
  return data.features;
}

export function discoverCard(p, position) {
  const what = { wreck: 'Wreck', history: 'Maritime history', life: 'Marine life' }[p.g] || '';
  return `<h1>${esc(ICON[p.g === 'life' ? p.k || 'life' : p.g]?.[0] || '')} ${esc(p.n)}</h1>
    <p class="sub">${esc(what)} · ${esc(position)}</p>
    ${p.img ? `<img class="place-photo" src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
    <div class="cards"><div class="card">
      ${p.s ? `<div class="big-note">${esc(p.s)}</div>` : ''}
      <p>${esc(p.d)}</p>
      ${p.url ? `<p><a href="${esc(p.url)}" target="_blank" rel="noopener">Read more on Wikipedia</a></p>` : ''}
      <div class="note">Text and photo from Wikipedia (CC BY-SA)${p.g === 'wreck' ? '; positions as Wikipedia gives them, not for navigation' : ''}.</div>
    </div></div>`;
}
