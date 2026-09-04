#!/usr/bin/env python3
"""One-row LIVE overlay: character `Elon` on KindGem997's wallet only.

Encoding matches PlaytestElonQaKit / LiveElonWarriorKit (Olympia nibbles).
This is not a give-all-items API and is not called by the game process.

Gates (all required to write):
  1. Exact name Elon (not ElonQa / PauPau / anyone else)
  2. Exact wallet 4R7FsyC85Yic3hGz7yWAt7HbV5A1qtC7UQi13Hsv5r7K
  3. Env ALLOW_LIVE_ELON_KIT=1 (unset on the game server)
  4. Flag --apply (default is dry-run)
  5. Row must already exist — never INSERT

Spawn/map columns are left unchanged. Production deploy is a separate PO step.

  python3 ops/apply-live-elon-warrior-kit.py --self-test
  ALLOW_LIVE_ELON_KIT=1 python3 ops/apply-live-elon-warrior-kit.py
  ALLOW_LIVE_ELON_KIT=1 python3 ops/apply-live-elon-warrior-kit.py --apply
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from copy import deepcopy
from pathlib import Path
from typing import Any

TARGET_NAME = "Elon"
TARGET_WALLET = "4R7FsyC85Yic3hGz7yWAt7HbV5A1qtC7UQi13Hsv5r7K"
BLOCKED_NAMES = {"elonqa", "paupau"}
ALLOW_ENV = "ALLOW_LIVE_ELON_KIT"

LEVEL = 150
STR = 182
INTEL = 65
MAG = 50
VIT = 80
CHR = 12
DEX = 128
EXP_L150 = 47_023_054
STAT_POOL = 517

ITEM_GBH = 762
ITEM_HELM = 403
ITEM_ARMOR = 411
ITEM_HAUBERK = 419
ITEM_LEGS = 423
ITEM_CAPE = 402
ITEM_ARESDEN_CAPE = 400
ITEM_ELVINE_CAPE = 401
ITEM_CAP = 407
ITEM_ROBE = 415
ITEM_WINGS = 751
ITEM_PLATE = 458
ITEM_PLATE_LEGS = 462
ITEM_PLATE_HAUBERK = 454
ITEM_MS22 = 1314

P_CASTING_PROB = 9
S_HIT_PROB = 2
WAND_CP_NIBBLE = 15
WAND_HR_NIBBLE = 13
HAMMER_PLUS = 7
CIC_LEVEL = 4
CIC_HP = 1
CIC_HP_VALUE = 70

SKILL_COUNT = 19
SKILL_START = 20
SKILL_MAX = 100
SKILL_MAGIC = 4
SKILL_HAMMER = 6
SKILL_STAFF = 12

def encode_magic(p_type: int, p_val: int, s_type: int, s_val: int, upgrade: int = 0) -> int:
    """Olympia m_dwAttribute nibbles (same bit layout as Enchanting.Encode)."""
    return (
        ((upgrade & 0xF) << 28)
        | ((p_type & 0xF) << 20)
        | ((p_val & 0xF) << 16)
        | ((s_type & 0xF) << 12)
        | ((s_val & 0xF) << 8)
    )


WAND_ATTR = encode_magic(P_CASTING_PROB, WAND_CP_NIBBLE, S_HIT_PROB, WAND_HR_NIBBLE, 0)
HAMMER_ATTR = encode_magic(0, 0, 0, 0, HAMMER_PLUS)
PLAYTEST_WAND_HR7 = encode_magic(P_CASTING_PROB, 15, S_HIT_PROB, 7, 0)


def allow_flag_on() -> bool:
    return os.environ.get(ALLOW_ENV, "") == "1"


def pick(d: dict[str, Any], *keys: str, default: Any = None) -> Any:
    for key in keys:
        if key in d and d[key] is not None:
            return d[key]
    lower = {str(k).lower(): v for k, v in d.items()}
    for key in keys:
        lk = key.lower()
        if lk in lower and lower[lk] is not None:
            return lower[lk]
    return default


def cape_id(side: str | None) -> int:
    s = (side or "").strip().lower()
    if s == "aresden":
        return ITEM_ARESDEN_CAPE
    if s == "elvine":
        return ITEM_ELVINE_CAPE
    return ITEM_CAPE


def max_uid(state: dict[str, Any]) -> int:
    found = 9_100_000

    def walk(obj: Any) -> None:
        nonlocal found
        if isinstance(obj, dict):
            uid = pick(obj, "ItemUid", "itemUid")
            if uid is not None:
                try:
                    found = max(found, int(uid))
                except (TypeError, ValueError):
                    pass
            for value in obj.values():
                walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)

    walk(state)
    return found


def inventory_item(
    item_id: int,
    uid: int,
    bag_x: int,
    bag_y: int,
    cur_life: int,
    max_life: int,
    attr: int = 0,
    cic_level: int = 0,
    cic_kind: int = 0,
    cic_value: int = 0,
) -> dict[str, Any]:
    return {
        "ItemId": item_id,
        "ItemUid": uid,
        "BagX": bag_x,
        "BagY": bag_y,
        "Quantity": 1,
        "BagZIndex": bag_x + bag_y * 8,
        "EffectOverrides": None,
        "ItemAttribute": attr,
        "ItemColor": 0,
        "CurLifeSpan": cur_life,
        "MaxLifeSpan": max_life,
        "BindState": 0,
        "BoundGuildId": "",
        "CicLevel": cic_level,
        "CicStatKind": cic_kind,
        "CicStatValue": cic_value,
        "SiphonLevel": 0,
    }


def equipped_item(item_id: int, uid: int, cur_life: int, max_life: int, attr: int = 0) -> dict[str, Any]:
    row = inventory_item(item_id, uid, 0, 0, cur_life, max_life, attr)
    row["BagX"] = None
    row["BagY"] = None
    del row["Quantity"]
    del row["BagZIndex"]
    return row


def apply_kit(state: dict[str, Any]) -> dict[str, Any]:
    out = deepcopy(state)
    uid = max_uid(out) + 1
    skills = list(pick(out, "SkillLevels", "skillLevels", default=[]) or [])
    while len(skills) < SKILL_COUNT:
        skills.append(SKILL_START)
    skills = [max(int(v), SKILL_START) for v in skills[:SKILL_COUNT]]
    skills[SKILL_HAMMER] = SKILL_MAX
    skills[SKILL_MAGIC] = max(skills[SKILL_MAGIC], 50)
    skills[SKILL_STAFF] = max(skills[SKILL_STAFF], 50)

    bag: list[dict[str, Any]] = []
    for spec in (
        (ITEM_GBH, 0, 0, 6000, 6000, HAMMER_ATTR, 0, 0, 0),
        (ITEM_MS22, 1, 0, 200, 200, WAND_ATTR, 0, 0, 0),
        (ITEM_CAP, 2, 0, 0, 0, 0, 0, 0, 0),
        (ITEM_ROBE, 3, 0, 0, 0, 0, 0, 0, 0),
        (ITEM_WINGS, 0, 1, 0, 0, 0, CIC_LEVEL, CIC_HP, CIC_HP_VALUE),
        (ITEM_PLATE, 1, 1, 0, 0, 0, CIC_LEVEL, CIC_HP, CIC_HP_VALUE),
        (ITEM_PLATE_LEGS, 2, 1, 0, 0, 0, CIC_LEVEL, CIC_HP, CIC_HP_VALUE),
        (ITEM_PLATE_HAUBERK, 3, 1, 0, 0, 0, CIC_LEVEL, CIC_HP, CIC_HP_VALUE),
        (ITEM_CAPE, 4, 1, 0, 0, 0, CIC_LEVEL, CIC_HP, CIC_HP_VALUE),
    ):
        item_id, x, y, cur, mx, attr, cic_l, cic_k, cic_v = spec
        bag.append(inventory_item(item_id, uid, x, y, cur, mx, attr, cic_l, cic_k, cic_v))
        uid += 1

    cape = cape_id(str(pick(out, "CitizenshipSide", "citizenshipSide", default="") or ""))
    equipped = []
    for slot, item_id, cur, mx in (
        ("helmet", ITEM_HELM, 0, 0),
        ("armor", ITEM_ARMOR, 0, 0),
        ("hauberk", ITEM_HAUBERK, 0, 0),
        ("leggings", ITEM_LEGS, 0, 0),
        ("cape", cape, 0, 0),
    ):
        equipped.append({"Slot": slot, "Item": equipped_item(item_id, uid, cur, mx)})
        uid += 1

    existing_exp = int(pick(out, "Exp", "exp", default=0) or 0)
    out["CharacterName"] = TARGET_NAME
    out["Level"] = LEVEL
    out["Exp"] = max(existing_exp, EXP_L150)
    out["Str"] = STR
    out["Int"] = INTEL
    out["Mag"] = MAG
    out["Vit"] = VIT
    out["Dex"] = DEX
    out["Chr"] = CHR
    out["AttackType"] = 1
    out["AttackRange"] = 1
    out["BagItems"] = bag
    out["EquippedItems"] = equipped
    out["SkillLevels"] = skills
    for camel in (
        "bagItems",
        "equippedItems",
        "skillLevels",
        "characterName",
        "level",
        "str",
        "int",
        "mag",
        "vit",
        "dex",
        "chr",
    ):
        out.pop(camel, None)
    return out


def summarize(state: dict[str, Any]) -> dict[str, Any]:
    equipped = pick(state, "EquippedItems", "equippedItems", default=[]) or []
    slots = {}
    for row in equipped:
        slot = pick(row, "Slot", "slot")
        item = pick(row, "Item", "item", default={}) or {}
        slots[str(slot)] = pick(item, "ItemId", "itemId")
    bag = pick(state, "BagItems", "bagItems", default=[]) or []
    bag_ids = [pick(row, "ItemId", "itemId") for row in bag]
    wand_attr = None
    for row in bag:
        if int(pick(row, "ItemId", "itemId", default=0) or 0) == ITEM_MS22:
            wand_attr = pick(row, "ItemAttribute", "itemAttribute")
    return {
        "name": pick(state, "CharacterName", "characterName"),
        "level": pick(state, "Level", "level"),
        "str": pick(state, "Str", "str"),
        "int": pick(state, "Int", "int"),
        "mag": pick(state, "Mag", "mag"),
        "vit": pick(state, "Vit", "vit"),
        "dex": pick(state, "Dex", "dex"),
        "chr": pick(state, "Chr", "chr"),
        "world": pick(state, "GameWorldId", "gameWorldId"),
        "xy": (pick(state, "X", "x"), pick(state, "Y", "y")),
        "weapon": slots.get("weapon"),
        "slots": slots,
        "bagIds": bag_ids,
        "wandAttr": wand_attr,
    }


def assert_kit(state: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if pick(state, "CharacterName", "characterName") != TARGET_NAME:
        errors.append(f"name={pick(state, 'CharacterName', 'characterName')}")
    if int(pick(state, "Level", "level", default=0) or 0) != LEVEL:
        errors.append(f"level={pick(state, 'Level', 'level')}")
    stats = {"Str": STR, "Int": INTEL, "Mag": MAG, "Vit": VIT, "Dex": DEX, "Chr": CHR}
    for key, want in stats.items():
        got = int(pick(state, key, key.lower(), default=-1) or -1)
        if got != want:
            errors.append(f"{key}={got} want {want}")
    total = sum(int(pick(state, k, k.lower(), default=0) or 0) for k in stats)
    if total != STAT_POOL:
        errors.append(f"stat total {total} want {STAT_POOL}")
    equipped = pick(state, "EquippedItems", "equippedItems", default=[]) or []
    slots = {
        pick(row, "Slot", "slot"): pick(pick(row, "Item", "item", default={}) or {}, "ItemId", "itemId")
        for row in equipped
    }
    if slots.get("helmet") != ITEM_HELM or slots.get("armor") != ITEM_ARMOR:
        errors.append(f"hero war slots={slots}")
    bag_rows = pick(state, "BagItems", "bagItems", default=[]) or []
    bag_ids = {int(pick(row, "ItemId", "itemId", default=0) or 0) for row in bag_rows}
    missing = {
        ITEM_GBH,
        ITEM_MS22,
        ITEM_CAP,
        ITEM_ROBE,
        ITEM_WINGS,
        ITEM_PLATE,
        ITEM_PLATE_LEGS,
        ITEM_PLATE_HAUBERK,
        ITEM_CAPE,
    } - bag_ids
    if missing:
        errors.append(f"bag missing {sorted(missing)}")
    wand = hammer = None
    cic_ok = 0
    for row in bag_rows:
        iid = int(pick(row, "ItemId", "itemId", default=0) or 0)
        if iid == ITEM_MS22:
            wand = int(pick(row, "ItemAttribute", "itemAttribute", default=0) or 0)
        if iid == ITEM_GBH:
            hammer = int(pick(row, "ItemAttribute", "itemAttribute", default=0) or 0)
        if iid in {ITEM_WINGS, ITEM_PLATE, ITEM_PLATE_LEGS, ITEM_PLATE_HAUBERK, ITEM_CAPE}:
            if (
                int(pick(row, "CicLevel", "cicLevel", default=0) or 0) == CIC_LEVEL
                and int(pick(row, "CicStatKind", "cicStatKind", default=0) or 0) == CIC_HP
                and int(pick(row, "CicStatValue", "cicStatValue", default=0) or 0) == CIC_HP_VALUE
            ):
                cic_ok += 1
    if wand != WAND_ATTR:
        errors.append(f"wand attr={wand} want {WAND_ATTR}")
    if hammer != HAMMER_ATTR:
        errors.append(f"hammer attr={hammer} want {HAMMER_ATTR} (+7)")
    if cic_ok != 5:
        errors.append(f"CIC4 HP70 pieces={cic_ok} want 5")
    return errors


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def connect():
    url = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_CONNECTION_STRING")
    if not url:
        return None, "DATABASE_URL / POSTGRES_CONNECTION_STRING not set"
    try:
        import psycopg  # type: ignore

        return psycopg.connect(url), None
    except Exception:
        pass
    try:
        import psycopg2  # type: ignore

        return psycopg2.connect(url), None
    except Exception as ex:
        return None, f"psycopg not available ({ex})"


def fetch_elon(conn) -> tuple[dict[str, Any] | None, str]:
    sql = """
        SELECT id::text, account_wallet, name, world_id, pos_x, pos_y, slot_index, hours_played, state_json
        FROM characters
        WHERE name = %s AND account_wallet = %s
    """
    with conn.cursor() as cur:
        cur.execute(sql, (TARGET_NAME, TARGET_WALLET))
        row = cur.fetchone()
    if not row:
        return None, (
            f"LIVE character {TARGET_NAME!r} was NOT found for wallet {TARGET_WALLET}. "
            "Stopped without INSERT."
        )
    keys = [
        "id",
        "account_wallet",
        "name",
        "world_id",
        "pos_x",
        "pos_y",
        "slot_index",
        "hours_played",
        "state_json",
    ]
    data = dict(zip(keys, row))
    state = data["state_json"]
    if isinstance(state, str):
        state = json.loads(state)
    data["state_json"] = state
    name = str(data["name"])
    if name != TARGET_NAME:
        return None, f"refusing unexpected name {name!r}"
    if str(data["account_wallet"]) != TARGET_WALLET:
        return None, "refusing unexpected wallet"
    if name.lower() in BLOCKED_NAMES:
        return None, f"refusing blocked name {name!r}"
    return data, ""


def write_elon(conn, row: dict[str, Any], state: dict[str, Any]) -> None:
    sql = """
        UPDATE characters
        SET state_json = %s::jsonb,
            updated_at = NOW()
        WHERE id = %s::uuid
          AND name = %s
          AND account_wallet = %s
    """
    payload = json.dumps(state, ensure_ascii=False)
    with conn.cursor() as cur:
        cur.execute(sql, (payload, row["id"], TARGET_NAME, TARGET_WALLET))
        if cur.rowcount != 1:
            raise RuntimeError(f"expected 1 row updated, got {cur.rowcount}")
    conn.commit()


def self_test() -> int:
    fixture = Path(__file__).resolve().parent / "fixtures" / "elon-live-kit-before.json"
    before = load_json(fixture)
    after = apply_kit(before)
    errors = assert_kit(after)
    if pick(after, "GameWorldId") != "traveler" or pick(after, "X") != 90:
        errors.append("spawn was rewritten")
    if int(pick(before, "Str")) != 14 or int(pick(before, "Vit")) != 14:
        errors.append("fixture stats drifted from live L1 report")
    if PLAYTEST_WAND_HR7 != 10_430_208:
        errors.append(f"playtest HR7 encode drifted {PLAYTEST_WAND_HR7}")
    if HAMMER_ATTR != (7 << 28):
        errors.append(f"hammer +7 attr {HAMMER_ATTR}")
    if errors:
        print("SELF-TEST FAIL:", file=sys.stderr)
        for err in errors:
            print(f"  {err}", file=sys.stderr)
        return 1
    print(
        "SELF-TEST OK: L1 14/14/12 overlay → L150 182/65/50/80/128/12, "
        f"bag GBH +7 attr={HAMMER_ATTR}, wand attr={WAND_ATTR} "
        "(CP nibble 15 / HR nibble 13 ≈91), CIC4 HP70 ×5."
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="Write the one Elon row (still needs ALLOW_LIVE_ELON_KIT=1).")
    parser.add_argument("--from-json", type=Path, help="Overlay a JSON snapshot (no DB).")
    parser.add_argument("--write-json", type=Path, help="Write overlay JSON (with --from-json).")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        return self_test()

    if args.from_json:
        before = load_json(args.from_json)
        name = pick(before, "CharacterName", "characterName")
        if name != TARGET_NAME:
            print(f"JSON character is {name!r}, not {TARGET_NAME!r}. Stopped.", file=sys.stderr)
            return 2
        after = apply_kit(before)
        print("BEFORE", json.dumps(summarize(before), indent=2))
        print("AFTER", json.dumps(summarize(after), indent=2))
        errors = assert_kit(after)
        if errors:
            print("kit check FAIL", errors, file=sys.stderr)
            return 1
        if args.write_json:
            args.write_json.write_text(json.dumps(after, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"wrote {args.write_json}")
        return 0

    if not allow_flag_on():
        print(
            f"{ALLOW_ENV} is not 1. Refusing to open Postgres. "
            "This door stays off on the game process.",
            file=sys.stderr,
        )
        return 4

    conn, err = connect()
    if conn is None:
        print(
            f"Cannot reach live Postgres ({err}). Elon was not edited from this host. "
            "Run on the game Postgres host with DATABASE_URL. This agent did not deploy.",
            file=sys.stderr,
        )
        return 3

    try:
        row, msg = fetch_elon(conn)
        if row is None:
            print(msg, file=sys.stderr)
            return 2
        before = row["state_json"]
        after = apply_kit(before)
        errors = assert_kit(after)
        print(f"FOUND id={row['id']} wallet={row['account_wallet']} name={row['name']!r} slot={row['slot_index']}")
        print("BEFORE", json.dumps(summarize(before), indent=2))
        print("AFTER", json.dumps(summarize(after), indent=2))
        print(
            f"encoding: wand ItemAttribute={WAND_ATTR} CP nibble={WAND_CP_NIBBLE} "
            f"(cap; CP40 no cabe) HR nibble={WAND_HR_NIBBLE} (×7≈91). "
            f"GBH +7 ItemAttribute={HAMMER_ATTR}. CIC4 HP70 ×5."
        )
        if errors:
            print("kit check FAIL", errors, file=sys.stderr)
            return 1
        if not args.apply:
            print("DRY-RUN: no write. Pass --apply with ALLOW_LIVE_ELON_KIT=1 to UPDATE this row only.")
            return 0
        write_elon(conn, row, after)
        print(
            f"UPDATED characters.id={row['id']} name=Elon (state_json only; world/pos unchanged). "
            "If Elon is online, re-log. Server was not restarted."
        )
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
