#!/usr/bin/env bash
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

if [[ "${AUTOSCALE_ENABLED:-1}" != "1" ]]; then
  log "autoscale disabled"
  exit 0
fi
need_token
HC="$(hcloud_bin)"

if ! "$HC" server describe "${HOT_SERVER_NAME}" >/dev/null 2>&1; then
  log "hot not present"
  rm -f "${STATE_DIR}/hot-ip.txt" "${STATE_DIR}/hot-status.txt"
  exit 0
fi

log "deleting hot ${HOT_SERVER_NAME}"
"$HC" server delete "${HOT_SERVER_NAME}" --force
rm -f "${STATE_DIR}/hot-ip.txt" "${STATE_DIR}/hot-created.txt"
echo "absent" >"${STATE_DIR}/hot-status.txt"
notify "🧹 Hot shard **${HOT_SERVER_NAME}** destroyed (ON cooled down)"
exit 0
