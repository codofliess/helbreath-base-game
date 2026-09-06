# Hybrid LatAm arena shard: keep CX53 world + add Vultr São Paulo arena

**Status:** runbook only. This file does **not** provision, spend, or cut over. Do **not** destroy, power off, or DNS-steal live EU (`OLD_IP`).

**Working plan (Martín, hybrid cut):** keep Hetzner CX53 fsn1 as **world**; add Vultr São Paulo **4 vCPU / 8 GB (~US$40/mo)** as **arena-only**. Incremental cost ~**$40**. **Pending Elon one-world confirm** — do **not** treat “replace CX53 with SP 8/32” as the default. That lift-and-shift is **deferred / appendix only**.

| | |
|---|---|
| **World (keep live)** | Hetzner **CX53** `chainlords-cx53-fsn1` (fsn1) · **~8 vCPU / 32 GB** · IPv4 **`OLD_IP=46.224.129.38`** · `play.chainlords.net` · cities / farms / heavy player maps · **stays warm and serving** |
| **Arena (add)** | Vultr **Cloud Compute Regular** · region **`sao`** · **4 vCPU / 8 GB** (~**US$40/mo**) · IPv4 **`ARENA_IP`** (placeholder — fill after create) · HvH / BvB / ping-sensitive LatAm |
| Identity / loot | **Same `playerId`**. Shared **middleware + Postgres SoT**. **Handoff into arena** — **not two inventories** |
| Client | **Separate arena endpoint** vs **world endpoint** (today the traveler defaults same-origin `/ws` on `play.chainlords.net` — hybrid needs an explicit arena WS/API host) |
| Repo / branch | `codofliess/helbreath-base-game` · **`consolidacion`** |
| Hard rule | **No** `hcloud server delete` / no [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh). **Do not** point `play.chainlords.net` A at São Paulo. Rollback = **shut SP arenas**, world unchanged. |

**Placeholders (do not invent addresses):**

| Token | Meaning |
|---|---|
| `OLD_IP` | `46.224.129.38` (documented production **world** IPv4) |
| `ARENA_IP` | Vultr São Paulo public IPv4 — fill **after** provision; never guess |
| `ARENA_HOST` | Public hostname for the arena shard (example shape `arena.chainlords.net` — **confirm in DNS**; do not invent the record). Not `play.chainlords.net`. |
| `SSH_KEY` | Operator key (live docs: `~/.ssh/hetzner_chainlords` → `root@OLD_IP`). Same pubkey on Vultr at create. |

Vultr cannot inherit Hetzner primary IP `46.224.129.38`. World DNS stays on `OLD_IP`. Arena is a **second origin**.

---

## Product shape

```
  Client
    ├─ world WS/API  →  play.chainlords.net  →  CX53 fsn1  (cities, farms, ML, …)
    └─ arena WS/API  →  ARENA_HOST           →  Vultr sao  (fightzone* / colosseum / HvH BvB)

  Both game processes
    └─ same WALLET_AUTH_SECRET
    └─ same DATABASE_URL  →  shared Postgres (SoT) + Railway middleware
```

| Surface | Host | Maps / load |
|---|---|---|
| World / traveler | CX53 `OLD_IP` | Aresden, Elvine, farms, Middleland, hunt zones, traveler hub, JSON `Chars/` that world still writes |
| Arena shard | Vultr `ARENA_IP` | Arena allowlist only (`fightzone*`, `colosseum`, pact/tourney maps — see [`docs/ARENA-CPP-CLIENT-FORK.md`](../docs/ARENA-CPP-CLIENT-FORK.md) §3). **No** city/farm sim on this box. |
| Middleware | Railway | Wallet challenge, session HMAC, leaderboards — **unchanged host** |
| Postgres | Railway plugin and/or the **one** canonical URL already on live `chainlords-game` | **Single SoT.** SP must **not** get its own `helbreath-postgres` with a copied dump as a second character DB. |

**Handoff (required product rule):** enter arena with the **same `playerId`**. Loadout/bag is the **one** persistence row (Postgres), not a second `Chars/*.json` tree on SP. Arena kits that are already sealed vs world bag (see social arena-kit docs) stay a **mode** on that player, not a second account.

