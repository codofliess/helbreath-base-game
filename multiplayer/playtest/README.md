# Playtest host (no Phantom / no wallet)

**Do not deploy this stack to `play.chainlords.net`.** Live production must keep wallet login. A wallet-skip on the live host would let anyone in.

This door is a **separate process and port** (and, in production-like setups, a **separate hostname**). Default `dotnet run` / `pnpm dev` are unchanged.

This repository’s stock server already authenticates with a client-supplied character name (no Phantom in this tree). Playtest mode still exists so:

1. Elon can enter as a **named test character** (`Elon`) without a Connect host/port form or any wallet UI.
2. A playtest **build** cannot be pointed at live: the client refuses if the page host is `play.chainlords.net`, and the server refuses to start if playtest env is on and a public hostname matches that host.
3. The playtest server accepts **only** that test character / network id, so it is not a general open login door.
4. There is no wallet connect, `$HELL`, airdrop, or mint surface in this client; playtest builds do not add one.

## Test character

| Field | Value |
|--------|--------|
| Character name | `Elon` |
| Server network id (save file) | `playtest-elon` → `Chars/playtest-elon.json` |
| Default playtest client | http://localhost:8081 |
| Default playtest WebSocket | `localhost:1338` |

Override with `PLAYTEST_CHARACTER_NAME` / `VITE_PLAYTEST_CHARACTER_NAME` and matching `PLAYTEST_NETWORK_ID` / `VITE_PLAYTEST_NETWORK_ID` on **both** sides.

Each playtest server start **deletes** that save (unless `PLAYTEST_RESET_CHARACTER=0`) so Elon gets a clean avatar: maps, magics, freeze, and weapon damage from a fresh spawn.

## Run locally (separate ports from a normal session)

You need **two terminals**. Do **not** set `PLAYTEST=1` on the process that serves live.

**1. Playtest game server** (from `multiplayer/server`):

```bash
PLAYTEST=1 PLAYTEST_LISTEN_PORT=1338 PLAYTEST_RESET_CHARACTER=1 dotnet run
```

**2. Playtest client** (from `multiplayer/mp-client`):

```bash
pnpm install
pnpm run dev:playtest
```

Open **http://localhost:8081**, click **Enter as Elon**. Production-style Connect (arbitrary name + host + port `1337`) is what `pnpm dev` still does.

## Docker Compose overlay (separate host)

From `multiplayer/playtest`:

```bash
docker compose -f docker-compose.yml up --build
```

Publishes client **8081** and WebSocket **1338**. Set `VITE_PLAYTEST_WS_HOST` to the **browser-reachable** hostname of this machine (not `play.chainlords.net`). Example:

```bash
VITE_PLAYTEST_WS_HOST=playtest.example.com docker compose -f docker-compose.yml up --build
```

If you ship a static playtest client elsewhere:

```bash
cd multiplayer/mp-client
VITE_PLAYTEST=true VITE_PLAYTEST_WS_HOST=playtest.example.com VITE_PLAYTEST_WS_PORT=1338 pnpm run build:playtest
```

Serve `dist/` on the playtest host only. The game server still needs `PLAYTEST=1` on that same (or paired) host.

## What must stay off live

- Do not set `PLAYTEST=1` in the live server environment.
- Do not build the live Cloudflare/static client with `VITE_PLAYTEST=true`.
- Do not put this compose file, its ports, or its env behind the `play.chainlords.net` vhost.
