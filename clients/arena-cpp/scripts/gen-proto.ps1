# Generate C++ protobuf from multiplayer/proto/network.proto
# Requires: protoc + libprotobuf (vcpkg install protobuf OR system package)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Proto = Join-Path $Root "multiplayer\proto\network.proto"
$Out = Join-Path $PSScriptRoot "..\generated\proto"

if (-not (Test-Path $Proto)) {
    throw "Proto not found: $Proto"
}

New-Item -ItemType Directory -Force -Path $Out | Out-Null

$protoc = Get-Command protoc -ErrorAction SilentlyContinue
if (-not $protoc) {
    Write-Host "protoc not on PATH. Install protobuf or add protoc to PATH."
    Write-Host "Example (vcpkg): vcpkg install protobuf:x64-windows"
    exit 1
}

& protoc `
    --proto_path=(Join-Path $Root "multiplayer\proto") `
    --cpp_out=$Out `
    $Proto

Write-Host "Generated C++ proto → $Out"
Get-ChildItem $Out | Select-Object Name, Length
