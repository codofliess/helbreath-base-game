# Helbreath Arena — kit builder (spec)

**Status:** entry **blocked** in client (`ARENA_ENTRY_ENABLED = false`) until this ships.  
**UX goal:** same flow as Helbreath World character desk (SELECTCHAR → Create Character → Start), not the half-baked kit lobby.

## Flow (parity with World)

1. Hub → **Helbreath Arena** (wallet seal).
2. **Character list** (4 slots) — same chrome as World.
3. **Create Character** on empty slot:
   - Name + looks (same rules as World).
   - **Stat points for level 150** fully allocatable (not L1 traveler soft kit).
4. **Loadout step** (after create, before Start / on Start into prep):
   - Base **hero set** auto-equipped by path (war / mage).
   - **1000 gear credits** to spend from a **catalog** (player-feedback driven; iterate weekly).
5. **Start** → enter Coliseum only with a completed kit.

## Base sets (create defaults)

| Path | Base gear |
|------|-----------|
| **War** | Hero set + **Critical Increase +4** + **HP +40** on each piece |
| **Mage** | Hero set + **Endurance +100%** + **MP +40** on each piece |

Exact item IDs / effect wiring: map to existing `Items.json` / Olympia effect attrs when implementing.

## Gear credits

- Starting budget: **1000 credits** per arena character / kit.
- Spend only from catalog; no cash shop bleed into World economy.
- Refund / respec policy: TBD (likely free respec between events during testing).

### Seed catalog (v0 — extend with player feedback)

| Item (working name) | Credits | Notes |
|---------------------|--------:|-------|
| Blood Sword +5 | 300 | War |
| Blood Axe +5 | 300 | War |
| Giant Battle Hammer | 600 | War |
| The Devastator | 800 | War |
| Merien Shield | 500 | War / hybrid |
| Zerk Wand (MS 20) | 500 | Mage |
| *(more…)* | … | Fill from Discord / testing-week feedback |

**Process:** ops sheet or `Config/ArenaGearCatalog.json` — add rows weekly; never hardcode only in UI.

## Config files (planned)

```
multiplayer/server/Config/ArenaGearCatalog.json
multiplayer/server/Config/Tournament.json   # brackets / entry already exist — extend
```

Client: read catalog from initial state or static JSON for desk shop UI.

## Non-goals (until open)

- Public entry to incomplete Arena desk.
- Auto-enter from landing `?mode=arena` deep link.
- Mixing World inventory into Arena kits (arena kits stay sealed / tournament loadout).

## Open checklist before `ARENA_ENTRY_ENABLED = true`

- [ ] Create desk with L150 point pool
- [ ] War / mage base hero sets applied server-side
- [ ] Catalog v0 + credit spend/refund
- [ ] Start only if kit valid (name + set + credits ≤ 1000)
- [ ] Map / matchmaking / fair gear validation on server
- [ ] Freeze copy: not ROI; utility / testing only
