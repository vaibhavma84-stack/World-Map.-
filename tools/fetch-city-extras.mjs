// Points of interest for chosen cities, into data/city-extras.json, from
// OpenStreetMap (ODbL) via Overpass, with photos of the places from Wikidata
// / Wikimedia Commons where OpenStreetMap links them:
//
//   traffic signals, petrol pumps, cafés, restaurants, bars and pubs,
//   nightclubs, members' clubs and gymkhanas, hotels (with their star rating), museums and galleries,
//   places of interest (attractions, viewpoints, heritage, art), golf
//   courses, snooker and pool halls, shooting ranges, cinemas and theatres.
//
//   node tools/fetch-city-extras.mjs
//
// Runs on GitHub (see .github/workflows/city.yml). Add a city to CITIES.
import { readFileSync, writeFileSync } from 'node:fs';

const CITIES = [
  { name: 'Mumbai', bbox: [18.85, 72.75, 19.35, 73.15] },
];
// Well-known clubs missing from OpenStreetMap, shown at the hotel they are
// in (the hotel's position from OpenStreetMap; a club whose hotel can't be
// found there is left out rather than guessed). Kept by hand: check each
// still runs before adding it, and note where that was read.
const KNOWN = {
  Mumbai: [
    { n: 'Trilogy', k: 'nightclub', host: /^(Hotel )?Sea Princess/i, src: 'Nightclub inside Hotel Sea Princess, Juhu Tara Road. Listed by Time Out, Foursquare and nightlife guides; check it is open before going.' },
    { n: 'Toy Room', k: 'nightclub', host: /^Grand Hyatt/i, src: 'Nightclub of the London Toy Room group; listings place it at the Grand Hyatt, off the Western Express Highway, Santacruz East. Check before going.' },
    { n: 'Kitty Su', k: 'nightclub', host: /^The Lalit( Mumbai)?$/i, src: 'Nightclub inside The Lalit, Andheri East. Listed by LBB and nightlife guides; check before going.' },
    { n: 'AER', k: 'nightclub', host: /^Four Seasons/i, src: 'Rooftop bar and club on the 34th floor of the Four Seasons, Worli. Check before going.' },
    { n: 'Asilo', k: 'nightclub', host: /^(The )?St\.? Regis/i, src: 'Rooftop bar and club on level 37 of The St. Regis, Lower Parel. Check before going.' },
  ],
};

const UA = { 'User-Agent': 'WorldMapCity/1.0 (https://github.com/vaibhavma84-stack/World-Map.-; personal map) node-fetch' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function overpass(query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const url of SERVERS) {
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
        await sleep(5000);
      } finally {
        clearTimeout(timer);
      }
    }
    await sleep(30000 * (attempt + 1));
  }
  return null;
}

const NOT_CLUB = /club ?house|^(the )?club$|swimming|pool\b|playground|tennis court|ground|field|lawn|stadium|\bgym\b|fitness|health club|yoga|academy|hall\b|^gymkhana$|rotary|lion'?s club|board game/i;

// Each element's kind, from its tags (first match wins).
function kindOf(t) {
  const sport = t.sport || '';
  if (t.highway === 'traffic_signals') return 'signals';
  if (t.amenity === 'fuel') return 'fuel';
  if (/billiards|snooker|pool/.test(sport) && !/swimming/.test(sport)) return 'snooker';
  if (/shooting/.test(sport) || t.leisure === 'shooting_ground' || t.shooting) return 'shooting';
  if (t.leisure === 'golf_course' || /golf/.test(sport)) return 'golf';
  if (t.amenity === 'nightclub') return 'nightclub';
  // Members' clubs and gymkhanas (golf clubs stay with golf, above).
  const name = t['name:en'] || t.name || '';
  if (t.club || ['social_club', 'social_centre'].includes(t.amenity) || t.leisure === 'sports_club'
    || (/gymkhana|\bclub\b/i.test(name) && (t.leisure || t.sport || t.building || t.amenity === 'community_centre'))) {
    // Not a housing society's club house, a gym, or a club's pool or ground.
    return NOT_CLUB.test(name) ? null : 'club';
  }
  if (t.amenity === 'bar' || t.amenity === 'pub' || t.amenity === 'biergarten') return 'bar';
  // Bars listed as restaurants ("bar & restaurant", breweries, permit rooms).
  if (['restaurant', 'cafe'].includes(t.amenity) && (t.bar === 'yes' || /\bbar\b|\bpub\b|brew|taproom|tavern|\bwine|\bbeer|permit room/i.test(name))) return 'bar';
  if (t.amenity === 'cafe') return 'cafe';
  if (t.amenity === 'restaurant') return 'restaurant';
  if (t.tourism === 'hotel') return 'hotel';
  if (t.tourism === 'museum') return 'museum';
  if (t.tourism === 'gallery') return 'museum';
  if (t.amenity === 'cinema' || t.amenity === 'theatre') return 'cinema';
  if (['attraction', 'viewpoint', 'artwork', 'zoo', 'aquarium', 'theme_park'].includes(t.tourism) || t.historic || t.natural === 'beach') return 'interest';
  return null;
}

