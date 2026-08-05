# Graceful game-server restart: flush player saves via CTRL+C, then start clean.
# Prefer this over Stop-Process -Force (which skips ApplicationStopping persistence).
$ErrorActionPreference = 'Continue'
$port = 1337
$serverDir = 'C:\Users\54116\helbreath-base-game\multiplayer\server'
$dll = Join-Path $serverDir 'bin\Debug\net10.0\Server.dll'

function Stop-GameServerGraceful {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  $pids = @($conns | ForEach-Object { $_.OwningProcess } | Sort-Object -Unique)
  if ($pids.Count -eq 0) {
    Write-Host '[graceful-restart] No listener on :1337'
    return
  }

  foreach ($procId in $pids) {
    Write-Host "[graceful-restart] Sending close to PID $procId (try graceful)…"
    # Prefer taskkill without /F first so .NET can run ApplicationStopping saves.
    & taskkill /PID $procId 2>$null | Out-Null
  }

  $deadline = (Get-Date).AddSeconds(12)
  while ((Get-Date) -lt $deadline) {
    $still = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $still) { break }
    Start-Sleep -Milliseconds 400
  }

  $leftover = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $leftover) {
    if ($c.OwningProcess) {
      Write-Host "[graceful-restart] Force-killing leftover PID $($c.OwningProcess)"
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  }
  Start-Sleep -Seconds 1
}

# Ensure configs land in output
Copy-Item -Force (Join-Path $serverDir 'Config\Spells.json') (Join-Path $serverDir 'bin\Debug\net10.0\Config\') -ErrorAction SilentlyContinue
Copy-Item -Force (Join-Path $serverDir 'Config\GameWorlds.json') (Join-Path $serverDir 'bin\Debug\net10.0\Config\') -ErrorAction SilentlyContinue

Stop-GameServerGraceful

Set-Location $serverDir
$env:DATABASE_URL = 'postgresql://helbreath:helbreath@localhost:5432/helbreath'
$env:HELL_MINT = 'Gnjgneo47EQdn63ejVsgyPLVvbW2GzqfkhfnS4SM43yF'
$env:ASPNETCORE_ENVIRONMENT = 'Development'
$env:ASPNETCORE_URLS = 'http://0.0.0.0:1337'
Write-Host '[graceful-restart] Starting Server.dll…'
dotnet exec $dll
