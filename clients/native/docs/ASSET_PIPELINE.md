# Asset pipeline

Characters and monsters are modelled in 3D and baked offline to sprite sheets. The client only loads the bake. It does not run Blender.

## Offline bake

`tools/blender/render_sprite_sheet.py` is the headless entry point:

```bash
blender -b character.blend -P clients/native/tools/blender/render_sprite_sheet.py -- \
  --out build/sprites/slm --name slm
```

The stub refuses to invent a render. Run outside Blender and it exits. Inside Blender it writes `manifest.json` and no pixels, because this repository has no `.blend` files.

A finished bake is:

| Field | Value |
| --- | --- |
| Directions | 8 |
| Frames per direction | 32 |
| Scale | 4× the original pixel size |
| Cell | 32px in world space, so a cell-sized frame is 128×128 in the sheet |
| Pivot | recorded in the sheet, in source pixels (already ×4) |

The manifest names one PNG sheet per direction. A packer, not written in this skeleton, then stores those sheets in the `.spr` layout documented in `sp-client/docs/SPRITE_FILE_FORMAT.md`: little-endian sheet count, per-sheet frame rectangles (left, top, width, height, pivotX, pivotY), then the PNG bytes. The native reader in `adapters/assets/Sprite.cpp` follows that layout and does not call the browser client's parser.

## What the sample loads today

| Role | Path | Notes |
| --- | --- | --- |
| Map | `sp-client/public/assets/maps/bsmith_1.amd` | 100×100, `TILESIZE = 10` |
| Ground | `sp-client/public/assets/sprites/tile406-421.spr` | sprite indices 418–421 are the blacksmith floor and walls |
| Monster | `sp-client/public/assets/sprites/slm.spr` | 40 sheets, 4 frames each |

World size of a frame is `pixelSize / sourceScale`. Original files use scale 1. PR #126 files use scale 4, so a ×4 rectangle still occupies the original cell. See `AI_UPSCALE.md`.

If the map or the slime file is missing, the loader builds an 8×8 colored grid and a four-frame blob and the HUD says `PLACEHOLDER`.
