# Olympia / Helbreath clásico — parity gap (producción)

**Fecha:** 2026-07-17  
**Alcance:** backlog de gaps vs referencia clásica (Olympia / Helbreath feel) para llevar a **producción**.  
**Fuera de este doc (explícito):** anti-speedhack clásico (LAT walk/run 590/290). Se diseña **después, distinto** — ver § 0.

Leyenda de estado:

| Tag | Significado |
|-----|-------------|
| **DONE** | Usable en stack traveler; polish menor ok |
| **PARTIAL** | Existe pero no 1:1 / frágil / incompleto |
| **GAP** | Ausente o stub sin valor de juego |
| **OURS** | Diferenciador Chain Lord (no clonar Olympia) — no bloquea paridad |
| **DEFER** | Aplazado a propósito |

Prioridad de olas (orden de ship):

1. **P0 — Feel de city** (movimiento, oro, magia, mid-spells)  
2. **P1 — Progresión / loot / mapa**  
3. **P2 — Social / PvP ciudad**  
4. **P3 — Guerra / endgame clásico**  
5. **P4 — Diferenciadores** (guildmaster panel, NFT, torneos…)  

---

## 0. Excluido: anti-speedhack clásico

| Ítem | Estado | Notas |
|------|--------|--------|
| Olympia/3.51 LAT walk (~590 ms / 3 steps) y run (~290 ms / 3 steps) | **DEFER** | No copiar ciego. Idear sistema propio (server-authoritative + fair play) en otro ticket. |
| Nuestro `movementSpeedViolationsChecker` / parálisis por cadence | **PARTIAL / OURS** | Mantener como está hasta el rediseño. **No** es gap de paridad a “cerrar” en esta ola. |

---

## 1. Movimiento y control del avatar (P0)

| Ítem | Estado | Notas / criterio de done |
|------|--------|---------------------------|
| Velocidad run/walk | **DONE** (P0) | Run **260 ms**/tile, walk **×2 = 520 ms**. Traveler force on login; client defaults 260. Anti-speedhack clásico sigue **DEFER**. |
| Click en pared / no-transitable | **DONE** (P0) | No spiral a celda libre lejana; stop sin progreso (GameObject + GameWorld click). Validar city/dungeon en playtest. |
| Hold-LMB sobre bloqueado | **DONE** (P0) | Cancel en vez de re-path thrash. |
| Course correction server (45°) | **DONE** | `Movement.cs` + Settings |
| Run mode toggle | **DONE** | |
| Stunlock / paralysis movement block | **DONE** | |
| Pathfinding A* global | **DEFER** | Clásico es local (dirección + adyacentes). No es gap prioritario. |

---

## 2. Combate melee (P0–P1)

| Ítem | Estado | Notas |
|------|--------|--------|
| Dados de arma Item.cfg | **DONE** | |
| STR / angelic damage | **DONE** | |
| Attack modes / safe attack | **DONE** | |
| Dash attack | **PARTIAL** | Traveler off por default |
| Critical / special hit effects | **PARTIAL** | |
| Armor Break / durability combat | **PARTIAL** | Spell + repair Tom; full Xelima tree no |
| PvP full rules (criminal, neutral, aura) | **PARTIAL** | Citizenship FOE básico |
| EK ledger + ladder + mult top | **GAP** → diseño | [`EK-LEDGER.md`](./EK-LEDGER.md) — P2 |

---

## 3. Magia / book / Magic Tower (P0)

| Ítem | Estado | Notas |
|------|--------|--------|
| Energy Bolt traveler starter | **DONE** | |
| Spells.json combat subset | **PARTIAL** | No catálogo completo Magic.cfg |
| Client spell book / VFX mid-high | **PARTIAL** | |
| Magic Tower Learn/Unlearn UI | **DONE** (P0) | Learn/Unlearn + `learn:N`/`unlearn:N`; book replace (no merge forever); Resync InitialState |
| Learn gasta oro bolsa (persistido) | **DONE** (P0) | Bag no wipe on traveler login; consolidate gold stacks; TrySpendGold |
| Unlearn sin refund | **DONE** (P0) | Server `unlearn:N` + spell directory resync |
| Chill / Para / DS / Heal cast mid-game | **DONE** (P0) | Map Olympia→server; IsSpellAllowed after Learn; timed challenge still adds protocol set |
| Absolute Magic Protect / full CC suite | **PARTIAL** | [`SPELL-CC-AUDIT.md`](./SPELL-CC-AUDIT.md) |
| Mana formula + regen clásico | **PARTIAL** | |

