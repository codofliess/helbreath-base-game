# Security hardening — pre-launch review

Date: 2026-07-21  
Scope: multiplayer game server (`multiplayer/server`), market side door, wallet auth.

## Executive summary

A full review of critical processes (auth, GM sandbox, combat, economy, market desk) found **launch-blocking** issues: client-spoofable GM mode, free cash-shop grants via fake tx signatures, and unauthenticated admin packets. **Fixes are implemented** in this pass. Remaining residual risk is documented below.

---

## CRITICAL (fixed)

| # | Issue | Exploit | Fix |
|---|--------|---------|-----|
| C1 | Client `playerMode=gm` → full sandbox without allowlist | Free items, teleport, kill-all mobs/NPCs, OP damage/range | `AdminSecurity`: force **traveler** unless `GM_WALLET_ALLOWLIST` or Dev+`ALLOW_OPEN_GM_SANDBOX` |
| C2 | `PlayerTeleportRequested` no gate | Instant map teleport to any free cell | GM gate |
| C3 | `CreateItemRequest` only checked TravelerMode | Spoof GM mode → free gear | `AdminSecurity.CanUseGmTools` |
| C4 | `KillAllMonsters` / `KillAllNpcs` / `SummonMonster` / `SummonNpc` | Wipe/farm maps | GM gate |
| C5 | Combat stat packets (damage, range, attack/cast/move speed, dash) | God combat | GM gate |
| C6 | Cash shop accepted any `payment_tx_signature` ≥40 chars | Free cash-shop items without paying | Stablecoin path **disabled** until on-chain verify; `allowDevGrantWithoutChainTx: false` |
| C7 | Market desk: grant then confirm | Confirm fail left free items in bag | Confirm **first**, then grant; qty clamp 1–99 |

## HIGH (fixed)

| # | Issue | Fix |
|---|--------|-----|
| H1 | Wallet auth HMAC compared with `string.Equals` | Constant-time `FixedTimeEquals` |
| H2 | Client `rangedAttack` flag bypassed Defense Shield on PvP | Server derives ranged from `AttackRange > 1` |
| H3 | Dash attack if client sets `DashAttack` without permission | Requires `AllowDashAttack` (traveler false) |
| H4 | Anti-bot tools “GM” = any non-traveler | Requires allowlisted GM wallet |

## Already solid (no change)

- Movement: 1-step Chebyshev, cadence, paralysis, reset on speed cheat
- Combat damage: server rolls damage; range re-check after lag delay
- Spells: `IsSpellAllowed` for travelers; learned Magic Tower list
- Auth session: one live connection per wallet; reconnect window
- WebSocket: 4 KB max inbound message
- Shop buy/sell: NPC distance + gold server-side
- Auction: bag gold item 90, fee debt ledger

## Middleware fixes (same pass)

| # | Issue | Fix |
|---|--------|-----|
| M1 | `MARKET_PAY_MODE` default `dev` + free `pay-dev` | Default **`live`**; pay-dev needs `dev` + `ALLOW_MARKET_DEV_PAY=1` |
| M2 | `confirm-pay` accepted any 40-char string | Live path returns **503** until RPC verify ships |
| M3 | Soft wallet auth on market | Default **require** token (`MARKET_REQUIRE_AUTH=0` only for local) |
| M4 | Hardcoded auth secret default | Fail closed in production; warn in dev |
| M5 | NFT voucher unauthenticated | `requireWalletToken` + owner check |
| M6 | Sync secret `!==` compare | `crypto.timingSafeEqual` |

## Residual risk (ops / next sprint)

| Risk | Severity | Recommendation for tomorrow |
|------|----------|-----------------------------|
| Secrets not set on VPS | **CRITICAL ops** | See checklist — without them auth/market stay locked or break open |
| No on-chain cash-shop / market verify | Medium (safe: **disabled**) | Mobile buy paused; in-game gold auction OK |
| Market `MARKET_SYNC_SECRET` compromise | High | Rotate; firewall middleware |
| Postgres 5432 published weak password | High | Bind localhost / strong password |
| Packet flood rate limits | Medium | Enable multi-box ceilings if bots appear |
| Drop path non-atomic | Low | Monitor |

## Ops checklist (soft test / launch)

```bash
# Required on GAME SERVER
set ASPNETCORE_ENVIRONMENT=Production   # or leave Development only on your PC
set WALLET_AUTH_SECRET=<long random, same as middleware>
set MARKET_SYNC_SECRET=<long random, same as middleware>
set MARKET_MIDDLEWARE_URL=https://your-middleware
set GM_WALLET_ALLOWLIST=YourWalletBase58

# Required on MIDDLEWARE
set NODE_ENV=production
set WALLET_AUTH_SECRET=<same>
set MARKET_SYNC_SECRET=<same>
set MARKET_PAY_MODE=live
# do NOT set ALLOW_MARKET_DEV_PAY
# do NOT set MARKET_REQUIRE_AUTH=0

# Never on public hosts:
# ALLOW_OPEN_GM_SANDBOX=true
# ALLOW_INSECURE_AUTH=1
# MARKET_PAY_MODE=dev
# ALLOW_MARKET_DEV_PAY=1
```

Startup logs:

- `[SECURITY] WARNING: WALLET_AUTH_SECRET is not set` → stop and fix
- `[SECURITY] GM sandbox locked: only GM_WALLET_ALLOWLIST…` → expected for launch

## Files touched

- `Helpers/AdminSecurity.cs` (new)
- `Server.cs` — force traveler + security banners
- `World/Game/GameWorld.cs` — gate all sandbox packets
- `Helpers/{Movement,Combat,Inventory,Npc,CashShop,MarketSideDoor,AntiBotTools}.cs`
- `Auth/WalletAuthValidator.cs`
- `Config/CashShop.json` — `allowDevGrantWithoutChainTx: false`
