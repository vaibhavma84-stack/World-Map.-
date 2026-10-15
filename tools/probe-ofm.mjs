// What the OpenFreeMap tiles hold for rivers at each zoom, over India.
//   node tools/probe-ofm.mjs
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
const tj = await (await fetch('https://tiles.openfreemap.org/planet')).json();
const t = (z, lon, lat) => {
  const n = 2 ** z, r = lat * Math.PI / 180;
  return [z, Math.floor((lon + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)];
};
for (const [z, x, y] of [t(5, 80, 22), t(6, 80, 22), t(7, 82, 21), t(8, 82, 21), t(9, 82, 21)]) {
  const url = tj.tiles[0].replace('{z}', z).replace('{x}', x).replace('{y}', y);
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  const vt = new VectorTile(new Pbf(buf));
  const w = vt.layers.waterway;
  const classes = {}, names = new Set();
  for (let i = 0; w && i < w.length; i++) { const p = w.feature(i).properties; classes[p.class] = (classes[p.class] || 0) + 1; if (p.name) names.add(p.name); }
  console.log(`z${z} ${x}/${y}: ${buf.length} bytes, layers ${Object.keys(vt.layers).join(',')}`);
  console.log(`   waterway ${JSON.stringify(classes)} names: ${[...names].slice(0, 15).join(', ')}`);
}
