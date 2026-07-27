// Verification pass for the round-2 deck work:
//  1. no floating control overlaps real slide content, on any slide
//  2. nothing overflows the 1080px frame
//  3. the closing CTA button is sized to its label, not to its column
//  4. fragments exist, and stepping right reveals them one at a time
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, relative, isAbsolute } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const decks = ['knowall-overview', 'knowall-overview-full', 'ai-discovery', 'agentic-delivery', 'cisp'];
const MIME = { '.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.css':'text/css','.js':'text/javascript','.ico':'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    const pathname = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = join(publicDir, pathname.replace(/^[/\\]+/, ''));
    const rel = relative(publicDir, file);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('traversal');
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
let problems = 0;

for (const deck of decks) {
  console.log(`\n===== ${deck} =====`);
  await page.goto(`http://localhost:${port}/presentations/${deck}.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.Reveal?.isReady?.(), { timeout: 20000 });

  // --- fragments -----------------------------------------------------------
  const frag = await page.evaluate(() => {
    const per = [];
    document.querySelectorAll('.reveal .slides > section').forEach((s, i) => {
      const n = s.querySelectorAll('.fragment').length;
      if (n) per.push(`${i + 1}:${n}`);
    });
    return { total: document.querySelectorAll('.fragment').length, per,
             titles: document.querySelectorAll('h1.fragment, h2.fragment, h3.fragment, .kicker.fragment, .band .fragment').length };
  });
  console.log(`  fragments: ${frag.total} total  [slide:count] ${frag.per.join(' ')}`);
  if (frag.titles) { console.log(`  ** ${frag.titles} title/kicker elements were fragmented **`); problems++; }
  if (!frag.total) { console.log('  ** no fragments found **'); problems++; }

  // step through the first fragmented slide with the right arrow
  const firstFrag = await page.evaluate(() => {
    const secs = Array.from(document.querySelectorAll('.reveal .slides > section'));
    return secs.findIndex((s) => s.querySelectorAll('.fragment').length > 1);
  });
  if (firstFrag >= 0) {
    await page.evaluate((n) => window.Reveal.slide(n, 0, -1), firstFrag);
    await sleep(200);
    const seq = [];
    const count = await page.evaluate((n) =>
      document.querySelectorAll('.reveal .slides > section')[n].querySelectorAll('.fragment').length, firstFrag);
    for (let s = 0; s <= count; s++) {
      seq.push(await page.evaluate((n) =>
        document.querySelectorAll('.reveal .slides > section')[n].querySelectorAll('.fragment.visible').length, firstFrag));
      await page.keyboard.press('ArrowRight');
      await sleep(120);
    }
    const ok = seq.every((v, i) => v === i);
    console.log(`  step-through slide ${firstFrag + 1}: visible counts ${seq.join(',')} ${ok ? 'OK' : '** NOT SEQUENTIAL **'}`);
    if (!ok) problems++;
  }

  // --- geometry (all fragments forced visible) ------------------------------
  await page.evaluate(() => window.Reveal.configure({ transition: 'none', fragments: false }));
  const total = await page.evaluate(() => window.Reveal.getTotalSlides());
  for (let i = 0; i < total; i++) {
    await page.evaluate((n) => window.Reveal.slide(n), i);
    await sleep(220);
    const r = await page.evaluate(() => {
      const sec = document.querySelector('.reveal .slides > section.present');
      const sr = sec.getBoundingClientRect();
      const scale = sr.height / 1080;
      const box = (e) => { const b = e.getBoundingClientRect();
        return { x:(b.left-sr.left)/scale, y:(b.top-sr.top)/scale, w:b.width/scale, h:b.height/scale }; };
      const SHELL = '.content,.dark-inner,.band,.cover-hero,.cover-scrim,.cta-top,.cta-bottom,.hero-bleed,.cover-copy,.pill-row,.kpi-row,.cards-2,.cards-3,.cards-5,.checks,.agent-row,.timeline,.partner-grid,.lifecycle-8';
      const ctls = Array.from(sec.querySelectorAll('.slide-cta, .slide-detail')).map((e) => ({ sel: e.className, r: box(e) }));
      // reveal's own chrome is an obstacle too — the pills must clear it
      document.querySelectorAll('.reveal > .controls, .reveal > .slide-number, .reveal > .progress').forEach((e) => { if (e.getClientRects().length) ctls.push({ sel: 'reveal-' + e.className, r: box(e) }); });
      const out = { over: [], hit: [], cta: null };
      const ctaBtn = sec.querySelector('.cta-button');
      if (ctaBtn) { const b = box(ctaBtn); out.cta = { w: Math.round(b.w), h: Math.round(b.h) }; }
      Array.from(sec.querySelectorAll('*')).forEach((e) => {
        if (e.closest('.slide-cta') || e.closest('.slide-detail')) return;
        if (e.matches(SHELL)) return;
        if (!e.getClientRects().length) return;
        const b = box(e);
        if (b.w < 6 || b.h < 6) return;
        const tag = e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).join('.') : '');
        if (b.y + b.h > 1081 || b.x + b.w > 1921 || b.y < -1 || b.x < -1) out.over.push(`${tag} [${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}]`);
        ctls.forEach((c) => {
          if (b.x + b.w <= c.r.x || c.r.x + c.r.w <= b.x || b.y + b.h <= c.r.y || c.r.y + c.r.h <= b.y) return;
          out.hit.push(`${tag} vs ${c.sel}`);
        });
      });
      out.over = [...new Set(out.over)].slice(0, 4);
      out.hit = [...new Set(out.hit)].slice(0, 4);
      return out;
    });
    const notes = [];
    if (r.hit.length) { notes.push(`OVERLAP: ${r.hit.join(' | ')}`); problems++; }
    if (r.over.length) { notes.push(`OVERFLOW: ${r.over.join(' | ')}`); problems++; }
    if (r.cta) notes.push(`cta-button ${r.cta.w}x${r.cta.h}px`);
    if (notes.length) console.log(`  slide ${String(i + 1).padStart(2)}: ${notes.join('  ')}`);
  }
}
console.log(`\n${problems ? `${problems} PROBLEM(S)` : 'clean — no overlaps, no overflow, fragments sequential'}`);
await browser.close();
await new Promise((r) => server.close(r));
