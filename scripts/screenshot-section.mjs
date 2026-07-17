// Capture a screenshot of a single on-page section (by element selector) at a
// fixed width, for embedding in a PR description or docs.
//
// Usage:
//   node scripts/screenshot-section.mjs --section '#allie' --out docs/screenshots/allie-01-section.png
//   node scripts/screenshot-section.mjs --url http://localhost:3000/ --section '#agents' \
//     --out docs/screenshots/agents-01-section.png --width 1280
//
// Options (all optional except --section and --out):
//   --url      page to load                     (default: http://localhost:3000/)
//   --section  CSS selector of the section       (e.g. '#allie', '#agents')
//   --out      output PNG path                   (e.g. docs/screenshots/allie-01-section.png)
//   --width    viewport/capture width in px      (default: 1280)
//   --keep-header   don't hide the sticky <header> (it's hidden by default so it
//                   doesn't overlay the top of the section)
//
// Requires a running dev/prod server and Playwright (a devDependency). Reads
// reveal-free, static sections — for full reveal.js decks see
// scripts/screenshot-presentations.mjs.
import { chromium } from '@playwright/test';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const url = arg('url', 'http://localhost:3000/');
const section = arg('section');
const out = arg('out');
const width = Number(arg('width', '1280'));
const keepHeader = process.argv.includes('--keep-header');

if (!section || !out) {
  console.error('Missing --section and/or --out. See the header of this file for usage.');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
// 'domcontentloaded' (not 'networkidle') — pages with a live chat/websocket may
// never reach network idle.
await page.goto(url, { waitUntil: 'domcontentloaded' });
if (!keepHeader) {
  // Hide the sticky site header so it doesn't overlay the top of the section.
  await page.addStyleTag({ content: 'header { display: none !important; }' });
}
const el = page.locator(section);
await el.waitFor({ state: 'visible', timeout: 20000 });
await el.scrollIntoViewIfNeeded();
await page.waitForTimeout(800); // let images/fonts settle
await el.screenshot({ path: out, timeout: 30000 });
console.log(`captured ${section} -> ${out} (width ${width})`);
await browser.close();