function query([s, w, n, e]) {
  const b = `(${s},${w},${n},${e})`;
  return `[out:json][timeout:180];(
    node["highway"="traffic_signals"]${b};
    nwr["amenity"~"^(fuel|cafe|restaurant|bar|pub|biergarten|nightclub|cinema|theatre|social_club|social_centre)$"]${b};
    nwr["club"]["name"]${b};
    nwr["name"~"Grand Hyatt|Sea Princess|Lalit|Four Seasons|St\\.? ?Regis"]${b};
    nwr["leisure"="sports_club"]["name"]${b};
    nwr["name"~"[Gg]ymkhana|[Cc]lub"]["leisure"]${b};
    nwr["name"~"[Gg]ymkhana|[Cc]lub"]["building"]${b};
    nwr["tourism"~"^(hotel|museum|gallery|attraction|viewpoint|artwork|zoo|aquarium|theme_park)$"]${b};
    nwr["historic"]["name"]${b};
    nwr["natural"="beach"]["name"]${b};
    nwr["leisure"~"^(golf_course|shooting_ground)$"]${b};
    nwr["sport"~"golf|billiards|snooker|pool|shooting"]${b};
  );out center tags;`;
}

// Photos: Wikidata's image (P18) for elements linked to Wikidata.
async function photos(ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', format: 'json', props: 'claims', ids: batch.join('|') })}`;
        const j = await (await fetch(url, { headers: UA })).json();
        for (const [id, e] of Object.entries(j.entities || {})) {
          const file = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
          if (file) out.set(id, file);
        }
        break;
      } catch (e) {
        console.warn(`  Wikidata: ${e.message}`);
        await sleep(5000 * (attempt + 1));
      }
    }
    await sleep(1500);
  }
  return out;
}

const root = new URL('..', import.meta.url);
let previous = [];
try { previous = JSON.parse(readFileSync(new URL('data/city-extras.json', root))).features; } catch { /* first run */ }

const features = [];
for (const city of CITIES) {
  console.log(city.name);
  const els = await overpass(query(city.bbox));
  if (!els) {
    const kept = previous.filter((f) => f.properties.city === city.name);
    console.log(`  no answer; keeping ${kept.length} from before`);
    features.push(...kept);
    continue;
  }
  const found = [];
  for (const el of els) {
    const t = el.tags || {};
    const k = kindOf(t);
    if (!k) continue;
    const lat = el.lat ?? el.center?.lat, lon = el.lon ?? el.center?.lon;
    if (lat == null) continue;
    const name = t['name:en'] || t.name || '';
    if (!name && !['signals', 'fuel'].includes(k)) continue;
    const p = { k, city: city.name };
    if (name) p.n = name;
    const stars = parseFloat(t.stars);
    if (stars) p.s = stars;
    if (t.cuisine) p.cu = t.cuisine.replace(/_/g, ' ').replace(/;/g, ', ');
    if (t.opening_hours) p.oh = t.opening_hours;
    if (t.phone || t['contact:phone']) p.ph = t.phone || t['contact:phone'];
    if (t.website || t['contact:website']) p.web = t.website || t['contact:website'];
    if (t.brand) p.br = t.brand;
    if (t.wikidata) p.wd = t.wikidata;
    if (t.wikipedia) p.wp = t.wikipedia;
    if (t.image && /^https?:/.test(t.image)) p.img = t.image;
    if (t.historic) p.h = t.historic;
    if (t.tourism) p.tr = t.tourism;
    found.push({ type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] } });
  }
  // Known clubs, at their hotels.
  for (const c of KNOWN[city.name] || []) {
    if (found.some((f) => f.properties.n?.toLowerCase() === c.n.toLowerCase() && ['nightclub', 'bar'].includes(f.properties.k))) continue;
    const host = els.find((el) => c.host.test(el.tags?.['name:en'] || el.tags?.name || '') && (el.tags?.tourism === 'hotel'))
      || els.find((el) => c.host.test(el.tags?.['name:en'] || el.tags?.name || ''));
    if (!host) { console.log(`  ${c.n}: hotel not found in OpenStreetMap; left out`); continue; }
    const lat = host.lat ?? host.center?.lat, lon = host.lon ?? host.center?.lon;
    found.push({ type: 'Feature', properties: { k: c.k, city: city.name, n: c.n, src: c.src, at: host.tags['name:en'] || host.tags.name }, geometry: { type: 'Point', coordinates: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] } });
    console.log(`  ${c.n}: at ${host.tags.name}`);
  }
  // One mark per club: OpenStreetMap often has the same club as several
  // buildings.
  for (let i = found.length - 1; i >= 0; i--) {
    const a = found[i];
    if (a.properties.k !== 'club') continue;
    const twin = found.findIndex((b, j) => j < i && b.properties.k === 'club' && b.properties.n.toLowerCase() === a.properties.n.toLowerCase()
      && Math.abs(b.geometry.coordinates[0] - a.geometry.coordinates[0]) < 0.005 && Math.abs(b.geometry.coordinates[1] - a.geometry.coordinates[1]) < 0.005);
    if (twin >= 0) found.splice(i, 1);
  }
  const wd = [...new Set(found.map((f) => f.properties.wd).filter(Boolean))];
  const pics = await photos(wd);
  for (const f of found) {
    const file = pics.get(f.properties.wd);
    if (file && !f.properties.img) f.properties.img = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`;
  }
  const count = {};
  for (const f of found) count[f.properties.k] = (count[f.properties.k] || 0) + 1;
  console.log(`  ${found.length} places: ${JSON.stringify(count)}; ${pics.size} photos`);
  features.push(...found);
}

if (!features.length) { console.error('Nothing found; keeping the previous file'); process.exit(1); }
writeFileSync(new URL('data/city-extras.json', root), JSON.stringify({ type: 'FeatureCollection', features }));
console.log(`data/city-extras.json: ${features.length} places`);
