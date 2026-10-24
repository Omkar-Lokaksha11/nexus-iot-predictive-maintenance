"""
SMARTTWIN AI - Predictor Module
Loads trained Scikit-learn pipeline, validates inputs, performs inference,
and provides mechanical engineering diagnostic explanations.
"""

import os
import math
import pandas as pd
import joblib

FEATURE_NAMES = [
    "Type",
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]"
]


def kelvin_to_celsius(k: float) -> float:
    return round(k - 273.15, 2)


def celsius_to_kelvin(c: float) -> float:
    return round(c + 273.15, 2)


class SmartTwinPredictor:
    def __init__(self, model_path: str = None):
        if model_path is None:
            root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            model_path = os.path.join(root, "models", "predictive_maintenance_pipeline.joblib")

        self.model_path = model_path
        self.pipeline = None
        self.model_loaded = False
        self.load_error = None
        self.load_model()

    def load_model(self):
        """Attempts to load the joblib pipeline."""
        if not os.path.exists(self.model_path):
            self.model_loaded = False
            self.load_error = f"Model artifact not found at: {self.model_path}. Please train the model first."
            return

        try:
            self.pipeline = joblib.load(self.model_path)
            self.model_loaded = True
            self.load_error = None
        except Exception as exc:
            self.model_loaded = False
            self.load_error = f"Failed to load model from {self.model_path}: {str(exc)}"

    def validate_inputs(self, input_data: dict) -> dict:
        """
        Validates and formats input parameters.
        Accepts:
            machine_type: 'L', 'M', or 'H'
            air_temperature_k: float (or air_temperature_c)
            process_temperature_k: float (or process_temperature_c)
            rotational_speed_rpm: float
            torque_nm: float
            tool_wear_min: float
        """
        # Validate machine type
        raw_type = str(input_data.get("type", input_data.get("machine_type", "M"))).upper().strip()
        if raw_type not in ["L", "M", "H"]:
            raise ValueError(f"Invalid machine type '{raw_type}'. Supported types are 'L', 'M', or 'H'.")

        # Validate temperatures (Kelvin or Celsius)
        if "air_temperature_k" in input_data:
            air_k = float(input_data["air_temperature_k"])
        elif "air_temperature_c" in input_data:
            air_k = celsius_to_kelvin(float(input_data["air_temperature_c"]))
        else:
            air_k = 298.2  # default nominal ~25 C

        if "process_temperature_k" in input_data:
            proc_k = float(input_data["process_temperature_k"])
        elif "process_temperature_c" in input_data:
            proc_k = celsius_to_kelvin(float(input_data["process_temperature_c"]))
        else:
            proc_k = air_k + 10.0  # nominal ~10 K above air

        if air_k < 250.0 or air_k > 350.0:
            raise ValueError(f"Air temperature {air_k:.1f} K ({kelvin_to_celsius(air_k):.1f} °C) is outside realistic operating bounds [250 K - 350 K].")

        if proc_k < 250.0 or proc_k > 370.0:
            raise ValueError(f"Process temperature {proc_k:.1f} K ({kelvin_to_celsius(proc_k):.1f} °C) is outside realistic operating bounds [250 K - 370 K].")

        # Validate rotational speed
        rpm = float(input_data.get("rotational_speed", input_data.get("rotational_speed_rpm", input_data.get("rpm", 1500))))
        if rpm < 500 or rpm > 4000:
            raise ValueError(f"Rotational speed {rpm:.1f} RPM is outside operating range [500 - 4000 RPM].")

        # Validate torque
        torque = float(input_data.get("torque", input_data.get("torque_nm", 40.0)))
        if torque < 0 or torque > 150:
            raise ValueError(f"Torque {torque:.1f} Nm is outside operating range [0 - 150 Nm].")

        # Validate tool wear
        tool_wear = float(input_data.get("tool_wear", input_data.get("tool_wear_min", 0.0)))
        if tool_wear < 0 or tool_wear > 500:
            raise ValueError(f"Tool wear {tool_wear:.1f} min is outside plausible range [0 - 500 min].")

        return {
            "Type": raw_type,
            "Air temperature [K]": round(air_k, 2),
            "Process temperature [K]": round(proc_k, 2),
            "Rotational speed [rpm]": round(rpm, 1),
            "Torque [Nm]": round(torque, 2),
            "Tool wear [min]": round(tool_wear, 1)
        }

    def _diagnose_failure_mode(self, validated: dict) -> dict:
        """
        Mechanical Engineering Diagnostic Heuristic
        Based on official AI4I 2020 failure mechanics:
        - TWF: Tool wear > 200 min
        - HDF: (Process temp - Air temp) < 8.6 K and Rotational speed < 1380 rpm
        - PWF: Power outside [3500 W, 9000 W]
        - OSF: Tool wear * Torque exceeds limits
        """
        air_k = validated["Air temperature [K]"]
        proc_k = validated["Process temperature [K]"]
        rpm = validated["Rotational speed [rpm]"]
        torque = validated["Torque [Nm]"]
        wear = validated["Tool wear [min]"]
        m_type = validated["Type"]

        temp_diff = proc_k - air_k
        rad_s = rpm * (2 * math.pi / 60)
        power_w = torque * rad_s

        osf_limit = 11000 if m_type == "L" else (12000 if m_type == "M" else 13000)
        overstrain_val = wear * torque

        suspected = []

        if wear >= 200:
            suspected.append({
                "mode": "Tool Wear Failure (TWF)",
                "reason": f"Tool accumulated {wear:.1f} operating minutes (limit: ~200-240 min). Flank wear exceeds critical threshold.",
                "action": "Immediate cutting tool replacement required to prevent workpiece damage or spindle jam."
            })

        if temp_diff < 8.6 and rpm < 1380:
            suspected.append({
                "mode": "Heat Dissipation Failure (HDF)",
                "reason": f"Thermal gradient (Process - Air = {temp_diff:.1f} K) is below heat dissipation threshold (<8.6 K) at low airflow speed ({rpm:.0f} RPM).",
                "action": "Inspect forced-air heat exchanger, coolant flow channels, and clean debris from radiator fins."
            })

        if power_w < 3500:
            suspected.append({
                "mode": "Power Failure - Underload (PWF)",
                "reason": f"Delivered spindle power ({power_w:.1f} W) is below minimum stable operating requirement (3,500 W).",
                "action": "Check motor electrical phase supply, inverter drive output, and belt transmission slip."
            })
        elif power_w > 9000:
            suspected.append({
                "mode": "Power Failure - Overload (PWF)",
                "reason": f"Delivered spindle power ({power_w:.1f} W) exceeds maximum continuous rating (9,000 W).",
                "action": "Reduce feed rate, verify cutting depth, and inspect for mechanical binding in gearbox."
            })

        if overstrain_val > osf_limit:
            suspected.append({
                "mode": "Overstrain Failure (OSF)",
                "reason": f"Combined load product (Wear {wear:.1f} min × Torque {torque:.1f} Nm = {overstrain_val:.0f}) exceeds type {m_type} limit ({osf_limit}).",
                "action": "Spindle bearing and drive shaft stress limit reached. Reduce machining torque immediately."
            })

        return {
            "power_watts": round(power_w, 1),
            "temp_diff_k": round(temp_diff, 2),
            "overstrain_product": round(overstrain_val, 1),
            "suspected_modes": suspected
        }

    def _evaluate_rule_based_status(self, validated: dict) -> dict:
        """
        Threshold-based physical condition check (independent of ML model).
        Allows comparing physics-based heuristics vs ML model inference.
        """
        air_k = validated["Air temperature [K]"]
        proc_k = validated["Process temperature [K]"]
        rpm = validated["Rotational speed [rpm]"]
        torque = validated["Torque [Nm]"]
        wear = validated["Tool wear [min]"]

        warnings = []
        criticals = []

        if proc_k > 313.15:  # > 40 C
            warnings.append(f"Process temperature high ({kelvin_to_celsius(proc_k):.1f} °C)")
        if proc_k > 318.15:  # > 45 C
            criticals.append(f"Process temperature critical ({kelvin_to_celsius(proc_k):.1f} °C)")

        if rpm < 1350 or rpm > 1750:
            warnings.append(f"Spindle speed deviating from nominal ({rpm:.0f} RPM)")
        if rpm < 1100 or rpm > 2200:
            criticals.append(f"Spindle speed severe deviation ({rpm:.0f} RPM)")

        if torque > 55.0:
            warnings.append(f"Elevated spindle torque ({torque:.1f} Nm)")
        if torque > 68.0:
            criticals.append(f"Spindle torque overload ({torque:.1f} Nm)")

        if wear > 180:
            warnings.append(f"Tool wear nearing lifespan ({wear:.1f} min)")
        if wear > 220:
            criticals.append(f"Tool wear critical ({wear:.1f} min)")

        if criticals:
            rule_status = "CRITICAL"
        elif warnings:
            rule_status = "WARNING"
        else:
            rule_status = "OPTIMAL"

        return {
            "status": rule_status,
            "warnings": warnings,
            "criticals": criticals,
            "summary": "Rule checks indicate normal operating parameters" if not warnings and not criticals else "; ".join(criticals + warnings)
        }

    def predict(self, input_data: dict) -> dict:
        """
        Predicts machine failure using the trained pipeline.
        Returns full diagnostic breakdown.
        """
        if not self.model_loaded:
            self.load_model()
            if not self.model_loaded:
                return {
                    "success": False,
                    "model_loaded": False,
                    "error": self.load_error or "Machine learning model is not loaded. Please train the model."
                }

        validated = self.validate_inputs(input_data)
        features_df = pd.DataFrame([validated])[FEATURE_NAMES]

        # Execute real inference through Scikit-learn pipeline
        prediction = int(self.pipeline.predict(features_df)[0])
        probabilities = self.pipeline.predict_proba(features_df)[0]
        failure_prob = float(probabilities[1])
        healthy_prob = float(probabilities[0])

        diagnostics = self._diagnose_failure_mode(validated)
        rule_check = self._evaluate_rule_based_status(validated)

        # Health status and recommendations
        if failure_prob >= 0.50 or prediction == 1:
            health_status = "CRITICAL"
            risk_level = "HIGH"
            general_advice = "High probability of machine failure detected by AI model. Halt operation for scheduled inspection."
        elif failure_prob >= 0.20:
            health_status = "WARNING"
            risk_level = "MEDIUM"
            general_advice = "Elevated risk detected. Monitor thermal and torque signatures closely and schedule preventative service."
        else:
            health_status = "OPTIMAL"
            risk_level = "LOW"
            general_advice = "Machine operating within safe industrial tolerances. No immediate maintenance intervention required."

        # Reconcile ML and physical diagnostics
        recommendations = []
        if diagnostics["suspected_modes"]:
            for m in diagnostics["suspected_modes"]:
                recommendations.append(f"[{m['mode']}] {m['action']}")
        else:
            recommendations.append(general_advice)

        # Disagreement explanation between ML and rule-based thresholds
        ml_rule_agreement = (prediction == 1 and rule_check["status"] == "CRITICAL") or (prediction == 0 and rule_check["status"] == "OPTIMAL")
        agreement_notes = "ML model and rule-based checks agree on machine status."
        if not ml_rule_agreement:
            if prediction == 1 and rule_check["status"] != "CRITICAL":
                agreement_notes = "ML model detects subtle multi-variate failure patterns before static individual thresholds are crossed."
            elif prediction == 0 and rule_check["status"] == "CRITICAL":
                agreement_notes = "Static rule threshold triggered, but ML model evaluates the overall parameter combination as within tolerable operating boundaries."

        return {
            "success": True,
            "model_loaded": True,
            "input_features": {
                "type": validated["Type"],
                "air_temperature_k": validated["Air temperature [K]"],
                "air_temperature_c": kelvin_to_celsius(validated["Air temperature [K]"]),
                "process_temperature_k": validated["Process temperature [K]"],
                "process_temperature_c": kelvin_to_celsius(validated["Process temperature [K]"]),
                "rotational_speed_rpm": validated["Rotational speed [rpm]"],
                "torque_nm": validated["Torque [Nm]"],
                "tool_wear_min": validated["Tool wear [min]"]
            },
            "prediction": {
                "failure_predicted": bool(prediction == 1),
                "failure_class": prediction,
                "failure_probability": round(failure_prob, 4),
                "failure_probability_percentage": round(failure_prob * 100, 2),
                "healthy_probability": round(healthy_prob, 4),
                "health_status": health_status,
                "risk_level": risk_level
            },
            "diagnostics": diagnostics,
            "rule_based_evaluation": rule_check,
            "ml_vs_rules": {
                "agree": ml_rule_agreement,
                "explanation": agreement_notes
            },
            "recommendations": recommendations,
            "transparency_note": "ML model evaluated solely on supported UCI AI4I features (Type, Air Temp, Process Temp, RPM, Torque, Tool Wear). Vibration is tracked separately on the dashboard as external simulation."
        }
