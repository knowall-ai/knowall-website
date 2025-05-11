const { createServer } = require('http');
const { parse } = require('url');
const fs = require('fs');
const { execSync } = require('child_process');

// Log Node.js version and environment for debugging
console.log(`Node.js version: ${process.version}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

// Check if node_modules exists and has next module
const hasNodeModules = fs.existsSync('./node_modules');
const hasNextModule = fs.existsSync('./node_modules/next');

// Install dependencies if needed
if (!hasNodeModules || !hasNextModule) {
  console.log('Dependencies missing, installing...');
  try {
    // Try to use pnpm if available, otherwise use npm
    try {
      execSync('pnpm --version', { stdio: 'ignore' });
      console.log('Using pnpm to install dependencies');
      execSync('pnpm install --production', { stdio: 'inherit' });
    } catch (e) {
      console.log('pnpm not available, using npm instead');
      execSync('npm install --production', { stdio: 'inherit' });
    }
    console.log('Dependencies installed successfully!');
  } catch (error) {
    console.error('Failed to install dependencies:', error);
    process.exit(1);
  }
}

// Now that we're sure dependencies are installed, require next
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(process.env.PORT || 8080, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${process.env.PORT || 8080}`);
    console.log('> Node.js version:', process.version);
    console.log('> Environment:', process.env.NODE_ENV);
  });
});
