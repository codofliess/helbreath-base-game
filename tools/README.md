# Utility Tools

Build and asset conversion utilities for the game client.

## Setup

```bash
pnpm install
```

**Audio tools** require [ffmpeg](https://ffmpeg.org/download.html) installed on your system.

---

## Scripts

### client-simulator.ts

Load-testing harness that opens many WebSocket clients against the multiplayer game server, issues movement and ping traffic, and writes an HTML report (`report_<unix>.html`) in the current working directory when the run ends (Ctrl+C, SIGTERM, first disconnect, or startup failure).

**Prerequisites:** Game server reachable at the configured host/port (defaults: `localhost:1337`). Map assets are read from `multiplayer/mp-client/public/assets/maps/`.

**Setup:** Install tool dependencies (includes `grpc-tools`, `ts-proto`, `tsx`, and `@bufbuild/protobuf`):

```bash
cd tools && pnpm install
```

**Run** (from `tools/`; `proto:generate` runs first and writes TypeScript stubs into `multiplayer/mp-client/src/proto/generated`, matching the mp-client package):

```bash
pnpm run client-simulator
pnpm run client-simulator -- --clients=50 --port=1337
pnpm exec tsx client-simulator.ts --ip=127.0.0.1 --minInterval=500 --maxInterval=1000
```

Optional flags: `--ip`, `--port`, `--clients`, `--rampUpTime` (seconds), `--minInterval` / `--maxInterval` (ms between movement attempts; minimum allowed interval is 220 ms).

### Rules bot (local PLAYTEST only)

One mage (or melee) client plays with a fixed rules loop: nearest slime, walk to it, cast Fire Strike or melee, drink an HP potion when health is low, return to town when health is critical or when health is low and no potions remain, then hunt again. Delays between actions are 250–900 ms. There are no LLM calls.

Cruchi's conditions, in the code that applies them:

(a) The bot may use everything the server sends via protocol to any client, including monster positions and HP, plus the client map file the simulator already loads for pathing. Internal state a client does not receive stays forbidden. Startup fails closed for `--server-log`, `--server-state`, `--database`, `--admin`, `--memory`, `--telemetry`, and the same family.

(b) Local only, no wallet. Auth is the PLAYTEST door: token `playtest-bypass-token`, seat `elon` → character `ElonQa`. The bot tries account `playtest-elonqa` and then `playtest-a` if the first login does not enter. It refuses to open a socket unless the host is localhost / 127.0.0.1 / ::1, or a private-LAN address passed with `--playtest`. `play.chainlords.net` and other public hosts are refused.

(c) Every bot is marked `actorKind: bot` (`middleware-node/auth.js` `/auth/enroll-bot`, and a local PLAYTEST seat when wallet auth is off). Bots are excluded from rankings, airdrops, economy, and transferable loot (`BotActor` on the game server).

(d) The wallet-less login exists only locally (PLAYTEST). Live still requires a wallet (`WalletAuthValidator.cs`, PR #33). A bot claim does not skip that check.

(e) Server logs are only for post-run evaluation (`player-bot-eval.ts`). That file is not imported by the bot, it is not inside the decision loop, and its result is never fed back into the bot.

The bot imports protobuf from `multiplayer/mp-client`. Install those stubs before the first run (the `ws` / wire package scripts are not required):

```bash
cd multiplayer/mp-client && npm ci --ignore-scripts
```

Node 22+ has a global `WebSocket`. Node 20 does not, unless you start it with `NODE_OPTIONS=--experimental-websocket`. The simulator also loads the `ws` package when the global is missing.

Start the local server with `PLAYTEST=1`. That flag binds `127.0.0.1` (not `0.0.0.0`). Wallet-less login is allowed when `PLAYTEST=1` and the process is not production and has no live secrets. `ASPNETCORE_ENVIRONMENT=Development` is the other local door for the same login. Either one is enough. A set `WALLET_AUTH_SECRET` still requires a wallet, including for a bot, and `PLAYTEST=1` refuses to start when that secret (or `DATABASE_URL`, `HELL_MINT`, `MARKET_MIDDLEWARE_URL`, `SOLANA_RPC_URL`) is set. `PLAYTEST` does not open the GM sandbox, so a new seat stays a traveler. Run the built DLL directly so a launch profile cannot inject those secrets.

The listen port is `PORT` when that variable is set (1–65535). Otherwise it is the port in `multiplayer/server/Config/Settings.json` (1337). You do not edit `Settings.json` when 1337 is taken. Pass the same port to the bot with `--port`.

A fresh seat is level 1 on the `traveler` world at the inland hub (90, 80), not Aresden. The bot walks to the southeast slime field on that map. The cast bar is `castSpeedMs` from the join snapshot, which is the duration the server enforces for that character (1800 ms when magic is low). A rejected finish lengthens a shorter bar to that slow cast and tries once more. A rejection at the slow bar switches the mage to melee so a level-1 seat can still kill slimes, then tries the same spell again after 6 swings or 8 seconds. While it is swinging with empty hands, it equips a usable dagger from the bag. The server's too-quick check is unchanged. A mage with no Fire Strike in the spell list melees instead of waiting. Potions are used only after HP actually drops.

The mage picks a spell with fixed rules, from spells the server actually sent. Shield, then Heal, when HP has dropped. Defense Shield also goes up when a strong mob is close or another player is in view. Control is not "three mobs nearby". A group within 2 cells is Blizzard (or Paralyze when Blizzard's mana is short) only when the mobs that survive one swing total at least 40 max HP or 8 attack damage on the enter packets. The seat's own attack damage comes from `InitialState`. A traveler is 8, and a slime packet is max HP 7, so a slime pack is not controlled. One strong mob (packet max HP at least 40, or attack damage at least 8) is Paralyze. After 3 Paralyze or Blizzard fizzles in a row the mage goes back to damage until that danger is gone. Another player, and the seat is not already invisible: Invisibility, then walk away without attacking, because monster chase skips an invisible player. Running is left as the server set it. `RunningMode` only doubles the tile time. Chase range does not read it, so there is no "walk so you are not heard" action. Fire Strike is the base attack. The client casts Spells.json id 2. The PLAYTEST grant is Olympia Magic.cfg id 30, and `MagicTower` maps 30 to 2. A fizzle melees, then tries that same spell again after 6 swings or 8 seconds. Olympia id 11 Staminar-Drain is in Magic.cfg and is not in the server spell map, so it is not granted and not cast. The PLAYTEST kit grants item 164 (Big Red Potion) plus Fire Strike, Heal, Defense Shield, Paralyze, Blizzard, and Invisibility.

`player-bot-eval.ts` prints a per-spell table from the JSONL lines (attempts, accepted, rejected, fizzled, and the reason on each cast). A spell the run never cast is absent from that table.

```bash
# from multiplayer/server, after building the DLL
PORT=1340 PLAYTEST=1 ASPNETCORE_ENVIRONMENT=Development dotnet bin/Release/net10.0/Server.dll

# from tools. --port must match PORT. Development is optional when PLAYTEST=1 is already set.
pnpm exec tsx client-simulator.ts --class mage --minutes 30 --host 127.0.0.1 --port 1340 --seat elon --log ./player-bot.jsonl
```

The JSONL log records kills, deaths, disconnects, potions, casts, and timestamps. The last line is a summary. **PASS** = at least 30 slime kills and 0 disconnects. **FAIL** = under 10 slime kills (treated as a game/network problem). Score it after the run:

```bash
pnpm exec tsx player-bot-eval.ts --log ./player-bot.jsonl
pnpm exec tsx player-bot-eval.ts --log ./player-bot.jsonl --server-log /path/to/local-server.log
```

To regenerate protos only:

```bash
pnpm run proto:generate
```

---

### compress-assets.js

Bundles game assets into a ZIP archive for loading. Reads `Assets.ts`, `Monsters.ts`, `Effects.ts`, `NPCs.ts`, and `Items.ts` from the client to discover assets, then compresses them into `sp-client/public/assets.zip`.

```bash
node compress-assets.js [--ratio=N] [--output=path]
```

- `--ratio=N` — Compression level 0–9 (default: 1). Level 1 is recommended.
- `--output=path` — Output path relative to `sp-client/` (default: `public/assets.zip`)

Or from the client: `pnpm run compress-assets`

---

### wav-to-mp3.js

Converts WAV files to MP3 using fluent-ffmpeg. Keeps original WAV files. Supports single files or recursive directory conversion.

```bash
node wav-to-mp3.js <path> [--sample-rate <kHz>] [--bitrate <kbps>] [--channels <n>]
```

Defaults: 44.1 kHz, 192 kbps, 2 channels. Output files are written next to the source with `.mp3` extension.

---

### sound-to-mp3.sh

Shell script that converts WAV to MP3 for game sounds. Uses fixed settings (22050 Hz, mono, 16 kbps) and **deletes** the original WAV after conversion.

```bash
./sound-to-mp3.sh <file.wav>
./sound-to-mp3.sh <directory>
```

---

### recompress-sprite-files.js

Re-compresses PNG data inside `.spr` files using oxipng. Writes output to a `compressed/` directory in the current working directory.

```bash
node recompress-sprite-files.js <level> <file-or-folder>
```

Compression levels 1–6 (higher = smaller output, slower). Example:

```bash
node recompress-sprite-files.js 2 ../sp-client/public/assets/sprites
```

---

### extract-spr-frames.js

Extracts frames from a single animation in a `.spr` file as PNG images.

```bash
node extract-spr-frames.js <spr-file> <animation-index> <output-dir>
```

Example: extract animation 0 from `kennedy.spr` into `./frames`:

```bash
node extract-spr-frames.js ../sp-client/public/assets/sprites/kennedy.spr 0 ./frames
```

---

### extract-all-spr.js

Extracts all animations from all `.spr` files in a folder. Creates an `extracted/` subfolder with one folder per sprite file, each containing numbered animation folders with frame PNGs.

```bash
node extract-all-spr.js <folder-path>
```

---

## PakToSprConverter

.NET tool to convert legacy `.pak` sprite files to `.spr` format. See [PakToSprConverter/README.md](PakToSprConverter/README.md).

**Usage:**
```bash
dotnet run -- <file-or-folder-path> [mode] [divergence]
```

- Single `.pak` file or folder of `.pak` files
- Output: `.spr` files alongside source (same name, lowercase extension)

**Conversion modes:**

| Mode | Description |
|------|-------------|
| `BinaryTransparency` (default) | Simple color-key transparency using top-left pixel |
| `BlendedTransparency` | Distance-based alpha blending for soft edges — **does not yield satisfactory results; needs to be reworked** |
| `NearTransparency` | Percentage-based transparency; configurable divergence (0–50%, default 5) |

**Divergence** (NearTransparency only): Third argument, 0–50. Pixels within this percentage of the color key become transparent.
