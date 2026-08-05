# Item bind / unbind — seals ~USD 5 + mercado NFT

> Diseño + **MVP código 2026-07-17** (server bind/unbind + bag menu). Cash shop USD y death-loot full siguen pendientes.  
> Nombre de archivo histórico: unbind Hero Set; **alcance** = **todo item** (no seals/gold) + seals 960–962.  
> Decisiones: 2026-07-10 · 2026-07-17 · 2026-07-17b · **2026-07-17c code**.

---

## 1. Objetivo

| Palanca | Qué hace | Sink |
|---------|----------|------|
| **Soul Bind Seal ~$5** | Item → **soulbound** al character: **no dropea al morir** (aunque no haya Zem en bag) | Alto tráfico esperado |
| **Guild Bind Seal ~$5** | Item → **guild-bound**: no dropea; uso acotado a la guild | Alto tráfico + retención guild |
| **Unbind Seal ~$5** | Quita soul/guild bind → tradeable / listable (mercado + transfer NFT) | Sink al destrabar venta |

1. **Seguridad de gear** sin depender solo del Zemstone clásico (Zem sigue existiendo para *otros* items no-bound).  
2. **Mercado secundario** de piezas NFT: unbind de pago → list/trade → rebind.  
3. **Tráfico de consumibles** de cash shop (~$5 c/u) = revenue recurrente, no one-shot.

---

## 2. Contexto en repo (ya existe)

| Pieza | Path / nota |
|-------|-------------|
| Catálogo Hero Set (Chain Lord) | `Items.json` ids ~**400–428** (cape, helm, armor, etc.) |
| Loadout torneo equal-footing | `Config/Tournament.json` (usa subset de esos ids: p.ej. 400, 403/404, 411/412, 419/420, 423/424) |
| NFT drops rare / legendary | `drop_ledger` + middleware Bubblegum cNFT (`middleware-node`) |
| Wallet auth | Phantom SIWS (`walletAuth` / `Auth/`) |

**Importante:** el hero set del **torneo** no es el mismo objeto que el hero set **persistente** del personaje (ver § 6).

---

## 3. Flujos canónicos

### 3.1 Proteger gear (bind — **sin zem**)

```
Tradeable / free  ──(Soul Bind Seal $5)──►  soulbound   →  no drop on death
                  ──(Guild Bind Seal $5)──►  guildbound  →  no drop on death (+ reglas guild)
```

Aplica a **todo item con NFT** (o flag `can_soul_bind` / `can_guild_bind`): rares, legendaries, hero set persistente, DK upgradado, etc.  
Cape/Shoes cash shop ($25) ya nacen soulbound (no hace falta seal al comprar; sí hace falta **Unbind Seal** para vender).

### 3.2 Vender / tradear (unbind)

```
soulbound | guildbound  ──(Unbind Seal $5)──►  unbound (listable)
                              ↓
                    Sale / transfer cNFT
                              ↓
              Buyer: Soul Bind o Guild Bind de nuevo ($5)  [opcional pero esperado]
```

| Paso | Qué ocurre |
|------|------------|
| 1. Bound (soul/guild) | Usable; **no** trade; **no drop** al morir (sin zem en bag) |
| 2. Unbind Seal | Consume 1 seal → `unbound`; **sí** puede dropear si no hay zem (o regla “unbound = droppable”) |
| 3. Transfer NFT | Comprador hold mint |
| 4. Buyer re-bind | Consume Soul o Guild Seal de nuevo → protección otra vez |

**Loop económico deseado:** drop NFT → bind $5 → (opcional unbind $5 → venta → buyer bind $5) → tráfico alto de seals.

Estados: § 4.

---

## 4. Estados del item

| Estado | Significado | Trade | Drop al morir (sin Zem) | Usable |
|--------|-------------|-------|-------------------------|--------|
| `soulbound` | Ligado a **character** (+ wallet) | No | **No** | Sí |
| `guildbound` | Ligado a **guild_id** (+ holder rules) | No* | **No** | Sí (solo si en esa guild) |
| `unbound` | Tradeable; sin protección de bind | Sí | **Sí** (Zem clásico aplica si existe) | Sí (o escrow al listar — open) |
| `listed` | En mercado / hold escrow | Solo vía sale/cancel | No (en escrow) | No |
| `pending_bind` | Transfer hecha; buyer aún no eligió soul/guild bind | No | No (hold) | No |

