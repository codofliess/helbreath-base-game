# $HELL — CoinGecko / CoinMarketCap listing pack (honest)

**Status:** live Meteora Dynamic Bonding Curve (DBC). Not graduated. **Path B mint** (do **not** use failed mint `A8fNV2…`).
**Rule:** copy **only** what is on-chain. Do **not** paste MASTERPLAN §1.7 canvas buckets as if they were separate minted allocations. This pack does **not** change tokenomics on-chain.

**Verified 2026-09-05:** Path B mint is SPL Token, **1 000 000 000** HELL, **9** decimals. Quote = wrapped SOL. Confirm mint/freeze authority on Solscan before submitting a form.

---

## Identifiers

| Field | Value |
|-------|--------|
| Name | Chain Lords HELL |
| Symbol | HELL |
| Chain | Solana |
| Mint | `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq` |
| DBC pool | `ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx` |
| Quote | `So11111111111111111111111111111111111111112` (wSOL) |
| Solscan | https://solscan.io/token/4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq |
| DexScreener | https://dexscreener.com/solana/4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq |
| Site | https://www.chainlords.net/#hell |
| Play | https://play.chainlords.net |
| Discord | https://discord.gg/F4NwwbfKtj |
| X | https://x.com/ChainLordsHQ |

Token / coin copy: **$HELL / Chain Lords**. Do not write “Helbreath” in the listing form name or description.

**Do not list** failed Path A mint `A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ` or pool `4HQX8w9bKfvFKg7NsUoRUpNboH4LyBb1ZkSkW1N2uL9q`.

---

## Logos

| Use | URL |
|-----|-----|
| Metaplex / 1024 | https://cdn.jsdelivr.net/gh/codofliess/helbreath-base-game@consolidacion/branding/hell-token/hell-token-logo-metaplex-1024.png |
| CoinGecko 512 | https://cdn.jsdelivr.net/gh/codofliess/helbreath-base-game@consolidacion/branding/hell-token/hell-token-logo-cg-512.png |
| Repo | `branding/hell-token/hell-token-logo-metaplex-1024.png`, `branding/hell-token/hell-token-logo-cg-512.png` |

**Landing hero / Discord-style PNG (keep serving as real `image/png`, no SPA fallback):**

`https://www.chainlords.net/branding/abaddon-icon/discord-server-icon.png`

