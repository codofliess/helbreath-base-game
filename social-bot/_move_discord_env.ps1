$ErrorActionPreference = 'Stop'
$src = 'C:\Users\54116\insurance-automation\.env'
$dst = Join-Path $PSScriptRoot '.env'
$example = Join-Path $PSScriptRoot '.env.example'

if (-not (Test-Path $src)) { throw "Missing $src" }

$token = $null
$guild = ''
Get-Content $src | ForEach-Object {
  $line = $_.Trim()
  if ($line -match '^\s*DISCORD_BOT_TOKEN\s*=\s*(.+)$') {
    $token = $Matches[1].Trim().Trim('"').Trim("'")
  }
  if ($line -match '^\s*DISCORD_GUILD_ID\s*=\s*(.+)$') {
    $guild = $Matches[1].Trim().Trim('"').Trim("'")
  }
}

if (-not $token -or $token.Length -lt 20) {
  throw 'DISCORD_BOT_TOKEN not found or too short in insurance-automation .env'
}

# Build social-bot .env from example + token
$lines = @()
if (Test-Path $example) {
  Get-Content $example | ForEach-Object {
    if ($_ -match '^\s*DISCORD_BOT_TOKEN\s*=') {
      $lines += "DISCORD_BOT_TOKEN=$token"
    } elseif ($_ -match '^\s*DISCORD_GUILD_ID\s*=') {
      $lines += "DISCORD_GUILD_ID=$guild"
    } else {
      $lines += $_
    }
  }
  if ($lines -notcontains "DISCORD_GUILD_ID=$guild" -and -not ($lines | Where-Object { $_ -match '^DISCORD_GUILD_ID=' })) {
    $lines = @("DISCORD_BOT_TOKEN=$token", "DISCORD_GUILD_ID=$guild", '') + $lines
  }
} else {
  $lines = @(
    "DISCORD_BOT_TOKEN=$token",
    "DISCORD_GUILD_ID=$guild",
    ''
  )
}

# Ensure token line exists if example had empty pattern issues
if (-not ($lines | Where-Object { $_ -match '^DISCORD_BOT_TOKEN=\S' })) {
  $lines = @("DISCORD_BOT_TOKEN=$token", "DISCORD_GUILD_ID=$guild") + $lines
}

[System.IO.File]::WriteAllLines($dst, $lines)
Write-Host "Wrote $dst"
Write-Host "DISCORD_BOT_TOKEN len=$($token.Length)"
Write-Host "DISCORD_GUILD_ID=$(if ($guild) { 'SET' } else { 'EMPTY (need server id)' })"

# Remove Discord keys from insurance .env (keep a backup)
$bak = "$src.bak-before-discord-move-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item $src $bak
$kept = Get-Content $src | Where-Object {
  $_ -notmatch '^\s*DISCORD_BOT_TOKEN\s*=' -and $_ -notmatch '^\s*DISCORD_GUILD_ID\s*='
}
[System.IO.File]::WriteAllLines($src, $kept)
Write-Host "Removed Discord keys from insurance .env (backup: $bak)"

# Open correct file in notepad
Start-Process notepad $dst
Write-Host "Opened social-bot .env in Notepad"
