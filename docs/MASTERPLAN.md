# Helbreath Chain Lord → Solana — MASTERPLAN (borrador v0.9)

> Documento vivo, **canónico** (changelog denso + roadmap), accionable, en español.  
> Sesión legible: [`BITACORA.md`](./BITACORA.md).  
> Versión: **borrador v0.9** (completo para críticas; no es la versión final de producto).  
> Última actualización de contenido: **2026-08-05**.  
> Producto: **Helbreath Chain Lord** (marca corta: **Chain Lords** / Chain Lord).  
> Repo: `C:\Users\54116\helbreath-base-game`  
> Reglas: § Decisiones y § Evaluaciones son **append-only**. Coordinación de modelos: [`FRAMEWORK-MULTIMODELO.md`](./FRAMEWORK-MULTIMODELO.md).

---

## Índice

0. [Prólogo Legal / IP](#0-prólogo-legal--ip) — marca, copyright, checklist inspired-by  
1. [Visión del producto](#1-visión-del-producto) — pilares, estados, fuera de alcance (§ 1.4 guild econ · § 1.6 gov staking · § 1.7 tokenomics · [§ 1.8 hero set](#18-hero-set--look-pixel-premium--futuro--no-bloquea-test) · [§ 1.9 AFK/capacidad](#19-capacidad-del-server-afk-vs-activo--mecanismos-early-2026-07-18) · [§ 1.10 progression CL + PL](#110-progression-chain-lords-rebirth-l79-block-level--promise-land--pl-dungeons-2026-07-25) · [§ 1.11 feel dens War](#111-combat-feel-vs-helbreath-war--capas-abc--2026-07-30))  
2. [Arquitectura (paths reales)](#2-arquitectura-paths-reales)  
3. [Changelog — julio 2026](#3-changelog--julio-2026)  
4. [Roadmap unificado (fases A–H)](#4-roadmap-unificado-fases-ah)  
5. [Decisiones (append-only)](#5-decisiones-append-only)  
6. [Evaluaciones externas (APPEND-ONLY)](#6-evaluaciones-externas-append-only)  
7. [Guía de rollback](#7-guía-de-rollback)  
8. [Cómo trabajar con este doc](#8-cómo-trabajar-con-este-doc)  
9. [Referencias rápidas](#9-referencias-rápidas-en-repo)  
10. [Cola de críticas para Fable 5](#10-cola-de-críticas-para-fable-5)

### Docs satélite

| Doc | Rol |
|-----|-----|
| [`LEGAL-IP-RESEARCH.md`](./LEGAL-IP-RESEARCH.md) | Notas de investigación IP Helbreath (no es consejo legal) |
| [`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md) | Checklist operativa: IP, ToS, privacy, crypto, torneos, menores |
| [`FRAMEWORK-MULTIMODELO.md`](./FRAMEWORK-MULTIMODELO.md) | Fable diseña → baratos ejecutan → Fable review; tags `[fable]` / `[cheap]` |
| [`TOURNAMENT-BUILD-CREDITS.md`](./TOURNAMENT-BUILD-CREDITS.md) | Build Draft: brackets 90/160 + point-buy + duelos guest |
| [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md) | Unbind de pago + venta Hero Set + rebind al holder NFT |
| [`refs/hero-set-premium/`](./refs/hero-set-premium/) | Refs visuales Ares/Elv hero set **pixel premium** (futuro; no mes de test) |
| [`EK-LEDGER.md`](./EK-LEDGER.md) | Enemy Kills: elegibilidad ±10, mult top 10/50, ledger público, aura |
| [`EK-SCREENSHOT-GALLERY.md`](./EK-SCREENSHOT-GALLERY.md) | Auto-screenshot estilo Olympia + rareza galería (top 10/50/200 ciudad opuesta) · MVP captura |
| [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md) | Poder GM + legacy airdrop + visión economía de guild (fees/egreso/partner) |
| [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) | PoH en claim + guild-priority ingress + filosofía AFK vs flota + **MVP toggles GM** |
| [`TIMED-CHALLENGES.md`](./TIMED-CHALLENGES.md) | Mode 1 Skills + Mode 2/3 Learning waves; Mode 4 Ettin endurance; Mode 10–13 Challenge scaffold |
| [`PVP-ACADEMY.md`](./PVP-ACADEMY.md) | Learning Guards + Challenge Easy→Elite (hero-set GM NPCs / AI tiers) |
| [`TRAINING-ARENA.md`](./TRAINING-ARENA.md) | Mapa de práctica: dummies War/Mage, presets, tip protocols |
| [`BEGINNER-PATH-1-80.md`](./BEGINNER-PATH-1-80.md) | Path opcional 1→80 + barracks farm (dummy/merc) + tip sheets |
| [`REFERENCE-HELBREATH-ARGENTINA.md`](./REFERENCE-HELBREATH-ARGENTINA.md) | Notas IG HB Argentina (UI/eventos/branding → hub Chain Lord) |
| [`HUMAN-TECH-WAAP.md`](./HUMAN-TECH-WAAP.md) | WaaP / human.tech / Passport: wallet embed vs sybil — **SKIP WaaP MVP · WATCH Passport** |
| [`CRYPTO-LOOT-AND-NFT-SWAPS.md`](./CRYPTO-LOOT-AND-NFT-SWAPS.md) | Research AGLD/Loot + NFT↔stable swaps — **DIY Solana**; no integrar Lootverse |
| Canvas gov staking (Cursor) | `helbreath-gov-staking-rep.canvas.tsx` — stake → R → luck/drop + descuentos soulbound (§ 1.7 cerrado); **TBD reconcile** caps combate vs estudio 1.6 |
| Canvas tokenomics legal-econ | `helbreath-hell-tokenomics-legal-econ.canvas.tsx` — stress-test + callout decisiones cerradas stake/mine/mercado |
| Canvas DEX liq + RH/Base | `helbreath-dex-liquidity-robinhood-base.canvas.tsx` — launch pump ~20% + Phase-2 Meteora earmark + fees + **C13** cash-out/black-swan; Base #1 constelación |
| [`SPAWN-PIT-PARITY.md`](./SPAWN-PIT-PARITY.md) | Pits/respawn/HP vs MAPDATA+NPC.cfg + RMG dungeons/HZ |
| [`MONSTER-DROP-PARITY.md`](./MONSTER-DROP-PARITY.md) | Loot tables vs Olympia gen + CritCandy 970 |
| [`OLYMPIA-ITEM-MAGIC-AFFIXES.md`](./OLYMPIA-ITEM-MAGIC-AFFIXES.md) | Primary/secondary/color; quality flat base dmg (Sharp/Ancient); rares pure |
| [`OLYMPIA-ANGELS.md`](./OLYMPIA-ANGELS.md) | Tutelary Angels: 5 maj claim at Gail, equip + upgrade to +15 |
| [`OLYMPIA-PVP-FEEL-GAP.md`](./OLYMPIA-PVP-FEEL-GAP.md) | PvP feel A/B audit: DamageMove 50/80 vs AttackType; brief Tola videos |
| [`refs/HELBREATH-WAR-LIVE-NOTES.md`](./refs/HELBREATH-WAR-LIVE-NOTES.md) | Live Helbreath War (Ditizar): dens PvP, tipografía quest, Cancel/Para, feel notes |
| [`SPELL-CC-AUDIT.md`](./SPELL-CC-AUDIT.md) | Auditoría Paralyze/Hold/Chill + combat/utility spells |
| [`OLYMPIA-PARITY-GAP.md`](./OLYMPIA-PARITY-GAP.md) | **Backlog prod** gaps vs Olympia/HB clásico (olas P0–P4); anti-speedhack **excluido** (diseño propio) |
| [`BITACORA.md`](./BITACORA.md) | Log legible por sesión (companion de este Changelog) |
| [`landing/README.md`](../landing/README.md) | Landing **chainlords.net** (World/Arena grises, Play wallet, EK side, Arena Sunday + `arena-1v1`/`arena-3v3`) |
| [`ARENA-CPP-CLIENT-FORK.md`](./ARENA-CPP-CLIENT-FORK.md) | **Option B:** client C++ arena-only (motor Olympia + wire .NET/proto); web = world; scaffold `clients/arena-cpp/` |
| [`ARENA-PRIZE-ESCROW-PHASE0.md`](./ARENA-PRIZE-ESCROW-PHASE0.md) | Bolsa PvP: whitelist, caps, DC 120m, team wipe, GS SoT |
| [`ARENA-PRIZE-ESCROW-PHASE1.md`](./ARENA-PRIZE-ESCROW-PHASE1.md) | Server prize bag + dc_grace + proto 104–106 |
| [`NFT-OPS-RUNBOOK.md`](./NFT-OPS-RUNBOOK.md) | Ops parcial mint/claim: backups, env, recover, lease, métricas (no audit `[fable]`) |

---

## 0. Prólogo Legal / IP

> **No es consejo legal.** Resumen operativo; detalle y fuentes en [`LEGAL-IP-RESEARCH.md`](./LEGAL-IP-RESEARCH.md) y checklist en [`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md). Verificar con abogado de PI antes de lanzamiento comercial / NFT.

1. **Marca preferida:** comercializar como **Chain Lord / Chain Lords** (u otra marca limpia). Evitar uso comercial de **“Helbreath”** (logo, splash, claims “oficial”) hasta que counsel lo despeje. El nombre interno del repo no es licencia.
2. **No confiar en “quiebra = clone gratis”:** el copyright de código/arte suele **sobrevivir** a la quiebra o al cierre (pasa a acreedores/compradores). Un trademark abandonado **≠** dominio público de sprites, mapas o client. Marca caducada tampoco autoriza copiar assets.
3. **Checklist “inspired-by”** (para no tirar trabajo): arte/UI propios o licenciados; renombrar ciudades (Aresden/Elvine), ítems signature (Devastator, etc.) y logos; no shippear leaks C++ Siementech; Olympia ≠ dueño del IP original — solo lo que ellos crearon de cero. Mecánicas de alto nivel (guerra de ciudades, isometric PvP) ≠ permiso para clonar expresión.
4. **Hallazgos de research (2026-07-11):** Siementech (KR, ~1999); cadena de título posterior **incierta**; prensa KR 2023 aún describe servicio oficial; USPTO search “Helbreath” → **0** live/dead en esa consulta; **sin** patentes de juego halladas; “IJH dueño” = **rumor no verificado**.
5. **Programas de partner / revenue-share con guilds:** si se materializa (ver § 1.4), redactarlo como **programa de rewards / partner program** sujeto a counsel — **no** como promesa de retorno de inversión ni oferta de valores. Detalle TBD con abogado.

---

## 1. Visión del producto

**Objetivo:** un **Chain Lord** (working title histórico: Helbreath Chain Lord) jugable en navegador, lo más cercano posible a la referencia clásica de city-war isometric MMORPG (mapas, monstruos, items, curva exp/rebirth) **sin asumir** derecho a clonar IP de terceros, con capa **Solana** para drops importantes como NFTs, y un producto paralelo de **torneos PvP equal-footing** + economía on-chain.

**Trayectoria de chains:** Chain Lord jugable → **Solana first** (wallets Phantom/Backpack, cNFT Bubblegum) → más adelante **Base / multi-chain** (solo cuando Solana esté estable). Constelación de seasons: shortlist **Base → Arbitrum → Ronin**; **Robinhood Chain** (L2 EVM mainnet 2026-07-01, RWA/Stock Tokens) = **watchlist TradFi**, no P1 gaming — ver canvas `helbreath-dex-liquidity-robinhood-base` + companions multichain.

### 1.1 Pilares con estado

Leyenda de estado: **Hecho** · **En curso** · **Diseño** · **Pendiente** · **Eliminado**

| Pilar | Qué significa | Estado |
|-------|----------------|--------|
| **Chain Lord base** | Items, drops, monstruos, mapas, seteo exp/rebirth lo más literal posible a la referencia clásica; luego iterar. | **En curso** — catálogos y progression en repo; polish/balance pendiente |
| **Solana NFTs (Rare vs Legendary)** | Solo piezas ~**USD 30+**. Mint **centralizado** (authority mint + airdrop): user pide → server cobra fee **~USD 0.20–0.50** (o equiv. $HELL) → mint cNFT → airdrop. Sin mint auto mid-loot. Tiers `rare` / `super_rare`. | **Pipeline hecho**; **política mint 2026-07-18** (flujo+fee; sintonía fina config); cobro claim **TBD código**; review `[fable]` pendiente |
| **Kill milestones** | No están en Helbreath clásico: **50 000 Frost** → elegir ZWand MS20 / Stormbringer; **5 000 Unicorn** → item Kloness; **max rebirth (RB20)** → elegir entre super-rares. Config: `Progression.json`. | **Hecho** (server + proto + UI parcial) |
| **Curva exp + rebirth Chain Lords** | Curva Olympia `iGetLevelExp` + GetExp boost ≤L80 + `0.8^RB` hasta L140. **Divergencia CL:** rebirth → **level 79** (no L1). **Block Level** → exp a majestic. Caps mapa: PL ≤**110**, PL Dungeons ≤**120**. | **Parcial** — curva live; L79 rebirth + Block Level + spawns PL = **diseño 2026-07-25** § **1.10** |
| **Torneos equal-footing** | Mundo `colosseum` (`tournamentArena`); server aplica hero set + bag; stash del char real. Ideal para jugadores de otros servers. | **Hecho** (MVP código: loadout, stash, rated kills, middleware CRUD, UI dialog) |
| **Sunday Arena inscription** | Landing 1v1 / 3v3: wallet sign-in, field + preclasificados Elo, preview bracket **tennis-style**, premios USDT (montos TBD). | **En curso** — `arena-1v1.html` / `arena-3v3.html` + `GET/POST /arena/week`; lock draw + prize pool real **TBD** |
| **Leaderboard Elo + decay + HoF** | Ranking solo/team estilo ATP/boxeo; inactividad → decay; hall of fame por torneo. | **En curso** — Elo + decay lazy + **job periódico** (persist) + tablas; payout/anti-cheat aparte |
| **Build Draft (brackets + créditos)** | Tier 90 / 160 + point-buy; modo **adicional** al equal-footing. Credits para kit maxed Sunday sin roster estable. | **Diseño** (+ copy live en landing Arena) — [`TOURNAMENT-BUILD-CREDITS.md`](./TOURNAMENT-BUILD-CREDITS.md); Fase C.2 |
| **Duelos espontáneos guest** | Wallet sin char persistente → char efímero de match → discard. | **Diseño** (junto a Build Draft) |
| **Unbind + mercado Hero Set** | Fee de unbind → listable → venta ligada a NFT → rebind al holder. | **Diseño** — [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md); Fase F |
| **Hero Set look pixel premium** | Sprites de gear más nítidos (estilo private-server) sin redibujar el mundo. | **Futuro** — refs en [`refs/hero-set-premium/`](./refs/hero-set-premium/); § **1.8**; **no** bloquea mes de test |
| **Spectator** | Ver torneos sin estar en la PC. **NO** Discord como CDN. MVP: OBS → Twitch/YouTube embed en landing. Discord = social / notifs guildmates. | **Diseño** — Fase E |
| **App móvil spectator** | PWA / nativa con deep links + push “torneo en vivo”. | **Pendiente** (fase tardía, post validar audiencia) |
| **Apuestas de espectadores** | Bookmaker / pools de terceros. | **Eliminado** (2026-07-09) — no reabrir sin decisión explícita |
| **Escrow desafíos con pozo** | Stake entre participantes (no espectadores); pozo custodial. | **Diseño** — Tier 3 / post-MVP, **después** de premios custodial estables (Fase D) |
| **Premios** | Gov token + USDC / SOL / sponsors; ledger `tournament_prizes` + payout. | **En curso** (schema + API prizes); **Pendiente** payout on-chain seguro |
| **EKs (Enemy Kills)** | Ledger público de EKs; elegibilidad nivel ±10 / superior; mult ×3 top10 / ×2 top11–50; aura roja (portar). Distinto del Elo torneo. Galería landing: rareza top 10/50/200 ciudad enemiga + rankings Legendary/Rare/total. | **Diseño + shell landing** — [`EK-LEDGER.md`](./EK-LEDGER.md) / [`EK-SCREENSHOT-GALLERY.md`](./EK-SCREENSHOT-GALLERY.md); ladder ciudad real **TBD**; Fase G |
| **Guilds + Legacy Airdrop** | Poder real a Guild Masters (tax, ACTIVE TRAINER/KILLER, voz en global); reconocimiento a guilds históricas (HB Arg, Alkon, LMDL, Olympia, Cursed, INT, Korea, …) con verificación Discord/evidencia/wallet. Economía de guild (visión): share de fees → consumibles al GM, bonus de egreso, partner program TBD. | **Diseño** — [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md); Fase H; § 1.4 |
| **Training Arena** | Mapa de práctica (Lory/freeze/kite): dummies War/Mage, presets, tip protocols estáticos. Sin Elo ni loadout de torneo. | **Fase 2 (spawn+chase)** — [`TRAINING-ARENA.md`](./TRAINING-ARENA.md); ApplyPreset + MonsterChase |
| **Beginner Path 1→80** | Quests opcionales guiadas (farm → barracks → stubs mid/end); abandonar sin pena; flags en `state_json`. | **Diseño + scaffold** — [`BEGINNER-PATH-1-80.md`](./BEGINNER-PATH-1-80.md); tiers 1–20 live + stubs |
| **Farm Barracks** | En `arefarm`/`elvfarm`: Dummy (estático) + Merc War/Mage (chase + XP); tip Chill→Para→PFA/DS (deny PFM); mage Chill+EB. | **En curso** — dwell + tips PFA/DS + merc kit Chill/EB; pits Olympia aparte (`SPAWN-PIT-PARITY.md`) |
| **Capacidad / AFK (early)** | Liberar CCU/RAM al inicio: kick por zona, auction offline, idle ligero, **AFK largo solo con mucho $HELL staked**. | **Diseño 2026-07-18** — § **1.9**; toggles AFK ya en `AntiBotTools` |
| **Arena live desk + $HELL incentives** | Landing select-char desk (Phaser) + BI strip (React); AFK BI **2h→5k** $HELL; duel **10k** / stream **20k**; anti-AFK **off** en BI; announce X+Discord. | **En curso / shipped core 2026-08-05** — `ArenaIncentives`, `ArenaSelectCharDesk`, social-bot hooks; caps ledger UTC |
| **Arena kit catalog (free vs credits)** | Free path-filtered war/mage loadout (HP/MP sets free; no plain cape); credits = DR/MR + MCon capes; hero mage sprites Cap/Robe/Hauberk; STR gates Blood Rapier 39 / Merien 40; sanitize unknown SKUs. | **En curso** — `ArenaLoadout` + `ArenaKitCatalog` + kit builder; polish sprites/path OK |
| **Arena spell economy** | Cast full **~1200 ms** (Magic 100% o Mag≥50) / slow **~1800**; mana `Magic.cfg`; **Inhib/Cancel/Sleep** credit-only en arena (45/46/52). Mass Blizzard gate **TBD**. | **Parcial shipped 2026-08-05** — `PlayerDerivedStats`, `MagicManaCatalog`, credit gates |

### 1.2 Fuera de alcance (explícito)

- Apuestas de espectadores / bookmaker UI.
- Compatibilidad wire con el server C++ legacy de Helbreath.
- Multi-chain (Base, etc.) en la primera ola — **Solana primero**.
- Hardcodear fees de unbind, costos finales de Build Draft, montos de prize pool, o cantidades de airdrop/mimos legacy en código (viven en config/JSON).
- Usar Discord Go Live / screen-share como origen de video del portal.

### 1.3 Narrativa de producto (una frase por capa)

1. **Jugá** Helbreath Chain Lord en browser con wallet Solana.  
2. **Progresá** con curva familiar + milestones garantizados.  
3. **Cobrás** drops raros/legendarios como cNFT.  
4. **Competí** en colosseum equal-footing (y más adelante Build Draft / duelos guest).  
5. **Subí** el leaderboard (Elo + decay) y entrás al hall of fame.  
5b. **Cazá** EKs open-world (ledger público + ladder; distinto del Elo de arena) — Fase G.  
5c. **Liderá** guilds con poderes de GM y, si sos legacy verificado, recibí mimos históricos — Fase H.  
6. **Mirás** streams desde la landing (y más tarde el móvil).  
7. **Mové economía** con unbind/mercado Hero Set, premios (**$HELL** + stables/sponsors), **staking $HELL** (utilidad in-game + descuentos soulbound — § 1.6 / § 1.7; topes combate **TBD reconcile**), **play-mine** como **única** vía de emisión por jugar, y a largo plazo incentivos de guild (§ 1.4).

### 1.4 Economía de guilds (visión — tejer en diseño económico)

> Notas de producto para **más adelante** (no implementación). Alinear con Fase H + [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md). **Cautela legal:** ver § 0.5 — no vender esto como “inversión” / security.

| Palanca | Intent | Forma de reward | Notas de diseño |
|---------|--------|-----------------|-----------------|
| **Share de fees al GM** | El GM de cada guild recibe un **% de los fees generados por su propia guild** | **No cash** — **consumibles** (packs de potions, repair kits, scrolls, etc.) | % y catálogo en config; fee sources = tax/unbind/marketplace/etc. TBD; anti-farm de alts |
| **Bonus de egreso (“graduación”)** | Extra cuando un jugador está **maxed** y **egresa** de la guild | Consumibles / soft rewards (TBD) | Incentiva **entrenar y soltar** en vez de solo hoardear roster; definir “maxed” (RB20 / level cap) |
| **Partner de largo plazo** | Guilds establecidas = **socios minoritarios** del negocio del server | Dividends / revenue-share ($$$$) — **programa TBD con counsel** | Criterios: antigüedad, online estable, no drama/exploit; **no** equity pública ni promesa de retorno |

**Meta estratégica:** un server activo con **1000+ online** es máquina de ingresos; los dividends a guilds grandes deben hacer **más atractivo construir guild fuerte a largo plazo** que “hacer plata” con un server privado / “fruta”. Competir por líderes serios, no por shady ops.

**Capacidad / anti-sybil (idea 2026-07-12):** guildes “establecidas” también pueden ser señal de **prioridad de ingreso** cerca del cap — ver [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) (no shipped; no confundir con partner payout).

**Open (economía):** % share, qué fees cuentan, definición de egreso elegible, umbral “guild establecida”, custody del partner payout — cola Fable § 10.

### 1.5 Auth / sybil / vendors externos (puntero)

- **Auth MVP:** wallet Solana (SIWS) — Phantom/Backpack; no reemplazar por embedded WaaS/WaaP.
- **Sybil / airdrops / legacy guild rewards:** diseño DIY (Discord + vouch + caps) en [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md); vendor opcional a **WATCH** = Human Passport (ex Gitcoin), **no** WaaP.
- **Research 2026-07-11:** [`HUMAN-TECH-WAAP.md`](./HUMAN-TECH-WAAP.md) — WaaP = wallet protocol (EVM/Sui hoy); Passport = PoH/sybil (EVM-centric). Veredicto: **SKIP WaaP para MVP · WATCH Passport** para Fase H / campañas.
- **Idea 2026-07-12 (capacidad / Helvet farming):** PoH / Passport en **claim**, no en login; cerca de cap (~3–4k) → **prioridad de ingreso** a miembros de guildes probadas; cuentas nuevas → segmento aparte (cola / overflow / traveler limitado / claim delayed — menú en doc). Ver [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md).
- **Filosofía AFK 2026-07-12:** AFK en mapa, ayuda de guild y caza enemiga de AFKs = OK / deseable; progression liviana de adults reales = OK; enemigo = flota AI / multi-box industrial + sybil Helvet — **no** banear “parado en town” como regla primaria. Detalle: [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) § 0.
- **Capacidad early 2026-07-18 (complementa, no borra § 0):** AFK **no** cuesta igual que PvP en CPU, pero **sí igual en CCU/RAM**. Early prod: liberar cupos con kick por zona + auction + (diseño) **AFK extendido solo con gran stake $HELL**. Ver § **1.9**.
- **MVP toggles 2026-07-12:** 8 herramientas ON/OFF + panel GM `:8080` (SysMenu → Anti-Bot / Ops); persist `AntiBotTools.json`; traveler no ve panel. Enforcement parcial (multi-box cap, AFK kick si OFF, telemetry torneo, soft XP drip); resto stub log.

### 1.6 Gov staking → reputación (visión — framework only)

> **2026-07-12 · diseño.** Sin implementación server/client. Detalle visual: canvas Cursor `helbreath-gov-staking-rep`; bitácora del mismo día; enlace en estrategia multi-chain § 7.  
> **Supersesión parcial (2026-07-13 · banda combate):** el PO fija **$HELL** como ticker y banda de stake en § **1.7** (drop **1%–20%**, luck **máx. 20**). La fila de topes de abajo (**luck ≤+5% / drop ≤+8%**) queda como **estudio previo** — **no borrada**; **TBD reconcile** con § 1.7 antes de implementar.  
> **Alineación cerrada (2026-07-13 · PO + craneo):** stake **no** emite $HELL; **no** hay yield/dividendo/fee-share a stakers. Beneficios = potencia char/guild (§ 1.6–1.7) **+** descuentos soulbound (detalle canónico en § **1.7**). Overflow “rent / fee rebates” del estudio 2026-07-12 queda **superseded** → ver fila Overflow.

| Capa | Intent | Tope / regla |
|------|--------|----------------|
| **Stake → R** | Gob token ($HELL) staked sube **reputación wallet** (score 0–100, curva cóncava) | Soft gains tempranos; **hard cap R=100** (ej. ~25 000 u stake; “u” TBD vs supply § 1.7) |
| **Chars** | Hasta **4 characters** bound a la wallet **comparten el mismo R** | No stackear R por char; 1 wallet = 1 reputación |
| **Bonos grind (estudio 2026-07-12)** | Luck, drop general (± XP opcional) escalan con R | En R=100: luck **≤+5%**, drop general **≤+8%**, rare/leg **≤+3% rel. o 0 legendary** — *supersedido tentativamente por § 1.7* |
| **Bonos grind (PO 2026-07-13 · tentativo)** | Ver § 1.7 STAKE | Drop **1%–20%**; Drop + luck (**máx. 20 luck**); Guildmaster = stake guild + collective stake |
| **Descuentos stake (cerrado · ver § 1.7)** | Consumibles elegibles (ej. piedras) a precio con descuento fuerte | Escala por stake; **tope máx./día**; compras = **soulbound** (no flip) |
| **Prohibido combate** | Daño, HP, hit, CC, Elo / Colosseum | **0** — torneos equal-footing *(estudio 1.6; reconfirmar vs banda 1–20%)* |
| **Prohibido económico (cerrado)** | Yield en tokens; fee-share a stakers; “stake = dinero” | Ver freeze § 1.7 — **no** emular dividendos vía stake |
| **Overflow** | Stake &gt; cap gameplay | Peso **gobernanza** + WL/utilidades — **nunca** más drop/luck. ~~Rent / fee rebates a stakers~~ = **superseded 2026-07-13** (conflicto con freeze “no yield / no fee-share”) |
| **Unstake** | Cooldown **7–14d** (default 14); R decae lineal al residual | Anti wash-stake / vote rent |

**Riesgos clave:** P2W combate (mitigado por topes + lista negra — **recalibrar** si se adopta drop hasta +20% / luck 20); sybil multi-wallet (1 R/wallet + PoH en rewards altos); framing securities si el copy vuelve a soar a “rent/APY” (counsel, § 0.5) — mitigado por freeze cerrado § 1.7.

**Open:** **TBD reconcile** caps combate § 1.6 vs § 1.7 (**no orphan** este estudio); calibrar “u” vs supply 1B $HELL; sim Monte Carlo; spec contrato staking; catálogo exacto de consumibles con descuento + fórmula stake→%→cap diario; alinear overflow gov/WL con guild partner (§ 1.4) e ingress antibot. Cola Fable § 10.

### 1.7 Tokenomics ($HELL) — tentativo / no implementado

> **2026-07-13 · PO · tentativo** (números supply/alloc/mining). **Decisiones de diseño cerradas** (adquisición / stake / descuentos / mercado / freeze / **launch·LP·fees DEX C8–C12** / **cash-out personal·treasury + black-swan C13** / **wallets·Squads C14**) = bloques **Decisiones cerradas** abajo — **no** tentativas. Donde el protocolo (pump.fun / PumpSwap) fija el fee schedule, la política del team es **tentativa / acotada** a lo controlable (recipient de creator fee). **Sin código** de token, staking, mining ni DEX. Alinear con § 1.6 / canvas `helbreath-gov-staking-rep` vía **TBD reconcile** solo en **caps de combate** (no silenciar el estudio prior). Counsel: § 0 / [`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md) antes de comunicar supply/allocations públicamente.

#### Mapa rápido — economía / capital ops / próximo slice

> Puntero de navegación (no duplica tablas). Todo lo denso sigue abajo en esta § 1.7 + § 1.4 / § 1.6. Canvases: `helbreath-gov-staking-rep`, `helbreath-hell-tokenomics-legal-econ`, `helbreath-dex-liquidity-robinhood-base`.

| Bloque | Qué | Dónde | Estado |
|--------|-----|-------|--------|
| **Supply / allocations** | 1B $HELL; team 100M · liq/market 300M · DAO/guilds 100M · growth 100M · play-mine 400M | [Supply](#supply-y-precio-de-referencia) · [Allocations](#allocations-suman-1-000-000-000) | Tentativo (schedule DAO open) |
| **Launch / LP / capital ops** | pump ~20% → PumpSwap; Meteora Phase-2 earmark; LP almost-never; fees; offramp C13; Squads treasury C14 | **C8–C14** + [Política launch/LP](#política-de-lanzamiento--liquidez--fees-dex-c8c13--2026-07-13) | **Cerrado** (path/política); montos C13 / delta 300M / Squads members **open** |
| **Stake / utility (no yield)** | Utilidad char/guild + descuentos soulbound; **no** emisión ni fee-share a stakers | **C1–C5** · [STAKE](#stake-hell-modelo-cerrado--números-combate-tentativos) · § **1.6** (caps combate TBD reconcile) | Modelo **cerrado**; caps combate **tentativo** |
| **Revenue de juego** | Embudo Cape/Shoes + piedras; ~5% P2P; recycle ~50%; shops $HELL/stables | [Usuarios/revenue](#usuarios--revenue-esperados-framing-optimista--po) · [Embudo](#embudo-de-gasto-consumibles-po--tentativo--2026-07-13) · postura #6–#7 | Framing tentativo; **shops premium TBD**; gold shops + **Olympia sell** + qty wheel **viven** |
| **Guild economy (visión)** | Fee share → consumibles; egreso; partner TBD | § **1.4** · [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md) | Diseño; **guild upgrade fee table = no built** |
| **Mercado in-game (código)** | Auction board MVP (C6); F6 Item Drops layout **60% lista / 40% detalle** + sell Olympia formula; shop buy **qty wheel** | § 3 changelog · F6 Inventory · `OlympiaSellPrice` | **Auction** mock gold; **Item Drops** sell gold OK; on-chain $HELL / recycle shards **TBD** |
| **Próximo slice de build** | 1) Auction on-chain / phishing allowlist (C6) → 2) **NPC shop catalogs** ampliados (stables/$HELL) → 3) **Guild upgrade** fee table + create/join real (Fase H) | Roadmap abajo; checklist § 3 | Auction MVP gold **shipped**; shops premium / guild upgrade still TBD |
| **Mes de test (launch)** | **Prioridad 2026-07-17:** subir test ~1 mes; jugadores + niveles + **créditos airdrop**; soulbound Cape/Shoes **USD 25** / combo **40** (persisten post-test); **sin** pump day-0; hero art premium **después** | [§ 1.7.4](#174-checklist--mes-de-test-público--cerrado--2026-07-14) · [§ 1.8](#18-hero-set--look-pixel-premium--futuro--no-bloquea-test) | Play-mine ledger + SysMenu; cash shop soulbound **TBD build**; refs hero en `docs/refs/hero-set-premium/` |

#### Decisiones cerradas — $HELL stake / mine / descuentos / mercado (2026-07-13 · PO + craneo)

> **Cerrado = fuente de verdad de producto** hasta que una Decisión § 5 nueva las reemplace. Lo demás en § 1.7 (supply, banda drop 1–20%, créditos mining, % fees exactos de recycle) sigue **tentativo** donde se marque.

| # | Decisión | Estado |
|---|----------|--------|
| **C1** | **Adquisición de $HELL:** solo del pool **play-mine / unlock-by-playing** (bucket mined + créditos diarios). **Stake no emite ni “paga” $HELL.** | **Cerrado** |
| **C2** | **Beneficios de stake:** (a) potencia in-game ya descrita en § 1.6–1.7 (char / guild / Guildmaster / drop·luck — caps combate **TBD reconcile**); **más** (b) **descuentos fuertes** en ciertos consumibles (ej. piedras), **tope máximo por día**, escalados por monto stakeado. | **Cerrado** (catálogo/%/fórmula = **tentativo / open**) |
| **C3** | **Compras con descuento de stake = soulbound.** Piedras u otros mats descontados **no** se tradean ni flippián; el descuento no es un cash-out. | **Cerrado** |
| **C4** | **Mercado espontáneo (no shilleado por el team):** un jugador **puede** usar mats soulbound descontados para upgradear gear **+0 → maxxed** y vender el **ítem maxxed** (ese resultado **no** es soulbound). Precio libre (gold / ítems / NFT / $HELL / USDT) wallet-a-wallet o vía auction. El team **no** promueve esto como “cash-out del stake” ni como negocio de crafting oficial. | **Cerrado** (existencia permitida; marketing **prohibido**) |
| **C5** | **Freeze explícito:** yield de stake en tokens; revenue-share de fees a stakers; DEX floor del team para cash-out de stakers; marketing “stake = dinero”; promover OTC USDT flip de goods descontados. | **Cerrado** |
| **C6** | **Postura mercado / auction:** preferir **non-custodial**; balances en engines **bajos**; avisar no acumular $$$ en la app de auction; fondos en **wallets de jugadores**; allowlist/tooling para contratos genuinos vs skins de phishing (**intent / TBD implement**). Acoplar a fees § postura (#6–#7). | **Cerrado** (implementación = open) |
| **C7** | **Recycle de fees:** ~**50%** exchange fees → torneos / marketing / hire; si fee revenue es fuerte, el team **puede** burn team tokens — coherente con postura #5/#7. **No** repartir fees a stakers. | **Cerrado** (policy sketch; % exacto / on-chain split = open) |

#### Decisiones cerradas — launch / liquidez / fees DEX (2026-07-13 · PO)

> Acoplar a C5 (no DEX floor / cash-out) y a freeze no-shill. **Base** sigue **#1** seat de constelación (EVM); **pump.fun** = path de **lanzamiento Solana** (awareness + bonding), no “seat” multi-chain. Detalle: canvas `helbreath-dex-liquidity-robinhood-base`.

| # | Decisión | Estado |
|---|----------|--------|
| **C8** | **Path de launch inicial:** ~**20% del supply (200M $HELL)** vía **pump.fun** (awareness + bonding → graduación **PumpSwap**). | **Cerrado** (path). **Open / delta:** bucket docs **Liquidity / market = 300M (30%)** no se overwritea; el 20% pump es el seed path — **resto del bucket 300M o re-split = TBD** si hace falta. |
| **C9** | **Reserva partnerships → pools secundarios (opcional):** del bucket **Growth & partnerships (100M / ~10% supply)** se **earmarkea** capital para **Phase-2 LP opcional** en **Meteora** (o similar) **solo si hace falta**. No gastar ese earmark en otro growth **sin notar** el compromiso. Wording PO “del fondo de partnerships un 10%” = el bucket partnerships (~10% supply / 100M) en todo o en parte para esos pools. | **Cerrado** (earmark + condición). **Tentativo:** cuánto del 100M se usa y cuándo. |
| **C10** | **Retiros de LP:** **no** hay withdraw rutinario. **Casi nunca** se saca LP. Única excepción: **withdraw atípico solo en las primeras horas** si el precio **explota de forma anormal** (emergencia risk/ops) — **divulgar como excepcional**, **no** como política de floor support ni cash-out. Alinea C5. | **Cerrado** |
| **C11** | **Split de swap fees (política objetivo):** fee un poco **por encima del default** donde sea **controlable**; **~30% → treasury (entidad)**, **~70% → LPs**. **Matiz crítico:** en **pump.fun / PumpSwap** el fee schedule es en gran medida **definido por el protocolo** (creator % vs protocol); el team suele controlar solo el **recipient de creator fee**, no un split 30/70 arbitrario. **30/70 aplica como target en pools Phase-2 configurables** (p.ej. Meteora / custom). En pump: **100% de la creator-share → treasury (entidad)**; el lado LP sigue el protocolo. | **Cerrado** (política + matiz protocolo). **Tentativo:** fee tier exacto en Meteora cuando se configure. |
| **C12** | **Sin transfer tax Token-2022.** Fees = swap / creator fee / fee de juego **~5%** P2P (ya en postura #6) — **no** tax on-transfer. | **Cerrado** (recomendación de producto locked) |
| **C13** | **Cash-out personal / treasury + black-swan (post-éxito Meteora):** si **Phase-2 Meteora (C9) es un éxito**, el PO **sí** puede realizar **capital limitado** hacia **offchain** (fiat/banco u equivalente) vía **entidad → payroll/distribución → offramp** — motivo principal = **seguridad** (reserva fuera de notebook/wallets si hay hack), **no** “dump on retail”. Fuentes **preferidas:** creator fees (C11), revenue de juego (consumibles, ~5% market), ventas **vested** del bucket team bajo caps de política, salary/ops predeterminado treasury→entidad. **Prohibido como framing rutinario:** pull de LP del seed **PumpSwap** / LP de graduación (sigue **C10 almost-never**). En éxito Meteora: realización **limitada y pre-declarada** (fees y/o trim capped de posición / LP share **explícitamente team MM capital**, **no** el LP locked de graduación pump). **Black swan:** la reserva offchain existe para **re-inyectar** capital externo tras bugs/exploit contenido y re-estabilizar ops/liquidez — playbook de ops / loss absorption, **no** promesa de floor a holders. **Marketing freeze:** nunca anunciar “cashing out because moon”; política interna; público solo transparencia locked LP vs team MM si hace falta. Monto/% = **open** (ver open #41). | **Cerrado** (política + intención PO). **Open:** banda $ / % (fees vs trim team MM) |
| **C14** | **Wallets / custody (Squads multisig):** **Jugadores** = **Phantom** (u otra wallet self-custodial). **Treasury / capital material** = **Squads** multisig (**2-of-3** o **3-of-5**) — vaults de allocations, **creator fee recipient** (C11), **LP seed / MM capital** grande, y **mint/freeze authority** si existe on-chain. **Hot ops wallet** = solo float pequeño (fees de tx, claim escrow ops, premios chicos). **C13 offramp** = vía **entidad → payroll**, **no** Phantom personal como sink de creator fees. Capital de **LP seed / MM** vive en multisig; **withdraw / trim** requiere **N firmas** (alinea C10 almost-never). Devnet traveler puede usar hot authority; **mainnet / capital real** migra a Squads. | **Cerrado** (política custody). **Open:** umbral $ exacto hot vs Squads; members/threshold final |

**Historia / supersedidos (no borrar):** estudio § 1.6 luck ≤+5% / drop ≤+8% = **preservado** + **TBD reconcile** vs banda PO 1–20%. Overflow “rent / fee rebates” del canvas/estudio 2026-07-12 = **superseded** por C5/C7 (sonaba a emular dividendos). Subsección “Liquidez inicial DEX (~20% · bajo estudio)” previa = **superseded** por C8–C12 (path cerrado; delta 300M sigue open). Cualquier línea previa que implicara “stake da tokens”, “piedras descontadas tradeables”, “stake = yield” o “withdraw rutinario de LP / floor DEX” queda **anulada** por estas tablas. **C13** no relaja **C10**: el cash-out personal permitido es vía fees/revenue/team MM pre-declarado + entidad, no vía pull rutinario del LP seed. **C14** concreta el “treasury multisig” ya recomendado en counsel fees: Phantom ≠ treasury.

#### Usuarios / revenue esperados (framing optimista · PO)

| Escenario | Usuarios × ARPU | Revenue anual (PO) | Notas |
|-----------|-----------------|--------------------|-------|
| **Optimista** | 4000 × $1/día/user | **$1.44M** | Consumibles + fees de juego + fees DEX |
| **Mod** | 1500 × $1/día | **$0.57M** | + fees juego + fees DEX |
| **Low** | 400 × $1/día | **$0.11M** | + fees juego + fees DEX |

**Footnote verificación (no “corrige” al PO):** `4000 × 365 × $1 = $1.46M` ≈ **$1.44M**; `1500 × 365 ≈ $0.55M` ≈ **$0.57M**; `400 × 365 = $0.146M` vs PO **$0.11M** (posible año ~275d, ARPU distinto, o redondeo — **dejar como está** hasta que PO precise).

> **$1/user/día se conserva** como framing de escenario blended. Lo que sigue **no lo reemplaza**: es el **mecanismo de gasto** (trust + must-have + piedras) con el que el PO argumenta que ese ARPU (o uno mayor en cohortes de spenders) puede sostenerse. Tentativo.

#### Embudo de gasto consumibles (PO · tentativo · 2026-07-13)

**Tesis de confianza (por qué en servers privados clásicos muchos no compran consumibles):**

1. Miedo a **moneygrab** / que el juego **desaparezca rápido**.
2. Miedo a que el **GM sea mercenario**: venta de ítems bajo mesa / black market fuera de mecánicas a amigos/clientes.

En un server **blockchain** esos riesgos se perciben **mucho más bajos** → mayor disposición a gastar (hipótesis de producto, no prueba de mercado).

**Compras one-time “MUST” (día 1 / early):**

| Ítem | Rol PO | Precio sketch |
|------|--------|---------------|
| **Shoes** + attrs (**exp +30%**, **HP/MP +30**, **drop +5%**) | Casi must-have · **soulbound** | **USD 25** / pieza (**cerrado 2026-07-17** · § 1.7.4) |
| **Cape** + attrs (**exp +40%**, **HP/MP +40**, **drop +5%**) | Casi must-have · **soulbound** | **USD 25** / pieza (**cerrado 2026-07-17**) |
| **Ambos** | Pack inicial · **soulbound** | **USD 40** combo (**cerrado 2026-07-17**; antes ~$50 tentativo) |

- Early Chain Lord: **no menos de 50–100** users harán ese gasto inicial → sube mucho el **$ promedio invertido en año 1**.
- Referencia Olympia (estimación PO): **≥ ~500 cuentas** compraron ese spend inicial.

**Gasto recurrente / upgrade:**

- Muchas cuentas compran en masa **piedras Xelima** y **piedras Merien** para llevar ítems a **+7**.
- Precio ideal: **~$1** cada una.
- Lanzar **bulk packs** para compras grandes (ofertas de volumen).
- **Descuento por stake (C2–C3):** el precio con descuento aplica a un subconjunto elegible; unidades compradas así son **soulbound**. Precio full (sin descuento de stake) puede seguir siendo tradeable según reglas de ítem — **no** confundir con el path descontado.

#### Puente ARPU año 1 (ejemplo ilustrativo · tentativo)

Números de **puente** (no sustituyen la tabla Low/Mod/Optimista). Muestran cómo Cape/Shoes + piedras **pueden justificar o superar** un ARPU blended alto en spenders / early cohort — sin afirmar que $1/día vale para *todos* los users.

| Pieza | Fórmula ejemplo | $ año 1 (ilustrativo) |
|-------|-----------------|------------------------|
| Cape+Shoes early | **50–100** × **$40** combo | **$2k–$4k** |
| Cape+Shoes mid (punto) | **75** × **$40** | **$3k** |
| Cape+Shoes sensibilidad Olympia-like | **500** × **$40** | **$20k** |
| Piedras (variable baja) | **200** cuentas × **80** piedras × **$1** | **$16k** |
| Piedras (variable alta) | **500** cuentas × **120** piedras × **$1** | **$60k** |
| Bulk packs | uplift sobre unitario | **TBD** (no inventar %) |

**Lecturas blended (contribución de *este* embudo, no revenue total):**

| Base users (escenario) | Cape/Shoes + piedras (combo ej.) | $ embudo | ≈ $/user/año solo embudo | vs $1/día (= **$365**/user/año) |
|------------------------|----------------------------------|----------|---------------------------|----------------------------------|
| **Low 400** | 75 × $40 + 200×80 piedras | **~$19k** | **~$48** | Cubriría ~**13%** del ARPU $1/día |
| **Mod 1 500** | 100 × $40 + 300×100 piedras | **~$34k** | **~$23** | ~**6%** |
| **Mod + Olympia-like** | 500 × $40 + 500×120 piedras | **~$80k** | **~$53** | ~**15%** |
| **Optimista 4 000** | 500 × $40 + 800×100 piedras | **~$100k** | **~$25** | ~**7%** |

**ARPU del *comprador* (no blended):** Cape+Shoes **$40** combo día 1 + p.ej. **80–120** piedras → **~$120–160** año 1 antes de packs; whales que masifican +7 **pueden superar $365**/año fácilmente. Eso **refuerza** la tesis de que el framing $1/día es alcanzable *en cohortes monetizadas*, no que el promedio de toda la base lo sea.

**Nota económica honesta (qué fortalece vs qué no prueba):**

- **Fortalece:** narrativa de **trust on-chain** vs private clássico; path claro de **monetización early** (must-have Cape/Shoes); **sink recurrente** (piedras/packs) alineado a utility de $HELL; sensibilidad Olympia-like muestra upside de conversión.
- **No prueba:** que 4k users paguen $1/día; **sesgo de selección** Olympia (server maduro ≠ launch); **retención de gasto** después del one-time; **concentración whale** (pocos pagan la mayoría); perception **P2W** si Cape/Shoes/piedras sesgan poder duro.
- **No confundir con C4:** que un jugador *pueda* maxxear y vender gear con mats soulbound **no** es un producto “stake cash-out” del team ni prueba de yield.

**Open (embudo):** catálogo exacto attrs Cape/Shoes; si se pagan en $HELL, stables o fiat; caps anti-P2W vs torneo equal-footing; pricing packs; counsel copy (no vender como inversión); lista de consumibles elegibles a descuento stake + caps diarios.

#### Postura PO · utilidad / no-shill / fees / retención (tentativo · 2026-07-13 · alineado a C1–C7)

> **No es consejo legal.** Captura fiel de posiciones del product owner + análisis de diseño. Antes de launch, custody de fees, fee de marketplace o burn público: counsel US + UE + jurisdicción del PO (entidad, tax, valores, gaming). Ver canvas `helbreath-hell-tokenomics-legal-econ`.

**1. MC no es promesa.** El equipo **nunca** comunicará nada que haga creer a la gente que se enriquecerá especulando con el token. Market cap / precio / “moon” **no** son KPIs de marketing.

**2. Token = utilidad (narrativa canónica).** Staking potencia personaje, potencia guild, roles económicos de guild + **descuentos soulbound** en consumibles elegibles (C2–C3). **No** staking-as-income. Copy público: utilidad in-game — no investment thesis.

**3. Disclaimer de MC orgánico (comportamiento de mercado, no target).** Compradores desinformados pueden ver el launch con **par USDT/USDC en pump.fun**, percibir un proyecto serio, y comprar de forma compulsiva **sin** shill del equipo ni promo “el token va a moon”. El MC circulante **puede** superar **$1M** de forma orgánica. Se **reconoce** como posible comportamiento de mercado; **no** se marketinea como objetivo, piso ni promesa.

**4. Estudio crítico — control / captura de fees del par DEX (parcialmente cerrado · C8–C12).** Path launch + política LP/fees = **C8–C12**. Sigue open: par exacto (SOL vs USDC/USDT), Creator Fees vs Cashback Coins, vaults/sharing_config, tax al claim. **Sin contratos DEX propios en este pass.** Detalle en canvas `helbreath-dex-liquidity-robinhood-base`. **Freeze C5:** el team **no** opera un “DEX floor” pensado para cash-out de stakers.

**5. Contingencia burn de team tokens.** Si llegan fondos grandes vía fees DEX + ventas de consumibles, el PO contempla **quemar / eliminar todos los tokens del bucket team**. Óptica de buena fe vs unlock ya documentado (3.33%/mes sobre 100M) — reconciliar schedule si se activa burn (cliff cancelado, burn on-chain verificable, no “promesa de buyback”). Coherente con **C7**.

**6. Fee marketplace P2P (sketch) + postura custody (C6).** **~5%** sobre trades intermediados jugador-a-jugador (ítems). Preferir flujo **non-custodial**; engines con balances **bajos**; warning UX: no acumular $$$ en la app de auction; fondos viven en **wallets de jugadores**. Allowlist / tooling vs phishing skins = **intent, TBD implement**. Preocupación legal del owner: ¿puede meterse en problemas personales por **quedarse** con (a) fees DEX si las controla/cobra y (b) ese 5%? → **entity + counsel** (abajo); no operar como persona física.

**7. Recycle de fees de exchange (~50%) — C7.** Sketch de política: **~50%** de las fees de exchange → premios de torneo, marketing, y **hire** de empleado(s) para mantenimiento general del juego; el resto implícitamente ops / owner. **No** se reparte a stakers (eso sería fee-share / yield — C5). Mitiga óptica extractiva si se ejecuta con transparencia; **no** elimina que sea revenue imponible ni el riesgo Howey/MiCA si el marketing vuelve a soar a “empresa común / profits”.

##### Freeze marketing — “nunca dice” (alineado al PO + C5)

| Nunca comunicar | Por qué |
|-----------------|--------|
| “Te vas a enriquecer / moon / 100× / easy money” | Viola postura #1; Expectation of profits (Howey) |
| MC objetivo, piso de precio, “vamos a $1M+” como promesa | MC orgánico ≠ target de marketing |
| “Inversión”, “retorno”, “APY”, “dividendo”, “passive income” | Framing de valores / yield |
| “Mining = vivir del juego / salary” | Play-mine ≠ employment ni guaranteed income |
| “Stake = dinero / cash-out / salary” | Viola C5; stake es utilidad + descuentos soulbound |
| Fee share / DEX fees como “yield para holders/stakers” | Confunde fee de plataforma con retorno; viola C5/C7 |
| “Comprá piedras baratas con stake y flipéalas a USDT” | Viola C3 + C5; mats descontados = soulbound |
| Promover el path maxxed-gear (C4) como “negocio oficial / stake ROI” | C4 permite espontáneo; **team no shillea** |
| Comparar $HELL con stocks / securities / “equity del server” | Auto-clasificación peligrosa |
| Shill coordinado, paid KOLs con script de precio, “guaranteed listing pumps” | Promo especulativa; amplifica prongs Howey + consumer |
| DEX floor / liquidez del team “para que stakers salgan en $$” | Viola C5 |

**Sí (utility-first):** staking potencia char/guild + descuentos soulbound capped; guilds ganan roles económicos y features; consumibles/exp; play-mine por jugar; torneos y fantasía del juego — **sin** promesa de valor externo del token ni de monetizar el stake.

##### Riesgo personal vs entidad (alto nivel · counsel)

- Cobrar creator fees de pump.fun/PumpSwap o el 5% P2P **en wallet personal** = mezcla income personal, custody, y posible piercing si hay enforcement (valores, tax, AML, consumer).
- Recomendación de diseño: **entidad** (LLC/SRL u otra) + treasury **multisig** + política escrita de uso de fees (50% recycle, **sin** payout a stakers) + bookkeeping + counsel tax **antes** del primer claim material.
- **C13:** cualquier realización personal post-éxito Meteora pasa por **treasury entidad → payroll/distribución → offramp** — no fee recipient personal. Reserva offchain = loss absorption / reinject, no marketing de exit.
- Jurisdicciones a mapear: US (Howey, FinCEN MSB si fiat/on-ramp, tax ordinary income); UE (MiCA marketing + CASP si aplica); LatAm del PO (p.ej. CNV/PSAV AR, AFIP/ARCA, gaming local).

**Open (fees / posture):** confirmar par launch (SOL vs USDC/USDT en pump.fun); Creator Fees vs Cashback; recipient = entidad (**C11** ya fija creator-share → treasury); % exacto recycle 50/50 (C7); fee tier Meteora si Phase-2; banda $/% **C13** (open #41); si 5% P2P es off-chain intermediary o on-chain escrow; trigger y mecánica del burn de team; diseño allowlist phishing (C6); counsel memo antes de comunicar burn o fee policy públicamente.

#### Supply y precio de referencia

| Dato | Valor PO |
|------|----------|
| Supply total | **1 000 000 000** $HELL |
| A **$1M** market cap | precio **$0.001** / token |

#### Allocations (suman 1 000 000 000)

| Bucket | Cantidad | Vesting / notas PO |
|--------|----------|--------------------|
| **Team** | **100 000 000** | Unlock **3.33% por mes** |
| **Liquidity / market** | **300 000 000** | Progressive auction + funds for team. **C8:** path de launch = **~20% supply (200M)** vía **pump.fun → PumpSwap**. **Delta open:** resto del bucket 300M / re-split TBD. Ver política launch/LP abajo + canvas `helbreath-dex-liquidity-robinhood-base` |
| **DAO (guilds)** | **100 000 000** | PO: “**3 months at 5%** each?” — ver ambigüedad abajo |
| **Growth & partnerships** | **100 000 000** | **5% por mes**. **C9:** earmark (en todo o en parte) para **Phase-2 LP opcional** (Meteora o similar) — no gastar sin notar el earmark |
| **Mined by playing** | **400 000 000** | Airdrops + gameplay (pool play-mine) — **única** emisión por jugar (**C1**) |

**Ambigüedad DAO (documentar literal + aclarar):** el PO escribió *“DAO (guilds — 3 months at 5% each?)"* con signo de interrogación. Interpretación provisional: **liberación escalonada** hacia DAO/guilds (p.ej. tramos mensuales ~5% del bucket DAO, o tres meses × 5% — **no está cerrado**). **No** hardcodear schedule hasta que PO confirme: ¿5%/mes del bucket DAO durante 20 meses? ¿tres ventanas de 5%? ¿5% del supply total?

#### Política de lanzamiento / liquidez / fees DEX (C8–C13 · 2026-07-13)

> **No es consejo legal.** Path y reglas de LP/fees = **cerrados** (C8–C12). Cash-out personal/treasury + black-swan = **cerrado en intención** (**C13**); montos/% = **open**. Números de bucket canónico **300M liq/market** y cuánto del **100M partnerships** se usa en Phase-2 = **tentativo / open** donde se marque. Cross-link: **C5** (no DEX floor para stakers), freeze no-shill, postura fees #4/#6/#7, counsel entidad § riesgo personal. **Base** = #1 seat constelación; **pump** = awareness launch Solana. Canvas: `helbreath-dex-liquidity-robinhood-base`.

**1. Launch path (C8 · cerrado):** ~**20% del supply (200M $HELL)** vía **pump.fun** — awareness + bonding curve → graduación **PumpSwap**. LP de migración de graduación: quemado por protocolo (no retirable). Creator fees ≠ ownership de LP.

**2. Delta vs bucket 300M/30% (open · no overwrite):** docs conservan **Liquidity / market = 300M**. El **20% pump** es el seed path cerrado; el **resto** del antiguo bucket liq (100M) o un **re-split** = **TBD** si hace falta. No silenciar el delta.

**3. Phase-2 opcional — Meteora / similar (C9 · cerrado earmark):** capital desde bucket **Growth & partnerships (~10% supply / 100M)** — en todo o en parte — **solo si hace falta** profundidad/secundario post-launch. No gastar ese earmark en otro growth sin documentar la excepción. **Trigger de C13:** realización personal limitada **condicionada** a que esta Phase-2 sea un **éxito** (definición operativa de “éxito” = open / pre-declarar antes del trim).

**4. Retiros de LP (C10 · cerrado):** **casi nunca** retirar. **Sin** withdraw rutinario. Excepción **atípica solo primeras horas** si precio **explota anormalmente** (risk/ops) — comunicar como emergencia, **no** como floor support ni política de cash-out (C5). **C13 no abre** withdraw rutinario del LP seed PumpSwap ni del LP de graduación.

**5. Swap fees — matiz pump vs Phase-2 (C11 · cerrado + tentativo donde protocolo limita):**

| Superficie | Quién fija el fee | Política del team |
|------------|-------------------|-------------------|
| **pump.fun / PumpSwap** | Protocolo (creator % vs protocol); team controla sobre todo el **recipient** de creator fee | **100% creator-share → treasury (entidad)**; lado LP = protocolo. **No** asumir split 30/70 arbitrario aquí |
| **Phase-2 (Meteora / custom)** | Fee tiers **configurables** (donde el AMM lo permita) | Target: fee **algo > default** si controlable; **~30% treasury / ~70% LPs** |

**6. Sin Token-2022 transfer tax (C12):** no tax on-transfer. Monetización on-chain/juego = swap/creator fees + fee P2P ~**5%** (postura #6) + sinks de juego — ya frozen en docs.

**7. Cash-out personal / treasury + black-swan (C13 · cerrado intención · montos open):**

> Intención PO (fiel): si Meteora Phase-2 **sale bien**, **sí** quiere sacar **algo de capital** a **$$ personales offchain** (offramp fiat/banco). Razón primaria = **seguridad** — si un hacker compromete notebook/wallets, sigue habiendo fondos fuera de cadena. **Black swan:** puede **re-inyectar** capital desde afuera cuando bugs/incidente estén contenidos, para re-estabilizar ops/liquidez.

| Permitido (fuentes preferidas) | Prohibido / evitar como framing |
|--------------------------------|----------------------------------|
| **Creator fees** → treasury (entidad) → payroll/distribución → offramp | Pull **rutinario** de LP seed **PumpSwap** / LP graduación (C10) |
| **Revenue de juego** (consumibles, ~5% market P2P) vía entidad | “Vaciar el pool” / cash-out anunciado como moon |
| Ventas **vested** del bucket **team** bajo **caps** de política pre-declarados | Confundir **team MM capital** con LP locked de pump graduation |
| Salary/ops predeterminado **treasury → entidad** | Recipient de fees en **wallet personal** (ver counsel § riesgo personal) |
| En éxito Meteora: realización **limitada + pre-declarada** de fees y/o **trim capped** de posición/LP **explícitamente team MM** (no el LP locked pump) | Marketing “estamos cashing out because moon” |

**Entity + offramp:** cash vía **company treasury → payroll/distribution → offramp**; no fee recipient personal. Alinea C11 (creator-share → entidad) y notas counsel previas.

**8. Custody / Squads (C14 · cerrado política · members open):**

| Rol | Wallet | Notas |
|-----|--------|-------|
| **Jugadores** | **Phantom** (self-custodial) | Claims, P2P, stake UI |
| **Treasury / vaults / creator fee / LP·MM grande / mint authority** | **Squads** multisig **2-of-3** o **3-of-5** | Capital material; N firmas para withdraw/trim (C10) |
| **Hot ops** | Hot wallet, **float pequeño** | Fees tx, claim escrow ops, premios chicos — no sink de fees |
| **C13 offramp** | Entidad → payroll | **No** Phantom personal como fee recipient |

Devnet traveler puede usar hot game-authority; **mainnet / capital real** → migrar vaults + fee recipient + mint authority a Squads.

##### Research Aragon (DAO tooling) · 2026-07-15 — patrones sí / contratos day-1 no

> **Research only** (sin deploy). Alinea bucket **DAO/guilds 100M**, guild econ § 1.4, custody **C14**, seat Base § 7, freeze utility-first. Fuentes: [OSx docs](https://docs.aragon.org/osx-contracts/1.x), [Aragon App / OSx](https://www.aragon.org/osx), [Base launch](https://blog.aragon.org/aragon-launches-on-base/), [legacy sunset](https://blog.aragon.org/legacy-product-update/), Product Digest May 2025. Bitácora: [`BITACORA.md`](./BITACORA.md) 2026-07-15.

**Stack Aragon 2025–2026 (qué existe hoy):**

| Pieza | Rol | Estado relevante |
|-------|-----|------------------|
| **Aragon OSx** | Framework modular EVM: `DAO.sol` (tesoro + execute) + **permissions** + **plugins** instalables | Canónico |
| **Aragon App** (`app.aragon.org`) | UI no-code + Governance Designer (etapas, roles, bodies externos) | Canónico; legacy app UI deprecada mid-2025 |
| **Plugins core** | **Token Voting**, **Multisig**, **Addresslist Voting**, **Admin**; + dual/optimistic/gauges; Safe/address externo como body (mayo 2025) | Adoptables como *patrones* |
| **Govern / Voice / Court** | Señal off-chain + execute + disputa | **Sunset** FE (dic 2024) — **no** adoptar |
| **Cadenas** | Ethereum, Polygon, **Base**, Arbitrum, OP-stack / L2s (zkSync, Mode, peaq, Celo, …) | **EVM-only** |
| **Solana** | — | **No soportado** (ni OSx ni App nativos) |

**Mapa → Chain Lord:**

| Necesidad CL | Patrón Aragon útil | Implementación day-1 recomendada |
|--------------|-------------------|----------------------------------|
| Gobernar bucket **100M DAO** | Multisig / staged bodies → execute treasury | **Squads** (C14) custodia el ATA DAO; política de propuestas en docs + Discord/in-game |
| Proposal → vote → execute (torneos, grants, burn) | Lifecycle OSx (propose / approve / execute con permisos) | **Híbrido:** voto **in-game / guild** (señal) → **execute** solo vía Squads (N firmas). Sin puente on-chain day-1 |
| Multisig vs token voting | Admin/Multisig bootstrap; Token Voting después | Day-1 = **multisig** (anti-sybil, legal freeze). Token-vote $HELL **más tarde** y solo si counsel OK (no soar a “gov = security”) |
| Guild DAO / server DAO | Dual governance (council rápido + veto comunidad) | **Patrón:** council = GMs legacy + team; veto/señal = guild votes in-game. Execute = Squads |
| Season / grants | Optimistic + veto; gauges (asignar % a buckets) | Producto: “temporadas” de grants con allowlist + caps; gauges = UI de priorización, no contrato |

**Top 5 adoptables (producto / ops — sin contratos Aragon):**

1. **Ciclo propose → quorum/señal → execute con delay** (timelock social o cooldown ops antes de firmar Squads).
2. **Híbrido council + comunidad:** multisig ejecuta; guild/in-game vota o veta en rangos chicos (premios, burn simbólico).
3. **Permissions por rol:** quién propone grants vs quién firma capital material (hot ops ≠ treasury).
4. **Optimistic grants:** ejecuta si no hay veto en ventana X (reduce apatía; alinea dual governance).
5. **Categorías de propuesta tipadas:** torneo / grant guild / burn / partner — cada una con umbral y destino de vault distinto.

**Top 3 “don’t bother yet”:**

1. **Deploy Aragon OSx / App day-1** — EVM; choca con Solana-first + C14 + “no multi-chain primera ola” (§ 1.2).
2. **Token Voting on-chain con $HELL** prematuro — plutocracia + framing securities; stake ya es utilidad (C1–C5), no gov yield.
3. **Aragon Govern / Court / Voice** — productos legacy sunset; no hay path de producto.

**Fit honesto:**

| Opción | Pros | Contras | Veredicto |
|--------|------|---------|-----------|
| **A. Aragon en Base “season DAO”** | UI madura; alinea seat Base; grants/sponsors EVM | Bridge $HELL/SPL; wallets duales; counsel multi-chain; fuera de ola 1 | **Más tarde** — solo si existe seat Base real + temporada con presupuesto EVM |
| **B. Squads + votos guild in-game (default)** | Nativo Solana; C14 ya cerrado; UX en el juego; freeze legal más simple | Menos “DAO theater” externo; execute sigue centralizado en N firmas | **Default path** |

**Default path (cerrado como recomendación de research · no es Decisión § 5 nueva):** day-1–N = **Squads (C14) + patrones de governance Aragon sin contratos** + votos guild/server **in-game**. Revisitar **Aragon OSx en Base** solo cuando (a) seat Base esté activo, (b) haya un sub-treasury/season budget que justifique EVM, (c) counsel revise copy de “DAO”. **No** implementar contratos en este pass.

**Black swan reinject (playbook ops):** la reserva offchain existe **específicamente** para absorber pérdida / re-seed liquidez+ops post-exploit. Es **por qué** existe el offramp parcial — **no** es promesa de floor ni de “siempre repondremos MC” a holders.

**Marketing freeze:** política **interna**. Público, si algo: transparencia **locked LP (pump) vs team MM capital** — nunca narrativa de exit por moon.

**Open (C13 · open #41):** ¿cuánto $ / % como **security reserve** post-offramp? ¿Prioridad fees vs trim team MM? Banda TBD — target = reserva de seguridad personal, **no** vaciar pool.

**Historia (opciones A1–A4 del estudio previo):** siguen válidas como menú de *cómo* usar leftovers del bucket 300M post-pump; el path day-0 canónico es **C8**. Separar siempre de contingencia burn del bucket **team** (C7) y de **C13** (realización limitada post-Meteora vía entidad).

#### STAKE $HELL (modelo cerrado · números combate tentativos)

**Historia coherente (una sola):** stakear $HELL **bloquea** tokens a cambio de **utilidad in-game** — no a cambio de más $HELL, ni de share de fees, ni de un “sueldo”. La emisión por jugar vive solo en **MINING** (C1).

| Beneficio | Valor / regla | Estado |
|-----------|---------------|--------|
| Bonus drop | **1% a 20%** | **Tentativo** (PO) — **TBD reconcile** vs estudio § 1.6 (+8%) |
| Drop + luck | **máx. 20 luck** | **Tentativo** — **TBD reconcile** vs estudio § 1.6 (+5%) |
| **Guildmaster** | Stake de la **guild** + **stake colectivo** | **Tentativo** (detalle fórmula open) |
| **Descuentos consumibles** (ej. piedras) | % fuerte escalado por stake; **cap máx. unidades/día** | **Cerrado** (C2) — %/cap/catálogo = **open** |
| Flag de compra descontada | Ítem/mat = **soulbound** | **Cerrado** (C3) |
| Emisión / yield en $HELL por stake | **No** | **Cerrado** (C1 / C5) |
| Fee-share / “dividendo” a stakers | **No** | **Cerrado** (C5 / C7) |

> **TBD reconcile vs estudio 2026-07-12:** canvas / § 1.6 proponían luck **≤+5%** y drop general **≤+8%** (anti-whale). PO abre banda **1–20% drop** y **max 20 luck**. Conservar ambos textos; decidir en cola Fable / sim económica **antes** de implementar. El cierre C1–C7 **no** resuelve esa calibración de combate.

##### Mercado espontáneo post-craft (C4 · permitido, no promovido)

1. Jugador stakea → compra mats elegibles con descuento (soulbound).  
2. Usa esos mats para llevar gear de **+0 → maxxed**.  
3. El **ítem maxxed** resultante **no** hereda soulbind del mat (salvo otra regla de ítem aparte).  
4. Puede venderlo a precio libre (gold / ítems / NFT / $HELL / USDT) P2P o auction, sujeto a fees/custody de C6.  
5. El team **no** shillea esto como “ROI del stake”, “crafting business” oficial, ni path de salida a USDT.

#### Uso de $HELL

- **Play-mine / unlock-by-playing** → **única** vía documentada de **adquirir $HELL por jugar** (C1). Stake **no** es faucet.
- **Staking** → potencia personaje + guild + roles económicos / features + **descuentos soulbound** capped (C2–C3); topes combate **TBD reconcile** § 1.6.
- **Consumibles**, **ítems de exp** (Cape/Shoes must-have, piedras Xelima/Merien, packs — ver embudo) y fees/economía de juego alineada al framing de revenue.
- Medio de pago espontáneo en trades de jugadores (incl. C4) — **sin** marketing de apreciación.
- **No** vender como promesa de apreciación / enriquecimiento / yield de stake (freeze).

#### MINING $HELL (play-mine diario) — emisión por jugar (C1)

- Distribución diaria **capped 500 000 tokens/día** hasta agotar el pool de **400 000 000** mined-by-playing.
- Se reparte entre jugadores con **créditos diarios** según la tabla:

| Acción | Créditos | Tokens directos (si aplica) | Cap / nota |
|--------|----------|-----------------------------|------------|
| Kill **+500 monsters** | **10** créditos | — | Umbral diario de kills |
| Cada **legendary EK** | **5** créditos | **+1 000** tokens | Cap **5 000 tokens/día** desde EKs |
| EK **top 100** | **3** créditos | **+300** tokens | Ranking EK |
| Participar en **events** | **5** créditos | **+100** tokens | Eventos de juego |

**Footnote verificación mining:** `400 000 000 ÷ 500 000 = **800 días**` (~2.2 años) al rate máximo diario si el cap se llena todos los días. Los tokens “directos” de EK/eventos deben restarse del mismo pool diario o ser adicionales — **PO no lo detalla** → **open**.

**Open (tokenomics · aún tentativo / no cerrado):** schedule DAO; fórmula créditos→share del pool diario; si tokens fijos de EK/eventos cuentan dentro del cap 500k/día; **reconcile** stake 1–20% vs estudio § 1.6 (**#26**); catálogo descuentos + fórmula stake→%→cap/día; **delta liq 300M vs seed pump 200M** (C8 · **#38**); cuánto del earmark partnerships 100M a Meteora (C9 · **#40**); **banda $/% C13** cash-out post-Meteora (**#41**); allowlist phishing auction (C6); Item Drops recycle shards (**#42**); counsel copy “mining/airdrop” (sin soar a salary).

**Análisis pendiente → hecho (2026-07-13):** stress-test económico + regulatorio (Howey / MiCA / CNV alto nivel, dilución 500k/día, unlock vs $1M MC, P2W stake, mitigaciones) en canvas Cursor `helbreath-hell-tokenomics-legal-econ` + pointer en [`BITACORA.md`](./BITACORA.md). **No es consejo legal**; **no** implementa contratos. IP sigue en [`LEGAL-IP-RESEARCH.md`](./LEGAL-IP-RESEARCH.md) (no conflar).

**Análisis fees / no-shill (2026-07-13 · mismo canvas):** postura utilidad + freeze marketing; disclaimer MC orgánico >$1M; estudio pump.fun/PumpSwap creator fees; retención DEX fees + 5% P2P; ~50% recycle; contingencia burn team. **Actualizado** con callout C1–C7 (stake ≠ mine; soulbound; no yield). **Launch/LP/fees C8–C12** + **cash-out/black-swan C13** + **custody Squads C14** en § 1.7 + canvas `helbreath-dex-liquidity-robinhood-base`. **Sin** implementar DEX/contratos.

#### 1.7.4 Checklist — mes de test (público / cerrado) · 2026-07-14 · **prioridad launch 2026-07-17**

> **PO · producto (actualizado 2026-07-17):** **lanzar a fase de test ~1 mes cuanto antes** — traer jugadores, grind de nivel, **colectar créditos** para el **airdrop inicial** (play-mine pending / tabla MINING). Exp/niveles del test **llevan a main**, salvo wipe de progresión si bugs de exp lo fuerzan.  
> **PO · 2026-07-21 (tarde):** **mañana** subir game a **Hetzner CX53** (confirmar SKU; doc previo CX52) + soft test **~10 amigos** (closed). No marketing de precio/$HELL. Discord + Grok 4.1 + market side door (dev pay) ya en camino.  
> **Foco del mes:** estabilidad World + progression + créditos + cash shop soulbound (abajo). **Fuera del mes:** hero set art premium (§ 1.8), pump day-0, stake C2 full, unbind mercado F.  
> **Sin** deploy de contratos ni launch pump como blocker de day-0.

##### Soft test 10 amigos (post-CX53 · checklist corta)

| # | Item | Owner |
|---|------|--------|
| 1 | VPS up + game WS + saves | Ops / PO |
| 2 | `play.chainlords.net` HTTPS → traveler | Ops |
| 3 | Landing Play URL apunta a play HTTPS | Ops |
| 4 | Discord invite + pin play + plantilla bug | PO |
| 5 | Bot FAQ Grok 4.1 en VPS (`pm2`) | Ops |
| 6 | 10 wallets de amigos; feedback 48h | PO |
| 7 | `MARKET_*` env en game si desk mobile | Ops |
| 8 | Freeze copy activo (no moon / no official Helbreath) | Todos |

##### Soulbound cash shop — **persiste post-test** (PO · 2026-07-17)

> Consumibles de pago en **USD** (o stable equivalente vía shop/cashier TBD). **Soulbound** al character/wallet (no trade / no AH flip). Tras el mes de test **se mantienen** en el char (no wipe de estos items salvo ban/exploit).

| SKU | Efectos (producto) | Precio | Notas |
|-----|-------------------|--------|--------|
| **Shoes / Boots boost** | Exp **+30%** · HP/MP **+30** · Drop rate **+5%** | **USD 25** c/u | Soulbound; duración TBD (timed buff item vs permanent equip — open #43) |
| **Cape boost** | Exp **+40%** · HP/MP **+40** · Drop rate **+5%** | **USD 25** c/u | Soulbound; mismo open de duración |
| **Combo Cape + Shoes** | Ambos | **USD 40** (ahorro vs 50) | Bundle checkout; no stack de % inventado — aplicar ambos efectos según reglas de item |

- Copy: utilidad de juego / cosmético-progresión **soulbound** — **nunca** “investment / APY / se vende a USDT”.
- Alinea C3 (soulbound no flip) y embudo ARPU § 1.7; **supersede** montos tentativos viejos ~$30/$50 si chocan → **25 / 25 / 40 combo** es la fuente actual.
- Implementación cash shop + payment rail = **must del mes** si se vende en test; si day-0 sin pagos, anunciar “coming this month” y no vender vapor.

##### Airdrop inicial (créditos del mes de test)

- Jugadores **acumulan créditos** play-mine (pending) durante el mes → base del **airdrop / claim $HELL** cuando exista mint real (C1).
- No borrar historial de créditos mining en wipe de progresión (política § A).
- Sybil: known risk; caps diarios; claim future puede pedir PoH (ANTIBOT).

##### Docs vs implementado (snapshot 2026-07-14)

| Pieza | Docs (§ 1.7 / satélites) | Código repo |
|-------|--------------------------|-------------|
| **C1–C7** stake/mine/descuentos/mercado | **Cerrado** (producto) | **Parcial** — play-mine ledger + pending UI (**C1**); stake/descuentos/recycle **no** |
| **C8–C13** pump / LP / fees / cash-out | **Cerrado** (path/política) | **Parcial** — `init-hell-token` SPL mint + alloc ATAs (devnet); **sin** pump / Meteora |
| **C14** Squads / wallets | **Cerrado** (custody política) | **Docs only** — mainnet Squads TBD; devnet = hot authority + vaults |
| Tabla **MINING** (créditos / 500k/día / 400M pool) | Tentativo (números) | **Sí (MVP)** — `HellMiningStore` JSON + hooks kills/EK/events + SysMenu pending |
| Auction / shops gold / sell Olympia | Postura C6 + roadmap | **Parcial** — auction **mock gold**; shops gold; **no** settle $HELL |
| NFT drop claim (cNFT Bubblegum) | Runbook ops | **Sí** — `middleware-node/mint.js` + `drop_ledger` (simulate\|onchain) |
| Chars / exp / Postgres | Arquitectura § 2 | **Sí** — `accounts` / `characters` / progression server |
| Landing Chain Lords | `landing/README.md` · **chainlords.net** | **Live** World/Arena, Play→wallet→SELECTCHAR, stats, EK, Arena Sunday, **`/market.html`** side door |
| Middleware HTTPS | market + auth + hell | **Live Railway** `chainlords-middleware-production.up.railway.app` (2026-07-21); market + Grok advisor |
| Discord + FAQ bot | social-bot | **Live** invite `discord.gg/F4NwwbfKtj`; bot **Grok 4.1 Fast** (2026-07-21) |
| Game host público | VPS | **Mañana CX53** (PO 2026-07-21) + soft test **10 amigos** |

##### A. Producto / persistencia

- [ ] **Política pública (Discord + landing):** “Exp y niveles del test **cuentan para main**.” Wipe **solo de progresión** (exp/level/rebirth) si bugs de exp lo obligan — **no** borrar wallets ni historial de créditos mining sin anuncio.
- [ ] Condiciones de wipe documentadas: exploit de farm exp, inflation no revertible, corrupción de `state_json` / progression. Quién decide (PO/GM) + ventana de aviso.
- [ ] Verificar saves reales en prod: `DATABASE_URL` compartido server C# + middleware; chars listables tras reboot; traveler vs GM (`player_mode`) no mezclan.
- [ ] Backup/restore drill **antes** del día 0 (ver Ops) — **antes de CX53 soft test**.
- [x] Capacidad / invite: **closed soft test ~10 amigos** primero (PO 2026-07-21); luego ampliar / público — comunicar cupo.
- [ ] Scope jugable mínimo del mes: World + grind + death/rez + bag/shops gold; torneos/NFT on-chain = **nice** si ya estables, no blockers del mes.

##### B. Infra

- [x] **Dominio** `chainlords.net` / `www` → Railway landing (Cloudflare DNS; 2026-07-18).
- [ ] Subdominio `play.chainlords.net` → traveler + WS game (**CX53 mañana**).
- [x] **HTTPS** landing (Railway + CDN).
- [x] **HTTPS middleware** público Railway (auth/market/hell; 2026-07-21). Play host = VPS pendiente.
- [ ] Hosting estable: traveler + **game C#** + Postgres en **CX53**; middleware puede seguir Railway o colocalizar.
- [ ] Secrets prod en VPS: `WALLET_AUTH_SECRET`, `MARKET_SYNC_SECRET`, `MARKET_MIDDLEWARE_URL`, `XAI_API_KEY` (bot); **no** defaults de dev.
- [x] Discord hub oficial **https://discord.gg/F4NwwbfKtj** — `#announcements`, `#bug-reports`, `#support`, FAQ bot Grok 4.1.
- [ ] Monitoring mínimo: uptime game/middleware/PG; logs; bot `pm2` en VPS.

##### C. Landing

- [x] Marca **Helbreath Chain Lords** en landing (2026-07-18+).
- [ ] **Play / Play Now → URL real HTTPS** del traveler en CX53 (hoy aún local en varios defaults).
- [x] Discord CTA invite oficial; market CTA `/market.html`.
- [ ] Swap art residual Olympia **antes** de marketing amplio.
- [ ] Página o post “Mes de test” / soft test 10: fechas, carry exp, mining pending, freeze copy.

##### D. Wallet / $HELL mining MVP

| Pregunta PO | Respuesta honesta para el mes de test |
|-------------|----------------------------------------|
| ¿Hace falta **token mint SPL** day-0? | **No** para empezar. Créditos **server-side** (pending balance) bastan. |
| ¿Smart contracts / programs custom? | **No** para el MVP del mes. Claim on-chain puede venir **después** del token real. |
| ¿**pump.fun** en el mes de test? | **Después** del mes (o al cierre), no day-0. Evita presión de precio + counsel prematuro sobre supply público. |
| ¿Qué sí hace falta build? | Ledger Postgres (wallet → créditos diarios / balance pending) + contadores (kills/EK/events) + UI “$HELL mined (pending)” + reglas anti-farm básicas. |

- [x] **Must (1–2 semanas):** implementar play-mine **off-chain** alineado a tabla MINING (aunque números sigan tentativos): créditos/día → `pending_hell` por wallet; visible in-game o F-key/simple panel; **sin** withdraw on-chain.
- [x] Copy UX: “créditos de minado / pending $HELL — canjeables cuando exista el token” — **nunca** “salary / APY / moon”.
- [ ] Anti-abuse mínimo: cap diario, 1 wallet = 1 share (sybil = known risk), no credit en traveler-only si aplica política.
- [x] **Later (started):** mint SPL $HELL script (`init-hell-token`); vault/treasury ATAs; endpoint **claim** pending→SPL (`POST /hell/claim`). Still TBD: PoH en claim alto; staking C2; pump C8; Meteora C9; C13; vesting unlocks.
- [ ] NFT cNFT claim (middleware) es **otro** sistema — no confundir con play-mine $HELL.

##### E. Legal / copy freeze (test)

- [ ] Freeze marketing § 1.7 (“nunca dice”) activo en Discord/landing/KOLs.
- [ ] Marca: preferir **Chain Lord**; “Helbreath” solo con counsel ([`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md) / § 0).
- [ ] ToS/privacy **mínimos** del test (cuenta wallet, bans, datos, no promesa de valor del token).
- [ ] No publicar allocations/supply/MC como promesa; mining copy = utilidad/juego, no investment.
- [ ] Edad / geo: decidir 18+ si wallet+NFT; anunciar.

##### F. Ops

- [ ] Backups PG diarios + restore testado ([`NFT-OPS-RUNBOOK.md`](./NFT-OPS-RUNBOOK.md)).
- [ ] GM tools: panel anti-bot/ops (`:8080` SysMenu); kick/ban path documentado.
- [ ] Triage bugs: plantilla Discord (repro, char, mapa, wallet truncada); severidad (wipe-risk / economy / soft).
- [ ] On-call: quién reinicia server/middleware/PG; canal `#status`.
- [ ] Kill-switch mint NFT (`HELBREATH_MINT_MODE=simulate`) si claim on-chain arde.

##### Path mínimo ~1–2 semanas vs nice-to-have

| Must-have (arrancar test) | Nice-to-have (mismo mes o post) |
|---------------------------|----------------------------------|
| Dominio + HTTPS + host game + middleware + PG | CDN global / multi-región |
| Landing CTA Play → URL real + marca Chain Lord | Art/video propios full; Spectate embeds |
| Saves chars + política carry exp publicada | Wipe automation / season tooling |
| **Play-mine créditos off-chain** + UI pending | Claim on-chain $HELL; token mint; pump.fun |
| Discord + freeze copy + ToS mínimo | Counsel memo securities completo |
| Backups + bug triage + GM kick | Elo/torneos polish; auction $HELL; guild create |
| Secrets prod + RPC si NFT on-chain | PoH Passport; stake descuentos; Meteora |

**Veredicto mining:** para el mes de test, **sí se puede “minar $HELL”** como **balance pending server-side** sin contratos. Eso cumple la intención de producto (C1 / tabla MINING) sin bloquear en Solana program work. On-chain claim + pump = **después** del mes (o al final), no prerequisite de day-0.

**Veredicto launch 2026-07-17:** prioridad = **subir test público/cerrado ya** (infra + carry exp + créditos + opcional soulbound shop). Arte hero premium, unbind F, pump = **después**.

---

### 1.8 Hero Set — look pixel premium (**FUTURO** — no bloquea test)

> **2026-07-17 · PO.** Posible implementación **después** del mes de test. **No** es requisito de launch ni de airdrop.

| | |
|--|--|
| **Qué** | Gear Hero Set (Ares/Elv) con **pixel art más nítido** (bordes limpios, metal/tela legibles), **misma silueta** Helbreath — no redibujar mapa/mobs. |
| **Refs internas** | [`docs/refs/hero-set-premium/`](./refs/hero-set-premium/) — copias de `ares hero set` / `elv hero set` (Desktop `CHAIN LORDS`). |
| **Por qué después** | El 90% del trabajo es **arte** (8 dirs × anims × capas M/W); el engine solo reemplaza `.spr` + pivotes. El mes de test prioriza **jugadores + créditos**. |
| **Cómo (cuando toque)** | Solo capas gear (cape/hat/robe/legs); NEAREST in-world; idle+walk primero; combat anims después; wire ids 400–428. |
| **No hacer** | Avatar semi-HD / blur LINEAR sobre tiles 32px; bloquear test por falta de este art. |

Detalle de implementación futura: README en la carpeta de refs + Fase F (fila arte). Unbind/mercado sigue en [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md).

### 1.9 Capacidad del server: AFK vs activo + mecanismos early (2026-07-18)

> Objetivo early/prod chica (~VPS $200/mes mental): **priorizar jugadores activos**.  
> Complementa (no reemplaza) la filosofía AFK vs flota de [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) § 0.

#### Recursos: AFK vs activo (conectado, char en mapa)

| Recurso | AFK (idle sin input) | Activo PvE | Activo PvP | ¿Kick AFK libera? |
|---------|----------------------|------------|------------|-------------------|
| **Cupo CCU** (1 slot online) | **Igual** (1) | 1 | 1 | **Sí — principal** |
| **RAM sesión** (WS, char, inv) | **Casi igual** | Alta | Alta | **Sí** |
| **CPU combate / skills** | Baja | Alta | Muy alta | Poco (si el lag es pelea) |
| **CPU AI mobs** | Baja–media* | Alta | Media–alta | Poco |
| **Red (broadcast)** | Baja | Media | Alta | Medio |
| **DB / autosave / loot** | Baja (save tick) | Alta | Alta | Poco |
| **Mint / middleware** | 0 si no claim | 0 salvo claim | 0 salvo claim | N/A |

\*El mapa con monstruos sigue tickeando; el AFK no apaga el mundo.

**Lectura producto:** AFK **≠** PvP en CPU, pero **=** activo en **asiento y RAM**. Kickeamos AFK para **capacidad y fairness de cupos**, no porque “pesen igual que un war mid”.

#### Política early sugerida (sintonizable · config)

| Zona / caso | Idle max (orientativo) | Notas |
|-------------|------------------------|--------|
| Hunt / dungeon / farm spots | **10–20 min** → warn → kick | Libera spots y CCU de farm AFK |
| Ciudad / safe | **30–60 min** o más laxo | Social; o más corto si hay auction offline |
| Con **stake $HELL alto** (umbral config) | Idle **extendido** o exento de kick “corto” | “Querés parkear el char online → skin in the game” |
| Soft offline XP drip | **OFF en prod** | No premies AFK (tool existe; no activar) |
| Multi-box cap | **ON** | Ya en AntiBotTools |

#### Mecanismos para liberar recursos (menú — early primero)

| # | Mecanismo | Qué libera | Esfuerzo | Notas |
|---|-----------|------------|----------|--------|
| 1 | **Kick idle por tipo de mapa** | CCU + RAM | Bajo (extender AntiBotTools) | Prioridad #1 early |
| 2 | **Auction / Sale House offline** | CCU de vendedores AFK | Medio | Listar y desconectar; MVP gold primero |
| 3 | **AFK privilege = mucho $HELL staked** | CCU “gratis” solo si stake | Medio (cuando stake live) | Utilidad de stake (C2), **no** yield; umbral alto en config |
| 4 | **Idle mode ligero** (menos broadcast/save) | CPU/red, **no** CCU | Medio | AFK barato en tick; cupo sigue ocupado |
| 5 | **Logout forzado a char select** tras idle | CCU + RAM | Bajo | Más agresivo que “kick to login” |
| 6 | **Canales / instancias** de farm saturado | CPU pelea densos | Alto | Cuando haya CCU real |
| 7 | **Cap de sesiones por wallet** | CCU multi-box | Ya parcial | Multi-box tool |
| 8 | **Cola de login cerca de cap** | Experiencia + prioridad guild | Medio | Idea 2026-07-12 ANTIBOT |
| 9 | **No regen / no drop credit si idle** | Incentivo a no AFK farm | Bajo–medio | Desincentivo sin kick inmediato |

#### Stake $HELL ↔ AFK (diseño)

- **Idea PO 2026-07-18:** quien quiere **quedarse AFK online** debe tener **gran cantidad de $HELL staked** (umbral alto, config; sintonía fina después).
- **Por qué:** convierte AFK en “pago de oportunidad” / skin-in-the-game; alinea con stake = **utilidad** (§ 1.6–1.7 C2), no dividendo.
- **No es:** yield por estar AFK; **no** fee-share; **no** “stake = salario”.
- **Comportamiento tentativo:**
  - Sin stake (o bajo umbral) → timers de kick **estricto** (sobre todo hunt).
  - Sobre umbral → timer **largo** o “park” permitido en ciudad / con restricciones (ej. no XP, no loot credit).
  - Unstake: respeta cooldown de stake; al caer bajo umbral, vuelven timers normales.
- **Depende de:** stake $HELL live (aún diseño). Early sin stake: usar solo **kick por zona + multi-box + auction**.

#### Orden de implementación sugerido (presupuesto chico)

1. Kick idle hunt/dungeon (config ms) + soft XP drip **OFF**.  
2. Multi-box cap ON.  
3. Auction offline MVP (cuando toque economía).  
4. Idle mode ligero si CCU alto pero CPU de pelea bajo.  
5. Gate **AFK extendido ↔ stake $HELL** cuando exista stake on-chain/off-chain usable.  
6. **Telemetría de carga por mapa/hora** → priorización dinámica (abajo).

#### Priorización dinámica de infra / workers por mapa y calendario (diseño 2026-07-18)

> Cuando haya que **priorizar recursos** (un VPS, N game-world workers, o varios shards): no repartir CPU “en partes iguales” a todos los mapas todo el día.  
> **Mandar capacidad a donde duele** — en la práctica early/mid, casi siempre **Middleland (ML)** y picos de pelea; las **ciudades** explotan en ventanas de raid/evento.

| Idea | Detalle |
|------|---------|
| **Calendario de eventos** | Días/horas **sin** raid de ciudad / crusade window → **bajar** budget de tick/AI/broadcast en Aresden/Elvine (o fusionar workers) y **subir** budget a **middleland** (+ huntzones calientes). |
| **Con raid / Heldenian / city war** | Invertir: más workers/prioridad a **ciudades + mid** involucrados; farm maps en modo “economy” (tick más lento, menos AI agresiva si hace falta). |
| **Sunday Arena** | Coliseum shard o worker dedicado en ventana del torneo; el resto del grid puede ir más light. |
| **Estadística (requisito)** | Series por **mapa + día-de-semana + hora (UTC o realm TZ)**: CCU, msgs/s, tick ms p95, CPU share, kills, teleports in. Dashboard simple (Prometheus/JSON rollup / tabla PG). |
| **Aplicación “inteligente”** | (1) **Manual ops** al inicio: cron + config `WorldResourceBudget` por franja. (2) **Semi-auto**: alertas “ML p95 tick > X”. (3) **Auto** solo cuando haya datos estables (evitar thrash). |
| **Palancas técnicas** | `GameWorldWorkers` / affinity mapa→worker; tick interval por mundo; cap de monstruos AI por mapa; AOI radius; rate de position broadcast; idle maps “sleep” si CCU=0. Ya existe multi-worker registry — extender con **weights por horario**. |
| **Qué no hacer early** | Autoscaling cloud caro sin métricas; mover jugadores entre shards a lo loco; optimizar ciudades 24/7 si están vacías a las 4am. |

**Producto / expectativa jugadores:** en horarios off-peak el farm de ciudad puede sentirse “igual”; en ML peak el server **prioriza** no morirse el tick. Comunicar solo si hay degradación visible (ej. “event mode”).

**Deps:** métricas de mundo (hoy parciales); calendario de eventos (config); sintonía fina de franjas cuando haya tráfico real.

### 1.10 Progression Chain Lords: rebirth L79, Block Level + Promise Land / PL Dungeons (2026-07-25)

> **Estado:** **diseño canónico PO** (append decisión § 5). Código hoy: rebirth resetea a **L1** (`GameWorldPlayer.ApplyRebirth`); majestics solo en **maxLevel**; spawns PL/farm dungeon aún parity Olympia parcial.  
> **Objetivo producto:** desparramar PvP y uso de mapas mid (PL outdoor + PL Dungeons) sin forzar a todo el mundo a push 150, y sin castigar a quien se queda farmeando majestic/upgrades.

#### A) Rebirth Chain Lords ≠ Olympia

| | Olympia / classic (ref) | **Chain Lords (este server)** |
|--|-------------------------|-------------------------------|
| Destino post-rebirth | Vuelve cerca del **inicio** (L1 / cycle start) | Vuelve a **level 79** |
| Exp al rebirth | Reset del ciclo | `exp = GetExpForLevel(79, rebirth)` (cumulativo Olympia table) |
| LU / stats | Rebirth LU bonus se mantiene como hoy | **Sin cambio** de `rebirthLuPoints` (6/RB) salvo sintonía posterior |
| Curva required | `iGetLevelExp` | **Igual** (no inflar table por RB; `rebirthExpMultiplierStep = 0`) |
| Exp obtenida post-RB | `0.8^RB` hasta L140 | **Igual** |

**Por qué L79:** el cycle mid (≈L80 GetExp cut + farm PL) es el “segundo home” del server; no castigar a L1 tras cada RB. El jugador re-sale del rebirth **ya en el bracket mid** (boost GetExp ≤80 casi apagado; camino a PL 110 / PL Dungeons 120).

**Implementación (cuando se codee):**

1. `Progression.json`: `rebirthResetLevel: 79` (default).  
2. `ApplyRebirth()` → `level = 79`, `exp = Progression.GetExpForLevel(79, newRebirth)`.  
3. UI/copy rebirth: “Restart at level 79”.  
4. Tests: L150→RB, level==79, exp table match, LU correct.

#### B) Block Level (botón) → majestic en vez de levels

| Campo | Spec |
|-------|------|
| **UI** | Botón **Block Level** (SysMenu / Character / Progression — exacto TBD; visible y reversible) |
| **Acción ON** | Congela el **level actual** del char. No sube de nivel aunque haya exp de kill/quest. |
| **Exp mientras ON** | Toda exp **nueva** se convierte a **majestic points** (misma lógica de overflow que max-level / `ApplyMajesticFromExp`, pero anclada al level bloqueado, no solo a `maxLevel` 150). |
| **Acción OFF** | Deja de convertir a majestic. La exp **nueva** vuelve a alimentar el bar de nivel hacia `level+1`. **No** convierte majestic ya ganados de vuelta a niveles. |
| **Casos de uso** | (1) Quedarse en bracket **PL outdoor (≤110)**; (2) quedarse en **PL Dungeons / mid (≤120)** para PvP/farm sin push; (3) farm majestics (angel/DK) sin subir. |
| **Caps de mapa (enforce server)** | Ver tabla C — block **no** salta caps de entrada; es elección de progression. |
| **Persistencia** | Flag `levelBlocked` (bool) + opcional `blockedAtLevel` en `state_json` / char state. |
| **Anti-abuse** | Toggle con cooldown corto opcional (ej. 30–60s) para no spam; sin cost gold en MVP. |

**Meta de diseño:** más gente “viva” en PL y PL Dungeons → **más PvP y uso de mapas mid**, menos mono-path “todo a 150”.

#### C) Caps de mapa (Chain Lords)

| Mundo | Id actual (repo) | Cap level (inclusive) | Notas |
|-------|------------------|------------------------|--------|
| **Promise Land (outdoor)** | `promiseland` · map `2ndmiddle` | **≤ 110** | Entrada / permanencia: kick o deny warp si `level > 110` (sintonía: soft warn vs hard block). |
| **Promise Land Dungeons** | Rebrand del **dungeon de farm Olympia** (hoy farm → `middled1n` / `middled1x`; renombrar display **Promise Land Dungeons**, max **120**) | **≤ 120** | Misma “altura” de contenido que el soft park L120. Mining nodes aquí. |
| Farms / cities / ML / resto | sin cambio de este corte | según reglas existentes | PL se alcanza desde `arefarm`/`elvfarm` teleports ya cableados. |

> **Nota L110 vs L120:** PL **outdoor** cierra en **110**. Quien quiera “frenar en 120” es para **PL Dungeons + PvP mid**, no para entrar outdoor PL por encima de 110. Block Level a L110 o L120 según el bracket elegido.

#### D) Spawns — Promise Land outdoor (`promiseland` / `2ndmiddle`)

IDs monstruo (repo `Monsters.json`): Rudolph **48**, Mountain Giant **38**, Troll **58**, Clay Golem **12**, Scorpion **50**, Stone Golem **28**, Skeleton **51**, Zombie **61**, Orc **40**, Cyclops **14**, Ogre **47**, Snake **3**.

| Mob | Count | Layout (PO) |
|-----|------:|-------------|
| **Rudolph** | **20** constantes | Diseminados a lo largo de la zona de spawn **a ambos lados del agua del medio**, y también en el **borde exterior del agua de la isla**. |
| **Mountain Giant** | **10** | Zona **alta montañosa de la derecha**: **5** debajo de los Stone Golems en la **mitad inferior** del mapa; **5** del lado Elvine a la derecha, en montañas a la **derecha de Skeletons**. |
| **Troll + Clay Golem** | pits en isla | **Isla del medio del mapa** — trolls y clay golems (reemplaza / redefine pits de isla). |
| **Scorpion / Stone Golem / Skeleton / Zombie / Orc** | Olympia-like | **Mismos lugares** que Olympia en PL, **excepto**: donde Olympia pone Clay Golems → **segundo pit de Stone Golems**. |

Implementación: reescribir `dwellAreas` de `promiseland` (hoy 11 pits genéricos). Preferir rects acotados (no un solo box enorme) para “diseminado”.

#### E) Spawns + mining — Promise Land Dungeons (ex farm dungeon)

| Elemento | Spec |
|----------|------|
| **Identidad** | Display **Promise Land Dungeons**; cap **L120**; acceso desde farms (hoy TP a `middled1n`) + sintonía de nombres en UI/minimap. |
| **Mining — cristales** | **6** nodos cristal **diseminados** por el mapa (minoria; no saturar). |
| **Mining — coal / mats** | **20** nodos en las zonas clásicas de coal/mining del dungeon. |
| **Cyclops** | **1 pit grande y extenso** en la **isla del medio**. |
| **Orcs** | **2 pits grandes** cerca de **cada salida** del dungeon: lado Elvine ~**50,40**; lado Ares simétrico del otro acceso. **Además:** donde estaban pits de **serpientes** → **pits de Orcs**. |
| **Stone Golems** | **2 pits grandes** donde estaban pits de orcs “de arriba”: ~**170,35** y abajo ~**40,180**. |
| **Ogres** | **~8** diseminados **alrededor de la isla**, caminando por los **pasillos del contorno del agua**, cubriendo la extensión; **evitar puentes** (no estacionar/bloquear bridges). |

Coords = orientativas PO; al implementar, alinear a walkable tiles del `.amd` y no pisar teleports.

#### F) Checklist de implementación (orden sugerido)

1. `[cheap]` `rebirthResetLevel: 79` + `ApplyRebirth` + UI copy.  
2. `[cheap]` Flag `levelBlocked` + ruta exp kill → majestic cuando ON; OFF → levels.  
3. `[cheap]` Botón Block Level en UI + status en F5/paperdoll/progression.  
4. `[cheap]` Enforce cap PL ≤110 / PL Dungeons ≤120 en warp + periodic check.  
5. `[cheap]` Reescritura `dwellAreas` promiseland (tabla D).  
6. `[cheap]` Reescritura dungeon (`middled1n`/`middled1x` o world id dedicado) + display name (tabla E).  
7. `[cheap]` Mining nodes 6 crystal + 20 coal (reusar pipeline mining/pickaxe existente o stub si falta).  
8. `[fable]` Pass balance counts vs población real post soft-test.

#### G) Fuera de este corte

- No cambia `maxLevel` 150 / majestics en cap absoluto.  
- No cambia milestones Frost/Unicorn.  
- No obliga Block Level; es opt-in.  
- Arena/torneo brackets siguen independientes.

### 1.11 Combat feel vs Helbreath War — Capas A/B/C (2026-07-30)

> **Referencia vivida:** stream **Ditizar** en Discord Cheseline · server **Helbreath War** (100+ on constantes), dens ToH3, multi-PvP.  
> **Notas de sesión:** [`refs/HELBREATH-WAR-LIVE-NOTES.md`](./refs/HELBREATH-WAR-LIVE-NOTES.md).  
> **Objetivo:** igualar o acercarnos **decentemente** al feel dens (transiciones, cancel→para→burst, sin bump, server snappy).  
> **Única distancia aceptable (PO):** límites **browser** + **ping/hosting** — no “es browser” como excusa de mecánica.  
> Complementa Olympia gap: [`OLYMPIA-PVP-FEEL-GAP.md`](./OLYMPIA-PVP-FEEL-GAP.md).

#### Observables en War (checklist de producto)

| Observable | Descripción |
|------------|-------------|
| Transiciones rápidas | Buff → Cancel → Para → burst sin “congelar” el sprite |
| Server snappy / bajo delay | Respuesta inmediata; 100+ dens sin feel de lag artificial |
| Swap de ropa ágil | Equip/unequip casi instant en client |
| Sin bump / wall stick | Wall-slide; no rubber-band al chocar pared |
| Quest UI | Texto **dorado serif** flotante a la derecha (sin caja); `title` + `key: cur/max` |
| Floats | Verde propio / rojo hostile; nombres con guiones + `!` |
| Drops post-PK | Panel `Drops (n/s)` sobre corpse inmediato |
| Invi swarm | Scouts invi + Detect; destape al buff/pegar |

#### Factibilidad (veredicto PO)

| Meta | Veredicto |
|------|-----------|
| Igualar 1:1 client nativo War | **No realista** (browser JS/WebGL + WS vs C++/protocolo clásico) |
| Acercarse decente en reglas + snappiness percibida | **Sí** — sprint de feel engineering + parity |
| Mejor que War en UX/logs/arena | **Sí** (deseable) |

#### Capa A — Reglas / feel de pelea (alta factibilidad) · **PRIORIDAD**

- [x] **DamageMove** umbral **≥50** open / **≥80** fightzone·arena·colosseum (PvP + monstruo→player + monstruo spell; monstruo recibe kick si dmg ≥ umbral) — `Combat.cs` / `GameWorldMonster.cs` (2026-07-30)
- [x] Equip Str/level gates + cast weapon class + shield auto-unequip (Devlin 1320–1322 cast OK)
- [ ] Cancel → Para → burst: validar MP costs / strip AMP / lockout vs tablas War (medición live)
- [ ] Floats bicolor + hyphen spell names (client)
- [ ] Quest overlay tipografía dorada serif (client)
- [ ] Corpse Drops panel parity UX
- [ ] Safe attack + invi break (audit residual)

#### Capa B — Snappiness implementable (media–alta) · **PRIORIDAD**

- [x] Melee damage delay más temprano: `AttackSpeedMs * 2/5` (floor 28ms) en vez de `/2`
- [x] Wall-slide mejorado: 45° + mejor vecino libre hacia dest; **no rubber-band** duro en pared (PositionCorrected stay)
- [x] Course correction ya ON en `Settings.json`
- [x] Equip optimistic ya existe (`predictEquipItem`)
- [x] Cast start local ya envía `SpellCastStart` en anim start
- [ ] Métricas: p95 move ack, equip RTT, cast-start visual delay (log opcional)
- [ ] Reducir broadcast/AOI pressure en dens (tune, no rediseño)

#### Capa C — Techo plataforma (mitigar sin romper)

- [ ] Prediction movimiento residual / interpolación observers (sin romper anti-cheat)
- [ ] Quality settings dens (FX cap) — opt-in
- [ ] Hosting regional cuando CCU lo pague
- [ ] No prometer 15 ms globales ni 100 sprites dens a 60 FPS en browser

#### Orden de trabajo (este corte)

1. Docs MASTERPLAN + live notes (**hecho**)  
2. A: DamageMove 50/80 (**hecho código**)  
3. B: delay melee + wall-slide (**hecho código**)  
4. Deploy server  
5. Siguiente: floats/quest typography client + métricas  

#### Paths código

| Área | Path |
|------|------|
| DamageMove | `multiplayer/server/Helpers/Combat.cs` (`GetDamageMoveThreshold`, `TryApplyDamageMoveStep`) |
| Mob→player kick | `multiplayer/server/World/Game/GameWorldMonster.cs` |
| Wall-slide | `multiplayer/server/Helpers/Movement.cs` (`TryCourseCorrectStep`) |
| Live notes | `docs/refs/HELBREATH-WAR-LIVE-NOTES.md` |

---

## 2. Arquitectura (paths reales)

```
helbreath-base-game/
├── docs/
│   ├── MASTERPLAN.md                 ← bitácora canónica (changelog denso + roadmap)
│   ├── BITACORA.md                   ← log legible por sesión (companion)
│   ├── LEGAL-IP-RESEARCH.md          ← research IP Helbreath (no es consejo legal)
│   ├── LEGAL-CHECKLIST.md            ← checklist ToS / privacy / crypto / torneos
│   ├── FRAMEWORK-MULTIMODELO.md
│   ├── TOURNAMENT-BUILD-CREDITS.md
│   ├── HERO-SET-UNBIND-MARKET.md
│   ├── EK-LEDGER.md                  ← Enemy Kills (Diseño; Fase G)
│   ├── GUILDS-AND-LEGACY-AIRDROP.md  ← Guilds + legacy airdrop (Diseño; Fase H)
│   ├── ANTIBOT-AIRDROP.md            ← PoH claim + guild ingress + AFK vs flota (idea)
│   ├── TRAINING-ARENA.md             ← Training / practice map (Fase 2 spawn+chase)
│   ├── BEGINNER-PATH-1-80.md         ← path opcional + Farm Barracks
│   ├── SPAWN-PIT-PARITY.md / MONSTER-DROP-PARITY.md / SPELL-CC-AUDIT.md
│   ├── CRYPTO-LOOT-AND-NFT-SWAPS.md  ← research DIY swaps (no integrar AGLD)
│   ├── REFERENCE-HELBREATH-ARGENTINA.md ← Notas IG HB Arg (diseño/producto)
│   ├── NFT-OPS-RUNBOOK.md            ← mint/claim ops + lease
│   └── HUMAN-TECH-WAAP.md            ← WaaP/Passport research (SKIP WaaP · WATCH Passport)
├── landing/                          ← chainlords.net: World/Arena panels, Play wallet, EK side, arena-1v1/3v3
├── landing-api/                      ← realm-stats cache (Railway) for public counters
│   ├── index.html, styles.css, chainlord-extras.css, main.js
│   ├── img/ + gameplay-teaser.mp4
│   └── README.md
├── multiplayer/
│   ├── proto/network.proto           ← contrato WebSocket + Protobuf (única fuente de verdad de red)
│   ├── server/                       ← C# / .NET 10, autoridad de juego
│   │   ├── Config/
│   │   │   ├── Items.json            ← catálogo Chain Lord (ref. clásica)
│   │   │   ├── Monsters.json
│   │   │   ├── Spells.json
│   │   │   ├── GameWorlds.json       ← incluye `colosseum` + tournamentArena + `training` + trainingArena
│   │   │   ├── Progression.json      ← maxLevel 180, maxRebirth 20, milestones
│   │   │   └── Tournament.json       ← loadout equal-footing (hero set + potions)
│   │   ├── Helpers/
│   │   │   ├── Combat.cs, Casting.cs, Spawn.cs, GroundItemPickup.cs
│   │   │   ├── Progression.cs        ← exp, rebirth, claim milestones
│   │   │   ├── NftDropEvaluator.cs   ← rare | super_rare whitelist
│   │   │   ├── NftDropLedger.cs
│   │   │   └── PvpKillLedger.cs      ← pvp_kills + Elo rated en arena
│   │   ├── Persistence/
│   │   │   ├── schema.sql            ← accounts, characters, drop_ledger, PvP/torneos
│   │   │   └── GamePersistenceService.cs
│   │   ├── Auth/                     ← WalletAuthValidator, WalletPubkey
│   │   ├── Utils/                    ← InventoryManager (ApplyTournamentLoadout), NetworkManager
│   │   └── World/Game/               ← GameWorld, GameWorldPlayer (stash torneo)
│   ├── mp-client/                    ← Phaser 3 + React
│   │   └── src/
│   │       ├── proto/generated/      ← codegen desde network.proto
│   │       ├── ui/dialogs/           ← Inventory, Character, Skill, MobKills, Tournament, Death…
│   │       ├── ui/store/             ← NftClaims, Progression, TournamentDialog…
│   │       └── utils/                ← NetworkManager, walletAuth, dropLedger, tournamentApi
│   ├── docker-compose.yml            ← Postgres local
│   └── scripts/                      ← start-postgres, start-stack, init-postgres
├── middleware-node/                  ← Express: auth, drops, mint, torneos/Elo/HoF
│   ├── server.js, auth.js, drops.js, mint.js, collection.js, metadata.js
│   ├── tournaments.js                ← CRUD torneos, bracket, leaderboard, decay, prizes
│   ├── persistence.js, umi.js, authority.js
│   └── scripts/init-devnet-collection.js
└── sp-client/                        ← single-player (referencia / explorer; no es el MP)
```

### 2.1 Flujo de datos

```
[Phantom/Backpack] --SIWS--> [mp-client] --WS+Protobuf--> [multiplayer/server C#]
                                    |                           |
                                    |                           v
                                    |                     PostgreSQL
                                    |                     (schema.sql)
                                    v                           ^
                            [middleware-node] ------------------+
                                    |
                                    v
                            Solana (cNFT mint rare / super_rare)
```

| Capa | Responsabilidad |
|------|-----------------|
| **mp-client** | UI, predicción de movimiento, wallet connect, claim NFT, dialogs F-keys, TournamentDialog |
| **server (C#)** | Autoridad: combate, drops, progression, torneo loadout/stash, PvP kills + Elo, persistencia |
| **proto** | Contrato; server y client se despliegan en sync — no fallbacks “campo faltante” |
| **Postgres** | Ver § 2.2 |
| **middleware-node** | Sesión wallet, drop claim/mint, torneos/bracket/leaderboard/HoF/prizes, authority |

### 2.2 Tablas relevantes (`schema.sql`)

| Tabla | Rol |
|-------|-----|
| `accounts` | Wallet pubkey, login |
| `characters` | Char persistido (`state_json`, mundo, posición) |
| `drop_ledger` | Drops NFT-candidatos; `nft_tier` (`none`/`rare`/`super_rare`); claim/mint |
| `pvp_kills` | Cada kill PvP (fuente de verdad de resultados; base para EKs) |
| `enemy_kills` (propuesto) | Ledger EK con `ek_value` / elegibilidad — ver Fase G + `EK-LEDGER.md` |
| `tournaments` | Directorio; `prizes_json`; status draft→finished |
| `tournament_participants` | Entrants (solo o team) |
| `tournament_matches` | Bracket single-elim; `arena_world_id` (default `colosseum`) |
| `pvp_ratings` | Elo por wallet+mode; peak, wins/losses, last_match |
| `rating_events` | Audit append-only de deltas (match, bonus, decay) |
| `hall_of_fame` | Campeones / títulos por torneo |
| `tournament_prizes` | Ledger custodial pending/paid + `tx_signature` |

### 2.3 Config clave (números viven en JSON, no en literales de combate)

- `multiplayer/server/Config/Progression.json` — milestones `frost-50000`, `unicorn-5000`, `max-rebirth`
- `multiplayer/server/Config/Tournament.json` — equipped + bagItems del loadout arena
- `multiplayer/server/Config/GameWorlds.json` — `"id": "colosseum"`, `"tournamentArena": true`
- `middleware-node/.env.example` — `DATABASE_URL`, colecciones Rare/Legendary, `SOLANA_RPC_URL`, `ADMIN_API_KEY`

---

## 3. Changelog — julio–agosto 2026

> Al cerrar trabajo: agregar línea fechada aquí (append) y marcar checkboxes en § 4.  
> Sesión legible: [`BITACORA.md`](./BITACORA.md).  
> Handoff PC-reset: [`SESSION-HANDOFF-2026-08-05.md`](./SESSION-HANDOFF-2026-08-05.md).

### 2026-08-05 — Arena desk + $HELL incentives + kit free/credits + cast/mana + spell gates

- [x] Landing Arena: Phaser desk + React BI strip / jump tabs; footer no solapa BI
- [x] Incentivos: AFK BI 2h→**5k** $HELL; duel **10k**; stream **20k**; ledger UTC; anti-AFK off en BI; X+Discord announce
- [x] Kit catalog: free path war/mage; free HP/MP sets; ban Cape plain; credits DR/MR+MCon capes
- [x] Mage hero Cap/Robe/Hauberk sprites (416/420 + gender fallback); dual-magic armor display
- [x] Blood Rapier STR 39 / 1 FS; Merien Shield STR 40; Angel INT en spell gates
- [x] Cast ~1200 ms full / ~1800 slow; mana costs `Magic.cfg` (`MagicManaCatalog`)
- [x] Arena credit-only: Inhib/Cancel/Sleep (45/46/52); sanitize SKU `set-hp50-war` unknown
- [x] Deploy VPS client+server (`46.224.129.38` /opt/chainlords)
- [x] Docs: BITACORA + este changelog + SESSION-HANDOFF; backup GitHub + Google Drive pre PC-reset
- [ ] Mass Blizzard credit gate (PO)
- [ ] Re-verify loadout/sprites post hard refresh / post PC-reset

### 2026-07-30 — PvP feel gap (Capa A+B) + Helbreath War dens feel

- [x] Olympia DamageMove: dmg ≥50 open / ≥80 fight zone (Server.cpp) documentado
- [x] Doc [`OLYMPIA-PVP-FEEL-GAP.md`](./OLYMPIA-PVP-FEEL-GAP.md) + brief grabación Tola
- [x] Live **Helbreath War** (Ditizar): notes [`refs/HELBREATH-WAR-LIVE-NOTES.md`](./refs/HELBREATH-WAR-LIVE-NOTES.md)
- [x] MASTERPLAN § **1.11** Capas A/B/C factibilidad + checklist
- [x] **Implement DamageMove 50/80** PvP + mob→player + monstruo kick por dmg
- [x] Melee hit delay más snappy (`AttackSpeed*2/5`)
- [x] Wall-slide amplio + soft-correct (sin reset duro en pared)
- [ ] Capa C: videos Tola Olympia + CL; prediction residual; dens FX cap
- [ ] Client: floats/quest typography War-like

### 2026-07-30 — Tutelary Angels (Gail / max-level majestics)

- [x] Relevo Olympia: 5 maj por Angel STR/DEX/INT/MAG (Gail CMD Hall); equip nibble+1; upgrade maj
- [x] Claim server `CityNpcServices` + UI Gail/Perry
- [x] Tip chat primer majestic; doc [`OLYMPIA-ANGELS.md`](./OLYMPIA-ANGELS.md)
- [x] Deploy prod

### 2026-07-30 — Item magic affixes Olympia (P2.7 + drops)

- [x] Tablas primary/secondary/color (Light/Sharp/Agile/Righteous/Poison/Ancient/CP; **Strong off** armas)
- [x] **Daño base flat** por calidad: Sup +1 · Sup Sharp +2 · Exc Sharp +3 · Sup Ancient +3 · Exc Ancient +4 (Sharp = Ancient−1)
- [x] **No** `Damage+value×7` (tooltip vanilla mentiroso) — `WeaponQualityBaseDamage`
- [x] Secondary HR / CAD / Exp / Gold **+1..+7**; wands MS catálogo + CP/HP/MP vamp
- [x] **Rares puros** (`IsPureRareDrop`) — sin Sharp/HR/Exp
- [x] Doc [`OLYMPIA-ITEM-MAGIC-AFFIXES.md`](./OLYMPIA-ITEM-MAGIC-AFFIXES.md) + P2.7 + decisión § 5
- [x] Deploy prod: `chainlords-game` + client tooltips

### 2026-07-18 — Capacidad / AFK vs activo + stake para parkear (diseño)

- [x] Tabla recursos AFK vs PvE vs PvP (CCU/RAM ≈ iguales; CPU combate AFK << activo)
- [x] Kick early por zona (hunt estricto; ciudad laxo); soft XP drip OFF en prod
- [x] Menú mecanismos: auction offline, idle ligero, multi-box, cola login, no credit si idle
- [x] **AFK extendido ↔ gran stake $HELL** (utilidad C2; no yield) — umbral config, sintonía fina
- [x] § **1.9** + § 5 + [`BITACORA.md`](./BITACORA.md)
- [ ] Código: timers por map-tag; wire stake check cuando stake exista


### 2026-07-18 — Priorización dinámica ML vs ciudades + stats por franja (diseño)

- [x] Idea PO: sin ventana de **raid de ciudad** → mandar presupuesto de workers/tick a **Middleland**
- [x] Con raid/war/Sunday Arena → reasignar a mapas del evento
- [x] Requisito: telemetría **mapa × día × hora** (CCU, tick p95, msgs, kills)
- [x] Fases: manual cron → semi-auto alertas → auto con cuidado
- [x] Documentado § **1.9** + § 5 + [`BITACORA.md`](./BITACORA.md)
- [ ] Código: rollup métricas por mundo; `WorldResourceBudget` / weights por franja

### 2026-07-18 — Mint centralizado + fee ~USD 0.20–0.50 (política · sintonía fina)

- [x] **Política PO:** mint cNFT **centralizado** (authority mint + airdrop); user **pide** → server cobra → mint → airdrop
- [x] Fee anti-spam banda **~USD 0.20–0.50** (o equiv. $HELL); no mint gratis; no mint auto mid-loot
- [x] Elegibles: piezas ~**USD 30+** (whitelist itemIds en config)
- [x] Anti-abuse: rate limit, lease/idempotencia, no self-mint client-only
- [x] Documentado § 1.1 + § 5 + [`BITACORA.md`](./BITACORA.md)
- [ ] **Código:** cablear cobro fee en claim/unbind + config montos/FX $HELL (sintonía fina en test)
- [ ] Review seguridad authority wallet / Squads `[fable]`

### 2026-07-18 — Landing chainlords.net + realm stats + Arena Sunday inscription

**Landing (Railway `chainlords-landing` · https://www.chainlords.net)**

- [x] Layout 3 columnas: grises **360px** World / Arena + centro manifesto Solana + video + wallet seed guide
- [x] Merge World/Arena en bandas grises (sin path-rails externos); títulos World/Arena **+30%**
- [x] **Play Now** (Phantom) → middleware auth → deep-link traveler `mode=world` → SELECTCHAR; HTTPS mixed-content fallback `autologin=1`
- [x] Contadores live: online / Bleeding / Buildings / PVP-PVE (`RealmStats` + `landing-api` / local `:1337`)
- [x] **EK Gallery** bajo stats verdes: mecánica ±10 + rareza top 10/50/200 + copy rankings Legendary/Rare/total
- [x] Arena Sunday copy: 3v3 / 1v1, credits maxed, warning defense, USDT prizes
- [x] Pages `arena-1v1.html` / `arena-3v3.html` + `arena-inscription.js/css`
- [x] Middleware `GET /arena/week`, `POST /arena/week/register` (memory o Postgres)
- [x] **Tennis-style seeding** en `buildRoundOneSlots` (ATP recursive; #1/#2 opposite halves) para preview + start bracket
- [ ] Middleware/play **HTTPS público**; montos USDT prize pool; lock draw ops UI
- [x] [`BITACORA.md`](./BITACORA.md) entrada 2026-07-18

### 2026-07-14 — Checklist mes de test (§ 1.7.4 · docs)

- [x] **§ 1.7.4** Checklist mes de test (público/cerrado): producto/persistencia, infra, landing, wallet/$HELL mining MVP, legal/copy, ops
- [x] Snapshot **docs vs implementado** (C1–C13 / MINING = docs only; chars/NFT claim/landing shell = viven)
- [x] Path mínimo 1–2 semanas: play-mine = **créditos off-chain pending**; **sin** pump/contratos day-0

### 2026-07-14 — $HELL play-mine MVP (código)

- [x] Server ledger `HellMiningStore` (`Chars/hell-mining.json`) + credit hooks (kills / EK / Timed Challenge) + UTC settle
- [x] Proto `HellMiningStatus` / claim guidance + SysMenu pending UI (utility copy)
- [x] Middleware `init-hell-token` (devnet SPL + alloc vaults) + `POST /hell/claim`
- [ ] Vesting unlocks / pump.fun / stake discounts / city killer ladder for legendary EK — **TBD**
- [x] Política PO documentada: exp carry → main; wipe solo progresión si bugs de exp
- [x] [`BITACORA.md`](./BITACORA.md) entrada 2026-07-14 — **solo docs; sin commit**

### 2026-07-14 — Olympia Parity Roadmap (auditoría screenshots · docs)

- [x] Auditoría visual de `SAVE\Helbreath Olympia #0–#119.jpg` + `SAVE\eks\` + `beta\contents\windows.json` vs `mp-client/src`
- [x] Nueva § **Olympia Parity Roadmap (P1–P3)** al final de § 4: 7 gaps P1 (quest tracker HUD, system log coloreado, chat overhead, minimapa esquina, reloj/día-noche, Required Exp, HP bar target), 12 P2 (chat tabs/whisper, EXP ticker + rested, spell announces, cadenas de daño, status effects, muerte Restart!, tooltips ricos, bag plus, party, clima, screenshot key, F5 completo), 9 P3 (crafting/enchant/upgrade, Options tabbed, Cash Shop, guild window, sociales, death recap, rebirth/statistics, special ability, watermark) — evidencia por screenshot + archivo destino
- [x] Quick wins y orden propuesto documentados; **sin implementación de UI en este pass**
- [x] [`BITACORA.md`](./BITACORA.md) entrada 2026-07-14 (puntero)
- [x] **P1.1 + P1.2 client HUD** (mismo día, pass posterior): `QuestTrackerHud` + `SystemLogOverlay` — BeginnerPath / milestones / TimedChallenge / HP / pickups / tips; hunt/daily proto + SP ticker **TBD**
- [x] **P1.7** target mob HP bar: Olympia-style `MonsterHoverOverlay` (red name + `(Berserked)` + HP strip), attack-target persist, FOE skull on remotes, HotkeyBar cyan `Poisoned` (no duration/N). Sin commit.

### 2026-07-14 — Gameplay / UI bugfix + economía in-game + landing Olympia

**Mundo / NPCs / warps**

- [x] **Church exit warps** (`arecath` / `elvcath`): interior → exterior doorstep arreglado
- [x] **City guards:** 4 Guard (id 31) random-walk **≤3 tiles** del TP pad (Aresden/Elvine) — ver `GameWorlds.json` `_cityGuardNote`
- [x] **Shop NPC** reposicionado a altura de **chimenea**; click → approach cell (no path onto NPC) — **todos los NPCs**
- [x] **Aresden TP water race:** client map reload antes de pintar coords ciudad (sigue relevante si reaparece)

**Progression / F-keys / combate**

- [x] **Level-up LU points** + **Level Set OK** + vitals (HP/MP) por fórmulas Olympia (`Progression.CalcMaxHp` / etc.)
- [x] **F8 Skill:** scroll + detail al click; **PVP Skills** Mode 2 guards waves **1→2→2→2→3**; Mode 3 darkelf + invi pot + PFA setup — [`TIMED-CHALLENGES.md`](./TIMED-CHALLENGES.md)
- [x] **Peace / Attack / Safe** modes (IconPannel recess); **RMB standstill attack** (sin pathfind); **Olympia player hover**
- [x] **Player list** resync; **ground drops** depth; **EXP bar** within-level en IconPannel
- [x] **F6** fonts + botones estilo Achievements (Bag / Item Drops / Auction)
- [x] **SELECTCHAR** texto en líneas de parchment; **IconPannel** altura Olympia **48/800** (`OlympiaUiScale`)
- [x] **Bag icon** scale control (F6)

**Economía / Item Drops / shop (código)**

- [x] **Auction board MVP** (C6 · gold ledger) — ver entrada 2026-07-13
- [x] **Item Drops** layout **~60% lista / ~40% detalle**; **Vender por gold** con fórmula Olympia (`OlympiaSellPrice` / `SellBagItem`); Crear NFT / Recycle shards = **parcial / TBD**
- [x] **Shop qty wheel** (mouse wheel 1–max) en ShopDialog
- [x] C1–C13 tokenomics **docs locked** (sin contratos) — sin cambio de política hoy

**NFT / EK / landing**

- [x] **NFT claim:** `parseLeaf` + commitment **finalized** + retry (`middleware-node/mint.js`)
- [x] **EK screenshot MVP** + rareza galería (doc) — [`EK-SCREENSHOT-GALLERY.md`](./EK-SCREENSHOT-GALLERY.md); ladder ciudad real = **TBD**
- [x] **Landing** shell **Olympia-identical** usable (`landing/` + README) — Spectate embeds / art swap = **TBD**

**Ops / opens (siguen TBD)**

- [ ] Auction on-chain $HELL / phishing allowlist (C6)
- [ ] Caps combate stake § 1.6 vs § 1.7 (**TBD reconcile** · open #26)
- [ ] C13 montos/% (open #41); delta liq 300M vs pump 200M (open #38); Meteora earmark (open #40)
- [ ] Guild upgrade / create-join real (Fase H)
- [ ] Review seguridad claim orphan `[fable]`
- [x] [`BITACORA.md`](./BITACORA.md) entrada 2026-07-14

### 2026-07-13 — Auction / trade board MVP (C6 · código)

- [x] Proto auction board (browse/create/bid/buy/cancel/settle debt) + snapshot/result
- [x] Server: list / match / expire / 5% fee / debt &lt; 3d / city·guild·player·rep gates; JSON persist `Chars/auction-board.json`; PG tables stub in schema
- [x] Client: SysMenu → Auction Board dialog (browse/create/debt)
- [x] Mock vs real: bag gold settle; on-chain $HELL non-custodial **not wired**; guild/rep stubs
- [x] [`BITACORA.md`](./BITACORA.md) + § 1.7 mapa update
- [ ] On-chain wallet settle / phishing allowlist (C6) still TBD

### 2026-07-13 — Mapa economía § 1.7 + guild upgrade status (docs polish)

- [x] § **1.7**: **Mapa rápido** agrupa supply/alloc · C8–C13 · stake no-yield · revenue · guild econ · próximo slice (auction → shops → guild upgrades = **planned/TBD**)
- [x] TOC § 1 → ancla mapa; [`BITACORA.md`](./BITACORA.md) entry
- [x] Veredicto guild upgrade: **not built** (stubs UI + Howard interest; sin upgrade/level costs en server/proto)
- [x] Auction MVP **started** (gold ledger); shops premium / guild upgrade still open

### 2026-07-13 — $HELL cash-out personal / treasury + black-swan C13 (política locked · docs)

- [x] § **1.7**: decisión **C13** — post-éxito Meteora Phase-2: realización limitada offchain (seguridad / offramp vía entidad); fuentes preferidas fees + revenue juego + vested team capped + salary ops; **no** LP pull rutinario PumpSwap (C10); trim capped solo team MM capital pre-declarado; black-swan reinject playbook; marketing freeze
- [x] Open #41: banda $/% + mix fees vs trim team MM = TBD
- [x] Canvas `helbreath-dex-liquidity-robinhood-base` + [`BITACORA.md`](./BITACORA.md) + Decisión § 5
- [ ] **No contratos** / sin montos hardcodeados

### 2026-07-13 — $HELL launch/LP/fees DEX C8–C12 (política locked · docs)

- [x] § **1.7**: decisiones **C8–C12** — pump.fun ~20% (200M) launch path; earmark partnerships ~10%/100M → Phase-2 Meteora opcional; LP almost-never withdraw (excepción primeras horas si explosión anormal); fee target 30/70 solo Phase-2 configurable; en pump 100% creator-share → treasury; **no** Token-2022 transfer tax
- [x] Delta vs bucket liq **300M/30%** documentado (resto/re-split TBD); Base sigue #1 constelación; pump = awareness Solana
- [x] Canvas `helbreath-dex-liquidity-robinhood-base` + [`BITACORA.md`](./BITACORA.md) + Decisión § 5 + opens #38/#40
- [ ] **No contratos** / no overwrite canónico allocations 300M

### 2026-07-13 — $HELL ~20% LP DEX + Robinhood Chain vs Base (research · docs)

- [x] § **1.7**: subsección liquidez inicial DEX (~20% bajo estudio; delta vs bucket 300M/30%); opciones A1–A4 + postura lock/disclose/no-piso — **superseded parcial** por C8–C12 (path cerrado; delta 300M sigue open)
- [x] § **1** trayectoria: Robinhood Chain watchlist; Base sigue P1 constelación; travel pass intacto
- [x] Canvas `helbreath-dex-liquidity-robinhood-base` + [`BITACORA.md`](./BITACORA.md)
- [x] Path ~20% pump **cerrado** (C8); subset/re-split 300M = **sigue open**
### 2026-07-13 — $HELL stake/mine/descuentos/mercado (decisiones cerradas · docs)

- [x] § **1.7**: bloque **Decisiones cerradas C1–C7** — $HELL solo play-mine (no stake); stake = utilidad + descuentos soulbound capped; mercado espontáneo maxxed no shilleado; freeze yield/fee-share/DEX-floor/stake=dinero; auction non-custodial + allowlist TBD; recycle ~50% sin payout a stakers
- [x] § **1.6**: overflow “rent/rebates” marcado **superseded**; fila descuentos + prohibido económico; estudio luck/drop **preservado** + **TBD reconcile** combate
- [x] Freeze marketing ampliado; Uso/$HELL y STAKE reescritos a una sola historia coherente
- [x] [`BITACORA.md`](./BITACORA.md) + callouts en canvases `helbreath-hell-tokenomics-legal-econ` y `helbreath-gov-staking-rep`
- [ ] **No código** shop/stake/mine/auction — catálogo descuentos + caps combate siguen open

### 2026-07-13 — $HELL utilidad / no-shill / DEX fees / retención (PO · tentativo · docs)

- [x] § **1.7**: postura PO — MC no promesa; utility staking char/guild; disclaimer MC orgánico >$1M (no target); estudio DEX fees TBD; contingencia burn team; fee P2P ~5%; recycle ~50% torneos/marketing/hire
- [x] Freeze “marketing nunca dice” alineado al PO
- [x] [`BITACORA.md`](./BITACORA.md) + canvas `helbreath-hell-tokenomics-legal-econ` (pump.fun/PumpSwap fees, liability retention, 50% recycle, burn vs unlock)
- [ ] **No código** DEX / contracts / marketplace fee — counsel + entity structure pendientes

### 2026-07-13 — ARPU / embudo consumibles (PO · tentativo · docs)

- [x] § **1.7**: tesis trust on-chain vs private (moneygrab + GM black market); Cape/Shoes MUST ~$30 / ~$50 par; early 50–100 buyers; Olympia ≥~500; piedras Xelima/Merien ~$1 + bulk packs
- [x] Escenarios Low/Mod/Optimista × $1/día **conservados**; puente ARPU año 1 ilustrativo + nota honesta (sesgo Olympia, retención, whales)
- [x] [`BITACORA.md`](./BITACORA.md) + canvas `helbreath-hell-tokenomics-legal-econ` (mitigantes trust/must-have vs riesgos P2W / securities marketing / packs)
- [ ] **No código** de shop / consumibles on-chain

### 2026-07-13 — Tokenomics $HELL (tentativo · docs)

- [x] **§ 1.7** tentativo PO: supply 1B, allocations, stake drop 1–20% / max 20 luck, Guildmaster collective stake, uso consumibles/exp, mining 500k/día + tabla créditos
- [x] Escenarios revenue optimista/mod/low documentados; footnotes de verificación matemática (sin “corregir” cifras PO)
- [x] § **1.6** anotado: topes luck +5% / drop +8% = estudio previo; **TBD reconcile** vs § 1.7 (no borrar)
- [x] Entrada [`BITACORA.md`](./BITACORA.md); canvas gov-staking callout de supersesión
- [x] Canvas stress-test econ+legal `helbreath-hell-tokenomics-legal-econ` + cross-link § 1.7
- [ ] **No código** token / staking / mining — counsel + reconcile pendientes

### 2026-07-12 — Gov staking → reputación (diseño · docs)

- [x] **§ 1.6** visión: stake gov → R wallet → luck/drop capped; overflow → gov/WL/rent; unstake cooldown + decay
- [x] Caps ejemplo documentados (luck +5%, drop +8%, rare ≤+3%/0, combate/torneo 0); ~25k u → R=100
- [x] Canvas `helbreath-gov-staking-rep` + § 7 en multichain strategy; entrada [`BITACORA.md`](./BITACORA.md)
- [ ] **No código** de mecánicas in-game / contrato aún — sim curvas + counsel rent pendientes

### 2026-07-12 — Timed Challenges (diseño · docs)

- [x] Doc satélite [`TIMED-CHALLENGES.md`](./TIMED-CHALLENGES.md): Mode 1 Skills (10 NPCs, Chill→protocolo, mana free, rewards EXP/Stone of Integrity, leaderboard diario); Mode 2 **TBD** (frase cortada); anti-abuso vs farm industrial de stone; **implementar después** de definir Mode 2

### 2026-07-12 — Anti-bot / capacidad (idea · docs)

- [x] Doc satélite [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md): PoH/Passport en **claim** (no login); **guild-priority ingress** cerca de cap; menú de segmento para cuentas nuevas; riesgos (venta de slots, Sybil guilds, newbies)
- [x] Punteros § **1.4** / **1.5** / Fase **H** + [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md)
- [x] Filosofía AFK (§ 0): AFK / ayuda guild / caza PvP de AFKs / progression adult = OK; flota AI + sybil Helvet = NOT OK; no ban “AFK en town” como regla primaria
- [x] MVP toggles + panel GM Anti-Bot / Ops (`AntiBotTools.json`, proto get/set, enforce parcial)

### 2026-07-11 (noche) — Hub / brand / login (consolidación)

- [x] Marca **Chain Lord** / Helbreath Chain Lord en hub + docs (preferencia comercial; counsel pendiente)
- [x] Hub **World | Goddesses | Arenas** (evoluciona 3-body 07-10); portales simétricos; desk solo post-portal
- [x] Wallet **one-click World**: *Bind seal & enter* → SIWS si hace falta → Phaser SELECTCHAR
- [x] SELECTCHAR / Create / Arena = **Phaser** (no wallpaper React); viewport desk **FIT**
- [x] Create-char **point-buy** (10–14, budget 70) + preview layered (`CreateCharDesk`)
- [x] **Traveler vs GM** save split (`player_mode` auth/list; traveler soft spawn)

### 2026-07-11 (noche) — Traveler: pits, NPCs, spells, drops

- [x] `traveler`: 6 slime pits (~108); dry spawn/resurrect inland `(90,80)` — [`SPAWN-PIT-PARITY.md`](./SPAWN-PIT-PARITY.md)
- [x] Pits Olympia: spots farms/towns + RMG→dwell dungeons/HZ; **huntzone3/4** MAPDATA sync (gap Orc-Mage)
- [x] City UIs: Shop, Gandalf, William warehouse, Tom buy+**repair**, Howard/Kennedy/Gail/Perry desks
- [x] Spell/CC audit (Paralyze/Hold/Chill + combat/utility) — [`SPELL-CC-AUDIT.md`](./SPELL-CC-AUDIT.md)
- [x] Drop parity regen + **CritCandy 970** — [`MONSTER-DROP-PARITY.md`](./MONSTER-DROP-PARITY.md)
- [x] Beginner Path hard gates 1–20 + Farm Barracks tips **PFA/DS**; Training Arena Fase 2 chase (entradas abajo)

### 2026-07-11 — Crypto loot / NFT↔stable research (docs)

- [x] Research AGLD/Loot + sudoswap + motores Solana → [`CRYPTO-LOOT-AND-NFT-SWAPS.md`](./CRYPTO-LOOT-AND-NFT-SWAPS.md)
- [x] Veredicto: **DIY** escrow/listing + USDC/SOL + Jupiter SPL; **no** integrar Lootverse/AGLD; Tensor/ME fase 2
- [x] Sin integración de código

### 2026-07-11 — human.tech / WaaP research (auth · sybil · economía)

- [x] Eval [waap.human.tech](https://waap.human.tech/) + Passport + docs/SDK → [`HUMAN-TECH-WAAP.md`](./HUMAN-TECH-WAAP.md)
- [x] **§ 1.5** puntero auth/sybil: SKIP WaaP MVP (no Solana live en SDK); WATCH Passport para airdrops/Fase H
- [x] Decisión append § 5 — sin integración de código

### 2026-07-11 — Prólogo Legal / IP + research docs

- [x] Research notes IP Helbreath (fundadores Siementech, trademarks USPTO 0 hits, copyright vs bankruptcy, Olympia vs IP original, exact-copy vs inspired-by) → [`LEGAL-IP-RESEARCH.md`](./LEGAL-IP-RESEARCH.md)
- [x] Checklist operativa (IP, ToS, privacy, crypto, torneos, menores) → [`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md)
- [x] **§ 0 Prólogo Legal / IP** en este MASTERPLAN: marca Chain Lord, no confiar en “quiebra = clone”, checklist inspired-by, pointer a docs legales

### 2026-07-11 — Economía de guilds (visión)

- [x] **§ 1.4** visión económica de guild: GM fee share → consumibles; bonus de egreso/graduación; partner minoritario TBD (counsel); meta 1000+ online vs “fruta”
- [x] Cautela legal § 0.5 (programa/rewards, no security offering) + pointer en Fase H + cross-link en [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md)
- [ ] Clearance formal con counsel + registro de marca propia — pendiente humano/abogado

### 2026-07-08 / 09 — Fundación Solana + Olympia + decisiones de producto

- [x] Stack multiplayer C# + mp-client Phaser/React + `network.proto`
- [x] Wallet auth (server `Auth/` + client `walletAuth.ts` + middleware `auth.js`)
- [x] Persistencia Postgres: accounts, characters, `drop_ledger`
- [x] Items / monstruos alineados a Olympia (catálogos + gen scripts)
- [x] Decisión: Solana primero; HTML5/Phaser para wallets
- [x] Decisión: Rare vs Legendary (`super_rare` whitelist); apuestas espectador **ELIMINADAS**
- [x] Decisión: milestones Frost/Unicorn/max rebirth + curva Olympia; torneos equal-footing + Elo decay

### 2026-07-10 — Torneos MVP, landing, docs, economía futura

- [x] **Landing** `landing/` — página marketing estática (Play → mp-client, Discord, wallet placeholder); README con nota Spectator
- [x] **NFT tiers** — `NftDropEvaluator` (`rare` / `super_rare`) + colecciones middleware; claim UI (`NftClaims`)
- [x] **Progression** — `Progression.json` + helpers + proto claim/rebirth + UI MobKills (parcial)
- [x] **Torneos equal-footing MVP (código):**
  - `Tournament.json` + mundo `colosseum` / `tournamentArena`
  - Stash + `EnterTournamentArena` / `ApplyTournamentLoadout` (gear de arena no persiste)
  - `PvpKillLedger` + Elo K=32 en arena (`GamePersistenceService`)
  - Schema Phase 3 completo (pvp_kills, tournaments*, ratings, HoF, prizes)
  - Middleware `tournaments.js`: CRUD, bracket, seed por rating, leaderboard, decay lazy (−25/sem tras 28d idle, floor 1000), HoF, prizes API
  - Client: `TournamentDialog` + `tournamentApi.ts` (registro, LB, HoF)
- [x] **Docs:** este MASTERPLAN (v0.9), `FRAMEWORK-MULTIMODELO.md`, `TOURNAMENT-BUILD-CREDITS.md`, `HERO-SET-UNBIND-MARKET.md`
- [x] **Diseño (sin código de juego):** Spectator (Fase E), Build Draft C.2, Unbind market F, escrow desafíos post-custodial
- [ ] Premios custodial **payout on-chain** — schema/API listos; firma/tx pendiente
- [x] Hardening ops claim/mint (runbook + métricas) — [`NFT-OPS-RUNBOOK.md`](./NFT-OPS-RUNBOOK.md); review seguridad `[fable]` sigue pendiente
- [ ] Review seguridad torneo — pendiente `[fable]` / humano

### 2026-07-10 — EKs (Enemy Kills) diseño

- [x] **Diseño (sin gameplay):** ledger público EKs, elegibilidad nivel ±10/superior, mult top 10 (×3) / 11–50 (×2), relación `pvp_kills` / `PvpKillLedger` / Elo torneo
- [x] Grep Olympia: **no** hay aura roja dedicada “da EK”; FOE name/círculo rojo + slate HP — feature a portar
- [x] Doc satélite [`EK-LEDGER.md`](./EK-LEDGER.md) + Fase G (estado **Diseño**)

### 2026-07-10 — Ghost dagger + VerifyFix

- [x] Fix client: `buildAssetConfigs` ya no usa `ITEMS[0]`/msw como arma por defecto; slot unequipped = placeholder pending invisible (`PlayerAppearanceManager` + `GameObject`)
- [x] Framework: § 3.1 Agente de verificación / plantilla VerifyFix en `FRAMEWORK-MULTIMODELO.md`; nota operativa en § 8 de este doc

### 2026-07-10 — Guilds + Legacy Airdrop (diseño)

- [x] **Diseño (sin gameplay):** poder de Guild Masters (tax, ACTIVE TRAINER/KILLER, chat global GM/capitán); verificación legacy vía Discord/evidencia/vouch/wallet; mimos/airdrop a guilds históricas (lista abierta de servers)
- [x] Inventario repo: stubs `GuildDialog` / `Guild.store` / menú Character; mapas `gldhall`; **no** había doc satélite previo ni proto/server guild
- [x] Doc satélite [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md) + Fase H (estado **Diseño**)

### 2026-07-10 — Login gate split (wallet / torneos)

- [x] **UI login:** `ConnectDialog` ya no centra el form localhost:1337 sobre el desk clásico. Gate split: banner izq. wallet → Play World (host/port/char) | banner der. torneos + **saved draft builds** (`localStorage` MVP, brackets 60/120/160). Centro = desk HB visible.
- [x] Util `tournamentBuilds.ts`; notas en [`TOURNAMENT-BUILD-CREDITS.md`](./TOURNAMENT-BUILD-CREDITS.md) § saved builds

### 2026-07-10 — Hub 3-body (World / Coliseum)

- [x] **UI login:** hub de 3 paneles reemplaza el split lateral — **arriba** gráfica servidor (placeholder `LoginScreenBg.jpg`), **abajo-izq** Helbreath World (wallet → desk), **abajo-der** Coliseum (slots 160/120/60 × hasta **3 builds**/bracket en `localStorage`)
- [x] Desk clásico solo tras **Enter Helbreath World** (`phase: play-world`); wallet auth + `IN_UI_CONNECT_TO_SERVER` intactos
- [x] Docs: [`TOURNAMENT-BUILD-CREDITS.md`](./TOURNAMENT-BUILD-CREDITS.md) § 10 actualizado

### 2026-07-11 — Hub v2 (World | Goddesses | Arenas)

- [x] **UI login:** composición única a pantalla completa — **izq** Helbreath World, **centro** diosas Aresden / Elendiel (arte `LoadingBg.jpg` + nameplates; ciudad canónica Elvine), **der** Helbreath Arenas (brackets 160/120/60 × 3 kits)
- [x] Se elimina el strip hero superior; atmósfera full-bleed (`SiteBg.jpg`); tipografía Cinzel/Spectral; desk solo en `play-world`
- [x] Mobile: stack World → Goddesses → Arenas; wallet + builds + `IN_UI_CONNECT_TO_SERVER` intactos

### 2026-07-11 — Phaser SELECTCHAR (no wallpaper mockup)

- [x] World desk = **Phaser** `SelectCharDesk` (`sprite-gamedialog2-8` + `dialogtext` ND_BUTTON frames, classic hitboxes, name/lv/exp text)
- [x] React play-world = thin chrome only (name / host / port); **no** CSS photo-frame desk
- [x] Assets existed (`gamedialog2` sheet 8, `dialogtext` sheet 1); **logic was missing** — ported from classic `UpdateScreen_OnSelectCharacter`
- [x] Arena lobby = Phaser `ArenaSelectCharDesk` (mismo chrome; kits 160/90)
- [x] Character portrait sprites on slots (appearance) — anchors classic y=148 + tint hair

### 2026-07-11 — Arena desk SELECTCHAR + brackets 160/90

- [x] Brackets Arena: **solo Lv 160 y 90**; **2 kits/nivel** → 4 slots (0–1 = 160 A/B, 2–3 = 90 A/B)
- [x] `tournamentBuilds` v2 + migración desde v1
- [x] Arena lobby Phaser SELECTCHAR (Start=Coliseum, Create=claim kit, Delete/Load/Exit)
- [x] Docs: [`TOURNAMENT-BUILD-CREDITS.md`](./TOURNAMENT-BUILD-CREDITS.md) § 2 / § 10

### 2026-07-11 — Hub v2 refine (portales simétricos + Arena lobby)

- [x] Hub: World y Arena = **puertas iguales** (nombre + wallet / CTA); sin UI de builds en el hub
- [x] Tras wallet Arena → `phase: arena-lobby` (luego desk 160/90 × 2 kits; ver entrada siguiente)
- [x] Tras wallet World → `play-world` (desk) sin cambios; Phantom + `IN_UI_CONNECT_TO_SERVER` intactos
- [x] CSS: paneles portal centrados, títulos más grandes, columnas laterales de peso igual
- [x] Docs: [`TOURNAMENT-BUILD-CREDITS.md`](./TOURNAMENT-BUILD-CREDITS.md) § 10

### 2026-07-11 — World desk: form embebido + marco grande

- [x] `play-world`: form Character/Host/Port dentro del cuadro SELECTCHAR (`sprite-gamedialog2-8-0`), anclado centro / medio-abajo
- [x] Desk frame ~96vw / max 1180px (aspect 800×600); Phaser `LoginScreenBg` con zoom cover ×1.18
- [x] Wallet chip + Back to Hub; connect `IN_UI_CONNECT_TO_SERVER` intacto

### 2026-07-11 — Referencia Helbreath Argentina (Instagram)

- [x] Captura de captions IG (reel `gino.games` + post update 16.55 `@helbreathargentina`); media/video no disponible vía scrape
- [x] Doc satélite [`REFERENCE-HELBREATH-ARGENTINA.md`](./REFERENCE-HELBREATH-ARGENTINA.md) — takeaways hub/World/Arenas/guilds/EKs + checklist captura manual en `docs/reference/`

### 2026-07-11 — Training Arena Fase 2 (spawn + chase)

- [x] Proto `ApplyTrainingPresetRequest` / `TrainingPresetApplied`
- [x] Server `TrainingArena.HandleApplyPresetRequest`: despawn session dummies → spawn War(62)/Mage(63) near player → `MonsterChase`
- [x] Client Training dialog **Apply** wired (solo mundo `training`); Farm Barracks Apply sigue tip-only
- [x] Doc [`TRAINING-ARENA.md`](./TRAINING-ARENA.md) actualizado a Fase 2
- [ ] Instancing multi-jugador / Clear button / casts Mage extra — pendiente Fase 3

### 2026-07-10 — Training Arena (diseño + stub)

- [x] **Diseño:** mapa de práctica skills (Lory/freeze/kite) con dummies War/Mage, presets extensibles, tip protocols estáticos (no IA)
- [x] Doc satélite [`TRAINING-ARENA.md`](./TRAINING-ARENA.md)
- [x] **Stub seguro (no rompe PvP/torneos):**
  - Mundo `training` en `GameWorlds.json` (`trainingArena: true`, mapa `fightzone1`, **sin** `TournamentConfig`/Elo)
  - Server `Helpers/TrainingArena.cs` — catálogo presets + ApplyPreset
  - Client `TrainingDialog` + `TrainingPresets.ts` (tips por preset); SysMenu + **Shift+F10**
- [x] Spawn dummies + chase AI vía `MonsterChase` / proto ApplyPreset — **Fase 2** (2026-07-11)

### 2026-07-11 — Beginner Path 1→80 + Farm Barracks (scaffold)

- [x] Doc satélite [`BEGINNER-PATH-1-80.md`](./BEGINNER-PATH-1-80.md) — path completo 1→80; tiers A–B live; C–E stubs
- [x] Server: `BeginnerPath.json` + `Helpers/BeginnerPath.cs` + flags en `PlayerPersistenceState` + proto enroll/abandon/talk/state
- [x] Client: Quest panel (F5) enroll/abandon + hints; tip sheets Farm Barracks en `TrainingDialog`
- [x] Farm (`arefarm`/`elvfarm`): NPCs Enzu / Drillmaster / Merc Captain; dwell Slimes + Training Dummy + Merc War/Mage (chase + XP)
- [ ] Tiers 21–80 live objectives — pendiente
- [x] Merc mage cast kit Chill Wind + Energy Bolt (sin kit full player) — 2026-07-11

### 2026-07-11 — NFT ops runbook (parcial, Fase A)

- [x] Doc [`NFT-OPS-RUNBOOK.md`](./NFT-OPS-RUNBOOK.md): backups Postgres, recover mint-fail, env vars, claim flow, anti double-mint existentes, checklist monitoreo
- [x] Middleware: `GET /metrics`, contadores claim, lock in-process, log CRITICAL + `orphanMintAddress` si mint OK / ledger lose; `/claimed` exige token + wallet
- [x] **DB claim lease** `nft_claim_lease_until` (`tryAcquireClaimLease` antes del mint) — multi-réplica; gap residual crash mint→finalize
- [x] `.env.example` middleware + server documentados (sin secrets reales)
- [ ] Review seguridad claim race / voucher auth / orphan reconcile — pendiente `[fable]`

### 2026-07-11 — Torneos MVP stabilize (bracket + killer + Elo decay)

- [x] **F10 Events:** bracket visual single-elim (tap evento → rounds / slots / winner highlight); contraste Ranks/Events/Honor
- [x] **Death dialog:** `PlayerDied.killer_name` → diálogo; fan-out explícito a víctima; event `ui-player-died`; fallback nombre desde `playersById`
- [x] **Elo decay job:** timer middleware (`DECAY_JOB_INTERVAL_MS`, default 1h) + `POST /admin/decay-run`; lazy read-path se mantiene
- [x] **No** payout on-chain / anti-cheat full (sigue bloqueado/legal + `[fable]`)
- [x] Docs: este MASTERPLAN + [`TOURNAMENT-BUILD-CREDITS.md`](./TOURNAMENT-BUILD-CREDITS.md) § ops equal-footing

### Estado snapshot (2026-07-14)

| Pieza | Estado |
|-------|--------|
| Hub World\|Goddesses\|Arenas + Phaser SELECTCHAR/Create + FIT | Hecho (MVP); parchment lines + IconPannel 48/800 |
| Traveler mode (saves split, slime pits, dry spawn) | Hecho (MVP); Aresden TP water race mitigado (map reload) |
| City NPCs (Shop/Gandalf/William/Tom/Howard/Kennedy/Gail/Perry) | Hecho (MVP desks); chimney + click-approach |
| City guards near TP (4 · ≤3 tiles) | Hecho |
| Church interiors exit warps (`arecath`/`elvcath`) | Hecho |
| Peace / Attack / Safe + RMB standstill + player hover | Hecho (MVP) |
| Level-up LU + Level Set + vitals formulas | Hecho (MVP) |
| F8 Skills scroll/detail + PVP Skills waves (guards/darkelf) | Hecho (MVP) |
| Auction board (gold settle) + Item Drops 60/40 + Olympia sell + shop qty | Hecho (MVP); on-chain auction / recycle **TBD** |
| Pits/HP/respawn Olympia + drops CritCandy | Hecho (gaps Orc-Mage / crusade kits) |
| Spell/CC audit (Paralyze+) | Hecho (audit); summon follow-mode pendiente |
| Olympia items/mobs + wallet + drop ledger | Hecho |
| NFT rare / super_rare mint + claim lease + parseLeaf/finalized | Hecho (runbook+lease+mint fix); seguridad `[fable]` pendiente |
| Milestones + rebirth curva | Hecho (balance IDs pendiente) |
| Colosseum equal-footing + stash | Hecho (MVP) |
| Elo rated kills + LB/decay job/HoF + bracket UI + killer death | Hecho (MVP usable) |
| EK screenshot MVP + gallery rarity (doc) | Hecho (MVP captura); ladder ciudad **TBD** |
| Landing Olympia shell + `#ek-gallery` | Hecho (shell); Spectate embeds **TBD** |
| Premios payout on-chain | Pendiente |
| Build Draft / guest duels | Diseño (Fase C.2) |
| Spectator embeds | Diseño (Fase E) |
| Unbind + mercado Hero Set | Diseño (Fase F) |
| Hero Set look pixel premium | Futuro post-test — refs en `docs/refs/hero-set-premium/`; § 1.8 |
| Mes de test + soulbound Cape/Shoes USD 25 / combo 40 | **Prioridad launch** — § 1.7.4; créditos → airdrop inicial |
| Escrow desafíos con pozo | Diseño (T3) |
| EKs ledger + ladder + aura | Diseño (Fase G); screenshot path aparte |
| Guilds + Legacy Airdrop | Diseño (Fase H) |
| Training Arena | Fase 2 — spawn + chase; Fase 3 pendiente |
| Beginner Path 1→80 | Scaffold; tiers 1–20 hard live; 21–80 stubs |
| Farm Barracks (dummy + merc + PFA/DS tips) | En curso (live early) |
| $HELL C1–C14 (stake/LP/pump/Meteora/offramp/Squads) | Docs **cerrados**; SPL mint **devnet**; opens #26/#38/#40/#41 + Squads members |
| Legal IP + checklist + crypto research + WaaP | Docs hechos; counsel humano pendiente |
| Multi-chain Base | Pendiente (post-Solana) |
| Apuestas espectador | Eliminado |

---

## 4. Roadmap unificado (fases A–H)

Etiquetas (ver framework):

- **`[fable]`** — diseño, arquitectura, review, seguridad, product calls  
- **`[cheap]`** — implementación mecánica, docs, CSS, CRUD, scripts, tests según spec  
- **`[human]`** — secrets, deploy prod, legal, pagos  

### Fase A — Fundación Chain Lord + Solana drops

| Ítem | Tag | Estado |
|------|-----|--------|
| [x] Catálogo items/monstruos Olympia en server config | `[cheap]` | Hecho |
| [x] Pits/respawn/HP/dmg alineados a MAPDATA+NPC.cfg (farms/towns slime); script `sync-olympia-pits.mjs` | `[cheap]` | Hecho — spots + RMG dungeons/HZ + huntzone3/4; gap Orc-Mage (`SPAWN-PIT-PARITY.md`) |
| [x] Drop tables regeneradas + CritCandy 970 | `[cheap]` | Hecho — [`MONSTER-DROP-PARITY.md`](./MONSTER-DROP-PARITY.md) |
| [x] Claim lease DB multi-réplica (`nft_claim_lease_until`) | `[cheap]` | Hecho — runbook § anti double-mint; orphan reconcile `[fable]` |
| [x] Mint claim: `parseLeaf` requiere **finalized** + retry RPC lag | `[cheap]` | Hecho 2026-07-14 — `middleware-node/mint.js` |
| [x] Diseño tiers NFT Rare vs Legendary (`super_rare`) + authority mint | `[fable]` | Hecho |
| [x] Middleware mint/collection/metadata + init-devnet-collection | `[cheap]` | Hecho |
| [x] Client drop ledger / NftClaims UI | `[cheap]` | Hecho |
| [x] Schema `drop_ledger` + `nft_tier` | `[fable]`/`[cheap]` | Hecho |
| [x] Hardening ops: backups Postgres, runbook mint fail, métricas básicas | `[cheap]` | Hecho — [`NFT-OPS-RUNBOOK.md`](./NFT-OPS-RUNBOOK.md); `/metrics` + claim lock in-process |
| [ ] Review seguridad: orphan mint→finalize, voucher auth, secrets prod | `[fable]` | Pendiente (lease cubre multi-réplica concurrente; gap crash mid-flight) |

### Fase B — Progression & milestones

| Ítem | Tag | Estado |
|------|-----|--------|
| [x] `Progression.json` + helpers server + proto claim/rebirth | `[cheap]` | Hecho |
| [x] UI MobKills / claim milestone | `[cheap]` | Hecho (verificar UX completa) |
| [ ] Balance pass: IDs de reward items vs catálogo real Olympia | `[cheap]` | Pendiente |
| [ ] Validar curva exp/rebirth vs referencia Olympia (números ~RB20/año) | `[fable]` | Pendiente |
| [ ] **CL rebirth → L79** (`rebirthResetLevel`, no L1) | `[cheap]` | **Diseño** § 1.10 A — código aún L1 |
| [ ] **Block Level** botón + exp→majestic mientras ON | `[cheap]` | **Diseño** § 1.10 B |
| [ ] Caps mapa **PL ≤110** / **PL Dungeons ≤120** (warp enforce) | `[cheap]` | **Diseño** § 1.10 C |
| [ ] Spawns PL outdoor (Rudolph 20, MG 10, isla troll/clay, 2º pit SG, …) | `[cheap]` | **Diseño** § 1.10 D |
| [ ] Spawns + mining **Promise Land Dungeons** (cyclops/orcs/SG/ogres + 6 crystal + 20 coal) | `[cheap]` | **Diseño** § 1.10 E |

### Fase C — Torneos equal-footing + leaderboard (**EN CURSO** — MVP grande ya en repo)

| Ítem | Tag | Estado |
|------|-----|--------|
| [x] `Tournament.json` + flag mundo arena | `[cheap]` | Hecho |
| [x] Diseño stash loadout (no persistir gear de torneo) | `[fable]` | Hecho |
| [x] Kill attribution PvP → `pvp_kills` + rated en arena | `[fable]`/`[cheap]` | Hecho (MVP) |
| [x] Middleware: CRUD torneos, participants, matches, report winner | `[cheap]` | Hecho (MVP) |
| [x] Decay lazy de `pvp_ratings` (inactividad) | `[cheap]` | Hecho (en read path) |
| [x] API leaderboard + hall of fame | `[cheap]` | Hecho |
| [x] UI: registro / tabs LB / HoF (`TournamentDialog`) | `[cheap]` | Hecho (MVP) |
| [x] UI: bracket visual + death dialog con killer name | `[cheap]` | Hecho (2026-07-11) |
| [x] **Tennis-style seeding** en bracket R1 (`buildRoundOneSlots` ATP) | `[cheap]` | Hecho 2026-07-18 — #1/#2 mitades opuestas |
| [x] Landing Sunday **1v1 / 3v3** inscription + `/arena/week` API | `[cheap]` | Hecho shell 2026-07-18 — prize pool USDT montos + middleware HTTPS **TBD** |
| [ ] Premios custodial: payout on-chain seguro desde `tournament_prizes` | `[fable]` | Pendiente (bloqueado/legal) |
| [ ] Review anti-cheat torneo (disconnect, teaming, loadout bypass) | `[fable]` | Pendiente |
| [x] Job periódico de decay (además del lazy) + métricas | `[cheap]` | Hecho (timer + `POST /admin/decay-run`) |

### Fase C.2 — Build Draft / brackets + créditos (**DISEÑO** — no implementar point-buy aún)

Modo **adicional** al equal-footing. Detalle: [`TOURNAMENT-BUILD-CREDITS.md`](./TOURNAMENT-BUILD-CREDITS.md).

| Ítem | Tag | Estado |
|------|-----|--------|
| [ ] Diseño de costos iniciales (heurística) por item/spell/stat por bracket | `[fable]` | Diseño |
| [ ] Modelo telemetría / simulación winrate | `[fable]` | Diseño |
| [ ] Loop handicap + synergy tax | `[fable]` | Diseño |
| [ ] Anti-meta: presupuesto tenso, anti-one-item, super-rares caros | `[fable]` | Diseño |
| [ ] Tablas JSON stub (`BuildBracketConfig`, `CreditCostEntry`) sin costos finales | `[cheap]` | Pendiente |
| [ ] Mundos arena por bracket en `GameWorlds.json` | `[cheap]` | Pendiente |
| [ ] UI picker stub: bracket → draft → lock | `[cheap]` | Pendiente |
| [x] **Saved builds en login (MVP localStorage)** — nombre / bracket / item ids / credit stub; Load build stub | `[cheap]` | Hecho (UI gate; sin lock server) |
| [ ] Flujo guest: char efímero → discard al salir | `[cheap]` | Pendiente |

**Prerrequisito:** estabilizar Fase C (equal-footing + LB) antes de abrir C.2 en código.

### Fase D — Post-MVP / no apuestas

| Ítem | Tag | Estado |
|------|-----|--------|
| [ ] Arenas con stake **entre participantes** (escrow / pozo) — **después** de custodial prizes | `[fable]` | Diseño (T3) |
| [ ] Multi-world scheduling / capacity para picos | `[cheap]` | Pendiente |
| [ ] Multi-chain (Base, etc.) — solo tras Solana estable | `[fable]` | Pendiente |
| [ ] Observabilidad (logs estructurados, dashboards) | `[cheap]` | Pendiente |
| [x] ~~Apuestas espectadores~~ | — | **CANCELADO** |

### Fase E — Spectator / streams (**DISEÑO** — no implementar app aún)

| Ítem | Tag | Estado |
|------|-----|--------|
| [ ] Diseño producto: hub landing vs PWA vs nativa; qué eventos se listan | `[fable]` | Diseño |
| [x] Landing **chainlords.net** (World/Arena, Play wallet, EK side, Sunday Arena + inscription) | `[cheap]` | **Live** 2026-07-18 — Spectate embeds + middleware público HTTPS pendientes |
| [x] Arena week API + tennis seed preview (`/arena/week`, `/arena/week/register`) | `[cheap]` | **En curso** 2026-07-18 — prize lock / admin start UX TBD |
| [ ] MVP landing: sección Live/Spectate + embed Twitch/YouTube | `[cheap]` | Pendiente (shell listo) |
| [ ] Runbook OBS → RTMP Twitch/YouTube; checklist pre-evento | `[cheap]` | Pendiente |
| [ ] Calendario streams en landing + CTA Discord social + CTA Play | `[cheap]` | Pendiente (CTA Play/Discord ya en shell) |
| [x] Política: Discord = chat/comunidad; **no** CDN de video | `[fable]` | Decidido (2026-07-10) |
| [ ] (opcional) Owncast / Cloudflare Stream | `[cheap]`/`[fable]` | Pendiente |
| [ ] App móvil / PWA + push “torneo en vivo” | `[fable]` | Pendiente (tardía) |
| [ ] LiveKit/Mux/IVS solo si latencia interactiva lo justifica | `[fable]` | Pendiente (tardía) |

### Fase F — Hero Set unbind + marketplace + **arte premium** (**DISEÑO / FUTURO**)

Detalle economía: [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md). Fees/asset = config; **no** hardcodear.  
**Arte pixel premium:** § **1.8** + [`refs/hero-set-premium/`](./refs/hero-set-premium/) — **después del mes de test** (no bloquea launch).

| Ítem | Tag | Estado |
|------|-----|--------|
| [ ] Reglas binding: `bound \| unbound \| listed \| pending_bind` | `[fable]` | Diseño |
| [ ] Custody: invariante `item_uid` ↔ mint; transfer sin duplicar | `[fable]` | Diseño |
| [ ] Anti-exploit: wash trading, unbind farming, race claim, aislamiento torneo | `[fable]` | Diseño |
| [ ] Política fee → treasury; confirmación on-chain; cooldowns en config | `[fable]` | Diseño |
| [ ] Stub `UnbindFeeConfig` (asset, amount placeholder, enabled ids) | `[cheap]` | Pendiente |
| [ ] UI stub: Unbind / estados / listing placeholder | `[cheap]` | Pendiente |
| [ ] Runbook unbind fail / reconcile ledger vs mint | `[cheap]` | Pendiente |
| [x] Refs visuales Ares/Elv hero set premium (copia interna) | `[cheap]` | Hecho 2026-07-17 — `docs/refs/hero-set-premium/` |
| [ ] **Post-test:** sheets `.spr` / pivotes idle+walk (capas gear only, NEAREST) | `[human]`/`[cheap]` | Futuro — arte externo + wire 400–428 |
| [ ] **Post-test:** combat anims M/W + polish silueta vs stock body | `[human]` | Futuro |

### Fase G — Enemy Kills (EKs) ledger + ladder (**DISEÑO** — no implementar gameplay completo aún)

Detalle: [`EK-LEDGER.md`](./EK-LEDGER.md). **Distinto** del Elo / HoF de torneos (Fase C).

| Ítem | Tag | Estado |
|------|-----|--------|
| [x] Reglas producto: elegible si víctima ≥ killer−10 (o superior); else no EK | `[fable]` | Diseño (2026-07-10) |
| [x] Multiplicadores: top 10 → ×3; top 11–50 → ×2; resto elegible → ×1 | `[fable]` | Diseño |
| [x] Grep Olympia aura roja “da EK” — no dedicada; FOE rojo + slate HP | `[cheap]` | Hecho (doc) |
| [ ] Modelo datos: extender `pvp_kills` **o** tabla `enemy_kills` (`ek_value`, levels, eligible) | `[fable]` | Diseño |
| [ ] Evaluar elegibilidad + mult en kill path (`PvpKillLedger` / helper) fuera de arena | `[cheap]` | Pendiente |
| [ ] API pública ledger + ladder (`GET /eks`, filtros) | `[cheap]` | Pendiente |
| [ ] UI landing y/o in-game: scroll, filtros (killer, victim, map, date, multiplier), archivo | `[cheap]` | Pendiente |
| [ ] Contador CharacterDialog = EKs reales (dejar de mapear mob kills) | `[cheap]` | Pendiente |
| [x] Auto-screenshot EK (canvas JPEG + download + upload stub) | `[cheap]` | MVP 2026-07-13 — ver `EK-SCREENSHOT-GALLERY.md` |
| [ ] Landing gallery wired to persistent store + city killer ranks | `[cheap]` | Scaffold + in-memory stub; rareza **locked** (top10/50/200) |
| [ ] Ground ring “da EK” sync (proto + client) relativa al viewer | `[fable]` | Diseño / portar — **no VFX aún** |
| [ ] Anti-farm + (opcional) decay/seasons del ranking EK | `[fable]` | Diseño |

**Nota visual 2026-07-10:** aura “da EK” = **círculo bajo los pies** (como crusade FOE `DrawObjectFOE` / `m_pEffectSpr[38]` / `EFFECT_CRUSADE_ENEMY_INDICATOR`), en players **más fina y esfumada**; no body glow. Open: color (¿solo ring si da EK, o rojo vs gris?). Detalle en [`EK-LEDGER.md`](./EK-LEDGER.md) § 5.

**Prerrequisito sugerido:** no mezclar inserts EK rated de `colosseum` con el ladder open-world; Elo torneo sigue en Fase C.

### Fase H — Guilds + Legacy Airdrop (**DISEÑO** — no implementar gameplay aún)

Detalle: [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md). Objetivo: relevancia real a **Guild Masters** (lazos desde ~2000) + reconocimiento verificable a guilds históricas. Economía de guild (visión): § **1.4**. Capacidad / sybil social (idea): [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md).

| Ítem | Tag | Estado |
|------|-----|--------|
| [x] Inventario repo: stubs UI GM (`GuildDialog`, tax, ACTIVE TRAINER/KILLER), menú Character, `gldhall`, tickets; sin proto/server | `[cheap]` | Hecho (doc) |
| [x] Recuperar concepto “comando especial” GM = statuses ACTIVE\* + tax + voz global (canvas chat 2026-07-08) | `[fable]` | Diseño |
| [x] Visión economía guild: fee share → consumibles; egreso/graduación; partner program TBD | `[fable]` | Diseño (2026-07-11) — § 1.4 |
| [x] Idea anti-bot capacidad: prioridad de ingreso a guildes probadas; segmento new/unknown (cola/overflow/traveler/claim delayed) | `[fable]` | Idea (2026-07-12) — [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md); toggles MVP shipped |
| [x] Filosofía AFK vs flota industrial (OK AFK/social/PvP hunt; NOT OK multi-box AI / sybil Helvet) | `[fable]` | Idea (2026-07-12) — [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) § 0 |
| [x] MVP toggles anti-bot/AFK/tournament-AI + panel GM (persist JSON, traveler gated) | `[codex]` | Shipped (2026-07-12) — § 0.1 doc; enforce parcial |
| [ ] Spec MVP poderes GM + capitanes (chat global, tax, statuses, invite/kick) | `[fable]` | Diseño |
| [ ] Flujo verificación legacy: Discord / screenshots / roster / vouch / SIWS / anti-sybil | `[fable]` | Diseño |
| [ ] Lista abierta servers target (HB Arg, Alkon, LMDL, Olympia, Cursed, INT, Korea, …) + fuentes | `[cheap]`/`[human]` | Diseño |
| [ ] Catálogo de mimos (title, tint, HoF, credits, NFT commemorative, hall rename) **sin montos** | `[fable]` | Diseño |
| [ ] Spec economía guild ( % fees, catálogo consumibles, reglas egreso, criterios partner) — **después** de counsel en partner | `[fable]`/`[human]` | Diseño |
| [ ] Schema futuro `guilds` / `guild_members` / `legacy_claims` (solo diseño hasta priorizar) | `[fable]` | Pendiente |
| [ ] Stubs código (proto + UI wire) — **después** de schema mínimo y chat roles | `[cheap]` | Pendiente — **no ahora** |

**Prerrequisito sugerido:** no abrir combate-affecting statuses hasta config JSON + anti-farm; chat privilege GM/capitán puede ir antes. Coordinar ACTIVE KILLER con reglas EK (Fase G). Partner/dividends = post-MVP + `[human]` legal.

---

### § Olympia Parity Roadmap (2026-07-14 · P1–P3)

> **Auditoría visual/funcional** contra los screenshots reales de Olympia en `C:\Users\54116\AppData\Roaming\Helbreath Olympia\SAVE\` (`Helbreath Olympia #0–#119.jpg` + `SAVE\eks\*.jpg`) + el catálogo de ventanas del client beta (`%AppData%\Helbreath Olympia\beta\contents\windows.json`). Cross-check contra `multiplayer/mp-client/src` para **no** repetir lo ya shipped (hover Olympia, IconPannel 48/800, F6 60/40 + sell + qty wheel, SELECTCHAR parchment, auction MVP, EK screenshot MVP, Peace/Attack/Safe, EXP bar within-level). **Solo plan — sin implementación en este pass.** Evidencia citada como `#N` = `Helbreath Olympia #N.jpg`.

#### P1 — Identidad de pantalla (lo que un jugador de Olympia nota en 5 segundos)

| # | Gap | Evidencia | Dónde aterriza |
|---|-----|-----------|----------------|
| P1.1 | **Quest/Hunt tracker HUD** (columna derecha): lista permanente de hunts + dailies con contadores coloreados (`Garden Unicorns · Unicorn: 0/100`, `ToH3 Demons Daily`, `A New Challenge Completed!` en oro). No existe nada equivalente en nuestro HUD (`grep questTracker` = 0). | #0, #10, #20, #25, #112, #117 (casi todos) | **Client 2026-07-14:** `ui/overlays/QuestTrackerHud.tsx` ← BeginnerPath + milestones + TimedChallenge (flash Completed!). Hunt/daily proto server = **TBD** |
| P1.2 | **Log de sistema/combate bottom-left** con colores: rojo `HP has been decreased by 24points.`, verde heals/SP, cyan tips (`Tip: Holding shift…`), blanco eventos (`Magikarp joined the party.`, `You got a Kite Shield.`). Hoy no renderizamos ese stream (`grep "has been decreased"` = 0 en client). | #3, #20, #53, #58, #107 | **Client 2026-07-14:** `ui/overlays/SystemLogOverlay.tsx` + `SystemLog.store.ts` (HP/pickups/party/death/effects/tips). SP ticker = **TBD** |
| P1.3 | **Chat overhead** sobre la cabeza del jugador (`nombre: texto` coloreado, ~10 s). Hoy el chat solo vive en F9. | #14, #40 (overheads), #48, #87, #101 | `game/objects/Player.ts` (+`FloatingText`-like label persistente); wire desde chat proto |
| P1.4 | **Minimapa de esquina** semi-transparente (top-left o top-right, toggleable) con dots. Tenemos `MinimapDialog` como ventana, no como widget de esquina estilo Olympia. | #10, #25, #30, #87, #117 | Reusar render de `MinimapDialog` como overlay fijo + toggle en IconPannel/tecla |
| P1.5 | **Reloj de juego** en el IconPannel (ícono reloj con hora 1–24) + día/noche. `grep gameClock` = 0. | #10 (13), #30 (14), #48 (13), #64 (9), #119 (7) | `HotkeyBar.tsx` (slot reloj ya existe en el sprite) + hora servidor en snapshot proto; tint día/noche en `GameWorld.ts` (Fase 2) |
| P1.6 | **Barra de ubicación con Required Exp**: el cartucho central alterna `Mapa(x,y)` con `Required Exp: 1605709 (15.26%)`. Nuestro cartucho solo muestra mapa/coords. | #70 | `HotkeyBar.tsx` — alternar textos como Olympia |
| P1.7 | **HP bar del mob target** (nombre rojo + estado `(Berserked)` + barrita roja bajo el mob) y **skull** sobre enemigos PK. | #53, #70, eks/Tanito_000 | **Client 2026-07-14:** `MonsterHoverOverlay` + attack-target persist; `Player` FOE skull; HotkeyBar `Poisoned`. PK count proto = **TBD** |

#### P2 — Sistemas visibles de sesión (retención / feel)

| # | Gap | Evidencia | Dónde aterriza |
|---|-----|-----------|----------------|
| P2.1 | **Chat Log window completa**: tabs `Global · Trade · Town · Nearby · Guild · Party · Whisper · Misc · All`, `View whispers`, `Change size`, búsqueda (lupa), timestamps opcionales. Nuestro F9 es log+input sin tabs ni whisper (`grep Whisper` en `ChatDialog` = 0). | #40; asset ref `Helbreath_Olympia__298` | **Client+proto 2026-07-14:** F9 tabs Global…Whisper+All; `/w` whisper; channel colors; SysMenu Whisper toggle; overhead tint by channel. Misc tab / lupa / Change size / Whispers window = **TBD** |
| P2.2 | **Ticker de EXP**: `Exp change in the last 10 seconds: +4,072 (+2,036 rested bonus)` + sistema **Rested Exp** (F5 lo lista). | #45, #58, #107, #112; asset 298 (Rested Exp: 63,166) | **Client 2026-07-14:** `Progression.store` 10s → SystemLog + F5 `Exp (10s)`; F5 Rested Exp stub=0. Server rested pool = **TBD** |
| P2.3 | **Announces de spell en mundo**: `Mass-Fire-Strike!`, `Fury-Of-Thor!`, `Absolute-Magic-Protect!`, `Meditation!` (verde/rojo/rosa sobre el caster). Tenemos FloatingText de daño; faltan announces con color por tipo. | #3, #57, #101, #107, #119 | **Client 2026-07-14:** `formatOlympiaSpellAnnounce` + role palette; local cast → SystemLog |
| P2.4 | **Cadenas de daño estilo Olympia**: hits apilados `-45-45-45!`, crit con `!`, `+189` heal verde, amarillo vs rojo (fuente del daño). Parity de formato/estilo vs nuestro FloatingText. | #20, #48, #105, #107 | **Client 2026-07-14:** `DamageChainFloatingText` merge `-45-45-45!`; dealt yellow / taken red / heal green |
| P2.5 | **Status effects visibles**: label de HP bar cambia (`Poisoned 15` cyan), mensajes `You have been frozen! Your movement decreases to 50%.`, `You are no longer burning.` Sin buff icons nuestros (`grep buff` = 0 en ui/). | #3 (Poisoned), #70 (frozen), #48 (burning) | `HotkeyBar.tsx` (label HP), SystemLog (P1.2); buff strip = P3 |
| P2.6 | **Muerte estilo Olympia**: mensajes `You have died! Click the restart button…`, `You dropped a Zemstone of Sacrifice.`, botón **`Restart!`** dorado flotante bottom-right (no modal). Nuestro `DeathDialog` es modal con killer name. | #14 | **Client 2026-07-14:** `DeathDialog.tsx` → floating golden `Restart!` + killer caption; SystemLog death line (P1.2). Zemstone drop-on-death log = **TBD** |
| P2.7 | **Tooltips de ítem ricos** + **magic affixes Olympia** (calidad + Sharp/Ancient flat + colores + secundarios). | #87 | **2026-07-14:** tooltips base. **2026-07-30 shipped:** Common/Superior/Exceptional + color prefixes; **Damage flat** (Sup +1 · Sup Sharp +2 · Exc Sharp +3 · Exc Ancient +4; **no** value×7); secondary HR/CAD/Exp/Gold +1..+7; wands MS + CP/HP/MP vamp; **rares puros**. Docs: [`OLYMPIA-ITEM-MAGIC-AFFIXES.md`](./OLYMPIA-ITEM-MAGIC-AFFIXES.md). Server `OlympiaMagicRoll` + `ItemMagicAttribute.WeaponQualityBaseDamage`; client `OlympiaItemName.ts`. |
| P2.8 | **Bag Olympia-plus**: contador peso `359/850 (41/50)`, oro abreviado (`2.2M`, `340k`), tab **`Drops (N)`** con badge de count, colores de rareza en Item Drops (`Epic Kite Shield` púrpura) + botón **Sort**. F6 60/40 ya shipped; faltan estos detalles. | #0, #40, #101, #117; asset 298 | **Client 2026-07-14:** weight + gold abbrev + `Drops (N)` + Sort + rarity/Epic tint in Item Drops |
| P2.9 | **Party UI**: ventana Party (Main/Members/Invites — windows.json) + mensajes `X joined the party.` / `withdrew from the party.` Tenemos `Party.store` stub en F5. | #57, #83, #112; windows.json | **Client+server 2026-07-14:** F5 Party members+HP; proto `PartyMember`; vitals rebroadcast |
| P2.10 | **Clima**: lluvia (eks/Tanito_000) y nieve (#70) con opción `Rain sounds`. `WeatherManager` existe — validar paridad visual + SFX + config server por mapa. | eks/Tanito_000, #70; asset 298 (Game Options) | **2026-07-14:** `defaultWeather` icebound/middleland; Rain sounds SysMenu; ambient dry cycle client |
| P2.11 | **Screenshot key genérica** (`Screenshot saved to …` × N en log, archivos `Helbreath Olympia #N.jpg`). Tenemos captura EK; falta hotkey usuario + counter + mensaje. | #87, #101, #105 | Client: reusar canvas EK capture; carpeta descarga + SystemLog |
| P2.12 | **F5 Character completo**: `Talents` (Earth, Lightning), `Rested Exp`, `Majestics`, `Enemy Kills: 12/1539`, `Contribution`, `Reputation`, `Hunger: 50%`, `Weight: 359/850`, título (`!RIVER!` + `Clear Title`), botones Quests/Statistics/Achievements/Guild/Party/Level Set/Feedback. Nuestro F5 tiene stats base + LU. | asset 298 | **Client 2026-07-14:** F5 rows Talents/Majestics/Hunger(TBD)/Title+Clear/EK `n/total` + existing Contribution/Rep/Weight. Server hunger/title/talents = **TBD**. **Path de mérito PvE** (dragones) = **P3.10** (alternativa a pick en City Hall). |

#### P3 — Ventanas/sistemas mayores (esfuerzo grande, staged)

| # | Gap | Evidencia | Dónde aterriza |
|---|-----|-----------|----------------|
| P3.1 | **Enchanting + Enchanting Bag (Shards/Fragments) + Item Upgrade + Alchemy + Crafting/Manufacture** — cadena completa de crafting Olympia; conecta con **Recycle shards TBD** (F6) y piedras Xelima/Merien (§ 1.7 embudo). | windows.json (Enchanting, Enchanting Bag, Item Upgrade, Alchemy, Crafting) | Nuevas ventanas + server crafting; priorizar **Item Upgrade** (monetiza piedras) |
| P3.2 | **Game Options estilo Olympia** (tabs Main/Gameplay/Graphics/Input o General/Video/Social/HUD/Input): volúmenes, Detail level, Chat logging/time stamps, **Mute List**, **Screenshots Folder**, **Support Ticket**, **News**, **Discord**, **Upcoming Events**, Local/Server time + Avg Ping, indicador **`Non-raid day (1 minute)`**. Nuestro F12 SysMenu es una lista simple. | asset 298; windows.json | `SysMenuDialog.tsx` → ventana Options tabbed; raid-day flag desde server |
| P3.3 | **Cash Shop window** (botón dentro de Options). Enlaza § 1.7 / **1.7.4** (Cape/Shoes soulbound **USD 25** / combo **40**, piedras ~$1, bulk packs) — **must del mes de test** si se vende day-0. | asset 298; windows.json (Cash Shop) | Nueva ventana + catálogo config JSON + middleware pagos (stables/$HELL/fiat) — coordinar con C6 y counsel |
| P3.4 | **Guild window completa** (Members/Board/**Upgrades**/Donations) — hoy guild = stubs; ya trackeado Fase H slice #3; los screenshots confirman el shape exacto de Olympia. | windows.json (common.guild) | Fase H — no antes de proto/schema guild |
| P3.5 | **Mailbox + Friends + Users(online) + Leaderboards in-game + News + Upcoming Events** — ventanas sociales secundarias. Leaderboards ya existe vía middleware para torneos; falta ventana genérica in-game. | windows.json | Ventanas React nuevas; baja urgencia hasta población real |
| P3.6 | **Death Recap** (`draw.notif.death_recap` en windows.json) — desglose de daño al morir. Sinergia con torneos/EK (aprender de la muerte). | windows.json | Server: buffer últimos hits; client: panel post-muerte |
| P3.7 | **Rebirth window** dedicada (tenemos rebirth en Progression sin UI dedicada) + **Statistics** (stats/mobs/elite) + **Achievements** tabs (General/PvM/PvP/Challenges — F10/F11 cubren parte). | windows.json | Consolidar en `CharacterDialog` satélites |
| P3.8 | **Special ability de armas** (`Special ability has been set! / usable in 0 seconds`, `Xelima's Rapier's ability activated!`) — sistema de gameplay, no solo UI. | #58 | Server combat + item flags; announce en SystemLog |
| P3.9 | **Watermark/branding** esquina sup-izq (`www.helbreath.net` en Olympia) → `chainlord` propio + FPS/Perf/ping overlay estilo Olympia (numerito + FPS + Perf). | todos | Overlay simple en `App.tsx` (FPS ya lo tenemos en debug) |
| P3.10 | **Dragon Talent Path (potencial / no committed):** aprender o **cambiar talento** matando el **dragón elemental** alineado, en vez de (o además de) un pick pasivo en **City Hall**. Da **mérito PvE** y endgame content. **Manuals elite:** Earth → Earth Shock Wave; Ice → Mass Blizzard; Fire → **HellFire**; Lightning → **Fury of Thor**; Poison → spell elite **a diseñar** (Mass Venom Strike **no existe**); Black → Tanker + loot tipo Elemental/Abaddon. Piloto natural: **Ice Dragon en Icebound** (IB). Relevar mapas Nemesis con dragones. | Product vision 2026-07-27; Boris IB + fantasy talent | **Doc:** `docs/ICEBOUND-AND-DRAGON-TALENT-QUEST.md`. Spells listos: ESW, Mass Blizzard. **A portar:** HellFire, Fury of Thor. **A diseñar:** poison elite. Talents server reales = dependencia P2.12. **No implementar hasta priorizar.** |

**Quick wins sugeridos (≤1 día c/u):** P1.5 reloj (sprite ya existe), P1.6 Required Exp en cartucho, P2.4 paleta/merge FloatingText, P2.5 label `Poisoned` en HP bar, P2.8 oro abreviado + badge Drops (N), P2.11 screenshot key, P3.9 watermark. **Esfuerzos grandes:** P1.1 quest tracker (proto+server), P2.1 chat channels, P3.1 crafting chain, P3.3 cash shop (legal/counsel primero), **P3.10 dragon talents** (si se elige path de mérito PvE).

**Orden propuesto:** P1.1 → P1.2 → P1.3/P1.4 (pantalla “se ve Olympia”) → P1.5–P1.7 quick wins → P2.1 chat → P2.2/P2.5/P2.6 session feel → resto P2 → P3 por demanda de producto (P3.1/P3.3 cuando economía § 1.7 lo pida; **P3.10** solo si se prioriza endgame talent-by-dragon vs City Hall pick).

**Shipped 2026-07-14 (client):** P1.3 chat overhead · P1.4 corner minimap · P1.5 clock+night tint (client hour) · P1.6 Map↔Required Exp cartridge · quick: bag gold abbrev + PrintScreen/Ctrl+Shift+S. Server game-hour proto = TBD.

**Shipped 2026-07-14 (P2 slice):** P2.2 exp ticker (SystemLog + F5) + Rested Exp stub · P2.9 Party members+HP · P2.10 defaultWeather + Rain sounds + ambient dry cycle (~25s first). Server rested pool = TBD.

**Shipped 2026-07-14 (client P2 slice):** P2.6 death Restart! · P2.7 rich tooltips polish · P2.8 bag weight/gold/Drops(N)/Sort/rarity · P2.12 F5 Hunger/Title/EK/Talents stubs. P1 HUD unchanged.

**Shipped 2026-07-14 (client P2 chat/combat feel):** P2.1 Chat Log tabs + whisper + channel overhead · P2.3 spell announces (+ SystemLog) · P2.4 damage chains + heal floats. P1 tracker/log/minimap/clock/target HP unchanged.

**Shipped 2026-07-30 (P2.7 item magic + drops):** Olympia primary/secondary/color tables; quality flat base damage (Sharp always Ancient−1); Strong disabled on weapons; rares pure (no Sharp/HR/Exp); wands catalog MS + CP/HP/MP vamp primary; secondary +1..+7. Doc [`OLYMPIA-ITEM-MAGIC-AFFIXES.md`](./OLYMPIA-ITEM-MAGIC-AFFIXES.md). Prod deploy server + client.

---

## 5. Decisiones (append-only)

> **No editar ni borrar entradas anteriores.** Si una decisión se revierte, agregar una nueva línea que la supersede.

| Fecha | Decisión | Contexto |
|-------|----------|----------|
| 2026-07-08 | Base HTML5 (Phaser) + server C# + wallets Solana | Mejor UX wallet que cliente nativo legacy |
| 2026-07-09 | Items Rare vs Legendary (colecciones cNFT separadas; código `rare` / `super_rare`) | Frecuencia vs super-rares Olympia |
| 2026-07-09 | Torneos equal-footing con loadout server-side | Meritocracia de skill, no de grind de gear |
| 2026-07-09 | **Eliminar apuestas de espectadores** | Riesgo legal/ops; foco en torneos + leaderboard |
| 2026-07-09 | Leaderboard con decay tipo ATP/boxeo | Mantener ranking vivo |
| 2026-07-09 | Milestones Frost 50k / Unicorn 5k / max rebirth | Diferenciador vs Helbreath clásico |
| 2026-07-09 | Curva exp/rebirth estilo Olympia (RB20 ~1 año como norte) | Sensación de progresión familiar |
| 2026-07-10 | Bitácora en `docs/MASTERPLAN.md` + framework multi-modelo | Coordinar Fable (diseño) vs modelos baratos (ejecución) |
| 2026-07-10 | Fable pausado por factura; ejecución con Composer/Grok | No bloquear el repo esperando Fable |
| 2026-07-10 | **Spectator:** no usar Discord como CDN de video. MVP = OBS → Twitch/YouTube embed en landing; Discord = hub social/chat/notifs. App nativa después. | API oficial no permite embeber Go Live; selfbots/ToS/DAVE E2EE. Ver § Evaluaciones y Fase E. |
| 2026-07-10 | **Brackets 60/120/160 + point-buy + duelos sin char persistente.** Equal-footing hero set **sigue** como modo open. Costos = sintonización futura; no hardcodear ni implementar C.2 aún. | Captura mid/high/endgame y jugadores de otros servers. Ver Fase C.2 + `TOURNAMENT-BUILD-CREDITS.md`. |
| 2026-07-10 | **Unbind de pago + transfer + rebind al holder del NFT.** Fee → treasury (asset configurable). No implementar ni hardcodear fees aún (Fase F). | Economía fees + mercado secundario. Ver `HERO-SET-UNBIND-MARKET.md`. |
| 2026-07-10 | **Premios:** gov token + USDC/SOL/sponsors vía `tournament_prizes` custodial; payout on-chain es `[fable]`/`[human]`. | Schema ya contempla `prizes_json` + ledger pending/paid. |
| 2026-07-10 | **Escrow desafíos con pozo:** Tier 3 / Fase D, **después** de que el payout custodial de torneos esté estable. No es betting de espectadores. | Stake solo entre participantes. |
| 2026-07-10 | MASTERPLAN consolidado como **borrador v0.9** (documento único para críticas posteriores, incl. Fable 5) | Avanzar sin esperar factura Fable; cola de críticas en § 10 |
| 2026-07-10 | **EKs (Enemy Kills):** ledger público; elegible solo si víctima tiene **más nivel** o como máximo **10 niveles menos** que el killer; top 10 EK → kill da **×3**, top 11–50 → **×2**, resto elegible → ×1. Aura roja = feature a portar (Olympia reference no tiene aura dedicada “da EK”). Ladder EK **≠** Elo torneo. No implementar gameplay completo aún (Fase G). | Open-world prestige + anti-farm de lows. Ver `EK-LEDGER.md`. |
| 2026-07-10 | **EKs — clarificación visual aura:** ground ring bajo pies (ref. crusade FOE), más fina/esfumada que monstruos en cruzada; no body glow; propuesta: otros jugadores ven ring en targets elegibles. Open: color (solo-si-da-EK vs rojo/gris). **No VFX aún.** | Fase G / `EK-LEDGER.md` § 5. |
| 2026-07-10 | Bugs UI/gameplay: Grok no marca done sin VerifyFix (call site + sin path alternativo); Fable offline → segundo agente explore/review | Brecha Grok↔Fable en ghost dagger; ver `FRAMEWORK-MULTIMODELO.md` § 3.1 |
| 2026-07-10 | **Guilds + Legacy Airdrop:** potenciar Guild Masters (tax, ACTIVE TRAINER/KILLER, voz en chat global con capitanes); programa de reconocimiento a guilds históricas de servers relevantes (lista abierta: HB Arg, Alkon, LMDL, Olympia, Cursed, INT, Korea, …) con verificación Discord/evidencia/vouch/wallet; mimos cosméticos/soft **sin hardcodear cantidades**. No implementar gameplay aún (Fase H). | Retención social + respeto a historia HB. Ver `GUILDS-AND-LEGACY-AIRDROP.md`. |
| 2026-07-10 | **Training Arena:** mundo dedicado `training` (`trainingArena`) para práctica de skills con dummies War/Mage y tip protocols por preset. **No** reutiliza loadout/stash/Elo de `colosseum`. Chase spawn = Fase 2 (reusar `MonsterChase`); MVP = doc + mundo + UI presets/tips + stub server. | Onboarding PvP / Lize-freeze drills sin tocar torneos. Ver `TRAINING-ARENA.md`. |
| 2026-07-11 | **Training Arena Fase 2:** ApplyPreset spawnea Merc War(62)/Mage(63) con chase; proto `ApplyTrainingPresetRequest`; Farm Barracks intacto. | VerifyFix: apply → dummies chase. Ver `TRAINING-ARENA.md`. |
| 2026-07-10 | **Login gate split:** wallet primero; luego Play World (connect host/port) o Tournaments. Desk clásico HB visible al centro; banners laterales. Saved tournament builds en `localStorage` (MVP, sin point-buy). | No tapar desk con form connect; prep C.2. |
| 2026-07-10 | **Hub 3-body:** primera pantalla = top server art + World + Coliseum. Desk 4-char **después** de elegir World. Coliseum: 3 slots (160/120/60) × hasta 3 builds/bracket (`localStorage`). | Evoluciona el split wallet\|torneos; prep C.2. |
| 2026-07-11 | **Arena desk Phaser:** lobby Arena deja de ser form React; `ArenaSelectCharDesk` reusa ND_SELECTCHAR (Start=Coliseum, Create=claim kit). SELECTCHAR portraits anchors y=148. F-keys: HUD F10/F11, Stats/Achievements ND_TEXT propio, Item Drops hermano, Magic ND_BUTTON. | Residual jugable UI. |
| 2026-07-11 | **Torneos MVP stabilize:** bracket visual F10 Events; death dialog con killer; Elo decay job periódico (además del lazy). Payout on-chain y anti-cheat full **no** en este corte. | Cerrar loop jugable Fase C `[cheap]`. |
| 2026-07-11 | **Economía de guilds (visión):** (1) GM recibe % de fees de su guild en **consumibles** (no cash); (2) bonus al **egreso** de jugadores maxed (“graduación”); (3) guilds estables = **partner minoritario** / dividends TBD con counsel (programa/rewards, no security); meta: 1000+ online hace más rentable guild seria que server “fruta”. Sin código. | Retención de GMs + alineación economía. Ver § 1.4 + `GUILDS-AND-LEGACY-AIRDROP.md`. |
| 2026-07-11 | **human.tech / WaaP:** **SKIP** integrar WaaP como wallet/login en MVP (SDK/docs = EVM+Sui; Solana no verificado como live; ya hay SIWS Solana). **WATCH** Human Passport (PoH/sybil) para airdrops/legacy/Fase H — spike solo si hace falta score EVM o Data Services. No código. | Auth ≠ sybil; no confundir WaaP con Passport. Ver `HUMAN-TECH-WAAP.md` + § 1.5. |
| 2026-07-11 | **Spawn/pit parity:** `dwellAreas` desde MAPDATA `spot-mob-generator`; farms/towns con slimes early; HP/dmg/respawn desde `NPC.cfg` (fórmulas Server.cpp). Drops no inventados. Gaps: `random-mob-generator` (dungeons/huntzones), huntzone3/4 MAPDATA ausente. | Early game farmable + parity Olympia. Ver `SPAWN-PIT-PARITY.md`. |
| 2026-07-11 | **RMG → dwell:** port `random-mob-generator` levels 4/5/13/16 a conteos esperados (`max-object−30`) para aresdend1, elvined1, middled1x, huntzone1/2, toh1. Barracks/traveler/training intactos. huntzone3/4 bloqueados (sin MAPDATA). | Dungeons/HZ farmables con misma composition Olympia. Ver `SPAWN-PIT-PARITY.md`. |
| 2026-07-11 | **Beginner Path + Farm Barracks:** path opcional 1→80 abandonable sin pena; barracks Dummy/Merc en arefarm/elvfarm (no brand Olympia). Tips Chill→Para→PFA/DS (deny PFM); merc mage Chill+EB. | Onboarding + PvP practice en farm. Ver `BEGINNER-PATH-1-80.md`. |
| 2026-07-11 | **City NPCs:** William warehouse (deposit/withdraw persistido), Tom blacksmith buy + **repair** (durability `cur`/`max` LifeSpan), Guard greeting. Shop Keeper + Gandalf ya vivos. Howard/Kennedy/Gail/Perry → desks live (ver fila siguiente). | Click→walk→talk→UI. Ver `ShopCatalog.ts`. |
| 2026-07-11 | **City NPCs live desks:** Howard guild interest (persistido + beginner credit), Kennedy citizenship brief, Gail heal/bless/donate, Perry crusade brief. Proto `CityNpcService*`. | Click→talk→UI→server. Ver `ShopCatalog.ts`. |
| 2026-07-27 | **Talents — path PvE potencial (P3.10):** alternativa a “elegir talento en City Hall” = matar **dragón elemental** y obtener **manual elite** (mérito PvE). Magias canónicas: Earth Shock Wave, Mass Blizzard, **HellFire**, **Fury of Thor**; poison elite **a diseñar** (no Mass Venom Strike). Black Dragon → Tanker + loot Abaddon/Elemental. Detalle en `docs/ICEBOUND-AND-DRAGON-TALENT-QUEST.md`. **No committed a build date** — solo backlog de implementación potencial. | Diferenciador vs pick pasivo; endgame content + IB/Icebound. |
| 2026-07-11 | **NFT ops runbook (parcial):** backups Postgres, recover mint-fail, env middleware+server, checklist monitoreo, métricas in-process `/metrics`, claim lock same-instance. **No** sustituye review seguridad `[fable]`. | Fase A hardening ops `[cheap]`. Ver `NFT-OPS-RUNBOOK.md`. |
| 2026-07-11 | **Claim lease DB:** `nft_claim_lease_until` adquirido **antes** del mint (`tryAcquireClaimLease`); libera en fail; métrica `claim_lease_rejected`. Gap residual: crash entre mint OK y `markDropClaimed` (orphan) — reconcile futuro `[fable]`. | Multi-réplica claim sin theater. Ver `NFT-OPS-RUNBOOK.md`. |
| 2026-07-11 | **huntzone3/4:** MAPDATA desde isolatorhk + RMG level 6 → dwell (273 mobs/mapa; −47 Orc-Mage gap). Supersede “bloqueados sin MAPDATA” de la fila RMG anterior. | Completar HZ mid. Ver `SPAWN-PIT-PARITY.md`. |
| 2026-07-11 | **Hub one-click + Phaser desks + FIT + create-char point-buy:** World CTA hace SIWS+desk; SELECTCHAR/Create/Arena en Phaser; viewport FIT; stats 10–14 budget 70 + preview. Traveler/GM saves separados vía `player_mode`. | Onboarding wallet→char sin wallpaper mock. |
| 2026-07-11 | **City NPC desks live:** Shop, Gandalf, William, Tom repair, Howard/Kennedy/Gail/Perry (`CityNpcService*`). Perry = crusade **brief** (no crusade real). Howard = guild **interest** flag (no create/join Fase H). | Click→talk→UI. |
| 2026-07-11 | **Spell/CC audit + drop parity:** Paralyze/Hold/Chill OK; combat/utility fixes documentados en `SPELL-CC-AUDIT.md`. Loot regen + CritCandy 970 en `MONSTER-DROP-PARITY.md`. Summon sin follow-mode Olympia. | Parity early/mid combat + loot. |
| 2026-07-11 | **Crypto loot research:** no integrar AGLD/Lootverse; MVP swaps = DIY escrow + USDC/SOL + Jupiter SPL; Tensor/ME opcional después. Sin código. | Evitar dependency EVM ajena. Ver `CRYPTO-LOOT-AND-NFT-SWAPS.md`. |
| 2026-07-11 | **Bitácora legible:** `docs/BITACORA.md` companion de sesión; MASTERPLAN § 3 sigue siendo changelog canónico denso. | Abrir una página al cerrar el día. |
| 2026-07-12 | **Anti-bot / capacidad (idea):** cerca de cap (~3–4k), miembros de **guildes probadas** tienen prioridad de ingreso; cuentas nuevas/unknown → segmento aparte (cola, overflow, traveler limitado, claim delayed, etc. — menú, sin elegir uno). PoH/Passport sigue en **claim** de airdrop (Helvet), **no** en login. Criterios guild TBD. | Sybil Solana + slots. Ver `ANTIBOT-AIRDROP.md` + § 1.5 + Fase H. |
| 2026-07-12 | **Filosofía AFK / anti-bot:** AFK en mapa, guild cuidando AFKs y enemigos cazándolos = incentivos deseados; adults con progression liviana/overnight humano = OK; enemigo = empresas/AI con docenas–cientos de chars + leveling masivo sybil Helvet. Distinguir 1–pocos chars humano vs flota; **no** banear AFK parado como regla primaria. | Claridad de amenaza. Ver `ANTIBOT-AIRDROP.md` § 0. |
| 2026-07-12 | **MVP toggles anti-bot:** `AntiBotTools.json` + proto GM get/set + panel SysMenu “Anti-Bot / Ops” (:8080 only). Enforce: multi-box session cap, AFK warn/kick si AFK-on-map OFF, telemetry torneo, soft XP drip. Stubs: guild ingress, new-player segment, claim sybil, high-stakes. Traveler rechazado en set. | Ops control sin romper :8081. |
| 2026-07-12 | **Timed Challenges (diseño):** Mode 1 = Skills cronometrado (10 NPCs móviles estilo goblin, Chill Wind previo + protocolo Para/DS o poison+Para/DS, mana free). Rewards: umbral fuerte → +50% EXP 2h; #1 del día → Stone of Integrity (violet zem, upgrade sin burn/downgrade). Mode 2 incompleto — no inventar. **Sin código** hasta cerrar Mode 2 (o mandato Mode 1-only). Anti-farm stone ↔ filosofía flota industrial. | Reto skill scored vs Training Arena libre. Ver `TIMED-CHALLENGES.md`. |
| 2026-07-12 | **Gov staking → reputación:** stake del governance token sube R a **nivel wallet** (≤4 chars comparten R). Curva suave + **hard cap** R=100 (ej. ~25k u). Bonos grind capped (luck ≤+5%, drop general ≤+8%, rare ≤+3% o 0 legendary); **prohibido** daño/HP/hit/CC y bonos en torneo. Overflow → gobernanza + WL/utilidades + rent/rebates (**no** más drop). Unstake cooldown 7–14d + decay. **Sin código** aún. | Anti-whale P2W + utilidad del gov token. Ver § 1.6 + canvas `helbreath-gov-staking-rep` + `BITACORA.md`. |
| 2026-07-13 | **EK screenshots + gallery rarity:** Olympia = schedule ~650ms → JPEG `SAVE/eks/{Victim}_{NNN}.jpg`. Ours: `EnemyKillAwarded` + client capture MVP. Gallery rarity locked: Legendary top10 / Rare 11–50 / Common 51–200 opposing-city killers. | Ver `EK-SCREENSHOT-GALLERY.md`. |
| 2026-07-13 | **Tokenomics $HELL (tentativo PO):** supply **1B**; @ $1M MC → **$0.001**. Alloc: team 100M (3.33%/mes), liq/market 300M, DAO/guilds 100M (schedule “3 months at 5%?” ambiguo), growth 100M (5%/mes), play-mine 400M. Stake: drop **1–20%**, luck **máx. 20**, Guildmaster = guild + collective stake. Uso: consumibles/exp. Mining: **500k/día** cap hasta agotar 400M; créditos (500 kills→10; leg EK→5+1k tok cap 5k/día; top100 EK→3+300; events→5+100). Revenue framing 4k/1.5k/0.4k users × $1/día. **Supersede tentativo** topes § 1.6 luck+5%/drop+8% → **TBD reconcile** (estudio prior preservado). **Sin código**. | Fuente de verdad provisional del PO. Ver § **1.7** + § 1.6 + `BITACORA.md`. |
| 2026-07-13 | **ARPU / embudo consumibles (tentativo PO):** trust on-chain mitiga miedo moneygrab + GM black market → más spend. MUST: Cape+Shoes (montos **superseded 2026-07-17** → USD **25** c/u / combo **40**; early 50–100; Olympia ≥~500). Recurrente: Xelima/Merien ~$1 + bulk packs a +7. $1/día scenarios **se mantienen**; puente año 1 ilustrativo + nota honesta. **Sin código** shop al 13; ver fila 2026-07-17 soulbound. | Mecanismo de soporte ARPU. Ver § **1.7** + `BITACORA.md` + canvas legal-econ. |
| 2026-07-13 | **$HELL utilidad / no-shill / fees (tentativo PO):** MC nunca promesa de enriquecimiento; token = utility (stake char/guild + roles económicos). MC >$1M posible por compras orgánicas en pump.fun **sin** shill — disclaimer de mercado, no target. Estudio crítico captura fees DEX (PumpSwap creator fees dinámicos). Contingencia: burn **all team tokens** si fees+consumibles fondean. Worry legal: retention personal de DEX fees + **5%** P2P intermediary. Policy ~**50%** exchange fees → torneos/marketing/hire. **Sin** DEX code. | Postura marketing + fee retention. Ver § **1.7** + `BITACORA.md` + canvas. |
| 2026-07-13 | **$HELL stake / mine / descuentos / mercado (cerrado PO + craneo):** **C1** $HELL solo play-mine — **no** de stake. **C2** stake = beneficios in-game (§ 1.6–1.7) + descuentos fuertes en consumibles (ej. piedras), cap máx./día, escala por stake. **C3** compras descontadas = **soulbound** (no flip). **C4** mercado espontáneo: mats soulbound → maxxear gear → vender ítem maxxed (no soulbound), precio libre; team **no** shillea como cash-out/crafting business. **C5** freeze: yield tokens, fee-share a stakers, DEX floor cash-out, “stake=dinero”, OTC USDT de goods descontados. **C6** auction non-custodial preferido; balances engines bajos; warn no acumular $$$; fondos en wallets; allowlist phishing TBD. **C7** ~50% fees → torneos/marketing/hire; burn team tokens opcional si fees fuertes — **sin** payout a stakers. Supersede overflow “rent/rebates” § 1.6 (sonaba a dividendos). Caps combate 1–20% vs estudio +5%/+8% = **sigue TBD reconcile**. **Sin código**. | Una historia coherente stake≠mine. Ver § **1.6** / § **1.7** C1–C7 + `BITACORA.md`. |
| 2026-07-13 | **$HELL ~20% liquidez DEX (estudio PO) + Robinhood Chain vs Base:** Pregunta ~**20% (200M)** a DEX como liquidez inicial — **delta** vs bucket docs **300M/30%** (no overwrite). Opciones: deep pair / auction leftovers / MM budget / split; separar de team burn. Postura: lock/burn LP, disclose, no piso/MC promise (C5). **Robinhood Chain** = producto real (mainnet **2026-07-01**, L2 EVM Arbitrum Orbit, Stock Tokens/RWA) — **watchlist**, no P1 gaming constellation. **Base** sigue #1 seat; ARB/Ronin sin cambio. Travel pass intacto. **Sin contratos.** | Ver § **1.7** liq + trayectoria § 1; canvas `helbreath-dex-liquidity-robinhood-base` + `BITACORA.md`. |
| 2026-07-13 | **$HELL launch / LP / fees DEX (C8–C12 · cerrado PO):** **C8** path inicial ~**20% (200M)** vía **pump.fun → PumpSwap** (awareness Solana); delta vs bucket **300M** = resto/re-split **TBD**. **C9** earmark bucket **partnerships ~10%/100M** → Phase-2 LP **opcional** Meteora (o similar) solo si hace falta — no gastar sin notar. **C10** LP: **casi nunca** withdraw; excepción atípica **primeras horas** si precio explota anormalmente (risk/ops), no floor/cash-out. **C11** target fee **~30% treasury / ~70% LPs** en pools Phase-2 configurables; en pump/PumpSwap fee = protocolo → **100% creator-share → treasury**. **C12** **no** Token-2022 transfer tax (fees = swap/creator/juego 5%). **Base** sigue #1 constelación. **Sin contratos.** | Ver § **1.7** C8–C12 + `BITACORA.md` + canvas `helbreath-dex-liquidity-robinhood-base`. |
| 2026-07-13 | **$HELL cash-out personal / treasury + black-swan (C13 · cerrado intención PO):** Si **Meteora Phase-2 (C9) es éxito**, PO **sí** realiza capital **limitado** a offchain (offramp fiat/banco) vía **entidad → payroll/distribución** — motivo = **seguridad** (reserva fuera de wallets si hack), no dump retail. Fuentes preferidas: creator fees, revenue juego (consumibles / ~5% market), vested team bajo caps, salary ops. **No** LP pull rutinario PumpSwap (C10). En éxito Meteora: realización pre-declarada fees y/o trim capped de **team MM capital** (no LP locked graduación). Black swan: reinject desde reserva offchain post-incidente = playbook ops, no floor promise. Marketing freeze (interno). Monto/% = **open #41**. **Sin contratos.** | Ver § **1.7** C13 + C8–C12; `BITACORA.md`; canvas `helbreath-dex-liquidity-robinhood-base`. |
| 2026-07-14 | **Gameplay polish batch (traveler):** church exit warps; 4 city guards ≤3 tiles del TP; Shop NPC chimney + click-approach all NPCs; LU points + Level Set + vitals; F8 scroll/detail + **PVP Skills** Mode 2–3 shipped (waves **1→2→2→2→3**; darkelf+invi/PFA) — supersede parcial “Timed Challenges sin código” 2026-07-12; Peace/Attack/Safe + RMB standstill + Olympia player hover; player-list resync; ground-drop depth; EXP within-level; F6 Achievements-style tabs; SELECTCHAR parchment ink; IconPannel 48/800; Item Drops 60/40 + Olympia sell + shop qty wheel; NFT parseLeaf/finalized; landing Olympia shell. | Jugabilidad diaria + economía gold MVP. Ver § 3 + `BITACORA.md` + `TIMED-CHALLENGES.md`. |
| 2026-07-14 | **Mes de test (~1 mes · PO):** exp/niveles del test **llevan a main**; wipe **solo progresión** si bugs de exp lo fuerzan. Durante el test: **minar $HELL** vía play-mine — MVP = **créditos off-chain (pending)**, no token mint ni pump day-0. Checklist operativo en § **1.7.4**. Must: dominio+HTTPS+host+PG, landing CTA real, ledger pending, Discord+copy freeze, backups. Later: SPL claim, pump C8, stake C2. **Sin contratos / sin deploy.** | Ver § **1.7.4** + `BITACORA.md`. |
| 2026-07-18 | **Landing product live (chainlords.net):** grises World/Arena 360px; Play Now = Phantom + deep-link SELECTCHAR; realm-stats públicos; EK gallery bajo contadores (copy ±10 + rareza top 10/50/200 + rankings rarity); Sunday Arena 1v1/3v3 pages con wallet inscription + field Elo; **seeding tennis** (cabezas de serie no se cruzan temprano). Middleware/play aún default localhost. Premios USDT montos TBD. | Mes de test CTA real + Fase C inscription. Ver § 3 + `BITACORA.md` + `landing/`. |
| 2026-07-18 | **Mint fee anti-spam (PO):** mint cNFT **solo** items ~**USD 30+**. Fee **no gratis** — banda **~USD 0.20–0.50** (o equiv. $HELL); $1 era techo, no target. No mint auto mid-loot. Monto + FX $HELL = **config** (sintonía fina). | Anti-spam + fricción baja. Ver fila mint centralizado + `BITACORA.md`. |
| 2026-07-18 | **Mint centralizado (PO · flujo canónico):** wallets **no** self-mint. Flujo: (1) player pide mintear item elegible; (2) server valida dueño/whitelist/no double-mint; (3) cobra fee USD/$HELL **antes** del mint; (4) **game authority** mintea cNFT Bubblegum; (5) **airdrop** a wallet del player; (6) marca ledger `minted` + idempotencia/lease (anti double-claim). Control del flujo y anti-abuse del lado server (rate limit /wallet/día, cooldown, pausa mint si RPC caro). **No** mint automático al drop. Gas on-chain lo cubre el team (amortizado por fee). Hot wallet authority: multisig/Squads + límites. Orphan mint→finalize = reconcile (runbook). Sintonía fina: montos, whitelist itemIds, caps. Implementación cobro = **TBD código**. | Control + anti-spam + UX simple. Ver pilar Solana NFTs + `NFT-OPS-RUNBOOK.md` + `BITACORA.md`. |
| 2026-07-18 | **AFK vs activo + capacidad early (PO):** AFK ≈ activo en **CCU/RAM**; AFK << activo en **CPU combate/red**. Kick early para liberar cupos (hunt 10–20m; ciudad más laxo). Soft XP drip OFF en prod. Menú: auction offline, idle mode ligero, multi-box, cola login. **AFK largo / park online** → requiere **gran cantidad de $HELL staked** (umbral config; utilidad stake C2, **no** yield). Sin stake live aún: kick por zona + multi-box. Detalle § **1.9**. | Capacidad VPS chico + utilidad $HELL. Ver `ANTIBOT-AIRDROP.md` + `BITACORA.md`. |
| 2026-07-18 | **Priorización dinámica de recursos por mapa/horario (PO · diseño):** con presión de infra, **no** repartir CPU igual 24/7. Días/horas **sin raid de ciudad** → empujar workers/tick budget a **Middleland (ML)** (y mapas calientes); con raid/war → priorizar ciudades + mid. **Sunday Arena** → ventana dedicada coliseum. Requisito: **estadísticas por mapa × día × hora** (CCU, tick p95, msgs/s, kills). Aplicación: primero cron/config manual; luego semi-auto; auto solo con datos estables. Palancas: weights de `GameWorldWorkers`, tick/AI/AOI caps, sleep de mapas vacíos. Detalle § **1.9**. | Infra inteligente sin overprovision. Ver `BITACORA.md`. |
| 2026-07-17 | **Prioridad = lanzar mes de test ya** (traer jugadores, grind nivel, **créditos para airdrop inicial**). Hero set **look pixel premium** (refs Ares/Elv private-server style) = **futuro post-test**, no bloquea launch — copia interna `docs/refs/hero-set-premium/` + § **1.8**. | Focus ship test. |
| 2026-07-17 | **Soulbound cash shop (persiste post-test):** Shoes/Boots Exp+30 · HP/MP+30 · Drop+5% = **USD 25**; Cape Exp+40 · HP/MP+40 · Drop+5% = **USD 25**; **combo USD 40**. Soulbound (no flip). Duración timed vs permanent = open. Supersede montos tentativos ~$30/$50 del embudo ARPU si chocan. | ARPU del mes de test. Ver § **1.7.4**. |
| 2026-07-17 | **Unbind fee = consumible ~USD 5** (*Unbind Seal*): 1 seal quemado = 1 unbind de **cualquier** `item_uid` elegible (hero set, DK upgraded, soulbound cape/shoes, rares bound, …). NFT = **título 1:1** con `item_uid`; stats/bind **off-chain**; **no** remint ni stats on-chain. Preferencia **mint-on-first-unbind** si aún no hay mint. Torneo loadout excluido. **No implementar** en day-0 del mes de test salvo stub. | Ver [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md) § 5–7. |
| 2026-07-17 | **Todo item NFT puede Soul Bind o Guild Bind por ~USD 5** (seals): **no dropea al morir** aunque no haya Zem en bag. Unbind Seal $5 revierte a tradeable (y vuelve a poder dropear / Zem clásico). Tráfico alto de seals = sink cash shop. Guild Bind requiere guilds (Fase H); MVP puede ser solo Soul Bind. Death-loot filter + 3 consumibles; NFT sin cambios de metadata. | Ver [`HERO-SET-UNBIND-MARKET.md`](./HERO-SET-UNBIND-MARKET.md) § 3–4, 7. |
| 2026-07-17 | **MVP código ItemBind shipped:** seals **960/961/962**; proto + bag RMB; persist `bindState`/`boundGuildId`; block sell/auction; soulbound no floor drop; guildbound floor only same-guild pickup; **solo GM/captain (`GuildRank` 2–3) unbindea guildbound**. Cash shop USD + death-loot hook pendientes. | `ItemBind.cs` + client bag menu. |
| 2026-07-15 | **$HELL custody / Squads (C14 · cerrado política PO):** Jugadores = **Phantom**. Treasury / vaults / creator fee recipient / LP·MM grande / mint authority = **Squads** multisig (**2-of-3** o **3-of-5**). Hot ops = float pequeño only. **C13** offramp = entidad → payroll (**no** Phantom personal como fee sink). LP seed/MM owned by multisig; withdraw/trim = N firmas (C10). Devnet puede hot; mainnet migra a Squads. Members/threshold exactos = open. | Ver § **1.7** C14; `BITACORA.md`. Resuelve parcialmente open #7. |
| 2026-07-15 | **$HELL SPL mint (devnet):** `npm run init-hell-token` creó mint + ATAs team/liq/DAO/growth/mining. Direcciones públicas en `BITACORA.md` / `.env.example` comments. Secrets solo en `.hell-token.json` / `.env` (gitignored). Claim: middleware `POST /hell/claim` + game server `HELL_MINT` para SysMenu. | Ver § **1.7.4**; middleware-node. |
| 2026-07-21 | **Discord oficial + FAQ Grok 4.1:** server Helbreath Chain Lords; invite `discord.gg/F4NwwbfKtj`; bot `Chain Lords Bot` con static FAQ + **llm `grok-4-1-fast-non-reasoning`** (`XAI_API_KEY`). Slash `/faq` + `/market`. | Soft test community. Ver `social-bot/`, `BITACORA.md`. |
| 2026-07-21 | **Market side door mobile:** middleware `/market/*` (search, quote, order, pay-dev, desk, advisor); landing `/market.html`; Discord `/market`; game `MarketSideDoor` sync + auto-deliver bag. Grok 4.1 Fast (no 4.5). Pay live USDC = TBD. Railway middleware HTTPS live. | Celular → order → mesa entrega → bag. Ver `MARKET-MOBILE.md`. |
| 2026-07-21 | **Soft test plan:** mañana **Hetzner CX53** (confirmar SKU vs CX52 doc) + **~10 testers amigos** closed. No pump/moon day-0. Checklist § 1.7.4 soft test + `BITACORA.md`. | Primeros humanos externos en World. |
| 2026-07-21 | **Last Stand waves (ref):** análisis https://helbreath-waves.pages.dev/ — patrones oleadas 60s, cuota, multi-type slime→abaddon, HUD, blessings instance-only. Docs `refs/LAST-STAND-WAVES-PORT.md`. | Training por oleadas. |
| 2026-07-21 | **Mode 4 Survival Waves MVP:** multi-type then **PO pivot** → Ettin-only endurance; academy = Guards learning. | See next row. |
| 2026-07-21 | **PvP Academy (PO):** Learning = Guards tandas; Challenge Easy→Elite scaffold. Doc `PVP-ACADEMY.md`. | Enseñar secuencias + ladder. |
| 2026-07-21 | **Academia en catedral:** NPCs 15 Drill Instructor + 16 Arena Master (`arecath`/`elvcath`); boards por tier; premios gold 1/día/tier con **handicap EK** (Standard/Advanced/Ultra — ultra solo Hard+Elite). | Anti-farm low tier. |

| 2026-07-25 | **Progression CL + PL redesign (PO):** (1) **Rebirth → level 79** (no L1 Olympia) — exp = `GetExpForLevel(79)`. (2) **Block Level** botón: congela level; exp **nueva** → **majestic points**; al quitar block, exp nueva vuelve a levels (majestics no se revierten). Casos: park en bracket PL / PL Dungeons / farm gizon. (3) Caps: **Promise Land outdoor ≤110** (`promiseland`/`2ndmiddle`); **Promise Land Dungeons ≤120** = rebrand dungeon farm Olympia (`middled1n`/`middled1x`). (4) Spawns PL: Rudolph **20** diseminados agua isla; Mountain Giant **10** montañas derecha (5+5); troll+clay en isla medio; scorp/SG/skel/zombie/orc Olympia-like pero clay Olympia → **2º pit Stone Golem**. (5) PL Dungeons: 6 crystal + 20 coal nodes; pit grande Cyclops isla; 2 pits Orc salidas (~50,40 elv + sim ares); 2 pits SG ~170,35 y ~40,180; serpientes→orcs; ~8 Ogre pasillos contorno agua sin bloquear puentes. Meta: **desparramar PvP y mapas mid**. **Sin código en este corte** — spec § **1.10**. | Diferenciador server + densidad mid-game. |
| 2026-07-25 | **Stone upgrades CL (Xelima/Merien):** Armas → Stone of Xelima; armor/shield → Merien. **Ancient** cap **+3**. Resto weapons/armor/shield **top +10**. Fail: &lt;+3 no retrocede (solo pierde piedra); ≥+3 puede **−1**; ≥+7 **quema** el ítem salvo **Stone of Integrity** (1112). Prob Olympia `bCheckIsItemUpgradeSuccess` (Merien ×2). Shields sin PA en drop; armaduras sí pueden PA. Bag RMB: Upgrade (Xelima/Merien) / Upgrade + Integrity. | Monetiza piedras + parity Olympia con fail rules CL. |
| 2026-07-25 | **Fishing / Mining gather + top fish buffs + skill 100% rares / cNFT:** (1) **Gold Carp** (más difícil) consume: **+10% hitting probability 1h** + **cero hunger 1h**. (2) **Green Carp** (2º): **cero hunger 1h** + **half SP cost 1h**. (3) Fishing rare loot only at **100% Fishing**: Merien/Xelima stones, Zems, Ruby/Emmy rings (PA mid ~5–10% cap), Merien Shield, Flam+3 — low rates. (4) Mining rare at **100% Mining**: Merien/Xelima/Zems + common ore. (5) **Skills at 100%** can mint as **tradeable skill cNFT** post-test; market prices expected Long Sword cheap · Mining mid · Manufacture very expensive (market-driven). F8: Mine/Fish buttons + skill sync. | Soft-test gather loop + late skill NFT economy. |
| 2026-07-30 | **Item magic affixes CL (PO):** (1) Quality = **daño base flat** en armas físicas — Superior +1 · Superior Sharp +2 · Exceptional Sharp +3 · Exceptional Ancient +4; Sharp siempre **1 menos** que Ancient. **No** usar tooltip vanilla `Damage+value×7`. (2) Primarios + color: Light/Sharp/Critical/Agile/Righteous/Poison/Ancient/CP; **Strong anulado** en armas. (3) Secundarios: HR / CAD / Exp / Gold(Rep) **+1..+7**. (4) Wands: MS0/10/20/22 de catálogo + primario CP/HP vamp/MP vamp + secondary HR/CAD/Exp/Gold. (5) **Rares puros** (Giant BH, Berserk/Kloness, MS22 charge, SuperRare…) sin Sharp/HR/Exp. Código: `OlympiaMagicRoll` + `WeaponQualityBaseDamage` + `IsPureRareDrop` + `OlympiaItemName`. | Feel bag Olympia + economía de drops legible. Doc `OLYMPIA-ITEM-MAGIC-AFFIXES.md`. |
| 2026-07-30 | **PvP / combate feel vs Olympia (PO):** objetivo = **igual o mejor** que Olympia en reglas y feel. **Única distancia aceptable:** límites técnicos de **browser game** (WebGL/JS/tab) y **ping / calidad de servidor pagado**. No usar “es browser” para justificar gaps de mecánica (DamageMove 50/80, stun, cast, spacing, bumps evitables). Capa A+B en `OLYMPIA-PVP-FEEL-GAP.md`; Capa C = videos Tola (top PvP Olympia). | Barra de calidad PvP; priorización post-clips. |
| 2026-07-30 | **Combat feel vs Helbreath War (PO + live Ditizar):** referencia dens 100+ on (ToH). **A** = reglas (DamageMove 50/80, Cancel/Para, floats, quest UI, drops). **B** = snappiness (equip/cast optimistic, wall-slide, delay hit, sin rubber-band). **C** = techo browser (mitigar, no prometer nativo). Meta: acercarse decente; no 1:1 nativo. Código: DamageMove + wall-slide + hit delay; docs § **1.11** + `refs/HELBREATH-WAR-LIVE-NOTES.md`. | Dens PvP feel = prioridad de producto junto a Olympia parity. |

<!-- APPEND nuevas decisiones debajo de esta línea, misma tabla o filas nuevas -->

---

## 6. Evaluaciones externas (APPEND-ONLY)

Otros LLMs / revisores humanos pueden **solo agregar** entradas al final. No reescribir secciones 1–5 salvo el dueño del doc (humano) o un agente con mandato explícito de “reescribir MASTERPLAN”.

### Instrucciones para Fable / otros LLMs

1. Leé § 1 Visión + § 4 Roadmap de la fase que revisás + docs satélite si aplica.  
2. **No borres** decisiones ni evaluaciones previas.  
3. Pegá tu review con el formato de abajo al **final** de este log.  
4. Si proponés cambiar producto: append una fila en § Decisiones (no edites filas viejas).  
5. Priorizá la **§ 10 Cola de críticas** cuando vuelva Fable 5 (batch review > micro-pings).  
6. No implementes código de juego en una sesión de “solo review” salvo mandato explícito.

### Formato de entrada (copiar)

```markdown
### Evaluación — YYYY-MM-DD — <modelo o persona>

**Alcance revisado:** (archivos / fase)
**Veredicto:** OK | Riesgos | Bloqueante
**Hallazgos:**
- …
**Recomendaciones:**
- …
**Qué NO se tocó:** (para no asumir trabajo hecho)
```

### Log de evaluaciones

<!-- APPEND-ONLY: nuevas evaluaciones debajo de esta línea -->

### Evaluación — 2026-07-10 — Cursor Grok 4.5

**Alcance revisado:** exploración de producto Spectator (streams de torneos/desafíos PvP) paralelo a `landing/`; opciones Discord vs plataformas de live; **sin implementación de app ni cambios de juego**.
**Veredicto:** Riesgos (si se insiste en Discord-as-CDN) | OK si se sigue MVP embed
**Hallazgos:**

#### Discord: ¿se puede embeber / retransmitir Go Live o screen share a web/app propia?

- **No hay API oficial** para que un bot o app de terceros consuma, retransmita o embeba el media de Go Live / screen share hacia un sitio o app externa.
- Librerías tipo “discord-video-stream” / selfbots **inyectan** video *hacia* Discord con **user tokens**; Discord prohíbe self-bots → riesgo de ban. Sentido inverso al problema.
- **DAVE / E2EE (marzo 2026):** endurece clientes no oficiales que intenten “escuchar” el stream. Stage channels siguen **dentro** de Discord — no hay export oficial del video a tu dominio.
- **Discord Activities (Embedded App SDK):** apps *dentro* de Discord; no retransmiten Go Live a la landing.
- **OAuth / webhooks / embeds de mensaje:** texto/rich embeds — **no** el bitstream de voice/video.

**Conclusión Discord:** chat, anuncios, comunidad, notifs a guildmates; **no** origen de video para el portal.

#### Alternativas reales — trade-offs

| Opción | Costo | Control / ToS | Latencia | Mobile | Tráfico a *nuestro* portal |
|--------|-------|---------------|----------|--------|----------------------------|
| **OBS → Twitch + embed** | Bajo | Embed rules (HTTPS, `parent`) | ~2–10s HLS | Excelente | Alto si hub en landing |
| **OBS → YouTube Live + embed** | Bajo | IFrame API; VOD | Similar | Excelente | Alto + discovery YT |
| **Kick + embed** | Bajo | Menos maduro | Similar | OK | Medio |
| **Owncast (self-host)** | VPS + BW | ToS propio | HLS | Web | Máximo branding |
| **Cloudflare Stream / Mux / IVS** | $/min | Control total | HLS o WHIP | SDKs | Máximo; costo escala |
| **LiveKit** | Cloud/self | WebRTC interactivo | Baja | SDKs | Overkill para 1→N broadcast |
| **Restream** | Freemium | Multi-destino | = destino | = destino | Twitch+YT+Owncast a la vez |

**Recomendaciones (MVP):**

1. **Corto `[cheap]`:** OBS → Twitch/YouTube; sección Spectate en `landing/`.  
2. Discord anuncia el link; no es CDN.  
3. No app nativa ni LiveKit hasta validar audiencia.  
4. Mediano: Owncast / CF Stream si se quiere cero dependencia.  
5. Largo `[fable]`: app móvil cuando el calendario lo justifique (Fase E).

**Qué NO se tocó:** código de `multiplayer/`, middleware, proto; solo docs (+ nota en `landing/README.md`).

---

### Evaluación — 2026-07-10 — Cursor Grok 4.5 (Build Draft / créditos)

**Alcance revisado:** diseño brackets de poder + point-buy + duelos guest; alineación con equal-footing (`Tournament.json`, `colosseum`). **Sin implementación** de créditos.
**Veredicto:** OK como roadmap futuro | Riesgos de balance si se hardcodean costos prematuros
**Hallazgos:**

- Equal-footing (hero set) **permanece** como producto open/skill-only.
- Brackets Tier 60/120/160 + draft = **segundo** producto PvP (power-band + escasez).
- Duelos guest: char efímero → discard (misma higiene: no filtrar gear de arena al char real).
- Loop de sintonización: heurística → telemetría → ajuste asistido (humano gate) → synergy tax tardía.
- Capas: item / spell / stat / (opcional) synergy tax.

**Recomendaciones:**

- Doc en `TOURNAMENT-BUILD-CREDITS.md`; ejecutar C.2 **después** de estabilizar Fase C.
- Empezar `[cheap]` con stubs JSON + UI picker; `[fable]` para costos y simulación.
- No hardcodear costos finales ni prometer ML end-to-end en el primer corte.

**Qué NO se tocó:** server/client/proto/middleware; solo docs.

---

### Evaluación — 2026-07-10 — Cursor Grok 4.5 (Hero Set unbind + mercado)

**Alcance revisado:** unbind de pago → transfer/venta → rebind al holder NFT; alineación Hero Set (~400–428), `Tournament.json`, `drop_ledger`, Bubblegum, SIWS. **Sin implementación.**
**Veredicto:** OK como roadmap futuro | Riesgos (economía + custody) si se implementa sin invariantes
**Hallazgos:**

| Riesgo | Mitigación de diseño |
|--------|----------------------|
| Wash trading | Fee mínimo + cooldown; no rewards por volume de unbind |
| Unbind farming | Transiciones estrictas; fee on-chain confirmado |
| Item duplicado off/on-chain | Invariante 1:1 `item_uid` ↔ mint; mover ownership, no clonar |
| Torneo loadout vs gear persistente | Unbind **solo** gear persistente + NFT; arena nunca entra al mercado |

**Recomendaciones:**

- Doc en `HERO-SET-UNBIND-MARKET.md`; Fase F tras review seguridad claim/mint `[fable]` (ops runbook Fase A ya hecho).
- Stub fee config + UI estados `[cheap]`; custody/anti-exploit `[fable]`.
- No hardcodear fees ni burn/remint hasta cerrar open questions.

**Qué NO se tocó:** código de juego / middleware de fees; solo docs.

---

### Evaluación — 2026-07-10 — Cursor Grok 4.5 (consolidación MASTERPLAN v0.9)

**Alcance revisado:** reescritura de `docs/MASTERPLAN.md` como borrador único v0.9; contraste con repo (torneos MVP, schema, middleware `tournaments.js`, landing, NFT `super_rare`).
**Veredicto:** OK como bitácora accionable para críticas | Riesgos si se asume “torneos 100% prod-ready” (MVP sí; payout/anti-cheat no)
**Hallazgos:**

- El MVP de torneos está **más avanzado** de lo que decía el MASTERPLAN previo (middleware + UI + Elo + decay lazy ya existen).
- Premios on-chain, bracket visual, anti-cheat y hardening mint siguen siendo el gap real de Fase C.
- C.2 / E / F / escrow quedan correctamente en Diseño; apuestas siguen Eliminado.
- Cola § 10 lista para batch-review cuando vuelva Fable 5.

**Recomendaciones:**

- Priorizar `[cheap]` restante de Fase C (bracket UI, death killer) + `[fable]` payout/anti-cheat cuando haya presupuesto.
- No abrir implementación de C.2/F hasta cerrar hardening A + C payout.
- Usar § 10 como agenda única de la primera sesión Fable 5.

**Qué NO se tocó:** código de juego; solo docs (`MASTERPLAN` + expansión ligera de satélites).

---

### Evaluación — 2026-07-10 — Cursor Grok 4.5 (EKs / Enemy Kills)

**Alcance revisado:** diseño ledger EKs + elegibilidad ±10 + mult ranking; grep `reference/`, `sp-client/reference/Server.cpp`, mp-client; relación `pvp_kills` / `PvpKillLedger` / Elo. **Sin implementación de gameplay.**
**Veredicto:** OK como Fase G Diseño | Riesgos si se confunde con Elo torneo o se porta ciego `EnemyKillRewardHandler` Olympia
**Hallazgos:**

- Olympia EK clásico = piso de nivel víctima (30/80) + facción/mapa (`EnemyKillRewardHandler`); **no** gap ±10 ni ×2/×3 por top.
- Aura “roja da EK”: **no encontrada** como feature dedicada. Evidencia cercana: `DrawObjectName` / `DrawObjectFOE` (FOE rojo), `CheckActiveAura` slate HP (`0x00400000`).
- Repo ya tiene log PvP (`pvp_kills` + `PlayerDied` → `PvpKillLedger`); CharacterDialog “Enemy Kills” hoy = **mob kills** mal etiquetados.
- Separar ladder EK de `pvp_ratings` / HoF evita contaminar torneos equal-footing.

**Recomendaciones:**

- Preferir tabla `enemy_kills` (o columnas claras) con `ek_value`, `eligible`, levels at kill; API pública en middleware + landing.
- Aura relativa al viewer = `[fable]`; MVP `[cheap]` = schema + ledger UI + contador real.
- No dar EK en `tournamentArena` (recomendación de diseño).

**Qué NO se tocó:** server/client/proto/middleware de juego; solo `docs/EK-LEDGER.md` + este MASTERPLAN.

---

### Evaluación — 2026-07-10 — Cursor Grok 4.5 (Guilds + Legacy Airdrop)

**Alcance revisado:** búsqueda de docs/código guild; stubs `GuildDialog` / `Guild.store` / Character guild panel; mapas `gldhall`; canvas chat GM/capitán; ausencia de proto/server guild. **Sin implementación de gameplay.**
**Veredicto:** OK como Fase H Diseño | Riesgos si se airdropea poder de combate o se salta verificación anti-impostor
**Hallazgos:**

- **No** existía `docs/GUILDS-*.md`; el “comando especial” de GM estaba implícito en stubs: **ACTIVE TRAINER** / **ACTIVE KILLER** + tax panel, más privilegio de **chat global** (canvas 2026-07-08).
- UI mock completa en sp-client; mp-client tiene store + menú labels; middleware `/guild/tax` **no** implementado; server C# / proto **sin** guild.
- Mapas `aregldhall` / `elvgldhall` y tickets Admission/Secession ya en catálogo — base cosmética/mundo lista, lógica no.
- Legacy airdrop necesita proceso humano + objeción pública; mimos deben ser cosmético/soft para no P2W ni farm de claims.

**Recomendaciones:**

- Mantener Fase H en Diseño; priorizar spec de roles + chat gate antes de statuses que toquen EXP/daño.
- Coordinar ACTIVE KILLER con anti-farm EK (Fase G).
- Lista de servers = open list; no cerrar roster sin research comunitario `[human]`.

**Qué NO se tocó:** código de juego; solo `docs/GUILDS-AND-LEGACY-AIRDROP.md` + este MASTERPLAN.

---

## 7. Guía de rollback

| Cambio | Cómo revertir | Notas |
|--------|---------------|-------|
| Schema Postgres nuevo | Migraciones **aditivas** (`ADD COLUMN IF NOT EXISTS`). No `DROP` tablas con datos de prod sin backup. | `schema.sql` es en gran parte idempotente |
| Proto / mensajes | Revertir commit de `network.proto` + regenerar client **y** server **juntos** | Nunca server nuevo + client viejo |
| Config JSON (Items, Progression, Tournament) | Restaurar desde git; existe `Items.json.pre-olympia.bak` | Validar IDs de items tras restore |
| Middleware mint | `HELBREATH_MINT_MODE` / desactivar claim en UI; no re-mintear uids ya claimed | Authority key offline |
| Feature torneo | Quitar `tournamentArena` del mundo o no exponer `colosseum` en lobby | Stash debe seguir restaurando char real al salir |
| Elo / ratings | Dejar de pasar `rated: true` en kills; ratings quedan históricos | No borrar `rating_events` |
| Decay | Ajustar constantes en `tournaments.js` o feature-flag el lazy decay | Floor 1000 evita ratings basura |
| Premios custodial | Marcar prizes `cancelled` / no pagar; no firmar txs | Ledger es fuente de “qué se debe” |
| Spectator embeds | Quitar sección Live de landing; streams siguen en Twitch/YT | Cero impacto en game server |
| Unbind / mercado (cuando exista) | `enabled: false` en fee config; no aceptar nuevos unbinds | Reconciliar listings abiertos antes |
| EKs / `enemy_kills` (cuando exista) | Dejar de evaluar elegibilidad en kill path; ledger queda histórico | No borrar filas; ladder deja de actualizarse |
| Guilds / legacy claims (cuando exista) | Feature-flag statuses y chat gate; claims `rejected`/`cancelled` | No borrar evidencia; HoF legacy se puede ocultar |
| Feature flags | Preferir config/env antes que borrar código a medias | Documentar apagado en § Decisiones |

**Backup mínimo antes de tocar prod:** dump Postgres + export authority/collection JSON del middleware + **tag git**.

**Smoke post-rollback:** login wallet → entrar mundo no-arena → inventario intacto; si se tocó torneo, entrar/salir `colosseum` y verificar que el char real no quedó con hero set de arena.

---

## 8. Cómo trabajar con este doc

1. Antes de una feature grande: leer Visión (§ 1) + Roadmap de la fase (§ 4) + satélite si aplica.  
2. Tareas `[cheap]` → Grok/Composer. Tareas `[fable]` → Fable cuando esté; si Fable pausado, solo implementar `[cheap]` con spec ya escrita aquí.  
3. Al terminar: actualizar checkboxes, línea en Changelog (§ 3), decisión nueva → append § 5; si la sesión fue larga, refrescar [`BITACORA.md`](./BITACORA.md) (1 página legible).  
4. Reviews externos → solo § 6 (append). Preguntas de diseño abiertas → § 10.  
5. **No** reintroducir apuestas de espectadores ni Discord-as-CDN sin decisión nueva.  
6. Bugs visuales/gameplay: tras un fix de Grok, correr **VerifyFix** (§ 3.1 de [`FRAMEWORK-MULTIMODELO.md`](./FRAMEWORK-MULTIMODELO.md)) antes de marcar done — call site citado + sin path alternativo.

---

## 9. Referencias rápidas en repo

| Tema | Path |
|------|------|
| Proto | `multiplayer/proto/network.proto` |
| Schema DB | `multiplayer/server/Persistence/schema.sql` |
| Progression | `multiplayer/server/Config/Progression.json` |
| Tournament loadout | `multiplayer/server/Config/Tournament.json` |
| Mundos | `multiplayer/server/Config/GameWorlds.json` |
| NFT tier eval | `multiplayer/server/Helpers/NftDropEvaluator.cs` |
| PvP / Elo | `multiplayer/server/Helpers/PvpKillLedger.cs` |
| Middleware torneos | `middleware-node/tournaments.js` |
| Client torneo UI | `multiplayer/mp-client/src/ui/dialogs/TournamentDialog.tsx` |
| Client MP | `multiplayer/mp-client/` |
| Middleware | `middleware-node/` |
| NFT ops / mint claim + lease | [`NFT-OPS-RUNBOOK.md`](./NFT-OPS-RUNBOOK.md) |
| Bitácora de sesión (legible) | [`BITACORA.md`](./BITACORA.md) |
| Landing | `landing/` |
| Framework modelos | `docs/FRAMEWORK-MULTIMODELO.md` |
| Build Draft | `docs/TOURNAMENT-BUILD-CREDITS.md` + Fase C.2 |
| Unbind / mercado | `docs/HERO-SET-UNBIND-MARKET.md` + Fase F |
| EKs / Enemy Kills | `docs/EK-LEDGER.md` + Fase G |
| Guilds + Legacy Airdrop | `docs/GUILDS-AND-LEGACY-AIRDROP.md` + Fase H |
| Anti-bot / capacidad + Helvet claim + AFK vs flota | `docs/ANTIBOT-AIRDROP.md` + § 1.5 + Fase H |
| Auth / sybil vendors (WaaP · Passport) | `docs/HUMAN-TECH-WAAP.md` + § 1.5 |
| Crypto loot / swaps research | `docs/CRYPTO-LOOT-AND-NFT-SWAPS.md` |
| Gov staking → reputación | § **1.6** + canvas `helbreath-gov-staking-rep` + `BITACORA.md` 2026-07-12 (**TBD reconcile** caps combate vs § 1.7; overflow rent **superseded**) |
| Tokenomics **$HELL** | § **1.7** — supply/alloc/mining **tentativo**; **C1–C13** (stake≠mine … launch/LP/fees + cash-out/black-swan); `BITACORA.md` 2026-07-13; canvas `helbreath-hell-tokenomics-legal-econ` |
| Liquidez DEX + launch/LP | § **1.7** **C8–C13** (pump ~20% cerrado; delta 300M open; partnerships→Meteora earmark; fees pump vs Phase-2; **C13** cash-out/black-swan); Base #1; opens #38/#40/#41; canvas `helbreath-dex-liquidity-robinhood-base` |
| Pits / spawn parity | `docs/SPAWN-PIT-PARITY.md` |
| Drop parity + CritCandy | `docs/MONSTER-DROP-PARITY.md` |
| Item magic affixes (quality / Sharp / colors / rares pure) | `docs/OLYMPIA-ITEM-MAGIC-AFFIXES.md` + P2.7 · `OlympiaMagicRoll` / `ItemMagicAttribute` / `OlympiaItemName` |
| Spell / CC audit | `docs/SPELL-CC-AUDIT.md` |
| Training Arena | `docs/TRAINING-ARENA.md` + mundo `training` + ApplyPreset spawn/chase |
| Beginner Path 1→80 | `docs/BEGINNER-PATH-1-80.md` + `BeginnerPath.json` + Quest panel |
| Farm Barracks | `arefarm`/`elvfarm` dwellAreas + Merc/Dummy + Farm tip sheets |
| Ref. HB Argentina (IG) | `docs/REFERENCE-HELBREATH-ARGENTINA.md` |
| Spectator | Fase E + § Evaluaciones 2026-07-10 |
| Olympia EK reference | `sp-client/reference/Server.cpp` `EnemyKillRewardHandler`; `reference/Client.cpp` `m_iEnemyKillCount` / `DrawObjectName` |
| Guild stubs (UI) | `sp-client/src/ui/dialogs/GuildDialog.tsx`; `*/ui/store/Guild.store.ts`; CharacterDialog GuildPanel |

---

## 10. Cola de críticas para Fable 5

> Agenda batch para cuando vuelva Fable (factura pagada). **No implementar** estas respuestas aquí — solo decidir / especificar.  
> Al resolver una: append Decisión en § 5 y tachar o anotar “resuelto YYYY-MM-DD” en la pregunta.

1. **Build Draft — presupuestos:** ¿cuáles son los `budget` iniciales por Tier 60 / 120 / 160, y qué heurística (rareza Olympia, rol, winrate percibido) fija el primer catálogo de costos sin hardcodear “números mágicos” en combate?
2. **Build Draft — anti-one-item:** ¿costo mínimo de ZWand MS20 / equivalentes endgame en Tier 160 para que “naked + arma” no sea estable? ¿Synergy tax en v1 o solo tras telemetría?
3. **Duelos guest:** ¿identidad anti-abuse solo por wallet, o también rate-limits / stake mínimo simbólico / cooldown entre matches? ¿Ranking Elo de guest separado del char persistido?
4. **Unbind fees:** ¿asset default (USDC vs SOL vs gov token), orden de magnitud del fee, y cooldown entre unbinds? ¿Unbound usable en combate o no (recomendación actual: no)?
5. **Unbind custody:** ¿mint-on-unbind para gear nunca mintado, o exigir claim/mint previo? ¿Burn+remint vs transfer del mismo cNFT (preferencia actual: no quemar)?
6. **Spectator MVP:** ¿Twitch, YouTube, o ambos vía Restream en el primer corte de `landing/`? ¿Calendario manual (CMS/JSON) o admin API?
7. **~~Authority / treasury multisig~~ (parcial 2026-07-15 · C14):** política = **Squads** para treasury/vaults/fee/LP·MM/mint authority; hot = float ops; jugadores = Phantom. **Sigue open:** ¿mismo Squads para unbind/prizes vs $HELL vaults? ¿members/threshold 2-of-3 vs 3-of-5? ¿migrate day-1 mainnet o hot+migrate post-test?
8. **Premios custodial:** ¿flujo de payout (admin firma, claim-by-winner, o ambos)? ¿Qué assets se pagan primero (USDC vs gov) y cómo se fondea el hot wallet de premios?
9. **Escrow desafíos (T3):** ¿pozo 1v1 con lock on-chain antes del match, o ledger off-chain + settle al reportar winner (como torneos)? ¿Límite de stake y KYC/legal?
10. **Anti-cheat torneo:** ¿qué hacer con disconnect a mitad de match (forfeit, pause, remake)? ¿Teaming en solo rated? ¿Validación server-side de que el loadout no se puede mutar en arena?
11. **NFT naming:** producto dice Legendary; código/DB usa `super_rare`. ¿Renombrar tier a `legendary` en schema/API o documentar el alias para siempre?
12. **Prioridad post-factura:** orden sugerido a confirmar — (A) hardening claim/mint + (C) payout/anti-cheat → (E) embeds landing → (C.2) stubs Build Draft → (F) unbind stubs — ¿o reordenar por go-to-market?
13. **EKs — nivel efectivo:** ¿la regla ±10 usa solo `level`, o level+rebirth / otra métrica de poder?
14. **EKs — ranking window:** ¿top 10/50 all-time, season, o rolling? ¿Decay como Elo torneo?
15. **EKs — aura:** ¿flag relativo al viewer (proto por observer) o señal global? ¿Color: solo ring si da EK, o rojo vs gris? ¿MVP = tip/nombre o ground ring fino?
16. **EKs vs Hero Set Olympia:** ¿el contador para cape/helm reutiliza `ek_value` del ledger nuevo o es economía separada?
17. **Guilds — statuses:** ¿ACTIVE TRAINER y ACTIVE KILLER mutuamente excluyentes? ¿% en config desde día 1?
18. **Guilds — chat:** ¿cuántos capitanes por guild? ¿Herald staff también habla en global?
19. **Legacy airdrop:** ¿one-shot al launch o ventanas periódicas? ¿Claim sin GM histórico si hay vouch fuerte de members?
20. **Legacy NFT:** ¿cNFT Bubblegum “Legacy Guild” separado de Rare/Legendary loot, o otro estándar?
21. **Guild economy — fee share:** ¿qué fees cuentan (tax, unbind, marketplace, torneos)? ¿% default y tope? ¿Consumibles solo o soft currency también?
22. **Guild economy — egreso:** ¿definición de “maxed”? ¿Cooldown / 1 bonus por char? ¿Reward al GM, a la guild bank, o a ambos?
23. **Guild partner program:** ¿criterios de elegibilidad (online, antigüedad, revenue)? ¿Forma legal (rev-share contractual vs rewards discretionary)? Counsel obligatorio antes de comunicar $$$$ públicamente.
24. **Prioridad Fase H vs C/A:** ¿stubs de guild (schema + chat gate) antes o después de payout torneo / hardening mint?
25. **Sybil / Passport:** ¿para legacy airdrop o prize gates vale Human Passport (EVM link) vs solo DIY Discord/vouch? ¿Umbral score y fricción LATAM aceptable?
26. **Gov staking — caps combate:** ¿adoptar banda PO § 1.7 (drop **1–20%**, luck **máx. 20**) o conservar estudio § 1.6 (luck +5% / drop +8% / rare ≤+3%)? ¿Curva lineal vs R-score? ¿XP opcional? *(Adquisición/yield/descuentos soulbound = **cerrados** C1–C5 — no reabrir aquí.)* — **sigue TBD**
27. **Gov staking — unidades:** ¿cómo anclar “25k u → R=100” al supply **1B $HELL** (bps del circulating por wallet)? ¿Peso gov overflow lineal o √stake? *(Overflow = gov/WL solo; rent/fee-rebates a stakers = **superseded**.)*
28. **~~Gov staking — rent/rebates~~ (superseded 2026-07-13):** fee-share / rent a stakers **prohibido** (C5/C7). Sustituir por: ¿cómo coexisten descuentos soulbound (C2) con fee share de **guild** (§ 1.4) sin doble-contar sinks? Counsel en copy.
29. **$HELL — DAO vesting:** aclarar “3 months at 5% each?” del bucket DAO 100M (¿5%/mes del bucket? ¿tres tramos?).
30. **$HELL — mining pool:** ¿los +1 000/+300/+100 tokens fijos de EK/eventos salen del cap diario 500k o son adicionales? ¿Fórmula créditos → share del pool?
31. **$HELL — revenue Low:** ¿$0.11M con 400 users es año parcial / ARPU distinto? (ver footnote § 1.7).
32. **$HELL — embudo consumibles:** ¿Cape/Shoes se pagan en $HELL, stables o fiat? ¿Attrs exactos (exp/MP/HP +30%) y si cuentan en torneo? ¿Pricing/odds de bulk packs de piedras (consumer protection)?
33. **$HELL — descuentos stake (C2 open params):** ¿catálogo exacto (solo piedras Xelima/Merien u otros)? ¿fórmula stake→% descuento? ¿cap unidades/día por wallet vs por char? ¿precio full sin descuento sigue tradeable?
34. **$HELL — DEX fees:** ¿Creator Fees o Cashback Coins en launch pump.fun? ¿Recipient = entidad (multisig) o persona? ¿Par SOL vs USDC/USDT?
35. **$HELL — fee P2P 5% + C6:** ¿intermediario off-chain del server o escrow on-chain non-custodial? ¿ToS + geo + KYC umbral? ¿diseño allowlist contratos vs phishing? *(Auction gold MVP shipped 2026-07-13; on-chain still open.)*
36. **$HELL — recycle 50%:** ¿on-chain split / multisig policy / solo ledger interno? ¿Qué cuenta como “exchange fees” vs shop consumibles? *(Confirmar: **0%** a stakers.)*
37. **$HELL — team burn:** ¿trigger cuantitativo (revenue X)? ¿Burn del unlock restante o también tokens ya vested? ¿Comunicación pública post-facto vs pre-anuncio?
38. **$HELL — liquidez / bucket 300M (parcialmente resuelto 2026-07-13 · C8):** path seed = **pump ~20%/200M** **cerrado**. ¿Resto del bucket 300M = auction leftovers / MM / otro, o re-split? ¿Par SOL vs USDC/USDT al create en pump? — **sigue TBD**
39. **Constelación — Robinhood Chain:** ¿confirmar watchlist-only 2026 (vs pitch Base/ARB/Ronin)? ¿Algún use-case prize/USDG que justifique spike técnico? *(Base #1 seat = **confirmado** en C8 nota / trayectoria § 1.)*
40. **$HELL — Phase-2 Meteora (C9 tentativo params):** ¿cuánto del earmark partnerships 100M se reserva vs se usa en otro growth? ¿Trigger “solo si hace falta”? ¿Fee tier exacto para cumplir target 30/70 (C11)? — **sigue TBD**
41. **$HELL — C13 cash-out / security reserve (montos open):** ¿banda **$** o **%** de realización post-éxito Meteora (target = reserva de seguridad personal post-offramp, no vaciar pool)? ¿Prioridad **creator/game fees** vs **trim capped de team MM capital**? ¿Definición operativa de “Meteora Phase-2 = éxito” antes del primer trim? ¿Counsel confirma path entidad→payroll→offramp + bookkeeping? — **sigue TBD**
42. **Item Drops — recycle:** ¿fragments/shards Olympia exactos en F6 Reciclar, o stub hasta parity full? *(Sell gold Olympia formula = shipped.)*
43. **Landing Spectate:** ¿Twitch/YouTube primero sobre el shell Olympia ya shipped, o esperar art/copy swap Chain Lord?

---

*Fin del borrador v0.9. Próxima edición mayor: tras batch-review Fable 5 (§ 10) o al cerrar payout on-chain de Fase C.*
