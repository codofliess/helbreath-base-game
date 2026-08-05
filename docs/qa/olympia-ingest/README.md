# Olympia ingest snapshot

Generated: `2026-08-03T15:42:07.697874+00:00`

## Counts

| kind | n |
|------|--:|
| itemCfgRows | 575 |
| magicRows | 65 |
| npcRows | 0 |
| olympiaDocs | 10 |
| weaponishRows | 128 |
| clMissingLowIdWeaponish | 0 |

## Docs indexed

- `OLYMPIA-ANGELS.md` — 6 headings
- `OLYMPIA-CHARACTER-LIST-NOTES.md` — 12 headings
- `OLYMPIA-DROPS-AND-MAGIC.md` — 21 headings
- `OLYMPIA-F5-CHARACTER-NOTES.md` — 9 headings
- `OLYMPIA-ITEM-MAGIC-AFFIXES.md` — 10 headings
- `OLYMPIA-MOB-SPECIALTY-LADDER.md` — 12 headings
- `OLYMPIA-MONSTER-ATTACK-PARITY.md` — 7 headings
- `OLYMPIA-PARITY-GAP.md` — 21 headings
- `OLYMPIA-PVP-FEEL-GAP.md` — 28 headings
- `OLYMPIA-TYPOGRAPHY.md` — 9 headings

## Agent rule

See repo root `AGENTS.md`. Re-run this script before combat/loot parity work.

```bash
python ops/olympia_ingest.py --wiki rare-items
```
