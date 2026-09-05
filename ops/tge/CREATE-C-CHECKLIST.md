# PATH C — Meteora DBC create checklist (HELBREATH — planned, not minted)

Extra=0 · tokens mínimos · **NO leftover=0** · **NO --execute in this PR**  
Ticker **HELBREATH** · name **Chain Lords — Helbreath** (Helbreath ON this coin; Path B `$HELL` listing rule does not apply here)  
Wallets lock (same as Path B): creator `65GhX7QsKfvdmbsaMBz4iEGgpcZZQnDRh4kgjTJbgT8q` · sender `BTvNgC6MYNmbfxqakyCda32pBWxM7SbJPZKvTYPo4jSh` · Squads A payer `2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy` · fee+leftover `A782eAeXcyMwnn2eqTmY96MVbf8Cai3TRA1eEmXixG8g`  
NO daily · NO KindGem997 · **CERO ExactOut**. Abaddon PNG path unchanged.

**This repo change does not create a mint.** There is no Path C mint address. Do not invent one. Do not point www at a fake mint. Live `$HELL` on landing stays Path B `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq`.

---

# LEFTOVER DOES NOT LAND IN A782 AT CREATE

```
╔══════════════════════════════════════════════════════════════════════╗
║  METEORA DBC leftover stays in the DBC BASE VAULT until AFTER        ║
║  migrate. Then leftover_receiver calls withdrawLeftover.             ║
║                                                                      ║
║  leftover + leftoverReceiver are CREATE PARAMS. They do NOT send     ║
║  tokens to A782 at initialize.                                       ║
║                                                                      ║
║  A782 HELBREATH ATA = 0 at create.                                   ║
║  DexScreener will look like ~100% on the curve (MC ≈ FDV).           ║
║  Farm / fail-buyer / list / team are OPS LEDGER TAGS only.           ║
║                                                                      ║
║  THIS IS THE SAME PATH B TRAP. NEW TICKER. WE ARE NOT LYING.         ║
╚══════════════════════════════════════════════════════════════════════╝
```

Proven (Meteora docs / IDL — not vibes):

