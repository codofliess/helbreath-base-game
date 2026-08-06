# Chain Lords landing API

Public cache for realm counters on **chainlords.net**.

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/realm-stats` | none (CORS `*`) |
| POST | `/api/realm-stats` | `X-Realm-Stats-Secret` |
| GET | `/health` | none |

## Production

- URL: `https://chainlords-stats-production.up.railway.app`
- Landing reads GET every 5 minutes.
- Local game server pushes every 30s when env is set:

```bash
REALM_STATS_PUSH_URL=https://chainlords-stats-production.up.railway.app/api/realm-stats
REALM_STATS_SECRET=<same as Railway variable>
```

## Deploy

```bash
cd landing-api
railway up -y
```