**Not implemented as two processes today.** Live is **one** `chainlords-game` on fsn1 that serves world **and** `/api/arena/*` + `/ws`. Hybrid GO needs: arena process **map allowlist**, client **arena endpoint**, and persistence that does not dual-write JSON bags. Track those as code/config follow-ups; this runbook does not ship them.

---

## Why this is not CX43→CX53 and not “move play to Brazil”

[`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh) + [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh):

- Stopped **source** game, dumped Postgres, rsynced `/opt/chainlords`, **moved the play IPv4**.
- That made **one** world. Hybrid is **two** game processes by design.

Do **not**:

- Stop `chainlords-game` on fsn1 for this cut.
- `pg_dump` live into a **new** local Docker on SP (split-brain inventories).
- Change `play.chainlords.net` A → `ARENA_IP`.
- Enable Hetzner autoscaler / upgrade-hunter on Vultr.

Do:

- Copy **binaries + Config** (and nginx pattern) to SP.
- Point SP at the **same** `WALLET_AUTH_SECRET` and **same** `DATABASE_URL` as world + middleware.
- Serve arena on `ARENA_HOST`.
- Leave fsn1 **warm and in World**.

---

## Sizing (do not provision in this workstream)

Incremental cost target: **~$40/mo** on top of existing CX53 (CX53 bill unchanged).

| SKU | ~list | Role in **this** plan |
|---|---|---|
| **Vultr sao Regular 4 vCPU / 8 GB** | **~US$40/mo** | **Working default.** Arena-only shard (HvH/BvB, LatAm ping). Not a world host. |
| Hetzner CX53 fsn1 ~8 vCPU / 32 GB | existing | **Keep.** World / cities / heavy maps. |
| Vultr sao 6/16 (~$80) or 8/32 (~$160) | higher | **Not the hybrid default.** Only if arena concurrency outgrows 4/8 **or** Elon later confirms a **one-world** move (see appendix). |

Martín’s earlier “stronger than $40 for ~150 **world** players” applied to a **full** Brazil world host. Hybrid parks that load on CX53; SP is arena concurrency, not 150 city-sim.

Confirm exact Regular plan/SSD in the Vultr console at create time (do not invent disk GB).

---

## Architecture (what lives where)

Documented production split ([`docs/PRODUCTION-REPAIR-RUNBOOK.md`](../docs/PRODUCTION-REPAIR-RUNBOOK.md)) **plus** the hybrid add:

| Piece | Where today | Hybrid |
|---|---|---|
| `play.chainlords.net` nginx + traveler + **world** `:1337` | Hetzner `OLD_IP` | **Stay** |
| Arena WS/API | Same process as world | **Add** on Vultr `ARENA_HOST` → local `:1337` |
| JSON `Chars/` on disk | `/opt/chainlords/server/Chars` on fsn1 | **World continues here.** SP must not become a second bag SoT. Prefer Postgres for cross-shard character state. |
| `Config/` | fsn1 | Copy to SP; SP config **restricts maps to arena allowlist** |
| Docker `helbreath-postgres` on VPS | Documented on fsn1 (2026-07-26) | **Stay on fsn1 if still canonical.** Do **not** clone it to SP. If live `DATABASE_URL` is already Railway public TCP, **both** world and arena use that URL. |
| Railway middleware + Postgres plugin | Railway | **Stay — shared** |
| Railway landing | `chainlords.net` | **Stay.** No landing HTML in this workstream. Landing may later link **Play World** vs **Play Arena** (separate PR). |

Secrets (never commit; copy from **live** `chainlords-game`, not git examples):

- `WALLET_AUTH_SECRET` — **identical** on world, arena, and middleware (HMAC sessions / `playerId`).
- `DATABASE_URL` — **identical** SoT URL on world and arena.
- `MARKET_SYNC_SECRET` / `MARKET_MIDDLEWARE_URL` if present — same values so market/auth do not fork.

Mismatched secrets = one shard accepts tokens the other rejects, or a silent second economy.

---

## Cutover order (hybrid — world never freeze)

Do these in this order. Expand checklists below.

0. **Confirm SoT:** live `DATABASE_URL` is the shared Postgres both shards will use. If only local Docker on fsn1 exists, **do not** GO until Railway public URL (or equivalent reachable SoT) is on **both** units — SP cannot safely own a copied local DB.
1. **Client/server follow-up ready (or flagged):** arena endpoint vs world endpoint; arena map allowlist; handoff same `playerId` / one inventory. If code is not ready, provision may wait; this PR still does **not** spend.
2. **Provision** Vultr `sao` Regular **4 vCPU / 8 GB** (operator later; this PR does not spend). Record **`ARENA_IP`**. SSH keys at create.
3. **Bootstrap** dest: packages, Docker (optional; not for a second Postgres), nginx, ufw. **No** Hetzner CLI. **No** public arena traffic yet.
4. **Rsync binaries + Config** (and a **staging** client if you serve traveler from `ARENA_HOST`). **Do not** `--delete` live `Chars/` onto SP as SoT. **Do not** stop fsn1 game.
5. **Install** systemd `chainlords-game` on SP; **disable** Hetzner hunters. Same secrets. nginx `server_name` = **`ARENA_HOST` + `ARENA_IP`** (not `play.chainlords.net` as the world vhost).
6. **DNS add** (not replace): A/AAAA **`ARENA_HOST` → `ARENA_IP`**. **`play.chainlords.net` stays `OLD_IP`.**
7. Smoke **arena** by IP then by `ARENA_HOST` (`/api/arena/bleeding-online`, `/ws`). Smoke **world** still on `play.chainlords.net` (unchanged).
8. **GO arena:** point client arena endpoint at `ARENA_HOST`. World endpoint unchanged. fsn1 stays **up**.
9. **Rollback:** stop/disable SP `chainlords-game` (and/or remove `ARENA_HOST` DNS). Clients fall back to world-only. **Do not** touch CX53 except to confirm it never stopped.

---

## 0. Shared Postgres SoT (do this first — do not stop world)

```bash
# OLD_IP=46.224.129.38
ssh -i "$SSH_KEY" "root@${OLD_IP}" 'bash -s' <<'REMOTE'
echo "=== DATABASE_URL on game unit (redact password when pasting logs) ==="
systemctl cat chainlords-game | grep -E 'Environment|EnvironmentFile' || true
echo "=== local docker postgres? ==="
docker ps -a --format '{{.Names}} {{.Status}}' | grep -i postgres || true
docker exec helbreath-postgres pg_isready -U helbreath -d helbreath 2>/dev/null || echo "no local helbreath-postgres ready"
REMOTE
```

| Observation | Hybrid action |
|---|---|
| `DATABASE_URL` is Railway **public** TCP | **Good.** Copy the **same** URL to SP arena unit. Do not `pg_dump` Railway into SP Docker. |
| `DATABASE_URL` is only `127.0.0.1` on fsn1 | **Blocker for dual-shard.** Exposing fsn1 `:5432` to the internet is a last resort. Prefer Railway `DATABASE_PUBLIC_URL` (or a private tunnel) as the **one** SoT **before** arena GO. |
| Copied local Docker on SP | **Forbidden** as character SoT — that is two inventories. |

Middleware Postgres stays on Railway ([`docs/PRODUCTION-REPAIR-RUNBOOK.md`](../docs/PRODUCTION-REPAIR-RUNBOOK.md)). Game and middleware should share the **same** logical player rows.

---

## 1. Provision Vultr São Paulo arena box (operator — not this PR)

Create **after** SoT + endpoint work is agreed. Record values; do not commit secrets or invent IPs.

- [ ] Region: **São Paulo (`sao`)**
- [ ] Plan: Cloud Compute **Regular 4 vCPU / 8 GB (~US$40/mo)** — **arena-only**. Do **not** create 8/32 as the hybrid default.
- [ ] OS: Ubuntu LTS matching world (`lsb_release -a` on `OLD_IP`)
- [ ] **SSH keys** at create (same pubkey as fsn1)
- [ ] Hostname e.g. `chainlords-arena-sao` (cosmetic)
- [ ] Firewall: see §5
- [ ] Write down **`ARENA_IP`**. Confirm: `ssh -i "$SSH_KEY" "root@${ARENA_IP}" hostname`
- [ ] **Do not** create the instance from this PR.

No `hcloud` on dest. Do not run [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh).

---

## 2. Bootstrap dest

Same packages as [`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh) §1, **minus** Hetzner CLI. **No** requirement to run Postgres Docker on SP.

