// Zero-dependency static server for the landing site.
//   npm run serve            → http://localhost:4600
//   PORT=8080 npm run serve

import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { SITE_DIR, ZIP_NAME } from './lib.mjs';

const PORT = Number(process.env.PORT) || 4600;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.zip': 'application/zip',
  '.ico': 'image/x-icon',
};

if (!existsSync(join(SITE_DIR, 'downloads', ZIP_NAME))) {
  console.warn(`note: downloads/${ZIP_NAME} missing — run \`npm run package\` for a working Download button.`);
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  const file = join(SITE_DIR, path);
  if (!file.startsWith(SITE_DIR) || !existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORT, () => {
  console.log(`Serving site/ at http://localhost:${PORT}`);
});
