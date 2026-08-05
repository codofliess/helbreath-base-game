# Chain Lords Discord — after you create the empty server + bot and fill .env
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
  Write-Host "Create social-bot\.env with:"
  Write-Host "  DISCORD_BOT_TOKEN=..."
  Write-Host "  DISCORD_GUILD_ID=..."
  exit 1
}

$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch "DISCORD_BOT_TOKEN=\S+" -or $envContent -notmatch "DISCORD_GUILD_ID=\S+") {
  Write-Host "DISCORD_BOT_TOKEN and DISCORD_GUILD_ID must be non-empty in .env"
  exit 1
}

if (-not (Test-Path "node_modules\discord.js")) {
  npm install
}

Write-Host "Running setup-server.mjs ..."
node setup-server.mjs
