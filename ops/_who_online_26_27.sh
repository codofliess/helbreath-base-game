#!/bin/bash
for day in 26 27; do
  echo "======== JUL $day unique travelers in logs ========"
  journalctl -u chainlords-game --since "2026-07-${day} 00:00" --until "2026-07-$((day+1)) 00:00" --no-pager 2>/dev/null \
    | grep -oE "Saved traveler '[^']+'" | sort | uniq -c | sort -rn
  echo "--- first/last per name ---"
  for name in Co2 BORIS Morlak Dunga Pituman Insk D10s Rafita12 Hyoga; do
    first=$(journalctl -u chainlords-game --since "2026-07-${day} 00:00" --until "2026-07-$((day+1)) 00:00" --no-pager 2>/dev/null | grep "Saved traveler '${name}'" | head -1)
    last=$(journalctl -u chainlords-game --since "2026-07-${day} 00:00" --until "2026-07-$((day+1)) 00:00" --no-pager 2>/dev/null | grep "Saved traveler '${name}'" | tail -1)
    count=$(journalctl -u chainlords-game --since "2026-07-${day} 00:00" --until "2026-07-$((day+1)) 00:00" --no-pager 2>/dev/null | grep -c "Saved traveler '${name}'" || true)
    if [[ "$count" != "0" ]]; then
      echo "$name count=$count"
      echo "  first: $first"
      echo "  last:  $last"
    else
      echo "$name count=0"
    fi
  done
done
