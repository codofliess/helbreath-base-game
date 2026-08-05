#!/bin/bash
set -e
systemctl stop chainlords-game || true
python3 /opt/chainlords/ops/strip-morlak-dual.py
chmod +x /opt/chainlords/server/Server
systemctl start chainlords-game
sleep 4
systemctl is-active chainlords-game
journalctl -u chainlords-game --no-pager -n 50 | grep -E 'MobSpecialty|Progression|Exception|error|listening|started|Failed' || true
python3 <<'PY'
import json, subprocess
d=json.load(open('/opt/chainlords/server/Chars/47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn.traveler.json'))
bag=d.get('BagItems') or []
necks=[r.get('ItemId') for r in bag if (r.get('ItemId') or 0) in range(638,650)]
print('json bag', len(bag), 'necks', necks)
out=subprocess.check_output([
  'psql','postgresql://helbreath:helbreath@127.0.0.1:5432/helbreath','-t','-A','-c',
  "SELECT name || ' bag=' || COALESCE(jsonb_array_length(state_json->'BagItems'),0)::text FROM characters WHERE account_wallet LIKE '47u56Tf6%'"
], text=True)
print('pg', out.strip())
PY
