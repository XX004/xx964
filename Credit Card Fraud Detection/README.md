Final Year Project · Two-stage ML pipeline · React + Flask + Firebase + Socket.IO
---
```
VERSION:
python 3.13.2
npm 11.6.2
```
## Folder Tree Overview
```
fraud-app/
├── README.md
│
├── backend/
│   ├── app.py               
│   ├── requirements.txt
│   ├── .env
│   ├── firebase-credentials.json
│   └── models/
│       ├── ulb_data.csv
│       ├── malaysian_profiles.csv
│       ├── malaysian_scaler.pkl
│       ├── meta_learner.pkl
│       ├── stage1_catboost.pkl
│       ├── stage1_iso_forest.pkl
│       ├── stage1_rf.pkl
│       ├── stage1_xgb.pkl	
│       ├── stage2_gbm.pkl	
│       └── x_test_rows.csv
│
└── frontend/
    ├── index.html
    ├── package-lock.json
    ├── package.json
    ├── vite.config.js
    ├── node_modules/
    ├── .env
    └── src/
        ├── main.jsx        
        ├── App.jsx         
        ├── index.css
        ├── firebase.js
        │
        ├── context/
        │   ├── AuthContext.jsx    
        │   └── SocketContext.jsx   ← real-time alerts
        │
        ├── utils/
        │   └── api.js              ← all fetch calls to backend
        │
        ├── components/
        │   ├── Layout.jsx          ← sidebar + alert banner
        │   └── Layout.css
        │
        └── pages/
            ├── LoginPage.jsx + Auth.css
            ├── RegisterPage.jsx
            ├── Dashboard.jsx + Dashboard.css
            ├── HistoryPage.jsx + HistoryPage.css
            ├── AdminPage.jsx + AdminPage.css
            ├── AdminHistoryPage.jsx + AdminHistoryPage.css
            ├── Dashboard.jsx + Dashboard.css
            ├── ManageCard.jsx + ManageCard.css
            ├── ManageModel.jsx + ManageModel.css
            ├── ManageUserPage.jsx + ManageUserPage.css
            ├── Notifications.jsx + Notifications.css
            ├── SettingsPage.jsx + SettingsPage.css
            └── TicketsPage.jsx + TicketsPage.css
```
## ML Pipeline

```
Input: V1–V28 (PCA) + Time + Amount + District
          │
          ▼
    ┌─────────────────────────────────┐
    │  Stage 1: Stacking Ensemble     │
    │  RF + XGBoost + CatBoost        │
    │  → LogisticRegression (meta)    │
    │  ULB PCA features               │
    └──────────────┬──────────────────┘
                   │
          prob ≥ 0.2340? ──YES──→ BLOCK
                   │
                  NO
                   │
                   ▼
    ┌─────────────────────────────────┐
    │  Stage 2: Malaysian GBM         │
    │  DOSM district context          │
    │  Spending deviation ratio       │
    └──────────────┬──────────────────┘
                   │
          prob ≥ 0.50? ──YES──→ BLOCK
                   │
                  NO
                   │
                   ▼
                APPROVE
```

---

## Quick  (From Scratch)
## Have 2 terminals simultaneously opened:
### Terminal 1. Backend

```cmd
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Copy and fill in your environment variables

# Place your .pkl files and CSVs in ./models/

python app.py
```

### Terminal 2. Frontend

```cmd
cd frontend
npm install

# Copy and fill in your Firebase credentials

npm run dev
```

### 3. Firebase setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Email/Password** authentication
3. Enable **Firestore** (Native mode)
4. Download your **service account JSON** → save as `backend/firebase-credentials.json`
5. Copy your **Web SDK config** → fill in `frontend/.env`
6. Create a Firestore index on `transactions` collection:
   - Fields: `uid` (ASC), `timestamp` (DESC)
   - Fields: `timestamp` (DESC) — for admin queries

### 4. Create an admin account

To promote a user to administrator:

```python
# Option A: Firebase Admin SDK (run once)
import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate("backend/firebase-credentials.json")
firebase_admin.initialize_app(cred)

auth.set_custom_user_claims("THE_USER_UID_HERE", {"admin": True})
print("Done")
```

---

## Model Files Expected in `backend/models/`

| File Required | Description |
|---|---|
| `stage1_xgb.pkl` | XGBClassifier (Stage 1 base) |
| `stage2_gbm.pkl` | GradientBoostingClassifier (Stage 2) |
| `malaysian_scaler.pkl` | StandardScaler for Stage 2 |
| `stage1_scaler_time.pkl` | RobustScaler for Time column |
| `stage1_scaler_log.pkl` | RobustScaler for log_amount |
| `stage1_iso_forest.pkl` | IsolationForest for anomaly score |
| `malaysian_profiles.csv` | DOSM district lookup |
| `meta_learner.pkl` | LogisticRegression stacking meta |
| `stage1_rf.pkl` | Random Forest base model |
| `stage1_catboost.pkl` | CatBoost base model |

---

## Environment Variables

### Backend `.env`

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | — | Flask secret key |
| `FIREBASE_CRED_PATH` | `./firebase-credentials.json` | Service account path |
| `MODEL_DIR` | `./models` | Directory with .pkl files |
| `FRAUD_THRESHOLD` | Decision threshold 

### Frontend `.env`

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL (default: http://localhost:5000) |
| `VITE_FIREBASE_*` | Firebase Web SDK config values |


