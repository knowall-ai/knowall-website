#!/bin/bash
# Deployment script for KnowAll.ai website on Azure App Service

# Print Node.js version for debugging
echo "Node.js version: $(node -v)"
echo "NPM version: $(npm -v)"

# Install dependencies using pnpm if available, otherwise use npm
if command -v pnpm &> /dev/null; then
    echo "Installing dependencies with pnpm..."
    pnpm install --production
else
    echo "pnpm not found, installing dependencies with npm..."
    npm install --production
fi

# Print success message
echo "Dependencies installed successfully!"
