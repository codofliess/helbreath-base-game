# Timed Challenges — retos contra el reloj (estilo Diablo 4)

> Modes **1–4 jugables** (2026-07-21 Mode 4 Survival).  
> Relacionado: [`TRAINING-ARENA.md`](./TRAINING-ARENA.md), [`refs/LAST-STAND-WAVES-PORT.md`](./refs/LAST-STAND-WAVES-PORT.md), MASTERPLAN § 3–5.

**Norte:** runs **cronometrados** con protocolo bajo presión; recompensas diarias + leaderboard. Inspiración UX Diablo 4 timed challenges — **no** copiar IP/assets Blizzard.

---

## 0. Resumen

| Modo | Nombre tentativo | Estado |
|------|------------------|--------|
| **1** | Skills (protocolo CC / control) | **MVP shipped** — ver § 1 + § 6 |
| **2** | PVP Skills — 10 Guards (waves) | **Shipped** — F8 → PVP Skills; waves 1→2→2→2→3 |
| **3** | PVP Skills — 10 Dark Elves | **Shipped** — invis pot + PFA setup, then same waves |
| **4** | Survival Waves (Last Stand–style) | **MVP shipped 2026-07-21** — Training → Challenge → Start Survival; config `Config/SurvivalWaves.json` |

Compartido:

