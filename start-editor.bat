@echo off
rem MoeHome Editor launcher - double click to start editor + preview
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found in PATH. Install from https://nodejs.org
    pause
    exit /b 1
)
if not exist "node_modules" (
    echo First run: installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)
echo Starting MoeHome Editor... browser will open automatically.
call npm run editor
pause
