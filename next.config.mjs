import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** @type {import('next').NextConfig} */
const nextConfig = {
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
