# HELL airdrop research — 2026-09-25

Research and list construction only. No signing, no keys, no on-chain sends, no game-code changes.

HELL mint: `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq` (Solana).

## What each platform is

| Platform | Site | What it is on Solana | Program / config IDs |
|---|---|---|---|
| **PumpFun** | https://pump.fun | Memecoin launchpad + PumpSwap AMM + in-app trader PnL / Mayhem boards | Bonding-curve program `6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`; PumpSwap `pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA` |
| **FOMO** | https://fomo.family | Social trading app (Privy login). Swaps route through existing DEX/launchpad programs; not a unique AMM program | Live API `https://prod-api.fomo.family` (session). Independent mirror `https://api.fomoapi.io` (API key) |
| **Stonkfun** | https://www.stonkfun.xyz (`stonk.fun` does not resolve) | Stock-paired Token-2022 launches on Raydium LaunchLab | LaunchLab `LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj`; platform configs `6BwHHDg3u1854jC8PDLXvR4spTcLNaoBxLJNGC4nTESt` (reward) and `4E876qZTE9FJMrBzgVtBrSrzz2TLivB5Y5QXPjB4gZL7` (standard); graduated CPMM `CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C` |
| **Moby** | https://moby.win (AssetDash) | Smart-money screener + self-custody trading (Privy). Hourly PnL contest **hides wallets** | `$MOBY` mint `Cy1GS2FqefgaMbi45UunrUzin1rfEmTUYnomddzBpump`. No public trader-program leaderboard |

## TASK 1 — trader quotas vs achieved

Target 1000 unique traders: 500 PumpFun / 300 FOMO / 100 Stonkfun / 100 Moby, ranked by **realized** PnL, valid 32-byte base58 Solana pubkeys, excluding programs/pools/CEX/custody and the team prefix `4R7F`.

| Platform | Quota | Achieved | Sources actually used | Shortfall / why | Proposed backfill |
|---|---:|---:|---|---|---|
| PumpFun | 500 | **447** | Live `GET https://frontend-api-v3.pump.fun/pnl-leaderboard?period={daily,weekly,monthly}` (100 wallets/window, on-site rank is **net** PnL; we keep `realizedPnlUsd > 0` and re-rank). Live Mayhem `GET .../mayhem/top-traders?window={24h,7d}` (`realisedPnlUsd`). Kolscan Pump-app KOL snapshot https://github.com/nirholas/kol-quest/blob/main/site/data/kolscan-leaderboard.json (committed 2026-04-09; profit SOL × live SOL USD). GMGN `launchpad_smart` subset of https://github.com/nirholas/kol-quest/blob/main/site/data/solwallets.json (captured 2026-03-09; `realized_profit_30d`) | **53**. Official board only publishes 100/window. After union, Mayhem, Kolscan **positive** profit, GMGN launchpad, existing-list dedupe (8), and dropping non-positive realized, 447 unique remain. Did not pad with losers or invented wallets. | Dune query [4032586](https://dune.com/queries/4032586) (needs `DUNE_API_KEY`); Solana Tracker PnL V2 `/v2/pnl/leaderboard/top` (paid, `x-api-key`) |
| FOMO | 300 | **0** | Identified only. `prod-api.fomo.family` → HTTP 430 unauthorized. `api.fomoapi.io/v2/leaderboard/30d` → 401 API key required. Docs sample wallets are truncated (`7Xy9...q4Tf`) so unusable | No reachable public wallet+PnL list | Free key at https://fomoapi.io/dashboard then `GET /v2/leaderboard/30d`; drop JSON into `sources/` and extend the builder |
| Stonkfun | 100 | **0** | Public `GET https://www.stonkfun.xyz/api/public/v1/tokens` works (25 tokens/page, creators, no trader PnL). Bitquery StonkFun API is per-token volume, not a platform PnL board, and needs a key | No accessible platform-wide realized PnL ranking | Index LaunchLab ixns for the two StonkFun platform config PDAs (Bitquery/Dune) and compute buy/sell USD |
| Moby | 100 | **0** | https://docs.mobyscreener.com/ : hourly top-10 pays out; **wallet stays private**, only rank + 24h PnL public | By design not a public wallet board | None that are actually Moby users until they publish addresses |

