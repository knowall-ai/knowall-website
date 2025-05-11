const { createServer } = require('http');
const { parse } = require('url');
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
