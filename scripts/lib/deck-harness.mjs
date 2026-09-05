// Shared harness for the presentation-deck scripts: the deck list, a static
// server over public/ (so /images/... and /presentations/... resolve exactly
// as on the deployed site), and reveal.js helpers.
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname, relative, isAbsolute } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const publicDir = join(root, 'public');

// Single source of truth for which decks exist (file name without .html).
export const decks = [
  'agentic-ai-solutions',
  'company-overview',
  'ai-discovery',
  'agentic-delivery',
  'cisp',
];

const MIME = {
  '.html': 'text/html',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Start a minimal static file server over public/ on an ephemeral port.
// Returns { server, port, close }. Always shut down via `close()` — see below.
export async function startStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
      const file = join(publicDir, pathname.replace(/^[/\\]+/, ''));
      const rel = relative(publicDir, file);
      if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('traversal');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, r));

  /**
   * Stop the server within a bounded time.
   *
   * `server.close()` only stops it accepting new connections — it waits for
   * existing ones to end, and Playwright holds a keep-alive socket open, so a
   * bare `close()` can wait forever and leave the script hanging after its work
   * is done. Drop the sockets explicitly, and never wait longer than
   * `timeoutMs` regardless.
   */
  const close = async (timeoutMs = 5000) => {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    let timer;
    const bounded = new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    try {
      await Promise.race([closed, bounded]);
    } finally {
      clearTimeout(timer);
    }
  };

  return { server, port: server.address().port, close };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Navigate to a deck and wait until reveal.js has finished initialising.
export async function gotoDeck(page, port, deck) {
  await page.goto(`http://localhost:${port}/presentations/${deck}.html`, {
    waitUntil: 'networkidle',
  });
  await page.waitForFunction(() => window.Reveal?.isReady?.(), { timeout: 20000 });
}
