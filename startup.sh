#!/bin/bash
# Custom startup script for Azure App Service

# Enter the source directory
cd "/home/site/wwwroot"

# Set up environment
export NODE_PATH=/usr/local/lib/node_modules:$NODE_PATH
if [ -z "$PORT" ]; then
  export PORT=8080
fi

# Install pnpm globally if not already installed
if ! command -v pnpm &> /dev/null; then
  echo "Installing pnpm globally..."
  npm install -g pnpm
fi

# Start the application using pnpm
echo "Starting application with pnpm..."

# Ensure pnpm-lock.yaml exists or create it
if [ ! -f "pnpm-lock.yaml" ]; then
  echo "Creating pnpm-lock.yaml from package.json..."
  pnpm install --frozen-lockfile
fi

# Start the application with pnpm
pnpm start
