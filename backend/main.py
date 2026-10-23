"""
SMARTTWIN AI - FastAPI Backend Application
AI-Based Digital Twin for Smart Manufacturing Using Predictive Maintenance
"""

import os
import json
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field, model_validator

from backend.model.predictor import SmartTwinPredictor, kelvin_to_celsius, celsius_to_kelvin
from backend.simulator import MachineSimulator
from backend.database import (
    save_prediction,
    get_recent_sensor_readings,
    get_alerts,
    get_alert_summary,
    acknowledge_alert,
    add_maintenance_event,
    get_maintenance_events,
    export_history_to_csv,
    get_recent_predictions
)

# Initialize application
app = FastAPI(
    title="SmartTwin AI API",
    description="Digital Twin and Predictive Maintenance Platform for Smart Manufacturing",
    version="2.1.0"
)

# Enable CORS for local development flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singletons for Predictor and Simulator
predictor_instance = SmartTwinPredictor()
simulator_instance = MachineSimulator(predictor=predictor_instance)


# ==============================================================================
# PYDANTIC SCHEMAS
# ==============================================================================

class PredictionRequest(BaseModel):
    type: str = Field(default="M", description="Machine grade: 'L' (Low), 'M' (Medium), 'H' (High)")
    air_temperature_k: Optional[float] = Field(default=None, description="Air temperature in Kelvin (e.g. 298.2)")
    air_temperature_c: Optional[float] = Field(default=None, description="Air temperature in Celsius (e.g. 25.0)")
    process_temperature_k: Optional[float] = Field(default=None, description="Process temperature in Kelvin (e.g. 308.6)")
    process_temperature_c: Optional[float] = Field(default=None, description="Process temperature in Celsius (e.g. 35.4)")
    rotational_speed_rpm: float = Field(..., ge=500.0, le=4000.0, description="Spindle speed in RPM")
    torque_nm: float = Field(..., ge=0.0, le=150.0, description="Spindle torque in Nm")
    tool_wear_min: float = Field(..., ge=0.0, le=500.0, description="Tool wear accumulation in minutes")

    @model_validator(mode="before")
    def check_and_normalize_inputs(cls, values):
        if not isinstance(values, dict):
            return values

        # 1. Normalize type / machine_type
        if "type" not in values and "machine_type" in values:
            values["type"] = values["machine_type"]
        raw_type = values.get("type", "M")
        if str(raw_type).upper().strip() not in ["L", "M", "H"]:
            raise ValueError("Machine type must be 'L', 'M', or 'H'.")

        # 2. Normalize rotational speed aliases
        if "rotational_speed_rpm" not in values or values["rotational_speed_rpm"] is None:
            for k in ["rotational_speed", "rpm"]:
                if values.get(k) is not None:
                    values["rotational_speed_rpm"] = values[k]
                    break

        # 3. Normalize torque aliases
        if "torque_nm" not in values or values["torque_nm"] is None:
            if values.get("torque") is not None:
                values["torque_nm"] = values["torque"]

        # 4. Normalize tool wear aliases
        if "tool_wear_min" not in values or values["tool_wear_min"] is None:
            for k in ["tool_wear", "wear"]:
                if values.get(k) is not None:
                    values["tool_wear_min"] = values[k]
                    break

        # 5. Validate temperatures
        air_k = values.get("air_temperature_k")
        air_c = values.get("air_temperature_c")
        if air_k is None and air_c is None:
            raise ValueError("Either air_temperature_k or air_temperature_c must be provided as a valid number.")

        proc_k = values.get("process_temperature_k")
        proc_c = values.get("process_temperature_c")
        if proc_k is None and proc_c is None:
            raise ValueError("Either process_temperature_k or process_temperature_c must be provided as a valid number.")

        return values


class SimulatorControlRequest(BaseModel):
    action: Optional[str] = Field(default="step", description="'step', 'pause', 'resume', 'reset'")
    scenario: Optional[str] = Field(default=None, description="'normal', 'warning', 'hdf', 'pwf', 'twf', 'osf'")
    machine_type: Optional[str] = Field(default=None, description="'L', 'M', or 'H'")


