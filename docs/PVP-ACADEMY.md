# PvP Academy — aprendizaje por patrones + challenge por nivel

> **PO 2026-07-21:** No priorizar survival multi-mob (Slime→Abaddon). Con el nivel de items actual, **Ettins ya son muchísimo**.  
> Lo que importa: **guardias en tandas** para enseñar **patrones y secuencias PvP**, y luego **challenge por dificultad** con NPCs “como jugadores” (firma GM + hero set).

> **PO (misma noche):** Academia **en la catedral** con **2 NPCs** — Learning + Challenge GM. Leaderboards por tier. Premios con **handicap por EK** (ultra no farmea Easy).

Relacionado: [`TIMED-CHALLENGES.md`](./TIMED-CHALLENGES.md), [`TRAINING-ARENA.md`](./TRAINING-ARENA.md), [`BEGINNER-PATH-1-80.md`](./BEGINNER-PATH-1-80.md).

---

## 0. Entrada: Catedral (shipped scaffold)

| NPC | Catalog id | Mundo | Función |
|-----|------------|-------|---------|
| **Drill Instructor** | **15** | `arecath` / `elvcath` | Learning modes |
| **Arena Master** (GM look TBD) | **16** | `arecath` / `elvcath` | Challenge tiers + boards |

Acciones desk (CityNpcServiceRequest):

| Action | Efecto |
|--------|--------|
| `learn_guards` / `learn_darkelves` / `learn_skills` | Start TimedChallenge 2 / 3 / 1 |
| `challenge_easy` … `challenge_elite` | Start modes 10–13 |
| `board_easy` … `board_elite` | Leaderboard text in `cityServicesSummary` |
| `handicap` | Explica banda EK del jugador |

Ledger: `Config/PvpAcademyLedger.json` (EK count + best times + daily reward claims).

### Handicap premios (EK lifetime)

| Banda | EK (default) | Premios gold al clear (1×/día/tier) |
|-------|--------------|-------------------------------------|
| **Standard** | &lt; 50 | Easy → Elite |
| **Advanced** | 50–199 | Intermediate → Elite (**no Easy**) |
| **Ultra** | ≥ 200 | **Hard + Elite only** |

Gold stub: Easy 200 · Int 500 · Hard 1200 · Elite 2500.

### Academy EK (Hard / Elite — elite-player-like tiers)

When Hard/Elite opponents behave like real elite players, a **successful clear** can grant **1 Academy EK** (counts toward lifetime EK / handicap / progression):

| Tier | Max Academy EKs / UTC day |
|------|---------------------------|
| **Hard** | **1** |
| **Elite** | **3** |
| Easy / Intermediate | **0** (no EK farm) |

Caps reset UTC midnight. Remaining budget shown on clear. Open-world EKs still increment lifetime via the same ledger.

---

## 1. Dos modalidades

| Modalidad | Objetivo | Enemigos hoy | Enemigos target |
|-----------|----------|--------------|-----------------|
| **Learning (aprendizaje)** | Enseñar secuencias PvP más usadas | **Guards** (y opcional Dark Elves + invi/PFA) en tandas 1→2→2→2→3 | Igual; tip sheets por oleada |
| **Challenge (evaluación)** | Medir skill bajo presión escalada | Stub = Guards + label de tier | **NPC firma GM + hero set**, war/mage AI por tier |

**No es Elo rated.** No es torneo. Kills no cuentan ladder ciudad.

---

## 2. Learning — guardias en tandas

### 2.1 Por qué Guards

- HP “real” de ciudad (catalog **31**).  
- Movimiento predecible → el jugador practica kite, freeze, Para, DS, PFA **sin** full human AI.  
- Oleadas crecientes = presión de **espaciado y target priority**, no de loot table.

### 2.2 Formato de oleadas (shipped Mode 2)

```
Wave sizes: 1 → 2 → 2 → 2 → 3   (total 10)
Next wave only after clear.
```

Entrada: **F8 → PVP Skills → 10 Guards** o Training → Challenge (botón Learning Guards).

### 2.3 Secuencias a enseñar (tip sheets — producto)

| Fase | Secuencia / hábito | Por qué |
|------|--------------------|---------|
| Open | Posicionar · no stack en el pack | AOE / multi-target |
| Mid | Chill → Para (o poison path) · DS self | Lock + survive |
| Defensive | PFA vs archers / DE · PFM cuando magia | Mode 3 DE setup |
| Reset | Step out · pot · re-engage | Breath control |
| Close | Priorizar low HP · no overcommit | Wave timing |

