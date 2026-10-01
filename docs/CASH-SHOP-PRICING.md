# Cash shop pricing — stable vs $HELL

> PO · 2026-07-17, actualizado **2026-09-29**. Config canónica: `multiplayer/server/Config/CashShop.json`.

## 0. Decisión PO 2026-09-29

- **Los precios son los de config** (`priceStableUsdCents` / `priceHell` en `CashShop.json`). No hay combo Cape+Shoes.
- **El precio del token lo pone el mercado.** El team nunca lo toca.
- Internamente, el precio en $HELL de los consumibles **se re-ajusta solo si el precio de mercado salta más de 20%** respecto del último ancla, para que queden más o menos al mismo precio en dólares.
- La venta de reputación (`ticket-reputation-100`) se mantiene.

## 1. Base de diseño

| | |
|--|--|
| Supply | **1 000 000 000** $HELL |
| Design FDV (diluted) | **~$1 000 000** |
| Precio/token de diseño (`pricing.designUsdPerHell`) | **$0.001** |
| `priceHell` en config | `usd × 1 000 × 1.2` (paridad a $0.001 + premium 20%) |

Ejemplos de config (hoy):

| SKU | USD stable | `priceHell` (a $0.001) |
|-----|-----------:|-----------------------:|
| Shoes / Boots boost (soulbound) | 49 | 0 — solo stable |
| Cape boost (soulbound) | 19 | 0 — solo stable |
| Unlearn talent / 100 Reputation | 10 | 12 000 |
| Seal (item NFT / guild bind) | 5 | 6 000 |
| Merien ×5 | 5 | 6 000 |
| Xelima ×5 | 9 | 10 800 |
| Integrity ×1 | 39 | 46 800 |

`priceHell = 0` → el SKU no acepta $HELL.

## 2. Cómo se cobra en $HELL (implementado · `HellPriceAnchor`)

```
cobro = ceil( priceHell × designUsdPerHell / anchorUsdPerHell ) × qty
```

- `anchorUsdPerHell` arranca en `designUsdPerHell` (factor 1 → se cobra exactamente `priceHell`).
- Cada **10 min** el server toma una muestra del precio de mercado:
  - `HELL_USD_PRICE` (override estático de ops), o
  - DexScreener para `HELL_MINT` (par con más liquidez USD donde $HELL es el token base; `HELL_PRICE_FEED_URL` con `{mint}` lo reemplaza; `HELL_PRICE_FEED=off` lo apaga).
- Guarda las últimas **6** muestras (≈1 h). Con al menos 3, si la **mediana** se aleja **más de 20%** del ancla, el ancla pasa a ser esa mediana (log `[HellPrice] Re-peg …`).
- Movimientos menores al 20% no cambian nada. Un pico corto no alcanza: tiene que sostenerse en la mediana.
- El ancla persiste en `Chars/hell-price-anchor.json` (sobrevive reinicios).
- Sin `HELL_MINT` ni `HELL_USD_PRICE`, el feed queda apagado y se sigue cobrando con el último ancla.

Ejemplo: si el mercado se asienta en $0.0015 (+50%), un SKU de `priceHell` 12 000 pasa a cobrar **8 000** $HELL (siguen siendo ~$12). Si cae a $0.0005 (−50%), cobra **24 000**.

**Ojo al launch:** si el token arranca muy por debajo de $0.001 (FDV chico), el primer re-peg multiplica los montos en $HELL en la misma proporción — ese es el comportamiento pedido (precio en dólares estable).

## 3. Checklist copy

- No prometer que $HELL “vale” un precio; el shop solo sigue al mercado.
- Stable = ancla USD.
- El Reward Market sigue oculto (`SHOW_TOKEN_PRICE=false`); la copy de jugador dice “rewards”, sin montos de token.
