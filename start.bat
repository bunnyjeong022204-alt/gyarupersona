@echo off
cd /d "%~dp0"
where node >NUL 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Opening download page - install the LTS version, then run this file again.
  start https://nodejs.org
  pause
  exit /b
)
start "" http://localhost:3000
node server.js
pause
