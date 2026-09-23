@echo off
cd /d "%~dp0"

echo [%DATE% %TIME%] Starting App Huevos... >> startup.log

:: Kill process on port 3000
echo [%DATE% %TIME%] Checking for existing process on port 3000... >> startup.log
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo [%DATE% %TIME%] Killing process %%a... >> startup.log
    taskkill /f /pid %%a >> startup.log 2>&1
)

:: Remove stale Next.js lock
if exist ".next\dev\lock" (
    echo [%DATE% %TIME%] Removing stale lock file... >> startup.log
    del ".next\dev\lock"
)

:: Start the app
echo [%DATE% %TIME%] Starting npm run dev... >> startup.log
:: Use cmd /c to ensure npm runs even if powershell execution policy is restricted
cmd /c "npm run dev" >> startup.log 2>&1

:: If it crashes, log it
echo [%DATE% %TIME%] Server exited. >> startup.log
