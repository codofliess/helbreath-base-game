#!/usr/bin/env bash
# Run on the VPS as root (or via: ssh root@IP 'bash -s' < install-on-vps.sh)
set -euo pipefail

OPS_DST=/opt/chainlords/ops
mkdir -p "$OPS_DST" /opt/chainlords/ops/state

# If run from repo copy
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -a "${SCRIPT_DIR}/." "$OPS_DST/"
chmod +x "$OPS_DST"/*.sh

if [[ ! -f "$OPS_DST/config.env" ]]; then
  cp "$OPS_DST/config.env.example" "$OPS_DST/config.env"
  echo "Wrote $OPS_DST/config.env — SET HCLOUD_TOKEN before autoscale does anything"
fi

# hcloud CLI
if ! command -v hcloud >/dev/null 2>&1; then
  curl -fsSL https://github.com/hetznercloud/cli/releases/latest/download/hcloud-linux-amd64.tar.gz \
    | tar -xz -C /usr/local/bin hcloud
  chmod +x /usr/local/bin/hcloud
fi

# jq curl
export DEBIAN_FRONTEND=noninteractive
apt-get install -y -qq jq curl >/dev/null

# systemd units
cat >/etc/systemd/system/chainlords-autoscaler.service <<'EOF'
[Unit]
Description=Chain Lords autoscaler tick
After=network.target chainlords-game.service

[Service]
Type=oneshot
ExecStart=/opt/chainlords/ops/autoscaler.sh
Nice=10
EOF

cat >/etc/systemd/system/chainlords-autoscaler.timer <<'EOF'
[Unit]
Description=Chain Lords autoscaler every 2 min

[Timer]
OnBootSec=2min
OnUnitActiveSec=2min
AccuracySec=30s
Unit=chainlords-autoscaler.service

[Install]
WantedBy=timers.target
EOF

cat >/etc/systemd/system/chainlords-upgrade-probe.service <<'EOF'
[Unit]
Description=Chain Lords try core upgrade (CX53 etc)
After=network.target

[Service]
Type=oneshot
ExecStart=/opt/chainlords/ops/try-upgrade-core.sh
Nice=10
EOF

cat >/etc/systemd/system/chainlords-upgrade-probe.timer <<'EOF'
[Unit]
Description=Probe CX stock / upgrade core every 30 min

[Timer]
OnBootSec=5min
OnUnitActiveSec=30min
AccuracySec=1min
Unit=chainlords-upgrade-probe.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now chainlords-autoscaler.timer
systemctl enable --now chainlords-upgrade-probe.timer

echo "Installed."
echo "  1) Edit /opt/chainlords/ops/config.env → HCLOUD_TOKEN=..."
echo "  2) systemctl start chainlords-autoscaler.service  # test once"
echo "  3) journalctl -u chainlords-autoscaler -f"
