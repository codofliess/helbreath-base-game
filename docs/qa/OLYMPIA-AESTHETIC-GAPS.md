# Olympia aesthetic / function gaps (auto-checklist)

Living checklist for client visual parity. Theory combat lives in `combat_matrix_audit.py`; this is **look & feel**.

## F5 Character (must)

| Rule | Status |
|------|--------|
| Avatar = real idle-south composite (skin + gender + hair + uw + worn gear) | ship 2026-08-03 |
| Body gear never drawn as bag icons | ship 2026-08-03 |
| Only 4 jewelry slots: neck / ring / angel / gem | ship 2026-08-03 |
| No rectangle/square body hitboxes on the figure | ship 2026-08-03 |
| HP/MP/SP text slash not bars | prior |
| City + name chrome | prior |

## Bag / ground icons

| Rule | Status |
|------|--------|
| Potions smaller than raw frame (bias ~0.58) | ship 2026-08-03 |
| Capes larger bias ~1.28 | ship 2026-08-03 |
| Wands/staff larger bias ~1.35 | ship 2026-08-03 |
| Jewelry slightly smaller | ship 2026-08-03 |
| Full Item.cfg scale import | TODO |

## Future auto-detect

- [ ] Script: sample inventory sprite natural sizes by type → warn if potion median edge > wand median × 1.4
- [ ] Screenshot diff F5 vs Olympia 315.jpg (optional)
- [ ] Composite FAIL if live player has armor equipped but paperdoll composite lacks gear layer
