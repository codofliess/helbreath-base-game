#!/usr/bin/env bash
# Prefer CX53, then best available from CORE_TYPES. Power off → change-type → power on.
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

if [[ "${UPGRADE_CORE_ENABLED:-1}" != "1" ]]; then
  log "core upgrade disabled"
  exit 0
fi
need_token
HC="$(hcloud_bin)"

name="${CORE_SERVER_NAME}"
if ! "$HC" server describe "$name" >/dev/null 2>&1; then
  log "core server '$name' not found"
  exit 0
fi

cur="$("$HC" server describe "$name" -o format='{{.ServerType.Name}}')"
log "core type now=$cur"

IFS=',' read -ra types <<< "${CORE_TYPES}"
for t in "${types[@]}"; do
  t="$(echo "$t" | xargs)"
  [[ -z "$t" ]] && continue
  if [[ "$t" == "$cur" ]]; then
    log "already on preferred/current $t"
    exit 0
  fi
  # Skip if already larger in a simple ordering (optional)
  log "trying resize → $t"
  if "$HC" server poweroff "$name" 2>/dev/null; then
    sleep 2
  fi
  if "$HC" server change-type "$name" "$t" 2>"${STATE_DIR}/last-resize.err"; then
    "$HC" server poweron "$name" || true
    notify "✅ Core **$name** resized **$cur → $t**"
    echo "$t" >"${STATE_DIR}/core-type.txt"
    exit 0
  fi
  log "resize to $t failed: $(tr '\n' ' ' <"${STATE_DIR}/last-resize.err" | head -c 200)"
  "$HC" server poweron "$name" 2>/dev/null || true
done

log "no upgrade available from list: ${CORE_TYPES}"
exit 0
