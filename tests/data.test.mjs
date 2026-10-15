// Checks the built data and the app's own helpers.   npm test
import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { COUNTRIES } from '../js/countries.js';
import { offsetMinutes, zonedToUtc, nextClockChange, sun, position } from '../js/time.js';

const root = new URL('..', import.meta.url).pathname;
const json = (f) => JSON.parse(readFileSync(`${root}data/${f}.json`));
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// Countries: 15 colours, and no two that share a border share one.
const countries = json('countries');
ok(countries.features.length > 200, 'countries present');
ok(countries.features.every((f) => f.properties.c >= 0 && f.properties.c < 15), 'every country coloured 0–14');
ok(new Set(countries.features.map((f) => f.properties.c)).size === 15, 'all 15 colours used');
{
  // Countries touch when they share a border point exactly (one topology).
  const owners = new Map();
  countries.features.forEach((f, i) => {
    const walk = (c) => (typeof c[0] === 'number' ? [c] : c.flatMap(walk));
    for (const [x, y] of walk(f.geometry.coordinates)) {
      const k = `${x},${y}`;
      if (!owners.has(k)) owners.set(k, new Set());
      owners.get(k).add(i);
    }
  });
  const clash = [];
  for (const set of owners.values()) {
    const ids = [...set];
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const [fa, fb] = [countries.features[ids[a]], countries.features[ids[b]]];
      if (fa.properties.c === fb.properties.c) clash.push(`${fa.properties.name} / ${fb.properties.name}`);
    }
  }
  ok(clash.length === 0, `neighbours share a colour: ${[...new Set(clash)].slice(0, 5).join(', ')}`);
}

// Ports: valid places, valid zones, a country the app knows.
const ports = json('ports');
ok(ports.length > 12000, `ports: ${ports.length}`);
const zones = new Set(ports.map((p) => p[6]));
for (const z of zones) {
  try { new Intl.DateTimeFormat('en', { timeZone: z }); } catch { assert.fail(`bad zone ${z}`); }
}
checks++;
ok(ports.every((p) => Math.abs(p[1]) <= 180 && Math.abs(p[2]) <= 90 && p[0]), 'positions in range, names present');
const unknown = [...new Set(ports.map((p) => p[3]))].filter((c) => !COUNTRIES[c] && !['AQ', 'HM', 'GS', 'TF', 'UM', 'XZ'].includes(c));
ok(unknown.length === 0, `countries without currency: ${unknown}`);
const details = json('details');
ok(ports.filter((p) => p[7] >= 0).every((p) => details[p[7]]), 'every World Port Index port has particulars');

// Gas terminals: either not fetched yet, or well-formed.
const gas = json('terminals');
ok(Array.isArray(gas) && gas.every((t) => t.length === 6 && Math.abs(t[0]) <= 180 && Math.abs(t[1]) <= 90 && ['LNG', 'LPG', 'LNG/LPG'].includes(t[3])), 'terminals well-formed');
ok(!gas.some((t) => /TEST/.test(t[2])), 'no test data in terminals');

// Traffic separation schemes: either not fetched yet, or well-formed.
const { KINDS } = await import('../tools/fetch-tss.mjs');
const tss = json('tss');
const tssKinds = new Set(Object.values(KINDS));
ok(tss.type === 'FeatureCollection' && tss.features.every((f) => tssKinds.has(f.properties.k)
  && ['LineString', 'Polygon'].includes(f.geometry.type)), 'tss well-formed');

// Harbour coastlines: once built, every square listed is there.
if (existsSync(`${root}data/coast/index.json`)) {
  const idx = json('coast/index');
  const keys = Object.keys(idx.cells);
  ok(keys.length > 1000, `coast squares: ${keys.length}`);
  ok(keys.every((k) => existsSync(`${root}data/coast/${k}.json`)), 'every coast square present');
}

// Every file the offline copy keeps exists.
const sw = readFileSync(`${root}sw.js`, 'utf8');
const ranges = eval(sw.match(/const RANGES = (\[[^\]]*\])/)[1]);
const fonts = eval(sw.match(/const FONTS = (\[[^\]]*\])/)[1]);
const files = [...sw.matchAll(/'([^']+\.(?:html|css|js|json|png|webmanifest))'/g)].map((m) => m[1]).filter((f) => !f.startsWith('data/coast/') && f !== 'index.json');
// (data/coast/index.json is cached only once the coastline job has made it.)
for (const f of [...files, ...fonts.flatMap((n) => ranges.map((r) => `fonts/${n}/${r}.pbf`))]) {
  ok(existsSync(root + f), `offline file missing: ${f}`);
}

// Clocks.
ok(offsetMinutes('Asia/Kolkata', new Date('2026-01-01T00:00Z')) === 330, 'India +5:30');
ok(offsetMinutes('Europe/London', new Date('2026-07-01T00:00Z')) === 60, 'London summer +1');
ok(zonedToUtc('America/New_York', 2026, 7, 4, 12, 0).toISOString() === '2026-07-04T16:00:00.000Z', 'wall time to UTC');
const change = nextClockChange('Europe/London', new Date('2026-10-11T00:00Z'));
ok(change && change.at.toISOString() === '2026-10-25T01:00:00.000Z' && change.to === 0, 'London clocks go back 25 Oct 2026');
ok(nextClockChange('Asia/Kolkata', new Date('2026-10-11T00:00Z')) === null, 'India keeps one time');
const s = sun(18.95, 72.85, new Date('2026-10-11T06:00Z'));
const ist = (d) => new Date(d.getTime() + 330 * 60000).toISOString().slice(11, 16);
ok(ist(s.rise) >= '06:25' && ist(s.rise) <= '06:35' && ist(s.set) >= '18:14' && ist(s.set) <= '18:24', `Mumbai sun ${ist(s.rise)} ${ist(s.set)}`);
ok(sun(78, 15, new Date('2026-06-21T12:00Z')).polar === 'day', 'Svalbard midnight sun');
ok(position(51.9, 4.4833) === '51°54.0′N 004°29.0′E', 'position format');


// Regulatory areas: well-formed, and a few known places in the right areas.
{
  const zones = json('zones');
  ok(zones.features.length >= 30 && zones.features.every((f) => ['eca', 'marpol', 'll'].includes(f.properties.k)), 'zones well-formed');
  globalThis.fetch = async () => ({ ok: true, json: async () => zones });
  const z = await import('../js/zones.js');
  await z.zonesReady;
  const at = (lon, lat, d) => z.zonesAt(lon, lat, new Date(d));
  ok(at(3, 55, '2026-01-10').eca.some((e) => /North Sea/.test(e.name)), 'North Sea is an ECA');
  ok(at(56.5, 26.5, '2026-01-10').marpol.some((m) => m.name === 'Gulfs area'), 'Hormuz is in the Gulfs special area');
  ok(at(56.5, 26.5, '2026-01-10').ll?.season === 'T', 'Persian Gulf is Tropical');
  ok(at(-40, 50, '2026-01-10').ll?.season === 'W' && at(-40, 50, '2026-07-10').ll?.season === 'S', 'N Atlantic Zone I winter and summer');
  ok(at(64, 15, '2026-07-10').ll?.season === 'S' && at(64, 15, '2026-01-10').ll?.season === 'T', 'Arabian Sea seasonal tropical');
  ok(!at(150, -30, '2026-01-10').ll && !at(150, -30, '2026-01-10').eca.length, 'off Sydney: Summer Zone, no ECA');
  ok(at(10, 38, '2026-01-10').eca.some((e) => /Mediterranean/.test(e.name)), 'Mediterranean SOx ECA');
}

console.log(`${checks} checks passed`);
