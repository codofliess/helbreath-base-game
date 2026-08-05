# Chain Lords ops — core + on-demand hot (autopilot)

## Goal

| Layer | Role | Target |
|-------|------|--------|
| **Core** (always on) | Login, cities, traveler, default 50–100 ON | Best available plan (CX53 preferred) |
| **Hot** (on demand) | Extra capacity / event maps | Create VPS when ON high; destroy when low |
| **Home** (optional later) | Overflow when you build the tower | Same scripts, different `HCLOUD` or SSH target |

## Truth: who runs 24/7?

- **Autopilot = scripts + systemd timers on the VPS** (not the chat agent).
- The agent (**Grok**) installs/updates the autopilot and can act when you are in session + `HCLOUD_TOKEN` is set.
- You do **not** need to babysit every scale event.

## Files

| Script | Purpose |
|--------|---------|
| `install-on-vps.sh` | Copy ops to `/opt/chainlords/ops`, install timers |
| `config.env.example` | Thresholds + secrets template |
| `lib.sh` | Common helpers |
| `probe-online.sh` | Read ON from `GET /api/realm-stats` |
| `try-upgrade-core.sh` | Prefer CX53 → CX43 → CX33 if stock |
| `hot-up.sh` | Create hot server + mark state |
| `hot-down.sh` | Delete hot server when cool |
| `autoscaler.sh` | Main loop: upgrade check + scale up/down |
| `notify.sh` | Discord webhook optional |
| `daily-qa-audit.sh` | Olympia ingest + combat theory audits |
| `install-daily-qa-audit.sh` | Install `chainlords-qa-audit.timer` (00:25 UTC) |

## Config (`/opt/chainlords/ops/config.env`)

```bash
CORE_SERVER_NAME=chainlords-play
HCLOUD_TOKEN=...                 # Hetzner API Read & Write
ONLINE_URL=http://127.0.0.1:1337/api/realm-stats
# Scale hot when core ON exceeds:
HOT_UP_ONLINE=45
# Destroy hot when ON below for N consecutive checks:
HOT_DOWN_ONLINE=20
HOT_DOWN_STREAK=6
# Preferred types for core resize (first available wins):
CORE_TYPES=cx53,cx43,cpx42,cx33,cpx32
# Hot node type / location:
HOT_TYPE=cx43
HOT_LOCATION=fsn1
HOT_SERVER_NAME=chainlords-hot
# Optional Discord (mining + QA fails):
# DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
# Optional email for QA fails (mailx on host):
# MAIL_TO=you@example.com
# NOTIFY_ON_OK=0
```

## Daily QA audit

```bash
# Install (once on VPS):
bash /opt/chainlords/ops/install-daily-qa-audit.sh

# Manual run:
REPO_DIR=/opt/chainlords/repo bash /opt/chainlords/ops/daily-qa-audit.sh

# Reports:
#   /opt/chainlords/server/Chars/reports/qa-audit-YYYY-MM-DD.md
#   docs/qa/PLAYWRIGHT-DEFERRED.md  — physical tests after theory green
```

Timer: `chainlords-qa-audit.timer` at **00:25 UTC** (after mining report ~00:10).  
Notify: Discord + `mail` only when `fails>0` (or `NOTIFY_ON_OK=1`).

## Hot shard (phase 1 — capacity clone)

Phase 1 hot is a **second full game process** (same binary) for **overflow sessions**, not yet map-routing by worldId.

True **map routing** (ML/PL only on hot) uses:

```bash
WORLD_ID_ALLOWLIST=middleland,promiseland,abaddon
```

on the hot node (supported in `Server.cs`). Lobby/client host selection is phase 2.

## Install

```bash
# from repo, as root on VPS:
export HCLOUD_TOKEN=...
bash multiplayer/ops/install-on-vps.sh
```

Timers:

- `chainlords-autoscaler.timer` — every 2 minutes  
- `chainlords-upgrade-probe.timer` — every 30 minutes (stock CX53)

## Manual

```bash
/opt/chainlords/ops/probe-online.sh
/opt/chainlords/ops/try-upgrade-core.sh
/opt/chainlords/ops/hot-up.sh
/opt/chainlords/ops/hot-down.sh
```
