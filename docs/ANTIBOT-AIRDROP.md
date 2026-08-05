# Anti-bot / capacidad — PoH en claim + prioridad por guild

> Diseño + **MVP de toggles shipped** (2026-07-12).  
> Contexto: usuarios Solana farming un posible airdrop de token **Helvet**; presión sybil/bots; capacidad ~3–4k online.  
> Relacionado: [`HUMAN-TECH-WAAP.md`](./HUMAN-TECH-WAAP.md) (Passport = WATCH), [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md), MASTERPLAN § 1.4 / 1.5 / Fase H.

**Estado:** Diseño + **código MVP** — flags runtime + panel GM (`:8080`). Ingress/claim reales siguen stub.

---

## 0. Filosofía AFK / anti-bot (aclaración 2026-07-12)

> Postura de producto del usuario. **No es ToS shipped** ni lista de bans automáticos — guía qué incentivar vs qué atacar.

### OK / incentivos deseados

| Comportamiento | Por qué está bien |
|----------------|-------------------|
| **AFK en el mapa** (town / farm) | Parte del ritmo MMO clásico; no es el enemigo |
| **Guild ayuda a miembros AFK** | Incentivo social (cuidar al compañero) |
| **Ciudad enemiga caza AFKs** | Incentivo PvP sano — “andan a matar a los AFK” |
| **Adultos que vuelven a un char algo progresado** | Offline/AFK liviano u overnight grind **por una persona real** — OK |
| **Niveles altos → más consumibles → economía se mueve** | Deseable; no castigar progression humana |

### NOT OK

| Amenaza | Por qué |
|---------|---------|
| **Empresas / AI training docenas–cientos de chars a la vez** (ej. ~200 jugadores AI) | Farm industrial multi-box — flota, no “un humano AFK” |
| **Leveling masivo automatizado para sybil de airdrop Helvet** | Ataca el token y la legitimidad del claim |

**Norte:** el enemigo es la **flota automatizada / sybil industrial**, no el AFK social ni el trabajador que deja el char un rato.

### Implicaciones de diseño (opciones — no shipped)

- Distinguir **1–pocos chars / ritmo humano** vs **automatización de flota** (límites de sesión, clustering device/wallet, techos de action rate, sybil en claim-time, guild-priority ingress ya en § 2–4).
- **No** banear “AFK parado en town/farm” como regla primaria.
- Más adelante (opcional): soft progression oficial para workers vs detectar agentes AI idénticos en paralelo — menú abierto; no elegir implementación aún.

---

## 0.1 MVP shipped — toggles GM (2026-07-12)

Herramientas **ON/OFF** persistidas en `multiplayer/server/Config/AntiBotTools.json`, mutables en runtime vía proto (`GetAntiBotTools*` / `SetAntiBotTools*`). Solo sesiones **GM** (`player_mode=gm`, cliente `:8080`) pueden setear; traveler (`:8081`) no ve el panel y el server rechaza set.

| Toggle (UI) | Default | Hoy en código |
|-------------|---------|---------------|
| **Guild-priority ingress** | OFF | Stub: log “would enforce” cerca de `nearCapacityOnline` |
| **New-player segment** | OFF | Stub: log queue/overflow/delayed claim |
| **Claim-time sybil gate** | OFF | Stub: flag + `AntiBotTools.IsClaimTimeSybilGateEnabled` para middleware; sin Passport |
| **Industrial multi-box limits** | OFF | **Enforce:** rechaza auth nueva si online ≥ `maxConcurrentSessions`; log rate/clustering |
| **AFK-on-map allowed** | **ON** | **Enforce:** si OFF → warn chat + kick tras idle (`afkWarnAfterMs` / `afkKickAfterMs`) |
| **Tournament inhuman-play telemetry** | OFF | **Enforce (log):** anomalías cast/move en arenas torneo |
| **Tournament high-stakes mode** | OFF | Stub: log “would require stream/identity” al entrar arena |
| **Soft offline progression** | OFF | **Mínimo:** drip XP periódico a jugadores idle cuando ON |

**UI:** SysMenu (F12) → **Anti-Bot / Ops** (solo GM). Traveler no monta el diálogo.

---

## 1. Principio: PoH en claim, no en login

Consejo previo (Passport / sybil) ya alineado en research:

| Momento | Qué hacer | Por qué |
|---------|-----------|---------|
| **Login / entrar al mundo** | Mantener fricción baja (SIWS + wallet Solana). **No** exigir Human Passport ni KYC-lite para jugar. | LATAM casual + players HB; PoH en la puerta mata onboarding. |
| **Claim de airdrop / reward on-chain** | Ahí sí evaluar PoH / score / vouch / allowlist (DIY o Passport WATCH). | El bot farm apunta al **token**, no al login. Coste sybil solo cuando hay payout. |

**Regla de producto:** auth ≠ sybil resistance. Ver [`HUMAN-TECH-WAAP.md`](./HUMAN-TECH-WAAP.md) § 5 — umbral Passport (si algún día) solo en claim, **no** para entrar al mundo.

---

## 2. Idea del usuario — prioridad de ingreso por guild “probada”

Cuando el server está cerca de capacidad (ej. **3–4k online**), jugadores que ya pertenecen a una **guild activa y legítima** (roster conocido, no farm fresco) obtienen **prioridad de entrada** al shard principal.

Cuentas **ultra-nuevas / desconocidas** van a un **segmento distinto** (ver § 4) — no necesariamente “baneadas”, sino degradadas en acceso o elegibilidad hasta que demuestren humanidad social o actividad.