---

## 4. Exp / rebirth / majestics (P0–P1)

| Ítem | Estado | Notas |
|------|--------|--------|
| Curva exp Client-style | **DONE** | |
| GetExp ≤80 boost | **DONE** | |
| Rebirth 0.8^RB + full from 140 | **DONE** | |
| Max L150 + 10 RB ×6 LU (config) | **PARTIAL** | MASTERPLAN menciona L180/RB20 — alinear producto |
| Monster exp factor + soft HitDice | **DONE** | Anclas slime/ant/orc/scorp/clops |
| Special ability exp (anti-magic etc.) | **PARTIAL** | Spawn SA + % exp; combat SA effects incompletos |
| Majestics at cap → gizon | **DONE** | |
| Angel/DK +15 form majestic | **PARTIAL** | MajesticUpgrade angels/DK |
| Kill milestones Frost/Unicorn/RB | **DONE** | OURS-friendly but shipped |

---

## 5. Inventario / oro / items (P0)

| Ítem | Estado | Notas |
|------|--------|--------|
| Bag + equip + gender mismatch | **DONE** | |
| Gold stack id 90 | **DONE** (P0) | Consolidate stacks + no wipe traveler bag on login — playtest confirm |
| Pickup ground / auto gold | **DONE** | |
| Drop to ground | **DONE** | |
| Durability / repair Tom | **DONE** | |
| Consumables pots | **DONE** | |
| Full Item.cfg effects / unique procs | **PARTIAL** | |
| Craft / manufacture / alchemy | **GAP** | P3 |
| Fishing / classic mining skills | **GAP** | HellMining es $HELL (OURS), no skill HB |

---

## 6. NPCs de ciudad / shops (P0–P1)

| Ítem | Estado | Notas |
|------|--------|--------|
| Shop Keeper potions | **DONE** | |
| Tom weapons + repair | **DONE** | |
| William warehouse | **DONE** | |
| Gandalf Magic Tower | **DONE** (P0) | open / learn:N / unlearn:N — playtest Confirm |
| Howard guild interest | **PARTIAL** | No create/join |
| Gail heal/bless/donate | **PARTIAL** | |
| Kennedy city brief | **PARTIAL** | |
| Perry crusade stub | **GAP** | Stub only |
| Full dialogue trees / quests NPC | **GAP** | |
| Guards outdoor (dwell) | **DONE** | |

---

## 7. Mapas / spawn / teleports (P1)

| Ítem | Estado | Notas |
|------|--------|--------|
| Cities Aresden/Elvine + interiors | **DONE** | |
| Traveler zone + city pick citizenship | **PARTIAL** | Login citizen → city (fix 2026-07) — validar |
| Farm / dungeon / huntzone | **PARTIAL** | |
| Spawn pits vs MAPDATA | **PARTIAL** | [`SPAWN-PIT-PARITY.md`](./SPAWN-PIT-PARITY.md) |
| Monster drop tables vs Olympia gen | **PARTIAL** | [`MONSTER-DROP-PARITY.md`](./MONSTER-DROP-PARITY.md) |
| Bleeding island / Heldenian maps | **PARTIAL** maps | Event systems **GAP** |
| Warp / TP pad feel | **PARTIAL** | |

---

## 8. Social / party / guild (P2)

| Ítem | Estado | Notas |
|------|--------|--------|
| Party create/join/leave | **PARTIAL** | MVP |
| Guild create / join / leave | **GAP** | |
| Guild hall full ops | **GAP** | |
| Guild warehouse real | **PARTIAL** | UI dialog existe; backend incompleto |
| **Guildmaster management menu** (tax, ACTIVE TRAINER/KILLER, global voice) | **OURS / DEFER** | Diseño [`GUILDS-AND-LEGACY-AIRDROP.md`](./GUILDS-AND-LEGACY-AIRDROP.md) — **después** de paridad P0–P2 |
| Legacy airdrop guilds | **OURS / DEFER** | |
| Friends list / mail / PM | **GAP** | |
| Chat city / guild / global channels | **PARTIAL** | Chat básico |

