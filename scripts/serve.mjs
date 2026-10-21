// Zero-dependency static server for the landing site.
//   npm run serve            → http://localhost:4600
//   PORT=8080 npm run serve
// Binds to 127.0.0.1 only (dev server — not exposed to the LAN).

import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
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

if (!statSync(join(SITE_DIR, 'downloads', ZIP_NAME), { throwIfNoEntry: false })) {
  console.warn(`note: downloads/${ZIP_NAME} missing — run \`npm run package\` for a working Download button.`);
}

createServer((req, res) => {
  const notFound = () => res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    // Malformed percent-encoding used to throw here and crash the server.
    res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Bad request');
    return;
  }
  path = normalize(path).replace(/^(\.\.[/\\])+/, '');
  if (path.endsWith('/')) path += 'index.html';
  const file = join(SITE_DIR, path);
  // Directories (e.g. /downloads) used to reach readFileSync and crash on EISDIR.
  if (!file.startsWith(SITE_DIR + sep) || !statSync(file, { throwIfNoEntry: false })?.isFile()) {
    notFound();
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Serving site/ at http://localhost:${PORT}`);
});
