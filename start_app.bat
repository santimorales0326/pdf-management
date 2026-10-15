@echo off
title PDF Nexus Launcher
cls
echo ===================================================
echo               PDF Nexus Local Launcher             
echo ===================================================
echo.

echo [+] Starting FastAPI Backend in the background...
start "PDF Nexus Backend" /min cmd /c "cd /d %~dp0backend && .venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo [+] Starting Next.js Frontend in the background...
start "PDF Nexus Frontend" /min cmd /c "cd /d %~dp0frontend && pnpm dev"

echo [+] Waiting for servers to initialize...
timeout /t 4 /nobreak >nul

echo [+] Opening PDF Nexus in your default browser...
start http://localhost:3000

echo.
echo ===================================================
echo  PDF Nexus is now running!                          
echo  - Backend: http://127.0.0.1:8000                  
echo  - Frontend: http://localhost:3000                 
echo ===================================================
echo.
echo  [!] To STOP all servers, press any key in this window.
echo.
pause

echo [+] Shutting down servers...
taskkill /fi "windowtitle eq PDF Nexus Backend*" /t /f >nul 2>&1
taskkill /fi "windowtitle eq PDF Nexus Frontend*" /t /f >nul 2>&1

echo [✓] Done. Goodbye!
timeout /t 2 >nul
