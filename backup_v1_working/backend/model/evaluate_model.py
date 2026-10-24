"""
SMARTTWIN AI - Model Evaluation Module
Verifies model performance against the UCI AI4I 2020 test set.
"""

import os
import json
import pandas as pd
import joblib
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score
from sklearn.model_selection import train_test_split

try:
    from backend.model.train_model import FEATURE_COLUMNS, TARGET_COLUMN, get_project_root
except ImportError:
    from train_model import FEATURE_COLUMNS, TARGET_COLUMN, get_project_root


def evaluate_existing_model():
    root = get_project_root()
    model_path = os.path.join(root, "models", "predictive_maintenance_pipeline.joblib")
    data_path = os.path.join(root, "data", "ai4i2020.csv")
    metrics_path = os.path.join(root, "models", "metrics.json")

    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found at {model_path}. Run train_model.py first.")
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset file not found at {data_path}.")

    pipeline = joblib.load(model_path)
    df = pd.read_csv(data_path)

    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMN].astype(int)

    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    y_pred = pipeline.predict(X_test)
    y_pred_proba = pipeline.predict_proba(X_test)[:, 1]

    report = classification_report(y_test, y_pred, target_names=["Healthy (0)", "Failure (1)"], output_dict=True)
    cm = confusion_matrix(y_test, y_pred)
    roc_auc = roc_auc_score(y_test, y_pred_proba)

    print("==================================================")
    print("      SMARTTWIN AI - MODEL EVALUATION REPORT      ")
    print("==================================================")
    print(classification_report(y_test, y_pred, target_names=["Healthy (0)", "Failure (1)"]))
    print(f"ROC-AUC: {roc_auc:.4f}")
    print("Confusion Matrix:")
    print(cm)
    print("==================================================")

    return {
        "classification_report": report,
        "confusion_matrix": cm.tolist(),
        "roc_auc": float(roc_auc)
    }


if __name__ == "__main__":
    evaluate_existing_model()
