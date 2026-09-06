#!/usr/bin/env python3
"""Apply Olympia war Hero kit onto Elon's paperdoll (EquippedItems) on live.

Playtest 2026-09-06: Elon L150 (traveler / Elvine, Phantom wallet nicknamed KindGem)
could not re-equip after death because:
  1. F5 Char Aw Snap 9 (OOM) — bag/paperdoll UI is unreachable.
  2. a Hero Armor/Helm (Item2.cfg weight 10000) needs Str 100. Join calls
     Inventory.UnequipItemsInvalidForStats and dumps the set into the bag.
     Underwear/gray robe is the naked paperdoll, not a missing catalog.

This script does NOT need F5. It writes EquippedItems + Str>=120 into PostgreSQL
state_json AND the Chars JSON mirrors so traveler dual-load cannot roll back.

Default is diagnose-only. Pass --apply to write.

Live (PaioPez), character MUST be logged off (otherwise the next autosave overwrites):

  cd /opt/chainlords/helbreath-base-game   # or wherever this file lives
  python3 ops/apply-live-elon-warrior-kit.py
  python3 ops/apply-live-elon-warrior-kit.py --apply --name Elon

If several wallets match, pass the Phantom pubkey:

  python3 ops/apply-live-elon-warrior-kit.py --apply --name Elon --wallet '<solana-pubkey>'

Env overrides (do not invent credentials — live docker postgres is the same as other ops):
  PG_CONTAINER  default helbreath-postgres
  PG_USER       default helbreath
  PG_DB         default helbreath
  CHARS_DIR     default /opt/chainlords/server/Chars
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

PG_CONTAINER = os.environ.get("PG_CONTAINER", "helbreath-postgres")
PG_USER = os.environ.get("PG_USER", "helbreath")
PG_DB = os.environ.get("PG_DB", "helbreath")
CHARS_DIR = Path(os.environ.get("CHARS_DIR", "/opt/chainlords/server/Chars"))

# Item2.cfg weight/100 floors: Hero Helm/Armor = 100 Str. Blood Rapier override = 39.
MIN_STR_FOR_HERO_WAR = 120

WAR_MALE = {
    "helmet": 403,  # a Hero Helm(M)
    "armor": 411,  # a Hero Armor(M)
    "hauberk": 419,  # a Hero Hauberk(M)
    "leggings": 423,  # a Hero Leggings(M)
    "boots": 451,  # Long Boots
    "weapon": 492,  # Blood Rapier
    "shield": 620,  # Merien Shield
    "necklace": 648,  # Necklace Of Liche
}
WAR_FEMALE = {
    "helmet": 404,
    "armor": 412,
    "hauberk": 420,
    "leggings": 424,
    "boots": 451,
    "weapon": 492,
    "shield": 620,
    "necklace": 648,
}

KIT_IDS = set(WAR_MALE.values()) | set(WAR_FEMALE.values())

# Item2.cfg token 11 maxLife for Hero pieces / rapier / merien / liche (generous full).
MAX_LIFE = {
    403: 2500,
    404: 2500,
    411: 5000,
    412: 5000,
    419: 2000,
    420: 2000,
    423: 3000,
    424: 3000,
    451: 2000,
    492: 3000,
    620: 3000,
    648: 3000,
}


def psql(sql: str) -> str:
    r = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            PG_CONTAINER,
            "psql",
            "-U",
            PG_USER,
            "-d",
            PG_DB,
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


def bag_list(state: dict) -> list:
    bag = state.get("BagItems")
    if bag is None:
        bag = state.get("bagItems")
    if not isinstance(bag, list):
        return []
    return bag


def eq_list(state: dict) -> list:
    eq = state.get("EquippedItems")
    if eq is None:
        eq = state.get("equippedItems")
    if not isinstance(eq, list):
        return []
    return eq


def item_id_of(row) -> int | None:
    if not isinstance(row, dict):
        return None
    if "ItemId" in row:
        return int(row["ItemId"])
    if "itemId" in row:
        return int(row["itemId"])
    item = row.get("Item") or row.get("item")
    if isinstance(item, dict):
        if "ItemId" in item:
            return int(item["ItemId"])
        if "itemId" in item:
            return int(item["itemId"])
    return None


def uid_of(row) -> int:
    if not isinstance(row, dict):
        return 0
    for key in ("ItemUid", "itemUid"):
        if key in row and row[key] is not None:
            return int(row[key])
    item = row.get("Item") or row.get("item")
    if isinstance(item, dict):
        for key in ("ItemUid", "itemUid"):
            if key in item and item[key] is not None:
                return int(item[key])
    return 0


def slot_of(row) -> str:
    if not isinstance(row, dict):
        return ""
    return str(row.get("Slot") or row.get("slot") or "")


def max_uid(state: dict) -> int:
    n = 1
    for row in bag_list(state):
        n = max(n, uid_of(row))
    for row in eq_list(state):
        n = max(n, uid_of(row))
    return n


def progress_score(state: dict) -> int:
    level = int(state.get("Level") or state.get("level") or 1)
    exp = int(state.get("Exp") or state.get("exp") or 0)
    rebirth = int(state.get("Rebirth") or state.get("rebirth") or 0)
    return level * 10_000_000_000 + max(0, exp) + rebirth * 1_000_000 + len(bag_list(state)) + len(eq_list(state))


def summarize(state: dict) -> dict:
    bag_ids = []
    for row in bag_list(state):
        iid = item_id_of(row)
        if iid is not None:
            bag_ids.append(iid)
    equipped = {}
    for row in eq_list(state):
        slot = slot_of(row)
        iid = item_id_of(row)
        if slot:
            equipped[slot] = iid
    return {
        "name": state.get("CharacterName") or state.get("characterName"),
        "world": state.get("GameWorldId") or state.get("gameWorldId"),
        "level": state.get("Level") or state.get("level"),
        "str": state.get("Str") or state.get("str"),
        "gender": state.get("GenderValue") if "GenderValue" in state else state.get("genderValue"),
        "citizenship": state.get("CitizenshipSide") or state.get("citizenshipSide"),
        "equipped": equipped,
        "bag_count": len(bag_list(state)),
        "bag_kit_ids": [i for i in bag_ids if i in KIT_IDS],
        "bag_sample_ids": bag_ids[:24],
    }


def bag_row_from_any(row: dict, uid_fallback: int) -> dict:
    item = row
    nested = row.get("Item") or row.get("item")
    if isinstance(nested, dict) and item_id_of(nested) is not None:
        item = nested
    iid = item_id_of(item) or 0
    uid = uid_of(item) or uid_fallback
    life = int(item.get("MaxLifeSpan") or item.get("maxLifeSpan") or MAX_LIFE.get(iid, 2000))
    cur = int(item.get("CurLifeSpan") or item.get("curLifeSpan") or life)
    return {
        "ItemId": iid,
        "ItemUid": uid,
        "BagX": item.get("BagX", item.get("bagX")),
        "BagY": item.get("BagY", item.get("bagY")),
        "Quantity": int(item.get("Quantity") or item.get("quantity") or 1),
        "BagZIndex": int(item.get("BagZIndex") or item.get("bagZIndex") or 0),
        "EffectOverrides": item.get("EffectOverrides") or item.get("effectOverrides"),
        "ItemAttribute": int(item.get("ItemAttribute") or item.get("itemAttribute") or 0),
        "ItemColor": int(item.get("ItemColor") or item.get("itemColor") or 0),
        "CurLifeSpan": cur,
        "MaxLifeSpan": life,
        "BindState": int(item.get("BindState") or item.get("bindState") or 0),
        "BoundGuildId": item.get("BoundGuildId") or item.get("boundGuildId") or "",
        "CicLevel": int(item.get("CicLevel") or item.get("cicLevel") or 0),
        "CicStatKind": int(item.get("CicStatKind") or item.get("cicStatKind") or 0),
        "CicStatValue": int(item.get("CicStatValue") or item.get("cicStatValue") or 0),
        "SiphonLevel": int(item.get("SiphonLevel") or item.get("siphonLevel") or 0),
    }


def make_equipped_row(slot: str, item_id: int, uid: int) -> dict:
    life = MAX_LIFE.get(item_id, 2000)
    return {
        "Slot": slot,
        "Item": {
            "ItemId": item_id,
            "ItemUid": uid,
            "BagX": None,
            "BagY": None,
            "EffectOverrides": None,
            "ItemAttribute": 0,
            "ItemColor": 0,
            "CurLifeSpan": life,
            "MaxLifeSpan": life,
            "BindState": 0,
            "BoundGuildId": "",
            "CicLevel": 0,
            "CicStatKind": 0,
            "CicStatValue": 0,
            "SiphonLevel": 0,
        },
    }


def apply_kit(state: dict) -> dict:
    gender = int(state.get("GenderValue") or state.get("genderValue") or 0)
    want = WAR_FEMALE if gender == 1 else WAR_MALE
    bag = list(bag_list(state))
    eq = list(eq_list(state))

    by_slot = {}
    for row in eq:
        s = slot_of(row)
        if s:
            by_slot[s] = row

    next_uid = max_uid(state) + 1

    def take_from_bag(item_id: int) -> dict | None:
        for i, row in enumerate(bag):
            if item_id_of(row) == item_id:
                return bag.pop(i)
        return None

    def stash_previous(existing: dict | None) -> None:
        if existing is None:
            return
        iid = item_id_of(existing)
        if iid in want.values():
            return
        bag.append(bag_row_from_any(existing, next_uid))

    new_eq = []
    kept_slots = set()
    for slot, item_id in want.items():
        existing = by_slot.get(slot)
        if existing is not None and item_id_of(existing) == item_id:
            new_eq.append(existing)
            kept_slots.add(slot)
            continue
        from_bag = take_from_bag(item_id)
        stash_previous(existing)
        if from_bag is not None:
            uid = uid_of(from_bag) or next_uid
            if uid == next_uid:
                next_uid += 1
            new_eq.append(make_equipped_row(slot, item_id, uid))
            kept_slots.add(slot)
            continue
        uid = next_uid
        next_uid += 1
        new_eq.append(make_equipped_row(slot, item_id, uid))
        kept_slots.add(slot)

    for row in eq:
        s = slot_of(row)
        if s and s not in kept_slots:
            new_eq.append(row)

    # Strip leftover kit copies from bag (avoid duplicate hero plates).
    cleaned_bag = []
    for row in bag:
        iid = item_id_of(row)
        if iid in want.values():
            continue
        cleaned_bag.append(row)

    state["BagItems"] = cleaned_bag
    state["EquippedItems"] = new_eq
    if "bagItems" in state:
        del state["bagItems"]
    if "equippedItems" in state:
        del state["equippedItems"]

    cur_str = int(state.get("Str") or state.get("str") or 10)
    if cur_str < MIN_STR_FOR_HERO_WAR:
        state["Str"] = MIN_STR_FOR_HERO_WAR
    else:
        state["Str"] = cur_str
    return state


def load_json_file(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as ex:
        print(f"warn: could not parse {path}: {ex}", file=sys.stderr)
        return None


def pick_state(from_db: dict | None, from_json: dict | None) -> dict:
    if from_db is None:
        return from_json or {}
    if from_json is None:
        return from_db
    return from_json if progress_score(from_json) > progress_score(from_db) else from_db


def find_pg_rows(name: str, wallet: str | None) -> list[tuple[str, str, str, str]]:
    name_esc = name.replace("'", "''")
    where = f"LOWER(name) = LOWER('{name_esc}')"
    if name.lower() == "elon":
        where = "LOWER(name) IN ('elon', 'kindgem')"
    if wallet:
        w = wallet.replace("'", "''")
        where = f"({where}) AND account_wallet = '{w}'"
    sql = (
        "SELECT id::text || E'\\t' || account_wallet || E'\\t' || name || E'\\t' || state_json::text "
        f"FROM characters WHERE {where} ORDER BY updated_at DESC;"
    )
    out = psql(sql)
    rows = []
    for line in out.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t", 3)
        if len(parts) < 4:
            print("skip pg line", line[:80])
            continue
        rows.append((parts[0], parts[1], parts[2], parts[3]))
    return rows


def write_pg(cid: str, state: dict) -> None:
    payload = json.dumps(state, separators=(",", ":"))
    sql = (
        f"UPDATE characters SET state_json = $json${payload}$json$::jsonb, "
        f"updated_at = NOW() WHERE id = '{cid}';"
    )
    r = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            PG_CONTAINER,
            "psql",
            "-U",
            PG_USER,
            "-d",
            PG_DB,
            "-v",
            "ON_ERROR_STOP=1",
            "-c",
            sql,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if r.returncode != 0:
        raise RuntimeError(f"update failed: {r.stderr or r.stdout}")


def write_json_mirrors(wallet: str, state: dict) -> list[str]:
    written = []
    if not CHARS_DIR.is_dir():
        print(f"warn: CHARS_DIR missing {CHARS_DIR} — Postgres only")
        return written
    for suffix in (".traveler.json", ".json"):
        path = CHARS_DIR / f"{wallet}{suffix}"
        if path.is_file() or suffix == ".traveler.json":
            bak = Path(str(path) + ".bak-elon-kit")
            if path.is_file():
                bak.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
            path.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
            written.append(str(path))
    return written


def print_sql_recipe(name: str) -> None:
    print(
        """
