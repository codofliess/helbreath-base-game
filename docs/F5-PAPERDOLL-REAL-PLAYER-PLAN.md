# Plan realista: F5 paperdoll = jugador real (estilo Olympia)

**Estado:** **Fase A+B reforzadas y re-deploy (2026-08-03)** — body slots **nunca** pintan íconos de bolsa (ni en DOM); composite idle-south + live map layers; hard-refresh obligatorio.  
**Fase C** opcional (dirección preview, etc.).

---

## 1. Qué se ve hoy en Chain Lords (el “muñeco de papel”)

| Capa | Qué hace | Problema |
|------|----------|----------|
| **Fallback CSS** | Silueta de `div`s (cabeza/torso/brazos/piernas) | Muñeco genérico si no hay captura Phaser |
| **Body/hair/uw frames** | Extrae frames idle-south de `human` / `mhr` / `mpt` | A veces solo body sin gear |
| **Composite** (`paperDollCapture.ts`) | Stack pivot-aligned: human → hair → uw → hauberk → pants → boots → helm → armor → shield → cape → weapon | **Si fallan texturas de gear**, cae a nude o a body solo |
| **Slot icons** | Sprites de **inventario** (bolsa) en hotspots del body | Cuando el composite no carga, se ven los íconos de bolsa “pegados” al muñeco → **look horripilante** |

Olympia **no** dibuja el ícono de inventario sobre el body. Dibuja el **mismo sprite de apariencia** que en el mundo (armour pack / weapon pack / shield pack), pivot-aligned, idle facing south.

---

## 2. Cómo lo hace Olympia (descifrado)

Fuente: screenshots que mandaste + `docs/OLYMPIA-F5-CHARACTER-NOTES.md` + layering clásico Helbreath `DrawDialogBox_Character`.

1. **Base humana real** siempre (skin + underwear + hair), never CSS stickman.
2. **Equip** = capas de **player-item appearance** (mismos packs que el world player), no `ItemInventory` icons.
3. **Orden de capas** (idle peace south, dir=4):
   - human body
   - hair
   - underwear
   - cape (atrás en world; F5 a veces cape detrás o delante según arma — mirror world south)
   - boots / leggings / hauberk / armor / helm
   - shield
   - weapon (último)
   - accessory (ángel) opcional encima
4. **Pivot** por frame (`spriteSheetPivots`) — pies anclados, no “centrar el bitmap a ojo”.
5. **Slots laterales** (anillo/cuello/gema) son íconos de UI **fuera** del avatar; body gear no usa ícono de bolsa.
6. Preview se actualiza al equipar/desequipar sin reabrir F5.

Nuestro `paperDollCapture.compositeIdleSouth` ya replica (1)–(4) **si** las texturas `sprite-{name}-{sheet}` están cargadas en Phaser. El fallo de producto es:

- lazy-load incompleto / timing → composite vacío → se ve stickman + bag icons;
- resolvers de gear (`PlayerAppearanceManager.resolveGearFromEquippedItems`) que no mapean todos los itemIds a sprite packs correctos;
- shields con `startSpriteSheetIndex` OOB (ya vimos Merien Shield);
- CSS de slots que todavía pinta `character-paperdoll-slot-img` encima cuando no hay composite confiable.

---

## 3. Plan de implementación (realista, 3 fases)

### Fase A — “siempre figura real” (½–1 día) — **prioridad**

1. **Quitar el stickman CSS** como default visible. Mientras no hay composite: skeleton vacío o spinner “cargando apariencia”, no muñeco de papel.
2. **Garantizar carga de assets** antes de pintar F5:
   - al abrir F5, forzar `loadPlayerItemAppearanceOnDemand` para **todos** los sprites del loadout;
   - reintentar composite hasta timeout corto (p.ej. 2s) o éxito;
   - log de capas que faltan (`[paperdoll] missing texture sprite-X-Y`).
3. **Ghost slots**: si hay `PAPERDOLL_COMPOSITE_KEY`, **nunca** mostrar bag icon en body slots (solo hitbox transparente). Ya hay clase `--ghost`; verificar CSS que el `img` quede `opacity:0` / no render.
4. Smoke test: naked, full plate + weapon + shield, cape, Merien Shield, female/male, 3 skins.

**Criterio de done A:** en F5 se ve un humano real con la ropa del world, sin stickman ni íconos de bolsa en el pecho.

### Fase B — parity visual fina (1–2 días)

1. Alinear **draw order** 1:1 con world idle-south (hoy hay dos órdenes: capture vs CSS BODY_SLOTS).
2. Tint de hair correcto (no multiply barebones).
3. Weapon/shield `startSpriteSheetIndex` desde `Items.json` / effect overrides ( magias especiales, +color ).
4. Escala del stage: Olympia ~90–110px de alto del body en el panel; nosotros a veces oversized/cropped.
5. Cache key = hash(gender, skin, hair, uw, equip uids) — no re-capture cada 1.2s si no cambió nada.

### Fase C — polish Olympia (opcional, 1 día)

1. Dirección del preview (solo south ok para v1).
2. Weapon sheath / bow stance no hace falta en F5.
3. Title/city chrome ya está en Character dialog — no mezclar con paperdoll.

---

## 4. Archivos clave (cuando implementemos)

| Archivo | Rol |
|---------|-----|
| `mp-client/src/utils/paperDollCapture.ts` | Composite pivot + layer list |
| `mp-client/src/ui/components/CharacterPaperDoll.tsx` | React shell + slots |
| `mp-client/src/utils/PlayerAppearanceManager.ts` | itemId → sprite packs |
| `mp-client/src/utils/ItemAssets.ts` | lazy load appearance |
| `mp-client/src/ui/rpg-ui.css` (paperdoll section) | stage size, ghost slots |
| `GameWorld.ts` → `IN_UI_PAPERDOLL_CAPTURE` | trigger desde Phaser |

Server: **no hace falta** para F5 visual (todo client-side con inventory ya sync).

---

## 5. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Sprites de armadura no cargados en lobby | Preload al entrar world + al equip |
| Pivot wrong → floating gear | Reusar pivots del world player; no inventar offsets |
| Merien / packs OOB | Clamp `startSpriteSheetIndex` al max del atlas |
| Performance re-capture 1.2s | Hash + capture solo on equip change |

---

## 6. Estimación

| Fase | Esfuerzo | Deploy |
|------|----------|--------|
| A | 0.5–1 día | client only |
| B | 1–2 días | client only |
| C | opcional | client only |

**Recomendación:** arrancar **solo Fase A** en un PR; validar con screenshots side-by-side Olympia vs CL; después B.

---

## 7. GO / NO-GO

Cuando digas **GO F5**, implemento Fase A completa, build client, deploy `:8081`, y te pido screenshot de un char full gear en F5.

Hasta entonces **no toco** más el paperdoll salvo bugs bloqueantes.
