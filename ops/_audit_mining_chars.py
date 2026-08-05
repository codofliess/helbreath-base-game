#!/usr/bin/env python3
"""Audit travelers vs hell-mining ledger on the game server."""
import json
import time
from pathlib import Path

chars = Path("/opt/chainlords/server/Chars")
print("=== TRAVELERS ===")
for p in sorted(chars.glob("*.traveler.json")):
    if "bak" in p.name:
        continue
    d = json.loads(p.read_text(encoding="utf-8"))
    mtime = time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime(p.stat().st_mtime))
    print(
        f"{d.get('CharacterName', '?'):12} "
        f"L{d.get('Level', '?'):<3} "
        f"hours={float(d.get('HoursPlayed') or 0):6.2f} "
        f"world={d.get('GameWorldId', '?'):12} "
        f"mtime={mtime} "
        f"wallet={p.stem}"
    )

hm_path = chars / "hell-mining.json"
hm = json.loads(hm_path.read_text(encoding="utf-8"))
print("\n=== MINING DAYS ===")
for day, k in sorted(hm.get("days", {}).items()):
    rows = []
    for w, v in k.get("wallets", {}).items():
        rows.append(
            (
                v.get("characterName"),
                v.get("credits"),
                v.get("connectedMinutes"),
                v.get("monsterKills"),
                v.get("ekCount"),
                w[:12],
            )
        )
    print(
        f"{day} settled={k.get('settled')} totalCr={k.get('totalCredits')} pool={k.get('creditPoolDistributed')} :: {rows}"
    )

print("\n=== TOP PENDING HELL ===")
for w, v in sorted(hm.get("wallets", {}).items(), key=lambda x: -x[1].get("pendingHell", 0)):
    print(f"  {v.get('pendingHell', 0):8}  {w}")

raf = "gCYpmkDeHDFGMnHPZ8MTXrijVgu7fPR3jU9Vpmv3ajo"
print(f"\nRafita wallet in mining wallets: {raf in hm.get('wallets', {})}")
for day, k in hm.get("days", {}).items():
    if raf in k.get("wallets", {}):
        print(f"  found in day {day}: {k['wallets'][raf]}")
