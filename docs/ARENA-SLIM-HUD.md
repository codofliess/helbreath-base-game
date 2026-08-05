# Arena Slim HUD

Duel-focused chrome for Chain Lords (web client). Same engine/art/VFX; less UI steal and less work per frame.

## When it turns on

1. **URL:** `?arena=1` or `?mode=arena` or `?arenaSlim=1`
2. **World id / map:** `colosseum`, `arena-duel-*`, `arena-btfield`, `fightzone*`, etc.  
   (see `ArenaSlimMode.store.ts`)

Body class: `arena-slim-mode`.

## What stays

| UI | Notes |
|----|--------|
| **Bag (F6)** | **Always** — swap sets/weapons mid-duel. **No** Item Drops / Auction tabs |
| **Hotkey bar** | Spells / combat |
| **Minimap** | Map body **click-through**; only **toolbar** (drag/zoom/×) captures clicks |
| **ArenaPact dialog** | Create / ready / tech / prize |
| **Chat strip + Enter compose** | Duel-isolated: global (all read) + `/party` ok; no trade/town spam |
| **System log** | Match/DC messages |
| **Player hover** | Names |
| **Cast dialog (F7)** | Magic |

## What is removed / blocked

| UI | |
|----|--|
| F5 Character / paperdoll | Blocked (CPU + clutter) |
| F8 Skills, F10 Academy/Tourneys, F12 SysMenu | Blocked |
| Quest tracker, Testnet HUD, tutorial | Hidden |
| Auction, Enchant bag, Mob kills, Watch, Training, Guild WH, Anti-bot panel | Not mounted |
| Monster/NPC hover overlays | Off |
| Item dialog (GM tints) | Off |

## Bag + mini F5 (mixed panel)

`InventoryDialog` prop `simpleBagOnly={true}`:

- **Top strip** (`ArenaBagMiniLoadout`): collapsible via lateral **oreja** (`▸ EQ` / `◂`)  
  - **Expanded:** ~40×44px avatar + 8 tiny combat slots  
    (weapon / shield / armor / helm / hauberk / legs / boots / cape)  
  - **Collapsed:** ~22px ear only — max pocket space mid-duel  
  - Click ear to toggle; preference in `localStorage` (`cl-arena-bag-mini-loadout-open`)  
  - Double-click slot to unequip; hover tooltip; **no** jewelry / full paperdoll  
  - Paperdoll capture only runs while open (CPU)  
- **Pocket** below: equip-by-double-click / Ctrl-pile as always  
- No Item Drops list, no Auction button  

Full F5 Character dialog stays **blocked** in slim (F5 key ignored).

## Chat

- Display filter: `global` / `nearby` / `party` / `misc`  
- Compose default: **global** (shared duel log)  
- Voice: Discord (product assumption)  
- Strip: `pointer-events: none` (no cast steal)

## Dev test

```
https://localhost:PORT/?arena=1
```

or enter any `colosseum` / `arena-duel-*` world after login.