**.NET:** production binary is **self-contained linux-x64** ([`docs/SESSION-HANDOFF-2026-07-26.md`](../docs/SESSION-HANDOFF-2026-07-26.md)). Rsync `Server` + runtime; do not publish `--self-contained false`.

```bash
# DEST: ARENA_IP (fill in)
ssh -i "$SSH_KEY" "root@${ARENA_IP}" 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx rsync curl jq ca-certificates gnupg lsb-release ufw
mkdir -p /opt/chainlords
echo bootstrap_ok
REMOTE
```

---

## 3. Copy binaries (fsn1 **stays up** — no world freeze)

Copy **server binary + Config + ops + nginx**. Do **not** mirror live `Chars/` as the SP SoT (`--exclude 'server/Chars/'` unless you need empty dir scaffolding).

```bash
OLD_IP=46.224.129.38
ARENA_IP=   # fill
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=20)
RSYNC_SSH="ssh ${SSH_OPTS[*]} -i ${SSH_KEY}"

rsync -aH \
  --exclude 'client-staging-new/' \
  --exclude 'server/**/*.pdb' \
  --exclude 'server/publish-linux*/' \
  --exclude 'server/_build_check_out/' \
  --exclude 'server/Chars/' \
  -e "$RSYNC_SSH" \
  /opt/chainlords/ "root@${ARENA_IP}:/opt/chainlords/"
```

