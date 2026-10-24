// Security headers shared by next.config.mjs (every response, including
// public/ files and the reveal.js decks) and proxy.ts (per-request page CSP).
// Plain .mjs so next.config.mjs can import it without a TypeScript step.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Headers sent on every response. */
export const baselineHeaders = [
  // No `preload`: not every knowall.ai subdomain is confirmed HTTPS-only.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Sallie's voice uses the microphone; nothing uses the camera or location.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
];

/** Directives common to the page and deck policies. */
const shared = {
  'default-src': ["'self'"],
  // Nostr avatars, product and story images live on arbitrary hosts.
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'media-src': ["'self'", 'blob:', 'https:'],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'frame-src': ["'none'"],
};

/** @param {Record<string, string[]>} directives */
function serialise(directives) {
  return [
    ...Object.entries(directives).map(([name, values]) => `${name} ${values.join(' ')}`),
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * CSP for Next-rendered pages. Scripts are allowed only by the per-request
 * nonce ('strict-dynamic' lets those scripts load Next's chunks).
 * @param {string} nonce
 * @param {{ dev?: boolean }} [opts]
 */
export function pageCsp(nonce, { dev = false } = {}) {
  return serialise({
    ...shared,
    // React needs eval in dev only, for its server-error overlays.
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    // React `style={…}` props render as style attributes, which a nonce can't
    // cover; script-src stays strict, which is what stops XSS.
    'style-src': ["'self'", "'unsafe-inline'"],
    // Nostr relays (incl. the DM relays KnowAll's profile lists) and LNURL
    // zap servers are discovered at runtime from Nostr metadata, so they
    // can't be enumerated here.
    'connect-src': ["'self'", 'https:', 'wss:'],
  });
}

/** CSP for API responses and other non-page files the proxy sees. */
export const resourceCsp = "default-src 'none'; frame-ancestors 'none'";

/**
 * sha256 sources for every inline <script> in the decks, so the deck CSP
 * needs no 'unsafe-inline' and follows any deck regeneration automatically.
 * @param {string} dir absolute path to public/presentations
 */
export function deckScriptHashes(dir) {
  const hashes = new Set();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(join(dir, file), 'utf8');
    for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
      hashes.add(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
    }
  }
  return [...hashes].sort();
}

/**
 * CSP for the static reveal.js decks under /presentations.
 * @param {string[]} scriptHashes from deckScriptHashes()
 */
export function deckCsp(scriptHashes) {
  return serialise({
    ...shared,
    'script-src': ["'self'", ...scriptHashes],
    // The decks' HTML uses style="" attributes for one-off layout tweaks.
    'style-src': ["'self'", "'unsafe-inline'"],
    'connect-src': ["'self'"],
  });
}
