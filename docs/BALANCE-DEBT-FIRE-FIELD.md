# Balance debt — Fire Field / ground ticks (KEEP HIGH FOR NOW)

**Status:** intentionally **overtuned** until big-mob drop testing is finished.  
**Created:** 2026-07-28  
**Reminder task:** Grok scheduled `nerf-fire-field-damage` (weekly Mon 11:00 America/Argentina/Buenos_Aires) — id `4289ca8f-1ef2-418a-83ac-d3047f2ca782`

## Symptom
A single Fire Field tick can hit ~**250 HP** (or full-glass a high-Mag mage). That lets mages melt large bosses too fast and skews drop testing time.

## Why leave it
PO wants farm speed while validating **big mob drops** (Hellclaw / pits / rares). Do **not** nerf until that pass is done.

## Where it lives
- Config: `multiplayer/server/Config/Spells.json` — **Fire Field** `id: 8` (`damageType: 4` GroundEffect, `tickRate: 1000`, dice `2d8+0`)
- Roll: every ground cell snapshots `PlayerDerivedStats.RollMagicDamage(caster, spell)` at cast (`Casting.ApplyGroundEffectSpell`)
- Formula: dice + Mag scale (`Mag/3.3` %) + equipped Magical Damage (`PlayerDerivedStats.RollMagicDamage`)

## When testing is done — nerf plan
1. Prefer a **ground-only factor** (e.g. 25–40% of full magic roll) so ES/MFS stay intact.
2. Or lower ground spell dice only (Fire Field / Poison / Spike Field / Ice Storm).
3. Target ballpark: hazard ticks ~**30–80** for mid–high Mag, not boss-erasure.
4. Deploy server; sanity-check boss TTK vs direct spells.

## Do not
- Leave full Mag scaling on ground ticks for public live balance.
- Nerf direct spell DPS as a side effect of this debt.
