# Monster Drop Parity (Olympia Server.cpp)

> Producto: **Helbreath Chain Lord**. Loot tables must mirror Olympia `NpcDeadItemGenerator` + `DeleteNpc` materials — **no inventar** exotic drops.

## Resumen

| Área | Estado |
|------|--------|
| Generator script | **Aligned** — `sp-client/tools/generate-monster-loot.mjs` |
| Item IDs (Gold / potions / materials) | **Aligned** — Gold **90**, potions **91/93/95**, Slime Jelly **220** |
| Gen-1 shields (Slime / Ant / Snake) | **Aligned** — Wood **79** + Targe **81** only (**no** Tower Shield **87**) |
| Tower Shield (87) | Gen **5+** only where Olympia armor switch includes it (Cyclops / Troll / …); **not** gen 8–10 |
| Rare standard bands | **Aligned** — Big potions **92/94/96**, Power Green **390**, candies **780–782** + CritCandy **970**, stones/tablets/balls (case 8) |
| Wand branch | **Aligned** — gen 2–3 → **258**, 4–6 → **257**, 7–8 → **256** (20% of weapon path, `iDice≤8000` melee); gen 1 / 9–10 sin wand |
| Armor weights (gen 6–10) | **Aligned** — nested Olympia `iDice` flattened (helms gen6, Scale/Knight gen7, Cape/Boots gen8–9, Scale/Helm gen10 reachable cases) |
| Reputation / secondary modifier | **Stub** — `MonsterLoot.TryGetKillerHelbreathRating` / `ResolveSecondaryDropThreshold`; tablas baked @ `m_iRating == 0`. Sin columna de rating Helbreath; **no** usar PvP Elo |
| Farm / traveler / town pit monsters | Regenerated via script |

**Reinicio:** hace falta **reiniciar el server** C# para recargar `Monsters.json` + `Items.json`.

## Fuentes

| Dato | Origen |
|------|--------|
| Drop logic | `sp-client/reference/Server.cpp` → `NpcDeadItemGenerator` + `DeleteNpc` |
| Item ids | `reference/Item.cfg` / `Item3.cfg` / `multiplayer/server/Config/Items.json` |
| NPC combat (no loot) | `reference/Npc.cfg` — **no define drops** |
| Runtime apply | `multiplayer/server/Helpers/MonsterLoot.cs` |

## Cómo regenerar (batch completo)

```bash
# Desde helbreath-base-game — reescribe loot de TODOS los sprites mapeados (47+ mobs)
node sp-client/tools/generate-monster-loot.mjs
# Deploy Config/Monsters.json + restart chainlords-game
```

**2026-07-30:** se eliminó el `continue` especial de Ettin (antes solo tocaba gold y dejaba tabla custom rota). Un solo bake = segmento completo por gen 1–10.

El script imprime checks: Slime `hasTowerShield` / `hasWand` = `false`, `hasCritCandy` = `true` + band chances; mid-mobs con gen + Tower/wand id/chance esperados; Demon gen8 Cape/Boots.

## RNG / reputation (Olympia)

```
Primary gate (~6500): iDice(1,10000) >= PrimaryDropRate  → ~35% enter drop path
  ├─ ≤6000 → Gold (~21% overall)
  └─ else item path:
       Secondary = SecondaryDropRate - clamp(rating * RepDropModifier, ±1000)
       ├─ dice ≤ Secondary → standard band (~12.6% @ rating 0, Secondary≈9000)
       └─ else → valuable (~1.4%): 60% weapon (80% melee / 20% wand) / 40% armor
```

MP bake: chances in `Monsters.json` use **rating 0**. Runtime does not rescale until `TryGetKillerHelbreathRating` returns a real rating. Character Helbreath reputation is not persisted; wiring PvP Elo would be incorrect.

## Slime (catalog id 1) — proof

| Path | Items | Notes |
|------|-------|-------|
| Gold | 90 | ~21% Olympia |
| Potions (common + rare bands) | 91–96, 390, candies **780–782 + 970**, stones… | branch estándar 12.6% |
| Gen-1 weapons | 1, 8, 59 | Dagger / Short Sword / Light Axe |
| Gen-1 shields | **79, 81** | Wood / Targe — **not** 87 |
| Material | **220** | Slime Jelly 1/25 |
| Wand | — | gen 1 no tiene rama wand |

**Bug fixed:** Slime previously listed Tower Shield (`itemId: 87` @ ~9.5%) from a bad shield-decay approximation.

