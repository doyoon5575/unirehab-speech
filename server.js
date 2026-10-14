import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const publicFiles = new Set(['/index.html', '/index.css', '/manifest.json', '/sw.js']);
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self)');
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); res.end(); return; }
  if (pathname === '/') pathname = '/index.html';
  const allowed = publicFiles.has(pathname)
    || /^\/src\/[a-zA-Z0-9_/-]+\.js$/.test(pathname)
    || /^\/audio\/[a-zA-Z0-9_-]+\.mp3$/.test(pathname);
  if (!allowed) { res.writeHead(404); res.end(); return; }
  try {
    const filename = await fs.realpath(path.resolve(root, '.' + pathname));
    if (!filename.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const stat = await fs.stat(filename);
    if (!stat.isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {
      'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': pathname.startsWith('/audio/') ? 'public, max-age=3600' : 'no-cache'
    });
    if (req.method === 'HEAD') res.end();
    else res.end(await fs.readFile(filename));
  } catch {
    if (!res.headersSent) res.writeHead(404);
    res.end();
  }
});
server.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1', () => {
  console.log('UniRehab development server ready. Public deployment requires HTTPS.');
});
