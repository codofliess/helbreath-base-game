#!/usr/bin/env python3
"""Verify the committed PLAYTEST ElonQa kit (no live Chars/, no PauPau)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "multiplayer/server/PlaytestKits/playtest-elonqa.traveler.json"

WANT_STATS = {"Str": 182, "Int": 65, "Mag": 50, "Vit": 80, "Dex": 128, "Chr": 12}
BAG_IDS = {407, 415, 419, 423, 620, 845, 643, 860, 1314}
EQUIP_WEAPON = 762


def main() -> int:
    if not KIT.is_file():
        print(f"missing {KIT}", file=sys.stderr)
        return 1
    data = json.loads(KIT.read_text())
    errors: list[str] = []
    if data.get("CharacterName") != "ElonQa":
        errors.append(f"name={data.get('CharacterName')}")
    if data.get("Level") != 150:
        errors.append(f"level={data.get('Level')}")
    if data.get("GameWorldId") != "traveler":
        errors.append(f"world={data.get('GameWorldId')}")
    if (data.get("X"), data.get("Y")) != (90, 80):
        errors.append(f"xy=({data.get('X')},{data.get('Y')})")
    for key, want in WANT_STATS.items():
        if data.get(key) != want:
            errors.append(f"{key}={data.get(key)} want {want}")
    total = sum(data.get(k, 0) for k in ("Str", "Int", "Mag", "Vit", "Dex", "Chr"))
    if total != 517:
        errors.append(f"stat total {total} want 517")
    equipped = data.get("EquippedItems") or []
    slots = {row.get("Slot"): (row.get("Item") or {}).get("ItemId") for row in equipped}
    if slots.get("weapon") != EQUIP_WEAPON:
        errors.append(f"weapon={slots.get('weapon')}")
    if "shield" in slots:
        errors.append("shield equipped with 2H hammer")
    bag_ids = {row.get("ItemId") for row in (data.get("BagItems") or [])}
    missing = BAG_IDS - bag_ids
    if missing:
        errors.append(f"bag missing {sorted(missing)}")
    if errors:
        print("FAIL:", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        return 1
    print(
        "OK ElonQa L150 traveler (90,80) GBH equipped, mage set/Merien/Storm/"
        "Ice neck/Xelima neck/MS22 in bag, no shield."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
