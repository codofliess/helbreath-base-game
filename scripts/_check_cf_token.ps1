$paths = @(
  (Join-Path $PSScriptRoot '.cloudflare_token'),
  'C:\Users\54116\insurance-automation\scripts\.cloudflare_token',
  'C:\Users\54116\helbreath-base-game\.cloudflare_token'
)
foreach ($p in $paths) {
  if (Test-Path $p) {
    Write-Host "FOUND $p len=$((Get-Item $p).Length)"
  } else {
    Write-Host "missing $p"
  }
}
Write-Host "CF_DEST env set: $([bool]$env:CF_DESTINATION_EMAIL)"
Write-Host "TOKEN env set: $([bool]$env:CLOUDFLARE_API_TOKEN)"
