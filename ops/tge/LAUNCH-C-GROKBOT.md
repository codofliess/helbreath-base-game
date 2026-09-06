# PATH C — grokbot launch kill-switches (HELBREATH)

**Read this before any create, listing, or landing edit.**  
This file is a **mechanical gate**. `assert-create-c.cjs` **fails** if these NEVER/MUST lines disappear.

**No mint in this PR. No `--execute`. Do not invent an address.**

Live `$HELL` on www stays Path B `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq` until a **real** HELBREATH mint exists **and** RPC vault + A782 + config numbers are pasted.

---

## NEVER (copy these strings — assert greps them)

1. **NEVER leftover=0**
2. **NEVER leftover landed in A782 at create** — Meteora leftover stays in the DBC vault until post-migrate `withdrawLeftover`; **A782=0 at create**
3. **NEVER publish LIVE mint on landing/listing without RPC** vault+A782+config numbers
4. **NEVER reuse A8fNV2 or 4Sk2 as HELBREATH**
5. **NEVER remint ticker HELL** — ticker is **HELBREATH**
6. **NEVER ExactOut**
7. **NEVER invent airdrop**
8. **NEVER buy 50% of supply**
9. **NEVER treat DexScreener MC=FDV as circulating**

## MUST

10. **MUST run assert-create-c.cjs PASS before any execute**
11. After create MUST print: **vault ≈1B, A782=0, leftover reserved in vault**

---

## Leftover truth (the lie grokbot already shipped on Path B)

`leftover: 600_000_000` + `leftoverReceiver: A782…` are **create params**.

They do **not** send tokens to A782 on `initialize` / `createPool`.

| When | DBC vault | A782 HELBREATH ATA | What you may write |
| --- | ---: | ---: | --- |
| At create | ≈ **1B** (unsold + migration LP + leftover) | **0** | leftover **reserved in vault** |
| While on curve | vault drops only as people **buy** | **0** | DexScreener MC=FDV is a **tracker artifact**, not circulating |
| After migrate + `withdrawLeftover` | leftover left the vault | leftover arrives | only then farm / fail-buyer / list / team can spend from A782 |

**Path B proof (same program):** `4Sk2…` vault ≈991M, A782=0, implied leftover ≈610M still in vault. Saying “A782 already has 600M” was the idiot move. Do not repeat it on HELBREATH.

There is **no** Meteora day-0 transfer ix that pays leftover to `leftover_receiver`. See [`CREATE-C-CHECKLIST.md`](./CREATE-C-CHECKLIST.md).

---

## Forbidden addresses (not HELBREATH)

| Pubkey | What it is | Path C |
| --- | --- | --- |
| `A8fNV2qVhVV35jh33yy4NcGNowkzKU7kA8uPKkcnFwZJ` | Failed Path A `$HELL` (leftover=0) | **NEVER reuse** |
| `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq` | Live Path B `$HELL` | **NEVER reuse** as HELBREATH; **keep** as landing hero until a real Path C mint exists |
| *(empty / invented)* | Placeholder | **NEVER publish LIVE** |

Ticker **HELL** is Path B. Path C ticker is **HELBREATH**. Do not remint HELL.

---

## Execute gate

```
node ops/tge/assert-create-c.cjs --skip-image
# must print ASSERT_PASS
# must print POST_CREATE_MUST_PRINT vault ≈1B
# must print POST_CREATE_MUST_PRINT A782=0
# must print POST_CREATE_MUST_PRINT leftover reserved in vault
```

- leftover **must** be `600_000_000`. leftover==0 → `ASSERT_FAIL` / refuse `--execute`.
- leftoverReceiver **must** be `A782eAeXcyMwnn2eqTmY96MVbf8Cai3TRA1eEmXixG8g`.
- ticker/symbol **must** be `HELBREATH`.
- Plan mint **must** stay `null` until a real create (and never A8fNV2 / 4Sk2).
- `--execute` on leftover==0 is refused. This PR does **not** run create.

Plan file: [`create-c.plan.json`](./create-c.plan.json). Fixture that **must fail**: [`fixtures/create-c-leftover-0.plan.json`](./fixtures/create-c-leftover-0.plan.json).

---

## Publish LIVE (landing / CG / CMC / Dex) — only after RPC

Do **not** flip `#hell` or listing mint to HELBREATH unless you paste **all** of:

1. mint (new pubkey — not A8fNV2, not 4Sk2)
2. DBC pool
3. PoolConfig
4. DBC base vault balance ≈ **1B** (or 1B minus buys)
5. A782 token ATA = **0**
6. implied leftover = `1B − swap_base_amount − migration_base_threshold` (≈600M class, **not** 0)

Without those RPC numbers, landing hero stays:

`4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq`

---

## Other grokbot traps

- **ExactOut:** off. No ops swap, no public route, no “airdrop via ExactOut”.
- **Invent airdrop:** no dates, no “we bought 50% for the community”, no curve buy to seed A782.
- **buy 50% of supply:** forbidden. Do not snipe the curve to fake leftover in A782.
- **DexScreener MC=FDV:** they price × 1B. That is **not** circulating. Circulating = tokens that **left the vault via swaps**.
- **NEVER leftover landed as a create GO.** Do not add a checkbox like `A782 ≈ 600M leftover landed` — `assert-create-c.cjs` **fails**.

---

## After a real create — print this (or you did not finish)

```
POST_CREATE_MUST_PRINT vault ≈1B
POST_CREATE_MUST_PRINT A782=0
POST_CREATE_MUST_PRINT leftover reserved in vault
```

If A782 ≠ 0 at create, you are looking at the wrong mint or you invented a transfer. Stop.
