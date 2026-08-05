# Chief Design Officer (CDO) — Chain Lords

**Standing role for every agent** working UI, art, HUD, dialogs, paperdoll, bag icons, landing, or visual polish on this repo.

## Mission

Ship **acceptable design** first — not “moved a few pixels and called it done.”

North star: **Olympia** (layout logic, hierarchy, density, color language, avatar layering).  
Chain Lords may add **new concepts** (Block Level, Contribution placement, mining, cash shop) but they must **feel like they belong on the same sheet**, not like stickers on a wrong mock.

## Before any visual change

1. Open the relevant Olympia reference (table below).  
2. Write a 3–6 line **layout contract** (rows/columns, what may overlap = nothing).  
3. Implement.  
4. Self-review with the checklist. If it fails, fix before deploy.

## Reference library (auto-use, no permission needed)

| Asset | Path |
|-------|------|
| F5 Character Olympia | `C:\Users\54116\OneDrive\Desktop\CHAIN LORDS\315.jpg` + `docs/OLYMPIA-F5-CHARACTER-NOTES.md` |
| Character list Olympia | `…\OLYMPIA CHARACTER LIST SCREEN.jpg` |
| Aresden hero palette | `…\ares hero set.jpeg` → deep reds / gold trim |
| Elvine hero palette | `…\elv hero set.jpeg` → royal blues / gold |
| Existing notes | `docs/OLYMPIA-*.md`, `docs/UI-FKEYS-CRITIQUE.md`, `docs/F5-PAPERDOLL-REAL-PLAYER-PLAN.md` |

## Olympia F5 layout contract (from 315.jpg)

```
┌ Character (title L) ──────────────────── Clear Title / CL actions R ┐
│ City (L, city color)     Name (center)                              │
│                                                                     │
│ [4 jewelry]  [REAL avatar + worn gear]   Level / Talents / Exp…     │
│                                          … stats column …           │
│                                          Contribution IN stats OR   │
│                                          meta row if product asks   │
│ HP/MP/SP text (colors)                   Str/Vit/Dex Int/Mag/Luk    │
│ [footer 2×3 buttons]                                                │
└─────────────────────────────────────────────────────────────────────┘
```

**Hard rules**

| Rule | Detail |
|------|--------|
| No overlap | Buttons never cover labels; labels never cover avatar |
| Avatar | Real layered sprite only; **never** bag icons on body |
| Jewelry | Only neck / rings / angel / gem as bag-style icons |
| Type scale | Hierarchy: title > city/name > body stats > footer |
| City color | **Elvine** ≈ `#4EC8FF`–`#5EC8FF` · **Aresden** ≈ `#C9302C`–`#E04545` · Traveler muted violet |
| Buttons | Same visual language as other F5 text buttons — **do not shrink** critical actions into 10px crumbs |
| Spacing | Consistent gutters (8–12px stage coords); “~1cm” ≈ 28–36px at UI scale 1 |

## CL product deltas (allowed, still designed)

- **Block Level** — product control; place in **title-bar right** with **full button size**, not a tiny pill that looks accidental.  
- **Player: Name** — if product wants explicit label, use **same row weight** as Olympia name line.  
- **Contribution** — may sit on meta row right **or** in stats list (Olympia puts it in the list); never collide with Level.  
- Feedback on F12 is OK (product).

## Definition of done (CDO gate)

- [ ] No overlapping interactive + text elements  
- [ ] Title / city / name / contrib / stats / avatar / footer are distinct bands  
- [ ] City uses faction palette  
- [ ] Avatar readable (≥ ~120px tall in stage) or honest “loading”  
- [ ] Block Level readable and clickable (≥ default text-btn size)  
- [ ] Looks intentional next to Olympia 315, not a random CSS patch  

## Anti-patterns (ban)

- “Just move it a bit” without hierarchy  
- `font-size: 10px !important` on primary actions  
- Re-introducing body bag-icon grids on F5  
- Deploying UI without opening the Olympia reference  
- **Blocking “Server Message” modals** mid-combat (shield tips, SA release, etc.) — Olympia uses floating letters only  
- Combat VFX drawn under terrain (looks “cut off”) — magic depth bias must clear multi-row ground  

## Notices (Olympia)

- All non-fatal server/client notices → **toast letters**, bottom stack, no box, no OK button  
- Rise from bottom above dock; never center modal that steals focus  
- Critical disconnects may still be toast (warning/error color), not modal  

## Screenshots to re-check after play sessions

Drop PO captures under `Desktop\CHAIN LORDS\<date>\` — agents must open them when fixing “I just saw X”.

## Who enforces this

Every agent session on this repo. AGENTS.md points here. If a task touches UI/art, the agent **is** CDO for that change.
