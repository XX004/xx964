import { useState, useEffect } from "react";
import { api } from "../utils/api";
import { useSocket } from "../context/SocketContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import {
  Shield, AlertOctagon, CheckCircle, RefreshCw, Bell, X
} from "lucide-react";
import { Link } from "react-router-dom";
import "./AdminPage.css";

const RADIAN = Math.PI / 180;
// Outside-pointing label with a bent connector line (classic Recharts pattern).
// The line's elbow point is fixed at a set distance from the pie, independent
// of slice size, so it no longer "strays" for small slices like Blocked.
function renderPieLabel({ cx, cy, midAngle, outerRadius, percent, value }) {
  if (percent === 0) return null;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 6) * cos;
  const sy = cy + (outerRadius + 6) * sin;
  const mx = cx + (outerRadius + 26) * cos;
  const my = cy + (outerRadius + 26) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 16;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#cbd5e1" fill="none" />
      <circle cx={ex} cy={ey} r={2.5} fill="#94a3b8" stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey - 2} textAnchor={textAnchor} fontSize={13} fontWeight={700} fill="#111827">
        {value}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 8} y={ey + 13} textAnchor={textAnchor} fontSize={11} fontWeight={600} fill="#94a3b8">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    </g>
  );
}

export default function Dashboard() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const { alerts, dismissAlert } = useSocket();

  async function load() {
    setLoading(true);
    try {
      // Already scoped server-side: /transactions returns only this user's own rows
      const res = await api.transactions();
      setTxns(res.transactions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const total = txns.length;
  const blocked = txns.filter((t) => t.decision === "BLOCK").length;
  const approved = txns.filter((t) => t.decision === "APPROVE").length;
  const blockRate = total > 0 ? ((blocked / total) * 100).toFixed(1) : "0.0";

  const pieData = total > 0 ? [
    { name: "Approved", value: approved, color: "#34d399" },
    { name: "Blocked",  value: blocked,  color: "#f87171" },
  ] : [];

  const districtMap = {};
  txns.forEach((t) => {
    const d = t.district || "Unknown";
    districtMap[d] = (districtMap[d] || 0) + 1;
  });
  const barData = Object.entries(districtMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([district, count]) => ({ district: district.length > 14 ? district.slice(0, 12) + "…" : district, count }));

  // `!a.uid` excludes admin-room broadcast copies (only relevant if this
  // account is also an admin) — personal-room fraud_alert events never carry uid.
  const myAlerts = alerts.filter((a) => !a.uid);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-sub">Your transaction activity and fraud checks</p>
        </div>
        <button className="refresh-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* Live alerts — your own blocked transactions only */}
      {myAlerts.length > 0 && (
        <div className="live-alerts">
          <div className="live-alerts-header">
            <Bell size={14} /> Your alerts ({myAlerts.length})
          </div>
          <div className="live-alerts-list">
            {myAlerts.slice(0, 5).map((a) => (
              <div
                key={a._key}
                className={`live-alert-item ${a.decision.toLowerCase()}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Link
                  to={`/history?txnId=${a.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}
                >
                  <strong>{a.decision}</strong> — S1: {(a.stage1_prob * 100).toFixed(1)}%
                  {a.stage2_prob != null ? ` · S2: ${(a.stage2_prob * 100).toFixed(1)}%` : ""}
                </Link>
                <button
                  className="alert-dismiss-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dismissAlert(a._key);
                  }}
                  aria-label="Dismiss alert"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'inherit', opacity: 0.6 }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="stat-cards">
        <StatCard icon={<Shield size={20} />}       label="Total transactions" value={total}           color="blue" />
        <StatCard icon={<AlertOctagon size={20} />} label="Blocked"            value={blocked}         color="red" />
        <StatCard icon={<CheckCircle size={20} />}  label="Approved"           value={approved}        color="green" />
        <StatCard icon={<AlertOctagon size={20} />} label="Block rate"         value={`${blockRate}%`} color="red" />
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-panel">
          <h2 className="panel-title">Decision breakdown</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart margin={{ top: 20, right: 40, bottom: 10, left: 40 }}>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={70}
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={30} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>

        <div className="chart-panel">
          <h2 className="panel-title">Your transactions by district</h2>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} margin={{ left: -10 }}>
                <XAxis dataKey="district" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {barData.map((_, i) => <Cell key={i} fill="#6366f1" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* Recent activity */}
      <div className="admin-panel">
        <h2 className="panel-title">Recent activity</h2>
        {txns.length === 0 ? (
          <div className="empty-history">No transactions yet.</div>
        ) : (
          <div className="txn-table-wrap">
            <table className="txn-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Amount</th>
                  <th>District</th>
                  <th>S1%</th>
                  <th>S2%</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, 10).map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontSize: 12, color: "#64748b" }}>
                      {new Date(t.timestamp).toLocaleString("en-MY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td>RM {parseFloat(t.amount || 0).toFixed(2)}</td>
                    <td>{t.district || "—"}</td>
                    <td className={t.stage1_prob >= 0.5 ? "prob-danger" : "prob-safe"}>
                      {t.stage1_prob != null ? `${(t.stage1_prob * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td className={t.stage2_prob >= 0.5 ? "prob-danger" : "prob-safe"}>
                      {t.stage2_prob != null ? `${(t.stage2_prob * 100).toFixed(2)}%` : "—"}
                    </td>
                    <td>
                      <span className={`badge ${t.decision?.toLowerCase()}`}>{t.decision}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <div className={`stat-card-icon icon-${color}`}>{icon}</div>
      <div>
        <div className="stat-card-label">{label}</div>
        <div className="stat-card-value">{value}</div>
      </div>
    </div>
  );
}

function EmptyChart() {
  return <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 14 }}>No data yet</div>;
}