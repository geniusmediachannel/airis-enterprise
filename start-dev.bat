@echo off
set "PATH=C:\Users\marko\AppData\Local\Programs\nodejs;%PATH%"
cd /d "%~dp0"
echo ========================================================
echo   AIRIS Enterprise - PT. Anugerah Illahi Rabbi
echo   Starting Vite Development Server on http://localhost:3000
echo ========================================================
call npm.cmd run dev
pause
