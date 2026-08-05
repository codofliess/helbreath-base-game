import json
from pathlib import Path

gw = json.loads(Path("/opt/chainlords/server/Config/GameWorlds.json").read_text(encoding="utf-8"))
for w in gw:
    if w.get("id") in ("toh1", "toh2", "toh3", "middleland"):
        d = w.get("dwellAreas") or []
        t = w.get("teleportLocs") or []
        print(
            w["id"],
            "dwells",
            len(d),
            "tps",
            len(t),
            "mon_sum",
            sum(x.get("count", 0) for x in d),
        )
        if w["id"] == "middleland":
            for x in d:
                if x.get("monsterId") == 33:
                    print("  HC", x)
        if w["id"] in ("toh2", "toh3"):
            for i, tp in enumerate(t):
                print("  tp", i, "->", tp.get("target"))
