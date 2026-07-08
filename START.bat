@echo off
setlocal
title TrustChain-WSN - Setup and Run
cd /d "%~dp0"

echo ============================================
echo  TrustChain-WSN - one-click setup and run
echo ============================================
echo.

REM ---------- Frontend ----------
echo [1/3] Installing frontend dependencies (this can take a few minutes on first run)...
cd frontend
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed. Make sure Node.js is installed: https://nodejs.org
    pause
    exit /b 1
)
cd ..

REM ---------- Backend (optional, skipped silently if Python is missing) ----------
where python >nul 2>nul
if %errorlevel%==0 (
    echo.
    echo [2/3] Setting up backend...
    cd backend
    if not exist venv (
        python -m venv venv
    )
    call venv\Scripts\activate
    pip install -r requirements.txt --default-timeout=120 --retries 10
    if errorlevel 1 (
        echo.
        echo WARNING: backend dependency install failed ^(likely a slow/unstable
        echo connection to pypi.org^). Skipping backend - frontend will still work.
        cd ..
        goto :frontend
    )
    if not exist .env (
        copy .env.example .env >nul
    )
    echo Starting backend server on http://localhost:8001 ...
    start "TrustChain-WSN Backend" cmd /k venv\Scripts\python -m uvicorn app.main:app --port 8001
    cd ..
) else (
    echo.
    echo [2/3] Python not found - skipping optional backend ^(frontend works fine without it^).
)

:frontend
REM ---------- Start frontend + open browser ----------
echo.
echo [3/3] Starting frontend on http://localhost:5174 ...
cd frontend
start "TrustChain-WSN Frontend" cmd /k npm run dev
cd ..

timeout /t 5 /nobreak >nul
start http://localhost:5174

echo.
echo Done. Two windows have opened (frontend, and backend if Python was found).
echo Keep them open while you use the app. Close this window whenever you like.
pause
