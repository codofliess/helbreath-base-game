#!/usr/bin/env python3
import json
g = json.load(open("/opt/chainlords/server/Config/GameWorlds.json"))
for w in g:
    if "middle" in w.get("id", "") or w.get("id") in ("elvbrk12", "promiseland"):
        d = w.get("dwellAreas") or []
        m = w.get("miningNodes") or []
        print(f"{w['id']}: dwells={len(d)} mining={len(m)} name={w.get('name')}")
        total = sum(int(x.get("count") or 0) for x in d)
        print(f"  total_mob_slots={total}")
