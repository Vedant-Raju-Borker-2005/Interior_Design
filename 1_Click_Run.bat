@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title InteriorAI Platform - One Click Launcher

cls
echo.
echo ============================================================
echo   InteriorAI Platform  -  One Click Launcher
echo   AI-Based Modular Interior Design Platform
echo ============================================================
echo.

:: ---- Resolve absolute paths from this bat file's location ----
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

:: ============================================================
:: [0] HARD CHECK - Backend folder must exist
::     This app does NOT run in dummy/mock mode.
:: ============================================================
if not exist "%BACKEND%\requirements.txt" (
    echo.
    echo ============================================================
    echo   ERROR: Backend folder not found!
    echo.
    echo   Looked for: %BACKEND%\requirements.txt
    echo.
    echo   This app does NOT run in dummy/mock mode.
    echo   Please make sure the full repo is cloned with the
    echo   'backend' folder present.
    echo ============================================================
    echo.
    pause
    exit /b 1
)
echo   [CHECK] Backend folder found. OK.
echo.

:: ============================================================
:: [1/5] Check Python
:: ============================================================
echo [1/5] Checking Python...
where python >nul 2>&1
if errorlevel 1 (
    echo.
    echo   ERROR: Python not found.
    echo   Install Python 3.10+ from https://python.org
    echo   Make sure to check "Add Python to PATH" during install.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo   %%v found. OK.
echo.

:: ============================================================
:: [2/5] Check Node.js
:: ============================================================
echo [2/5] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo.
    echo   ERROR: Node.js not found.
    echo   Install Node 18+ from https://nodejs.org
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo   Node %%v found. OK.
echo.

:: ============================================================
:: [3/5] Backend - Python virtual env + dependencies
:: ============================================================
echo [3/5] Setting up backend...
cd /d "%BACKEND%"

if not exist ".venv" (
    echo   Creating Python virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo   ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
)

call ".venv\Scripts\activate.bat"

if not exist ".venv\installed.flag" (
    echo   Installing Python dependencies ^(first time only - takes ~1 min^)...
    python -m pip install --upgrade pip -q --disable-pip-version-check
    pip install -r requirements.txt -q --disable-pip-version-check
    if errorlevel 1 (
        echo   ERROR: pip install failed. Check requirements.txt
        pause
        exit /b 1
    )
    echo. > ".venv\installed.flag"
    echo   Dependencies installed successfully.
) else (
    echo   Dependencies already installed. Skipping.
)

echo   Backend ready.
cd /d "%ROOT%"
echo.

:: ============================================================
:: [4/5] Frontend - npm install
:: ============================================================
echo [4/5] Setting up frontend...
cd /d "%FRONTEND%"

if not exist "node_modules" (
    echo   Installing frontend dependencies ^(first time only - takes ~2-3 min^)...
    call npm install --no-audit --no-fund
    if errorlevel 1 (
        echo   ERROR: npm install failed. Make sure Node.js 18+ is installed.
        pause
        exit /b 1
    )
    echo   Frontend dependencies installed.
) else (
    echo   node_modules found. Skipping npm install.
)

echo   Frontend ready.
cd /d "%ROOT%"
echo.

:: ============================================================
:: [5/5] Launch Backend + Frontend in separate windows
:: ============================================================
echo [5/5] Launching services...
echo.
echo   Backend API : http://localhost:8000
echo   Frontend    : http://localhost:3000
echo   API Docs    : http://localhost:8000/docs
echo.
echo   Two new windows will open (Backend and Frontend).
echo   Close those windows to stop the servers.
echo.

:: Launch Backend
start "InteriorAI - Backend (port 8000)" /d "%BACKEND%" cmd /k "chcp 65001 >nul && set PYTHONIOENCODING=utf-8 && call .venv\Scripts\activate.bat && echo Backend starting... && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Wait for backend to initialize
timeout /t 4 /nobreak >nul 2>&1

:: Launch Frontend
start "InteriorAI - Frontend (port 3000)" /d "%FRONTEND%" cmd /k "chcp 65001 >nul && echo Frontend starting... && npm run dev"

:: Wait for frontend
timeout /t 6 /nobreak >nul 2>&1

:: Open browser
start http://localhost:3000

echo ============================================================
echo   InteriorAI is now running!
echo.
echo   Open: http://localhost:3000
echo ============================================================
echo.
echo   This launcher window can be closed.
echo   The Backend and Frontend windows must stay open.
echo.
pause
