# SMARTTWIN AI
### AI-Based Digital Twin for Smart Manufacturing Using Predictive Maintenance
**Mechanical Engineering MDM Mini Project • 2026**

---

## 1. Executive Summary & Project Introduction

In modern manufacturing, unexpected machinery breakdowns cause significant economic losses, production downtime, and safety hazards. Traditional maintenance approaches typically follow one of two paradigms:
1. **Reactive Maintenance ("Run-to-Failure"):** Machinery is repaired only after failure occurs, causing secondary equipment damage and unpredicted shutdowns.
2. **Preventative Maintenance ("Calendar/Schedule-Based"):** Parts are replaced on fixed schedules regardless of actual wear, discarding functional tooling prematurely and increasing operational expenditure.

**SmartTwin AI** implements a **Digital Twin and Machine Learning Predictive Maintenance System** that bridges this gap. By creating an interactive software twin of an industrial CNC milling/cutting spindle and utilizing the official **UCI AI4I 2020 Predictive Maintenance Dataset**, the platform provides:
- Continuous physical telemetry monitoring (rotational speed, spindle torque, air temperature, process temperature, cutting tool wear, and vibration).
- Real-time AI failure risk inference via a trained **Scikit-learn Random Forest** model with balanced class weighting.
- Mechanical root-cause failure diagnostics:
  - **Tool Wear Failure (TWF)**
  - **Heat Dissipation Failure (HDF)**
  - **Power Failure (PWF)**
  - **Overstrain Failure (OSF)**
- Comparison between static physical threshold rules and multi-variate ML predictions.
- Persistent SQLite storage for telemetry, predictions, alerts, and service logs.
- Real-time downloadable CSV export for maintenance engineers.

> [!NOTE]
> **Single Unified Application:** The frontend dashboard and the FastAPI backend run together as **one local web application** at `http://127.0.0.1:8000`.

---

## 2. Technology Stack & System Architecture

```
                                  +---------------------------------------+
                                  |         SMARTTWIN AI FRONTEND         |
                                  | (HTML5, Responsive CSS, Canvas, SVG)  |
                                  +-------------------+-------------------+
                                                      |
                                     HTTP REST / JSON | (Port 8000)
                                                      v
                                  +-------------------+-------------------+
                                  |       FASTAPI PYTHON BACKEND          |
                                  | (backend/main.py, Uvicorn ASGI Server)|
                                  +---------+-------------------+---------+
                                            |                   |
                     +----------------------+                   +-----------------------+
                     v                                                                  v
+--------------------+---------------------+                  +-------------------------+---------------------+
|        MACHINE LEARNING PIPELINE         |                  |             SQLITE DATABASE                 |
|  - Preprocessing: OneHotEncoder + Scale  |                  | (smarttwin.db)                              |
|  - Classifier: RandomForest (Balanced)   |                  | - sensor_readings   - predictions           |
|  - Dataset: UCI AI4I 2020 (10,000 rows)  |                  | - alerts            - maintenance_events    |
|  - Artifacts: models/*.joblib & *.json   |                  +-----------------------------------------------+
+------------------------------------------+
```

| Layer | Technologies & Tools |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Industrial Glassmorphism, Animated Welcome Landing Screen), Vanilla JavaScript (ES6+), HTML5 Canvas 2D API, Dynamic SVG |
| **Backend** | Python 3.10+, FastAPI, Uvicorn (ASGI), Pydantic v2 |
| **Machine Learning** | Scikit-learn (RandomForestClassifier with `class_weight='balanced'`), Pandas, NumPy, Joblib |
| **Database** | SQLite3 (Persistent with indexed schema migrations, alert deduplication, and parameterized operations) |
| **Testing** | Pytest, FastAPI TestClient (24 automated unit, regression, and integration tests) |
| **Target OS** | Microsoft Windows 10/11 (Optimized for ~8 GB RAM laptops) |

---

## 3. Dataset & Data Consistency Rule

