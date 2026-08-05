# UI F-keys (F5–F12) — Autocrítica de diseño

**Fecha:** 2026-07-12  
**Método:** Lectura end-to-end de `HotkeyBar`, `main.tsx` keydown, dialogs + `rpg-ui.css` / `OlympiaUiScale`; restyle Nemesis sobre shell compartido.  
**Alcance:** UI in-game F5–F12 (no hub / ConnectDialog — otro workstream).

Barra de calidad: chrome **Nemesis** (carbón translúcido + borde sienna + títulos góticos) con acentos oro/marrón Chain Lord — no “React form / purple AI slop”.

---

## Mapa F5–F12

| Tecla | Diálogo | Submenús / tabs | Shell |
|-------|---------|-----------------|-------|
| **F5** | Character | Main sheet + Quest / Party / Level Set (tabs góticos) + Guild / Stats / Achievements | DialogText 270×376 + `.hb-nemesis-dialog` |
| **F6** | Bag / Inventory | Tabs: **Bag** \| **Item Drops** (+ NFT claims); gear en F5 | Bag 225×185 · Drops sibling 258×339 |
| **F7** | Magic Book (Cast) | Circles 1–10 + checkbox “Cast animation” | ND_GAME1 258×328 |
| **F8** | Skill | Lista scrolleable de skills % | ND_GAME2 258×339 |
| **F9** | Chat | Log + input + Send | Chat 364×162 |
| **F10** | Tournament | Tabs: **Ranks** \| **Events** \| **Honor** | Reusa sprite sizing |
| **Shift+F10** | Training Arena | Presets + tip protocol + Apply | Mismo chrome Nemesis |
| **F11** | Monster's Kills | Kill tally + milestones/claims | ND_GAME2 258×339 |
| **F12** | System Menu | Detail / Sound / Music / Whisper / Shout / volumes / Transparency / Guide Map / Training / Log out | ND_GAME1 258×268 |

**HUD icons (HotkeyBar):** Char F5, Bag F6, Magic F7, Skill F8, Chat F9, Tour F10, Kills F11, Sys F12.

---

## Veredicto (1 línea)

Chrome F5–F12 unificado en `.hb-nemesis-dialog` (fondo carbón ~rgba(20,18,16,0.88), borde `#b86a32`, títulos Cinzel naranja-marrón, body Tahoma gris claro, botones oro/marrón Chain Lord); layouts/hitzones Olympia intactos.

---

## Fixes applied — addressed

1. **Nemesis chrome (2026-07-12)** — clase compartida `.hb-nemesis-dialog` en `OlympiaDialogShell` + F5 Character; sprites de pergamino suprimidos por CSS. **addressed.**  
2. **Títulos HTML** — Character / Magic / Skill / Chat / SysMenu / Tournament / Mob Kills / Training siempre tienen barra de título (overlays sprite ocultos). **addressed.**  
3. **F5 labels** — `data-label` en stats (Level/Exp/Health/…) porque el bake del DialogText ya no se ve. **addressed.**  
4. **Footer tabs** — Quest / Party / Level Set. y Bag / Item Drops como texto gótico, no ND_BUTTON sprite. **addressed.**  
5. **Skill / SysMenu / Cast** — título HTML solo si falta sprite overlay (nada de doble chrome). **addressed (prev).**  
6. **F6 Item Drops** — panel hermano `item-drops-dialog-root`. **addressed (prev).**  
7. **HUD icons F10/F11** — IconPannel2 frames 2/5. **addressed (prev).**

---

## Autocrítica residual (menor)

- Franja F1–F12 flotante sigue duplicando el mapa de teclas junto a iconos.  
- Cast animation checkbox sigue siendo control web (bajo ROI).  
- Stubs Quest/Party/Guild / Apply Training sin contenido real.  
- Labels F5 vía `::before` pueden solaparse si el equip grid crece; afinar posiciones con captura live.  
- Hard-refresh: `http://localhost:8081/?v=nemesis-fkey-20260712`.

---

## Nota de método

Re-captura: `cd multiplayer/mp-client && node scripts/ui-fkeys-critique.mjs` con server estable y `?v=nemesis-fkey-20260712`.
