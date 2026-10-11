// Draws icons/icon.svg out as the PNGs phones want.  npm run icons
// Needs Playwright's Chromium (present in the build container).
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const svg = readFileSync(`${root}icons/icon.svg`, 'utf8');
const OUT = {
  'icons/icon-192.png': 192,
  'icons/icon-512.png': 512,
  'icons/apple-touch-icon.png': 180,
  'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png': 192,
};
const browser = await chromium.launch();
for (const [file, size] of Object.entries(OUT)) {
  mkdirSync(`${root}${file.replace(/[^/]+$/, '')}`, { recursive: true });
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>body{margin:0}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: `${root}${file}` });
  await page.close();
}
await browser.close();