On SP: arena **map allowlist** in Config (reject city/farm worlds). Copy `chainlords-game.service` only; **disable** hunter/autoscaler/probe.

```bash
systemctl daemon-reload
systemctl disable --now chainlords-autoscaler.timer chainlords-upgrade-probe.timer chainlords-upgrade-hunter.timer 2>/dev/null || true
# Environment=: same WALLET_AUTH_SECRET + DATABASE_URL as fsn1 (SoT)
```

---

## 4. nginx + secrets on SP (arena vhost)

Use [`ops/nginx/install-chainlords-play.sh`](./nginx/install-chainlords-play.sh) + [`ops/nginx/chainlords-play.conf.template`](./nginx/chainlords-play.conf.template), but **`server_name` must be `ARENA_HOST` + `ARENA_IP`**, not world play.

```bash
export CLIENT_ROOT=/opt/chainlords/client   # optional static; arena clients may be C++ / same traveler with other WS host
export SERVER_IP="${ARENA_IP}"
export TEMPLATE=/opt/chainlords/ops/nginx/chainlords-play.conf.template
bash /opt/chainlords/ops/nginx/install-chainlords-play.sh
# Then edit server_name: ARENA_HOST ARENA_IP _   — never steal play.chainlords.net
nginx -t && systemctl enable --now nginx && systemctl reload nginx
```

TLS: new hostname, likely Cloudflare orange → origin `:80` (same pattern as play). Do not invent certs.

```bash
chmod +x /opt/chainlords/server/Server
```

Loopback smoke **without** advertising `ARENA_HOST` until DNS + allowlist are ready.

---

## 5. Firewall (arena box)

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Do **not** expose Postgres on SP (there should be no public `:5432`). Prefer game bound `127.0.0.1:1337` behind nginx `/ws` and `/api/`. Mirror ports on the Vultr firewall group.

World fsn1 firewall **unchanged**.

---

## 6. GO window — add arena DNS, keep world DNS

**No** stop of `chainlords-game` on `OLD_IP`.

### 6a. DNS **add**

- `play.chainlords.net` **A remains `46.224.129.38`**
- `ARENA_HOST` **A → `ARENA_IP`** (proxied or grey — record what you set)

### 6b. Start SP arena process

