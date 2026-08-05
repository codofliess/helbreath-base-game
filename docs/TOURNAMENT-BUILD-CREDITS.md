# Torneos — Build Draft / créditos (diseño)

> Diseño futuro. **No implementar** el sistema de point-buy completo todavía.  
> El modo equal-footing actual (`Tournament.json` + mundo `colosseum`) sigue siendo el producto “open / hero set”.  
> Bitácora: [`MASTERPLAN.md`](./MASTERPLAN.md) — decisión 2026-07-10 + Fase C.2.

---

## 1. Dos modos PvP (no se reemplazan)

| Modo | Qué es | Estado |
|------|--------|--------|
| **Open / equal gear** | Todos reciben el mismo loadout server-side (hero set + bag). Skill-only. | En repo (`Tournament.json`, `tournamentArena`) |
| **Build Draft (brackets)** | Elegís bracket de poder, gastás un **presupuesto de créditos** en arma/armadura/hechizos/stats. Balance por escasez. | Solo diseño (este doc) |

---

## 2. Dos brackets (propuesta — no números finales)

Referencia de progresión clásica en repo: `Progression.json` (`maxLevel` 180, `maxRebirth` 20). Los caps de bracket son **intención de banda**, no valores locked.

| Bracket | Sensación | Nivel / poder (propuesta) | Notas |
|---------|-----------|---------------------------|--------|
| **Tier 90** | Mid competitivo | Nivel ~90; rebirth bajo; pool de items/spells de esa banda | Onboarding PvP + builds “limpias” |
| **Tier 160** | Endgame | Nivel tope de banda (~160+) + poder comparable a **~20 rebirths** (no copiar char persistido) | Super-rares carísimos en créditos; no “todo gratis” |

Cada bracket define: `budget`, `maxLevel` (y caps de stats/rebirth simulados), y qué IDs entran en la tabla de costos (o allowlist).

> **UI login (2026-07-11):** Arena desk usa **solo 160 y 90** (2 kits cada uno = 4 slots SELECTCHAR). Los tiers 60/120 del diseño anterior se retiraron del MVP de lobby; migración `localStorage` v1→v2 en `tournamentBuilds.ts`.

---

## 3. Flujo de duelo espontáneo (sin char en el server)

```
guest / wallet connect
    → elige bracket (90 | 160)
    → draft con créditos (items / spells / stats)
    → lock loadout (server valida presupuesto + allowlist)
    → match en arena del bracket
    → fin → discard char efímero (nada se escribe al personaje persistido)
```

- **Sin personaje persistente:** el duelo crea un char de sesión (o snapshot arena) solo para ese match.
- Misma regla de higiene que el torneo actual: **gear de arena no contamina** el char real (stash / no-persist).
- Wallet sirve para identidad / anti-abuse / ranking futuro; no exige grind local previo.

---

## 4. Modelo de datos sugerido (JSON)

Esqueleto orientativo. Tablas pueden vivir en un futuro `BuildBrackets.json` (o extensión de `Tournament.json`); **costos finales no se hardcodean aún**.

```json
{
  "brackets": [
    {
      "id": "tier-90",
      "displayName": "Tier 90",
      "budget": 100,
      "maxLevel": 90,
      "maxRebirth": 0,
      "arenaWorldId": "colosseum-90",
      "costs": [
        { "kind": "item", "id": 19, "cost": 0 },
        { "kind": "spell", "id": 12, "cost": 0 },
        { "kind": "stat", "id": "str", "costPerPoint": 0 }
      ]
    }
  ]
}
```

### Tipos sugeridos

**`BuildBracketConfig`**

| Campo | Rol |
|-------|-----|
| `id` | `tier-90` / `tier-160` |
| `budget` | Créditos totales del draft |
| `maxLevel` / `maxRebirth` | Caps del char efímero |
| `arenaWorldId` | Mundo con reglas de ese bracket |
| `allowedItemIds` *o* `costs[]` | Allowlist simple vs tabla de costos |
| `allowedSpellIds` | Igual para hechizos |

**`CreditCostEntry`**

