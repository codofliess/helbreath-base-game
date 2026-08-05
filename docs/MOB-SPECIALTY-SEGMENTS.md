# Mob Specialty — segment base_kills (Chain Lords)

**Fecha:** 2026-07-31 (invertido: rare = pocos kills, farm = muchos)  
**Fórmula (Olympia):** `killsRequired(L) = base_kills × L²`  
**Stake:** `effective = real + floor(stakedHell / 100_000)`

---

## 1. Principio (Olympia + PO)

Los bichos **raros / endgame** suben de specialty con **pocos kills** (compensan spawn).  
Los bichos de **farm denso** (orcos, slime…) piden **muchos kills** por tier.

Ejemplo PO:

| | base | L1 | L2 (≈ “pasar a tier 2”) |
|--|-----:|---:|------------------------:|
| **Tigerworm** | 3 | 3 | **12** (~10) |
| **Orc** | 125 | 125 | **500** |

---

## 2. Olympia (referencia)

`specialties.json`: bases 20–150. Unicorn/Hellhound **20** (barato); Demon **100**; open-world Orc UI **150** (caro).  
No es “más difícil de matar ⇒ más kills de specialty”.

---

## 3. Segmentos CL (invertidos)

| Segmento | base | L2 | Contenido |
|----------|-----:|---:|-----------|
| **apex_tw** | **3** | 12 | Tigerworm, Dragons, Abaddon |
| **apex_hc** | **6** | 24 | Hellclaw, Gargoyle, Wyverns · *(Giant Unicorn)* |
| **high_demon** | **12** | 48 | Demon, Unicorn, MG, Nizie, Centaurus, Minotaur… |
| **mid_frost** | **25** | 100 | Frost, Ettin, Lich, Dark Elf, Ice Golem… |
| **mid_ww** | **50** | 200 | Werewolf, Ogre |
| **low** | **75** | 300 | Golems, Scorpion, Troll, mid-farm… |
| **early** | **125** | **500** | **Orc**, Slime, Ant, Snake, Zombie, Goblin… |

Default unlisted: **75**.

Cadena ≈ ×2 de TW hacia early (3→6→12→25→50→75→125).

---

## 4. Tabla rápida L1 / L5 / L10

| L | TW 3 | HC 6 | Demon 12 | Frost 25 | WW 50 | Low 75 | Orc 125 |
|--:|-----:|-----:|---------:|---------:|------:|-------:|--------:|
| 1 | 3 | 6 | 12 | 25 | 50 | 75 | 125 |
| 2 | 12 | 24 | 48 | 100 | 200 | 300 | 500 |
| 5 | 75 | 150 | 300 | 625 | 1250 | 1875 | 3125 |
| 10 | 300 | 600 | 1200 | 2500 | 5000 | 7500 | 12500 |

---

## 5. Archivos

- `multiplayer/server/Config/MobSpecialties.json`
- `Helpers/MobSpecialty.cs` (DefaultBaseKills = 75)
