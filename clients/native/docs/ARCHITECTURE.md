# Architecture

Modular monolith, ports and adapters. One process, one composition root (`src/app/Application.cpp`).

| Ring | May depend on | Must not depend on |
| --- | --- | --- |
| `src/core` | C++ standard library | SFML, OpenGL, protobuf, file formats |
| `src/ports` | C++ standard library | SFML, OpenGL |
| `src/adapters` | core, ports, and that adapter's library | each other, except the app wires them |
| `src/app` | everything above | — |

The server is not in this process. Gameplay that changes the world (movement authority, combat, drops, minting) stays in `multiplayer/server` and the middleware that already sits beside it.

## Runtime path of the first frame

1. `SampleAssets` reads an `.amd` map and `.spr` sheets (or builds a placeholder grid if those files are missing).
2. Core `appendIsoFrame` turns cells into world-space quads. It does not know about GL.
3. The render adapter uploads the atlas and the current monster sheet, batches quads by texture, and draws with an orthographic camera.
4. SFML 3 opens the window and the OpenGL context and forwards keyboard and wheel input.
5. The protobuf session can decode a `ServerMessage`. It does not open a socket in this skeleton, and it does not turn a ground item into an NFT notice.

## Ports

- `IInput` — per-frame pan, zoom, quit, screenshot.
- `IAudio` — `play(cue)`. The composition root uses `NullAudio`. No audio backend is linked (SFML audio is left off).
- `INetworkSession` — connect / disconnect. `ProtobufSession::connect` reports that the socket is not linked yet.
- `IMarketPort`, `IHellPort` — read sourced rules. See `ECONOMY.md`.
- `NftDropPort` — server mint notices and claim forwards. See `NFT_DROP_EVENTS.md`.
