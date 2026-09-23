$WshShell = New-Object -comObject WScript.Shell
$StartupDir = $WshShell.SpecialFolders.Item("Startup")
$ShortcutPath = "$StartupDir\StartAppHuevos.lnk"

Write-Host "Updating shortcut at: $ShortcutPath"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "$PSScriptRoot\start-app-robust.bat"
$Shortcut.WorkingDirectory = "$PSScriptRoot"
$Shortcut.WindowStyle = 7 # Minimized
$Shortcut.Save()

Write-Host "Shortcut updated successfully to point to: $PSScriptRoot\start-app-robust.bat"
