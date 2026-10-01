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

Start the local server with `PLAYTEST=1`. That flag binds `127.0.0.1` (not `0.0.0.0`) on the port in `multiplayer/server/Config/Settings.json` (1337 unless you change it). It refuses to start when a live secret is set (`WALLET_AUTH_SECRET`, `DATABASE_URL`, `HELL_MINT`, `MARKET_MIDDLEWARE_URL`, `SOLANA_RPC_URL`) or the host is production. Run the built DLL directly so a launch profile cannot inject those secrets. The PLAYTEST kit then grants item 164 (Big Red Potion) and Fire Strike to the bot seat. A mage with no Fire Strike in the spell list melees instead of waiting. Potions are used only after HP actually drops.

```bash
cd tools
pnpm exec tsx client-simulator.ts --class mage --minutes 30 --host 127.0.0.1 --port 1337 --seat elon --log ./player-bot.jsonl
```

Use `--port 31337` only when that is the port the local server is actually listening on.

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