class MaintenanceEventRequest(BaseModel):
    technician_name: str = Field(..., min_length=2, max_length=100)
    action_type: str = Field(..., description="'INSPECTION', 'TOOL_REPLACEMENT', 'LUBRICATION', 'CALIBRATION', 'REPAIR'")
    component: str = Field(..., description="'SPINDLE_BEARING', 'CUTTING_TOOL', 'COOLING_SYSTEM', 'MOTOR_DRIVE'")
    description: str = Field(..., min_length=5, max_length=500)
    notes: Optional[str] = Field(default=None, max_length=500)
    is_demo: Optional[int] = Field(default=0, ge=0, le=1)


# ==============================================================================
# API ENDPOINTS
# ==============================================================================

@app.get("/api/health", tags=["Health"])
def health_check():
    """Returns application, database, and machine learning model status."""
    return {
        "status": "online",
        "system": "SmartTwin AI",
        "version": "2.1.0",
        "model_loaded": predictor_instance.model_loaded,
        "model_path": predictor_instance.model_path,
        "simulator_running": not simulator_instance.is_paused,
        "active_scenario": simulator_instance.scenario,
        "machine_type": simulator_instance.machine_type
    }


@app.get("/api/simulator/readings", tags=["Simulator"])
def get_simulator_readings(step: bool = Query(True, description="Whether to tick the simulation by 1 step")):
    """Returns current machine telemetry and recent bounded history."""
    if step:
        current_data = simulator_instance.step()
    else:
        current_data = simulator_instance.get_current_state()

    return {
        "success": True,
        "current": current_data,
        "reading": current_data,
        "history": simulator_instance.history_buffer,
        "active_scenario": simulator_instance.scenario,
        "machine_type": simulator_instance.machine_type,
        "is_paused": simulator_instance.is_paused
    }


@app.post("/api/simulator/control", tags=["Simulator"])
def control_simulator(payload: SimulatorControlRequest):
    """Controls simulation execution state and demonstration scenario."""
    if payload.action == "pause":
        simulator_instance.pause()
    elif payload.action == "resume":
        simulator_instance.resume()
    elif payload.action == "reset":
        simulator_instance.reset()
    elif payload.action == "step":
        simulator_instance.step()

    if payload.scenario:
        simulator_instance.set_scenario(payload.scenario)

    if payload.machine_type:
        simulator_instance.set_machine_type(payload.machine_type)

    return {
        "success": True,
        "is_paused": simulator_instance.is_paused,
        "active_scenario": simulator_instance.scenario,
        "machine_type": simulator_instance.machine_type,
        "state": simulator_instance.get_current_state()
    }


@app.post("/api/predict", tags=["AI Prediction"])
def predict_machine_failure(payload: PredictionRequest):
    """
    Submits machine parameters to the trained ML model.
    Returns real inference probability, predicted class, and diagnostic advice.
    """
    if not predictor_instance.model_loaded:
        predictor_instance.load_model()
        if not predictor_instance.model_loaded:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=predictor_instance.load_error or "ML model is not loaded. Train the model first."
            )

    req_dict = payload.model_dump()
    try:
        result = predictor_instance.predict(req_dict)
    except ValueError as val_err:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Inference error: {str(exc)}")

    # Persist manual prediction to database
    if result.get("success"):
        try:
            pred_info = result["prediction"]
            inp = result["input_features"]
            rec = "; ".join(result.get("recommendations", []))
            save_prediction({
                "machine_type": inp["type"],
                "air_temperature_k": inp["air_temperature_k"],
                "process_temperature_k": inp["process_temperature_k"],
                "rotational_speed": inp["rotational_speed_rpm"],
                "torque": inp["torque_nm"],
                "tool_wear": inp["tool_wear_min"],
                "failure_predicted": pred_info["failure_predicted"],
                "failure_probability": pred_info["failure_probability"],
                "health_status": pred_info["health_status"],
                "recommendation": rec,
                "source": "MANUAL_UI"
            })
        except Exception as db_err:
            print(f"[API] Warning saving manual prediction to DB: {db_err}")

    return result


@app.get("/api/model/metrics", tags=["Model Evaluation"])
def get_model_metrics():
    """Retrieves real evaluation metrics produced during model training."""
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    metrics_path = os.path.join(root, "models", "metrics.json")

    if not os.path.exists(metrics_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Model metrics file not found. Please run backend/model/train_model.py first."
        )

    try:
        with open(metrics_path, "r", encoding="utf-8") as f:
            metrics_data = json.load(f)
        return metrics_data
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read metrics file: {str(exc)}"
        )


