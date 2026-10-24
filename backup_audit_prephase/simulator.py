"""
SMARTTWIN AI - Machine Simulator Engine
Generates physically plausible digital-twin telemetry, handles operating scenarios,
calculates health score, logs sensor telemetry to SQLite, and triggers rule and ML alerts.
"""

import math
import random
from datetime import datetime
from typing import Dict, Any, List, Optional

try:
    from backend.model.predictor import SmartTwinPredictor, kelvin_to_celsius
    from backend.database import save_sensor_reading, save_alert
except ImportError:
    from model.predictor import SmartTwinPredictor, kelvin_to_celsius
    from database import save_sensor_reading, save_alert


class MachineSimulator:
    def __init__(self, predictor: Optional[SmartTwinPredictor] = None):
        self.predictor = predictor or SmartTwinPredictor()

        # Operational State
        self.is_running: bool = True
        self.is_paused: bool = False
        self.machine_type: str = "M"
        self.scenario: str = "normal"  # normal, warning, hdf, pwf, twf, osf

        # Physical parameters (nominal baseline)
        self.air_temperature_k: float = 298.2   # ~25.0 C
        self.process_temperature_k: float = 308.6 # ~35.4 C
        self.rotational_speed: float = 1480.0   # RPM
        self.torque: float = 40.0              # Nm
        self.tool_wear: float = 35.0           # minutes
        self.vibration: float = 1.55           # mm/s (Simulated external measurement)

        self.health_score: float = 95.0
        self.history_buffer: List[Dict[str, Any]] = []
        self.max_history: int = 50

        # Debouncing alert timestamps
        self.last_alert_time: float = 0.0

    def set_scenario(self, scenario: str):
        """Sets the operating scenario."""
        valid_scenarios = ["normal", "warning", "hdf", "pwf", "twf", "osf"]
        clean_scenario = scenario.lower().strip()
        if clean_scenario in valid_scenarios:
            self.scenario = clean_scenario
        else:
            self.scenario = "normal"

    def set_machine_type(self, m_type: str):
        if m_type.upper() in ["L", "M", "H"]:
            self.machine_type = m_type.upper()

    def pause(self):
        self.is_paused = True

    def resume(self):
        self.is_paused = False

    def reset(self):
        """Resets simulator to factory nominal values."""
        self.air_temperature_k = 298.2
        self.process_temperature_k = 308.6
        self.rotational_speed = 1480.0
        self.torque = 40.0
        self.tool_wear = 20.0
        self.vibration = 1.45
        self.scenario = "normal"
        self.health_score = 96.0
        self.is_paused = False

    def _calculate_health_score(self, failure_prob: float) -> float:
        """
        Calculates machine health percentage (0 - 100%)
        Combines ML failure probability and physical parameter deviations.
        """
        base = 100.0 - (failure_prob * 60.0)

        # Penalize process temp elevation (> 315 K / 42 C)
        if self.process_temperature_k > 315.0:
            base -= (self.process_temperature_k - 315.0) * 2.0

        # Penalize excessive vibration
        if self.vibration > 2.2:
            base -= (self.vibration - 2.2) * 15.0

        # Penalize severe tool wear (> 180 min)
        if self.tool_wear > 180.0:
            base -= (self.tool_wear - 180.0) * 0.35

        # Penalize torque extremes
        if self.torque > 55.0:
            base -= (self.torque - 55.0) * 0.8

        return max(5.0, min(100.0, round(base, 1)))

    def step(self) -> Dict[str, Any]:
        """
        Advances the simulation by one step.
        Calculates new physics-based values with smooth transition dynamics.
        """
        if self.is_paused:
            return self.get_current_state()

        # Target setpoints depending on scenario
        if self.scenario == "normal":
            target_air = 298.2 + random.uniform(-0.4, 0.4)
            target_proc = target_air + 10.4 + random.uniform(-0.3, 0.3)
            target_rpm = 1480.0 + random.uniform(-25, 25)
            target_torque = 40.0 + random.uniform(-2.5, 2.5)
            wear_increment = 0.15
            target_vib = 1.5 + random.uniform(-0.15, 0.15)

        elif self.scenario == "warning":
            target_air = 300.5 + random.uniform(-0.3, 0.3)
            target_proc = 313.2 + random.uniform(-0.5, 0.5)
            target_rpm = 1560.0 + random.uniform(-35, 35)
            target_torque = 54.0 + random.uniform(-3.0, 3.0)
            wear_increment = 0.4
            target_vib = 2.4 + random.uniform(-0.2, 0.2)

        elif self.scenario == "hdf":  # Heat Dissipation Fault
            target_air = 303.8 + random.uniform(-0.2, 0.2)
            target_proc = 309.2 + random.uniform(-0.2, 0.2)  # Diff < 6 K!
            target_rpm = 1320.0 + random.uniform(-20, 20)    # Low airflow
            target_torque = 48.0 + random.uniform(-2.0, 2.0)
            wear_increment = 0.2
            target_vib = 2.2 + random.uniform(-0.15, 0.15)

        elif self.scenario == "pwf":  # Power Failure (high torque/strain)
            target_air = 301.0 + random.uniform(-0.3, 0.3)
            target_proc = 314.5 + random.uniform(-0.4, 0.4)
            target_rpm = 1260.0 + random.uniform(-30, 30)
            target_torque = 74.0 + random.uniform(-3.5, 3.5)  # Over 9000 W power!
            wear_increment = 0.6
            target_vib = 3.2 + random.uniform(-0.25, 0.25)

        elif self.scenario == "twf":  # Tool Wear Failure
            target_air = 300.8 + random.uniform(-0.3, 0.3)
            target_proc = 315.0 + random.uniform(-0.5, 0.5)
            target_rpm = 1450.0 + random.uniform(-30, 30)
            target_torque = 58.0 + random.uniform(-3.0, 3.0)
            wear_increment = 1.2
            # Accelerate wear toward 220+ min
            if self.tool_wear < 205.0:
                self.tool_wear = 205.0
            target_vib = 3.4 + random.uniform(-0.2, 0.2)

        elif self.scenario == "osf":  # Overstrain Fault
            target_air = 302.0 + random.uniform(-0.4, 0.4)
            target_proc = 316.2 + random.uniform(-0.5, 0.5)
            target_rpm = 1380.0 + random.uniform(-30, 30)
            target_torque = 68.0 + random.uniform(-2.5, 2.5)
            wear_increment = 0.8
            if self.tool_wear < 190.0:
                self.tool_wear = 190.0
            target_vib = 3.1 + random.uniform(-0.2, 0.2)
        else:
            target_air = 298.2
            target_proc = 308.6
            target_rpm = 1480.0
            target_torque = 40.0
            wear_increment = 0.1
            target_vib = 1.5

        # Smooth low-pass transition filter (physics emulation)
        alpha = 0.25
        self.air_temperature_k = round(self.air_temperature_k + alpha * (target_air - self.air_temperature_k), 2)
        self.process_temperature_k = round(self.process_temperature_k + alpha * (target_proc - self.process_temperature_k), 2)
        self.rotational_speed = round(self.rotational_speed + alpha * (target_rpm - self.rotational_speed), 1)
        self.torque = round(self.torque + alpha * (target_torque - self.torque), 2)
        self.vibration = round(max(0.5, self.vibration + alpha * (target_vib - self.vibration)), 2)

        self.tool_wear = round(min(300.0, self.tool_wear + wear_increment), 1)

        # Run real ML inference with predictor
        pred_res = self.predictor.predict({
            "type": self.machine_type,
            "air_temperature_k": self.air_temperature_k,
            "process_temperature_k": self.process_temperature_k,
            "rotational_speed_rpm": self.rotational_speed,
            "torque_nm": self.torque,
            "tool_wear_min": self.tool_wear
        })

        failure_prob = pred_res.get("prediction", {}).get("failure_probability", 0.0) if pred_res.get("success") else 0.0
        self.health_score = self._calculate_health_score(failure_prob)

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Snapshot structure
        reading = {
            "timestamp": now_str,
            "machine_type": self.machine_type,
            "air_temperature_k": self.air_temperature_k,
            "air_temperature_c": kelvin_to_celsius(self.air_temperature_k),
            "process_temperature_k": self.process_temperature_k,
            "process_temperature_c": kelvin_to_celsius(self.process_temperature_k),
            "rotational_speed": self.rotational_speed,
            "torque": self.torque,
            "tool_wear": self.tool_wear,
            "vibration": self.vibration,
            "health_score": self.health_score,
            "operating_mode": self.scenario,
            "ml_prediction": pred_res.get("prediction", {}),
            "ml_diagnostics": pred_res.get("diagnostics", {}),
            "rule_evaluation": pred_res.get("rule_based_evaluation", {})
        }

        # Persist reading to SQLite
        try:
            save_sensor_reading(reading)
        except Exception as e:
            print(f"[Simulator] Error saving sensor reading to DB: {e}")

        # Evaluate and trigger alerts
        self._evaluate_and_trigger_alerts(reading, pred_res)

        # Update rolling in-memory history buffer
        self.history_buffer.append(reading)
        if len(self.history_buffer) > self.max_history:
            self.history_buffer.pop(0)

        return reading

    def _evaluate_and_trigger_alerts(self, reading: Dict[str, Any], pred_res: Dict[str, Any]):
        """Creates alerts when conditions degrade, cleanly distinguishing ML vs Rule based alerts."""
        pred = pred_res.get("prediction", {})
        diagnostics = pred_res.get("diagnostics", {})
        rule_eval = pred_res.get("rule_based_evaluation", {})

        # 1. ML-Based Critical Alert
        if pred.get("failure_predicted") or pred.get("failure_probability", 0.0) >= 0.50:
            diag_reason = "Elevated multi-parameter failure probability detected."
            if diagnostics.get("suspected_modes"):
                diag_reason = f"Suspected: {diagnostics['suspected_modes'][0]['mode']} - {diagnostics['suspected_modes'][0]['reason']}"

            save_alert(
                severity="CRITICAL",
                alert_type="ML_FAILURE_RISK",
                message=f"[AI ALERT] {pred.get('failure_probability_percentage', 0)}% failure probability estimated. {diag_reason}",
                source="ML_MODEL",
                reading_snapshot=reading
            )

        # 2. Rule-Based Vibration Alert (Vibration is independent of ML model!)
        if reading["vibration"] > 3.2:
            save_alert(
                severity="CRITICAL",
                alert_type="VIBRATION_EXCESS",
                message=f"[RULE ALERT] Machine vibration reached {reading['vibration']:.2f} mm/s (critical limit: 3.2 mm/s). Inspect rotor unbalance.",
                source="RULE_THRESHOLD",
                reading_snapshot=reading
            )
        elif reading["vibration"] > 2.5:
            save_alert(
                severity="WARNING",
                alert_type="VIBRATION_WARNING",
                message=f"[RULE ALERT] Elevated machine vibration at {reading['vibration']:.2f} mm/s (stable threshold: 2.2 mm/s).",
                source="RULE_THRESHOLD",
                reading_snapshot=reading
            )

        # 3. Rule-Based Thermal Alert
        if reading["process_temperature_c"] > 43.0:
            save_alert(
                severity="WARNING",
                alert_type="THERMAL_WARNING",
                message=f"[RULE ALERT] Process temperature reached {reading['process_temperature_c']:.1f} °C ({reading['process_temperature_k']:.1f} K).",
                source="RULE_THRESHOLD",
                reading_snapshot=reading
            )

        # 4. Rule-Based Tool Wear Alert
        if reading["tool_wear"] >= 200.0:
            save_alert(
                severity="WARNING",
                alert_type="TOOL_WEAR_WARNING",
                message=f"[RULE ALERT] Cutting tool wear accumulated {reading['tool_wear']:.1f} min (critical limit: 200 min).",
                source="RULE_THRESHOLD",
                reading_snapshot=reading
            )

    def get_current_state(self) -> Dict[str, Any]:
        """Returns the most recent simulation state without advancing time."""
        if self.history_buffer:
            return self.history_buffer[-1]

        # Initial default state before first step
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        pred_res = self.predictor.predict({
            "type": self.machine_type,
            "air_temperature_k": self.air_temperature_k,
            "process_temperature_k": self.process_temperature_k,
            "rotational_speed_rpm": self.rotational_speed,
            "torque_nm": self.torque,
            "tool_wear_min": self.tool_wear
        })

        return {
            "timestamp": now_str,
            "machine_type": self.machine_type,
            "air_temperature_k": self.air_temperature_k,
            "air_temperature_c": kelvin_to_celsius(self.air_temperature_k),
            "process_temperature_k": self.process_temperature_k,
            "process_temperature_c": kelvin_to_celsius(self.process_temperature_k),
            "rotational_speed": self.rotational_speed,
            "torque": self.torque,
            "tool_wear": self.tool_wear,
            "vibration": self.vibration,
            "health_score": self.health_score,
            "operating_mode": self.scenario,
            "is_paused": self.is_paused,
            "ml_prediction": pred_res.get("prediction", {}),
            "ml_diagnostics": pred_res.get("diagnostics", {}),
            "rule_evaluation": pred_res.get("rule_based_evaluation", {})
        }
