@echo off
setlocal enabledelayedexpansion
echo Stopping development server...

REM Close the DevServer window if it exists
taskkill /FI "WindowTitle eq DevServer*" /F >nul 2>&1

REM Kill any processes on port 3000
echo Checking for processes on port 3000...
for /f "tokens=5" %%i in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo Killing process with PID %%i...
    taskkill /F /PID %%i >nul 2>&1
)

REM Clean up any remaining Node.js processes that might be from npm/dev server
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH') do (
    set "PID=%%i"
    set "PID=!PID:"=!"
    taskkill /F /PID !PID! >nul 2>&1
)

REM Clean up files
if exist dev-server.pid del dev-server.pid
if exist dev-server.log del dev-server.log

echo Development server stopped.