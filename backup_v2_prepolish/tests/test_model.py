"""
Unit tests for Machine Learning model, evaluation metrics, and predictor.
Includes regression tests for None-handling, temperature units, and validation.
"""

import os
import pytest
from backend.model.predictor import SmartTwinPredictor, kelvin_to_celsius, celsius_to_kelvin


def test_temperature_conversion():
    assert kelvin_to_celsius(273.15) == 0.0
    assert kelvin_to_celsius(298.15) == 25.0
    assert celsius_to_kelvin(25.0) == 298.15
    assert celsius_to_kelvin(0.0) == 273.15


def test_predictor_loads_existing_model():
    predictor = SmartTwinPredictor()
    assert predictor.model_loaded is True
    assert predictor.pipeline is not None
    assert predictor.load_error is None


def test_predictor_normal_machine_operation():
    predictor = SmartTwinPredictor()
    normal_input = {
        "type": "M",
        "air_temperature_k": 298.2,
        "process_temperature_k": 308.6,
        "rotational_speed_rpm": 1500.0,
        "torque_nm": 40.0,
        "tool_wear_min": 10.0
    }
    result = predictor.predict(normal_input)
    assert result["success"] is True
    assert result["model_loaded"] is True
    assert result["prediction"]["failure_predicted"] is False
    assert result["prediction"]["failure_probability"] < 0.30
    assert result["prediction"]["health_status"] in ["OPTIMAL", "WARNING"]


def test_predictor_failure_detection():
    predictor = SmartTwinPredictor()
    abnormal_input = {
        "type": "L",
        "air_temperature_k": 304.0,
        "process_temperature_k": 309.0,
        "rotational_speed_rpm": 1200.0,
        "torque_nm": 76.0,
        "tool_wear_min": 230.0
    }
    result = predictor.predict(abnormal_input)
    assert result["success"] is True
    assert result["prediction"]["failure_probability"] > 0.50
    assert result["prediction"]["failure_predicted"] is True
    assert result["prediction"]["health_status"] == "CRITICAL"
    assert len(result["diagnostics"]["suspected_modes"]) > 0


def test_predictor_celsius_inputs():
    predictor = SmartTwinPredictor()
    celsius_input = {
        "type": "H",
        "air_temperature_c": 25.0,
        "process_temperature_c": 35.0,
        "rotational_speed_rpm": 1520.0,
        "torque_nm": 38.0,
        "tool_wear_min": 5.0
    }
    result = predictor.predict(celsius_input)
    assert result["success"] is True
    assert result["input_features"]["air_temperature_c"] == 25.0


def test_regression_none_type_temperature_inputs():
    """
    REGRESSION TEST:
    Ensures that when optional temperature parameters are serialized as None,
    it does NOT raise:
    TypeError: float() argument must be a string or a real number, not 'NoneType'
    """
    predictor = SmartTwinPredictor()
    # Case A: air_temperature_k is None, air_temperature_c is provided
    payload_a = {
        "type": "M",
        "air_temperature_k": None,
        "air_temperature_c": 25.0,
        "process_temperature_k": None,
        "process_temperature_c": 35.0,
        "rotational_speed_rpm": 1500.0,
        "torque_nm": 40.0,
        "tool_wear_min": 10.0
    }
    res_a = predictor.predict(payload_a)
    assert res_a["success"] is True
    assert res_a["prediction"]["failure_predicted"] is False

    # Case B: air_temperature_c is None, air_temperature_k is provided
    payload_b = {
        "type": "M",
        "air_temperature_k": 298.2,
        "air_temperature_c": None,
        "process_temperature_k": 308.6,
        "process_temperature_c": None,
        "rotational_speed_rpm": 1500.0,
        "torque_nm": 40.0,
        "tool_wear_min": 10.0
    }
    res_b = predictor.predict(payload_b)
    assert res_b["success"] is True


def test_predictor_invalid_inputs():
    predictor = SmartTwinPredictor()

    valid_base = {
        "air_temperature_k": 298.2,
        "process_temperature_k": 308.6,
        "rotational_speed_rpm": 1500.0,
        "torque_nm": 40.0,
        "tool_wear_min": 10.0
    }

    # Invalid machine type
    with pytest.raises(ValueError, match="Invalid machine type"):
        predictor.predict({**valid_base, "type": "Z"})

    # Out of bounds temperature
    with pytest.raises(ValueError, match="Air temperature"):
        predictor.predict({**valid_base, "type": "M", "air_temperature_k": 100.0})

    # Out of bounds RPM
    with pytest.raises(ValueError, match="Rotational speed"):
        predictor.predict({**valid_base, "type": "M", "rotational_speed_rpm": 9000.0})

    # Missing air temperature
    with pytest.raises(ValueError, match="Missing required air temperature"):
        predictor.predict({
            "type": "M",
            "process_temperature_k": 308.6,
            "rotational_speed_rpm": 1500.0,
            "torque_nm": 40.0,
            "tool_wear_min": 10.0
        })


def test_missing_model_behavior():
    fake_path = os.path.join("non_existent_folder", "missing_pipeline.joblib")
    predictor = SmartTwinPredictor(model_path=fake_path)
    assert predictor.model_loaded is False
    res = predictor.predict({
        "type": "M",
        "air_temperature_k": 298.2,
        "process_temperature_k": 308.6,
        "rotational_speed_rpm": 1500.0,
        "torque_nm": 40.0,
        "tool_wear_min": 10.0
    })
    assert res["success"] is False
    assert res["model_loaded"] is False
    assert "not loaded" in res["error"].lower() or "not found" in res["error"].lower()
