# Migrate Chain Lords game host: Hetzner CX53 fsn1 → Vultr São Paulo (sao)

**Status:** runbook only. This file does **not** provision, spend, or cut over. Do **not** destroy or power off live EU (`OLD_IP`).

| | |
|---|---|
| Source (live) | Hetzner **CX53** `chainlords-cx53-fsn1` (fsn1) · documented IPv4 **`OLD_IP=46.224.129.38`** ([`docs/SESSION-HANDOFF-2026-07-26.md`](../docs/SESSION-HANDOFF-2026-07-26.md), [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh)) |
| Target (this move) | Vultr **Cloud Compute Regular** · region **`sao` (São Paulo)** · **4 vCPU / 8 GB / 160 GB SSD** · list ~**$40/mo** |
| Repo / branch | `codofliess/helbreath-base-game` · **`consolidacion`** |
| Moves | Game process (`chainlords-game`), traveler static (`nginx` + `/opt/chainlords/client`), server binaries + **`Chars/`** + **`Config/`**, systemd, firewall |
| Does **not** move | Railway landing (`chainlords.net`), Railway **middleware-node**, Railway **Postgres plugin** (if that is the middleware DB) |
| Hard rule | Keep **fsn1 warm until GO**. No Hetzner delete / no `hcloud server delete`. [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh) is **Hetzner-only** and **must not** be run for this move. |

**Placeholders (do not invent addresses):**

| Token | Meaning |
|---|---|
| `OLD_IP` | `46.224.129.38` (documented production play IPv4) |
| `NEW_IP` | Vultr São Paulo instance public IPv4 — fill in **after** provision; never guess |
| `SSH_KEY` | Operator key (live docs: `~/.ssh/hetzner_chainlords` → `root@OLD_IP`). Install the **same public key** on Vultr at create time. |

Vultr cannot inherit Hetzner primary IP `46.224.129.38`. Cutover is **DNS** (and Cloudflare proxy), not an IP swap.

---

## Why this is not a copy of CX43→CX53

[`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh) + [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh) assumed:

1. Destination IP already known (`178.105.251.138` — **do not reuse**; that was a temporary CX53 address before the play IP moved).
2. Same cloud (Hetzner) so the **play IPv4 could be reassigned** — DNS did not change.
3. Immediate `systemctl stop chainlords-game` on **source** (split-brain prevention) then dump + rsync.

For Vultr:

- Destination IP is **`NEW_IP` (unknown until created)**.
- Do a **warm copy while fsn1 stays serving**, then a **short freeze** (stop game on source → final rsync/dump → start dest → DNS) at GO.
- Do **not** enable Hetzner **autoscaler / upgrade-hunter / try-upgrade-core** on Vultr (`HCLOUD_TOKEN` would still target Hetzner and can create/destroy EU servers). Copy the units only if you explicitly disable them.

**Capacity note (ops, not a blocker for this doc):** live CX53 was documented as **16 vCPU / 32 GB / 320 GB**. Target is **4 / 8 / 160**. Watch CPU, RAM, and disk after GO; this runbook does not resize or buy extra SKUs.

---

## Architecture (what lives where)

Documented production split ([`docs/PRODUCTION-REPAIR-RUNBOOK.md`](../docs/PRODUCTION-REPAIR-RUNBOOK.md), session handoff 2026-07-26):

| Piece | Where today | This migrate |
|---|---|---|
| `play.chainlords.net` nginx + traveler `/opt/chainlords/client` | Hetzner `OLD_IP` | **Move** to Vultr `NEW_IP` |
| `chainlords-game` · `/opt/chainlords/server` · HTTP/WS **`:1337`** | Hetzner | **Move** |
| JSON saves **`/opt/chainlords/server/Chars/`** + **`Config/`** | Hetzner | **Move** (authoritative for traveler JSON / mining / auction / arena files) |
| Docker **`helbreath-postgres`** · volume `helbreath_pg_data` · `127.0.0.1:5432` | Documented **on the game VPS** (handoff 2026-07-26; [`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh) dumps this) | **If still local:** dump/restore onto Vultr. **If `DATABASE_URL` already points at Railway public TCP:** **do not** dump/restore Railway; game-server only moves (see § Postgres) |
| Railway **middleware** | `chainlords-middleware-production.up.railway.app` | **Stay** |
| Railway **Postgres plugin** | middleware `DATABASE_URL` | **Stay** (middleware DB) |
| Railway **landing** | `chainlords.net` | **Stay**. Do **not** change landing HTML in this workstream. After DNS GO, landing `CHAINLORDS_PLAY_URL` (default `https://play.chainlords.net`) still works if the hostname follows DNS. |

