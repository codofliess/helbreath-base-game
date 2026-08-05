#!/usr/bin/env python3
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "/opt/chainlords/server/Chars/hell-mining.json"
day_key = sys.argv[2] if len(sys.argv) > 2 else "2026-07-25"
with open(path, encoding="utf-8") as f:
    d = json.load(f)
days = d.get("Days") or d.get("days") or {}
print("day_keys", sorted(days.keys())[-12:])
day = days.get(day_key)
if not day:
    print("missing", day_key)
    sys.exit(1)
print(json.dumps(day, indent=2))
