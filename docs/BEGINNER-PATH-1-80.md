# Beginner Path 1→80 — guided training (optional)

> Diseño + contrato MVP.  
> Estado: **Tiers A–E live (hard)** (2026-07-11) — sin soft gates en el catálogo.  
> Producto: **Helbreath Chain Lord** (marca corta: **Chain Lord**).  
> No brand Olympia — training “inspired-by” clásico / Chain Lord.

---

## 1. Objetivo

Un **camino opcional** de quests guiadas (nivel 1→80) que enseña exploración, farm, barracks y protocolos de ataque a jugadores que no saben cómo jugar.

| Regla | Detalle |
|-------|---------|
| **Opcional** | El jugador puede ignorar el path y farmear / PvP normalmente. |
| **Abandonar sin pena** | `Abandon` limpia la quest activa y **no** bloquea juego, XP, mundos ni ítems. |
| **Re-enrolar** | Hablar con Enzu (farm) permite volver a enrolarse si se abandonó. |
| **No rated** | Kills de training/dummies/mercs **no** son Elo; solo XP de monstruo normal. |

Relacionado: [`TRAINING-ARENA.md`](./TRAINING-ARENA.md) (mapa `training` + tip protocols), barracks en farm (§ 5).

---

## 2. Arquitectura (paths reales)

```
docs/BEGINNER-PATH-1-80.md          ← este doc
multiplayer/server/Config/BeginnerPath.json
multiplayer/server/Helpers/BeginnerPath.cs
multiplayer/server/Helpers/Party.cs   (create/join/leave mínimo)
PlayerPersistenceState.BeginnerPath  (state_json)
proto: BeginnerPathEnroll/Abandon/Talk/UiAction + BeginnerPathState
proto: CreateParty/JoinParty/LeaveParty + PartyState
mp-client: BeginnerPath.store + CharacterDialog QuestPanel / PartyPanel
mp-client: constants/BeginnerPathQuests.ts (hints espejo)
Farm: arefarm / elvfarm → NPCs + dwellAreas (dummies + mercs)
Howard (catalog 2): CityNpcServices.register_guild_interest → guild flag + quest
```

---

## 3. Persistencia (flags)

En `state_json` vía `PlayerPersistenceState.BeginnerPath`:

| Campo | Significado |
|-------|-------------|
| `enrolled` | Jugador aceptó el path al menos una vez |
| `abandoned` | Abandonó el path activo; juego libre |
| `activeQuestId` | Quest en curso (`null` si idle / abandonado / completó todo) |
| `progress` | Contador hacia el objetivo de la quest activa |
| `completedQuestIds` | Quests terminadas (orden de completado) |

También: `GuildInterestRegistered` (Howard) en persistence del personaje — flag de interés guild, no sistema de guild completo.

**Abandon:** `abandoned=true`, `activeQuestId=null`, `progress=0`. Completadas se **conservan** (no se borra progreso histórico). No hay cooldown ni multa.

---

## 4. Catálogo de quests (1→80)

IDs estables.  
`status`: `live` = server avanza.  
**Gate:** `hard` = acción de mundo real verificable en server.

### Tier A — Farm basics (1–10) · **live (hard)**

| id | Nivel guía | Objetivo | Hint (ES) | Gate |
|----|------------|----------|-----------|------|
| `bp_enroll` | 1 | Enrolarse con Enzu | Hablá con Enzu en el farm y aceptá el entrenamiento. | hard · enroll |
| `bp_slime_5` | 1–5 | Matar 5 Slimes | Al sur del farm hay Slimes. Matá 5 y volvé. | hard · kill |
| `bp_dummy_3` | 5–8 | Matar 3 Training Dummy | Barracks de dummies (Shift+F10 → Farm Barracks). | hard · kill |
| `bp_visit_city` | 8–10 | Visitar ciudad (aresden/elvine) | Portal del farm → ciudad. | hard · visit |

### Tier B — Barracks + CC intro (11–20) · **live (hard)**

