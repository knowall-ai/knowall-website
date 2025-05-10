/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ['ui-avatars.com'],
  },
  output: 'export', // Enable static exports for Azure Static Web Apps
  distDir: 'out', // Specify the output directory
  
  // Prevent watching logs directory to avoid continuous rebuilds
  webpack: (config, { isServer }) => {
    // Ignore changes to log files and directories
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/.git/**', '**/node_modules/**', '**/logs/**', '**/.next/**', '**/out/**']
    };
    return config;
  },
}

export default nextConfig