import { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  CreditCard, Plus, Trash2, X, ChevronRight,
  Zap, MapPin, DollarSign, CheckCircle, XCircle, RefreshCw, ChevronDown, AlertTriangle, Lock,
} from "lucide-react";
import "./ManageCard.css";
import "./Dashboard.css"; // generator styles (scenario-picker, verdict-card, pipeline, etc.) — unchanged

export default function ManageCard() {
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newNetwork, setNewNetwork] = useState("Visa");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  async function loadCards() {
    setLoadingCards(true);
    try {
      const res = await api.cards();
      setCards(res.cards || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCards(false);
    }
  }

  useEffect(() => { loadCards(); }, []);

  async function handleCreateCard(e) {
    e.preventDefault();
    setFormError("");
    if (!newLabel.trim()) {
      setFormError("Give your card a name");
      return;
    }
    setCreating(true);
    try {
      const card = await api.createCard({ label: newLabel.trim(), network: newNetwork });
      setCards((prev) => [card, ...prev]);
      setNewLabel("");
      setShowAddForm(false);
    } catch (err) {
      setFormError(err.message || "Failed to create card");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteCard(cardId) {
    if (!window.confirm("Delete this card? Past transactions are kept.")) return;
    try {
      await api.deleteCard(cardId);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      if (selectedCard?.id === cardId) setSelectedCard(null);
    } catch (err) {
      console.error(err);
    }
  }

  if (selectedCard) {
    return (
      <div className="manage-card-page">
        <button className="back-btn" onClick={() => setSelectedCard(null)}>
          ← Back to cards
        </button>
        <div className="active-card-banner">
          <CreditCard size={18} />
          <span>{selectedCard.label}</span>
          <span className="card-meta">{selectedCard.network} •••• {selectedCard.last4}</span>
        </div>
        <TransactionGenerator card={selectedCard} />
      </div>
    );
  }

  return (
    <div className="manage-card-page">
      <div className="manage-card-header">
        <div>
          <h1 className="page-title">Manage Cards</h1>
          <p className="page-sub">Create a simulated card, then run transactions against it</p>
        </div>
        <button className="add-card-btn" onClick={() => setShowAddForm((s) => !s)}>
          <Plus size={16} /> New card
        </button>
      </div>

      {showAddForm && (
        <form className="add-card-form" onSubmit={handleCreateCard}>
          <input
            type="text"
            placeholder="Card name (e.g. My Everyday Card)"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
          />
          <select value={newNetwork} onChange={(e) => setNewNetwork(e.target.value)}>
            <option>Visa</option>
            <option>Mastercard</option>
            <option>UnionPay</option>
          </select>
          <button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create"}
          </button>
          <button type="button" className="cancel-btn" onClick={() => { setShowAddForm(false); setFormError(""); }}>
            <X size={14} />
          </button>
        </form>
      )}
      {formError && <div className="inline-error"><AlertTriangle size={14} /> {formError}</div>}

      {loadingCards ? (
        <div className="loading-state">
          <RefreshCw size={24} className="spin" /> Loading cards…
        </div>
      ) : cards.length === 0 ? (
        <div className="empty-history">
          <CreditCard size={36} className="empty-icon" />
          <p>No cards yet. Create one to start generating transactions.</p>
        </div>
      ) : (
        <div className="card-grid">
          {cards.map((c) => (
            <button key={c.id} className="card-tile" onClick={() => setSelectedCard(c)}>
              <div className="card-tile-top">
                <CreditCard size={20} />
                <Trash2
                  size={15}
                  className="card-delete-icon"
                  onClick={(e) => { e.stopPropagation(); handleDeleteCard(c.id); }}
                />
              </div>
              <div className="card-tile-label">{c.label}</div>
              <div className="card-tile-meta">{c.network} •••• {c.last4}</div>
              <div className="card-tile-cta">
                Use this card <ChevronRight size={14} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


// ─── Transaction Generator ──────────────────────────────────────────────────
// Moved from the old Dashboard.jsx as-is; logic/JSX unchanged.
// NOTE: `card` is accepted here but not yet sent to the backend — /predict and
// _log_transaction in app.py don't have a card_id field yet, so right now
// selecting a card only scopes the UI, not the stored transaction record.
// Flagging this so it's not mistaken for already being wired end-to-end.

function TransactionGenerator({ card }) {
  const [districts,    setDistricts]    = useState([]);
  const [testRows,     setTestRows]     = useState({ normal: null, suspicious: null });
  const [scenarioId,   setScenarioId]   = useState("normal");
  const [district,     setDistrict]     = useState("");
  const [customAmount, setCustomAmount] = useState("200.00");
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState("");

  useEffect(() => {
    api.districts().then((r) => {
      setDistricts(r.districts || []);
      if (r.districts?.length) setDistrict(r.districts[0].district);
    });
    api.scenarios().then((r) => {
      const rows = r.scenarios || [];
      setTestRows({
        normal:     rows.find((s) => s.actual_class === 0) ?? null,
        suspicious: rows.find((s) => s.actual_class === 1) ?? null,
      });
    });
  }, []);

  const isCustom = scenarioId === "custom";

  function getActiveRow() {
    if (scenarioId === "normal")     return testRows.normal;
    if (scenarioId === "suspicious") return testRows.suspicious;
    return null;
  }

  function getDisplayAmount() {
    if (isCustom) return customAmount;
    const row = getActiveRow();
    return row?.row?.Amount != null ? row.row.Amount.toFixed(2) : "—";
  }

  async function handleRun() {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const row = getActiveRow();

      const vFeatures = Object.fromEntries(
        Array.from({ length: 28 }, (_, i) => [
          `V${i + 1}`,
          isCustom ? 0 : (row?.row?.[`V${i + 1}`] ?? 0),
        ])
      );

      const payload = {
        ...vFeatures,
        Time:     isCustom ? 43200 : (row?.row?.Time ?? 43200),
        Amount:   isCustom ? parseFloat(customAmount) : (row?.row?.Amount ?? 100),
        district: district,
      };

      const res = await api.predict(payload);
      setResult(res);
    } catch (err) {
      setError(err.message || "Prediction failed");
    } finally {
      setLoading(false);
    }
  }

  const SCENARIOS = [
    {
      id: "normal",
      label: "Normal transaction",
      description: testRows.normal
        ? `Real test row · RM ${testRows.normal.row?.Amount?.toFixed(2)}`
        : "Loading…",
    },
    {
      id: "suspicious",
      label: "Suspicious transaction",
      description: testRows.suspicious
        ? `Real test row · RM ${testRows.suspicious.row?.Amount?.toFixed(2)}`
        : "Loading…",
    },
    {
      id: "custom",
      label: "Custom (manual entry)",
      description: "You choose the amount and district",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1 className="page-title">Transaction Checker</h1>
        <p className="page-sub">Two-stage fraud detection · Malaysian geographic context</p>
      </div>

      <div className="dashboard-grid">
        <div className="panel inputs-panel">
          <h2 className="panel-title">Transaction Setup</h2>

          <div className="scenario-picker">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                className={`scenario-btn ${scenarioId === s.id ? "active" : ""}`}
                onClick={() => { setScenarioId(s.id); setResult(null); setError(""); }}
              >
                <span className="scenario-label">{s.label}</span>
                <span className="scenario-desc">{s.description}</span>
              </button>
            ))}
          </div>

          <div className="divider" />

          {/* Amount — locked for normal/suspicious, editable for custom */}
          <div className="input-group">
            <label>
              <DollarSign size={15} /> Amount (RM)
            </label>
            {isCustom ? (
              <input
                type="number" min="0.01" step="0.01"
                value={customAmount}
                onChange={(e) => { setCustomAmount(e.target.value); setResult(null); }}
              />
            ) : (
              <div className="locked-value">RM {getDisplayAmount()}</div>
            )}
          </div>

          {/* District — always user choice */}
          <div className="input-group">
            <label><MapPin size={15} /> District</label>
            <div className="select-wrap">
              <select value={district} onChange={(e) => { setDistrict(e.target.value); setResult(null); }}>
                {districts.length === 0 && <option value="">Loading…</option>}
                {districts.map((d) => (
                  <option key={`${d.state}-${d.district}`} value={d.district}>
                    {d.district}, {d.state}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="select-icon" />
            </div>
          </div>

          {/* V features — always locked, just shown for transparency */}
          {!isCustom && (
            <div className="hidden-notice">
              <Lock size={11} /> V1–V28 and Time are from the real test row — hidden from input
            </div>
          )}

          {isCustom && (
            <div className="hidden-notice">
              Custom mode: V1–V28 and Time set to neutral values. Only Amount and District affect Stage 2.
            </div>
          )}

          {error && <div className="inline-error"><AlertTriangle size={14} /> {error}</div>}

          <button className="run-btn" onClick={handleRun} disabled={loading || !district}>
            {loading
              ? <><RefreshCw size={16} className="spin" /> Analysing…</>
              : <><Zap size={16} /> Run prediction</>
            }
          </button>
        </div>

        <div className="panel result-panel">
          <h2 className="panel-title">Decision</h2>

          {!result && !loading && (
            <div className="empty-state">
              <Zap size={32} className="empty-icon" />
              <p>Pick a scenario and run the prediction.</p>
            </div>
          )}

          {loading && (
            <div className="empty-state">
              <RefreshCw size={32} className="empty-icon spin" />
              <p>Running model…</p>
            </div>
          )}

          {result && (
            <ResultCard
              result={result}
              amount={getDisplayAmount()}
              district={district}
            />
          )}
        </div>
      </div>

      <PipelineDiagram result={result} />
    </div>
  );
}


function ResultCard({ result, amount, district }) {
  const { decision, stage1_prob, stage2_prob, district_profile, triggered_stage } = result;
  const isBlock = decision === "BLOCK";

  return (
    <div className={`verdict-card ${decision.toLowerCase()}`}>
      {isBlock
        ? <XCircle size={44} className="verdict-icon block" />
        : <CheckCircle size={44} className="verdict-icon approve" />
      }
      <div className={`verdict-label ${decision.toLowerCase()}`}>{decision}</div>
      <div className="verdict-sub">
        {triggered_stage === "velocity"
          ? "Blocked by velocity rule — too many transactions"
          : isBlock
          ? `Blocked at Stage ${triggered_stage}`
          : "Transaction approved"
        }
      </div>

      <div className="verdict-stats">
        <StatRow label="Amount"    value={`RM ${parseFloat(amount).toFixed(2)}`} />
        <StatRow label="District"  value={district} />
        {stage1_prob != null && (
          <StatRow label="Stage 1 probability" value={`${(stage1_prob * 100).toFixed(2)}%`} alert={stage1_prob >= 0.5} />
        )}
        {stage2_prob != null && (
          <StatRow label="Stage 2 probability" value={`${(stage2_prob * 100).toFixed(2)}%`} alert={stage2_prob >= 0.5} />
        )}
        {stage2_prob === null && stage1_prob != null && (
          <StatRow label="Stage 2" value="Bypassed (Stage 1 blocked)" muted />
        )}
        {district_profile && (
          <>
            <StatRow label="Area expenditure mean" value={`RM ${district_profile.expenditure_mean.toFixed(2)}`} />
            <StatRow label="Area Gini index"       value={district_profile.gini.toFixed(4)} />
            <StatRow
              label="Spending vs area avg"
              value={`${((parseFloat(amount) / district_profile.expenditure_mean) * 100).toFixed(0)}%`}
              alert={parseFloat(amount) / district_profile.expenditure_mean > 2}
            />
          </>
        )}
      </div>

      {stage1_prob != null && (
        <div className="prob-bars">
          <ProbBar label="Stage 1" value={stage1_prob} />
          {stage2_prob != null && <ProbBar label="Stage 2" value={stage2_prob} />}
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, alert, muted }) {
  return (
    <div className={`stat-row ${alert ? "alert" : ""} ${muted ? "muted" : ""}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function ProbBar({ label, value }) {
  const pct    = Math.round(value * 100);
  const danger = value >= 0.5;
  return (
    <div className="prob-bar-wrap">
      <div className="prob-bar-header">
        <span className="prob-bar-label">{label}</span>
        <span className={`prob-pct ${danger ? "danger" : ""}`}>{pct}%</span>
      </div>
      <div className="prob-track">
        <div className={`prob-fill ${danger ? "danger" : "safe"}`} style={{ width: `${pct}%` }} />
        <div className="prob-threshold" title="Threshold 50%" />
      </div>
    </div>
  );
}

function PipelineDiagram({ result }) {
  const decided = result !== null;
  const blocked = result?.decision === "BLOCK";
  const velocity = result?.triggered_stage === "velocity";

  return (
    <div className="pipeline-section">
      <h2 className="panel-title" style={{ marginBottom: 14 }}>Pipeline flow</h2>
      <div className="pipeline">
        <div className="pipe-node input-node">
          <div className="pipe-icon">📥</div>
          <div className="pipe-label">Input</div>
          <div className="pipe-sub">V1–V28 · Time · Amount · District</div>
        </div>

        <div className="pipe-arrow">→</div>

        <div className={`node ${decided && !velocity ? (result.triggered_stage === 1 ? "fired" : "active") : "idle"}`}>
          <div className="pipe-icon">🧠</div>
          <div className="pipe-label">Stage 1</div>
          <div className="pipe-sub">RF + XGB + CatBoost → LR</div>
          {result?.stage1_prob != null && (
            <div className="pipe-prob">{(result.stage1_prob * 100).toFixed(1)}%</div>
          )}
        </div>

        <div className="pipe-arrow">→</div>

        <div className={`node ${decided && !velocity && result.triggered_stage !== 1 ? (result.triggered_stage === 2 ? "fired" : "active") : "idle"}`}>
          <div className="pipe-icon">🗺️</div>
          <div className="pipe-label">Stage 2</div>
          <div className="pipe-sub">Malaysian GBM · DOSM</div>
          {result?.stage2_prob != null && (
            <div className="pipe-prob">{(result.stage2_prob * 100).toFixed(1)}%</div>
          )}
        </div>

        <div className="pipe-arrow">→</div>

        <div className={`node verdict-node ${decided ? (blocked ? "block" : "approve") : "idle"}`}>
          <div className="pipe-icon">
            {!decided ? "❓" : blocked ? "🚫" : "✅"}
          </div>
          <div className="pipe-label">{!decided ? "Pending" : result.decision}</div>
        </div>
      </div>
    </div>
  );
}