// Fetches every pilot boarding place mapped in OpenSeaMap / OpenStreetMap
// (seamark:type=pilot_boarding) into data/pilots.json.
//
//   npm run pilots
//
// Runs on GitHub (see .github/workflows/pilots.yml), which can reach the
// Overpass servers. Data © OpenStreetMap contributors, ODbL.
//
// Coverage is what volunteers have mapped: good in Europe and at many large
// ports, thin elsewhere. The official list is the Admiralty List of Radio
// Signals, Volume 6, which is not free to copy.
import { readFileSync, writeFileSync } from 'node:fs';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'world-map-pilots/1 (github.com/vaibhavma84-stack)',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The whole world in one question is more than the servers will answer, so
// ask area by area. A busy server refuses some areas; those keep what an
// earlier run found, and the next run tries them again.
const STEP = 20;
async function area(s, w, n, e) {
  const query = `[out:json][timeout:120][bbox:${s},${w},${n},${e}];
(node["seamark:type"="pilot_boarding"];way["seamark:type"="pilot_boarding"];);
out center tags;`;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of SERVERS) {
      try {
        const res = await fetch(url, { method: 'POST', headers: HEADERS, body: `data=${encodeURIComponent(query)}` });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (json.remark && /error|timed out|runtime/i.test(json.remark)) throw new Error(json.remark);
        return json.elements || [];
      } catch (e) {
        console.warn(`  ${url.split('/')[2]}: ${e.message}`);
        await sleep(4000);
      }
    }
    await sleep(30000);
  }
  return null;
}

const file = new URL('../data/pilots.json', import.meta.url);
let previous = [];
try { previous = JSON.parse(readFileSync(file)); } catch { /* first run */ }
const inBox = (b, s, w) => b[1] >= s && b[1] < s + STEP && b[0] >= w && b[0] < w + STEP;

const elements = new Map();
const kept = [];
let failed = 0;
for (let s = -80; s < 90; s += STEP) {
  for (let w = -180; w < 180; w += STEP) {
    const got = await area(s, w, Math.min(s + STEP, 90), w + STEP);
    if (got) {
      for (const el of got) elements.set(`${el.type}${el.id}`, el);
      console.log(`${s}..${s + STEP}, ${w}..${w + STEP}: ${got.length}`);
    } else {
      failed++;
      const old = previous.filter((b) => inBox(b, s, w));
      kept.push(...old);
      console.log(`${s}..${s + STEP}, ${w}..${w + STEP}: no answer, keeping ${old.length} from before`);
    }
    await sleep(2000);
  }
}
const json = { elements: [...elements.values()] };

const round = (v) => Math.round(v * 1e5) / 1e5;
const pilots = [];
for (const el of json.elements) {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) continue;
  const t = el.tags || {};
  const pick = (...keys) => keys.map((k) => t[k]).find(Boolean) || '';
  pilots.push([
    round(lon), round(lat),
    pick('seamark:name', 'name', 'seamark:pilot_boarding:name'),
    pick('seamark:pilot_boarding:category'),
    pick('seamark:pilot_boarding:channel', 'seamark:pilot_boarding:communication_channel', 'seamark:radio_station:channel', 'seamark:communication:channel'),
    pick('seamark:pilot_boarding:information', 'seamark:information', 'description', 'note'),
  ]);
}
pilots.push(...kept);
pilots.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
writeFileSync(file, JSON.stringify(pilots));
console.log(`data/pilots.json: ${pilots.length} pilot boarding places; ${failed} areas unanswered this time`);
// Nothing at all answered: fail, so the run shows red rather than saving nothing.
if (failed && !elements.size && !kept.length) process.exit(1);
