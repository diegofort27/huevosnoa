@echo off
echo Deteniendo el servidor de Next.js...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a
echo Servidor detenido correctamente.
pause
