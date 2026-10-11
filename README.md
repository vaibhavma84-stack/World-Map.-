# World Map

An offline world map for seafarers, for Android and iPhone. Nothing needs a
connection once it is installed.

- **Political map**: every country in one of 15 light pastels. No two
  countries that share a border have the same colour. Borders are dashed.
- **Rivers and lakes**, with their names drawn along them. Natural Earth's
  extra-detailed sets are used for Europe and North America.
- **12,700+ ports**: all 3,802 in the NGA World Port Index, plus about 8,900
  more UN/LOCODE ports (many inland, along rivers). Every one is named, and
  smaller ports appear as you zoom in.
- **Pilot boarding places** from OpenSeaMap, shown as magenta **P** markers.
  Each port's card lists the nearest ones within 40 nm.
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
| Ports and particulars | NGA World Port Index (Pub. 150), via [seaport-data-js](https://www.npmjs.com/package/seaport-data-js) | CC BY 4.0 |
| More ports | [UN/LOCODE](https://unece.org/trade/uncefact/unlocode) | Free to use |
| Pilot boarding places | [OpenSeaMap](https://openseamap.org) / OpenStreetMap | ODbL |
| Time zones of ports | [geo-tz](https://github.com/evansiroky/node-geo-tz) | MIT / ODbL |
| Weather, sea state, tides | [Open-Meteo](https://open-meteo.com) | CC BY 4.0 |
| Chart marks | [OpenSeaMap](https://openseamap.org) | CC BY-SA |
| Exchange rates | [ExchangeRate-API](https://www.exchangerate-api.com) | Free, with attribution |

Pilot boarding places only cover what volunteers have mapped. Coverage is good
in Europe and at many large ports, and thin elsewhere. The official list is the
Admiralty List of Radio Signals Vol. 6.

## Building

```sh
npm install
npm run data     # downloads sources, writes data/*.json
npm run vendor   # map renderer and label fonts
npm run icons    # app icons (needs Playwright's Chromium)
npm test
npm start        # http://localhost:8080
```

`npm run pilots` needs the Overpass servers. It runs on GitHub every month, and
whenever its script changes (see `.github/workflows/pilots.yml`).
