# Enemy Kills (EKs) — Ledger público + ranking

> Diseño (español). **Solo documentación** — no implementar gameplay completo aún.  
> Decisión de producto: 2026-07-10 (ver [`MASTERPLAN.md`](./MASTERPLAN.md) § Decisiones + Fase G).  
> Conceptos del usuario cargados **tal cual**; se pueden cambiar después según feedback.

**Estado:** Diseño.

---

## 1. Objetivo

Sistema de **Enemy Kills (EKs)** para Helbreath Chain Lord / Solana:

1. **Ledger público** de todos los EKs registrados — biblioteca fácil de scrollear, archivada, filtrable/agrupable.
2. **Elegibilidad por nivel** (regla de producto nueva; no es 1:1 con Helbreath clásico).
3. **Multiplicadores** según ranking EK de la víctima (incentivo a cazar tops).
4. **Señal visual** (ground ring bajo los pies) para quién “da EK” vs quién no — inspirada en el círculo crusade FOE, más fina/esfumada; **no** body glow.

---

## 2. Relación con lo ya existente

| Pieza | Path | Rol vs EKs |
|-------|------|------------|
| Tabla `pvp_kills` | `multiplayer/server/Persistence/schema.sql` | Log crudo de **toda** kill PvP (killer/victim/world/time). **No** es aún el ledger de EKs (sin `eligible`, `ek_value`, levels). |
| `PvpKillLedger` | `multiplayer/server/Helpers/PvpKillLedger.cs` | Inserta en `pvp_kills`; si `rated` (arena torneo) aplica Elo. |
| Atribución killer | `GameWorld` → `PlayerDied` | Resuelve killer y llama `PvpKillLedger.TryRecordKill(..., rated: IsTournamentArena)`. |
| Leaderboard torneos | `middleware-node/tournaments.js` + `pvp_ratings` / HoF | **Distinto** del EK ladder: Elo rated de arena equal-footing, no suma de EKs open-world. |
| UI “Enemy Kills” en Character | `mp-client` / `sp-client` CharacterDialog | Hoy es **placeholder**: `Progression.store` mapea `totalKills` (mobs) → `enemyKills`. **No** es el contador PvP EK. |
| Olympia reference | `reference/Client.cpp`, `sp-client/reference/Server.cpp` | Contador `m_iEnemyKillCount`, `EnemyKillRewardHandler`, hero items por EK — reglas de facción/mapa/nivel mínimo, **no** ±10 ni top multipliers. |

**Aclaración de producto:**

- **EK ladder** = ranking por suma de `ek_value` (open PvP / mundos no-torneo, según política).
- **Tournament Elo / HoF** = skill rating en `colosseum` / brackets — **no** mezclar en la misma tabla de leaderboard sin decisión explícita.

---

## 3. Reglas de elegibilidad (producto — 2026-07-10)

Carga tal cual del usuario (ajustable por feedback):

> Solo cuenta como **EK** si matás a un jugador de **más nivel** que vos, **o** como máximo **10 niveles menos** que vos.  
> Si la víctima está **más de 10 niveles por debajo**, el kill **no** da EK.

Formalización sugerida (para implementación futura):

```
delta = victim_level - killer_level
eligible = (delta >= -10)   // víctima ≥ killer−10 (incluye superiores)
```

| Caso | Ejemplo (killer L100) | ¿EK? |
|------|------------------------|------|
| Víctima superior | L120 | Sí (×1 o más según ranking) |
| Víctima igual | L100 | Sí |
| Víctima hasta −10 | L90 | Sí |
| Víctima >10 abajo | L89 | **No** |

**Notas abiertas:** ver § 9 (rebirth, same-wallet, arena, etc.).

### 3.1 Contraste con Olympia clásico (referencia)

En `sp-client/reference/Server.cpp` → `EnemyKillRewardHandler`:

- Sube `m_iEnemyKillCount` si la víctima alcanza un **piso de nivel** (`iEK_Level` 30, o 80 si el attacker ≥ 80) vía `iGetExpLevel`.
- En modo clásico: víctima **fuera** de su pueblo (`m_cLocation` vs `m_cMapName`); modo deathmatch (`m_bEnemyKillMode`) relaja eso.
- Basado en **facciones** (Aresden/Elvine), no en gap ±10 entre killer y victim.
- `m_iEnemyKillAdjust` configura cuántos puntos por kill.

