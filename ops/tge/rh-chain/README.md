# HELBREATH — Robinhood Chain token

Foundry project. **Do not pass `--broadcast` / `--private-key` from CI or this repo.**

```bash
cd ops/tge/rh-chain
forge test
# deploy (your machine, funded RH wallet):
# forge create src/HelbreathRH.sol:HelbreathRH --constructor-args $TREASURY \
#   --rpc-url $RH_RPC_URL --private-key $PRIVATE_KEY --broadcast
```

See [`../CREATE-RH-CHECKLIST.md`](../CREATE-RH-CHECKLIST.md).
