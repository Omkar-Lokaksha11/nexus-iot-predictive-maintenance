"""
SMARTTWIN AI - Machine Learning Training Pipeline
Dataset: Official UCI AI4I 2020 Predictive Maintenance Dataset
Reference: https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset
"""

import os
import sys
import json
import urllib.request
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
    classification_report
)
import joblib

DATASET_URLS = [
    "https://archive.ics.uci.edu/ml/machine-learning-databases/00601/ai4i2020.csv",
    "https://archive.ics.uci.edu/static/public/601/ai4i+2020+predictive+maintenance+dataset.zip"
]

FEATURE_COLUMNS = [
    "Type",
    "Air temperature [K]",
    "Process temperature [K]",
    "Rotational speed [rpm]",
    "Torque [Nm]",
    "Tool wear [min]"
]

TARGET_COLUMN = "Machine failure"
FAILURE_MODES = ["TWF", "HDF", "PWF", "OSF", "RNF"]


def get_project_root() -> str:
    current = os.path.dirname(os.path.abspath(__file__))
    # backend/model -> backend -> root
    return os.path.abspath(os.path.join(current, "..", ".."))


def ensure_dataset(data_path: str) -> str:
    """Download official UCI dataset if not present."""
    if os.path.exists(data_path) and os.path.getsize(data_path) > 10000:
        print(f"[Dataset] Using existing dataset at: {data_path}")
        return data_path

    os.makedirs(os.path.dirname(data_path), exist_ok=True)
    print(f"[Dataset] Attempting programmatic download of official UCI AI4I 2020 dataset...")

    downloaded = False
    for url in DATASET_URLS:
        try:
            print(f"[Dataset] Trying URL: {url}")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            with urllib.request.urlopen(req, timeout=25) as response:
                content = response.read()

                # If it's a zip file, extract ai4i2020.csv
                if url.endswith(".zip"):
                    import zipfile
                    import io
                    with zipfile.ZipFile(io.BytesIO(content)) as z:
                        csv_names = [n for n in z.namelist() if n.endswith(".csv")]
                        if csv_names:
                            with open(data_path, "wb") as f_out:
                                f_out.write(z.read(csv_names[0]))
                            downloaded = True
                            break
                else:
                    with open(data_path, "wb") as f_out:
                        f_out.write(content)
                    downloaded = True
                    break
        except Exception as exc:
            print(f"[Dataset] Download attempt failed for {url}: {exc}")

    if not downloaded or not os.path.exists(data_path):
        raise FileNotFoundError(
            f"Failed to automatically download the official UCI AI4I 2020 dataset.\n"
            f"Please manually download 'ai4i2020.csv' from:\n"
            f"https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset\n"
            f"and place it in: {data_path}"
        )

    print(f"[Dataset] Successfully saved dataset to {data_path} ({os.path.getsize(data_path)} bytes)")
    return data_path