Live Kolscan (`kolscan.io/api/leaderboard`) was Cloudflare 400/522 from this environment. Dune HTML/API was 401/403 without a key. GMGN `gmgn.ai` was Cloudflare-blocked. Birdeye public API 401.

### PumpFun collection accounting

- Raw rows: 100+100+100 PnL windows, 50+50 Mayhem, 1304 Kolscan rows (472 unique wallets), 135 GMGN launchpad_smart.
- Positive realized by source (pre-wallet-dedupe): monthly 85, weekly 70, daily 38, Mayhem 50+50, Kolscan unique positive 83, GMGN 135.
- Cross-source duplicates kept on the higher realized (then live pump > Mayhem > Kolscan > GMGN): 60.
- Dropped vs prior ChainLords lists: 8. Invalid/infra: 0. Non-positive realized skipped: 103.
- **447 unique positive-realized wallets** → all taken (under the 500 quota).

Among the 447 in the sheet: 150 official pump.fun PnL board, 85 Mayhem, 77 Kolscan, 135 GMGN launchpad_smart.

## TASK 2 — 1500 mix

Rules: all 11 `player_ronda1` with wallets (exclude `DevTest` NEED_WALLET), all 80 `nft_gamer`, then top `pump_person` (`status=in`) by `pump_ui` to fill 1500. Team prefix `4R7F` not present. Traders were already de-duplicated against `ronda2.send.ready.csv`, `airdrop-v1.wallets.csv`, and `ronda2.onchain.wallets.csv`.

Because trader quota filled 447 not 1000, holder backfill took the remaining slots.

| Bucket | Count | Role |
|---|---:|---|
| trader_pumpfun | 447 | TASK 1 PumpFun |
| trader_fomo / stonkfun / moby | 0 | shortfall |
| player_ronda1 | 11 | existing list |
| nft_gamer | 80 | existing list |
| pump_person | 962 | existing list, top `pump_ui` |
| **Total** | **1500** | |

## TASK 3 — amounts

- Default total **120,000,000 HELL** across 1500 wallets (base 80,000).
- Each amount is a unique integer in **[72034, 87999]** (~±10% of 80,000), none divisible by 1000, exact sum 120,000,000.
- Deterministic seed `hell-airdrop-2026-09-25` (SHA-256 over `seed\|wallet\|index`).
- Re-run: `python3 data/airdrop-2026-09-25/scripts/build_airdrop_sheet.py --total 50000000`

Bucket summary (`bucket_summary.csv`):

```
bucket,count,sum_amount_hell,min_amount_hell,max_amount_hell
nft_gamer,80,6402629,72125,87711
player_ronda1,11,873451,72248,87628
pump_person,962,76963872,72044,87999
trader_pumpfun,447,35760048,72034,87971
ALL,1500,120000000,72034,87999
```

Sheet columns: `bucket, source_platform, rank, wallet, pnl_usd_or_pump_ui, amount_hell, source_url, note`.

## File paths

| File | Purpose |
|---|---|
| `airdrop_1500.csv` | Main 1500-row sheet |
| `airdrop_1500.xlsx` | Same + bucket_summary + research_notes tabs |
| `bucket_summary.csv` | One line per bucket |
| `traders_collected.csv` | All 447 PumpFun traders (pre-holder mix) |
| `provenance.json` | Quotas, shortfalls, SOL price, stats |
| `scripts/build_airdrop_sheet.py` | Assembler + amount engine |
| `scripts/fetch_pumpfun_leaderboards.py` | Refresh live pump JSON |
| `sources/` | Prior CSVs + raw leaderboard JSON |

## How to refresh PumpFun only

```bash
python3 data/airdrop-2026-09-25/scripts/fetch_pumpfun_leaderboards.py
python3 data/airdrop-2026-09-25/scripts/build_airdrop_sheet.py --total 120000000
```
