// Saves today's exchange rates against the US dollar into data/rates.json, so
// the app has recent rates at sea.   npm run rates
// Rates by ExchangeRate-API (https://www.exchangerate-api.com), free with
// attribution; updated once a day.
import { writeFileSync } from 'node:fs';

const res = await fetch('https://open.er-api.com/v6/latest/USD');
const j = await res.json();
if (j.result !== 'success') throw new Error(`Rates: ${JSON.stringify(j).slice(0, 200)}`);
const rates = {};
for (const [k, v] of Object.entries(j.rates)) rates[k] = +v.toPrecision(6);
const out = { date: new Date(j.time_last_update_unix * 1000).toISOString(), rates };
writeFileSync(new URL('../data/rates.json', import.meta.url), JSON.stringify(out));
console.log(`data/rates.json: ${Object.keys(rates).length} currencies, ${out.date}`);
