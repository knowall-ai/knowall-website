// Build the static presentation pages in public/presentations/.
//
//   node scripts/build-presentations.mjs          write the generated files
//   node scripts/build-presentations.mjs --check  fail if any is out of date
//
// Today it renders the gallery cards in index.html from decks.json, between
// the <!-- decks:start --> and <!-- decks:end --> markers. The output is
// committed, so the live site and PDF export never depend on this running.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadManifest, presentationsDir } from './lib/decks.mjs';

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

/** Every generated file: [path, expected contents]. */
function outputs() {
  const { decks } = loadManifest();
  const indexPath = join(presentationsDir, 'index.html');
  return [[indexPath, renderIndex(readFileSync(indexPath, 'utf8'), decks)]];
}

let stale = 0;
for (const [path, contents] of outputs()) {
  const current = readFileSync(path, 'utf8');
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
