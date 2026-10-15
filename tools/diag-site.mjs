// Opens the published app in WebKit (Safari's engine) and Chromium, goes to
// Umm Qasr at zoom 9 and reports what the detailed world coastline does:
// requests for land.pmtiles, their answers, errors, and features drawn.
//   node tools/diag-site.mjs [url]
import { webkit, chromium } from 'playwright';

const URL_ = process.argv[2] || 'https://vaibhavma84-stack.github.io/World-Map.-/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [name, engine] of [['webkit', webkit], ['chromium', chromium]]) {
  console.log(`\n===== ${name}`);
  const browser = await engine.launch();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (!/GL Driver|WebGL|vertices/.test(m.text())) console.log(`  console.${m.type()}: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => console.log(`  pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (/pmtiles/.test(r.url())) console.log(`  FAILED ${r.url()} ${r.failure()?.errorText}`); });
  page.on('response', async (r) => {
    if (!/land\.pmtiles/.test(r.url())) return;
    const h = r.headers();
    console.log(`  ${r.status()} range=${r.request().headers().range || '-'} content-range=${h['content-range'] || '-'} length=${h['content-length'] || '-'} enc=${h['content-encoding'] || '-'} sw=${r.fromServiceWorker()}`);
  });
  for (const round of [1, 2]) {
    console.log(`  --- load ${round}${round === 2 ? ' (service worker in charge)' : ''}`);
    await page.goto(URL_, { waitUntil: 'load', timeout: 120000 });
    try { await page.waitForFunction(() => window.wmMap?.loaded(), null, { timeout: 120000 }); } catch { console.log('  map never loaded'); }
    await sleep(5000);
    await page.evaluate(() => window.wmMap.jumpTo({ center: [47.95, 30.0], zoom: 9 }));
    await sleep(20000);
    const state = await page.evaluate(() => {
      const m = window.wmMap;
      return {
        sw: !!navigator.serviceWorker?.controller,
        worldSource: !!m.getSource('world'),
        worldLayers: ['world-sea', 'world-land'].map((id) => `${id}:${!!m.getLayer(id)}`).join(' '),
        loaded: m.getSource('world') ? m.isSourceLoaded('world') : null,
        features: m.getSource('world') ? m.querySourceFeatures('world', { sourceLayer: 'land' }).length : null,
        rendered: m.getLayer('world-land') ? m.queryRenderedFeatures({ layers: ['world-land'] }).length : null,
      };
    }).catch((e) => ({ error: e.message }));
    console.log(`  state: ${JSON.stringify(state)}`);
    await page.screenshot({ path: `diag-${name}-${round}.png` });
  }
  await browser.close();
}
