#!/bin/bash
set -e
psql postgresql://helbreath:helbreath@127.0.0.1:5432/helbreath -c '\dt' 2>&1 | head -40
echo ====
psql postgresql://helbreath:helbreath@127.0.0.1:5432/helbreath -c "
SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pvp_kills' ORDER BY ordinal_position;
" 2>&1
echo ====
psql postgresql://helbreath:helbreath@127.0.0.1:5432/helbreath -c "
SELECT * FROM pvp_kills ORDER BY 1 DESC LIMIT 5;
" 2>&1 | head -30
echo ====
psql postgresql://helbreath:helbreath@127.0.0.1:5432/helbreath -c "
SELECT killer_name, victim_name, count(*) 
FROM pvp_kills 
WHERE created_at >= '2026-07-26 00:00:00+00' AND created_at < '2026-07-28 00:00:00+00'
GROUP BY 1,2 ORDER BY 3 DESC;
" 2>&1
echo ====alt
psql postgresql://helbreath:helbreath@127.0.0.1:5432/helbreath -c "
SELECT * FROM pvp_kills LIMIT 3;
" 2>&1
