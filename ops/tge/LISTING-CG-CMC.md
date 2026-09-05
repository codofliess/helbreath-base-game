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
| DexScreener | https://dexscreener.com/solana/ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx |
| Site | https://www.chainlords.net/#hell |
| Play | https://play.chainlords.net |
| Discord | https://discord.gg/F4NwwbfKtj |
| X | https://x.com/ChainLordsHQ |

Token / coin copy: **$HELL / Chain Lords**. Do not write “Helbreath” in the listing form name or description.

**Do not list** failed Path A mint `A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ` or pool `4HQX8w9bKfvFKg7NsUoRUpNboH4LyBb1ZkSkW1N2uL9q`.

---

## Path C — HELBREATH (planned / not created)

**Not live.** No mint. Do **not** paste a placeholder address into CG/CMC, DexScreener, or the www hero.

| Field | Value |
|-------|--------|
| Status | **Planned only** — docs + asserts in `ops/tge/CREATE-C-CHECKLIST.md`. **No on-chain create in this PR.** |
| Name (when created) | Chain Lords — Helbreath |
| Symbol (when created) | HELBREATH |
| Chain | Solana |
| Mint | **none** — do not invent one; do not list a fake mint as live |
| Live `$HELL` today | Path B `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq` (keep landing / current listing on this) |
| Leftover at create | **Still in the DBC vault.** A782 = **0** until post-migrate `withdrawLeftover`. Same Path B trap, new ticker. |
| leftover=0 | **Forbidden** (`assert-create-c.cjs` refuses `--execute`) |

Helbreath **is** the intended listing name for **this** ticker only. That does **not** change Path B `$HELL` copy above (still no Helbreath on the live HELL form).

**Do not write** that leftover already sits in A782 on create day. leftover + leftoverReceiver are create params; Meteora pays leftover only after migrate.

Landing / www hero stays on Path B `4Sk2…` until a **real** Path C mint exists.

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

## Supply on the DBC (read from chain 2026-09-05 — do not paste the plan)

**Do not write “600M already in A782”.** That was the Path B *plan*. It is **not** what wallets show.

Read from `PoolConfig` `14CeTDGTgV1CFgpo746MLFEheV8UMcVq3rrN1TLnwwXu` + vault `CmJSX3PsfCApVCohTo4njZUS7obPmCyjCRXwTMNNTFbx`:

| On-chain field | Amount (HELL, 9 dec) | % of 1B |
|----------------|----------------------|---------|
| `swap_base_amount` (sellable on the curve) | ≈ **322.096M** | **32.2%** |
| `migration_base_threshold` (graduation LP) | ≈ **67.904M** | **6.8%** |
| Implied leftover (`1B − swap − migration`) | ≈ **610.000M** | **61.0%** |
| `pre_migration_token_supply` / `post_migration_token_supply` | **1 000 000 000** / **1 000 000 000** | — |
| DBC base vault **right now** (`base_reserve` = ATA balance) | ≈ **991.32M** | **99.1%** |
| `A782…` HELL ATA | **0** | **0%** |
| `leftover_receiver` / `fee_claimer` | `A782…` (pubkey only — **no tokens yet**) | — |
| `migration_quote_threshold` | ≈ **30.56 SOL** | — |

322.096 + 67.904 + 610.000 = 1B. Leftover is **reserved in the DBC vault**, not sent to Squads at create. Meteora only pays leftover to `leftover_receiver` **after migrate** (`withdrawLeftover`). Until then DexScreener will look like “~100% on the curve”.

**DexScreener (pool `ADHCfYc…`, checked 2026-09-05):** `fdv` ≈ **$2 122** and `marketCap` ≈ **$2 122** (they price × 1B). GeckoTerminal `market_cap_usd: null` is the honest tracker default. **Do not paste DexScreener MC as circulating.**

**Forbidden on CG/CMC / social / Discord FAQ:**

