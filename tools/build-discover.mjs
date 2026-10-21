// Famous wrecks, maritime history and marine life for the map, into
// data/discover.json: each place's position, summary and photo from
// Wikipedia (CC BY-SA; credited in the app), and for marine life the season
// to see it. Places without a position on Wikipedia are left out (logged).
//
//   node tools/build-discover.mjs
//
// Runs on GitHub (see .github/workflows/discover.yml). Add a place to a list
// by its English Wikipedia title.
import { readFileSync, writeFileSync } from 'node:fs';

// Wrecks and disasters at sea.
const WRECKS = [
  'Titanic', 'RMS Lusitania', 'German battleship Bismarck', 'SS Edmund Fitzgerald', 'Mary Rose', 'SS Andrea Doria',
  'Costa Concordia disaster', 'MV Wilhelm Gustloff', 'MS Estonia', 'MV Doña Paz', 'Exxon Valdez oil spill',
  'Torrey Canyon oil spill', 'Prestige oil spill', 'MV Wakashio oil spill', 'X-Press Pearl', 'MV Rena oil spill',
  'MSC Napoli', 'Endurance (1912 ship)', 'Japanese battleship Yamato', 'USS Arizona (BB-39)', 'Batavia (1628 ship)',
  'SS Central America', 'Nuestra Señora de Atocha', 'HMHS Britannic', 'SS Thistlegorm', 'SS Yongala', 'MV Le Joola',
  'Sinking of MV Sewol', 'SS Vaitarna', 'SS Tilawa', 'Bombay explosion (1944)', 'MSC Elsa 3', '2021 Suez Canal obstruction',
  'Amoco Cadiz', 'Herald of Free Enterprise', 'SS Arctic', 'HMS Hood (51)', 'Vasa (ship)', 'RMS Empress of Ireland',
  'SS Eastland', 'MV Derbyshire', 'Erika (ship)', 'SS Fort Stikine', 'MV Golden Ray', 'Dali (ship)',
];
// Maritime history: old ports, canals, capes and straits with a story.
const HISTORY = [
  'Lothal', 'Muziris', 'Kozhikode', 'Malacca', 'Kingdom of Ormus', 'Zanzibar', 'Venice', 'Lisbon', 'Cape of Good Hope',
  'Cape Horn', 'Strait of Magellan', 'Suez Canal', 'Panama Canal', 'Kiel Canal', 'Strait of Gibraltar', 'Bab-el-Mandeb',
  'Strait of Malacca', 'Port Royal', 'Greenwich Royal Observatory', 'Cutty Sark', 'HMS Victory', 'Plymouth Hoe',
  'Kappad', 'Goa Velha', 'Sopara', 'Arikamedu', 'Mandvi', 'Surat Castle', 'Bombay Dockyard', 'Gateway of India',
  'Batavia, Dutch East Indies', 'Canton System', 'Dejima', 'Elmina Castle', 'Mombasa', 'Kilwa Kisiwani', 'Sagres, Portugal',
  'Palos de la Frontera', 'Bounty Bay', 'Point Venus',
];
// Marine life, with when and what to look for.
const LIFE = [
  ['Gahirmatha Marine Wildlife Sanctuary', 'turtle', 'Olive ridley turtles nest here in mass arrivals (arribadas), usually February to April.'],
  ['Rushikulya', 'turtle', 'Olive ridley mass nesting on the beach near the river mouth, February to April.'],
  ['Tortuguero National Park', 'turtle', 'Green turtles nest July to October; leatherbacks March to May.'],
  ['Raine Island', 'turtle', 'The world’s largest green turtle rookery, nesting November to February.'],
  ['Ras al Jinz', 'turtle', 'Green turtles nest all year, most from June to September.'],
  ['Ostional Wildlife Refuge', 'turtle', 'Olive ridley arribadas, mostly July to December.'],
  ['Silver Bank', 'whale', 'Humpback whales gather to breed and calve, January to March.'],
  ['Hervey Bay', 'whale', 'Humpbacks rest here on their way south, July to October.'],
  ['Mirissa', 'whale', 'Blue whales close to the shipping lanes off southern Sri Lanka, December to April. Keep a lookout.'],
  ['Ojo de Liebre Lagoon', 'whale', 'Grey whales calve in the lagoon, January to March.'],
  ['Vavaʻu', 'whale', 'Humpbacks breed here, July to October.'],
  ['Île Sainte-Marie', 'whale', 'Humpbacks in the channel, July to September.'],
  ['Hermanus', 'whale', 'Southern right whales close inshore, June to November.'],
  ['Kaikōura', 'whale', 'Sperm whales all year in the deep canyon close to shore.'],
  ['Stellwagen Bank National Marine Sanctuary', 'whale', 'Humpbacks April to October. The Boston traffic lanes were moved in 2007 to cut whale strikes.'],
  ['Bay of Fundy', 'whale', 'North Atlantic right whales, July to October. The traffic lanes were moved in 2003 to protect them.'],
  ['Monterey Bay', 'whale', 'Blue and humpback whales, summer and autumn.'],
  ['Ningaloo Coast', 'shark', 'Whale sharks, March to July; humpbacks June to November.'],
  ['Donsol', 'shark', 'Whale sharks, November to June.'],
  ['Gulf of Mannar Marine National Park', 'reef', 'Coral reefs, dugongs and sea turtles.'],
  ['Great Barrier Reef', 'reef', 'The largest coral reef system; mandatory pilotage in the inner route and Torres Strait.'],
  ['Mosquito Bay', 'glow', 'One of the brightest bioluminescent bays: the water glows on moonless nights.'],
  ['Vaadhoo', 'glow', 'The “sea of stars”: plankton light up the surf, mostly late in the year.'],
  ['Toyama Bay', 'glow', 'Firefly squid light up the bay, March to June.'],
  ['Jervis Bay', 'glow', 'Bioluminescent plankton on calm nights; dolphins all year.'],
  ['Galápagos Islands', 'life', 'Sea lions, marine iguanas, penguins and hammerheads.'],
  ['Sardine run', 'life', 'Billions of sardines move up the coast with dolphins, sharks and gannets, May to July.'],
  ['Andaman Sea', 'life', 'Manta rays and whale sharks around the Similan Islands, February to April.'],
];

