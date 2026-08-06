# Chain Lords — Arena C++ Client (Option B)

Native **arena-only** client. Open world stays on the **web** client.

- **Server:** same .NET game server (protobuf + WebSocket)  
- **Motor feel:** Olympia/HB C++ base (drop sources under `vendor/`)  
- **Art / VFX:** Chain Lords (not raw Olympia branding)  
- **Maps:** fightzones only — see `config/arena_maps.json`

## Docs

- Product dual-client: [`docs/ARENA-CPP-CLIENT-FORK.md`](../../docs/ARENA-CPP-CLIENT-FORK.md)  
- Prize bag: [`docs/ARENA-PRIZE-ESCROW-PHASE0.md`](../../docs/ARENA-PRIZE-ESCROW-PHASE0.md)

## Status

| Layer | Status |
|-------|--------|
| Scaffold / CMake / config | **Live** |
| Network API + arena allowlist | **Live** (stubs until linked) |
| `protoc` C++ generation | Script ready |
| Olympia vendor tree | **You drop** → `vendor/olympia-client/` |
| Full render/combat loop | M2+ |

## Build (bootstrap harness)

Requires: CMake 3.20+, C++20 compiler (MSVC 2022 recommended), optional `protoc`.

```powershell
cd clients/arena-cpp
cmake -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Debug
.\build\Debug\cl_arena_bootstrap.exe --help
```

Linux:

```bash
cmake -B build -DCMAKE_BUILD_TYPE=Debug
cmake --build build
./build/cl_arena_bootstrap --help
```

### Generate C++ protobuf (when protoc installed)

```powershell
.\scripts\gen-proto.ps1
```

Outputs under `generated/proto/`.

## Drop Olympia sources

```
clients/arena-cpp/vendor/olympia-client/   # full client that compiles
clients/arena-cpp/assets/maps/            # fightzone*.amd only (or junction)
clients/arena-cpp/assets/vfx/             # CL magic VFX sheets
```

Do **not** commit multi‑GB asset trees without Git LFS.

## Wire targets

| Env | WebSocket | Auth HTTP |
|-----|-----------|-----------|
| Local | `ws://127.0.0.1:PORT/ws` | middleware local |
| Prod | `wss://play.chainlords.net/...` | production middleware |

Exact paths mirror `mp-client` `NetworkManager` (keep in sync).

## Next milestones

1. Link real WS (IXWebSocket / Boost.Beast) + binary frames  
2. Authenticate + join `colosseum`  
3. Integrate Olympia render path for fightzone1 only  
4. Port 3 CL VFX  
5. ArenaPact + prize bag UI  

## License / IP

Inspired-by Helbreath lineage; Chain Lords branding and mechanics.  
Do not ship third-party trademarks or unlicensed Olympia marketing assets.
