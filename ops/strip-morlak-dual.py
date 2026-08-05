#!/usr/bin/env python3
"""Strip bug rare necklaces from Morlak on both JSON traveler file and PostgreSQL (docker)."""
import json
import shutil
import subprocess
from pathlib import Path

PATH = Path(
    "/opt/chainlords/server/Chars/47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn.traveler.json"
)
ITEMS = json.load(open("/opt/chainlords/server/Config/Items.json", encoding="utf-8"))
BY = {i["id"]: i for i in ITEMS}
ALWAYS = {
    308, 311, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
    1108, 1109, 1110, 1111,
}
NAME_KILL = ("necklace", "neck", "pendant", "pandent", "knecklace", "efreet", "beholder")


def is_bug(iid) -> bool:
    if iid is None:
        return False
    iid = int(iid)
    if iid in ALWAYS:
        return True
    it = BY.get(iid) or {}
    t = (it.get("itemType") or "").lower()
    n = (it.get("name") or "").lower()
    return t == "necklace" or any(k in n for k in NAME_KILL)


def strip_state(d: dict):
    removed = []
    bag = d.get("BagItems") or d.get("bagItems") or []
    new = []
    for row in bag:
        if not isinstance(row, dict):
            new.append(row)
            continue
        iid = row.get("ItemId") if "ItemId" in row else row.get("itemId")
        if iid is not None and is_bug(int(iid)):
            removed.append(int(iid))
        else:
            new.append(row)
    if "BagItems" in d:
        d["BagItems"] = new
    elif "bagItems" in d:
        d["bagItems"] = new
    else:
        d["BagItems"] = new

    eq = d.get("EquippedItems") or d.get("equippedItems")
    if isinstance(eq, list):
        ne = []
        for row in eq:
            if not isinstance(row, dict):
                ne.append(row)
                continue
            iid = row.get("ItemId") if "ItemId" in row else row.get("itemId")
            if iid is not None and is_bug(int(iid)):
                removed.append(int(iid))
            else:
                ne.append(row)
        if "EquippedItems" in d:
            d["EquippedItems"] = ne
        else:
            d["equippedItems"] = ne
    elif isinstance(eq, dict):
        for s, row in list(eq.items()):
            if not row or not isinstance(row, dict):
                continue
            iid = row.get("ItemId") if "ItemId" in row else row.get("itemId")
            if iid is not None and is_bug(int(iid)):
                removed.append(int(iid))
                del eq[s]

    d["StakedHell"] = int(d.get("StakedHell") or d.get("stakedHell") or 0)
    return d, removed, len(new)


def psql(sql: str) -> str:
    r = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "helbreath-postgres",
            "psql",
            "-U",
            "helbreath",
            "-d",
            "helbreath",
            "-v",
            "ON_ERROR_STOP=1",
            "-t",
            "-A",
            "-c",
            sql,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if r.returncode != 0:
        raise RuntimeError(f"psql failed: {r.stderr or r.stdout}")
    return r.stdout


def main():
    d = json.load(open(PATH, encoding="utf-8"))
    d, removed, bagn = strip_state(d)
    shutil.copy2(PATH, str(PATH) + ".bak-pg-sync-strip")
    with open(PATH, "w", encoding="utf-8") as f:
        json.dump(d, f, indent=2)
        f.write("\n")
    print("json removed", removed, "bag", bagn)

    out = psql(
        "SELECT id || E'\\t' || name || E'\\t' || state_json::text "
        "FROM characters WHERE account_wallet LIKE '47u56Tf6%';"
    )
    lines = [ln for ln in out.splitlines() if ln.strip()]
    print("pg rows", len(lines))
    for line in lines:
        parts = line.split("\t", 2)
        if len(parts) < 3:
            print("skip line", line[:80])
            continue
        cid, name, sj = parts
        st = json.loads(sj)
        st, rem, bn = strip_state(st)
        print("pg char", name, "removed", rem, "bag", bn)
        # Write JSON via stdin to avoid shell quoting hell
        payload = json.dumps(st)
        r = subprocess.run(
            [
                "docker",
                "exec",
                "-i",
                "helbreath-postgres",
                "psql",
                "-U",
                "helbreath",
                "-d",
                "helbreath",
                "-v",
                "ON_ERROR_STOP=1",
                "-c",
                f"UPDATE characters SET state_json = $json${payload}$json$::jsonb, updated_at = NOW() WHERE id = '{cid}';",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if r.returncode != 0:
            raise RuntimeError(f"update failed: {r.stderr or r.stdout}")
        print("updated", name)
    print("done dual strip")


if __name__ == "__main__":
    main()
