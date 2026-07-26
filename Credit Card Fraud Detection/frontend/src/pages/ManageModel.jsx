import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, TrendingUp, AlertTriangle, CheckCircle2,
  XCircle, Cpu, Layers, Download, Activity
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { api } from "../utils/api";
import "./ManageModel.css";

function StatCard({ label, value, sub }) {
  return (
    <div className="mm-stat-card">
      <span className="mm-stat-label">{label}</span>
      <span className="mm-stat-value">{value}</span>
      {sub && <span className="mm-stat-sub">{sub}</span>}
    </div>
  );
}

function ConfusionMatrix({ cm, title }) {
  if (!cm) return null;
  const { true_negative, false_positive, false_negative, true_positive } = cm;
  return (
    <div className="mm-cm">
      {title && <h4 className="mm-cm-title">{title}</h4>}
      <div className="mm-cm-grid">
        <div className="mm-cm-cell mm-cm-corner" />
        <div className="mm-cm-cell mm-cm-header">Predicted legit</div>
        <div className="mm-cm-cell mm-cm-header">Predicted fraud</div>

        <div className="mm-cm-cell mm-cm-header">Actual legit</div>
        <div className="mm-cm-cell mm-cm-tn">{true_negative.toLocaleString()}</div>
        <div className="mm-cm-cell mm-cm-fp">{false_positive.toLocaleString()}</div>

        <div className="mm-cm-cell mm-cm-header">Actual fraud</div>
        <div className="mm-cm-cell mm-cm-fn">{false_negative.toLocaleString()}</div>
        <div className="mm-cm-cell mm-cm-tp">{true_positive.toLocaleString()}</div>
      </div>
    </div>
  );
}

function MetricsPanel({ metrics, title }) {
  if (!metrics) return null;
  return (
    <div className="mm-panel">
      {title && <div className="mm-panel-title">{title}</div>}
      <div className="mm-stat-row">
        <StatCard label="PR-AUC" value={metrics.pr_auc} />
        <StatCard label="Precision" value={metrics.precision} />
        <StatCard label="Recall" value={metrics.recall} />
        <StatCard label="F1-score" value={metrics.f1} />
      </div>
      <ConfusionMatrix cm={metrics.confusion_matrix} />
      <p className="mm-panel-footnote">
        Evaluated on {metrics.n_samples?.toLocaleString()} held-out rows
        ({metrics.n_fraud?.toLocaleString()} fraud) at threshold {metrics.threshold}
      </p>
    </div>
  );
}

