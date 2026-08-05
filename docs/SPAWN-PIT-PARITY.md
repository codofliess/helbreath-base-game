# Spawn / Pit Parity (Olympia MAPDATA + NPC.cfg)

> Producto: **Helbreath Chain Lord**. “Olympia” = referencia de balance/pits, no branding.

## Resumen

| Área | Estado |
|------|--------|
| Pits (`dwellAreas`) desde `spot-mob-generator` | **Hecho** para mapas con spots en MAPDATA |
| Farms / towns — slimes early | **Hecho** (`arefarm` 45 slime, `elvfarm` 60, ciudades 60 c/u) |
| HP / daño / respawn desde `NPC.cfg` | **Hecho** para 47+ monstruos catalogados |
| Drop rates | **Hecho (2026-07-11)** — regenerado desde `generate-monster-loot.mjs` (Olympia Server.cpp). Ver [`MONSTER-DROP-PARITY.md`](./MONSTER-DROP-PARITY.md). Slime ya **no** dropea Tower Shield; CritCandy **970** en catálogo. |
| `random-mob-generator` (dungeons / huntzones) | **Hecho (2026-07-11)** — tablas `Server.cpp` → conteos esperados × (`maximum-object` − 30) en `dwellAreas` |
| huntzone3/4 MAPDATA | **Hecho (2026-07-11)** — archivos desde isolatorhk; pits RMG level 6 sincronizados (273 mobs c/u; −47 Orc-Mage gap) |

**Reinicio:** hace falta **reiniciar el server** C# para recargar `GameWorlds.json` + `Monsters.json`. Cliente no requiere rebuild por pits.

## Fuentes

| Dato | Origen |
|------|--------|
| Rectángulos + counts de pits | `tmp-mapdata/*.txt` / `sp-client/reference/mapdata` → `spot-mob-generator` |
| Tipo de mob en MAPDATA | `sp-client/reference/Server.cpp` switch `iMobType` → nombre |
| Cap + composition random | `maximum-object` MAPDATA + `Server.cpp` RMG switch (~25911) + strcpy table (~26549) |
| HitDice / ADT / ADR / RegTime | `reference/Npc.cfg` (isolatorhk Helbreath.ServerFiles) |
| HP esperado | `Server.cpp` `_bInitNpcAttr`: HD≤5 → `dice(HD,4)+HD` (avg HD×3.5); else HD×5 + avg(1..HD) |
| Daño min/max | `iDice(ADT, ADR)` → min=ADT, max=ADT×ADR |
| Respawn ms | `RegTime` de NPC.cfg |
| Loot | `sp-client/tools/generate-monster-loot.mjs` (no se re-inventó en este pass) |

Script reproducible: `node multiplayer/server/scripts/sync-olympia-pits.mjs`  
Reporte máquina: [`SPAWN-PIT-PARITY.report.json`](./SPAWN-PIT-PARITY.report.json)

## Early / starter (traveler → ciudad → farm)

| Mundo | Pits | Slime pits | Slime count | Otros early |
|-------|------|------------|-------------|-------------|
| `traveler` | 6 | **6** | 108 | Solo Slime — mapa `default`, spawn seco inland **(90,80)** (no map-center; costa/shore ~y104+) |
| `arefarm` | 11 | 3 | 45 | Ant, Scorpion, Amphis(Snake), Stone Golem |
| `elvfarm` | 10 | 2 | 60 | Ant, Scorpion, Amphis |
| `aresden` | 13 | 3 | 60 | + guards / mid farm mobs según MAPDATA |
| `elvine` | 13 | 3 | 60 | idem |

Antes: `traveler` **no tenía** `dwellAreas` (0 pits). `arefarm` / `elvfarm` se sincronizaron desde MAPDATA.

## Mundos sincronizados (spot pits)

| World | MAPDATA | Pits | Total mobs |
|-------|---------|------|------------|
| aresden | aresden.txt | 13 | 170 |
| elvine | elvine.txt | 13 | 170 |
| arefarm | arefarm.TXT | 11 | 150 |
| elvfarm | elvfarm.TXT | 10 | 195 |
| promiseland | 2ndmiddle.txt | 11 | 185 |
| middleland | middleland.txt | 27 | 430 |
| icebound | icebound.txt | 13 | 168 |

Spots McGaffin/Perry/Devlin (tipos 67–69) **omitidos** del dwell combat (NPC de pueblo; no monstruo de farm).

## Mundos sincronizados (random-mob-generator → dwell esperado)

Olympia rellena hasta `maximum-object − 30` eligiendo tipo por tabla de nivel. Nuestro server solo tiene `dwellAreas`: el script asigna **conteos esperados** (largest-remainder) por probabilidad exacta de `Server.cpp`, área = bbox de waypoints ±20.

