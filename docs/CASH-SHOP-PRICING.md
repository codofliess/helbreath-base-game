# Cash shop pricing — stable vs $HELL

> PO · 2026-07-17. Config canónica: `multiplayer/server/Config/CashShop.json`.

## 1. Tu matemática (correcta)

| | |
|--|--|
| Supply | **1 000 000 000** $HELL |
| Design FDV (diluted) | **~$1 000 000** |
| Precio/token de diseño | **$1 000 000 / 1e9 = $0.001** |

Si el token cotiza a **$10M diluted** → **$0.01/token** = **10×** el design.

Los `priceHell: 40` del MVP inicial estaban **mal escalados** (valían ~$0.04 a design price, no ~$25).

## 2. Dos formas de cobrar en $HELL

### A) **Fixed HELL** (ahora en config)

- Lista: `priceHell` = cantidad fija de tokens.
- Calibrado a design **$0.001** + **premium +20%** (stable siempre más barato *en USD de referencia*).

| SKU (USD stable) | Parity HELL ($0.001) | +20% premium → **priceHell** |
|------------------|----------------------|------------------------------|
| $25 boost (shoes/boots/cape) | 25 000 | **30 000** |
| $40 combo | 40 000 | **48 000** |
| $5 seal | 5 000 | **6 000** |
| $1 Merien×5 | 1 000 | **1 200** |
| $1.20 Xelima×5 | 1 200 | **1 440** |

**Si FDV = $10M ($0.01/token)** con lista fija:

| SKU | Costo en USD al pagar HELL |
|-----|----------------------------|
| Boost 30k HELL | **$300** (10× vs $25 stable) |
| Combo 48k | **$480** |
| Seal 6k | **$60** |

Eso **es** la “big sale” automática para el treasury: quien paga en token cuando el precio subió, paga más USD-equivalente. Quien paga USDC sigue en $25.

**Riesgo:** jugadores sienten que $HELL shop es “imposible” en pump → empujás a stable (bien) o pedís sales.

### B) **Dynamic HELL** (futuro, recomendado post-launch)

```
hellAmount = ceil( (usdCents/100) / oracleUsdPerHell * (1 + premiumBps/10000) )
```

- Stable: siempre USD fijo.
- $HELL: siempre ~USD target × premium (ej. $25 × 1.2 = $30 de token al precio de mercado).
- En pump a $10M: boost cuesta **3 000 HELL** (~$30), no 30 000.
- En dump a $0.0005: boost cuesta **60 000 HELL** (~$30).

Necesita oracle (Jupiter/Pyth) + caps min/max amount anti-manipulation.

## 3. Recomendación de producto

| Fase | Política |
|------|----------|
| **Mes de test / pre-pump** | **Fixed HELL** calibrado a **$0.001 + 20%** (tabla arriba). Simple, sin oracle. |
| **Post listing / volátil** | Pasar a **dynamic** con premium 15–25%, o **sales** manuales (multiplicador 0.5× en HELL amounts). |
| **Mensaje UI** | “Stablecoin = precio fijo USD. $HELL = tokens a precio de referencia $0.001 (+20%); si el token sube, el shop en $HELL se encarece en dólares.” |

## 4. Sales en pump (opcional)

Sin oracle, si FDV ≫ $1M:

- `hellPriceMultiplier` global en config (ej. 0.3 = 70% off HELL list) para “$HELL sale weekend”.
- O bajar `priceHell` a mano en `CashShop.json`.

No mezclar con freeze marketing “token = investment” — copy = utilidad de juego.

## 5. Checklist copy

- No prometer que $HELL “siempre vale $0.001”.
- Stable = ancla USD.
- HELL rail = sink de play-mine + premium / riesgo de precio.
