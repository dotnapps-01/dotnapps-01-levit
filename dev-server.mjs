/* Local server: the static site plus the /api function, so the storefront and /admin/ both work offline.
 *   node dev-server.mjs   (PORT=8080 by default; admin password is "levit-admin" unless ADMIN_PASSWORD is set)
 * Data is kept in .data/db.json. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import handler from './api/index.js';

const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.txt': 'text/plain' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname.startsWith('/api/')) return handler(req, res);
  let p = decodeURIComponent(u.pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';              // clean URLs: /shop -> shop.html
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  if (/\/(\.data|api|scripts)\//.test(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 8080, () => console.log(`LEVIT on http://localhost:${process.env.PORT || 8080}  (admin: /admin/)`));
