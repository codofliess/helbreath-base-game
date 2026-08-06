# Bitácora de sesión — Helbreath Chain Lord

## 2026-08-06 — Ops prod + digresión TMS/logística + memoria/skills (antes de volver a CL)

**Contexto:** sesión post PC-reset. Stack real = **Hetzner game** + **Railway middleware** + client `play.chainlords.net`. No asumir localhost como prod.

### Chain Lords / helbreath (código + ops)

- **GitGuardian:** leak `REALM_STATS_SECRET` en commit histórico `landing-api/.env.local.secret` → **rotado** (Railway `chainlords-stats` + VPS `server.env`); secret viejo rechazado 401.
- **Regen vitals Olympia:** `Game.h` clásico — **SP 10s / HP 15s / MP 20s** (relojes independientes + hunger iPlusTime). No “todo 20s con offset inventado”. World **y** Arena (mismo `RunPlayerVitalRegenTick` por `GameWorld`).
- **Bag layout sagrado:** `ConsolidateStackableBagItems` = **no-op** automático; solo merge intencional Shift+click. Autosave 15s. Posiciones BagX/BagY persisten (stash arena restaura char real).
- **Fire Field:** footprint server ya 3×3 (`aoeRadius: 1` Chebyshev); client scale 1.0 + depth under feet (no velo total).
- **Mobs invisibles (Ettin/Stalker):** lazy-load ocultaba body (`alpha 0`) esperando `.spr` → pelean sin sprite. Fix: placeholder **ninja `ghk` visible**; load de **sonidos no bloquea** sprites; emergency texture; retry lazy-load. Deploy client `index-DUW_NWDY.js`.

### Digresión producto (NO es Chain Lords core) — TMS / logística CV

Ideación (guardar para spin-off / skills, no bloquear CL):

1. **Depósitos altos:** 2 drones (redundancia) con lector QR + óptica morfología/conteo de cajas; límites indoor (SLAM, batería, film).
2. **Pallets valor USD 2k–10k enfilmados:** BLE beacon / RFID UHF (no solo cámara).
3. **Mejora de input inventario (80% del valor):** fábrica pega QR o serial+QR en caja; recepción vs remito barata.
4. **Remito repensado:** por línea — imagen **familia** + imagen/glyph **serial**; thumbs en recepción.
5. **Glyph geométrico B/N** = ID visual offline (no requiere chain).
6. **cNFT Solana** de remitos/glyphs = **opcional premium**, no base WMS.
7. Tech ya existe (visión warehouse, drones inventory, RFID); competir en **nicho pyme / un flujo IN-OUT**, híbrido etiqueta+visión.

Docs satélite: [`LOGISTICS-TMS-VISION.md`](./LOGISTICS-TMS-VISION.md).  
Skill: `logistics-vision-tms` (local `~\.grok\skills` + espejo Drive).

### Memoria / skills de agente (post X @N01ennn · PlugMem Microsoft)

**Insight a internalizar:** los agentes no necesitan “más historial crudo en contexto”; necesitan **hechos + skills reutilizables** compilados desde la experiencia (graph / docs / skills), no logs enteros. Hasta ~100× menos tokens de contexto si se alimenta solo lo decision-ready.

**Política PO de dispersión de aprendizajes:**

| Qué | Dónde |
|-----|--------|
| Código producto CL | GitHub `codofliess/helbreath-base-game` branch `consolidacion` |
| Docs densos CL (MASTERPLAN, BITACORA, satélites) | Repo git **+** Google Drive espejo |
| Skills reutilizables multi-proyecto | `~\.grok\skills\*` ahora; monorepo privado futuro `agent-skills` |
| Secrets / SSH / .env | Nunca git / nunca Drive público |
| Handoffs de sesión | `docs/SESSION-HANDOFF-*.md` + Drive |

Skill: `agent-memory-skills` (compilar experiencia → skill/doc, no re-inyectar transcripts).

### Camino personal (video → CV → físico → robots)

- **SportSignature** = ancla 100% video.  
- CV detección/clasificación como proyectos.  
- Toolings físicos (cámaras, latencia).  
- Robótica con o sin socio, después de pipeline video+QC estable.

### Verify

- Play: Ctrl+F5 → mobs ninja o real; bag layout tras relog; regen SP más frecuente que MP.  
- Drive + git actualizados este pass (docs; skills en path local + Drive).

---
## 2026-08-05 — Arena: landing, incentivos $HELL, kit catalog, heroes/sprites, cast/mana, spell gates + PC-reset backup

**PO (sesión larga):** cerrar Arena playable + economía free vs credits; fix visual mage hero; cast/mana Olympia-like; backup pre-reset PC.

### Landing / desk (Phaser + React)

- Contrato: **Phaser arriba** (select char desk), **React** solo strip BI + jump tabs; footer no solapa BI.
- `ArenaSelectCharDesk.ts` + `BleedingOnlineStrip` + `DeskModeJumpTab` + reserva de altura footer (`footerActionY` / strip reserve).
- Deploy client VPS `play.chainlords.net` → `/opt/chainlords/client`.

### Incentivos Arena $HELL (`ArenaIncentives` + `HellMiningStore`)

| Acción | Premio (diseño live) |
|--------|----------------------|
| AFK BI ≥ **2 h** | **5 000** $HELL (claim / pending grant) |
| Duelo pact | **10 000** $HELL |
| Stream / announce bonus | **20 000** $HELL (caps + ledger UTC) |
| Anti-AFK | **off** en BI (no kick idle BI) |
| Social | anuncio **X + Discord** vía social-bot / pact hooks |

Ledger durable JSON + `GrantPendingHell`. Archivos: `ArenaIncentives.cs`, `AntiBotTools`, `ArenaPact*`, `HellMining*`.

### Kit / catalog Arena (free vs credits)

- **Free bag:** loadout path-filtered (war / mage); **HP50 / MP** armor sets **gratis** solo en free path; **no** Cape plain (id 400 ban).
- Capas free: **CIC+7 / HP50** + MC/MP free variants.
- **Credits (DR/MR + MCon):** capes dual DR pieces + MR/MCon — **no** meter free HP/MP sets en shop de créditos.
- Mage **Hero set** visible: Cap / Robe / Hauberk (sprites 416/420 `equippedSpriteMale/Female` + fallback gender en `PlayerAppearanceManager`).
- **Blood Rapier** STR **39**, full swing **1**; **Merien Shield** STR **40** (`ItemEquipCatalog`).
- INT-gated spells usan **Angel INT**; dual-magic armor encode + `OlympiaItemName` secondary display.
- Sanitize SKUs legacy: `set-hp50-war` UNKNOWN bloqueaba Complete → `sanitizeCatalogPurchases` client+server.
- Archivos clave: `ArenaLoadout.cs`, `ArenaKitCatalog.json` / `.ts`, `arenaKits.ts`, `ArenaKitBuilder*`.

### Cast / mana (parity Olympia normal)

- Full cast ≈ **1200 ms** cuando Magic **100%** o Mag ≥ **50** (no turbo 600 ms).
- Cast lento ≈ **1800 ms** fuera de ese umbral (`PlayerDerivedStats`).
- Mana costs desde **`Magic.cfg`** vía `MagicManaCatalog` (no circle×3 inventado).
- Arena credit-only spells: **Inhib / Cancel / Sleep** (ids **45 / 46 / 52**) — `IsArenaCreditGatedSpell`; charges per-use en arena (`ChargeWand` / `GameWorldPlayer`).
- **Mass Blizzard** credit gate: **TBD PO**.

### Deploy / ops

- VPS **46.224.129.38** · `/opt/chainlords/{client,server}` · branch git **`consolidacion`** · remote `github.com/codofliess/helbreath-base-game`.
- Publish folders locales (`publish-*-sc`, etc.) = **artefactos pesados** → **no** git; copiar a Drive si se necesitan rebuild offline.

### Backup pre-reset PC (esta entrada)

- Actualizar **MASTERPLAN** + esta **BITACORA** + `SESSION-HANDOFF-2026-08-05.md`.
- **GitHub:** código + docs (sin `publish-*` / `tmp-*` / logs).
- **Google Drive:** handoff + docs densos + contexto de sesión (cuenta `martin.fliess@grupofliess.com.ar`).

### Pendiente post-reset

1. `git pull` branch `consolidacion` + re-clone si hace falta.
2. Re-verify kit Complete + sprites mage hero tras hard refresh.
3. Mass Blizzard gate (si PO confirma).
4. Re-link SSH key Hetzner / secrets locales (`.env` no van a git).

---

## 2026-07-30 — Rebirth cancel / rollback (gap vs Olympia)

**PO / Boris:** en Olympia se puede **tirar atrás el rebirth** (avance guardado) y volver al **L max del RB anterior**. CL no tenía cancel.

### Shipped
- Snapshot **pre-rebirth** (RB, L, exp, maj, stats, block) al rebirthear
- F5 **Cancel Rebirth** → restaura snapshot (o fallback RB−1 + L150 si no hay snapshot)
- Proto `RebirthRollbackRequest` + deploy server/client

### Flujo
1. Rebirth L150 → L79 RB+1 (snapshot guardado)
2. F5 → **Cancel Rebirth** → RB anterior + L/exp/maj/stats pre-RB

---

## 2026-07-30 — PvP feel gap: Capa A (Olympia) + B (CL)

**PO:** cómo medir experiencia PvP vs Olympia (move, bumps, kicks, fluidez). Tola (top PvP Olympia) grabará clips (Capa C).

**Norte de producto (PO):** lo único que puede distanciarnos de Olympia (en lo posible) son **límites técnicos de browser** y **ping / calidad de servers pagos**. El resto: **iguales o mejores** (mecánica + feel). Documentado en `OLYMPIA-PVP-FEEL-GAP.md` §0 + decisión MASTERPLAN.

### Capa A (Olympia source)
- **DamageMove / patada:** umbral de **daño**, no lista de bichos.
  - Mapa normal: **dmg ≥ 50** → 1 tile kick
  - Fight zone: **dmg ≥ 80**
  - Bajo umbral: solo anim de hit
- Client: `DEF_NOTIFY_DAMAGEMOVE` → `OBJECTDAMAGEMOVE` interpolado

### Capa B (CL hoy)
- Kick solo si `AttackType.Knockback` (modo de ataque)
- Mobs: casi ninguno `attackType: 3` (Guard/Sorceress/Academy Elite)
- **No** hay umbral 50/80 → gap feel principal **KB-1**

### Entregable
- Doc: [`OLYMPIA-PVP-FEEL-GAP.md`](./OLYMPIA-PVP-FEEL-GAP.md) — matriz gap, brief grabación Tola, plan post-video
- **No** se reescribió combate aún (esperar clips Tola + Olympia de él)

### Siguiente
1. Tola: clips Oly + CL (brief en el doc §7)
2. Implementar DamageMove 50/80 (+ log feel) según prioridades de video

---

## 2026-07-30 — Tutelary Angels (Gail / majestics L150)

**PO:** cerrar gap Olympia de ángeles al max level.

### Olympia (relevado)
- Max level → exp sobrante = **majestics (gizon)**
- Gail CMD Hall: **Tutelary Angel** STR/DEX/INT/MAG por **5 maj** c/u (ids 1108–1111)
- Equip: bonus = nibble upgrade + 1 (base claim = +1)
- Upgrade con majestics en bag hasta +15 (CL)

### Ya teníamos
- Accrual majestics max-level / Block Level
- Equip bonuses angelic
- Bag `MajesticUpgrade` angels + DK
- Arena angels +15

### Gap cerrado + deploy
- **Claim** `claim_angel_str|dex|int|mag` en Gail (cathedral) y Perry (command-hall)
- Soulbound + 5 maj spend server-side
- Client UI 4 botones en NpcTalkDialog
- Chat tip al primer majestic
- Doc [`OLYMPIA-ANGELS.md`](./OLYMPIA-ANGELS.md)

