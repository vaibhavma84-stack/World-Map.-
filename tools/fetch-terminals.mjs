// LNG and LPG terminals near ports, into data/terminals.json.
//
//   npm run terminals
//
// Two sources, merged:
//   Wikidata (CC0): items that are LNG or LPG terminals, with position and
//     operator.
//   OpenStreetMap (ODbL), via Overpass: anything named LNG, LPG or
//     "liquefied … gas" within 12 km of large and medium ports and those
//     listed with an LNG terminal, leaving out filling stations, shops and
//     the like.
// Runs on GitHub (see .github/workflows/terminals.yml), which can reach both.
// Coverage is what those projects hold: good for large terminals, patchy for
// small LPG jetties.
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const UA = { 'User-Agent': 'WorldMapTerminals/1.0 (https://github.com/vaibhavma84-stack/World-Map.-; personal seafarer map) node-fetch' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GAS = /\b(LNG|LPG)\b|liquefied\s+(natural|petroleum)\s+gas|regasification|liquefaction/i;
const kindOf = (text) => {
  const t = text || '';
  const lng = /\bLNG\b|natural gas|regasification|liquefaction/i.test(t);
  const lpg = /\bLPG\b|petroleum gas|propane|butane/i.test(t);
  return lng && lpg ? 'LNG/LPG' : lpg ? 'LPG' : lng ? 'LNG' : null;
};

// ---------------------------------------------------------------- Wikidata
// Text search for items with a position (haswbstatement:P625), then the
// items themselves: kept when their name or description says LNG or LPG and
// that they are a terminal, plant or facility (not a ship, firm or article).
const WD = 'https://www.wikidata.org/w/api.php';
// Proposed terminals that were never built, which Wikidata does not mark so.
const NEVER_BUILT = /^Crown Landing\b/i;
const PLACE = /terminal|plant|facility|regasification|liquefaction|import|export|storage|jetty|port|harbou?r|FSRU|floating storage/i;
const NOT_PLACE = /ship|vessel|carrier|tanker|company|corporation|business|article|scholarly|journal|patent|project company|family name|given name/i;

// Wikidata turns away requests that come too fast; go gently, retry, and say
// what it answered when it refuses.
async function wdJson(params) {
  const url = `${WD}?${new URLSearchParams({ format: 'json', maxlag: '5', ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { ...UA, Accept: 'application/json' } });
      const text = await res.text();
      try { return JSON.parse(text); } catch { throw new Error(`${res.status} ${text.slice(0, 160).replace(/\s+/g, ' ')}`); }
    } catch (e) {
      console.warn(`  Wikidata: ${e.message}`);
      await sleep(5000 * 3 ** attempt);
    }
  }
  return null;
}

async function entities(ids, props) {
  const j = await wdJson({ action: 'wbgetentities', props, languages: 'en', ids: ids.join('|') });
  if (j?.entities) return Object.values(j.entities);
  // One at a time, from the plain data pages, if the batch is refused.
  const out = [];
  for (const id of ids) {
    try {
      const r = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${id}.json`, { headers: UA });
      const d = await r.json();
      out.push(...Object.values(d.entities || {}));
    } catch (e) { console.warn(`  ${id}: ${e.message}`); }
    await sleep(1000);
  }
  return out;
}

async function wikidata() {
  const terms = ['LNG terminal', 'LNG', 'LNG import terminal', 'LNG export terminal', 'liquefied natural gas',
    'regasification terminal', 'FSRU', 'LPG terminal', 'liquefied petroleum gas terminal', 'LPG import terminal'];
  const ids = new Set();
  for (const term of terms) {
    for (let offset = 0; offset < 1500; offset += 500) {
      try {
        const j = await wdJson({ action: 'query', list: 'search', srlimit: '500', sroffset: String(offset), srsearch: `${term} haswbstatement:P625` });
        const hits = j?.query?.search || [];
        for (const h of hits) ids.add(h.title);
        if (hits.length < 500) break;
      } catch (e) { console.warn(`  search "${term}": ${e.message}`); break; }
      await sleep(1500);
    }
  }
  console.log(`  ${ids.size} candidate items`);
  const list = [...ids];
  const out = [];
  const operators = new Map();
  for (let i = 0; i < list.length; i += 50) {
    for (const e of await entities(list.slice(i, i + 50), 'labels|descriptions|claims')) {
      const name = e.labels?.en?.value || '';
      const desc = e.descriptions?.en?.value || '';
      const text = `${name} ${desc}`;
      if (!name || !GAS.test(text) || !PLACE.test(text) || NOT_PLACE.test(desc)) continue;
      // Gas-fired power stations are not terminals; nor is anything proposed,
      // cancelled, closed or no longer standing (P576: dissolved/demolished).
      if (/power (plant|station)|combined cycle|generating station/i.test(text)) continue;
      if (/proposed|planned|cancel|former|defunct|decommission|abandon|closed/i.test(desc)) continue;
      if (e.claims?.P576) continue;
      if (NEVER_BUILT.test(name)) continue;
      const coord = e.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
      if (!coord) continue;
      const op = e.claims?.P137?.[0]?.mainsnak?.datavalue?.value?.id || '';
      out.push({ lon: coord.longitude, lat: coord.latitude, name, kind: kindOf(text) || 'LNG', operator: op, source: 'Wikidata', desc });
      if (op) operators.set(op, '');
    }
    await sleep(1500);
  }
  // Operators' names.
  const opIds = [...operators.keys()];
  for (let i = 0; i < opIds.length; i += 50) {
    for (const e of await entities(opIds.slice(i, i + 50), 'labels')) operators.set(e.id, e.labels?.en?.value || '');
    await sleep(1500);
  }
  for (const t of out) t.operator = operators.get(t.operator) || '';
  return out;
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
const TIME_LIMIT = 10 * 60000;
const started = Date.now();

async function overpass(query) {
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const url of SERVERS) {
      if (Date.now() - started > TIME_LIMIT) return null;
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 110000);
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
  // Ports likely to have gas terminals: large and medium ones, and any the
  // World Port Index lists with an LNG terminal. Large ports first.
  const details = JSON.parse(readFileSync(new URL('data/details.json', root)));
  const ports = JSON.parse(readFileSync(new URL('data/ports.json', root)))
    .filter((p) => p[7] >= 0 && (p[5] <= 1 || details[p[7]][9] != null))
    .sort((a, b) => a[5] - b[5]);
  const out = [];
  const unasked = [];
  const BATCH = 6;
  for (let i = 0; i < ports.length; i += BATCH) {
    const batch = ports.slice(i, i + BATCH);
    const els = Date.now() - started > TIME_LIMIT ? null : await overpass(`[out:json][timeout:90];(${batch.map((p) =>
      `nwr(around:12000,${p[2]},${p[1]})["name"~"LNG|LPG|[Ll]iquefied"];`).join('')});out center tags;`);
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
