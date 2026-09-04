# Helbreath multiplayer base client

A Phaser 3 Helbreath **multiplayer** browser client built with React, TypeScript, and Vite. It targets the authoritative C# server in [`multiplayer/server`](../server): gameplay state is simulated on the server and synchronized over **WebSockets** using **Protobuf** messages.

**Overlap with single-player:** Rendering, assets, maps, sprites, and most Phaser/React architecture match the single-player client. For stack overview, project layout, asset ZIP vs per-file loading, dev tips, community tools, and production build basics, see **[`sp-client/README.md`](../../sp-client/README.md)** — treat that document as the canonical description; this README only calls out what differs in the multiplayer client.

---

## Tech Stack

Same core as single-player (TypeScript, Phaser 3, React, Vite, Radix UI primitives, TanStack Store via `@tanstack/react-store`, `@dnd-kit` for draggable dialogs). **Additional / different pieces:**

| Technology | Purpose |
|------------|---------|
| [Protocol Buffers](https://protobuf.dev/) | Shared wire schemas in [`multiplayer/proto`](../proto) (`network.proto`) |
| [`@bufbuild/protobuf`](https://buf.build/docs/protobuf/) | Runtime helpers for generated message types |
| [`ts-proto`](https://github.com/stephenh/ts-proto) + [`grpc-tools`](https://www.npmjs.com/package/grpc-tools) | Generate TypeScript from `.proto` (`pnpm run proto:generate`) |
| [react-toastify](https://fkhadra.github.io/react-toastify/) | Toasts for connection and server feedback |

**Prerequisites:** [Node.js](https://nodejs.org) (LTS recommended). For `proto:generate`, a working `protoc` is required (provided via the `grpc-tools` package when scripts run).

---

## Quick Start

You need the **multiplayer server** running (default WebSocket port **1337** — see [`multiplayer/server/README.md`](../server/README.md)).

```bash
cd multiplayer/mp-client
pnpm install
pnpm dev
```

The client dev server runs at **http://localhost:8080** (same as single-player). Use the in-game **Connect** dialog: defaults are host `localhost`, port `1337`, plus a character name.

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm proto:generate` | Regenerate `src/proto/generated/network.ts` from `../proto/network.proto` |
| `pnpm dev` | Runs `proto:generate`, frees port 8080 if in use, then starts Vite (`vite/config.dev.mjs`) |
| `pnpm build` | Runs `proto:generate`, then production build → `multiplayer/mp-client/dist` |
| `pnpm dev-nolog` / `pnpm build-nolog` | Same as `dev` / `build` without the pre-script hooks (skip proto step if you know generated files are current) |
| `pnpm compress-assets` | Build `assets.zip` via repo `tools` script (see Asset Loading below) |
| `pnpm lint` | `tsc --noEmit` |

---

## Differences from single-player (behavior & code)

- **Network layer:** [`src/utils/NetworkManager.ts`](src/utils/NetworkManager.ts) maintains the WebSocket, encodes/decodes protobuf `ClientMessage` / `ServerMessage`, and fans inbound events into the Phaser [`EventBus`](src/game/EventBus.ts). There is no local-only simulation of other players or authoritative combat — the server owns that state.
- **UI:** Extra dialogs and stores for **Connect**, **Connecting**, **Server** (e.g. ping / sync controls), **Server message**, **Chat**, **Death**, and **Player** hover; see [`src/App.tsx`](src/App.tsx) and [`src/ui/`](src/ui/).
- **Login flow:** [`LoginScreen`](src/game/scenes/LoginScreen.ts) leads into connection and world entry driven by server messages rather than offline-only character pick.
- **Build pipeline:** `predev` / `prebuild` run protobuf codegen so generated types stay in sync with [`multiplayer/proto`](../proto). Commit or regenerate `src/proto/generated/` as your workflow requires.
- **Deploy:** [`wrangler.jsonc`](wrangler.jsonc) points at `./dist` for static assets (e.g. Cloudflare Pages); the game still needs a reachable **WebSocket server** — hosting only the static client is not enough for multiplayer.

---

## Project Structure

The layout mirrors [`sp-client`](../../sp-client) (`src/game`, `src/constants`, `src/utils`, `src/ui`, Phaser scenes, custom `.spr` / `.amd` loaders). Notable **multiplayer-only** additions:

```
multiplayer/mp-client/src/
├── proto/generated/     # Generated from ../proto/network.proto (do not edit by hand)
├── utils/NetworkManager.ts   # WebSocket + protobuf bridge to EventBus
└── ui/ ...                # Connect, Chat, Server, Death, etc. (see App.tsx)
```

---

## Asset Loading

Same two modes as single-player: per-file vs ZIP, controlled by **`ENABLE_ZIP_LOADING`** in [`src/Config.ts`](src/Config.ts), with `pnpm compress-assets` output under `public/assets.zip`. Monster assets can be lazy-loaded with **`LOAD_MONSTER_ASSETS_ON_DEMAND`**; when enabled, only `MONSTER_PLACEHOLDER_SPRITE` and its sounds are eager-loaded or bundled, and real monster assets load when monsters enter range. Map and tile `.spr` packs can be lazy-loaded with **`LOAD_MAP_ASSETS_ON_DEMAND`** via [`src/utils/MapAssets.ts`](src/utils/MapAssets.ts) when `GameWorld` starts (current `.amd` + only the tile sheets that map needs). Details: **[`sp-client/README.md` § Asset Loading](../../sp-client/README.md#asset-loading)** and [`sp-client/docs/ASSET_LOADING.md`](../../sp-client/docs/ASSET_LOADING.md). For tile binary layout and the on-demand path, see [`sp-client/docs/SPRITE_FILE_FORMAT.md`](../../sp-client/docs/SPRITE_FILE_FORMAT.md).

---

## Dev Guides

Client-side guides (movement, maps, audio, UI layer, spells, etc.) live under [`sp-client/docs/`](../../sp-client/docs/) — the multiplayer client follows the same rendering and gameplay patterns; see [`sp-client/README.md` § Dev Guides](../../sp-client/README.md#dev-guides) for the full list.

For **wire protocol, prediction, and server authority**, use the multiplayer repo docs, especially [`CLIENT_SERVER_SYNC.md`](../docs/CLIENT_SERVER_SYNC.md), plus [`multiplayer/server/README.md`](../server/README.md) and linked server design docs.

---

## Development Tips

- **Server first:** Start [`multiplayer/server`](../server) before connecting; port must match the Connect dialog (default **1337**).
- **Proto changes:** After editing `../proto/network.proto`, run `pnpm proto:generate` (or rely on `pnpm dev` / `pnpm build` which run it automatically).
- **Faster loading / local dev:** Same as single-player: trim unused maps, enable `LOAD_MONSTER_ASSETS_ON_DEMAND` and/or `LOAD_MAP_ASSETS_ON_DEMAND`, and prefer per-file assets with `ENABLE_ZIP_LOADING = false` so on-demand fetches to `assets/maps/` and `assets/sprites/` work; see [`sp-client/README.md`](../../sp-client/README.md).

---

## Production Build

```bash
cd multiplayer/mp-client
pnpm install
pnpm build
```

Output is in `multiplayer/mp-client/dist`. Static files can be served from any host; ensure clients can open a **WebSocket** to your game server URL/port.

Live `play.chainlords.net` (Hetzner) serves this dist from **`/opt/chainlords/client`**. Production `pnpm build` must **not** set `VITE_GENERATE_MINIMAP`. Confirm memory-safe flags with `pnpm check:live-memory` before publishing.

### Live memory / OOM (Chrome Aw Snap 9)

Entering a city as a fully geared character used to OOM the tab when the client preloaded every map/tile pack, zoomed the camera for a full-world minimap, or registered the full item/monster/effect catalog (including item-pack frame data URLs) before the first GameWorld frame.

World rendering stays camera window + culling ring; this change does not reduce Olympia-quality sprites **in view**. First spell/NPC/bag may hitch once while that pack fetches.

### Publish static client to Hetzner (PaioPez)

Do this on the play host after merging to `consolidacion`. **Client-only** — do not restart the game server unless static files are mixed into the server tree (they are not; nginx points at `/opt/chainlords/client`).

```bash
# On a build machine with this repo (not from CI to live):
cd /path/to/repo/multiplayer/mp-client
pnpm install
pnpm check:live-memory
# Do not export VITE_GENERATE_MINIMAP
pnpm build

# On Hetzner play host (example — keep a dated backup):
sudo cp -a /opt/chainlords/client "/opt/chainlords/client.bak-$(date +%Y%m%d-%H%M)"
# Sync dist contents onto the nginx root. Preserve live `game-assets/` (maps/sprites HTTP).
sudo rsync -a --delete --exclude game-assets ./dist/ /opt/chainlords/client/
# Hard-refresh play.chainlords.net (Ctrl+Shift+R). Confirm Network: new hashed JS (not PR #8 `index-DlGsHxOc.js`).
# Enter traveler as Elon/Martín: character list → Enter World must not Aw Snap 9. Open bag after world is up.
```

| Flag | Live production | Notes |
|------|-----------------|--------|
| `LOAD_MAP_ASSETS_ON_DEMAND` | **true** (Config, not env) | LoadingScreen skips all `.amd` / tile `.spr`; `prepareMapForGameWorld` loads only the current map + required packs sequentially (including tree-shadow indices `tree+50`). |
| `LOAD_MONSTER_ASSETS_ON_DEMAND` | **true** | Only placeholder monster `.spr` at load; concrete packs when a mob enters view. |
| `LOAD_PLAYER_ITEM_APPEARANCE_ASSETS_ON_DEMAND` | **true** | Equipped gear `.spr` after map ready, sequential (not racing tile packs on enter). |
| `LOAD_EFFECT_ASSETS_ON_DEMAND` | **true** | Effect catalog not registered at load; first VFX for that pack fetches it. |
| `LOAD_NPC_ASSETS_ON_DEMAND` | **true** | NPC `.spr` when an NPC enters view. |
| `LOAD_ITEM_ICON_ASSETS_ON_DEMAND` | **true** | `item-pack` / `item-ground` on bag open or ground pile — no full frame data-URL dump. |
| `ENABLE_ZIP_LOADING` | **false** | Do not decompress a full `assets.zip` into memory on live. |
| `VITE_GENERATE_MINIMAP` | **unset** → `GENERATE_MINIMAP = false` | Skips full-world WebGL minimap capture. Pre-baked `assets/images/minimaps/*.jpg` still load for `Minimap.PRE_GENERATED`. |
| `VITE_GENERATE_MINIMAP=1` | snapshot tooling only | Re-enables on-demand full-map capture (can OOM). Use with `DOWNLOAD_MAP_SNAPSHOT` per [`sp-client/docs/GENERATING_MINIMAP_SNAPSHOTS.md`](../../sp-client/docs/GENERATING_MINIMAP_SNAPSHOTS.md). Do **not** bake this into the Hetzner client. |

Do not SSH from cloud agents; do not write live Postgres or character kit rows.
