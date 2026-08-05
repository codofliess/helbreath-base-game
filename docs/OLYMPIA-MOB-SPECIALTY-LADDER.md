# Olympia Mob Specialty ladder (from #315 UI)

**Source screenshot:** `Helbreath Olympia #315.jpg` (Statistics → Mobs → Orc specialty tooltip)  
**Fecha captura UI:** 2026-07-25  
**Estado:** diseño de referencia para Chain Lords Mob Mastery + stake stacking  
**Related:** [`MOB-MASTERY-STAKE-STACKING.md`](./MOB-MASTERY-STAKE-STACKING.md)

---

## 1. What the UI shows (Orc example)

| Field | Value on screenshot |
|-------|---------------------|
| Species | **Orc** |
| Total kills (list) | **359** |
| Current specialty level | **1** |
| Progress to next | **359 / 600** kills for level 2 |
| Current bonuses (at L1) | **+1 Damage on Orc** |
| Label | “Orc Specialty Level 1” |

### Upcoming bonuses (from tooltip)

| Level | Kills required (total) | Bonus granted at that level |
|------:|-----------------------:|-----------------------------|
| **2** | 600 | **−1 Damage Received** (from that mob) |
| **3** | 1350 | **+2.00% Drop Rate** |
| **4** | 2400 | **+1.96% Drop Rate** |
| **5** | 3750 | **+1.92% Drop Rate** |
| **6** | 5400 | **+1.88% Drop Rate** |
| **7** | 7350 | **+1.84% Drop Rate** |
| **8** | 9600 | **+1.81% Drop Rate** |

### Kill thresholds pattern

Differences between consecutive thresholds:

| Step | From → To | Δ kills |
|------|-----------|--------:|
| L1→L2 | ? → 600 | (L1 threshold not shown; progress bar implies L2@600) |
| L2→L3 | 600 → 1350 | **750** |
| L3→L4 | 1350 → 2400 | **1050** |
| L4→L5 | 2400 → 3750 | **1350** |
| L5→L6 | 3750 → 5400 | **1650** |
| L6→L7 | 5400 → 7350 | **1950** |
| L7→L8 | 7350 → 9600 | **2250** |

Δ sequence: **750, 1050, 1350, 1650, 1950, 2250** = arithmetic **+300** each step.

If L1 threshold is **150** (common for early list rows e.g. Giant Ant 29/150):

- L1 @ 150 → L2 @ 600 (Δ 450) — does **not** continue the +300 series from L2.
- Or L1 @ 300: Δ to 600 = 300; then 750, 1050… would need different model.

**Working formula hypothesis (for L≥2 thresholds):**

```
threshold(L) = 150 * L * (L + 1)   ? 
  L=2 → 150*2*3=900 ≠ 600
threshold(L) = 75 * L * (L + 1):
  L=2 → 450 ≠ 600
threshold(L) = 150 * L^2:
  L=2 → 600 ✓
  L=3 → 1350 ✓
  L=4 → 2400 ✓
  L=5 → 3750 ✓
  L=6 → 5400 ✓
  L=7 → 7350 ✓
  L=8 → 9600 ✓
```

**Confirmed:** for this Orc ladder (and likely all standard mobs):

```
killsRequired(level) = 150 * level²
```

| Level | 150 × L² |
|------:|---------:|
| 1 | 150 |
| 2 | 600 |
| 3 | 1350 |
| 4 | 2400 |
| 5 | 3750 |
| 6 | 5400 |
| 7 | 7350 |
| 8 | 9600 |
| 9 | 12150 |
| 10 | 15000 |

Screenshot list consistency:

