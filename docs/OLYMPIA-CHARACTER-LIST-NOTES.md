# Olympia Character List — live notes (2026-07-15)

> Captured live: `Helbreath Olympia 18.2` windowed (~800×600 client + chrome).  
> Reference files:  
> - `multiplayer/mp-client/scripts/verify-selectchar-out/olympia-charlist-ONLY.png`  
> - `multiplayer/mp-client/scripts/verify-selectchar-out/olympia-live-now.png`  
> - Prior SAVE: `AppData\Roaming\Helbreath Olympia\SAVE\Helbreath Olympia #305.jpg`  
> Traveler (bad) ref: OneDrive Screenshots PauPau Character List.

## Window / presentation

| Item | Olympia live |
|------|----------------|
| Title bar | `Helbreath Olympia 18.2` (Windows chrome) |
| Client area | **Exactly 800×600** (`Helbreath Olympia #305.jpg` is 800×600 pixels). Letterbox black only *outside* that 4:3 frame if the host window/browser is larger |
| Fullscreen | Not required; medium windowed is the reference |
| Background | Dark stone + runes; desk floating, **not** full-bleed React hub |

## Layout (top → bottom)

1. **Title only:** centered leather banner **“Character List”**  
   - **NO** top-left red “Log Out” tab  
2. **4 character cards** (oval portrait + parchment fields) in a rope frame  
3. **Lower panel:** left help text | right action buttons  
4. **Email row** under panel: `Email:` masked + **Reveal**  
5. **Version** bottom-left outside desk: `Version 18.2 (32 bit)`

## Character card (selected vs idle)

Selected (gold glow border + gold fill on fields):

- Oval portrait with **full gear** (staff/sword, armor, cape) — not underwear preview  
- Fields (Olympia labels, not classic NAME/LEV/Exp bake alone):
  - **Name** — e.g. `Co2`, `alychar`
  - **Lev.** — e.g. `140 (+14)` rebirth in parens  
  - **Talents** — two lines of talent/skill tags (e.g. `Long Sword` / `Xelima`, or `Lightning`)  
- Idle cards: same structure, muted brown, empty if no char  

**Not present on cards:** Exp number, hours played, STR/VIT dump, stray “h” glyphs.

## Lower-left help well (exact spirit)

```
You can start game by clicking START
button, and make a new character.
If you want to delete a character,
press the DELETE CHARACTER button.
```

- Dark ink on lined parchment  
- **No** selected-char summary (name/lev/exp) repeated here  
- **No** “Relics of the Chain Lord…” marketing footer  

## Action buttons (right stack, top → bottom)

1. Start  
2. Create New Character  
3. Delete Character  
4. Change Password  
5. Log Out  

- Brown stone buttons, gold hover (classic)  
- Log Out **only** here — not as top tab  

## Email bar

- Below lower panel, still on desk  
- `Email:` + asterisks + **Reveal** link/button  
- Traveler may omit or replace with wallet short id (product choice) — do **not** put Chain Lord slogan here  

## Gaps vs our traveler (PauPau capture)

| Issue in traveler | Olympia |
|-------------------|---------|
| Red **Log Out** tab top-left | Absent |
| Footer “Chain Lord travel with every soul…” | Absent |
| Left panel = char summary + purple help | Help text only, dark ink |
| Preview nearly nude | Full equipment silhouette |
| NAME / LEV / Exp (and overflow) | Name / Lev. / Talents |
| No email row | Email + Reveal |
| Extra Log Out chrome | Single Log Out button |

## Implementation checklist (traveler)

1. **Never** overlay DialogText frame that paints top Log Out (frame 50 in our pack). — **done** (`SelectCharDesk` / `ArenaSelectCharDesk`)  
2. Hide/remove NFT marketing `nftNote` forever on SELECTCHAR. — **done**  
3. Status well = Olympia help copy only (no selected-slot dump). — **done**  
4. Status ink = classic dark purple-brown (`OLYMPIA_SELECTCHAR_INK`), not bright violet. — **done**  
5. Slot text: **Name / Lev. / Talents** (cover classic NAME/LEV/Exp bake + redraw). — **done** 2026-07-16  
   - Talent *values* need server fields later (lines stay empty for now)  
6. Preview: default shirt+pants over underwear when no equip on list. — **done** (`wearDefaultClothes`)  
7. Wallet row under panel (Email stand-in) + **Reveal/Hide**. — **done** 2026-07-16  
8. Keep black letterbox stage; desk 800×600 CSS `cm` insets; no HotkeyBar. — **done**  
9. **Walk + rotate** with equipped gear (classic `DrawObject_OnMove_ForMenu` / 100ms frame). — **done**  
   - Server: `CharacterListEntry.Equipped` from `state_json` / traveler JSON → proto `CharacterEquipPreview`  
   - Client: `menuCharacterPreview.createMenuCharacterPreview` WalkPeaceMode + `SelectCharDesk` timer  
10. Log Out tab cover: opaque stone + stamp from top-right desk chrome; **W≤198** so title “Character List” is never clipped. — **done** 2026-07-16  

Hard-refresh traveler: `?v=selectchar-olympia-20260716`

## SELECTCHAR letterbox (code contract)

```
from superior and inferior edges of screen → 2.0 cm black
from both side edges of screen             → 3.5 cm black
```

**Implementation (2026-07-15):** pure CSS in `public/style.css` on
`body.login-selectchar-active #game-container`:
`left/right: 3.5cm; top/bottom: 2cm`. Canvas is `position:absolute; inset:0; width/height:100%`.
JS only adds the body class + Scale.NONE + strips Phaser inline styles
(`loginDeskPresentation.ts`). Reference snips: Desktop `CHAIN LORDS\`.

## Presentation / scale — measured from `Helbreath Olympia #306.jpg`

Pixel samples on mid-row / mid-col of **#306** (800×600 SAVE):

| Edge | Pure black (R=G=B=0) | First stone/UI |
|------|----------------------|----------------|
| Left | x 0…79 | x≈80 |
| Right | x≈720…799 | |
| Top | y 0…59 | y≈60 |
| Bottom | ~60 px | |

→ Inner client ≈ **640×480**, pad **80/640 = 12.5%** of content on each edge.  
Physical ruler on expanded monitor (~3.5 cm sides, ~2 cm top) is the same ratio on a laptop panel.

**Rules:**

1. Logical desk buffer stays **800×600** (our ND_SELECTCHAR art).
2. CSS: fit outer box `content × 1.25` into the browser → black borders like #306; center with `position:fixed` + pixel left/top/width/height.
3. **Never** draw a solid “Log Out tab cover” rectangle over the title/first slot (that was the ugly patch).

## Capture meta

- Process: `OlympiaGame_32`  
- Window: `Helbreath Olympia 18.2` ~816×639 outer (title bar + client)  
- Client content matches SAVE #305 layout family  