### Flujo jugador
L150 → farmear maj → Gail → Angel X (−5 maj) → equip accessory → RMB upgrade

---

## 2026-07-30 — Item magic affixes Olympia (calidad + Sharp/Ancient flat + rares puros)

**PO:** diseño de items — primarios/secundarios/colores; Common/Superior/Exceptional; Sharp/Right/Ancient/Light/Agile/Poison (Strong anulado); HR/Exp/CAD/Gold +1..+7; wands MS base + CP/HP/MP vamp; **rares sin Sharp/HR/Exp**.

### Regla de daño base (corregida en vivo)

El tooltip vanilla `Damage+value×7` (Sharp) es **mentira de display** — CL **no** lo usa.

| Nombre | Daño base flat |
|--------|----------------|
| Superior (sin Sharp/Ancient) | **+1** |
| Superior Sharp | **+2** |
| Exceptional Sharp | **+3** |
| Superior Ancient | **+3** |
| Exceptional Ancient | **+4** |

Sharp = Ancient − 1 al mismo tier. Fórmula: `qualityBase (Sup=1 / Exc=2) + Sharp(+1) / Ancient(+2)`.

### Shipped (server + client + prod)

- `OlympiaMagicRoll.cs` — dice primarios/colores; Strong never; secondary HR/CAD/Exp/Gold +1..+7; wands CP/HP vamp/MP vamp
- `ItemMagicAttribute.WeaponQualityBaseDamage` — equip flat (no value×7)
- `MonsterLoot.IsPureRareDrop` — rares/legendaries attribute 0
- `OlympiaItemName.ts` — Superior/Exceptional + tooltips flat
- Doc: [`OLYMPIA-ITEM-MAGIC-AFFIXES.md`](./OLYMPIA-ITEM-MAGIC-AFFIXES.md)
- Deploy VPS `chainlords-game` active + client `index-DmiD_a7G.js`

### También en la misma racha (contexto)

- Drop parity batch (Ettin full bake, Giant BH rare, plate legs GG/HC/TW/dragons/Abby, MS22 charge wands, ESW shop-only)
- Portal hub rails / bag scale / ML unicorns — ver MASTERPLAN changelog

### Verificar in-game

1. Ctrl+F5 client
2. Drop arma normal → `Superior Sharp …` / `Damage+2` (no `Damage+14`)
3. Rare (Giant BH, Berserk wand, MS22 charge) → **puro**, sin HR/Exp/Sharp

---

## 2026-07-28 — Balance debt: Fire Field ticks too high (KEEP)

- **Fire Field / ground effects** can hit ~250 HP per tick (full `RollMagicDamage` + Mag). Melts big bosses; **left high on purpose** to speed big-mob drop testing.
- **Do not nerf yet.** Debt doc: [`BALANCE-DEBT-FIRE-FIELD.md`](./BALANCE-DEBT-FIRE-FIELD.md).
- Grok reminder task `nerf-fire-field-damage` weekly Mon 11:00 ART until done.

## 2026-07-26 (madrugada) — Handoff

- Trabajo live en **CX43** `46.224.129.38` (peso gold/20, CSS deploy, depth mobs).
- **CX53** ya provisionado `178.105.251.138` pero **vacío**; play sigue en CX43.
- Detalle: [`SESSION-HANDOFF-2026-07-26.md`](./SESSION-HANDOFF-2026-07-26.md)

> Log **legible** por sesiÃ³n. La bitÃ¡cora canÃ³nica densa (checkboxes, decisiones append-only, roadmap) sigue en [`MASTERPLAN.md`](./MASTERPLAN.md) Â§ 3â€“5.  
> No inventar: solo lo verificado en docs/cÃ³digo del repo.

---

## 2026-07-24 â€” X @ChainLordsHQ + content ops Discord

**PO:** cuenta X **@ChainLordsHQ** live; automatizar contenido con Discord.

### Shipped
- Handle oficial en docs, landing footer/news, social-bot `.env` / FAQ
- [`docs/social/CONTENT-OPS-X-DISCORD.md`](./social/CONTENT-OPS-X-DISCORD.md) â€” workflow joint
- Bot: `/content draft|list|show|post-discord|pack-load|x-handle` + pack semana 1
- Queue JSON: `social-bot/data/content-queue.json` (runtime)

### Ops
1. Pin en X el pack `pin`
2. Reiniciar social-bot â†’ `/content pack-load`
3. Set `DISCORD_ANNOUNCE_CHANNEL_ID` para post-discord
4. X API auto-post = fase 2

---

## 2026-07-24 â€” X + roles guild Discord + airdrop gates (diseÃ±o)

**PO:** cuenta X ademÃ¡s de Discord; follow X como condiciÃ³n de airdrop (claim); Discord despuÃ©s para no colapsar; roles GM/capitÃ¡n/veterano/guildsman + tag de guild; salas por HELL staked.

### Docs
- Nuevo: [`docs/social/X-GUILD-ROLES-AIRDROP.md`](./social/X-GUILD-ROLES-AIRDROP.md) â€” orden Xâ†’Discord, ranks, category rooms, roadmap
- Actualizado: `OPS-DESK.md`, `FREEZE-COPY.md` (copy airdrop/X/guild rooms)

### Ops hoy
- X: **@ChainLordsHQ** (ver entrada content ops)
- VPS `DISCORD_WEBHOOK_URL` sigue vacÃ­o
- Roles guild + stake rooms = diseÃ±o; bot `/guild-role` = prÃ³ximo slice

### AlineaciÃ³n
- Stake rooms = utility unlock (MASTERPLAN C1â€“C5), no yield
- Claim-time social gates (como PoH en claim), no en login

---

## 2026-07-21 (noche) â€” Academia en catedral + leaderboards + handicap EK

**PO:** Learning/Challenge en **church** con 2 NPCs; boards por nivel; premios con handicap (ultra no farmea low tiers).

### Shipped
- NPCs **15 Drill Instructor** + **16 Arena Master** en `arecath` / `elvcath`
- `PvpAcademy.cs` â€” desks, boards, EK count, gold reward 1/day/tier
- Handicap: Standard &lt;50 EK Â· Advanced 50â€“199 Â· Ultra â‰¥200 (solo Hard/Elite)
- Client roles `academy-learning` / `academy-challenge` en NpcTalkDialog
- Clear challenge 10â€“13 â†’ board + reward check

### Flujo jugador
1. EntrÃ¡ catedral â†’ hablÃ¡ con **Drill Instructor** (learning) o **Arena Master** (challenge/boards)
2. CompletÃ¡ challenge â†’ mensaje handicap + gold si elegible
3. Boards en el panel del GM

### TBD
- Sprite hero-set GM real para Arena Master
- AI war/mage por tier
- Umbrales EK configurables en JSON

### Academy EK (PO Â· Hard/Elite)
- Clear **Hard** â†’ +1 EK lifetime, **mÃ¡x 1/dÃ­a UTC**
- Clear **Elite** â†’ +1 EK por clear, **mÃ¡x 3/dÃ­a UTC**
- Easy/Intermediate no dan EK (anti-farm)
- Contadores en `PvpAcademyLedger.json` (`academyEkHardToday` / `academyEkEliteToday`)

### Elite > Unicorn (PO)
- Unicorn: ES + Chill + Para (random cast)
- Monsters **pueden** castear Para (hostile debuff allowed)
- Catalogs **100â€“103** Academy Recruitâ†’Elite Contender
- `AcademyCombatAi`: prioridad Paraâ†’Chillâ†’ES (no random puro)
- Grok = diseÃ±o de polÃ­tica offline; runtime = state machine

---

## 2026-07-21 (noche) â€” PvP Academy: Learning Guards + Challenge ladder (visiÃ³n PO)

**PO:** No importa multi-mob survival (Slimeâ†’Abaddon). Con items actuales **Ettins ya son muchÃ­simo**.  
Lo que importa: **guardias en tandas** para enseÃ±ar **patrones/secuencias PvP** (aprendizaje), y luego **challenge por nivel** con NPCs firma GM + hero set (war/mage AI: Easy â†’ Elite).

### Producto
- Doc: [`PVP-ACADEMY.md`](./PVP-ACADEMY.md)
- Config: `Config/PvpAcademy.json`
- **Learning** = Mode 2 Guards waves (tips por oleada) + Mode 3 DE
- **Challenge** Easy/Int/Hard/Elite = modes **10â€“13** scaffold (Guards + label; AI hero TBD)
- **Endurance** Mode 4 = **Ettins only** (no bestiario)
- UI Training â†’ tab **Academy** (default)

### Challenge tiers (target AI)
| Tier | Comportamiento |
|------|----------------|
| Easy | Movimiento predecible; casi no PFM/AMP |
| Intermediate | Self PFM/PFA/AMP lento |
| Hard | Te tira PFA/DS, Chill, invi a veces |
| Elite | Invi pots, 1 Merien, Xelima, Para fuerte |

### CÃ³digo
- `TimedChallenge` modes 10â€“13 + tips learning waves
- Survival â†’ Ettin-only
- TrainingDialog Academy panel

### PrÃ³ximo build grande
NPC actor hero-set + AI profiles por tier (no day-0 de los 10 testers).

---

## 2026-07-21 (noche) â€” Mode 4 Survival Waves MVP (cÃ³digo)

**PO:** pasar de la ref Last Stand a implementaciÃ³n.

### Shipped
- `TimedChallenge` **Mode 4** â€” drip spawn, 60s/wave, multi-catalog 1â€“14, tick 1s
- `Config/SurvivalWaves.json` + defaults built-in
- Training UI: **Start Survival Waves** + HUD message
- Docs TIMED-CHALLENGES Â§ 2.5 actualizado

### Probar
1. Join world (no torneo) Â· Shift+F10 â†’ Challenge  
2. **Start Survival Waves**  
3. Ver banner WAVE 1 SLIMES Â· matar / esperar timer  
4. Abort o clear wave 14  

### TBD
- Blessings instance-only  
- Endless post-14  
- Leaderboard survival  
- Abaddon catalog 64 cuando estÃ© complete  

---

## 2026-07-21 (noche) â€” Ref: Helbreath Last Stand waves (training por oleadas)

**PO:** https://helbreath-waves.pages.dev/ es muy parecido a la idea de **sesiones de entrenamiento por oleadas**.

### AnÃ¡lisis
- Browser solo: hold field, **wave 60s**, drip spawn (max 10 concurrent), gold, armory mid-run, level-up **2 blessings**, game over.
- Tabla waves 1â€“14: Slimes â†’ â€¦ â†’ Wyvern â†’ Abaddon + endless.
- FÃ³rmulas: quota por wave, damage/HP scale, banner UI.

### QuÃ© tomamos (diseÃ±o, no assets)
1. Doc port: [`refs/LAST-STAND-WAVES-PORT.md`](./refs/LAST-STAND-WAVES-PORT.md)
2. Seed JSON: [`refs/survival-waves-seed.json`](./refs/survival-waves-seed.json)
3. Snapshot `game.js` local solo para estudio (no ship)
4. MASTERPLAN / TIMED-CHALLENGES: **Mode 4 Survival Waves** = diseÃ±o post soft test

### Encaje
- **Ya shipped:** Mode 2/3 waves Guards/DarkElf `1â†’2â†’2â†’2â†’3` (skill practice).
- **Mode 4** reusa spawn/wave plumbing + timer 60s + multi-catalog + HUD.
- **No** copiar OPK/sprites del site; mapear a `Monsters.json` nuestro.

### No ahora
- Implement full Mode 4 antes de CX53 + 10 testers.
- Roguelike shop/blessings en char main.

---

## 2026-07-21 (tarde) â€” MaÃ±ana: VPS CX53 + soft test 10 amigos

**PO:** maÃ±ana **subir server a Hetzner CX53** y conseguir **~10 testers amigos** (closed test, no marketing pÃºblico de precio/$HELL).

