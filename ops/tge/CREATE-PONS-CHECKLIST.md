# PATH PONS — launch HELBREATH like RH gainers

Pons (active factory `0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB`) is how volume tokens launch on Robinhood Chain: **one tx** deploys the ERC-20, seeds a **locked Uniswap V3 / WETH** pool (1B supply, 1% fee), locks metadata on-chain. Terminals (Pons UI, DexScreener, GMGN) read `logo()` + `socials()` from the token.

**This repo does not send the create tx.** Martín signs on [ponsfamily.com](https://ponsfamily.com) with a RH wallet. Metadata below is locked at create — typo = new token.

Pack: [`pons-create-pack.json`](./pons-create-pack.json)

---

## Paste these fields (do not improvise)

| Field | Value |
|-------|--------|
| Name | `Chain Lords Helbreath` |
| Symbol | `HELBREATH` |
| **Logo / image** | `https://www.chainlords.net/branding/abaddon-icon/discord-server-icon.png` |
| Logo fallback (if UI wants upload) | upload `branding/hell-token/pons-abaddon-avatar-1024.png` (Abaddon face, 1024 PNG) |
| Description | `HELBREATH — Chain Lords. Play: https://play.chainlords.net · Hell is what you leave still. Utility for the browser MMO (shops, sinks, play-mine credits). Not an investment product. Not a Robinhood brokerage listing.` |
| Website | `https://www.chainlords.net` |
| Twitter / X | `https://x.com/ChainLordsHQ` |
| Discord | `https://discord.gg/F4NwwbfKtj` |
| Telegram | *(empty)* |
| Farcaster | *(empty)* |
| Play (in description, Pons has one website slot) | `https://play.chainlords.net` |
| Creator fee wallet | Martín RH EOA (same as signer unless you set Squads-equivalent) |
| Creator tax | **5%** (500 bps) if the UI offers it — swap-side, not a honeypot |
| Developer / first buy | **$50 in ETH** as extra value on the launch tx (Pons: ETH above `0.0005` launch fee = creator buy on block 0) |

Logo URL already returns `image/png` (Abaddon). That is the Solana / landing avatar. Terminals that scrape `logo()` will show this face.

---

## What Pons actually does (honest)

- Supply **1B** all into the locked pool. **No 60% treasury bag.** That is the gainer setup.
- Fees: **1% pool** → creator **70%** / protocol **30%** (current factory). Plus optional creator tax.
- First **2 blocks**: only creator initial buy on launch block; then 5% max wallet.
- Graduation = **4.2 ETH** paired. Same pool after. No Meteora leftover story.
- **NOT listed on Robinhood** the app.

---

## After Martín signs

1. Save `TokenLaunched` tx + token address (Pons tokens often end in `bbbb`).
2. Verify on token: `logo()`, `socials()`, `name()`, `symbol()`.
3. Check Pons page + DexScreener `robinhood` show Abaddon + X/Discord/site.
4. Only then paste the address into listing/landing. Do not invent one.

`node ops/tge/print-pons-fields.cjs` dumps the paste block.
