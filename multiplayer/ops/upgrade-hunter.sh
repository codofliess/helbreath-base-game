#!/usr/bin/env bash
# Hourly hunter: prefer CX53, else one 8+ core spare (CX43 / CPX42).
# Never create multiple 8-core spares. Always keep hunting CX53.
set -uo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

need_token
HC="$(hcloud_bin)"
LOG="${STATE_DIR}/upgrade-hunter.log"
mkdir -p "${STATE_DIR}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG"; }

log "hunter tick"
$HC server list | tee -a "$LOG" || true

cur="$($HC server describe "${CORE_SERVER_NAME}" -o format='{{.ServerType.Name}}' 2>/dev/null || echo unknown)"
log "core ${CORE_SERVER_NAME} type=${cur}"

# Only fully idle when already on CX53 (goal).
if [[ "$cur" == "cx53" ]]; then
  log "core already cx53 — hunter idle"
  exit 0
fi

try_create() {
  local type="$1" loc="$2" name="$3"
  if $HC server describe "$name" >/dev/null 2>&1; then
    log "already have $name"
    return 0
  fi
  log "try create $name type=$type loc=$loc"
  if $HC server create \
      --name "$name" \
      --type "$type" \
      --image "${HOT_IMAGE:-ubuntu-24.04}" \
      --location "$loc" \
      --ssh-key "${SSH_KEY_NAME:-chainlords-setup}" \
      --label role=upgrade \
      --label project=chainlords \
      --label sku="$type" 2>"${STATE_DIR}/hunter-err.txt"; then
    ip="$($HC server ip "$name" 2>/dev/null || true)"
    log "GRABBED $name ip=$ip type=$type loc=$loc"
    echo "$name $type $loc $ip $(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"${STATE_DIR}/grabbed.txt"
    notify "Hetzner GRABBED **${name}** type=**${type}** loc=**${loc}** ip=\`${ip}\`"
    return 0
  fi
  log "no stock ${type}@${loc}: $(tr '\n' ' ' <"${STATE_DIR}/hunter-err.txt" | head -c 220)"
  return 1
}

# Always hunt CX53 (even if core is already cx43/cpx42).
for loc in fsn1 nbg1 hel1; do
  try_create cx53 "$loc" "chainlords-cx53-${loc}" && exit 0
done

# If core already 8+ (cx43/cpx42/…), do not create more 8-core spares or poweroff-resize.
case "$cur" in
  cx43|cpx42|cpx52|cpx62|ccx33|ccx43|ccx53)
    log "core already 8+ ($cur); no CX53 stock this hour — idle (no extra spares)"
    exit 0
    ;;
esac

# Core still small: try one 8+ spare, then resize path
for loc in fsn1 nbg1 hel1; do
  try_create cx43 "$loc" "chainlords-cx43-${loc}" && exit 0
done
for loc in fsn1 nbg1 hel1; do
  try_create cpx42 "$loc" "chainlords-cpx42-${loc}" && exit 0
done

for t in cx53 cx43 cpx42; do
  log "try resize ${CORE_SERVER_NAME} -> $t"
  $HC server poweroff "${CORE_SERVER_NAME}" 2>"${STATE_DIR}/hunter-err.txt" || true
  sleep 4
  if $HC server change-type "${CORE_SERVER_NAME}" "$t" 2>"${STATE_DIR}/hunter-err.txt"; then
    $HC server poweron "${CORE_SERVER_NAME}" || true
    log "RESIZED core ${cur} -> $t"
    echo "$t $(date -u +%Y-%m-%dT%H:%M:%SZ)" >"${STATE_DIR}/core-type.txt"
    notify "Core **${CORE_SERVER_NAME}** resized **${cur} → ${t}**"
    exit 0
  fi
  log "resize $t failed: $(tr '\n' ' ' <"${STATE_DIR}/hunter-err.txt" | head -c 200)"
  $HC server poweron "${CORE_SERVER_NAME}" 2>/dev/null || true
done

log "no upgrade this hour"
exit 0
