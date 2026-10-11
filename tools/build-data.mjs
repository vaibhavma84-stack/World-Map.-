// Builds the map's data once, here, so the app carries everything it shows and
// needs no connection on board.
//
//   npm run data
//
// Sources, all free to reuse:
//   Natural Earth 1:10m — countries, rivers, lakes (public domain)
//   NGA World Port Index, via seaport-data-js (CC BY 4.0)
//   UN/LOCODE, via datasets/un-locode on GitHub (UNECE, free to use)
//
// Output, in data/:
//   countries.json  country shapes, each with a colour 0–14 no neighbour shares
//   borders.json    land borders between countries, as lines
//   labels.json     where each country's name goes
//   rivers.json     river centre lines with names
//   river-names.json  smoother copies of the named rivers, for their labels
//   lakes.json      lakes
//   ports.json      every port: [name, lon, lat, country, locode, rank, tz, detail]
//   details.json    World Port Index particulars, by the detail number above
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { neighbors, mesh } from 'topojson-client';
import { find as findZone } from 'geo-tz/all';

const require = createRequire(import.meta.url);
const root = new URL('..', import.meta.url).pathname;
const cache = `${root}tools/.cache/`;
const out = `${root}data/`;
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const SOURCES = {
  'countries.geojson': `${NE}ne_10m_admin_0_countries.geojson`,
  'rivers.geojson': `${NE}ne_10m_rivers_lake_centerlines.geojson`,
  'rivers-europe.geojson': `${NE}ne_10m_rivers_europe.geojson`,
  'rivers-north-america.geojson': `${NE}ne_10m_rivers_north_america.geojson`,
  'lakes.geojson': `${NE}ne_10m_lakes.geojson`,
  'lakes-europe.geojson': `${NE}ne_10m_lakes_europe.geojson`,
  'lakes-north-america.geojson': `${NE}ne_10m_lakes_north_america.geojson`,
  'locode.csv': 'https://raw.githubusercontent.com/datasets/un-locode/main/data/code-list.csv',
};

for (const [file, url] of Object.entries(SOURCES)) {
  if (existsSync(cache + file)) continue;
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  writeFileSync(cache + file, Buffer.from(await res.arrayBuffer()));
}

const mapshaper = (...args) =>
  execFileSync(`${root}node_modules/.bin/mapshaper`, args, { stdio: ['ignore', 'inherit', 'inherit'] });
const write = (name, value) => {
  const text = JSON.stringify(value);
  writeFileSync(out + name, text);
  console.log(`data/${name}: ${(text.length / 1024 / 1024).toFixed(2)} MB`);
};

// ---------------------------------------------------------------- countries
// Simplified as one topology, so neighbouring countries still share exactly
// the same border line afterwards — which is also how "touching" is found.
mapshaper('-i', cache + 'countries.geojson',
  '-filter-fields', 'NAME,ISO_A2_EH',
  '-rename-fields', 'name=NAME,iso=ISO_A2_EH',
  '-simplify', '45%', 'keep-shapes',
  '-o', 'format=topojson', 'quantization=200000', cache + 'countries.topo.json');

const topo = JSON.parse(readFileSync(cache + 'countries.topo.json'));
const layer = Object.keys(topo.objects)[0];
const geoms = topo.objects[layer].geometries;
const touching = neighbors(geoms);

// 15 colours. Most constrained country first (DSatur); each takes the colour
// least used so far that none of its neighbours has, and where it can, one
// its neighbours' neighbours lack too, so like colours sit far apart.
const COLOURS = 15;
const colour = new Array(geoms.length).fill(-1);
const used = new Array(COLOURS).fill(0);
for (let n = 0; n < geoms.length; n++) {
  let pick = -1, best = -1;
  for (let i = 0; i < geoms.length; i++) {
    if (colour[i] >= 0) continue;
    const sat = new Set(touching[i].map((j) => colour[j]).filter((c) => c >= 0)).size;
    const score = sat * 1000 + touching[i].length;
    if (score > best) { best = score; pick = i; }
  }
  const near = new Set(touching[pick].map((j) => colour[j]));
  const far = new Set(touching[pick].flatMap((j) => touching[j]).map((j) => colour[j]));
  const free = [...Array(COLOURS).keys()].filter((c) => !near.has(c));
  const spread = free.filter((c) => !far.has(c));
  const choice = (spread.length ? spread : free).sort((a, b) => used[a] - used[b])[0];
  colour[pick] = choice;
  used[choice]++;
}
for (let i = 0; i < geoms.length; i++) {
  for (const j of touching[i]) {
    if (colour[i] === colour[j]) throw new Error(`Same colour touching: ${geoms[i].properties.name} / ${geoms[j].properties.name}`);
  }
  geoms[i].properties.c = colour[i];
}

const { feature } = await import('topojson-client');
const round = (v) => Math.round(v * 1e4) / 1e4;
const roundCoords = (c) => (typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(roundCoords));
const tidy = (fc) => {
  for (const f of fc.features) f.geometry && (f.geometry.coordinates = roundCoords(f.geometry.coordinates));
  return fc;
};
write('countries.json', tidy(feature(topo, topo.objects[layer])));
write('borders.json', tidy({
  type: 'FeatureCollection',
  features: [{ type: 'Feature', properties: {}, geometry: mesh(topo, topo.objects[layer], (a, b) => a !== b) }],
}));

// One point inside each country (inside its largest piece) to hang its name
// on, with its area so bigger countries get bigger names and show first.
mapshaper('-i', cache + 'countries.topo.json',
  '-each', 'area=Math.round(this.area/1e6)', '-points', 'inner',
  '-filter-fields', 'name,area', '-o', 'format=geojson', 'precision=0.001', cache + 'labels.out.json');
