#!/usr/bin/env python3
"""Audit day 26/27 evidence: travelers mtime, mining rows, pvp files, presence logs."""
import json
from datetime import datetime, timezone, date
from pathlib import Path

CHARS = Path("/opt/chainlords/server/Chars")
d = json.loads((CHARS / "hell-mining.json").read_text(encoding="utf-8"))

WALLETS = {
    "47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn": "Dunga/Morlak",
    "36zA4DKL4jxvmLkqsvtF9RtzRAwSjscTvfkQPKJNim5g": "BORIS",
    "2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy": "Co2",
    "bz4vbzgX6M15hetZ9PtikrEkdT3u2QV2cNbtmrwGyW9": "Pituman",
    "7MCgEvUnERDMpcQnyvPPm4yH547SjjbftUjDCX6givWB": "Insk",
    "9oJdzcWZCvtUJfMtHSVZPRrSbt5LYh7PbJK3TYUmXSJz": "D10s",
    "gCYpmkDeHDFGMnHPZ8MTXrijVgu7fPR3jU9Vpmv3ajo": "Rafita12",
    "Egne1mkpDDKoxTKP8wR9XmgQC3fQPv2tNQjWs5v26q2R": "Hyoga",
}

print("=== TRAVELER mtimes (UTC) ===")
for p in sorted(CHARS.glob("*.traveler.json")):
    if "bak" in p.name:
        continue
    t = json.loads(p.read_text(encoding="utf-8"))
    m = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
    print(
        f"{t.get('CharacterName'):12} mtime={m.isoformat()} L{t.get('Level')} "
        f"hours={float(t.get('HoursPlayed') or 0):.2f} wallet={p.stem[:16]}"
    )

for day in ("2026-07-26", "2026-07-27"):
    print(f"\n=== MINING {day} ===")
    k = d["days"].get(day, {})
    print(
        f"settled={k.get('settled')} totalCr={k.get('totalCredits')} pool={k.get('creditPoolDistributed')}"
    )
    for w, v in (k.get("wallets") or {}).items():
        print(
            f"  {v.get('characterName')}: cr={v.get('credits')} mins={v.get('connectedMinutes')} "
            f"kills={v.get('monsterKills')} ek={v.get('ekCount')} share={v.get('settledShare')} "
            f"farmMilli={v.get('farmMillicredits')}"
        )

print("\n=== PVP reports ===")
for p in sorted((CHARS / "reports").glob("pvp-*.txt")):
    print(f"--- {p.name} ---")
    print(p.read_text(encoding="utf-8", errors="replace")[:2000])

print("\n=== pendingHell live ===")
for w, v in sorted(
    (d.get("wallets") or {}).items(), key=lambda x: -int(x[1].get("pendingHell") or 0)
):
    name = WALLETS.get(w, "?")
    print(f"  {int(v.get('pendingHell') or 0):8}  {name:14} {w[:16]}")

# presence logs
plog = CHARS / "presence-log"
if plog.is_dir():
    print("\n=== presence-log files ===")
    for p in sorted(plog.glob("*.jsonl")):
        print(p.name, p.stat().st_size, "bytes")
