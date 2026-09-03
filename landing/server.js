/**
 * Chain Lords landing — static site + public API reverse proxy.
 * Proxies ops/monitoring paths to middleware and game API without SPA fallback.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;

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
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
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
  let filePath = path.join(ROOT, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith('/')) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
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
      send(res, 200, data, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    });
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const route = shouldProxy(url.pathname);
  if (route) {
    void proxyRequest(req, res, route, url);
    return;
  }
  serveStatic(req, res, url);
});

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[landing] listening on :${PORT}`);
    console.log(`[landing] middleware proxy → ${MIDDLEWARE_URL}`);
    console.log(`[landing] game API proxy → ${PLAY_URL}`);
  });
}

module.exports = { shouldProxy, PROXY_ROUTES, MIDDLEWARE_URL, PLAY_URL, server };
