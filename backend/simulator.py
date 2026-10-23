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
    from backend.database import save_sensor_reading, save_alert, resolve_alert
except ImportError:
    from model.predictor import SmartTwinPredictor, kelvin_to_celsius
    from database import save_sensor_reading, save_alert, resolve_alert


class MachineSimulator:
    def __init__(self, predictor: Optional[SmartTwinPredictor] = None):
        self.predictor = predictor or SmartTwinPredictor()

        # Operational State
        self.is_running: bool = True
        self.is_paused: bool = False
        self.machine_type: str = "M"
        self.scenario: str = "normal"  # normal, warning, hdf, pwf, twf, osf

        # Physical parameters (nominal baseline)
        self.air_temperature_k: float = 298.2     # ~25.0 C
        self.process_temperature_k: float = 308.6 # ~35.4 C
        self.rotational_speed: float = 1480.0     # RPM
        self.torque: float = 40.0                # Nm
        self.tool_wear: float = 35.0             # minutes
        self.vibration: float = 1.55             # mm/s (Simulated external measurement)

        self.health_score: float = 95.0
        self.overall_status: str = "OPTIMAL"
        self.history_buffer: List[Dict[str, Any]] = []
        self.max_history: int = 100
        self.step_count: int = 0

    def set_scenario(self, scenario: str):
        """Sets the operating scenario."""
        valid_scenarios = ["normal", "warning", "hdf", "pwf", "twf", "osf"]
        clean_scenario = str(scenario).lower().strip()
        if clean_scenario in valid_scenarios:
            self.scenario = clean_scenario
        else:
            self.scenario = "normal"

    def set_machine_type(self, m_type: str):
        if str(m_type).upper() in ["L", "M", "H"]:
            self.machine_type = str(m_type).upper()

    def pause(self):
        self.is_paused = True

    def resume(self):
        self.is_paused = False

    def reset(self):
        """Resets simulator to factory nominal values."""
        self.step_count = 0
        self.air_temperature_k = 298.2
        self.process_temperature_k = 308.6
        self.rotational_speed = 1480.0
        self.torque = 40.0
        self.tool_wear = 20.0
        self.vibration = 1.45
        self.scenario = "normal"
        self.health_score = 96.0
        self.overall_status = "OPTIMAL"
        self.history_buffer = []
        self.is_paused = False

        # Resolve any active simulation alerts
        resolve_alert("TOOL_WEAR_WARNING", "RULE_THRESHOLD")
        resolve_alert("THERMAL_WARNING", "RULE_THRESHOLD")
        resolve_alert("VIBRATION_WARNING", "RULE_THRESHOLD")
        resolve_alert("VIBRATION_EXCESS", "RULE_THRESHOLD")
        resolve_alert("ML_FAILURE_RISK", "ML_MODEL")

    def _determine_unified_condition(self, failure_prob: float, rule_status: str) -> tuple:
        """
        Calculates unified status and health score ensuring zero contradiction:
        - If ML Risk is HIGH or Rule is CRITICAL -> Status: CRITICAL, Health: 5 - 48%
        - Else if ML Risk is MODERATE or Rule is WARNING -> Status: WARNING, Health: 50 - 78%
        - Else -> Status: OPTIMAL, Health: 80 - 100%
        """
        ai_risk = "HIGH" if failure_prob >= 0.50 else ("MODERATE" if failure_prob >= 0.20 else "LOW")

        if ai_risk == "HIGH" or rule_status == "CRITICAL":
            status = "CRITICAL"
            base_score = 45.0 - (failure_prob * 35.0)
            health = max(5.0, min(48.0, round(base_score, 1)))
        elif ai_risk == "MODERATE" or rule_status == "WARNING":
            status = "WARNING"
            base_score = 78.0 - (failure_prob * 45.0)
            health = max(50.0, min(78.0, round(base_score, 1)))
        else:
            status = "OPTIMAL"
            base_score = 100.0 - (failure_prob * 60.0)
            health = max(80.0, min(100.0, round(base_score, 1)))

        return status, health

    def step(self) -> Dict[str, Any]:
        """
        Advances the simulation by one step.
        Calculates new physics-based values with smooth transition dynamics.
        Generates realistic dynamic variations representing actual milling cutting cycles.
        """
        if self.is_paused:
            return self.get_current_state()

        self.step_count += 1
        t = self.step_count

        # Target setpoints depending on scenario with realistic industrial harmonics
        if self.scenario == "normal":
            # Normal machining: subtle spindle load harmonics & ambient air drift
            cycle_rpm = 36.0 * math.sin(t * 0.32) + 14.0 * math.cos(t * 0.65) + random.uniform(-6.0, 6.0)
            target_rpm = 1480.0 + cycle_rpm

            cycle_torque = 4.2 * math.cos(t * 0.32) + 1.8 * math.sin(t * 0.65) + random.uniform(-1.0, 1.0)
            target_torque = 40.0 + cycle_torque

            target_air = 298.2 + 0.35 * math.sin(t * 0.05) + random.uniform(-0.1, 0.1)
            delta_t = 10.4 + 1.2 * math.sin(t * 0.22) + random.uniform(-0.25, 0.25)
            target_proc = target_air + delta_t

            wear_increment = 0.25
            cycle_vib = 0.32 * math.sin(t * 0.48) + 0.12 * math.cos(t * 0.95) + random.uniform(-0.05, 0.05)
            target_vib = 1.48 + cycle_vib

        elif self.scenario == "warning":
            # Mechanical stress operation (approaching continuous boundaries)
            cycle_rpm = 46.0 * math.sin(t * 0.35) + random.uniform(-8.0, 8.0)
            target_rpm = 1560.0 + cycle_rpm

            cycle_torque = 4.8 * math.cos(t * 0.35) + random.uniform(-1.5, 1.5)
            target_torque = 54.5 + cycle_torque

            target_air = 300.5 + 0.4 * math.sin(t * 0.05) + random.uniform(-0.1, 0.1)
            delta_t = 12.8 + 1.2 * math.sin(t * 0.2) + random.uniform(-0.2, 0.2)
            target_proc = target_air + delta_t

            wear_increment = 0.50
            target_vib = 2.45 + 0.30 * math.sin(t * 0.5) + random.uniform(-0.08, 0.08)

        elif self.scenario == "hdf":
            # Heat Dissipation Fault: Restricted airflow & ventilation collapse (Process - Air < 8.6 K at low RPM)
            target_air = 303.8 + 0.3 * math.sin(t * 0.08) + random.uniform(-0.1, 0.1)
            target_proc = 309.8 + 0.3 * math.cos(t * 0.08) + random.uniform(-0.1, 0.1)
            target_rpm = 1320.0 + 25.0 * math.sin(t * 0.25) + random.uniform(-6.0, 6.0)  # Below 1380 RPM threshold
            target_torque = 48.0 + 2.5 * math.cos(t * 0.3) + random.uniform(-1.0, 1.0)
            wear_increment = 0.30
            target_vib = 2.25 + 0.2 * math.sin(t * 0.4) + random.uniform(-0.08, 0.08)

        elif self.scenario == "pwf":
            # Power Failure: Spindle drive overload (Delivered power P > 9,000 W)
            target_air = 301.2 + 0.3 * math.sin(t * 0.08)
            target_proc = 314.5 + 0.8 * math.cos(t * 0.15)
            target_rpm = 1250.0 + 28.0 * math.sin(t * 0.25) + random.uniform(-8.0, 8.0)
            target_torque = 74.5 + 4.0 * math.cos(t * 0.25) + random.uniform(-1.5, 1.5)  # Surging to 75-79 Nm
            wear_increment = 0.65
            target_vib = 3.25 + 0.30 * math.sin(t * 0.5) + random.uniform(-0.1, 0.1)

        elif self.scenario == "twf":
            # Tool Wear Failure: Cutting insert flank wear exceeds 200 min critical lifespan
            if self.tool_wear < 202.0:
                self.tool_wear = 202.0
            wear_increment = 1.60

            target_air = 300.8 + 0.3 * math.sin(t * 0.08)
            target_proc = 315.2 + 0.6 * math.cos(t * 0.15)
            target_rpm = 1455.0 + 25.0 * math.sin(t * 0.3) + random.uniform(-8.0, 8.0)
            target_torque = 56.5 + 3.5 * math.cos(t * 0.3) + random.uniform(-1.5, 1.5)  # Friction increase
            target_vib = 3.45 + 0.30 * math.sin(t * 0.6) + random.uniform(-0.1, 0.1)    # Severe flank chatter (>3.2 mm/s)

        elif self.scenario == "osf":
            # Overstrain Failure: Combined stress product (Wear x Torque) exceeds metallurgical limit
            if self.tool_wear < 192.0:
                self.tool_wear = 192.0
            wear_increment = 0.90

            target_air = 302.0 + 0.4 * math.sin(t * 0.08)
            target_proc = 316.5 + 0.6 * math.cos(t * 0.15)
            target_rpm = 1380.0 + 22.0 * math.sin(t * 0.3) + random.uniform(-8.0, 8.0)
            target_torque = 68.5 + 3.0 * math.cos(t * 0.3) + random.uniform(-1.5, 1.5)
            target_vib = 3.20 + 0.25 * math.sin(t * 0.5) + random.uniform(-0.1, 0.1)

        else:
            target_air = 298.2
            target_proc = 308.6
            target_rpm = 1480.0
            target_torque = 40.0
            wear_increment = 0.20
            target_vib = 1.45

        # Smooth low-pass transition filter (physics emulation)
        alpha = 0.50
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
        rule_status = pred_res.get("rule_based_evaluation", {}).get("status", "OPTIMAL")

        # Unified condition calculation
        self.overall_status, self.health_score = self._determine_unified_condition(failure_prob, rule_status)

        now = datetime.now()
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")
        time_display = now.strftime("%H:%M:%S")

        # Snapshot structure
        reading = {
            "timestamp": now_str,
            "time": time_display,
            "step": self.step_count,
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
            "overall_status": self.overall_status,
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

        # Evaluate and trigger alerts with lifecycle management
        self._evaluate_and_trigger_alerts(reading, pred_res)

        # Update rolling in-memory history buffer
        self.history_buffer.append(reading)
        if len(self.history_buffer) > self.max_history:
            self.history_buffer.pop(0)

        return reading

    def _evaluate_and_trigger_alerts(self, reading: Dict[str, Any], pred_res: Dict[str, Any]):
        """Creates or updates alerts with lifecycle management and auto-resolution."""
        pred = pred_res.get("prediction", {})
        diagnostics = pred_res.get("diagnostics", {})

        # 1. ML Failure Alert Lifecycle
        if pred.get("failure_predicted") or pred.get("failure_probability", 0.0) >= 0.50:
            diag_reason = "Multi-variate degradation pattern detected."
            if diagnostics.get("suspected_modes"):
                diag_reason = f"{diagnostics['suspected_modes'][0]['mode']}: {diagnostics['suspected_modes'][0]['reason']}"

            save_alert(
                severity="CRITICAL",
                alert_type="ML_FAILURE_RISK",
                message=f"[AI ALERT] {pred.get('failure_probability_percentage', 0)}% failure probability estimated. {diag_reason}",
                source="ML_MODEL",
                reading_snapshot=reading
            )
        elif pred.get("failure_probability", 0.0) < 0.20:
            # Condition resolved
            resolve_alert("ML_FAILURE_RISK", "ML_MODEL")

        # 2. Vibration Alert Lifecycle (Separate External Measurement)
        if reading["vibration"] > 3.2:
            save_alert(
                severity="CRITICAL",
                alert_type="VIBRATION_EXCESS",
                message=f"[RULE ALERT] Machine vibration reached {reading['vibration']:.2f} mm/s (critical limit: 3.2 mm/s).",
                source="RULE_THRESHOLD",
                reading_snapshot=reading
            )
        elif reading["vibration"] > 2.2:
            save_alert(
                severity="WARNING",
                alert_type="VIBRATION_WARNING",
                message=f"[RULE ALERT] Elevated vibration at {reading['vibration']:.2f} mm/s (stable threshold: 2.2 mm/s).",
                source="RULE_THRESHOLD",
                reading_snapshot=reading
            )
        else:
            # Safe vibration range, resolve vibration alerts
            resolve_alert("VIBRATION_EXCESS", "RULE_THRESHOLD")
            resolve_alert("VIBRATION_WARNING", "RULE_THRESHOLD")

        # 3. Thermal Alert Lifecycle
        if reading["process_temperature_c"] > 43.0:
            save_alert(
                severity="WARNING",
                alert_type="THERMAL_WARNING",
                message=f"[RULE ALERT] Process temperature reached {reading['process_temperature_c']:.1f} °C ({reading['process_temperature_k']:.1f} K).",
                source="RULE_THRESHOLD",
                reading_snapshot=reading
            )
        else:
            resolve_alert("THERMAL_WARNING", "RULE_THRESHOLD")

        # 4. Tool Wear Alert Lifecycle
        if reading["tool_wear"] >= 200.0:
            save_alert(
                severity="WARNING",
                alert_type="TOOL_WEAR_WARNING",
                message=f"[RULE ALERT] Cutting tool wear accumulated {reading['tool_wear']:.1f} min (critical limit: 200 min).",
                source="RULE_THRESHOLD",
                reading_snapshot=reading
            )
        else:
            resolve_alert("TOOL_WEAR_WARNING", "RULE_THRESHOLD")

    def get_current_state(self) -> Dict[str, Any]:
        """Returns the most recent simulation state without advancing time."""
        if self.history_buffer:
            return self.history_buffer[-1]

        # Initial state before first step
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
            "overall_status": self.overall_status,
            "operating_mode": self.scenario,
            "is_paused": self.is_paused,
            "ml_prediction": pred_res.get("prediction", {}),
            "ml_diagnostics": pred_res.get("diagnostics", {}),
            "rule_evaluation": pred_res.get("rule_based_evaluation", {})
        }