### Objetivo soft test (10)
- Wallet login â†’ character list â†’ World (estabilidad, no features nuevas)
- Discord: invite + `#how-to-play` + `#bug-reports` + `/faq` (Grok 4.1)
- Opcional: market mobile dev-pay (no USDC real) si el middleware/desk estÃ¡ wired
- Feedback: crashes, bag, login, lag, â€œno entiendo cÃ³mo jugarâ€

### Checklist maÃ±ana (orden)
1. **Pagar / provisionar CX53** (o CX52 si al final es ese plan â€” confirmar SKU Hetzner)
2. SSH + Docker + compose: game `:1337`, middleware local o **usar Railway middleware**, Postgres, nginx/Caddy
3. TLS: `play.chainlords.net` (+ `api.` si middleware en VPS; si no, API = Railway)
4. Env game: `MARKET_MIDDLEWARE_URL`, `MARKET_SYNC_SECRET` (mismo secret Railway), auth secrets
5. Landing: `__CHAINLORDS_PLAY_URL__` â†’ HTTPS play; middleware URL ya pÃºblico
6. **social-bot** en VPS con `pm2`/`systemd` (no PC del PO) + `XAI_API_KEY`
7. Invite 10 amigos al Discord; pin play link; rol Tester si hace falta
8. Smoke: 2â€“3 wallets desde redes distintas; 1 bug report de plantilla

### No en day-0 de los 10
- pump.fun / moon talk  
- mint mainnet masivo  
- pay live USDC (seguir `MARKET_PAY_MODE=dev` salvo treasury listo)  
- promise de airdrop $  

### Estado stack al cierre 2026-07-21
| Pieza | Estado |
|--------|--------|
| Landing | Live Railway `chainlords.net` + `/market.html` |
| Middleware + market API | Live Railway `chainlords-middleware-production.up.railway.app` |
| Discord + bot Grok 4.1 | Live (bot en PC hoy â†’ **mover a CX53 maÃ±ana**) |
| Game World pÃºblico | **MaÃ±ana CX53** |
| Grok 4.1 | Key en social-bot + Railway middleware |

Ver: [`VPS-CX52-PENDING.md`](./VPS-CX52-PENDING.md) (actualizar SKU a CX53 si aplica) Â· MASTERPLAN Â§ 1.7.4 soft test.

---

## 2026-07-21 â€” Market side door mobile + Grok order + delivery desk

**PO:** celular â†’ landing market â†’ Grok arma compra â†’ wallet USDC â†’ mesa de entrega â†’ bag in-game. Modelo **Grok 4.1 Fast** (no 4.5). Sin combate.

### Hecho (cÃ³digo)
1. **middleware-node/market.js** â€” search, quote, orders, reserve, pay-dev / confirm-pay, desk claims, advisor NL + optional xAI, game sync endpoints
2. **landing/market.html** (+ css/js) â€” UI mobile + Phantom connect + checkout dev
3. **landing/index.html** â€” bloque Market link
4. **social-bot** â€” slash `/market` + FAQ keywords
5. **MarketSideDoor.cs** â€” sync listings desde auction board; auto-deliver claims al entrar al world / tick
6. Doc: [`docs/MARKET-MOBILE.md`](./MARKET-MOBILE.md)

### Env clave
`MARKET_SYNC_SECRET`, `MARKET_MIDDLEWARE_URL`, `MARKET_PAY_MODE=dev|live`, `MARKET_TREASURY_WALLET`, opcional `XAI_API_KEY`

### Deploy 2026-07-21 (avanzado)
- Railway service **chainlords-middleware** (Node 20) Â· `https://chainlords-middleware-production.up.railway.app`
- Landing redeploy con `market.html` + middleware pÃºblico
- Partial stack fill en quote/order
- `MARKET_PAY_MODE=dev` en prod por ahora (test)

### Pendiente / hardening
- Verificar tx SPL USDC on-chain en live (memo orderId)
- Volume persist para `data/market-state.json` (Railway ephemeral)
- Payout seller USDC batch
- Game server env `MARKET_MIDDLEWARE_URL` + `MARKET_SYNC_SECRET` en **CX53** (maÃ±ana)
- ~~Social-bot MARKET_API_URL prod~~ (hecho) Â· bot con Grok 4.1 (hecho en PC; migrar a VPS)

---

## 2026-07-21 â€” Discord oficial Chain Lords (condensado + bootstrap)

**PO:** armar Discord propio del proyecto (estilo Olympia condensado), simple de moderar y automatizable.

### Layout
INFO (welcome, announcements, status, links) Â· COMMUNITY (general, lfg, guilds, media) Â· PLAYTEST (how-to-play, bug-reports, support) Â· ARENA (arena-news, arena-lfg) Â· VOICE Â· STAFF (ops*)

### AutomatizaciÃ³n
- Script `social-bot/setup-server.mjs` â€” roles, canales, permisos, pins, invite forever
- FAQ bot existente `social-bot` + freeze copy (fase 2)
- Mail: ops@ / hello@ â†’ chainlords.net@gmail.com (CF Email Routing OK)

### Docs
- [`docs/social/DISCORD-SETUP.md`](./social/DISCORD-SETUP.md) actualizado

### Hecho 2026-07-21
1. Bot **Chain Lords Bot#4529** en server **Helbreath Chain Lords** (`1528992494920925305`)
2. Bootstrap canales/roles/pins OK
3. Invite permanente: **https://discord.gg/F4NwwbfKtj**
4. Landing actualizada + Railway deploy + CDN purge
5. Staff role: asignar a mano (Server Members Intent off en bot)  

### Pendiente
- PO: rol **Staff** a sÃ­ mismo en Members  
- ~~FAQ bot~~ â†’ **Grok 4.1 live** (2026-07-21); maÃ±ana en CX53  
- Enable Community en Discord si quieren announcement channels nativos  
- Soft test: **10 amigos** post-CX53

---

## 2026-07-18 â€” VPS primer mes: Hetzner CX52/CX53 (actualizado 2026-07-21)

**PO (2026-07-18):** CX52 pendiente de pago.  
**PO (2026-07-21):** **maÃ±ana subir a CX53** + **10 testers amigos**. Confirmar SKU exacto en Hetzner al provisionar.

### Acordado
- VPS **holgado** 1er mes (game + opcional middleware + postgres + nginx play).
- Landing + middleware market **pueden seguir en Railway** (ya live); game **sÃ­ o sÃ­** en VPS.
- Bot Discord + Grok en el VPS (pm2), no en notebook del PO.
- Cuando pague: **SSH** (IP + key) â†’ compose + TLS + wire play URL.

### Checklist al tener el VPS
1. SSH root + Docker  
2. docker-compose: server `:1337`, postgres, nginx; middleware local **o** Railway  
3. TLS + `play.chainlords.net`  
4. Landing `__CHAINLORDS_PLAY_URL__` â†’ play HTTPS  
5. Invite 10 testers + smoke  

5. Probar login wallet desde red externa  

### No hacer aÃºn
- Multi-region / K8s / 1000 CCU sizing.

---

## 2026-07-18 â€” Priorizar recursos por mapa/horario (ML vs ciudades)

**PO:** si hay que racionar infra â€” p.ej. dÃ­as **sin raid de ciudad** â†’ mandar capacidad a **Middleland** (donde mÃ¡s se necesita). Medir **dÃ­as y horarios** de uso real y aplicar presupuesto de workers/tick con inteligencia.

### Idea
- Calendario de eventos (raid / war / Sunday Arena) + stats histÃ³ricas.
- Off-peak ciudades â†’ mÃ¡s budget a **ML** (+ huntzones calientes).
- Peak raid â†’ ciudades + mid primero.
- Arena domingo â†’ ventana dedicada coliseum.

### Stats a guardar (por mapa)
CCU, tick ms p95, msgs/s, kills, teleports â€” por **dÃ­a de semana + hora**.

### AplicaciÃ³n
1. Manual: cron + config weights.  
2. Alertas semi-auto.  
3. Auto solo con datos estables.

### Docs
- [`MASTERPLAN.md`](./MASTERPLAN.md) Â§ **1.9** (priorizaciÃ³n dinÃ¡mica) + Â§ 5.

### CÃ³digo
- **TBD** (mÃ©tricas rollup + budget por franja); multi-worker registry ya existe.

---

## 2026-07-18 â€” AFK vs activo + liberar CCU early + stake para parkear

**PO:** documentar costos AFK vs activo; early liberar recursos; quien quiera AFK largo â†’ **mucho $HELL staked**.

### Recursos (conectado en mapa)

| | AFK | PvE activo | PvP activo |
|--|-----|------------|------------|
| CCU / RAM sesiÃ³n | **â‰ˆ igual** | alto | alto |
| CPU combate / red | **bajo** | alto | muy alto |
| DB loot/kills | bajo | alto | alto |

â†’ Kick AFK sirve para **cupos y RAM**, no tanto para bajar lag de pelea mid.

### Early (sin stake live aÃºn)
1. Kick idle **hunt/dungeon** 10â€“20 min; ciudad mÃ¡s laxo.
2. Soft XP drip **OFF** en prod.
3. Multi-box cap ON.
4. Auction offline cuando toque (mata AFK vendedor).
5. Idle mode ligero (menos broadcast) si hace falta CPU/red sin liberar CCU.

### Stake â†” AFK (diseÃ±o)
- AFK extendido / â€œpark onlineâ€ solo con **gran stake $HELL** (umbral config).
- Utilidad de stake (C2), **no** yield ni fee-share.
- Sin umbral â†’ timers estrictos.

### Docs
- [`MASTERPLAN.md`](./MASTERPLAN.md) **Â§ 1.9** + decisiÃ³n Â§ 5 2026-07-18.
- Complementa filosofÃ­a [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) Â§ 0 (no contradice â€œcaza de AFKs OKâ€; filtra parkear gratis a escala).

### CÃ³digo
- Timers por zona + stake check = **TBD**; base `AntiBotTools` AFK warn/kick ya existe.

---

## 2026-07-18 â€” Mint centralizado + fee ~USD 0.20â€“0.50 (polÃ­tica Â· sintonÃ­a fina TBD)

**PO:** vamos por mint **centralizado** (server controla el flujo) + fee anti-spam **barato**. SintonÃ­a fina de montos/whitelist despuÃ©s.

### QuÃ© se mintea
- Solo piezas que **valen la pena** (piso producto ~**USD 30+**).
- Mid-loot / farm â†’ **solo inventario server** (cero mint automÃ¡tico al drop).

### Fee
- **No gratis.** Banda objetivo **~USD 0.20â€“0.50** o **equivalente $HELL**.
- **$1** era techo tentativo; con 0.2â€“0.5 alcanza para desincentivar spam.
- Monto exacto + FX $HELL â†’ **config JSON** (sintonizable en test).

### Flujo canÃ³nico (authority mint + airdrop)
1. Player pide mintear item elegible (UI claim / unbind path).
2. Server valida: dueÃ±o, whitelist, no double-mint, no lock (auction/bound).
3. Cobra fee (**stable** y/o **$HELL**) **antes** del mint.
4. **Game authority** mintea cNFT Bubblegum.
5. **Airdrop** a la wallet del player.
6. Ledger: `fee_paid` â†’ `minting` â†’ `minted` + lease/idempotencia (anti double-claim).

### Anti-abuse (lado server)
- Rate limit mints / wallet / dÃ­a; cooldown entre mints.
- Pausar mint si RPC/gas se pone caro.
- No self-mint desde client sin pasar por server de juego.
- Authority key: multisig/Squads + lÃ­mites (no meter todo el treasury).

### Por quÃ© centralizado
- Control de elegibilidad y anti-spam.
- UX simple (user no pelea gas/failed mint).
- Gas cNFT barato lo absorbe el team; fee cubre spam + margen chico.
- Encaja pipeline existente (Bubblegum + claim lease + `drop_ledger`).

### Docs
- [`MASTERPLAN.md`](./MASTERPLAN.md) Â§ 1.1 + Â§ 5 decisiones 2026-07-18 (fee + flujo centralizado).
- Ops: [`NFT-OPS-RUNBOOK.md`](./NFT-OPS-RUNBOOK.md) (lease/orphan).

