// Points of interest for chosen cities (data/city-extras.json, from
// OpenStreetMap with Wikidata photos): each kind with its own icon and
// switch; hotels rated five stars stand out with a gold star. Tapping one
// shows what OpenStreetMap knows about it, and a photo where there is one.

export const KINDS = {
  signals: { label: 'Traffic signals', icon: '🚦', colour: '#c0392b', zoom: 15 },
  fuel: { label: 'Petrol pumps', icon: '⛽', colour: '#555555', zoom: 13 },
  cafe: { label: 'Cafés', icon: '☕', colour: '#8d5524', zoom: 14 },
  restaurant: { label: 'Restaurants (Michelin links highlighted)', icon: '🍽️', colour: '#c0392b', zoom: 14 },
  bar: { label: 'Bars and pubs', icon: '🍺', colour: '#b7791f', zoom: 14 },
  nightclub: { label: 'Nightclubs', icon: '🪩', colour: '#7b2cbf', zoom: 13 },
  hotel: { label: 'Hotels (5★ highlighted)', icon: '🏨', colour: '#2c7a7b', zoom: 13 },
  museum: { label: 'Museums and galleries', icon: '🏛️', colour: '#5b4b8a', zoom: 12 },
  interest: { label: 'Places of interest and heritage', icon: '📍', colour: '#d35400', zoom: 12 },
  cinema: { label: 'Cinemas and theatres', icon: '🎭', colour: '#6d214f', zoom: 13 },
  golf: { label: 'Golf courses', icon: '⛳', colour: '#2f855a', zoom: 11 },
  snooker: { label: 'Snooker and pool', icon: '🎱', colour: '#1a202c', zoom: 13 },
  shooting: { label: 'Shooting ranges', icon: '🎯', colour: '#9b2c2c', zoom: 12 },
};
export const PLACE_GROUPS = Object.fromEntries(Object.keys(KINDS).map((k) => [`poi-${k}`,
  k === 'hotel' ? ['poi-hotel', 'poi-hotel-5'] : k === 'restaurant' ? ['poi-restaurant', 'poi-michelin'] : [`poi-${k}`]]));

