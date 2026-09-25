#!/usr/bin/env bash
# Isolated playtest door. Loopback only. Do not point this at live Chile or a public tunnel.
# Game :31337 · traveler Vite :8081 · GM Vite :8080.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="${HOME}/.dotnet:${HOME}/.dotnet/tools:${PATH}"

# Tight default fd limits make Vite's native watcher die with EMFILE. Polling is also on in the Vite configs.
ulimit -n 65536 2>/dev/null || true

unset DATABASE_URL WALLET_AUTH_SECRET HELL_MINT MARKET_MIDDLEWARE_URL SOLANA_RPC_URL || true
export PLAYTEST=1
export ASPNETCORE_ENVIRONMENT=Development
# Local GM Vite only — never set this in production. Lets :8080 edit kit/stats on playtest seats.
export ALLOW_OPEN_GM_SANDBOX=1

GAME_PORT=31337
echo "[playtest] game 127.0.0.1:${GAME_PORT} + traveler http://127.0.0.1:8081 + GM http://127.0.0.1:8080"
echo "[playtest] seats: http://127.0.0.1:8081/?seat=a  (A/ElonQa, QA Guild One)"
echo "[playtest]         http://127.0.0.1:8081/?seat=b  (B/MaggyQa, QA Guild Two)"
echo "[playtest]         http://127.0.0.1:8081/?seat=c  (C/PistQa, QA Guild One)"
echo "[playtest] aliases: ?seat=elon|maggy|pist   GM: http://127.0.0.1:8080/?seat=a"

cd "$ROOT/multiplayer/server"
dotnet run --no-launch-profile &
SERVER_PID=$!

cd "$ROOT/multiplayer/mp-client"
if [[ ! -d node_modules ]]; then
  npm install --ignore-scripts
fi

cleanup() {
  kill "$SERVER_PID" ${CLIENT_PID:-} ${GM_PID:-} 2>/dev/null || true
}
trap cleanup EXIT INT TERM

bound=0
for _ in $(seq 1 90); do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "[playtest] game server exited before bind" >&2
    exit 1
  fi
  code="$(curl -s -o /dev/null --max-time 1 -w '%{http_code}' "http://127.0.0.1:${GAME_PORT}/" || true)"
  if [[ "$code" != "000" && -n "$code" ]]; then
    bound=1
    break
  fi
  sleep 1
done
if [[ "$bound" != 1 ]]; then
  echo "[playtest] game did not bind :${GAME_PORT}" >&2
  exit 1
fi
echo "[playtest] game UP on 127.0.0.1:${GAME_PORT}"

if [[ "${PLAYTEST_GM:-1}" == "1" ]]; then
  npm run gm &
  GM_PID=$!
fi

npm run playtest &
CLIENT_PID=$!

wait "$CLIENT_PID"
