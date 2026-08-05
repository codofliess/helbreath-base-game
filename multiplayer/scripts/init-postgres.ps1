# One-time PostgreSQL bootstrap for Helbreath (requires postgres superuser password)
param(
    [string]$SuperPassword = 'postgres'
)

$ErrorActionPreference = 'Stop'
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
if (-not (Test-Path $psql)) {
    Write-Error 'PostgreSQL 17 not found. Install via winget or Docker first.'
}

$env:PGPASSWORD = $SuperPassword

& $psql -U postgres -h localhost -v ON_ERROR_STOP=1 -c @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'helbreath') THEN
    CREATE USER helbreath WITH PASSWORD 'helbreath';
  END IF;
END `$`$;
"@

$dbExists = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname = 'helbreath'"
if (-not ($dbExists -match '1')) {
    & $psql -U postgres -h localhost -c 'CREATE DATABASE helbreath OWNER helbreath;'
}

Write-Host 'Ready: postgresql://helbreath:helbreath@localhost:5432/helbreath'