def train_pipeline(data_path: str = None, models_dir: str = None) -> dict:
    """
    Executes reproducible ML training pipeline:
    1. Loads and validates official dataset
    2. Builds preprocessing + balanced Random Forest pipeline
    3. Evaluates with proper metrics
    4. Saves pipeline.joblib and metrics.json
    """
    root = get_project_root()
    if data_path is None:
        data_path = os.path.join(root, "data", "ai4i2020.csv")
    if models_dir is None:
        models_dir = os.path.join(root, "models")

    os.makedirs(models_dir, exist_ok=True)
    ensure_dataset(data_path)

    print("[Training] Loading dataset...")
    df = pd.read_csv(data_path)

    # Validate essential columns
    for col in FEATURE_COLUMNS + [TARGET_COLUMN]:
        if col not in df.columns:
            raise ValueError(f"Dataset missing expected column: '{col}'. Check that official AI4I 2020 dataset is used.")

    # Data integrity check
    df_clean = df.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN]).copy()
    print(f"[Training] Dataset shape: {df_clean.shape[0]} rows, {df_clean.shape[1]} columns")

    X = df_clean[FEATURE_COLUMNS]
    y = df_clean[TARGET_COLUMN].astype(int)

    # Class distribution analysis
    total_samples = len(y)
    failures_total = int(y.sum())
    healthy_total = total_samples - failures_total
    failure_rate_pct = round((failures_total / total_samples) * 100, 2)

    print(f"[Training] Total instances: {total_samples}")
    print(f"[Training] Healthy (0): {healthy_total} ({100 - failure_rate_pct:.2f}%)")
    print(f"[Training] Failure (1): {failures_total} ({failure_rate_pct:.2f}%)")
    print(f"[Training] Extreme class imbalance detected (failure rate ~3.4%).")
    print(f"[Training] Strategy: Using class_weight='balanced' in RandomForestClassifier to maximize failure recall.")

    # Stratified 80/20 train-test split for reproducibility
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    categorical_features = ["Type"]
    numerical_features = [
        "Air temperature [K]",
        "Process temperature [K]",
        "Rotational speed [rpm]",
        "Torque [Nm]",
        "Tool wear [min]"
    ]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(categories=[["L", "M", "H"]], handle_unknown="ignore"), categorical_features),
            ("num", StandardScaler(), numerical_features)
        ]
    )

    # Balanced Random Forest classifier
    model = RandomForestClassifier(
        n_estimators=120,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1
    )

    pipeline = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("classifier", model)
    ])

    print("[Training] Fitting pipeline...")
    pipeline.fit(X_train, y_train)

    print("[Evaluation] Running test evaluation...")
    y_pred = pipeline.predict(X_test)
    y_pred_proba = pipeline.predict_proba(X_test)[:, 1]

    # Metrics calculation
    accuracy = float(accuracy_score(y_test, y_pred))
    precision_fail = float(precision_score(y_test, y_pred, pos_label=1, zero_division=0))
    recall_fail = float(recall_score(y_test, y_pred, pos_label=1, zero_division=0))
    f1_fail = float(f1_score(y_test, y_pred, pos_label=1, zero_division=0))
    roc_auc = float(roc_auc_score(y_test, y_pred_proba))

    cm = confusion_matrix(y_test, y_pred)
    # cm: [[TN, FP], [FN, TP]]
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

    # Feature importances extraction
    ohe_names = list(pipeline.named_steps["preprocessor"].named_transformers_["cat"].get_feature_names_out(categorical_features))
    all_feature_names = ohe_names + numerical_features
    importances = pipeline.named_steps["classifier"].feature_importances_.tolist()
    feature_importance_dict = {
        name: round(float(imp), 4)
        for name, imp in sorted(zip(all_feature_names, importances), key=lambda x: x[1], reverse=True)
    }

    # Failure mode statistics in dataset
    failure_mode_counts = {}
    for fm in FAILURE_MODES:
        if fm in df_clean.columns:
            failure_mode_counts[fm] = int(df_clean[fm].sum())

    metrics_payload = {
        "dataset_name": "UCI AI4I 2020 Predictive Maintenance Dataset",
        "dataset_reference": "https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset",
        "model_architecture": "RandomForestClassifier (Balanced Ensemble)",
        "features_used": FEATURE_COLUMNS,
        "note_on_vibration": "Vibration is not an input feature in the UCI AI4I 2020 dataset and is not passed to the ML model. It is monitored separately as an external physical simulation.",
        "random_state": 42,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "class_distribution": {
            "total_samples": total_samples,
            "train_healthy": int((y_train == 0).sum()),
            "train_failure": int((y_train == 1).sum()),
            "test_healthy": int((y_test == 0).sum()),
            "test_failure": int((y_test == 1).sum()),
            "overall_failure_percentage": failure_rate_pct
        },
        "evaluation_metrics": {
            "accuracy": round(accuracy, 4),
            "precision_failure_class": round(precision_fail, 4),
            "recall_failure_class": round(recall_fail, 4),
            "f1_score_failure_class": round(f1_fail, 4),
            "roc_auc": round(roc_auc, 4)
        },
        "confusion_matrix": {
            "matrix": [[tn, fp], [fn, tp]],
            "true_negatives_healthy_correct": tn,
            "false_positives_false_alarms": fp,
            "false_negatives_missed_failures": fn,
            "true_positives_failures_detected": tp
        },
        "failure_mode_distribution": failure_mode_counts,
        "feature_importances": feature_importance_dict,
        "training_timestamp": pd.Timestamp.now().isoformat(),
        "imbalance_handling_justification": (
            "Because machine failures represent only ~3.4% of samples, standard accuracy can be misleading "
            "(a naive baseline predicting 0 for all instances achieves 96.6% accuracy but catches 0 failures). "
            "Using class_weight='balanced' penalizes missed failures, yielding a high Recall for failure events, "
            "which is crucial in industrial engineering to prevent catastrophic downtime."
        )
    }

    # Save artifacts
    model_filepath = os.path.join(models_dir, "predictive_maintenance_pipeline.joblib")
    metrics_filepath = os.path.join(models_dir, "metrics.json")

    joblib.dump(pipeline, model_filepath)
    with open(metrics_filepath, "w", encoding="utf-8") as f:
        json.dump(metrics_payload, f, indent=2)

    print(f"[Training] Model saved to: {model_filepath}")
    print(f"[Training] Metrics saved to: {metrics_filepath}")
    print(f"[Evaluation Summary]")
    print(f"  - Accuracy: {accuracy * 100:.2f}%")
    print(f"  - Failure Recall: {recall_fail * 100:.2f}% (True Positives: {tp} / {tp + fn})")
    print(f"  - Failure Precision: {precision_fail * 100:.2f}%")
    print(f"  - F1-Score: {f1_fail:.4f}")
    print(f"  - ROC-AUC: {roc_auc:.4f}")
    print(f"  - Confusion Matrix: TN={tn}, FP={fp}, FN={fn}, TP={tp}")

    return metrics_payload


if __name__ == "__main__":
    train_pipeline()
