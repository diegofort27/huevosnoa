@echo off
set "APP_DIR=%~dp0app-huevos"
cd /d "%APP_DIR%"

echo [%DATE% %TIME%] Starting App... >> ..\startup_log.txt

:: Kill any stale processes on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo [%DATE% %TIME%] Killing process %%a on port 3000... >> ..\startup_log.txt
    taskkill /f /pid %%a >> ..\startup_log.txt 2>&1
)

:: Ensure any other node processes from this app are cleared if needed
:: taskkill /F /IM node.exe /T >nul 2>&1

:: Deleting potential stale lock
if exist ".next\dev\lock" del ".next\dev\lock"

:: Run using cmd /c to bypass potential PowerShell execution policy issues
cmd /c "npm run dev" >> ..\startup_log.txt 2>&1
