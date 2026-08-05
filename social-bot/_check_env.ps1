$envPath = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path $envPath)) {
  Write-Host 'NO .env file'
  exit 1
}
Write-Host 'FOUND .env'
Get-Content $envPath | ForEach-Object {
  $line = $_.Trim()
  if ($line -eq '' -or $line.StartsWith('#')) { return }
  $i = $line.IndexOf('=')
  if ($i -lt 1) { return }
  $k = $line.Substring(0, $i).Trim()
  $v = $line.Substring($i + 1).Trim().Trim('"').Trim("'")
  if ($k -eq 'DISCORD_BOT_TOKEN') {
    if ($v.Length -gt 20) { Write-Host "DISCORD_BOT_TOKEN=SET (len=$($v.Length))" }
    else { Write-Host "DISCORD_BOT_TOKEN=EMPTY_OR_SHORT (len=$($v.Length))" }
  } elseif ($k -eq 'DISCORD_GUILD_ID') {
    if ($v.Length -gt 5) { Write-Host "DISCORD_GUILD_ID=SET (len=$($v.Length))" }
    else { Write-Host 'DISCORD_GUILD_ID=EMPTY' }
  } else {
    Write-Host "$k=present"
  }
}
