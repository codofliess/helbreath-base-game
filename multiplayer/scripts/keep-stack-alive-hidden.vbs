' Helbreath keep-alive launcher ? runs PowerShell with no visible window.
Option Explicit
Dim sh, cmd
Set sh = CreateObject("WScript.Shell")
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\54116\helbreath-base-game\multiplayer\scripts\keep-stack-alive.ps1"""
' 0 = hidden window, False = do not wait
sh.Run cmd, 0, False
