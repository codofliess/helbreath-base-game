# X + Discord guild roles + airdrop access

> Producto / ops · 2026-07-24.  
> Complementa: [`OPS-DESK.md`](./OPS-DESK.md) · [`DISCORD-SETUP.md`](./DISCORD-SETUP.md) · [`GUILDS-AND-LEGACY-AIRDROP.md`](../GUILDS-AND-LEGACY-AIRDROP.md) · MASTERPLAN § 1.4 / 1.6–1.7 · [`FREEZE-COPY.md`](./FREEZE-COPY.md).

**Estado:** diseño + checklist. **No** hay contrato de stake ni bot de roles live todavía.

---

## 1. Por qué este orden (evitar colapso)

| Fase | Qué pedimos | Por qué |
|------|-------------|---------|
| **A — X first** | Seguir la cuenta oficial de X como **condición blanda de airdrop** (claim-time) | X escala marketing y funnel; un solo “follow” es barato de verificar vía API/proofs y no satura Discord |
| **B — Discord second** | Entrar al Discord **después** (o en paralelo suave), roles de guild **cuando hay identidad de guild** | Si pedimos Discord masivo antes de tener roles/salas/guild stack, el server se llena de ghost accounts sin estructura |
| **C — Guild rooms** | Salas privadas solo si la guild cumple **umbral de $HELL staked** (config) | Alinea a MASTERPLAN: stake = utilidad/guild features, **no** yield; evita 200 canales vacíos |

**Norte:** airdrop/claim es el momento de fricción social (igual que PoH en claim — ver [`ANTIBOT-AIRDROP.md`](../ANTIBOT-AIRDROP.md)). **Jugar no debe exigir X ni Discord.**

---

## 2. Cuenta de X (crear ya)

### 2.1 Setup manual (humano — ~30 min)

