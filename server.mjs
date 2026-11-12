import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// only the public folder is served so repository internals never reach the preview
const root = fileURLToPath(new URL('./public/', import.meta.url));
// content types the browser needs to accept module scripts and the page
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
// preview port comes from the environment when the platform assigns one
const port = Number(process.env.PORT) || 3000;

createServer(async (req, res) => {
  let path = '/';
  try { path = decodeURIComponent(new URL(req.url, 'http://local').pathname); } catch { res.writeHead(400).end(); return; }
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(root, path));
  if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  } catch { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); }
}).listen(port, '0.0.0.0', () => console.log('slipstrike listening on port ' + port));
