Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

$procs = Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and (
    $_.MainWindowTitle -match 'Cloudflare|dash.cloudflare|Email Routing|routing' -or
    ($_.ProcessName -match 'chrome|msedge|brave|firefox' -and $_.MainWindowTitle -match 'Cloud|chainlords|Email')
  )
}
Write-Host "Matching windows:"
$procs | ForEach-Object { Write-Host ("  {0} | {1}" -f $_.ProcessName, $_.MainWindowTitle) }

# Prefer chrome with cloudflare in title; else any chrome
$target = $procs | Select-Object -First 1
if (-not $target) {
  $target = Get-Process chrome, msedge -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 } |
    Select-Object -First 1
}
if (-not $target) {
  Write-Host "No browser window found; capturing full screen"
  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
} else {
  Write-Host ("Focusing: {0}" -f $target.MainWindowTitle)
  [Win]::ShowWindow($target.MainWindowHandle, 9) | Out-Null
  [Win]::SetForegroundWindow($target.MainWindowHandle) | Out-Null
  Start-Sleep -Milliseconds 600
  $rect = New-Object Win+RECT
  [Win]::GetWindowRect($target.MainWindowHandle, [ref]$rect) | Out-Null
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
