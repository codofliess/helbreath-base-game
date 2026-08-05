#!/usr/bin/env bash
# Main autopilot tick (systemd timer every 2 min).
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

STREAK_FILE="${STATE_DIR}/hot-down-streak"

n="$(online_count)"
echo "$n" >"${STATE_DIR}/last-online.txt"
log "autoscaler online=$n up>=${HOT_UP_ONLINE} down<=${HOT_DOWN_ONLINE}"

# Ensure hcloud present when token set
if [[ -n "${HCLOUD_TOKEN:-}" ]]; then
  need_token
fi

if [[ "${AUTOSCALE_ENABLED:-1}" == "1" && -n "${HCLOUD_TOKEN:-}" ]]; then
  if (( n >= HOT_UP_ONLINE )); then
    echo 0 >"${STREAK_FILE}"
    if ! command -v hcloud >/dev/null 2>&1 && [[ ! -x /usr/local/bin/hcloud ]]; then
      log "skip hot-up: no hcloud"
    else
      bash "$(cd "$(dirname "$0")" && pwd)/hot-up.sh" || true
    fi
  elif (( n <= HOT_DOWN_ONLINE )); then
    streak=0
    [[ -f "${STREAK_FILE}" ]] && streak="$(cat "${STREAK_FILE}")"
    streak=$((streak + 1))
    echo "$streak" >"${STREAK_FILE}"
    log "cool streak=$streak need=${HOT_DOWN_STREAK}"
    if (( streak >= HOT_DOWN_STREAK )); then
      bash "$(cd "$(dirname "$0")" && pwd)/hot-down.sh" || true
      echo 0 >"${STREAK_FILE}"
    fi
  else
    echo 0 >"${STREAK_FILE}"
  fi
else
  log "autoscale skipped (disabled or no token)"
fi