```bash
systemctl enable chainlords-game nginx
systemctl restart chainlords-game
systemctl reload nginx
systemctl is-active chainlords-game nginx
```

### 6c. Smoke arena by IP (Host header = `ARENA_HOST`)

```bash
ARENA_IP=   # fill
ARENA_HOST= # fill — do not invent
curl -sS -H "Host: ${ARENA_HOST}" "http://${ARENA_IP}/api/arena/bleeding-online" | head -c 400; echo
curl -sSI -H "Host: ${ARENA_HOST}" "http://${ARENA_IP}/ws" | head -n 15
```

Expect JSON for `/api/arena/*`, not SPA HTML ([`docs/PRODUCTION-REPAIR-RUNBOOK.md`](../docs/PRODUCTION-REPAIR-RUNBOOK.md)).

### 6d. Smoke **world unchanged**

```bash
curl -sS https://play.chainlords.net/api/realm-stats | head -c 200; echo
curl -sS https://play.chainlords.net/api/arena/bleeding-online | head -c 200; echo
# World /api/arena/* may still exist on fsn1 until clients switch; hybrid GO is client endpoint split, not deleting EU arena routes overnight.
```

### 6e. Client GO

Point **arena** WS/API at `ARENA_HOST` (new env or connect field). Keep **world** on `play.chainlords.net`. Same wallet token (`WALLET_AUTH_SECRET`). Confirm **one** bag after arena match (Postgres), not a SP-only JSON file.

---

## 7. Dual-deploy, secrets, auth, nginx (risks)

| Risk | Why it hurts | Mitigation |
|---|---|---|
| **Dual deploy** | Two `chainlords-game` binaries drift (combat, proto, allowlists) | Same `consolidacion` artifact on both; deploy world and arena in one change window; version-check `/api` or logs |
| **Secrets** | Different `WALLET_AUTH_SECRET` / `MARKET_*` | Copy from live unit; never git `.env.example` |
| **Auth / `playerId`** | Token works on one shard only; or bind-before-world fails on arena | Same secret; same middleware; session claims include `playerId` ([`WalletAuthValidator`](../multiplayer/server/Auth/WalletAuthValidator.cs)) |
| **Two inventories** | SP `Chars/` or a cloned Postgres | Shared `DATABASE_URL`; exclude live `Chars/` rsync as SoT; no `pg_dump` clone |
| **nginx** | `/api/` falls through to SPA; or `play.chainlords.net` accidentally served from SP | Arena vhost = `ARENA_HOST` only; `location /api/` and `/ws` → `127.0.0.1:1337` |
| **Split-brain world** | Both processes simulate cities | SP **map allowlist** — reject Aresden/Elvine/farms |
| **Hetzner hunters on SP** | `hcloud` create/destroy EU | Disable autoscaler / upgrade-probe / hunter timers |
| **`ip-swap-to-cx53.sh`** | Unassigns play IP from live world | **Never** run for this cut |
| **One-world later** | Elon confirms single Brazil world | Separate decision; see appendix — not this GO |

---

## 8. Rollback = shut SP arenas (world stays)

1. **Stop** `chainlords-game` on Vultr (`ARENA_IP`). Optionally disable nginx arena vhost / remove `ARENA_HOST` DNS.
2. Client arena endpoint **off** (world-only). Do **not** DNS `play.chainlords.net` anywhere.
3. Confirm fsn1 still `active` and `https://play.chainlords.net/api/realm-stats` JSON.
4. Leave the Vultr VM in place or destroy later — **optional**; rollback does **not** require destroying SP, only shutting the arena process/DNS.
5. No Postgres restore on fsn1: world never froze and was not replaced.

---

## 9. After GO

- [ ] CX53 fsn1 **warm**, still world.
- [ ] Incremental bill ~**$40** (SP 4/8), CX53 unchanged.
- [ ] Dual deploy checklist on every game binary push (fsn1 **and** SP).
- [ ] Do **not** run [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh).
- [ ] Destroying CX53 is **out of scope** (and against this plan).

---

## Ops script notes (`migrate-to-cx53.sh` is the wrong shape)

