# Market side door — mobile buy + Grok + delivery desk

## Flow

1. **Browse** stocks from phone: landing `/market.html` or Discord `/market`
2. **Grok / advisor** builds a buy plan (Grok 4.1 Fast or static NL)
3. **Order** reserves listings → user pays **USDC** (dev: `pay-dev`; live: treasury + `confirm-pay`)
4. Items go to **delivery desk** (wallet-linked claims)
5. Player enters **World** → game server auto-grants bag stacks and confirms claim

Combat / farm tools are **hard-blocked** in the advisor.

## Components

| Piece | Path |
|--------|------|
| Side door API | `middleware-node/market.js` |
| Landing UI | `landing/market.html` + `market.js` + `market.css` |
| Discord | `social-bot` `/market` + FAQ keywords |
| Game bridge | `multiplayer/server/Helpers/MarketSideDoor.cs` |

## Production URLs (Railway · 2026-07-21)

| Service | URL |
|---------|-----|
| Middleware + market API | https://chainlords-middleware-production.up.railway.app |
| Landing market UI | https://www.chainlords.net/market.html |
| Health | https://chainlords-middleware-production.up.railway.app/market/health |

Project: `chainlords-landing` · services `chainlords-middleware` + `chainlords-landing`.

## Env

### Middleware (`middleware-node`)

```
MARKET_PAY_MODE=dev          # or live
MARKET_FEE_PERCENT=5
MARKET_TREASURY_WALLET=       # Solana pubkey for live USDC
MARKET_SYNC_SECRET=same-as-game
MARKET_DATA_DIR=./data       # optional persist (ephemeral on Railway unless volume)
AUCTION_BOARD_JSON=          # optional path to Chars/auction-board.json
XAI_API_KEY=                 # optional — advisor uses 4.1 Fast
XAI_MODEL=grok-4-1-fast-non-reasoning
NIXPACKS_NODE_VERSION=20
```

### Game server

```
MARKET_MIDDLEWARE_URL=https://chainlords-middleware-production.up.railway.app
MARKET_SYNC_SECRET=same-as-middleware
```

### Social bot

```
MARKET_API_URL=https://chainlords-middleware-production.up.railway.app
MARKET_LANDING_URL=https://www.chainlords.net/market.html
```

## HTTP API (middleware)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/market/health` | counts + pay mode |
| GET | `/market/search?q=` | public listings |
| GET | `/market/listings` | all active |
| POST | `/market/quote` | `{ q, qty, maxUnitUsdc }` |
| POST | `/market/orders` | `{ wallet, q, qty, maxUnitUsdc, delivery }` |
| POST | `/market/orders/:id/pay-dev` | dev settle |
| POST | `/market/orders/:id/confirm-pay` | `{ wallet, txSignature }` live |
| GET | `/market/desk/:wallet` | ready claims |
| POST | `/market/advisor` | `{ message }` NL / Grok |
| POST | `/market/game/sync-listings` | game → catalog (secret) |
| GET | `/market/game/desk/:wallet` | game pull (secret) |
| POST | `/market/game/desk-claim` | game confirms grant (secret) |

## Security notes

- v1 **pay-dev** is for test only — never enable as sole path in prod without treasury verify.
- Live: set `MARKET_PAY_MODE=live`, treasury multisig, verify SPL transfer memo=`orderId` (RPC verify TBD hardening).
- Desk grant is **server-side** only; client cannot invent claims.
- Advisor refuses kill/farm language.

## Demo seed

On empty state, middleware seeds Merien / Xelima / Merien Shield demo listings so mobile UI works without a live auction board.

## Test checklist

1. `cd middleware-node && node server.js`
2. Open `landing/market.html` → Search `merien`
3. Connect/paste wallet → Quote → Create order & pay (dev)
4. Refresh desk → claims ready
5. Game online with `MARKET_SYNC_SECRET` → bag receives items + system chat
6. Discord `/market query: merien stones` (middleware reachable from bot host)