That path must stay a real `image/png` (not SPA `index.html`). Landing on `consolidacion` serves it from `landing/branding/abaddon-icon/discord-server-icon.png` (PR [#10](https://github.com/codofliess/helbreath-base-game/pull/10)). **Live Railway redeploy is an ops blocker** — see bottom.

---

## Supply on the DBC (the only honest allocation)

Path B create used **leftover = 600 000 000 (60%)**, `leftoverReceiver` = Squads vault `A782…`. That is **not** leftover=0.

| DBC / create field | Amount | % of 1B |
|--------------------|--------|---------|
| Bonding / on-curve class (`total − leftover`) | **400 000 000** | **40%** |
| leftover (off-curve at create → `A782…`) | **600 000 000** | **60%** |

400M + 600M = 1B. That is the whole supply at create.

Exact on-curve split between `swapBaseAmount` (sellable) and `migrationBaseThreshold` (graduation LP) must be read from the live DBC account for pool `ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx` — do **not** paste Path A’s 825.887M / 174.112M numbers.

**Forbidden on CG/CMC / social / Discord FAQ:**

- Treating MASTERPLAN canvas (100M team, 300M liq, 100M DAO, 100M growth, 400M play-mine) as **this mint’s on-chain buckets**
- “circulating = 40% unlocked” without reading wallets vs curve vault
- Any claim that play-mine credits are already a **separate** on-chain mint allocation (credits are a game ledger; leftover HELL at `A782…` is the vault those systems may later spend)

Internal leftover ledger tags (farm / fail-buyer / list / team) are **ops intent**, not listing-form fields unless those transfers have already happened on-chain.

---

## Circulating supply (bonding-curve language only)

Until migration completes:

- **Total / max supply:** 1 000 000 000 HELL (fixed; confirm mint authority revoked on Solscan).
- **Circulating:** tokens that have **left the curve vault via swaps** (held by wallets), plus leftover tokens that have **left `A782…`** if any. Do **not** report FDV as circulating.
- **Not circulating:** unsold on-curve tokens still in the DBC base vault, plus `migrationBaseThreshold` that only becomes AMM LP at graduation, plus leftover still sitting in `A782…`.
- **Market cap:** if a tracker requires a number, use **price × tokens outside the curve vault**, or leave MC blank and report **FDV = price × 1B**. GeckoTerminal may report `market_cap_usd: null` while the launchpad is incomplete — that is the honest default.

### Post-migrate leftover note (keep)

After migrate: circulating = 1B minus LP tokens locked in the DAMM pool (70% of **partner** LP permanently locked; see below), minus any leftover still held in `A782…` that has not been distributed. Recalculate from the graduated pool + leftover wallet; do not keep DBC language. **Do not** call leftover=0 — Path B leftover already landed at create.

---

## Fees (DBC, pre-migrate)

| Item | Value |
|------|--------|
| Swap fee | Confirm on-chain for this pool (Path B plan: **1%** / 100 bps) |
| Protocol / creator / partner shares | Confirm `VirtualPool.creator` and `PoolConfig.fee_claimer` before pasting |

Confirm full pubkeys on-chain (`VirtualPool.creator`, `PoolConfig.fee_claimer`) before pasting into a form. Prefixes are the ops names; do not invent the rest of the base58. Path B lock: leftover + fee claimer `A782…`, pool creator `65Gh…`.

**ExactOut:** not used. Do not advertise ExactOut routing.

---

## Post-migrate LP (config already set; do not retune on-chain)

| Party | LP share | Lock |
|-------|----------|------|
| Creator | **0%** | — |
| Partner (`A782…`) | **100%** of migrated LP | **30% unlocked** + **70% locked** |

Claim / withdraw steps: [`POST-MIGRATE-CLAIM.md`](./POST-MIGRATE-CLAIM.md). That note still describes Path A leftover=0 withdraw language — **Path B leftover is 60% at `A782…`**; do not `withdrawLeftover` as if leftover were 0, and do not retune LP 30/70.

---

## What we are **not** promising

| Item | Listing stance |
|------|----------------|
| **Ronda2** | **DEFERRED.** Do not put a second round, second pool, or “phase 2 sale” on CG/CMC. |
| **ExactOut** | **No.** |
| **Robinhood / RH listing** | **No listing promise.** RH Chain is watchlist only (MASTERPLAN). Do not write “coming to Robinhood”. |
| **Graduation date / MC floor** | None. Curve fills when quote hits the migrate threshold, not on a calendar. |
| **Play-mine = circulating reserve** | Credits are a **game** ledger. Leftover HELL at `A782…` is not “already circulating play-mine.” |
| **Airdrop campaign** | **Out of scope for this pack.** Do not invent airdrop dates or amounts on CG/CMC. |

---

## Suggested listing description (utility, freeze C5)

> HELL is the utility token for Chain Lords (browser MMO): shops, sinks, and play-mine credits. Fixed 1B supply on Solana. Live on a Meteora bonding curve (leftover 60% at create to the partner vault; 40% on-curve). Not an investment product. Not affiliated with official Helbreath.

---

## Landing / CDN check (code vs live)

| Check | `consolidacion` git | Live www |
|-------|---------------------|----------|
| Hero `#hell` (LIVE, Maggy line, Path B mint + DexScreener) | **This PR** | Requires Railway **chainlords-landing** redeploy |
| `landing/branding/abaddon-icon/discord-server-icon.png` (1024 PNG) | **Present** (PR #10) | Same redeploy |
| SPA must not fallback `/branding/*.png` | `landing/server.js` + `landing/test/abaddon-png-path.test.js` | Same |

This PR does **not** redeploy Railway. If www still shows mint `A8fNV2…`, that is an **ops blocker**, not a git miss.
