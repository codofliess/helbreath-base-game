# Combat matrix FULL (theory EV) — 100% monsters

Philosophy: **Olympia feel first** + thin Nemesis/CL — `docs/qa/OLYMPIA-NEMESIS-MERGE.md`.

- Monsters: **75**
- Matrix rows: **3300** (magic×7 + phys×8 + defense×7) × (L0+L50)
- Blizzard dice: 7d8+16 mult=1.0
- Caster mock: Mag=150 Str=120 Dex=80
- FAILs: **0**

---

## Stack reference (independent of mob)

| Mage loadout | EV raw |
|--------------|-------:|
| bare (HR+0) | 69.1 |
| MS20 (HR+0) | 69.1 |
| MS22_HR50 (HR+50) | 69.1 |
| MS22_HR91 (HR+91) | 69.1 |
| ZW20 (HR+0) | 86.4 |
| ZW20_HeroMage (HR+0) | 91.4 |
| bare_HeroMage (HR+0) | 73.1 |

| War loadout | EV raw |
|-------------|-------:|
| bare_hand | 13.0 |
| LongSword+2 | 8.7 |
| GiantSword | 18.6 |
| GS_Hero | 23.6 |
| GS_Hero_NOX | 23.6 |
| GS_Hero_NOX_Xelima7 | 30.6 |
| GS_Hero_NOX_Abaddon17 | 40.6 |
| GS_full_upg10 | 50.6 |

Jewelry: NOX=HR100, Ring Xelima=+7 phys, Abaddon=+10 phys. Gold Carp is fishing consumable (not AP).
Merien +N on defense = **PA% proxy** (illustrative; live Merien is upgrade/durability path).

---

## Per-monster snapshot (key columns)

Columns: bare Blizz L0/L50 after | ZW+Hero L50 | GS full jewelry L50 | naked taken L0 | PA50 Merien10 L0 | PA80 L0 | drop× L50

