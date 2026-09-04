#!/usr/bin/env bash
# Run ON the live VPS (root@46.224.129.38). Not from a cloud agent without SSH.
# Updates only character Elon / KindGem997. Does not restart chainlords-game.
set -euo pipefail

if [[ ! -d /opt/chainlords/server ]]; then
  echo "This is not the live game host (/opt/chainlords/server missing)." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$ROOT/ops/apply-live-elon-warrior-kit.py" ]]; then
  # Copied next to the game tree on the VPS.
  if [[ -f /opt/chainlords/repo/ops/apply-live-elon-warrior-kit.py ]]; then
    ROOT=/opt/chainlords/repo
  else
    echo "apply-live-elon-warrior-kit.py not found" >&2
    exit 1
  fi
fi

# Local Postgres as used by prior VPS ops (deploy-finish.sh). Override with DATABASE_URL if needed.
export DATABASE_URL="${DATABASE_URL:-postgresql://helbreath:helbreath@127.0.0.1:5432/helbreath}"
export ALLOW_LIVE_ELON_KIT=1

python3 "$ROOT/ops/apply-live-elon-warrior-kit.py" --self-test
python3 "$ROOT/ops/apply-live-elon-warrior-kit.py" --apply \
  --chars-dir /opt/chainlords/server/Chars

echo "Done. Elon must re-log. chainlords-game was not restarted."
