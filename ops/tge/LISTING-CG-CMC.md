# $HELL — CoinGecko / CoinMarketCap listing pack (honest)

**Status:** live Meteora Dynamic Bonding Curve (DBC). Not graduated.
**Rule:** copy **only** what is on-chain. Do **not** paste MASTERPLAN §1.7 canvas buckets (team 10% / mine 40% / “40/12 reserved”). Those tables were never minted. This pack does **not** change tokenomics on-chain.

**Verified 2026-09-05:** mint is SPL Token, **1 000 000 000** HELL, **9** decimals, **mint authority = none**, **freeze authority = none**. Quote = wrapped SOL.

---

## Identifiers

| Field | Value |
|-------|--------|
| Name | Chain Lords HELL |
| Symbol | HELL |
| Chain | Solana |
| Mint | `A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ` |
| DBC pool | `4HQX8w9bKfvFKg7NsUoRUpNboH4LyBb1ZkSkW1N2uL9q` |
| Quote | `So11111111111111111111111111111111111111112` (wSOL) |
| Solscan | https://solscan.io/token/A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ |
| Dexscreener | https://dexscreener.com/solana/4hqx8w9bkfvfkg7nsuorupnboh4lybb1zkskw1n2ul9q |
| Site | https://www.chainlords.net/#hell |
| Play | https://play.chainlords.net |
| Discord | https://discord.gg/F4NwwbfKtj |
| X | https://x.com/ChainLordsHQ |

Token / coin copy: **$HELL / Chain Lords**. Do not write “Helbreath” in the listing form name or description.

---

## Logos

| Use | URL |
|-----|-----|
| Metaplex / 1024 | https://cdn.jsdelivr.net/gh/codofliess/helbreath-base-game@consolidacion/branding/hell-token/hell-token-logo-metaplex-1024.png |
| CoinGecko 512 | https://cdn.jsdelivr.net/gh/codofliess/helbreath-base-game@consolidacion/branding/hell-token/hell-token-logo-cg-512.png |
| Repo | `branding/hell-token/hell-token-logo-metaplex-1024.png`, `branding/hell-token/hell-token-logo-cg-512.png` |

**On-chain Metaplex URI (Token Metadata Immutable — cannot change):**

`https://www.chainlords.net/branding/abaddon-icon/discord-server-icon.png`

That path must stay a real `image/png` (not SPA `index.html`). Landing on `consolidacion` already serves it from `landing/branding/abaddon-icon/discord-server-icon.png` (PR [#10](https://github.com/codofliess/helbreath-base-game/pull/10)). **Live Railway redeploy is an ops blocker** — see bottom.

---

## Supply on the DBC (the only honest allocation)

Create used **leftover = 0**. There is **no** off-curve team, mine, or airdrop reserve sitting in a vault at create.

| DBC field | Amount | % of 1B |
|-----------|--------|---------|
| `swapBaseAmount` (tokens on the bonding curve) | ≈ **825.887M** | **82.59%** |
| `migrationBaseThreshold` (tokens reserved for graduation LP) | ≈ **174.112M** | **17.41%** |
| leftover / off-curve mine / airdrop / team at create | **0** | **0%** |

825.887M + 174.112M ≈ 1B. That is the whole supply.

**Forbidden on CG/CMC / social / Discord FAQ:**

- “40% mined / 12% team” or any **40/12 reserved** split
- MASTERPLAN canvas: 100M team, 300M liq, 100M DAO, 100M growth, 400M play-mine
- “circulating = 40% unlocked”
- Any claim that play-mine credits are already a reserved on-chain bucket

Those numbers are **design canvas**, not this mint.

---

## Circulating supply (bonding-curve language only)

Until migration completes:

- **Total / max supply:** 1 000 000 000 HELL (fixed; mint authority revoked).
- **Circulating:** tokens that have **left the curve vault via swaps** (held by wallets). Do **not** report FDV as circulating. Do **not** subtract invented team/mine locks.
- **Not circulating:** unsold `swapBaseAmount` still in the DBC base vault, plus the `migrationBaseThreshold` that only becomes AMM LP at graduation.
- **Market cap:** if a tracker requires a number, use **price × tokens outside the curve vault**, or leave MC blank and report **FDV = price × 1B**. GeckoTerminal currently reports `market_cap_usd: null` while the launchpad is incomplete — that is the honest default.

After migrate: circulating = 1B minus LP tokens locked in the DAMM pool (70% of **partner** LP permanently locked; see below). Recalculate from the graduated pool; do not keep DBC language.

---

## Fees (DBC, pre-migrate)

| Item | Value |
|------|--------|
| Swap fee | **1%** |
| Protocol share of that 1% | **20%** |
| Creator share | **40%** → claim to creator `65Gh…` |
| Partner share | **40%** → claim to Squads vault `A782…` |

Confirm full pubkeys on-chain (`VirtualPool.creator`, `PoolConfig.fee_claimer`) before pasting into a form. Prefixes are the ops names; do not invent the rest of the base58.

**ExactOut:** not used. Do not advertise ExactOut routing.

---

## Post-migrate LP (config already set; do not retune on-chain)

| Party | LP share | Lock |
|-------|----------|------|
| Creator | **0%** | — |
| Partner (`A782…`) | **100%** of migrated LP | **30% unlocked** + **70% locked** |

Claim / withdraw steps: [`POST-MIGRATE-CLAIM.md`](./POST-MIGRATE-CLAIM.md).

---

## What we are **not** promising

| Item | Listing stance |
|------|----------------|
| **Ronda2** | **DEFERRED.** Do not put a second round, second pool, or “phase 2 sale” on CG/CMC. |
| **ExactOut** | **No.** |
| **Robinhood / RH listing** | **No listing promise.** RH Chain is watchlist only (MASTERPLAN). Do not write “coming to Robinhood”. |
| **Graduation date / MC floor** | None. Curve fills when quote hits the migrate threshold (~**78.35 SOL**), not on a calendar. |
| **Play-mine = circulating reserve** | Credits are a **game** ledger. They are **not** an on-chain allocation on this mint. |

---

## Suggested listing description (utility, freeze C5)

> HELL is the utility token for Chain Lords (browser MMO): shops, sinks, and play-mine credits. Fixed 1B supply on Solana. Live on a Meteora bonding curve (leftover 0 at create — no off-curve team/mine reserve). Not an investment product. Not affiliated with official Helbreath.

---

## Landing / CDN check (code vs live)

| Check | `consolidacion` git | Live www |
|-------|---------------------|----------|
| Hero `#hell` (LIVE, Maggy line, mint + DBC) | **Present** (merged PR #10) | Requires Railway **chainlords-landing** redeploy |
| `landing/branding/abaddon-icon/discord-server-icon.png` (1024 PNG) | **Present** | Same redeploy + CDN purge of the Metaplex URI |
| SPA must not fallback `/branding/*.png` | `landing/server.js` + `landing/test/abaddon-png-path.test.js` | Same |

This PR does **not** redeploy Railway. If explorers still show HTML at the immutable URI, that is an **ops blocker**, not a git miss.
