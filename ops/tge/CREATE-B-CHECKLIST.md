# PATH B — Meteora DBC create checklist ($HELL reticker / new mint)

Extra=0 · tokens mínimos · NO leftover=0  
Wallets lock: creator `65GhX7QsKfvdmbsaMBz4iEGgpcZZQnDRh4kgjTJbgT8q` · sender `BTvNgC6MYNmbfxqakyCda32pBWxM7SbJPZKvTYPo4jSh` · Squads A `2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy` · fee+leftover `A782eAeXcyMwnn2eqTmY96MVbf8Cai3TRA1eEmXixG8g`  
NO daily · NO KindGem997 · CERO ExactOut airdrop.

## Leftover timing (Meteora — do not lie)

`leftover` + `leftoverReceiver` are **create params**. They do **not** send HELL to A782 at create.

Meteora keeps leftover in the **DBC base vault** until **after migrate**, then `withdrawLeftover` pays `leftover_receiver`. Until then:

- A782 HELL ATA is **0**
- DexScreener looks like “~100% on the curve” (MC ≈ FDV)
- farm / fail-buyer / list / team buckets are **ops ledger only** — not spendable from A782

Live Path B mint `4Sk2…` (2026-09-05): vault ≈ **991.32M**, A782 = **0**, implied leftover ≈ **610M** still in the vault. Do **not** write “A782 ≈ 600M leftover landed”.

## Target split (1B supply) — LOCK Elon/Martín (plan, not wallets)

| Bucket | % | Amount | Where |
| --- | ---: | ---: | --- |
| Bonding / curve sellable | 40% | 400_000_000 | DBC sellable + migration LP (on-curve class) |
| Farming progresivo (tope diario) | 30% | 300_000_000 | Ledger tag on leftover — spendable from A782 **only after** `withdrawLeftover` |
| Airdrop buyers mint fallido `A8fNV2…` | 10% | 100_000_000 | Same — post-withdraw only |
| Airdrop lista ~1000 (plan anterior) | 12% | 120_000_000 | Same — post-withdraw only |
| Team multi-wallet Martín | 8% | 80_000_000 | Same — post-withdraw only |
| **leftover (create param)** | **60%** | **600_000_000** | **Reserved in DBC vault**; `leftoverReceiver` = A782 **after migrate** |

Off-curve sum: 30+10+12+8 = **60%**. Curve = **40%**. Leftover param = **600M NUNCA 0**. On-chain `4Sk2…` rounded to ≈610M leftover / ≈322M swap / ≈68M migration LP.

Failed-mint buyers (`A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ`): snapshot buy txs/holders → CSV → pay from **10%** bucket via sender. No curve buy.


## Product lock (Martín / Elon) — AFTER mint

Tokenomics unchanged: farm **30** / airdrop fail **10** / lista **12** / team **8** / bonding **40**.

1. **Launch surface:** Abaddon avatar + redes + landing (URI PNG + hero mint). Redeploy Railway if live still stale.
2. **Mining 30%:** farmable vía **Grok Bot** (créditos / tope diario) desde A782 — wire **después** de migrate + `withdrawLeftover`, no en el tx Meteora y no al create.
3. **Arenas + torneos:** agentes IA controlando jugadores — **después** del mint; no bloquea create.
4. **Gas:** ~US$30 en SOL → Squads A `2a4b…` (payer create). Extra=0 fuera de eso.
5. Orden: **checklist create first** → GO Cruchi → farm/arena product AFTER.

## Meteora `buildCurve*` MUST

- `totalTokenSupply`: `1_000_000_000`
- `leftover`: `600_000_000` — script aborts if `0`
- `leftoverReceiver`: `A782…`
- `feeClaimer`: `A782…`
- `tokenAuthorityOption`: Immutable (URI PNG estática lista antes)
- Fee: 100 bps fixed (o scheduler anti-snipe) · `collectFeeMode`: QuoteToken · `creatorTradingFeePercentage`: 50
- Liquidity post-migrate: partner 30% unlocked / 70% locked · creator LP 0% (salvo corte Martín)
- Seed: 0 first-buy · initial MC chico · migrate threshold a definir
- Payer create: Squads A `2a4b…` · poolCreator: `65Gh…`

## Pre-execute asserts (`assert-create-b.cjs`)

1. `leftover === 600_000_000` — **refuse `--execute` if leftover==0**
2. `leftover / total === 0.60`
3. `leftoverReceiver === A782` && `feeClaimer === A782`
4. Creator / sender / Squads A pubs match lock
5. Metaplex/image URI returns `image/png` (HEAD), not HTML
6. Bucket ledger in plan: farm 300M · airdropFail 100M · airdropList 120M · team 80M

## Post-create GO (Cruchi + Paio)

- [ ] mintAuthority = null · freezeAuthority = null
- [ ] A782 HELL ATA = **0** at create (leftover is **not** landed)
- [ ] DBC base vault holds almost all 1B (unsold sellable + migration LP + leftover)
- [ ] `PoolConfig`: leftover implied = `1B − swap_base_amount − migration_base_threshold` (Path B ≈ 610M, **not** leftover=0)
- [ ] URI PNG 200 on locked Metaplex path
- [ ] After migrate only: `withdrawLeftover` → A782, then route team / farm / airdrops from A782
- [ ] Until then: do **not** spend, airdrop, or list leftover as sitting in Squads

## Missing Martín

- Lista wallets team + amounts que sumen **80M** (8%)
