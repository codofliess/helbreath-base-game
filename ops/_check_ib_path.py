#!/usr/bin/env python3
"""Walkability audit for Middleland → Icebound approach."""
from __future__ import annotations

import re
import struct
from collections import deque
from pathlib import Path

AMD = Path(__file__).resolve().parents[1] / "multiplayer/server/Config/maps/middleland.amd"
HEADER = 256
WATER, SHORE = 19, 18
BLOCKED, TELE = 0x80, 0x40


def load(path: Path):
    data = path.read_bytes()
    header = data[:HEADER].decode("ascii", errors="ignore").replace("\0", " ")
    sx = int(re.search(r"MAPSIZEX\s*=\s*(\d+)", header).group(1))
    sy = int(re.search(r"MAPSIZEY\s*=\s*(\d+)", header).group(1))
    ts = int(re.search(r"TILESIZE\s*=\s*(\d+)", header).group(1))
    return data, sx, sy, ts


def tile(data, sx, sy, ts, x, y):
    off = HEADER + (y * sx + x) * ts
    sprite = struct.unpack_from("<h", data, off)[0]
    flags = data[off + 8]
    wet = sprite in (WATER, SHORE)
    blocked_flag = bool(flags & BLOCKED)
    tele = bool(flags & TELE)
    walk = not blocked_flag and not wet
    return sprite, flags, blocked_flag, tele, wet, walk


def main():
    data, sx, sy, ts = load(AMD)
    print(f"map {sx}x{sy} tileSize={ts}")

    def show(x, y, label=""):
        sprite, flags, bf, tele, wet, walk = tile(data, sx, sy, ts, x, y)
        print(
            f"  {label}({x},{y}) spr={sprite} flags=0x{flags:02x} "
            f"blockedFlag={bf} tele={tele} wet={wet} walk={walk}"
        )

    print("=== 458,249 and 3x3 ===")
    for dy in range(-2, 3):
        row = []
        for dx in range(-2, 3):
            *_, walk = tile(data, sx, sy, ts, 458 + dx, 249 + dy)
            _, _, _, tele, wet, walk = tile(data, sx, sy, ts, 458 + dx, 249 + dy)
            row.append("T" if tele else ("." if walk else ("W" if wet else "#")))
        print(f"y={249+dy}: {''.join(row)}")
    show(458, 249, "focus ")

    print("=== IB pad region 448-460 x 275-290 (T tele . walk W wet # block) ===")
    for y in range(275, 291):
        row = []
        for x in range(448, 461):
            _, _, _, tele, wet, walk = tile(data, sx, sy, ts, x, y)
            row.append("T" if tele else ("." if walk else ("W" if wet else "#")))
        print(f"y={y}: {''.join(row)}")

    print("=== AMD tele-flag cells 440-470 x 270-295 ===")
    for y in range(270, 296):
        for x in range(440, 471):
            sprite, flags, bf, tele, wet, walk = tile(data, sx, sy, ts, x, y)
            if tele:
                print(f"  tele ({x},{y}) spr={sprite} walk={walk} wet={wet} blockFlag={bf}")

    # BFS walkability (server rules: blocked flag OR wet)
    def walkable(x, y):
        if x < 0 or y < 0 or x >= sx or y >= sy:
            return False
        *_, walk = tile(data, sx, sy, ts, x, y)
        return walk

    def bfs(start, goal, box):
        q = deque([start])
        seen = {start}
        while q:
            x, y = q.popleft()
            if (x, y) == goal:
                return True, len(seen)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n in seen:
                    continue
                nx, ny = n
                if not (box[0] <= nx <= box[1] and box[2] <= ny <= box[3]):
                    continue
                if not walkable(nx, ny):
                    continue
                seen.add(n)
                q.append(n)
        return False, len(seen)

    box = (400, 480, 230, 320)
    for start, goal, name in [
        ((430, 260), (452, 281), "mainland→IB pad"),
        ((430, 260), (458, 249), "mainland→458,249"),
        ((458, 249), (452, 281), "458,249→IB pad"),
        ((450, 250), (452, 281), "near island→pad"),
    ]:
        ok, n = bfs(start, goal, box)
        print(f"BFS {name} {start}->{goal}: reachable={ok} visited={n}")

    # Find nearest walkable to 458,249
    print("=== nearest walkable to 458,249 ===")
    best = None
    for r in range(0, 25):
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                if max(abs(dx), abs(dy)) != r:
                    continue
                x, y = 458 + dx, 249 + dy
                if walkable(x, y):
                    best = (x, y, r)
                    break
            if best:
                break
        if best:
            break
    print(" nearest", best)
    show(458, 249)
    if best:
        show(best[0], best[1], "nearest ")

    # Classic AMD only (ignore wet block) — would shore allow path?
    def walkable_classic(x, y):
        if x < 0 or y < 0 or x >= sx or y >= sy:
            return False
        sprite, flags, bf, tele, wet, walk = tile(data, sx, sy, ts, x, y)
        return not bf  # only blocked flag, shore walkable

    def bfs_classic(start, goal, box):
        q = deque([start])
        seen = {start}
        while q:
            x, y = q.popleft()
            if (x, y) == goal:
                return True, len(seen)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                n = (x + dx, y + dy)
                if n in seen:
                    continue
                nx, ny = n
                if not (box[0] <= nx <= box[1] and box[2] <= ny <= box[3]):
                    continue
                if not walkable_classic(nx, ny):
                    continue
                seen.add(n)
                q.append(n)
        return False, len(seen)

    print("=== classic AMD (shore walkable) BFS ===")
    for start, goal, name in [
        ((430, 260), (452, 281), "mainland→IB pad"),
        ((430, 260), (458, 249), "mainland→458,249"),
        ((458, 249), (452, 281), "458,249→IB pad"),
    ]:
        ok, n = bfs_classic(start, goal, box)
        print(f"  classic {name}: reachable={ok} visited={n}")


if __name__ == "__main__":
    main()
