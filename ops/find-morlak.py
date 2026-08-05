#!/usr/bin/env python3
import json, glob, os
chars = glob.glob("/opt/chainlords/server/Chars/*.json")
for p in chars:
    if "hell-mining" in p or "report" in p or p.endswith(".bak"):
        continue
    try:
        d = json.load(open(p, encoding="utf-8"))
    except Exception as e:
        continue
    name = (d.get("CharacterName") or d.get("characterName") or "")
    if str(name).lower() == "morlak" or "morlak" in os.path.basename(p).lower() or "47u56" in p:
        print("FILE", p)
        print("name", name)
        bag = d.get("BagItems") or d.get("bagItems") or []
        eq = d.get("EquippedItems") or d.get("equippedItems") or []
        print("bag count", len(bag), "eq", len(eq) if isinstance(eq, list) else type(eq))
