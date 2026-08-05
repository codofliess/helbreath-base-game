# Playwright physical tests — DEFERRED list

**Rule:** run these only after a **substantial** theoretical batch is green  
(`ops/combat_audit.py` + `ops/combat_matrix_audit.py` exit 0).

Live char: PO wallet allowed (standing `AGENTS.md`). Prefer not to burn uniques.

---

## When to unlock

- [ ] Theory matrix stable 3+ consecutive green days  
- [ ] `__CL_QA__.getState()` hook shipped (bag, last dmg float, specialty, equipped)  
- [ ] Grant script can equip mock loadouts without hand-click  

---

## Suite A — Mage Blizzard (same mob, e.g. Demon or Training Dummy)

| # | Loadout | Assert (approx) |
|---|---------|-----------------|
| A1 | No wand, specialty L50 | Blizz hits; float dmg in band of theory EV±25% |
| A2 | MS20 (256) | same or ≥ A1 |
| A3 | MS22 + HR50 | hit rate ↑ vs A1 (sample N casts) |
| A4 | MS22 HR91 +10 | hit rate ≥ A3; no wand destroy on open bag |
| A5 | ZW20 +0 | dmg ≈ 1.25× A1 magic EV |
| A6 | ZW20 +10 | ≥ A5 |
| A7 | each of above **+ full mage hero set** | +~4 dmg vs same loadout without set |

Target: same `catalogMonsterId` every time (GM summon).

---

## Suite B — War physical

| # | Loadout | Assert |
|---|---------|--------|
| B1 | bare hand L50 specialty | hits register |
| B2 | LongSword+2 | dmg ≫ bare |
| B3 | + Hero War full set | hit% ↑, dmg +~5 |
| B4 | + Necklace Of Xelima (HR100) | hit% ↑ |
| B5 | + Ring Xelima (+7) | dmg +~7 |
| B6 | + Ring Abaddon (+10) | dmg +~10 more |
| B7 | weapon +10 upgrade | dmg ≥ B6 |

---

## Suite C — Incoming / Merien

| # | Loadout | Assert |
|---|---------|--------|
| C1 | naked | high taken from same mob hit |
| C2 | heavy PA set | taken ↓ |
| C3 | same + Merien +5 / +10 pieces | taken ≤ C2 (or durability path documented) |
| C4 | specialty L50 vs L0 | taken ↓ on same gear |

---

## Suite D — Drops

| # | Case | Assert |
|---|------|--------|
| D1 | specialty L0 vs L50 farm N=50 same mob | rare row rate not lower at L50 (theory mult) |
| D2 | dragon corpse | ≥1 ground item (gold ok) |
| D3 | MS22 in bag | name contains MS22, sprite staff not tablet |

---

## Suite E — Gross UI/economy

| # | Case | Assert |
|---|------|--------|
| E1 | Cash Stat Change Ticket | price 0; consume → stats 10 |
| E2 | MS22 stone upgrade | rejected with message |

---

## Not in Playwright (theory only)

- Full 137 weapons × 75 monsters  
- Exact Olympia binary dice tables bit-identical  
- Ping/feel dens  

---

## Runner sketch (future)

```bash
# after theory green:
node multiplayer/mp-client/scripts/qa-combat-smoke.mjs
# later:
node multiplayer/mp-client/scripts/qa-matrix-live.mjs --suite A
```
