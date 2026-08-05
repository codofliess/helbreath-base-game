# Olympia item magic affixes (primary / secondary / color)

> Chain Lords port: `OlympiaMagicRoll.cs` + `OlympiaItemName.ts` + `ItemMagicAttribute.cs`.  
> **Named rares/legendaries drop PURE** (no Sharp/HR/Exp) — see `MonsterLoot.IsPureRareDrop`.

## 1. Quality tier + **flat base damage** (physical weapons)

Vanilla client tooltip `Damage+value×7` for Sharp is a **display quirk** — CL does **not** use that.

Quality classifies the **base damage tier** (dual magic / high nibble only **labels** Exceptional; the player meaning is the damage):

| Quality | How classified | Flat base (no Sharp/Ancient) |
|---------|----------------|------------------------------|
| **Common** | `itemAttribute == 0` | +0 |
| **Superior** | single magic, primary value ≤ 6 | **+1** |
| **Exceptional** | dual magic **or** primary value ≥ 7 | **+2** quality base |

Then Sharp / Ancient stack on quality (**Sharp = Ancient − 1** at same tier):

| Name | Base damage |
|------|-------------|
| Superior *(any non-Sharp/Ancient physical)* | **+1** |
| Superior **Sharp** | **+2** |
| Exceptional **Sharp** | **+3** |
| Superior **Ancient** | **+3** |
| Exceptional **Ancient** | **+4** |

Formula: `qualityBase (1 or 2) + Sharp(+1) / Ancient(+2)`.

## 2. Weapon primary (bits 20–23) + **item color**

Olympia dice → type + `m_cItemColor` (Client palette 1–8):

| Dice band | Primary type | Name prefix | Color id | Effect (summary) |
|-----------|--------------|-------------|----------|------------------|
| 1–299 | **6 Light** | Light | 2 | Weight−, full swing less Str + quality base dmg |
| 300–999 | **8 Sharp** | Sharp | 3 | Flat base Damage (see §1) — **not** value×7 |
| 1000–2499 | **1 Critical** | Critical | 5 | Crit hit damage +value + quality base |
| 2500–4499 | **5 Agile** | Agile | 1 | Attack speed −1 + quality base |
| 4500–6499 | **3 Righteous** | Righteous (“Right”) | 7 | Name/color + quality base |
| 6500–8099 | **2 Poisoning** | Poisoning | 4 | Poison dmg **20%–70%** + quality base |
| 8100–9699 | **7 Ancient** | Ancient | 6 | Flat base Damage = Sharp+1 at same quality |
| 9700–10000 | **9 Casting Prob** | Casting Prob. | 8 | Casting Probability +value |

**Type 4 Strong = never rolled** (disabled for weapons on this server).

## 3. Weapon / wand secondary (bits 12–15) — ~40%+ by gen

Olympia secondary dice (weapons + wands):

| Dice band | Secondary type | Display | Notes |
|-----------|----------------|---------|--------|
| 1–4999 | **2 Hit Prob** | Hitting Probability +1..+7 ×7 | HR |
| 5000–8499 | **10 CAD** | Consecutive Attack Damage +1..+7 | flat combo dmg |
| 8500–9499 | **12 Gold** | Gold +value×10% | gold-find; some servers call this “Rep” |
| 9500–10000 | **11 Exp** | Experience +value×10% | |

**Product rule:** all four secondary stats are clamped to **+1..+7** after gen scaling.

## 4. Wands (effect type 13 ATTACK_MANASAVE)

| Layer | Content |
|-------|---------|
| Catalog base | **MS0 / MS10 / MS20 / MS22** from item name (`CatalogManaSavePercent`) |
| Magic primary | **Casting Prob (9, color 8)** · **HP Vamp (4, color 5)** · **MP Vamp (6, color 1)** |
| Magic secondary | HR / CAD / Exp / Gold(Rep) **+1..+7** only |
| Charge wands 1314–16 | Pure catalog charges 200/200 — **no** Sharp/HR roll |
| Berserk/Kloness wands | Pure rares — no magic roll |

> Melee type 4 Strong is disabled; type 4/6 on **wands only** mean HP/MP Vamp.  
> Base MS% is independent of magic primary (product rule).

## 5. Armor / shield primary & secondary

See `ItemMagicAttribute` — Endurance(8)/Light(6)/ManaConv(11)/ChargeCrit(12) primary; full defense secondary set (PA allowed on body, **not** on shields).

## 6. Rares = pure

| Rule | Implementation |
|------|----------------|
| No Sharp / Ancient / Agile / dual magic / HR / Exp | `MonsterLoot.IsPureRareDrop` → skip `OlympiaMagicRoll` |
| Applies to | Berserk/Kloness/Blood/Giant BH/Barbarian/manuals/MS22 charge/SuperRare list |

## 7. Gen scaling (harder mob → better stated)

`ScaleAttributeValueForGen` + higher dual-magic rate for gen 5–10 (Hellclaw/TW/Demon/Ettin).  
Weapon secondary still clamped to 1–7 after scale.

## 8. Equip application (server)

| Affix | Where |
|-------|--------|
| Sharp / Ancient / quality | `WeaponQualityBaseDamage` → flat melee base (Sup +1… Exc Ancient +4) |
| Agile | `AttackSpeedMs` −80ms |
| Poisoning | +20–70% of physical as poison contribution |
| Casting Prob | `MagicCastSuccess` flat % |
| HR secondary | `HitRatio` |
| CAD secondary | combo damage |
| Exp / Gold | kill exp / gold drop % |
| Wand MS base | `ManaSavePercent` from catalog name |
| Wand HP/MP Vamp | `HpRegenPercent` / `MpRegenPercent` |

## 9. Files

| File | Role |
|------|------|
| `Helpers/OlympiaMagicRoll.cs` | Dice + color |
| `Helpers/ItemMagicAttribute.cs` | Equip bonuses |
| `mp-client/.../OlympiaItemName.ts` | Name/tooltip/color |
| `Helpers/MonsterLoot.cs` | When to roll vs pure rare |
