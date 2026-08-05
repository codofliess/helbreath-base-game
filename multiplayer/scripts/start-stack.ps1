# Helbreath local stack — run from repo after PostgreSQL is installed
$ErrorActionPreference = 'Stop'

$multiplayerRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path $multiplayerRoot -Parent

$env:DATABASE_URL = 'postgresql://helbreath:helbreath@localhost:5432/helbreath'
$env:HELBREATH_MINT_MODE = 'onchain'

Write-Host 'Stopping existing Helbreath processes on :3001 and :1337...'
foreach ($port in 3001, 1337) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 2

Write-Host 'Starting middleware on http://localhost:3001 ...'
Start-Process -WorkingDirectory "$repoRoot\middleware-node" -FilePath 'node' -ArgumentList 'server.js'

Start-Sleep -Seconds 2

Write-Host 'Starting game server on http://localhost:1337 ...'
Start-Process -WorkingDirectory "$repoRoot\multiplayer\server" -FilePath 'dotnet' -ArgumentList 'run'

Write-Host 'Done. Open http://localhost:8080 (run Vite separately if needed).'
Write-Host "DATABASE_URL=$($env:DATABASE_URL)"