The machine learning model is trained exclusively on the official **UCI AI4I 2020 Predictive Maintenance Dataset**:
- **Dataset Reference:** [UCI Machine Learning Repository #601](https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset)
- **Sample Count:** 10,000 synthetic records representing actual milling machine telemetry.
- **Class Distribution:**
  - Non-Failures (Class 0): **9,661** (96.61%)
  - Machine Failures (Class 1): **339** (3.39%)
- **Supported Input Features:**
  1. `Type`: Product quality variant (`L` = 50%, `M` = 30%, `H` = 20%).
  2. `Air temperature [K]`: Generated via random walk normalized around 300 K.
  3. `Process temperature [K]`: Generated via random walk added to air temp plus 10 K.
  4. `Rotational speed [rpm]`: Calculated from spindle power (2860 W) with normal noise.
  5. `Torque [Nm]`: Normally distributed around 40 Nm (SD = 10 Nm).
  6. `Tool wear [min]`: Cumulative minutes of cutting insert wear.

> [!IMPORTANT]
> **Vibration Segregation Rule:**
> The official UCI AI4I 2020 dataset does **not** include vibration as a feature. SmartTwin AI strictly complies with data science integrity by **never** feeding simulated vibration into the ML model. Vibration is displayed on the dashboard as a separate physical sensor measurement with dedicated rule-based threshold warnings.

---

## 4. Prerequisites

- **Operating System:** Windows 10 or 11 (64-bit).
- **RAM:** 4 GB minimum (8 GB recommended).
- **Python:** Python 3.10.x or higher installed and added to the Windows `PATH`.
  - To verify in Command Prompt / PowerShell:
    ```powershell
    python --version
    ```
- **Web Browser:** Google Chrome, Microsoft Edge, Mozilla Firefox, or Brave.

---

## 5. One-Step Windows Setup & Startup

### Option A: Automatic One-Step Scripts (Recommended)

1. Open File Explorer, navigate to the project directory:
   ```
   C:\Users\Shree\Desktop\NEXUS
   ```
2. **First-time setup:** Double-click:
   ```
   setup_windows.bat
   ```
   *This script checks Python, creates `venv`, installs `requirements.txt`, downloads the dataset, trains the model, and executes the automated tests.*
3. **Launch the application:** Double-click:
   ```
   run_windows.bat
   ```
4. Open your browser and go to:
   ```
   http://127.0.0.1:8000
   ```
   To view the interactive Swagger REST API documentation:
   ```
   http://127.0.0.1:8000/docs
   ```

---

### Option B: Manual Setup via PowerShell / CMD

1. Open PowerShell inside the project directory:
   ```powershell
   cd C:\Users\Shree\Desktop\NEXUS
   ```

2. (Optional) Create and activate a virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
   *If PowerShell displays an `ExecutionPolicy` error, run:*
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
   .\venv\Scripts\Activate.ps1
   ```

3. Install requirements:
   ```powershell
   pip install -r requirements.txt
   ```

4. Train the machine learning model:
   ```powershell
   python backend/model/train_model.py
   ```

5. Launch the application server:
   ```powershell
   python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
   ```

6. Open `http://127.0.0.1:8000` in your browser.

---

## 6. Manual Dataset Download (If Offline)

If automatic dataset downloading fails due to firewall or network restrictions:
1. Download `ai4i2020.csv` directly from:
   [UCI Machine Learning Repository - AI4I 2020](https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset)
   *(Or direct mirror: `https://archive.ics.uci.edu/ml/machine-learning-databases/00601/ai4i2020.csv`)*
2. Save the file into the `data/` folder:
   ```
   C:\Users\Shree\Desktop\NEXUS\data\ai4i2020.csv
   ```
3. Run the training script:
   ```powershell
   python backend/model/train_model.py
   ```

---

## 7. Dashboard Sections & How to Use Them

### A. Overview Dashboard
- **Machine Health Score:** Dynamic 0–100% composite score derived from ML failure probability and physical parameter tolerances.
- **Failure Probability:** Real-time percentage estimated by the Random Forest model.
- **Telemetry Indicators:** Visual badges for Speed (RPM), Torque (Nm), Air & Process Temperature (°C / K), Tool Wear (min), and Vibration (mm/s).
- **Scenario Selector:** Top-bar dropdown allowing instant switching between normal and fault scenarios.

### B. Digital Twin
- **Interactive 2D Machine Representation:** Animated SVG showing stator, stator cooling fins, rotating rotor assembly, bearing housings, and output spindle.
- **Dynamic Speed & Thermal Glow:** Rotor animation speed dynamically scales with Spindle RPM; heat overlay shifts to warning amber/red when temperature rises.
- **Operating Parameters:** Allows switching between Quality Grades (Type L, M, H) and Fault Scenarios.
- **Simulation Transparency:** Clearly labelled as a software simulation twin.

### C. Live Monitoring (Small-Multiples Layout)
- **Dedicated Small-Multiple Canvas Charts:** 5 separate time-series charts with actual engineering units, clear axis labels, and reference threshold lines:
  1. **Spindle Rotational Speed:** 1,000 - 3,000 RPM range with nominal reference line at 1,500 RPM.
  2. **Drive Torque:** 0 - 80 Nm range with continuous threshold line at 55 Nm.
  3. **Thermal Dynamics (Air vs Process):** Dual-line temperature chart displaying internal process vs ambient air and live $\Delta T$ delta in °C / K.
  4. **Tool Wear Progression:** 0 - 260 min cumulative wear tracking with critical boundaries at 200 min and 240 min.
  5. **Vibration Amplitude (RMS):** 0 - 5.0 mm/s ISO 10816 vibration spectrum, explicitly segregated as an independent physical sensor measurement.
- **Telemetry Controls:** Start, Pause, Resume, and Buffer Clear buttons.
- **Numerical Telemetry Deck:** Live numerical tiles displaying metric conversions (K to °C, RPM to rad/s, Torque to kW spindle power).

### D. AI Prediction
- **Custom Parameter Submission:** Allows entering any combination of Type, Air Temp, Process Temp, RPM, Torque, and Tool Wear.
- **Unit Flexibility:** Toggle between Kelvin (K) and Celsius (°C).
- **Quick Preset Buttons:** One-click presets for Healthy Baseline, Thermal HDF Risk, Overload PWF Risk, and Tool Wear TWF Risk.
- **Diagnostic Feedback:** Displays predicted failure class, probability bar, probable physical failure mode (TWF, HDF, PWF, OSF), and operator recommendations.
- **Physics vs. ML Comparison:** Explains whether static rule limits and multi-variate ML predictions agree or diverge.

### E. Alert Centre
- **Filterable Event Log:** Categorized by severity (Critical, Warning) and status (Active, Acknowledged).
- **Source Attribution:** Clearly marks whether an alert originated from an `ML_MODEL` prediction or a `RULE_THRESHOLD` sensor boundary.
- **Acknowledge Function:** Plant personnel can mark alerts as acknowledged, updating the SQLite database instantly.

### F. Maintenance History
- **Service Records Table:** Displays logged maintenance actions with technician name, component, and engineering notes.
- **Add Maintenance Modal:** Interactive form allowing plant operators to log service events directly into SQLite.
- **CSV Data Export:** One-click button (`/api/maintenance/export`) to download records for reporting and audit compliance.

### G. Model Performance
- **Live Metrics from Training:** Displays Accuracy, Recall, Precision, and ROC-AUC read directly from `models/metrics.json`.
- **Confusion Matrix:** Full 2×2 breakdown (True Negatives, False Positives, False Negatives, True Positives).
- **Class Imbalance Visualization:** Visual representation of the 96.6% to 3.4% imbalance and justification of why `class_weight='balanced'` was selected.
- **Feature Importance Ranking:** Bar chart ranking the predictive influence of Rotational Speed, Torque, Tool Wear, and Temperature.

### H. Project Information
- Comprehensive review of problem formulation, mathematical equations, mechanical failure modes, limitations, and future enhancements suitable for university viva questions.

---

## 8. Interpreting Model Evaluation Metrics

During model training on the stratified 80/20 test split (2,000 unseen samples), the following real results were achieved:

| Metric | Value | Industrial Significance |
| :--- | :---: | :--- |
| **Accuracy** | **97.90%** | Overall correct rate across both healthy and failure instances. |
| **ROC-AUC** | **0.9590** | Exceptional ability to distinguish between normal and abnormal machine states across all decision thresholds. |
| **Failure Recall** | **60.29%** | **41 out of 68 actual machine failures caught** on unseen test data. |
| **Failure Precision** | **73.21%** | When the AI model flags a failure, it is correct in ~73% of cases. |
| **F1-Score** | **0.6613** | Harmonic mean balancing recall and precision for the rare minority class. |

### Why Failure Recall is the Most Critical Metric
In industrial manufacturing, a **False Negative (missed failure)** means a machine catastrophic breakdown occurs on the shop floor, resulting in thousands of dollars of lost production, ruined workpieces, and damaged spindle bearings.
In contrast, a **False Positive (false alarm)** simply triggers a preventative 5-minute visual inspection.
Therefore, our pipeline implements `class_weight='balanced'` within `RandomForestClassifier` to heavily penalize missed failures, ensuring high sensitivity to emerging degradation patterns.

---

## 9. Running Automated Tests

A comprehensive 24-test suite verifies all components before deployment:
```powershell
python -m pytest tests/ -v
```

### Verified Test Categories:
- **`tests/test_model.py` (8 tests):**
  - Temperature unit conversions (Kelvin to Celsius & Celsius to Kelvin).
  - Predictor artifact loading.
  - Normal machine inference and probability output.
  - Failure detection for critical conditions.
  - Celsius input inference.
  - **Regression:** Handling unsubmitted / `None` temperature inputs without triggering `TypeError`.
  - Boundary input rejection (out-of-range RPM, negative temperatures).
  - Graceful handling of missing model artifacts (HTTP 503 readiness).
- **`tests/test_simulator.py` (6 tests):**
  - Spindle telemetry initialization and Gaussian variation.
  - Telemetry advancement on step.
  - Simulation pause and resume state control.
  - Scenario simulation (`normal`, `warning`, `hdf`, `pwf`, `twf`, `osf`).
  - **Unified Condition:** Consistency between status badges and health scores (no 84% score when in warning).
  - Strict segregation of simulated vibration from the ML pipeline.
- **`tests/test_api.py` (10 tests):**
  - Health endpoint (`/api/health`) and component readiness checks.
  - Telemetry readings polling (`/api/simulator/readings`).
  - Simulator control (`/api/simulator/control`).
  - Valid AI prediction via REST (`/api/predict`).
  - Temperature unit toggle and `None` value serialization in Pydantic.
  - Validation error handling (HTTP 422 with structured issue details).
  - Evaluation metrics endpoint (`/api/model/metrics`).
  - Alert lifecycle, deduplication (`is_active=1`), and acknowledge endpoint (`/api/alerts/{id}/ack`).
  - Maintenance event creation, demo filtering, and CSV export (`/api/maintenance/export`).
  - Static frontend serving (root index, style, and script delivery).

---

## 10. Troubleshooting Common Windows Errors

### 1. PowerShell Script Execution Policy Error
**Symptom:** `cannot be loaded because running scripts is disabled on this system.`  
**Fix:** Run this command in PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

### 2. Port 8000 Already in Use
**Symptom:** `ERROR: [Errno 10048] error while attempting to bind on address ('127.0.0.1', 8000)`  
**Fix:** Stop the previous server process or kill the process using port 8000:
```powershell
netstat -ano | findstr :8000
taskkill /PID <PID_NUMBER> /F
```
Or start on an alternate port:
```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8080 --reload
```

### 3. Model Not Loaded / 503 Error on Prediction
**Symptom:** `ML model is not loaded. Train the model first.`  
**Fix:** Execute the training pipeline once:
```powershell
python backend/model/train_model.py
```

---

## 11. Project Limitations & Future Scope

### Current Limitations:
1. **Simulation Environment:** The machine telemetry is produced via high-fidelity physics simulation rather than physical microcontrollers (e.g. ESP32, Modbus).
2. **Binary Horizon:** The classification predicts failure likelihood under current operating inputs rather than calculating exact remaining operating hours (Remaining Useful Life).

### Future Roadmap:
- **RUL Regression Pipeline:** Train an ensemble regressor (e.g. Gradient Boosting / XGBoost) to estimate Remaining Useful Life in machine hours.
- **Hardware Telemetry Bridge:** Connect real vibration accelerometers (ADXL345) and thermocouple sensors via an ESP32 microcontroller over MQTT.
- **OPC-UA Integration:** Support standard industrial automation protocols for PLC / SCADA interoperability.

---

## 12. College Guide / Mini Project Demonstration Script

Follow this step-by-step walkthrough during your project demonstration:

1. **Introduction & Welcome Landing Screen:**
   - Launch `run_windows.bat` or `python -m uvicorn backend.main:app --port 8000`.
   - Open `http://127.0.0.1:8000` in Google Chrome or Edge.
   - Point out the **Animated Welcome Screen**:
     - *"Respected Guide, this project is titled SmartTwin AI. It is an AI-based Digital Twin designed for smart manufacturing using predictive maintenance."*
     - Highlight the feature cards: Physics Simulation, Random Forest Pipeline, Real-Time Telemetry, and SQLite Service Logging.
     - Click **"Launch Digital Twin Dashboard"** to enter the workspace with a smooth CSS transition.

2. **Overview Dashboard Demonstration:**
   - Point out the **Machine Health Score (95%)**, **Failure Probability (1.2%)**, and operating parameters.
   - Show that telemetry streams live every 2 seconds without full page reloads.
   - Highlight the status consistency: when healthy, the system displays green `NORMAL` with an optimal health score >90%.

3. **Digital Twin Demonstration:**
   - Navigate to the **Digital Twin** tab.
   - Explain the 2D machine visualization: *"This visualizes the CNC milling motor. Notice the rotor spinning dynamically according to spindle RPM and the stator cooling fins."*
   - Switch the scenario dropdown to **"Fault: Tool Wear Exceeded (TWF)"**.
   - Show how the rotor, temperature indicators, and health score change dynamically in synchronization.

4. **Live Monitoring Demonstration:**
   - Open **Live Telemetry**.
   - Show the multi-channel canvas chart plotting temperature, speed, torque, wear, and vibration simultaneously.
   - Explain that vibration is tracked independently as an external physical metric without polluting the ML model.

5. **AI Prediction Demonstration:**
   - Open **AI Prediction**.
   - Test the **4 Quick Test Presets**:
     - Click **"Healthy Baseline"** and click **"Execute AI Prediction"**; observe the green "OPTIMAL - HEALTHY" result with low failure risk (~1%).
     - Click **"Thermal HDF Risk"** and click **"Execute AI Prediction"**; observe the heat dissipation warning.
     - Click **"Overload PWF Risk"**; observe high torque + low RPM power failure detection.
     - Click **"Tool Wear TWF Risk"**; observe tool wear >220 min flagged with critical failure probability (>80%) and immediate replacement advice.
   - Highlight the **Physics vs ML comparison** card: explains whether static rule limits and multi-variate ML predictions agree or diverge.
   - Note the toast notification system: no blocking browser popups.

6. **Alert Centre & Maintenance History:**
   - Show how critical events triggered by the simulator are logged into SQLite with event-driven deduplication (no runaway spam).
   - Demonstrate the **Acknowledge Alert** button.
   - Switch to **Maintenance Log**, notice existing seed records are clearly tagged with the blue `DEMO` badge.
   - Fill out the form to record an actual maintenance action (e.g. "Spindle Tool Insert Replaced"), submit, and see it appended with a green `USER` badge.
   - Click **"Export CSV"** to demonstrate downloadable reports for maintenance compliance.

7. **Model Performance & Viva Discussion:**
   - Navigate to **Model Performance**.
   - Explain the evaluation metrics (97.90% accuracy, 60.29% failure recall, 0.9590 ROC-AUC).
   - Answer the classic viva question: *"Why is Failure Recall prioritized over naive accuracy?"* using the confusion matrix and class imbalance explanation.
