# Olympia vs Chain Lords — PvP feel gap (Capa A + B)

> **Status:** Capas A (Olympia source) y B (CL runtime) auditadas 2026-07-30.  
> **Capa C (experiencia vivida):** pendiente — clips de **Tola** (PvP Olympia + PvP CL).  
> No reescribir combate a ciegas: este doc es la base; los videos validan prioridades.

---

## 0. Objetivo de producto (PO · 2026-07-30)

**Norte:** la experiencia de PvP (y combate en general) debe ser **igual o mejor** que Olympia en todo lo que sea **reglas + feel implementable**.

**Única distancia aceptable** (en la medida de lo posible):

| Aceptable como “no es culpa del diseño” | No aceptable (hay que cerrar) |
|----------------------------------------|-------------------------------|
| Límites **técnicos de browser** (WebGL/Phaser, single-thread JS, audio web, tab throttling) | Reglas distintas sin justificación (ej. kick solo por AttackType vs umbral 50/80) |
| **Ping / calidad de red** del jugador o del VPS contratado | Bumps, desync, DamageMove mal, stun wrong, cast wrong, spacing broken |
| Costos de infra (cómo de “local” se siente un DC lejano) | “Es un browser game” como excusa para parity de **mecánica** |

**Implicación:** si Tola (u otro top PvP) dice “en Olympia pasa X y acá no”, y X no es ping/browser:

1. Se trata como **bug o gap de parity**  
2. Se prioriza hasta **igual o mejor**  
3. Solo se marca “wontfix / limitación de plataforma” con evidencia técnica (y se mitiga: prediction, interpolación, equalizer opcional, etc.)

**Mejor que Olympia** (deseable, no bloqueante): claridad de dmg, FOE, arena fair delay opt-in, logs, UX de pact/tournament — sin romper el feel clásico.

---

## 0.1 Scope del feel (qué medimos)

Medir y cerrar el gap de **experiencia de PvP** (no solo daño numérico):

- Movimiento fluido (sin bumps / rubber-band)
- Hit timing / interrupt / stun
- **DamageMove** (“patear” hacia atrás)
- Cast feel, dash, legibilidad
- Gráficos/FX solo donde afectan el combate

---

## 1. Capa A — Olympia (source of truth)

### 1.1 DamageMove = umbral de daño (no “lista de bichos”)

En `reference/Server.cpp` (paths de daño a player ~28905 y ~29358):

| Mapa | Umbral | Efecto |
|------|--------|--------|
| **Normal** (ML, city, farm…) | **`iDamage >= 50`** | `DEF_NOTIFY_DAMAGEMOVE` + 1 tile |
| **Fight zone** (`m_bIsFightZone`) | **`iDamage >= 80`** | mismo, umbral más alto |
| Por debajo del umbral | — | `DEF_OBJECTDAMAGE` (anim hit, **sin** displace) |

Dirección: 8-dir **alejándose del atacante** (vector atk → tgt).  
Si la celda no es moveable, el client/server intentan fallback (en algunos paths).

**Importante:** en PvP player→player y en hits de mob→player que pasan por este path, **cualquier** fuente de daño ≥ umbral patea. No es “Ettin patea y Slime no”: es **¿cuánto dmg entró?** (mitigado). Un slime que meta 12 no patea; un hit de 55 sí.

### 1.2 Client olympia — cómo se siente el kick

`Client.cpp`:

1. `DEF_NOTIFY_DAMAGEMOVE` setea `m_sDamageMove` (dir) + `m_sDamageMoveAmount` (dmg).
2. En el loop de comando, si `m_sDamageMove != 0` → `m_cCommand = DEF_OBJECTDAMAGEMOVE`, target cell = ±1 en dir.
3. Floating text `-%dPts` / font size por banda de dmg.
4. `DrawObject_OnDamageMove` interpola el sprite (no es un teleport seco en el client original).

### 1.3 Super Attack / “critical feel”

- `wType >= 20` = super attack path; consume `m_iSuperAttackLeft`.
- Crit / SA es **modo de ataque** separado del DamageMove por umbral.
- En client, DamageMove con amount especial puede mostrar “Critical!” en algunos ports.

### 1.4 Magia

Muchas magias llaman `Effect_Damage_Spot_DamageMove` → el mismo mecanismo de displace + dmg (valores por spell config `m_sValue4/7`).  
Feel: un BSW / ESW gordo **patea** igual que un melee 50+.

### 1.5 Qué NO es Olympia DamageMove

- No es el `AttackType.Knockback` de nuestro enum (eso es un diseño CL/modern).
- No depende de “solo bosses”.
- No es multi-tile por default (1 paso de grid).

### 1.6 Fuentes A