- Entrada Mode 1 + **4**: **Training → Challenge** (Shift+F10).
- Entrada Modes 2–3: **F8 Skill → PVP Skills**.
- Reloj + progreso server-authoritative; abort sin reward.
- Leaderboard **diario UTC** — Mode 1 only.
- Anti-abuso: **1 Stone / wallet / día** (solo #1 del día, Mode 1).

---

## 1. Mode 1 — Skills (shipped MVP)

### 1.1 Objetivo

Completar el protocolo sobre **10 NPCs** lo más rápido posible.

- El run **empieza** al pulsar **Start Skills challenge** (timer server).
- El run **termina** cuando los **10** tienen protocolo completo (validación server).
- Mana: **gratis** durante el challenge (cliente refill; traveler desbloquea Chill/Para/DS/Poison solo mientras corre).

### 1.2 NPCs

| Propiedad | MVP |
|-----------|-----|
| Cantidad | **10** |
| Catalog | Mercenary Warrior (`62`) — chase como farm barracks |
| Movimiento | Velocidad = **run base del jugador**; chase agresivo |
| Daño | **0** al player; HP alto; melee hit no mata (marca poison Route B) |
| Prerrequisito | **Chill Wind** aplicado al target antes de completar |

### 1.3 Protocolos válidos

Orden flexible; estado final por NPC:

**Ruta A:** Chill Wind + Paralyze + Defense Shield  
**Ruta B:** Chill (prereq) + Poison (melee hit o spell) + Paralyze + Defense Shield  

**DS:** en Olympia es self-cast; el server acredita runners a ≤4 celdas cuando el jugador se buffea DS durante el run (tip sheet Chill → Para → DS).

Invalidaciones: matar un runner incompleto → no cuenta; leave/abort → sin reward.

### 1.4 Recompensas

| Condición | Reward |
|-----------|--------|
| Tiempo ≤ **2:00** (`HardThresholdMs = 120000`) | **+50% EXP** por **2 horas** (ledger + session) |
| **#1 del día UTC** | **Stone of Integrity** (item `1112`) — 1 / wallet / día |
| Completar sin umbral / sin #1 | Board + toast; sin stone/buff fuerte |

### 1.5 Stone of Integrity (violet zem)

- Item `1112` en `Items.json` (consumible).
- Consume: stub de **safe upgrade** (log + mensaje; sin burn/downgrade cuando exista upgrade system).
- Bound por claim diario al wallet ganador.

### 1.6 Relación con Training Arena

Práctica libre en Arena/Farm Barracks; Challenge es la versión scored (misma UI Training, tab **Challenge**).

---

## 2. Mode 2–3 — PVP Skills (shipped)

Entrada: **F8 Skill → PVP Skills**.

| Mode | Contenido | Waves | Notas |
|------|-----------|-------|-------|
| **2** | 10 Guards (catalog `31`, HP 1926) | 1→2→2→2→3 | Spawn ≥5 celdas del jugador, ángulos; kill → next wave |
| **3** | 10 Dark Elves (catalog `15`, HP 771) | igual | Setup: Invisibility Potion + PFA; luego waves |

Shift+F10 Training → Challenge: Mode 1 Skills **y** Mode 4 Survival.

### 2.5 Mode 4 — Survival Waves (MVP shipped · ref Last Stand)

Inspiración: [Helbreath: Last Stand](https://helbreath-waves.pages.dev/).  
**Entrada:** Training → Challenge → **Start Survival Waves** (`mode=4`).

| Pieza | Shipped |
|-------|---------|
| Waves 1–14 multi-type (Slime→…→scaled Demon boss) | `Config/SurvivalWaves.json` |
| 60s timer **or** clear-all → next | `TimedChallenge.TickWorld` 1s |
| Drip spawn, max concurrent 10 | Sí |
| Mix recycle prior types | Sí |
| HUD message + wave index | Training panel + quest tracker |
| Finish on wave 14 clear / death / abort | Sí |
| Blessings / armory mid-run | **No** (later) |

Port notes: [`refs/LAST-STAND-WAVES-PORT.md`](./refs/LAST-STAND-WAVES-PORT.md).

---

## 3. Anti-abuso (MVP)

| Control | Shipped |
|---------|---------|
| 1 stone / wallet / UTC day | Sí (`TimedChallengeLedger.json`) |
| Instance server-authoritative | Sí (protocol + timestamps) |
| Bound reward | Stone no trade focus; claim solo #1 |
| Industrial multi-box | Ligero — alinear con [`ANTIBOT-AIRDROP.md`](./ANTIBOT-AIRDROP.md) toggles |

---

## 4. Wire (código)

| Capa | Pieza |
|------|--------|
| Proto | `StartTimedChallengeRequest` / `Abort` / `GetLeaderboard` + `TimedChallengeState` / `Finished` / `Leaderboard` |
| Server | `Helpers/TimedChallenge.cs` |
| Client | Training dialog tab **Challenge**; `TimedChallenge.store.ts` |
| Persist | `Config/TimedChallengeLedger.json` |

---

## 5. Checklist

- [x] Entry UI (Training → Challenge)
- [x] Validación server protocolo Mode 1 (10 NPCs)
- [x] Mana free en challenge
- [x] Leaderboard diario + rewards (buff EXP, Stone)
- [x] Anti-abuso mínimo (1 stone/wallet/día)
- [ ] Mode 2 según spec usuario
- [ ] Balance fino del umbral 2:00

---

## 6. Cómo jugar / verificar (ES) — traveler `:8081`

1. Abrí el cliente traveler (`http://localhost:8081`) y entrá al mundo (hard-refresh tras deploy: Ctrl+Shift+R).
2. **Shift+F10** (o SysMenu → Training) → tab **Challenge**.
3. **Start Skills challenge** → spawnean 10 runners; mana free; Chill/Para/DS disponibles en traveler mientras corre.
4. Por cada runner: **Chill Wind** → **Paralyze** → **Defense Shield** (cerca del target), o Chill + **golpe melee** (poison) + Para + DS.
5. Al completar 10: toast con tiempo; board diario en el mismo panel.
6. **Rewards:** ≤2:00 → buff +50% EXP 2h; #1 del día UTC → **Stone of Integrity** en bag (1/wallet/día). Consume la stone → mensaje stub de upgrade seguro.
7. Reiniciar server tras pull: copiar `Config/` al output y `dotnet run`; hard-refresh cliente.

---

*Punteros: [`MASTERPLAN.md`](./MASTERPLAN.md) · [`BITACORA.md`](./BITACORA.md) 2026-07-12.*
