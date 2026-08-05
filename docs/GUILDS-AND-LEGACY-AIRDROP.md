# Guilds + Legacy Airdrop — poder de Guild Masters e historia HB

> Diseño (español). **Solo documentación** — no implementar gameplay de guilds ni airdrop on-chain aún.  
> Decisión de producto: 2026-07-10 (ver [`MASTERPLAN.md`](./MASTERPLAN.md) § Decisiones + Fase H).  
> Conceptos del usuario + stubs previos en repo; cantidades/rewards **sin hardcodear**.

**Estado:** Diseño.

---

## 1. Objetivo

1. Dar **más poder y relevancia a los Guild Masters (GMs de guild)** — y, en menor medida, a capitanes — porque sostienen lazos sociales del Helbreath desde ~2000.
2. Diseñar un **programa de reconocimiento / airdrop** a guilds históricas de servidores relevantes (HB Arg, Alkon, LMDL, Olympia, Cursed, INT, Korea, …).
3. Si vuelven, deben **demostrar** (Discord + evidencia + vouching + wallet) que son los verdaderos integrantes.
4. Si se verifica: **mimos / welcome rewards** simbólicos y útiles, sin romper economía ni abrir farm de claims.

---

## 2. Por qué importan los Guild Masters

| Motivo | Detalle |
|--------|---------|
| **Retención** | El GM es el nodo social: convoca raids, wars, farm parties, recluta newbies. Sin líderes activos, el server se vacía aunque el combate sea bueno. |
| **Comunidad** | Lazos multi-década (nicks, rivalidades, alianzas) son el moat emocional vs “otro MMO más”. |
| **Historia HB** | Guilds legendarias de Arg / Alkon / LMDL / Olympia / etc. son memoria colectiva; reconocerlas es marketing + respeto, no solo loot. |
| **Moderación orgánica** | Un GM con herramientas (tax, statuses, voz en global, kick/ban de guild) reduce carga de staff y da identidad de “equipo”. |
| **Go-to-market** | Atraer un GM histórico trae su roster; atraer un jugador suelto no. |
| **Economía de largo plazo** | Fee share (consumibles), bonus de egreso, partner program — ver § 4.3 y [`MASTERPLAN.md`](./MASTERPLAN.md) § 1.4 |

**Norte de producto:** el Guild Master no es un título cosmético — es un rol con **comandos / privilegios** visibles y útiles.

---

## 3. Qué existe hoy en el repo (inventario)

**No** había un `docs/GUILDS-*.md` previo. El concepto vivía en stubs UI + un canvas de diseño (chat) + mapas/items clásicos.

| Pieza | Path | Estado |
|-------|------|--------|
| Panel GM (tax / statuses / warehouse) | `sp-client/src/ui/dialogs/GuildDialog.tsx` | Stub UI; POST a `http://localhost:3001/guild/tax` (**endpoint no existe** en middleware) |
| Store guild (tax, `isGuildMaster`, `activeTrainer` / `activeKiller`) | `sp-client/src/ui/store/Guild.store.ts`, `multiplayer/mp-client/src/ui/store/Guild.store.ts` | Mock local (`guildName: 'Legion'`, etc.) |
| Menú guild clásico (Create / Disband / Join / Member List / Declare War / Contribution) | `mp-client` / `sp-client` `CharacterDialog` → `GuildPanel` | Solo labels; sin red |
| Sprite / frame guild dialog | `mp-client/src/constants/SpriteKeys.ts` (`GUILD_DIALOG_BG`) | Asset key |
| Mapas Guild Hall | `GameWorlds.json` `aregldhall` / `elvgldhall` → map `gldhall_1`; assets `map-gldhall_1` | Mundo/mapa presentes; sin lógica de guild |
| Items ticket | `Items.json` Guild Admission / Secession Ticket | Catálogo |
| Referencia C++ | `reference/Client.cpp` (Guild Menu / Op / Hall, create/disband, rank 0 = GM) | Legacy HB; **no** portado a proto/server C# |
| Chat global solo GM/capitán | Canvas `helbreath-diseno-economia.canvas.tsx` (2026-07-08) | Diseño; no en `docs/` hasta este satélite |
| MASTERPLAN | Menciona Discord = notifs a **guildmates** (Spectator) | Sin fase de guilds hasta Fase H |
| Proto / server C# / schema | Sin mensajes ni tablas `guild*` | **Sin implementación de gameplay** |

### 3.1 “Comando especial” recuperado (anotaciones previas)

No hay un slash-command documentado tipo `/gm …` en docs. Lo más cercano a **poder especial de Guild Master** en el repo:

