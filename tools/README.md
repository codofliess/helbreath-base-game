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

### map-diff.mjs

Compares every checked-in `.amd` to a Helbreath Olympia reference, then writes a ranked report.

Olympia `.amd` files are read from `reference/olympia-maps/` (or `--olympia`). Olympia MAPDATA text dumps are read from `reference/mapdata/`, `sp-client/reference/mapdata/`, or `tmp-mapdata/` (or `--mapdata`). Neither dump is in the repo today. The script still runs: it audits collision, teleport wiring, and spawn cells on `multiplayer/server/Config/maps`, and diffs those bytes against the mp-client and sp-client copies.

```bash
node tools/map-diff.mjs
node tools/map-diff.mjs --olympia reference/olympia-maps --mapdata reference/mapdata
node --test tools/map-diff.test.mjs
```

From `tools/` with pnpm 10 (pnpm 9 breaks on `allowBuilds`):

```bash
npx pnpm@10 run map-diff
npx pnpm@10 run map-diff:test
```

`--strict` exits non-zero when an Olympia source directory is missing. Default output is `tools/map-diff-out/` (gitignored). A one-map sample image lives at `tools/map-diff/sample-side-by-side.png`.

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
