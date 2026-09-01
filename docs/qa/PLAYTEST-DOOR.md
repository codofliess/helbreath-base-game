# Playtest door (PLAYTEST=1) — not live

**Product this week:** a separate host/build so Elon can enter and kill a mob **without Phantom**.  
**Not** a skip on `https://play.chainlords.net`. **Not** the 11-tier loot table.

Live auth stays Phantom + SIWS. This door is a **different build** (`VITE_PLAYTEST=1`) talking to a **different game process** (`PLAYTEST=1`).

---

## Host status (this PR)

A public playtest URL was **not provisioned**.

- Railway MCP in this agent is **unavailable** (tool discovery error). Standing orders still forbid `railway up`.
- Live Hetzner / `play.chainlords.net` must **not** be used.
- No playtest domain is invented here.

**How to reach it (local isolated stack):** `http://127.0.0.1:8081/` after the commands below. That URL is loopback on the machine that runs the scripts — it is **not** a public host.

If someone later stands up a throwaway VM, they must publish **that** machine’s URL. Do not point DNS at live play.

---

## Hard rules

| Do | Do not |
|----|--------|
| `PLAYTEST=1` game + `pnpm playtest` / `pnpm build:playtest` | Deploy this build to `play.chainlords.net` |
| Character **`ElonQa`** on account `playtest-elonqa` | Use Boris / live wallets |
| Saves in `CharsPlaytest/` | Set `WALLET_AUTH_SECRET`, `DATABASE_URL`, `HELL_MINT` |
| Open **http://127.0.0.1:8081** | Set `VITE_GAME_HOST` to play / Hetzner IPs |

Public hostnames (`play.chainlords.net`, `*.chainlords.net`, live VPS IPs) **force playtest off** in the client even if `VITE_PLAYTEST=1` was baked in. The server **refuses to start** PLAYTEST=1 with live secrets/DB/mint.

---

## How to run (isolated, later)

From repo root:

```bash
chmod +x ops/run-playtest-door.sh
./ops/run-playtest-door.sh
```

Or two terminals:

**A — game**

```bash
cd multiplayer/server
unset DATABASE_URL WALLET_AUTH_SECRET HELL_MINT MARKET_MIDDLEWARE_URL SOLANA_RPC_URL
export PLAYTEST=1
export ASPNETCORE_ENVIRONMENT=Development
export HELL_TESTING_WEEK=0
export HELL_TESTING_WEEK_UNTIL=2020-01-01
dotnet run --no-launch-profile
```

Expect `[PLAYTEST] Isolated door ON` and bind **1337**.

**B — client**

```bash
cd multiplayer/mp-client
pnpm install
pnpm playtest
```

Browser: **http://127.0.0.1:8081/**  
Click **Enter as ElonQa** (or wait — hub auto-enters). No Phantom. First visit creates `ElonQa`; later visits load `CharsPlaytest/`. Traveler map: kill a mob.

Static bundle (still not live): `pnpm build:playtest` → `multiplayer/mp-client/dist-playtest/`. Serve that folder only next to a `PLAYTEST=1` server. Do not upload it as the production traveler.

---

## What this flag does

- Client: skip Phantom; isolated session `playtest-elonqa` / `playtest-bypass-token`.
- Server: accept **only** that account; force name `ElonQa`; traveler mode; `CharsPlaytest/`.
- Off: `$HELL` mining/claim, airdrop/testing-week credits, NFT drop ledger, EK screenshot upload, middleware / Railway URLs.

---

## Sanity

| Check | Expected |
|-------|----------|
| Address bar | `http://127.0.0.1:8081`, **not** play.chainlords.net |
| Character | `ElonQa` |
| Live play | Unchanged Phantom login |
| This agent | No public URL (no Railway/Hetzner creds for a separate host) |
