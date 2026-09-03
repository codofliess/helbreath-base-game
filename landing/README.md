# Chain Lords landing

Static marketing site for **chainlords.net** (Helbreath Chain Lords).

## Live

| URL | Notes |
|-----|--------|
| https://chainlords.net | Apex (Cloudflare → Railway) |
| https://www.chainlords.net | www |
| https://chainlords-landing-production.up.railway.app | Railway direct |

Railway project: **chainlords-landing**.

## What ships (2026-07-18)

| Area | Detail |
|------|--------|
| Layout | 3-col shell: gray **World** / dark center / gray **Arena** (sides 360px) |
| World CTA | Yellow **Play Now** → Phantom → middleware auth → traveler `?wallet&token&mode=world` → SELECTCHAR |
| Stats | Live online / Bleeding / Buildings / PVP-PVE (`landing-api` or game `:1337`) |
| EK | Gallery under green stats — rarity rules + filters |
| Arena | Sunday events copy; links to **1v1** / **3v3** inscription |
| Inscription | `arena-1v1.html`, `arena-3v3.html` — wallet sign, preclassified table, tennis R1 preview |
| Market | `market.html` — mobile auction side door, Grok order, USDC pay-dev, delivery desk |

See also [`docs/MARKET-MOBILE.md`](../docs/MARKET-MOBILE.md).

## Config overrides (optional)

Set before `main.js` / arena scripts:

```js
window.__CHAINLORDS_PLAY_URL__ = "http://127.0.0.1:8081";
window.__CHAINLORDS_MIDDLEWARE_URL__ = "http://127.0.0.1:3001";
window.__CHAINLORDS_STATS_API__ = "https://chainlords-stats-production.up.railway.app";
```

## Deploy

```bash
cd landing
railway up -y
railway cdn purge all
```

The landing service runs `node server.js`, which serves static files and **reverse-proxies** public API paths (`/health`, `/leaderboard`, `/api/arena/*`) to middleware and play hosts. See [`docs/PRODUCTION-REPAIR-RUNBOOK.md`](../docs/PRODUCTION-REPAIR-RUNBOOK.md).

## Related services

| Service | Role |
|---------|------|
| **landing-api** (Railway stats) | `GET/POST /api/realm-stats` |
| **middleware-node** | `/auth/*`, `/arena/week`, `/ek-screenshots` |
| **game server :1337** | Realm stats source + character list WS |
| **traveler :8081** | Client after Play Now |

## DNS (Cloudflare)

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `gzndcp2m.up.railway.app` | DNS only |
| CNAME | `www` | `fx5fd1dz.up.railway.app` | DNS only |

## Local

```bash
npx --yes serve .
```
