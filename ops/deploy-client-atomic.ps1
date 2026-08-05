# Atomic client deploy for play.chainlords.net
# Uploads index.html + style.css + matching hashed JS/CSS/phaser together, then verifies origin.
# Prevents the "JS updated, CSS 404" failure that blanks hub layout and bottom dock styles.
#
# Usage (from repo root or any cwd):
#   pwsh -File ops/deploy-client-atomic.ps1
#   pwsh -File ops/deploy-client-atomic.ps1 -SkipBuild
#
param(
    [switch]$SkipBuild,
    [string]$HostName = "46.224.129.38",
    [string]$RemoteRoot = "/opt/chainlords/client",
    [string]$SshKey = "$env:USERPROFILE\.ssh\hetzner_chainlords"
)

$ErrorActionPreference = "Stop"
$ClientDir = Resolve-Path (Join-Path $PSScriptRoot "..\multiplayer\mp-client")
$Dist = Join-Path $ClientDir "dist"

if (-not $SkipBuild) {
    Push-Location $ClientDir
    try {
        & pnpm.cmd run build
        if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
            # PowerShell may surface vite stderr as non-zero even on success; require artifacts.
            Write-Warning "pnpm exit code=$LASTEXITCODE — checking dist artifacts..."
        }
    } finally {
        Pop-Location
    }
}

$indexHtml = Join-Path $Dist "index.html"
if (-not (Test-Path $indexHtml)) {
    throw "Missing dist/index.html — build first"
}

$html = Get-Content $indexHtml -Raw
$refs = [regex]::Matches($html, 'assets/[^"\s>]+') | ForEach-Object { $_.Value } | Select-Object -Unique
if ($refs.Count -lt 2) {
    throw "index.html has fewer than 2 asset refs — aborting"
}

$required = @("index.html", "style.css") + $refs
foreach ($rel in $required) {
    $path = if ($rel -like "assets/*") { Join-Path $Dist $rel } else { Join-Path $Dist $rel }
    if (-not (Test-Path $path)) {
        throw "Missing build artifact: $rel"
    }
}

$cssRefs = $refs | Where-Object { $_ -like "*.css" }
$jsRefs = $refs | Where-Object { $_ -like "*.js" }
if (-not $cssRefs) { throw "No CSS ref in index.html" }
if (-not $jsRefs) { throw "No JS ref in index.html" }

Write-Host "Deploying to ${HostName}:${RemoteRoot}"
Write-Host "  HTML + style + $($refs -join ', ')"

$sshBase = @("-i", $SshKey, "-o", "StrictHostKeyChecking=no")
$scpBase = $sshBase

# Upload hashed assets first, then HTML last (atomic switch for browsers).
foreach ($rel in $refs) {
    $local = Join-Path $Dist $rel
    $remote = "${RemoteRoot}/$rel"
    & scp @scpBase $local "root@${HostName}:$remote"
    if ($LASTEXITCODE -ne 0) { throw "scp failed for $rel" }
}

& scp @scpBase (Join-Path $Dist "style.css") "root@${HostName}:${RemoteRoot}/style.css"
if ($LASTEXITCODE -ne 0) { throw "scp failed for style.css" }

& scp @scpBase $indexHtml "root@${HostName}:${RemoteRoot}/index.html"
if ($LASTEXITCODE -ne 0) { throw "scp failed for index.html" }

$verifyScript = @"
set -e
cd '$RemoteRoot'
chown root:www-data index.html style.css
chmod 644 index.html style.css
for f in $($refs -join ' '); do
  if [ ! -f "`$f" ]; then echo "MISSING `$f"; exit 2; fi
  chown root:www-data "`$f"
  chmod 644 "`$f"
done
echo '--- origin checks ---'
for f in $($refs -join ' '); do
  code=`$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: play.chainlords.net' "http://127.0.0.1/`$f")
  echo "`$code `$f"
  if [ "`$code" != "200" ]; then exit 3; fi
done
code=`$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: play.chainlords.net' http://127.0.0.1/index.html)
echo "`$code index.html"
# Critical UI markers must exist in CSS
CSS=`$(ls assets/index-*.css 2>/dev/null | head -1)
if [ -n "`$CSS" ]; then
  for m in login-hub-columns cl-dock-panel hotkey-bar-root; do
    if ! grep -q "`$m" "`$CSS"; then echo "CSS missing marker: `$m"; exit 4; fi
  done
  echo "CSS markers OK (`$CSS)"
fi
echo DEPLOY_OK
"@

$verifyOut = & ssh @sshBase "root@$HostName" $verifyScript
Write-Host $verifyOut
if ($verifyOut -notmatch "DEPLOY_OK") {
    throw "Remote verify failed"
}

Write-Host ""
Write-Host "Deploy complete. Hard-refresh browser (Ctrl+Shift+R)."
Write-Host "Note: hub has no bottom dock by design; dock appears after Enter World (game-world-active)."