| Archivo | Qué |
|---------|-----|
| `reference/Server.cpp` ~28905–28932, ~29358–29397 | umbrales 50/80 + DAMAGEMOVE |
| `reference/Client.cpp` ~27230–27237, ~32294–32352 | apply + interpolate DamageMove |
| `reference/Client.cpp` DrawObject_OnDamageMove | render |

---

## 2. Capa B — Chain Lords (runtime)

### 2.0 Shipped 2026-07-30 — DamageMove umbral (KB-1 cerrado en código)

- PvP / spell-to-player / monstruo→player: si `damage >= 50` (open) o `>= 80` (fightzone*/colosseum/arena/btfield) → kick 1 tile (`TryApplyDamageMoveStep`).
- Monstruo también recibe kick por umbral de dmg (no solo `AttackType.Knockback` de catálogo).
- Ver `Combat.GetDamageMoveThreshold` / `TryApplyDamageMoveStep`.
- Live dens feel también vs **Helbreath War**: `docs/refs/HELBREATH-WAR-LIVE-NOTES.md` + MASTERPLAN § 1.11.

### 2.1 Modelo de hit: `AttackType` (cliente → server)

```csharp
// Commons.cs
NoInterrupt = 0, Interrupt = 1, Stun = 2, Knockback = 3
```

- El **jugador** elige / manda `AttackType` en el packet de ataque (UI stun/normal/knockback modes).
- Knockback PvP solo si `attackType == Knockback` **y** la celda destino está libre (`Combat.ApplyPlayerAttackToPlayerWithDamageImmediate`).
- **No hay** check `damage >= 50` / `>= 80` para forzar kick.

### 2.2 Mobs → player

- Catalog `Monsters.json` `attackType`:
  - mayoría **omit / 0–1** (sin kick automático por dmg)
  - **Stun (2):** Dark Elf (1 muestra)
  - **Knockback (3):** Guard, Sorceress, Academy Elite Contender (~3 entradas)
- Mob hit aplica knockback solo si su `AttackType` de catálogo es Knockback, no por umbral de dmg.

### 2.3 Player → player (PvP)

| Paso | CL |
|------|-----|
| Hit/miss | `CombatHit.RollMeleeHitPlayer` |
| Dmg | dice + Sharp/quality flat + CAD + SA + mitigation |
| Kick | **solo** si request `AttackType.Knockback` |
| Stun lock | si `AttackType.Stun` (+ duración config) |
| Arena equalizer | `ArenaPact.GetCombatDelayMs` (delay artificial) |

### 2.4 Client CL

- `Player.ts`: estados `TakeDamage`, `TakeDamageOnMove`, `TakeDamageWithKnockback`
- Config: `KnockbackTimeMs`, stunlock wall-clock local
- Dash attack mode separado
- Floating dmg chains (P2.4) — legibilidad OK-ish
- **No** path 1:1 de `DEF_NOTIFY_DAMAGEMOVE` con umbral 50/80

### 2.5 Fight zone

- Mundos `fightzone*` existen en config (arena kits).
- Falta confirmar flag server `IsFightZone` análogo a `m_bIsFightZone` para umbral 80 (si implementamos DamageMove).

### 2.6 Fuentes B

| Archivo | Qué |
|---------|-----|
| `Helpers/Combat.cs` | PvP/PvE hit + knockback por AttackType |
| `World/Game/GameWorldMonster.cs` | mob→player knockback |
| `Commons.cs` | AttackType enum |
| `Config/Monsters.json` | attackType por mob |
| `mp-client/.../Player.ts` | anim / stunlock / knockback |
| `mp-client/Config.ts` | timings knockback/stun |

---

## 3. Matriz de gap (A vs B)

| ID | Tema | Olympia (A) | CL (B) | Gap | Prioridad propuesta |
|----|------|-------------|--------|-----|---------------------|
| **KB-1** | Kick por dmg | ≥50 open / ≥80 FZ | **Shipped** umbral (2026-07-30) | Cerrado en código | Validar en game |
| **KB-2** | Kick magia | DamageMove en muchas spells | Mismo umbral en spell→player path | Cerrado vía dmg | Validar |
| **KB-3** | Kick mob→player | dmg ≥50 | **Shipped** umbral + catalog Knockback | Cerrado en código | Validar |
| **AT-1** | Stun vs normal | modes + SA | AttackType UI | Validar mirror | P1 (videos) |
| **MV-1** | Bumps / rubber | client DAMAGEMOVE interp | authority + lerp | TBD videos | P0 si Tola reporta |
| **MV-2** | Dash attack | classic dash | dashMode client+server | TBD videos | P1 |
| **NT-1** | Ping / equalizer | n/a classic | ArenaPact delay | Puede **añadir** artificial lag | P1 (arena only) |
| **CS-1** | Cast interrupt | Hold/Para/… | audit SPELL-CC | Parcial | P1 |
| **UI-1** | Floating dmg / FOE | classic | chains + FOE | Menor | P2 |
| **FX-1** | Graphics fluency | native | Phaser sprites | Menor/medio | P2 |