Do **not** paste-run [`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh): it **stops live world**, dumps Postgres, and implies deleting the old host.

| [`ops/migrate-to-cx53.sh`](./migrate-to-cx53.sh) | Hybrid arena add |
|---|---|
| `DEST_IP` default `178.105.251.138` | **Forbidden.** Require `ARENA_IP`; never default to `OLD_IP`. |
| §2 stop game on source | **Do not.** World stays up. |
| §3 `pg_dump` → dest Docker | **Do not** as character SoT. Shared `DATABASE_URL` only. |
| §4 rsync whole `/opt/chainlords` `--delete` | Copy binary/`Config`; **exclude** live `Chars/` SoT. |
| §6 rewrite nginx to dest **play** IP | Arena vhost `ARENA_HOST`; **do not** take over `play.chainlords.net`. |
| §7 source game left stopped | **Opposite:** source game **stays running**. |
| §8 delete old servers | **Forbidden.** |

| [`ops/ip-swap-to-cx53.sh`](./ip-swap-to-cx53.sh) | Hybrid |
|---|---|
| Move `46.224.129.38` onto another Hetzner VM | **N/A.** World IP stays on CX53. |

| Deploy scripts | Hybrid |
|---|---|
| [`ops/deploy-finish.sh`](./deploy-finish.sh) etc. | After GO, run **per host** (world **and** arena) when shipping game bits. `psql` to `127.0.0.1` on SP will fail if SoT is Railway — use `DATABASE_URL`. |
| [`ops/nginx/install-chainlords-play.sh`](./nginx/install-chainlords-play.sh) | `SERVER_IP=ARENA_IP`; then **fix `server_name`** to `ARENA_HOST`. |
| [`multiplayer/ops/install-on-vps.sh`](../multiplayer/ops/install-on-vps.sh) | **Do not** run on Vultr (enables Hetzner autoscale). |

Suggested header if you later add a **non-destructive** `ops/add-vultr-arena-sao.sh`:

```bash
OLD_IP="${OLD_IP:-46.224.129.38}"
ARENA_IP="${ARENA_IP:?set ARENA_IP — no default}"
if [[ "$ARENA_IP" == "$OLD_IP" ]]; then echo "refusing ARENA_IP=OLD_IP"; exit 1; fi
# never: systemctl stop chainlords-game on OLD_IP
# never: hcloud server delete / ip-swap-to-cx53.sh
# never: play.chainlords.net A → ARENA_IP
```

---

## GO checklist (print at arena enable)

- [ ] Elon one-world **not** assumed; hybrid is the working plan
- [ ] Shared `DATABASE_URL` reachable from SP (not a cloned local PG)
- [ ] Same `WALLET_AUTH_SECRET` on world, arena, middleware
- [ ] Client has **arena endpoint** vs **world endpoint**
- [ ] SP map allowlist = arena only (no cities)
- [ ] Handoff = same `playerId` / one inventory (no SP `Chars/` SoT)
- [ ] `ARENA_IP` recorded; SSH works; SKU **4 vCPU / 8 GB**
- [ ] nginx `ARENA_HOST` + `/api/` + `/ws` → `:1337`
- [ ] `play.chainlords.net` still `46.224.129.38`
- [ ] Hetzner autoscale timers **off** on SP
- [ ] fsn1 **not** stopped, **not** scheduled for delete
- [ ] Smoke arena `ARENA_HOST` + smoke world `play.chainlords.net`
- [ ] Rollback = **shut SP arenas** (stop dest game / drop `ARENA_HOST`); world stays

---

## Appendix — deferred one-world lift (not the working plan)

If Elon later **confirms one-world** (all maps in Brazil, no EU world process):

- That is a **new** GO: freeze world, rsync including `Chars/`, DNS `play.chainlords.net` → new IP, stop dual-write.
- SKU discussion from earlier drafts: SP **8 vCPU / 32 GB (~US$160/mo)** as CX53 parity for ~150 **world** players; 6/16 minimum comfortable; 4/8 only if &lt;50 online **and** hosting world (not this hybrid).
- **Until that confirm:** do **not** size or DNS as if CX53 were being replaced. Hybrid + **$40** arena box is the plan.
