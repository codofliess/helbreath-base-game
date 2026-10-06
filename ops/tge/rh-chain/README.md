# HELBREATH — Robinhood Chain token

> **DEPRECATED (PO 2026-09-29).** `$HELL` (Solana) is the only Chain Lords token; it launches 2026-09-30 in the afternoon. The RH / Pons `HELBREATH` path in this file is kept as a record only: do not deploy, promote, or post it. See `docs/ADR-001-MULTICHAIN-AUTH.md` (2026-09-29 amendment).

Foundry project. **Do not pass `--broadcast` / `--private-key` from CI or this repo.**

```bash
cd ops/tge/rh-chain
forge test
# deploy (your machine, funded RH wallet):
# forge create src/HelbreathRH.sol:HelbreathRH --constructor-args $TREASURY \
#   --rpc-url $RH_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

See [`../CREATE-RH-CHECKLIST.md`](../CREATE-RH-CHECKLIST.md).
