# World Map

An offline world map for seafarers, for Android and iPhone. Nothing needs a
connection once it is installed.

- **Political map**: every country in one of 15 light pastels. No two
  countries that share a border have the same colour. Borders are dashed.
- **Rivers and lakes**, with their names drawn along them. Natural Earth's
  extra-detailed sets are used for Europe and North America.
- **Harbour coastlines** from OpenStreetMap round every port, from zoom 8.
- **12,700+ ports**: all 3,802 in the NGA World Port Index, plus about 8,900
  more UN/LOCODE ports (many inland, along rivers). Every one is named, and
  smaller ports appear as you zoom in.
- **Tap a port** to see:
  - local time, its UTC offset and the next clock change
  - how far to advance or retard the ship's clock
  - the time at home
  - sunrise and sunset
  - currency and dialling code
  - an ETA converter (port time to UTC, ship's time and home time)
  - for World Port Index ports, its particulars: depths, maximum draft and
    length, pilotage, tugs and supplies
- **Tap a country** to see:
  - local time
  - currency, and 1 USD in the local currency (with a converter)
  - dialling code
  - its languages, with useful words (hello, thank you, please,
    welcome, goodbye, yes, no, sorry) and how to say them
- **Weather and sea state** (online, from Open-Meteo):
  - wind
  - isobars
  - air and sea temperature
  - wave and swell height, direction and period
  - surface current set and rate
  - a time slider over the next 72 hours

  The last download stays on the phone for use at sea.
- **Tides** on each port's card: a sea-level curve with high and low waters
  (Open-Meteo model, not official tide tables).
- **LNG and LPG terminals** marked on the map and listed on each port's card
  (from Wikidata and OpenStreetMap; refreshed monthly).
- **Major ocean currents** with their usual rates, always shown, offline.
- **Sea chart marks** (online, from OpenSeaMap): TSS, recommended tracks,
  lights, buoys and beacons. Tiles you have viewed are kept for offline use.
- **Search** by port name, UN/LOCODE or country.
- **My position** uses the phone's GPS, which works at sea.

Not for navigation.

## Installing

**Android**: open the repository's **Releases** page on the phone, download the
latest `WorldMap-….apk` and open it. Allow installing from your browser if
asked. Every new build installs over the old one.

**iPhone**: open the published address (Settings → Pages in this repository) in
Safari, then Share → **Add to Home Screen**. Open it once while online so it can
save the map for offline use.

## Data

| What | Source | Licence |
|---|---|---|
| Countries, borders, rivers, lakes | [Natural Earth](https://www.naturalearthdata.com) 1:10m | Public domain |
| Harbour coastlines | [OpenStreetMap](https://osmdata.openstreetmap.de) land polygons | ODbL |
| Ports and particulars | NGA World Port Index (Pub. 150), via [seaport-data-js](https://www.npmjs.com/package/seaport-data-js) | CC BY 4.0 |
| More ports | [UN/LOCODE](https://unece.org/trade/uncefact/unlocode) | Free to use |
| Time zones of ports | [geo-tz](https://github.com/evansiroky/node-geo-tz) | MIT / ODbL |
| Weather, sea state, tides | [Open-Meteo](https://open-meteo.com) | CC BY 4.0 |
| Chart marks | [OpenSeaMap](https://openseamap.org) | CC BY-SA |
| LNG and LPG terminals | [Wikidata](https://www.wikidata.org) (CC0), OpenStreetMap (ODbL) | |
| Exchange rates | [ExchangeRate-API](https://www.exchangerate-api.com) | Free, with attribution |

## Building

```sh
npm install
npm run data     # downloads sources, writes data/*.json
npm run vendor   # map renderer and label fonts
npm run icons    # app icons (needs Playwright's Chromium)
npm test
npm start        # http://localhost:8080
```

Pilot boarding positions are deliberately left out: they move, and only the
agent's or the latest ALRS Vol. 6 position should be used.
