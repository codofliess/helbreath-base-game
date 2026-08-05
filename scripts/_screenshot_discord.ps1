Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinD {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

$candidates = @()
Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object {
  $t = $_.MainWindowTitle
  if ($t -match 'Discord' -and $t -notmatch 'Portal de desarrolladores|Developer Portal|Terminal|grok') {
    $candidates += $_
  }
}
if (-not $candidates) {
  Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'Discord|discord.com' } | ForEach-Object { $candidates += $_ }
}
Write-Host 'Candidates:'
$candidates | ForEach-Object { Write-Host ("  {0} | {1}" -f $_.ProcessName, $_.MainWindowTitle) }

$target = $candidates | Select-Object -First 1
if (-not $target) {
  Write-Host 'No Discord window; full screen'
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
} else {
  Write-Host ("Focus: {0}" -f $target.MainWindowTitle)
  [WinD]::ShowWindow($target.MainWindowHandle, 9) | Out-Null
  [WinD]::SetForegroundWindow($target.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 700
  $rect = New-Object WinD+RECT
  [WinD]::GetWindowRect($target.MainWindowHandle, [ref]$rect) | Out-Null
  $w = [Math]::Max(100, $rect.Right - $rect.Left)
  $h = [Math]::Max(100, $rect.Bottom - $rect.Top)
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size $w, $h))
}
$path = Join-Path $PSScriptRoot '_cf_token_screen.png'
$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host $path
