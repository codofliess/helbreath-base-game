#!/usr/bin/env python3
"""
Resplit 2026-07-26 only (no real mining ledger that day).

From journal evidence who was online UTC 26:
  Pituman, Insk, BORIS, Morlak, Co2, D10s (+ Rafita12 traveler mtime)

Ops rule:
  - D10s fixed 20_000 HELL
  - remaining 480_000 split equally among the others
  - days 25/27/28 UNTOUCHED
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
D10S_SHARE = 20_000

# wallet, name, ekCount (informational)
MAIN = [
    ("bz4vbzgX6M15hetZ9PtikrEkdT3u2QV2cNbtmrwGyW9", "Pituman", 4),
    ("7MCgEvUnERDMpcQnyvPPm4yH547SjjbftUjDCX6givWB", "Insk", 3),
    ("36zA4DKL4jxvmLkqsvtF9RtzRAwSjscTvfkQPKJNim5g", "BORIS", 0),
    ("47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn", "Morlak", 0),  # now Dunga
    ("2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy", "Co2", 0),
    ("gCYpmkDeHDFGMnHPZ8MTXrijVgu7fPR3jU9Vpmv3ajo", "Rafita12", 0),  # traveler mtime on 26
]
D10S = ("9oJdzcWZCvtUJfMtHSVZPRrSbt5LYh7PbJK3TYUmXSJz", "D10s", 0)


def main() -> None:
    bak = CHARS / f"hell-mining.json.bak-resplit26-{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(LEDGER, bak)
    print("backup", bak)

    data = json.loads(LEDGER.read_text(encoding="utf-8"))
    wallets_bal = data.setdefault("wallets", {})
    days = data.setdefault("days", {})
    day = days.setdefault(DAY, {"utcDay": DAY, "wallets": {}})
    day_wallets = day.setdefault("wallets", {})

    # Claw back prior day-26 settledShare from pending
    clawed = 0
    for w, row in list(day_wallets.items()):
        share = int(row.get("settledShare") or 0)
        if share <= 0:
            continue
        bal = wallets_bal.setdefault(w, {"wallet": w, "pendingHell": 0, "claimedHell": 0})
        before = int(bal.get("pendingHell") or 0)
        bal["pendingHell"] = max(0, before - share)
        clawed += share
        print(f"claw {row.get('characterName') or w[:12]} share={share} pending {before}->{bal['pendingHell']}")

    data["remainingPool"] = int(data.get("remainingPool") or 0) + clawed
    print("clawed", clawed, "remainingPool", data["remainingPool"])

    n_main = len(MAIN)
    main_pool = DAILY_CAP - D10S_SHARE
    base = main_pool // n_main
    rem = main_pool - base * n_main
    equal_credits_main = 10
    d10s_credits = 2  # symbolic smaller participation

    new_rows = {}
    grants = []

    for i, (wallet, name, ek) in enumerate(MAIN):
        share = base + (1 if i < rem else 0)
        new_rows[wallet] = make_row(wallet, name, equal_credits_main, share, ek)
        grants.append((wallet, name, share, equal_credits_main))

    w, name, ek = D10S
    new_rows[w] = make_row(w, name, d10s_credits, D10S_SHARE, ek)
    grants.append((w, name, D10S_SHARE, d10s_credits))

    total_credits = sum(r["credits"] for r in new_rows.values())
    total_share = sum(r["settledShare"] for r in new_rows.values())
    assert total_share == DAILY_CAP, total_share

    for wallet, name, share, cr in grants:
        bal = wallets_bal.setdefault(wallet, {"wallet": wallet, "pendingHell": 0, "claimedHell": 0})
        before = int(bal.get("pendingHell") or 0)
        bal["pendingHell"] = before + share
        print(f"grant {name:10} cr={cr:2} share={share:6} pending {before}->{bal['pendingHell']}")

    day.clear()
    day.update(
        {
            "utcDay": DAY,
            "totalCredits": total_credits,
            "directSpent": 0,
            "creditPoolDistributed": DAILY_CAP,
            "settled": True,
            "settledAtMs": int(datetime.now(timezone.utc).timestamp() * 1000),
            "wallets": new_rows,
            "integrityNote": (
                f"Preventive split day-26 (no mining ledger). "
                f"D10s fixed {D10S_SHARE}; remaining {main_pool} equal among {n_main} "
                f"({base}+rem). Journal-backed presence. Days 25/27/28 untouched."
            ),
        }
    )

    if int(data.get("remainingPool") or 0) < DAILY_CAP:
        raise SystemExit(f"remainingPool {data.get('remainingPool')} < {DAILY_CAP}")
    data["remainingPool"] = int(data["remainingPool"]) - DAILY_CAP

    tmp = LEDGER.with_suffix(".json.tmp-resplit26")
    tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
    tmp.replace(LEDGER)
    print("wrote", LEDGER, "remainingPool", data["remainingPool"], "totalCredits", total_credits)

    # Sanity: other days still rule-based
    for other in ("2026-07-25", "2026-07-27"):
        o = data["days"][other]
        print(f"UNTOUCHED {other} totalCr={o.get('totalCredits')} wallets={list((o.get('wallets') or {}).keys())[:4]}...")


def make_row(wallet: str, name: str, credits: int, share: int, ek: int) -> dict:
    return {
        "wallet": wallet,
        "characterName": name,
        "credits": credits,
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
        "preventiveSplit": True,
        "note": "Day-26 preventive (journal presence; no farm ledger).",
    }


if __name__ == "__main__":
    main()
