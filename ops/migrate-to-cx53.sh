#!/usr/bin/env bash
# Migrate Chain Lords production from current host (CX43) → CX53.
# Run ON THE SOURCE (CX43) as root:
#   bash /opt/chainlords/ops/migrate-to-cx53.sh
#
# Dest defaults: 178.105.251.138 (chainlords-cx53-fsn1)
set -euo pipefail

DEST_IP="${DEST_IP:-178.105.251.138}"
DEST_HOST="root@${DEST_IP}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

echo "=== migrate-to-cx53: source=$(hostname) → $DEST_IP ==="

if [[ "$(hostname)" == *cx53* ]]; then
  echo "Refusing: this looks like the destination host."
  exit 1
fi

# Ensure we can SSH to dest (same key on authorized_keys)
ssh "${SSH_OPTS[@]}" "$DEST_HOST" "hostname; free -h | head -1"

echo "=== [1/8] Bootstrap packages on CX53 ==="
ssh "${SSH_OPTS[@]}" "$DEST_HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx rsync curl jq ca-certificates gnupg lsb-release ufw
# Docker
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
mkdir -p /opt/chainlords /var/www/html
# hcloud optional
if ! command -v hcloud >/dev/null 2>&1; then
  curl -fsSL https://github.com/hetznercloud/cli/releases/latest/download/hcloud-linux-amd64.tar.gz \
    | tar -xz -C /usr/local/bin hcloud || true
  chmod +x /usr/local/bin/hcloud 2>/dev/null || true
fi
echo bootstrap_ok
REMOTE

echo "=== [2/8] Stop game on source for consistent final data (short downtime) ==="
systemctl stop chainlords-game || true
# Keep postgres up for dump; stop new writes via game only

echo "=== [3/8] Dump Postgres ==="
DUMP=/tmp/helbreath-pg-migrate.sql.gz
docker exec helbreath-postgres pg_dump -U helbreath -d helbreath --clean --if-exists | gzip -c > "$DUMP"
ls -la "$DUMP"
scp "${SSH_OPTS[@]}" "$DUMP" "$DEST_HOST:/tmp/helbreath-pg-migrate.sql.gz"

echo "=== [4/8] Rsync /opt/chainlords (server, client, ops, env) ==="
# Exclude huge staging if any; keep Chars, Config, reference, binary
rsync -aH --delete \
  --exclude 'client-staging-new/' \
  --exclude 'server/**/*.pdb' \
  --exclude 'server/publish-linux*/' \
  --exclude 'server/_build_check_out/' \
  -e "$RSYNC_SSH" \
  /opt/chainlords/ "$DEST_HOST:/opt/chainlords/"

echo "=== [5/8] Copy systemd units ==="
for u in chainlords-game.service chainlords-mining-report.service chainlords-mining-report.timer \
         chainlords-upgrade-hunter.service chainlords-upgrade-hunter.timer \
         chainlords-autoscaler.service chainlords-autoscaler.timer \
         chainlords-upgrade-probe.service chainlords-upgrade-probe.timer; do
  if [[ -f "/etc/systemd/system/$u" ]]; then
    scp "${SSH_OPTS[@]}" "/etc/systemd/system/$u" "$DEST_HOST:/etc/systemd/system/$u"
  fi
done
# nginx site
scp "${SSH_OPTS[@]}" /etc/nginx/sites-enabled/chainlords-play \
  "$DEST_HOST:/tmp/chainlords-play.nginx" || \
  scp "${SSH_OPTS[@]}" /etc/nginx/sites-available/chainlords-play \
  "$DEST_HOST:/tmp/chainlords-play.nginx"

echo "=== [6/8] Start Postgres + restore + game + nginx on dest ==="
ssh "${SSH_OPTS[@]}" "$DEST_HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
# Postgres container
if ! docker ps -a --format '{{.Names}}' | grep -qx helbreath-postgres; then
  docker volume create helbreath_pg_data >/dev/null
  docker run -d --name helbreath-postgres --restart unless-stopped \
    -e POSTGRES_USER=helbreath \
    -e POSTGRES_PASSWORD=helbreath \
    -e POSTGRES_DB=helbreath \
    -p 127.0.0.1:5432:5432 \
    -v helbreath_pg_data:/var/lib/postgresql/data \
    postgres:16-alpine
else
  docker start helbreath-postgres || true
fi
# Wait ready
for i in $(seq 1 40); do
  if docker exec helbreath-postgres pg_isready -U helbreath -d helbreath >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec helbreath-postgres pg_isready -U helbreath -d helbreath

# Restore
gunzip -c /tmp/helbreath-pg-migrate.sql.gz | docker exec -i helbreath-postgres \
  psql -U helbreath -d helbreath -v ON_ERROR_STOP=1
echo pg_restore_ok

# Permissions
chmod +x /opt/chainlords/server/Server 2>/dev/null || true
chown -R root:www-data /opt/chainlords/client || true
# nginx site: rewrite IP in server_name to CX53
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
sed -e 's/46\.224\.129\.38/178.105.251.138/g' \
    -e 's/server_name play.chainlords.net.*/server_name play.chainlords.net 178.105.251.138 _;/' \
    /tmp/chainlords-play.nginx > /etc/nginx/sites-available/chainlords-play
ln -sfn /etc/nginx/sites-available/chainlords-play /etc/nginx/sites-enabled/chainlords-play
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

systemctl daemon-reload
systemctl enable chainlords-game
systemctl restart chainlords-game
sleep 3
systemctl is-active chainlords-game
systemctl is-active nginx
ss -tlnp | grep -E ':80|:1337|:5432' || true
# Smoke
curl -sS -o /dev/null -w 'realm_stats %{http_code}\n' http://127.0.0.1:1337/api/realm-stats || true
curl -sS -o /dev/null -w 'index %{http_code}\n' -H 'Host: play.chainlords.net' http://127.0.0.1/ || true
curl -sS http://127.0.0.1:1337/api/realm-stats | head -c 300; echo
echo dest_stack_up
REMOTE

echo "=== [7/8] Source left stopped (game). Keep nginx briefly for old DNS until switch. ==="
# Restart source game? NO — avoid split-brain writes. Leave game stopped on source.
echo "source game remains STOPPED to prevent dual-write"

echo "=== [8/8] Verify dest from source ==="
curl -sS -o /dev/null -w "dest_ip_realm %{http_code}\n" --connect-timeout 5 "http://${DEST_IP}:1337/api/realm-stats" || true
curl -sS -o /dev/null -w "dest_ip_http %{http_code}\n" --connect-timeout 5 -H "Host: play.chainlords.net" "http://${DEST_IP}/" || true

echo "MIGRATE_DATA_OK dest=$DEST_IP"
echo "NEXT: point DNS play.chainlords.net A → $DEST_IP (proxied), then delete old servers."
