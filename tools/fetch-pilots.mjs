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
import { writeFileSync } from 'node:fs';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const QUERY = `[out:json][timeout:900];
(
  node["seamark:type"="pilot_boarding"];
  way["seamark:type"="pilot_boarding"];
  relation["seamark:type"="pilot_boarding"];
);
out center tags;`;

let json;
for (const url of SERVERS) {
  try {
    console.log(`Asking ${url}`);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'world-map-pilots/1 (github.com/vaibhavma84-stack)' },
      body: `data=${encodeURIComponent(QUERY)}`,
    });
    if (!res.ok) throw new Error(`${res.status}`);
    json = await res.json();
    if (json.remark && !json.elements?.length) throw new Error(json.remark);
    break;
  } catch (e) {
    console.warn(`  failed: ${e.message}`);
  }
}
if (!json) throw new Error('No Overpass server answered');

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
pilots.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
writeFileSync(new URL('../data/pilots.json', import.meta.url), JSON.stringify(pilots));
console.log(`data/pilots.json: ${pilots.length} pilot boarding places`);