---

## 9. Guerra / crusade / Heldenian (P3)

| Ítem | Estado | Notas |
|------|--------|--------|
| Crusade schedule + UI | **GAP** | Stubs / Perry brief |
| Heldenian event loop | **GAP** | Maps present, logic no |
| City construction / structures | **GAP** | |
| War contribution / renown | **GAP** | |

---

## 10. UI / UX Olympia feel (P0–P1)

| Ítem | Estado | Notas |
|------|--------|--------|
| System log carteles 5s TTL | **DONE** | |
| Level-up toast | **DONE** | |
| SELECTCHAR / create char | **PARTIAL** | |
| F5 character / LU set | **PARTIAL** | |
| F6 bag | **DONE** | |
| Minimap / guide | **PARTIAL** | |
| Death / resurrect flow | **PARTIAL** | |
| Disconnect modal spam | **PARTIAL** | Mitigado |
| Landing Olympia shell | **PARTIAL** | landing/ |

---

## 11. Sistemas propios (no son “gaps Olympia”)

Ship separado; no bloquean checklist de paridad:

| Ítem | Doc / estado |
|------|----------------|
| Torneos colosseum + Elo | MASTERPLAN — MVP |
| Build Draft / guest duels | Diseño |
| NFT Rare/Legendary Solana | NFT-OPS-RUNBOOK |
| Timed Challenges | TIMED-CHALLENGES |
| Training Arena | TRAINING-ARENA |
| Beginner Path 1→80 | BEGINNER-PATH-1-80 |
| Auction board | Código MVP |
| $HELL mining | HellMining |
| Anti-bot tools GM | ANTIBOT-AIRDROP |
| **Anti-speedhack propio** | **DEFER** (este doc § 0) |

---

## 12. Ola de producción recomendada (orden de PR)

### Ola P0 — “puedo city-jugar como en Olympia”
1. ~~Validar oro persistido + stacks (sin wipe login).~~ **In progress 2026-07** — no wipe + consolidate.  
2. ~~Magic Tower Learn/Unlearn E2E~~ **In progress** — `learn:N` + ResyncTravelerSpells via InitialState.  
3. ~~Movimiento pared~~ + run **260 ms** (walk 520). Validar en city.  
4. Spells CC — combat spells unlock via Magic Tower map (Chill 45→3, Para 35→27, DS 13→32…).  

### Ola P1 — “progresión y mapa”
5. Exp mid/high anchors (skeleton, hellbound, ettin…) con samples live.  
6. Spawn-pit + drop parity tickets abiertos.  
7. Warehouse / shop edge cases.  
8. Citizenship login always correct city.  

### Ola P2 — “social PvP”
9. Party polish.  
10. Guild create/join mínimo (sin menú GM full).  
11. EK ledger MVP.  
12. Chat channels.  

### Ola P3 — “guerra”
13. Crusade/Heldenian design → implement.  

### Ola P4 — “Chain Lord”
14. Guildmaster management menu.  
15. Legacy airdrop.  
16. Torneos / NFT polish.  

---

## 13. Criterio “listo para prod” por gap

Un gap **PARTIAL/GAP** se marca **DONE** cuando:

- [ ] Server + client en `main` (o release branch)  
- [ ] Traveler mode no regresa  
- [ ] Persistencia (`.traveler.json` / DB) correcta tras relog  
- [ ] Nota corta en [`BITACORA.md`](./BITACORA.md)  
- [ ] Si aplica: fila en SPAWN-PIT / MONSTER-DROP / SPELL-CC  

---

## 14. Changelog de este doc

| Fecha | Cambio |
|-------|--------|
| 2026-07-17 | Creación: escaneo gaps + olas P0–P4; anti-speedhack **excluido** (diseño propio posterior). |