→ La regla ±10 / superior es **producto nuevo** para este repo; no portar ciegamente el handler Olympia.

---

## 4. Multiplicadores por ranking EK

Objetivo: más incentivo a cazar a los tops; quienes **no** dan EK tienen menos incentivo a ser farmed.

| Ranking de la **víctima** (ladder EK global o por season — TBD) | Multiplicador |
|----------------------------------------------------------------|---------------|
| Top 10 | **EK × 3** |
| Top 11–50 | **EK × 2** |
| Resto elegible | **× 1** |
| No elegible (nivel) | **0** (no entra al ledger de EKs / no suma) |

`ek_value` sugerido por kill elegible:

```
ek_value = 1 * multiplier(victim_rank)
```

(o `base_ek` configurable × multiplier).

El ranking usado para el multiplicador debe ser **snapshot al momento del kill** (evitar race: matás a alguien que acaba de salir del top 10).

---

## 5. Aura “da EK” — ground ring (diseño visual)

> Clarificación 2026-07-10: **no** es un glow de cuerpo. Es un **círculo debajo de los pies** (ground ring), similar al aura de monstruos en cruzada, pero en players: **más finita y más esfumada** (menos opacidad / stroke más delgado) para no romper la estética. Objetivo: se note quién da EK vs quién no, **sin gritar** visualmente. **No implementar VFX aún.**

### 5.1 Grep / evidencia en repo (referencia de implementación futura)

| Hallazgo | Path / símbolo | ¿Es “aura de quien da EK”? |
|----------|----------------|----------------------------|
| **Círculo rojo Crusade bajo FOE** (ground ring) | `reference/Client.cpp` / `sp-client/reference/Client.cpp` — `CGame::DrawObjectFOE` (~L18522): si `_iGetFOE(_tmp_iStatus) < 0` → `m_pEffectSpr[38]->PutTransSprite(ix, iy, iFrame, …)` — comentario `red crusade circle`. Se llama desde draw de objetos cuando `m_bIsCrusadeMode`. | **No EK.** Referencia visual más cercana: ring bajo pies en crusade. |
| Port HTML5 del indicador | `sp-client` / `mp-client` `constants/Effects.ts` — `EFFECT_CRUSADE_ENEMY_INDICATOR` (`'crusade-enemy-indicator'`), sprite `crueffect1` sheet index 7 | Mismo concepto crusade; **no** cableado a EK. |
| Nombre / afiliación en rojo si FOE &lt; 0 | `DrawObjectName` — `iFOE < 0` → RGB(255,0,0) | **No.** Enemigo de facción / combatant. |
| “Slate red (HP)” | `CheckActiveAura` bit `0x00400000`, `m_pEffectSpr[149]` | **No.** Buff de slate. |
| Contador / reward EK | `m_iEnemyKillCount`, `EnemyKillRewardHandler`, etc. | Lógica de puntos; **sin** flag visual “da EK a *vos*”. |
| mp-client / sp-client actuales | `EFFECT_ABADDON_AURA` (mob); CharacterDialog `enemyKills` = mob kills | **Sin** ground ring PvP EK. |

**Conclusión:** Olympia **no** tiene aura dedicada “da EK”. La referencia a reutilizar/adaptar es el **círculo crusade FOE** (`DrawObjectFOE` + `m_pEffectSpr[38]` / `EFFECT_CRUSADE_ENEMY_INDICATOR`), no body glow ni slate HP.

### 5.2 Spec visual (append 2026-07-10)

