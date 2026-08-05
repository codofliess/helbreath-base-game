# Crypto Loot ($AGLD) + NFT↔stable swaps — research para Chain Lord

> **Solo investigación / diseño.** Sin integración de código.  
> Producto: **Helbreath Chain Lord** (Solana-first).  
> Fecha: **2026-07-11**.  
> Cross-links: [`MASTERPLAN.md`](./MASTERPLAN.md) · [`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md) · [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md)  
> **No es consejo legal ni de inversión.**

---

## 1. Resumen ejecutivo

**Loot / $AGLD:** ideas útiles (composable loot bags, CC0-style openness, community currency → gas/governance, “build on the bag”). El stack vivo hoy es **Ethereum + Adventure Layer (L2 EVM)**, no Solana. **Integrar su token/chain/marca nos enreda** (dependency, brand, dead-ecosystem risk). **DIY inspirado** sí; **integrar AGLD/Lootverse** no.

**Sudoswap:** referencia clara de **AMM NFT + bonding curves** (ETH/L2). Protocolo a **copiar conceptualmente**, no a portar.

**Swaps in-game (MVP Solana):**  
1. **Primero DIY** — escrow / listing propio (o Metaplex-compatible transfer) + **USDC/SOL** vía wallet + **Jupiter solo para SPL↔SPL** (no es AMM de NFTs).  
2. **Opcional fase 2** — Tensor o Magic Eden API para liquidez secundaria externa (ToS + fees + key gating).  
3. **Evitar** Hyperspace (shut down), Auction House Metaplex (deprecated), Coral Cube (absorbido / legacy), Sphere (pagos fiat/stable, no NFT AMM).

| Tema | ¿Nos sirve? | Veredicto |
|------|-------------|-----------|
| Ideas Loot (bags, composability, CC0 ethos) | **Sí (inspiración)** | DIY |
| $AGLD / Adventure Layer / Lootverse games | **No** | No integrar |
| Marca “Loot” / bags OG | **No** | IP/brand risk |
| Mecánica sudoswap (curves, pools) | **Sí (inspiración)** | DIY más adelante |
| Tensor / Magic Eden APIs | **Parcial** | Fase 2, no MVP crítico |
| Hadeswap (Solana NFT AMM) | **Parcial / frágil** | Evaluar liquidez real; no dependencia core |
| Jupiter | **Sí (SPL)** | Token leg; no NFT↔USDC nativo |
| Escrow propio + USDC | **Sí** | **MVP recomendado** |

---

## 2. AGLD / Loot — qué son y status 2025–2026

### 2.1 Origen

- **Loot (for Adventurers):** 8 000 NFTs de texto on-chain (agosto 2021, Dom Hofmann). Gear listado sin stats/arte; comunidad interpreta y construye. Ethos: *“Feel free to use Loot in any way you want.”* Sitio: [lootproject.com](https://www.lootproject.com/).
- **$AGLD (Adventure Gold):** airdrop comunitario (Will Papper, sep 2021) — ~10 000 AGLD por bag OG. ERC-20 en **Ethereum**. No fue fundraising clásico del creador de Loot.
- Ecosistema (“Lootverse”): mLoot, Synthetic Loot, Realms, Crypts & Caverns, Characters, etc. — muchos forks/derivados comunitarios.

### 2.2 Tokenomics / utilidad (hoy)

| Pieza | Rol |
|-------|-----|
| Supply | Cap ~96 M; airdrop histórico ~80 M; resto emisiones DAO |
| Circulante ~2026 | ~87–93 M (fuentes de mercado; verificar on-chain) |
| Utilidad | Gobernanza AGLD DAO; **gas en Adventure Layer**; medium de intercambio en juegos FOCG del ecosistema |
| Vínculo bags | **Ya no mecánico:** tener Loot no da AGLD nuevo |

Fuentes: [LeveX AGLD guide (2026)](https://levex.com/en/blog/agld-guide), [Gate blog AGLD 2026](https://www.gate.com/blog/how-agld-governance-drives-token-value-and-loot-ecosystem-expansion), [CMC AGLD overview](https://coinmarketcap.com/cmc-ai/adventure-gold/what-is/).

### 2.3 Adventure Layer (ex “Loot Chain”)

- L2 **EVM** (OP Stack / Caldera), AGLD como gas, DA vía Polygon (según docs/manifiesto).
- Enfoque: **fully onchain games (FOCG)** / autonomous worlds — no Solana.
- Rebrand de Loot Chain → Adventure Layer = alcance más amplio que solo Lootverse.
- Manifiesto: [paragraph.com/@aglddao/the-adventure-layer-manifesto](https://paragraph.com/@aglddao/the-adventure-layer-manifesto).

**Honest status 2025–2026:** el proyecto **no está muerto** — DAO, L2, listings en CEX, precio ~rango bajo vs ATH 2021. Sí es **nicho EVM/FOCG**, volumen de juegos “consumer” cuestionable, y **orthogonal** a Chain Lord (Solana + cNFT Bubblegum + MMORPG client propio).

### 2.4 Qué hicieron bien (ideas reutilizables sin stack)

| Idea | Aplicación a Chain Lord |
|------|-------------------------|
| Loot como **dato mínimo + interpretación** | Nuestros drops ya tienen stats reales; la lección es **composable ownership** (NFT = claim on item), no texto vacío |
| **CC0 / “build freely”** | Nosotros: **inspired-by** + arte propio ([`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md)) — no copiar bags/marca Loot |
| Community currency → utilidad real | Nuestro gov token futuro: utilidad clara (premios, fees) **sin** atar a ecosistema ajeno |
| Bags / inventory on-chain | Nuestro `drop_ledger` + Bubblegum ya cubre “loot on chain”; no hace falta bags Loot |
| Royalties / secondary | En Solana royalties son **opcionales/enforceables según marketplace**; diseñar fee de unbind + treasury propios ([`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md)) |
| Open protocols vs closed game economy | Preferir **programas propios + Metaplex estándar** a “join Lootverse” |

### 2.5 Riesgos si “integramos” Loot/AGLD

| Riesgo | Detalle |
|--------|---------|
| Chain mismatch | ETH/L2 vs Solana-first → bridges, UX, custody, ops |
| Dependency / dead project | Si Adventure Layer no escala, AGLD utility se hunde; nosotros heredaríamos narrativa |
| Brand / IP | “Loot”, bags OG, Lootverse = marca/comunidad ajena; CC0 del texto ≠ permiso para confundir producto |
| Token securities | Atar economía del juego a AGLD de terceros = compliance + ToS ajenos |
| Product distraction | FOCG tick-based ≠ nuestro modelo (server authoritative C# + claim mint) |

### 2.6 Recomendación AGLD/Loot

| Opción | Veredicto |
|--------|-----------|
| Integrar AGLD / Adventure Layer / Loot bags | **NO NOS SIRVE** |
| Partner marketing “Lootverse compatible” | **NO** (brand) |
| Copiar ideas de composability / fee design / community currency **en nuestro stack Solana** | **SÍ — DIY** |
| Leer whitepapers/manifiestos como inspiración FOCG | OK lectura; no roadmap |

**Conclusión:** *inspired by / copy protocol ideas and build ourselves* — **no** integrate their stack.

---

## 3. Sudoswap (referencia ETH) — cómo funciona

Docs: [docs.sudoswap.xyz](https://docs.sudoswap.xyz/).

- **AMM de NFTs:** pools `NFT ↔ ETH/ERC20` en lugar de solo order book.
- LP deposita NFTs y/o tokens; elige tipo de pool (buy / sell / trade) + **spotPrice** + **delta** + curva.
- Curvas: **linear**, **exponential**, **XYK** (producto constante de reservas virtuales).
- Cada trade mueve el precio según la curva (más compras → más caro; más ventas → más barato).
- Trade pools pueden cobrar **spread/fee** al LP; protocol fee configurable.
- **Floor fungibility:** el pool no discrimina por token ID dentro de la colección (mismo precio de “floor”).

**Para Chain Lord:** útil como **modelo mental** para liquidez de sets fungibles (p.ej. muchas piezas Rare intercambiables) o floor of Hero pieces. **No** portar contratos ETH. En Solana el análogo histórico es Hadeswap / Coral Cube AMM / MMM de Magic Eden — ver tabla § 4.

---

## 4. Comparativa: engines / APIs de swap NFT (Solana + referencia)

Criterios: API estabilidad, Solana-native, NFT↔SOL/USDC, embebible / server-mediated, fees, riesgo de dependencia.

| Engine | Chain | Modelo | NFT↔SOL | NFT↔USDC | API / embed | Fees (típico) | Estabilidad 2026 | ¿Nos sirve? |
|--------|-------|--------|---------|----------|-------------|-----------------|------------------|-------------|
| **Sudoswap** | ETH / L2 | AMM + curves | ETH/ERC20 | vía ERC20 | On-chain | Protocol + LP | Vivo en EVM | **Inspiración only** |
| **DIY escrow + listing** | Solana | Order book / escrow propio | Sí | Sí (SPL) | Nuestro middleware | Nuestros | Control total | **MVP — SÍ** |
| **Jupiter** | Solana | DEX aggregator **SPL** | N/A (tokens) | SOL↔USDC etc. | [station.jup.ag](https://station.jup.ag/docs/apis) | Route + gas | Alta | **SÍ (leg token)** |
| **Tensor** | Solana | Marketplace + Tensorswap pools + bids | Sí (primario) | Listings multi-currency / post-swap | [dev.tensor.trade](https://dev.tensor.trade/docs/getting-started-1) / [docs API](https://docs.tensor.trade/trade/api-and-sdk); API key; SDKs públicos | Marketplace % + royalties | Líder liquidez; API **alpha**/breaking | **Fase 2 — parcial** |
| **Magic Eden** | Solana (+ multi) | Marketplace + MMM AMM pools | Sí | Limitado / vía SOL | [docs.magiceden.io](https://docs.magiceden.io/); instr. + Bearer key | Marketplace % | Maduro; ToS API | **Fase 2 — parcial** |
| **Hadeswap** | Solana | NFT AMM + bonding curves (sudoswap-like) | Sí | No nativo | Docs/SDK; liquidez variable | 0% protocol (governance puede cambiar) | Vivo pero **nicho**; audits/claim historial mezclado | **Evaluar; no core** |
| **Coral Cube AMM** | Solana | AMM pools; hist. agregado a ME | Sí | — | Legacy | LP fees | Absorbed / legacy post-ME | **NO** |
| **Hyperspace** | — | Marketplace | — | — | API sunset | — | **Shut down ~2024-09** | **NO** |
| **Metaplex Auction House** | Solana | Escrowless listings | Sí | SPL possible | Legacy docs | Marketplace | **Deprecated** | **NO (nuevo build)** |
| **Sphere** | Solana | **Payments** / stables / on-ramp | No NFT AMM | Fiat↔stable | Payments API | Merchant | Vivo (pagos) | **Solo payouts fiat later** |
| **NFT→any token pattern** | Solana | Tensor sell → Jupiter swap | → SOL → USDC | Composición | Server or client compose | 2× fees | Patrón conocido ([Superteam idea](https://build.superteam.fun/ideas/liquidating-an-nft-to-any-token)) | **Fase 2 opcional** |

### Notas cortas por opción

- **Tensor:** deepest Solana NFT liquidity; REST alpha; SDKs on-chain sin key para algunas paths; **ToS + API access form**; no asumir USDC-native para todos los listings.
- **Magic Eden:** instruction builders (list/buy/MMM fulfill); bueno para exposición secundaria; dependencia de su API y fees.
- **Hadeswap:** el “sudoswap de Solana” en concepto; liquidez por colección suele ser débil vs Tensor order book — mal como única vía de exit para jugadores.
- **Jupiter:** indispensable para **SOL↔USDC↔gov token**; **no** reemplaza marketplace NFT.
- **Hyperspace / Auction House / Coral Cube:** lecciones de **dead dependency** — no construir MVP encima.

---

## 5. Recomendación MVP Chain Lord

### 5.1 Fase MVP (economía jugable sin marketplace externo)

1. **Unbind fee → treasury** en **USDC (SPL)** o SOL (config) — ya alineado a [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md).
2. **Escrow / listing DIY** (server-mediated):
   - Seller firma list; item/cNFT en escrow program o estado `listed` + hold.
   - Buyer paga USDC/SOL; atomic transfer item ↔ payment.
   - Fee % a treasury; ledger en Postgres (`drop_ledger` / tablas marketplace TBD).
3. **Jupiter** solo para: jugador convierte SOL↔USDC, o premio gov↔USDC — **fuera** del path NFT crítico o como helper UX.
4. **No** integrar AGLD, Adventure Layer, sudoswap contracts, Hyperspace, Auction House nuevo.

### 5.2 Fase 2 (liquidez externa)

- Botón “List on Tensor / ME” vía sus APIs (tx serializada → wallet firma) **opcional**.
- O pipeline “Instant sell”: floor bid Tensor → SOL → Jupiter → USDC (composited), con UI de slippage y fees transparentes.
- Evaluar **pool AMM propio** (sudoswap-like) solo si hay volumen de piezas **casi fungibles** (muchas rares iguales); Hero Set único = order book > curve.

### 5.3 Qué no hacer en MVP

- Custodiar fondos de jugadores en hot wallet sin multisig/runbook.
- Depender de un solo marketplace API para claim/rebind.
- Mezclar apuestas de espectadores (ya eliminado) con swaps.
- Prometer yield / LP returns sobre items del juego sin counsel ([`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md) § Crypto / securities).

