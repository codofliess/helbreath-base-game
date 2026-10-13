# ChainLords native client

A new Windows-first game client for ChainLords. It is a C++20 program with its own OpenGL 3.0 render path. It is not a port of the browser client and it does not reuse Helbreath Evolution code or art.

The C# server in `multiplayer/server` stays as it is. This folder is client only. The wire format is the existing `multiplayer/proto/network.proto` (WebSocket binary frames, one protobuf message each).

## Layout

```
clients/native/
  src/core/                 game types: map, camera, animation, economy, NFT port
  src/ports/                input, null audio, and network session interfaces
  src/adapters/assets/      .spr and .amd readers, sample loader, PNG
  src/adapters/render/      OpenGL 3 sprite batch and isometric layers
  src/adapters/input/       SFML 3 keyboard and mouse
  src/adapters/net/         protobuf decode of ServerMessage
  src/app/                  composition root
  docs/                     pipeline and economy notes
  economy/unavailable.rules sourced rates only; none are recorded yet
  tools/blender/            offline sprite-bake stub
  third_party/              public-domain stb image headers
```

Core does not include SFML or OpenGL. Adapters depend on core. `src/app` is the only place that wires them together.

## Build on Linux

Tested with g++ 13, CMake 3.28, Ninja, and SFML 3.1 fetched by CMake.

```bash
sudo apt-get install -y g++ cmake ninja-build pkg-config \
  libx11-dev libxrandr-dev libxcursor-dev libxi-dev libudev-dev \
  libgl1-mesa-dev libegl1-mesa-dev \
  protobuf-compiler libprotobuf-dev

cmake -S clients/native -B clients/native/build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build clients/native/build
ctest --test-dir clients/native/build --output-on-failure
```

A headless frame (needs a GL 3 context; llvmpipe is enough):

```bash
xvfb-run -a clients/native/build/chainlords-native \
  --screenshot clients/native/docs/screenshot.png --width 1280 --height 720
```

Keys in the window: WASD or arrows pan, Q/E or the wheel zoom, F12 writes `chainlords-native.png`, Esc quits.

## Build on Windows (MSVC)

Primary target. From a Visual Studio 2022 x64 prompt, with CMake, git, and protobuf available:

```bat
cmake -S clients/native -B clients/native/build -G "Visual Studio 17 2022" -A x64
cmake --build clients/native/build --config Release
clients\native\build\Release\chainlords-native.exe --screenshot frame.png
```

CMake downloads SFML 3.1 if `find_package(SFML 3)` does not find it. Protobuf is required either on the system or through vcpkg:

```bat
cmake -S clients/native -B clients/native/build -G "Visual Studio 17 2022" -A x64 ^
  -DCMAKE_TOOLCHAIN_FILE=%VCPKG_ROOT%\scripts\buildsystems\vcpkg.cmake
```

`vcpkg.json` lists `sfml` (window) and `protobuf`. The fetched SFML build is the one this tree is written against (3.1.0).

## What the first frame shows

The sample loads `sp-client/public/assets/maps/bsmith_1.amd` and the ground sheets in `tile406-421.spr`, and animates `slm.spr` (Slime, monster id 1 in `multiplayer/server/Config/Monsters.json`). If `experiments/upscale-2026-10-04/after/` from PR #126 is present, those 4× files are used instead and drawn back onto the 32px grid. See `docs/`.
