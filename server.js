// cache-bust: 2026-05-23
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const DIST = join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = join(DIST, urlPath);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST, 'index.html');
  }

  const content = readFileSync(filePath);
  const contentType = MIME[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(content);
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Serving dist/ on port ${PORT}`);
});