1. **Statuses de guild (panel F5 / GuildDialog)** — solo el GM configura:
   - **ACTIVE TRAINER** — +% EXP / +% Drop a cambio de tax (stub: +10% / +10%).
   - **ACTIVE KILLER** — +% Daño / +% Absorción a cambio del primer EK del día (stub: +5% / +5%).
2. **Tax y contribuciones** — % oro, % party gold, % quest rewards; flags “primer EK del día / primer Majestic semanal / contribución semanal → guild”.
3. **Voz privilegiada en chat global** — solo guildmasters y **capitanes** hablan en global (rate limit configurable); resto: mapa/local, guild, whisper (canvas 2026-07-08).

Los % del stub son **placeholders de UI**, no números de producto locked. En implementación futura: config JSON, no literales mágicos en combate.

---

## 4. Poderes / comandos de Guild Master

### 4.1 MVP propuesto `[fable]` diseño → `[cheap]` stubs

| Privilegio | Quién | Notas |
|------------|-------|-------|
| Crear / disband guild | GM (rank 0) | Alinear a flujo HB + tickets Admission/Secession |
| Invite / kick / promote capitán | GM | Capitanes = sub-roles para chat global + ayuda ops |
| Configurar tax + contribución | Solo GM | Visible a miembros (menú F5 / Character → Guild) |
| Activar **ACTIVE TRAINER** / **ACTIVE KILLER** | Solo GM | Un status activo a la vez o cooldowns — TBD; costos = tax/EK, no free power |
| Hablar en **chat global** | GM + capitanes | Rate limit por hora en config |
| Declarar guild war (UI) | Solo GM | MVP puede ser flag social + UI; PvP rules después |
| Guild warehouse (lectura) | Miembros; deposit rules TBD | Stub ya existe en GuildDialog tab |
| Rename display / motto corto | Solo GM | Cosmético; rename de hall legacy = reward de airdrop (§ 6) |

### 4.2 Wishlist (post-MVP)

- Comando de reunión / ping a online members (Discord webhook opcional + in-game).
- Marca en minimapa de “rally point” puesto por el GM.
- Alianza / NAP flags visibles.
- Cuota de guild bank con permisos por rango.
- Emblema / cape tint de guild (cosmético; overlap con mimos legacy).
- Integración torneo: team registration bajo banner de guild (sin mezclar Elo individual).
- Slash o chat-command canónico, p.ej. `/gstatus trainer|killer|off` — **nombre exacto TBD**; el “comando especial” histórico del concepto = **statuses ACTIVE\*** + privilegio de voz.

### 4.3 Economía de guild (visión — tejer después)

Detalle canónico en [`MASTERPLAN.md`](./MASTERPLAN.md) **§ 1.4**. Resumen:

| Palanca | Intent |
|---------|--------|
| **GM fee share** | % de fees generados por **su** guild → **consumibles** (potions, repair kits, scrolls), **no cash** |
| **Bonus de egreso** | Extra al GM/guild cuando un miembro **maxed** “egresa” / se gradúa — incentiva entrenar y soltar, no solo hoardear |
| **Partner de largo plazo** | Guilds estables = socios minoritarios del negocio ($$$$ dividends) — **programa/rewards TBD con counsel**; no vender como inversión/security |

**Meta:** server con **1000+ online** + dividends a guilds grandes > incentivo a armar “fruta” / private shady. Cautela legal: MASTERPLAN § 0.5.

### 4.4 Qué no es (límites)

- No es Game Master de servidor (admin). El GM de guild **no** banea cuentas del server.
- No bypass de anti-cheat, torneo loadout, ni mint NFT.
- Statuses no deben stackearse con exploits de party/alt (§ 7).

---

## 5. Flujo de verificación legacy (identidad de guild histórica)

Objetivo: si una guild de HB Arg / Alkon / … quiere “volver”, demostrar con evidencia social + on-chain link que son **ellos**, no impostores.

```
Claim abierto (Discord + form)
        ↓
Evidencia (roster / screenshots / roles / vouch)
        ↓
Review humano + anti-sybil
        ↓
Link wallet(s) SIWS
        ↓
Estado: verified_legacy → elegible a mimos
```

### 5.1 Canales de evidencia (combinables)

