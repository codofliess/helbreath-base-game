# Training Arena — mapa de práctica (skills + dummies)



> Diseño + contrato MVP jugable.  

> Estado: **Fase 2 — spawn + chase** (2026-07-11).  

> No reemplaza PvP open-world ni torneos `colosseum` / `tournamentArena`.



Relacionado: [`BEGINNER-PATH-1-80.md`](./BEGINNER-PATH-1-80.md) (quests opcionales + barracks en farm con tip sheets compartidos).



---



## 1. Objetivo



Un **mapa de entrenamiento** (estilo Lize / freeze tricks / skill practice) donde el jugador:



1. Entra a un mundo dedicado (`training`) sin loadout de torneo ni Elo rated.

2. Elige un **preset** de dummies (War / Mage / mix).

3. Practica skills (Lize/Lize-style kite, freeze → Lize, hold → side-step, etc.).

4. Ve en pantalla un **tip protocol** estático por preset (no IA generativa).



---



## 2. Relación con sistemas existentes



| Sistema | Relación |

|---------|----------|

| `colosseum` + `tournamentArena` | **No reutilizar** loadout/stash/Elo. Solo el patrón de mundo dedicado en `GameWorlds.json` + mapa `fightzone1`. |

| `arena1`…`arena8` | Mundos PvP/fightzone genéricos; training es otro `id` con flag `trainingArena`. |

| `MonsterChase` / farm mercs | Chase AI de dummies: mismos catalog ids que barracks (62 War / 63 Mage) + `MonsterChase.EvaluateChaseForPlayer`. |

| `Spawn.cs` / `GameWorld.TrySpawnCatalogMonsterNearPlayer` | Entry point al ApplyPreset (sin dwell respawn). |

| Client dialogs (F-keys / SysMenu) | UI de preset + tips; **Apply** envía `ApplyTrainingPresetRequest`. |



**Invariant:** kills en `training` **no** deben ser `rated` Elo. `PvpKillLedger` solo ratea cuando `GameWorld.IsTournamentArena`.



---



## 3. Mundo / mapa



### 3.1 Entry en `GameWorlds.json`



```json

{

  "id": "training",

  "name": "Training Arena",

  "map": "fightzone1",

  "music": "default.mp3",

  "workerThread": 0,

  "trainingArena": true

}

```



- **Mapa:** reutiliza `fightzone1` (mismo asset que arenas/colosseum) para no pedir arte nuevo.

- **Flag:** `trainingArena: true` en `GameWorldConfig` (paralelo a `tournamentArena`, **sin** pasar `TournamentConfig`).

- **Spawn:** centro / free cell vía `Spawn.GetSpawnLocation` (sin teleports dedicados).

- **Cómo entrar:** el mundo aparece en `WorldsList`; el jugador lo selecciona como cualquier otro mundo. El dialog Training no fuerza transfer.



### 3.2 Qué no hace el mundo training



- No aplica hero set / stash de torneo.

- No marca kills como rated.

- No tiene dwell areas de farm por defecto (mapa vacío hasta ApplyPreset).



---



## 4. Roles de dummy



| Rol | Intención de práctica | Comportamiento (Fase 2) |

|-----|----------------------|-------------------------|

| **War** | Melee pressure, hold, side-step, kite corto | Catalog **62** Mercenary Warrior — chase melee |

| **Mage** | Freeze / Lize / kite largo | Catalog **63** Mercenary Mage — chase + Chill Wind + Energy Bolt (mismo template que farm) |



Los dummies **no** son players reales. Fase 2 usa monstruos catalog (farm mercs) sin tocar dwells de `arefarm`/`elvfarm`.



---



## 5. Presets (extensibles)



IDs estables (client + server deben coincidir):



| `presetId` | Dummies | Uso típico |

|------------|---------|------------|

| `mage_chase_1` | 1× Mage | Freeze → Lize → kite vs un mago |

| `war_chase_1` | 1× War | Hold / side-step vs un war |

| `war_chase_2` | 2× War | Split aggro, kite en 2 |

| `mage_chase_2` | 2× Mage | Multi-freeze / priorización |

| `mix_war_mage_1` | 1× War + 1× Mage | Mix pressure (melee + rango) |



Agregar presets = nueva fila en tip sheet + definición server; sin hardcodear en combate.



---



## 6. Tip protocols (no IA)



Cada preset tiene una lista ordenada de **plays sugeridos** (strings). El client las muestra al seleccionar el preset.



Fuente de verdad tips: `multiplayer/mp-client/src/constants/TrainingPresets.ts` (`TRAINING_PRESETS` + `FARM_BARRACKS_PRESETS`).  

Server mirror (IDs + composition arena): `multiplayer/server/Helpers/TrainingArena.cs`.  

