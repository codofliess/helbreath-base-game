# What is missing for the first real 4× map and monster

The window already shows a real map and a real monster at the original resolution: blacksmith `bsmith_1.amd` with `tile406-421.spr`, and slime `slm.spr` on a walkable cell. That art is isometric in the pixels and sits on the 32px grid. It is not the 3D bake described in `ASSET_PIPELINE.md`.

These are absent, so that bake is not on screen:

1. No Blender scene. `tools/blender/render_sprite_sheet.py` has nothing to render. A creature needs a `.blend` (or equivalent) with a rig that can face 8 directions.
2. No baked sheet with 32 frames per direction at 4× (128px per original 32px cell), and no `manifest.json` from a real bake.
3. No packer from those PNGs into `.spr` with pivots. The runtime reader is ready for that layout once the file exists.
4. PR #126's 4× outputs are not on `master` (`experiments/upscale-2026-10-04/after/`). They are also the old frame count run through Real-ESRGAN, not a 32-frame 3D render. If that tree is checked out beside this client, the loader will draw it at 1/4 size. The PR itself says the filter does not match a re-authored HD pass.
5. `bsmith_1.amd` has ground sprites only (indices 418–421). Object sprite is 0 on every cell, so there is no furniture or tree layer to load. An outdoor map such as `aresden.amd` also needs `maptiles1.spr`, `trees1.spr`, and the object packs, with their index bases. Those files are in the repo; this first frame does not reference them.
6. No cNFT badge texture. The badge is a flat quad, and it draws only after `NftDropPort` receives a server notice. `network.proto` has no such notice yet, on purpose: the server was not changed.
7. `docs/MASTERPLAN.md` and `middleware-node/{market,hell,mint}.js` are not in the repo, so the economy ports have no numbers. See `ECONOMY.md`.

If `bsmith_1.amd` or `slm.spr` is missing at runtime, the client draws an 8×8 placeholder grid and a four-frame blob instead of failing the window.
