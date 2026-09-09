#!/usr/bin/env python3
"""Grant Elvine MAGO loadout to character Elon (Chile playtest).

Reads/writes persisted PlayerPersistenceState JSON under Chars/ and, when
DATABASE_URL is set, the dual-write PostgreSQL ``characters.state_json`` row.

Does not touch Config/maps, Magias/Gandalf, HUD, or client paint.
Never grants Aresden ``a Hero`` / Aresden cape ids (PR #62 kit purity).

Default is dry-run. Use --apply on Chile after the game process is stopped
(or Elon is fully offline). See ops/ELON-MAGO-CHILE-RUNBOOK.md.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

# --- Catalog (Items.json / Item.cfg / Item2.cfg / Item3.cfg / hero tables) ---

GOLD_ITEM_ID = 90
BERSERK_WAND_MS20 = 861  # Items.json "Berserk Wand(MS.20)"; Item3.cfg BerserkWand(MS.20)
TOWER_SHIELD = 87  # Items.json "Tower Shield"; Item.cfg TowerShield weight 4000
LICHE_NECK = 648  # Items.json "Necklace Of Liche"; Item3.cfg NecklaceOfLiche
ARC_MAGE_RING = 734  # Items.json "Ringof Arcmage"; Item3.cfg RingofArcmage
LONG_BOOTS = 451  # Items.json "Long Boots"; ArenaKitCatalog starter boots
ELVINE_HERO_CAPE = 401  # Items.json "Elvine Hero Cape" — never 400 Aresden Hero Cape
ELVINE_HERO_CAPE_PLUS = 428  # Items.json "Elvine Hero Cape+1"

# e Hero mage set (HeroFactionKit + HeroSetBonus MageSets Elvine)
E_HERO_CAP_M, E_HERO_CAP_W = 409, 410
E_HERO_ROBE_M, E_HERO_ROBE_W = 417, 418
E_HERO_HAUBERK_M, E_HERO_HAUBERK_W = 421, 422
E_HERO_LEGS_M, E_HERO_LEGS_W = 425, 426

# Arena mage-mp50 bag clothes (ArenaKitCatalog.json starter.freeArmorInBag)
WIZARD_HAT_M, WIZARD_HAT_W = 753, 757
CHAIN_MAIL_M, CHAIN_MAIL_W = 456, 476
HAUBERK_M, HAUBERK_W = 454, 472
PLATE_LEGS_M, PLATE_LEGS_W = 462, 483

# PR #62 — Aresden city kit → Elvine sibling (HeroFactionKit.AresdenToElvine)
ARESDEN_TO_ELVINE = {
    400: 401,
    403: 405,
    404: 406,
    407: 409,
    408: 410,
    411: 413,
    412: 414,
    415: 417,
    416: 418,
    419: 421,
    420: 422,
    423: 425,
    424: 426,
    427: 428,
}
ARESDEN_HERO_IDS = frozenset(ARESDEN_TO_ELVINE)
ELVINE_HERO_IDS = frozenset(ARESDEN_TO_ELVINE.values())

# ItemMagicAttribute / Enchanting.Encode (Helpers/Enchanting.cs)
P_LIGHT = 6
P_ENDURANCE = 8
S_DEFENSE_RATIO = 3
S_MP_REGEN = 6

# Tower Shield weight 4000 → STR 40. Light nibble 10 → −40 stones so STR 30 can wear.
# DR display = nibble × 7 → 10 × 7 = 70.
LIGHT_DR70_ATTR = None  # filled after encode()
MP50_CLOTHES_ATTR = None

# Item.cfg / Item3.cfg maxLife (token after v1–v6)
MAX_LIFE = {
    BERSERK_WAND_MS20: 5000,
    TOWER_SHIELD: 800,
    E_HERO_CAP_M: 1500,
    E_HERO_CAP_W: 1500,
    E_HERO_ROBE_M: 4000,
    E_HERO_ROBE_W: 4000,
    E_HERO_HAUBERK_M: 2000,
    E_HERO_HAUBERK_W: 2000,
    E_HERO_LEGS_M: 3000,
    E_HERO_LEGS_W: 3000,
    ELVINE_HERO_CAPE: 300,
    ELVINE_HERO_CAPE_PLUS: 300,
    LICHE_NECK: 300,
    ARC_MAGE_RING: 300,
    LONG_BOOTS: 300,
    WIZARD_HAT_M: 1500,
    WIZARD_HAT_W: 1500,
    CHAIN_MAIL_M: 3000,
    CHAIN_MAIL_W: 3000,
    HAUBERK_M: 2000,
    HAUBERK_W: 2000,
    PLATE_LEGS_M: 3000,
    PLATE_LEGS_W: 3000,
}

# Progression.cs GetLuPoints: LU = level*3 - (sum-70) - 3 + rebirth*6
# Fully spent (LU=0): sum = level*3 - 3 + 70 + rebirth*6
# L150 RB0 → 517 (matches ArenaKitCatalog.statTotalPoints)
MAX_STAT = 200  # Progression.MaxStat
STAT_FLOOR = 10
TARGET_STR, TARGET_DEX, TARGET_INT, TARGET_MAG, TARGET_CHR = 30, 50, 200, 200, 10
MIN_GOLD = 2000
MAGIC_SKILL_INDEX = 4  # Helpers/Skills.cs Magic
SKILL_COUNT = 19
MAGIC_SKILL_PLAYTEST = 100

LEDGER_NAMES = frozenset(
    {"referrals.json", "auction-board.json", "hell-mining.json", "timed-challenge-ledger.json"}
)

GANDALF_WORLD = "elvwzdtwr"
GANDALF_PARK = (45, 33)  # Chebyshev 3 from NPC 1 at (48,33); MagicTower.MaxInteractDistance=4


def encode(p_type: int, p_val: int, s_type: int, s_val: int, upgrade: int = 0) -> int:
    """Match Server.Helpers.Enchanting.Encode (nibbles packed into uint)."""
    p_type = max(0, min(15, p_type))
    p_val = max(0, min(15, p_val))
    s_type = max(0, min(15, s_type))
    s_val = max(0, min(15, s_val))
    upgrade = max(0, min(15, upgrade))
    return (upgrade << 28) | (p_type << 20) | (p_val << 16) | (s_type << 12) | (s_val << 8)


LIGHT_DR70_ATTR = encode(P_LIGHT, 10, S_DEFENSE_RATIO, 10, 0)
# ArenaLoadout.EncodeArmorMagicSecondary: Endurance 1 + secondary nibble 7 (~49% MP regen).
MP50_CLOTHES_ATTR = encode(P_ENDURANCE, 1, S_MP_REGEN, 7, 0)


def total_stat_budget(level: int, rebirth: int) -> int:
    """Allocated STR+VIT+DEX+INT+MAG+CHR when LU is fully spent."""
    return int(level) * 3 - 3 + 70 + max(0, int(rebirth)) * 6


def compute_vit(level: int, rebirth: int) -> tuple[int, int]:
    """Return (vit, leftover_lu). VIT is leftover after MAG/INT/STR/DEX/CHR floors."""
    budget = total_stat_budget(level, rebirth)
    reserved = TARGET_MAG + TARGET_INT + TARGET_STR + TARGET_DEX + TARGET_CHR
    raw = budget - reserved
    if raw < STAT_FLOOR:
        return STAT_FLOOR, max(0, budget - (reserved - TARGET_CHR + STAT_FLOOR) - STAT_FLOOR)
    vit = min(MAX_STAT, raw)
    leftover = max(0, raw - vit)
    return vit, leftover


def get_i(d: dict[str, Any], *keys: str, default: int = 0) -> int:
    for k in keys:
        if k in d and d[k] is not None:
            try:
                return int(d[k])
            except (TypeError, ValueError):
                pass
    return default


def get_s(d: dict[str, Any], *keys: str, default: str = "") -> str:
    for k in keys:
        if k in d and d[k] is not None:
            return str(d[k])
    return default


def char_name(state: dict[str, Any]) -> str:
    return get_s(state, "CharacterName", "characterName").strip()


def set_pascal(state: dict[str, Any], pascal: str, value: Any) -> None:
    state[pascal] = value
    camel = pascal[:1].lower() + pascal[1:]
    state.pop(camel, None)


def rewrite_hero_id(item_id: int) -> int:
    return ARESDEN_TO_ELVINE.get(int(item_id), int(item_id))


def item_id_of(row: dict[str, Any]) -> int:
    if "ItemId" in row:
        return int(row["ItemId"] or 0)
    if "itemId" in row:
        return int(row["itemId"] or 0)
    inner = row.get("Item") or row.get("item") or {}
    if isinstance(inner, dict):
        return get_i(inner, "ItemId", "itemId")
    return 0


def collect_uids(state: dict[str, Any]) -> set[int]:
    uids: set[int] = set()

    def walk(obj: Any) -> None:
        if isinstance(obj, dict):
            uid = obj.get("ItemUid", obj.get("itemUid"))
            if uid is not None:
                try:
                    uids.add(int(uid))
                except (TypeError, ValueError):
                    pass
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(state.get("BagItems") or state.get("bagItems") or [])
    walk(state.get("EquippedItems") or state.get("equippedItems") or [])
    walk(state.get("WarehouseItems") or state.get("warehouseItems") or [])
    return uids


def new_uid(used: set[int]) -> int:
    for _ in range(32):
        uid = random.randint(10**12, 9 * 10**17)
        if uid not in used:
            used.add(uid)
            return uid
    uid = int(time.time() * 1_000_000) ^ random.randint(1, 10**9)
    used.add(uid)
    return uid


def allocate_bag_slot(index: int) -> tuple[int, int]:
    """Match InventoryManager.AllocateBagSlot."""
    bag_width, bag_height, cell, pad = 148, 120, 36, 8
    cols = max(1, (bag_width - pad * 2) // cell)
    col, row = index % cols, index // cols
    bag_x = pad + cell // 2 + col * cell
    bag_y = pad + cell // 2 + row * cell
    if bag_y > bag_height - pad:
        bag_y = bag_height // 2
        bag_x = bag_width // 2
    return bag_x, bag_y


def persisted_item(
    item_id: int,
    uid: int,
    *,
    attr: int = 0,
    color: int = 0,
    qty: int = 1,
    bag_x: int | None = None,
    bag_y: int | None = None,
    bag_z: int = 0,
    equipped: bool = False,
) -> dict[str, Any]:
    life = MAX_LIFE.get(int(item_id), 0)
    row: dict[str, Any] = {
        "ItemId": int(item_id),
        "ItemUid": int(uid),
        "BagX": bag_x,
        "BagY": bag_y,
        "EffectOverrides": None,
        "ItemAttribute": int(attr),
        "ItemColor": int(color),
        "CurLifeSpan": life,
        "MaxLifeSpan": life,
        "BindState": 0,
        "BoundGuildId": "",
        "CicLevel": 0,
        "CicStatKind": 0,
        "CicStatValue": 0,
        "SiphonLevel": 0,
    }
    if not equipped:
        row["Quantity"] = int(qty)
        row["BagZIndex"] = int(bag_z)
    return row


def rewrite_item_dict(item: dict[str, Any]) -> None:
    iid = get_i(item, "ItemId", "itemId")
    nxt = rewrite_hero_id(iid)
    if nxt != iid:
        set_pascal(item, "ItemId", nxt)


def rewrite_inventory_lists(state: dict[str, Any]) -> int:
    changed = 0
    for key in ("BagItems", "bagItems", "WarehouseItems", "warehouseItems"):
        rows = state.get(key)
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, dict):
                continue
            before = item_id_of(row)
            rewrite_item_dict(row)
            if item_id_of(row) != before:
                changed += 1
    eq = state.get("EquippedItems") or state.get("equippedItems")
    if isinstance(eq, list):
        for row in eq:
            if not isinstance(row, dict):
                continue
            inner = row.get("Item") or row.get("item")
            if isinstance(inner, dict):
                before = item_id_of(inner)
                rewrite_item_dict(inner)
                if item_id_of(inner) != before:
                    changed += 1
    return changed


def bag_list(state: dict[str, Any]) -> list[dict[str, Any]]:
    rows = state.get("BagItems")
    if rows is None:
        rows = state.get("bagItems")
    if not isinstance(rows, list):
        rows = []
        state["BagItems"] = rows
    else:
        set_pascal(state, "BagItems", rows)
    return rows


def equipped_list(state: dict[str, Any]) -> list[dict[str, Any]]:
    rows = state.get("EquippedItems")
    if rows is None:
        rows = state.get("equippedItems")
    if not isinstance(rows, list):
        rows = []
        state["EquippedItems"] = rows
    else:
        set_pascal(state, "EquippedItems", rows)
    return rows


def count_gold(state: dict[str, Any]) -> int:
    total = 0
    for row in bag_list(state):
        if item_id_of(row) == GOLD_ITEM_ID:
            total += get_i(row, "Quantity", "quantity", default=1)
    return total


def ensure_gold(state: dict[str, Any], used: set[int], minimum: int) -> int:
    have = count_gold(state)
    if have >= minimum:
        return 0
    need = minimum - have
    for row in bag_list(state):
        if item_id_of(row) == GOLD_ITEM_ID:
            q = get_i(row, "Quantity", "quantity", default=1)
            set_pascal(row, "Quantity", q + need)
            set_pascal(row, "ItemId", GOLD_ITEM_ID)
            return need
    bags = bag_list(state)
    bx, by = allocate_bag_slot(len(bags))
    bags.append(persisted_item(GOLD_ITEM_ID, new_uid(used), qty=need, bag_x=bx, bag_y=by, bag_z=len(bags)))
    return need


def unequip_to_bag(state: dict[str, Any], slot: str, used: set[int]) -> None:
    eq = equipped_list(state)
    keep: list[dict[str, Any]] = []
    bags = bag_list(state)
    for row in eq:
        s = get_s(row, "Slot", "slot")
        if s != slot:
            keep.append(row)
            continue
        inner = row.get("Item") or row.get("item") or {}
        if not isinstance(inner, dict) or item_id_of(inner) <= 0:
            continue
        moved = dict(inner)
        if "Quantity" not in moved and "quantity" not in moved:
            moved["Quantity"] = 1
        if moved.get("BagX") is None and moved.get("bagX") is None:
            bx, by = allocate_bag_slot(len(bags))
            moved["BagX"] = bx
            moved["BagY"] = by
        moved["BagZIndex"] = len(bags)
        bags.append(moved)
    set_pascal(state, "EquippedItems", keep)


def put_equipped(
    state: dict[str, Any],
    slot: str,
    item_id: int,
    used: set[int],
    *,
    attr: int = 0,
    color: int = 0,
) -> None:
    if item_id in ARESDEN_HERO_IDS:
        raise RuntimeError(f"refusing Aresden Hero id {item_id} on slot {slot}")
    unequip_to_bag(state, slot, used)
    eq = equipped_list(state)
    eq.append(
        {
            "Slot": slot,
            "Item": persisted_item(item_id, new_uid(used), attr=attr, color=color, equipped=True),
        }
    )
    set_pascal(state, "EquippedItems", eq)


def has_bag_item(state: dict[str, Any], item_id: int, attr: int | None = None) -> bool:
    for row in bag_list(state):
        if item_id_of(row) != item_id:
            continue
        if attr is None:
            return True
        if get_i(row, "ItemAttribute", "itemAttribute") == attr:
            return True
    return False


def add_bag_item(state: dict[str, Any], item_id: int, used: set[int], *, attr: int = 0, color: int = 0) -> None:
    if item_id in ARESDEN_HERO_IDS:
        raise RuntimeError(f"refusing Aresden Hero id {item_id} in bag")
    bags = bag_list(state)
    bx, by = allocate_bag_slot(len(bags))
    bags.append(
        persisted_item(item_id, new_uid(used), attr=attr, color=color, bag_x=bx, bag_y=by, bag_z=len(bags))
    )


def gender_value(state: dict[str, Any]) -> int:
    return 1 if get_i(state, "GenderValue", "genderValue") == 1 else 0


def mage_hero_ids(female: bool) -> dict[str, int]:
    if female:
        return {
            "helmet": E_HERO_CAP_W,
            "armor": E_HERO_ROBE_W,
            "hauberk": E_HERO_HAUBERK_W,
            "leggings": E_HERO_LEGS_W,
        }
    return {
        "helmet": E_HERO_CAP_M,
        "armor": E_HERO_ROBE_M,
        "hauberk": E_HERO_HAUBERK_M,
        "leggings": E_HERO_LEGS_M,
    }


def mp_bag_clothes(female: bool) -> list[int]:
    if female:
        return [WIZARD_HAT_W, CHAIN_MAIL_W, HAUBERK_W, PLATE_LEGS_W]
    return [WIZARD_HAT_M, CHAIN_MAIL_M, HAUBERK_M, PLATE_LEGS_M]


def ensure_magic_skill(state: dict[str, Any]) -> None:
    skills = state.get("SkillLevels") or state.get("skillLevels")
    if not isinstance(skills, list):
        skills = [0] * SKILL_COUNT
    while len(skills) < SKILL_COUNT:
        skills.append(0)
    cur = 0
    try:
        cur = int(skills[MAGIC_SKILL_INDEX] or 0)
    except (TypeError, ValueError):
        cur = 0
    skills[MAGIC_SKILL_INDEX] = max(cur, MAGIC_SKILL_PLAYTEST)
    set_pascal(state, "SkillLevels", skills)


def apply_mago(state: dict[str, Any], *, park_gandalf: bool, min_gold: int) -> dict[str, Any]:
    """Mutate one PlayerPersistenceState dict. Returns a summary."""
    name = char_name(state)
    if name.lower() != "elon":
        raise RuntimeError(f"refusing to patch name {name!r} (expected Elon)")

    level = max(1, get_i(state, "Level", "level", default=1))
    rebirth = max(0, get_i(state, "Rebirth", "rebirth", default=0))
    vit, leftover_lu = compute_vit(level, rebirth)
    if TARGET_MAG > MAX_STAT or TARGET_INT > MAX_STAT:
        raise RuntimeError("target MAG/INT exceed Progression.MaxStat")
    reserved = TARGET_MAG + TARGET_INT + TARGET_STR + TARGET_DEX + TARGET_CHR
    if total_stat_budget(level, rebirth) < reserved + STAT_FLOOR:
        raise RuntimeError(
            f"L{level} RB{rebirth} budget {total_stat_budget(level, rebirth)} "
            f"cannot fund MAG/INT 200 + STR 30 + DEX 50 + CHR 10 + VIT floor"
        )

    set_pascal(state, "CharacterName", "Elon")
    set_pascal(state, "CitizenshipSide", "elvine")
    set_pascal(state, "Str", TARGET_STR)
    set_pascal(state, "Vit", vit)
    set_pascal(state, "Dex", TARGET_DEX)
    set_pascal(state, "Int", TARGET_INT)
    set_pascal(state, "Mag", TARGET_MAG)
    set_pascal(state, "Chr", TARGET_CHR)
    set_pascal(state, "HungerStatus", 100)

    female = gender_value(state) == 1
    rewritten = rewrite_inventory_lists(state)
    used = collect_uids(state)

    hero = mage_hero_ids(female)
    # Hero clothes carry MP-focus secondary (arena Endurance+MP nibble 7).
    put_equipped(state, "helmet", hero["helmet"], used, attr=MP50_CLOTHES_ATTR)
    put_equipped(state, "armor", hero["armor"], used, attr=MP50_CLOTHES_ATTR)
    put_equipped(state, "hauberk", hero["hauberk"], used, attr=MP50_CLOTHES_ATTR)
    put_equipped(state, "leggings", hero["leggings"], used, attr=MP50_CLOTHES_ATTR)
    put_equipped(state, "cape", ELVINE_HERO_CAPE, used)
    put_equipped(state, "boots", LONG_BOOTS, used)
    put_equipped(state, "weapon", BERSERK_WAND_MS20, used)  # pure rare; catalog MS.20; attr 0
    put_equipped(state, "shield", TOWER_SHIELD, used, attr=LIGHT_DR70_ATTR, color=2)
    put_equipped(state, "necklace", LICHE_NECK, used)
    put_equipped(state, "ring-left", ARC_MAGE_RING, used)

    for iid in mp_bag_clothes(female):
        if not has_bag_item(state, iid, MP50_CLOTHES_ATTR):
            add_bag_item(state, iid, used, attr=MP50_CLOTHES_ATTR)

    gold_added = ensure_gold(state, used, min_gold)
    ensure_magic_skill(state)

    if park_gandalf:
        set_pascal(state, "GameWorldId", GANDALF_WORLD)
        set_pascal(state, "X", GANDALF_PARK[0])
        set_pascal(state, "Y", GANDALF_PARK[1])

    leftover_ids = faction_ids_in_state(state)
    bad = leftover_ids & ARESDEN_HERO_IDS
    if bad:
        raise RuntimeError(f"Aresden Hero ids still present after rewrite: {sorted(bad)}")

    return {
        "name": "Elon",
        "level": level,
        "rebirth": rebirth,
        "budget": total_stat_budget(level, rebirth),
        "str": TARGET_STR,
        "vit": vit,
        "dex": TARGET_DEX,
        "int": TARGET_INT,
        "mag": TARGET_MAG,
        "chr": TARGET_CHR,
        "leftoverLu": leftover_lu,
        "gold": count_gold(state),
        "goldAdded": gold_added,
        "heroRewritten": rewritten,
        "female": female,
        "equipped": equipped_snapshot(state),
        "park": f"{GANDALF_WORLD} {GANDALF_PARK}" if park_gandalf else "unchanged",
    }


def faction_ids_in_state(state: dict[str, Any]) -> set[int]:
    ids: set[int] = set()
    for row in bag_list(state):
        ids.add(item_id_of(row))
    for row in equipped_list(state):
        inner = row.get("Item") or row.get("item") or row
        if isinstance(inner, dict):
            ids.add(item_id_of(inner))
    for row in state.get("WarehouseItems") or state.get("warehouseItems") or []:
        if isinstance(row, dict):
            ids.add(item_id_of(row))
    return ids


def equipped_snapshot(state: dict[str, Any]) -> dict[str, int]:
    out: dict[str, int] = {}
    for row in equipped_list(state):
        slot = get_s(row, "Slot", "slot")
        inner = row.get("Item") or row.get("item") or {}
        if slot and isinstance(inner, dict):
            out[slot] = item_id_of(inner)
    return out


def iter_char_files(chars_dir: Path) -> list[Path]:
    files: list[Path] = []
    for path in sorted(chars_dir.glob("*.json")):
        if path.name in LEDGER_NAMES or path.name.startswith("reports"):
            continue
        if "reports" in path.parts:
            continue
        files.append(path)
    return files


def load_json(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def write_json_atomic(path: Path, state: dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)


def backup_file(path: Path, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    dest = backup_dir / f"{path.name}.{int(time.time())}.bak"
    shutil.copy2(path, dest)
    return dest


def find_database_url() -> str:
    for key in ("DATABASE_URL", "POSTGRES_CONNECTION_STRING"):
        val = (os.environ.get(key) or "").strip()
        if val:
            return val
    for candidate in (
        Path("/opt/chainlords/ops/config.env"),
        Path("/opt/chainlords/server/.env"),
        Path("/opt/chainlords/ops/.env"),
    ):
        if not candidate.is_file():
            continue
        for line in candidate.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line.startswith("export "):
                line = line[7:]
            if line.startswith("DATABASE_URL=") or line.startswith("POSTGRES_CONNECTION_STRING="):
                return line.split("=", 1)[1].strip().strip("'\"")
    return ""


def postgres_rows(database_url: str, name: str) -> list[tuple[str, str, dict[str, Any]]]:
    """Return (wallet, db_name, state) via psql. Empty if psql/url missing."""
    if not database_url:
        return []
    qname = name.replace("'", "''")
    psql_sql = (
        "SELECT account_wallet || E'\\t' || name || E'\\t' || state_json::text "
        f"FROM characters WHERE LOWER(name) = LOWER('{qname}');"
    )
    try:
        proc = subprocess.run(
            ["psql", database_url, "-At", "-v", "ON_ERROR_STOP=1", "-c", psql_sql],
            check=False,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        print("NOTE: psql not on PATH — skip PostgreSQL scan (JSON only).", file=sys.stderr)
        return []
    if proc.returncode != 0:
        print(f"NOTE: psql list failed ({proc.returncode}): {proc.stderr.strip()[:240]}", file=sys.stderr)
        return []
    rows: list[tuple[str, str, dict[str, Any]]] = []
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t", 2)
        if len(parts) != 3:
            continue
        wallet, db_name, raw = parts
        try:
            state = json.loads(raw)
        except json.JSONDecodeError:
            continue
        rows.append((wallet, db_name, state))
    return rows


def postgres_write(database_url: str, wallet: str, name: str, state: dict[str, Any]) -> bool:
    world = get_s(state, "GameWorldId", "gameWorldId", default="elvine") or "elvine"
    x = get_i(state, "X", "x")
    y = get_i(state, "Y", "y")
    payload = json.dumps(state, ensure_ascii=False)
    return _postgres_write_via_stdin(database_url, wallet, name, world, x, y, payload)


def _postgres_write_via_stdin(
    database_url: str,
    wallet: str,
    name: str,
    world: str,
    x: int,
    y: int,
    payload: str,
) -> bool:
    # dollar-quote the JSON so we never interpolate bag contents into SQL identifiers
    tag = "ELONJSON"
    while tag in payload:
        tag += "X"
    sql = (
        f"UPDATE characters SET state_json = ${tag}${payload}${tag}$::jsonb, "
        f"world_id = ${tag}W${world}${tag}W$, "
        f"pos_x = {int(x)}, pos_y = {int(y)}, updated_at = NOW() "
        f"WHERE account_wallet = ${tag}A${wallet}${tag}A$ "
        f"AND LOWER(name) = LOWER(${tag}N${name}${tag}N$);"
    )
    proc = subprocess.run(
        ["psql", database_url, "-v", "ON_ERROR_STOP=1", "-c", sql],
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(f"PostgreSQL write failed: {proc.stderr.strip()[:400]}", file=sys.stderr)
        return False
    return True


def print_recipe() -> None:
    vit150, lu150 = compute_vit(150, 0)
    print("=== Elon MAGO recipe (repo-computed, Elvine only) ===")
    print("Stats formula: Progression.GetLuPoints → LU = L*3 - (sum-70) - 3 + RB*6")
    print(f"  L150 RB0 total budget = {total_stat_budget(150, 0)} (ArenaKitCatalog.statTotalPoints)")
    print(
        f"  MAG {TARGET_MAG} INT {TARGET_INT} STR {TARGET_STR} DEX {TARGET_DEX} "
        f"CHR {TARGET_CHR} → VIT {vit150} (LU leftover {lu150})"
    )
    print(f"  Extra rebirth LU (+6 each) all goes to VIT (cap {MAX_STAT})")
    print("Items (never a Hero / Aresden cape):")
    print(f"  weapon     {BERSERK_WAND_MS20} Berserk Wand(MS.20)  attr=0 (pure rare, catalog MS.20)")
    print(f"  shield     {TOWER_SHIELD} Tower Shield  Light+DR70 attr={LIGHT_DR70_ATTR} color=2")
    print(f"  necklace   {LICHE_NECK} Necklace Of Liche  ADDEFFECT mana-save 15 (Item3.cfg)")
    print(f"  ring-left  {ARC_MAGE_RING} Ringof Arcmage  ADDEFFECT +4 magical dmg (Item3.cfg)")
    print(f"  cape       {ELVINE_HERO_CAPE} Elvine Hero Cape")
    print("  e Hero mage M: cap 409 / robe 417 / hauberk 421 / legs 425  (MP50 attr)")
    print("  e Hero mage W: cap 410 / robe 418 / hauberk 422 / legs 426  (MP50 attr)")
    print(f"  MP50 clothes attr={MP50_CLOTHES_ATTR} (Endurance1 + MP nibble 7, same as ArenaLoadout)")
    print(f"  gold item  {GOLD_ITEM_ID}  min {MIN_GOLD}")
    print("  Missile/Heal learn: Magic.cfg ReqInt 18/20, gold 100/100 (MagicTower.SpellGoldPrices)")
    print("No admin grant API — Chars JSON + characters.state_json only.")


def run_self_test() -> int:
    print_recipe()
    assert total_stat_budget(150, 0) == 517
    assert compute_vit(150, 0) == (27, 0)
    assert compute_vit(150, 1) == (33, 0)
    assert LIGHT_DR70_ATTR == encode(6, 10, 3, 10, 0)
    assert MP50_CLOTHES_ATTR == encode(8, 1, 6, 7, 0)
    fixture = {
        "CharacterName": "Elon",
        "Level": 150,
        "Rebirth": 0,
        "GenderValue": 0,
        "CitizenshipSide": "traveler",
        "Str": 10,
        "Vit": 10,
        "Dex": 10,
        "Int": 10,
        "Mag": 10,
        "Chr": 10,
        "BagItems": [
            persisted_item(90, 1, qty=50, bag_x=8, bag_y=8),
            persisted_item(400, 2, bag_x=44, bag_y=8),  # Aresden cape — must rewrite
        ],
        "EquippedItems": [
            {
                "Slot": "armor",
                "Item": persisted_item(415, 3, equipped=True),  # a Hero Robe(M)
            }
        ],
        "GameWorldId": "aresden",
        "X": 1,
        "Y": 1,
    }
    summary = apply_mago(fixture, park_gandalf=True, min_gold=MIN_GOLD)
    assert summary["vit"] == 27
    assert summary["mag"] == 200
    assert summary["gold"] >= MIN_GOLD
    eq = summary["equipped"]
    assert eq["weapon"] == BERSERK_WAND_MS20
    assert eq["shield"] == TOWER_SHIELD
    assert eq["necklace"] == LICHE_NECK
    assert eq["ring-left"] == ARC_MAGE_RING
    assert eq["helmet"] == E_HERO_CAP_M
    assert eq["armor"] == E_HERO_ROBE_M
    assert eq["hauberk"] == E_HERO_HAUBERK_M
    assert eq["leggings"] == E_HERO_LEGS_M
    assert eq["cape"] == ELVINE_HERO_CAPE
    leftover = faction_ids_in_state(fixture)
    assert not (leftover & ARESDEN_HERO_IDS), leftover
    assert 401 in leftover  # rewritten cape
    assert fixture["CitizenshipSide"] == "elvine"
    assert fixture["GameWorldId"] == GANDALF_WORLD
    shield = next(r["Item"] for r in fixture["EquippedItems"] if r["Slot"] == "shield")
    assert shield["ItemAttribute"] == LIGHT_DR70_ATTR
    print("SELF-TEST OK", json.dumps(summary, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Write JSON/Postgres (default: dry-run)")
    parser.add_argument("--self-test", action="store_true", help="Run fixture assertions and exit")
    parser.add_argument("--print-recipe", action="store_true", help="Print ids/stats and exit")
    parser.add_argument("--name", default="Elon", help="CharacterName to match (default Elon)")
    parser.add_argument("--chars-dir", default=os.environ.get("CHARS_DIR", "/opt/chainlords/server/Chars"))
    parser.add_argument("--min-gold", type=int, default=MIN_GOLD)
    parser.add_argument("--park-gandalf", action="store_true", help="Move Elon to elvwzdtwr (45,33)")
    parser.add_argument("--skip-postgres", action="store_true")
    args = parser.parse_args()

    if args.self_test:
        return run_self_test()
    if args.print_recipe:
        print_recipe()
        return 0
    if args.name.lower() != "elon":
        print("This playtest script is locked to Elon.", file=sys.stderr)
        return 2

    print_recipe()
    chars_dir = Path(args.chars_dir)
    database_url = "" if args.skip_postgres else find_database_url()
    matches: list[tuple[str, dict[str, Any], Path | None]] = []

    if chars_dir.is_dir():
        for path in iter_char_files(chars_dir):
            state = load_json(path)
            if not state:
                continue
            if char_name(state).lower() != "elon":
                continue
            matches.append(("json", state, path))
    else:
        print(f"NOTE: CHARS_DIR missing ({chars_dir}) — JSON scan skipped")

    if database_url:
        for wallet, db_name, state in postgres_rows(database_url, "Elon"):
            if char_name(state).lower() != "elon" and db_name.lower() != "elon":
                continue
            print(f"PG hit wallet={wallet[:8]}… name={db_name!r} L{get_i(state, 'Level', 'level')}")
            matches.append((f"pg:{wallet}", state, None))
    else:
        print("NOTE: no DATABASE_URL — PostgreSQL dual-write skipped")

    if not matches:
        print("No Elon snapshots found. Scan names:")
        if chars_dir.is_dir():
            for path in iter_char_files(chars_dir):
                st = load_json(path)
                if st:
                    print(f"  {char_name(st)!r}  {path.name}")
        return 2

    backup_dir = chars_dir / "backups-elon-mago" if chars_dir.is_dir() else Path("/tmp/elon-mago-backups")
    applied = 0
    for kind, state, path in matches:
        before = {
            "file": path.name if path else kind,
            "side": get_s(state, "CitizenshipSide", "citizenshipSide"),
            "L": get_i(state, "Level", "level"),
            "RB": get_i(state, "Rebirth", "rebirth"),
            "STR": get_i(state, "Str", "str", default=10),
            "VIT": get_i(state, "Vit", "vit", default=10),
            "DEX": get_i(state, "Dex", "dex", default=10),
            "INT": get_i(state, "Int", "int", default=10),
            "MAG": get_i(state, "Mag", "mag", default=10),
            "gold": count_gold(state),
            "eq": equipped_snapshot(state),
        }
        print("BEFORE", json.dumps(before, ensure_ascii=False))
        summary = apply_mago(state, park_gandalf=args.park_gandalf, min_gold=args.min_gold)
        print("AFTER ", json.dumps(summary, ensure_ascii=False))
        if not args.apply:
            continue
        if path is not None:
            bak = backup_file(path, backup_dir)
            write_json_atomic(path, state)
            print(f"WROTE {path} (backup {bak})")
            applied += 1
        elif kind.startswith("pg:"):
            wallet = kind.split(":", 1)[1]
            if postgres_write(database_url, wallet, "Elon", state):
                print(f"WROTE postgres characters.Elon wallet={wallet[:8]}…")
                applied += 1
            else:
                return 1

    # If we applied JSON for a wallet that also lives in PG, patch PG from the JSON result.
    if args.apply and database_url:
        for kind, state, path in matches:
            if path is None:
                continue
            wallet = path.name.replace(".traveler.json", "").replace(".json", "")
            if postgres_write(database_url, wallet, "Elon", state):
                print(f"DUAL-WRITE postgres from {path.name} wallet={wallet[:8]}…")
                applied += 1
            else:
                print(f"WARNING: postgres dual-write failed for {path.name}", file=sys.stderr)

    if not args.apply:
        print("dry-run only (pass --apply to write). Do not leave Elon online while applying.")
        return 0
    print(f"done writes={applied}. Elon must re-log. Learn Missile(0)/Heal(1) at Gandalf.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