-- Diagnose (read-only). Run as the live docker role — do not invent a password:
--   docker exec -i helbreath-postgres psql -U helbreath -d helbreath
SELECT id, account_wallet, name, world_id,
       state_json->>'Level' AS level,
       state_json->>'Str' AS str,
       state_json->>'GenderValue' AS gender,
       state_json->>'CitizenshipSide' AS side,
       state_json->>'GameWorldId' AS world,
       jsonb_array_length(COALESCE(state_json->'EquippedItems','[]'::jsonb)) AS eq_n,
       jsonb_array_length(COALESCE(state_json->'BagItems','[]'::jsonb)) AS bag_n,
       (SELECT jsonb_agg(e->>'Slot' || '=' || (e->'Item'->>'ItemId'))
          FROM jsonb_array_elements(COALESCE(state_json->'EquippedItems','[]'::jsonb)) e) AS equipped,
       (SELECT jsonb_agg(b->>'ItemId')
          FROM jsonb_array_elements(COALESCE(state_json->'BagItems','[]'::jsonb)) b
         WHERE (b->>'ItemId')::int IN (403,404,411,412,419,420,423,424,451,492,620,648)) AS bag_kit
FROM characters
WHERE LOWER(name) IN (LOWER('"""
        + name.replace("'", "''")
        + """'), 'kindgem')
ORDER BY updated_at DESC;

-- Do NOT paste a hand-built UPDATE for EquippedItems unless you merged bag UIDs.
-- Use this script with --apply (it dollar-quotes JSONB like ops/strip-morlak-dual.py).
"""
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--name", default="Elon")
    ap.add_argument("--wallet", default=os.environ.get("ELON_WALLET") or "")
    ap.add_argument("--apply", action="store_true", help="Write Postgres + Chars JSON. Default is diagnose.")
    ap.add_argument("--sql-help", action="store_true", help="Print diagnose SQL and exit.")
    args = ap.parse_args()
    if args.sql_help:
        print_sql_recipe(args.name)
        return 0

    wallet_filter = args.wallet.strip() or None
    try:
        rows = find_pg_rows(args.name, wallet_filter)
    except RuntimeError as ex:
        print(ex, file=sys.stderr)
        print("Postgres unreachable from this host. On live VPS run the script next to docker.")
        print_sql_recipe(args.name)
        return 2

    if not rows:
        print(f"No Postgres characters named {args.name!r} (or KindGem). Searching JSON…")
        if CHARS_DIR.is_dir():
            for p in sorted(CHARS_DIR.glob("*.json")):
                st = load_json_file(p)
                if not st:
                    continue
                nm = str(st.get("CharacterName") or st.get("characterName") or "")
                if nm.lower() in {args.name.lower(), "kindgem", "elon"}:
                    print("json", p.name, summarize(st))
        print_sql_recipe(args.name)
        return 1

    print(f"Postgres matches: {len(rows)}")
    targets = []
    for cid, wallet, name, sj in rows:
        db_state = json.loads(sj)
        traveler = load_json_file(CHARS_DIR / f"{wallet}.traveler.json")
        gm = load_json_file(CHARS_DIR / f"{wallet}.json")
        chosen = pick_state(db_state, traveler)
        if gm and progress_score(gm) > progress_score(chosen):
            # Never prefer GM sandbox OP kit over traveler/PG for this playtest char.
            tname = str((traveler or db_state).get("CharacterName") or name)
            gname = str(gm.get("CharacterName") or "")
            if gname.lower() == tname.lower():
                chosen = gm
        print("---")
        print(f"id={cid} wallet={wallet} name={name}")
        print("before", json.dumps(summarize(chosen), indent=2))
        targets.append((cid, wallet, name, chosen))

    if not args.apply:
        print("\nDiagnose only. Re-run with --apply after Elon logs off.")
        print_sql_recipe(args.name)
        return 0

    if len(targets) > 1 and not wallet_filter:
        print("Refusing --apply: multiple wallets. Pass --wallet <pubkey>.", file=sys.stderr)
        return 1

    for cid, wallet, name, chosen in targets:
        after = apply_kit(json.loads(json.dumps(chosen)))
        print("after", json.dumps(summarize(after), indent=2))
        write_pg(cid, after)
        mirrors = write_json_mirrors(wallet, after)
        print("updated postgres", name, "json", mirrors)

    print("done. Elon must re-log (not F5) so InitialState picks up EquippedItems.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
