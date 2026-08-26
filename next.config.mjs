import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value:
      "upgrade-insecure-requests; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;",
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // CSP/HSTS moved from meta tags in app/layout.tsx: real headers apply to every
  // response (HSTS in a meta tag is ignored by browsers), and removing the manual
  // <head> silences React's script-tag warning in dev.
  async headers() {
    // NIP-05 (https://github.com/nostr-protocol/nips/blob/master/05.md) requires
    // /.well-known/nostr.json to be served with Access-Control-Allow-Origin: *
    // so Nostr clients can fetch it cross-origin. Applied in dev and prod.
    const nip05CorsHeader = {
      source: '/.well-known/nostr.json',
      headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }],
    };
    if (process.env.NODE_ENV !== 'production') return [nip05CorsHeader];
    return [{ source: '/:path*', headers: securityHeaders }, nip05CorsHeader];
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
