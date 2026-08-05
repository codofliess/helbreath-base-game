#!/usr/bin/env python3
"""Force-settle a hell-mining UTC day: credit-share the daily 500k pool into wallet pending.

Matches HellMiningStore.SettleDayLocked (credit-weighted, remainder to last).
Default: settle today (or --day YYYY-MM-DD). Use while server is stopped, or server will
re-load file on next boot if you stop first.

Usage:
  python3 settle-mining-day.py [--day 2026-07-25] [/path/to/hell-mining.json]
"""
from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

DAILY_CAP = 500_000


def is_active(row: dict) -> bool:
    return bool(
        (row.get("credits") or 0) > 0
        or (row.get("connectedMinutes") or 0) > 0
        or (row.get("monsterKills") or 0) > 0
        or (row.get("ekCount") or 0) > 0
        or row.get("loginCreditGranted")
        or (row.get("directTokens") or 0) > 0
    )


def activity_weight(row: dict) -> int:
    w = max(0, int(row.get("connectedMinutes") or 0))
    w += max(0, int(row.get("monsterKills") or 0))
    w += max(0, int(row.get("ekCount") or 0)) * 5
    return w if w > 0 else 1


def settle_day(data: dict, day_key: str) -> None:
    days = data.get("days") or data.get("Days")
    if not days or day_key not in days:
        raise SystemExit(f"day {day_key} not found")
    day = days[day_key]
    if day.get("settled"):
        print(f"day {day_key} already settled — skip settle, report only")
        return

    direct = int(day.get("directSpent") or 0)
    pool_left = int(data.get("remainingPool") or 0)
    credit_pool = max(0, DAILY_CAP - direct)
    if credit_pool > pool_left:
        credit_pool = pool_left

    wallets = day.get("wallets") or day.get("Wallets") or {}
    active = [r for r in wallets.values() if is_active(r)]
    total_credits = int(day.get("totalCredits") or 0)
    use_credits = total_credits > 0 and any(int(r.get("credits") or 0) > 0 for r in active)

    weight_sum = 0
    for r in active:
        weight_sum += int(r.get("credits") or 0) if use_credits else activity_weight(r)
    if weight_sum <= 0:
        weight_sum = max(1, len(active))
        use_credits = False

    ordered = sorted(
        active,
        key=lambda r: (
            -(int(r.get("credits") or 0) if use_credits else activity_weight(r)),
            (r.get("wallet") or "").lower(),
        ),
    )

    if "wallets" not in data:
        data["wallets"] = {}
    global_wallets = data["wallets"]

    assigned = 0
    distributed = 0
    print(f"settle {day_key}: active={len(ordered)} totalCredits={total_credits} creditPool={credit_pool}")
    for i, row in enumerate(ordered):
        w = int(row.get("credits") or 0) if use_credits else activity_weight(row)
        if w <= 0:
            w = 1
        if i == len(ordered) - 1:
            share = credit_pool - assigned
        else:
            share = credit_pool * w // weight_sum
            assigned += share
        if share <= 0:
            continue
        wallet = row.get("wallet") or ""
        bal = global_wallets.get(wallet) or {"wallet": wallet, "pendingHell": 0, "claimedHell": 0}
        bal["wallet"] = wallet
        bal["pendingHell"] = int(bal.get("pendingHell") or 0) + share
        global_wallets[wallet] = bal
        row["settledShare"] = int(row.get("settledShare") or 0) + share
        distributed += share
        name = row.get("characterName") or "?"
        print(f"  {name:12} credits={row.get('credits'):3} share={share:8,} pending={bal['pendingHell']:,} tiers=+{bal['pendingHell']//100_000}")

    data["remainingPool"] = pool_left - distributed
    day["creditPoolDistributed"] = distributed
    day["settled"] = True
    day["settledAtMs"] = int(datetime.now(timezone.utc).timestamp() * 1000)
    print(f"distributed={distributed:,} poolLeft={data['remainingPool']:,}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?", default="/opt/chainlords/server/Chars/hell-mining.json")
    ap.add_argument("--day", default=datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    args = ap.parse_args()
    path = Path(args.path)
    if not path.exists():
        raise SystemExit(f"missing {path}")

    bak = path.with_suffix(path.suffix + f".bak-settle-{args.day}-{datetime.now(timezone.utc).strftime('%H%M%S')}")
    shutil.copy2(path, bak)
    print("backup", bak)

    data = json.loads(path.read_text(encoding="utf-8"))
    settle_day(data, args.day)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("wrote", path)

    # summary
    wallets = data.get("wallets") or {}
    for w, bal in wallets.items():
        p = int(bal.get("pendingHell") or 0)
        print(f"WALLET {w[:12]}… pending={p:,} stakeTiers=+{p // 100_000}")


if __name__ == "__main__":
    main()
