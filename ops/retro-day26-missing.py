#!/usr/bin/env python3
"""
Retro-compensate wallets that were online on 2026-07-26 but missing/incomplete in mining ledger.

Does NOT re-open settled day-26 pool (Pituman/Insk keep their 500k share).
Grants pending HELL from remaining pool for proven presence (traveler mtime on that day).
"""
import json
import shutil
from datetime import datetime, timezone, date
from pathlib import Path

CHARS = Path("/opt/chainlords/server/Chars")
LEDGER = CHARS / "hell-mining.json"
DAY = "2026-07-26"
DAY_DATE = date.fromisoformat(DAY)

# Compensation (pending HELL) for wallets with traveler save on day 26 but no/insufficient ledger row.
# Day-26 pool already fully assigned to Pituman+Insk EK retro; these are fairness top-ups.
COMP = {
    # Rafita12 — traveler mtime 2026-07-26, never in ledger
    "gCYpmkDeHDFGMnHPZ8MTXrijVgu7fPR3jU9Vpmv3ajo": {
        "name": "Rafita12",
        "pendingHell": 15_000,
        "reason": "traveler save on 2026-07-26, zero mining row",
    },
    # D10s — traveler mtime 2026-07-26 11:02, not in day-26 ledger
    "9oJdzcWZCvtUJfMtHSVZPRrSbt5LYh7PbJK3TYUmXSJz": {
        "name": "D10s",
        "pendingHell": 15_000,
        "reason": "traveler save on 2026-07-26, missing from day-26 ledger",
    },
    # Morlak/Dunga — user confirmed online every day; day-26 farm row never existed in any backup
    "47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn": {
        "name": "Dunga/Morlak",
        "pendingHell": 50_000,
        "reason": "operator confirmed full-day presence; day-26 ledger wiped (no farm row in any bak)",
    },
}


def main():
    bak = CHARS / f"hell-mining.json.bak-retro26comp-{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(LEDGER, bak)
    print("backup", bak)

    data = json.loads(LEDGER.read_text(encoding="utf-8"))
    wallets = data.setdefault("wallets", {})
    days = data.setdefault("days", {})
    day = days.setdefault(
        DAY,
        {
            "utcDay": DAY,
            "totalCredits": 0,
            "directSpent": 0,
            "creditPoolDistributed": 0,
            "settled": True,
            "settledAtMs": 0,
            "wallets": {},
        },
    )
    day_wallets = day.setdefault("wallets", {})

    # Annotate day with integrity note (do not change settled shares)
    day["integrityNote"] = (
        "Day had ledger wipe during ops; EK retro for Pituman/Insk kept. "
        "Missing farmers compensated via pendingHell top-up from remaining pool (see retro-day26-missing.py)."
    )

    total_grant = 0
    for wallet, spec in COMP.items():
        # Verify traveler mtime evidence when possible
        trav = CHARS / f"{wallet}.traveler.json"
        if trav.is_file():
            mtime = datetime.fromtimestamp(trav.stat().st_mtime, tz=timezone.utc)
            print(f"traveler {spec['name']} mtime={mtime.isoformat()} (need day {DAY})")
        bal = wallets.setdefault(wallet, {"wallet": wallet, "pendingHell": 0, "claimedHell": 0})
        before = int(bal.get("pendingHell") or 0)
        grant = int(spec["pendingHell"])
        bal["pendingHell"] = before + grant
        total_grant += grant
        data["remainingPool"] = max(0, int(data.get("remainingPool") or 0) - grant)

        # Ensure day wallet row exists for visibility in reports (credits already settled; mark note only)
        row = day_wallets.setdefault(
            wallet,
            {
                "wallet": wallet,
                "characterName": spec["name"].split("/")[0],
                "credits": 0,
                "monsterKills": 0,
                "monsterCreditGranted": False,
                "monsterCreditsEarned": 0,
                "farmMillicredits": 0,
                "diversityDoubled": False,
                "ekCount": 0,
                "ekCreditsGranted": 0,
                "connectedMinutes": 0,
                "onlineHoursGranted": 0,
                "afkBlocksGranted": 0,
                "loginCreditGranted": True,
                "ekDirectTokens": 0,
                "eventDirectTokens": 0,
                "directTokens": 0,
                "eventParticipated": False,
                "settledShare": 0,
            },
        )
        row["characterName"] = spec["name"].split("/")[0]
        row["loginCreditGranted"] = True
        row["retroCompPendingHell"] = grant
        row["retroCompReason"] = spec["reason"]
        print(f"GRANT +{grant} pendingHell → {spec['name']} ({wallet[:12]}…) {before}→{bal['pendingHell']} | {spec['reason']}")

    LEDGER.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print("wrote", LEDGER, "total_grant", total_grant, "remainingPool", data.get("remainingPool"))


if __name__ == "__main__":
    main()
