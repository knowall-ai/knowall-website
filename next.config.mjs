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
  // Images configuration removed - not using external image sources

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
