@echo off
echo Starting development server on 192.168.50.63:3000...

REM Stop any existing server
call stop-dev.bat

REM Start the server in background with logging
start "DevServer" /MIN cmd /c "npm run dev -- --hostname 192.168.50.63 > dev-server.log 2>&1"

echo Development server starting...
echo Check browser at http://192.168.50.63:3000
echo Logs written to: dev-server.log
echo Use stop-dev.bat to stop the server