- “600M leftover already sitting in A782 / team / mine vault”
- Treating MASTERPLAN canvas (100M team, 300M liq, 100M DAO, 100M growth, 400M play-mine) as **this mint’s on-chain buckets**
- “circulating = 40% unlocked”
- Any claim that play-mine credits are already a reserved on-chain allocation

Internal leftover ledger tags (farm / fail-buyer / list / team) are **ops intent**. They cannot be spent from A782 until leftover is withdrawn post-migrate.

---

## Circulating supply (bonding-curve language only)

Until migration completes:

- **Total / max supply:** 1 000 000 000 HELL (fixed; confirm mint authority revoked on Solscan).
- **Circulating:** tokens that have **left the curve vault via swaps** (held by wallets). Today that is the ~8.7M bought so far — **not** 1B, **not** DexScreener’s MC. Do **not** report FDV as circulating.
- **Not circulating:** the **~991M still in the DBC base vault** (unsold sellable + migration LP + leftover). Leftover is **not** in `A782…` yet.
- **Market cap:** leave blank / `null` (GeckoTerminal) or use **price × tokens outside the vault**. DexScreener MC=FDV is a tracker artifact.

### Post-migrate leftover note (keep)

After migrate: call `withdrawLeftover` → `leftover_receiver` `A782…`. Only then can leftover leave the DBC vault. Circulating = 1B minus locked partner LP (70% of **partner** LP; see below) minus leftover still sitting in `A782…`. Recalculate from the graduated pool + leftover wallet. **Do not** write leftover=0 (Path A). **Do not** write leftover already landed at create (the lie that showed up on DexScreener as ~100% in the vault).

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

Claim / withdraw steps: [`POST-MIGRATE-CLAIM.md`](./POST-MIGRATE-CLAIM.md) (Path B `4Sk2…`: **do** `withdrawLeftover` after migrate → `A782…`, ~610M if the curve completed as configured). Do not retune LP 30/70. Path A leftover=0 / “do not withdraw” is **only** for dead mint `A8fNV2…`.

---

## What we are **not** promising

| Item | Listing stance |
|------|----------------|
| **Ronda2** | **DEFERRED.** Do not put a second round, second pool, or “phase 2 sale” on CG/CMC. |
| **ExactOut** | **No.** |
| **Robinhood / RH listing** | **No listing promise.** RH Chain is watchlist only (MASTERPLAN). Do not write “coming to Robinhood”. |
| **Graduation date / MC floor** | None. Curve fills when quote hits the migrate threshold, not on a calendar. |
| **Play-mine = circulating reserve** | Credits are a **game** ledger. Leftover is still in the DBC vault, not a spendable A782 reserve. |
| **Airdrop campaign** | **Out of scope for this pack.** Do not invent airdrop dates or amounts on CG/CMC. |

---

## Suggested listing description (utility, freeze C5)

> HELL is the utility token for Chain Lords (browser MMO): shops, sinks, and play-mine credits. Fixed 1B supply on Solana. Live on a Meteora bonding curve. Leftover stays in the DBC vault until post-migrate withdraw — it is not in the partner wallet at create. Not an investment product. Not affiliated with official Helbreath.

---

## Landing / CDN check (code vs live)

| Check | `consolidacion` git | Live www |
|-------|---------------------|----------|
| Hero `#hell` (LIVE, Maggy line, Path B mint + DexScreener) | **Path B `4Sk2…` stays live** — do not point hero at a fake HELBREATH mint | Requires Railway **chainlords-landing** redeploy |
| `landing/branding/abaddon-icon/discord-server-icon.png` (1024 PNG) | **Present** (PR #10) | Same redeploy |
| SPA must not fallback `/branding/*.png` | `landing/server.js` + `landing/test/abaddon-png-path.test.js` | Same |

This PR does **not** redeploy Railway. If www still shows mint `A8fNV2…`, that is an **ops blocker**, not a git miss.
