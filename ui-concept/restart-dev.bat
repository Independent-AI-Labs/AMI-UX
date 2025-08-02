@echo off
REM Rebuild and restart development server

echo Stopping current development server...
call stop-dev.bat

echo Building project...
npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Build failed! Check for errors above.
    pause
    exit /b 1
)

echo Build successful! Starting development server...
call start-dev-simple.bat

echo Development server restarted successfully!