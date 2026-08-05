import json
from collections import Counter
from pathlib import Path
p = Path("/opt/chainlords/server/Config/Monsters.json")
m = json.loads(p.read_text())
c = Counter()
for x in m:
    a = x.get("allegiance")
    if a is None:
        a = x.get("Allegiance", "missing")
    c[str(a)] += 1
print("allegiance counts", dict(c))
# names containing wolf / hell / guard
for x in m:
    name = (x.get("name") or "").lower()
    if any(k in name for k in ("wolf", "were", "hell", "guard", "stalker", "ogre", "troll")):
        print(x.get("id"), x.get("name"), "allegiance=", x.get("allegiance"), "dmg=", x.get("attackDamageMin"), x.get("attackDamageMax"))