Secrets (never commit; copy from **live systemd/env**, not from git examples):

- `WALLET_AUTH_SECRET` — **same value** as middleware (fail-closed on game server).
- `DATABASE_URL` — local `postgresql://…@127.0.0.1:5432/helbreath` **or** Railway `DATABASE_PUBLIC_URL` (see § Postgres).
- Also copy if present on the unit: `MARKET_SYNC_SECRET`, `MARKET_MIDDLEWARE_URL`, and any other `Environment=` / `EnvironmentFile=` from `chainlords-game.service`.

---

## Cutover order (summary)

Do these in this order. Expand checklists below.

0. **Decide Postgres path** on live (`helbreath-postgres` vs Railway `DATABASE_URL`) — **before** freeze.
1. **Provision** Vultr `sao` Regular 4/8/160 (operator; this PR does not spend). Record **`NEW_IP`**. SSH keys at create.
2. **Bootstrap** dest: packages, Docker, nginx, ufw. **No** Hetzner CLI required. **No** game traffic to dest yet.
3. **Warm rsync** `/opt/chainlords` while **fsn1 game stays up**.
4. **Install** systemd units + nginx template with `SERVER_IP=NEW_IP`. Copy secrets onto dest unit. **Do not** start `chainlords-game` for public play until freeze (or start only for loopback smoke, then stop).
5. **GO window:** stop **game** on `OLD_IP` (leave nginx up for old DNS). Final rsync + Postgres dump/restore **only if local**. Start dest stack. Smoke **by `NEW_IP`**.
6. **DNS** `play.chainlords.net` **A → `NEW_IP`**. Keep **fsn1 powered on**, game **stopped** (no dual-write).
7. Smoke **via hostname**: health / arena / `/ws`.
8. **Hold rollback:** fsn1 warm until dest is proven. Destroy Hetzner **only** in a later, explicit decision (not this runbook’s GO).

---

## 0. Postgres decision (do this first on live)

SSH to source (do not stop the game for this check):

```bash
# OLD_IP=46.224.129.38
ssh -i "$SSH_KEY" "root@${OLD_IP}" 'bash -s' <<'REMOTE'
echo "=== DATABASE_URL on game unit (redact password when pasting logs) ==="
systemctl cat chainlords-game | grep -E 'Environment|EnvironmentFile' || true
# If EnvironmentFile is used:
#   grep -E '^DATABASE_URL=' /path/from/unit || true

echo "=== local docker postgres? ==="
docker ps -a --format '{{.Names}} {{.Status}}' | grep -i postgres || true
docker exec helbreath-postgres pg_isready -U helbreath -d helbreath 2>/dev/null || echo "no local helbreath-postgres ready"
REMOTE
```

| Observation | Action at GO |
|---|---|
| `DATABASE_URL` is localhost / `helbreath@127.0.0.1` **and** `helbreath-postgres` is running | **Dump/restore** with the same pattern as [`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh) §§3 and 6 onto Vultr. Characters in Postgres move with the dump. |
| `DATABASE_URL` is Railway **public** TCP (`DATABASE_PUBLIC_URL` style) | **Game-server only.** Do **not** `pg_dump` Railway into a new local Docker (split-brain / overwrite risk). Do **not** migrate the Railway plugin. Copy the **same** `DATABASE_URL` onto dest. Optional: still run empty local Postgres **only if** you are sure the game will not use it. |
| Both exist | Trust **`DATABASE_URL` on `chainlords-game`**. Document which one is canonical in the GO ticket. |

Railway middleware Postgres stays on Railway either way ([`docs/PRODUCTION-REPAIR-RUNBOOK.md`](../docs/PRODUCTION-REPAIR-RUNBOOK.md)).

---

## 1. Provision Vultr São Paulo (operator — spending happens here, not in git)

Create **after** this runbook is approved. Record values; do not commit secrets or live IPs beyond `OLD_IP`.

- [ ] Region: **São Paulo (`sao`)**
- [ ] Plan: Cloud Compute **Regular** **4 vCPU / 8 GB RAM / 160 GB SSD** (~$40/mo)
- [ ] OS: Ubuntu LTS matching source (`lsb_release -a` on `OLD_IP`; CX53-era docs used Ubuntu 24.04 in autoscaler image hints)
- [ ] **SSH keys** attached at create (same pubkey as `hetzner_chainlords` / current `authorized_keys` on fsn1)
- [ ] Hostname e.g. `chainlords-play-sao` (cosmetic)
- [ ] Firewall/VPC: see § 6. Vultr cloud firewall **and/or** `ufw` on box
- [ ] Write down **`NEW_IP`** (IPv4). IPv6 optional; nginx template already `listen [::]:80`
- [ ] Confirm you can: `ssh -i "$SSH_KEY" "root@${NEW_IP}" hostname`

No `hcloud` on dest. Do not run [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh).

---

## 2. Bootstrap dest (packages, Docker, dirs)

Same package set as [`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh) §1, minus Hetzner CLI.

