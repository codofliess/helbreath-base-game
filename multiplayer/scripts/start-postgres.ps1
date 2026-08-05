# Starts PostgreSQL for Helbreath Phase 2 (requires Docker Desktop)
$ErrorActionPreference = 'Stop'
$composeFile = Join-Path $PSScriptRoot 'docker-compose.yml'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Error 'Docker not found. Install Docker Desktop or set DATABASE_URL to an existing PostgreSQL instance.'
}

docker compose -f $composeFile up -d
Write-Host 'PostgreSQL ready at postgresql://helbreath:helbreath@localhost:5432/helbreath'
Write-Host 'Set DATABASE_URL on the game server and middleware-node, then restart both.'
