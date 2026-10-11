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
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'User-Agent': 'world-map-pilots/1 (github.com/vaibhavma84-stack)',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The whole world in one question is more than the servers will answer, so
// ask area by area: 30° of latitude by 45° of longitude at a time.
async function area(s, w, n, e) {
  const query = `[out:json][timeout:180][bbox:${s},${w},${n},${e}];
(node["seamark:type"="pilot_boarding"];way["seamark:type"="pilot_boarding"];relation["seamark:type"="pilot_boarding"];);
out center tags;`;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of SERVERS) {
      try {
        const res = await fetch(url, { method: 'POST', headers: HEADERS, body: `data=${encodeURIComponent(query)}` });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(json.remark);
        return json.elements || [];
      } catch (e) {
        console.warn(`  ${url.split('/')[2]}: ${e.message}`);
        await sleep(3000);
      }
    }
    await sleep(20000 * (attempt + 1));
  }
  throw new Error(`No server answered for ${s},${w},${n},${e}`);
}

const elements = new Map();
for (let s = -90; s < 90; s += 30) {
  for (let w = -180; w < 180; w += 45) {
    const got = await area(s, w, s + 30, w + 45);
    for (const el of got) elements.set(`${el.type}${el.id}`, el);
    console.log(`${s}..${s + 30}, ${w}..${w + 45}: ${got.length}`);
    await sleep(1500);
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
pilots.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
writeFileSync(new URL('../data/pilots.json', import.meta.url), JSON.stringify(pilots));
console.log(`data/pilots.json: ${pilots.length} pilot boarding places`);
