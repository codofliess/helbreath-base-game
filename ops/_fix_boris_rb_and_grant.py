#!/usr/bin/env python3
"""Inspect + fix BORIS: report rebirth/level, grant specialty L50 all mobs, +1000 maj if needed."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

CHARS = Path(os.environ.get("CHARS_DIR", "/opt/chainlords/server/Chars"))
CONFIG = Path(os.environ.get("CONFIG_DIR", "/opt/chainlords/server/Config"))
WALLET_PREFIX = "36zA4DKL"
TARGET_SPECIALTY_L = 50
MAJ_GRANT = 1000


def load_ids():
    data = json.loads((CONFIG / "Monsters.json").read_text(encoding="utf-8-sig"))
    return sorted({int(r["id"]) for r in data if "id" in r})


def load_bases():
    path = CONFIG / "MobSpecialties.json"
    out = {}
    if not path.is_file():
        return out
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    for row in data:
        if "id" not in row:
            continue
        out[int(row["id"])] = int(row.get("base_kills") or 125)
    return out


def kills_for(base: int, level: int) -> int:
    return max(0, base) * level * level


def name_of(d: dict) -> str:
    return str(d.get("CharacterName") or d.get("characterName") or "")


def get_i(d: dict, *keys, default=0):
    for k in keys:
        if k in d and d[k] is not None:
            try:
                return int(d[k])
            except (TypeError, ValueError):
                pass
    return default


def main() -> int:
    bases = load_bases()
    ids = load_ids()
    files = sorted(CHARS.glob("*.json"))
    touched = []
    for path in files:
        if path.name in ("referrals.json", "auction-board.json", "hell-mining.json"):
            continue
        if "36zA4DKL" not in path.name and "boris" not in path.name.lower():
            # still open to check CharacterName
            pass
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        nm = name_of(d)
        is_boris = nm.lower() == "boris" or "36zA4DKL" in path.name
        if not is_boris:
            continue

        lvl = get_i(d, "Level", "level", default=1)
        rb = get_i(d, "Rebirth", "rebirth", default=0)
        maj = get_i(d, "MajesticPoints", "majesticPoints", default=0)
        exp = get_i(d, "Exp", "exp", default=0)
        print(f"BEFORE {path.name}: name={nm!r} L{lvl} RB{rb} maj={maj} exp={exp}")

        # Grant specialty L50 for all species
        rows = []
        for mid in ids:
            b = bases.get(mid, 125)
            rows.append({"MonsterId": mid, "Kills": kills_for(b, TARGET_SPECIALTY_L)})
        d["MonsterKills"] = rows
        d.pop("monsterKills", None)

        # Majestics: ensure at least MAJ_GRANT (idempotent — do not stack on re-run).
        if maj < MAJ_GRANT:
            d["MajesticPoints"] = MAJ_GRANT
            d.pop("majesticPoints", None)
            print(f"  Majestics {maj} → {MAJ_GRANT}")
        else:
            print(f"  Majestics already {maj} (>= {MAJ_GRANT}) — left unchanged")

        # Restore wiped rebirth: RB0 at L150 was reported as lost RB5 (not intentional).
        if rb == 0:
            d["Rebirth"] = 5
            d.pop("rebirth", None)
            print(f"  RESTORED Rebirth 0 → 5")
        else:
            print(f"  Rebirth is {rb} — left unchanged")

        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        tmp.replace(path)
        print(f"AFTER  {path.name}: L{get_i(d,'Level','level')} RB{get_i(d,'Rebirth','rebirth')} maj={d['MajesticPoints']} specialtyL={TARGET_SPECIALTY_L} species={len(rows)}")
        touched.append(path.name)

    if not touched:
        print("No BORIS files found")
        return 2
    print("done:", ", ".join(touched))
    print("NOTE: if BORIS is online, stop server before grant or re-log after stop-grant-start")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