| id | Nivel guía | Objetivo | Hint (ES) | Gate |
|----|------------|----------|-----------|------|
| `bp_merc_war_1` | 11–14 | Matar 1 Mercenary Warrior | Barracks mercs: chase tipo jugador. | hard · kill |
| `bp_merc_mage_1` | 14–17 | Matar 1 Mercenary Mage | Chill + Energy Bolt; Chill primero antes de commit. | hard · kill |
| `bp_cc_protocol` | 17–20 | Hablar con Merc Captain | Chill → Paralyze → PFA/DS (negar PFM si tenés esos spells). | hard · talk |

### Tier C — Hunt / mid (21–40) · **live (hard)**

| id | Nivel guía | Objetivo | Gate | Notas |
|----|------------|----------|------|-------|
| `bp_huntzone_intro` | 21–25 | Visitar huntzone1–4 | **hard** · visit | Huntzones aún sin dwellAreas; el gate es llegar al mapa. |
| `bp_party_hint` | 25–30 | Create o Join party | **hard** · `create_or_join_party` | F5 → Party → Create / Join por código. |
| `bp_potions` | 30–35 | Comprar poción (Shop Keeper) | **hard** · buy_item | areshop / elvshop, ítems 91–96. |
| `bp_mid_farm` | 35–40 | Matar 5 Clay Golems | **hard** · kill | Mid routes / afueras de ciudad. |

### Tier D — Dungeon / war prep (41–60) · **live (hard)**

| id | Nivel guía | Objetivo | Gate | Notas |
|----|------------|----------|------|-------|
| `bp_dungeon_gate` | 41–45 | Entrar dungeon ciudad | **hard** · visit | `aresdend1` / `elvined1`. |
| `bp_lize_drill` | 45–50 | Entrar mundo `training` | **hard** · visit | Tips Arena en Shift+F10 (freeze → Lize). |
| `bp_ek_awareness` | 50–55 | 10 mob kills + hint EK (±10) | **hard** · `mob_kills` | EK ledger aún diseño ([`EK-LEDGER.md`](./EK-LEDGER.md)); milestone de farm mientras se enseña la regla. |
| `bp_guild_hint` | 55–60 | Howard → Register guild interest | **hard** · talk_npc (2) | Flag `GuildInterestRegistered`; no inventa guild completo. |

### Tier E — Capstone (61–80) · **live (hard)**

| id | Nivel guía | Objetivo | Gate | Notas |
|----|------------|----------|------|-------|
| `bp_middleland` | 61–70 | Visitar Middleland / Promiseland | **hard** · visit | Riesgo PvP open-world. |
| `bp_training_preset` | 70–75 | ApplyPreset Arena OK | **hard** · `apply_training_preset` | Shift+F10 → Apply en mundo `training`; server debe spawnear ≥1 dummy. |
| `bp_path_complete` | 75–80 | Hablar con Enzu | **hard** · talk | Cierre del path 1→80. |

### Soft gates

Ninguno en el catálogo live. `BeginnerPathUiActionRequest` queda para gates futuros que no se puedan verificar en server.

---

## 5. Farm barracks (ambos en el mapa farm)

No usan el mapa `arebrk11` vacío como contenido principal: las zonas viven en **`arefarm` / `elvfarm`**.

| Barracks | Monstruos | Comportamiento | XP |
|----------|-----------|----------------|----|
| **Dummy** | `Training Dummy` (catalog 42) | Estático / sin chase (practice hits) | Sí (`HandleMonsterKilled`) |
| **Mercenary** | `Mercenary Warrior` (62), `Mercenary Mage` (63) | Chase alto tipo jugador; mage con Chill Wind + Energy Bolt | Sí |

NPCs de farm:

| Catalog id | Nombre | Rol |
|------------|--------|-----|
| 11 | Enzu | Quest giver / enroll / re-enroll / path complete |
| 12 | Drillmaster | Tip sheet dummies |
| 13 | Merc Captain | Tip sheet CC / chase mercs |

Tip protocols (mismo patrón que Training Arena): ver `TrainingPresets.ts` sección farm barracks + [`TRAINING-ARENA.md`](./TRAINING-ARENA.md) § 6.

### Protocolo de ataque (Merc / PvP practice)

