# Helbreath: Last Stand → port de patrones (waves)

**Fuente:** https://helbreath-waves.pages.dev/ · `game.js` (snapshot local: `helbreath-last-stand-game.js`)  
**Fecha:** 2026-07-21  
**Tipo:** single-player browser survival (canvas + OPK sprites). **No** copiar assets/OPK/IP; solo **diseño de oleadas + UX + fórmulas**.

Relacionado: [`TIMED-CHALLENGES.md`](../TIMED-CHALLENGES.md), [`TRAINING-ARENA.md`](../TRAINING-ARENA.md), Mode 2/3 waves ya shipped.

---

## 1. Qué es el juego

| Pieza | Last Stand | Nosotros |
|-------|------------|----------|
| Género | Solo, hold the field, roguelike light | MMO + challenge instance |
| Map | Tilemap Middleland-like | Mundo `training` / instance challenge |
| Loop | Waves 60s · spawn · gold · shop · level blessings | TimedChallenge + Training Arena |
| Muerte | Game over → restart run | Abort / rez / leave world |
| Progresión run | Level-up → **elige 2 blessings** | Buff temporal / tip sheet / gold (no roguelike full) |

Muy alineado con la idea de **sesiones de entrenamiento por oleadas**.

---

## 2. Motor de oleadas (lo que sí conviene imitar)

### 2.1 Constantes

```js
WAVE_SECONDS = 60;
// spawn tick: max(0.38, 0.95 / intensity)
// concurrent enemies on field: < 10
// advance when: waveTime <= 0  OR  (spawned >= quota && enemies.length === 0)
```

### 2.2 Catálogo de “lead types” (waves 1–14)

| Wave | Key | Nombre UI | HP base | Speed | Damage | XP | Gold |
|------|-----|-----------|---------|-------|--------|----|------|
| 1 | slime | SLIMES | 22 | 48 | 7 | 6 | 3 |
| 2 | ant | GIANT ANTS | 34 | 67 | 8 | 9 | 4 |
| 3 | orc | ORCS | 66 | 54 | 11 | 13 | 6 |
| 4 | scorpion | SCORPIONS | 82 | 74 | 12 | 16 | 8 |
| 5 | zombie | ZOMBIES | 120 | 43 | 15 | 20 | 11 |
| 6 | skeleton | SKELETONS | 105 | 62 | 17 | 24 | 14 |
| 7 | stone-golem | STONE GOLEMS | 150 | 40 | 20 | 32 | 18 |
| 8 | werewolf | WEREWOLVES | 185 | 64 | 26 | 40 | 24 |
| 9 | demon | DEMONS | 245 | 42 | 34 | 52 | 32 |
| 10 | gargoyle | GARGOYLES | 310 | 48 | 44 | 68 | 42 |
| 11 | hellclaw | HELLCLAWS | 430 | 52 | 56 | 90 | 55 |
| 12 | tigerworm | TIGERWORMS | 600 | 42 | 70 | 120 | 72 |
| 13 | wyvern | WYVERN (boss-ish) | 1100 | 45 | 153 | 260 | 150 |
| 14 | abaddon | ABADDON | 2200 | 39 | 246 | 520 | 300 |

**Mapear a catalog ids** en nuestro `Monsters.json` (nombres clásicos Helbreath) — no hardcodear HP de Last Stand; escalar con defs del server.

### 2.3 Cuota por wave (`waveQuota`)

```
w1 → 14
w2 → 12
w3–7 → min(10, 3+w)
w8 → 8
w9–10 → 7
w11–12 → 6
w13–14 → 1   // boss singles
w15+ endless:
  phase 3–4 (boss recycle) → 1
  else → min(10, 6 + floor((w-15)/15))
```

### 2.4 Mix de spawns (`spawnType`)

- Wave 1: 100% slime  
- Wave 2: mezcla ant + 1 slime  
- Waves 3–14: lead type + cada 3 spawns un type de las 4 waves anteriores (recycling)  
- Endless: elite mix (werewolf/hellclaw/gargoyle) o boss types  