- Clay Golem 2/**50** — **different ladder** (elite / low-cap / different species formula?)
- Giant Ant 29/**150** — matches L1@150
- Giant Scorpion 4/**100** — different
- Orc 359/**600** — L1 done, next L2@600 ✓
- Snake 598/**600** — next L2@600 ✓

So **not every mob uses 150×L²** for every threshold; early tiers on some mobs show 50/100. Possible explanations:

1. **Species multiplier** `killsRequired = base * L²` with base 50/100/150 by family.  
2. **Elite Mobs** tab uses other tables.  
3. Partial data / UI rounding.

**Default CL proposal:** use `150 * L²` for standard open-world mobs (matches Orc/Snake/Ant L1). Species-specific base open.

---

## 2. Bonus ladder structure (Olympia)

From the Orc tooltip, bonuses are **per level milestone**, stacked permanently for that species:

| Level | Type | Magnitude (Orc tooltip) |
|------:|------|-------------------------|
| 1 | **+Damage** (flat) to that mob | **+1** |
| 2 | **−Damage received** (flat) from that mob | **−1** |
| 3+ | **+Drop rate %** (relative), diminishing | 2.00% → 1.96% → 1.92% → … ≈ **−0.04 pp per level** |

**Not shown on this screenshot (but typical for full specialty systems):**

- Hit chance / accuracy vs that mob  
- Further +damage / −taken at higher levels  
- Exp bonuses  

**Implication for CL stake design:**  
Do **not** invent a single “+0.5% dmg per level” only — Olympia uses a **step ladder**: early levels = flat combat, later = drop %. Stake should either:

**A)** Add **effective levels** on this same ladder (your earlier rule: +10 levels per 100k stake), or  
**B)** Multiply the **same bonus table** as if the player were N levels higher.

Your prior rule (100k → +10 levels) maps cleanly onto this ladder as **level offset**.

---

## 3. Drop % progression (L3+)

| Level | Drop % bonus (tooltip) | Δ |
|------:|-----------------------:|--:|
| 3 | 2.00% | — |
| 4 | 1.96% | −0.04 |
| 5 | 1.92% | −0.04 |
| 6 | 1.88% | −0.04 |
| 7 | 1.84% | −0.04 |
| 8 | 1.81% | −0.03 |

Nearly linear:  
`dropBonusPct(L) ≈ 2.00 - 0.04 * (L - 3)` for L≥3, with slight noise at L8.

**Cumulative drop** if all stack additively:

```
cumDrop(L) = sum_{k=3..L} dropBonusPct(k)
L8 ≈ 2+1.96+1.92+1.88+1.84+1.81 ≈ 11.41%
```

Combat flats L1–L2 do **not** appear to grow on this tooltip beyond +1/−1 (may cap or upgrade at higher levels not shown).

---

## 4. List UI columns (Olympia #315)

| Column | Meaning |
|--------|---------|
| Name | Monster species |
| Kills | Lifetime kills of that species |
| Level | Current specialty level (0 if below L1 threshold) |

Progress in tooltip: `currentKills / killsRequired(nextLevel)`.

---

## 5. CL implementation mapping

| Olympia | Chain Lords |
|---------|-------------|
| Specialty Level | `killBaseLevel` from kills via `150*L²` (or species base) |
| +1 dmg / −1 taken / drop % steps | Bonus table by level |
| Stake personal | `+ floor(staked/100k)*10` **effective levels** on top of specialty level |
| F11 | Show kills, level, current bonuses, next unlocks |

### Effective level with stake

```
specialtyLevel = max L such that kills >= 150 * L²   // L>=1; else 0
stakeLevels    = floor(stakedHell / 100_000)   // 100k = +1 tier; 5M = +50
effectiveLevel = specialtyLevel + stakeLevels
```

Bonuses = sum of ladder steps from 1..effectiveLevel (same table as Olympia).

**Example:** organic L7 + 300k pending → +3 → effective **10**.  
Organic L7 + 500k → +5 → **12**. Organic L7 + 5M → +50 → **57**.

---

## 6. Full species table (Olympia `contents/specialties.json` → CL `MobSpecialties.json`)

**Source:** Olympia client data dump (`specialties.json`), not only the Orc/Slug UI screenshot.  
**29 species** with per-mob `base_kills` and ordered `bonuses[]` (each entry = reward at that specialty level).  
Levels beyond the array keep cycling **`drop_rate`**.

Formula (all species):

```
killsRequired(L) = base_kills * L²
specialtyLevel   = max L with kills >= base_kills * L²
stakeLevels      = floor(stakedHell / 100_000)         // 100k→+1; 5M→+50; reversible if balance drops
effectiveLevel   = specialtyLevel + stakeLevels        // e.g. L7 + 300k = 10; L7 + 5M = 57
```

Stake amount for specialty = `max(StakedHell, mining PendingHell)` (daily credit-share fills pending).

Bonus type meanings (CL `MobSpecialty.AggregateBonuses`):

| Type | Per step |
|------|----------|
| `damage` | +1 flat dmg vs species |
| `damage_reduction` | −1 flat taken from species |
| `damage_pct` | +2% dmg |
| `damage_reduction_pct` | −2% taken |
| `hit_ratio` / `hit_ratio_pct` | +2 hit chance points |
| `drop_rate` | +2.00% then −0.04 pp each further drop step |

| Id | CL name (if mapped) | base_kills | Bonus ladder (L1 →) |
|---:|---------------------|----------:|---------------------|
| 10 | Cat | 150 | dmg, drop×5 |
| 16 | Elf Master | 150 | dmg, drop×5 |
| 22 | God's Hand Knight | 150 | dmg, drop×5 |
| 14 | Cyclops | 150 | dmg, −taken, drop×6 |
| 17 | Dark Shadow Knight | 100 | dmg, −taken, hit, drop×4 |
| 11 | Centaurus | 100 | dmg, −taken, hit, drop×4 |
| 18 | Demon | 100 | dmg, −taken, hit, drop×4 |
| 12 | Clay Golem | 50 | dmg, drop, −taken, drop, hit, drop×2 |
| 23 | GHK on Steed | 50 | dmg, drop, −taken, drop, hit, drop×2 |
| 27 | Giant Tree | 50 | −taken, drop, dmg%, drop, hit, drop×2 |
| 57 | Ancient Temple Knight | 50 | −taken, drop, dmg%, drop, hit, drop×2 |
| 61 | Zombie | 50 | −taken, drop, dmg%, drop, hit, drop×2 |
| 28 | Stone Golem | 50 | −taken, drop, dmg%, drop, hit, drop×2 |
| 13 | Claw Turtle | 100 | −taken, drop, dmg%, drop, hit, drop×3 |
| 65 | (unmapped) | 100 | −taken, drop, dmg%, drop×3 |
| 58 | Troll | 25 | −taken, drop, dmg%, drop, hit, drop |
| 53 | Stalker | 100 | −taken%, drop, dmg%, drop×3 |
| 63 | Mercenary Mage | 50 | −taken%, drop, dmg%, drop, hit, drop×2 |
| 62 | Mercenary Warrior | 50 | −taken%, drop, dmg%, drop×3 |
| 29 | Arrow Guard Tower | 50 | −taken%, drop, dmg%, drop×3 |
| 30 | Cannon Guard Tower | 50 | −taken%, drop, dmg%, drop, hit, drop |
| 48 | Rudolph | 50 | −taken%, drop, dmg%, drop, hit, drop |
| 76 | (unmapped) | 50 | −taken%, drop, dmg%, drop×3 |
| 54 | Tentocle | 100 | −taken%, drop, dmg%, drop, hit, drop |
| 33 | Hellclaw | 75 | −taken%, drop, dmg%, drop, hit, drop |
| 59 | Unicorn | 20 | −taken%, drop, dmg%, drop, hit%, drop |
| 32 | Hellhound | 20 | −taken%, drop, dmg%, drop, hit%, drop |
| 31 | Guard | 20 | −taken%, drop, dmg%, drop, hit%, drop |
| 52 | Sorceress | 20 | −taken%, drop, dmg%, drop, hit%, drop |

**Not every open-world farm mob is in this file** (e.g. Orc/Snake/Slug from the UI screenshot may use default base 150 + default ladder: dmg, −taken, then drop_rate). Unlisted species in CL use that default.

**Stake rule (product):** real kill tier stays; balance only adds effective levels.  
`floor(tokens/100k)` tiers — **5M tokens = +50**. L7 + 300k → **10**; L7 + 5M → **57**.

## 7. Open / follow-ups

1. Map Olympia specialty ids → CL catalog ids for any mismatch (ids 65, 76 unmapped; early farm ants/orcs may need explicit rows).  
2. Wire real on-chain stake ledger (today: persisted `StakedHell` mock on character).  
3. Elite Mobs tab — separate list? (not in specialties.json dump)  
5. Is +hit % on this ladder (not in this tooltip)?  
6. Cap specialty / effective level.

---

## 7. Integrity / production note

Stone of Integrity: **defer** (user: saldrá en unos días para probar).

Necklace drop bug (2026-07-25): separate fix — loot remapper turned gold-rate chances into necklace ids; regenerate loot from Olympia generator.
