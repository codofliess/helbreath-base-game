#!/usr/bin/env python3
import json
from pathlib import Path

d = json.loads(Path("/opt/chainlords/server/Chars/hell-mining.json").read_text(encoding="utf-8"))
for day in ["2026-07-25", "2026-07-26", "2026-07-27", "2026-07-28"]:
    k = d["days"].get(day, {})
    print(
        f"=== {day} settled={k.get('settled')} totalCr={k.get('totalCredits')} "
        f"pool={k.get('creditPoolDistributed')}"
    )
    note = k.get("integrityNote") or ""
    if note:
        print(f"  note: {note[:140]}")
    for w, v in (k.get("wallets") or {}).items():
        print(
            f"  {v.get('characterName')}: cr={v.get('credits')} mins={v.get('connectedMinutes')} "
            f"kills={v.get('monsterKills')} ek={v.get('ekCount')} share={v.get('settledShare')} "
            f"equalFlag={v.get('equalSplitDay26')}"
        )
