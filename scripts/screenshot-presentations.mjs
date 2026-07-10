// Capture a 1280x720 screenshot of every slide in each reveal.js presentation
// deck under public/presentations, writing docs/screenshots/<deck>-NN.png.
//
// Usage: node scripts/screenshot-presentations.mjs
// Requires Playwright (resolved from the repo's node_modules) and network
// access (decks load reveal.js 4.5.0 from the jsDelivr CDN).
import { chromium } from '@playwright/test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdir } from 'node:fs/promises'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const presDir = join(root, 'public', 'presentations')
const outDir = join(root, 'docs', 'screenshots')

// deck file (without .html) -> screenshot basename
const decks = [
  { file: 'knowall-overview', name: 'knowall-overview' },
  { file: 'knowall-overview-full', name: 'knowall-overview-full' },
  { file: 'ai-discovery', name: 'ai-discovery' },
  { file: 'agentic-delivery', name: 'agentic-delivery' },
  { file: 'cisp', name: 'cisp' },
]

const pad = (n) => String(n).padStart(2, '0')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
})

let total = 0
for (const deck of decks) {
  const url = pathToFileURL(join(presDir, `${deck.file}.html`)).href
  await page.goto(url, { waitUntil: 'networkidle' })
  // Wait for reveal.js to finish initialising.
  await page.waitForFunction(() => window.Reveal && window.Reveal.isReady && window.Reveal.isReady(), {
    timeout: 20000,
  })
  // Kill transitions so captures are crisp and deterministic.
  await page.evaluate(() => window.Reveal.configure({ transition: 'none', transitionSpeed: 'fast' }))
  const count = await page.evaluate(() => window.Reveal.getTotalSlides())
  for (let i = 0; i < count; i++) {
    await page.evaluate((n) => window.Reveal.slide(n), i)
    await sleep(300) // let layout/fonts settle
    const out = join(outDir, `${deck.name}-${pad(i + 1)}.png`)
    await page.screenshot({ path: out })
  }
  console.log(`${deck.name}: ${count} slides`)
  total += count
}

await browser.close()
console.log(`Done — ${total} screenshots in docs/screenshots/`)
