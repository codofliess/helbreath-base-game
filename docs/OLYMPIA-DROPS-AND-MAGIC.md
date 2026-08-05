# Olympia drops: rates, gen pools, magic attributes

Source of truth scanned 2026-07-16:

| File | Role |
|------|------|
| `reference/Server.cpp` → `NpcDeadItemGenerator` (~L48238–49598) | Full drop tree + magic rolls |
| `reference/Npc.cfg` | Mob combat stats — **no loot table** |
| `reference/Item.cfg` / `Item2.cfg` / `Item3.cfg` | Base item stats / effect type |
| `docs/olympia-npc-dead-item-generator-extract.cpp` | Extracted generator for grepping |
| MP port | `MonsterLoot.cs` + `OlympiaMagicRoll.cs` + baked `Monsters.json` via `sp-client/tools/generate-monster-loot.mjs` |

Also see [`MONSTER-DROP-PARITY.md`](./MONSTER-DROP-PARITY.md).

---

## 1. Does Olympia show drop rate per item?

**Yes, but only as code comments + dice ranges — not in Npc.cfg.**

- Global gates: `m_iPrimaryDropRate` (default **6500**) and `m_iSecondaryDropRate` (default **9000**), loaded from server settings (`Server.cpp` ~5242–5264).
- Per-item “rate” = nested `iDice(1,10000)` / `iDice(1,12000)` / `iDice(1,3)` switches, **not** a column on the NPC.

### Overall probabilities (rating 0, Primary=6500, Secondary=9000)

```
Primary gate: iDice(1,10000) >= 6500  → ~35% any drop
  ├─ ≤6000 of that → Gold            → ~21% overall
  └─ else item path (~14% overall):
       Secondary: iDice <= 9000 - clamp(rating*repMod, ±1000)
       ├─ pass → standard band      → ~12.6% @ rating 0
       └─ fail → valuable band      → ~1.4%
            ├─ 60% weapon (80% melee / 20% wand when gen allows)
            └─ 40% armor/shield
```

**Gold quantity:** `iDice(1, GoldDiceMax - GoldDiceMin) + GoldDiceMin` from NPC gold dice fields; player `m_iAddGold` % bonus applied.

**Materials** (e.g. Slime Jelly 220) come from **DeleteNpc / material tables**, separate from `NpcDeadItemGenerator` primary path — see generator script + `MONSTER-DROP-PARITY.md`.

---

## 2. Gen level (which mob → which weapon/armor pool)

`iGenLevel` is **hardcoded by `m_sType`** inside `NpcDeadItemGenerator` (not a free-form drop list):

| Gen | Mob types (Olympia type ids) |
|-----|------------------------------|
| 1 | Slime(10), Giant-Ant(16), Amphis(22), Rabbit(55), Cat(56) |
| 2 | Skeleton(11), Orc/Orc-Mage(14), Scorpion(17), Zombie(18) |
| 3 | Stone-Golem(12), Clay-Golem(23) |
| 4 | Hellbound(27), Rudolph(61) |
| 5 | Cyclops(13), Troll(28), Beholder(53), Cannibal-Plant(60), DireBoar(62), Claw-Turtle(72), Giant-Crayfish(74), Giant-Plant(76) |
| 6 | Orge(29), WereWolf(33), Stalker(48), Dark-Elf(54), Ice-Golem(65), Minotaurus(78) |
| 7 | Liche(30), Balrogs(70), Centaurus(71), Frost(63), Nizie(79) |
| 8 | Demon(31), Unicorn(32), Hellclaw(49), Tigerworm(50), Gagoyle(52) |
| 9 | MountainGiant(58) |
| 10 | Ettin(59), MasterMage-Orc(77), Lizards(75) |

Guards / Dummy / Crop: **no drop**.

### Gen-1 weapons (example)

`iDice(1,3)` → Dagger **1** / ShortSword **8** / LightAxe **59**.

### Gen-1 shields

Wood **79** / Targe **81** only — **not** Tower Shield **87** (higher gens).

### Wand branch (valuable weapon path, ~20% of weapon rolls)

| Gen | Wand id |
|-----|---------|
| 2–3 | **258** |
| 4–6 | **257** |
| 7–8 | **256** |
| 1, 9–10 | no wand |

---

## 3. Standard band (potions / candies / stones)

When secondary **passes**, `iResult = iDice(1,12000)` → `dwValue` 1–9:

