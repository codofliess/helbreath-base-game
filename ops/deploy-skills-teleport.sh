#!/bin/bash
set -euo pipefail
systemctl stop chainlords-game || true
sleep 1
chmod +x /opt/chainlords/server/Server
systemctl start chainlords-game
sleep 4
systemctl is-active chainlords-game
journalctl -u chainlords-game --no-pager -n 15 | grep -E 'listening|Exception|Failed|MobSpecialty|Skills' || journalctl -u chainlords-game --no-pager -n 8
# verify farm dest in config
python3 - <<'PY'
import json
g=json.load(open('/opt/chainlords/server/Config/GameWorlds.json'))
for w in g:
  if w.get('id')!='elvine': continue
  for t in w.get('teleportLocs') or []:
    if (t.get('target') or {}).get('worldId')=='elvfarm':
      print('elvfarm dest', t['target']['loc'])
PY
