# PATH B — Meteora DBC create checklist ($HELL reticker / new mint)

Extra=0 · tokens mínimos · NO leftover=0  
Wallets lock: creator `65GhX7QsKfvdmbsaMBz4iEGgpcZZQnDRh4kgjTJbgT8q` · sender `BTvNgC6MYNmbfxqakyCda32pBWxM7SbJPZKvTYPo4jSh` · Squads A `2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy` · fee+leftover `A782eAeXcyMwnn2eqTmY96MVbf8Cai3TRA1eEmXixG8g`  
NO daily · NO KindGem997 · CERO ExactOut airdrop.

## Target split (1B supply) — LOCK Elon/Martín

| Bucket | % | Amount | Where |
| --- | ---: | ---: | --- |
| Bonding / curve sellable | 40% | 400_000_000 | DBC (on-curve) |
| Farming progresivo (tope diario) | 30% | 300_000_000 | Off-curve → A782; game emits daily cap from vault |
| Airdrop buyers mint fallido `A8fNV2…` | 10% | 100_000_000 | Off-curve → A782 → sender; amount ≈ lo comprado |
| Airdrop lista ~1000 (plan anterior) | 12% | 120_000_000 | Off-curve → A782 → sender transfers |
| Team multi-wallet Martín | 8% | 80_000_000 | Off-curve → A782 → wallets Martín (**lista pendiente**) |
| **leftover (create param)** | **60%** | **600_000_000** | **`leftoverReceiver` = A782** |

Off-curve sum: 30+10+12+8 = **60%**. Curve = **40%**. Leftover param = **600M NUNCA 0**.

Failed-mint buyers (`A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ`): snapshot buy txs/holders → CSV → pay from **10%** bucket via sender. No curve buy.

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
- [ ] A782 ≈ **600M** HELL (leftover landed)
- [ ] Curve / bonding class ≈ **400M** (40%)
- [ ] URI PNG 200 on locked Metaplex path
- [ ] Team 80M: Martín lista → route from A782
- [ ] Farming 300M tagged in A782 ledger + daily cap in game
- [ ] Airdrop fail-buyers 100M + lista 120M: **transfer only** A782→sender→users

## Missing Martín

- Lista wallets team + amounts que sumen **80M** (8%)
