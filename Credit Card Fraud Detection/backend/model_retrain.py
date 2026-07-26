from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from sklearn.metrics import (
    confusion_matrix,
    precision_recall_fscore_support,
    average_precision_score,
)


# ─── Stage 1 feature columns (order matters — matches training) ──────────────

STAGE1_FEATURE_COLS = [
    "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10",
    "V11", "V12", "V13", "V14", "V15", "V16", "V17", "V18", "V19", "V20",
    "V21", "V22", "V23", "V24", "V25", "V26", "V27", "V28",
    "sin_hour", "cos_hour", "scaled_time", "scaled_log_amount", "anomaly_score",
]


def _score_stack(models_dict, meta_learner, X):
    rf_prob = models_dict["rf"].predict_proba(X)[:, 1]
    xgb_prob = models_dict["xgb"].predict_proba(X)[:, 1]
    cat_prob = models_dict["catboost"].predict_proba(X)[:, 1]
    meta_X = np.column_stack([rf_prob, xgb_prob, cat_prob])
    return meta_learner.predict_proba(meta_X)[:, 1]


def _metrics_at_threshold(y_true, y_prob, threshold: float) -> dict:
    y_pred = (y_prob >= threshold).astype(int)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, average="binary", zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    pr_auc = average_precision_score(y_true, y_prob)
    tn, fp, fn, tp = cm.ravel()
    return {
        "threshold": threshold,
        "precision": round(float(precision), 4),
        "recall": round(float(recall), 4),
        "f1": round(float(f1), 4),
        "pr_auc": round(float(pr_auc), 4),
        "confusion_matrix": {
            "true_negative": int(tn),
            "false_positive": int(fp),
            "false_negative": int(fn),
            "true_positive": int(tp),
        },
        "n_samples": int(len(y_true)),
        "n_fraud": int(y_true.sum()),
    }


def _stage1_stack_and_holdout(models: dict):
    """Shared setup for both public functions below: validates that
    ulb_data.csv and the required model artifacts are loaded, and returns
    (X_test, y_test, live_stack_or_None). Raises if the held-out data isn't
    available — both callers treat that as a 404, not a 500."""
    if "ulb_data" not in models:
        raise FileNotFoundError("ulb_data.csv was not loaded at startup (check MODEL_DIR)")

    df = models["ulb_data"]
    missing = [c for c in STAGE1_FEATURE_COLS + ["Class"] if c not in df.columns]
    if missing:
        raise ValueError(f"ulb_data.csv is missing expected column(s): {missing}")

    X_test = df[STAGE1_FEATURE_COLS]
    y_test = df["Class"]

    live_stack = None
    if "meta_learner" in models and "rf" in models and "catboost" in models:
        live_stack = {"rf": models["rf"], "xgb": models["stage1_xgb"], "catboost": models["catboost"]}

    return X_test, y_test, live_stack


# ─── Static metrics for the currently-LIVE model  ───────────────

def compute_live_metrics(models: dict, threshold: float) -> dict:
    """Pure compute: evaluates the model already loaded in app.py's `models`
    dict against the held-out split of ulb_data.csv. Zero writes, zero
    Firestore, safe to call on every dashboard load.
    """
    X_test, y_test, live_stack = _stage1_stack_and_holdout(models)

    if live_stack is not None:
        y_prob = _score_stack(live_stack, models["meta_learner"], X_test)
    else:
        y_prob = models["stage1_xgb"].predict_proba(X_test)[:, 1]

    result = _metrics_at_threshold(y_test, y_prob, threshold)
    result["evaluated_at"] = datetime.now(timezone.utc).isoformat()
    result["source"] = "live"
    return result


def stage1_holdout_probabilities(models: dict) -> np.ndarray:
    """Raw Stage 1 probability array instead of collapsing it to metrics. Used to
    compare incoming traffic's score distribution against the held-out set
    the model was validated on — a proxy for input drift, since we have no
    ground-truth labels for live traffic to check accuracy drift directly.
    """
    X_test, _y_test, live_stack = _stage1_stack_and_holdout(models)

    if live_stack is not None:
        return _score_stack(live_stack, models["meta_learner"], X_test)
    return models["stage1_xgb"].predict_proba(X_test)[:, 1]