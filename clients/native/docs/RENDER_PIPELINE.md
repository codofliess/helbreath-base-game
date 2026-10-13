# Render pipeline

OpenGL 3.0 is the minimum. The window asks SFML for a 3.3 core context, because a core profile is how portable code gets an OpenGL 3 context (macOS will not create a 3.0 compatibility context). SFML treats the version as a hint. If the driver returns 3.0 or 3.1, shaders are GLSL 1.30. If it returns 3.3 or newer, shaders are `#version 330 core`. Either shader uses the same feature set: a vertex array object, one dynamic vertex buffer, one texture unit, alpha blending, and an orthographic matrix. No uniform buffers, geometry shaders, or compute.

The context created on the Linux llvmpipe run was 4.5 core. The HUD prints that version.

## Sprite batch

Each quad is six vertices (`x, y, u, v, r, g, b, a`). The batch flushes when the texture changes, so ground tiles that share the atlas stay in one draw. Textures use nearest filtering. Blend mode is source alpha, one minus source alpha.

Ground frames used by the loaded map are copied into one atlas. The monster sheet is its own texture. A 1×1 white texture draws the HUD bar and, when a server notice exists, the NFT badge. A small generated ellipse is the shadow under the monster.

## Isometric layers

World pixels are y-down. Two projections live in `core/Projection.hpp`:

- `AuthoredGrid` places cell `(x, y)` at `(x * 32, y * 32)`. That is how these `.spr` tiles were drawn: the isometric look is in the pixels, and the grid is square. `32` is `TILE_SIZE` from `sp-client/docs/MAP_RENDERING.md`, and the ground frames in `tile406-421.spr` are 32×32.
- `Diamond` uses the 2:1 map `((x - y) * 16, (x + y) * 8)`. It is for sheets baked as diamond footprints. The blacksmith art is not that, so the sample uses the grid. Pass `--projection diamond` to see the other path.

Draw order inside a frame:

1. Ground, row by row.
2. Object sprites, sorted by foot row then column. Anchored on the cell center, shifted by the frame pivot.
3. Monster shadow, then the monster, same pivot rule.
4. NFT badges, only for notices already in `NftDropPort`.
5. HUD, in screen pixels, after the world camera.

The camera fits the map content, then wheel and Q/E zoom it. Zoom is a scale on the orthographic bounds, so the batch itself does not special-case zoom.

Monster playback uses the sheet map in `sp-client/docs/MONSTER_MECHANICS.md` (idle sheets 0–7, one per direction) and 10 frames per second, the `GameAsset` default in `sp-client/docs/ANIMATIONS_RENDERING.md`. How many frames are inside the sheet is read from the file. `slm.spr` has 4.
