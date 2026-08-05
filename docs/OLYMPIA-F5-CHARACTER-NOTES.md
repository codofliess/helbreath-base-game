# Olympia F5 Character — design notes (from CHAIN LORDS\315.jpg)

> Source: `C:\Users\54116\OneDrive\Desktop\CHAIN LORDS\315.jpg`  
> Live Olympia 18.2 — character **Co2**, city **Elvine**, full gear preview.

## Layout (L → R, top → bottom)

```
┌─ Character ──────────────────────────┬─ Mods ─┐
│ Elvine (city)          Co2  [Clear Title]     │
│                                              │
│  [avatar + gear]     Level / Talents / Exp…   │
│  nude base + layers  HP / MP / SP as TEXT     │
│  left gear slots     Str Vit Dex | Int Mag Luk│
│                                              │
│  [Quests] [Statistics] [Achievements]        │
│  [Guild]  [Party]      [Level Set.]          │
│  [Feedback]                                  │
└──────────────────────────────────────────────┘
```

## Key differences vs our current Chain Lord F5

| Item | Olympia 315 | Ours (before this note) |
|------|-------------|-------------------------|
| **HP / MP / SP** | **Plain numbers** `current/max` with a **slash** (e.g. `570/570`, `325/325`, `421/421`) — **no** colored bar fills | Colored gauge bars |
| **HP color** | Green text | Red bar |
| **MP color** | Cyan/blue text | Blue bar |
| **SP color** | Red/pink-ish text | Green bar |
| **Primary stats** | Right of vitals: **Str, Vit, Dex** then **Int, Mag, Luk** (numeric) | Mixed layout |
| **Hover tooltips** | Cursor over Str/Vit/Dex/Int/Mag/Luk shows **formulas** (how that stat modifies combat / mechanics) | Missing / incomplete |
| **Avatar** | Always present; **nude human base by design**, then **gear layers** cover body (staff, armor, etc. visible on Co2) | Often default clothes / compressed |
| **City** | Top-left, e.g. **Elvine** (city affiliation name) | Faction line; needs +readable size |
| **Name** | Top center gold | Present |
| **Clear Title** | Top-right control | Present |
| **Mid stats block** | Level (+rebirth), Talents, Exp, Next Exp, Rested Exp, Majestics, Weight `cur/max`, Enemy Kills, Contribution, Reputation, **Hunger %** | Partial / different order |
| **Footer** | 7 buttons including Feedback | We moved Feedback to F12 (product choice); Olympia keeps Feedback on F5 |
| **Gear slots** | Left of avatar (rings / neck / etc. as small icons) | Paper-doll slots |

## Vitals (critical)

- **Not bars.** Text only: `HP: 570/570`, `MP: 325/325`, `SP: 421/421`.
- Slash separator, not a progress fill.
- Color-coded numbers (HP green, MP cyan, SP warm/red).

## Avatar rules

1. Base nude/underwear human always drawn (original Helbreath layering).
2. Equipped items are **additional sprite layers** on top (weapon, armor, helm…), not a replacement of the whole silhouette.
3. Preview stays visible while viewing Character (not hidden when opening sub-panels unless Olympia does — 315 shows main sheet with avatar).

## Stat tooltips (to implement later)

On hover of **Str / Vit / Dex / Int / Mag / Luk**, show classic-style formula tooltips (damage, HP, hit, cast, etc.). Exact strings TBD from Client.cpp / Olympia live.

## Footer buttons (Olympia)

Row1: Quests | Statistics | Achievements  
Row2: Guild | Party | Level Set.  
Row3: Feedback (full width or left cell)

(Chain Lord may keep Feedback under F12 if product prefers — note divergence.)

## HUD context in 315 (not F5 but visible)

- Bottom dock: classic gauges + map name `Elvine Blacksmith(47,34)` + seals.
- Right: Skills + Chat Log open.
- Useful for overall chrome density only.

## Implementation checklist (when we code)

1. [x] Replace F5 HP/MP/SP **bars** with **slash text** + Olympia colors.
2. [x] Layout: avatar left | vitals + 6 attrs right; hover formulas on attrs.
3. [x] Ensure paper-doll base is nude layers + gear overlay (no forced full clothing skin).
4. [x] City label large/readable top-left.
5. [x] Match weight / hunger / majestics / EK / reputation block order if missing.
6. [x] Footer 6 buttons (Feedback under F12 — product choice).