| Source | What it actually says |
| --- | --- |
| [DBC Surplus and Leftover](https://docs.meteora.ag/core-products/dbc/surplus-and-leftover) | Leftover = unused **base** after the token has **migrated**. `withdrawLeftover` only after virtual pool migration progress is `CreatedPool`. Sent once to `leftover_receiver`. |
| [DBC Accounts](https://docs.meteora.ag/core-products/dbc/accounts-and-permissions) | `leftover_receiver` is fixed on config. Withdraw leftover is permissionless **but funds only go to that ATA after migration**. |
| [SDK leftoverReceiver](https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/reference) | `leftoverReceiver` = “Receiver for leftover base tokens **after migration**.” |
| [SDK createPool](https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/reference) | `createPool({ baseMint, config, name, symbol, uri, payer, poolCreator })` — **no leftover transfer field**. |
| [IDL instructions](https://docs.meteora.ag/developer-guides/dbc/program/instructions) | `initialize_virtual_pool_with_spl_token` / `create_config` do **not** pay leftover. The leftover instruction is `withdraw_leftover` under **Migration**. |
| `lockedVesting` | “Locked base-token vesting schedule **after migration**” / locker created at migrate. **Not** a day-0 spendable A782 ATA. |

**There is no proven Meteora instruction that mints/transfers leftover off-curve to A782 at initialize.** Do not invent a fake “send 600M at create” ix.

Path B live proof (same program, already burned us): mint `4Sk2…` leftover ≈610M **still in vault** `CmJSX3…` (~991M). A782 HELL = **0**. DexScreener FDV=MC looks like 100% on curve.

---

## If you need spendable tokens in A782 **at create** (farm / team)

`leftover` **alone does not do that.**

| Option | What it is | Honest? |
| --- | --- | --- |
| **(a) This Path C plan** | leftover 60% reserved **in the DBC vault** until migrate + `withdrawLeftover` → A782 | **Yes.** Same Path B trap, new ticker. Write it on every form. |
| **(b) Day-0 off-curve transfer via leftoverReceiver** | Would require an initialize/createPool ix that actually transfers to A782 | **NOT FOUND** in current DBC IDL / SDK. Do not claim it. |
| **(c) leftover=0** | Path A: ~100% on curve (825M+174M). No leftover to withdraw. | **FORBIDDEN.** `assert-create-c.cjs` refuses `--execute`. |

If Martín needs farm/team spendable on day 0, that is a **product wait** (migrate first) — not a leftover-param trick. Do not buy the curve. Do not remint `$HELL`. HELBREATH is a **new ticker** so `$HELL` image is not burned again.

---

## Target split (1B supply) — LOCK (plan, not wallets)

Same lock as Path B unless Martín changes it later.

| Bucket | % | Amount | Where **at create** |
| --- | ---: | ---: | --- |
| Bonding / curve sellable | 40% | 400_000_000 | DBC sellable + migration LP (on-curve class) |
| Farming progresivo (tope diario) | 30% | 300_000_000 | Ledger tag on leftover — spendable from A782 **only after** `withdrawLeftover` |
| Airdrop buyers mint fallido `A8fNV2…` | 10% | 100_000_000 | Same — post-withdraw only |
| Airdrop lista ~1000 (plan anterior) | 12% | 120_000_000 | Same — post-withdraw only |
| Team multi-wallet Martín | 8% | 80_000_000 | Same — post-withdraw only |
| **leftover (create param)** | **60%** | **600_000_000** | **Reserved in DBC vault**; `leftoverReceiver` = A782 **after migrate** |

Off-curve sum: 30+10+12+8 = **60%**. Curve = **40%**. Leftover param = **600M NUNCA 0**.

Failed-mint buyers (`A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ`): snapshot → CSV → pay from **10%** bucket via sender **after** withdraw. No curve buy. No ExactOut.

---

## Product lock — AFTER mint (not this PR)

Tokenomics unchanged: farm **30** / airdrop fail **10** / lista **12** / team **8** / bonding **40**.

1. **Launch surface:** Abaddon avatar + redes + landing (URI PNG + hero mint) **only after a real Path C mint exists**. Until then landing hero stays Path B `4Sk2…`.
2. **Mining 30%:** farmable vía Grok Bot desde A782 — wire **después** de migrate + `withdrawLeftover`.
3. **Arenas + torneos:** después del mint.
4. **Gas:** ~US$30 en SOL → Squads A `2a4b…` (payer create). Extra=0.
5. Orden: **this checklist + asserts first** → later GO (keys / `--execute` **out of scope here**).

---

## Meteora `buildCurve*` MUST (when someone actually creates — not now PR)

- `totalTokenSupply`: `1_000_000_000`
- `leftover`: `600_000_000` — script **aborts / refuses `--execute` if `0`**
- `leftoverReceiver`: `A782…`
- `feeClaimer`: `A782…`
- `tokenAuthorityOption`: Immutable (URI PNG estática lista antes)
- Fee: 100 bps fixed (o scheduler anti-snipe) · `collectFeeMode`: QuoteToken · `creatorTradingFeePercentage`: 50
- Liquidity post-migrate: partner 30% unlocked / 70% locked · creator LP 0%
- Seed: 0 first-buy · initial MC chico · migrate threshold a definir
- Payer create: Squads A `2a4b…` · poolCreator: `65Gh…`
- Metaplex **name** = `Chain Lords — Helbreath` · **symbol** = `HELBREATH`
- Image: Abaddon / hell-token PNG (same locked path as Path B)

---

## Pre-execute asserts (`assert-create-c.cjs`)

1. `ticker` / `symbol` === `HELBREATH`
2. `leftover === 600_000_000` — **refuse `--execute` if leftover==0**
3. `leftover / total === 0.60`
4. `leftoverReceiver === A782` && `feeClaimer === A782`
5. Creator / sender / Squads A pubs match lock
6. Metaplex/image URI returns `image/png` (HEAD), not HTML
7. Bucket ledger in plan: farm 300M · airdropFail 100M · airdropList 120M · team 80M
8. Script **prints** that A782 will be **0** until `withdrawLeftover` (no day-0 transfer)

**Forbidden checkbox (do not add, ever):** leftover already sitting in A782 on create day / leftover already landed.

---

## Post-create GO (only after a real mint — expect empty A782)

- [ ] mintAuthority = null · freezeAuthority = null
- [ ] A782 HELBREATH ATA = **0** at create (leftover is **not** landed — this is correct)
- [ ] DBC base vault holds almost all 1B (unsold sellable + migration LP + leftover)
- [ ] `PoolConfig`: leftover implied = `1B − swap_base_amount − migration_base_threshold` (**not** leftover=0)
- [ ] URI PNG 200 on locked Metaplex path
- [ ] After migrate only: `withdrawLeftover` → A782, then route team / farm / airdrops from A782
- [ ] Until then: do **not** spend, airdrop, or list leftover as sitting in Squads
- [ ] Do **not** list a placeholder mint as live on CG/CMC / landing

---

## Out of scope (unless Martín says otherwise)

- Execute Meteora create (NO KEYS / NO `--execute` here)
- Airdrop campaign
- ExactOut
- Railway redeploy credentials
- Robinhood listing promise (MASTERPLAN watchlist only)

## Missing Martín

- Lista wallets team + amounts que sumen **80M** (8%)
- Explicit GO to create HELBREATH on-chain (this PR is docs + asserts only)
