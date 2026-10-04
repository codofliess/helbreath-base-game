#!/usr/bin/env python3
"""Definition experiment: x4 Real-ESRGAN on assets already in this repo.

The RRDBNet layout matches xinntao/Real-ESRGAN so the official
RealESRGAN_x4plus.pth checkpoint loads. That project is BSD-3-Clause,
Copyright (c) 2021, Xintao Wang. The weights are not written into the repo.

Usage:
  python upscale_experiment.py --weights /tmp/weights/RealESRGAN_x4plus.pth
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import shutil
import struct
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageDraw, ImageFont

SCALE = 4
ROOT = Path(__file__).resolve().parents[2]
SPRITE_DIR = ROOT / "sp-client/public/assets/sprites"
MAP_PATH = ROOT / "sp-client/public/assets/maps/bsmith_1.amd"
TILE_PACK = ROOT / "sp-client/public/assets/sprites/tile406-421.spr"
TILE_BASE = 406
OUT = Path(__file__).resolve().parent
MONSTERS = ("ant", "bunny", "slm")


class ResidualDenseBlock(nn.Module):
    """BSD-3-Clause architecture from xinntao/Real-ESRGAN (Copyright (c) 2021, Xintao Wang)."""

    def __init__(self, num_feat: int = 64, num_grow_ch: int = 32) -> None:
        super().__init__()
        self.conv1 = nn.Conv2d(num_feat, num_grow_ch, 3, 1, 1)
        self.conv2 = nn.Conv2d(num_feat + num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv3 = nn.Conv2d(num_feat + 2 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv4 = nn.Conv2d(num_feat + 3 * num_grow_ch, num_grow_ch, 3, 1, 1)
        self.conv5 = nn.Conv2d(num_feat + 4 * num_grow_ch, num_feat, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, num_feat: int, num_grow_ch: int = 32) -> None:
        super().__init__()
        self.rdb1 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb2 = ResidualDenseBlock(num_feat, num_grow_ch)
        self.rdb3 = ResidualDenseBlock(num_feat, num_grow_ch)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.rdb3(self.rdb2(self.rdb1(x)))
        return out * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        num_feat = 64
        self.conv_first = nn.Conv2d(3, num_feat, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(num_feat, 32) for _ in range(23)])
        self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_last = nn.Conv2d(num_feat, 3, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


def load_model(weights: Path) -> RRDBNet:
    model = RRDBNet()
    checkpoint = torch.load(weights, map_location="cpu", weights_only=False)
    state = checkpoint["params_ema"] if isinstance(checkpoint, dict) and "params_ema" in checkpoint else checkpoint
    model.load_state_dict(state, strict=True)
    model.eval()
    return model


def read_spr(path: Path) -> list[dict]:
    data = path.read_bytes()
    count = struct.unpack_from("<h", data, 0)[0]
    if count < 0:
        raise ValueError(f"negative sprite count in {path}")
    offset = 2
    metas = []
    for _ in range(count):
        frame_count, image_length, width, height = struct.unpack_from("<hiii", data, offset)
        offset += 14
        offset += 1  # startLocation placeholder
        frames = []
        for _frame in range(frame_count):
            frames.append(struct.unpack_from("<hhhhhh", data, offset))
            offset += 12
        metas.append(
            {
                "image_length": image_length,
                "width": width,
                "height": height,
                "frames": frames,
            }
        )
    sheets = []
    for meta in metas:
        offset += 4  # startLocation
        png = data[offset : offset + meta["image_length"]]
        offset += meta["image_length"]
        if png[:8] != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"sheet in {path} is not a PNG")
        image = Image.open(io.BytesIO(png)).convert("RGBA")
        sheets.append({**meta, "image": image, "png": png})
    return sheets


def write_spr(path: Path, sheets: list[dict]) -> None:
    buffer = bytearray()
    buffer += struct.pack("<h", len(sheets))
    encoded = []
    for sheet in sheets:
        png = png_bytes(sheet["image"])
        frames = sheet["frames"]
        for value in frames:
            for item in value:
                if item < -32768 or item > 32767:
                    raise ValueError(f"frame value {item} does not fit in int16")
        width, height = sheet["image"].size
        buffer += struct.pack("<h", len(frames))
        buffer += struct.pack("<i", len(png))
        buffer += struct.pack("<ii", width, height)
        buffer += struct.pack("<B", 0)
        for frame in frames:
            buffer += struct.pack("<hhhhhh", *frame)
        encoded.append(png)
    for png in encoded:
        buffer += struct.pack("<i", 0)
        buffer += png
    path.write_bytes(buffer)


def png_bytes(image: Image.Image) -> bytes:
    payload = io.BytesIO()
    image.save(payload, format="PNG", optimize=True)
    return payload.getvalue()


def bleed_rgb(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Fill transparent pixels from neighboring opaque colors so the RGB model has no empty holes."""
    out = rgb.copy()
    filled = alpha > 0
    if not filled.any() or filled.all():
        return out
    height, width = filled.shape
    for _ in range(max(height, width)):
        grew = False
        for y_shift, x_shift in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            source = np.zeros_like(filled)
            source_rgb = np.zeros_like(out)
            y_src_start = max(0, -y_shift)
            y_src_end = height - max(0, y_shift)
            x_src_start = max(0, -x_shift)
            x_src_end = width - max(0, x_shift)
            y_dst_start = max(0, y_shift)
            y_dst_end = height - max(0, -y_shift)
            x_dst_start = max(0, x_shift)
            x_dst_end = width - max(0, -x_shift)
            source[y_dst_start:y_dst_end, x_dst_start:x_dst_end] = filled[y_src_start:y_src_end, x_src_start:x_src_end]
            source_rgb[y_dst_start:y_dst_end, x_dst_start:x_dst_end] = out[y_src_start:y_src_end, x_src_start:x_src_end]
            take = source & ~filled
            if take.any():
                out[take] = source_rgb[take]
                filled |= take
                grew = True
        if not grew or filled.all():
            break
    return out


