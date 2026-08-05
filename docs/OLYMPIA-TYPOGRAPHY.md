# Olympia Typography — specs & gaps

**Fecha:** 2026-07-12  
**Fuentes:** `sp-client/reference/Client.cpp` (PutString / PutString2 / PutAlignedString / PutString_SprFont*), assets `DialogText.pak` / `sprfonts.pak`, traveler `multiplayer/mp-client`.

Hard-refresh traveler: `http://localhost:8081/?v=olympia-typo-20260712` (Ctrl+F5).

---

## Qué usa Olympia realmente

### 1. Texto GDI dinámico (diálogos, SELECTCHAR, chat)

| API | Uso | Cara aproximada | Tamaño / ritmo |
|-----|-----|-----------------|----------------|
| `PutString` / `PutString2` / `PutAlignedString` | Labels dinámicos, stats, chat, tooltips | Sans de sistema (histórico **MS Sans Serif**; en web **Tahoma** / Segoe UI) | Face ~**12px**; `PutAlignedString` RECT **15px** alto; chat pitch **13px** (`i*13`) |
| Outline | `PutString2` dibuja negro en (x+1,y), (x,y+1), (x+1,y+1) + color | — | CSS `text-shadow` 3-dir o Phaser `stroke` |

**Colores de tinta (diálogos):**

| Uso | RGB | Hex |
|-----|-----|-----|
| Stats / valores F5 | 45, 25, 25 | `#2d1919` |
| Nombre personaje F5 | 45, 20, 20 | `#2d1414` |
| SELECTCHAR name/lv/exp | 51, 0, 51 | `#330033` |
| Hover item nombre | 255, 255, 255 | `#ffffff` |
| Hover item stats | 150, 150, 150 | `#969696` |

**Chat (`PutString2` cases):** normal `#e6e6e6`, guild `#82c882`, party `#ff8282`, whisper `#8282ff`, yell `#e6e682`, system `#b4ffb4` / `#9696aa`. En traveler el panel chat es pergamino → **normal** se mantiene en tinta oscura `#2d1919` para legibilidad; canales de color sí se alinean.

El archivo fuente de `m_DDraw` (CreateFont) **no está** en este repo; la altura del RECT (15) + look retail confirman sans ~12px, no serif.

### 2. Sprite fonts (`sprites\sprfonts.pak`)

| Sprite | Uso |
|--------|-----|
| `DEF_SPRID_INTERFACE_FONT1` / `FONT2` | `PutString_SprFont` / `SprFont2` — títulos cortos (“Casting”, “Next”, Level Up) |
| `SPRFONTS2` | `PutString_SprFont3` — nameplates / speech bubbles sobre entidades |
| Números sprite | `PutString_SprNum` — HP/MP/SP HUD |

Estos **no** son fuentes web. Traveler aproxima HUD nums con Tahoma + outline negro.

### 3. Labels horneados en sprites

`DialogText.pak` / `GameDialog` llevan títulos y captions pintados en el frame (F5 “Character”, botones ND_BUTTON, etc.). No se reescriben con CSS.

---

## Traveler — qué se aplicó

| Superficie | Antes | Ahora |
|------------|-------|-------|
| CSS in-game (`rpg-ui.css`, `style.css` body) | Georgia / mix | `--olympia-ui-font: Tahoma, 'MS Sans Serif', 'Segoe UI', sans-serif` |
| F5–F12 / bag / cast / skill / chat / shop | Georgia o Tahoma suelto | `var(--olympia-ui-font)` + tinta `--olympia-ink` |
| SELECTCHAR / CreateChar / Arena desk (Phaser) | Georgia 12px, status dorado | Tahoma 12px, ink `#330033`; selección = frame focus, no color dorado |
| FloatingText / hover overlays | Georgia | Tahoma + stroke (PutString2) |
| Hub marketing `.login-hub` | Cinzel / Spectral | **Sin cambio** (intencional) |

Constantes: `multiplayer/mp-client/src/constants/OlympiaTypography.ts`  
Variables CSS: `:root` en `rpg-ui.css` y `public/style.css`.

---

## Gaps restantes

1. **Sprite fonts reales** — no hay atlas web de `sprfonts`; damage/nameplates siguen siendo canvas text, no glyphs pixel.
2. **CreateFont exacto** — falta `DXC_ddraw` en el repo; confirmar face/height con captura live o dump del cliente Olympia.
3. **Chat normal color** — classic usa gris claro sobre panel oscuro; traveler usa tinta oscura sobre pergamino.
4. **Splash “Helbreath Explorer”** (`SpriteUtils.ts`) — sigue Georgia (branding), no UI in-game.
5. **Hub Cinzel/Spectral** — marketing distinto; documentado a propósito.
6. **Anti-alias** — GDI classic era más “duro”; navegadores suavizan Tahoma.

---

## Screenshot checklist (cuando haya login Olympia)

Comparar lado a lado (retail vs `http://localhost:8081`):

- [ ] SELECTCHAR — name / Lv / Exp bajo cada slot (cara, color `#330033`, posición)
- [ ] CREATECHAR — labels y valores de stats
- [ ] F5 Character — nombre, status, números STR…CHR
- [ ] F6 Bag — tabs / vacíos
- [ ] F7 Magic — círculos y nombres de hechizos
- [ ] F8 Skills — lista %
- [ ] F9 Chat — líneas + input
- [ ] F10 / Training / F11 / F12 — títulos y filas
- [ ] HUD HP/MP/SP números (HotkeyBar)
- [ ] Nameplates / damage floating text
- [ ] Item hover (cursor: blanco + gris)

Capturar a 800×600 lógico o anotar el scale `1.5` del traveler.

---

## Nota de método

Paridad tipográfica = **sans GDI 12px + tintas RGB del Client.cpp**, no fuentes display modernas. Pixel-perfect de `sprfonts` requiere exportar el PAK a bitmap font Phaser (trabajo aparte).
