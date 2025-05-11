const { createServer } = require('http');
const { parse } = require('url');
const fs = require('fs');
const { execSync } = require('child_process');

// Log Node.js version and environment for debugging
console.log(`Node.js version: ${process.version}`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

// Try to require next directly first
let next;
try {
  next = require('next');
  console.log('Next.js module found, skipping dependency installation');
} catch (e) {
  // Check if node_modules exists and has next module
  const hasNodeModules = fs.existsSync('./node_modules');
  const hasNextModule = fs.existsSync('./node_modules/next');

  // Install dependencies if needed
  if (!hasNodeModules || !hasNextModule) {
    console.log('Dependencies missing, installing...');
    try {
      // First, ensure pnpm is installed globally
      try {
        execSync('pnpm --version', { stdio: 'ignore' });
        console.log('pnpm is already installed');
      } catch (e) {
        console.log('Installing pnpm globally...');
        execSync('npm install -g pnpm', { stdio: 'inherit' });
        console.log('pnpm installed successfully!');
      }
      
      // Use pnpm to install dependencies
      console.log('Installing dependencies with pnpm...');
      execSync('pnpm install', { stdio: 'inherit' });
      console.log('Dependencies installed successfully!');
    } catch (error) {
      console.error('Failed to install dependencies:', error);
      console.error('Please ensure pnpm is properly configured.');
      process.exit(1);
    }
  }
  
  // Now try to require next again
  next = require('next');
}

// Now that we're sure dependencies are installed

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
