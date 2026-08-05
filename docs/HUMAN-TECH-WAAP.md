# human.tech / WaaP — evaluación para Chain Lord

> Research notes (2026-07-11). **Solo documentación** — sin integración de código.  
> Producto evaluado: [WaaP](https://waap.human.tech/) + suite [human.tech](https://human.tech/) (incl. [Human Passport](https://passport.human.tech/)).  
> Contexto: Helbreath **Chain Lord** = Solana-first, login por wallet (Phantom/Backpack / SIWS), NFTs cNFT, torneos, guilds/legacy airdrop.

---

## 1. Qué es (y qué no es)

### 1.1 Confusión de nombre — separar dos productos

| Producto | URL | Qué vende | ¿Es PoH / anti-sybil? |
|----------|-----|-----------|----------------------|
| **WaaP** (Wallet as a Protocol) | [waap.human.tech](https://waap.human.tech/) · docs [docs.waap.human.tech](https://docs.waap.human.tech/) / [docs.wallet.human.tech](https://docs.wallet.human.tech/quick-start) | Wallet **embebida**: login email/phone/social, keys 2PC-MPC, gas tank, policies, “universal account” | **No** (identidad nativa zk es plugin/feature adyacente; el core es custody/onboarding) |
| **Human Passport** (ex Gitcoin Passport) | [passport.human.tech](https://passport.human.tech/) · docs [docs.passport.xyz](https://docs.passport.xyz/) | Suite de **Sybil resistance** / proof-of-personhood: Stamps, score, Models ML, zk KYC-lite | **Sí** — este es el producto relevante para airdrops/bots |
| **human.tech** (umbrella) | [human.tech](https://human.tech/) | Framework: Passport + Wallet (WaaP) + Privacy; Holonym Foundation; DPI gubernamental (Barbados/Guyana, Trident) | Ambos |

**Honestidad marketing:** [waap.human.tech](https://waap.human.tech/) es denso en claims (“extreme security”, “free”, “minutes to integrate”, comparación agresiva vs Privy/MetaMask). La arquitectura 2PC-MPC e Ika está documentada en blogs/prensa, pero **Solana no aparece como chain live en docs/SDK** (ver § 2.3). Parte del copy de prensa ([The Block PR, 2025-10-22](https://www.theblock.co/press-releases/375698/ika-and-human-tech-reveal-wallet-as-a-protocol-waap-first-zero-trust-decentralized-wallet-infra)) dice que WaaP “can support Bitcoin, Solana”; el FAQ de [human.tech](https://human.tech/) y los quick-starts **no listan Solana** entre integraciones actuales.

### 1.2 Propósito de WaaP (resumen)

- Sustituir **Wallet-as-a-Service** (Privy, etc.): cuentas “alquiladas” por app, fees por wallet, custody semi-centralizada.
- Ofrecer **Wallet-as-a-Protocol**: una cuenta universal, portable entre dApps, sin SaaS mensual / per-wallet fee según su narrativa.
- Onboarding Web2: email, phone, Google/Twitter/Discord, Face ID; sin seed phrase.
- Seguridad: key split (share usuario + share red/TEE → migración a [Ika 2PC-MPC](https://human.tech/blog/our-wallet-as-a-protocol-is-now-secured-by-ika-s-2pc-mpc)); simulation / anti blind-signing; policies (límites de gasto, MFA).

### 1.3 Propósito de Human Passport (resumen)

- Hereda Gitcoin Passport: Stamps (credenciales) → **Unique Humanity Score**.
- Productos: Stamps API, Embed React, **Models** (clasificar EVM address como humano/sybil sin Passport), Individual Verifications (gov ID / phone / biometrics / Clean Hands vía ZK), Data Services (clustering batch).
- Caso de uso explícito en marketing: airdrops, faucets, QF, governance, **gaming rewards**, comunidades.

---

## 2. Tech, chains, APIs, costo, madurez

### 2.1 Tech stack (WaaP)

| Pieza | Detalle (fuentes públicas) |
|-------|----------------------------|
| Keys | Human Keys / Human Network (vOPRF sobre atributos de login; claim ~2.5M keys en blog Passport) |
| Signing | 2PC-MPC; share de seguridad vía enclave y/o red Ika (Sui); rollout anunciado Q4 2025 |
| Provider | EIP-1193 (`window.waap`) para EVM; Sui Wallet Standard vía `initWaaPSui` |
| SDK | npm [`@human.tech/waap-sdk`](https://www.npmjs.com/package/@human.tech/waap-sdk) |
| Examples | [holonym-foundation/waap-examples](https://github.com/holonym-foundation/waap-examples) (Next.js + wagmi/ethers) |
| Audits (claim) | Cure53, Hexens, Least Authority, Halborn (citados en docs WaaP) |

### 2.2 Tech stack (Passport)

| Pieza | Detalle |
|-------|---------|
| Stamps | Agregado de señales KYC / biometrics / web3 / web2 / web-of-trust → score |
| Models API | ML sobre actividad on-chain **ETH L1 + L2s** — sin exigir que el user tenga Passport |
| Individual Verifications | ZK proofs; attestations on-chain vía Sign Protocol (Optimism/Base) o SBTs (Stellar) |
| Embed | React widget; partners free (según [passport embed](https://passport.human.tech/embed)) |

### 2.3 Chains soportadas (crítico para Chain Lord)

| Fuente | Chains citadas |
|--------|----------------|
| [waap.human.tech](https://waap.human.tech/) marketing table | **EVM, Stellar, soon SUI** |
| [docs.waap.human.tech](https://docs.waap.human.tech/) / quick-start | **EVM + Sui** (`initWaaP` / `initWaaPSui`) |
| [human.tech FAQ](https://human.tech/) | Ethereum, Base, Linea, Arbitrum, Optimism, zkSync, Scroll, Shape, Ika, **Sui, Stellar, Aztec** |
| The Block PR | Dice genéricamente “can support Bitcoin, Solana” |

**Conclusión Solana:** no hay quick-start, método SDK ni lista FAQ que trate Solana como integración **live**. Tratar “Solana support” de prensa como **aspiracional / no verificable** hasta que docs + SDK lo demuestren. Chain Lord es **Solana-first** → WaaP **no encaja** como wallet primaria hoy.

Passport Models / Stamps son **EVM-centric**. Un jugador con solo pubkey Solana no es el happy path; haría falta wallet EVM vinculada, bridge de identidad, o Data Services custom.

### 2.4 APIs / SDKs

| Superficie | Uso |
|------------|-----|
| `@human.tech/waap-sdk` | Embedded wallet EVM/Sui |
| Passport Stamps API | Score por address (API key + scorer id) — [docs.passport.xyz](https://docs.passport.xyz/) |
| Passport Models API | Score sybil/human sin Stamps UX |
| Passport Embed | UI in-flow |
| Individual Verifications API | KYC-lite ZK |
| Data Services | Batch / partner engagment (pricing no público en landing) |

### 2.5 Costo (claims públicos — verificar en portal)

| Producto | Costo declarado |
|----------|-----------------|
| WaaP | **$0** integración / SaaS / per-wallet; revenue vía actividad de txs + economía Human Network ([blog WaaP vs WaaS](https://passport.human.tech/blog/wallet-as-a-protocol-not-a-service)). Comparan WaaS típico a ~3–8¢/wallet/mes. |
| Passport Stamps / Embed (core) | **Free** para partners (docs + embed page) |
| Stamps premium (gov ID / biometric human.tech) | ~**$5**/stamp (costos de proveedores externos; citado en FAQ Embed vía search/support) |
| On-chain mint de score | ~**$3** + gas (mismo FAQ Embed) |
| Data Services / enterprise | Contact sales — no public price sheet claro |

**Caveat:** “free” WaaP puede implicar atribución de revenue de txs al onboarder y dependencia de la economía del protocolo; no es “cero costo operacional” (integración, soporte UX, compliance, downtime de red MPC).

### 2.6 Madurez

| Señal | Lectura |
|-------|---------|
| Passport: 2M+ passports, $512M+ airdrops “secured”, partners Guild/Galxe/Snapshot | Maduro en **EVM sybil** (legado Gitcoin) |
| WaaP: npm SDK, examples, audits nombrados, Ika partnership 2025 | Producto **real pero joven** como “protocol”; messaging aún muy marketing |
| DPI / Trident Barbados | Madurez institucional en **identity gov**, no en Solana gaming |
| Solana gaming integrations | **No evidenciadas** en docs públicas revisadas |

---

## 3. Beneficios potenciales para Chain Lord

Mapa honesto: **casi todo el valor anti-sybil viene de Passport, no de WaaP.**

| Necesidad Chain Lord | ¿WaaP ayuda? | ¿Passport ayuda? | Notas |
|----------------------|--------------|------------------|-------|
| Login wallet Solana (ya SIWS / Phantom) | **No** — sustituiría stack; chains wrong | N/A | Ya tenemos auth en server/middleware |
| Onboarding casual sin wallet | Sí (email/social) **si** hubiera Solana | No | Conflicto con Solana-first + players HB que ya tienen wallet |
| Sybil resistance airdrops / legacy guild rewards | No | **Sí** (score / Models / Data Services) | Mejor fit Fase H; hoy EVM-centric |
| Bots en torneos / multi-account Elo farm | Débil (wallet UX ≠ bot detection in-game) | Parcial (1-human gate al registrarse) | No reemplaza anti-cheat server, disconnect rules, rate limits |
| Unique humans en brackets / prize eligibility | No | **Sí** (threshold score ≥20 típico Gitcoin) | Fricción UX alta para LATAM casual |
| KYC-lite / Clean Hands para premios grandes | zk-ID plugin WaaP (vago) | **Sí** — Individual Verifications | Solo si counsel pide compliance; no MVP |
| Gas sponsorship / embedded mint UX | Gas tank (EVM/Sui) | No | Mint cNFT Solana ya es path propio |
| Guild claim anti-impostor | No | Parcial + Data Services | Complementa Discord/vouch/wallet ya diseñados en [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md) |

---

## 4. Riesgos

| Riesgo | Severidad para MVP | Detalle |
|--------|--------------------|---------|
| **Solana gap** | Alta | SDK/docs = EVM+Sui. Integrar WaaP como login = pelear la decisión “Solana primero”. |
| **Producto equivocado** | Alta | Si el objetivo era PoH, WaaP no es el producto; Passport sí. |
| **Dependencia / entanglement** | Media | MPC network, Human Network, attribution economics, branding “secured by human.tech”. DIY SIWS + Phantom es más simple y alineado. |
| **Privacy / IDENTITY** | Media–Alta | Stamps/zk ID / phone / biometrics = datos sensibles aunque sea “privacy-preserving”. ToS + privacy policy + menores ([`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md)). No es consejo legal. |
| **UX friction** | Media | Pedir Passport score ≥20 o mint on-chain ($3) ahuyenta jugadores HB casual / multi-wallet. |
| **Falso sentido de seguridad** | Media | Score humano ≠ no-cheat en PvP; bots pueden usar cuentas “humanas” farmed. |
| **Legal / KYC** | Media | Individual Verifications rozan KYC; custody de premios + torneos ya en checklist legal. |
| **Marketing opacity** | Baja–Media | Claims “free forever”, “minutes”, “support Solana” sin docs → validar antes de roadmap binding. |
| **DIY vs vendor** | — | Anti-sybil DIY: Discord link, vouch, caps, review humano, cooldown (ya en diseño guilds). Passport acelera scoring EVM; no elimina proceso humano legacy. |

---

## 5. Recomendación

### Veredicto MVP: **SKIP WaaP · WATCH Passport (sybil)**

| Decisión | Condición |
|----------|-----------|
| **SKIP** integrar **WaaP** como wallet / login | Mientras Chain Lord sea Solana-first y Phantom/Backpack + SIWS cubran auth. Reabrir solo si (a) docs oficiales + SDK Solana GA, **y** (b) queremos embedded social-login *además* de wallets nativas. |
| **WATCH** **Human Passport** | Para Fase H legacy airdrop / faucets / reward campaigns cuando haya presupuesto de sybil. Spike técnico: ¿se puede scorear vía Models con address EVM vinculada a pubkey Solana, o Data Services custom? |
| **No bloquear** torneos Elo / equal-footing MVP | Gate “unique human” es opcional post-MVP; anti-abuse = rate limits, disconnect rules, server loadout (§ 10 MASTERPLAN). |
| **KYC-lite** | Solo si counsel/premios custodial lo exigen; entonces evaluar Individual Verifications **o** proveedor Solana-native — no asumir Passport. |

### Condiciones para pasar de WATCH → integrate (Passport)

1. Spike ≤2 días: API key + score de una lista de wallets de prueba (idealmente mapeo Solana↔EVM o batch Data Services).
2. Umbral y UX definidos (ej. score ≥20 solo para claim de airdrop, **no** para entrar al mundo).
3. Privacy notice + opt-in; menores fuera o flujo parental.
4. Fallback DIY si API cae (allowlist manual / vouch).

### Condiciones para reconsiderar WaaP

1. Página oficial de chains + `initWaaPSolana` (o equivalente) en docs.
2. Demo mint cNFT / SIWS-compatible con Human Wallet en Solana.
3. Decisión de producto de admitir login email-first *sin* romper inventario/NFT atados a pubkey Solana.

---

## 6. Fuentes

- [https://waap.human.tech/](https://waap.human.tech/)
- [https://docs.waap.human.tech/](https://docs.waap.human.tech/)
- [https://docs.wallet.human.tech/quick-start](https://docs.wallet.human.tech/quick-start)
- [https://human.tech/](https://human.tech/)
- [https://passport.human.tech/](https://passport.human.tech/)
- [https://docs.passport.xyz/](https://docs.passport.xyz/)
- [https://passport.human.tech/blog/wallet-as-a-protocol-not-a-service](https://passport.human.tech/blog/wallet-as-a-protocol-not-a-service)
- [https://human.tech/blog/our-wallet-as-a-protocol-is-now-secured-by-ika-s-2pc-mpc](https://human.tech/blog/our-wallet-as-a-protocol-is-now-secured-by-ika-s-2pc-mpc)
- [The Block PR — Ika + WaaP](https://www.theblock.co/press-releases/375698/ika-and-human-tech-reveal-wallet-as-a-protocol-waap-first-zero-trust-decentralized-wallet-infra)
- [npm @human.tech/waap-sdk](https://www.npmjs.com/package/@human.tech/waap-sdk)
- [GitHub holonym-foundation/waap-examples](https://github.com/holonym-foundation/waap-examples)

---

*Fin. Sin código. Revisar si human.tech publica Solana GA o un Passport scorer Solana-native.*
