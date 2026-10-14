// Copies the map renderer into vendor/ and fetches the letter shapes (glyphs)
// the map's labels use into fonts/ (as OpenSans-Regular and so on: the map
// asks for them by those names, and paths without spaces travel better), so the app draws text with no connection.
//
//   npm run vendor        (after npm run data, which decides which letters)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
mkdirSync(`${root}vendor`, { recursive: true });
for (const f of ['maplibre-gl.js', 'maplibre-gl.css', 'LICENSE.txt']) {
  copyFileSync(`${root}node_modules/maplibre-gl/dist/${f === 'LICENSE.txt' ? '../LICENSE.txt' : f}`, `${root}vendor/${f.replace('LICENSE', 'maplibre-LICENSE')}`);
}

// The reader for the world coastline file (PMTiles), as a plain script.
copyFileSync(`${root}node_modules/pmtiles/dist/pmtiles.js`, `${root}vendor/pmtiles.js`);

// Every letter any label can show, and so which 256-letter blocks are needed.
const text = [];
for (const p of JSON.parse(readFileSync(`${root}data/ports.json`))) text.push(p[0]);
for (const f of ['countries', 'rivers', 'lakes']) {
  for (const x of JSON.parse(readFileSync(`${root}data/${f}.json`)).features) text.push(x.properties.name || '');
}
text.push('0123456789 -–—().,\'’');
const blocks = new Set();
for (const ch of text.join('')) blocks.add(Math.floor(ch.codePointAt(0) / 256));

const FONTS = ['Open Sans Regular', 'Open Sans Semibold', 'Open Sans Italic', 'Open Sans Bold'];
const BASE = 'https://raw.githubusercontent.com/openmaptiles/fonts/gh-pages/';
for (const font of FONTS) {
  const dir = font.replace('Open Sans ', 'OpenSans-');
  mkdirSync(`${root}fonts/${dir}`, { recursive: true });
  for (const b of [...blocks].sort((a, z) => a - z)) {
    const range = `${b * 256}-${b * 256 + 255}`;
    const file = `${root}fonts/${dir}/${range}.pbf`;
    if (existsSync(file)) continue;
    const res = await fetch(`${BASE}${encodeURIComponent(font)}/${range}.pbf`);
    if (!res.ok) { console.warn(`${font} ${range}: ${res.status}`); continue; }
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
}
console.log(`Glyph blocks: ${[...blocks].sort((a, z) => a - z).join(', ')}`);