---

## 6. Riesgos (custody, ToS, legal)

| Riesgo | Mitigación |
|--------|------------|
| **Custody** | Preferir escrow program / escrowless hasta match; multisig treasury; reconcile ledger vs mint (Fase F) |
| **ToS marketplaces** | Tensor/ME API: rate limits, key revocation, prohibitions on wrapping their UI; leer [ME API ToS](https://docs.magiceden.io/) y Tensor developer terms antes de ship |
| **Dead dependency** | Hyperspace = caso de estudio; core path = DIY |
| **Royalties / creator fees** | cNFT Bubblegum + política propia; no asumir enforcement universal en Solana |
| **Gambling adjacency** | Swaps de items ≠ betting; no pools de espectadores — [`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md) § Tournaments |
| **Securities** | Gov token / fee share guild: framing rewards/utility; counsel antes de marketing — checklist § Crypto |
| **Wash trading / unbind farm** | Cooldowns, fee floors, detección — ver HERO-SET doc |
| **cNFT specifics** | Tensor TCOMP / ME compressed paths ≠ legacy NFT; probar claim→list con Bubblegum real |

---

## 7. Pointer MASTERPLAN (economía)

- Visión economía in-game + unbind: [`MASTERPLAN.md`](./MASTERPLAN.md) § 1 (pilares Unbind + mercado), § 1.4 guild fees, **Fase F**.
- Detalle unbind: [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md).
- Este doc = **research satélite** para “¿integrar Loot/sudoswap/Tensor o DIY?” → respuesta: **DIY + Jupiter SPL; Tensor/ME opcional después**.

---

## 8. Fuentes (URLs)

### Loot / AGLD
- https://www.lootproject.com/
- https://levex.com/en/blog/agld-guide
- https://levex.com/en/blog/adventure-layer-explained
- https://paragraph.com/@aglddao/the-adventure-layer-manifesto
- https://www.gate.com/blog/how-agld-governance-drives-token-value-and-loot-ecosystem-expansion
- https://coinmarketcap.com/cmc-ai/adventure-gold/what-is/
- https://www.coinbase.com/blog/loot-project-the-first-community-owned-nft-gaming-platform
- https://a16zcrypto.com/posts/article/cc0-nft-creative-commons-zero-license-rights/

### Sudoswap
- https://docs.sudoswap.xyz/
- https://docs.sudoswap.xyz/reference/pricing/
- https://docs.sudoswap.xyz/reference/pair-creation/

### Solana NFT / swaps
- https://docs.tensor.trade/trade/api-and-sdk
- https://dev.tensor.trade/docs/getting-started-1
- https://docs.magiceden.io/
- https://docs.hadeswap.com/providing-liquidity-how-does-it-work/liquidity-pools-and-bonding-curves
- https://www.hadeswap.com/
- https://station.jup.ag/docs/apis
- https://build.superteam.fun/ideas/liquidating-an-nft-to-any-token
- https://www.metaplex.com/docs/legacy-documentation/auction-house
- https://blockworks.co/news/lightspeed-newsletter-hyperspace-nft-shutter
- https://crypto.news/hyperspace-shuts-down-nft-marketplace-on-solana/
- https://coralcube.gitbook.io/coral-cube
- https://spherepay.co/

---

## 9. Changelog

| Fecha | Cambio |
|-------|--------|
| **2026-07-11** | Creación: research AGLD/Loot + sudoswap + Solana swap engines; veredicto DIY MVP + Jupiter SPL; Tensor/ME fase 2; no integrar Loot/AGLD. |

---

*Fin del doc. Actualizar si Tensor/ME cambian ToS o si se decide AMM in-house post-volumen.*
