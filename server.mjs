import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

// Minimal static file server so the ES-module app (and its node_modules imports)
// load over http without a bundler. `npm start`, then open the printed URL.
const ROOT = new URL('.', import.meta.url).pathname;
// 5174, not 5173: the sibling fish rig owns 5173, and a stale one of those
// silently serving fish to this project's screenshot script is a confusing
// half-hour you only need to lose once.
const PORT = process.env.PORT || 5174;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') path = '/index.html';
    const full = normalize(join(ROOT, path));
    if (!full.startsWith(ROOT)) { res.writeHead(403).end('forbidden'); return; }
    const body = await readFile(full);
    // No caching, ever. A dev server that lets the browser cache source modules
    // means an edit can silently fail to reach the page — and you end up tuning a
    // shader the browser is not reading.
    res.writeHead(200, {
      'Content-Type': MIME[extname(full)] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500).end(String(e.message));
  }
});

server.listen(PORT, () => {
  console.log(`\n  🍈  Fruit running at  http://localhost:${PORT}/\n`);
});
