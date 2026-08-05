# Combat audit report (gross errors)

- FAILs: **0**
- Total findings: 16

## FAIL

_None — catalog/specialty/magic/PA-MA basic invariants OK._

## WARN / INFO

- `INFO` **[catalog]** Weapons=137 Monsters=75 Spells=54 SpecialtyDefs=75
- `WARN` **[loot]** 26 non-gen NPC/tower/dummy empty loot (ok if intentional): Armored Battle Steed(4), Bunny(6), Battle Golem(8), Cat(10), Elf Master(16), Dark Shadow Knight(17), Detector(19), God's Hand Knight(22), God's Hand Knight on Armored Battle Steed(23), Arrow Guard Tower(29), Cannon Guard Tower(30), Guard(31)…
- `INFO` **[specialty-sample]** L0→L25 sample (base hit 100):
- `INFO` **[specialty-sample]**   Orc(40): out 100→101 | taken 100→99 | drop× 1.00→1.36 | hit+0 | base_kills=125
- `INFO` **[specialty-sample]**   Demon(18): out 100→101 | taken 100→99 | drop× 1.00→1.35 | hit+2 | base_kills=12
- `INFO` **[specialty-sample]**   Frost(20): out 100→101 | taken 100→99 | drop× 1.00→1.36 | hit+0 | base_kills=25
- `INFO` **[specialty-sample]**   Hellclaw(33): out 100→102 | taken 100→98 | drop× 1.00→1.35 | hit+2 | base_kills=6
- `INFO` **[specialty-sample]**   Tigerworm(55): out 100→103 | taken 100→99 | drop× 1.00→1.34 | hit+2 | base_kills=3
- `INFO` **[specialty-sample]**   Earth Dragon(110): out 100→103 | taken 100→99 | drop× 1.00→1.34 | hit+2 | base_kills=3
- `INFO` **[specialty-sample]**   Gargoyle(21): out 100→102 | taken 100→98 | drop× 1.00→1.35 | hit+2 | base_kills=6
- `INFO` **[magic]** Energy Bolt EV Mag10=6.2 Mag200=9.6 (ok scales)
- `INFO` **[magic]** Blizzard EV Mag150≈69.1 (dice=7d8+16)
- `INFO` **[mitigation]** PA samples: 0%→100 20%→80 50%→50 80%→20
- `INFO` **[mitigation]** MA samples: 0%→100 20%→80 50%→50 80%→20
- `INFO` **[hit]** Melee hit gen5 dex50: 69% → +10spec 79%
- `INFO` **[cash]** Stat Change Ticket is free (0/0) — ok

## How this maps to play

| Theory (this script) | Practice (Playwright / human) |
|----------------------|-------------------------------|
| Specialty out/in/drop L0→L25 | Kill same mob L0 vs L25 char; compare float dmg + loot |
| Magic EV scales with Mag | Cast EB Mag10 vs Mag200 dummy |
| PA/MA reduce damage | Equip PA/MA gear; compare taken |
| Debow/MS22 in tables | Live drop farm or GM loot inject |
| Free stat ticket | Cash shop buy → consume → stats 10 |
