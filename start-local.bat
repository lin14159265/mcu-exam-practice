@echo off
setlocal
chcp 65001 >nul

set "PORT=8765"
set "URL=http://127.0.0.1:%PORT%/index.html"

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found.
  echo Please install Python or open index.html directly in your browser.
  pause
  exit /b 1
)

netstat -ano | findstr /R /C:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo Port %PORT% is already in use.
  echo If this project is already running, open:
  echo %URL%
  echo.
  echo Otherwise close the process using port %PORT%, or edit PORT in start-local.bat.
  start "" "%URL%"
  pause
  exit /b 1
)

echo Starting local quiz server...
echo URL: %URL%
echo.
echo Keep this window open while using the web page.
echo Press Ctrl+C in this window to stop the server.
echo.
start "" "%URL%"
python -m http.server %PORT%