| Campo | Rol |
|-------|-----|
| `kind` | `item` \| `spell` \| `stat` (y futuro `synergy`) |
| `id` | itemId / spellId / nombre de stat |
| `cost` o `costPerPoint` | Entero ≥ 0; `0` = placeholder / free stub |
| (opcional) `tags` | rareza, rol, para telemetría |

**Synergy tax (fase tardía):** entrada `kind: "synergy"` con `requires: [idA, idB]` y `extraCost` si ambos están en el draft.

---

## 5. Principios de balance

1. **Presupuesto tenso** — un kit “completo bueno” debe rozar el tope; sobrar mucho = budget flojo.
2. **Anti-one-item** — ZWand MS20 / equivalentes endgame deben costar tanto que el resto del kit quede cojo (naked + arma ≠ winrate estable).
3. **Costos crecientes en super-rares** — rareza / poder percibido → costo alto; no regalar legendaries en Tier 90.
4. **Paridad de bracket** — solo pelean dentro del mismo Tier; no cross-bracket en matchmaking default.
5. **Lock server-side** — el cliente propone; el server rechaza overspend, IDs fuera de tabla, o stacks ilegales.
6. **Iterar con datos** — costos iniciales = heurística; la verdad sale de winrate, no de intuición sola.

---

## 6. Plan de “AI tuning” (fases realistas)

No prometer ML mágico. Empezar con **reglas + telemetría + revisión humana**.

| Fase | Qué | Quién |
|------|-----|--------|
| **0 — Stub** | JSON vacío / costos `0`; UI picker; mundos por bracket | `[cheap]` |
| **1 — Heurística** | Costos iniciales humanos por rareza/rol | `[fable]` |
| **2 — Telemetría** | Loggear drafts + resultados; winrate por pieza / combo | `[cheap]` + `[fable]` schema |
| **3 — Simulación** | Matchups sintéticos o bots de reglas (no deep RL obligatorio) | `[fable]` |
| **4 — Ajuste asistido** | AI propone deltas de costo; humano aprueba; versionar tablas | `[fable]` |
| **5 — Synergy tax** | Solo si un meta único domina tras 3–4 | `[fable]` |

### Capas de valuación

1. Item cost  
2. Spell cost  
3. Stat cost (point-buy)  
4. (Opcional) Synergy tax  

### Riesgos a vigilar

- **Power creep** al bajar costos del meta actual.  
- **Meta único** (todos el mismo draft).  
- **Exploits de draft** (lock race, items no listados, budget bypass).  
- Confundir “modelo entrenó” con “tabla versionada + review”.

---

## 7. Qué NO hacer aún

- No hardcodear **costos finales** en server/client.  
- No reemplazar ni romper el loadout equal-footing de `Tournament.json`.  
- No exigir char persistido para duelos guest del Build Draft.  
- No auto-aplicar ajustes de AI a prod sin gate humano.  
- No abrir cross-bracket matchmaking en el primer corte.

Cuando se implemente: checkboxes en MASTERPLAN § Fase C.2; costos viven en JSON versionado, no en literales de combate.

---

## 8. Open questions (para Fable / humano)

1. ¿Budgets iniciales por bracket (90 / 160) y unidad de crédito (entero abstracto vs “puntos”)?
2. ¿Tier 160 simula ~RB20 en stats/spells o solo en allowlist de items?
3. ¿Elo de duelos guest comparte tabla `pvp_ratings` o es un `mode` separado (`draft-solo`)?
4. ¿Synergy tax en el primer ship o solo tras N semanas de telemetría?
5. ¿Matchmaking: cola libre, challenge code, o solo bracket de torneo programado?
6. ¿Los hechizos cuestan por ID o por “tier de magia” agrupado?

Detalle de críticas batch: [`MASTERPLAN.md`](./MASTERPLAN.md) § 10.

---

## 9. MVP steps `[cheap]` (cuando se abra C.2 — orden sugerido)

Prerrequisito: Fase C equal-footing estable. **No** poner costos finales.