\*Guildbound: no W2W libre; “transfer” interno guild = open (depósito guild bank vs no).

```
unbound ──Soul Seal──► soulbound
unbound ──Guild Seal─► guildbound
soulbound|guildbound ──Unbind Seal──► unbound ──list──► listed ──sale──► pending_bind
pending_bind ──buyer Soul|Guild Seal──► soulbound|guildbound
listed ──cancel──► unbound
```

### 4.1 Relación con **Zemstone of Sacrifice**

| Item | ¿Dropea al morir? |
|------|-------------------|
| `soulbound` / `guildbound` | **Nunca** por death loot (bind seal = “zem por pieza”) |
| `unbound` / sin flag bind | Reglas clásicas: puede dropear; **Zem en bag** protege según reglas Olympia/HB que implementemos |
| Torneo loadout | N/A (stash) |

Producto: el jugador **no necesita Zem** para no perder su Devastator/Hero/DK **si** pagó Soul o Guild Bind. Zem sigue útil para **el resto** del bag no-bound → **doble sink** (zem + seals).

---

## 5. Relación item in-game ↔ cNFT (**regla simple — no te enredes**)

### 5.1 Una frase

**El NFT es el “título de propiedad” de una instancia (`item_uid`). El juego manda stats, bind y upgrades. El unbind no reescribe el NFT ni crea otro mint.**

### 5.2 Capas

| Capa | Qué guarda | Quién manda |
|------|------------|-------------|
| **Postgres / inventarios** | `item_uid`, `item_id` (catálogo), **stats/attrs** (exp%, HP, drop, +DK level…), `bind_state`, `bound_wallet`, `bound_character_id`, `nft_mint` (nullable) | **Server** (autoridad absoluta) |
| **Solana cNFT (Bubblegum)** | Identidad de la pieza + holder wallet; metadata **cosmético** (nombre, imagen, rareza) | On-chain holder = dueño económico |
| **Invariante** | **1 `item_uid` ↔ ≤1 mint activo**. Unbind/bind/upgrade **nunca** clonan `item_uid` ni mint | |

### 5.3 Qué **no** va on-chain (a propósito)

- `bound` / `unbound` / `listed`
- Stats de Cape/Shoes (+30/+40 exp, HP, drop)
- Nivel de upgrade DK set / effectOverrides
- Cooldowns de unbind

Meter eso en el mint Bubblegum = **problema real** (updates caros, cNFT compressed = metadata rígida, desync).  
**Solución fácil:** metadata estática al mint; el juego lee stats de la DB por `item_uid` ligado al mint.

### 5.4 Cuándo existe el NFT

| Origen del item | ¿Mint cNFT? | Unbind |
|-----------------|-------------|--------|
| Drop rare/legendary | Ya al claim (pipeline actual) | Consume **Unbind Seal** → `unbound`; mint **sigue** |
| Hero set persistente (EK/reward/shop) | **Mint-on-first-unbind** o mint al otorgar (elegir una) | Igual: seal $5 → tradeable |
| Cape/Shoes cash shop soulbound ($25) | **Opcional hasta unbind** — ver § 5.5 | Seal $5 → tradeable; mint si aún no hay |
| Torneo equal-footing loadout | **Nunca** | N/A |

**Recomendación MVP unbind:** `mint-on-first-unbind` para items que aún no tienen mint (cash shop / grants). Si ya tiene mint (drop), solo cambia `bind_state`.

### 5.5 Cape / Shoes soulbound ($25) y el NFT

No son un caso especial mágico:

```
Compra shop → item_uid bound, soulbound=true, sin mint (o mint locked)
     │
     ├─ Uso normal en char (stats off-chain)
     │
     └─ Quiere vender → quema Unbind Seal (~$5) → bind_state=unbound
              │
              ├─ si no hay mint → mint cNFT 1× (metadata genérica “Chain Lord Cape Boost”)
              └─ list / transfer NFT → buyer holds mint → Bind → bound a su char
```

Los **stats viajan con el `item_uid` en DB**, no se “copian al NFT”. El comprador recibe el mismo `item_uid` (ownership row) al confirmar bind con el mint.

