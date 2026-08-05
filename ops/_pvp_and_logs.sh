#!/bin/bash
set -e
echo "=== pvp_kills schema ==="
docker exec helbreath-postgres psql -U helbreath -d helbreath -c '\d pvp_kills' || true
echo "=== recent pvp ==="
docker exec helbreath-postgres psql -U helbreath -d helbreath -c 'SELECT * FROM pvp_kills ORDER BY 1 DESC LIMIT 30;' || true
echo "=== pvp by day ==="
docker exec helbreath-postgres psql -U helbreath -d helbreath -c "
SELECT date(created_at AT TIME ZONE 'UTC') AS d, killer_name, victim_name, count(*)
FROM pvp_kills
GROUP BY 1,2,3
ORDER BY 1,4 DESC;
" 2>&1 || docker exec helbreath-postgres psql -U helbreath -d helbreath -c "
SELECT * FROM pvp_kills LIMIT 5;
" 2>&1
echo "=== journal Pituman Jul27 ==="
journalctl -u chainlords-game --since '2026-07-27 00:00' --until '2026-07-28 00:00' --no-pager 2>/dev/null | grep -i Pituman | head -40 || true
echo "=== journal names Jul26 ==="
journalctl -u chainlords-game --since '2026-07-26 00:00' --until '2026-07-27 00:00' --no-pager 2>/dev/null | grep -iE 'Pituman|BORIS|Morlak|Co2|Dunga|Rafita|D10s|Insk' | head -50 || true
echo "=== journal names Jul27 sample ==="
journalctl -u chainlords-game --since '2026-07-27 12:00' --until '2026-07-28 00:00' --no-pager 2>/dev/null | grep -iE 'Pituman|BORIS|Morlak|Co2|Insk|Saved traveler' | head -60 || true
