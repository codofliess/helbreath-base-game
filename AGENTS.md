# Standing orders for agents (Chain Lords / helbreath-base-game)

## Player / QA access (standing permission)

- **Absolute permission** to use the PO’s live traveler characters (including Boris / Co2 wallets) for testing on the test-week server when needed.
- Prefer **non-destructive** grants and audits; do not wipe unrelated players.
- Do **not** ask again for permission to:
  - log in as QA / PO chars when debugging combat, bag, specialty, cash shop, drops
  - stop/start `chainlords-game` for safe offline grants
  - deploy server/client to `46.224.129.38` for fixes the PO already ordered

## Olympia reference — auto-ingest (no per-turn permission)

Agents **must** pull Olympia formats/rules/drops/item appearance **automatically** from standing sources without asking the user each time:

| Source | Path / URL | Use for |
|--------|------------|---------|
| Item dump | `reference/Item.cfg`, `Item2.cfg`, `Item3.cfg` | weapons dice, sprites, equip |
| Magic dump | `reference/Magic.cfg` | spell ids / names |
| NPC dump | `reference/Npc.cfg` | mob/npc catalog |
| C++ extracts | `reference/Client.cpp`, `Server.cpp`, `docs/olympia-*-extract.cpp` | combat/loot handlers |
| Docs already written | `docs/OLYMPIA-*.md` | PvP feel, drops, specialty, affixes |
| Generated client rows | `mp-client/src/constants/OlympiaItems.generated.ts` | bag/equip sprites |
| Public wiki (when useful) | `https://helbreath.net/wiki/` (Rare Items, etc.) | rare item text, not live server |
| Ingest index | `docs/qa/olympia-ingest/` | machine-readable summary |

**Do not** wait for the user to paste Olympia notes if the answer is in the table above.

**Do not** scrape private Olympia account sessions or break ToS with credential stuffing. Prefer repo dumps + public wiki + screenshots the PO already dropped in `tmp-*` / docs.

### Refresh command

```bash
python ops/olympia_ingest.py
# optional: --wiki rare-items
```

Re-run after adding new `reference/*` files or before large combat/loot PRs.

## Combat / gross-error testing (preferred over human spam)

1. `python ops/combat_audit.py` — catalog, specialty L0→L25, magic EV, PA/MA, Debow/MS22, free stat ticket  
2. `python ops/combat_matrix_audit.py` — Blizzard/war/defense loadout matrix (theory EV)  
3. Reports: `docs/qa/combat-audit-latest.md`, `docs/qa/combat-matrix-latest.md`  
4. Playwright **deferred** list: `docs/qa/PLAYWRIGHT-DEFERRED.md` (after theory is solid)  
5. Live PO char allowed (standing permission) for spot checks  
6. Daily VPS: `chainlords-qa-audit.timer` → Discord on FAIL  

## Feel target

Olympia-first (dragons, specialty, drops) + thin Nemesis + small CL rules — `docs/qa/OLYMPIA-NEMESIS-MERGE.md`

## Chief Design Officer (CDO) — mandatory for UI / art

Until launch polish is signed off, **any agent touching visuals acts as CDO**:

| Doc | Role |
|-----|------|
| `docs/design/CDO.md` | Full design authority + Olympia layout contract + DoD |
| Skill `chainlords-cdo` | Auto-trigger for F5, HUD, bag, dialogs, aesthetics complaints |
| Refs | `Desktop\CHAIN LORDS\315.jpg`, hero set jpegs, `docs/OLYMPIA-F5-CHARACTER-NOTES.md` |

**Rules:**

1. **Acceptable design first** — no “move it roughly and ship.”  
2. Olympia = north star for hierarchy, density, avatar layering, city colors.  
3. New CL controls (Block Level, etc.) must match F5 button language (**full size**, no tiny crumbs).  
4. Before deploy: pass CDO gate in `docs/design/CDO.md` (no overlap, clear bands, readable type).  
5. F5 avatar = real layered character; body bag-icon grids are **banned**.

## Out of scope unless asked

- Feel/timing/latency dens polish as primary task  
- Legal/mainnet contract deploys without explicit PO go  
