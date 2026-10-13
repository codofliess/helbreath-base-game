# AI upscale feed

PR #126 (`experiments/upscale-2026-10-04/`, branch `cursor/upscale-definition-experiment-d3d1`, not merged) is the base. It ran Real-ESRGAN `RealESRGAN_x4plus` (BSD 3-Clause, Copyright (c) 2021, Xintao Wang) on assets already in this repo. Weights are not in the repo. Scale is the model's native 4×.

## Files the experiment wrote

| Output | Meaning |
| --- | --- |
| `after/bsmith_1.amd` | Same bytes as `sp-client/public/assets/maps/bsmith_1.amd`. The map is an index grid; pixels live in the sprite pack. |
| `after/bsmith-tile418-421-x4.spr` | Four sheets, sprite indices 418–421, frame rectangles and pivots multiplied by 4. |
| `after/slm.spr`, `after/ant.spr`, `after/bunny.spr` | Whole sheets scaled by 4. Direction strips stay aligned. Still the original frame count (4 per sheet for the slime), not 32. |

Alpha stayed binary. Opaque colors were snapped back onto colors that already existed in that source image. The PR's own write-up says this is a filter, not new authored detail.

## How this client consumes them

`loadSample` looks for those `after/` paths before the originals:

- If `after/bsmith-tile418-421-x4.spr` and `after/bsmith_1.amd` exist, ground uses them with index base 418 (the experiment pack contains only those four sprites, as sheets 0–3) and `sourceScale = 4`.
- If `after/slm.spr` exists, the slime uses it with `sourceScale = 4`.
- Otherwise the original `tile406-421.spr` (index base 406) and `slm.spr` are used at scale 1.

`appendIsoFrame` divides width, height, and pivot by `sourceScale` before drawing. The world grid stays 32px. That is the correction the PR called out: the browser client would draw the ×4 rectangles at ×4 size because it treats pivots as pixels and blits ground into a 32×32 slot. This client keeps the grid and only uses the extra pixels as texture detail.

This checkout of `master` does not contain `experiments/`. The first frame therefore uses the original files. Dropping the PR's `after/` tree into the repo is enough for the loader to switch; no code change is required.

The 32-frame, 3D-baked sheets in `ASSET_PIPELINE.md` are a different source. They are not what PR #126 produced. When those sheets exist they should be packed the same way (rectangles already in ×4 pixels, `sourceScale` 4) so this loader can draw them on the same grid.