**¿Problema?** Solo si alguien intenta:  
- mint duplicado por unbind (→ invariante 1:1)  
- stats en metadata on-chain (→ no lo hagas)  
- unbind sin quemar seal (→ server exige consume)

### 5.6 Flujo custody (actualizado 2026-07-17)

```
bound ──(consume Unbind Seal ~$5)──► unbound [+ mint si faltaba]
         │
         ├─(list / W2W transfer cNFT)──► pending_bind (buyer holds mint)
         └─ buyer Bind ──► bound (wallet holds mint + char elegido)
```

1. Unbind → server **consume 1 Unbind Seal** del bag (o pago verificado que **otorga y quema** el seal en la misma tx lógica).  
2. `bind_state = unbound`; mint **no se quema**.  
3. Sale → transfer cNFT + update ownership off-chain.  
4. Bind → `getAssetsByOwner` / proof: wallet holds mint → attach `item_uid` al character.

---

## 6. Torneos equal-footing vs gear persistente

| | Hero set de torneo | Hero set / gear persistente (mercado) |
|--|--------------------|--------------------------------|
| Origen | Server aplica loadout de `Tournament.json` al entrar a `colosseum` / arena | Inventario del character + ownership NFT |
| Persistencia | **No** se escribe al char real (stash / restore al salir) | Sí; sobrevive logout |
| Unbind / venta | **No aplica** — instancias efímeras de arena | Sí (este diseño) |
| IDs de catálogo | Pueden coincidir (400–428) | Mismos *tipos*; **distinta instancia** (`item_uid`) |

Regla: **unbind solo gear persistente**. Loadout de torneo nunca paga seal ni entra al mercado.

---

## 7. Familia de consumibles ~**USD 5** (PO · 2026-07-17)

### 7.1 Tres seals (mismo precio display; ids distintos)

| Consumible (nombre de trabajo) | Precio | Efecto al quemar 1u sobre un `item_uid` |
|--------------------------------|--------|----------------------------------------|
| **Soul Bind Seal** | ~USD **5** | `bind_state = soulbound` · **no drop on death** · no trade |
| **Guild Bind Seal** | ~USD **5** | `bind_state = guildbound` · **no drop on death** · no trade libre · `guild_id` = guild actual del char |
| **Unbind Seal** | ~USD **5** | `bind_state = unbound` · tradeable · **vuelve a poder dropear** (Zem clásico otra vez) |

Cash shop Cape/Shoes ($25) = soulbound **de nacimiento** (sin gastar Soul Seal al comprar).

### 7.2 Por qué genera “gran tráfico”

| Situación | Seals quemados (típico) |
|-----------|-------------------------|
| Consigue rare/leg/hero NFT | **+1 Soul o Guild Bind** (proteger) |
| Quiere vender | **+1 Unbind** |
| Comprador quiere no dropear | **+1 Soul o Guild Bind** de nuevo |
| Cambia de guild (guildbound) | Unbind + re-Guild Bind, o regla “leave guild → force unbound / lock” (open) |
| Multi-pieza set (5–8 items) | **×N seals** por set |

→ ARPU recurrente sin ser pay-to-win de daño: es **protección / liquidez**.

### 7.3 Quién cobra

- Compra del seal en shop → treasury / entidad.  
- Quemar seal = sink; no segundo cobro on-chain obligatorio.  
- Marketplace % sobre venta P2P = **aparte** (opcional).

### 7.4 Config (no hardcode)

```text
BindSealConfig:
  soulBindItemId: …
  guildBindItemId: …
  unbindItemId: …
  shopPriceUsd: 5
  canBindTags: [nft_drop, hero_set, upgraded_dk, …]   # “todo item NFT”
  canUnbindTags: [… same + soulbound_boost …]
  mintOnFirstUnbind: true
  death: { soulboundNoDrop: true, guildboundNoDrop: true }
  cooldownHours: …
```

### 7.5 Guild bound — reglas mínimas (diseño)

| Regla | Default propuesto |
|-------|-------------------|
| Quién puede **equipar/usar** | Solo chars con `guild_id` del bind |
| Sale de la guild | Item **se queda** con el char pero **locked** hasta Unbind Seal o re-join misma guild (open: auto-unbind free vs paid) |
| Guild disuelta | Force `unbound` o lock — open |
| GM no puede confiscar | Ownership sigue en wallet/NFT del jugador |