| Band | Rough share of standard | Items |
|------|-------------------------|--------|
| 1 | ~25% of 1–12000 | Green pot **95** |
| 2 | | Red **91** |
| 3 | | Blue **93** |
| 4 | | Big Green **96** |
| 5 | | Big Red **92** |
| 6 | | Big Blue **94** |
| 7 | | Power Green **390**, pots, candies **780–782**, CritCandy **970** |
| 8 | rare | Super Power Green **391**, Zem/Xelima/Merien stones, Ancient Tablets **868–871**, balls **651–655** |
| 9 | seasonal | Rabbit/Rudolph candies only |

---

## 4. Special parameters (magic attributes) — **yes, Olympia rolls them**

On valuable **weapon/armor** after `_bInitItemAttr`:

### Effect type gate (`m_sItemEffectType`)

| Effect type | Meaning | Roll routine |
|-------------|---------|--------------|
| `DEF_ITEMEFFECTTYPE_ATTACK` (1) | Melee weapons | Attack magic + color |
| `DEF_ITEMEFFECTTYPE_ATTACK_MANASAVE` (13) | Wands | Mana-save primary |
| `DEF_ITEMEFFECTTYPE_DEFENSE` (2) | Armor/shield/helm… | Defense magic |

Potions/gold: **no** attribute roll.

### Bit layout (`m_dwAttribute`) — same as client `GetItemName`

| Bits | Field |
|------|--------|
| 20–23 | Primary SWE **type** |
| 16–19 | Primary SWE **value** (1–13, weighted) |
| 12–15 | Secondary SWE **type** (optional) |
| 8–11 | Secondary SWE **value** |
| 28–31 | Rep-damage suffix (when used) |
| 0 | Custom-item flag |

### Value curve (`iDice(1,30000)`)

| Value | Approx weight |
|------:|---------------|
| 1 | ~34% |
| 2 | ~22% |
| 3 | ~15% |
| 4 | ~10% |
| 5 | ~6% |
| 6–13 | tail down to ~0.1% |

**Caps:** gen ≤ 2 → value max **7**; several type-specific minimums (e.g. crit type min 5).

### Secondary attribute

`if (iDice(1,10000) >= 6000)` → ~**40%** of magic items get a second SWE type/value packed into bits 8–15.

### Item color

Tied to primary attack-type roll (weapon colors 1–8); defense often `cColor = 0`.

### MP port

`OlympiaMagicRoll.cs` ports the same dice tables.  
`MonsterLoot.SpawnLootEntry` calls `OlympiaMagicRoll.Roll(item, genLevel)` and stores `itemAttribute` + `itemColor` on the ground item.

---

## 5. How MP applies this today

| Layer | Mechanism |
|-------|-----------|
| Baked chances | `generate-monster-loot.mjs` expands Olympia tree → `Monsters.json` `loot[{itemId, chance, min, max}]` at **rating 0** |
| Runtime | Independent rolls per row; **at most one primary + one rare** (+ gold independent) for normal mobs |
| Magic | `OlympiaMagicRoll` on gear with effect type attack/defense/wand |
| Reputation rescale | **Stub** — `TryGetKillerHelbreathRating` always false |

### Why drops can feel “completely wrong”

1. **Independent row chances** ≠ single nested Olympia tree (mutual exclusivity differs).
2. **Missing / wrong IDs** in catalog vs Item.cfg.
3. **Magic not shown** in UI even when `itemAttribute` is set.
4. **Gen wrong** on monster catalog → wrong weapon/armor pool.
5. **Server not restarted** after regenerating `Monsters.json`.

---

## 6. How to re-sync loot

```bash
node sp-client/tools/generate-monster-loot.mjs
# Restart multiplayer server (loads Monsters.json + Items.json)
```

Validate Slime: no Tower Shield **87**, no wand, has CritCandy **970** band share, material **220**.

---

## 7. Next engineering steps (if drops still wrong in-game)

1. Diff one live kill’s loot vs expected Olympia path for that gen (log `itemId` + `itemAttribute`).
2. Confirm UI decodes `itemAttribute` (SWE type/value) for bag tooltips.
3. Optionally replace independent multi-row rolls with a single tree walk matching `NpcDeadItemGenerator` 1:1.
4. Wire Helbreath character rating into secondary threshold when persisted.

---

## 8. Extract location

Full generator dump: `docs/olympia-npc-dead-item-generator-extract.cpp`  
(from `reference/Server.cpp` L48238+).
