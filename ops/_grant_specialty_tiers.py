#!/usr/bin/env python3
"""Grant Olympia-style mob specialty tiers via kill counters (kills >= base * L^2).

Targets (characterName, case-insensitive):
  Insk  → L50
  Co2   → L100  (PO "a mi")
  Morlak / Dunga → L150  (Morlak wallet may now be Dunga)
  BORIS → L200

Writes traveler + non-traveler JSON under CHARS_DIR. Online players must re-log
(or world-transfer) to pick up the new counters after the server loads saves.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

CHARS_DIR = Path(os.environ.get("CHARS_DIR", "/opt/chainlords/server/Chars"))
CONFIG_DIR = Path(os.environ.get("CONFIG_DIR", "/opt/chainlords/server/Config"))

# Character display name → specialty level (real tier from kills).
TARGETS: dict[str, int] = {
    "insk": 50,
    "co2": 100,
    "morlak": 150,
    "dunga": 150,  # same account historically as Morlak
    "boris": 200,
}


def load_monster_ids() -> list[int]:
    path = CONFIG_DIR / "Monsters.json"
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    return sorted({int(row["id"]) for row in data if "id" in row})


def load_base_kills() -> dict[int, int]:
    path = CONFIG_DIR / "MobSpecialties.json"
    out: dict[int, int] = {}
    if not path.is_file():
        return out
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    for row in data:
        mid = int(row["id"])
        out[mid] = int(row.get("base_kills") or 150)
    return out


def kills_for_level(base: int, level: int) -> int:
    if level <= 0:
        return 0
    return int(base) * int(level) * int(level)


def build_monster_kills(monster_ids: list[int], bases: dict[int, int], level: int) -> list[dict]:
    rows = []
    for mid in monster_ids:
        base = bases.get(mid, 150)
        k = kills_for_level(base, level)
        rows.append({"MonsterId": mid, "Kills": k})
    return rows


def char_name(state: dict) -> str:
    return str(state.get("CharacterName") or state.get("characterName") or "").strip()


def apply_file(path: Path, monster_ids: list[int], bases: dict[int, int]) -> str | None:
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except Exception as ex:
        return f"skip {path.name}: {ex}"

    name = char_name(state)
    key = name.lower()
    if key not in TARGETS:
        return None

    level = TARGETS[key]
    rows = build_monster_kills(monster_ids, bases, level)
    # Prefer PascalCase (server persistence) and drop camelCase twin if present.
    state["MonsterKills"] = rows
    if "monsterKills" in state:
        del state["monsterKills"]

    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)
    return f"OK {name} L{level} → {path.name} ({len(rows)} species, e.g. kills={rows[0]['Kills'] if rows else 0})"


def main() -> int:
    if not CHARS_DIR.is_dir():
        print(f"CHARS_DIR missing: {CHARS_DIR}", file=sys.stderr)
        return 1
    monster_ids = load_monster_ids()
    bases = load_base_kills()
    print(f"species={len(monster_ids)} specialty_defs={len(bases)} chars_dir={CHARS_DIR}")

    applied = []
    for path in sorted(CHARS_DIR.glob("*.json")):
        if path.name in ("referrals.json", "auction-board.json", "hell-mining.json"):
            continue
        if path.name.startswith("reports"):
            continue
        msg = apply_file(path, monster_ids, bases)
        if msg:
            print(msg)
            applied.append(msg)

    if not applied:
        print("No matching characters found. Names present:")
        for path in sorted(CHARS_DIR.glob("*.json")):
            try:
                st = json.loads(path.read_text(encoding="utf-8"))
                print(f"  {char_name(st)!r}  {path.name}")
            except Exception:
                pass
        return 2

    print(f"done: {len(applied)} file(s). Players online need re-log to load.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
