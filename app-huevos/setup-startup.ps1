$WshShell = New-Object -comObject WScript.Shell
$StartupDir = $WshShell.SpecialFolders.Item("Startup")
$Shortcut = $WshShell.CreateShortcut("$StartupDir\AppHuevosBackground.lnk")
$Shortcut.TargetPath = "$PSScriptRoot\iniciar-servidor.vbs"
$Shortcut.WorkingDirectory = "$PSScriptRoot"
$Shortcut.Save()

Write-Host "Configurado: El servidor se iniciará automáticamente en segundo plano cada vez que inicies Windows."
