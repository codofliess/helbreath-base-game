#!/usr/bin/env python3
"""Refresh live Pump.fun JSON dumps used by build_airdrop_sheet.py."""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "sources"
UA = {
    "User-Agent": "Mozilla/5.0 (ChainLords airdrop research; no trading; public GET only)"
}


def get(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for period in ("daily", "weekly", "monthly"):
        url = f"https://frontend-api-v3.pump.fun/pnl-leaderboard?period={period}"
        data = get(url)
        path = ROOT / f"pumpfun-pnl-leaderboard-{period}.json"
        path.write_text(json.dumps(data, indent=2) + "\n")
        print(f"{period}: {len(data.get('entries') or [])} -> {path}")
    for window in ("24h", "7d"):
        url = f"https://frontend-api-v3.pump.fun/mayhem/top-traders?window={window}"
        data = get(url)
        path = ROOT / f"pumpfun-mayhem-top-traders-{window}.json"
        path.write_text(json.dumps(data, indent=2) + "\n")
        print(f"mayhem {window}: {len(data.get('items') or [])} -> {path}")
    sol = get("https://frontend-api-v3.pump.fun/sol-price")
    (ROOT / "pumpfun-sol-price.json").write_text(json.dumps(sol, indent=2) + "\n")
    print("sol-price", sol)


if __name__ == "__main__":
    main()
