// Capture a 1280x720 screenshot of every slide in each reveal.js presentation
// deck under public/presentations, writing docs/screenshots/<deck>-NN.png.
//
// Usage: node scripts/screenshot-presentations.mjs
// Requires Playwright (resolved from the repo's node_modules) and network
// access (decks load reveal.js 4.5.0 from the jsDelivr CDN). Serves public/
// over a local HTTP server so absolute asset paths (/images/...) resolve.
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const outDir = join(root, 'docs', 'screenshots');

// deck file (without .html) -> screenshot basename
const decks = [
  { file: 'knowall-overview', name: 'knowall-overview' },
  { file: 'knowall-overview-full', name: 'knowall-overview-full' },
  { file: 'ai-discovery', name: 'ai-discovery' },
  { file: 'agentic-delivery', name: 'agentic-delivery' },
  { file: 'cisp', name: 'cisp' },
];

const MIME = {
  '.html': 'text/html',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ico': 'image/x-icon',
};

// Minimal static server over public/ so /images/... and /presentations/...
// resolve exactly as they do on the deployed site.
const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(publicDir, path);
    if (!file.startsWith(publicDir)) throw new Error('traversal');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const pad = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});

let total = 0;
for (const deck of decks) {
  await page.goto(`http://localhost:${port}/presentations/${deck.file}.html`, {
    waitUntil: 'networkidle',
  });
  // Wait for reveal.js to finish initialising.
  await page.waitForFunction(
    () => window.Reveal && window.Reveal.isReady && window.Reveal.isReady(),
    { timeout: 20000 }
  );
  // Kill transitions so captures are crisp and deterministic.
  await page.evaluate(() =>
    window.Reveal.configure({ transition: 'none', transitionSpeed: 'fast' })
  );
  const count = await page.evaluate(() => window.Reveal.getTotalSlides());
  for (let i = 0; i < count; i++) {
    await page.evaluate((n) => window.Reveal.slide(n), i);
    await sleep(350); // let layout/fonts/images settle
    const out = join(outDir, `${deck.name}-${pad(i + 1)}.png`);
    await page.screenshot({ path: out });
  }
  console.log(`${deck.name}: ${count} slides`);
  total += count;
}

await browser.close();
server.close();
console.log(`Done — ${total} screenshots in docs/screenshots/`);
