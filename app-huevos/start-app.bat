@echo off
cd /d "%~dp0"

echo Checking for existing process on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Killing process %%a...
    taskkill /f /pid %%a >nul 2>&1
)

echo Starting App Huevos...
start cmd /k "npm run dev"

echo Waiting for server to start...
timeout /t 10 >nul
start "" "http://localhost:3000"
exit