| Mecanismo | Cómo | Fuerza | Tag |
|-----------|------|--------|-----|
| **Discord role / server histórico** | Rol en Discord de la guild o del server legacy; export de members con fecha | Media–alta si el Discord es antiguo y moderado | `[cheap]` checklist |
| **Screenshots / clips** | Char select, guild menu, wars, rankings con fecha visible | Media (forgeable) — útil como apoyo | `[cheap]` |
| **Roster claim** | Lista de nicks + rangos (GM / capitán / member) firmada por el claimant GM | Baja sola; alta con vouch cruzado | `[fable]` modelo |
| **Vouching** | N≥K miembros verificados se vouching mutuamente; o vouch de GMs de guilds rivales conocidas | Alta si K y diversidad son buenos | `[fable]` |
| **Wallet link** | SIWS (mismo flujo que login) amarra Discord user ↔ wallet ↔ char | Obligatoria para claim on-chain / créditos | `[cheap]` reutilizar auth |
| **Prueba social pública** | Thread en Discord oficial del juego: “somos X de Alkon”; período de objeción | Media — la comunidad detecta impostores | `[human]` |
| **Archivos externos** | Rankings web, foros, Wayback, videos YouTube de wars | Media–alta según fuente | `[human]` research |

### 5.2 Roles en el claim

| Rol | Responsabilidad |
|-----|-----------------|
| **Claimant GM** | Abre el claim de la guild legacy; propone roster inicial |
| **Claimant members** | Se unen al claim con evidencia propia + link wallet |
| **Reviewer (staff)** | Aprueba / rechaza / pide más prueba; resuelve disputas |
| **Objector** | Cualquier jugador puede objetar en ventana pública con evidencia |

### 5.3 Anti-sybil / anti-farm de claims

- Un wallet / Discord no puede ser **GM verificado** de N guilds legacy a la vez (N=1 salvo excepción staff).
- Cooldown largo entre claims rechazados.
- Cap de members recompensados por guild (lista cerrada post-aprobación; altas posteriores = proceso normal, no airdrop).
- Peso mayor a evidencia **pre-anuncio** del programa (Discord join dates, posts viejos).
- Disputas: si dos grupos claman la misma guild, **ninguno** recibe mimos hasta resolución; o se parte en “rama A / rama B” cosmético sin rewards económicos — TBD `[fable]`.

### 5.4 Estados sugeridos (datos futuros)

`draft` → `submitted` → `in_review` → `objection_window` → `verified` | `rejected` | `disputed`

Sin schema aún; cuando se implemente: tablas en Postgres + cola admin en middleware — **no** hardcodear montos de reward en filas.

---

## 6. Servidores / comunidades target (lista abierta)

Lista **no exhaustiva** — se puede ampliar con research comunitario:

| Comunidad / server | Notas |
|--------------------|-------|
| **HB Arg** | Comunidad argentina histórica |
| **Alkon** | Server muy citado en la escena LATAM |
| **LMDL** | Legacy relevante |
| **Olympia** (server histórico) | Referencia de balance/contenido de este repo; no es la marca del producto (**Helbreath Chain Lord**) |
| **Cursed** | Server histórico |
| **INT** | Escena internacional |
| **Korea** | Origen / escena KR del IP |
| *(open)* | Otros: privados longevos, foros, Discords con roster documentado |

Cada entrada futura debería tener: nombre canónico, región, años activos (aprox), fuentes de evidencia tipicas, y un **slug** estable para HoF (`legacy_server_slug`).

---

## 7. Airdrop / mimos (welcome rewards)

Reconocimiento a su rol en la historia — **no** un free-win económico. Ideas (cantidades / supply en config; **no hardcodear**):

| Mimo | Tipo | Notas |
|------|------|-------|
| **Title** | Cosmético | p.ej. “Legacy — \<Guild\> (\<Server\>)” |
| **Cape tint / emblem** | Cosmético | Tint o overlay de guild verificada |
| **Hall of Fame entry** | Social / landing | Página o sección in-game: guild + server + años + roster verificado |
| **Starter credits** | Soft currency / Build Draft credits | Monto en config; no P2W hard |
| **NFT commemorative** | cNFT / collection separada | “Legacy Guild” — no confundir con drops Rare/Legendary de loot |
| **Guild hall rename** | Cosmético / world flavor | Nombre display en `aregldhall`/`elvgldhall` o instancia futura — cuidado con unique names |
| **Priority guild name reservation** | Ops | Reservar el nombre histórico al GM verificado por ventana T |
| **Discord role** | Social | Rol “Legacy \<Guild\>” en Discord oficial |

**Principio:** preferir cosmético + prestigio + soft onboarding; evitar items de combate endgame en el airdrop legacy.

---

