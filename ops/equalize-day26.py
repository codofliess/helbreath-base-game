#!/usr/bin/env python3
"""
Equal-split day 2026-07-26 among 5 wallets (100k HELL + 10 credits each).

IMPORTANT: stop chainlords-game before running, or the live process will overwrite
hell-mining.json from memory on its next persist tick.

Steps:
1) Claw back any prior day-26 settledShare + known retro top-ups from pendingHell
2) Return clawed amounts to remainingPool
3) Assign equal 100_000 share + 10 credits to each of 5 participants
4) Deduct 500_000 once from remainingPool
"""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

CHARS = Path("/opt/chainlords/server/Chars")
LEDGER = CHARS / "hell-mining.json"
DAY = "2026-07-26"
DAILY_CAP = 500_000

PARTICIPANTS = [
    ("bz4vbzgX6M15hetZ9PtikrEkdT3u2QV2cNbtmrwGyW9", "Pituman", 4),  # ekCount info only
    ("7MCgEvUnERDMpcQnyvPPm4yH547SjjbftUjDCX6givWB", "Insk", 3),
    ("47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn", "Dunga", 0),
    ("9oJdzcWZCvtUJfMtHSVZPRrSbt5LYh7PbJK3TYUmXSJz", "D10s", 0),
    ("gCYpmkDeHDFGMnHPZ8MTXrijVgu7fPR3jU9Vpmv3ajo", "Rafita12", 0),
]

# Known one-off top-ups that may still sit in pendingHell from earlier retro scripts.
KNOWN_RETRO = {
    "gCYpmkDeHDFGMnHPZ8MTXrijVgu7fPR3jU9Vpmv3ajo": 15_000,
    "9oJdzcWZCvtUJfMtHSVZPRrSbt5LYh7PbJK3TYUmXSJz": 15_000,
    "47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn": 50_000,
}


def main() -> None:
    bak = CHARS / f"hell-mining.json.bak-equal26-{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(LEDGER, bak)
    print("backup", bak)

    data = json.loads(LEDGER.read_text(encoding="utf-8"))
    wallets_bal = data.setdefault("wallets", {})
    days = data.setdefault("days", {})
    day = days.setdefault(DAY, {"utcDay": DAY, "wallets": {}})
    day_wallets = day.setdefault("wallets", {})

    clawed = 0

    # Claw settledShare on day-26 rows
    for w, row in list(day_wallets.items()):
        share = int(row.get("settledShare") or 0)
        retro_field = int(row.get("retroCompPendingHell") or 0)
        take = share + retro_field
        if take <= 0:
            continue
        bal = wallets_bal.setdefault(w, {"wallet": w, "pendingHell": 0, "claimedHell": 0})
        before = int(bal.get("pendingHell") or 0)
        bal["pendingHell"] = max(0, before - take)
        clawed += take
        print(f"claw day-row {w[:12]}… share={share} retroField={retro_field} {before}->{bal['pendingHell']}")

    # Claw known retro leftovers if still present (idempotent: only if pending has room)
    for w, amt in KNOWN_RETRO.items():
        bal = wallets_bal.setdefault(w, {"wallet": w, "pendingHell": 0, "claimedHell": 0})
        # Only claw if this wallet's day-row had no settledShare (already handled above for retro_field)
        row = day_wallets.get(w) or {}
        already = int(row.get("retroCompPendingHell") or 0)
        if already >= amt:
            continue  # already clawed via day-row field
        # Detect leftover: if they still have more pending than "other days" baseline is hard;
        # only claw if equal-split not yet applied (settledShare != 100000 for all).
        share = int(row.get("settledShare") or 0)
        if share == 100_000 and int(row.get("credits") or 0) == 10:
            print(f"skip known-retro {w[:12]}… already equal-split")
            continue
        if share > 0:
            continue  # share claw already took day-26 portion
        before = int(bal.get("pendingHell") or 0)
        if before <= 0:
            continue
        take = min(amt, before)
        bal["pendingHell"] = before - take
        clawed += take
        print(f"claw known-retro {w[:12]}… -{take} {before}->{bal['pendingHell']}")

    data["remainingPool"] = int(data.get("remainingPool") or 0) + clawed
    print("clawed", clawed, "remainingPool", data["remainingPool"])

    n = len(PARTICIPANTS)
    base_share = DAILY_CAP // n
    rem = DAILY_CAP - base_share * n
    equal_credits = 10
    total_credits = equal_credits * n

    new_day_wallets = {}
    for i, (wallet, name, ek) in enumerate(PARTICIPANTS):
        share = base_share + (1 if i < rem else 0)
        row = {
            "wallet": wallet,
            "characterName": name,
            "credits": equal_credits,
            "monsterKills": 0,
            "monsterCreditGranted": False,
            "monsterCreditsEarned": 0,
            "farmMillicredits": 0,
            "diversityDoubled": False,
            "ekCount": ek,
            "ekCreditsGranted": ek,
            "connectedMinutes": 0,
            "onlineHoursGranted": 0,
            "afkBlocksGranted": 0,
            "loginCreditGranted": True,
            "ekDirectTokens": 0,
            "eventDirectTokens": 0,
            "directTokens": 0,
            "eventParticipated": False,
            "settledShare": share,
            "equalSplitDay26": True,
            "note": "Preventive equal split 2026-07-26 (5-way).",
        }
        new_day_wallets[wallet] = row
        bal = wallets_bal.setdefault(wallet, {"wallet": wallet, "pendingHell": 0, "claimedHell": 0})
        before = int(bal.get("pendingHell") or 0)
        bal["pendingHell"] = before + share
        print(f"grant {name:10} +{share} pending {before}->{bal['pendingHell']}")

    day.clear()
    day.update(
        {
            "utcDay": DAY,
            "totalCredits": total_credits,
            "directSpent": 0,
            "creditPoolDistributed": DAILY_CAP,
            "settled": True,
            "settledAtMs": int(datetime.now(timezone.utc).timestamp() * 1000),
            "wallets": new_day_wallets,
            "integrityNote": f"Equal split {DAILY_CAP}/{n} = {base_share} HELL + {equal_credits} credits each.",
        }
    )

    if int(data.get("remainingPool") or 0) < DAILY_CAP:
        raise SystemExit(f"remainingPool {data.get('remainingPool')} < {DAILY_CAP}")
    data["remainingPool"] = int(data["remainingPool"]) - DAILY_CAP

    # Atomic write
    tmp = LEDGER.with_suffix(".json.tmp-equal26")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(LEDGER)
    print("wrote", LEDGER, "remainingPool", data["remainingPool"])
    print("VERIFY day26:")
    for w, row in new_day_wallets.items():
        print(f"  {row['characterName']:10} cr={row['credits']} share={row['settledShare']}")


if __name__ == "__main__":
    main()