@app.get("/api/alerts", tags=["Alerts"])
def list_alerts(
    severity: Optional[str] = Query(None, description="'ALL', 'CRITICAL', 'WARNING', 'INFO'"),
    acknowledged: Optional[int] = Query(None, description="0 for unacknowledged, 1 for acknowledged"),
    is_active: Optional[int] = Query(None, description="1 for active, 0 for resolved"),
    include_test: bool = Query(False, description="Whether to include internal test-generated alerts"),
    limit: int = Query(50, ge=1, le=200)
):
    """Retrieves persisted machine alerts with filtering and summary metrics."""
    alerts = get_alerts(severity=severity, acknowledged=acknowledged, is_active=is_active, limit=limit, include_test=include_test)
    summary = get_alert_summary(include_test=include_test)
    return {
        "success": True,
        "count": len(alerts),
        "summary": summary,
        "alerts": alerts
    }


@app.post("/api/alerts/{alert_id}/acknowledge", tags=["Alerts"])
def acknowledge_existing_alert(alert_id: int):
    """Marks an alert as acknowledged by plant personnel."""
    updated = acknowledge_alert(alert_id)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert with ID {alert_id} not found.")
    return {"success": True, "message": f"Alert {alert_id} marked as acknowledged."}


@app.get("/api/maintenance", tags=["Maintenance"])
def list_maintenance_history(
    component: Optional[str] = Query(None),
    action_type: Optional[str] = Query(None),
    is_demo: Optional[int] = Query(None, description="0 for user logs, 1 for demo records"),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500)
):
    """Retrieves logged maintenance events with optional search and demo filters."""
    events = get_maintenance_events(
        component=component,
        action_type=action_type,
        is_demo=is_demo,
        search=search,
        limit=limit
    )
    return {
        "success": True,
        "count": len(events),
        "events": events
    }


@app.post("/api/maintenance", tags=["Maintenance"])
def log_maintenance_event(event: MaintenanceEventRequest):
    """Logs a new maintenance action to SQLite."""
    event_id = add_maintenance_event(
        technician_name=event.technician_name,
        action_type=event.action_type,
        component=event.component,
        description=event.description,
        notes=event.notes,
        is_demo=event.is_demo or 0
    )
    return {
        "success": True,
        "event_id": event_id,
        "message": "Maintenance record successfully persisted to database."
    }


@app.get("/api/maintenance/export", tags=["Maintenance"])
def export_maintenance_csv(is_demo: Optional[int] = Query(None)):
    """Generates and returns historical maintenance records as a downloadable CSV."""
    csv_content = export_history_to_csv(is_demo=is_demo)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=smarttwin_maintenance_history.csv"}
    )


# ==============================================================================
# FRONTEND STATIC SERVING
# ==============================================================================

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

@app.get("/", tags=["Frontend"])
def serve_index():
    """Serves the main SmartTwin AI dashboard."""
    index_path = os.path.join(PROJECT_ROOT, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return PlainTextResponse("SmartTwin AI: index.html not found.")


# Mount root directory for static assets
app.mount("/static", StaticFiles(directory=PROJECT_ROOT), name="static")

# Direct static routes
@app.get("/style.css", include_in_schema=False)
def serve_css():
    return FileResponse(os.path.join(PROJECT_ROOT, "style.css"), media_type="text/css")

@app.get("/script.js", include_in_schema=False)
def serve_js():
    return FileResponse(os.path.join(PROJECT_ROOT, "script.js"), media_type="application/javascript")

@app.get("/favicon.svg", include_in_schema=False)
def serve_favicon_svg():
    path = os.path.join(PROJECT_ROOT, "favicon.svg")
    if os.path.exists(path):
        return FileResponse(path, media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="favicon.svg not found")

@app.get("/favicon.ico", include_in_schema=False)
def serve_favicon_ico():
    ico_path = os.path.join(PROJECT_ROOT, "favicon.ico")
    if os.path.exists(ico_path):
        return FileResponse(ico_path, media_type="image/x-icon")
    svg_path = os.path.join(PROJECT_ROOT, "favicon.svg")
    if os.path.exists(svg_path):
        return FileResponse(svg_path, media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="favicon not found")
