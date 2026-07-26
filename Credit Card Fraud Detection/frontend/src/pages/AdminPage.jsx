import { useState, useEffect } from "react";
import { api } from "../utils/api";
import { useSocket } from "../context/SocketContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import {
  Shield, AlertOctagon, CheckCircle, Clock, Users, RefreshCw, Bell, X
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

export default function AdminPage() {
  const [stats,   setStats]   = useState(null);
  const [txns,    setTxns]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminUid, setAdminUid] = useState("");
  const [adminMsg, setAdminMsg] = useState("");
  const { alerts, dismissAlert, markAllSeen} = useSocket();

  async function load() {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([api.adminStats(), api.transactions()]);
      setStats(s);
      setTxns(t.transactions || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  
  async function handleSetAdmin(e) {
    e.preventDefault();
    setAdminMsg("");
    try {
      const res = await api.setAdmin(adminUid.trim());
      setAdminMsg(res.message || "Done");
      setAdminUid("");
    } catch (err) {
      setAdminMsg(`Error: ${err.message}`);
    }
  }

  const pieData = stats ? [
    { name: "Approved", value: stats.approved, color: "#34d399" },
    { name: "Blocked",  value: stats.blocked,  color: "#f87171" },
  ] : [];

  // Bar chart: last 20 txns by district
  const districtMap = {};
  txns.forEach((t) => {
    const d = t.district || "Unknown";
    districtMap[d] = (districtMap[d] || 0) + 1;
  });
  const barData = Object.entries(districtMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([district, count]) => ({ district: district.length > 14 ? district.slice(0,12)+"…" : district, count }));

  const adminAlerts = alerts.filter(a => a.uid);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-sub">System-wide fraud monitoring and management</p>
        </div>
        <button className="refresh-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* Live alerts */}
      {alerts.length > 0 && (
        <div className="live-alerts">
                    <div className="live-alerts-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bell size={14} /> Live alerts ({adminAlerts.length})
            </span>
            <button
              className="dismiss-all-btn"
              onClick={() => markAllSeen(adminAlerts.map((a) => a.id))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'inherit', opacity: 0.75, textDecoration: 'underline' }}
            >
              Dismiss all
            </button>
          </div>
          <div className="live-alerts-list">
            {adminAlerts.slice(0, 5).map((a) => (
              <div
                key={a._key}
                className={`live-alert-item ${a.decision.toLowerCase()}`}
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Link
                  to={`/admin/history?txnId=${a.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', flex: 1 }}
                >
                  <strong>{a.decision}</strong> — S1: {(a.stage1_prob * 100).toFixed(1)}%
                  {a.stage2_prob != null ? ` · S2: ${(a.stage2_prob * 100).toFixed(1)}%` : ""}
                  {a.uid ? ` · User: ${a.uid.slice(0, 8)}…` : ""}
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
      {stats && (
        <div className="stat-cards">
          <StatCard icon={<Shield size={20} />}      label="Total transactions" value={stats.total}      color="blue" />
          <StatCard icon={<AlertOctagon size={20} />} label="Blocked"            value={stats.blocked}    color="red" />
          <StatCard icon={<CheckCircle size={20} />}  label="Approved"           value={stats.approved}   color="green" />
          <StatCard icon={<AlertOctagon size={20} />} label="Block rate"         value={`${stats.block_rate}%`} color="red" />
          <StatCard icon={<Users size={20} />}        label="Active users"       value={stats.users}      color="blue" />
        </div>
      )}

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
          <h2 className="panel-title">Transactions by district</h2>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} margin={{ left: -10 }}>
                <XAxis dataKey="district" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {barData.map((_, i) => <Cell key={i} fill="#6366f1" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="admin-panel">
        <h2 className="panel-title">Recent transactions (all users)</h2>
        {txns.length === 0 ? (
          <div className="empty-history">No transactions logged yet.</div>
        ) : (
          <div className="txn-table-wrap">
            <table className="txn-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
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
                      {new Date(t.timestamp).toLocaleString("en-MY", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                    </td>
                    <td style={{ fontSize: 12, fontFamily: "monospace" }}>{t.uid?.slice(0,10)}…</td>
                    <td>RM {parseFloat(t.amount||0).toFixed(2)}</td>
                    <td>{t.district || "—"}</td>
                    <td className={t.stage1_prob >= 0.5 ? "prob-danger" : "prob-safe"}>
                      {t.stage1_prob != null ? `${(t.stage1_prob*100).toFixed(2)}%` : "—"}
                    </td>
                    <td className={t.stage2_prob >= 0.5 ? "prob-danger" : "prob-safe"}>
                      {t.stage2_prob != null ? `${(t.stage2_prob*100).toFixed(2)}%` : "—"}
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

      {/* Grant admin */}
      <div className="admin-panel">
        <h2 className="panel-title">Grant admin access</h2>
        <p className="panel-sub">Enter a Firebase UID to grant administrator privileges.</p>
        <form onSubmit={handleSetAdmin} className="admin-form">
          <input
            type="text" placeholder="Firebase UID"
            value={adminUid} onChange={(e) => setAdminUid(e.target.value)}
            required
          />
          <button type="submit">Grant admin</button>
        </form>
        {adminMsg && <div className="admin-msg">{adminMsg}</div>}
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
  return <div style={{ height: 220, display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8", fontSize:14 }}>No data yet</div>;
}