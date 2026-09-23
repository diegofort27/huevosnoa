$port = 3000
$command = "npm run dev"
$logFile = "watchdog.log"
$appPath = "c:\Users\gomez\Documents\antigravity\app huevos\app-huevos"

Add-Content -Path $logFile -Value "[$(Get-Date)] Watchdog started."

while ($true) {
    $listening = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    
    if (-not $listening) {
        Add-Content -Path $logFile -Value "[$(Get-Date)] Server not detected on port $port. Restarting..."
        
        # Kill any zombie processes on that port just in case
        $zombies = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        foreach ($z in $zombies) {
            Stop-Process -Id $z.OwningProcess -Force -ErrorAction SilentlyContinue
        }

        # Start the app in a new window so it's visible but separate
        Start-Process cmd.exe -ArgumentList "/c cd /d $appPath && $command" -WindowStyle Minimized
        
        # Give it some time to start before checking again
        Start-Sleep -Seconds 15
    }

    Start-Sleep -Seconds 30
}