function iconImage(emoji, ring, gold = false) {
  const s = 2, size = (gold ? 34 : 26) * s;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 2 * s, 0, Math.PI * 2);
  g.fillStyle = gold ? '#fff4c2' : '#ffffff';
  g.fill();
  g.lineWidth = (gold ? 3 : 2) * s;
  g.strokeStyle = gold ? '#d4a017' : ring;
  g.stroke();
  g.font = `${(gold ? 19 : 14) * s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, size / 2, size / 2 + s);
  return g.getImageData(0, 0, size, size);
}

// Luxury hotels whose star rating OpenStreetMap does not record, by name.
const LUXURY = /\b(Taj Mahal Palace|Taj President|Taj Lands End|Taj Santacruz|Four Seasons|St\.? Regis|The Leela|Leela Kempinski|Kempinski Leela|Sofitel|Trident|Oberoi|JW Marriott|Grand Hyatt|ITC Maratha|ITC Grand Central|Ritz[- ]Carlton|Westin)\b/i;
// Restaurants linked to Michelin stars. Michelin has no guide for India, so
// no restaurant here holds a star itself; these are run by a Michelin-starred
// chef, or share a name and kitchen with a starred restaurant abroad.
const MICHELIN = [
  [/^Yauatcha\b/i, 'Yauatcha London (Soho) held a Michelin star; this is its Mumbai sister restaurant.'],
  [/^Hakkasan\b/i, 'Hakkasan London held a Michelin star; this is its Mumbai sister restaurant (check it is still open).'],
  [/^Ziya\b/i, 'Menu by Vineet Bhatia, the first Indian chef to win a Michelin star (Zaika and Rasoi, London). Check it is still open.'],
  [/^Trishna\b/i, 'Trishna London, named after and inspired by this Mumbai restaurant, won a Michelin star.'],
];

export async function addCityPlaces(map, labelsBefore) {
  const data = await fetch('data/city-extras.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (!data?.features?.length) return false;
  for (const f of data.features) {
    const p = f.properties;
    if (p.k === 'hotel' && !(p.s >= 5) && LUXURY.test(p.n || '')) p.lux = 1;
    if (p.k === 'restaurant' || p.k === 'bar') {
      const m = MICHELIN.find(([re]) => re.test(p.n || ''));
      if (m) p.mi = m[1];
    }
    if (p.s >= 5 || p.lux) p.gold = 1;
  }
  map.addSource('cityx', { type: 'geojson', data });
  for (const [k, d] of Object.entries(KINDS)) {
    map.addImage(`poi-${k}`, iconImage(d.icon, d.colour), { pixelRatio: 2 });
    if (k === 'hotel') map.addImage('poi-hotel-5', iconImage('⭐', d.colour, true), { pixelRatio: 2 });
    map.addLayer({
      id: `poi-${k}`, type: 'symbol', source: 'cityx', minzoom: d.zoom,
      filter: k === 'hotel' ? ['all', ['==', ['get', 'k'], 'hotel'], ['!', ['has', 'gold']]]
        : k === 'restaurant' ? ['all', ['==', ['get', 'k'], k], ['!', ['has', 'mi']]] : ['==', ['get', 'k'], k],
      layout: {
        'icon-image': `poi-${k}`, 'icon-allow-overlap': k === 'signals', 'icon-size': k === 'signals' ? 0.75 : 1,
        'text-field': k === 'signals' ? '' : ['step', ['zoom'], '', d.zoom + 1.5, ['coalesce', ['get', 'n'], '']],
        'text-font': ['OpenSans-Semibold'], 'text-size': 10.5, 'text-anchor': 'top', 'text-offset': [0, 1.1],
        'text-max-width': 8, 'text-optional': true,
      },
      paint: { 'text-color': d.colour, 'text-halo-color': 'rgba(255,255,255,0.92)', 'text-halo-width': 1.5 },
    }, labelsBefore);
  }
  // Five-star hotels: on top, gold, shown from further out and never hidden.
  map.addLayer({
    id: 'poi-hotel-5', type: 'symbol', source: 'cityx', minzoom: 10,
    filter: ['all', ['==', ['get', 'k'], 'hotel'], ['has', 'gold']],
    layout: {
      'icon-image': 'poi-hotel-5', 'icon-allow-overlap': true, 'icon-ignore-placement': false,
      'text-field': ['step', ['zoom'], '', 12, ['coalesce', ['get', 'n'], '']],
      'text-font': ['OpenSans-Bold'], 'text-size': 11.5, 'text-anchor': 'top', 'text-offset': [0, 1.3], 'text-max-width': 9, 'text-optional': true,
    },
    paint: { 'text-color': '#9a6b00', 'text-halo-color': '#fffbe6', 'text-halo-width': 2 },
  }, labelsBefore);
  // Restaurants linked to Michelin stars: a gold rosette, on top.
  map.addImage('poi-michelin', iconImage('🏵️', '#c0392b', true), { pixelRatio: 2 });
  map.addLayer({
    id: 'poi-michelin', type: 'symbol', source: 'cityx', minzoom: 10, filter: ['has', 'mi'],
    layout: {
      'icon-image': 'poi-michelin', 'icon-allow-overlap': true,
      'text-field': ['step', ['zoom'], '', 12, ['coalesce', ['get', 'n'], '']],
      'text-font': ['OpenSans-Bold'], 'text-size': 11.5, 'text-anchor': 'top', 'text-offset': [0, 1.3], 'text-optional': true,
    },
    paint: { 'text-color': '#a3271b', 'text-halo-color': '#fffbe6', 'text-halo-width': 2 },
  }, labelsBefore);
  return true;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function placeCard(p, position) {
  const d = KINDS[p.k] || { label: 'Place', icon: '📍' };
  const stars = p.s ? `<div class="big">${'★'.repeat(Math.round(p.s))}<span class="note"> ${p.s}-star</span></div>`
    : p.lux ? '<div class="big">★★★★★<span class="note"> luxury (5-star class); rating not recorded in OpenStreetMap</span></div>' : '';
  const michelin = p.mi ? `<div class="big">🏵️ Michelin link</div><div class="note">${esc(p.mi)}</div>` : '';
  const rows = [
    ['Cuisine', p.cu], ['Brand', p.br], ['Open', p.oh], ['Phone', p.ph && `<a href="tel:${esc(p.ph)}">${esc(p.ph)}</a>`],
    ['Website', p.web && `<a href="${esc(p.web)}" target="_blank" rel="noopener">${esc(p.web.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>`],
    ['Heritage', p.h && p.h.replace(/_/g, ' ')],
    ['Wikipedia', p.wp && `<a href="https://${esc(p.wp.split(':')[0])}.wikipedia.org/wiki/${esc(encodeURIComponent(p.wp.split(':').slice(1).join(':')))}" target="_blank" rel="noopener">Read about it</a>`],
  ].filter(([, v]) => v);
  return `<h1>${d.icon} ${esc(p.n || d.label)}</h1>
    <p class="sub">${esc(d.label)} · ${esc(position)}</p>
    ${p.img ? `<img class="place-photo" src="${esc(p.img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
    <div class="cards"><div class="card">${stars}${michelin}
      ${rows.length ? `<table class="facts">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${k === 'Phone' || k === 'Website' || k === 'Wikipedia' ? v : esc(v)}</td></tr>`).join('')}</table>` : '<div class="note">No more details recorded.</div>'}
    </div></div>
    <p class="hint small">From OpenStreetMap${p.img ? '; photo from Wikimedia Commons' : ''}. Details may be out of date.</p>`;
}
