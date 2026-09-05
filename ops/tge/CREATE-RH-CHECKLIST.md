# PATH RH — Robinhood Chain launch (HELBREATH)

Grokbot gate: [`LAUNCH-RH-GROKBOT.md`](./LAUNCH-RH-GROKBOT.md).  
**This PR does not deploy.** No private keys. No `--execute`.

Ticker **HELBREATH** · name **Chain Lords Helbreath** · chain **Robinhood Chain** (EVM L2, chainId **4663**).  
**NOT listed on Robinhood** the brokerage. RH Chain ≠ RH app listing.

Solana `$HELL` Path B mint `4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq` stays on www until an RH contract is **verified on Blockscout** and RPC-checked. Do not invent an address.

MASTERPLAN **C12** (no Token-2022 transfer tax) is **Solana-only**. This path is ERC-20 tax on RH, disclosed.

---

## What we can actually guarantee (day 0)

The contract **mints 1B to `treasury`**. Then treasury **sends 400M into the Uniswap pair** and **keeps 600M**. That 600M is in a wallet you control **at seed**, not leftover-in-a-Meteora-vault.

| Bucket | Amount | Where at seed |
|--------|--------|----------------|
| Treasury / farm / team / ops | **600M (60%)** | `treasury` EOA or Squads-equivalent on RH |
| Uniswap seed | **400M (40%)** | V3 pool vs WETH (or USDC if you switch quote) |
| Martín first buy | **$50** | Manual swap in the first seconds after the pair is live. **Not 50% of supply. Not an allocation.** |

Transfer **tax 5%** (500 bps, hard cap 10%) on non-excluded transfers → `treasury`. Pair + treasury + owner are tax-excluded so LP and fee collection work.

---

## Fees “para nosotros”

| Fee | Who gets it | Notes |
|-----|-------------|--------|
| ERC-20 transfer tax **5%** | `treasury` | On wallet↔wallet (and any non-excluded hop). Disclose on every form. |
| Uniswap pool fee (V3 tier you pick, often 1% / 0.3%) | LPs | Protocol fee is Uniswap’s, not ours. |
| Owner `setTaxBps` | — | Cannot exceed **10%**. No honeypot, no sell-block, no blacklist. |

---

## Network

| | Mainnet | Testnet |
|--|---------|---------|
| Chain ID | 4663 | 46630 |
| RPC | https://rpc.mainnet.chain.robinhood.com | https://rpc.testnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com | https://explorer.testnet.chain.robinhood.com |
| Gas | ETH | ETH |
| Uniswap V3 factory | `0x1f7d7550B1b028F7571E69A784071F0205FD2EfA` | none published — test mechanics on anvil / mainnet fork |

Reconfirm factory on Blockscout before sending 400M.

---

## GO (human, after testnet)

1. Treasury = Martín RH EOA (write it into `create-rh.plan.json`). **Not** Solana `A782…` (wrong curve).
2. `node ops/tge/assert-create-rh.cjs` **PASS**
3. `forge test` in `ops/tge/rh-chain`
4. Deploy **testnet** first (`forge create` / script). Verify Blockscout.
5. Mainnet deploy: 1B lands in treasury. Screenshot RPC `balanceOf(treasury) == 1B`.
6. Approve NPM + seed **400M + ETH** (size of ETH is Martín’s call; $50 is the **first buy**, not the LP).
7. `setDexPair(pool)` so the pair is tax-excluded.
8. Martín buys **$50** in the first seconds. That is a tick on the chart.
9. Only then paste the **verified** address into listing/landing.

**Refuse:** leftover=0 remint on Solana · “600M already in A782” · “listed on Robinhood” · “$50 = 50% supply” · fake LIVE mint · ExactOut · invent airdrop.
