# $HELL — post-migrate claim path

**Extra = 0.** Docs only. Do **not** change DBC/DAMM config on-chain. Do **not** create a new mint.

**Live Path B mint (use this):** `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq` · pool `ADHCfYcCC2h5RM44aQhjTrRBLESJPmPnepy6bV8pkNx` · config `14CeTDGTgV1CFgpo746MLFEheV8UMcVq3rrN1TLnwwXu`.

Failed Path A mint `A8fNV2…` / pool `4HQX8w9b…` is **not** the live token. Path A leftover=0 language below is **historical only**.

As of 2026-09-05 Path B is **not** graduated. Run migrate only after the quote threshold is actually hit.

---

## Wallets

| Role | Who | Prefix (confirm full pubkey on-chain) |
|------|-----|----------------------------------------|
| Creator | DBC `creator` | `65Gh…` |
| Partner fee_claimer / leftover_receiver / LP | Squads vault | `A782…` |
| Protocol | Meteora | n/a (not us) |

Creator claims **must** land on `65Gh…`. Partner trading fees, leftover, and partner LP **must** land on the **A782 Squads vault**, not a personal Phantom.

---

## Leftover timing (Path B — read this first)

On `4Sk2…` leftover is **not** 0. Config implies ≈ **610M** reserved (`1B − ~322.096M swap − ~67.904M migration LP`).

Those tokens sit in the DBC base vault (`CmJSX3PsfCApVCohTo4njZUS7obPmCyjCRXwTMNNTFbx`, ≈991.32M today). **A782 = 0** until after migrate.

1. Wait for quote threshold, then migrate.
2. From `leftover_receiver` `A782…`, call `withdrawLeftover`.
3. Only then can farm / fail-buyer / list / team ledgers spend from A782.

Do **not** write “600M already in A782”. Do **not** treat DexScreener MC=FDV as “leftover=0 / 100% circulating”.

---

## 1. While still on the curve (now)

Swap fee plan: **1%**, split **Protocol 20% / Creator 40% / Partner 40%** — confirm on-chain for this pool before claiming.

1. From the Meteora DBC UI or `@meteora-ag/dynamic-bonding-curve-sdk`:
   - Creator (`65Gh…`) signs `claimCreatorTradingFee` / `claimCreatorTradingFeeToReceiver` → receiver = `65Gh…`.
   - Partner fee_claimer (`A782…`) signs `claimPartnerTradingFee` / `claimPartnerTradingFeeToReceiver` → receiver = **A782 Squads vault**.
2. Claim quote (SOL) and any base fee balances. Repeat as fees accrue; do not wait for migrate if SOL is sitting unclaimed.
3. **Do not** call `withdrawLeftover` **before** migrate. It will fail or no-op while the pool is still on the curve. Extra = 0.

**ExactOut:** do not enable or use ExactOut swaps for ops or public routing.

---

## 2. Migrate when quote threshold is met

Graduation is the on-chain `migrationQuoteThreshold` (Path B config ≈ **30.56 SOL** — confirm before paying the tx), not a date. Path A’s ~78.35 SOL number is **wrong for `4Sk2…`**.

1. Confirm on-chain: quote reserve ≥ threshold and the pool is eligible to migrate.
2. Anyone can typically pay the migrate tx; prefer Squads / hot ops with a small SOL float.
3. Follow the DBC migration sequence for this config’s destination (DAMM v1 or v2 — read `PoolConfig.migrationOption`, do not guess):
   - DAMM v1: `createDammV1MigrationMetadata` → optional locker → `migrateToDammV1` → lock LP.
   - DAMM v2: optional locker → `migrateToDammV2`.
4. Record the **new DAMM pool address**. Update Dexscreener/CG/CMC to the graduated pair. Do not keep listing the DBC address as the only pool.
5. **Then** call `withdrawLeftover` → `A782…` (~610M if the curve completed as configured).

---

## 3. LP after migrate (already configured)

| Party | Share of migrated LP | After migrate |
|-------|----------------------|----------------|
| Creator (`65Gh…`) | **0%** | Nothing to claim as LP. Creator continues to claim **trading fees** only. |
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
- Skip `withdrawLeftover` on Path B (that leftover=0 instruction was Path A / `A8fNV2…` only).
- Send leftover, partner fees, or unlocked LP to a personal wallet instead of A782 Squads.
- Airdrop / ExactOut from the curve.

---

## 6. Historical — Path A mint only (`A8fNV2…`)

Pool `4HQX8w9bKfvFKg7NsUoRUpNboH4LyBb1ZkSkW1N2uL9q` was created with **leftover = 0** (~825.887M swap + ~174.112M migration). There is **no leftover base** to withdraw on that mint. Do **not** copy that rule onto `4Sk2…`.

---

## 7. Landing / Railway (ops blocker, not this PR)

Claim path does not depend on the website. Listing explorers **do** depend on the immutable Metaplex URI returning PNG bytes.

Git on this branch already points landing + listing at Path B `4Sk2…`. **Redeploying Railway `chainlords-landing` is out of scope here.** Until ops redeploys, www may still serve stale Path A mint HTML.