| Aspecto | Spec |
|---------|------|
| Forma | **Ground ring** — círculo plano **debajo de los pies** del otro jugador (no glow de torso/silhouette). |
| Referencia | Aura de monstruos al empezar cruzada (`DrawObjectFOE` / `EFFECT_CRUSADE_ENEMY_INDICATOR`). |
| Diferencia vs crusade | **Más fina** (stroke más delgado) y **más esfumada** (menor opacidad / más soft edge). Debe leerse como señal sutil, no como alerta de guerra. |
| Quién lo ve (propuesta) | **Otros jugadores** ven el ring en **targets elegibles** respecto al viewer (A ve ring en B si matar a B daría EK a A según § 3). El local player no necesita ring en sí mismo. |
| Qué **no** es | Body glow, tint de armadura, nombre FOE crusade, slate HP, Abaddon aura. |
| Implementación | **Pendiente** — solo diseño; VFX / proto más adelante (`[fable]`). |

### 5.3 Propuesta técnica (cuando se implemente)

1. Server calcula, por viewer, si el target **daría EK** al viewer según § 3.
2. Proto: flag relativa al observer (p.ej. `ek_eligible_ring` o bit en status) — **sin** legacy guessing; extender `network.proto`.
3. mp-client: ground ring bajo pies — variante más fina/faded del asset crusade (`crueffect1` / spr 38) o sprite nuevo equivalente; **no** reutilizar crusade FOE a full opacity.
4. Opcional: tip en hover “Gives EK” / “No EK (level gap)”.

MVP barato posible: solo tip/hover o nombre; full ground ring = polish `[fable]`.

---

## 6. Ledger público

### 6.1 UX

| Superficie | Contenido |
|------------|-----------|
| **Landing** (`landing/`) | Biblioteca pública scrolleable: feed de EKs recientes + filtros; SEO/share. |
| **In-game** (dialog / panel) | Misma API; vista rápida + link “ver historial completo”. |
| **Archivado** | Paginación / cursor por `created_at`; seasons o meses colapsables. |
| **Agrupación** | Por killer, victim, map/world, día, multiplicador (×1/×2/×3). |

### 6.2 Filtros

- Killer (nombre / wallet)
- Victim (nombre / wallet)
- Map / `world_id`
- Date range
- Multiplier (`1` / `2` / `3`)
- Solo elegibles (default) vs incluir kills PvP no-EK (si se guardan en la misma tabla con `eligible=false`)

### 6.3 API sugerida (middleware)

- `GET /eks` — lista paginada + filtros  
- `GET /eks/ladder` — top por `SUM(ek_value)`  
- Auth: lectura pública; escritura **solo** desde game server / service role (igual que `pvp_kills`).

---

## 7. Modelo de datos sugerido

### Opción A — Extender `pvp_kills`

```sql
-- columnas aditivas (ejemplo; no aplicar aún)
ALTER TABLE pvp_kills ADD COLUMN IF NOT EXISTS eligible BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pvp_kills ADD COLUMN IF NOT EXISTS ek_value INT NOT NULL DEFAULT 0;
ALTER TABLE pvp_kills ADD COLUMN IF NOT EXISTS killer_level INT;
ALTER TABLE pvp_kills ADD COLUMN IF NOT EXISTS victim_level INT;
ALTER TABLE pvp_kills ADD COLUMN IF NOT EXISTS victim_ek_rank INT;  -- snapshot
ALTER TABLE pvp_kills ADD COLUMN IF NOT EXISTS multiplier INT NOT NULL DEFAULT 1;
```

Pros: un solo log de kills. Contras: mezcla torneo rated + open EK; queries del ledger deben filtrar `eligible`.

### Opción B — Tabla `enemy_kills` (recomendada para claridad de producto)

```sql
CREATE TABLE IF NOT EXISTS enemy_kills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pvp_kill_id UUID REFERENCES pvp_kills(id),  -- opcional link al log crudo
    world_id TEXT NOT NULL,
    killer_wallet TEXT NOT NULL,
    killer_name TEXT NOT NULL,
    victim_wallet TEXT NOT NULL,
    victim_name TEXT NOT NULL,
    killer_level INT NOT NULL,
    victim_level INT NOT NULL,
    eligible BOOLEAN NOT NULL DEFAULT true,
    ek_value INT NOT NULL,           -- 0 si no eligible; else 1*mult
    multiplier INT NOT NULL DEFAULT 1,
    victim_ek_rank INT,              -- rank al momento del kill
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enemy_kills_time ON enemy_kills(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enemy_kills_killer ON enemy_kills(killer_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enemy_kills_victim ON enemy_kills(victim_wallet, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enemy_kills_ek_value ON enemy_kills(ek_value) WHERE eligible;
```

