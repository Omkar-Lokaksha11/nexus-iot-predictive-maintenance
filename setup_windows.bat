@echo off
setlocal

:: Set working directory to the directory containing this script
cd /d "%~dp0"

echo ===============================================================================
echo                SMARTTWIN AI - WINDOWS ENVIRONMENT SETUP
echo   AI-Based Digital Twin for Smart Manufacturing Using Predictive Maintenance
echo ===============================================================================
echo.

:: 1. Check Python installation
echo [*] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python was not found in your system PATH.
    echo Please install Python 3.10 or higher from https://www.python.org/downloads/
    echo Make sure to check the box: Add Python to PATH during installation.
    pause
    exit /b 1
)

python -c "import sys; print('Detected Python version: ' + sys.version.split()[0])"

:: 2. Create or verify Virtual Environment
echo.
echo [*] Setting up Python virtual environment...
if not exist "venv" (
    echo [*] Creating virtual environment in venv directory...
    python -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created.
) else (
    echo [OK] Existing virtual environment found.
)

:: 3. Activate Virtual Environment
echo [*] Activating virtual environment...
if exist "venv\Scripts\activate.bat" (
    call "venv\Scripts\activate.bat"
) else (
    echo [WARNING] Could not activate venv directly. Proceeding with system Python...
)

:: 4. Install Dependencies
echo.
echo [*] Installing required Python dependencies from requirements.txt...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install one or more dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies successfully installed.

:: 5. Train Model & Prepare Evaluation Artifacts
echo.
echo [*] Checking machine learning model artifacts...
if not exist "models\predictive_maintenance_pipeline.joblib" (
    echo [*] Model pipeline not found. Running ML training pipeline now...
    python backend\model\train_model.py
    if errorlevel 1 (
        echo [ERROR] Model training failed. Check your network connection to download the UCI dataset.
        pause
        exit /b 1
    )
    echo [OK] Model trained and saved to models\predictive_maintenance_pipeline.joblib.
) else (
    echo [OK] Trained model artifact already exists.
)

:: 6. Run automated test suite
echo.
echo [*] Running automated test verification with Pytest...
python -m pytest tests\ -q
if errorlevel 1 (
    echo [WARNING] Some tests encountered issues. Review test output above.
) else (
    echo [OK] All automated tests passed successfully!
)

echo.
echo ===============================================================================
echo                SETUP COMPLETED SUCCESSFULLY!
echo ===============================================================================
echo You can now run the application anytime using:
echo    run_windows.bat
echo.
echo Or start manually with:
echo    python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
echo ===============================================================================
pause
