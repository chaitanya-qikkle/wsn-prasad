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

REM ---------- Backend ----------
REM The pinned backend packages (pydantic 2.7, numpy 1.26, ...) ship ready-made
REM builds for Python 3.10 - 3.12 only. On 3.13+ pip tries to compile them from
REM source and fails, so pick a supported Python even if a newer one is the default.
echo.
echo [2/3] Setting up backend...
set "PY="
py -3.12 -c "pass" >nul 2>nul
if not errorlevel 1 set "PY=py -3.12"
if defined PY goto :have_python
py -3.11 -c "pass" >nul 2>nul
if not errorlevel 1 set "PY=py -3.11"
if defined PY goto :have_python
py -3.10 -c "pass" >nul 2>nul
if not errorlevel 1 set "PY=py -3.10"
if defined PY goto :have_python
python -c "import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] <= (3, 12) else 1)" >nul 2>nul
if not errorlevel 1 set "PY=python"
if defined PY goto :have_python

echo.
echo ERROR: the backend needs Python 3.12 ^(3.10 or 3.11 also work^).
echo Python 3.13 / 3.14 are too new for the backend packages.
echo Install Python 3.12 from https://www.python.org/downloads/release/python-31210/
echo ^(it can sit alongside your current Python^), then run START.bat again.
echo The dashboard has no live data without the backend.
goto :frontend

:have_python
echo Using: %PY%
cd backend

REM Rebuild the venv if it was made with an unsupported Python, or with one
REM that has since been uninstalled.
if not exist venv\Scripts\python.exe goto :make_venv
venv\Scripts\python.exe -c "import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] <= (3, 12) else 1)" >nul 2>nul
if not errorlevel 1 goto :venv_ready
echo Existing backend\venv uses an unsupported or missing Python - rebuilding it...
rmdir /s /q venv

:make_venv
%PY% -m venv venv
if errorlevel 1 (
    echo ERROR: could not create the Python virtual environment.
    cd ..
    goto :frontend
)

:venv_ready
venv\Scripts\python.exe -m pip install -r requirements.txt --default-timeout=120 --retries 10
if errorlevel 1 (
    echo.
    echo WARNING: backend dependency install failed - see the pip error above.
    echo Skipping backend; the dashboard will have no live data.
    cd ..
    goto :frontend
)
if not exist .env (
    copy .env.example .env >nul
)
echo Starting backend server on http://localhost:8001 ...
start "TrustChain-WSN Backend" cmd /k venv\Scripts\python -m uvicorn app.main:app --port 8001
cd ..

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
echo Done. Two windows have opened (frontend, and backend if it started).
echo Keep them open while you use the app. Close this window whenever you like.
pause