function ModelRosterPanel({ info }) {
  if (!info) return null;
  return (
    <div className="mm-panel">
      <div className="mm-panel-title">Loaded components</div>
      <div className="mm-roster-table-wrap">
        <table className="mm-roster-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>File</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {info.components.map((c) => (
              <tr key={c.key}>
                <td>{c.component}</td>
                <td className="mm-mono">{c.file}</td>
                <td className="mm-muted">{c.role}</td>
                <td>
                  {c.loaded ? (
                    <span className="mm-badge-ok"><CheckCircle2 size={13} /> Loaded</span>
                  ) : (
                    <span className="mm-badge-missing"><XCircle size={13} /> Missing</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mm-panel-footnote">
        Reference data: ulb_data.csv {info.ulb_data_loaded ? "loaded" : "missing"} ·
        {" "}malaysian_profiles.csv {info.district_profiles_loaded ? "loaded" : "missing"}
      </p>
    </div>
  );
}

function DriftPanel({ drift, loading, error, onCheck }) {
  const chartData = drift
    ? drift.holdout_histogram.map((h, i) => ({
        bin: h.bin,
        Holdout: h.count,
        Live: drift.live_histogram[i]?.count ?? 0,
      }))
    : [];

  return (
    <div className="mm-panel">
      <div className="mm-panel-title-row">
        <div className="mm-panel-title">Traffic drift check</div>
        <button className="mm-btn mm-btn-ghost mm-btn-sm" onClick={onCheck} disabled={loading}>
          <Activity size={14} className={loading ? "mm-spin" : ""} />
          {loading ? "Checking…" : "Check now"}
        </button>
      </div>
      <p className="mm-muted mm-panel-desc">
        Compares Stage 1 scores on recent live transactions against the held-out
        validation set. 
      </p>

      {error && (
        <div className="mm-banner mm-banner-danger">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {drift && (
        <>
          {drift.drift_flag && (
            <div className="mm-banner mm-banner-warning">
              <AlertTriangle size={16} />
              Mean Stage 1 score shifted by {drift.mean_shift} vs. the held-out set —
              worth a closer look.
            </div>
          )}
          <div className="mm-stat-row">
            <StatCard label="Live mean" value={drift.live.mean} sub={`n=${drift.live_n}`} />
            <StatCard label="Holdout mean" value={drift.holdout.mean} />
            <StatCard label="Mean shift" value={drift.mean_shift} />
            <StatCard label="Live p90" value={drift.live.p90} />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="bin" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Holdout" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Live" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

export default function ManageModel() {
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [liveError, setLiveError] = useState(null);

  const [modelInfo, setModelInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState(null);

  const [drift, setDrift] = useState(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftError, setDriftError] = useState(null);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportMessage, setExportMessage] = useState(null);

  const loadLiveMetrics = useCallback(async () => {
    setLoadingLive(true);
    setLiveError(null);
    try {
      const data = await api.modelMetrics();
      setLiveMetrics(data);
    } catch (e) {
      setLiveError(e.message);
    } finally {
      setLoadingLive(false);
    }
  }, []);

  const loadModelInfo = useCallback(async () => {
    setLoadingInfo(true);
    setInfoError(null);
    try {
      const data = await api.modelInfo();
      setModelInfo(data);
    } catch (e) {
      setInfoError(e.message);
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  useEffect(() => {
    loadLiveMetrics();
    loadModelInfo();
  }, [loadLiveMetrics, loadModelInfo]);

  async function handleDriftCheck() {
    setDriftLoading(true);
    setDriftError(null);
    try {
      const data = await api.driftCheck(200);
      setDrift(data);
    } catch (e) {
      setDriftError(e.message);
    } finally {
      setDriftLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    setExportMessage(null);
    try {
      const blob = await api.exportReviewedTransactions();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "reviewed_transactions.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMessage("Export downloaded.");
    } catch (e) {
      setExportError(e.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mm-page">
      <header className="mm-header">
        <div className="mm-header-title">
          <Cpu size={24} className="mm-title-icon" />
          <div>
            <h1>Manage Algorithm</h1>
            <p>Fraud-detection cascade — performance, composition, and drift</p>
          </div>
        </div>
        <button className="mm-btn mm-btn-ghost" onClick={loadLiveMetrics} disabled={loadingLive}>
          <RefreshCw size={16} className={loadingLive ? "mm-spin" : ""} />
          Refresh metrics
        </button>
      </header>

      <section className="mm-section">
        <h2 className="mm-section-title"><TrendingUp size={18} /> Live model performance</h2>
        {loadingLive && !liveMetrics && <p className="mm-muted">Computing metrics on held-out data…</p>}
        {liveError && (
          <div className="mm-banner mm-banner-danger">
            <AlertTriangle size={16} /> {liveError}
          </div>
        )}
        {liveMetrics && <MetricsPanel metrics={liveMetrics} />}
      </section>

      <section className="mm-section">
        <h2 className="mm-section-title"><Layers size={18} /> Model composition</h2>
        {loadingInfo && !modelInfo && <p className="mm-muted">Loading model roster…</p>}
        {infoError && (
          <div className="mm-banner mm-banner-danger">
            <AlertTriangle size={16} /> {infoError}
          </div>
        )}
        {modelInfo && <ModelRosterPanel info={modelInfo} />}
      </section>

      <section className="mm-section">
        <h2 className="mm-section-title"><Activity size={18} /> Drift monitoring</h2>
        <DriftPanel
          drift={drift}
          loading={driftLoading}
          error={driftError}
          onCheck={handleDriftCheck}
        />
      </section>

      <section className="mm-section">
        <h2 className="mm-section-title"><Download size={18} /> Export for retraining</h2>
        <p className="mm-muted mm-panel-desc">
          Downloads every transaction an admin manually overrode via a resolved
          dispute ticket.
        </p>
        <button className="mm-btn mm-btn-primary" onClick={handleExport} disabled={exporting}>
          <Download size={16} />
          {exporting ? "Exporting…" : "Export reviewed transactions (CSV)"}
        </button>
        {exportMessage && (
          <div className="mm-banner mm-banner-success">
            <CheckCircle2 size={16} /> {exportMessage}
          </div>
        )}
        {exportError && (
          <div className="mm-banner mm-banner-danger">
            <XCircle size={16} /> {exportError}
          </div>
        )}
      </section>
    </div>
  );
}