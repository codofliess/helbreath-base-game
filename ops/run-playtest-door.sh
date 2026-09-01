#!/usr/bin/env bash
# Isolated playtest door (ElonQa, no Phantom). NOT live. Do not SSH Hetzner / railway up.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

unset DATABASE_URL WALLET_AUTH_SECRET HELL_MINT MARKET_MIDDLEWARE_URL SOLANA_RPC_URL || true
export PLAYTEST=1
export ASPNETCORE_ENVIRONMENT=Development
export HELL_TESTING_WEEK=0
export HELL_TESTING_WEEK_UNTIL=2020-01-01

echo "[playtest] game :1337 + client http://127.0.0.1:8081  (not play.chainlords.net)"

cd "$ROOT/multiplayer/server"
dotnet run --no-launch-profile &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait until the game port is listening (or the server dies).
for _ in $(seq 1 60); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[playtest] game server exited before bind" >&2
    exit 1
  fi
  if command -v ss >/dev/null 2>&1 && ss -ltn | grep -q ':1337'; then
    break
  fi
  sleep 1
done

cd "$ROOT/multiplayer/mp-client"
if [[ ! -d node_modules ]]; then
  pnpm install
fi
exec pnpm run playtest