write('labels.json', JSON.parse(readFileSync(cache + 'labels.out.json')));

// ------------------------------------------------------------ rivers, lakes
// The world set, plus Natural Earth's more detailed Europe and North America
// sets, which carry many smaller rivers the world set leaves out.
mapshaper('-i', 'combine-files', cache + 'rivers.geojson', cache + 'rivers-europe.geojson', cache + 'rivers-north-america.geojson',
  '-merge-layers', 'force', '-filter-fields', 'name,scalerank',
  '-simplify', '60%', '-o', 'precision=0.0001', cache + 'rivers.out.json');
write('rivers.json', JSON.parse(readFileSync(cache + 'rivers.out.json')));

// Names need smooth lines to run along: letters will not bend round every
// meander, so the names ride on a much simpler copy of each named river.
mapshaper('-i', cache + 'rivers.out.json', '-filter', 'Boolean(name)',
  '-simplify', '6%', '-o', 'precision=0.001', cache + 'river-names.out.json');
write('river-names.json', JSON.parse(readFileSync(cache + 'river-names.out.json')));

mapshaper('-i', 'combine-files', cache + 'lakes.geojson', cache + 'lakes-europe.geojson', cache + 'lakes-north-america.geojson',
  '-merge-layers', 'force', '-filter-fields', 'name,scalerank', '-simplify', '45%', 'keep-shapes',
  '-o', 'precision=0.0001', cache + 'lakes.out.json');
write('lakes.json', JSON.parse(readFileSync(cache + 'lakes.out.json')));

// -------------------------------------------------------------------- ports
// The World Port Index first: it has the particulars. Then every UN/LOCODE
// place marked as a port that the Index does not already have.
const { findPorts } = require('seaport-data-js');
const wpi = await findPorts({});
const RANK = { Large: 0, Medium: 1, Small: 2, 'Very Small': 3 };
const zone = (lat, lon) => findZone(lat, lon)[0] || 'UTC';

const ports = [];
const details = [];
const seen = new Set();
const grid = new Map();
const cell = (lat, lon) => `${Math.floor(lat * 20)}:${Math.floor(lon * 20)}`;
const near = (lat, lon, cc) => {
  const [a, b] = [Math.floor(lat * 20), Math.floor(lon * 20)];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const p of grid.get(`${a + i}:${b + j}`) || []) {
      if (p.cc === cc && Math.hypot(p.lat - lat, (p.lon - lon) * Math.cos(lat * Math.PI / 180)) < 0.03) return true;
    }
  }
  return false;
};
const remember = (lat, lon, cc) => {
  const k = cell(lat, lon);
  grid.set(k, [...(grid.get(k) || []), { lat, lon, cc }]);
};

const m = (v) => (v == null ? null : Math.round(v * 10) / 10);
const yes = (v) => (v === true ? 1 : v === false ? 0 : null);
for (const p of wpi) {
  const lat = round(p.latitude), lon = round(p.longitude);
  const d = [
    p.harbor_size, p.harbor_type, p.harbor_use, p.water_body, p.alternate_name,
    m(p.channel_depth_m), m(p.anchorage_depth_m), m(p.cargo_pier_depth_m),
    m(p.oil_terminal_depth_m), m(p.lng_terminal_depth_m), m(p.tidal_range_m),
    m(p.max_vessel_length_m), m(p.max_vessel_draft_m),
    yes(p.pilotage_compulsory), yes(p.tugs_assistance), yes(p.first_port_of_entry),
    yes(p.medical_facilities), yes(p.supply_provisions), yes(p.supply_potable_water),
    yes(p.supply_fuel_oil), yes(p.supply_diesel_oil), p.repairs, p.dry_dock,
  ];
  details.push(d);
  ports.push([p.name, lon, lat, p.country_code, p.locode || '', RANK[p.harbor_size] ?? 3, zone(lat, lon), details.length - 1]);
  if (p.locode) seen.add(p.locode);
  remember(lat, lon, p.country_code);
}

const csv = readFileSync(cache + 'locode.csv', 'utf8').split('\n');
const parse = (line) => {
  const cols = []; let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { cols.push(cur); cur = ''; } else cur += ch;
  }
  cols.push(cur);
  return cols;
};
const head = parse(csv[0]);
const col = (name) => head.indexOf(name);
const [cC, cL, cN, cS, cF, cX, cCh] = ['Country', 'Location', 'Name', 'Status', 'Function', 'Coordinates', 'Change'].map(col);
const deg = (s, w) => {
  const v = +s.slice(0, w) + +s.slice(w, w + 2) / 60;
  return /[SW]$/.test(s) ? -v : v;
};
let added = 0;
for (const line of csv.slice(1)) {
  if (!line) continue;
  const r = parse(line);
  if (r[cF]?.[0] !== '1' || !r[cX] || ['XX', 'RR'].includes(r[cS]) || r[cCh] === 'X') continue;
  const code = r[cC] + r[cL];
  const mt = r[cX].match(/^(\d{4}[NS]) (\d{5}[EW])$/);
  if (!mt || seen.has(code)) continue;
  const lat = round(deg(mt[1], 2)), lon = round(deg(mt[2], 3));
  if (Math.abs(lat) > 85 || near(lat, lon, r[cC])) continue;
  seen.add(code);
  remember(lat, lon, r[cC]);
  ports.push([r[cN], lon, lat, r[cC], code, 4, zone(lat, lon), -1]);
  added++;
}
console.log(`Ports: ${wpi.length} from the World Port Index, ${added} more from UN/LOCODE`);
write('ports.json', ports);
write('details.json', details);
