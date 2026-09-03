# Production repair runbook — API routing + PostgreSQL

**Scope:** Chain Lords production API surfaces only. No gameplay or live player data changes.

**Verified broken (2026-09-03):**

| URL | Symptom |
|-----|---------|
| `GET play.chainlords.net/api/arena/bleeding-online` | `200` HTML (SPA) instead of JSON |
| `GET play.chainlords.net/api/realm-stats` | JSON OK (partial nginx proxy) |
| `GET chainlords-middleware-production.up.railway.app/health` | `postgres: false` |
| `GET …/leaderboard?mode=solo` | `503 PostgreSQL not configured` |
| `GET chainlords.net/health` | SPA `index.html` |

This PR adds repo-side fixes. **Deploy steps below** are required for production to turn green.

---

## Architecture

| Host | Service | API role |
|------|---------|----------|
| `play.chainlords.net` | Hetzner nginx + game `:1337` + traveler static | `/api/*`, `/ws` |
| `chainlords.net` | Railway **landing** | Marketing SPA + **new** reverse proxy for public ops paths |
| `chainlords-middleware-production.up.railway.app` | Railway **middleware-node** | `/health`, `/leaderboard`, drops, tournaments |
| Railway **Postgres** plugin | Managed DB | Shared by middleware (and optionally game VPS) |

---

## 1. Hetzner — fix `play.chainlords.net` `/api/arena/*`

**Root cause:** nginx proxies only some `/api` paths (e.g. `realm-stats`). `/api/arena/bleeding-online` falls through to the traveler SPA.

**Repo fix:** `ops/nginx/chainlords-play.conf.template` — single `location /api/` → `127.0.0.1:1337`.

### Minimal host action (required)

```bash
# On Hetzner play host (as root), after pulling this branch:
export CLIENT_ROOT=/opt/chainlords/client
export TEMPLATE=/opt/chainlords/repo/ops/nginx/chainlords-play.conf.template
bash /opt/chainlords/repo/ops/nginx/install-chainlords-play.sh

# Deploy game binary that includes Server.cs MapGet("/api/arena/bleeding-online")
# (consolidacion branch — rebuild + restart chainlords-game)
systemctl restart chainlords-game
```

### Verify

```bash
curl -sS https://play.chainlords.net/api/arena/bleeding-online | jq .
# Expect: {"worldId":"…","count":N,"players":[…],"source":"game-server",…}
curl -sSI https://play.chainlords.net/api/arena/bleeding-online | grep -i content-type
# Expect: application/json
```

---

## 2. Railway middleware — PostgreSQL

**Root cause:** `middleware-node` starts without `DATABASE_URL`. `getPool()` returns null → `/health` reports `postgres: false`, `/leaderboard` returns 503.

**Repo fix:**

- `middleware-node/persistence.js` — resolve `DATABASE_URL`, `PGHOST`/`PGUSER`/…, ping on `/health`
- `middleware-node/scripts/apply-schema.js` — idempotent schema from `multiplayer/server/Persistence/schema.sql`
- `middleware-node/railway.toml` — `preDeployCommand = "node scripts/apply-schema.js"`

### Minimal host action (Railway UI — unavoidable for variable reference)

Railway cannot set `${{Postgres.DATABASE_URL}}` from `railway.toml` alone. One-time UI step:

1. Railway project → **+ New** → **Database** → **PostgreSQL** (skip if Postgres service already exists).
2. Open **middleware-node** service → **Variables**.
3. **+ New Variable** → **Add Reference** → select Postgres service → **`DATABASE_URL`**.
   - Resolved value looks like: `${{Postgres.DATABASE_URL}}` (service name must match exactly).
4. Redeploy middleware (push to connected branch or **Deploy**).

Optional: if the game server on Hetzner should write to the same DB, copy the **public** TCP URL from Postgres → Variables → `DATABASE_PUBLIC_URL` into the VPS `chainlords-game` environment as `DATABASE_URL` (separate secret; never commit).

### Verify

```bash
curl -sS https://chainlords-middleware-production.up.railway.app/health | jq '.postgres,.postgresConfigured'
# Expect: true, true

curl -sS 'https://chainlords-middleware-production.up.railway.app/leaderboard?mode=solo' | jq '.success,.entries'
# Expect: true, [] or array (not 503)
```

---

## 3. Railway landing — public API on `chainlords.net`

**Root cause:** `serve -s` SPA mode returns `index.html` for `/health`, `/leaderboard`, `/api/arena/bleeding-online`.

**Repo fix:** `landing/server.js` reverse-proxies:

| Path | Upstream (env override) |
|------|------------------------|
| `/health`, `/metrics` | `CHAINLORDS_MIDDLEWARE_URL` |
| `/leaderboard`, `/tournaments*`, `/hall-of-fame`, `/prizes` | middleware |
| `/api/arena/*` | `CHAINLORDS_PLAY_URL` |

Set on Railway **landing** service (optional; defaults are production URLs):

```
CHAINLORDS_MIDDLEWARE_URL=https://chainlords-middleware-production.up.railway.app
CHAINLORDS_PLAY_URL=https://play.chainlords.net
```

Redeploy landing after merge.

### Verify

```bash
curl -sS https://chainlords.net/health | jq '.postgres'
curl -sS 'https://chainlords.net/leaderboard?mode=solo' | jq '.success'
curl -sS https://chainlords.net/api/arena/bleeding-online | jq '.source'
```

---

## 4. Local verification (CI / dev)

```bash
# Middleware unit tests
cd middleware-node && npm test

# Landing proxy route tests
cd landing && npm test

# Nginx template contract
node ops/nginx/chainlords-play.test.js
```

---

## Rollback

| Layer | Rollback |
|-------|----------|
| nginx | Restore previous `/etc/nginx/sites-available/chainlords-play` from backup; `nginx -t && systemctl reload nginx` |
| landing | Revert to `start:static-only` / previous Railway deploy |
| middleware | Remove `DATABASE_URL` reference (leaderboard returns 503 again; no data loss if Postgres kept) |

---

## Files changed in this repair

- `ops/nginx/chainlords-play.conf.template`
- `ops/nginx/install-chainlords-play.sh`
- `ops/nginx/chainlords-play.test.js`
- `landing/server.js`, `landing/package.json`, `landing/railway.toml`
- `landing/test/proxy-routes.test.js`
- `middleware-node/persistence.js`, `middleware-node/server.js`
- `middleware-node/scripts/apply-schema.js`
- `middleware-node/railway.toml`, `middleware-node/package.json`, `middleware-node/.env.example`
- `middleware-node/test/persistence.test.js`
- `docs/PRODUCTION-REPAIR-RUNBOOK.md` (this file)
