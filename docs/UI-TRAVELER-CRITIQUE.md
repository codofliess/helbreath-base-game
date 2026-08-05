# UI Traveler — Autocrítica de diseño



**Fecha:** 2026-07-11  

**Método:** Screenshots en vivo (`localhost:8081` traveler + server `:1337`), lectura de layout DOM (`getBoundingClientRect`).  

**Capturas:** `multiplayer/mp-client/scripts/verify-game-viewport-out/`  

**Hard-refresh:** obligatorio tras este fix (`Ctrl+Shift+R` o `?v=viewport-fit-20260711`) — `public/style.css` + `Scale.FIT` no siempre hot-reloadean limpio.



Barra de calidad: presentación Blizzard / classic Helbreath retail — no “funciona en el browser”.



---



## Veredicto (1 línea)



El viewport in-game ya no es una tarjeta mini abajo-derecha: **Scale.FIT + stage centrado** llena el browser (~viewport completo). SELECTCHAR sigue con CSS `transform: scale` near-fullscreen.



---



## Lo que se ve en cada pantalla



| # | Archivo | Qué muestra |

|---|---------|-------------|

| 01 | `01-hub.png` | Hub Chain Lord / seal |

| 02 | `02-selectchar.png` | Desk SELECTCHAR near-fullscreen (800×600 × scale) |

| 03 | `03-ingame-viewport.png` | GameWorld Loading map — canvas **full / centered** (no mini corner) |

| 06 | `06-ingame-with-hud.png` | (si el mapa carga) HUD docked vía `--hb-canvas-*` |



Medición Playwright 1440×900 in-game: canvas ≈ **1442×812**, class `game-world-canvas`, body `game-world-active`, vars `--hb-canvas-left/width/inset-bottom` publicadas.



---



## Fixes aplicados (esta pasada) — addressed



1. **Canvas mini bottom-right / letterbox roto** — **addressed.** Causa: `Scale.NONE` + CSS `justify-content: flex-end` en `game-world-active`. Ahora default `Scale.FIT` + `CENTER_BOTH`; GameWorld aplica `gameWorldCanvasPresentation`; desks pasan a `NONE` solo mientras SELECTCHAR/Create están activos.

2. **CSS pelea con updateCenter** — **addressed.** Quitado `flex-end`; desks siguen limpiando `margin` + `transform` propios; in-game deja márgenes a Phaser FIT.

3. **HUD flotando en el “mar negro”** — **addressed (layout).** `.hotkey-bar-root` usa `--hb-canvas-left/width/inset-bottom` publicados desde el canvas letterboxed.

4. **Teardown desk → mundo** — **addressed.** `forceClearLoginDeskCanvasPresentation` restaura modo FIT guardado; GameWorld limpia residual y reaplica presentación.

5. **Wallet / City Select / copy hub** — sin cambios en esta pasada (otro agente / prior).



---



## Autocrítica residual

### Sigue débil

- Preview Create / maniquí traveler (contenido, no viewport) — hair/centering en SELECTCHAR **addressed** (anchors y=148 + nudge).

- City Select arte ND_GAME2 baked.

- Si el connect con wallet DEV falla al 1–2s, el cliente vuelve al hub — no es el bug de scale, pero conviene hard-refresh si el canvas quedó raro tras un kick.

### Fortalezas

- In-game ya no es “tarjeta dorada en la esquina”.

- SELECTCHAR near-fullscreen intacto (World + **Arena Phaser desk**).

- HUD alineado al borde inferior del canvas (cuando el mapa cargó); iconos F10/F11 en panel.



---



## Próximos 5 (ROI)



1. Asegurar que tras kick/logout el hub siempre haga `scale.refresh()` FIT (parcialmente hecho en `clearGameWorldCanvasPresentation`).

2. Tipografía unificada Empty / Create new / status.

3. Arena column visibility a anchos medios (hub).

4. Sustituir maniquí traveler por loadout mínimo visible.

5. Retirar franja F1–F12 flotante si el panel de iconos alcanza cobertura total.



---



## Nota de método



```text

node scripts/verify-game-viewport.mjs

node scripts/verify-ingame-hud.mjs

```



Hard-refresh: `http://localhost:8081/?v=jugable-ui-residual-20260711`  

DEV: `__helbreathDevEnterPlayWorld()` · `__helbreathDevConnectAs('Name')`