| World | MAPDATA | RMG level | max-object | Slots | Composition (catalog) |
|-------|---------|-----------|------------|-------|------------------------|
| aresdend1 | aresdend1.txt | 4 | 180 | 150 | Ant 37, Snake 37, Stone Golem 22, Clay Golem 22, Hellhound 16, Cyclops 16 |
| elvined1 | elvined1.txt | 4 | 180 | 150 | idem |
| middled1x | middled1x.TXT | 5 | 150 | 120 | Ant 35, Orc 18, Zombie 18, Skeleton 12, Scorpion 12, Stone Golem 12, Clay Golem 9, Hellhound 2, Cyclops 2 |
| huntzone1 | huntzone1.txt | 16 | 350 | 320 | Scorpion 59, Ant 42, Snake 41, Skeleton 56, Zombie 56, Rudolph 32, Stone Golem 17, Clay Golem 17 |
| huntzone2 | huntzone2.txt | 16 | 350 | 320 | idem |
| huntzone3 | huntzone3.txt | 6 | 350 | 320→273 | Skeleton 47, Clay Golem 66, Troll 66, Stone Golem 39, Tentocle 19, mid/high-band ×4 (Orc, Cyclops, Ogre, Hellhound, WereWolf, Giant Frog, Mountain-Giant, Ettin, Cannibal-Plant). **−47 Orc-Mage** (result id 6) |
| huntzone4 | huntzone4.txt | 6 | 350 | 320→273 | idem |
| toh1 | toh1.txt | 13 | 675 | 645 | Zombie 90, Hellhound 161, Cyclops 129, Ogre 97, Dark Elf 129, Beholder 39 |

Si un mapa tiene **spots y** RMG (p.ej. `2ndmiddle` / farms), **ganan los spots** — no se apila RMG encima (evitar doble spawn inventado).

### huntzone3 / huntzone4 MAPDATA

Fuente: [isolatorhk/Helbreath.ServerFiles](https://raw.githubusercontent.com/isolatorhk/Helbreath.ServerFiles/master/HGServer/MAPDATA/) → `tmp-mapdata/` + `sp-client/reference/mapdata/`.  
Contenido: `maximum-object = 350`, `random-mob-generator = 1 6`, waypoints compartidos (bbox ≈ 35–218 × 56–211), teleports a huntzone1/2. Sin `spot-mob-generator`.

## Combat sample (post-sync)

| Monster | HP | Dmg | Respawn ms | Nota |
|---------|----|-----|------------|------|
| Slime | 7 | 1–4 | 3500 | = wiki Olympia HP 7 |
| Ant | ~11 | 2–6 | 5000 | Giant-Ant |
| Snake (Amphis) | 14 | 2–8 | 3500 | |
| Scorpion | 21 | 5–15 | 3500 | |
| Orc | 14 | 3–9 | 3500 | |
| Stone Golem | ~138 | 7–28 | 4500 | antes tenía dmg absurdo 100–200 |

## Gaps (no inventar)

1. **Orc-Mage** (RMG result id 6 en huntzone3/4) — sin fila open-world en catálogo → 47 slots omitidos por mapa (gap en reporte). No inventar monstruo.
2. **Unidades de cruzada / kits** (AGT, GHK, Beetle, etc.) — sin fila clara en NPC.cfg de combate open-world; quedan gaps en el reporte.
3. **Training Dummy / Mercenary Warrior|Mage** — arena propia; **excluidos** del patch de combate NPC.cfg (`SKIP_COMBAT_PATCH_NAMES` en el script). Pit sync **conserva** dwellAreas con monsterId 42/62/63 (`BARRACKS_MONSTER_IDS`) al re-sync MAPDATA.
4. **Farm Barracks (`arefarm`/`elvfarm`)** — dwellAreas manuales (42/62/63) **no** están en MAPDATA; **re-añadidas** cerca de Drillmaster / Merc Captain en `GameWorlds.json` (`npcs`). El pit sync **conserva** estas filas al re-sync MAPDATA vía merge de `BARRACKS_MONSTER_IDS` en el script.
5. **Loot exacto Olympia** — regenerado 2026-07-11 vía `generate-monster-loot.mjs` (gen pools + materiales DeleteNpc + CritCandy 970). Detalle: [`MONSTER-DROP-PARITY.md`](./MONSTER-DROP-PARITY.md). Re-correr el script si cambian Item.cfg ids.
6. **Traveler dry spawn** — server bloquea sprite 19 (agua) **y** sprite 18 (shore) como occupied; spawn/resurrect/reconnect usan hub único **(90,80)** vía `Spawn.TryGetTravelerDefaultSpawn`. No `SpawnInMiddle` / map-center en `traveler`.
7. **Npc.cfg isolatorhk vs Olympia live** — RegTime/HitDice pueden diferir del binario Olympia actual; best available open source. Wiki HP slime coincide.
8. **RMG packs / berserk / followers** — Olympia spawnea master + followers por tick; nosotros fijamos población esperada estática. Composición de tipos = misma tabla; clustering dinámico no replicado.

## Cómo re-sync

```bash
# NPC.cfg ya en reference/; si falta:
# curl -L -o reference/Npc.cfg https://raw.githubusercontent.com/isolatorhk/Helbreath.ServerFiles/master/Config/Npc.cfg

# MAPDATA huntzone3/4 (si faltan):
# curl -L -o tmp-mapdata/huntzone3.txt https://raw.githubusercontent.com/isolatorhk/Helbreath.ServerFiles/master/HGServer/MAPDATA/huntzone3.txt
# curl -L -o tmp-mapdata/huntzone4.txt https://raw.githubusercontent.com/isolatorhk/Helbreath.ServerFiles/master/HGServer/MAPDATA/huntzone4.txt

node multiplayer/server/scripts/sync-olympia-pits.mjs
# Reiniciar multiplayer server
```
