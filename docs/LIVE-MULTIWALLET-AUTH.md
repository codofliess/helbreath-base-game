# Live multiwallet login (Phantom + RH Chain + Base)

Login is challenge–response against middleware-node. The wallet **signs a UTF-8 message**; the server recovers the key **offline**. **No RH or Base RPC is required** for `personal_sign` / EIP-191. Solana RPC is for mint/drops, not SIWS.

Copy: **RH Chain / Pons** (never “listed on Robinhood”). Solana `$HELL` listing stays on the landing.

## Env (live)

Set the **same** `WALLET_AUTH_SECRET` on middleware and the C# game server. Fail-closed if missing in production.

| Variable | Where | Required | Notes |
|----------|--------|----------|--------|
| `WALLET_AUTH_SECRET` | Railway middleware + Hetzner game server | **Yes** (prod) | HMAC for session tokens (`X-Wallet-Token`). Strong random. Never `ALLOW_INSECURE_AUTH=1` in prod. |
| `DATABASE_URL` | Railway middleware (+ game server Postgres) | **Yes** (prod) | Player/wallet SoT. In-memory binds are local-dev only. |
| `NODE_ENV` | middleware | **Yes** (`production`) | Turns on fail-closed secret + SoT checks. |
| `BOT_ENROLL_SECRET` or `ADMIN_SECRET` | middleware | Only if bot enroll is used | Public register is always `human`. |
| `MARKET_SYNC_SECRET` | middleware + game server | If market side door is live | Unrelated to login verify. |
| `SOLANA_RPC_URL` / `RPC_URL` | middleware | Mint/drops only | **Not** used by `/auth/challenge` or `/auth/verify`. |
| RH RPC / Base RPC | — | **No** for login | Optional later for balances/NFTs. Do not block login on them. |

Templates: `middleware-node/.env.example`, `multiplayer/server/.env.example`. Do not commit real secrets.

## Deploy remaining after merge

1. **Railway** (`chainlords-middleware-production`): merge → redeploy Node service. Confirm `WALLET_AUTH_SECRET` + `DATABASE_URL` are set. Startup log should say `Auth: /auth/challenge, /auth/verify (sol+rh+base EIP-191)`.
2. **Hetzner** traveler (`play.chainlords.net`): ship updated `mp-client` static + restart the game server so HMAC session v2 still matches the middleware secret. If a Node middleware process also runs on the VPS, restart it after pull; otherwise Railway is the SoT.
3. **Landing** (`chainlords.net`): ship `landing/` so Play Now exposes Phantom / RH Chain / Base (autologin `?chain=sol|rh|base`).
4. Smoke: Phantom sign → character list; injected EVM `personal_sign` on `rh` and `base` → session with `boundChains` containing that chain only (same `0x` on both chains = two players unless bound from an existing session).

## Client paths

- Hub picker: Phantom (`sol`) · RH Chain (`rh`) · Base (`base`).
- Same endpoints: `GET/POST /auth/challenge?chainId=&address=` then `POST /auth/verify` with `chainId`, `address`, `challengeId`, `signature`.
