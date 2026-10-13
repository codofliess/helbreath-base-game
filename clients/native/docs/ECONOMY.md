# Economy ports

The client does not own the economy. `IMarketPort` and `IHellPort` only return values that a rules file states, and each value has to name the file it was copied from.

## What was searched

These paths are not in this repository (not on `master`, and not in a filename search of the owner's GitHub code):

- `docs/MASTERPLAN.md`
- `middleware-node/market.js`
- `middleware-node/hell.js`
- `middleware-node/mint.js`

`clients/native/economy/unavailable.rules` records those four paths as unavailable. It contains no `rate` or `hell` lines. `CatalogMarket::quote` and `CatalogHell::parameter` therefore return nothing. A line that states a number without a source path is rejected.

The only related names found in this tree are environment variables the playtest door refuses to combine with `PLAYTEST=1`, in `multiplayer/server/Helpers/PlaytestMode.cs`: `HELL_MINT`, `MARKET_MIDDLEWARE_URL`, and `SOLANA_RPC_URL`. They are integration switches. They are not rates, fees, or thresholds, so they are not copied into the catalog as numbers.

`multiplayer/server/Config/Items.json` has item ids and types. It does not carry a market price or a mint rule, so it is not used as an economy table.

## Rules file

```
unavailable <path>
rate <pair> <numerator> <denominator> <source-path>
hell <key> <value> <source-path>
```

When `market.js` and `hell.js` exist, copy only figures that appear in those files, and point `source-path` at the file. Do not fill in a default. The core has no numeric constant for a price, a fee, a burn, or a mint threshold.