| ID | Name | Gen | HP | AtkMid | BlizzL0 | BlizzL50 | ZWHeroL50 | GSFullL50 | NakedInL0 | Merien10InL0 | PA80InL0 | Drop×L50 |
|---:|------|----:|---:|-------:|--------:|---------:|----------:|----------:|----------:|-------------:|---------:|---------:|
| 0 | Ettin | 10 | 1376 | 40 | 69 | 70 | 92 | 52 | 40 | 20 | 8 | 1.529 |
| 1 | Slime | 1 | 7 | 2 | 69 | 70 | 92 | 52 | 2 | 1 | 1 | 1.529 |
| 2 | Ant | 1 | 11 | 4 | 69 | 70 | 92 | 52 | 4 | 2 | 1 | 1.529 |
| 3 | Snake | 1 | 14 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.529 |
| 4 | Armored Battle Steed | — | 0 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.524 |
| 5 | Dragon | 7 | 2751 | 50 | 69 | 71 | 94 | 53 | 50 | 25 | 10 | 1.519 |
| 6 | Bunny | — | 14 | 3 | 69 | 70 | 92 | 52 | 3 | 2 | 1 | 1.534 |
| 7 | Beholder | 5 | 551 | 36 | 69 | 70 | 93 | 52 | 36 | 18 | 8 | 1.524 |
| 8 | Battle Golem | — | 0 | 5 | 69 | 70 | 93 | 52 | 5 | 3 | 1 | 1.524 |
| 9 | Cannibal Plant | 5 | 578 | 36 | 69 | 70 | 93 | 52 | 36 | 18 | 8 | 1.524 |
| 10 | Cat | — | 14 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.534 |
| 11 | Centaurus | 7 | 1926 | 72 | 69 | 70 | 92 | 52 | 72 | 36 | 15 | 1.524 |
| 12 | Clay Golem | 3 | 166 | 18 | 69 | 70 | 92 | 52 | 18 | 9 | 4 | 1.524 |
| 13 | Claw Turtle | 5 | 661 | 40 | 69 | 70 | 93 | 52 | 40 | 20 | 8 | 1.524 |
| 14 | Cyclops | 5 | 331 | 28 | 69 | 70 | 92 | 52 | 28 | 14 | 6 | 1.529 |
| 15 | Dark Elf | 6 | 771 | 20 | 69 | 70 | 92 | 52 | 20 | 10 | 4 | 1.529 |
| 16 | Elf Master | — | 0 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.534 |
| 17 | Dark Shadow Knight | — | 0 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.524 |
| 18 | Demon | 8 | 1871 | 55 | 69 | 70 | 92 | 52 | 55 | 28 | 11 | 1.524 |
| 19 | Detector | — | 0 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.534 |
| 20 | Frost | 7 | 716 | 28 | 69 | 70 | 92 | 52 | 28 | 14 | 6 | 1.529 |
| 21 | Gargoyle | 8 | 2201 | 72 | 69 | 70 | 93 | 52 | 72 | 36 | 15 | 1.524 |
| 22 | God's Hand Knight | — | 0 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.534 |
| 23 | God's Hand Knight on Armored Battle Steed | — | 0 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.524 |
| 24 | Giant Cray Fish | 5 | 386 | 28 | 69 | 70 | 93 | 52 | 28 | 14 | 6 | 1.524 |
| 25 | Giant Frog | 5 | 193 | 21 | 69 | 70 | 93 | 52 | 21 | 11 | 5 | 1.524 |
| 26 | Giant Lizard | 10 | 2476 | 55 | 69 | 70 | 92 | 52 | 55 | 28 | 11 | 1.524 |
| 27 | Giant Tree | 5 | 551 | 28 | 69 | 70 | 93 | 52 | 28 | 14 | 6 | 1.524 |
| 28 | Stone Golem | 3 | 138 | 18 | 69 | 70 | 93 | 52 | 18 | 9 | 4 | 1.524 |
| 29 | Arrow Guard Tower | — | 0 | 5 | 69 | 70 | 93 | 52 | 5 | 3 | 1 | 1.529 |
| 30 | Cannon Guard Tower | — | 0 | 5 | 69 | 70 | 93 | 52 | 5 | 3 | 1 | 1.524 |
| 31 | Guard | — | 1926 | 54 | 69 | 70 | 93 | 52 | 54 | 27 | 11 | 1.524 |
| 32 | Hellhound | 4 | 193 | 21 | 69 | 70 | 93 | 52 | 21 | 11 | 5 | 1.524 |
| 33 | Hellclaw | 8 | 5501 | 112 | 69 | 70 | 93 | 52 | 112 | 56 | 23 | 1.524 |
| 34 | Ice Golem | 6 | 468 | 28 | 69 | 70 | 92 | 52 | 28 | 14 | 6 | 1.529 |
| 35 | Light War Beetle | — | 0 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.529 |
| 36 | Master Mage Orc | 10 | 1376 | 32 | 69 | 70 | 92 | 52 | 32 | 16 | 7 | 1.524 |
| 37 | Minotaur | 6 | 1871 | 78 | 69 | 70 | 92 | 52 | 78 | 39 | 16 | 1.524 |
| 38 | Mountain Giant | 9 | 551 | 32 | 69 | 70 | 92 | 52 | 32 | 16 | 7 | 1.524 |
| 39 | Nizie | 7 | 1541 | 55 | 69 | 70 | 92 | 52 | 55 | 28 | 11 | 1.524 |
| 40 | Orc | 2 | 14 | 6 | 69 | 70 | 92 | 52 | 6 | 3 | 2 | 1.529 |
| 41 | Dire Boar | 5 | 716 | 36 | 69 | 70 | 92 | 52 | 36 | 18 | 8 | 1.529 |
| 42 | Training Dummy | — | 0 | 5 | 69 | 70 | 92 | 52 | 5 | 3 | 1 | 1.534 |
| 43 | Fire Wyvern | 8 | 16501 | 128 | 69 | 70 | 93 | 52 | 128 | 64 | 26 | 1.524 |
| 44 | Wyvern | 8 | 13751 | 128 | 69 | 70 | 93 | 52 | 128 | 64 | 26 | 1.524 |
| 45 | Ugly Wyvern | — | 0 | 5 | 69 | 70 | 93 | 52 | 5 | 3 | 1 | 1.524 |
| 46 | Lich | 7 | 716 | 28 | 69 | 70 | 92 | 52 | 28 | 14 | 6 | 1.529 |
| 47 | Ogre | 6 | 633 | 32 | 69 | 70 | 92 | 52 | 32 | 16 | 7 | 1.524 |
| 48 | Rudolph | — | 221 | 21 | 69 | 70 | 93 | 52 | 21 | 11 | 5 | 1.524 |
| 49 | Scarecrow | — | 14 | 6 | 69 | 70 | 92 | 52 | 6 | 3 | 2 | 1.534 |
| 50 | Scorpion | 2 | 34 | 10 | 69 | 70 | 92 | 52 | 10 | 5 | 2 | 1.529 |
| 51 | Skeleton | 2 | 45 | 12 | 69 | 70 | 92 | 52 | 12 | 6 | 3 | 1.529 |
| 52 | Sorceress | — | 100 | 15 | 69 | 70 | 93 | 52 | 15 | 8 | 3 | 1.524 |
| 53 | Stalker | 6 | 716 | 40 | 69 | 70 | 93 | 52 | 40 | 20 | 8 | 1.529 |
| 54 | Tentocle | — | 441 | 24 | 69 | 70 | 93 | 52 | 24 | 12 | 5 | 1.524 |
| 55 | Tigerworm | 8 | 11001 | 112 | 69 | 71 | 94 | 53 | 112 | 56 | 23 | 1.519 |
| 56 | Temple Knight | — | 0 | 5 | 69 | 70 | 93 | 52 | 5 | 3 | 1 | 1.524 |
| 57 | Ancient Temple Knight | — | 0 | 5 | 69 | 70 | 93 | 52 | 5 | 3 | 1 | 1.524 |
| 58 | Troll | 5 | 303 | 24 | 69 | 70 | 93 | 52 | 24 | 12 | 5 | 1.524 |
| 59 | Unicorn | 8 | 1871 | 55 | 69 | 70 | 92 | 52 | 55 | 28 | 11 | 1.524 |
| 60 | Werewolf | 6 | 771 | 36 | 69 | 70 | 92 | 52 | 36 | 18 | 8 | 1.524 |
| 61 | Zombie | 2 | 56 | 10 | 69 | 70 | 93 | 52 | 10 | 5 | 2 | 1.524 |
| 62 | Mercenary Warrior | — | 0 | 5 | 69 | 70 | 93 | 52 | 5 | 3 | 1 | 1.529 |
| 63 | Mercenary Mage | — | 0 | 5 | 69 | 70 | 93 | 52 | 5 | 3 | 1 | 1.524 |
| 64 | Abaddon (incomplete) | 10 | 82501 | 171 | 69 | 71 | 94 | 53 | 171 | 86 | 35 | 1.519 |
| 100 | Academy Recruit | — | 2200 | 30 | 69 | 70 | 92 | 52 | 30 | 15 | 6 | 1.529 |
| 101 | Academy Adept | — | 2800 | 45 | 69 | 70 | 92 | 52 | 45 | 23 | 9 | 1.529 |
| 102 | Academy Veteran | — | 4200 | 70 | 69 | 70 | 92 | 52 | 70 | 35 | 14 | 1.524 |
| 103 | Academy Elite Contender | — | 6500 | 102 | 69 | 70 | 92 | 52 | 102 | 51 | 21 | 1.524 |
| 110 | Earth Dragon | 7 | 18500 | 200 | 69 | 71 | 94 | 53 | 200 | 100 | 40 | 1.519 |
| 111 | Illusion Dragon | 8 | 18500 | 200 | 69 | 71 | 94 | 53 | 200 | 100 | 40 | 1.519 |
| 112 | Lightning Dragon | 8 | 18500 | 200 | 69 | 71 | 94 | 53 | 200 | 100 | 40 | 1.519 |
| 113 | Poison Dragon | 9 | 18500 | 200 | 69 | 71 | 94 | 53 | 200 | 100 | 40 | 1.519 |
| 114 | Black Dragon | 8 | 42000 | 264 | 69 | 71 | 94 | 53 | 264 | 132 | 53 | 1.519 |
| 9901 | Goblin | 2 | 320 | 8 | 69 | 70 | 92 | 52 | 8 | 4 | 2 | 1.529 |

---

## Coherence FAIL checks

_No matrix FAILs — specialty monotonic, ZW/Hero/rings, PA, threat ladder OK._

---

## How to read

- **Outbound after specialty**: higher = better for player (L50 should ≥ L0).
- **Inbound taken**: lower = better for player (armor/PA/Merien/specialty).
- Full row dump: sibling CSV `combat-matrix-full.csv` next to this report.
- Live Playwright: deferred — `docs/qa/PLAYWRIGHT-DEFERRED.md`.