## Mid-mob samples (post-regen)

| Mob | Gen | Tower Shield | Wand |
|-----|-----|--------------|------|
| Orc / Skeleton / Scorpion | 2 | no | **258** @ ~0.005 |
| Stone Golem | 3 | no | **258** @ ~0.005 |
| Cyclops / Troll | 5 | sí (87) | **257** @ ~0.005 |
| Demon | 8 | sí (wiki blend) | **256** @ ~0.005 |
| **Ettin** | **10** | no (Scale/Helm/Plate) | none (Olympia gen9–10 sin wand) |

## Ettin (catalog id 0 · Olympia type 59 · gen 10) — batch 2026-07-30

**Antes:** tabla custom a mano + el generator **hacía `continue` y no regeneraba** Ettin → holes (raras wrong, plate inconsistente, sin pool gen10 completo).

**Ahora:** bake completo vía `generate-monster-loot.mjs` (mismo path que Slime/Orc/Demon):

| Path | Items (IDs) |
|------|-------------|
| Gold | **90** · 1–170 @ 0.21 |
| Standard band | pots 91–96, 390, candies 780–782+970, stones/tablets/balls |
| Valuable weapons (gen10) | **50, 51, 55, 56, 615, 761, 762, 843, 853** |
| Valuable armor | Olympia Scale **457/477** + Helm **600/602** + CL Plate **458/478** + light Cape/Boots/horned |
| Materials / manuals | **735, 853, 382** (+ wiki rare weights) |

Runtime: `MonsterLoot.DropSinglePrimaryLoot` — gold independent; at most one pot/material bucket + one gear + one rare per kill (Olympia-style caps).

## Pit monsters covered

traveler / arefarm / elvfarm / aresden / elvine early pits: Slime, Ant, Snake (Amphis), Scorpion, Stone/Clay Golem, Orc (middleland), etc. — all regen from gen pools in the script.

## Relevamiento bugs testers (2026-07-28 → wiki pass)

**Lista de rares:** [Olympia wiki Monsters and drops](https://www.helbreath.net/wiki/Monsters_and_drops)  
**Script:** `generate-monster-loot.mjs` → `MATERIAL_BY_OLYMPIA` + **`WIKI_RARE_BY_OLYMPIA`** (solo IDs en `Items.json`).

| Mob | Wiki bodyparts | Signature rares (subset catalog) | CL |
|-----|----------------|----------------------------------|-----|
| **Demon** | 540–543 | Blood Axe/Rapier/Sword, Berserk Wand, Demon Slayer, Resur Wand, Ring Demonpower, Efreet… | **OK** |
| **Gárgola** | None | Xelima line, Dark Executor, Rings Xelima/Abaddon/Demon/Dragon, Efreet, Beholder… | **OK** |
| **Unicorn** | materials | Kloness + Merien | **OK** (ya no NO_LOOT) |
| **Frost** | gen7 | Storm Bringer, Ice Elemental sword (+ Kloness Axe en pool gen7) | **OK** |

Wiki rares **sin catálogo** (Haste Manual, Vortex Gem, Sword of Thirst, Hat of Divinity, Windslasher, Bane, Excalibur…) **no se inventan** hasta portar item.

## Gaps restantes

1. Runtime reputation rescale — stub listo (`TryGetKillerHelbreathRating` → false); pendiente persistir **rating Helbreath de personaje** (no Elo PvP). Baseline neutral OK para jugable.
2. CritCandy **970** — **hecho (2026-07-11)**: añadido a `Items.json` (ausente de Item.cfg; stub espejo de candies 780–782) + case-7 share en loot.
3. Case 9 seasonal Dec candy (Rabbit/Rudolph only) — omitido a propósito.
4. Gen 8 shields **926/927** (ShieldOfFaith/Brave) — en Olympia pero **ausentes de Item.cfg**; no inventar stats. Share no redistribuida (Demon gen8 dropea solo Cape/Boots en catálogo).
5. See also [`SPAWN-PIT-PARITY.md`](./SPAWN-PIT-PARITY.md) for spawn/HP sync (separate from loot).

## Tom repair (durability)

Weapon durability (`curLifeSpan` / `maxLifeSpan`) is wired end-to-end from Olympia `Item.cfg`. Tom repairs weapons (category 1–10) with the classic half-price × missing-durability formula. Combat wears equipped weapons by 1 per hit (fair weather).
