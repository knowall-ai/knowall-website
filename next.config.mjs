import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { baselineHeaders, deckCsp, deckScriptHashes } from './lib/security-headers.mjs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Baseline headers on every response; the deck CSP is hashed from the deck
// HTML at build time. Page CSP (per-request nonce) is set in proxy.ts.
const deckHeaders = [
  {
    key: 'Content-Security-Policy',
    value: deckCsp(
      deckScriptHashes(fileURLToPath(new URL('./public/presentations', import.meta.url)))
    ),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,
  // Real headers, not meta tags: they apply to every response, including
  // public/ files, and browsers ignore HSTS in a meta tag.
  async headers() {
    // NIP-05 (https://github.com/nostr-protocol/nips/blob/master/05.md) requires
    // /.well-known/nostr.json to be served with Access-Control-Allow-Origin: *
    // so Nostr clients can fetch it cross-origin. Applied in dev and prod.
    const nip05CorsHeader = {
      source: '/.well-known/nostr.json',
      headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
    };
    return [
      { source: '/:path*', headers: baselineHeaders },
      { source: '/presentations/:path*', headers: deckHeaders },
      nip05CorsHeader,
    ];
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // /presentations is a static index.html in public/, which Next doesn't
  // directory-resolve. Redirect (not rewrite) the clean URL onto the file so
  // the browser lands on /presentations/index.html and the page's relative
  // deck/asset links resolve under /presentations/ rather than the site root.
  async redirects() {
    return [
      { source: '/presentations', destination: '/presentations/index.html', permanent: false },
    ];
  },

  // next/image quality values must be enumerated in Next 16 (previously any
  // value was allowed). The app uses quality 90 and 95; 75 is the default.
  images: {
    qualities: [75, 90, 95],
  },

  // Next 16 defaults to Turbopack. Declaring an (empty) turbopack config
  // adopts it and silences the "webpack config with no turbopack config"
  // build error. The webpack block below still applies when building with
  // `--webpack` (it only tunes dev watch-ignores, not the production output).
  turbopack: {},

  // Prevent watching logs directory to avoid continuous rebuilds
  webpack: (config, { isServer }) => {
    // Ignore changes to log files and directories
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/.git/**', '**/node_modules/**', '**/logs/**', '**/.next/**', '**/out/**'],
    };
    return config;
  },
};

export default nextConfig;
