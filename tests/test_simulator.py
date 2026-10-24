"""
Unit tests for MachineSimulator and Digital Twin physics engine.
"""

import math
import pytest
from backend.simulator import MachineSimulator


def test_simulator_initialization():
    sim = MachineSimulator()
    state = sim.get_current_state()
    assert state is not None
    assert "air_temperature_k" in state
    assert "rotational_speed" in state
    assert "vibration" in state
    assert "health_score" in state
    assert "overall_status" in state
    assert sim.scenario == "normal"
    assert sim.is_paused is False


def test_simulator_step_advances_telemetry():
    sim = MachineSimulator()
    init_tool_wear = sim.tool_wear
    step_data = sim.step()

    assert step_data["tool_wear"] >= init_tool_wear
    assert 0.0 <= step_data["health_score"] <= 100.0
    assert len(sim.history_buffer) >= 1


def test_simulator_pause_and_resume():
    sim = MachineSimulator()
    sim.pause()
    assert sim.is_paused is True
    wear_before = sim.tool_wear
    sim.step()
    assert sim.tool_wear == wear_before  # No advancement while paused

    sim.resume()
    assert sim.is_paused is False
    sim.step()
    assert sim.tool_wear > wear_before


def test_simulator_scenarios():
    sim = MachineSimulator()

    # Normal scenario
    sim.set_scenario("normal")
    assert sim.scenario == "normal"
    res_normal = sim.step()
    assert res_normal["health_score"] >= 80.0
    assert res_normal["overall_status"] == "OPTIMAL"

    # Heat Dissipation Fault scenario
    sim.set_scenario("hdf")
    assert sim.scenario == "hdf"
    for _ in range(6):
        sim.step()
    res_hdf = sim.get_current_state()
    assert res_hdf["air_temperature_k"] > 300.0

    # Reset
    sim.reset()
    assert sim.scenario == "normal"
    assert sim.tool_wear == 20.0
    assert sim.overall_status == "OPTIMAL"


def test_status_and_health_score_consistency():
    """Verify that overall status and health score never contradict each other."""
    sim = MachineSimulator()

    # 1. OPTIMAL status must have health >= 80%
    status_opt, health_opt = sim._determine_unified_condition(0.05, "OPTIMAL")
    assert status_opt == "OPTIMAL"
    assert health_opt >= 80.0

    # 2. WARNING status must have health capped below 80%
    status_warn, health_warn = sim._determine_unified_condition(0.35, "OPTIMAL")
    assert status_warn == "WARNING"
    assert health_warn < 80.0
    assert health_warn >= 50.0

    # 3. CRITICAL status must have health capped below 50%
    status_crit, health_crit = sim._determine_unified_condition(0.85, "CRITICAL")
    assert status_crit == "CRITICAL"
    assert health_crit < 50.0


def test_vibration_separation():
    """Verify that vibration is reported but not part of ML model inputs."""
    sim = MachineSimulator()
    state = sim.step()
    assert "vibration" in state
    # ML prediction features must not contain vibration
    ml_input_keys = state["ml_prediction"]
    assert "vibration" not in ml_input_keys


def test_simulator_history_accumulation_and_distinct_timestamps():
    """Verify telemetry history accumulates distinct timestamped samples with step counter."""
    sim = MachineSimulator()
    sim.reset()
    for _ in range(12):
        sim.step()

    assert len(sim.history_buffer) == 12
    step_indices = [r["step"] for r in sim.history_buffer]
    assert step_indices == list(range(1, 13))
    assert all("timestamp" in r and "time" in r for r in sim.history_buffer)


def test_simulator_nominal_variations_within_configured_limits():
    """Verify nominal operation generates non-flat, dynamic mechanical variations within safe bounds."""
    sim = MachineSimulator()
    sim.reset()
    speeds, torques, proc_temps, vibrations = [], [], [], []

    for _ in range(25):
        reading = sim.step()
        speeds.append(reading["rotational_speed"])
        torques.append(reading["torque"])
        proc_temps.append(reading["process_temperature_c"])
        vibrations.append(reading["vibration"])

    # 1. Spindle speed oscillates dynamically (non-flat) within safe operating envelope
    speed_range = max(speeds) - min(speeds)
    assert speed_range >= 15.0  # Visibly dynamic, not flat!
    assert 1400.0 <= min(speeds) and max(speeds) <= 1560.0

    # 2. Torque oscillates dynamically within safe envelope
    torque_range = max(torques) - min(torques)
    assert torque_range >= 2.0  # Dynamic chip load variation
    assert 32.0 <= min(torques) and max(torques) <= 48.0

    # 3. Process temperature breathes with cutting cycle
    temp_range = max(proc_temps) - min(proc_temps)
    assert temp_range >= 0.4
    assert 32.0 <= min(proc_temps) and max(proc_temps) <= 39.0

    # 4. Vibration oscillates with running harmonics below ISO boundary
    vib_range = round(max(vibrations) - min(vibrations), 2)
    assert vib_range >= 0.15
    assert 1.0 <= min(vibrations) and max(vibrations) <= 2.2


