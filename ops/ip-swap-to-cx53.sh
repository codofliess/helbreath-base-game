#!/usr/bin/env bash
# Run on CX53 while it still has 178.105.251.138
# Moves production IPv4 46.224.129.38 onto CX53, then powers CX53 back on.
set -euo pipefail
set -a
source /opt/chainlords/ops/config.env
set +a
export PATH=/usr/local/bin:$PATH
LOG=/tmp/ip-swap.log
exec > >(tee -a "$LOG") 2>&1

echo "=== $(date -u) ip-swap start ==="
hcloud server list

IP_OLD_PLAY=142001929   # 46.224.129.38
IP_CX53=142092777       # 178.105.251.138
SRV_CX53=chainlords-cx53-fsn1
SRV_CX43=chainlords-play

# Ensure CX43 off
st=$(hcloud server describe "$SRV_CX43" -o format='{{.Status}}')
echo "CX43 status=$st"
if [[ "$st" != "off" ]]; then
  hcloud server poweroff "$SRV_CX43"
  sleep 5
fi

echo "Unassign $IP_OLD_PLAY from CX43 (if still assigned)..."
hcloud primary-ip unassign "$IP_OLD_PLAY" || true

echo "Power off CX53..."
# Detach: schedule poweron sequence via Hetzner API *before* network dies.
# We'll unassign our IP then assign play IP then poweron — all via cloud API
# which works without local network after unassign.

echo "Unassign CX53 current IP $IP_CX53..."
hcloud primary-ip unassign "$IP_CX53"

echo "Assign play IP $IP_OLD_PLAY to $SRV_CX53..."
hcloud primary-ip assign "$IP_OLD_PLAY" --server "$SRV_CX53"

echo "Power on $SRV_CX53..."
hcloud server poweron "$SRV_CX53" || true

for i in $(seq 1 40); do
  st=$(hcloud server describe "$SRV_CX53" -o format='{{.Status}}' || true)
  echo "status=$st ($i)"
  if [[ "$st" == "running" ]]; then
    break
  fi
  sleep 3
done

hcloud server list
hcloud primary-ip list
echo "=== $(date -u) ip-swap done ==="
