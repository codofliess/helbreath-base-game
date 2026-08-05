# Combat QA pipeline — gross errors (not feel/timing)

**Goal:** Catch basic combat/catalog bugs without waiting for friends on WhatsApp.  
**Not in scope:** latency feel, cast bar snappiness, movement rubber-band.

---

## Two layers

| Layer | Tool | What it proves |
|-------|------|----------------|
| **A. Theory matrix** | `python ops/combat_audit.py` | Specialty L0→L25, magic EV, PA/MA, loot tables, MS22/Debow IDs, free stat ticket |
| **B. Practice smoke** | `node mp-client/scripts/qa-combat-smoke.mjs` | Client actually loads; optional live dumps via `__CL_QA__` |

Theory runs in **seconds**. Practice is for **spot-checks** that theory matches live packets/UI.

---

## Run theory audit (do this often)

From repo root:

```bash
python ops/combat_audit.py
python ops/combat_matrix_audit.py   # Blizz / war / Merien defense stacks
# or
python ops/combat_audit.py --config-dir multiplayer/server/Config --out docs/qa/combat-audit-latest.md
```

Exit code **1** = at least one **FAIL** (gross error).

Latest reports: [`combat-audit-latest.md`](./combat-audit-latest.md), [`combat-matrix-latest.md`](./combat-matrix-latest.md)

**Merge philosophy:** Olympia feel first + thin Nemesis + CL wrappers — [`OLYMPIA-NEMESIS-MERGE.md`](./OLYMPIA-NEMESIS-MERGE.md).

**Physical Playwright:** deferred list in [`PLAYWRIGHT-DEFERRED.md`](./PLAYWRIGHT-DEFERRED.md) (after theory green days).

**VPS daily:** `chainlords-qa-audit.timer` @ 00:25 UTC → Discord/`MAIL_TO` on FAIL only.

### What FAIL means (examples)

- Empty monster loot tables  
- Debow (618) missing from dragon loot  
- MS22 ids not weapons / wrong names  
- Specialty L25 **reduces** outgoing damage or **increases** damage taken  
- Drop mult L25 **lower** than L0  
- Stat ticket not free  
- Magic EV does not scale with Mag  

### Specialty L25 check (your request)

For each mob specialty ladder the script computes:

- outgoing dmg on a base hit of 100  
- incoming taken on a base hit of 100  
- drop multiplier  

and asserts **L25 better for player** than L0.

---

## Practice smoke (optional, Playwright)

```bash
cd multiplayer/mp-client
# local traveler client:
node scripts/qa-combat-smoke.mjs
# or
QA_URL=https://play.chainlords.net QA_CHAR=YourTestChar node scripts/qa-combat-smoke.mjs
```

Needs `__helbreathDevConnectAs` on the build (dev/traveler). Prod may only get screenshot + DOM smoke until `__CL_QA__` harness is expanded.

**Impersonating a real wallet** should use a **dedicated QA char**, not main Boris — grants + restarts won’t risk personal gear.

---

## Suggested cadence (scale velocity)

| When | Action |
|------|--------|
| Every combat/loot PR | `combat_audit.py` must exit 0 |
| Daily (agent or cron) | Re-run audit; attach FAILs to Discord/email |
| After deploy | 1× Playwright smoke + 1 live dragon kill by human or QA char |
| Weekly | Expand scenarios (new weapons, new spells) |

---

## Expanding the matrix (next steps)

1. **Weapon dice coverage** — parse `reference/Item.cfg` and flag weapons with `itemType=weapon` but no attack dice (fallback 1d5 only).  
2. **Live packet probe** — small GM command: `simulate_hit weaponId monsterId n=100` returns mean damage (server-side).  
3. **`window.__CL_QA__.getState()`** — bag, maj, specialty, last damage float, last ground loot ids.  
4. **Referee file** — `qa/olympia-expect.json` dictated by second agent from Olympia notes.

---

## What we deliberately do NOT automate here

- Ping floors / region probe  
- “Does dens feel like War”  
- Full weapon×monster×enchant Monte Carlo in live world (hours) — use theory + targeted live samples instead  
