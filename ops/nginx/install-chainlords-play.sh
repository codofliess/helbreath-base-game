#!/usr/bin/env bash
# Install / refresh play.chainlords.net nginx site from repo template.
set -euo pipefail

CLIENT_ROOT="${CLIENT_ROOT:-/opt/chainlords/client}"
SERVER_IP="${SERVER_IP:-}"
TEMPLATE="${TEMPLATE:-/opt/chainlords/repo/ops/nginx/chainlords-play.conf.template}"
DEST="/etc/nginx/sites-available/chainlords-play"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE" >&2
  exit 1
fi

if [[ -z "$SERVER_IP" ]]; then
  SERVER_IP="$(hostname -I | awk '{print $1}')"
fi

sed \
  -e "s|__CLIENT_ROOT__|${CLIENT_ROOT}|g" \
  -e "s|__SERVER_IP__|${SERVER_IP}|g" \
  "$TEMPLATE" > "$DEST"

ln -sfn "$DEST" /etc/nginx/sites-enabled/chainlords-play
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "Installed $DEST (client=$CLIENT_ROOT ip=$SERVER_IP)"
