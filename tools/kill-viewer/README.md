# ChainLords — Kill Ledger viewer (draft)

Status: **DRAFT. Not deployed.** Package lives at `tools/kill-viewer/` so game client/server stay untouched. No keys and no real secrets (env var *names* only, see `.env.example`).

Sample/mock JSON fixtures are **not committed**. `npm run gen:sample` can write `sample/` locally (gitignored). Tests generate the same deterministic data in memory.

## Stack
- **Frontend:** Vite + React + TypeScript. Two bundles: `web/public` → `dist/public` and `web/admin` → `dist/admin`.
- **Backend:** Hono on Node 20. Two entrypoints: `src/server/public/index.ts` → `dist/server/public-api.mjs` (port 8787) and `src/server/admin/index.ts` → `dist/server/admin-api.mjs` (port 8788, internal host).
- **DB:** Postgres (`db/schema.sql`). With no `PUBLIC_DB_URL`, the public API uses generated SAMPLE data and the sample banner stays on.
- **Tests:** vitest, plus `check-public-bundle.mjs` after build.

## How to run tests (not wired into repo CI)

There is no existing GitHub Actions workflow in this repo to attach to without inventing CI. Run locally (or add a job later):

```bash
cd tools/kill-viewer
npm ci
npm test                 # unit/privacy/copy + embedded-Postgres schema test (~30s)
SKIP_PG_INTEGRATION=1 npm test   # skip embedded Postgres
npm run build            # typecheck + both web bundles + both server bundles + public-bundle privacy check
```

## Run locally
```bash
npm ci
# Fail-closed: blank delay env hides kills and loot. For a local preview you must set explicit values:
#   PUBLIC_PUBLISH_DELAY_HOURS=0 PUBLIC_LOOT_REVEAL_DELAY_HOURS=0 PUBLIC_TIME_ROUND_MINUTES=60
PUBLIC_PUBLISH_DELAY_HOURS=0 PUBLIC_LOOT_REVEAL_DELAY_HOURS=0 PUBLIC_TIME_ROUND_MINUTES=60 \
  npm run dev:public-api & npm run dev:web        # http://localhost:5173
# admin (dev only): ADMIN_DEV_JWT_SECRET=<throwaway> ADMIN_IP_ALLOWLIST=127.0.0.1 npm run dev:admin-api & npm run dev:admin-web
npm run gen:sample       # optional; writes gitignored sample JSON
```

`KILL_LEDGER_ONCHAIN_DEPLOYED=false` (default) keeps Maggy's subtitle/footer **without** on-chain wording. Set `true` only after a contract is deployed.

## Fail-closed defaults (owner)
| Knob | If unset |
|---|---|
| `PUBLIC_PUBLISH_DELAY_HOURS` | Hide all public kills. No `{delay}` duration is decided. |
| `PUBLIC_LOOT_REVEAL_DELAY_HOURS` | Hide loot (`loot_revealed=false`). |
| `PUBLIC_TIME_ROUND_MINUTES` | Times coarsened to the UTC day (rounding stays on; finer bucket unset). |
| `same_city_weight` | Unset (`NULL`). Same-city credited kills weigh **0** until the owner sets a value. |
| EK payout `rate_per_ek` | Unset. Preview only, `emitir=false`. No money-movement code. |
| `KILL_LEDGER_ONCHAIN_DEPLOYED` | `false`. |
| Loot currency label | **Zem** (not gold). |
| Second city name | Configurable data; sample shows **Elvine**. |

## Player-facing copy
From Maggy (25-sep-2026). Default title/subtitle/footer omit on-chain wording. Status labels: Counted / Limit reached / Voided / Level gap. Rankings: "City rankings · Top 30" / "Last 30 days" (no `ek-v1` in the chrome).

## Privacy
Kill location stays in `internal_ops`. Public API + public bundle never import location types. Import-boundary tests and `check-public-bundle.mjs` must stay green.

## File map
```
db/schema.sql
src/shared/public-types.ts         public slice types (+ FORBIDDEN_PUBLIC_KEYS)
src/shared/sample-public.ts        in-memory SAMPLE generator (no location)
src/shared/publish-policy.ts       fail-closed delay / rounding / on-chain flag
src/shared/ek-weights.ts           PURE EK ranking/weighting
src/server/admin/sample-locations.ts  admin-only SAMPLE coordinates
src/server/admin/payout.ts         read-only payout preview (no default rate, emitir=false)
web/public/copy.ts                 Maggy player-facing strings
tests/                             public-api, import-boundary, admin-api, bundle-and-schema, ek-weights, sql.integration, copy
```
