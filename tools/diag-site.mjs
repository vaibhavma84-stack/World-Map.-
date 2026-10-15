// Opens the published app in WebKit (Safari's engine) and Chromium, goes to
// Umm Qasr at zoom 9 and reports what the detailed world coastline does:
// requests for land.pmtiles, their answers, errors, and features drawn.
// Each engine is tried without the service worker, then with it (twice, so
// the second load is served by it).
//   node tools/diag-site.mjs [url]
import { webkit, chromium } from 'playwright';

const URL_ = process.argv[2] || 'https://vaibhavma84-stack.github.io/World-Map.-/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function visit(page, label) {
  console.log(`  --- ${label}`);
  try {
    await page.goto(URL_, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.wmMap?.getLayer('land'), null, { timeout: 120000 });
    await page.evaluate(() => window.wmMap.jumpTo({ center: [47.95, 30.0], zoom: 9 }));
    await sleep(25000);
    const state = await page.evaluate(() => {
      const m = window.wmMap;
      return {
        sw: !!navigator.serviceWorker?.controller,
        worldLayers: ['world-sea', 'world-land'].map((id) => `${id}:${!!m.getLayer(id)}`).join(' '),
        loaded: m.getSource('world') ? m.isSourceLoaded('world') : null,
        features: m.getSource('world') ? m.querySourceFeatures('world', { sourceLayer: 'land' }).length : null,
        rendered: m.getLayer('world-land') ? m.queryRenderedFeatures({ layers: ['world-land'] }).length : null,
      };
    });
    console.log(`  state: ${JSON.stringify(state)}`);
  } catch (e) {
    console.log(`  ERROR: ${e.message.split('\n')[0]}`);
  }
}

for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  console.log(`\n===== ${name}`);
  const browser = await engine.launch();
  for (const sw of ['block', 'allow']) {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 860 }, serviceWorkers: sw });
    const page = await ctx.newPage();
    page.on('crash', () => console.log('  PAGE CRASHED'));
    page.on('console', (m) => { const t = m.text(); if (!/GL Driver|WebGL|vertices|Failed to load resource/.test(t)) console.log(`  console.${m.type()}: ${t.slice(0, 300)}`); });
    page.on('pageerror', (e) => console.log(`  pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (/pmtiles/.test(r.url())) console.log(`  FAILED ${r.headers().range || ''} ${r.failure()?.errorText}`); });
    let n = 0;
    page.on('response', (r) => {
      if (!/land\.pmtiles/.test(r.url()) || n++ > 12) return;
      const h = r.headers();
      console.log(`  ${r.status()} range=${r.request().headers().range || '-'} content-range=${h['content-range'] || '-'} length=${h['content-length'] || '-'} sw=${r.fromServiceWorker()}`);
    });
    await visit(page, `service worker ${sw}, load 1`);
    if (sw === 'allow') { n = 0; await visit(page, 'service worker allow, load 2'); }
    await ctx.close();
  }
  await browser.close();
}
