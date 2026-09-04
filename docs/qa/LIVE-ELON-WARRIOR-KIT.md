# Live `Elon` Warrior L150 — one-row ops door

Owner-authorized overlay for **one** live traveler:

| Field | Value |
| --- | --- |
| Name | `Elon` (exact) |
| Wallet | `4R7FsyC85Yic3hGz7yWAt7HbV5A1qtC7UQi13Hsv5r7K` (@KindGem997) |

Not PauPau. Not playtest `ElonQa`. No INSERT. No generic give-item packet.

## Why this is not an open admin API

- The game process does **not** call `LiveElonWarriorKit`.
- Writes happen only from `ops/apply-live-elon-warrior-kit.py`.
- All of these must match or the script exits without UPDATE:
  1. `name = 'Elon'`
  2. `account_wallet` = the pubkey above
  3. `ALLOW_LIVE_ELON_KIT=1` (must stay **unset** on `chainlords-game`)
  4. `--apply` (default is dry-run)
- Blocked names: `ElonQa`, `PauPau`.
- `UPDATE … WHERE id AND name AND wallet`; `rowcount` must be 1.
- `world_id` / `pos_x` / `pos_y` are not rewritten.

## Kit (PO 2026-09-04)

- Level 150 · 182 STR / 65 INT / 50 MAG / 80 VIT / 12 CHR / 128 DEX
- Equipped: a Hero warrior (M) helm/armor/hauberk/legs + traveler cape
- Bag: Giant Battle Hammer **+7** (upgrade nibble 7)
- Bag: Magic Wand(MS22) — CP nibble **15** (cap; product CP40 no cabe en 4 bits), HR nibble **13** (display ×7 ≈ **91**, closest to HR90)
- Bag: a Hero Cap(M) + a Hero Robe(M) (swap mage)
- Bag CIC4 HP70 each: Wings-Helm(M) 751, Plate Mail(M) 458, Plate Leggings(M) 462, Hauberk(M) 454, Cape 402
- Bag extra Cape 402 **MCon/DR**: MCon nibble 15 (cap; product 20 no cabe, combate clampa a 13), DR nibble 11 → 77 (más cerca de 80; 12 sería 84)

## Apply on the game Postgres host

Elon offline or re-log after. Backup first. Not a game-binary deploy.

```bash
python3 ops/apply-live-elon-warrior-kit.py --self-test
ALLOW_LIVE_ELON_KIT=1 DATABASE_URL='…' python3 ops/apply-live-elon-warrior-kit.py
ALLOW_LIVE_ELON_KIT=1 DATABASE_URL='…' python3 ops/apply-live-elon-warrior-kit.py --apply
```
