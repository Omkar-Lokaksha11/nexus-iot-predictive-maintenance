"""
Integration tests for FastAPI endpoints.
Includes regression tests for alert deduplication, None-handling, and demo record filtering.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import save_alert, get_alerts

client = TestClient(app)


def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["system"] == "SmartTwin AI"
    assert data["model_loaded"] is True


def test_api_simulator_readings():
    response = client.get("/api/simulator/readings?step=false")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "current" in data
    assert "air_temperature_k" in data["current"]


def test_api_simulator_control():
    response = client.post("/api/simulator/control", json={
        "action": "pause",
        "scenario": "warning",
        "machine_type": "H"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["is_paused"] is True
    assert data["active_scenario"] == "warning"
    assert data["machine_type"] == "H"

    # Resume
    client.post("/api/simulator/control", json={"action": "resume", "scenario": "normal"})


def test_api_prediction_endpoint_valid():
    payload = {
        "type": "M",
        "air_temperature_k": 298.5,
        "process_temperature_k": 308.8,
        "rotational_speed_rpm": 1490.0,
        "torque_nm": 41.0,
        "tool_wear_min": 25.0
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "prediction" in data
    assert "failure_probability" in data["prediction"]
    assert "health_status" in data["prediction"]


def test_api_prediction_celsius_and_none_serialization():
    """Regression test: submitting with Celsius and None Kelvin fields succeeds."""
    payload = {
        "type": "M",
        "air_temperature_k": None,
        "air_temperature_c": 25.0,
        "process_temperature_k": None,
        "process_temperature_c": 35.4,
        "rotational_speed_rpm": 1500.0,
        "torque_nm": 40.0,
        "tool_wear_min": 15.0
    }
    response = client.post("/api/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["input_features"]["air_temperature_c"] == 25.0


def test_api_prediction_invalid_input():
    # Out of bounds speed
    response = client.post("/api/predict", json={
        "type": "M",
        "rotational_speed_rpm": 90000.0,
        "torque_nm": 40.0,
        "tool_wear_min": 10.0,
        "air_temperature_k": 298.0,
        "process_temperature_k": 308.0
    })
    assert response.status_code == 422  # Pydantic validation error


def test_api_model_metrics():
    response = client.get("/api/model/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "evaluation_metrics" in data
    assert "accuracy" in data["evaluation_metrics"]
    assert "confusion_matrix" in data


def test_api_alerts_lifecycle_and_deduplication():
    # Save multiple identical condition alerts in succession
    id1 = save_alert("WARNING", "TEST_DEDUP_TYPE", "Test warning reading 200.1", "RULE_THRESHOLD")
    id2 = save_alert("WARNING", "TEST_DEDUP_TYPE", "Test warning reading 200.2", "RULE_THRESHOLD")
    id3 = save_alert("CRITICAL", "TEST_DEDUP_TYPE", "Test critical reading 200.3", "RULE_THRESHOLD")

    # They should resolve to the same active alert ID with escalated severity
    assert id1 == id2
    assert id2 == id3

    # Query via API
    response = client.get("/api/alerts?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

    # Acknowledge the alert
    ack_resp = client.post(f"/api/alerts/{id1}/acknowledge")
    assert ack_resp.status_code == 200
    assert ack_resp.json()["success"] is True


def test_api_maintenance_records_and_export():
    # Add maintenance event
    post_resp = client.post("/api/maintenance", json={
        "technician_name": "Test Engineer",
        "action_type": "INSPECTION",
        "component": "SPINDLE_BEARING",
        "description": "Routine diagnostic inspection of main drive spindle.",
        "notes": "No vibration or anomalous wear detected.",
        "is_demo": 0
    })
    assert post_resp.status_code == 200
    assert post_resp.json()["success"] is True

    # List maintenance with filter
    list_resp = client.get("/api/maintenance?search=Routine&is_demo=0")
    assert list_resp.status_code == 200
    assert list_resp.json()["count"] >= 1

    # Export CSV
    export_resp = client.get("/api/maintenance/export?is_demo=0")
    assert export_resp.status_code == 200
    assert "text/csv" in export_resp.headers["content-type"]
    assert "Technician" in export_resp.text


def test_api_serves_frontend():
    # Root index
    resp_index = client.get("/")
    assert resp_index.status_code == 200
    assert "SmartTwin AI" in resp_index.text

    # Static CSS
    resp_css = client.get("/style.css")
    assert resp_css.status_code == 200
    assert "text/css" in resp_css.headers["content-type"]

    # Static JS
    resp_js = client.get("/script.js")
    assert resp_js.status_code == 200
    assert "SmartTwin AI" in resp_js.text
