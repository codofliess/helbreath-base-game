/**
 * Chain Lords landing — static site + public API reverse proxy.
 * Proxies ops/monitoring paths to middleware and game API without SPA fallback.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.resolve(__dirname);
const ROOT_PREFIX = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
const DENIED_BASENAMES = new Set(['server.js', 'package.json', 'package-lock.json', 'railway.toml']);

const MIDDLEWARE_URL = (process.env.CHAINLORDS_MIDDLEWARE_URL || 'https://chainlords-middleware-production.up.railway.app').replace(/\/$/, '');
const PLAY_URL = (process.env.CHAINLORDS_PLAY_URL || 'https://play.chainlords.net').replace(/\/$/, '');

/** @type {Array<{ match: (pathname: string) => boolean, targetBase: string }>} */
const PROXY_ROUTES = [
  {
    match: (p) => p === '/health' || p === '/metrics',
    targetBase: MIDDLEWARE_URL,
  },
  {
    match: (p) => p === '/leaderboard' || p.startsWith('/tournaments') || p.startsWith('/hall-of-fame') || p.startsWith('/prizes'),
    targetBase: MIDDLEWARE_URL,
  },
  {
    match: (p) => p.startsWith('/api/arena/'),
    targetBase: PLAY_URL,
  },
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};

function shouldProxy(pathname) {
  return PROXY_ROUTES.find((r) => r.match(pathname)) || null;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': headers['Cache-Control'] || 'no-store', ...headers });
  res.end(body);
}

function isAssetPath(pathname) {
  const ext = path.extname(pathname).toLowerCase();
  if (ext && MIME[ext] && ext !== '.html') return true;
  if (pathname === '/branding/abaddon-icon/discord-server-icon.png') return true;
  if (pathname.startsWith('/branding/')) return true;
  return false;
}

function isDeniedPath(filePath) {
  const rel = path.relative(ROOT, filePath);
  if (!rel || rel === '') return false;
  const parts = rel.split(path.sep);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('.')) return true;
    if (part === 'node_modules') return true;
  }
  const base = path.basename(filePath);
  if (DENIED_BASENAMES.has(base)) return true;
  if (base.endsWith('.test.js')) return true;
  return false;
}

async function proxyRequest(req, res, route, url) {
  const target = `${route.targetBase}${url.pathname}${url.search}`;
  const headers = { ...req.headers, host: new URL(route.targetBase).host };
  delete headers.connection;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : req,
      redirect: 'manual',
    });

    const outHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (key === 'transfer-encoding' || key === 'connection') {
        return;
      }
      outHeaders[key] = value;
    });
    outHeaders['cache-control'] = 'no-store, max-age=0';

    res.writeHead(upstream.status, outHeaders);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.end(buf);
  } catch (error) {
    send(res, 502, JSON.stringify({ ok: false, error: 'upstream_unavailable', detail: error.message }), {
      'Content-Type': 'application/json; charset=utf-8',
    });
  }
}

function serveStatic(req, res, url) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }
  if (decodedPath.includes('\0')) {
    send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  const relative = decodedPath.replace(/^\/+/, '');
  let filePath = path.resolve(ROOT, relative);
  if (url.pathname.endsWith('/')) {
    filePath = path.resolve(filePath, 'index.html');
  }
  if (filePath !== ROOT && !filePath.startsWith(ROOT_PREFIX)) {
    send(res, 403, 'Forbidden');
    return;
  }
  if (isDeniedPath(filePath)) {
    send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // Never SPA-fallback asset URLs (Metaplex token uri is a locked .png path).
      if (isAssetPath(url.pathname)) {
        send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
        return;
      }
      const fallback = path.join(ROOT, 'index.html');
      fs.readFile(fallback, (readErr, data) => {
        if (readErr) {
          send(res, 404, 'Not found');
          return;
        }
        send(res, 200, data, { 'Content-Type': 'text/html; charset=utf-8' });
      });
      return;
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        send(res, 500, 'Read error');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
      if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || ext === '.ico') {
        headers['Cache-Control'] = 'public, max-age=86400';
      }
      send(res, 200, data, headers);
    });
  });
}

const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const route = shouldProxy(url.pathname);
    if (route) {
      void proxyRequest(req, res, route, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    if (error instanceof URIError) {
      if (!res.headersSent) {
        send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      return;
    }
    console.error('[landing] request handler error', error);
    if (!res.headersSent) {
      send(res, 500, 'Internal error', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
  }
});

server.on('clientError', (err, socket) => {
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return;
  }
  socket.destroy();
});

process.on('uncaughtException', (err) => {
  console.error('[landing] uncaughtException', err);
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[landing] listening on :${PORT}`);
    console.log(`[landing] middleware proxy → ${MIDDLEWARE_URL}`);
    console.log(`[landing] game API proxy → ${PLAY_URL}`);
  });
}

module.exports = { shouldProxy, isAssetPath, PROXY_ROUTES, MIDDLEWARE_URL, PLAY_URL, server };
