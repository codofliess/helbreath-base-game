#!/usr/bin/env python3
"""Recalculate 2026-07-25 mining credits under new testing-week rules.

Rules applied:
  - +1 login
  - +1 per full hour online (AFK counts)
  - Farm (day-1 targets / estimates; live path is HP-weighted + 100/species cap)

Targets:
  - D10s:  3 = 1 login + 2 farm (~27 slimes)
  - Morlak: 32 = 1 login + 1 hour + 30 farm (300+ kills)
  - Co2:   22 = 1 login + 1 hour + 20 farm (keep prior farm block earnings + hour)
"""
from __future__ import annotations

import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

PATH = Path(sys.argv[1] if len(sys.argv) > 1 else "/opt/chainlords/server/Chars/hell-mining.json")
DAY = "2026-07-25"

# wallet -> (characterName, credits, monsterCreditsEarned, onlineHours, farmMilli, note)
PATCH = {
    "9oJdzcWZCvtUJfMtHSVZPRrSbt5LYh7PbJK3TYUmXSJz": {
        "characterName": "D10s",
        "credits": 3,
        "monsterCreditsEarned": 2,
        "onlineHoursGranted": 0,
        "farmMillicredits": 2000,  # 2 farm credits floor
        "note": "login1 + farm2 (slimes)",
    },
    "47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn": {
        "characterName": "Morlak",
        "credits": 32,
        "monsterCreditsEarned": 30,
        "onlineHoursGranted": 1,
        "farmMillicredits": 30000,
        "note": "login1 + hour1 + farm30",
    },
    "2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy": {
        "characterName": "Co2",
        "credits": 22,
        "monsterCreditsEarned": 20,
        "onlineHoursGranted": 1,
        "farmMillicredits": 20000,
        "note": "login1 + hour1 + farm20",
    },
}


def main() -> None:
    if not PATH.exists():
        print(f"missing {PATH}", file=sys.stderr)
        sys.exit(1)

    backup = PATH.with_suffix(
        PATH.suffix + f".bak-day1-recalc-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    )
    shutil.copy2(PATH, backup)
    print(f"backup -> {backup}")

    with PATH.open(encoding="utf-8") as f:
        data = json.load(f)

    days = data.get("Days") or data.get("days")
    if not days or DAY not in days:
        print(f"day {DAY} not found", file=sys.stderr)
        sys.exit(1)

    day = days[DAY]
    if day.get("settled"):
        print(f"day {DAY} already settled — abort", file=sys.stderr)
        sys.exit(2)

    wallets = day.get("wallets") or day.get("Wallets") or {}
    total = 0
    for wallet, cfg in PATCH.items():
        row = wallets.get(wallet)
        if not row:
            print(f"WARN: wallet {wallet} ({cfg['characterName']}) missing — skip")
            continue
        before = row.get("credits", 0)
        row["credits"] = cfg["credits"]
        row["monsterCreditsEarned"] = cfg["monsterCreditsEarned"]
        row["monsterCreditGranted"] = cfg["monsterCreditsEarned"] > 0
        row["onlineHoursGranted"] = cfg["onlineHoursGranted"]
        row["afkBlocksGranted"] = cfg["onlineHoursGranted"]  # legacy field sync
        row["farmMillicredits"] = cfg["farmMillicredits"]
        row["loginCreditGranted"] = True
        total += cfg["credits"]
        print(
            f"{cfg['characterName']}: {before} -> {cfg['credits']} "
            f"({cfg['note']}) mins={row.get('connectedMinutes')} kills={row.get('monsterKills')}"
        )

    day["totalCredits"] = total
    day["utcDay"] = DAY

    with PATH.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")

    print(f"OK day {DAY} totalCredits={total}")


if __name__ == "__main__":
    main()
