# Icebound (IB) + Dragon Talent Quest — relevamiento y plan

**Fecha:** 2026-07-27  
**Fuente:** feedback Boris (Janchi) — “IB no se puede ir” = **Icebound** (mapa de hielo).  
**MASTERPLAN:** trackeado como **P3.10** (potencial implementación) + decisión append-only 2026-07-27 — *alternativa con mérito PvE* a aprender talentos solo en City Hall.

---

## 1. Icebound — qué es y cómo se entra

| Campo | Valor |
|--------|--------|
| **World id** | `icebound` |
| **Mapa** | `icebound.amd` **300×300** |
| **Entrada clásica** | Isla del medio **al este de Middleland** (pads azules) |
| **ML pads (AMD tele bit)** | `(452–453, 281–282)` |
| **Clima** | `snow-medium` |
| **Contenido (dwell)** | Frost, Ice Golem, Beholder, Hellclaw, Tigerworm (TW), Wyvern, Dire Boar |

### Fix de código (2026-07-27)

Problema probable: landing muy cerca de la **fila de salida** SE de icebound (`y=264`, tele pads), pad de entrada chico (2×2), y return a ML encima de zona confusa.

Cambios en `GameWorlds.json`:

1. **Pad entrada ML → IB** ampliado a **4×4** alrededor de los azules (`451–454 × 280–283`).
2. **Landing en IB** → **`(255, 250)`** (pasto/hielo caminable, **lejos** de `y=264`).
3. **Salida IB → ML** landing → **`(448, 278)`** (isla, no encima del pad azul).

### Cómo probar

1. Middleland → isla este → pisar pads azules ~`(452,281)`.
2. Debe cargar Icebound en nieve, spawn ~interior SE.
3. Ir al borde SE `y=264` (fila azul) → vuelve a la isla ML.

### Path a Wyverns (audit 2026-07-28)

| Check | Resultado |
|-------|-----------|
| Landing SE `(255,250)` | free (no 0x80) |
| Wyvern dwell `id=44` | box `(28–81, 23–59)` NW — shared with Tigerworm |
| BFS server (bit **0x80** only) | **path existe** SE → wyvern center `(54,41)` ~350 steps |
| Client walk (`HBMap.isMoveAllowed`) | mismo bit 0x80; icebound **0** tiles wet (18/19) |
| Componentes aislados | hay bolsillos chicos no conectados; **no** el box de wyvern |
| Pasarelas 1 tile | ~120 celdas 1-wide en el mapa (diseño AMD, no muro total) |

**Conclusión:** no hay muro de código que impida llegar a wyverns desde el landing actual. Si un tester “no puede pasar”, pedir **coords exactas** del choke (X,Y) — suele ser confusión de ruta entre muros de hielo que *se ven* como piso pero tienen flag blocked, o un corredor de 1 tile taponado por mobs. No se tocó el `.amd` sin coords.

---

## 2. Talents hoy en Chain Lords

- F5 “Talents” es un **resumen de stats** (`Str/Vit/Mag…`), **no** el sistema Olympia Earth/Lightning/Fire/etc.
- No hay quest de cambio de talento ni manuals elite de magia cableados a dragones.
- Bosses parciales: **Dragon** genérico (`id 5`, sprite barlog), **Abaddon (incomplete)** (`id 64`), Wyvern / Fire Wyvern.

### Magias elite canónicas (nombres de producto — 2026-07-27)

| Escuela | Spell elite | Estado en `Spells.json` / client |
|---------|-------------|----------------------------------|
| **Earth** | **Earth Shock Wave** | Existe (+ VFX client) |
| **Ice** | **Mass Blizzard** | Existe en catálogo |
| **Fire** | **HellFire** | **No está** — hay que portar/diseñar (no confundir con Blizzard/fire menores) |
| **Lightning** | **Fury of Thor** | **No está** — hay que portar/diseñar |
| **Poison** | *(no hay Mass Venom Strike)* | Solo **Poison**, **Poison Cloud**, **Mass Poison**. Si hacemos Poison Dragon, **diseñar** magia elite nueva (nombre TBD: p.ej. *Mass Venom Strike* u otro) |
| **Tanker / Black** | pasiva / talent, no spell AoE | Diseño aparte |

---

## 3. Relevamiento dragones (Helbreath / Nemesis → CL)

Objetivo: listar **mapas + boss** del universo Nemesis/Olympia y proponer **1 dragón = 1 talento / manual**.

| Talento / escuela | Dragón / boss | Mapa típico (Oly/Nemesis) | Manual / drop elite | Notas CL |
|-------------------|---------------|---------------------------|---------------------|----------|
| **Earth** | Earth Dragon | Dungeon / tierra | **Earth Shock Wave** | Spell listo |
| **Ice** | Ice Dragon | Hielo / icebound-like | **Mass Blizzard** | Spell listo; IB sin ice dragon aún |
| **Fire** | Fire Dragon / Fire Wyvern | Volcano / Infernia | **HellFire** | Spell **a portar** |
| **Lightning** | Lightning Dragon | Sky / light dungeon | **Fury of Thor** | Spell **a portar** |
| **Poison** | Poison Dragon | Swamp / poison dungeon | Elite poison **a diseñar** | *Mass Venom Strike no existe* en Oly/CL; Mass Poison es otra cosa |
| **Black / Tanker** | Black Dragon | Abaddon / deep | Tanker talent + loot Abaddon/Elemental | Abaddon incompleto |
| **(meta)** | Elemental / Abaddon | Endgame | Rings / swords rares | Items parciales en Items.json |

