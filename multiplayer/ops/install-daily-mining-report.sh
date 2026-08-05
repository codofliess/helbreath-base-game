#!/usr/bin/env bash
# Installs systemd timer for daily mining report at 00:10 UTC.
set -euo pipefail
OPS_DIR="$(cd "$(dirname "$0")" && pwd)"
install -m 0755 "${OPS_DIR}/daily-mining-report.sh" /opt/chainlords/ops/daily-mining-report.sh

# Load Discord webhook if present
ENV_FILE=/opt/chainlords/ops/config.env
cat >/etc/systemd/system/chainlords-mining-report.service <<'EOF'
[Unit]
Description=Chain Lords daily play-mine report
After=network.target chainlords-game.service

[Service]
Type=oneshot
EnvironmentFile=-/opt/chainlords/ops/config.env
Environment=CHARS_DIR=/opt/chainlords/server/Chars
Environment=STATE_DIR=/opt/chainlords/ops/state
ExecStart=/opt/chainlords/ops/daily-mining-report.sh
Nice=10
EOF

cat >/etc/systemd/system/chainlords-mining-report.timer <<'EOF'
[Unit]
Description=Run Chain Lords mining report daily (00:10 UTC)

[Timer]
OnCalendar=*-*-* 00:10:00 UTC
Persistent=true
Unit=chainlords-mining-report.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now chainlords-mining-report.timer
systemctl list-timers --all | grep mining || true
echo "Installed chainlords-mining-report.timer"