**Intuición:** el moat anti-sybil más barato en un MMO clásico es la **red social ya verificada** (guildes serias), no un captcha en el splash.

---

## 3. Criterios de “guild probada” (TBD — no locked)

Ninguno es requisito fijo aún; combinar señales y subir el listón con el tiempo:

| Señal | Notas |
|-------|--------|
| **Antigüedad de guild** | Edad del registro in-game y/o legacy verificado (Fase H) |
| **Actividad agregada** | Logins recientes, kills/EKs, taxes pagadas, tiempo online de miembros |
| **Vouch de GM** | El Guild Master (o capitán) “sponsorea” al miembro para prioridad — con rate limit / responsabilidad |
| **Legacy guild verification** | Roster histórico verificado (Discord + evidencia + wallet) — [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md) |
| **Staff / partner tier** | Guilds en partner program (§ 1.4 MASTERPLAN) o allowlist ops |

**Open:** umbral numérico (días, % online semanal, min members activos); si traveler-only cuenta; si alts en la misma guild heredan prioridad.

---

## 4. Segmento para cuentas nuevas / desconocidas (opciones — no comprometerse a una)

Listar menú de diseño; se puede **combinar** capas:

| Opción | Efecto | Pros | Contras |
|--------|--------|------|---------|
| **Cola (queue)** | Esperan slot en el mundo principal | Simple de comunicar | UX frustrante; bots también esperan |
| **Overflow shard / world** | Mundo paralelo o capacidad extra “cold” | Protege PvP/economía del main | Split comunidad; costo ops |
| **Traveler limitado** | Solo modo traveler soft (ya existe split traveler/GM) hasta vouch | Reusa infra; bajo riesgo loot | Newbies honestos tardan en “graduarse” |
| **Claim delayed / capped** | Juegan normal pero elegibilidad Helvet/NFT claim retrasada o con cap hasta score/vouch | Alinea con “PoH en claim” | No alivia presión de **slots** online |
| **Rewards reducidos** hasta vouch | EXP/drop/soft rewards menores en ventana T | Desincentiva farm bot | Castiga newbies reales; economía dual |
| **Invite-only soft** | Necesitan invite de miembro de guild probada para main | Fuerte anti-sybil social | Barrera de entrada alta; mercado negro de invites |

**Norte sugerido (borrador):** separar **capacidad (slots)** de **elegibilidad de airdrop**. Queue/overflow/traveler atacan slots; delayed claim / Passport atacan Helvet farming — no mezclar en un solo switch sin pensar UX.

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación (ideas) |
|--------|---------------------|
| **Guilds venden slots / invites** | Cap de vouchs por GM/semana; cooldown; audit de joins masivos; revocar prioridad si patrón de venta |
| **Sybil guilds** (roster bot fresco) | Requiere antigüedad + actividad agregada + review; legacy ≠ guild creada ayer; tax/EK mínimos |
| **Exclusión de newbies honestos** | Path claro: traveler → actividad → join guild o vouch staff; comunicar “prioridad, no veto permanente”; cola con ETA |
| **GMs abusivos / kick político** | Appeals staff; prioridad atada a wallet+char history, no solo membresía del día |
| **Falso sentido de seguridad** | Guild priority ≠ anti-cheat PvP; bots humanos en guildes grandes siguen existiendo — complementar con rate limits y claim PoH |
| **Expectativa “Helvet free win”** | Comunicar farming ≠ claim garantizado; PoH / caps en claim |

---

## 6. Relación con roadmap

| Doc / fase | Relación |
|------------|----------|
| **Este doc** | Idea capacidad + sybil social + filosofía AFK (§ 0) + **MVP toggles** (§ 0.1) |
| MASTERPLAN § **1.5** | Auth vs sybil; Passport en claim; postura AFK vs flota |
| MASTERPLAN § **1.4** / Fase **H** | Guildes “establecidas” ya son activo económico — prioridad de ingress es extensión natural |
| [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md) | Vouch / legacy verification = señales reutilizables |
| Traveler vs GM (login) | Posible vehículo del segmento “nuevo” sin inventar un tercer modo aún |

---

## 7. Open questions

1. ¿Umbral de capacidad (hard cap vs soft “near full”)? ¿Por mundo o global?
2. ¿Prioridad es skip-queue, reserved slots %, o reconnect favor?
3. ¿Criterio mínimo de “guild probada” al launch vs a 3 meses?
4. ¿Traveler limitado es default para unknown, o solo cuando hay pressure?
5. ¿Claim Helvet y prioridad de login son políticas **independientes**? (recomendación: sí)
6. ¿Passport / DIY solo en claim Helvet, o también en overflow graduation?
7. ¿Señales concretas “humano 1–pocos chars” vs “flota AI” (rate, clustering, session) sin castigar AFK social?
8. ¿Soft progression oficial para workers (opcional futuro) o solo detección de paralelismo?

---

## 8. Tags

| Trabajo | Tag |
|---------|-----|
| Cerrar menú § 4 (qué segmento al MVP de capacidad) | `[fable]` |
| Definir señales § 3 + anti-venta de slots | `[fable]` |
| Señales flota vs AFK humano (§ 0) sin ban de “parado en town” | `[fable]` |
| Spike Passport solo si claim Helvet es real | `[cheap]` / WATCH |
| Código queue / overflow / traveler gate | **Parcial** — toggles + stubs; full gate TBD |
| MVP toggles + panel GM | **Shipped** (2026-07-12) |

---

*Fin. Idea de producto + MVP de flags/ops. Ampliar enforcement real tras feedback de GMs y review Fable (cola MASTERPLAN § 10).*
