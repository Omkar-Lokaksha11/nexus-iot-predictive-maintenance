@echo off
setlocal enabledelayedexpansion

echo ===============================================================================
echo                SMARTTWIN AI - APPLICATION LAUNCHER
echo   AI-Based Digital Twin for Smart Manufacturing Using Predictive Maintenance
echo ===============================================================================
echo.

:: 1. Activate Virtual Environment if available
if exist "venv\Scripts\activate.bat" (
    echo [*] Activating local virtual environment (venv)...
    call venv\Scripts\activate.bat
) else (
    echo [*] Virtual environment not found. Using system Python...
)

:: 2. Verify model artifact exists
if not exist "models\predictive_maintenance_pipeline.joblib" (
    echo [!] Trained model not detected in models\predictive_maintenance_pipeline.joblib
    echo [*] Automatically training machine learning model now...
    python backend\model\train_model.py
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Model training failed.
        pause
        exit /b 1
    )
)

:: 3. Launch FastAPI Application Server
echo.
echo [*] Starting SmartTwin AI Application Server on http://127.0.0.1:8000
echo [*] Open your web browser and navigate to:
echo.
echo        http://127.0.0.1:8000
echo.
echo [*] Interactive API documentation is available at:
echo        http://127.0.0.1:8000/docs
echo.
echo [*] Press Ctrl+C to safely terminate the application server.
echo ===============================================================================
echo.

python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

echo.
echo SmartTwin AI server terminated cleanly.
pause
