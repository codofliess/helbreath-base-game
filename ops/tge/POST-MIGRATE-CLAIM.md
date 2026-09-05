# $HELL — post-migrate claim path

**Extra = 0.** Docs only. Do **not** change DBC/DAMM config on-chain.

Pool `4HQX8w9bKfvFKg7NsUoRUpNboH4LyBb1ZkSkW1N2uL9q` · mint `A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ`.

As of 2026-09-05 the launchpad was **not** graduated (`launchpad_details.completed = false`). Run migrate only after the quote threshold is actually hit.

---

## Wallets

| Role | Who | Prefix (confirm full pubkey on-chain) |
|------|-----|----------------------------------------|
| Creator | DBC `creator` | `65Gh…` |
| Partner fee_claimer / LP | Squads vault | `A782…` |
| Protocol | Meteora | n/a (not us) |

Creator claims **must** land on `65Gh…`. Partner trading fees and partner LP **must** land on the **A782 Squads vault**, not a personal Phantom.

---

## 1. While still on the curve (now)

Swap fee is **1%**, split **Protocol 20% / Creator 40% / Partner 40%**.

1. From the Meteora DBC UI or `@meteora-ag/dynamic-bonding-curve-sdk`:
   - Creator (`65Gh…`) signs `claimCreatorTradingFee` / `claimCreatorTradingFeeToReceiver` → receiver = `65Gh…`.
   - Partner fee_claimer (`A782…`) signs `claimPartnerTradingFee` / `claimPartnerTradingFeeToReceiver` → receiver = **A782 Squads vault**.
2. Claim quote (SOL) and any base fee balances. Repeat as fees accrue; do not wait for migrate if SOL is sitting unclaimed.
3. **Do not** call `withdrawLeftover`. **leftover = 0** at create → there is nothing to withdraw. Extra = 0.

**ExactOut:** do not enable or use ExactOut swaps for ops or public routing.

---

## 2. Migrate when quote threshold is met

Graduation is **~78.35 SOL** `migrationQuoteThreshold` (quote vault / threshold on the DBC), not a date.

1. Confirm on-chain: quote reserve ≥ ~**78.35 SOL** and the pool is eligible to migrate.
2. Anyone can typically pay the migrate tx; prefer Squads / hot ops with a small SOL float.
3. Follow the DBC migration sequence for this config’s destination (DAMM v1 or v2 — read `PoolConfig.migrationOption`, do not guess):
   - DAMM v1: `createDammV1MigrationMetadata` → optional locker → `migrateToDammV1` → lock LP.
   - DAMM v2: optional locker → `migrateToDammV2`.
4. Record the **new DAMM pool address**. Update Dexscreener/CG/CMC to the graduated pair. Do not keep listing the DBC address as the only pool.

There is **no leftover base** to skim at migrate (`leftover = 0`).

---

## 3. LP after migrate (already configured)

| Party | Share of migrated LP | After migrate |
|-------|----------------------|----------------|
| Creator (`65Gh…`) | **0%** | Nothing to claim as LP. Creator continues to claim **trading fees** only (40% of the 1% while on DBC; post-migrate DAMM fee schedule is whatever the config set — do not invent a new split). |
| Partner (`A782…`) | **100%** | **30% unlocked** + **70% locked** |

**Partner unlocked 30%:**

1. After migrate, from the partner / fee_claimer (`A782…`): withdraw / claim the **unlocked 30%** LP (`claimDammV1LpToken` or DAMM v2 equivalent).
2. Destination: **A782 Squads vault**.
3. Treat unlocked LP as treasury inventory (C10 almost-never dump). Withdraw ≠ sell.

**Partner locked 70%:** leave locked. Do not write unlock-date promises unless the on-chain locker account says so.

Creator LP = **0%** → skip creator lock/claim LP instructions.

---

## 4. Fees after migrate

- Keep claiming **creator** trading/migration fees to `65Gh…` (`creatorWithdrawMigrationFee` / DAMM fee claim as applicable).
- Keep claiming **partner** trading/migration fees to **A782 Squads**.
- Protocol share stays with Meteora.

---

## 5. Do not do

- Retune leftover, curve amounts, fee bps, or LP 30/70 — **on-chain tokenomics stay as created**.
- Advertise **Ronda2** (deferred).
- Promise a **Robinhood** listing.
- Call `withdrawLeftover` as if there were a mine/team bucket.
- Send partner fees or unlocked LP to a personal wallet instead of A782 Squads.

---

## 6. Landing / Railway (ops blocker, not this PR)

Claim path does not depend on the website. Listing explorers **do** depend on the immutable Metaplex URI returning PNG bytes.

Git on `consolidacion` already has PR #10 (hero + `discord-server-icon.png`). **Redeploying Railway `chainlords-landing` is out of scope here.** Until ops redeploys and purges CDN, www may still serve stale HTML at the locked URI.
