// Capture a 1280x720 screenshot of every slide in each reveal.js presentation
// deck under public/presentations, writing docs/screenshots/<deck>-NN.png.
//
// Usage: node scripts/screenshot-presentations.mjs
// Requires Playwright (resolved from the repo's node_modules). Decks are fully
// self-contained (reveal.js and fonts are vendored), served over a local HTTP
// server so absolute asset paths (/images/...) resolve.
import { chromium } from '@playwright/test';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { root, decks, startStaticServer, sleep, gotoDeck } from './lib/deck-harness.mjs';

const outDir = join(root, 'docs', 'screenshots');

const { port, close: closeServer } = await startStaticServer();

const pad = (n) => String(n).padStart(2, '0');

await mkdir(outDir, { recursive: true });
let browser;

let total = 0;
// try/finally so a deck that throws still tears down the browser and server —
// otherwise a failure leaves an orphaned Chromium and a listening port behind.
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    // The decks drift their full-bleed imagery slowly (Ken Burns). Asking for
    // reduced motion switches that off, so captures are deterministic — and it
    // exercises the prefers-reduced-motion path at the same time.
    reducedMotion: 'reduce',
  });
  for (const deck of decks) {
    await gotoDeck(page, port, deck);
    // Kill transitions so captures are crisp and deterministic.
    // fragments:false shows every fragment at once, so a still capture shows the
    // finished slide rather than its first build step.
    await page.evaluate(() =>
      window.Reveal.configure({ transition: 'none', transitionSpeed: 'fast', fragments: false })
    );
    const count = await page.evaluate(() => window.Reveal.getTotalSlides());
    for (let i = 0; i < count; i++) {
      await page.evaluate((n) => window.Reveal.slide(n), i);
      await sleep(350); // let layout/fonts/images settle
      const out = join(outDir, `${deck}-${pad(i + 1)}.png`);
      await page.screenshot({ path: out });
    }
    console.log(`${deck}: ${count} slides`);
    total += count;
  }
} finally {
  // browser may be undefined if launch() itself failed — the server still needs closing.
  if (browser) await browser.close();
  await closeServer();
}
console.log(`Done — ${total} screenshots in docs/screenshots/`);