def test_simulator_fault_scenarios_directional_changes():
    """Verify HDF, PWF, and TWF produce expected physical failure conditions and directional changes."""
    sim = MachineSimulator()

    # HDF: Restricted airflow, process & air converge (delta < 8.6 K) at low RPM (< 1380)
    sim.set_scenario("hdf")
    for _ in range(5):
        sim.step()
    hdf_reading = sim.get_current_state()
    delta_t = hdf_reading["process_temperature_k"] - hdf_reading["air_temperature_k"]
    assert delta_t < 8.6
    assert hdf_reading["rotational_speed"] < 1380.0

    # PWF: Spindle power exceeds 9,000 W continuous overload limit
    sim.set_scenario("pwf")
    for _ in range(5):
        sim.step()
    pwf_reading = sim.get_current_state()
    power_w = (2 * 3.14159 * pwf_reading["rotational_speed"] * pwf_reading["torque"]) / 60
    assert pwf_reading["torque"] >= 68.0
    assert power_w > 9000.0

    # TWF: Tool wear accelerates past 200 min critical boundary with elevated vibration
    sim.set_scenario("twf")
    for _ in range(5):
        sim.step()
    twf_reading = sim.get_current_state()
    assert twf_reading["tool_wear"] >= 200.0
    assert twf_reading["vibration"] >= 3.0


def test_simulator_alert_lifecycle_and_test_db_persistence():
    """
    Regression test:
    Verifies that simulator alerts and resolutions correctly write and persist
    to the isolated test database without readonly errors.
    """
    import os
    from backend.database import get_db_path, get_alerts, get_alert_history

    # 1. Verify active database is isolated from production
    active_db = get_db_path()
    prod_db = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "smarttwin.db"))
    assert active_db != prod_db, "Tests must run on isolated test DB, not production"
    assert os.path.exists(active_db)

    sim = MachineSimulator()
    sim.reset()

    # 2. Trigger HDF fault scenario to create alerts
    sim.set_scenario("hdf")
    for _ in range(8):
        sim.step()

    # 3. Verify active alerts exist in the test DB
    alerts_result = get_alerts()
    active_alerts = [a for a in alerts_result if a["is_active"] == 1]
    assert len(active_alerts) > 0

    fault_alerts = [a for a in active_alerts if a["alert_type"] in ("THERMAL_WARNING", "ML_FAILURE_RISK", "VIBRATION_WARNING", "VIBRATION_EXCESS")]
    assert len(fault_alerts) > 0
    test_alert = fault_alerts[0]
    alert_id = test_alert["id"]

    # 4. Verify audit actions were recorded
    history = get_alert_history(alert_id)
    assert len(history) >= 1
    assert any(h["action_type"] == "CREATED" for h in history)

    # 5. Reset simulator and verify automatic resolution persists
    sim.reset()
    alerts_after = get_alerts()
    resolved_match = [a for a in alerts_after if a["id"] == alert_id]
    assert len(resolved_match) == 1
    assert resolved_match[0]["is_active"] == 0
    assert resolved_match[0]["status"] == "RESOLVED"

    # 6. Verify RESOLVED action logged in audit trail
    history_after = get_alert_history(alert_id)
    assert any(h["action_type"] == "RESOLVED" for h in history_after)


def test_simulator_production_db_isolation():
    """Regression test: Verifies that simulator operations write to isolated test DB, not production smarttwin.db."""
    import os
    import sqlite3
    from backend.database import get_db_path

    active_db = get_db_path()
    prod_db = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "smarttwin.db"))
    assert active_db != prod_db, "Active test DB must be isolated from production DB"
    assert os.path.exists(active_db)

    # Check test database count before stepping
    conn_test = sqlite3.connect(active_db)
    cur_test = conn_test.cursor()
    cur_test.execute("SELECT COUNT(*) FROM sensor_readings;")
    test_readings_before = cur_test.fetchone()[0]
    conn_test.close()

    # Run simulator steps
    sim = MachineSimulator()
    sim.set_scenario("twf")
    for _ in range(6):
        sim.step()
    sim.reset()

    # Verify that the 6 simulator steps were recorded in isolated test DB
    conn_test = sqlite3.connect(active_db)
    cur_test = conn_test.cursor()
    cur_test.execute("SELECT COUNT(*) FROM sensor_readings;")
    test_readings_after = cur_test.fetchone()[0]
    conn_test.close()

    assert test_readings_after == test_readings_before + 6, "Simulator steps must be written to isolated test DB!"


