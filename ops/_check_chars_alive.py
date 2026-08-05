#!/usr/bin/env python3
import json, glob, os

chars = []
for p in sorted(glob.glob("/opt/chainlords/server/Chars/*.traveler.json")):
    if ".bak" in p:
        continue
    try:
        d = json.load(open(p))
        name = d.get("CharacterName") or d.get("Name") or "?"
        lvl = d.get("Level")
        if lvl is None:
            stats = d.get("Stats") or {}
            lvl = stats.get("Level")
        world = d.get("WorldId") or d.get("World")
        bag = len(d.get("BagItems") or [])
        eq = len(d.get("EquippedItems") or d.get("Equipment") or [])
        chars.append((name, lvl, world, bag, eq, os.path.basename(p)))
    except Exception as e:
        chars.append(("ERR", str(e), p, 0, 0, ""))

print("traveler_files", len(chars))
for c in chars:
    print(f"name={c[0]!r} lvl={c[1]} world={c[2]} bag={c[3]} eq={c[4]} file={c[5]}")
