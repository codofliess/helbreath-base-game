#!/usr/bin/env python3
"""Patch a traveler persist JSON with the exact Magias fields F7 / Gandalf read.

Usage:
  python3 ops/grant-mago-magias.py --json /path/to/wallet.traveler.json
  python3 ops/grant-mago-magias.py --print-template

Does not SSH Chile. Player must be offline, then relog.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

GOLD_ITEM_ID = 90
MAGIC_SKILL_INDEX = 4
CIRCLE_ONE_OLYMPIA_IDS = [0, 1, 2]
DEFAULT_GOLD = 1700
SKILL_COUNT = 19


def apply_magias_grant(state: dict, gold_quantity: int = DEFAULT_GOLD) -> dict:
    """Set LearnedOlympiaSpellIds + Magic skill + bag item 90. Does not invent Mag/Int."""
    state["LearnedOlympiaSpellIds"] = list(CIRCLE_ONE_OLYMPIA_IDS)
    skills = list(state.get("SkillLevels") or [])
    while len(skills) < SKILL_COUNT:
        skills.append(20)
    skills[MAGIC_SKILL_INDEX] = max(int(skills[MAGIC_SKILL_INDEX] or 0), 100)
    state["SkillLevels"] = skills
    # Prefer bag item 90. Leave Gold=0 so load does not double-stack after Quantity is set.
    state["Gold"] = 0
    bag = list(state.get("BagItems") or [])
    gold_rows = [row for row in bag if int(row.get("ItemId") or row.get("itemId") or 0) == GOLD_ITEM_ID]
    if gold_rows:
        row = gold_rows[0]
        key = "Quantity" if "Quantity" in row or "quantity" not in row else "quantity"
        row[key] = max(int(row.get(key) or 0), gold_quantity)
    else:
        bag.append({
            "ItemId": GOLD_ITEM_ID,
            "ItemUid": 90001,
            "BagX": 0,
            "BagY": 0,
            "Quantity": gold_quantity,
            "BagZIndex": 0,
        })
    state["BagItems"] = bag
    return state


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", type=Path, help="Traveler persist JSON to patch in place")
    parser.add_argument("--gold", type=int, default=DEFAULT_GOLD)
    parser.add_argument("--print-template", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if args.print_template:
        print(json.dumps(apply_magias_grant({}, args.gold), indent=2))
        return 0

    if args.json is None:
        parser.error("pass --json or --print-template")

    path: Path = args.json
    state = json.loads(path.read_text(encoding="utf-8"))
    apply_magias_grant(state, args.gold)
    text = json.dumps(state, indent=2, ensure_ascii=False)
    if args.dry_run:
        print(text)
        return 0
    path.write_text(text + "\n", encoding="utf-8")
    print(
        f"patched {path} LearnedOlympiaSpellIds={state['LearnedOlympiaSpellIds']} "
        f"SkillLevels[4]={state['SkillLevels'][4]} bag90 ok. Relog required.",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
