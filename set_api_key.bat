@echo off
echo =============================================
echo   Set Groq API Key
echo =============================================
echo.
echo Get your free key at: https://console.groq.com
echo (It starts with: gsk_)
echo.
set /p APIKEY="Paste your Groq API key here and press Enter: "

if "%APIKEY%"=="" (
  echo [ERROR] No key entered. Exiting.
  pause
  exit /b 1
)

echo GROQ_API_KEY=%APIKEY%> "%~dp0backend\.env"
echo.
echo [OK] API key saved to backend\.env
echo [OK] File contents:
type "%~dp0backend\.env"
echo.
echo Now restart your backend server for the key to take effect.
echo (Close the backend terminal and run start.bat again, or press Ctrl+C then restart)
echo.
pause
