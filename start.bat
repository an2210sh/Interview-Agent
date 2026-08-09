@echo off
echo =============================================
echo   AI Interview Agent - Full Stack Startup
echo =============================================
echo.

REM ── Check for API key ─────────────────────────────────────────
IF NOT EXIST "%~dp0backend\.env" (
  echo [!] No .env file found. Creating from template...
  copy "%~dp0backend\.env.example" "%~dp0backend\.env"
  echo.
  echo  IMPORTANT: Edit backend\.env and set your GROQ_API_KEY
  echo  Get a free key at: https://console.groq.com
  echo.
  pause
)

REM ── Verify API key is set ─────────────────────────────────────
findstr /C:"your_groq_api_key_here" "%~dp0backend\.env" >nul 2>&1
IF NOT ERRORLEVEL 1 (
  echo [!] WARNING: You haven't set your GROQ_API_KEY yet!
  echo     Edit backend\.env and replace 'your_groq_api_key_here' with your key.
  echo     Get a free key at: https://console.groq.com
  echo.
  pause
)

echo [1/3] Installing Python dependencies...
C:\Users\Naitik\anaconda3\python.exe -m pip install -r "%~dp0backend\requirements.txt" -q
echo       Done.
echo.

echo [2/3] Starting Backend (API) in a new window...
start "AI Interview Agent - Backend" cmd /k "cd /d %~dp0backend && C:\Users\Naitik\anaconda3\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

echo [3/3] Starting Frontend server in a new window...
start "AI Interview Agent - Frontend" cmd /k "cd /d %~dp0frontend && C:\Users\Naitik\anaconda3\python.exe -m http.server 3000"

echo.
echo =============================================
echo   Both servers are starting up!
echo =============================================
echo.
echo   Backend API:  http://localhost:8000
echo   API Docs:     http://localhost:8000/docs
echo   Frontend UI:  http://localhost:3000
echo.
echo   Opening frontend in your browser...
timeout /t 3 /nobreak >nul
start http://localhost:3000
echo.
echo   Press any key to close this launcher.
pause >nul
