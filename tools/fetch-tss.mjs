// Traffic separation schemes and other routeing measures, into data/tss.json,
// so they show offline and complete (the OpenSeaMap picture layer leaves
// gaps, as at Hormuz).
//
//   npm run tss
//
// From OpenStreetMap's sea marks (ODbL), via Overpass, a box of the world at
// a time. Runs on GitHub (see .github/workflows/tss.yml). A box the servers
// could not answer keeps what the previous run found there.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const UA = { 'User-Agent': 'WorldMapTSS/1.0 (https://github.com/vaibhavma84-stack/World-Map.-; personal seafarer map) node-fetch' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// OpenStreetMap seamark:type → the short kind the app draws.
export const KINDS = {
  separation_zone: 'zone',
  separation_roundabout: 'zone',
  separation_line: 'line',
  separation_boundary: 'boundary',
  separation_lane: 'lane',
  separation_crossing: 'crossing',
  inshore_traffic_zone: 'itz',
  precautionary_area: 'precaution',
  recommended_track: 'track',
  recommended_route_centreline: 'track',
  deep_water_route_centreline: 'dw',
  two_way_route: 'twoway',
  'two-way_route': 'twoway',
};
const TYPES = Object.keys(KINDS).join('|');

// The servers are free and often busy: stop asking after this long, write
// what came, and keep the previous run's finds for the boxes not reached.
const TIME_LIMIT = 140 * 60000;
const started = Date.now();
const late = () => Date.now() - started > TIME_LIMIT;

async function overpass(query) {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of SERVERS) {
      if (late()) return null;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 240000);
      try {
        const res = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` });
        if (!res.ok) throw new Error(`${res.status}`);
        const j = await res.json();
        if (j.remark && /error|timed out|runtime/i.test(j.remark)) throw new Error(j.remark);
        return j.elements || [];
      } catch (e) {
        console.warn(`  ${url.split('/')[2]}: ${e.message}`);
        await sleep(5000);
      } finally {
        clearTimeout(timer);
      }
    }
    await sleep(30000 * (attempt + 1));
  }
  return null;
}

const round = (v) => Math.round(v * 1e5) / 1e5;
const coords = (geom) => (geom || []).filter((g) => g && g.lat != null).map((g) => [round(g.lon), round(g.lat)]);
const closed = (c) => c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1];

// Overpass elements (with "out geom") → features: zones as areas where the
// way closes, everything else as lines in the way's own direction (which for
// a lane is the direction of traffic).
export function features(elements) {
  const out = [];
  const seen = new Set();
  const add = (kind, c, name) => {
    if (c.length < 2) return;
    const key = `${kind}:${c[0]}:${c[c.length - 1]}:${c.length}`;
    if (seen.has(key)) return;
    seen.add(key);
    const area = ['zone', 'itz', 'precaution'].includes(kind) && closed(c);
    out.push({
      type: 'Feature',
      properties: name ? { k: kind, n: name } : { k: kind },
      geometry: area ? { type: 'Polygon', coordinates: [c] } : { type: 'LineString', coordinates: c },
    });
  };
  for (const el of elements) {
    const t = el.tags || {};
    const kind = KINDS[t['seamark:type']];
    if (!kind) continue;
    const name = t['seamark:name'] || t.name || '';
    if (el.type === 'way') add(kind, coords(el.geometry), name);
    else if (el.type === 'relation') {
      for (const m of el.members || []) if (m.type === 'way' && m.role !== 'inner') add(kind, coords(m.geometry), name);
    }
  }
  return out;
}

// The world in boxes of 30° by 30°, small enough for the servers; the
// busiest waters first (Gulf and Hormuz, Red Sea, Malacca, Europe, East
// Asia, the US coasts), the empty polar boxes last.
const FIRST = [[0, 30], [0, 90], [30, 0], [30, -30], [0, 120], [30, 120], [0, 60], [30, 30], [0, -90], [30, -90], [30, -120], [30, -60], [0, 0], [-30, 0], [-30, 120], [-30, 30]];
function boxes() {
  const list = [];
  for (let s = -90; s < 90; s += 30) for (let w = -180; w < 180; w += 30) list.push([s, w, s + 30, w + 30]);
  const rank = (b) => {
    const i = FIRST.findIndex(([s, w]) => s === b[0] && w === b[1]);
    return i >= 0 ? i : FIRST.length + Math.abs(b[0] + 15);
  };
  return list.sort((a, b) => rank(a) - rank(b));
}
const inBox = (f, [s, w, n, e]) => {
  const c = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0];
  return c[1] >= s && c[1] < n && c[0] >= w && c[0] < e;
};

if (import.meta.url === `file://${process.argv[1]}`) {
  let previous = [];
  try { previous = JSON.parse(readFileSync(new URL('data/tss.json', root))).features; } catch { /* first run */ }
  const all = [];
  let answered = 0;
  for (const box of boxes()) {
    const [s, w, n, e] = box;
    // The box goes on each statement, not as a global [bbox:], which would
    // cut the shapes off at its edges.
    const b = `(${s},${w},${n},${e})`;
    const q = `[out:json][timeout:200];(way["seamark:type"~"^(${TYPES})$"]${b};relation["seamark:type"~"^(${TYPES})$"]${b};);out geom;`;
    const els = await overpass(q);
    if (els) {
      answered++;
      // Keep each feature in the box where it starts, so none is doubled.
      const got = features(els).filter((f) => inBox(f, box));
      all.push(...got);
      console.log(`  ${s},${w}: ${got.length}`);
    } else {
      const kept = previous.filter((f) => inBox(f, box));
      all.push(...kept);
      console.log(`  ${s},${w}: no answer, kept ${kept.length} from before`);
    }
    await sleep(3000);
  }
  if (!answered) {
    console.error('No box answered; keeping the previous data/tss.json');
    process.exit(1);
  }
  writeFileSync(new URL('data/tss.json', root), JSON.stringify({ type: 'FeatureCollection', features: all }));
  const count = (k) => all.filter((f) => f.properties.k === k).length;
  console.log(`data/tss.json: ${all.length} features (${count('zone')} zones, ${count('lane')} lanes, ${count('track')} tracks)`);
}