Orden sugerido (extensible):

1. **Chill Wind** primero (slow)
2. **Paralyze** (lock)
3. **PFA / DS** para negar PFM enemigo (**solo** cuando el char ya tenga esos spells; si no, saltear)
4. Burst / kite según rol; re-Chill al romper el lock

Merc Mage (catalog 63) castea **Chill Wind** + **Energy Bolt** (probs moderadas) para practicar kite de cast line tipo mago Olympia, sin kit full player.

---

## 6. Red (proto)

| Mensaje | Dirección | Uso |
|---------|-----------|-----|
| `BeginnerPathEnrollRequest` | C→S | Enrolarse / re-enrolarse |
| `BeginnerPathAbandonRequest` | C→S | Abandonar sin pena |
| `BeginnerPathTalkRequest` | C→S | Talk NPC (Enzu / Captain / etc.) |
| `BeginnerPathUiActionRequest` | C→S | Soft gates futuros (ninguno live) |
| `BeginnerPathState` | S→C | Snapshot (join + cada cambio) |
| `CreatePartyRequest` / `JoinPartyRequest` / `LeavePartyRequest` | C→S | Party mínimo (código) |
| `PartyState` | S→C | Snapshot party |
| `ApplyTrainingPresetRequest` | C→S | Arena Apply → credits `apply_training_preset` si OK |
| `CityNpcServiceRequest` (`register_guild_interest`) | C→S | Howard → flag + `bp_guild_hint` |

Avance de kills: hook en `Progression.HandleMonsterKilled` → `BeginnerPath.OnMonsterKilled` (incluye `mob_kills`).  
Avance de mundos: hook en spawn/world enter → `BeginnerPath.OnWorldEntered`.  
Compras shop: `Shop.HandleBuyShopItemRequest` → `BeginnerPath.OnShopItemPurchased`.  
Party: `Party.HandleCreate/Join` → `BeginnerPath.OnPartyJoinedOrCreated`.  
Guild: `CityNpcServices` register → `BeginnerPath.OnGuildHallInterest`.  
Arena: `TrainingArena` Apply OK → `BeginnerPath.OnTrainingPresetApplied`.

---

## 7. UI

| Pieza | Rol |
|-------|-----|
| F5 → Quest | Estado del path, hint, progreso, **Abandon** / **Enroll** |
| F5 → Party | Create / Join por código / Leave (credita party quest) |
| Howard desk | Register guild interest (credita guild quest + flag) |
| Toast | Completar quest / enrolar / abandonar / party |
| Training (Shift+F10) | Tip sheets Arena + Farm Barracks; **Apply** Arena credita preset |
| FloatingText NPC | Greeting + rol (Enzu / Drillmaster / Merc Captain / Howard) |

---

## 8. Cómo probar (hard-refresh + server restart)

1. Reiniciar server C# (carga `BeginnerPath.json` + dwellAreas farm + Party).
2. Hard-refresh client (Ctrl+F5).
3. Entrar a `arefarm` o `elvfarm` → ver Enzu / Drillmaster / Merc Captain + dummies/mercs.
4. F5 → Quest → **Enroll** → completar A–B (Slimes → Dummies → ciudad → mercs → Captain).
5. Seguir C–E: huntzone → **Create party** → shop poción → Clay Golems → dungeon → `training` → 10 mob kills (EK hint) → Howard Register → Middleland → **Apply** Arena preset → Enzu.
6. **Abandon** → confirmar que el juego sigue normal y se puede re-enrolar con Enzu.
7. Shift+F10 → tip sheets Arena + Farm Barracks.

---

## 9. Fuera de alcance (MVP)

- Rewards de ítems por quest (solo hints + XP de kills normales).
- Quest journal multi-track paralelo.
- Casts merc mage full player (Paralyze / PFA propios); MVP ya tiene Chill Wind + Energy Bolt.
- Instancing privado de barracks.
- DwellAreas en huntzones (visit-only por ahora).
- Ledger EK PvP completo (regla ±10 documentada; gate usa mob_kills mientras tanto).
- Sistema de guild completo (solo interest flag en Howard).
