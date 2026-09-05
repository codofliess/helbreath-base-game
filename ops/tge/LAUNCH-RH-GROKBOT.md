# PATH RH — grokbot kill-switches

**Read before any RH deploy, listing, or landing edit.**  
`assert-create-rh.cjs` fails if these NEVER lines are dropped from the plan.

**No contract address in this PR. No `--execute`. No keys.**

---

## NEVER

1. **NEVER leftover=0** Solana remint as a substitute for this path
2. **NEVER leftover landed in A782 at create** — A782 is a Solana vault. RH treasury is an **EVM** address you set.
3. **NEVER publish LIVE** without Blockscout verification + RPC `totalSupply` / `balanceOf(treasury)`
4. **NEVER reuse A8fNV2 or 4Sk2** as the RH token
5. **NEVER remint ticker HELL** on Solana for this path — ticker is **HELBREATH** on RH
6. **NEVER ExactOut**
7. **NEVER invent airdrop**
8. **NEVER write $50 buy = 50% of supply**
9. **NEVER write listed on Robinhood** (brokerage). This is **Robinhood Chain** only.
10. **NEVER honeypot** (no blacklist, no can’t-sell, tax cap 10%)

## MUST

11. **MUST** mint 1B to treasury, then seed only 400M
12. **MUST** keep 600M in treasury at seed (this is the day-0 guarantee)
13. **MUST** tax 500 bps default, max 1000, to treasury
14. **MUST** `setDexPair` after the pool exists
15. **MUST** run `assert-create-rh.cjs` PASS (without `--execute`)

---

## $50 first seconds

Martín swaps **fifty US dollars** of ETH (or quote) into HELBREATH when the pair is live.  
That is **not** leftover, **not** 50% supply, **not** a bot we ship. Manual wallet.