### 2.5 Escalado

```
mobDamage = base * mult * (1 + (wave-1) * 0.065)
mobHp     ≈ base * (1 + (wave-1) * 0.16)
hitChance escala con hitRatio / defenseRatio
```

### 2.6 HUD (UX a copiar en Challenge tab)

- **WAVE** n + nombre (SLIMES…)  
- **NEXT WAVE IN** mm:ss (60s)  
- **REMAINING** (vivos + por spawnear)  
- **DEFEATED** kills  
- Banner al avanzar: `WAVE n · NAME · subtitle`  
- Pause / restart run  

### 2.7 Blessings (level-up mid-run) — **opcional / light**

Last Stand: elegís **2** de:

| Blessing | Efecto |
|----------|--------|
| Sweeping Blow | +1 target por swing (max 4) |
| Vitality | +50 max HP |
| Tempered Steel | +2 damage |
| Physical Absorption | +1% PA (cap 80) |
| Renewal | +10 HP / 5s |
| Gold Find | +10% gold |
| Life Siphon | +1% siphon (cap 10%) |
| Evasion Training | +10 DR |
| Battle Rhythm | ~12% attack speed |

**En MMO:** no copiar roguelike permanente en char main. Opciones sanas:

- A) Solo **challenge instance** buffs (se limpian al salir)  
- B) Training “tip sheet” sin stats  
- C) Gold/exp challenge only, sin blessings  

Recomendación soft test: **A light** (1–2 buffs temporales por clear de wave 5/10) más adelante; day-0 CX53 no.

### 2.8 Armory mid-run

Shop con gold de kills + upgrade items +10%/nivel.  
**MMO:** no hace falta — ya hay bag/shops. Opcional “challenge gold” dummy.

---

## 3. Qué **no** portar

| Last Stand | Por qué no |
|------------|------------|
| OPK pack loader / green-screen sprites | Assets ajenos; nosotros usamos `.spr` / packs propios |
| Single-thread client sim de combate | Server-authoritative en multiplayer |
| Auto-attack toggle como core | Ya hay combat client |
| Full roguelike shop en run | Rompe economía main |
| Landscape-only mobile mini-game como producto principal | Complemento, no reemplazo World |

---

## 4. Encaje en Chain Lords (plan de producto)

### Ya tenemos

- **Mode 2/3** TimedChallenge: waves `1→2→2→2→3` de un solo catalog (Guard / Dark Elf)  
- **Training Arena** ApplyPreset + chase dummies  
- **Farm Barracks** tip protocols  

### Gap vs Last Stand

| Gap | Prioridad soft test 10 |
|-----|------------------------|
| Tabla multi-tipo por wave (slime→…→abaddon) | Media — Mode 4 Survival |
| Timer 60s + clear-or-timeout advance | Alta UX |
| Concurrent cap + drip spawn | Alta |
| HUD wave/remaining/timer | Alta client |
| Endless phase post-14 | Baja |
| Blessings mid-run | Baja post-CX53 |

### Mode 4 — Survival Waves (**MVP shipped 2026-07-21**)

```
Mode = 4
Start → Wave 1 banner (TimedChallengeState)
Config: multiplayer/server/Config/SurvivalWaves.json
Server: drip spawn + 60s + advance; TickWorld 1s
Client: Training → Challenge → Start Survival Waves
Clear wave 14 → TimedChallengeFinished
```

---

## 5. Config

- Design seed: `survival-waves-seed.json`  
- **Live game config:** `multiplayer/server/Config/SurvivalWaves.json`

---

## 6. Orden

1. Docs ✅  
2. JSON + catalog map ✅  
3. Server Mode 4 ✅  
4. Client Start + HUD message ✅  
5. Opcional: blessings instance-only  
6. **Nunca** copiar OPK/assets del site  

---

## 7. Legal / marca

Last Stand usa marca “Helbreath” + sprites estilo clásico. Nuestro producto: **Helbreath Chain Lords** (marca propia, no oficial). Tomar **solo mecánicas**; no rehostear su `game.js` ni packs.
