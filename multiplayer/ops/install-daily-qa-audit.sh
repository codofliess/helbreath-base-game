#!/usr/bin/env bash
# Install systemd timer: daily QA audit 00:25 UTC (after mining report 00:10).
set -euo pipefail
OPS_DIR="$(cd "$(dirname "$0")" && pwd)"

# Copy script into place only when installer lives elsewhere (local clone).
DEST_OPS="/opt/chainlords/ops"
if [[ "${OPS_DIR}" != "${DEST_OPS}" ]]; then
  install -m 0755 "${OPS_DIR}/daily-qa-audit.sh" "${DEST_OPS}/daily-qa-audit.sh"
else
  chmod 0755 "${DEST_OPS}/daily-qa-audit.sh"
fi
# Ship python auditors next to ops if repo not cloned
for f in combat_audit.py combat_matrix_audit.py olympia_ingest.py; do
  src=""
  if [[ -f "${OPS_DIR}/../../ops/${f}" ]]; then
    src="${OPS_DIR}/../../ops/${f}"
  elif [[ -f "${OPS_DIR}/${f}" ]]; then
    src="${OPS_DIR}/${f}"
  fi
  if [[ -n "$src" ]]; then
    if [[ "$src" != "${DEST_OPS}/${f}" ]]; then
      install -m 0644 "$src" "${DEST_OPS}/${f}"
    else
      chmod 0644 "${DEST_OPS}/${f}"
    fi
  fi
done

# Optional: keep a git checkout for full matrix reference/
if [[ ! -d /opt/chainlords/repo ]]; then
  echo "NOTE: clone repo to /opt/chainlords/repo for full matrix (Item.cfg reference)."
  echo "  git clone <url> /opt/chainlords/repo"
fi

cat >/etc/systemd/system/chainlords-qa-audit.service <<'EOF'
[Unit]
Description=Chain Lords daily combat/olympia QA audit
After=network.target

[Service]
Type=oneshot
EnvironmentFile=-/opt/chainlords/ops/config.env
Environment=CHARS_DIR=/opt/chainlords/server/Chars
Environment=CONFIG_DIR=/opt/chainlords/server/Config
Environment=STATE_DIR=/opt/chainlords/ops/state
Environment=REPO_DIR=/opt/chainlords/repo
Environment=FAILS=0
ExecStart=/bin/bash -c 'export DAY=$(date -u +%%Y-%%m-%%d); export FAILS=0; /opt/chainlords/ops/daily-qa-audit.sh'
Nice=10
EOF

# Fix service: run script directly (it sets FAILS internally)
cat >/etc/systemd/system/chainlords-qa-audit.service <<'EOF'
[Unit]
Description=Chain Lords daily combat/olympia QA audit
After=network.target

[Service]
Type=oneshot
EnvironmentFile=-/opt/chainlords/ops/config.env
Environment=CHARS_DIR=/opt/chainlords/server/Chars
Environment=CONFIG_DIR=/opt/chainlords/server/Config
Environment=STATE_DIR=/opt/chainlords/ops/state
Environment=REPO_DIR=/opt/chainlords/repo
Environment=REPORT_DIR=/opt/chainlords/server/Chars/reports
ExecStart=/opt/chainlords/ops/daily-qa-audit.sh
Nice=10
EOF

cat >/etc/systemd/system/chainlords-qa-audit.timer <<'EOF'
[Unit]
Description=Run Chain Lords QA audit daily (00:25 UTC)

[Timer]
OnCalendar=*-*-* 00:25:00 UTC
Persistent=true
Unit=chainlords-qa-audit.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now chainlords-qa-audit.timer
systemctl list-timers --all | grep qa-audit || true
echo "Installed chainlords-qa-audit.timer"
echo "Set DISCORD_WEBHOOK_URL (and optional MAIL_TO) in /opt/chainlords/ops/config.env"
