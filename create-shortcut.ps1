$shortcutPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\StartAppHuevos.lnk"
$targetPath = "c:\Users\gomez\Documents\antigravity\app huevos\silent-start.vbs"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.Save()
