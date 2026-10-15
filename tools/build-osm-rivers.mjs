// Rivers and their tributaries, with names, for the whole world, from
// OpenStreetMap as served in OpenFreeMap's tiles: every river the zoom-8
// tiles carry (the main rivers and their larger tributaries), written as
// GeoJSON lines for tippecanoe.
//
//   node tools/build-osm-rivers.mjs > rivers.geojsonl
//
// Land is found at zoom 5 first (tiles holding anything but sea), and only
// the zoom-8 tiles under those are read. Rivers cut at tile edges are kept
// as they are; drawn together they join up.
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';

const UA = { 'User-Agent': 'WorldMapRivers/1.0 (https://github.com/vaibhavma84-stack/World-Map.-; personal seafarer map)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tj = await (await fetch('https://tiles.openfreemap.org/planet', { headers: UA })).json();
const url = (z, x, y) => tj.tiles[0].replace('{z}', z).replace('{x}', x).replace('{y}', y);

async function tile(z, x, y) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url(z, x, y), { headers: UA });
      if (res.status === 204 || res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return new VectorTile(new Pbf(Buffer.from(await res.arrayBuffer())));
    } catch (e) {
      if (attempt === 4) { console.error(`  ${z}/${x}/${y}: ${e.message}`); return null; }
      await sleep(2000 * (attempt + 1));
    }
  }
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// Zoom 5: which tiles hold land.
const land = [];
const all5 = [];
for (let x = 0; x < 32; x++) for (let y = 0; y < 32; y++) all5.push([x, y]);
await pool(all5, 8, async ([x, y]) => {
  const vt = await tile(5, x, y);
  if (vt && Object.keys(vt.layers).some((l) => !['water', 'water_name'].includes(l))) land.push([x, y]);
});
console.error(`${land.length} land tiles at zoom 5`);

// Zoom 8 under them: the rivers.
const z8 = [];
for (const [x5, y5] of land) for (let dx = 0; dx < 8; dx++) for (let dy = 0; dy < 8; dy++) z8.push([x5 * 8 + dx, y5 * 8 + dy]);
let done = 0, lines = 0;
await pool(z8, 8, async ([x, y]) => {
  const vt = await tile(8, x, y);
  const w = vt?.layers.waterway;
  for (let i = 0; w && i < w.length; i++) {
    const f = w.feature(i);
    if (f.properties.class !== 'river') continue;
    const g = f.toGeoJSON(x, y, 8);
    const name = f.properties.name_en || f.properties['name:en'] || f.properties.name_int || f.properties.name || '';
    const round = (cs) => cs.map(([a, b]) => [Math.round(a * 1e4) / 1e4, Math.round(b * 1e4) / 1e4]);
    const geometry = g.geometry.type === 'LineString'
      ? { type: 'LineString', coordinates: round(g.geometry.coordinates) }
      : { type: 'MultiLineString', coordinates: g.geometry.coordinates.map(round) };
    process.stdout.write(JSON.stringify({ type: 'Feature', properties: name ? { n: name } : {}, geometry }) + '\n');
    lines++;
  }
  if (++done % 2000 === 0) console.error(`  ${done} / ${z8.length} tiles, ${lines} river lines`);
});
console.error(`${lines} river lines from ${z8.length} tiles`);
