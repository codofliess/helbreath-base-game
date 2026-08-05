#!/usr/bin/env python3
import json
from pathlib import Path

chars = Path("/opt/chainlords/server/Chars")


def summarize(path: Path, label: str) -> None:
    d = json.loads(path.read_text(encoding="utf-8"))
    print(f"\n=== {label} ===")
    print("file:", path.name, "bytes:", path.stat().st_size)
    print("remainingPool", d.get("remainingPool"))
    print("days present:", sorted((d.get("days") or {}).keys()))
    for day in sorted((d.get("days") or {}).keys()):
        k = d["days"][day]
        rows = [
            (
                v.get("characterName"),
                v.get("credits"),
                v.get("connectedMinutes"),
                v.get("monsterKills"),
                v.get("ekCount"),
                v.get("settledShare"),
            )
            for v in (k.get("wallets") or {}).values()
        ]
        print(
            f"  {day} settled={k.get('settled')} totalCr={k.get('totalCredits')} "
            f"pool={k.get('creditPoolDistributed')} :: {rows}"
        )
    print("pendingHell by wallet:")
    for w, v in sorted(
        (d.get("wallets") or {}).items(),
        key=lambda x: -int(x[1].get("pendingHell") or 0),
    ):
        print(f"  {int(v.get('pendingHell') or 0):8}  {w}")


summarize(chars / "hell-mining.json", "LIVE NOW (after equal split)")
summarize(
    chars / "hell-mining.json.bak-fix26-20260728_003753",
    "BAK 00:37 — before day26 retro (NO day 26 farm existed)",
)
summarize(
    chars / "hell-mining.json.bak-retro26comp-20260728_023623",
    "BAK 02:36 — after EK retro + comp, before equal split",
)
summarize(
    chars / "hell-mining.json.bak-equal26-20260728_024336",
    "BAK 02:43 — snapshot taken right before last equalize write",
)

print("\n=== TRAVELER CHARS (equalize never touches these) ===")
for p in sorted(chars.glob("*.traveler.json")):
    if "bak" in p.name:
        continue
    d = json.loads(p.read_text(encoding="utf-8"))
    print(
        f"  {d.get('CharacterName', '?'):12} L{d.get('Level')} "
        f"hours={float(d.get('HoursPlayed') or 0):.2f} "
        f"exp={d.get('Exp')} world={d.get('GameWorldId')} file={p.name[:20]}"
    )

print("\n=== ALL hell-mining BACKUPS ON DISK ===")
for p in sorted(chars.glob("hell-mining.json*")):
    print(f"  {p.name:55} {p.stat().st_size:6} bytes")
