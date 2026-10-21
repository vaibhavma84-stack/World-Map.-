// Stars for the night sky, into data/stars.json: every star to magnitude 5
// (J2000 right ascension and declination, magnitude, colour), the 57
// navigational stars of the Nautical Almanac and Polaris by name and number,
// and the constellation figures.
//
//   node tools/build-stars.mjs
//
// Reads tools/sources/stars/ (d3-celestial 0.7.35, BSD-3; Hipparcos data).
import { readFileSync, writeFileSync } from 'node:fs';

const src = new URL('sources/stars/', import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, src)));
const stars = read('stars.6.json').features;
const names = read('starnames.json');
const lines = read('constellations.lines.json').features;

// The Nautical Almanac's numbering, 1 to 57; HIP numbers where the name is
// shared by more than one star.
const NAV = ['Alpheratz', 'Ankaa', 'Schedar:3179', 'Diphda', 'Achernar', 'Hamal', 'Acamar', 'Menkar:14135', 'Mirfak',
  'Aldebaran', 'Rigel', 'Capella', 'Bellatrix', 'Elnath', 'Alnilam', 'Betelgeuse', 'Canopus', 'Sirius', 'Adhara',
  'Procyon', 'Pollux', 'Avior', 'Suhail', 'Miaplacidus', 'Alphard', 'Regulus', 'Dubhe', 'Denebola', 'Gienah', 'Acrux',
  'Gacrux', 'Alioth', 'Spica', 'Alkaid', 'Hadar', 'Menkent', 'Arcturus', 'Rigil Kentaurus', 'Zubenelgenubi:72622',
  'Kochab', 'Alphecca', 'Antares', 'Atria', 'Sabik', 'Shaula', 'Rasalhague', 'Eltanin', 'Kaus Australis', 'Vega',
  'Nunki', 'Altair', 'Peacock', 'Deneb', 'Enif', "Al Na'ir:109268", 'Fomalhaut', 'Markab:113963'];
const key = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
const navHip = new Map();
NAV.forEach((entry, i) => {
  const [name, hip] = entry.split(':');
  const found = hip || Object.entries(names).find(([, v]) => key(v.name || '') === key(name))?.[0];
  if (!found) throw new Error(`No star named ${name}`);
  navHip.set(String(found), [i + 1, name]);
});
navHip.set('11767', [0, 'Polaris']);

const out = [];
for (const f of stars) {
  const hip = String(f.id);
  const nav = navHip.get(hip);
  if (f.properties.mag > 5 && !nav) continue;
  let [ra, dec] = f.geometry.coordinates;
  if (ra < 0) ra += 360;
  const n = names[hip];
  const row = [Math.round(ra * 1e4) / 1e4, Math.round(dec * 1e4) / 1e4, f.properties.mag, Math.round(parseFloat(f.properties.bv || 0.6) * 100) / 100];
  if (nav) row.push(nav[1], nav[0]);
  else if (n?.name && f.properties.mag <= 2.5) row.push(n.name);
  out.push(row);
}
// Checks: Sirius and Polaris where they should be.
const at = (name) => out.find((r) => r[4] === name);
const near = (r, ra, dec) => Math.abs(r[0] - ra) < 0.05 && Math.abs(r[1] - dec) < 0.05;
if (!near(at('Sirius'), 101.287, -16.716) || !near(at('Polaris'), 37.954, 89.264) || !near(at('Vega'), 279.235, 38.784)) throw new Error('Star positions are off');
if (out.filter((r) => r[5]).length !== 57) throw new Error('Not 57 navigational stars');

const figures = lines.map((f) => ({ c: f.id, l: f.geometry.coordinates.map((part) => part.map(([ra, dec]) => [Math.round((ra < 0 ? ra + 360 : ra) * 100) / 100, Math.round(dec * 100) / 100])) }));
writeFileSync(new URL('../data/stars.json', import.meta.url), JSON.stringify({ stars: out, figures }));
console.log(`data/stars.json: ${out.length} stars, ${figures.length} constellations`);
