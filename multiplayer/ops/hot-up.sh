#!/usr/bin/env bash
# Create a hot overflow VPS (phase 1: capacity node; deploy is best-effort snapshot of core bits).
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

if [[ "${AUTOSCALE_ENABLED:-1}" != "1" ]]; then
  log "autoscale disabled"
  exit 0
fi
need_token
HC="$(hcloud_bin)"

if "$HC" server describe "${HOT_SERVER_NAME}" >/dev/null 2>&1; then
  log "hot already exists: ${HOT_SERVER_NAME}"
  exit 0
fi

log "creating hot ${HOT_SERVER_NAME} type=${HOT_TYPE} loc=${HOT_LOCATION}"
if ! "$HC" server create \
  --name "${HOT_SERVER_NAME}" \
  --type "${HOT_TYPE}" \
  --image "${HOT_IMAGE:-ubuntu-24.04}" \
  --location "${HOT_LOCATION}" \
  --ssh-key "${SSH_KEY_NAME}" \
  --label role=hot \
  --label project=chainlords 2>"${STATE_DIR}/hot-up.err"; then
  log "hot-up failed: $(tr '\n' ' ' <"${STATE_DIR}/hot-up.err" | head -c 300)"
  notify "⚠️ Hot-up failed (${HOT_TYPE}@${HOT_LOCATION}). Check stock/credit. ON may be high."
  exit 1
fi

ip="$("$HC" server ip "${HOT_SERVER_NAME}")"
echo "$ip" >"${STATE_DIR}/hot-ip.txt"
date -u +%Y-%m-%dT%H:%M:%SZ >"${STATE_DIR}/hot-created.txt"
notify "🚀 Hot shard **${HOT_SERVER_NAME}** up · IP \`${ip}\` · type **${HOT_TYPE}** (wire deploy/clients if not automated yet)"
log "hot ip=$ip — phase1: server exists; full game deploy to hot is next automation step"
# Best-effort: mark for manual/follow-up deploy
echo "pending-deploy" >"${STATE_DIR}/hot-status.txt"
exit 0