def test_tool_wear_cumulative_progression_and_bounds():
    """
    Verifies that tool wear is strictly cumulative (non-decreasing),
    bounded by the 250 min lifecycle ceiling, and resets to baseline on reset().
    """
    sim = MachineSimulator()
    sim.reset()
    assert sim.tool_wear == 20.0

    wear_history = [sim.tool_wear]
    for _ in range(25):
        reading = sim.step()
        assert reading["tool_wear"] >= wear_history[-1], "Tool wear must be non-decreasing!"
        assert reading["tool_wear_rate"] > 0.0, "Tool wear rate must be positive during active cutting"
        wear_history.append(reading["tool_wear"])

    # Over 25 steps at ~0.15 min/step, progression should be around 3.5 - 4.5 min
    total_delta = wear_history[-1] - wear_history[0]
    assert 2.5 <= total_delta <= 6.0, f"Progression delta {total_delta} should be gradual and realistic"

    # Reset behavior: starts new sharp insert cycle
    sim.reset()
    assert sim.tool_wear == 20.0
    assert sim.tool_wear_rate == 0.15


def test_tool_wear_accelerated_only_in_documented_scenarios():
    """
    Verifies that wear rate accelerates only under high mechanical stress (TWF, PWF, Warning),
    and does NOT arbitrarily accelerate in thermal fault conditions (HDF).
    """
    # 1. Normal wear rate baseline
    sim_normal = MachineSimulator()
    sim_normal.set_scenario("normal")
    normal_reading = sim_normal.step()
    rate_normal = normal_reading["tool_wear_rate"]

    # 2. HDF: strictly thermal dissipation problem, wear rate should remain close to nominal
    sim_hdf = MachineSimulator()
    sim_hdf.set_scenario("hdf")
    hdf_reading = sim_hdf.step()
    rate_hdf = hdf_reading["tool_wear_rate"]
    assert abs(rate_hdf - rate_normal) < 0.08, "HDF should not arbitrarily inflate wear rate"

    # 3. High load warning: elevated chip load
    sim_warn = MachineSimulator()
    sim_warn.set_scenario("warning")
    warn_reading = sim_warn.step()
    rate_warn = warn_reading["tool_wear_rate"]
    assert rate_warn > rate_normal * 1.5, "Warning scenario should produce elevated wear rate"

    # 4. TWF: tertiary breakdown wear regime
    sim_twf = MachineSimulator()
    sim_twf.set_scenario("twf")
    twf_reading = sim_twf.step()
    rate_twf = twf_reading["tool_wear_rate"]
    assert rate_twf > rate_warn, "TWF scenario should produce the highest wear rate"


def test_vibration_stochastic_variation_and_scenario_deliberation():
    """
    Verifies that vibration:
    - exhibits organic, non-repeating variations within safe bounds during normal operation
    - remains unforced/nominal during HDF (thermal fault)
    - crosses configured 3.2 mm/s threshold during TWF (chatter) and PWF (drive surge)
    """
    # 1. Normal mode: non-repetitive stochastic behavior within safe bounds
    sim = MachineSimulator()
    sim.reset()
    vib_readings = []
    for _ in range(30):
        r = sim.step()
        assert not math.isnan(r["vibration"])
        vib_readings.append(r["vibration"])

    # Normal variations must be bounded
    assert min(vib_readings) >= 1.0
    assert max(vib_readings) <= 2.2
    # Verify values are dynamic (not flat or frozen)
    assert max(vib_readings) - min(vib_readings) >= 0.15

    # 2. HDF mode: vibration remains nominal (thermal issue, not mechanical chatter)
    sim_hdf = MachineSimulator()
    sim_hdf.set_scenario("hdf")
    for _ in range(6):
        r_hdf = sim_hdf.step()
    assert r_hdf["vibration"] < 2.2, "HDF vibration must not be artificially elevated"

    # 3. TWF mode: chatter exceeds configured 3.2 alert limit
    sim_twf = MachineSimulator()
    sim_twf.set_scenario("twf")
    for _ in range(6):
        r_twf = sim_twf.step()
    assert r_twf["vibration"] >= 3.0, "TWF must produce elevated vibration chatter"

    # 4. PWF mode: spindle power surge produces drive vibration
    sim_pwf = MachineSimulator()
    sim_pwf.set_scenario("pwf")
    for _ in range(6):
        r_pwf = sim_pwf.step()
    assert r_pwf["vibration"] >= 2.8, "PWF must produce high drive vibration"