### Pasos de relevamiento (operativo)

1. **Lista de mapas Nemesis** con dragones (screenshots / wiki / dump de spawns).
2. Cruzar con **AMD + Monsters** que ya tenemos (`icebound`, `infernia*`, `abaddon`, dungeons).
3. Decidir **1 world id por dragón** (nuevo o reutilizar dungeon vacío).
4. Tabla final `DragonId → TalentId → ManualItemId → SpellId → LootTable`.

---

## 4. Diseño de quest: “Pacto del dragón”

### Fantasy

El jugador elige (o re-elige) un **talento de combate/magia** matando al **dragón elemental** alineado. El dragón dropea el **manual elite** y, con chance, **loot de calibre Elemental/Abaddon**.

### Reglas (borrador)

| Regla | Propuesta |
|--------|-----------|
| **Unlock** | Nivel mínimo (ej. 80+) o quest previa en ciudad |
| **Cambio de talento** | 1 activo; matar dragón del nuevo tipo + consumir manual **o** ritual en NPC |
| **Cooldown** | 1 cambio / N días **o** costo majestics + gold |
| **Primera vez** | Gratis al matar + pickear manual |
| **Party** | Solo tag del último hit / damage share mínimo % |
| **Fail** | Muerte del dragón sin manual = re-spawn timer (ej. 6–24 h) |

### Flujo técnico

```
[NPC Ciudad: Dragon Sage]
    → muestra talento actual + dragones disponibles
    → marca quest activa (DragonTalentQuestId)

[World icebound / earth-den / …]
    → spawn único boss (respawn timer)
    → OnKill: si quest activa y dragonType match
         → grant Manual item (soulbound)
         → chance loot elite table (Abaddon/Elemental style)

[Usar Manual en bag]
    → set player.TalentId = X
    → unlock spell(s) elite asociados
    → toast + F5 talents line real
```

### Persistencia

```text
PlayerPersistenceState:
  TalentId: string?          // "earth" | "ice" | "poison" | "light" | "fire" | "tanker"
  TalentChangedAtUtc: long?
  DragonQuestActive: string? // dragon type
  DragonKills: { type: count }
```

### Loot tables (paridad Elemental/Abaddon)

- **Común:** gold alto, stones, gems de arma/ropa mid tier  
- **Raro:** manual del dragón (garantizado 1 si quest)  
- **Muy raro:** piezas “of the Elemental / Abaddon / Dragonpower” (ya hay items en Items.json: Sword of Ice Elemental, Ring of the Abaddon, Ring of Dragonpower)

---

## 5. Fases de implementación

| Fase | Entrega | Esfuerzo |
|------|---------|----------|
| **P0** | Icebound accesible (pad + landing) | Hecho / deploy |
| **P1** | Modelo `TalentId` + F5 muestra talent real + NPC stub | S |
| **P2** | 1 dragón piloto (**Ice Dragon** en icebound upper o arena) + Mass Blizzard manual | M |
| **P3** | Earth / Poison / Fire dragons en mapas dedicados + manuals | L |
| **P4** | Black Dragon / Tanker + loot Abaddon-like | L |
| **P5** | Cooldown, party rules, ladder “dragon kills” | M |

### Piloto recomendado: Ice Dragon en Icebound

- Spawn raro en zona norte (TW/Hellclaw area) o **arena** cerrada en icebound.
- Kill → manual **Mass Blizzard** + chance Ice Elemental sword.
- Valida todo el pipeline sin tocar 6 mapas a la vez.
- Siguiente piloto natural: Fire (**HellFire**) o Lightning (**Fury of Thor**) cuando existan los spells.

### Diseño pendiente: elite poison (si hay Poison Dragon)

*Mass Venom Strike* **no existe**. Opciones:

| Opción | Idea | Riesgo |
|--------|------|--------|
| **A** | Nuevo spell *Mass Venom Strike*: AoE veneno + DoT fuerte, círculo alto | Hay que VFX + balance |
| **B** | Rebrand / upgrade de **Mass Poison** como “elite” del dragón | Menos trabajo, menos fantasía “nueva” |
| **C** | Skip poison dragon en v1; solo Earth/Ice/Fire/Lightning/Tanker | Menos scope |

Recomendación: **A** solo si poison es core del fantasy; si no, **C** en v1.

---

## 6. Open questions (para vos)

1. ¿Talento es **mutuamente excluyente** (solo 1) o stack de 2 como algunas builds Oly?
2. ¿Manual se **aprende** (spell permanente) o es **consumible one-shot**?
3. ¿Black Dragon = Tanker **stat tree** o solo título + pasiva DR?
4. ¿Querés spawns en **mapas Oly 1:1** o **arenas custom** “Dragon Lair” más fáciles de balancear?
5. ¿Poison Dragon entra en v1 (**diseñar** elite) o se pospone?

---

## 7. Referencias en repo

- `multiplayer/server/Config/GameWorlds.json` — `middleland` → `icebound`, world `icebound`
- `multiplayer/mp-client/src/constants/HuntPits.generated.ts` — pits icebound
- `multiplayer/server/Config/Spells.json` — Earth Shock Wave, Mass Blizzard
- `multiplayer/server/Config/Monsters.json` — Dragon 5, Abaddon 64, Wyvern, Fire Wyvern
- `docs/MASTERPLAN.md` — F5 Talents TBD
