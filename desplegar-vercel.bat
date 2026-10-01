@echo off
title Desplegar a Vercel - App Huevos
set "APP_DIR=%~dp0app-huevos"
cd /d "%APP_DIR%"
set "PATH=C:\Program Files\nodejs;%PATH%"

echo ========================================================
echo        DESPLIEGUE DIRECTO A VERCEL (Sin GitHub)
echo ========================================================
echo.
echo Este asistente subira tu codigo directamente a Vercel.
echo.
echo Si es la primera vez:
echo  1. Te pedira identificarte (puedes elegir Email o GitHub).
echo  2. Te preguntara 'Set up and deploy? [Y/n]' -> Presiona Y y luego Enter.
echo  3. En las siguientes preguntas presiona Enter para aceptar los valores por defecto.
echo.
echo ========================================================
echo.

call npx vercel --prod

echo.
echo ========================================================
echo Proceso finalizado.
echo ========================================================
pause
