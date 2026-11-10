
@echo off
setlocal EnableExtensions

title Veritas AI - Local Launcher
cd /d "%~dp0"

set "ROOT=%~dp0"
set "PYTHON_VERSION=3.15"
set "FASTAPI_PORT=5001"
set "LARAVEL_PORT=8001"
set "FRONTEND_PORT=5173"

echo.
echo ===============================================
echo             VERITAS AI
echo        STABLE LOCAL DEMO LAUNCHER
echo ===============================================
echo.

REM ===========================================
REM 1. CHECK REQUIRED PROJECT FILES
REM ===========================================

echo [CHECK] Project structure...

if not exist "%ROOT%ai-python-service\main.py" (
    echo [ERROR] FastAPI main.py not found.
    goto :failed
)

if not exist "%ROOT%veritas-backend\artisan" (
    echo [ERROR] Laravel artisan not found.
    goto :failed
)

if not exist "%ROOT%veritas-frontend\package.json" (
    echo [ERROR] Frontend package.json not found.
    goto :failed
)

if not exist "%ROOT%veritas-frontend\node_modules" (
    echo [ERROR] Frontend node_modules missing.
    goto :failed
)

if not exist "%ROOT%ai-python-service\english_fake_news_pipeline_v1.pkl" (
    echo [ERROR] English ML model missing.
    goto :failed
)

if not exist "%ROOT%ai-python-service\albanian_fake_news_pipeline.pkl" (
    echo [ERROR] Albanian ML model missing.
    goto :failed
)

echo [OK] Project files found.
echo.

REM ===========================================
REM 2. CHECK REQUIRED COMMANDS
REM ===========================================

echo [CHECK] Required tools...

py -%PYTHON_VERSION% --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python %PYTHON_VERSION% not available.
    goto :failed
)

py -%PYTHON_VERSION% -c "import uvicorn, fastapi, joblib, sklearn" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] FastAPI Python dependencies missing.
    goto :failed
)

where php >nul 2>&1
if errorlevel 1 (
    echo [ERROR] PHP not found in PATH.
    goto :failed
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found in PATH.
    goto :failed
)

echo [OK] Required tools available.
echo.

REM ===========================================
REM 3. START FASTAPI
REM ===========================================

echo [1/3] FastAPI...

call :port_busy %FASTAPI_PORT%

if not errorlevel 1 (
    echo [SKIP] Port %FASTAPI_PORT% already in use.
) else (
    echo [START] FastAPI on 127.0.0.1:%FASTAPI_PORT%

    start "Veritas - FastAPI" cmd /k "cd /d ""%ROOT%ai-python-service"" && py -%PYTHON_VERSION% -m uvicorn main:app --host 127.0.0.1 --port %FASTAPI_PORT%"
)

echo.

REM ===========================================
REM 4. START LARAVEL
REM ===========================================

echo [2/3] Laravel...

call :port_busy %LARAVEL_PORT%

if not errorlevel 1 (
    echo [SKIP] Port %LARAVEL_PORT% already in use.
) else (
    echo [START] Laravel on 127.0.0.1:%LARAVEL_PORT%

    start "Veritas - Laravel" cmd /k "cd /d ""%ROOT%veritas-backend"" && php artisan serve --host=127.0.0.1 --port=%LARAVEL_PORT%"
)

echo.

REM ===========================================
REM 5. START REACT / VITE
REM ===========================================

echo [3/3] React / Vite...

call :port_busy %FRONTEND_PORT%

if not errorlevel 1 (
    echo [SKIP] Port %FRONTEND_PORT% already in use.
    echo [INFO] Existing Vite may use IPv6.
    echo [INFO] Restart it manually if IPv4 is needed.
) else (
    echo [START] React on 127.0.0.1:%FRONTEND_PORT%

    start "Veritas - Frontend" cmd /k "cd /d ""%ROOT%veritas-frontend"" && npm run dev -- --host 127.0.0.1 --port %FRONTEND_PORT% --strictPort"
)

echo.

REM ===========================================
REM 6. SUMMARY
REM ===========================================

echo ===============================================
echo            VERITAS SERVICE STATUS
echo ===============================================
echo.
echo Frontend: http://127.0.0.1:5173
echo Laravel:  http://127.0.0.1:8001
echo FastAPI:  http://127.0.0.1:5001/docs
echo.
echo IMPORTANT:
echo - Ensure MySQL is running in XAMPP.
echo - Check service windows for startup errors.
echo - A busy port does not prove a healthy service.
echo - Do not close active service windows.
echo.
echo ===============================================
echo.
pause
exit /b 0

REM ===========================================
REM HELPERS
REM ===========================================

:port_busy
netstat -ano -p tcp | findstr /C:":%~1 " | findstr /C:"LISTENING" >nul 2>&1
exit /b %errorlevel%

:failed
echo.
echo [FAILED] Veritas startup checks did not pass.
echo No new services were started by this launcher.
echo.
pause
exit /b 1