### 7.6 ¿Fácil o problema?

| | |
|--|--|
| Soul/Unbind seal + no-drop flag | **Fácil** — flag en `item_uid` + death-loot filter |
| Guild bind | **Medio** — necesita guild_id real (Fase H parcial); hasta entonces solo Soul Bind en MVP |
| NFT | **Igual que antes** — mint 1:1; bind state **off-chain**; no remint |
| Death loot engine | **Medio** si aún no hay drop-on-death clásico en server; el flag se engancha cuando exista |

**Veredicto:** la idea de “todo NFT se soul/guild-bindea por $5 y no dropea sin zem” es **coherente y shippable**. No complica el NFT; **sí** exige death-loot rules + 3 items de shop.

---

## 8. Alcance

| Alcance | Descripción |
|---------|-------------|
| **Mes de test** | Cape/Shoes soulbound $25; créditos airdrop. Seals bind/unbind = **nice** si hay death-drop; si no, “coming soon”. |
| **MVP seals** | Soul Bind + Unbind (~$5) + no-drop flag + death loot filter. |
| **MVP+** | Guild Bind (cuando guilds existan). |
| **Mercado** | Unbind → list/transfer NFT → re-bind. |
| **Tags** | Default: **todo item con mint NFT** + hero/DK/boosts; torneo loadout excluido. |

---

## 9. Open questions (restantes)

1. **Leave guild** con item guildbound: lock / free unbind / paid unbind.  
2. **¿Unbound dropea siempre** o solo según tabla de death-drop Olympia?  
3. **¿Cape/Shoes unbind_forbidden?** Default: **se pueden unbind** con Unbind Seal.  
4. **Mint-on-first-unbind** vs mint al claim (drops ya mintan).  
5. Cooldowns anti-wash soul↔unbind loops.  
6. **¿Item `unbound` usable** en campo o solo en escrow al listar?  
7. Listing in-game vs W2W primero.  
8. Nombres finales de los 3 seals.  
9. Stack: ¿Zem + soulbound ambos? (sí, redundante en esa pieza; Zem cubre el resto del bag).

---

## 10. Anti-exploit (checklist de diseño — `[fable]`)

- Una sola fuente de verdad: mint holder + fila ownership; rechazar bind si wallet ≠ holder.
- No duplicar `item_uid` al transferir; mover ownership, no clonar.
- Unbind Seal consumido (o pago que lo materializa y quema) **antes** de pasar a `unbound`.
- Torneo loadout aislado del pipeline de unbind.
- Rate limits / cooldown / fee mínimo configurable contra wash trading.
- Reconciliación periódica drop_ledger ↔ mint (detectar item off-chain sin mint o mint sin fila).

---

## 11. Fuera de alcance de este doc

- Implementación server / client / middleware / proto.
- Implementación del shop del Unbind Seal (montos en config; ~USD 5 producto).  
- % de marketplace sobre venta P2P.
- UI final de listing.
- Legal/compliance de secondary sales (revisión humana aparte).

Detalle de roadmap y evaluación de riesgos: [`MASTERPLAN.md`](./MASTERPLAN.md) (Fase F + § Evaluaciones 2026-07-10 Unbind).

---

## 12. MVP steps `[cheap]` (cuando se abra Fase F — orden sugerido)

Prerrequisito: hardening claim/mint (Fase A) + frontera torneo stash intacta. **No** hardcodear montos de fee.

1. `[cheap]` Catalog: **Soul Bind / Guild Bind / Unbind** seals + `BindSealConfig` (~$5, tags, death no-drop flags).
2. `[cheap]` `bind_state` + `guild_id?` por `item_uid`.
3. `[cheap]` Death-loot: skip drop si `soulbound|guildbound`.
4. `[cheap]` UI bag: badges + acciones Bind Soul / Bind Guild / Unbind.
5. `[cheap]` Shop seals (mismo rail Cape/Shoes).
6. `[fable]` Mercado: unbind → transfer cNFT → pending → re-bind; reconcile mint.
7. `[fable]` Guild leave / dissolve edge cases; anti-wash cooldowns; aislamiento torneo.

MASTERPLAN § 5 · 2026-07-17 / 2026-07-17b.