## 8. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| **Impostores** | Ventana de objeción pública + vouch cruzado + evidencia pre-anuncio |
| **Drama / doxxing** | Proceso staff escrito; no exigir datos personales reales; solo nicks/Discord/wallet |
| **Farm de claims** | Cap por guild, 1 GM legacy por wallet, cooldown, sin rewards de combate |
| **Sybil Discord** | Cuentas nuevas con poca historia pesan poco; pedir link a Discord antiguo |
| **Nombre squatting** | Reserva solo post-`verified`; disputa = hold |
| **Expectativa P2W** | Comunicar “reconocimiento”, no “pay-to-win pack” |
| **Solapamiento con Hero Set / torneos** | Mimos legacy no alteran loadout equal-footing ni Elo |
| **Venta de slots / Sybil guilds** (si hay prioridad de ingreso) | Caps de vouch, antigüedad+actividad, appeals — ver [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) |

---

## 8.1 Capacidad / anti-bot (puntero)

Idea aparte (2026-07-12): cerca de capacidad, miembros de **guildes probadas** podrían tener prioridad de login; cuentas nuevas → segmento distinto. PoH en **claim** de airdrop (Helvet), no en login. Detalle y menú de opciones: [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md). **No shipped.**

---

## 9. Open questions

1. ¿ACTIVE TRAINER y ACTIVE KILLER son mutuamente excluyentes? ¿Cooldown al cambiar? `[fable]`
2. ¿Los % de status viven en `GuildStatusConfig.json` desde el día 1? `[fable]` / `[cheap]` stub
3. ¿Capitanes: cuántos por guild? ¿Los nombra solo el GM? `[fable]`
4. ¿Chat global: hard-require guild rank, o también “herald” staff? `[fable]`
5. ¿Legacy airdrop es one-shot al launch o ventanas periódicas? `[fable]`
6. ¿NFT commemorative es Bubblegum cNFT (como drops) o NFT “normal” 1/1 por guild? `[fable]`
7. ¿Qué pasa si el GM histórico no vuelve pero 10 members sí? ¿Claim sin GM con vouch mayor? `[fable]`
8. ¿Guild war MVP es solo UI/flag o ya afecta PvP/EK? (recomendación: **no** mezclar con Fase G EKs al inicio) `[fable]`
9. ¿Legal/ToS del airdrop (jurisdicciones, no security offering)? `[human]`
10. ¿Prioridad vs Fase C payout / Fase A hardening — cuándo abrir stubs de guild en código? `[fable]` (sugerencia: diseño ahora; código tras chat roles + schema mínimo)
11. Economía guild (§ 4.3 / MASTERPLAN § 1.4): ¿qué fees, % share, definición de egreso, criterios partner? `[fable]` + counsel en partner `[human]`

---

## 10. Relación con el roadmap

| Fase / doc | Relación |
|------------|----------|
| **Fase H** (este doc) | Diseño guilds + legacy verification + mimos |
| **MASTERPLAN § 1.4** | Visión economía guild (fee share / egreso / partner) |
| [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) | Prioridad de ingreso por guild + segmento new/unknown (idea) |
| Fase E Spectator | Discord = social / notifs guildmates (ya decidido) |
| Fase G EKs | ACTIVE KILLER consume “primer EK del día” — coordinar reglas anti-farm |
| Canvas economía 2026-07-08 | Chat global GM/capitán — incorporar a implementación de chat |
| Unbind / marketplace | Filtros por guild en listings (wishlist marketplace) — no bloqueante; fees de unbind pueden alimentar share GM (§ 4.3) |

**Prerrequisito sugerido para código:** schema `guilds` / `guild_members` + roles en Postgres antes de statuses que afecten combate; chat privilege puede ir antes (solo gate de canal).

---

## 11. Tags de trabajo

| Trabajo | Tag |
|---------|-----|
| Cerrar open questions de poderes GM + anti-sybil legacy | `[fable]` |
| Inventario / ampliar lista de servers + fuentes | `[cheap]` / `[human]` |
| Stub UI ya existente: no expandir hasta spec de schema | — |
| Schema + proto guild messages | `[fable]` luego `[cheap]` |
| Flujo Discord claim + admin review queue | `[fable]` + `[cheap]` |
| Config JSON statuses/tax (sin números finales locked) | `[cheap]` |
| Legal airdrop / comunicación pública | `[human]` |
| Spec economía guild (fees → consumibles, egreso, partner) | `[fable]` / `[human]` counsel |

---

*Fin del diseño inicial. Ampliar con feedback de GMs históricos y review Fable 5 (cola MASTERPLAN § 10).*
