# Helbreath keep-alive: start any missing local service (no UI flash).
$ErrorActionPreference = 'Continue'
$log = 'C:\Users\54116\helbreath-base-game\multiplayer\scripts\keep-stack-alive.log'
function Log($m) {
  $line = "{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m
  Add-Content -Path $log -Value $line -ErrorAction SilentlyContinue
}
function PortUp([int]$port) {
  return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

# Middleware 3001
if (-not (PortUp 3001)) {
  Log 'START Middleware :3001'
  Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory 'C:\Users\54116\helbreath-base-game\middleware-node' -WindowStyle Hidden
}

# Game server 1337
if (-not (PortUp 1337)) {
  Log 'START GameServer :1337'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','C:\Users\54116\helbreath-base-game\multiplayer\server\_start_dev.cmd' -WindowStyle Hidden
}

# Traveler 8081
if (-not (PortUp 8081)) {
  Log 'START Traveler :8081'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','C:\Users\54116\helbreath-base-game\multiplayer\mp-client\_run_traveler.cmd' -WindowStyle Hidden
}

# GM 8080
if (-not (PortUp 8080)) {
  Log 'START GM :8080'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','C:\Users\54116\helbreath-base-game\multiplayer\mp-client\_run_gm.cmd' -WindowStyle Hidden
}

$s = @()
foreach ($p in 1337,3001,8080,8081) {
  if (PortUp $p) { $s += "UP:$p" } else { $s += "DOWN:$p" }
}
Log ("STATUS " + ($s -join ' '))
