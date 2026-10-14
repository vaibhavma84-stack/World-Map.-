// LNG and LPG terminals near ports, into data/terminals.json.
//
//   npm run terminals
//
// Two sources, merged:
//   Wikidata (CC0): items that are LNG or LPG terminals, with position and
//     operator.
//   OpenStreetMap (ODbL), via Overpass: anything named LNG, LPG or
//     "liquefied … gas" within 15 km of a World Port Index port, leaving out
//     filling stations, shops and the like.
// Runs on GitHub (see .github/workflows/terminals.yml), which can reach both.
// Coverage is what those projects hold: good for large terminals, patchy for
// small LPG jetties.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const UA = { 'User-Agent': 'world-map-terminals/1 (github.com/vaibhavma84-stack/World-Map.-)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GAS = /\b(LNG|LPG)\b|liquefied\s+(natural|petroleum)\s+gas|regasification|liquefaction/i;
const kindOf = (text) => {
  const t = text || '';
  const lng = /\bLNG\b|natural gas|regasification|liquefaction/i.test(t);
  const lpg = /\bLPG\b|petroleum gas|propane|butane/i.test(t);
  return lng && lpg ? 'LNG/LPG' : lpg ? 'LPG' : lng ? 'LNG' : null;
};

// ---------------------------------------------------------------- Wikidata
async function wikidata() {
  const terms = ['LNG terminal', 'liquefied natural gas terminal', 'LNG import terminal', 'LNG export terminal',
    'regasification terminal', 'LNG plant', 'liquefied natural gas plant', 'LPG terminal', 'liquefied petroleum gas terminal'];
  const classes = new Set();
  for (const term of terms) {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=7&search=${encodeURIComponent(term)}`;
    try {
      const j = await (await fetch(url, { headers: UA })).json();
      for (const hit of j.search || []) {
        if (GAS.test(hit.label || '') && !/company|ship|carrier|vessel|tanker|project$/i.test(hit.description || '')) {
          classes.add(hit.id);
          console.log(`  class ${hit.id} ${hit.label} — ${hit.description || ''}`);
        }
      }
    } catch (e) { console.warn(`  search "${term}": ${e.message}`); }
    await sleep(300);
  }
  if (!classes.size) return [];
  const query = `SELECT ?item ?itemLabel ?coord ?opLabel ?clsLabel WHERE {
    VALUES ?cls { ${[...classes].map((q) => `wd:${q}`).join(' ')} }
    ?item wdt:P31/wdt:P279* ?cls ; wdt:P625 ?coord .
    OPTIONAL { ?item wdt:P137 ?op }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, { headers: { ...UA, Accept: 'application/sparql-results+json' } });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const rows = (await res.json()).results.bindings;
  const out = new Map();
  for (const r of rows) {
    const m = r.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
    if (!m) continue;
    const name = r.itemLabel?.value || '';
    if (/^Q\d+$/.test(name)) continue; // no English name
    const kind = kindOf(`${name} ${r.clsLabel?.value || ''}`) || 'LNG';
    out.set(r.item.value, { lon: +m[1], lat: +m[2], name, kind, operator: r.opLabel?.value || '', source: 'Wikidata' });
  }
  return [...out.values()];
}

// ----------------------------------------------------------- OpenStreetMap
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const NOT_TERMINALS = ['amenity', 'shop', 'highway', 'railway', 'public_transport', 'route', 'office', 'craft', 'vending', 'healthcare', 'tourism', 'leisure'];

// The Overpass servers are free and often busy, so: the biggest ports first,
// a time limit for the whole run, and whatever a run could not ask about is
// kept from the previous run and tried again next time.
const TIME_LIMIT = 75 * 60000;
const started = Date.now();

async function overpass(query) {
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of SERVERS) {
      if (Date.now() - started > TIME_LIMIT) return null;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 200000);
      try {
        const res = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` });
        if (!res.ok) throw new Error(`${res.status}`);
        const j = await res.json();
        if (j.remark && /error|timed out|runtime/i.test(j.remark)) throw new Error(j.remark);
        return j.elements || [];
      } catch (e) {
        console.warn(`  ${url.split('/')[2]}: ${e.message}`);
        await sleep(4000);
      } finally {
        clearTimeout(timer);
      }
    }
    await sleep(20000);
  }
  return null;
}

async function openStreetMap() {
  const ports = JSON.parse(readFileSync(new URL('data/ports.json', root)))
    .filter((p) => p[7] >= 0)
    .sort((a, b) => a[5] - b[5]); // Large ports first
  const out = [];
  const unasked = [];
  const BATCH = 40;
  for (let i = 0; i < ports.length; i += BATCH) {
    const batch = ports.slice(i, i + BATCH);
    const els = Date.now() - started > TIME_LIMIT ? null : await overpass(`[out:json][timeout:180];(${batch.map((p) =>
      `nwr(around:15000,${p[2]},${p[1]})["name"~"LNG|LPG|[Ll]iquefied"];`).join('')});out center tags;`);
    if (!els) { unasked.push(...batch); continue; }
    for (const el of els) {
      const t = el.tags || {};
      if (NOT_TERMINALS.some((k) => t[k])) continue;
      const name = t['name:en'] || t.name || '';
      if (!GAS.test(name)) continue;
      const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
      if (lat == null) continue;
      out.push({ lon, lat, name, kind: kindOf(name), operator: t.operator || '', source: 'OpenStreetMap', rank: el.type === 'node' ? 1 : 0 });
    }
    console.log(`  ports ${Math.min(i + BATCH, ports.length)}/${ports.length}: ${out.length} found, ${unasked.length} ports not asked about`);
    await sleep(1500);
  }
  return { found: out, unasked };
}

// -------------------------------------------------------------------- merge
const km = (a, b) => {
  const r = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * r / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin((b.lon - a.lon) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const words = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['lng', 'lpg', 'terminal', 'the', 'and'].includes(w)));
const alike = (a, b) => {
  const [x, y] = [words(a.name), words(b.name)];
  if (!x.size || !y.size) return true;
  return [...x].some((w) => y.has(w));
};

console.log('Wikidata');
let wd = [];
try { wd = await wikidata(); } catch (e) { console.warn(`  ${e.message}`); }
console.log(`  ${wd.length} terminals`);
console.log('OpenStreetMap');
const { found: osm, unasked } = await openStreetMap();
console.log(`  ${osm.length} named features; ${unasked.length} ports not asked about this time`);

// Near the ports this run could not ask about, keep what the last run found.
let previous = [];
try { previous = JSON.parse(readFileSync(new URL('data/terminals.json', root))); } catch { /* first run */ }
const kept_before = previous
  .filter((r) => r[5] === 'OpenStreetMap')
  .map(([lon, lat, name, kind, operator, source]) => ({ lon, lat, name, kind, operator, source, rank: 0 }))
  .filter((t) => unasked.some((p) => km(t, { lon: p[1], lat: p[2] }) < 16));
console.log(`  ${kept_before.length} kept from the previous run`);
osm.push(...kept_before);

// One entry per terminal: Wikidata first, then OpenStreetMap features that are
// not the same place (same kind of gas, similar name, within 3 km).
const kept = [];
for (const t of [...wd, ...osm.sort((a, b) => a.rank - b.rank)]) {
  if (!t.kind) continue;
  if (kept.some((k) => km(k, t) < 3 && (k.kind === t.kind || k.kind === 'LNG/LPG') && alike(k, t))) continue;
  kept.push(t);
}
const round = (v) => Math.round(v * 1e5) / 1e5;
const rows = kept.map((t) => [round(t.lon), round(t.lat), t.name, t.kind, t.operator, t.source]);
rows.sort((a, b) => a[1] - b[1] || a[0] - b[0]);

// A run that heard nothing from either source keeps the previous file.
if (!wd.length && !osm.length) {
  console.error('Neither source answered; keeping the previous data/terminals.json');
  process.exit(1);
}
writeFileSync(new URL('data/terminals.json', root), JSON.stringify(rows));
console.log(`data/terminals.json: ${rows.length} terminals (${rows.filter((r) => r[3].includes('LNG')).length} LNG, ${rows.filter((r) => r[3].includes('LPG')).length} LPG)`);
