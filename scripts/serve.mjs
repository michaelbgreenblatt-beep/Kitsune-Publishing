/**
 * Zero-dependency static server for local development.
 *
 *   node scripts/serve.mjs        → serves public/ on http://localhost:4871
 *   PORT=8080 node scripts/serve.mjs
 *
 * Content Studio is a static client-side app (no backend, no build step needed
 * for dev). This just hands the browser the files in public/.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = join(import.meta.dirname, '..', 'public');
const port = Number(process.env.PORT) || 4871;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer(async (req, res) => {
  let path = decodeURIComponent((req.url || '/').split('?')[0]);
  if (path === '/') path = '/index.html';
  // Keep the request inside public/ — no path traversal.
  const filePath = normalize(join(root, path));
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(port, () => {
  console.log(`Content Studio → http://localhost:${port}`);
});
