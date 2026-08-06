/**
 * Lightweight public stats API for the Chain Lords landing page.
 * Game server POSTs snapshots; landing GETs them (CORS open).
 */
const http = require('http');

const PORT = Number(process.env.PORT || 3100);
const PUSH_SECRET = (process.env.REALM_STATS_SECRET || '').trim();
const MAX_BODY = 64 * 1024;

/** @type {{ online: number, bleedingIsland: number, insideBuildings: number, pvpPve: number, updatedAtUtc: string | null, source: string }} */
let cache = {
  online: 0,
  bleedingIsland: 0,
  insideBuildings: 0,
  pvpPve: 0,
  updatedAtUtc: null,
  source: 'empty',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Realm-Stats-Secret');
}

function sendJson(res, status, body) {
  cors(res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200 ? 'public, max-age=15' : 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function normalizeStats(raw) {
  const n = (v) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0;
  };
  return {
    online: n(raw.online),
    bleedingIsland: n(raw.bleedingIsland),
    insideBuildings: n(raw.insideBuildings),
    pvpPve: n(raw.pvpPve),
    updatedAtUtc: new Date().toISOString(),
    source: 'game-server',
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    cors(res);
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
    sendJson(res, 200, { ok: true, service: 'chainlords-landing-api', hasStats: !!cache.updatedAtUtc });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/realm-stats') {
    sendJson(res, 200, {
      online: cache.online,
      bleedingIsland: cache.bleedingIsland,
      insideBuildings: cache.insideBuildings,
      pvpPve: cache.pvpPve,
      updatedAtUtc: cache.updatedAtUtc,
      source: cache.source,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/realm-stats') {
    if (!PUSH_SECRET) {
      sendJson(res, 503, { error: 'REALM_STATS_SECRET not configured on API' });
      return;
    }
    const headerSecret =
      (req.headers['x-realm-stats-secret'] || '').toString() ||
      (req.headers.authorization || '').toString().replace(/^Bearer\s+/i, '');
    if (headerSecret !== PUSH_SECRET) {
      sendJson(res, 401, { error: 'unauthorized' });
      return;
    }
    try {
      const text = await readBody(req);
      const raw = text ? JSON.parse(text) : {};
      cache = normalizeStats(raw);
      console.log(
        `[landing-api] stats updated online=${cache.online} bisle=${cache.bleedingIsland} buildings=${cache.insideBuildings} field=${cache.pvpPve}`
      );
      sendJson(res, 200, { ok: true, ...cache });
    } catch (e) {
      sendJson(res, 400, { error: e.message || 'bad request' });
    }
    return;
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[landing-api] listening on :${PORT} secret=${PUSH_SECRET ? 'set' : 'MISSING'}`);
});
