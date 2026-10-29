import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
export function serveSite(port, workerPort) {
  const root = process.cwd();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.json': 'application/json',
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1:' + port);
      if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers))
          if (value && !['host', 'connection', 'content-length'].includes(key))
            headers.set(key, Array.isArray(value) ? value.join(',') : value);
        const response = await fetch('http://127.0.0.1:' + workerPort + url.pathname + url.search, {
          method: req.method,
          headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
          redirect: 'manual',
        });
        const outgoing = new Headers(response.headers);
        outgoing.delete('content-encoding');
        outgoing.delete('content-length');
        outgoing.delete('transfer-encoding');
        res.writeHead(response.status, Object.fromEntries(outgoing));
        res.end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      const directory = path.join(root, 'apps/site/dist');
      const relative = decodeURIComponent(url.pathname) + (url.pathname.endsWith('/') ? 'index.html' : '');
      const file = path.resolve(directory, '.' + relative);
      if (!file.startsWith(directory + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      try {
        let body = await fs.readFile(file);
        res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader(
          'Cache-Control',
          /[.-][a-zA-Z0-9_-]{8,}\.(?:js|css|woff2)$/.test(file)
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=0, must-revalidate',
        );
        if (/\.(?:html|css|js|svg|json|xml)$/.test(file)) {
          res.setHeader('Vary', 'Accept-Encoding');
          if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
            body = gzipSync(body);
            res.setHeader('Content-Encoding', 'gzip');
          }
        }
        res.end(body);
      } catch {
        const notFound = await fs.readFile(path.join(directory, '404.html'));
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(notFound);
      }
    } catch (error) {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.writeHead(500);
      res.end(error.message);
    }
  });
  server.listen(port, '127.0.0.1', () => console.log('Site and Admin preview: http://127.0.0.1:' + port));
  return server;
}
