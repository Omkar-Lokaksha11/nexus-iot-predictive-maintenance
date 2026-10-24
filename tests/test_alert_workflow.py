"""
Tests for SmartTwin AI Alert Assignment and Resolution Workflow Endpoints.
Verifies persistent SQLite storage, status transitions, audit history, and validation.
"""

import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import save_alert, get_connection

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_test_alerts():
    """Cleans up any test-generated alerts created during these tests."""
    yield
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM alert_actions WHERE alert_id IN (SELECT id FROM alerts WHERE is_test = 1 OR alert_type LIKE 'TEST_%');")
    c.execute("DELETE FROM alerts WHERE is_test = 1 OR alert_type LIKE 'TEST_%';")
    conn.commit()
    conn.close()


def test_alert_lifecycle_workflow():
    # 1. Create a test alert
    alert_id = save_alert(
        severity="CRITICAL",
        alert_type="TEST_SPINDLE_OVERHEAT",
        message="Test alert for automated workflow verification",
        source="TEST_SUITE",
        is_test=1
    )
    assert alert_id > 0

    # 2. Get alert details
    resp = client.get(f"/api/alerts/{alert_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["alert"]["id"] == alert_id
    assert data["alert"]["status"] == "NEW"
    assert len(data["alert"]["history"]) >= 1

    # 3. Assign alert to Mechanical Maintenance
    assign_resp = client.post(f"/api/alerts/{alert_id}/assign", json={
        "assigned_team": "Mechanical Maintenance",
        "assigned_person": "Er. Alex Bennett",
        "priority": "HIGH",
        "notes": "Urgent spindle thermal dissipation check"
    })
    assert assign_resp.status_code == 200
    assign_data = assign_resp.json()
    assert assign_data["success"] is True
    assert assign_data["alert"]["status"] == "ASSIGNED"
    assert assign_data["alert"]["assigned_team"] == "Mechanical Maintenance"
    assert assign_data["alert"]["assigned_person"] == "Er. Alex Bennett"
    assert assign_data["alert"]["priority"] == "HIGH"

    # 4. Update status to IN_PROGRESS
    status_resp = client.post(f"/api/alerts/{alert_id}/status", json={
        "status": "IN_PROGRESS",
        "performed_by": "Er. Alex Bennett",
        "notes": "Technician arrived at CNC station 4."
    })
    assert status_resp.status_code == 200
    assert status_resp.json()["alert"]["status"] == "IN_PROGRESS"

    # 5. Record a maintenance action
    action_resp = client.post(f"/api/alerts/{alert_id}/action", json={
        "action_performed": "Flushed radiator heat exchanger and cleaned coolant filter",
        "diagnosis": "Coolant particulate blockage caused thermal delta drop to 6.2 K",
        "technician_notes": "Radiator cleared. Coolant flow restored to 45 L/min.",
        "performed_by": "Er. Alex Bennett",
        "status_after": "IN_PROGRESS"
    })
    assert action_resp.status_code == 200
    assert action_resp.json()["success"] is True

    # 6. Check action history
    hist_resp = client.get(f"/api/alerts/{alert_id}/history")
    assert hist_resp.status_code == 200
    hist = hist_resp.json()["history"]
    assert len(hist) >= 4  # CREATED, ASSIGNED, STATUS_CHANGE, ACTION_TAKEN

    action_types = [h["action_type"] for h in hist]
    assert "CREATED" in action_types
    assert "ASSIGNED" in action_types
    assert "STATUS_CHANGE" in action_types
    assert "ACTION_TAKEN" in action_types

    # 7. Resolve alert with required notes
    resolve_resp = client.post(f"/api/alerts/{alert_id}/resolve", json={
        "resolution_notes": "Spindle cooling circuit flushed, heat dissipation restored to factory delta.",
        "resolution_category": "HARDWARE_REPAIR",
        "resolved_by": "Er. Alex Bennett",
        "follow_up": "Inspect coolant filter after 50 operating hours"
    })
    assert resolve_resp.status_code == 200
    resolved_alert = resolve_resp.json()["alert"]
    assert resolved_alert["status"] == "RESOLVED"
    assert resolved_alert["is_active"] == 0
    assert resolved_alert["resolution_notes"] is not None
    assert resolved_alert["resolved_by"] == "Er. Alex Bennett"


def test_resolve_alert_validation():
    alert_id = save_alert(
        severity="WARNING",
        alert_type="TEST_VALIDATION_ALERT",
        message="Validation test alert",
        source="TEST_SUITE",
        is_test=1
    )

    # Empty resolution notes must fail with 422 or 400
    resp = client.post(f"/api/alerts/{alert_id}/resolve", json={
        "resolution_notes": "",
        "resolved_by": "Tester"
    })
    assert resp.status_code in [400, 422]


def test_invalid_status_transition():
    alert_id = save_alert(
        severity="INFO",
        alert_type="TEST_STATUS_ALERT",
        message="Status test alert",
        source="TEST_SUITE",
        is_test=1
    )

    resp = client.post(f"/api/alerts/{alert_id}/status", json={
        "status": "NON_EXISTENT_STATUS"
    })
    assert resp.status_code in [400, 422]


def test_nonexistent_alert():
    resp = client.get("/api/alerts/99999999")
    assert resp.status_code == 404