### Hipótesis P0 — status

> ~~KB-1 abierto~~ → **implementado 2026-07-30** (umbral 50/80). Validar en prod con pelea gorda (War dens feel + Olympia).

---

## 4. Cómo medir (listo para Capa C / Tola)

### 4.1 Brief de grabación (Tola)

**Setup ideal**

- 1080p **60fps**, mic opcional
- HUD visible (HP, target)
- Misma pelea conceptual en **Olympia** y **CL** (no hace falta mirror perfecto de gear)

**Clips (15–40 s c/u)**

| ID | Escena | Notar en voz o texto |
|----|--------|----------------------|
| O1 | 1v1 melee open field Olympia | ¿cuándo patea? ¿a partir de qué dmg visual? |
| C1 | 1v1 melee mirror en CL (ML o arena) | ¿falta patada? ¿bump? |
| O2 | Fight zone / arena Olympia | umbral más alto (80) |
| C2 | Arena pact / fightzone CL | |
| O3 | Mage trade (FS/BSW/EB) Olympia | kick de magia |
| C3 | Mage trade CL | |
| O4 | War vs Mage Olympia (su pick) | feel cast interrupt |
| C4 | War vs Mage CL | |
| X1 | (opcional) 1 clip “esto se siente mal en CL” | el que él elija |

**Checklist verbal (1–5)** al final de cada clip CL: move / bumps / kick / stun / cast / overall.

### 4.2 Log server (cuando implementemos feel-debug)

```
ts, map, fightZone, atk, tgt, dmg, attackTypeIn, attackTypeOut,
kicked, posBefore, posAfter, rttMs
```

Toggle: env `COMBAT_FEEL_LOG=1` o admin flag (no spamear prod 24/7).

### 4.3 Criterios de “cerrado”

| Métrica | Target |
|---------|--------|
| Kick rate dmg≥50 open | ≈100% si cell libre (Oly) |
| Kick rate dmg 1–49 | ≈0% |
| Kick rate FZ 50–79 | ≈0%; ≥80 ≈100% |
| Rubber events (>1 tile snap sin kick) | ~0 en LAN |
| Score Tola overall | ≥4/5 en core loop |

---

## 5. Plan de implementación (post-videos, no ciego)

Orden sugerido **después** de ver a Tola:

1. **KB-1 DamageMove threshold**  
   - Tras aplicar dmg final a player: si `dmg >= (IsFightZone ? 80 : 50)` → forzar kick 1 tile (aunque AttackType no sea Knockback).  
   - Packet: reutilizar path Knockback client (`TakeDamageWithKnockback`) o alias DamageMove.  
   - Fight zone: flag por map id (`fightzone*`, arena pact maps).

2. **KB-2** spells: al resolver dmg magia a player, mismo umbral.

3. **KB-3** mob→player: mismo umbral (opcional override catalog “never kick” para crop/dummy).

4. **MV-1** si videos muestran bumps: revisar interpolación client en knockback + occupancy.

5. **NT-1** ArenaPact delay: validar con Tola si el equalizer “mata” el feel.

**No tocar** antes de videos: rebalance de dmg numbers, redesign AttackType UI, FX cosméticos.

---

## 6. Estado de instrumentación

| Item | Estado |
|------|--------|
| Doc A+B | **Este archivo** |
| Bitácora / masterplan pointer | actualizar |
| Combat feel log | **TBD** (1 PR chico) |
| DamageMove 50/80 | **TBD** post-Tola (o pre-implement si PO autoriza) |
| Videos Tola | **Pending** |

---

## 7. Mensaje corto para Tola (copiar)

> Necesitamos 4–8 clips cortos (15–40s) a 60fps:  
> 1) tu PvP en **Olympia** (melee + magia + si podés fight zone)  
> 2) lo mismo en **Chain Lords**  
> En cada clip de CL: ¿te falta la patada cuando el hit es gordo? ¿hay bumps? ¿stun raro?  
> Sos el mejor barómetro de feel — no hace falta mirror de set, hace falta **honestidad de experiencia**.

---

## 8. Resumen ejecutivo

| Capa | Resultado |
|------|-----------|
| **A** | Kick = dmg ≥ **50** (open) / **80** (fight zone); 1 tile; client `OBJECTDAMAGEMOVE` |
| **B** | Kick = `AttackType.Knockback` elegido; casi ningún mob type=3; sin umbral 50/80 |
| **Gap #1** | **KB-1** DamageMove por daño |
| **Siguiente** | Videos Tola (C) → priorizar fix KB-1 + bumps que él marque |

*Auditoría: 2026-07-30. Fuentes: `reference/Server.cpp`, `reference/Client.cpp`, `multiplayer/server/Helpers/Combat.cs`, `GameWorldMonster.cs`, `Monsters.json`.*