1. `[cheap]` Crear `BuildBrackets.json` (o extensión) con 2 brackets (90 / 160), `budget` placeholder, `costs[]` en `0`, allowlists vacías o mínimas.
2. `[cheap]` Flags/ids de mundo `colosseum-90` / `-160` en `GameWorlds.json` (pueden apuntar al mismo mapa al inicio).
3. `[cheap]` Proto/API stub: `SelectBuildBracket` + `LockBuildDraft` que solo validan “suma ≤ budget” y rechazan IDs desconocidos.
4. `[cheap]` UI picker: elegir bracket → lista de piezas con costo → barra de créditos → Lock (sin economía real).
5. `[cheap]` Char efímero: al entrar al match crear snapshot arena; al salir discard (reutilizar patrón stash de torneo).
6. `[cheap]` Telemetría mínima: loggear draft JSON + winner al terminar match (tabla o archivo; schema `[fable]` si va a Postgres).
7. `[fable]` (después) Heurística de costos v1 + review; versionar tablas (`BuildBrackets.v1.json`).

---

## 10. Saved tournament builds (login MVP — 2026-07-10 / 2026-07-11)

**Hecho en cliente (sin point-buy / sin lock server):**

### Hub 3-body → Hub v2 → portales simétricos → desk Arena (2026-07-10 / 2026-07-11)

- **Hub:** composición única — **izq** Helbreath World | **centro** diosas Aresden / Elendiel (`LoadingBg.jpg`) | **der** Helbreath Arena. Ambos laterales = **puerta de entrada** (nombre + Phantom/wallet + CTA); **sin** UI de builds en el hub.
- **World desk** (`phase: play-world`): SELECTCHAR clásico (4 chars) + copy *“Rare NFTs shared across characters on this wallet”* (los rares NFT viven en la wallet, no por personaje).
- **Arena lobby** (`phase: arena-lobby`): **Phaser** `ArenaSelectCharDesk` — mismo chrome SELECTCHAR (`sprite-gamedialog2-8` + ND_BUTTON). **2 brackets** (Lv **160** / **90**); **2 kits** por nivel → **4 slots** de desk:
  - Slots 0–1 = Lv 160 A / B
  - Slots 2–3 = Lv 90 A / B
  - Save / Load / Rename / Del stubs en el panel central; luego Enter the Coliseum.
- Persistencia: `localStorage` key `helbreath.tournamentBuilds.v2` (+ `….preferredSlots`, `….lastLoaded`). Migración automática desde `olympia.tournamentBuilds.v1` (60→90, 120→90 si no hay 60, 160 se conserva; slot 2 legacy se descarta).
- Campos MVP: `name`, `bracket`, `slot` (0|1), `itemIds[]`, `creditSpendStub`.
- Flujo World: Phantom → **Enter Helbreath World** → desk SELECTCHAR → `IN_UI_CONNECT_TO_SERVER`.
- Flujo Arena: Phantom → **Enter Helbreath Arena** → desk builds 160/90 → Coliseum dialog.
- Código: `tournamentBuilds.ts` + `ConnectDialog.tsx` / `ConnectDialog.store.ts` + estilos `.login-desk*` en `rpg-ui.css`.

Cuando se abra C.2 de verdad, estos JSON locales alimentan el picker / `LockBuildDraft` — no reemplazan validación server-side.

---

## 11. Ops equal-footing (MVP jugable — 2026-07-11)

Estado del loop **open / hero set** (no Build Draft):

| Pieza | Dónde | Notas |
|-------|-------|-------|
| Loadout + stash | `Tournament.json` + mundo `colosseum` | Gear arena no contamina char persistido |
| F10 dialog | `TournamentDialog` | Tabs Ranks / Events / Honor |
| Bracket visual | Events → tap torneo | Single-elim por `round`/`position`; winner highlight; BYE |
| Killer en death | `PlayerDied.killer_name` | Fan-out a víctima; UI “Killed by …” |
| Elo lazy | `GET /leaderboard` | −25/sem tras 28d idle, floor 1000 (solo display) |
| Elo persist job | middleware `startEloDecayJob` | Default 1h; `DECAY_JOB_INTERVAL_MS`; `POST /admin/decay-run` |
| Premios on-chain | `tournament_prizes` | Schema/API sí; **payout custodial bloqueado/legal** — no implementar aún |
| Anti-cheat full | — | Fuera de este MVP |

Hard-refresh cliente tras deploy UI (`Ctrl+Shift+R`). Reiniciar middleware para el decay job.