### CÃ³digo
- Pipeline cNFT **ya existe**; **cobro fee + gate claim** = **TBD** (cuando implementemos).

---

## 2026-07-18 â€” Landing chainlords.net + Arena Sunday + inscripciÃ³n tennis

**Dominio live:** [chainlords.net](https://www.chainlords.net) / Railway `chainlords-landing` + CDN purge.  
**Marca en UI:** Helbreath **Chain Lords** (header seal; tagline bajo Aresden | Elendiel | The Coliseum).

### Landing layout (product)
- Wallpaper full-bleed; shell 3 columnas: grises laterales **360px** (+50% sobre 240) + centro oscuro.
- **Sin** banners externos `path-rail`; World/Arena **dentro** de las grises.
- **Izquierda (World):** â€œUnder the goddessâ€ Â· **Helbreath World** (+30% tÃ­tulo) Â· Play Now amarillo (PNG) Â· contadores verdes live Â· **EK Gallery** debajo de stats.
- **Derecha (Arena):** **Helbreath Arena** (+30%) Â· Sunday PvP Events (3v3 / 1v1 como links) Â· copy crÃ©ditos maxed / warning defensa Â· premios **USDT**.
- **Centro:** manifesto Solana (ownership + governance) Â· video Â· Play + **wallet guide** (Phantom, seeds en papel, nunca share) Â· News / Features / Contact.
- **Quitado:** nav NEWS/PLAY/â€¦ del centro.

### Play Now â†’ wallet â†’ character list
- Landing `main.js`: Phantom â†’ middleware `/auth/challenge|verify` â†’ redirect traveler `?wallet=&token=&mode=world`.
- HTTPS landing + middleware HTTP: fallback `?mode=world&autologin=1` (cliente hace Phantom).
- Client: `bootstrapWalletDeepLinkAtBoot` + `consumeWalletDeepLink` + `LoginScreen` / `ConnectDialog` â†’ `enterPlayWorldPhase` (SELECTCHAR).
- Defaults locales: play `127.0.0.1:8081`, middleware `:3001`, stats `:1337` o Railway stats API.

### Realm stats (live)
- Server `GET /api/realm-stats` + push opcional `REALM_STATS_*` â†’ `landing-api` Railway.
- Landing poll 30s: online / Bleeding Island / Inside Buildings / PVP-PVE (`RealmStats.cs`).

### EK Gallery (izquierda)
- Copy: no todo kill es EK (Â±10); rareza por rank vÃ­ctima en ladder ciudad enemiga (Leg top10 / Rare 11â€“50 / Common 51â€“200).
- Rankings mÃ¡s allÃ¡ del total: most Legendary / Rare / total / nation boards.
- Grid + filtros; API middleware `/ek-screenshots` (stub vacÃ­o hasta prod).

### Arena inscription pages (tennis draw)
| PÃ¡gina | Formato |
|--------|---------|
| `landing/arena-1v1.html` | solo / 1v1 |
| `landing/arena-3v3.html` | team / 3v3 |

- Phantom sign-in + form (fighter / team + mates).
- Tabla preclasificados (seed, Elo, Wâ€“L) + preview R1.
- Middleware: `GET /arena/week?format=solo|team`, `POST /arena/week/register` (wallet token).
- Memory store si no hay Postgres; con PG: torneo semanal auto + `pvp_ratings`.
- **Seeding tennis** en `tournaments.js` `buildRoundOneSlots` (1 y 2 mitades opuestas; orden ATP recursivo) â€” tambiÃ©n al **start** de bracket real.

### Archivos clave
`landing/index.html`, `chainlord-extras.css`, `main.js`, `arena-*.html`, `arena-inscription.{js,css}`, `landing-api/server.js`, `middleware-node/tournaments.js`, `mp-client` `walletAuth.ts` / `LoginScreen.ts` / `ConnectDialog.tsx`, `server/Helpers/RealmStats.cs`

### Opens / TBD
- Middleware **pÃºblico HTTPS** (hoy landing apunta a `127.0.0.1:3001`).
- Prize pool USDT montos reales; lock draw + admin start desde ops.
- City killer ladder real para rareza EK galerÃ­a (sigue TBD).
- X / Discord oficial URLs cuando el user las tenga.

---

## 2026-07-17 â€” Cashier cash shop (Stablecoin | $HELL)

**NPC Cashier (id 14)** en guild hall + city hall (Ares/Elv).  
Dialog: **Stablecoin Market** (USDC/USDT allowlist) vs **$HELL Market** (pending credits; always pricier).

### CatÃ¡logo (solo lo pedido)
- 6 boosts: Shoes/Boots Exp+30 + (MP|HP)+30 + Drop+5%; Cape Exp+40 + (MP|HP)+40 + Drop+5%  
- Combos Cape+Shoes MP/HP $40 stable / 65 $HELL  
- Seals 960â€“962 ($5 / 8 $HELL)  
- Stones MerienÃ—5 / XelimaÃ—5  

### Pago
- Stable: mint allowlist mainnet USDC/USDT (+ devnet USDC); **fake mints rejected**  
- Dev: grant without chain tx if `AllowDevGrantWithoutChainTx`  
- $HELL: `HellMiningStore.TrySpendPending`  

### Archivos
`CashShop.cs`, `Config/CashShop.json`, `CashShopDialog.tsx`, items 950â€“955  

---

## 2026-07-17 â€” Mes de test prioritario + hero set premium (futuro)

**PO:** lanzar server a **test ~1 mes** cuanto antes (jugadores, niveles, **crÃ©ditos â†’ airdrop inicial**).  
**Hero set pixel premium** (refs Ares/Elv en Desktop `CHAIN LORDS`) = **despuÃ©s del test**, no bloquea launch.

### Docs
- Copia interna: `docs/refs/hero-set-premium/` (`ares-hero-set-ref.jpeg`, `elv-hero-set-ref.jpeg` + README)
- [`MASTERPLAN.md`](./MASTERPLAN.md) Â§ **1.8** (futuro art) Â· Â§ **1.7.4** actualizado Â· Fase F fila arte Â· Decisiones 2026-07-17

### Soulbound cash shop (persiste post-test)
| Item | Stats | Precio |
|------|-------|--------|
| Shoes/Boots | Exp +30% Â· HP/MP +30 Â· Drop +5% | **USD 25** |
| Cape | Exp +40% Â· HP/MP +40 Â· Drop +5% | **USD 25** |
| Combo | ambos | **USD 40** |

Soulbound (no trade). ImplementaciÃ³n shop/pagos = work del mes de test si se vende day-0.

### Prioridad build (no arte hero)
1. Infra + HTTPS + landing CTA real  
2. Carry exp + play-mine crÃ©ditos visibles  
3. (Opcional mes) cash shop soulbound Cape/Shoes  
4. Post-test: hero set art + unbind F  

### Bind / unbind seals â€” **MVP cÃ³digo 2026-07-17**
- Items.json **960** Soul Bind Â· **961** Guild Bind Â· **962** Unbind Seal  
- `ItemBind.cs` + proto `ItemBindRequest/Result` + bag context menu  
- Persist `bindState` / `boundGuildId` en bag+equip  
- Bloquea drop suelo / auction / sell-for-gold si bound  
- Guild unbind: solo **GuildRank captain(2) o master(3)** + mismo `guildId`  
- Guild rank stub en char (`GuildRank` persistido); set via `SetGuildRank` (guild create Fase H)  
- Death-loot filter: enganchar cuando exista drop-on-death  
- Cash shop USD / mint seals a player: TBD (GM CreateItem 960â€“962 en :8080)  

---

## 2026-07-17 â€” Pickup aim + spell aimAssist scan

### QuÃ© no anda / parcial (re-scan)
- **GAP / P2â€“P4:** guild create, crusade, Heldenian loop, craft, fishing skill, EK ladder, friends/mail
- **PARTIAL P1:** spawn-pit/drop parity, full Magic.cfg roster, mana regen clÃ¡sico, PvP criminal/aura full
- **P0 playtest:** Magic Tower Learn E2E (cÃ³digo ship; validar en juego)
- **DEFER:** anti-speedhack clÃ¡sico

### Pickup â€œcursor no calibradoâ€
- Antes: click â†’ `pixel>>5` celda; **solo** pickup en **misma** celda (2Âº click). Gold auto al pisar; resto no.
- **Fix:** click sobre loot â†’ dest = `item.worldX/Y` + walk-to-pickup al llegar; hitbox sprite con pad.

### Aim assist magias
- **Ya existÃ­a** para Para/Hold/buffs/Lightning Bolt (`aimAssist` + snap celda a entidad bajo cursor).
- **Faltaba** en EB/Fire/Chill/Blizzard/Massâ€¦ â†’ **activado** en Spells.json combat set.
- No es â€œcerca de la celda sin clickear el cuerpoâ€: hay que clickear **sobre** el sprite (pad +8 px). AoE se centra en la entidad si hay snap.

---

## 2026-07-17 â€” P0 Olympia parity (coder): city feel ship

**Pedido:** mandar a producciÃ³n los gaps salvo anti-speedhack; **empezar P0 ya**.

### Ship P0 (cÃ³digo)

| Ãrea | Cambio |
|------|--------|
| **Oro** | Traveler login **no** wipe bag; `ConsolidateStackableBagItems`; gold id 90 spend consolidado |
| **Magic Tower** | `learn:N` / `unlearn:N`; spend bag gold; Resync spells via `InitialState`; Unlearn tambiÃ©n resync |
| **Client book** | Server `learned=` **reemplaza** (no merge forever); `applyServerSpellUnlocks` authoritativo + protocol flag |
| **Cast fail** | `SpellCastFailed` si hechizo no allowlisted |
| **Mid spells** | Chill/Para/DS/Heal en mapa Olympiaâ†’server + allowlist post-Learn |
| **Run speed** | **260 ms**/tile run (walk Ã—2); client defaults 260 |
| **Wall path** | Click pared: no spiral; stop sin progreso; hold-LMB no thrash |

### Docs
- [`OLYMPIA-PARITY-GAP.md`](./OLYMPIA-PARITY-GAP.md) â€” filas P0 marcadas DONE (playtest pendiente)

### Verify (jugador)
1. Ctrl+F5 `http://localhost:8081/` traveler â†’ PauPau  
2. Oro en F6 persiste entre login  
3. Gandalf â†’ Learn Heal â†’ aparece en F7 â†’ cast  
4. Unlearn â†’ sale del book y no casteable  
5. Learn Chill/Para/DS si hay oro â†’ cast  
6. Run feel ~260; click pared no corre en cÃ­rculos  

**Anti-speedhack clÃ¡sico:** DEFER (otro ticket).

### Archivos clave
`MagicTower.cs`, `Casting.cs`, `Spawn.cs`, `GameWorldPlayer.cs`, `InventoryManager.cs`, `MagicShopDialog.store.ts`, `MagicShopDialog.tsx`, `GameObject.ts`, `GameWorld.ts`, `PlayerDialog.store.ts`, `NetworkManager.ts`, `OlympiaServerSpellMap.ts`.

---

## 2026-07-16 â€” Character List B (ship): centered hero + classic buttons + detail

**Ship:** layout **B only** (lista izq + hÃ©roe centro + detail der).

### PO feedback aplicado
- Letras mÃ¡s grandes (tÃ­tulo 36, slots 20/17, detail 15â€“16)
- HÃ©roe **centrado** en pantalla (`viewW/2`, `viewH*0.42`), scale **+50%**
- Slots izq **+50%** (~420Ã—108, mini oval mayor)
- Botones **abajo en hilera**: Start Â· Create Character Â· Delete Character Â· Change Password Â· Log Out
- Copy clÃ¡sico (sin â€œForge/Seal soulâ€)
- Panel derecho: Legendary items Â· Rare items Â· Status (stats + hours; hunt tiers TBD server)

**Verify:** Ctrl+F5 `http://localhost:8081/` â†’ World â†’ Character List.

---

## 2026-07-15/16 â€” Traveler UI parity (F5 / F6 / minimap / drops / mobs)

SesiÃ³n larga de polish jugable (cliente + server). **Sin commit** de secrets.

### F5 Character (Olympia 315)
- HP/MP/SP como **texto slash** coloreado (sin barras).
- Tooltips de fÃ³rmulas Str/Vit/Dex/Int/Mag/Luk (mirror `Client.cpp`).
- Paper-doll: base nude + capas de gear; city/faction legible.
- Footer 6 botones abajo; **Achievements** una sola etiqueta; letras azules.
- Feedback queda en F12 (producto).

### F6 Bag
- Ãrea de items a **todo el marco** menos franja footer.
- Quitado cartel **Item Drops** del footer y botÃ³n **Sort**.
- Footer: `peso cur/max Â· items n/50 Â· oro N` (i18n por idioma SysMenu/chat).
- Avisos de loot en **system log** (abajo-izq), no chrome de bag.

### Sell for gold
- LÃ³gica Olympia buy-back ya en server (`OlympiaSellPrice` / `Shop.HandleSellBagItemRequest`) + mirror client.
- Fix flujo: no borrar drop-log hasta OK server; toast + system log; sell desde context menu de bag; match bagâ†”drop mÃ¡s robusto.

### Item Drops (rareza Olympia)
- Solo **pickup** notable â†’ log F6 (no al caminar sobre piles).
- **Legendary** = bases tope (Devastator, Berserk Wand, Xelima/Merien/Kloness/DKâ€¦) â€” IDs sync `NftDropEvaluator`.
- **Rare** = magic-roll / blacksmith con umbrales Olympia (dual magic, hit>4, +â‰¥6, stat%â‰¥35).
- Common no entra al log; loot common sigue yendo al **piso** (oro auto-pickup al pisar).

### Guide map (minimap esquina)
- TamaÃ±o ~322 (+15%); arrastrable; zoom rueda/Â±; hide Ã— / RMB / **M**; F11 translucidez (Shift+F11 = Mob Kills).
- Party = puntos verdes; self azul; pits = thumbs monstruo (load on-demand `.spr`).
- Layout pos/zoom en `localStorage`.

### System log + toasts
- System log abajo-izq **mÃ¡s grande** y legible (~20px, panel suave).
- Toasts abajo-der: **solo letras** (sin recuadro dorado), elevados sobre el dock.

### Monstruos
- Fix titileo Moveâ†”Idle entre pasos de red (`Monster.startMovement`).
- Velocidades desde **Npc.cfg ActionTime** (Ant 1400 ms, Slime 2300, â€¦) + chase `SrchRange`.
- Agro: chase mÃ¡s rÃ¡pido (`ActionTimeâˆ’350`, floor 600 ms) como `NpcProcess` Olympia.
- Server rebuild + restart requerido (y hecho en sesiÃ³n cuando el lock de `Server.exe` lo permitiÃ³).

### SELECTCHAR / Character List (Olympia 18.2 re-try)
- Sin tab **Log Out** arriba-izq (no frame 50 + cover piedra opaca Wâ‰¤198, sin clip del tÃ­tulo).
- Cards: labels **Name / Lev. / Talents** (parche sobre bake classic NAME/LEV/Exp).
- Help well = copy Olympia START/DELETE (sin summary del slot ni marketing NFT).
- Fila **Wallet** + Reveal/Hide (stand-in de Email).
- Preview walk con ropa default (shirt+pants) o gear equipado.
- Letterbox CSS cm intacto (`login-selectchar-active`).
- Capturas: `mp-client/scripts/verify-selectchar-out/olympia-retry-*.png`.

### Archivos clave
`CharacterDialog.tsx`, `CharacterPaperDoll.tsx`, `InventoryDialog.tsx`, `olympiaSellPrice.ts`, `olympiaDropRules.ts`, `ItemDrops.store.ts`, `CornerMinimapHud.tsx`, `SystemLogOverlay.tsx`, `Monster.ts`, `GameWorldMonster.cs`, `Monsters.json`, `rpg-ui.css`, `main.tsx`, `SysMenuDialog.store.ts`, `SelectCharDesk.ts`, `selectCharSlotLayout.ts`, `ArenaSelectCharDesk.ts`.

**Verify:** F5 vitals/tooltips/doll Â· F6 pocket + sell Â· loot floor/common Â· rare/legendary en Item Drops Â· minimap drag/zoom/F11 Â· ants ~1.4 s/paso Â· toasts legibles sobre dock Â· SELECTCHAR Name/Lev./Talents + sin Log Out tab + Wallet/Reveal.

---

## 2026-07-15 â€” Research Aragon (DAO) â†’ patrones sÃ­ / Solana default

**Contexto:** bucket DAO/guilds 100M + C14 Squads + Solana-first + freeze utility.

**Hallazgo:** Aragon OSx + App = **EVM-only** (Ethereum/Polygon/**Base**/Arbitrum/L2s). Plugins Ãºtiles: Token Voting, Multisig, Addresslist, Admin + dual/optimistic. **Govern/Voice/Court = sunset.** **Sin Solana nativo.**

**Veredicto PO:** adoptar **patrones** (proposeâ†’voteâ†’execute, hÃ­brido council+comunidad, permissions, optimistic grants, tipado de propuestas). **No** deploy Aragon day-1. Default = **Squads + votos guild in-game**. Aragon en Base = solo si seat Base + season budget EVM + counsel.

Detalle: [`MASTERPLAN.md`](./MASTERPLAN.md) Â§ 1.7 â†’ subsecciÃ³n *Research Aragon* (bajo C14). **Sin contratos. Sin commit.**

---

## 2026-07-15 â€” C14 Squads/multisig + `$HELL` mint (devnet)

**C14 (docs locked Â· MASTERPLAN Â§ 1.7):**
- **Players:** Phantom (self-custodial).
- **Treasury / capital material:** **Squads** multisig (**2-of-3** o **3-of-5**) â€” allocation vaults, creator fee recipient (C11), large LP/MM, mint authority if any.
- **Hot ops:** small float only (tx fees, claim escrow ops, small prizes).
- **C13 offramp:** entity â†’ payroll â€” **not** personal Phantom as fee sink.
- **LP seed / MM:** owned by multisig; withdraw/trim = N signatures (C10).
- Devnet traveler may use hot game-authority; mainnet migrates to Squads. Members/threshold exact = open (partial close of open #7).

**Devnet mint (ran `npm run init-hell-token` Â· authority `QwVTG29AdREoNrGXpEHJxvsipcq8XJWSnD14SRLtE2C` Â· ~4.5 SOL):**

| Role | Public address (ATA / mint) |
|------|-----------------------------|
| **HELL_MINT** | `Gnjgneo47EQdn63ejVsgyPLVvbW2GzqfkhfnS4SM43yF` |
| Team vault ATA (100M) | `CSHTcukkNVqQjHyUvPTDBd4T8AdB9NDE7zthVnCESyG4` |
| Liquidity / market ATA (300M) | `DQdwNnV3CPDVRiq8bgq35LVW1vHasVGZN3MA9Pu4zjJ8` |
| DAO / guilds ATA (100M) | `2MKfDM1N54ydpKduEYQ262dt9Sn4FqtSdnKeqrTU9svP` |
| Growth / partnerships ATA (100M) | `EF6WNL8wWy5rEMqtwfF3wtSbj6MhMMieLhvMQ8MYNdKi` |
| Play-mine escrow ATA (400M) | `2w4vE7ieXkJWoBQTDJgkAPfcx6a5H3uHCwszUAfkRz9m` |

Secrets (`HELL_MINING_VAULT_OWNER_SECRET`, vault owner keys) only in `middleware-node/.hell-token.json` / `.env` â€” **gitignored**, not committed. Sync: `node scripts/sync-hell-env-from-token.js`.

**Verify claim path:**
1. Middleware loads mint from env or `.hell-token.json` â†’ `GET /hell/status` shows mint + vault.
2. Game server process has `HELL_MINT=<mint>` â†’ SysMenu `claimAvailable`.
3. Earn pending via play-mine â†’ wallet session â†’ `POST /hell/claim` pays SPL from mining vault.

**Sin commit** de secrets. **Sin** Squads on-chain setup este pass (polÃ­tica only).

---

## 2026-07-14 â€” $HELL play-mine MVP (cÃ³digo Â· C1 ledger + mint script)

**Coded this pass:**
- **Server:** `HellMiningStore` / `HellMining` â€” JSON ledger `Chars/hell-mining.json` (400M pool, 500k/day cap). Credits: 500 monster killsâ†’10c; legendary EKâ†’5c+1k tok (cap 5k EK/day); top100 EKâ†’3c+300; Timed Challenge clearâ†’5c+100 once/day. Daily credit-share settle on UTC rollover. Direct tokens count against the 500k day budget.
- **Proto + client:** `HellMiningStatus` / claim guidance; SysMenu (F12) shows pending $HELL + todayâ€™s credits (utility copy, no ROI).
- **Middleware:** `npm run init-hell-token` creates SPL mint + ATAs (team/liq/DAO/growth/mining 400M) on **devnet**; `GET /hell/status`, `POST /hell/claim` pays from mining vault when env set. Shared ledger path via `HELL_MINING_LEDGER_PATH`.

**Still TBD / out of this pass:** vesting unlock schedules; pump.fun (C8); stake utility/discounts (C2); DEX/Meteora; city killer ladder (legendary/top100 EK ranks stubbed â†’ rarity stays Unspecified until ladder exists); Postgres migration of ledger (JSON is fine for traveler).

**Verify in-game:** kill monsters â†’ SysMenu kill counter; clear a Timed Challenge â†’ +5 credits / +100 pending; EK awards need rank ladder for legendary/top100.

---

## 2026-07-14 â€” Checklist mes de test (docs Â· Â§ 1.7.4)

PO quiere **~1 mes de test** (pÃºblico/cerrado). Decisiones de producto: exp/niveles del test **llevan a main** (wipe solo progresiÃ³n si bugs de exp); durante el test ya se debe **poder minar $HELL**.

**Docs vs cÃ³digo (honesto):**
- **C1â€“C13** + tabla MINING + pump path = **docs locked / tentativo** â€” play-mine ledger + mint script **ahora viven** (ver entrada arriba); stake/DEX/pump **aÃºn no**.
- **SÃ­ viven:** chars/exp Postgres, NFT cNFT claim (`middleware-node/mint.js`), auction mock gold, landing shell Olympia + tag Chain Lord (Play â†’ `localhost:8080`).

**Respuesta a â€œÂ¿quÃ© hace falta para arrancar?â€:**
- **Dominio + HTTPS + hosting** (traveler + game + middleware + PG) = **sÃ­, must**.
- **Landing polish** marca Chain Lord + CTA Play â†’ URL real = **sÃ­, must** (no hace falta redesign total day-0).
- **Smart contracts / pump day-0** = **no**. Mining del mes = **crÃ©ditos off-chain (pending)** â†’ claim SPL despuÃ©s; pump.fun = post-mes / cierre.

Checklist completo: MASTERPLAN **Â§ 1.7.4**. **Sin commit.**

---

## 2026-07-14 â€” Olympia Parity P2.1 / P2.3 / P2.4 (chat tabs Â· spell announce Â· damage chains)

Client traveler (sin commit; P1 HUD intacto):

- **P2.1 Chat Log:** F9 tabs `Global Â· Trade Â· Town Â· Nearby Â· Guild Â· Party Â· Whisper Â· All`; send by active tab; `/w Name msg` + `/trade`/`/guild`/â€¦; channel line colors; SysMenu Whisper toggle filters whisper lines; chat overhead tint by channel (P1.3 wire).
- **P2.3 Spell announces:** `Mass-Fire-Strike!`-style float over caster (role colors); local cast also â†’ SystemLog.
- **P2.4 Damage chains:** merge rapid hits `-45-45-45!` (crit `!`); dealt yellow / taken red; heal `+N` green on local HP up.

Verify: `:8081` â†’ F9 tabs/whisper â†’ cast (announce + log) â†’ multi-hit mob (chain numbers).

---

## 2026-07-14 â€” Olympia Parity P2.2 / P2.9 / P2.10 (party Â· weather Â· exp ticker)

Client + wire (sin commit; retry polish after usage limit):

- **P2.9 Party UI:** F5 Party tab members + HP bars; proto `PartyMember` + `PartyState.members`; vitals rebroadcast (combat/heal/city/rez).
- **P2.10 Clima:** `defaultWeather` icebound/middleland; SysMenu **Rain sounds**; dry maps ambient cycle (first precip ~25s, then ~3 min).
- **P2.2 Exp ticker:** SystemLog every 10s + F5 `Exp (10s)` / **Rested Exp** from `Progression.store` (rested pool stub=0; server TBD).

Verify: `:8081` â†’ F5 Party create/join (HP) â†’ grind (ticker in log + F5) â†’ F12 Rain sounds / middleland rain / icebound snow / dry map wait ~25s.

---

## 2026-07-14 â€” Olympia Parity P2 death / F5 / bag / tooltips

Client traveler session UI (sin commit; P1 HUD intacto; retry after usage limit):

- **P2.6** Death â†’ floating golden **Restart!** bottom-right (no parchment modal); killer caption; wire `IN_UI_REQUEST_SERVER_RESURRECT`. SystemLog death line already P1.2. Zemstone-on-death = TBD.
- **P2.12** F5: Talents (TBD stub), Majestics, Hunger 50% (TBD), Title + Clear Title (local stub), Enemy Kills `n/total`, Contribution/Rep/Weight existing.
- **P2.8** Bag footer: weight + abbreviated gold + Sort + `Drops (N)`; Item Drops rarity/Epic purple tints.
- **P2.7** Tooltips: compact magic `Poison Damage+N`, `Endurance`, `Required Str: N (M full speed)`, colored name + green magic attr lines.

Verify: `:8081` â†’ F5 / F6 / die for Restart!. Hub DOM: `node scripts/verify-p2-hub-dom.mjs` (13/13 ok).

---

## 2026-07-14 â€” Olympia Parity P1.3â€“P1.6 (+ quick wins)

Client traveler HUD/feel (sin commit):

- **P1.3** Chat overhead `Nombre: texto` sobre la cabeza (~10 s, rojo outlined) â€” `Player.showChatOverhead` + `GameWorld` â† `CHAT_MESSAGE_RECEIVED`.
- **P1.4** Minimapa esquina semi-transparente (`CornerMinimapHud`) top-right; toggle **M** / F12 Guide Map / RMB hide (reemplaza dialog flotante como default).
- **P1.5** Reloj 1â€“24 sobre dial IconPannel + tint noche en `GameWorld` (hora client-local 48 min/dÃ­a; server hour = TBD).
- **P1.6** Cartucho central alterna `Map(x,y)` â†” `Required Exp: N (xx.xx%)` cada 4 s.
- Quick wins: oro bag abreviado (item 90); screenshot **PrintScreen** / **Ctrl+Shift+S**.

Verify: `:8081` â†’ mundo â†’ chat (overhead) â†’ M (minimap) â†’ mirar cartucho/reloj â†’ F6 gold stack â†’ Ctrl+Shift+S.

---

## 2026-07-14 â€” Olympia Parity P1.1 + P1.2 (quest tracker + system log)

Client traveler HUD overlays shipped (sin commit, sin proto nuevo):

- **P1.1** `QuestTrackerHud` â€” columna derecha (oro + cyan + flash `Completed!`): Beginner Path + milestones de kills/rebirth + Timed Challenge.
- **P1.2** `SystemLogOverlay` â€” log bottom-left coloreado (rojo daÃ±o HP, verde heal, cyan tips, blanco eventos): HP deltas, pickups, party, server msgs, death, temp effects, tips de Training Apply.
- Stores: `SystemLog.store.ts`; wire en `App.tsx` / `main.tsx` / logout reset. Hunt/daily server counters = **TBD** (roadmap).

Verify: traveler `:8081` â†’ entrar mundo â†’ pelear (log rojo/verde) / F5 Quest enroll / Shift+F10 Apply tips / milestones en tracker.

---

## 2026-07-14 â€” P1.7 Target mob HP bar (Olympia parity)

- **MonsterHoverOverlay** restyled: red hostile name, `(Berserked)` suffix, thin red HP strip (no brown card / allegiance panel). Stays visible while attacking even without hover.
- **Enemy skull** over FOE opposing-city remotes (world marker + hover); PK count not on wire yet.
- **Quick win:** HotkeyBar HP label â†’ cyan `Poisoned` when local `TemporaryEffectType.Poison` is active (no duration/N on client).
- **Sin commit.** Verify hover/attack target bar + poison label on `:8081`.

---

## 2026-07-14 â€” Olympia Parity Roadmap (auditorÃ­a Â· docs)

AuditorÃ­a de los screenshots reales de Olympia (`%AppData%\Helbreath Olympia\SAVE\#0â€“#119` + `SAVE\eks\` + `beta\contents\windows.json`) cruzada contra `mp-client/src`. Resultado: **Â§ Olympia Parity Roadmap (P1â€“P3)** al final de MASTERPLAN Â§ 4 â€” 7 gaps P1 (quest tracker HUD derecha, system log coloreado, chat overhead, minimapa esquina, reloj/dÃ­a-noche, Required Exp, HP bar de target), 12 P2 (chat tabs/whisper, EXP ticker + rested exp, spell announces, daÃ±o encadenado, status effects, muerte Restart!, tooltips ricos, bag plus, party, clima, screenshot key, F5 completo) y 9 P3 (crafting/enchanting/upgrade, Options tabbed, Cash Shop, guild window, sociales, death recap, rebirth/statistics UI, special ability, watermark), cada uno con screenshot de evidencia y archivo destino. Quick wins marcados. **Solo docs â€” sin cambios de UI. Sin commit.**

---

## 2026-07-14 â€” Bugfix jugabilidad + economÃ­a UI + landing Olympia

Batch grande de polish traveler (sin commit). Tokenomics **C1â€“C13** ya locked en docs (2026-07-13) â€” sin cambio de polÃ­tica.

### Mundo / NPCs

- **Church exit:** warps interiorâ†’exterior en `arecath` / `elvcath` arreglados.
- **City guards:** 4 Guard cerca del TP, random-walk **â‰¤3 tiles** del pad (`GameWorlds.json`).
- **Shop NPC** a altura de chimenea; click â†’ **approach cell** (no path encima del NPC) â€” mismo fix para **todos** los NPCs.
- **Aresden TP water:** race de map reload mitigado (si reaparece, seguir auditando).

### Progression / combate / F-keys

- **LU points** al level-up + panel **Level Set** OK + vitals (fÃ³rmulas Olympia).
- **F8:** scroll + detail; **PVP Skills** â€” guards waves **1â†’2â†’2â†’2â†’3**; darkelf + invi pot + PFA (`TimedChallenge.cs` / [`TIMED-CHALLENGES.md`](./TIMED-CHALLENGES.md)).
- **Peace / Attack / Safe**; **RMB standstill attack**; hover jugador estilo Olympia.
- Player list **resync**; ground drops **depth**; barra **EXP within-level**.
- **F6** fonts + botones tipo Achievements (Bag / Item Drops / Auction).
- **SELECTCHAR** ink en lÃ­neas parchment; IconPannel **48/800**; bag icon scale.

### EconomÃ­a in-game (cÃ³digo)

- **Auction board MVP** (gold, 5% fee) â€” ver 2026-07-13.
- **Item Drops:** layout **~60% lista / ~40% detalle**; sell gold = **OlympiaSellPrice**; Crear NFT OK path; Recycle shards = **TBD**.
- **Shop qty wheel** (mouse wheel).

### NFT / EK / landing

- Claim mint: **`parseLeaf` + finalized** + retry (`middleware-node/mint.js`).
- EK screenshot MVP + rareza galerÃ­a (doc) â€” ladder ciudad = **TBD**.
- **Landing** shell **Olympia-identical** usable (`landing/README.md`) â€” Spectate embeds / art swap = **TBD**.

### Opens que siguen TBD

Caps combate stake (#26), delta liq 300M (#38), Meteora earmark (#40), C13 montos (#41), auction on-chain/phishing (C6), guild upgrade, recycle F6 (#42), Spectate (#43).

Artefactos: MASTERPLAN Â§ **1.7** mapa Â· Â§ **3** changelog Â· snapshot Â· Â§ **5** decisiones Â· Â§ **10** opens #42â€“43 Â· esta bitÃ¡cora.

---

## 2026-07-13 â€” EK auto-screenshot + galerÃ­a (MVP)

- **Olympia:** `SAVE\\eks\\{Victim}_{NNN}.jpg` JPEG 800Ã—600; schedule â†’ **~650 ms** â†’ capture; log `Scheduled EK screenshot` / `Taking Enemy Kill screenshot`. 46 archivos locales (~272â€“354 KB); contador por vÃ­ctima (`_000`/`_001`). Sin sidecars.
- **Producto rareza (locked):** Legendary top **1â€“10**, Rare **11â€“50**, Common **51â€“200** killers de la **ciudad opuesta**.
- **MVP cÃ³digo:** proto `EnemyKillAwarded`; server elegibilidad Â±10 + no arena; client canvas JPEG + download + POST stub; middleware `/ek-screenshots`; landing `#ek-gallery`.
- Doc: [`EK-SCREENSHOT-GALLERY.md`](./EK-SCREENSHOT-GALLERY.md). Ladder ciudad / rarity real = **TBD**. **Sin commit.**

---

## 2026-07-13 â€” Auction / trade board MVP (C6 Â· cÃ³digo empezado)

- **Slice #1 started:** timed auction + limit sell, access rules (city / guild / blacklist / full-level+repâ‰¥100), commission **5%** on settle with debt &lt; 3 days â†’ char/IP trade block.
- **Settlement (mock vs real):** bag gold item **90** server-authoritative; on-chain `$HELL` / non-custodial wallet settle **not wired** (C6 preference documented in snapshot `settlement_note`). Item escrow short-lived in `Chars/auction-board.json`.
- **Guild / rep stubs:** `GuildId` + `Reputation` persisted fields; â€œonly own guildâ€ requires non-empty guild id (Fase H). Reputation not combat-fed yet. Citizenship from world / persisted `CitizenshipSide`.
- **UI:** F12 SysMenu â†’ **Auction Board** (traveler :8081 ok). Proto fields 64â€“69 / 83â€“84.
- Artefactos: `AuctionBoard*.cs`, `AuctionBoardDialog.tsx`, MASTERPLAN Â§ 1.7 checklist update. **Sin commit.**

---

## 2026-07-13 â€” Mapa economÃ­a Â§ 1.7 + status guild upgrade (docs polish)

- MASTERPLAN Â§ **1.7**: aÃ±adido **Mapa rÃ¡pido** (supply/alloc Â· C8â€“C13 Â· stake no-yield Â· revenue Â· guild econ Â· prÃ³ximo slice planned). TOC Â§ 1 apunta al mapa. **Sin** implementar auction/shops/guild upgrade.
- **Guild upgrade:** **not built**. Inventario: UI mock (`Guild.store` / `CharacterDialog` labels) + Howard `register_guild_interest` stub; create/join/upgrade/level costs **no** en proto/server C#. Veredicto alineado a [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md) Â§ 3. Olympia-like guild upgrade = **aÃºn por construir** (Fase H / slice #3).
- **PrÃ³ximo slice (planned/TBD):** auction engine â†’ NPC shop catalogs (stables/$HELL) â†’ guild upgrade fee table. Shops gold parciales ya viven (`ShopCatalog` / Tom / Keeper).

---

## 2026-07-13 â€” $HELL cash-out personal / treasury + black-swan (C13 Â· polÃ­tica locked Â· docs)

Lock-in intenciÃ³n PO (docs only; **sin contratos; sin commit; no es consejo legal**). Acoplado a Â§ 1.7 **C8â€“C12** (pump â†’ PumpSwap; Meteora Phase-2; LP almost-never).

- **IntenciÃ³n:** si **Meteora Phase-2 es Ã©xito**, PO **sÃ­** cash-out **limitado** a $$ personales offchain (offramp fiat/banco). Motivo = **seguridad** (reserva fuera de notebook/wallets si hack) â€” no â€œdump on retailâ€.
- **Fuentes preferidas:** creator fees (C11 â†’ entidad), revenue juego (consumibles, ~5% market), ventas vested team bajo caps, salary/ops treasuryâ†’entidad.
- **Prohibido como rutina:** LP pull del seed **PumpSwap** / LP graduaciÃ³n (**C10** almost-never intacto).
- **En Ã©xito Meteora:** realizaciÃ³n **pre-declarada** â€” fees y/o trim capped de **team MM capital** (no LP locked pump).
- **Path:** company treasury â†’ payroll/distribuciÃ³n â†’ offramp (no fee recipient wallet personal).
- **Black swan:** reserva offchain para **re-inyectar** post-bugs/exploit â†’ re-estabilizar ops/liquidez (playbook loss absorption; **no** floor promise a holders).
- **Marketing freeze:** nunca â€œcashing out because moonâ€; interno; pÃºblico solo locked LP vs team MM si hace falta.
- **Open #41:** Â¿cuÃ¡nto $/%? Â¿fees vs trim team MM? Â¿quÃ© cuenta como â€œÃ©xitoâ€ Meteora?
- Artefactos: MASTERPLAN Â§ **1.7** C13 + DecisiÃ³n Â§ 5; canvas `helbreath-dex-liquidity-robinhood-base`; esta bitÃ¡cora.

---

## 2026-07-13 â€” $HELL launch / LP / fees DEX (C8â€“C12 Â· polÃ­tica locked Â· docs)

Lock-in PO (docs only; **sin contratos; sin commit**). Acoplado a Â§ 1.7 + C5/C7.

- **C8 Launch:** ~**20% supply (200M $HELL)** vÃ­a **pump.fun** (awareness + bonding â†’ **PumpSwap**). Bucket docs **liq/market 300M** se conserva â€” **delta:** resto / re-split **TBD**.
- **C9 Partnerships â†’ Phase-2:** earmark del bucket **growth/partnerships ~10%/100M** para LP **opcional** en **Meteora** (o similar) **solo si hace falta**; no gastar ese earmark en otro growth sin notar.
- **C10 LP withdraw:** **casi nunca**. Sin withdraw rutinario. ExcepciÃ³n atÃ­pica: **primeras horas** si precio **explota anormalmente** (risk/ops) â€” divulgar como emergencia, **no** floor/cash-out.
- **C11 Fees:** target **~30% treasury / ~70% LPs** donde el pool sea **configurable** (Phase-2). En **pump/PumpSwap** el schedule es **protocolo** â†’ team fija recipient: **100% creator-share â†’ treasury (entidad)**; LP side = protocolo.
- **C12:** **no** Token-2022 transfer tax; fees = swap/creator + juego ~5% P2P.
- **ConstelaciÃ³n:** **Base** sigue **#1** seat; pump = launch awareness Solana (no seat EVM).
- Artefactos: MASTERPLAN Â§ **1.7** C8â€“C12 + DecisiÃ³n Â§ 5 + opens #38/#40; canvas `helbreath-dex-liquidity-robinhood-base`; esta bitÃ¡cora.

---

## 2026-07-13 â€” $HELL ~20% LP DEX + Robinhood Chain vs Base (research Â· docs)

Dos temas PO (UI sigue en paralelo). **Sin contratos. Sin commit.** *(Path ~20% pump **cerrado** despuÃ©s â†’ C8; este log conserva el research previo.)*

### A Â· ~20% como liquidez inicial DEX

- Docs Â§ 1.7 siguen con bucket **liq/market 300M (30%)**. PO pregunta **~20% (200M)** a DEX â€” **delta documentado**, no overwrite silencioso. â†’ **C8** cierra el path pump; delta 300M sigue open.
- â€œInitial liquidityâ€ Solana: par `$HELL/SOL` o `$HELL/USDC`; path tÃ­pico pump.fun â†’ graduaciÃ³n **PumpSwap** (LP de migraciÃ³n **quemado**); LP **extra** post-grad no auto-lock.
- Opciones: deep pair day-0 Â· leftovers de progressive auction Â· MM budget Â· split labeled. **Separar** de contingencia burn del **team** (C7).
- Riesgos: rug optics si LP unlocked, IL, acusaciones MC/wash, chocar con no-shill / C5 (no DEX floor para stakers).
- **Postura (actualizada C10):** almost-never withdraw; excepciÃ³n primeras horas si explosiÃ³n anormal.

### B Â· Robinhood Chain vs Base (constelaciÃ³n)

- **Robinhood Chain:** nombre oficial; **mainnet pÃºblico 2026-07-01**; L2 EVM **Arbitrum Orbit** (~100ms); foco RWA / Stock Tokens / DeFi (Uniswap day-1). Wallet RH + geo limits. Ã“ptica brokerage+chain = alta. **Gaming:** dÃ©bil (sin grants/player base PvP). â†’ **Watchlist P3**, no seat 2026.
- **Base:** sigue **#1** para season seat (Smart Wallet, grants 1â€“5 ETH, consumer). Shortlist previo intacto: Base â†’ Arbitrum â†’ Ronin.
- ConstelaciÃ³n = travel pass / entitlements; **no** mover NFT inventory como arb libre. Home = Solana.

Artefacto: canvas Cursor `helbreath-dex-liquidity-robinhood-base` (abrir al lado del chat). MASTERPLAN Â§ 1.7 + trayectoria Â§ 1 + opens #38â€“40.

---

## 2026-07-13 â€” $HELL stake / mine / descuentos / mercado (decisiones cerradas Â· docs)

Lock-in PO + craneo (docs only; **sin cÃ³digo**). Una sola historia coherente:

- **$HELL se gana jugando** (play-mine / unlock-by-playing). **Stake no emite tokens.**
- **Stake** = utilidad ya descrita (char / guild / dropÂ·luck â€” caps combate **aÃºn TBD reconcile** vs estudio Â§ 1.6) **+** descuentos fuertes en consumibles elegibles (ej. piedras), **cap mÃ¡x./dÃ­a**, escala por stake.
- Compras con ese descuento = **soulbound** (no flip / no OTC USDT de mats baratos).
- **Mercado espontÃ¡neo permitido, no promovido:** mats soulbound â†’ maxxear gear â†’ vender el **Ã­tem maxxed** (no soulbound) al precio que sea (gold/Ã­tems/NFT/$HELL/USDT) P2P o auction. Team **no** shillea como â€œcash-out del stakeâ€ ni crafting business.
- **Freeze:** yield en tokens; fee-share a stakers; DEX floor del team para sacar stakers; â€œstake = dineroâ€; promover flip USDT de goods descontados.
- **Auction:** preferir non-custodial; engines con poco balance; warn no acumular $$$ en la app; fondos en wallets; allowlist vs phishing = intent/TBD.
- **Fees:** ~50% recycle â†’ torneos/marketing/hire; burn team tokens opcional si fees fuertes â€” **sin** payout a stakers.
- **Historia:** overflow â€œrent/rebatesâ€ Â§ 1.6 **superseded** (sonaba a dividendos). Estudio luck +5% / drop +8% **preservado** + TBD reconcile.
- Artefactos: MASTERPLAN Â§ **1.6** / Â§ **1.7** (C1â€“C7) + DecisiÃ³n append-only + canvases tokenomics/gov callout. **Sin commit.**

---

## 2026-07-13 â€” $HELL utilidad / no-shill / DEX fees / retenciÃ³n (PO Â· tentativo Â· docs)

- **MC no es promesa:** nunca comunicar que la gente se enriquecerÃ¡ especulando con el token.
- **Utility-only:** staking â†’ poder de personaje + guild + roles econÃ³micos / mÃ¡s features para guilds.
- **MC orgÃ¡nico:** compradores pueden ver par USDT/USDC en pump.fun + proyecto serio y comprar sin shill del team â†’ MC circulante **puede** > **$1M**; es comportamiento de mercado, **no** target de marketing.
- **Estudio crÃ­tico (docs):** control/captura de **DEX pair fees** â€” pump.fun bonding (~1.25% total; creator ~0.30%) â†’ graduaciÃ³n a **PumpSwap** (no Raydium por defecto desde ~mar-2025); fees dinÃ¡micos por MC; creator claim via vaults; opciÃ³n **Cashback Coins** (fees a traders, locked at launch) vs Creator Fees; sharing_config multi-recipient.
- **Contingencia:** si fees DEX + consumibles fondean fuerte â†’ **burn de todos los team tokens** (reconciliar vs unlock 3.33%/mes).
- **Legal worry PO (no dictamen):** quedarse con (a) DEX creator fees y (b) **~5%** fee en trades P2P intermediados â€” riesgo personal si wallet fÃ­sica; entity + counsel.
- **Policy sketch:** ~**50%** exchange fees â†’ torneos + marketing + hire mantenimiento; resto ops/owner. Mitiga Ã³ptica; **sigue** siendo revenue imponible; no borra Howey/MiCA si se marketinea mal.
- MASTERPLAN Â§ **1.7** (subsecciÃ³n postura); canvas `helbreath-hell-tokenomics-legal-econ` actualizado. **No es consejo legal. Sin contratos/DEX. Sin commit.**

---

## 2026-07-13 â€” ARPU / embudo consumibles (PO Â· tentativo Â· docs)

- **Por quÃ© no compran en private clÃ¡ssico:** (1) miedo moneygrab / server muere; (2) miedo GM mercenario / black market fuera de mecÃ¡nicas. **On-chain** â†’ esos riesgos se perciben mucho mÃ¡s bajos â†’ mÃ¡s willingness to spend (tesis PO).
- **MUST one-time:** Shoes + Cape (attrs tipo exp +30%, MP/HP +30%) â€” ~**$30**/pieza, ~**$50** el par. Early: **â‰¥50â€“100** buyers; Olympia ref. PO: **â‰¥~500** cuentas con ese spend.
- **Recurrente:** piedras **Xelima** + **Merien** a **+7**, ideal **~$1** c/u; **bulk packs** para volumen.
- Escenarios Low/Mod/Optimista Ã— **$1/dÃ­a** **se conservan**; el embudo es **mecanismo de soporte** (puede justificar/exceder ARPU en spenders), no overwrite silencioso.
- **Puente aÃ±o 1 (ej.):** 50â€“100 Ã— $50 = **$2.5â€“5k**; 500 Ã— $50 = **$25k**; piedras variables (ej. 200Ã—80=$16k â€¦ 500Ã—120=$60k). Blended solo-embudo: Low ~**$49**/user/aÃ±o (~13% de $365); Mod+Olympia-like ~**$57**/user (~16%). Comprador activo ~**$130â€“170**+ antes de packs/whales.
- **Honestidad:** fortalece trust + early monetization + sink; **no prueba** $1/dÃ­a en toda la base (sesgo Olympia, retenciÃ³n post one-time, whales, P2W). MASTERPLAN Â§ **1.7**; canvas `helbreath-hell-tokenomics-legal-econ` actualizado. **Sin cÃ³digo** de shop.

---

## 2026-07-13 â€” Tokenomics $HELL (tentativo Â· docs)

- PO: ticker **$HELL**, supply **1B**, @ $1M MC â†’ **$0.001**.
- Alloc: team 100M (3.33%/mes), liq/market 300M, DAO/guilds 100M (*â€œ3 months at 5%?â€* â€” ambiguo), growth 100M (5%/mes), play-mine **400M**.
- Stake: drop **1â€“20%**, luck **mÃ¡x. 20**, Guildmaster = stake guild + collective. Uso: consumibles / exp items.
- Mining: **500k tokens/dÃ­a** hasta agotar 400M (~**800 dÃ­as** al cap); crÃ©ditos (500 killsâ†’10; leg EKâ†’5+1k tok cap 5k/dÃ­a; top100â†’3+300; eventsâ†’5+100).
- Revenue framing: 4k / 1.5k / 0.4k users Ã— $1/dÃ­a â†’ $1.44M / $0.57M / $0.11M (+ fees).
- **vs Â§ 1.6:** estudio prior luck +5% / drop +8% **preservado** + marcado **TBD reconcile**; PO = fuente tentativa. MASTERPLAN Â§ **1.7**. **Sin cÃ³digo**.
- **Stress-test econ + legal (docs):** canvas Cursor `helbreath-hell-tokenomics-legal-econ` (abrir al lado del chat) â€” Howey/MiCA/CNV alto nivel, diluciÃ³n, P2W, mitigaciones. **No es consejo legal.** Sin contratos.

---

## 2026-07-12 â€” Gov staking â†’ reputaciÃ³n (diseÃ±o Â· docs)

- Intent: stake del **governance token** sube **reputaciÃ³n a nivel wallet**; los **â‰¤4 chars** bound heredan el mismo R.
- R alimenta parÃ¡metros de grind (p.ej. **luck**, **drop rate** general) con **curva suave + topes duros** (anti-whale / anti-P2W combate).
- **Overflow** (stake &gt; cap gameplay, ej. ~25k u â†’ R=100): peso de **gobernanza**, WL/utilidades, **rent / rebates** de fees â€” **no** mÃ¡s drop/luck.
- Prohibido vÃ­a stake: daÃ±o, HP, hit, CC, Elo/torneo equal-footing.
- Unstake: cooldown **7â€“14d** (default 14) + decay lineal de R; wash-stake / sybil mitigados (1 R/wallet, PoH en rewards altos).
- Artefactos: MASTERPLAN **Â§ 1.6** + decisiÃ³n append-only; canvas `helbreath-gov-staking-rep` (abrir al lado del chat); Â§ 7 en multichain strategy canvas. **Sin cÃ³digo** de juego.

### Caps ejemplo (a simular; no hardcodear)

| Bono | Tope en R=100 |
|------|----------------|
| Luck | +5% |
| Drop general | +8% |
| Rare/legendary | +3% rel. o 0 legendary |
| XP (opcional) | +5% |
| Combate / torneo | **0** |

---

## 2026-07-12 â€” F6 Bag UX (tip + gear)

- Tip inline â€œDoble clicâ€¦â€: **una vez** (`hb-bag-beginner-tip-seen`); overlay para no solaparse con tabs.
- DespuÃ©s: tip + prefs detrÃ¡s de **tuerca** (esquina superior derecha); â—‡ translucidez a la izquierda, sin overlap.
- Prefs (localStorage `hb-bag-settings-v1`): sector drops generales, auto-apilar pociones + sector fallback, ancho/alto/escala.
- Routing client en `bagDropRouting.ts` (follow-up `moveItemInBag`); **TODO server** `AllocateBagSlot`.
- Traveler hard-refresh: `?v=bag-gear-20260712`

---

## 2026-07-11 â€” sesiÃ³n + continuaciÃ³n nocturna

### Hub / brand / login

- Marca producto: **Helbreath Chain Lord** (corta: **Chain Lord**); hub kicker + copy alineados.
- Hub **3-body** â†’ columnas **World | Goddesses | Arenas** (full-bleed; desk solo tras portal).
- Wallet **one-click World**: *Bind seal & enter* â†’ Phantom si hace falta â†’ SELECTCHAR (`handleEnterWorldFromHub`).
- SELECTCHAR / Create Character / Arena lobby = **Phaser** (`SelectCharDesk`, `CreateCharDesk`, `ArenaSelectCharDesk`) â€” no wallpaper CSS.
- Viewport desk/login: **FIT** (`loginDeskPresentation` / canvas presentation).
- Create-char: **point-buy** clÃ¡sico (base 10, max 14, budget 70) + preview layered.
- **Traveler vs GM**: `playerMode` en auth/list; saves separados; traveler soft spawn (`:8081`).

### Traveler / open-world

- Mapa `traveler`: **6 slime pits** (~108); spawn/resurrect **seco** inland `(90,80)` (`IsFreeDryCell`).
- Pits Olympia sync: farms/towns spots + RMGâ†’dwell (dungeons/HZ); **huntzone3/4** MAPDATA + RMG level 6. Docs: [`SPAWN-PIT-PARITY.md`](./SPAWN-PIT-PARITY.md).
- Shop/NPC UIs: Shop Keeper, **Gandalf** (magic), **William** warehouse, **Tom** buy+repair, desks **Howard / Kennedy / Gail / Perry**.
- Spells/CC: auditorÃ­a Paralyze/Hold/Chill + fixes combat/utility â†’ [`SPELL-CC-AUDIT.md`](./SPELL-CC-AUDIT.md). Summon sin follow-mode Olympia (abierto).
- Drops: regen loot Olympia + **CritCandy 970**; Slime sin Tower Shield â†’ [`MONSTER-DROP-PARITY.md`](./MONSTER-DROP-PARITY.md).
- Beginner Path 1â†’80: scaffold + tiers 1â€“20 **hard gates**; Câ€“E stubs. Farm Barracks + tips **PFA/DS**. Training Arena **Fase 2** (ApplyPreset + chase). Docs: [`BEGINNER-PATH-1-80.md`](./BEGINNER-PATH-1-80.md), [`TRAINING-ARENA.md`](./TRAINING-ARENA.md).

### Stabilize (torneos / NFT ops)

- Torneos MVP: bracket visual F10, death dialog **killer**, Elo **decay job** periÃ³dico. Sin payout on-chain / anti-cheat full.
- NFT ops: [`NFT-OPS-RUNBOOK.md`](./NFT-OPS-RUNBOOK.md) + `/metrics` + **DB claim lease** (`nft_claim_lease_until`) multi-rÃ©plica. Review `[fable]` pendiente.

### Legal / economÃ­a (docs)

- [`LEGAL-IP-RESEARCH.md`](./LEGAL-IP-RESEARCH.md), [`LEGAL-CHECKLIST.md`](./LEGAL-CHECKLIST.md), prÃ³logo Â§ 0 MASTERPLAN.
- Guild economy visiÃ³n Â§ **1.4**; [`HUMAN-TECH-WAAP.md`](./HUMAN-TECH-WAAP.md) â€” **SKIP WaaP Â· WATCH Passport**.
- [`CRYPTO-LOOT-AND-NFT-SWAPS.md`](./CRYPTO-LOOT-AND-NFT-SWAPS.md) â€” DIY Solana + Jupiter SPL; no integrar AGLD/Lootverse.
- **2026-07-12:** idea capacidad/sybil â†’ [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) (guild-priority ingress; PoH en claim).

---

## 2026-07-12 â€” Timed Challenges Mode 1 (MVP shipped)

- Doc [`TIMED-CHALLENGES.md`](./TIMED-CHALLENGES.md) actualizado: **Mode 1 Skills jugable**.
- Server `TimedChallenge.cs`: 10 chase runners @ player run speed; protocolo Chill+Para+DS (poison melee = Route B); mana free; leaderboard diario UTC (`TimedChallengeLedger.json`); â‰¤2:00 â†’ +50% EXP 2h; #1 dÃ­a â†’ Stone of Integrity (`1112`, 1/wallet/dÃ­a); consume = upgrade stub.
- Client: Training â†’ tab **Challenge** (Shift+F10). Traveler `:8081` hard-refresh.
- **Mode 2** sigue TBD (usuario).

## 2026-07-12 â€” Timed Challenges (diseÃ±o Â· docs)

- Doc [`TIMED-CHALLENGES.md`](./TIMED-CHALLENGES.md): retos contra el reloj (feel Diablo 4 timed).
- **Mode 1 â€” Skills** capturado (luego shipped â€” ver entrada arriba).
- **Mode 2** cortado (â€œy otra que sea unâ€¦â€) â†’ secciÃ³n TBD + preguntas.
- Anti-abuso: farm industrial de stone â†” [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md).

## 2026-07-12 â€” Anti-bot / AFK (docs + MVP toggles)

- FilosofÃ­a aclarada en [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) Â§ 0: AFK + ayuda guild + caza PvP de AFKs + progression adult = **OK**; flota AI / multi-box industrial + sybil Helvet = **NOT OK**.
- ImplicaciÃ³n: no banear â€œparado en town/farmâ€ como regla primaria; apuntar a 1â€“pocos chars humanos vs automatizaciÃ³n de flota.
- **Shipped MVP:** 8 toggles + panel GM `:8080` (SysMenu â†’ Anti-Bot / Ops); persist `AntiBotTools.json`; traveler `:8081` sin panel / set rechazado. Detalle Â§ 0.1 del doc.

### Sigue abierto (breve)

- **Timed Challenges Mode 2** â€” usuario debe completar el diseÃ±o (Mode 1 MVP ya shipped).
- DiseÃ±o Fâ€“H: Unbind market, Spectator embeds, EKs gameplay, guild create/join real (Fase H).
- Counsel / registro marca; payout on-chain; crusade real (Perry = brief).
- Training Arena Fase 3 (instance / Clear / casts); Beginner tiers 21â€“80 live.
- Summon **follow-mode**; Orc-Mage gap HZ3/4; review seguridad claim/torneo `[fable]`.
- Full ingress queue / Passport claim (flags existen; pipelines TBD).

---

*Detalle fechado y checkboxes: [`MASTERPLAN.md`](./MASTERPLAN.md) Â§ 3 (Changelog) + Â§ 4 (Roadmap).*

## 2026-07-17 â€” Parity gap backlog a producciÃ³n

- Creado `docs/OLYMPIA-PARITY-GAP.md`: inventario DONE/PARTIAL/GAP/OURS + olas P0â€“P4.
- **Excluido:** anti-speedhack clÃ¡sico (LAT 590/290) â†’ diseÃ±o propio mÃ¡s adelante.
- **Incluido para prod:** movimiento, magia, oro, mid-spells, loot/spawn, guild mÃ­nimo, EK, crusade, etc.
- Diferenciadores (menÃº Guildmaster, legacy airdrop, torneos NFT) = ola P4, no bloquean paridad.
- Link en MASTERPLAN tabla de docs.

## 2026-07-17 â€” Ola P0 coding started

- Run speed default **260 ms**/tile (walk 520); traveler constraints force 260.
- MagicTower: after Learn, `Spawn.SendInitialState(includeSpells)` pushes unlocks.
- Casting: silent refuse â†’ `SpellCastFailed` when spell not allowed.
- Client: reverse map serverâ†’olympia spell ids on InitialState for book sync.
- Movement wall path (prior): no spiral free-cell; stop without progress.
- Anti-speedhack still DEFER per OLYMPIA-PARITY-GAP Â§0.

## 2026-07-25 â€” Progression CL + Promise Land (diseÃ±o masterplan)

- Documentado en MASTERPLAN **Â§ 1.10** + decisiÃ³n append Â§ 5 + Fase B checklist.
- **Rebirth Chain Lords â†’ L79** (no L1). CÃ³digo actual sigue en L1 hasta implementar.
- **Block Level:** exp nueva â†’ majestic; un-block â†’ exp a levels otra vez.
- Caps: PL outdoor **â‰¤110**; PL Dungeons **â‰¤120** (ex farm dungeon).
- Spawns PL + PL Dungeons (Rudolph, MG, cyclops/orcs/SG/ogres, mining 6 crystal + 20 coal) â€” **diseÃ±o**, no dwell reescrito aÃºn.
- Meta producto: desparramar PvP y uso de mapas mid.


