#!/bin/bash
journalctl -u chainlords-game --no-pager -n 100 | grep -E 'MobSpecialty|Progression|Failed|Exception|error|listening' || true
docker exec -i helbreath-postgres psql -U helbreath -d helbreath -t -A -c "SELECT name, jsonb_array_length(COALESCE(state_json->'BagItems','[]'::jsonb)) FROM characters WHERE account_wallet LIKE '47u56Tf6%';"
python3 - <<'PY'
import json
d=json.load(open('/opt/chainlords/server/Chars/47u56Tf6RsSi4ZjcgKFqnyPfGUYr5vX2cjDVQAMzriMn.traveler.json'))
bag=d.get('BagItems') or []
necks=[r.get('ItemId') for r in bag if (r.get('ItemId') or 0) in range(638,650)]
print('json bag', len(bag), 'necks', necks, 'staked', d.get('StakedHell'))
PY
ls -la /opt/chainlords/server/Config/MobSpecialties.json
ls /opt/chainlords/client/assets/*.js 2>/dev/null | head -5
systemctl is-active chainlords-game
