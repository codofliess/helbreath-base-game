#!/usr/bin/env bash
set -euo pipefail

OPS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${OPS_DIR}/config.env"

STATE_DIR="${OPS_DIR}/state"
mkdir -p "${STATE_DIR}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

need_token() {
  if [[ -z "${HCLOUD_TOKEN:-}" ]]; then
    log "ERROR: HCLOUD_TOKEN empty in config.env"
    exit 1
  fi
  export HCLOUD_TOKEN
}

notify() {
  local msg="$1"
  log "NOTIFY: $msg"
  if [[ -n "${DISCORD_WEBHOOK_URL:-}" ]]; then
    curl -sS -H 'Content-Type: application/json' \
      -d "$(jq -nc --arg c "$msg" '{content:$c}')" \
      "$DISCORD_WEBHOOK_URL" >/dev/null || true
  fi
}

online_count() {
  local json
  json="$(curl -fsS --max-time 5 "${ONLINE_URL}" 2>/dev/null || echo '{}')"
  echo "$json" | jq -r '.online // 0' 2>/dev/null || echo 0
}

hcloud_bin() {
  if command -v hcloud >/dev/null 2>&1; then
    command -v hcloud
  elif [[ -x /usr/local/bin/hcloud ]]; then
    echo /usr/local/bin/hcloud
  else
    log "ERROR: hcloud CLI not installed"
    exit 1
  fi
}