UI: mensajes server por wave + tips en panel (copy corto ES/EN).

### 2.4 Learning Mode 3 (Dark Elves)

Setup: **Invi pot → step → PFA** luego waves. Enseña invis + arrow protect (patrón open-world / gank).

### 2.5 Optional pressure: Ettins only

Si se quiere “mucho pack / mucha vida” sin bestiario: **solo Ettin (id 0)**.  
No multi-type Last Stand ladder. Config opcional / Mode endurance.

---

## 3. Challenge — por dificultad (vision)

NPCs **no son monstruos de caza**: se sienten como **jugadores** con hero set (loadout tipo torneo / GM create), firma visual **GM** (sprite/name tag).

### 3.1 Roles

| Rol | Comportamiento target |
|-----|------------------------|
| **Warrior** | Melee, hammer/sword patterns, physical pressure, Merien/Xelima when allowed |
| **Mage** | Range, Chill / Para / PFM self, AMP, DS timing |

### 3.2 Tiers

| Tier | Nombre | AI / kit (target) | Mode id (scaffold) |
|------|--------|-------------------|---------------------|
| **1** | Easy | Movimiento **predecible**; casi no self-buff PFM/AMP; pocos golpes/trucos | **10** |
| **2** | Intermediate | Self **PFM / PFA / AMP** a ritmo lento; poke decente | **11** |
| **3** | Hard | Se defiende **y** te tira **PFA/DS**, **Chill**, a veces **invi** | **12** |
| **4** | Elite | Kit completo: invi pots, **1× Merien Shield**, Xelima si hace falta, Para de calidad, full tools | **13** |

### 3.3 Formato challenge (propuesto)

- 1v1 o 1v2 tandas cortas (no 10 forever).  
- O waves de 1–2 “players” con el tier AI.  
- Clear / timeout / death = score (time, deaths, patterns used — TBD).  
- **No** drop loot de economía main.

### 3.4 Combat vs Unicorn (shipped)

| | Unicorn (59) | Academy Elite (103) |
|--|--------------|---------------------|
| Kit | ES + Chill + Para (random) | ES, Triple ES, Chill, Para, Fire, LB, LS |
| AI | Random among rolled spells | **Priority:** Para if free → Chill setup → ES pressure |
| Stats | ~1.8k HP, 10–100 dmg | ~6.5k HP, 45–160 dmg, faster attack |

Hard (102) same priority AI, slightly lower rates.  
**Grok:** policy design offline (this table + `AcademyCombatAi.cs` constants). **Not** per-tick LLM (latency/cost).  
Still TBD: self Merien / invi pots / hero-set look (monster buffs engine limits self-PFM).

### 3.5 Dependencias de build (orden)

1. Learning + catedral desks ✅  
2. Academy catalogs 100–103 + priority AI ✅  
3. Hero-set GM **look** + self-buffs (Merien/invi)  
4. Full player-like pathing / AMP self  
5. Scoring polish

---

## 4. Encaje código actual

| Pieza | Estado |
|-------|--------|
| Mode 2 Guards waves | **Shipped** — core Learning |
| Mode 3 Dark Elves + setup | **Shipped** — Learning invi/PFA |
| Mode 4 multi-mob Survival | **Deprecado como prioridad**; opcional Ettin-only endurance |
| Mode 10–13 Challenge tiers | **Scaffold** — Guards + copy; AI hero TBD |
| Tournament loadout JSON | Reuse for hero set on academy NPCs |
| Training Arena dummies | Sigue para Lize/kite free practice |

---

## 5. Copy UI (ES)

**Learning**  
> Guardias en tandas. Practicá las secuencias de PvP: posicionamiento, Chill→Para, DS, PFA. Sin Elo.

**Challenge Easy**  
> Oponente predecible. Casi no se buffea. Ideal para cerrar el combo sin estrés.

**Challenge Intermediate**  
> Se tira PFM/PFA/AMP despacio. Mantené presión y lecturas.

**Challenge Hard**  
> Se defiende y te tira PFA/DS, Chill, invi ocasional.

**Challenge Elite**  
> Kit completo: invi pots, Merien 1 carga, Xelima si hace falta, Para fuerte. Como pelear un human bueno.

---

## 6. Freeze

- No vender “AI pro” como promesa day-0 de los 10 testers — Learning Guards **sí**.  
- No moon / $HELL en rewards de academy.  
- No copiar Last Stand bestiario como producto principal.