def palette_of(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    if not (alpha > 0).any():
        return np.zeros((1, 3), np.uint8)
    colors = rgb[alpha > 0]
    return np.unique(colors.reshape(-1, 3), axis=0)


def snap_palette(rgb: np.ndarray, alpha: np.ndarray, palette: np.ndarray) -> np.ndarray:
    snapped = np.zeros_like(rgb)
    opaque = alpha > 0
    if not opaque.any():
        return snapped
    pixels = rgb[opaque].astype(np.int16)
    table = palette.astype(np.int16)
    chosen = np.empty((pixels.shape[0], 3), np.uint8)
    step = 2048
    for start in range(0, pixels.shape[0], step):
        chunk = pixels[start : start + step]
        distance = ((chunk[:, None, :] - table[None, :, :]) ** 2).sum(axis=2)
        chosen[start : start + chunk.shape[0]] = table[distance.argmin(axis=1)]
    snapped[opaque] = chosen
    return snapped


def upscale_rgba(model: RRDBNet, image: Image.Image) -> tuple[Image.Image, dict]:
    array = np.array(image.convert("RGBA"))
    rgb = array[:, :, :3]
    alpha = array[:, :, 3]
    if not np.isin(alpha, (0, 255)).all():
        raise ValueError("expected binary transparency (0 or 255)")
    palette = palette_of(rgb, alpha)
    nearest_alpha = np.array(
        Image.fromarray(alpha, mode="L").resize((alpha.shape[1] * SCALE, alpha.shape[0] * SCALE), Image.Resampling.NEAREST)
    )
    if not (alpha > 0).any():
        rgba = np.dstack([np.zeros((*nearest_alpha.shape, 3), np.uint8), nearest_alpha])
        stats = {"palette": 0, "mean_abs_vs_nearest": 0.0, "mean_colors_per_block": 0.0}
        return Image.fromarray(rgba, mode="RGBA"), stats

    bled = bleed_rgb(rgb, alpha)
    tensor = torch.from_numpy(bled).permute(2, 0, 1).unsqueeze(0).to(dtype=torch.float32).div_(255.0)
    with torch.inference_mode():
        predicted = model(tensor)
    predicted_rgb = (
        predicted.squeeze(0).clamp(0, 1).mul(255).round().to(torch.uint8).permute(1, 2, 0).cpu().numpy()
    )
    if predicted_rgb.shape[0] != rgb.shape[0] * SCALE or predicted_rgb.shape[1] != rgb.shape[1] * SCALE:
        raise ValueError(f"model output {predicted_rgb.shape} is not exactly x{SCALE}")
    snapped = snap_palette(predicted_rgb, nearest_alpha, palette)
    rgba = np.dstack([snapped, nearest_alpha])

    nearest_rgb = np.repeat(np.repeat(rgb, SCALE, axis=0), SCALE, axis=1)
    opaque = nearest_alpha > 0
    difference = np.abs(snapped.astype(np.int16) - nearest_rgb.astype(np.int16))[opaque].mean() if opaque.any() else 0.0
    block_colors = mean_colors_per_block(snapped, nearest_alpha)
    invented = colors_outside_palette(snapped, nearest_alpha, palette)
    if invented:
        raise ValueError(f"palette snap left {invented} colors outside the source palette")
    if not np.array_equal(nearest_alpha, rgba[:, :, 3]):
        raise ValueError("alpha was not preserved")
    stats = {
        "palette": int(palette.shape[0]),
        "mean_abs_vs_nearest": round(float(difference), 3),
        "mean_colors_per_block": round(float(block_colors), 3),
    }
    return Image.fromarray(rgba, mode="RGBA"), stats


def mean_colors_per_block(rgb: np.ndarray, alpha: np.ndarray) -> float:
    height, width = alpha.shape
    usable_h = height - (height % SCALE)
    usable_w = width - (width % SCALE)
    if usable_h == 0 or usable_w == 0:
        return 0.0
    colors = []
    view_rgb = rgb[:usable_h, :usable_w]
    view_alpha = alpha[:usable_h, :usable_w]
    blocks_y = usable_h // SCALE
    blocks_x = usable_w // SCALE
    for y in range(blocks_y):
        row = view_rgb[y * SCALE : (y + 1) * SCALE]
        row_alpha = view_alpha[y * SCALE : (y + 1) * SCALE]
        for x in range(blocks_x):
            mask = row_alpha[:, x * SCALE : (x + 1) * SCALE] > 0
            if not mask.any():
                continue
            block = row[:, x * SCALE : (x + 1) * SCALE][mask]
            colors.append(np.unique(block.reshape(-1, 3), axis=0).shape[0])
    if not colors:
        return 0.0
    return float(np.mean(colors))


def colors_outside_palette(rgb: np.ndarray, alpha: np.ndarray, palette: np.ndarray) -> int:
    if not (alpha > 0).any():
        return 0
    used = np.unique(rgb[alpha > 0].reshape(-1, 3), axis=0)
    palette_set = {tuple(color) for color in palette.tolist()}
    return sum(1 for color in used.tolist() if tuple(color) not in palette_set)


def scale_frames(frames: list[tuple], image: Image.Image) -> list[tuple]:
    scaled = []
    width, height = image.size
    for left, top, frame_w, frame_h, pivot_x, pivot_y in frames:
        item = (left * SCALE, top * SCALE, frame_w * SCALE, frame_h * SCALE, pivot_x * SCALE, pivot_y * SCALE)
        if item[0] < 0 or item[1] < 0 or item[0] + item[2] > width or item[1] + item[3] > height:
            raise ValueError(f"scaled frame {item} falls outside {width}x{height}")
        scaled.append(item)
    return scaled


def upscale_monster(model: RRDBNet, name: str) -> dict:
    source = SPRITE_DIR / f"{name}.spr"
    sheets = read_spr(source)
    output_sheets = []
    stats = []
    for index, sheet in enumerate(sheets):
        image, sheet_stats = upscale_rgba(model, sheet["image"])
        output_sheets.append({"image": image, "frames": scale_frames(sheet["frames"], image)})
        stats.append(sheet_stats)
        print(f"  {name} sheet {index + 1}/{len(sheets)} {sheet['image'].size} -> {image.size}", flush=True)
    destination = OUT / "after" / f"{name}.spr"
    write_spr(destination, output_sheets)
    reread = read_spr(destination)
    if len(reread) != len(sheets):
        raise ValueError(f"{name} round-trip sheet count mismatch")
    return {
        "name": name,
        "source": str(source.relative_to(ROOT)),
        "before_bytes": source.stat().st_size,
        "after_bytes": destination.stat().st_size,
        "sheets": len(sheets),
        "mean_abs_vs_nearest": round(float(np.mean([item["mean_abs_vs_nearest"] for item in stats])), 3),
        "mean_colors_per_block": round(float(np.mean([item["mean_colors_per_block"] for item in stats])), 3),
        "max_palette": max(item["palette"] for item in stats),
    }


def load_map() -> tuple[int, int, list[tuple[int, int, int, int]]]:
    data = MAP_PATH.read_bytes()
    header = data[:256].replace(b"\x00", b" ").decode("ascii", "replace").split()
    values = {}
    for index, token in enumerate(header):
        if token in ("MAPSIZEX", "MAPSIZEY", "TILESIZE") and index + 2 < len(header):
            values[token] = int(header[index + 2])
    size_x = values["MAPSIZEX"]
    size_y = values["MAPSIZEY"]
    tile_size = values["TILESIZE"]
    if tile_size != 10:
        raise ValueError(f"unexpected TILESIZE {tile_size}")
    tiles = []
    offset = 256
    for _y in range(size_y):
        for _x in range(size_x):
            tiles.append(struct.unpack_from("<hhhh", data, offset))
            offset += tile_size
    return size_x, size_y, tiles


def content_bounds(size_x: int, tiles: list[tuple[int, int, int, int]]) -> tuple[int, int, int, int]:
    points = [(index % size_x, index // size_x) for index, tile in enumerate(tiles) if tile[0] > 0]
    xs = [point[0] for point in points]
    ys = [point[1] for point in points]
    return min(xs), min(ys), max(xs), max(ys)


def upscale_map(model: RRDBNet) -> dict:
    size_x, size_y, tiles = load_map()
    x0, y0, x1, y1 = content_bounds(size_x, tiles)
    used: dict[tuple[int, int], None] = {}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            sprite, frame, _object_sprite, _object_frame = tiles[y * size_x + x]
            if sprite > 0:
                used[(sprite, frame)] = None
    sheets = read_spr(TILE_PACK)
    output_sheets = []
    abs_values = []
    block_values = []
    for sprite in range(418, 422):
        sheet = sheets[sprite - TILE_BASE]
        base = np.array(sheet["image"].resize((sheet["image"].width * SCALE, sheet["image"].height * SCALE), Image.Resampling.NEAREST))
        used_frames = [frame for (spr, frame) in used if spr == sprite]
        print(f"  map sprite {sprite}: {len(used_frames)} used frames", flush=True)
        for frame_index in used_frames:
            left, top, frame_w, frame_h, _pivot_x, _pivot_y = sheet["frames"][frame_index]
            crop = sheet["image"].crop((left, top, left + frame_w, top + frame_h))
            upscaled, stats = upscale_rgba(model, crop)
            if upscaled.size != (frame_w * SCALE, frame_h * SCALE):
                raise ValueError("tile upscale size mismatch")
            base[top * SCALE : (top + frame_h) * SCALE, left * SCALE : (left + frame_w) * SCALE] = np.array(upscaled)
            abs_values.append(stats["mean_abs_vs_nearest"])
            block_values.append(stats["mean_colors_per_block"])
        output_sheets.append(
            {
                "image": Image.fromarray(base, mode="RGBA"),
                "frames": scale_frames(sheet["frames"], Image.fromarray(base, mode="RGBA")),
            }
        )
    destination = OUT / "after" / "bsmith-tile418-421-x4.spr"
    write_spr(destination, output_sheets)
    reread = read_spr(destination)
    if len(reread) != 4:
        raise ValueError("map sprite round-trip failed")
    return {
        "map": "sp-client/public/assets/maps/bsmith_1.amd",
        "tile_pack": "sp-client/public/assets/sprites/tile406-421.spr",
        "tile_pack_bytes": TILE_PACK.stat().st_size,
        "map_bytes": MAP_PATH.stat().st_size,
        "map_sha256": hashlib.sha256(MAP_PATH.read_bytes()).hexdigest(),
        "after_sha256": hashlib.sha256((OUT / "after" / "bsmith_1.amd").read_bytes()).hexdigest(),
        "after_tile_bytes": destination.stat().st_size,
        "map_size": [size_x, size_y],
        "content_bounds_tiles": [x0, y0, x1, y1],
        "content_tiles": [(x1 - x0 + 1), (y1 - y0 + 1)],
        "used_frames": len(used),
        "sprites": [418, 419, 420, 421],
        "mean_abs_vs_nearest": round(float(np.mean(abs_values)), 3) if abs_values else 0,
        "mean_colors_per_block": round(float(np.mean(block_values)), 3) if block_values else 0,
    }


def checkerboard(width: int, height: int, cell: int = 8) -> Image.Image:
    y_index, x_index = np.indices((height, width))
    on = ((y_index // cell) + (x_index // cell)) % 2 == 0
    image = np.zeros((height, width, 4), np.uint8)
    image[on] = (48, 48, 52, 255)
    image[~on] = (28, 28, 32, 255)
    return Image.fromarray(image, mode="RGBA")


def composite_over_checker(image: Image.Image) -> Image.Image:
    board = checkerboard(image.width, image.height)
    board.alpha_composite(image)
    return board.convert("RGB")


def font(size: int) -> ImageFont.ImageFont:
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)


def side_by_side(left: Image.Image, right: Image.Image, title: str, left_label: str, right_label: str) -> Image.Image:
    if left.size != right.size:
        raise ValueError(f"comparison panels differ: {left.size} vs {right.size}")
    header = 64
    gap = 12
    canvas = Image.new("RGB", (left.width * 2 + gap, left.height + header), (16, 16, 18))
    draw = ImageDraw.Draw(canvas)
    draw.text((16, 8), title, fill=(235, 235, 235), font=font(22))
    draw.text((16, 36), left_label, fill=(180, 210, 180), font=font(18))
    draw.text((left.width + gap + 16, 36), right_label, fill=(210, 190, 150), font=font(18))
    canvas.paste(left, (0, header))
    canvas.paste(right, (left.width + gap, header))
    return canvas


def render_map_region(sheets: list[dict], tiles, size_x: int, bounds, scale: int) -> Image.Image:
    x0, y0, x1, y1 = bounds
    width = (x1 - x0 + 1) * 32 * scale
    height = (y1 - y0 + 1) * 32 * scale
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    by_sprite = {418 + index: sheet for index, sheet in enumerate(sheets)}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            sprite, frame, _object_sprite, _object_frame = tiles[y * size_x + x]
            if sprite <= 0:
                continue
            sheet = by_sprite[sprite]
            left, top, frame_w, frame_h, _pivot_x, _pivot_y = sheet["frames"][frame]
            crop = sheet["image"].crop((left, top, left + frame_w, top + frame_h))
            canvas.alpha_composite(crop, ((x - x0) * 32 * scale, (y - y0) * 32 * scale))
    return canvas


def monster_contact(name: str) -> None:
    before = read_spr(SPRITE_DIR / f"{name}.spr")
    after = read_spr(OUT / "after" / f"{name}.spr")
    rows = []
    # First action is eight direction strips. Sheet 8 is the next action's first direction.
    for index in (0, 1, 2, 3, 4, 5, 6, 7, 8):
        original = before[index]["image"]
        enlarged = original.resize((original.width * SCALE, original.height * SCALE), Image.Resampling.NEAREST)
        upscaled = after[index]["image"]
        if enlarged.size != upscaled.size:
            raise ValueError(f"{name} sheet {index} size diverged")
        rows.append((composite_over_checker(enlarged), composite_over_checker(upscaled)))
    width = max(row[0].width for row in rows)
    height = sum(row[0].height for row in rows) + 4 * (len(rows) - 1)
    left = Image.new("RGB", (width, height), (12, 12, 12))
    right = Image.new("RGB", (width, height), (12, 12, 12))
    y = 0
    for original, upscaled in rows:
        left.paste(original, (0, y))
        right.paste(upscaled, (0, y))
        y += original.height + 4
    image = side_by_side(
        left,
        right,
        f"{name}.spr  ·  directions 0–7 and next action",
        "original, nearest-neighbor x4",
        "Real-ESRGAN x4, source palette and alpha",
    )
    image.save(OUT / "compare" / f"upscale-monster-{name}.png")


def map_comparisons() -> None:
    size_x, _size_y, tiles = load_map()
    bounds = content_bounds(size_x, tiles)
    original_pack = read_spr(TILE_PACK)
    original_sheets = [original_pack[sprite - TILE_BASE] for sprite in (418, 419, 420, 421)]
    # Render at 1x from the original frames, then nearest-neighbor the whole picture.
    original = render_map_region(original_sheets, tiles, size_x, bounds, scale=1)
    original_x4 = original.resize((original.width * SCALE, original.height * SCALE), Image.Resampling.NEAREST)
    upscaled_sheets = read_spr(OUT / "after" / "bsmith-tile418-421-x4.spr")
    upscaled = render_map_region(upscaled_sheets, tiles, size_x, bounds, scale=SCALE)
    if original_x4.size != upscaled.size:
        raise ValueError("map comparison sizes differ")
    full = side_by_side(
        original_x4.convert("RGB"),
        upscaled.convert("RGB"),
        "bsmith_1.amd content  ·  tile sprites 418–421",
        "original tiles, nearest-neighbor x4",
        "used tiles Real-ESRGAN x4, same frame grid",
    )
    full.save(OUT / "compare" / "upscale-map-bsmith.png")

    # Central 8×6 tiles, shown 1:1 so the review is not only a shrunken full map.
    x0, y0, x1, y1 = bounds
    crop_bounds = (x0 + 8, y0 + 6, x0 + 15, y0 + 11)
    zoom_original = render_map_region(original_sheets, tiles, size_x, crop_bounds, scale=1).resize(
        ((crop_bounds[2] - crop_bounds[0] + 1) * 32 * SCALE, (crop_bounds[3] - crop_bounds[1] + 1) * 32 * SCALE),
        Image.Resampling.NEAREST,
    )
    zoom_upscaled = render_map_region(upscaled_sheets, tiles, size_x, crop_bounds, scale=SCALE)
    zoom = side_by_side(
        zoom_original.convert("RGB"),
        zoom_upscaled.convert("RGB"),
        f"bsmith_1 zoom  ·  map tiles x {crop_bounds[0]}–{crop_bounds[2]}, y {crop_bounds[1]}–{crop_bounds[3]}",
        "original, nearest-neighbor x4",
        "Real-ESRGAN x4, source palette and alpha",
    )
    zoom.save(OUT / "compare" / "upscale-map-bsmith-zoom.png")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, required=True)
    args = parser.parse_args()
    if not args.weights.is_file():
        raise SystemExit(f"weights not found: {args.weights}")
    for folder in ("before", "after", "compare"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)
    for name in MONSTERS:
        shutil.copy2(SPRITE_DIR / f"{name}.spr", OUT / "before" / f"{name}.spr")
    shutil.copy2(MAP_PATH, OUT / "before" / "bsmith_1.amd")
    shutil.copy2(MAP_PATH, OUT / "after" / "bsmith_1.amd")

    torch.set_num_threads(4)
    print("loading RealESRGAN_x4plus", flush=True)
    model = load_model(args.weights)
    monsters = []
    for name in MONSTERS:
        print(f"monster {name}", flush=True)
        monsters.append(upscale_monster(model, name))
    print("map bsmith_1", flush=True)
    map_stats = upscale_map(model)
    print("comparisons", flush=True)
    for name in MONSTERS:
        monster_contact(name)
    map_comparisons()
    report = {"scale": SCALE, "monsters": monsters, "map": map_stats}
    (OUT / "sizes.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