Flujo: `PlayerDied` → siempre `pvp_kills` (como hoy) → si política EK aplica al mundo → evaluar elegibilidad + mult → insert `enemy_kills` y actualizar contador/ladder.

Índices para ladder: materializar `ek_scores (wallet, season, total_ek)` o vista agregada.

---

## 8. MVP `[cheap]` vs `[fable]`

### `[cheap]` — MVP docs → código mínimo

- [ ] Spec cerrada en este doc + MASTERPLAN Fase G (este entregable)
- [ ] Extender schema (`enemy_kills` o columnas) + índices
- [ ] En `PvpKillLedger` / helper nuevo: evaluar § 3 + mult § 4; insert solo si mundo no-arena (o política TBD)
- [ ] API middleware `GET /eks` + `GET /eks/ladder` (CRUD read)
- [ ] Landing: lista scrolleable + filtros básicos (killer, date, multiplier)
- [ ] Contador real en CharacterDialog (dejar de mapear mob kills → `enemyKills`)

### `[fable]` — diseño / polish / anti-abuse

- [ ] Sync ground ring “da EK” (proto + client; fina/esfumada vs crusade FOE) relativa al viewer
- [ ] Anti-farm: same-party, same-wallet alts, trade-kills, cooldown victim→killer
- [ ] Decay / seasons del ranking EK (¿ATP-like como Elo torneo o ladder forever?)
- [ ] Relación rebirth / effective level en la regla ±10
- [ ] Review seguridad: no confiar client para `eligible` / `ek_value`
- [ ] Política: ¿EKs en `colosseum`? (recomendación: **no** — Elo torneo ya cubre arena)

---

## 9. Open questions

1. ¿El nivel es `level` solo, o `level + rebirth` / “effective power”?
2. ¿Same-wallet (dos chars) o party mates pueden darse EKs?
3. ¿Snapshot de top 10/50: global all-time, season, o rolling 30d?
4. ¿Kills no elegibles se listan en el ledger público con badge “no EK” o se omiten?
5. ¿Ring relativo al **viewer** (A ve ring en B, C no) o flag global “suele dar EK”? (propuesta § 5.2: relativo al viewer en targets elegibles)
6. **Color del ring:** ¿rojo = da EK y sin ring / gris = no da EK? ¿o **solo** ring si da EK (ausencia = no da)?
7. ¿Contador Hero Set Olympia (`m_iEnemyKillCount` para cape/helm) se reutiliza o es ladder separado?
8. ¿Decay del ranking EK? ¿Floor?
9. Mundos: ¿todos los no-`tournamentArena`, o solo mapas PvP explícitos?

---

## 10. Evidencia grep (resumen)

```
reference/Client.cpp          m_iEnemyKillCount, DEF_NOTIFY_ENEMYKILL*,
                              NotifyMsg_EnemyKillReward, DrawObjectName (FOE red),
                              CheckActiveAura (Slate red HP),
                              DrawObjectFOE + m_pEffectSpr[38] (red crusade circle)
sp-client/reference/Client.cpp  mismo DrawObjectFOE
sp-client/reference/Server.cpp EnemyKillRewardHandler, m_iEnemyKillCount,
                              m_bEnemyKillMode, m_iEnemyKillAdjust
sp-client|mp-client Effects.ts EFFECT_CRUSADE_ENEMY_INDICATOR (crueffect1 #7)
sp-client/.../PlayerDialog*   enemyKills UI (demo/placeholder)
mp-client CharacterDialog     "Enemy Kills" label
mp-client Progression.store   enemyKills ← totalKills (mobs)  ← NO es EK PvP
multiplayer/.../schema.sql    pvp_kills
multiplayer/.../PvpKillLedger.cs  RecordPvpKillAsync
multiplayer/.../GameWorld.cs  PlayerDied → TryRecordKill
```

---

*Doc satélite de Fase G. Cambios de reglas → append decisión en MASTERPLAN; no borrar este historial de diseño.*
