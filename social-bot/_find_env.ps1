$roots = @(
  'C:\Users\54116\helbreath-base-game',
  'C:\Users\54116\insurance-automation'
)
foreach ($root in $roots) {
  Write-Host "=== $root ==="
  Get-ChildItem -Path $root -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { -not $_.PSIsContainer -and $_.Name -like '.env*' } |
    ForEach-Object {
      Write-Host $_.FullName
      $keys = @()
      Get-Content $_.FullName -ErrorAction SilentlyContinue | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
          $k = $line.Substring(0, $line.IndexOf('=')).Trim()
          $v = $line.Substring($line.IndexOf('=') + 1).Trim()
          if ($k -eq 'DISCORD_BOT_TOKEN') {
            if ($v.Length -gt 20) { Write-Host "  DISCORD_BOT_TOKEN=SET len=$($v.Length)" }
            else { Write-Host "  DISCORD_BOT_TOKEN=short/empty len=$($v.Length)" }
          } elseif ($k -eq 'DISCORD_GUILD_ID') {
            Write-Host "  DISCORD_GUILD_ID=$(if ($v.Length -gt 5) { 'SET' } else { 'EMPTY' })"
          } else {
            Write-Host "  $k=present"
          }
        }
      }
    }
}
