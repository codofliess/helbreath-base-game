#!/usr/bin/env python3
import json, sys
path = sys.argv[1] if len(sys.argv) > 1 else "/opt/chainlords/server/Config/Monsters.json"
ipath = sys.argv[2] if len(sys.argv) > 2 else "/opt/chainlords/server/Config/Items.json"
m = json.load(open(path, encoding="utf-8"))
items = json.load(open(ipath, encoding="utf-8"))
by = {i["id"]: i for i in items}
rows = []
for mon in m:
    for l in mon.get("loot") or []:
        it = by.get(l.get("itemId")) or {}
        t = (it.get("itemType") or "").lower()
        n = (it.get("name") or "").lower()
        if t == "necklace" or "neck" in n or "pendant" in n or "angelic" in n:
            rows.append(
                {
                    "chance": float(l.get("chance") or 0),
                    "mob": mon.get("name") or mon.get("id"),
                    "itemId": l.get("itemId"),
                    "name": it.get("name"),
                    "type": it.get("itemType"),
                    "min": l.get("minQuantity"),
                    "max": l.get("maxQuantity"),
                }
            )
rows.sort(key=lambda r: -r["chance"])
print("total neck/pendant rows", len(rows))
print("--- top 40 by chance ---")
for r in rows[:40]:
    print(f"{r['chance']:.6f}  mob={r['mob']!s:20s} id={r['itemId']} {r['name']} ({r['type']})")
print("--- chance > 0.002 ---")
for r in rows:
    if r["chance"] > 0.002:
        print(f"{r['chance']:.6f}  mob={r['mob']} id={r['itemId']} {r['name']}")

# sum chance per mob for necklace-type
from collections import defaultdict
sums = defaultdict(float)
for r in rows:
    sums[r["mob"]] += r["chance"]
print("--- sum necklace chance per mob (top 15) ---")
for mob, s in sorted(sums.items(), key=lambda x: -x[1])[:15]:
    print(f"{s:.6f}  {mob}")
