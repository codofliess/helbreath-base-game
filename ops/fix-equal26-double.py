#!/usr/bin/env python3
"""Remove leftover day-26 retro top-ups so equal split is the only day-26 award."""
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

CHARS = Path("/opt/chainlords/server/Chars")
LEDGER = CHARS / "hell-mining.json"

# Prior retro top-ups from retro-day26-missing.py that were NOT clawed
# (rows had settledShare=0 so equalize only clawed Pituman/Insk shares).
RETRO_LEFTOVER = {
    "gCYpmkDeHDFGMnHPZ8MTXrijVgu7fPR3jU9Vpmv3ajo": 15_000,  # Rafita12
    "9oJdzcWZCvtUJfMtHSVZPRrSbt5LYh7PbJK3TYUmXSJz": 15_000,  # D10s
    "47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn": 50_000,  # Dunga
}


def main() -> None:
    bak = CHARS / f"hell-mining.json.bak-fix-equal26-{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(LEDGER, bak)
    print("backup", bak)

    data = json.loads(LEDGER.read_text(encoding="utf-8"))
    wallets = data.setdefault("wallets", {})
    returned = 0
    for w, amt in RETRO_LEFTOVER.items():
        bal = wallets.setdefault(w, {"wallet": w, "pendingHell": 0, "claimedHell": 0})
        before = int(bal.get("pendingHell") or 0)
        bal["pendingHell"] = max(0, before - amt)
        returned += amt
        print(f"remove retro leftover {w[:12]}… -{amt} pending {before}->{bal['pendingHell']}")

    data["remainingPool"] = int(data.get("remainingPool") or 0) + returned
    LEDGER.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print("returned", returned, "remainingPool", data["remainingPool"])

    # Print day-26 summary
    day = data["days"]["2026-07-26"]
    for w, row in day["wallets"].items():
        pend = wallets.get(w, {}).get("pendingHell")
        print(
            f"  {row.get('characterName'):10} share={row.get('settledShare')} "
            f"credits={row.get('credits')} pendingTotal={pend}"
        )


if __name__ == "__main__":
    main()