// Where Wikipedia's summary gives the wrong place for the wreck itself.
const POSITION = { 'Endurance (1912 ship)': [-52.33, -68.74] }; // found 2022, Weddell Sea

const UA = { 'User-Agent': 'WorldMapDiscover/1.0 (https://github.com/vaibhavma84-stack/World-Map.-; personal map)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function summary(title) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`, { headers: UA });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`  ${title}: ${e.message}`);
      await sleep(3000 * (attempt + 1));
    }
  }
  return null;
}

const root = new URL('..', import.meta.url);
let previous = [];
try { previous = JSON.parse(readFileSync(new URL('data/discover.json', root))).features; } catch { /* first run */ }

const features = [];
const missing = [];
const jobs = [...WRECKS.map((t) => [t, 'wreck']), ...HISTORY.map((t) => [t, 'history']), ...LIFE.map(([t, k, s]) => [t, 'life', k, s])];
for (const [title, group, kind, season] of jobs) {
  const s = await summary(title);
  await sleep(300);
  if (s && POSITION[title]) s.coordinates = { lon: POSITION[title][0], lat: POSITION[title][1] };
  if (!s?.coordinates) {
    const old = previous.find((f) => f.properties.t === title);
    if (old) features.push(old);
    else missing.push(`${title}${s ? ' (no position)' : ' (no page)'}`);
    continue;
  }
  const p = { t: title, g: group, n: s.title, d: (s.extract || '').slice(0, 900), url: s.content_urls?.mobile?.page || s.content_urls?.desktop?.page };
  if (kind) p.k = kind;
  if (season) p.s = season;
  if (s.thumbnail?.source) p.img = s.thumbnail.source.replace(/\/\d+px-/, '/480px-');
  features.push({ type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: [Math.round(s.coordinates.lon * 1e5) / 1e5, Math.round(s.coordinates.lat * 1e5) / 1e5] } });
}
console.log(`${features.length} places; left out: ${missing.join(', ') || 'none'}`);
if (features.length < 30) { console.error('Too few places; keeping the previous file'); process.exit(1); }
writeFileSync(new URL('data/discover.json', root), JSON.stringify({ type: 'FeatureCollection', features }));
