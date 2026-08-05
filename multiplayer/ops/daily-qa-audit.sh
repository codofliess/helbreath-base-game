#!/usr/bin/env bash
# Daily Olympia ingest + combat theory audits. Discord webhook on FAIL.
# Optional: MAIL_TO via mailx/sendmail if present.
set -uo pipefail

OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
# Repo may live only on VPS under /opt/chainlords/repo or ops may hold copies of scripts
REPO="${REPO_DIR:-/opt/chainlords/repo}"
CHARS_DIR="${CHARS_DIR:-/opt/chainlords/server/Chars}"
REPORT_DIR="${REPORT_DIR:-${CHARS_DIR}/reports}"
STATE_DIR="${STATE_DIR:-/opt/chainlords/ops/state}"
LOG="${STATE_DIR}/daily-qa-audit.log"
CONFIG_DIR="${CONFIG_DIR:-/opt/chainlords/server/Config}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
MAIL_TO="${MAIL_TO:-}"

mkdir -p "${REPORT_DIR}" "${STATE_DIR}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "$LOG"; }

DAY="$(date -u +%Y-%m-%d)"
log "daily QA audit start ${DAY}"

# Prefer scripts from REPO; fallback to ops copies
AUDIT_PY="${REPO}/ops/combat_audit.py"
MATRIX_PY="${REPO}/ops/combat_matrix_audit.py"
INGEST_PY="${REPO}/ops/olympia_ingest.py"
if [[ ! -f "$AUDIT_PY" ]]; then AUDIT_PY="${OPS_DIR}/combat_audit.py"; fi
if [[ ! -f "$MATRIX_PY" ]]; then MATRIX_PY="${OPS_DIR}/combat_matrix_audit.py"; fi
if [[ ! -f "$INGEST_PY" ]]; then INGEST_PY="${OPS_DIR}/olympia_ingest.py"; fi

FAILS=0
BODY=""
OUT_MD="${REPORT_DIR}/qa-audit-${DAY}.md"
OUT_JSON="${REPORT_DIR}/qa-audit-${DAY}.json"

{
  echo "# Daily QA audit ${DAY} UTC"
  echo ""
} >"$OUT_MD"

run_py() {
  local name="$1"
  local script="$2"
  shift 2
  if [[ ! -f "$script" ]]; then
    log "SKIP ${name}: missing ${script}"
    echo "## ${name}: SKIP (script missing)" >>"$OUT_MD"
    return 0
  fi
  log "RUN ${name}"
  local tmp
  tmp="$(mktemp)"
  set +e
  python3 "$script" "$@" >"$tmp" 2>&1
  local rc=$?
  set -e
  cat "$tmp" >>"$OUT_MD"
  echo "" >>"$OUT_MD"
  if [[ $rc -ne 0 ]]; then
    FAILS=$((FAILS + 1))
    BODY+="FAIL ${name} (exit ${rc})\n"
    log "FAIL ${name} exit=${rc}"
  else
    BODY+="OK ${name}\n"
    log "OK ${name}"
  fi
  rm -f "$tmp"
  return 0
}

# Ingest does not fail the day on wiki errors
if [[ -f "$INGEST_PY" ]]; then
  run_py "olympia_ingest" "$INGEST_PY" --repo "${REPO}" --wiki rare-items || true
else
  log "no olympia_ingest.py"
fi

run_py "combat_audit" "$AUDIT_PY" --config-dir "$CONFIG_DIR" --out "${REPORT_DIR}/combat-audit-${DAY}.md"
run_py "combat_matrix" "$MATRIX_PY" --repo "${REPO}" --out "${REPORT_DIR}/combat-matrix-${DAY}.md"

# If REPO missing for matrix, try with config only by faking repo layout
if [[ $FAILS -gt 0 ]] && [[ ! -d "${REPO}/multiplayer/server/Config" ]]; then
  log "REPO layout incomplete — matrix may have failed; ensure git clone at ${REPO}"
fi

python3 - <<PY
import json, os
from datetime import datetime, timezone
obj = {
  "utcDay": "${DAY}",
  "generatedAt": datetime.now(timezone.utc).isoformat(),
  "fails": int("${FAILS}"),
  "reportMd": "${OUT_MD}",
  "status": "FAIL" if int("${FAILS}") else "OK",
}
path = "${OUT_JSON}"
with open(path, "w", encoding="utf-8") as f:
    json.dump(obj, f, indent=2)
print("wrote", path, obj["status"])
PY

SUMMARY="Chain Lords QA audit ${DAY}: fails=${FAILS}
${BODY}
Reports: ${OUT_MD}
"

export DAY FAILS SUMMARY DISCORD_WEBHOOK_URL MAIL_TO NOTIFY_ON_OK

# Discord on FAIL (or NOTIFY_ON_OK=1)
if [[ -n "${DISCORD_WEBHOOK_URL}" ]]; then
  if [[ "${FAILS}" -gt 0 ]] || [[ "${NOTIFY_ON_OK:-0}" == "1" ]]; then
    python3 - <<'PY'
import json, os, urllib.request
url = os.environ.get("DISCORD_WEBHOOK_URL") or ""
fails = int(os.environ.get("FAILS", "0") or "0")
day = os.environ.get("DAY", "")
body = os.environ.get("SUMMARY", "")
content = f"**QA audit {day}** — {'🔴 FAIL' if fails else '🟢 OK'} (fails={fails})\n```\n{body[:1800]}\n```"
req = urllib.request.Request(
    url,
    data=json.dumps({"content": content}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    urllib.request.urlopen(req, timeout=20)
    print("discord ok")
except Exception as e:
    print("discord fail", e)
PY
  else
    log "QA green — Discord silent (set NOTIFY_ON_OK=1 to always ping)"
  fi
else
  log "DISCORD_WEBHOOK_URL empty — skip discord"
fi

# Email on FAIL (or always if NOTIFY_ON_OK=1) when mailx present
if [[ -n "${MAIL_TO}" ]] && command -v mail >/dev/null 2>&1; then
  if [[ "${FAILS}" -gt 0 ]] || [[ "${NOTIFY_ON_OK:-0}" == "1" ]]; then
    echo -e "$SUMMARY" | mail -s "Chain Lords QA audit ${DAY} fails=${FAILS}" "$MAIL_TO" || true
    log "mailed ${MAIL_TO}"
  fi
elif [[ -n "${MAIL_TO}" ]]; then
  log "MAIL_TO set but mail(1) missing — install mailutils or msmtp"
fi

log "daily QA audit done fails=${FAILS}"
# exit 0 so timer does not enter failed state forever; JSON carries status
exit 0
