# Olympia monster attack / magic parity

Source of truth: `reference/Server.cpp` NBA (~10590–10890), `NpcMagicHandler`, mana regen (~8992), `reference/Npc.cfg`, `reference/Magic.cfg`.

## Physical attack

| Situation | Behavior |
|-----------|----------|
| Adjacent (`|dx|≤1` and `|dy|≤1`) | Melee (or tower special) |
| `attackRange > 1` and in range | Ranged physical (Dark Elf bow, crossbow tower) or specials |
| Frost / Nizie in range | 1/3 Ice-Strike + ice flag (port: Ice-Strike spell) |

## Magic (all casters)

| Rule | Olympia | Multiplayer |
|------|---------|-------------|
| Attempt | `iDice(1,2)==1` (50%) | same |
| Range | `|dx|≤9` and `|dy|≤7` | same |
| Adjacent | no magic (melee instead) | same |
| After cast | `m_dwTime += 2000` | `CastRecoveryMs = 2000` (min recovery) |
| Mana regen | every `DEF_MPUPTIME` (~15s): `+1d(maxMana/5)` | same |

## Magic-level ladder → Spells.json

| ML | Olympia Magic.cfg pick order | Server spell ids |
|----|------------------------------|------------------|
| 1–2 | MM / EB | 0 Energy Bolt |
| 3 | FB → EB | 1, 0 |
| 4 | FS → LA → FB → EB | 2, 6, 1, 0 |
| 5 | Lightning → FS → LA → FB → EB | 6, 2, 1, 0 |
| 6 | LB → Lightning → … | 6, 2, 1, 0 |
| 7 | BSW 1/5 → MFS → ES → LB → Lightning | 16, 12, 11, 6 |
| 8 | Para 1/3 → ES → LB → Lightning | 27, 11, 6, 2 |
| 9 | Lightning-Strike 1/3 | 18 |
| 10 | *(empty)*; Frost/Nizie Ice-Strike special | 10 |
| 11 | *(empty)* | — |
| 12 | Blizzard 1/3 → MCW | 21, 13 |
| 13 | ESW 1/3 → Meteor | 22, 19 |
| &lt;0 | Lightning → LA → MM (guards) | 6, 0 |

AI≥2: skip Para if target already held; skip magic vs PFA (melee instead) — Para skip is implemented; PFA skip is partial (no full PFA gate yet).

## Config fields (`Monsters.json`)

- `magicLevel` — Npc.cfg ML
- `maxMana` — Npc.cfg Mana
- `magicHitRatio` — Npc.cfg MHR
- `spells[]` — documentation + Academy kits; runtime ladder uses ML when set

Regenerate:

```bash
node multiplayer/server/scripts/patch-olympia-monster-magic.mjs
```

## Notable casters (Npc.cfg)

| Mob | ML | Mana |
|-----|----|------|
| Orc-Mage | 3 | 150 |
| Cyclops / Hellhound / Cannibal-Plant / Tentocle | 5 | 250–550 |
| Lich | 6 | 1000 |
| Demon / Barlog / Gagoyle / Master Mage Orc / Fire-Wyvern | 7 | 1500–16000 |
| Unicorn / Centaurus / Giant-Lizard | 8 | 700–2000 |
| Tigerworm | 9 | 16000 |
| Frost / Nizie | 10 | 700–2000 |
| Wyvern | 12 | 16000 |
| Abaddon | 13 | 20000 |
| City Guard | −10 | 1000 |

## Academy

Ids 100–103 keep custom kits; Hard/Elite use `AcademyCombatAi` priority (Para → Chill → ES). Still spend mana and respect 9×7 / non-adjacent / 50% gate.
