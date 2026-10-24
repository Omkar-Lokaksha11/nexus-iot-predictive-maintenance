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
