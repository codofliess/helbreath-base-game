#!/bin/bash
set -euo pipefail
systemctl stop chainlords-game || true
sleep 1
# Force-settle today (and any unsettled past days the script targets)
python3 /opt/chainlords/ops/settle-mining-day.py --day 2026-07-25 /opt/chainlords/server/Chars/hell-mining.json
chmod +x /opt/chainlords/server/Server
systemctl start chainlords-game
sleep 4
systemctl is-active chainlords-game
journalctl -u chainlords-game --no-pager -n 40 | grep -E 'MobSpecialty|HellMining|Exception|listening|started|Failed' || true
python3 - <<'PY'
import json
hm=json.load(open('/opt/chainlords/server/Chars/hell-mining.json'))
print('remainingPool', hm.get('remainingPool'))
print('day settled', (hm.get('days') or {}).get('2026-07-25',{}).get('settled'))
for w,b in (hm.get('wallets') or {}).items():
  p=int(b.get('pendingHell') or 0)
  print(f"  {w[:16]} pending={p:,} +{p//100000} tiers")
# Morlak day share
day=(hm.get('days') or {}).get('2026-07-25') or {}
for w,r in (day.get('wallets') or {}).items():
  print(f"  day {r.get('characterName')} cr={r.get('credits')} share={r.get('settledShare')}")
PY
