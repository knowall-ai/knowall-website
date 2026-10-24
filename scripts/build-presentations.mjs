// Build the static presentation pages in public/presentations/.
//
//   node scripts/build-presentations.mjs          write the generated files
//   node scripts/build-presentations.mjs --check  fail if any is out of date
//
// 1. Each deck in decks.json is built from presentations-src/<slug>.html.
//    A source is plain reveal.js HTML plus include directives:
//
//      <!-- @include cta {"label": "Slide 6 of 6: ...", "heading": "..."} -->
//
//    which are replaced by presentations-src/partials/<name>.mjs called with
//    the JSON parameters (and the deck's slug). The directive must be the only
//    thing on its line(s); the JSON may span several lines.
// 2. index.html's gallery cards are rendered from decks.json, between the
//    <!-- decks:start --> and <!-- decks:end --> markers.
//
// The output is committed, so the live URLs and PDF export never depend on
// this running. npm run decks:check (in CI) fails when it is stale.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadManifest, presentationsDir } from './lib/decks.mjs';

const srcDir = join(presentationsDir, '..', '..', 'presentations-src');

const check = process.argv.includes('--check');

const escapeHtml = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderCard(deck) {
  const title = escapeHtml(deck.title);
  return `        <a
          class="presentation-card"
          href="${deck.slug}.html"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${title} presentation (opens in a new tab)"
        >
          <div class="thumb">
            <img src="${deck.thumb}" alt="" width="720" height="405" />
          </div>
          <div class="card-body">
            <h2>${title}</h2>
            <p>${escapeHtml(deck.description)}</p>
            <span class="cta" aria-hidden="true">View presentation &rarr;</span>
          </div>
        </a>
`;
}

const START = '<!-- decks:start';
const END = '        <!-- decks:end -->';

function renderIndex(html, decks) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start < 0 || end < start)
    throw new Error('index.html: decks:start/decks:end markers missing');
  const afterStart = html.indexOf('\n', start) + 1;
  return html.slice(0, afterStart) + decks.map(renderCard).join('') + html.slice(end);
}

const INCLUDE = /^[ \t]*<!-- @include ([\w-]+)([\s\S]*?)-->[ \t]*\n/gm;
const partials = new Map();

async function partial(name) {
  if (!partials.has(name)) {
    const url = pathToFileURL(join(srcDir, 'partials', `${name}.mjs`)).href;
    partials.set(name, (await import(url)).default);
  }
  return partials.get(name);
}

async function renderDeck(slug) {
  const file = `presentations-src/${slug}.html`;
  const source = readFileSync(join(srcDir, `${slug}.html`), 'utf8');
  let out = '';
  let last = 0;
  for (const match of source.matchAll(INCLUDE)) {
    const [whole, name, json] = match;
    let params;
    try {
      params = json.trim() ? JSON.parse(json) : {};
    } catch (error) {
      throw new Error(`${file}: bad parameters for @include ${name}: ${error.message}`);
    }
    out += source.slice(last, match.index) + (await partial(name))({ slug, ...params });
    last = match.index + whole.length;
  }
  out += source.slice(last);
  if (out.includes('@include')) throw new Error(`${file}: an @include directive was not expanded`);
  return out;
}

/** Every generated file: [path, expected contents]. */
async function outputs() {
  const { decks } = loadManifest();
  const files = [];
  for (const { slug } of decks) {
    files.push([join(presentationsDir, `${slug}.html`), await renderDeck(slug)]);
  }
  const indexPath = join(presentationsDir, 'index.html');
  files.push([indexPath, renderIndex(readFileSync(indexPath, 'utf8'), decks)]);
  return files;
}

let stale = 0;
for (const [path, contents] of await outputs()) {
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  if (current === contents) continue;
  if (check) {
    console.error(`stale: ${path}`);
    stale++;
  } else {
    writeFileSync(path, contents);
    console.log(`wrote ${path}`);
  }
}
if (stale) {
  console.error(
    `\n${stale} generated presentation file(s) are out of date: run npm run decks:build`
  );
  process.exit(1);
}
if (check) console.log('presentations up to date');
