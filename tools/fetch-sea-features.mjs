// Things at sea, for the map, offline:
//   data/lights.json   lighthouses and major lights with their characters
//                      (OpenStreetMap seamarks, ODbL);
//   data/offshore.json oil and gas platforms and offshore wind farms (OSM);
//   data/cables.json   submarine telecom cables (TeleGeography, CC BY-NC-SA)
//                      and submarine pipelines and power cables (OSM);
//   data/seabed.json   named undersea features: trenches, ridges, seamounts,
//                      basins, canyons (Wikidata, CC0).
//
//   node tools/fetch-sea-features.mjs
//
// Runs on GitHub (.github/workflows/sea-features.yml). Each part keeps the
// previous file if its source does not answer.
import { readFileSync, writeFileSync } from 'node:fs';

const UA = { 'User-Agent': 'WorldMapSea/1.0 (https://github.com/vaibhavma84-stack/World-Map.-; personal map)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const root = new URL('..', import.meta.url);
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const r3 = (v) => Math.round(v * 1e3) / 1e3;

async function overpass(query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of SERVERS) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 600000);
      try {
        const res = await fetch(url, { method: 'POST', signal: ctl.signal, headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` });
        if (!res.ok) throw new Error(`${res.status}`);
        const j = await res.json();
        if (j.remark && /error|timed out|runtime/i.test(j.remark)) throw new Error(j.remark.slice(0, 120));
        return j.elements || [];
      } catch (e) {
        console.warn(`  ${url.split('/')[2]}: ${e.message}`);
        await sleep(8000);
      } finally {
        clearTimeout(timer);
      }
    }
    await sleep(45000 * (attempt + 1));
  }
  return null;
}
// The world in longitude bands, so no one query is too big.
async function bands(make, width = 30) {
  const all = [];
  for (let w = -180; w < 180; w += width) {
    const els = await overpass(make(`(-85,${w},85,${w + width})`));
    if (!els) return null;
    console.log(`  ${w}..${w + width}: ${els.length}`);
    all.push(...els);
    await sleep(5000);
  }
  const seen = new Set();
  return all.filter((e) => { const k = `${e.type}${e.id}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
function keep(name, features, min) {
  const path = new URL(`data/${name}.json`, root);
  if (!features || features.length < min) {
    console.log(`data/${name}.json: only ${features?.length ?? 0}; keeping the previous file`);
    return;
  }
  writeFileSync(path, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`data/${name}.json: ${features.length} features, ${(readFileSync(path).length / 1e6).toFixed(1)} MB`);
}
const point = (el, props) => {
  const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
  return lat == null ? null : { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: [r5(lon), r5(lat)] } };
};

// ----------------------------------------------------------------- lights
// The light's character as on the chart, e.g. "Fl(2)W.10s25M".
function lightOf(t) {
  const pre = ['seamark:light:', 'seamark:light:1:'].find((p) => t[`${p}character`]) || 'seamark:light:';
  const g = (k) => t[`${pre}${k}`];
  const ch = g('character');
  if (!ch) return null;
  const colourCode = { white: 'W', red: 'R', green: 'G', yellow: 'Y', blue: 'Bu', orange: 'Or', violet: 'Vi' };
  const colours = (g('colour') || '').split(';').map((c) => colourCode[c.trim()] || '').join('');
  const group = g('group') ? `(${g('group')})` : '';
  const period = g('period') ? `${g('period')}s` : '';
  const range = g('range') ? `${g('range')}M` : '';
  const height = g('height') ? `${g('height')}m` : '';
  return { c: ch, gr: g('group') || '', col: colours, p: Number(g('period')) || 0, text: `${ch}${group}${colours}${period ? `.${period}` : ''}${height}${range}`, seq: g('sequence') || '' };
}
async function lights() {
  console.log('Lights');
  const els = await bands((b) => `[out:json][timeout:600];(node["seamark:type"~"^(light_major|lighthouse)$"]${b};node["man_made"="lighthouse"]["seamark:light:character"]${b};);out tags;`);
  if (!els) return null;
  const out = [];
  for (const el of els) {
    const t = el.tags || {};
    const l = lightOf(t);
    const f = point(el, { n: t['seamark:name'] || t['name:en'] || t.name || '', ...(l ? { ch: l.text, c: l.c, gr: l.gr, col: l.col, p: l.p, seq: l.seq } : {}), maj: t['seamark:type'] === 'light_minor' ? 0 : 1 });
    if (f && (l || f.properties.n)) out.push(f);
  }
  return out;
}

// ---------------------------------------------------------- offshore works
async function offshore() {
  console.log('Platforms and wind farms');
  const els = await bands((b) => `[out:json][timeout:600];(
    nwr["seamark:type"="platform"]${b};
    nwr["man_made"="offshore_platform"]${b};
    nwr["seamark:type"="production_area"]["seamark:production_area:category"="wind_farm"]${b};
    nwr["power"="plant"]["plant:source"="wind"]["offshore"="yes"]${b};
    nwr["power"="plant"]["plant:source"="wind"]["location"="offshore"]${b};
  );out center tags;`, 60);
  if (!els) return null;
  const out = [];
  for (const el of els) {
    const t = el.tags || {};
    const wind = t['plant:source'] === 'wind' || t['seamark:production_area:category'] === 'wind_farm';
    const f = point(el, { k: wind ? 'wind' : 'platform', n: t['seamark:name'] || t.name || '', op: t.operator || '', pr: t.product || t['seamark:platform:category'] || '' });
    if (f) out.push(f);
  }
  return out;
}

// --------------------------------------------------- cables and pipelines
async function cables() {
  console.log('Cables and pipelines');
  const out = [];
  try {
    const j = await (await fetch('https://www.submarinecablemap.com/api/v3/cable/cable-geo.json', { headers: UA })).json();
    for (const f of j.features || []) {
      const lines = f.geometry.type === 'MultiLineString' ? f.geometry.coordinates : [f.geometry.coordinates];
      for (const line of lines) out.push({ type: 'Feature', properties: { k: 'telecom', n: f.properties.name || '' }, geometry: { type: 'LineString', coordinates: line.map(([x, y]) => [r3(x), r3(y)]) } });
    }
    console.log(`  telecom cables: ${out.length} lines`);
  } catch (e) { console.warn(`  TeleGeography: ${e.message}`); }
  const els = await bands((b) => `[out:json][timeout:600];(way["seamark:type"~"^(pipeline_submarine|cable_submarine)$"]${b};);out tags geom;`, 60);
  if (els) {
    for (const el of els) {
      if (!el.geometry) continue;
      const t = el.tags || {};
      const kind = t['seamark:type'] === 'pipeline_submarine' ? 'pipeline' : 'power';
      out.push({ type: 'Feature', properties: { k: kind, n: t['seamark:name'] || t.name || '', pr: t['seamark:pipeline_submarine:product'] || t.substance || '' }, geometry: { type: 'LineString', coordinates: el.geometry.map((p) => [r3(p.lon), r3(p.lat)]) } });
    }
    console.log(`  OSM pipelines and power cables: ${els.length}`);
  }
  return out;
}

// ------------------------------------------------------- undersea features
async function seabed() {
  console.log('Undersea features');
  const classes = ['oceanic trench', 'seamount', 'guyot', 'mid-ocean ridge', 'oceanic ridge', 'submarine ridge', 'abyssal plain', 'submarine canyon', 'oceanic plateau', 'submarine plateau', 'fracture zone', 'oceanic basin', 'ocean deep', 'bank', 'submarine volcano'];
  const q = `SELECT ?item ?name ?coord ?cls WHERE {
    VALUES ?clsLabel { ${classes.map((c) => `"${c}"@en`).join(' ')} }
    ?c rdfs:label ?clsLabel . ?item wdt:P31 ?c ; wdt:P625 ?coord ; rdfs:label ?name .
    FILTER(LANG(?name) = "en") BIND(STR(?clsLabel) AS ?cls)
  }`;
  try {
    const res = await fetch(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: q, format: 'json' })}`, { headers: { ...UA, Accept: 'application/sparql-results+json' } });
    const j = await res.json();
    const seen = new Set();
    const out = [];
    for (const b of j.results.bindings) {
      const m = b.coord.value.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);
      if (!m || seen.has(b.item.value)) continue;
      seen.add(b.item.value);
      const kind = b.cls.value.replace(/^(oceanic|submarine|mid-ocean) /, '');
      out.push({ type: 'Feature', properties: { n: b.name.value, k: kind }, geometry: { type: 'Point', coordinates: [r3(+m[1]), r3(+m[2])] } });
    }
    const count = {};
    for (const f of out) count[f.properties.k] = (count[f.properties.k] || 0) + 1;
    console.log(`  ${out.length} named: ${JSON.stringify(count)}`);
    return out;
  } catch (e) {
    console.warn(`  Wikidata: ${e.message}`);
    return null;
  }
}

const only = process.argv[2];
if (!only || only === 'seabed') keep('seabed', await seabed(), 50);
if (!only || only === 'cables') keep('cables', await cables(), 100);
if (!only || only === 'offshore') keep('offshore', await offshore(), 50);
if (!only || only === 'lights') keep('lights', await lights(), 500);
