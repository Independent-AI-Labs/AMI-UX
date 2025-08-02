@echo off
setlocal enabledelayedexpansion
REM Start development server in background and save PID

echo Starting development server...

REM Kill any existing dev server first
if exist dev-server.pid (
    set /p OLD_PID=<dev-server.pid
    echo Stopping existing server with PID %OLD_PID%...
    taskkill /F /PID %OLD_PID% >nul 2>&1
    del dev-server.pid
)

REM Start the dev server in background and capture PID
echo Starting npm dev server...
start /B cmd /c "npm run dev -- --hostname 192.168.50.63 >dev-server.log 2>&1"

REM Wait a moment for the process to start
timeout /t 3 >nul

REM Find the node.js process running the dev server
for /f "tokens=2 delims=," %%i in ('tasklist /fi "imagename eq node.exe" /fo csv /nh') do (
    set "PID=%%i"
    set "PID=!PID:"=!"
    echo !PID! > dev-server.pid
    echo Development server started with PID !PID!
    echo Log output: dev-server.log
    goto :done
)

:done
echo Server starting... Check dev-server.log for output
echo Use stop-dev.bat to stop the server