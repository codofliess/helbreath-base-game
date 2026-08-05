$ErrorActionPreference = 'Continue'
$conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
  Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
}
Set-Location $PSScriptRoot
Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $PSScriptRoot -WindowStyle Minimized
Start-Sleep -Seconds 3
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/arena/week?format=solo' -UseBasicParsing -TimeoutSec 5
  Write-Host $r.Content
} catch {
  Write-Host ('ERR ' + $_.Exception.Message)
}
