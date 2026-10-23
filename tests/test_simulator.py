"""
Unit tests for MachineSimulator and Digital Twin physics engine.
"""

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
    vib_range = max(vibrations) - min(vibrations)
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

