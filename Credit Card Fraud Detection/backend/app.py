"""
Flask + SocketIO + Firebase
"""

import os
import json
import logging
import numpy as np
import pandas as pd
from math import sin, cos, pi, log1p
from datetime import datetime, timezone
import io
import csv
import random

import joblib
from flask import Flask, request, jsonify, Response
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS

import firebase_admin
from firebase_admin import credentials, firestore, auth
from google.cloud.firestore_v1.base_query import FieldFilter

import model_retrain

# ─── App Setup ────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "klaus-secret")
CORS(app, origins=["http://localhost:5173", "http://localhost:3000"])

socketio = SocketIO(
    app,
    cors_allowed_origins=["http://localhost:5173", "http://localhost:3000"],
    async_mode="threading",
)

# ─── Firebase Init ────────────────────────────────────────────────────────────

FIREBASE_CRED_PATH = os.environ.get("FIREBASE_CRED_PATH", "firebase-credentials.json")

if os.path.exists(FIREBASE_CRED_PATH):
    cred = credentials.Certificate(FIREBASE_CRED_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    logger.info("✅ Firebase connected")
else:
    logger.warning("⚠️  Firebase credentials not found — running without Firebase")
    db = None

# ─── Model Loading ────────────────────────────────────────────────────────────

MODEL_DIR = os.environ.get("MODEL_DIR", "./models")
FRAUD_THRESHOLD = float(os.environ.get("FRAUD_THRESHOLD", "0.5"))
STAGE1_EVAL_THRESHOLD = 0.2340

models = {}


def load_models():
    """Load all .pkl assets once at startup."""
    required = {
        "stage1_xgb":       "stage1_xgb.pkl",
        "stage2_gbm":       "stage2_gbm.pkl",
        "scaler_time":      "stage1_scaler_time.pkl",
        "scaler_log":       "stage1_scaler_log.pkl",
        "iso_forest":       "stage1_iso_forest.pkl",
        "malaysian_scaler": "malaysian_scaler.pkl",
        "rf":               "stage1_rf.pkl",
        "catboost":     "stage1_catboost.pkl",
        "meta_learner":     "meta_learner.pkl"
    }


    for key, fname in required.items():
        path = os.path.join(MODEL_DIR, fname)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Required model file missing: {path}")
        models[key] = joblib.load(path)
        logger.info(f"✅ Loaded {fname}")


    # Load Malaysian district profiles
    profiles_path = os.path.join(MODEL_DIR, "malaysian_profiles.csv")
    if not os.path.exists(profiles_path):
        raise FileNotFoundError(f"malaysian_profiles.csv missing from {MODEL_DIR}")
    models["district_profiles"] = pd.read_csv(profiles_path)
    logger.info(f"✅ Loaded malaysian_profiles.csv ({len(models['district_profiles'])} districts)")

    # Load demo X_test rows
    xtest_path = os.path.join(MODEL_DIR, "ulb_data.csv")
    if os.path.exists(xtest_path):
        models["ulb_data"] = pd.read_csv(xtest_path)
        logger.info(f"✅ Loaded ulb_data.csv")


# ─── Feature Engineering ─────────────────────────────────────────────────────

STAGE1_COLS = [
    "V1","V2","V3","V4","V5","V6","V7","V8","V9","V10",
    "V11","V12","V13","V14","V15","V16","V17","V18","V19","V20",
    "V21","V22","V23","V24","V25","V26","V27","V28",
    "sin_hour","cos_hour","scaled_time","scaled_log_amount","anomaly_score",
]

STAGE2_COLS = [
    "V1","V2","Amount_RM","Loc_Mean_Expenditure","Loc_Gini_Index","Spending_Deviation_Ratio"
]


def engineer_stage1(payload: dict) -> pd.DataFrame:
    """Build the 33-column Stage 1 feature vector."""
    time_val = float(payload["Time"])
    amount   = float(payload["Amount"])

    hour          = (time_val // 3600) % 24
    sin_hour      = sin(2 * pi * hour / 24)
    cos_hour      = cos(2 * pi * hour / 24)
    log_amount    = log1p(amount)
    scaled_time   = models["scaler_time"].transform([[time_val]])[0][0]
    scaled_log_am = models["scaler_log"].transform([[log_amount]])[0][0]

    row = {f"V{i}": float(payload[f"V{i}"]) for i in range(1, 29)}
    row.update({
        "sin_hour":          sin_hour,
        "cos_hour":          cos_hour,
        "scaled_time":       scaled_time,
        "scaled_log_amount": scaled_log_am,
    })
    df_pre = pd.DataFrame([row])

    # Anomaly score (iso_forest was fitted on same 32-col set minus anomaly_score itself)
    iso_input_cols = [
        "V1","V2","V3","V4","V5","V6","V7","V8","V9","V10",
        "V11","V12","V13","V14","V15","V16","V17","V18","V19","V20",
        "V21","V22","V23","V24","V25","V26","V27","V28",
        "sin_hour","cos_hour","scaled_time","scaled_log_amount",
    ]
    anomaly_score = models["iso_forest"].decision_function(df_pre[iso_input_cols])[0]
    row["anomaly_score"] = anomaly_score

    return pd.DataFrame([row])[STAGE1_COLS]


def engineer_stage2(payload: dict, district: str) -> pd.DataFrame | None:
    """Build the 6-column Stage 2 feature vector."""
    profiles = models["district_profiles"]
    match = profiles[profiles["district"].str.lower() == district.lower()]
    if match.empty:
        return None

    exp_mean = float(match["expenditure_mean"].iloc[0])
    gini     = float(match["gini"].iloc[0])
    amount_rm = float(payload["Amount"])

    row = {
        "V1":                     float(payload["V1"]),
        "V2":                     float(payload["V2"]),
        "Amount_RM":              amount_rm,
        "Loc_Mean_Expenditure":   exp_mean,
        "Loc_Gini_Index":         gini,
        "Spending_Deviation_Ratio": amount_rm / (exp_mean + 1e-5),
    }
    df = pd.DataFrame([row])[STAGE2_COLS]
    scaled = models["malaysian_scaler"].transform(df)
    return pd.DataFrame(scaled, columns=STAGE2_COLS), exp_mean, gini



# ─── Auth Middleware ──────────────────────────────────────────────────────────

def verify_token(req):
    """Returns (uid, is_admin, error_msg)."""
    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, False, "Missing token"
    token = auth_header.split(" ", 1)[1]
    try:
        decoded = auth.verify_id_token(token)
        uid = decoded["uid"]
        claims = decoded.get("custom_claims") or decoded
        is_admin = bool(claims.get("admin", False))
        return uid, is_admin, None
    except Exception as e:
        return None, False, str(e)


def require_auth(f):
    """Decorator: requires valid Firebase token."""
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if db is None:
            return f(*args, uid="dev-user", is_admin=False, **kwargs)
        uid, is_admin, err = verify_token(request)
        if err:
            return jsonify({"error": err}), 401
        return f(*args, uid=uid, is_admin=is_admin, **kwargs)
    return wrapper


def require_admin(f):
    """Decorator: requires admin role."""
    from functools import wraps
    @wraps(f)
    def wrapper(*args, **kwargs):
        if db is None:
            return f(*args, uid="dev-admin", is_admin=True, **kwargs)
        uid, is_admin, err = verify_token(request)
        if err:
            return jsonify({"error": err}), 401
        if not is_admin:
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, uid=uid, is_admin=is_admin, **kwargs)
    return wrapper


# ─── /predict ─────────────────────────────────────────────────────────────────

@app.route("/predict", methods=["POST"])
@require_auth
def predict(uid, is_admin):
    payload = request.get_json(force=True)

    # Validate V1–V28 are present
    missing = [f"V{i}" for i in range(1, 29) if f"V{i}" not in payload]
    if missing:
        return jsonify({"error": f"Missing features: {missing}"}), 400

    # ── Stage 1 ──
    try:
        X1 = engineer_stage1(payload)
    except Exception as e:
        logger.exception("Stage 1 feature engineering failed")
        return jsonify({"error": f"Stage 1 preprocessing error: {e}"}), 500

    # Use meta_learner stacking if available, else fall back to XGBoost directly
    try:
        if "meta_learner" in models and "rf" in models and "catboost" in models:
            rf_prob = models["rf"].predict_proba(X1)[0][1]
            xgb_prob = models["stage1_xgb"].predict_proba(X1)[0][1]
            cat_prob = models["catboost"].predict_proba(X1)[0][1]
            meta_X = np.array([[rf_prob, xgb_prob, cat_prob]])
            stage1_prob = float(models["meta_learner"].predict_proba(meta_X)[0][1])
        else:
            stage1_prob = float(models["stage1_xgb"].predict_proba(X1)[0][1])
    except Exception as e:
        logger.exception("Stage 1 prediction failed")
        return jsonify({"error": f"Stage 1 prediction error: {e}"}), 500

    # ── Short-circuit if Stage 1 fires ──
    if stage1_prob >= FRAUD_THRESHOLD:
        result = {
            "decision":        "BLOCK",
            "stage1_prob":     round(stage1_prob, 4),
            "stage2_prob":     None,
            "district_profile": None,
            "triggered_stage": 1,
        }
        result["id"] = _log_transaction(uid, payload, result )
        socketio.emit("fraud_alert", result, room=uid)
        if is_admin or True:  # broadcast to admin room
            socketio.emit("fraud_alert", {**result, "uid": uid}, room="admins")
        return jsonify(result)

    # ── Stage 2 ──
    district = payload.get("district", "")
    stage2_result = engineer_stage2(payload, district)

    if stage2_result is None:
        result = {
            "decision":        "HOLD",
            "stage1_prob":     round(stage1_prob, 4),
            "stage2_prob":     None,
            "district_profile": None,
            "triggered_stage": None,
            "message":         f"Unknown district: {district}",
        }
        result["id"] = _log_transaction(uid, payload, result)
        return jsonify(result)

    X2_scaled, exp_mean, gini = stage2_result
    try:
        stage2_prob = float(models["stage2_gbm"].predict_proba(X2_scaled)[0][1])
    except Exception as e:
        logger.exception("Stage 2 prediction failed")
        return jsonify({"error": f"Stage 2 prediction error: {e}"}), 500

    decision = "BLOCK" if stage2_prob >= FRAUD_THRESHOLD else "APPROVE"

    result = {
        "decision":         decision,
        "stage1_prob":      round(stage1_prob, 4),
        "stage2_prob":      round(stage2_prob, 4),
        "district_profile": {"expenditure_mean": round(exp_mean, 2), "gini": round(gini, 4)},
        "triggered_stage":  2 if decision == "BLOCK" else None,
    }

    result["id"] = _log_transaction(uid, payload, result)

    if decision == "BLOCK":
        socketio.emit("fraud_alert", result, room=uid)
        socketio.emit("fraud_alert", {**result, "uid": uid}, room="admins")

    return jsonify(result)

def _extract_district(location: str | None) -> str | None:
    if not location or "district_profiles" not in models:
        return location
    known = models["district_profiles"]["district"].dropna().unique()
    loc_lower = location.lower()
    for d in known:
        if d.lower() in loc_lower:
            return d
    return location 

def _normalize_txn(doc_id: str, data: dict) -> dict:
    if "userId" not in data:
        return {"id": doc_id, "source": "web", **data}

    raw_decision = str(data.get("decision") or "").strip().upper()
    status = str(data.get("status") or "").strip().lower()
    is_fraud = bool(data.get("is_fraud", False))
    resolved = raw_decision == "RESOLVED" or status == "resolved"

    if raw_decision == "FRAUD":
        decision = "BLOCK"
    elif raw_decision == "APPROVED":
        decision = "APPROVE"
    elif resolved:

        decision = "APPROVE"
    else:
        decision = "BLOCK" if is_fraud else "APPROVE"

    ts = data.get("timestamp")
    return {
        "id":         doc_id,
        "uid":        data.get("userId"),
        "timestamp":  ts.isoformat() if ts else None,
        "amount":     data.get("amount_rm"),
        "district":   _extract_district(data.get("location")),
        "decision":   decision,
        "stage1_prob": None,
        "stage2_prob": None,
        "triggered_stage": None,
        "area_expenditure_mean": None,
        "area_gini_index": None,
        "spending_deviation_ratio": None,
        "manually_reviewed": resolved,
        "source": "mobile",
        "card_bank":    data.get("card_bank"),
        "card_last4":   data.get("card_last4"),
        "card_network": data.get("card_network"),
        "location_raw": data.get("location"),
    }

def _log_transaction(uid: str, payload: dict, result: dict):
    """Persist transaction + result to Firestore."""
    if db is None:
        return None
    try:
        profile = result.get("district_profile") or {}
        exp_mean = profile.get("expenditure_mean")
        gini = profile.get("gini")

        amount = payload.get("Amount")
        spending_deviation = None
        if amount is not None and exp_mean:
            spending_deviation = round(float(amount) / (float(exp_mean) + 1e-5), 4)

        doc = {
            "uid":       uid,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "amount":    payload.get("Amount"),
            "district":  payload.get("district"),
            "decision":  result["decision"],
            "stage1_prob": result.get("stage1_prob"),
            "stage2_prob": result.get("stage2_prob"),
            "triggered_stage": result.get("triggered_stage"),
            "area_expenditure_mean": exp_mean,
            "area_gini_index":       gini,
            "spending_deviation_ratio": spending_deviation,
        }
        _, doc_ref = db.collection("transactions").add(doc)
        return doc_ref.id
    except Exception as e:
        logger.warning(f"Firestore log failed: {e}")
        return None

@app.route("/profile", methods=["GET"])
@require_auth
def get_profile(uid, is_admin):
    """Return this user's Firestore profile doc (phone, fullName, etc.)."""
    if db is None:
        return jsonify({"profile": None})
    try:
        doc = db.collection("users").document(uid).get()
        return jsonify({"profile": doc.to_dict() if doc.exists else None})
    except Exception as e:
        logger.exception("Failed to fetch profile")
        return jsonify({"error": str(e)}), 500

@app.route("/profile", methods=["POST"])
@require_auth
def upsert_profile(uid, is_admin):
    """Create/update this user's shared Firestore profile doc.
    Same 'users' collection as mobile app writes to."""
    if db is None:
        return jsonify({"error": "Database unavailable"}), 503
    payload = request.get_json(force=True) or {}
    phone = (payload.get("phone") or "").strip()
    full_name = (payload.get("fullName") or "").strip()
    email = (payload.get("email") or "").strip()

    try:
        ref = db.collection("users").document(uid)
        doc = ref.get()

        data = {"uid": uid, "email": email, "fullName": full_name, "phone": phone}

        if not doc.exists:
            data["role"] = "admin" if is_admin else "user"
            data["biometricsEnabled"] = False
            data["createdAt"] = firestore.SERVER_TIMESTAMP
        elif is_admin and doc.to_dict().get("role") != "admin":
            data["role"] = "admin"

        ref.set(data, merge=True)
        return jsonify({"message": "Profile saved"})
    except Exception as e:
        logger.exception("Failed to upsert profile")
        return jsonify({"error": str(e)}), 500
    
# ─── /transactions ────────────────────────────────────────────────────────────
@app.route("/transactions", methods=["GET"])
@require_auth
def get_transactions(uid, is_admin):
    if db is None:
        return jsonify({"transactions": []})
    try:
        col = db.collection("transactions")

        if is_admin:
            docs = col.limit(500).stream()
        else:
            own_docs = col.where(filter=FieldFilter("uid", "==", uid)).stream()
            mobile_docs = col.where(filter=FieldFilter("userId", "==", uid)).stream()
            docs = list(own_docs) + list(mobile_docs)

        rows = [_normalize_txn(d.id, d.to_dict()) for d in docs]
        rows.sort(key=lambda r: r.get("timestamp") or "", reverse=True)
        rows = rows[:200 if is_admin else 50]

        return jsonify({"transactions": rows})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── /admin ───────────────────────────────────────────────────────────────────

@app.route("/admin/stats", methods=["GET"])
@require_admin
def admin_stats(uid, is_admin):
    if db is None:
        return jsonify({
            "total": 0, "blocked": 0, "approved": 0, "hold": 0,
            "block_rate": 0, "users": 0,
        })
    try:
        rows = [_normalize_txn(d.id, d.to_dict()) for d in db.collection("transactions").stream()]
        total    = len(rows)
        blocked  = sum(1 for r in rows if r["decision"] == "BLOCK")
        approved = sum(1 for r in rows if r["decision"] == "APPROVE")
        hold     = total - blocked - approved
        active_users = sum(1 for u in auth.list_users().iterate_all() if not u.disabled)

        return jsonify({
            "total": total, "blocked": blocked, "approved": approved, "hold": hold,
            "block_rate": round(blocked / total * 100, 1) if total else 0,
            "users": active_users,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/set-admin", methods=["POST"])
@require_admin
def set_admin_claim(uid, is_admin):
    """Grant admin custom claim to a user by UID."""
    data = request.get_json(force=True)
    target_uid = data.get("uid")
    if not target_uid:
        return jsonify({"error": "uid required"}), 400
    try:
        auth.set_custom_user_claims(target_uid, {"admin": True})
        return jsonify({"success": True, "message": f"Admin claim set for {target_uid}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/clear-transactions", methods=["DELETE"])
@require_admin
def clear_transactions(uid, is_admin):
    target_uid = request.args.get("uid")
    if not target_uid:
        return jsonify({"error": "uid required"}), 400
    try:
        deleted = 0
        for field in ("uid", "userId"):
            docs = db.collection("transactions")\
                .where(filter=FieldFilter(field, "==", target_uid))\
                .stream()
            for doc in docs:
                doc.reference.delete()
                deleted += 1
        return jsonify({"success": True, "deleted": deleted})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/admin/users", methods=["GET"])
@require_admin
def list_registered_users(uid, is_admin):
    """List every registered Firebase Auth user (name, email, dates, status)."""
    try:
        phone_by_uid = {}
        if db is not None:
            for doc in db.collection("users").stream():
                phone_by_uid[doc.id] = doc.to_dict().get("phone")
        users = []
        for user in auth.list_users().iterate_all():
            claims = user.custom_claims or {}
            users.append({
                "uid":          user.uid,
                "email":        user.email,
                "display_name": user.display_name,
                "phone":        phone_by_uid.get(user.uid) or user.phone_number,
                "created_at":   user.user_metadata.creation_timestamp,
                "last_sign_in": user.user_metadata.last_sign_in_timestamp,
                "disabled":     user.disabled,
                "is_admin":     bool(claims.get("admin")),
            })
        return jsonify({"users": users})
    except Exception as e:
        logger.exception("Failed to list registered users")
        return jsonify({"error": str(e)}), 500
    
def verify_token(req):
    """Returns (uid, is_admin, error_msg)."""
    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, False, "Missing token"
    token = auth_header.split(" ", 1)[1]
    try:
        decoded = auth.verify_id_token(token, check_revoked=True)
        uid = decoded["uid"]
        claims = decoded.get("custom_claims") or decoded
        is_admin = bool(claims.get("admin", False))
        return uid, is_admin, None
    except auth.UserDisabledError:
        return None, False, "This account has been disabled"
    except auth.RevokedIdTokenError:
        return None, False, "Session has been revoked, please sign in again"
    except Exception as e:
        return None, False, str(e) 
 
@app.route("/admin/users/<target_uid>/disable", methods=["POST"])
@require_admin
def set_user_disabled(target_uid, uid, is_admin):
    """Enable or disable a user's account."""
    payload = request.get_json(force=True) or {}
    disabled = bool(payload.get("disabled", True))
    try:
        auth.update_user(target_uid, disabled=disabled)
        if disabled:
            # Invalidates their current session immediately (check_revoked=True in verify_token)
            auth.revoke_refresh_tokens(target_uid)
        return jsonify({"message": f"User {'disabled' if disabled else 'enabled'}"})
    except Exception as e:
        logger.exception("Failed to update user disabled state")
        return jsonify({"error": str(e)}), 500
    
# ─── /scenarios ──────────────────────────────────────────────────────────────

@app.route("/scenarios", methods=["GET"])
def get_scenarios():
    """Return pre-built demo scenario rows."""
    if "ulb_data" not in models:
        return jsonify({"scenarios": []})
    df = models["ulb_data"]

    normal_row = df[df["Class"] == 0].head(1)
    fraud_row = df[df["Class"] == 1].head(1)
    demo_df = pd.concat([normal_row, fraud_row])

    scenarios = []
    for i, row in demo_df.iterrows():
        scenarios.append({
            "id": int(i),
            "label": f"Scenario {i+1}",
            "row": {col: float(row[col]) for col in row.index if col != "Class"},
            "actual_class": int(row["Class"]) if "Class" in row else None,
        })
    return jsonify({"scenarios": scenarios})

# ─── /User cards ───────────────────────────────────────────────────────────────────

@app.route("/cards", methods=["GET"])
@require_auth
def get_cards(uid, is_admin):
    """List the current user's simulated cards."""
    if db is None:
        return jsonify({"cards": []})
    try:
        docs = (
            db.collection("cards")
            .where(filter=FieldFilter("uid", "==", uid))
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .stream()
        )
        cards = [{"id": d.id, **d.to_dict()} for d in docs]
        return jsonify({"cards": cards})
    except Exception as e:
        logger.exception("Failed to list cards")
        return jsonify({"error": str(e)}), 500


@app.route("/cards", methods=["POST"])
@require_auth
def create_card(uid, is_admin):
    """Create a new simulated card for the current user."""
    if db is None:
        return jsonify({"error": "Database unavailable"}), 503
    payload = request.get_json(force=True) or {}
    label = (payload.get("label") or "").strip()
    network = (payload.get("network") or "Simulated").strip()
    if not label:
        return jsonify({"error": "Card label is required"}), 400
    try:
        doc = {
            "uid":        uid,
            "label":      label,
            "network":    network,
            "last4":      f"{random.randint(0, 9999):04d}",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        _, doc_ref = db.collection("cards").add(doc)
        return jsonify({"id": doc_ref.id, **doc}), 201
    except Exception as e:
        logger.exception("Failed to create card")
        return jsonify({"error": str(e)}), 500


@app.route("/cards/<card_id>", methods=["DELETE"])
@require_auth
def delete_card(card_id, uid, is_admin):
    """Delete a card belonging to the current user."""
    if db is None:
        return jsonify({"error": "Database unavailable"}), 503
    try:
        ref = db.collection("cards").document(card_id)
        doc = ref.get()
        if not doc.exists or doc.to_dict().get("uid") != uid:
            return jsonify({"error": "Card not found"}), 404
        ref.delete()
        return jsonify({"message": "Card deleted"})
    except Exception as e:
        logger.exception("Failed to delete card")
        return jsonify({"error": str(e)}), 500
    
# ─── /tickets ──────────────────────────────────────────────────────────────
@app.route("/tickets", methods=["POST"])
@require_auth
def create_ticket(uid, is_admin):
    """User disputes a BLOCKed transaction, asking admin to review it."""
    if db is None:
        return jsonify({"error": "Database unavailable"}), 503
    payload = request.get_json(force=True) or {}
    transaction_id = (payload.get("transaction_id") or "").strip()
    reason = (payload.get("reason") or "").strip()

    if not transaction_id or not reason:
        return jsonify({"error": "transaction_id and reason are required"}), 400

    try:
        txn_ref = db.collection("transactions").document(transaction_id)
        txn_doc = txn_ref.get()
        if not txn_doc.exists:
            return jsonify({"error": "Transaction not found"}), 404
        txn = txn_doc.to_dict()

        # Users can only dispute their own transactions (admins can dispute any, if needed)
        if not is_admin and txn.get("uid") != uid:
            return jsonify({"error": "Not your transaction"}), 403

        if txn.get("decision") not in ("BLOCK", "APPROVE"):
            return jsonify({"error": "Only approved or blocked transactions can be disputed"}), 400

        # Prevent duplicate open disputes on the same transaction
        existing = (
            db.collection("tickets")
            .where(filter=FieldFilter("transaction_id", "==", transaction_id))
            .where(filter=FieldFilter("status", "==", "PENDING"))
            .limit(1)
            .stream()
        )
        if next(existing, None) is not None:
            return jsonify({"error": "A ticket for this transaction is already pending"}), 409

        doc = {
            "uid":            uid,
            "transaction_id": transaction_id,
            "reason":         reason,
            "status":         "PENDING",
            "created_at":     datetime.now(timezone.utc).isoformat(),
            "resolved_at":    None,
            "resolved_by":    None,
            # snapshot fields so the admin ticket list doesn't need extra joins
            "amount":       txn.get("amount"),
            "district":     txn.get("district"),
            "decision":     txn.get("decision"),
            "timestamp":    txn.get("timestamp"),
            "stage1_prob":  txn.get("stage1_prob"),
            "stage2_prob":  txn.get("stage2_prob"),
        }
        _, doc_ref = db.collection("tickets").add(doc)
        return jsonify({"id": doc_ref.id, **doc}), 201
    except Exception as e:
        logger.exception("Failed to create ticket")
        return jsonify({"error": str(e)}), 500


@app.route("/tickets", methods=["GET"])
@require_auth
def get_tickets(uid, is_admin):
    """Admin sees all tickets; user sees only their own."""
    if db is None:
        return jsonify({"tickets": []})
    try:
        col = db.collection("tickets")
        if is_admin:
            query = col.order_by("created_at", direction=firestore.Query.DESCENDING)
        else:
            query = col.where(filter=FieldFilter("uid", "==", uid)).order_by(
                "created_at", direction=firestore.Query.DESCENDING
            )
        tickets = [{"id": d.id, **d.to_dict()} for d in query.stream()]
        return jsonify({"tickets": tickets})
    except Exception as e:
        logger.exception("Failed to list tickets")
        return jsonify({"error": str(e)}), 500


@app.route("/tickets/<ticket_id>", methods=["PATCH"])
@require_admin
def resolve_ticket(ticket_id, uid, is_admin):
    """Admin approves or rejects a dispute. Approving flips the transaction's
    decision to APPROVE and marks it as manually reviewed."""
    if db is None:
        return jsonify({"error": "Database unavailable"}), 503
    payload = request.get_json(force=True) or {}
    new_status = payload.get("status")

    if new_status not in ("APPROVED", "REJECTED"):
        return jsonify({"error": "status must be APPROVED or REJECTED"}), 400

    try:
        ticket_ref = db.collection("tickets").document(ticket_id)
        ticket_doc = ticket_ref.get()
        if not ticket_doc.exists:
            return jsonify({"error": "Ticket not found"}), 404
        ticket = ticket_doc.to_dict()

        if ticket.get("status") != "PENDING":
            return jsonify({"error": "Ticket already resolved"}), 409

        resolved_at = datetime.now(timezone.utc).isoformat()
        ticket_ref.update({
            "status":      new_status,
            "resolved_at": resolved_at,
            "resolved_by": uid,
        })

        txn_ref = db.collection("transactions").document(ticket["transaction_id"])
        txn_doc = txn_ref.get()
        if txn_doc.exists:
            original_decision = ticket.get("decision")
            update = {
                "manually_reviewed": True,
                "reviewed_at":       resolved_at,
                "reviewed_by":       uid,
                "original_decision": original_decision,
            }
            if new_status == "APPROVED":
                update["decision"] = "APPROVE" if original_decision == "BLOCK" else "BLOCK"
            txn_ref.update(update)

        socketio.emit("ticket_resolved", {
            "ticket_id":      ticket_id,
            "transaction_id": ticket["transaction_id"],
            "status":         new_status,
        }, room=ticket["uid"])
        
        return jsonify({"message": f"Ticket {new_status.lower()}"})
    except Exception as e:
        logger.exception("Failed to resolve ticket")
        return jsonify({"error": str(e)}), 500

@app.route("/admin/clear-tickets", methods=["DELETE"])
@require_admin
def clear_tickets(uid, is_admin):
    """Delete all or specific ticket records. Does NOT touch the transactions collection —
    any decision already changed by an approved ticket stays changed."""
    if db is None:
        return jsonify({"error": "Database unavailable"}), 503
    try:
        payload = request.get_json(silent=True) or {}
        ticket_ids = payload.get("ticket_ids")

        batch = db.batch()
        count = 0

        if ticket_ids is not None:
            for tid in ticket_ids:
                ref = db.collection("tickets").document(tid)
                batch.delete(ref)
                count += 1
                if count % 400 == 0:
                    batch.commit()
                    batch = db.batch()
        else:
            docs = list(db.collection("tickets").stream())
            for d in docs:
                batch.delete(d.reference)
                count += 1
                if count % 400 == 0: 
                    batch.commit()
                    batch = db.batch()
        if count % 400 != 0:
            batch.commit()
        return jsonify({"message": f"Deleted {count} ticket(s)"})
    except Exception as e:
        logger.exception("Failed to clear tickets")
        return jsonify({"error": str(e)}), 500

# ─── Model Management (admin) ──────────────────────────────────────────────────

@app.route("/admin/model-metrics", methods=["GET"])
@require_admin
def model_metrics(uid, is_admin):
    """Static performance of the currently-LIVE model against a held-out
    split of ulb_data.csv. Pure compute — no retraining, no Firestore."""
    try:
        result = model_retrain.compute_live_metrics(models, STAGE1_EVAL_THRESHOLD)
        return jsonify(result)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.exception("model-metrics failed")
        return jsonify({"error": str(e)}), 500


MODEL_ROSTER = [
    {"key": "rf",               "file": "stage1_rf.pkl",           "component": "Random Forest",              "role": "Stage 1 cascade member"},
    {"key": "stage1_xgb",       "file": "stage1_xgb.pkl",          "component": "XGBoost",                    "role": "Stage 1 cascade member."},
    {"key": "catboost",         "file": "stage1_catboost.pkl",     "component": "CatBoost",                   "role": "Stage 1 cascade member."},
    {"key": "meta_learner",     "file": "meta_learner.pkl",        "component": "Meta-learner (LogReg)",      "role": "Stacks RF / XGBoost / CatBoost probabilities."},
    {"key": "iso_forest",       "file": "stage1_iso_forest.pkl",   "component": "Isolation Forest",           "role": "Anomaly-score feature for Stage 1."},
    {"key": "scaler_time",      "file": "stage1_scaler_time.pkl",  "component": "RobustScaler (Time)",        "role": "Scales transaction time for Stage 1."},
    {"key": "scaler_log",       "file": "stage1_scaler_log.pkl",   "component": "RobustScaler (log Amount)",  "role": "Scales log(amount) for Stage 1."},
    {"key": "stage2_gbm",       "file": "stage2_gbm.pkl",          "component": "Logistic Regression",          "role": "Stage 2 district-based scoring."},
    {"key": "malaysian_scaler", "file": "malaysian_scaler.pkl",    "component": "Scaler",                     "role": "Scales Stage 2 features."},
]


@app.route("/admin/model-info", methods=["GET"])
@require_admin
def model_info(uid, is_admin):
    """What's actually loaded in prod right now."""
    components = [{**entry, "loaded": entry["key"] in models} for entry in MODEL_ROSTER]
    return jsonify({
        "components": components,
        "ulb_data_loaded": "ulb_data" in models,
        "district_profiles_loaded": "district_profiles" in models,
    })

@app.route("/admin/export-reviewed", methods=["GET"])
@require_admin
def export_reviewed_transactions(uid, is_admin):
    """CSV of transactions an admin manually overrode via the ticket system.
    This is the closest thing we have to a human-corrected label — useful
    as input to a deliberate, offline retrain decision, rather than an
    automatic one-click retrain."""
    if db is None:
        return jsonify({"error": "Database unavailable"}), 503
    try:
        docs = db.collection("transactions").where(filter=FieldFilter("manually_reviewed", "==", True)).stream()
        rows = [{"id": d.id, **d.to_dict()} for d in docs]
        if not rows:
            return jsonify({"error": "No manually reviewed transactions found"}), 404

        rows.sort(key=lambda r: r.get("reviewed_at") or "", reverse=True)

        fieldnames = [
            "id", "uid", "timestamp", "amount", "district",
            "original_decision", "decision", "manually_reviewed",
            "reviewed_at", "reviewed_by",
            "stage1_prob", "stage2_prob", "triggered_stage",
            "area_expenditure_mean", "area_gini_index", "spending_deviation_ratio",
        ]
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

        return Response(
            buf.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=reviewed_transactions.csv"},
        )
    except Exception as e:
        logger.exception("Failed to export reviewed transactions")
        return jsonify({"error": str(e)}), 500

@app.route("/admin/drift-check", methods=["GET"])
@require_admin
def drift_check(uid, is_admin):
    """Compares recent live traffic's Stage 1 probability distribution
    against the held-out validation set's distribution."""
    try:
        holdout_probs = model_retrain.stage1_holdout_probabilities(models)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    if db is None:
        return jsonify({"error": "Database unavailable"}), 503

    try:
        n = int(request.args.get("n", 200))
        docs = (
            db.collection("transactions")
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(n)
            .stream()
        )
        live_probs = [d.to_dict().get("stage1_prob") for d in docs]
        live_probs = np.array([p for p in live_probs if p is not None], dtype=float)

        if len(live_probs) < 10:
            return jsonify({
                "error": f"Not enough recent transactions to compare (found {len(live_probs)}, need at least 10)"
            }), 400

        def summarize(arr):
            return {
                "mean":   round(float(np.mean(arr)), 4),
                "median": round(float(np.median(arr)), 4),
                "std":    round(float(np.std(arr)), 4),
                "p90":    round(float(np.percentile(arr, 90)), 4),
            }

        def histogram(arr, bins=10):
            counts, edges = np.histogram(arr, bins=bins, range=(0, 1))
            return [
                {"bin": f"{edges[i]:.1f}–{edges[i+1]:.1f}", "count": int(counts[i])}
                for i in range(len(counts))
            ]

        holdout_summary = summarize(holdout_probs)
        live_summary = summarize(live_probs)
        mean_shift = round(abs(holdout_summary["mean"] - live_summary["mean"]), 4)

        return jsonify({
            "holdout": holdout_summary,
            "live": live_summary,
            "live_n": int(len(live_probs)),
            "mean_shift": mean_shift,
            "drift_flag": mean_shift > 0.05,
            "holdout_histogram": histogram(holdout_probs),
            "live_histogram": histogram(live_probs),
        })
    except Exception as e:
        logger.exception("drift-check failed")
        return jsonify({"error": str(e)}), 500


# ─── /districts ──────────────────────────────────────────────────────────────

@app.route("/districts", methods=["GET"])
def get_districts():
    if "district_profiles" not in models:
        return jsonify({"districts": []})
    df = models["district_profiles"]
    districts = df[["state", "district"]].drop_duplicates().to_dict("records")
    return jsonify({"districts": districts})


# ─── SocketIO ─────────────────────────────────────────────────────────────────

@socketio.on("connect")
def on_connect():
    logger.info(f"Socket connected: {request.sid}")
    emit("connected", {"message": "Connected to Klaus"})


@socketio.on("join")
def on_join(data):
    """Client joins their personal room and optionally admin room."""
    room = data.get("room")
    if room:
        join_room(room)
        emit("joined", {"room": room})


# ─── Health ───────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "models_loaded": list(models.keys()),
        "firebase": db is not None,
        "threshold": FRAUD_THRESHOLD,
    })


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        load_models()
    except Exception as e:
        logger.warning(f"⚠️  Model loading skipped (dev mode): {e}")

    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
