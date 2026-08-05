#!/usr/bin/env python3
"""Remove bug-drop rare necklaces/pendants and other absurd gear from Morlak bag/equip."""
import json
from pathlib import Path

PATH = Path("/opt/chainlords/server/Chars/47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn.traveler.json")
ITEMS = json.load(open("/opt/chainlords/server/Config/Items.json", encoding="utf-8"))
BY = {i["id"]: i for i in ITEMS}

# Necklace / pendant catalog ids that rained from loot bug (638 fire, 639 poison, etc.)
NECK_TYPES = {"necklace"}
# Also strip by name keywords
NAME_KILL = ("necklace", "neck", "pendant", "pandent", "knecklace", "efreet", "beholder")

# High-value bug candidates: necklaces always; angelics if dropped during bug window
ALWAYS_STRIP_IDS = {
    308, 311, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
    1108, 1109, 1110, 1111,  # angelic pendants (if any from bug)
}

def is_bug_rare(item_id: int) -> bool:
    if item_id in ALWAYS_STRIP_IDS:
        return True
    it = BY.get(item_id) or {}
    t = (it.get("itemType") or "").lower()
    n = (it.get("name") or "").lower()
    if t in NECK_TYPES:
        return True
    if any(k in n for k in NAME_KILL):
        return True
    return False

def main():
    d = json.load(open(PATH, encoding="utf-8"))
    bag = d.get("BagItems") or d.get("bagItems") or []
    removed = []
    new_bag = []
    for row in bag:
        iid = row.get("ItemId") if "ItemId" in row else row.get("itemId")
        if iid is None:
            new_bag.append(row)
            continue
        if is_bug_rare(int(iid)):
            name = (BY.get(int(iid)) or {}).get("name", "?")
            removed.append((iid, name, row.get("ItemUid") or row.get("itemUid")))
        else:
            new_bag.append(row)
    if "BagItems" in d:
        d["BagItems"] = new_bag
    else:
        d["bagItems"] = new_bag

    # Equipped: unequip bug necks into void (delete)
    eq = d.get("EquippedItems") or d.get("equippedItems")
    if isinstance(eq, list):
        new_eq = []
        for row in eq:
            iid = row.get("ItemId") if "ItemId" in row else row.get("itemId")
            if iid is not None and is_bug_rare(int(iid)):
                name = (BY.get(int(iid)) or {}).get("name", "?")
                removed.append((iid, name, "equipped"))
            else:
                new_eq.append(row)
        if "EquippedItems" in d:
            d["EquippedItems"] = new_eq
        else:
            d["equippedItems"] = new_eq
    elif isinstance(eq, dict):
        for slot, row in list(eq.items()):
            if not row:
                continue
            iid = row.get("ItemId") if "ItemId" in row else row.get("itemId")
            if iid is not None and is_bug_rare(int(iid)):
                name = (BY.get(int(iid)) or {}).get("name", "?")
                removed.append((iid, name, f"eq:{slot}"))
                del eq[slot]

    bak = PATH.with_suffix(PATH.suffix + ".bak-strip-bug-rares")
    import shutil
    shutil.copy2(PATH, bak)
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2)
        f.write("\n")
    print("backup", bak)
    print("bag now", len(new_bag))
    print("removed", len(removed))
    for r in removed:
        print(" -", r)

if __name__ == "__main__":
    main()
