import json
d = json.load(open("/opt/chainlords/server/Config/Spells.json"))
for sid in (5, 19, 20, 21, 22, 23):
    s = next(x for x in d if x["id"] == sid)
    print(
        f'{s["id"]:2} {s["name"]:22} '
        f'{s.get("damageDiceCount")}d{s.get("damageDiceSides")}+{s.get("damageDiceBonus")}'
    )
