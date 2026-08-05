#!/usr/bin/env python3
import re, struct
from collections import deque
from pathlib import Path

AMD = Path(r"C:\Users\54116\helbreath-base-game\multiplayer\server\Config\maps\middleland.amd")
data = AMD.read_bytes()
header = data[:256].decode("ascii", "ignore").replace("\0", " ")
sx = int(re.search(r"MAPSIZEX\s*=\s*(\d+)", header).group(1))
sy = int(re.search(r"MAPSIZEY\s*=\s*(\d+)", header).group(1))
ts = int(re.search(r"TILESIZE\s*=\s*(\d+)", header).group(1))
WATER, SHORE = 19, 18


def tile(x, y):
    off = 256 + (y * sx + x) * ts
    sprite = struct.unpack_from("<h", data, off)[0]
    flags = data[off + 8]
    wet = sprite in (WATER, SHORE)
    bf = bool(flags & 0x80)
    tele = bool(flags & 0x40)
    walk_srv = (not bf) and (not wet)
    walk_classic = not bf
    return sprite, flags, bf, tele, wet, walk_srv, walk_classic, sprite == SHORE, sprite == WATER


def dump(x, y):
    s, f, bf, tele, wet, ws, wc, sh, wa = tile(x, y)
    print(
        f"({x},{y}) spr={s} fl=0x{f:02x} bf={bf} tele={tele} shore={sh} water={wa} walkSrv={ws} walkCl={wc}"
    )


print("start 430,260:")
dump(430, 260)
print("walkable near 430,260 (srv):")
for r in range(0, 30):
    found = []
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if max(abs(dx), abs(dy)) != r:
                continue
            x, y = 430 + dx, 260 + dy
            if 0 <= x < sx and 0 <= y < sy and tile(x, y)[5]:
                found.append((x, y))
    if found:
        print(" r", r, found[:12])
        break


def bfs_component(start, walk_fn, box):
    q = deque([start])
    seen = {start}
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if n in seen:
                continue
            nx, ny = n
            if not (box[0] <= nx <= box[1] and box[2] <= ny <= box[3]):
                continue
            if not walk_fn(nx, ny):
                continue
            seen.add(n)
            q.append(n)
    return seen


box = (400, 500, 200, 320)


def walk_srv(x, y):
    if not (0 <= x < sx and 0 <= y < sy):
        return False
    return tile(x, y)[5]


def walk_cl(x, y):
    if not (0 <= x < sx and 0 <= y < sy):
        return False
    return tile(x, y)[6]


pad_comp = bfs_component((452, 281), walk_srv, box)
print("server component of pad size", len(pad_comp))
print("  includes 458,249?", (458, 249) in pad_comp)
print("  includes 450,278?", (450, 278) in pad_comp)
print(
    "  min/max",
    min(p[0] for p in pad_comp),
    max(p[0] for p in pad_comp),
    min(p[1] for p in pad_comp),
    max(p[1] for p in pad_comp),
)

seed = None
for y in range(250, 290):
    for x in range(400, 440):
        if walk_srv(x, y):
            seed = (x, y)
            break
    if seed:
        break
print("mainland seed", seed)
if seed:
    main_comp = bfs_component(seed, walk_srv, (300, 520, 150, 400))
    print("mainland server component size", len(main_comp))
    print("  pad in mainland?", (452, 281) in main_comp)
    print("  458,249 in mainland?", (458, 249) in main_comp)

shores = []
for y in range(250, 295):
    for x in range(440, 470):
        s, f, bf, tele, wet, ws, wc, sh, wa = tile(x, y)
        if sh and not bf:
            shores.append((x, y))
print("count shore walkable-in-classic", len(shores))
print("sample", shores[:40])

pad_cl = bfs_component((452, 281), walk_cl, box)
print("classic pad component size", len(pad_cl))
print("  458,249 in classic pad?", (458, 249) in pad_cl)
shore_on_island = [(x, y) for (x, y) in pad_cl if tile(x, y)[7]]
print("shore cells inside classic pad component", len(shore_on_island), shore_on_island[:50])

if seed:
    main_cl = bfs_component(seed, walk_cl, (300, 520, 150, 400))
    print("classic mainland size", len(main_cl))
    print("pad in classic mainland?", (452, 281) in main_cl)
    print("458,249 in classic mainland?", (458, 249) in main_cl)

print("strip y=248-255 x=445-465:")
for y in range(248, 256):
    row = ""
    for x in range(445, 466):
        s, f, bf, tele, wet, ws, wc, sh, wa = tile(x, y)
        if tele:
            row += "T"
        elif ws:
            row += "."
        elif sh:
            row += "S"
        elif wa:
            row += "W"
        else:
            row += "#"
    print(f"y={y}: {row}")

print("strip y=260-285 x=430-460:")
for y in range(260, 286):
    row = ""
    for x in range(430, 461):
        s, f, bf, tele, wet, ws, wc, sh, wa = tile(x, y)
        if tele:
            row += "T"
        elif ws:
            row += "."
        elif sh:
            row += "S"
        elif wa:
            row += "W"
        else:
            row += "#"
    print(f"y={y}: {row}")

# Find bridge bottlenecks: cells needed for classic connectivity that are shore
if seed:
    # cells in classic path but shore
    bridge_shores = [p for p in main_cl if tile(p[0], p[1])[7] and 430 <= p[0] <= 470 and 240 <= p[1] <= 300]
    print("shore cells in classic mainland component near island", len(bridge_shores))
    print(sorted(bridge_shores)[:80])