Farm barracks tip sheet: grupo **Farm Barracks** en `TrainingDialog` (Apply solo muestra how-to; no spawnea en farm).

Protocolo Farm (Merc / PvP practice): **Chill Wind → Paralyze → PFA/DS** para negar PFM enemigo (PFA/DS solo si el jugador ya tiene esos spells). Fuente: `FARM_BARRACKS_PRESETS` (`farm_merc_mage`, `farm_cc_protocol`).



---



## 7. AI chase



### Fase 2 (live)



1. Al ApplyPreset: despawn dummies previos del jugador (session list).

2. Spawn N monstruos cerca del jugador (`TrySpawnCatalogMonsterNearPlayer`, radio 12, `hasDwellArea: false`).

3. Limpia spawn protection → `MonsterChase.EvaluateChaseForPlayer` — el jugador se mueve → dummies aggro/chase.

4. Roles War/Mage: catalog 62 / 63 (mismos que farm mercs).

5. Al salir del mundo `training` o re-aplicar: despawn inmediato de los dummies del jugador.



### Fase 3 (polish)



- Casts scripted adicionales en Mage dummy.

- Instancing por jugador si hay concurrencia (un slot por session en el mismo mapa).

- Botón Clear explícito (hoy re-Apply ya limpia).



---



## 8. UI client + proto



| Pieza | Path | Rol |

|-------|------|-----|

| Store | `ui/store/TrainingDialog.store.ts` | open + `selectedPresetId` |

| Dialog | `ui/dialogs/TrainingDialog.tsx` | lista presets + tip protocol + Apply |

| Presets | `constants/TrainingPresets.ts` | tip sheets + labels |

| Apertura | SysMenu → **Training**; **Shift+F10** | no roba F10 (torneos) |

| Proto | `ApplyTrainingPresetRequest` / `TrainingPresetApplied` | client → server → toast |



Flujo:



1. Entrar al mundo `training`.

2. Abrir Training (menú o Shift+F10).

3. Elegir preset → tips locales.

4. **Apply preset** → `ApplyTrainingPresetRequest` → spawn + chase; toast con resultado.

5. Re-Apply cambia de preset (despawn previos).



Farm Barracks: Apply sigue siendo tip local (“walk to Dummy/Merc zones”) — no rompe barracks.



---



## 9. Enganche GameWorlds / Spawn / dialog



```

[GameWorlds.json] id=training, trainingArena=true

        │

        ▼

[Server.cs] RegisterGameWorld (sin TournamentConfig)

        │

        ▼

[TrainingArena.HandleApplyPresetRequest]

        │  despawn session dummies → TrySpawnCatalogMonsterNearPlayer (62/63)

        │  → MonsterChase.EvaluateChaseForPlayer

        ▼

[mp-client TrainingDialog] Apply → ApplyTrainingPresetRequest

        │

        ▼

[TrainingPresetApplied] toast ok / error

```



---



## 10. VerifyFix — cobertura



| Requisito | Cubierto |

|-----------|----------|

| Preset 1 mage chase | `mage_chase_1` → 1× Mage (63) |

| Preset 1 war chase | `war_chase_1` → 1× War (62) |

| Preset 2 wars | `war_chase_2` |

| Preset 2 mages | `mage_chase_2` |

| Mix war+mage | `mix_war_mage_1` |

| Tip protocols por preset | `TrainingPresets.ts` + § 6 |

| No romper PvP/torneos | flag distinto; sin Elo/loadout |

| No romper farm barracks | dwells 62/63 intactos; Apply farm = tip only |

| Extensible | nuevos `presetId` en tablas client/server |



**VerifyFix manual:** entrar a `training` → Apply preset → dummies spawn y chase.



---



## 11. Fuera de alcance (post Fase 2)



- Dummies con apariencia de player avatar real.

- IA de cast Mage completa (más allá de Chill Wind + Energy Bolt del kit merc).

- Instancing multi-jugador en el mismo mapa.

- Ranked / rewards por training.



---



## 12. Cómo probar (Fase 2)



1. Reiniciar server C# (carga proto + `TrainingArena` spawn).

2. Hard-refresh del client (Ctrl+F5) tras cambios UI/proto.

3. Conectarse → entrar al mundo **Training Arena** (`training`).

4. Abrir **System Menu (F12)** → **Training**, o **Shift+F10**.

5. Elegir un preset Arena → **Apply preset** → toast de éxito; dummies aparecen y persiguen.

6. Re-Apply con otro preset → despawn previos + nuevos.

7. Confirmar que **Farm Barracks** Apply solo muestra tip (no spawnea).

8. Confirmar que `arefarm`/`elvfarm` mercs/dummies siguen en sus dwells.

9. Confirmar que `colosseum` sigue aplicando torneo (sin regresión).


