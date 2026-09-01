# Session handoff — 2026-08-27 (Grok Bot)

Repo: `codofliess/helbreath-base-game`  
**Cursor Origin:** GitHub mirror (PO synced full git into Origin 2026-08-27). Agents work here; GitHub remains canonical.  
Work branch: **`consolidacion`** (not `master`)  
PO: Martín / codofliess  
**LIVE: do not touch.**

## Stack (observe only)

| Piece | Where | Status 2026-08-27 |
|-------|--------|-------------------|
| Traveler client | https://play.chainlords.net (Cloudflare → Hetzner) | HTTP 200 |
| Game WS | `wss://play.chainlords.net/ws` | Endpoint up (plain GET → 400) |
| Game process | Hetzner · `chainlords-game` | Heartbeat live · **0 online** |
| Realm stats | https://chainlords-stats-production.up.railway.app/api/realm-stats | `source: game-server` |
| Landing | https://www.chainlords.net | Railway SUCCESS |
| Middleware | https://chainlords-middleware-production.up.railway.app/health | Process UP · **`postgres: false`** |
| Game is **not** a Railway service | Hetzner VPS | Railway = landing + middleware + stats only |

Do not “fix” middleware Postgres from a cloud agent unless PO orders it.

## What you may do

1. Clone, read `AGENTS.md`, `docs/design/CDO.md` for UI.
2. Branch from `consolidacion`.
3. Code + tests + PR. No merge, no deploy.
4. Olympia ingest from repo `reference/` (see AGENTS.md).

## What you must not do

Secrets, `.env`, social-bot tokens, wallet keys, Railway/Hetzner deploys, X/Discord public posts.

## Social (separate from this repo task)

- X brand: @ChainLordsHQ — password recovery pending; drafts only.
- Discord: do not reuse production `DISCORD_BOT_TOKEN` in Grok Bot (Gateway clash).

## Playtest door (docs)

Phantom-free entry is **not** allowed on live. Isolated how-to: [`docs/qa/PLAYTEST-DOOR.md`](qa/PLAYTEST-DOOR.md) (traveler Vite `:8081`, local game `:1337`, char **`ElonQa`**). Do not deploy that host; do not point `VITE_GAME_HOST` at play/Hetzner.

## First useful jobs (pick one, PR)

1. CDO/UI polish from `tmp-po-*.png` (wallet vs referral, Arena button, create-duel, pixelated HUD).
2. Inventory/bag work already dirty on local `consolidacion` — **do not overwrite uncommitted PO files**; ask if conflict.
3. Document-only: map Railway vs Hetzner in README ops section.
4. **Done (docs):** playtest door without Phantom — see `docs/qa/PLAYTEST-DOOR.md`. No CDO/UI in that PR.

Local workstation may have **uncommitted** consolidacion changes. Prefer a clean branch from `origin/consolidacion` unless PO says to continue that WIP.
