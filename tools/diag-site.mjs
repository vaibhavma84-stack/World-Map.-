// Opens the published app in WebKit (Safari's engine) and Chromium, goes to
// Mumbai at street level and reports what the city detail does: its sources,
// features loaded and drawn per layer, map errors, and the tile requests.
//   node tools/diag-site.mjs [url]
import { webkit, chromium } from 'playwright';

const URL_ = process.argv[2] || 'https://vaibhavma84-stack.github.io/World-Map.-/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LAYERS = ['osm-roads', 'city-road', 'city-road-case', 'city-buildings', 'city-metro', 'city-rail', 'city-stations',
  'city-landuse', 'city-park', 'city-poi', 'city-road-names', 'poi-signals'];

async function visit(page, name, label, zoom) {
  console.log(`  --- ${label} zoom ${zoom}`);
  try {
    await page.goto(URL_, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.wmMap?.getLayer('land'), null, { timeout: 120000 });
    await page.evaluate(() => {
      window.wmErrors = [];
      window.wmMap.on('error', (e) => window.wmErrors.push(String(e.error?.message || e.error || e).slice(0, 300)));
    });
    await page.waitForFunction(() => window.wmMap.getSource('osm-detail'), null, { timeout: 60000 }).catch(() => {});
    await page.evaluate((z) => window.wmMap.jumpTo({ center: [72.835, 18.94], zoom: z }), zoom);
    await sleep(30000);
    const state = await page.evaluate((layers) => {
      const m = window.wmMap;
      const src = (id) => (m.getSource(id) ? { loaded: m.isSourceLoaded(id) } : 'missing');
      const q = (sl) => (m.getSource('osm-detail') ? m.querySourceFeatures('osm-detail', { sourceLayer: sl }).length : null);
      const drawn = {};
      for (const id of layers) {
        if (!m.getLayer(id)) { drawn[id] = 'no layer'; continue; }
        drawn[id] = `${m.getLayoutProperty(id, 'visibility') || 'visible'} ${m.queryRenderedFeatures({ layers: [id] }).length}`;
      }
      return {
        sw: !!navigator.serviceWorker?.controller, version: document.querySelector('#app-version')?.textContent,
        zoom: m.getZoom().toFixed(1), osm: src('osm'), detail: src('osm-detail'),
        features: { transportation: q('transportation'), building: q('building'), poi: q('poi') },
        drawn, layerOrder: m.getStyle().layers.map((l) => l.id).filter((id) => /^(city-road$|osm-water|osm-roads$|borders|land$|world-land)/.test(id)),
        errors: window.wmErrors.slice(0, 10),
      };
    }, LAYERS);
    console.log(`  ${JSON.stringify(state, null, 1)}`);
    await page.screenshot({ path: `diag-${name}-${label.replace(/\W+/g, '-')}-z${zoom}.png` });
  } catch (e) {
    console.log(`  ERROR: ${e.message.split('\n')[0]}`);
  }
}

for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  console.log(`\n===== ${name}`);
  const browser = await engine.launch();
  for (const sw of ['block', 'allow']) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, deviceScaleFactor: 1, serviceWorkers: sw });
    const page = await ctx.newPage();
    page.on('crash', () => console.log('  PAGE CRASHED'));
    page.on('console', (m) => { const t = m.text(); if (!/GL Driver|WebGL|vertices/.test(t)) console.log(`  console.${m.type()}: ${t.slice(0, 300)}`); });
    page.on('pageerror', (e) => console.log(`  pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (/openfreemap/.test(r.url())) console.log(`  FAILED ${r.url()} ${r.failure()?.errorText}`); });
    const seen = {};
    page.on('response', (r) => {
      const m = r.url().match(/openfreemap\.org\/.*?\/(\d+)\/\d+\/\d+\.pbf/);
      if (!m) return;
      const k = `z${m[1]} ${r.status()}`;
      seen[k] = (seen[k] || 0) + 1;
    });
    for (const zoom of [14, 16]) {
      await visit(page, name, `sw-${sw}`, zoom);
      console.log(`  tiles: ${JSON.stringify(seen)}`);
    }
    await ctx.close();
  }
  await browser.close();
}