1. Ir a [x.com/i/flow/signup](https://x.com/i/flow/signup) con mail del proyecto (`chainlords.net@gmail.com` / `ops@chainlords.net`).
2. Handle preferido (probar en orden):
   - `@ChainLordsHB` / `@ChainLordsGame` / `@HelbreathCL` / `@PlayChainLords`
3. Display name: **Chain Lords**
4. Bio (freeze-safe, EN/ES corto):

```
Helbreath Chain Lords — classic open PvP/PvM · Solana-native $HELL utility
Play: play.chainlords.net · Site: chainlords.net
Discord: discord.gg/F4NwwbfKtj
Utility / play-mine · not investment advice
```

5. Avatar: `branding/abaddon-icon/discord-server-icon.png` (o abaddon 400×400).
6. Header: wallpaper / SiteBg / art de marca.
7. Pin: anuncio **Testing Week 1 + créditos → TGE** (mismo texto que landing `#news`).
8. 2FA ON + app password guardado en vault del team.
9. Anotar handle final en:
   - Landing `#links` / footer
   - Discord `#links`
   - `social-bot/.env` → `OFFICIAL_X_URL=https://x.com/<handle>`
   - Este doc § 7

### 2.2 Qué **no** hacer en X

- No prometer ROI, “guaranteed airdrop $”, floor de DEX, ni “stake = money” (C5 / FREEZE-COPY).
- No DMs automáticos pidiendo seed / “verify wallet” (scam vector).
- Auto-post/API write = **fase 2** (API X de pago); day-1 = **manual + drafts en `#ops-content`**.

### 2.3 Cadencia mínima (primera semana)

| Día | Post |
|-----|------|
| 0 | “Server open for testing · credits → TGE · play.chainlords.net” + pin |
| 1–2 | Short clip / screenshot EK o world |
| 3 | “Follow for airdrop eligibility (utility rewards) · Discord for guilds” |
| 5–7 | Patch / credit reminder · link Discord #announcements |

---

## 3. Airdrop eligibility — condiciones en capas

### 3.1 Principio

- **Play-mine credits** (testing week) → score de actividad on-server (ledger `hell-mining.json`).
- **Social gates** en **claim** (no en login):
  1. **Follow oficial X** (obligatorio fase claim v1).
  2. **Miembro Discord** (fase claim v1.1 o v2 — no bloquear claim early si Discord aún no tiene roles).
  3. Opcional después: rol de guild verificado, PoH, wallet allowlist, legacy vouch.

### 3.2 Cómo verificar “nos sigue en X” (opciones)

| Opción | Pros | Contras | Cuándo |
|--------|------|---------|--------|
| **A. OAuth “Sign in with X”** + check friendship/follow | Robusto | App X Developer + scopes | Preferido mid-term |
| **B. Manual staff allowlist** (screenshot / list) | Cero API | No escala | Solo friends & family |
| **C. Middleware claim form** “handle + proof tweet” | Barato | Sybil fácil | MVP interino |
| **D. Third-party (Galxe / Zealy / custom)** | UX conocida | Costo + dependencia | Solo si counsel OK |

**MVP recomendado testing → TGE:**  
ledger de créditos **ya** es la señal de juego; **follow X** = checkbox + OAuth cuando haya app, o proof tweet con handle linkeado a wallet en claim UI.

### 3.3 Copy legal-safe (claim UI / mail)

```
To claim testing-week / TGE utility rewards you must:
1) Have earned mining credits on the live server (wallet activity).
2) Follow our official X account (utility program eligibility — not investment advice).
Discord membership and guild roles unlock community rooms and may improve eligibility tiers later.
```

**Prohibido en copy:** “guaranteed tokens”, “profit”, “ROI”, “airdrop money”.

---

## 4. Discord — roles por rango de guild + nombre de guild

### 4.1 Jerarquía de roles (display order de arriba a abajo)

| Rol base | Quién | Color sugerido | Hoist |
|----------|--------|----------------|-------|
| Staff / Mod | Team | rojo/violeta | sí |
| **Guild Master** | rank master in-game | dorado | sí |
| **Guild Captain** | rank captain | naranja | sí |
| **Guild Veteran** | rank veteran (o antigüedad/rep umbral) | plateado | sí |
| **Guildsman** | miembro de guild | gris-azul | no |
| Tester | early tester | verde | no |
| Traveler | sin guild | default | no |

### 4.2 Rol “de qué guild es”

Patrón **dos roles** (evita explosión de permisos):

1. **Rank role** (compartido): `Guild Master` / `Captain` / `Veteran` / `Guildsman`
2. **Guild tag role** (uno por guild): `G · <GuildName>`  
   - Nombre visible: `G · Legion`  
   - Color por guild (opcional)  
   - Solo miembros de esa guild  

**Display en Discord:**  
`@Guild Master` + `@G · Legion` → se ve el rango y la guild en el miembro.

Alternativa (más cara en roles): un solo rol compuesto `GM · Legion` — **no** preferido (N ranks × M guilds).

### 4.3 Cómo se asignan (pipeline)

```
In-game guild identity (Fase H)
    → wallet + guildId + guildRank + guildName
        → middleware POST /discord/sync-roles (HMAC staff secret)
            → bot Discord assigns rank + G·Name
```

**Hoy (sin Fase H completa):**

| Paso | Cómo |
|------|------|
| 1 | Form / ticket en `#guilds`: wallet + guild name + rank claimed |
| 2 | Staff o bot verifica (roster, vouch, o futuro on-chain) |
| 3 | Script/bot: `assignRoles(userId, [rankRole, guildTagRole])` |
| 4 | Al leave guild in-game → quitar tag (job periódico) |

### 4.4 Mapeo rank in-game (stub actual)

| `GuildRank` (server) | Rol Discord |
|----------------------|-------------|
| 3 Master | Guild Master |
| 2 Captain | Guild Captain |
| 1 Veteran (si se define) | Guild Veteran |
| 0 Member / default | Guildsman |

*(Alinear números exactos al proto cuando Fase H cierre ranks.)*

---

## 5. Salas de guild por $HELL staked

### 5.1 Regla de producto

> **Cada guild con ≥ `GUILD_DISCORD_STAKE_MIN` $HELL staked** (wallet de guild o suma de members — **TBD custody**) obtiene un **category** de Discord con salas propias + features del masterplan que se irán abriendo.

Stake = **utilidad / acceso a features de guild** (MASTERPLAN C1–C5). **No** yield, **no** fee-share a stakers.

### 5.2 Umbral (config — no hardcode final)

| Campo | Default tentativo | Notas |
|-------|-------------------|--------|
| `GUILD_DISCORD_STAKE_MIN` | **TBD** (ej. 50k–250k u $HELL) | Calibrar post-supply/precio; **no** publicar número hasta counsel |
| Fuente del stake | Guild treasury wallet **o** suma de stakes de masters/capitanes | Preferir **1 treasury por guild** (anti sybil de alts) |
| Recheck | Cada 24h | Si cae bajo umbral → archivar category (read-only 7d → delete) |

### 5.3 Category template por guild elegible

```
📁 GUILD · <Name>
  #g-<slug>-hall        (chat general de guild)
  #g-<slug>-officers    (solo Master + Captain)
  #g-<slug>-war         (wars / EK / rivalidades)
  #g-<slug>-bank        (warehouse / taxes — más adelante)
  🔊 g-<slug>-voice
```

Permisos: solo rol `G · <Name>` (+ officers en officers). Staff bypasa.

### 5.4 Features masterplan a ir abriendo (orden)

| # | Feature | Depende de |
|---|---------|------------|
| 1 | Roles rank + tag | Bot + roster manual o Fase H |
| 2 | Category rooms por stake | Stake live o **whitelist temporal** de guilds legacy |
| 3 | Webhook in-game → `#g-…-hall` (login de GM, war declare) | Fase H + bot |
| 4 | Tax / ACTIVE TRAINER·KILLER notifs | Guild powers MVP |
| 5 | Guild warehouse mirror (read-only summary) | Warehouse + guild bank |
| 6 | Partner / fee-share **consumibles** (no cash) | Counsel + § 1.4 |
| 7 | Priority ingress cerca de cap | AntiBotTools guild-priority |
| 8 | Legacy airdrop verify (Discord + evidence) | GUILDS-AND-LEGACY-AIRDROP |

**Mientras stake no esté live:** permitir **2–5 guilds legacy invitadas** con category manual (HB Arg / Olympia / etc.) sin exigir HELL — solo para no bloquear comunidad.

---

## 6. Roadmap de implementación

### Ahora (ops humano · 0 código de stake)

- [ ] Crear cuenta X + 2FA + pin Testing Week  
- [ ] Poner handle en landing `#links`, Discord `#links`, `OFFICIAL_X_URL`  
- [ ] Rellenar `DISCORD_WEBHOOK_URL` en VPS (hoy vacío)  
- [ ] Crear roles base en Discord: Guild Master / Captain / Veteran / Guildsman  
- [ ] Anuncio: “Follow X for airdrop eligibility (utility) · Discord for guild life”  
- [ ] Sheet: columna `xHandle` / `discordId` en reportes de claim (prep)

### Próximo slice código (barato)

- [ ] `social-bot`: comando staff `/guild-role set @user master|captain|veteran|guildsman guild:<Name>`  
- [ ] Auto-create `G · <Name>` role if missing  
- [ ] Claim middleware stub: `requiresXFollow: true` flag (enforce when OAuth ready)  
- [ ] Docs claim UI en market/landing “Airdrop eligibility”

### Después (Fase H + stake)

- [ ] Sync roles desde `GuildId` / `GuildRank` on login  
- [ ] `GUILD_DISCORD_STAKE_MIN` + job create/archive categories  
- [ ] Full masterplan guild powers + partner program (counsel)

---

## 7. Handles / IDs (rellenar)

| Pieza | Valor |
|-------|--------|
| X handle | **@ChainLordsHQ** → https://x.com/ChainLordsHQ |
| X app (OAuth) | TBD |
| Discord invite | `https://discord.gg/F4NwwbfKtj` |
| Discord guild id | (en `social-bot/.env`) |
| Announcements webhook | VPS `DISCORD_WEBHOOK_URL` (**vacío hoy — completar**) |
| Stake min for rooms | TBD u $HELL |

---

## 8. Decisiones abiertas (PO)

1. ¿Claim TGE exige **solo X**, o X+Discord desde el día 1 del claim?  
2. ¿Umbral exacto de HELL staked por guild para salas?  
3. ¿Stake de guild = treasury única o suma de miembros?  
4. ¿Veteran se define por rank in-game o por antigüedad (días en guild / rep)?  
5. ¿Legacy guilds obtienen category **sin** stake durante testing?

---

## 9. Relación con freeze / counsel

- Airdrop = **utility reward** por play-mine + social eligibility — no inversión.  
- Stake rooms = **feature unlock**, no dividend.  
- Cualquier “partner revenue” a guilds → counsel (MASTERPLAN § 1.4).  
- Ver [`FREEZE-COPY.md`](./FREEZE-COPY.md) antes de tweets de airdrop.
