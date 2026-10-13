#!/usr/bin/env python3
"""Offline sprite bake for the native client. This is a stub, not a runtime tool.

The game client does not run Blender. An artist runs this headless, then a packer
(not part of this skeleton) turns the PNGs into a .spr the asset loader already reads.

    blender -b character.blend -P clients/native/tools/blender/render_sprite_sheet.py -- \\
        --out build/sprites/slm --name slm --scale 4 --frames 32 --directions 8

Output of a finished bake, per direction:
  32 frames at 4x the original pixel size (a 32px Helbreath cell becomes 128px).
  Eight directions. One PNG sheet per direction, plus manifest.json.

This stub checks that it is inside Blender, writes the manifest the loader expects
to see later, and does not render. There is no .blend in this repository.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


DIRECTIONS = 8
FRAMES = 32
SCALE = 4
CELL_PIXELS = 32


def parse_args() -> argparse.Namespace:
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = argv[1:]
    parser = argparse.ArgumentParser(description="Bake a 4x, 32-frame sprite sheet (stub).")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--name", default="creature")
    parser.add_argument("--scale", type=int, default=SCALE)
    parser.add_argument("--frames", type=int, default=FRAMES)
    parser.add_argument("--directions", type=int, default=DIRECTIONS)
    return parser.parse_args(argv)


def main() -> int:
    args = parse_args()
    if args.frames != FRAMES or args.directions != DIRECTIONS or args.scale != SCALE:
        print(
            f"the native pipeline expects {DIRECTIONS} directions, {FRAMES} frames, scale {SCALE}",
            file=sys.stderr,
        )
        return 2
    try:
        import bpy  # noqa: F401
    except ImportError:
        print("run this with Blender: blender -b model.blend -P render_sprite_sheet.py -- --out <dir> --name <id>")
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    frame_px = CELL_PIXELS * args.scale
    manifest = {
        "name": args.name,
        "directions": args.directions,
        "framesPerDirection": args.frames,
        "sourceScale": args.scale,
        "cellPixels": CELL_PIXELS,
        "framePixels": frame_px,
        "sheets": [],
        "note": "stub only: no frames were rendered; this repository has no .blend sources",
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"wrote {args.out / 'manifest.json'} (no pixels; renderer stub)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