**.NET / runtime:** production binary is **self-contained linux-x64** (`dotnet publish -c Release -r linux-x64 --self-contained true` — [`docs/SESSION-HANDOFF-2026-07-26.md`](../docs/SESSION-HANDOFF-2026-07-26.md)). Host does **not** need the .NET SDK if you **rsync the live `/opt/chainlords/server` tree** (includes `Server` + runtime). Do **not** publish `--self-contained false` onto this host.

Install **ASP.NET / .NET 10 runtime only if** you later switch to framework-dependent deploys. For a binary copy migrate: **rsync is enough**.

```bash
# DEST: NEW_IP (fill in)
ssh -i "$SSH_KEY" "root@${NEW_IP}" 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx rsync curl jq ca-certificates gnupg lsb-release ufw
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
mkdir -p /opt/chainlords /var/www/html
echo bootstrap_ok
REMOTE
```

---

## 3. Warm copy (fsn1 **stays up**)

Run **from source** (or from an operator box that can SSH both). **Do not** `systemctl stop chainlords-game` yet.

Rsync set matches [`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh) §4:

```bash
OLD_IP=46.224.129.38
NEW_IP=   # fill
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
RSYNC_SSH="ssh ${SSH_OPTS[*]} -i ${SSH_KEY}"

# From source as root, or: ssh root@OLD_IP then:
rsync -aH --delete \
  --exclude 'client-staging-new/' \
  --exclude 'server/**/*.pdb' \
  --exclude 'server/publish-linux*/' \
  --exclude 'server/_build_check_out/' \
  -e "$RSYNC_SSH" \
  /opt/chainlords/ "root@${NEW_IP}:/opt/chainlords/"
```

Must include **`server/Server`**, **`server/Chars/`**, **`server/Config/`**, **`client/`**, **`ops/`**. Confirm dest:

```bash
ssh -i "$SSH_KEY" "root@${NEW_IP}" \
  'ls -la /opt/chainlords/server/Server /opt/chainlords/server/Chars /opt/chainlords/server/Config | head; du -sh /opt/chainlords/server/Chars /opt/chainlords/client'
```

Copy systemd units (same list as migrate §5). **Disable Hetzner hunters on dest:**

```bash
for u in chainlords-game.service chainlords-mining-report.service chainlords-mining-report.timer; do
  scp "${SSH_OPTS[@]}" -i "$SSH_KEY" "/etc/systemd/system/$u" "root@${NEW_IP}:/etc/systemd/system/$u" || true
done
# Do NOT enable on Vultr (they call hcloud create/resize/delete):
#   chainlords-upgrade-hunter.*  chainlords-autoscaler.*  chainlords-upgrade-probe.*
```

On dest after copy:

```bash
systemctl daemon-reload
systemctl disable --now chainlords-autoscaler.timer chainlords-upgrade-probe.timer chainlords-upgrade-hunter.timer 2>/dev/null || true
# Edit chainlords-game.service: same WALLET_AUTH_SECRET + DATABASE_URL as source
```

---

## 4. nginx + secrets on dest

Use repo installer ([`ops/nginx/install-chainlords-play.sh`](./nginx/install-chainlords-play.sh) + [`ops/nginx/chainlords-play.conf.template`](./nginx/chainlords-play.conf.template)). **`SERVER_IP` must be `NEW_IP`**, not `46.224.129.38`.

```bash
# On dest; template may live under /opt/chainlords/ops/nginx or /opt/chainlords/repo/ops/nginx after rsync
export CLIENT_ROOT=/opt/chainlords/client
export SERVER_IP="${NEW_IP}"   # not OLD_IP
export TEMPLATE=/opt/chainlords/ops/nginx/chainlords-play.conf.template
# if missing after rsync: /opt/chainlords/repo/ops/nginx/chainlords-play.conf.template
bash /opt/chainlords/ops/nginx/install-chainlords-play.sh
nginx -t && systemctl enable --now nginx && systemctl reload nginx
```

Do **not** `sed` leftover `178.105.251.138` from the old migrate script. If you copy a live `sites-enabled/chainlords-play` from fsn1, rewrite `server_name` / any hardcoded IP to **`play.chainlords.net` + `NEW_IP`**.

TLS: production play is typically **Cloudflare orange-cloud** to origin **:80**. Keep origin HTTP unless you already terminate TLS on fsn1 — then copy certs the same way (not invented here).

**Secrets:** copy `WALLET_AUTH_SECRET` and `DATABASE_URL` byte-for-byte from live `chainlords-game` (and `MARKET_*` if set). Missing `WALLET_AUTH_SECRET` fail-closes auth ([`docs/SECURITY-HARDENING-PRELAUNCH.md`](../docs/SECURITY-HARDENING-PRELAUNCH.md)).

```bash
chmod +x /opt/chainlords/server/Server
chown -R root:www-data /opt/chainlords/client || true
```

Optional loopback-only smoke **before** GO (then **stop** dest game again so dest does not accept public WS as a second world):

```bash
systemctl start chainlords-game
sleep 3
curl -sS -o /dev/null -w 'realm %{http_code}\n' http://127.0.0.1:1337/api/realm-stats
systemctl stop chainlords-game   # stay cold until GO
```

---

## 5. Firewall

Open what play actually uses. Game HTTP/WS is **proxied** via nginx; binding `:1337` on `127.0.0.1` is preferred (current migrate smoke greps `:1337` on the box — if live listens on `0.0.0.0:1337`, either keep that or bind loopback **and** only expose 80/443).

**ufw example (dest):**

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
# Only if game must be reached on NEW_IP:1337 (prefer nginx /ws and /api/ instead):
# ufw allow 1337/tcp
ufw --force enable
ufw status verbose
```

Mirror the same ports on the **Vultr firewall** group attached to the instance. Do **not** expose Postgres (`5432`) to `0.0.0.0`. Live compose pattern is `127.0.0.1:5432:5432`.

SSH: keep 22 (or your Vultr SSH port) from operator IPs if you restrict; do not lock yourself out before DNS GO.

---

## 6. GO window — freeze, final copy, start dest, DNS

Announce a short downtime. Split-brain = two games writing **`Chars/`** (and local Postgres).

### 6a. Freeze source game (nginx on fsn1 may stay up)

```bash
ssh -i "$SSH_KEY" "root@${OLD_IP}" 'systemctl stop chainlords-game'
# Do not poweroff/delete the CX53.
```

### 6b. Final rsync (same excludes as §3)

Run immediately after stop.

### 6c. Postgres dump/restore **only if local canonical DB**

Pattern from [`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh):

```bash
# On SOURCE after game stop:
DUMP=/tmp/helbreath-pg-migrate.sql.gz
docker exec helbreath-postgres pg_dump -U helbreath -d helbreath --clean --if-exists | gzip -c > "$DUMP"
scp -i "$SSH_KEY" "$DUMP" "root@${NEW_IP}:/tmp/helbreath-pg-migrate.sql.gz"
```

On dest: create `helbreath-postgres` **postgres:16-alpine** as in migrate §6 (`POSTGRES_USER/PASSWORD/DB=helbreath`, volume `helbreath_pg_data`, `-p 127.0.0.1:5432:5432`), wait `pg_isready`, then:

```bash
gunzip -c /tmp/helbreath-pg-migrate.sql.gz | docker exec -i helbreath-postgres \
  psql -U helbreath -d helbreath -v ON_ERROR_STOP=1
```

If Railway is canonical: **skip 6c**. Confirm dest `DATABASE_URL` still points at Railway.

### 6d. Start dest stack

```bash
systemctl daemon-reload
systemctl enable chainlords-game nginx
systemctl restart chainlords-game
systemctl reload nginx
systemctl is-active chainlords-game nginx
ss -tlnp | grep -E ':80|:1337|:5432' || true
```

### 6e. Smoke **by IP** (before DNS)

```bash
NEW_IP=   # fill
curl -sS -o /dev/null -w "dest_realm %{http_code}\n" --connect-timeout 5 "http://${NEW_IP}:1337/api/realm-stats" || true
curl -sS -o /dev/null -w "dest_http %{http_code}\n" --connect-timeout 5 \
  -H "Host: play.chainlords.net" "http://${NEW_IP}/" || true
curl -sS -H "Host: play.chainlords.net" "http://${NEW_IP}/api/realm-stats" | head -c 400; echo
curl -sS -H "Host: play.chainlords.net" "http://${NEW_IP}/api/arena/bleeding-online" | head -c 400; echo
# WS: HTTP GET often 400 on /ws (upgrade required) — that is OK; see hostname smoke after DNS
curl -sSI -H "Host: play.chainlords.net" "http://${NEW_IP}/ws" | head -n 15
```

Expect JSON for `/api/realm-stats` and `/api/arena/bleeding-online` (**not** SPA HTML). See [`docs/PRODUCTION-REPAIR-RUNBOOK.md`](../docs/PRODUCTION-REPAIR-RUNBOOK.md).

### 6f. DNS cutover (GO)

Cloudflare (or current DNS): **A** `play.chainlords.net` → **`NEW_IP`**.

- If **proxied** (orange): origin is `NEW_IP:80`; hostname tests use `https://play.chainlords.net`.
- If **grey**: wait TTL; curl `--resolve play.chainlords.net:443:${NEW_IP}` if needed.

**Keep fsn1:** powered on, **`chainlords-game` stopped**, nginx optional. Do **not** start game on both.

Landing HTML: **no change**. Hostname `play.chainlords.net` follows DNS.

---

## 7. Smoke after DNS (hostname)

```bash
curl -sS https://play.chainlords.net/api/realm-stats | head -c 400; echo
curl -sS https://play.chainlords.net/api/arena/bleeding-online | jq .
curl -sSI https://play.chainlords.net/api/arena/bleeding-online | grep -i content-type
# Expect application/json

# WS endpoint (upgrade): documented probe is GET → 400 while up
curl -sSI https://play.chainlords.net/ws | head -n 20

# Traveler
curl -sS -o /dev/null -w "index %{http_code}\n" https://play.chainlords.net/

# Middleware (unchanged host) — still Railway
curl -sS https://chainlords-middleware-production.up.railway.app/health | jq '.postgres,.postgresConfigured' || true
```

In-browser: wallet session (same `WALLET_AUTH_SECRET`), enter world, confirm char list from **`Chars/`** / Postgres.

On dest: `journalctl -u chainlords-game -n 80 --no-pager` — listening, no secret/DB crash.

Deploy helpers after GO (same as today, against **new** host): [`ops/deploy-finish.sh`](./deploy-finish.sh), [`ops/deploy-skills-teleport.sh`](./deploy-skills-teleport.sh), [`ops/deploy-stake-settle.sh`](./deploy-stake-settle.sh), [`ops/verify-deploy.sh`](./verify-deploy.sh) — they assume `/opt/chainlords` + `chainlords-game` on the machine you SSH into.

---

## 8. Rollback (fsn1 still warm)

Use if dest fails health/arena/ws or players cannot load chars.

1. **Stop** `chainlords-game` on Vultr (`NEW_IP`) — prevent dual-write.
2. DNS **A** `play.chainlords.net` → **`OLD_IP` (`46.224.129.38`)**.
3. **Start** `chainlords-game` on fsn1.
4. Smoke hostname against EU again (§7 URLs).
5. If GO had **local** Postgres restore on dest only, fsn1 DB is still the pre-GO dump **plus** any writes that happened on dest during the bad window — if dest was live with a **copied** local DB, you may need to dump dest and restore fsn1 **or** rsync `Chars/` back. Prefer **failing before DNS** so rollback is DNS + start only.
6. Leave Vultr instance in place until the next attempt (no requirement to destroy it in rollback).

---

## 9. After GO (not part of GO)

- [ ] fsn1 remains **warm** until a **separate** explicit decommission ticket.
- [ ] Do **not** run [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh).
- [ ] Point operator SSH docs / `AGENTS.md` live IP at `NEW_IP` in a later docs PR if desired.
- [ ] Hetzner autoscaler timers stay **off** on Vultr.
- [ ] Destroying CX53 is **out of scope** here.

---

## Ops script notes (adapt `migrate-to-cx53.sh`, do not paste-run)

There is **no** executable `ops/migrate-to-vultr-sao.sh` in this PR on purpose: the CX53 script **stops live game** and hardcodes a dest IP. Use this mapping when you write a dest-specific script **after** `NEW_IP` exists.

| [`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh) | Vultr São Paulo |
|---|---|
| `DEST_IP="${DEST_IP:-178.105.251.138}"` | **Forbidden default.** Require `DEST_IP`/`NEW_IP`; refuse empty. Never default to `178.105.251.138` or `46.224.129.38`. |
| `hostname == *cx53*` refuse | Refuse if `hostname` looks like live fsn1 / `*cx53*` **and** you meant dest. Refuse dest==`OLD_IP`. |
| §1 `hcloud` install | **Skip.** |
| §2 stop game on source **first** | **Move to GO only.** Warm rsync while source runs; stop immediately before final rsync/dump. |
| §3 `docker exec helbreath-postgres pg_dump` | **Gate** on §0. Skip if Railway is `DATABASE_URL`. |
| §4 rsync `/opt/chainlords` | Keep excludes; include `Chars/` + `Config/` + `Server`. |
| §5 copy all hunter/autoscaler units | Copy **`chainlords-game`** (+ mining timer if you still want reports). **Do not enable** hunter/autoscaler/probe. |
| §6 `sed` `46.224.129.38` → `178.105…` | Use [`ops/nginx/install-chainlords-play.sh`](./nginx/install-chainlords-play.sh) with `SERVER_IP=NEW_IP`. |
| §7 leave source game stopped | **Yes at GO.** Do **not** delete/poweroff source. |
| §8 “then delete old servers” | **Delete that sentence.** Keep fsn1 until explicit later GO. |

| [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh) | Vultr |
|---|---|
| `hcloud primary-ip` assign `IP_OLD_PLAY` (comment: `46.224.129.38`) onto CX53 | **N/A.** Cross-cloud. Cutover = DNS to `NEW_IP`. Running this script would take play IP off the only live box. |

| Deploy scripts | Vultr |
|---|---|
| [`ops/deploy-finish.sh`](./deploy-finish.sh), [`deploy-skills-teleport.sh`](./deploy-skills-teleport.sh), [`deploy-stake-settle.sh`](./deploy-stake-settle.sh) | After GO, run **on dest**. They `systemctl stop/start chainlords-game` and assume `Chars/` + local `psql` in finish/verify — if Railway-only, `psql` to `127.0.0.1` in [`ops/deploy-finish.sh`](./deploy-finish.sh) / [`ops/verify-deploy.sh`](./verify-deploy.sh) will fail; use `DATABASE_URL` instead. |
| [`ops/nginx/install-chainlords-play.sh`](./nginx/install-chainlords-play.sh) | `SERVER_IP=NEW_IP` (defaults to `hostname -I` first address if unset — verify that **is** `NEW_IP`). |
| [`multiplayer/ops/install-on-vps.sh`](../multiplayer/ops/install-on-vps.sh) | **Do not** run on Vultr as-is: enables Hetzner autoscaler + upgrade-probe. |

Suggested script header if you later add `ops/migrate-to-vultr-sao.sh`:

```bash
# DEST_IP must be set. OLD_IP is documented production and must stay up until GO.
OLD_IP="${OLD_IP:-46.224.129.38}"
DEST_IP="${DEST_IP:?set DEST_IP to Vultr NEW_IP — no default}"
if [[ "$DEST_IP" == "$OLD_IP" ]]; then echo "refusing DEST_IP=OLD_IP"; exit 1; fi
# never: hcloud server delete / poweroff of chainlords-cx53-fsn1
```

---

## GO checklist (print at freeze)

- [ ] Postgres path decided (§0)
- [ ] `NEW_IP` recorded; SSH works
- [ ] Warm rsync done; `Chars/` + `Config/` + `Server` present
- [ ] `WALLET_AUTH_SECRET` / `DATABASE_URL` on dest unit (not git examples)
- [ ] nginx `server_name` has `play.chainlords.net` + `NEW_IP`; `/api/` and `/ws` → `127.0.0.1:1337`
- [ ] ufw/Vultr firewall: SSH + 80/443; Postgres not public
- [ ] Hetzner autoscale timers **disabled** on dest
- [ ] fsn1 **not** scheduled for delete
- [ ] Freeze: stop game on `OLD_IP` → final rsync → (optional local pg restore) → start dest → IP smoke → DNS → hostname smoke
- [ ] Rollback plan: stop dest game, DNS back to `46.224.129.38`, start fsn1 game
