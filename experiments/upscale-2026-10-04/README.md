# Upscale experiment, 4 Oct 2026

Definition test. These files are not wired into the client, and they do not replace production sprites or maps.

## License of the tool and the weights

Real-ESRGAN, BSD 3-Clause, Copyright (c) 2021, Xintao Wang.

- Code license, verified from the raw file before the run: https://github.com/xinntao/Real-ESRGAN/blob/master/LICENSE
- Weights actually loaded: `RealESRGAN_x4plus.pth` from https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth (release v0.1.0, which stores the pre-trained models). The same file is described as BSD 3-Clause at https://huggingface.co/amd/realesrgan-x4plus
- BSD 3-Clause allows commercial use. No non-commercial clause. The anime checkpoint and waifu2x were not used.
- The weight file is not in this repo. The full license text is `REALESRGAN-BSD.txt`.

Scale is 4×, the native factor of `RealESRGAN_x4plus`.

## Sources, all already in this repo

| Role | Path |
| --- | --- |
| Map | `sp-client/public/assets/maps/bsmith_1.amd` |
| Tiles | `sp-client/public/assets/sprites/tile406-421.spr` sheets for indices 418–421 |
| Monsters | `sp-client/public/assets/sprites/ant.spr`, `bunny.spr`, `slm.spr` |

The drawn part of `bsmith_1` is the 24×18 block from tile (30, 23) to (53, 40): 290 frames. The `.amd` is an index grid. `after/bsmith_1.amd` matches the source byte for byte (`sha256 f17f393db7f1875bd1f9470f8dbd9364835889f4c867829394c382a4d03828ec`).

Alpha on these assets is only 0 or 255. The output alpha is that mask, nearest-neighbor ×4. Opaque colors are snapped to colors that already existed in that source image. Frame rectangles and pivots are multiplied by 4. Monster sheets were scaled whole, so direction strips stay in register. Used map tiles were pasted back at `left*4, top*4`. Unused frames on those four sheets are nearest-neighbor ×4 so the old frame index still hits the same cell.

## Disk size of each pair

| Pair | Before | After |
| --- | ---: | ---: |
| `ant.spr` | 58,051 | 343,942 |
| `bunny.spr` | 112,021 | 1,237,587 |
| `slm.spr` | 96,921 | 1,628,786 |
| `bsmith_1.amd` | 100,256 | 100,256 (same file) |
| Tile sheets 418–421 | 184,329 bytes of PNG inside the 1,150,764-byte 16-sheet pack | 4,349,260 bytes in `after/bsmith-tile418-421-x4.spr` |

## Would the current client load these with no code change?

**Monsters: yes.** `HBSprite.parseSprite` accepts a decodable PNG and int16 frame rectangles. It does not cap bitmap size. These sheets fit in int16 (largest here 936×208). The live client does not request `experiments/`. If these bytes replaced the current filenames, the loader would register them and `GameAsset` would draw them at 4× world size, because width, height, and pivots are pixels while the ground grid stays 32.

**Map: no.** `HBMap` loads `.amd` indices, and this `.amd` did not change. The new pixels are a 4-sheet `.spr` the catalog does not name. The live pack is the 16-sheet `tile406-421.spr`. Even if the larger bitmaps were spliced into that pack, `renderMapTiles` blits every ground frame into a 32×32 slot (`TILE_SIZE`). The extra pixels would be discarded. No client code was changed to avoid that.

## Quality

Public reference, looked at only: the Steam page for app 5243580 and the comparison scenes on helbreathevolution.com. Those images were not downloaded into this repo and were not model input.

That HD bar is re-authored art at about four times the pixels: hard edges, materials that separate, local light and shadow, creatures with volume. The Evolution page says it is not a filter. Steam says some sprites were AI-upscaled and then reviewed by the developer.

This run is the filter, with no review pass. The blacksmith is still the same room, on the same grid, with soft noisy edges (about 4.7 source colors per original pixel, mean absolute error about 10 versus nearest ×4). The ant keeps its silhouette and strips, with broken outlines (error about 80, about 4.2 colors per block). The bunny is the noisiest (error about 138, about 7.9 colors per block) because some sheets already hold hundreds of colors, so the palette snap barely constrains the model. The slime moves less (error about 12) but its flat fill still breaks up. None of them grow new authored detail. They are not close to those public screenshots.

## Findings

1. Not the HD bar. Those public pictures are new edges, materials, and light. This is the old drawing, enlarged, then snapped onto its own colors.
2. Palette lock held. No new opaque colors. On the bunny the source palette is wide enough that the lock barely helps.
3. Transparency stayed binary and pixel-aligned.
4. Monster frame rectangles and pivots are exactly ×4, so the direction strips stay registered.
5. The 290 blacksmith frames were pasted back on the ×4 grid. The room still composes.
6. Monster outlines got worse: one source pixel becomes several palette colors.
7. The map moved less than the monsters and still gained no new stonework or light.
8. Files got much larger without becoming easier to read.

## no pude juzgar

- The client was not booted, so this was not seen in motion. The load answer is from the loader and the 32px map blit.
- Attack, hit, and death were not played. Contact sheets show strips 0–7 and sheet 8.
- No outdoor city map was upscaled.
- The Steam and Evolution shots were only looked at. Their source files were not measured.
- No artist cleanup pass was tried.
- Characters, items, UI, and spells were not part of this run.

Comparisons, left = original nearest ×4, right = this experiment:

- `compare/upscale-map-bsmith.png`
- `compare/upscale-map-bsmith-zoom.png`
- `compare/upscale-monster-ant.png`
- `compare/upscale-monster-bunny.png`
- `compare/upscale-monster-slm.png`
