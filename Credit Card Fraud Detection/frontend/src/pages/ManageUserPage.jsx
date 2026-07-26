import { useState, useEffect } from "react";
import { api } from "../utils/api";
import { Trash2, User, RefreshCw, Search, X, ShieldCheck, Ban, CheckCircle2 } from "lucide-react";
import "./AdminPage.css";
import "./ManageUserPage.css";

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [searchUid, setSearchUid] = useState("");
  const [busyUid, setBusyUid] = useState(null);

  async function load() {
    setLoading(true);
    try {
      // Registered users (name/email/dates/status) from Firebase Auth,
      // and transactions just for count/last-active.
      const [userRes, txnRes] = await Promise.all([
        api.registeredUsers(),
        api.transactions(),
      ]);

      const stats = {};
      (txnRes.transactions || []).forEach((t) => {
        if (!t.uid) return;
        if (!stats[t.uid]) stats[t.uid] = { count: 0, lastActive: t.timestamp };
        stats[t.uid].count += 1;
        if (t.timestamp && new Date(t.timestamp) > new Date(stats[t.uid].lastActive)) {
          stats[t.uid].lastActive = t.timestamp;
        }
      });

      const merged = (userRes.users || []).map((u) => ({
        ...u,
        count: stats[u.uid]?.count || 0,
        lastActive: stats[u.uid]?.lastActive || null,
      }));

      setUsers(merged);
    } catch (e) {
      console.error("Failed to load users:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleClearHistory(uid) {
    if (!window.confirm(`Delete ALL transactions for user ${uid}?`)) return;
    try {
      const res = await api.clearTransactions(uid);
      setActionMsg(`Deleted ${res.deleted} transactions for ${uid}`);
      load();
      setTimeout(() => setActionMsg(""), 4000);
    } catch (err) {
      setActionMsg(`Error: ${err.message}`);
    }
  }

  async function handleToggleDisabled(u) {
    const action = u.disabled ? "re-enable" : "disable";
    if (!window.confirm(`Are you sure you want to ${action} this account (${u.display_name || u.email || u.uid})?`)) return;
    setBusyUid(u.uid);
    try {
      await api.setUserDisabled(u.uid, !u.disabled);
      setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, disabled: !u.disabled } : x)));
    } catch (err) {
      setActionMsg(`Error: ${err.message}`);
    } finally {
      setBusyUid(null);
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = searchUid.toLowerCase();
    return (
      u.uid.toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.phone || "").toLowerCase().includes(q) ||
      (u.display_name || "").toLowerCase().includes(q)
    );
  });

  function formatDate(ms) {
    if (!ms) return "—";
    return new Date(ms).toLocaleString("en-MY", { year: "numeric", month: "short", day: "numeric" });
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h1 className="page-title">Manage Users</h1>
          <p className="page-sub">Registered accounts and their activity</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div className="uid-search">
            <Search size={14} className="uid-search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, or UID..."
              value={searchUid}
              onChange={(e) => setSearchUid(e.target.value)}
            />
            {searchUid && (
              <X size={14} className="uid-clear-icon" onClick={() => setSearchUid("")} />
            )}
          </div>
          <button className="refresh-btn" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="action-msg">{actionMsg}</div>
      )}

      <div className="admin-panel">
        <h2 className="panel-title">Registered Users ({filteredUsers.length})</h2>
        {loading ? (
          <div className="empty-history">Loading users…</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-history">{users.length === 0 ? "No users found." : "No users match your search."}</div>
        ) : (
          <div className="txn-table-wrap">
            <table className="txn-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Created</th>
                  <th>Last Sign-in</th>
                  <th>Transactions</th>
                  <th>Last Transaction</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.uid} className={u.disabled ? "user-row-disabled" : ""}>
                    <td>
                      <div className="user-cell">
                        <User size={14} className="user-cell-icon" />
                        <div>
                          <div className="user-cell-name">
                            {u.display_name || "(no name set)"}
                            {u.is_admin && <ShieldCheck size={13} className="admin-badge-icon" title="Admin" />}
                          </div>
                          <div className="user-cell-sub">{u.email || "—"}</div>
                          <div className="user-cell-sub">{u.phone || "—"}</div>
                          <div className="user-cell-uid">{u.uid || "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: "#64748b", fontSize: 13 }}>{formatDate(u.created_at)}</td>
                    <td style={{ color: "#64748b", fontSize: 13 }}>{formatDate(u.last_sign_in)}</td>
                    <td>{u.count}</td>
                    <td style={{ color: "#64748b", fontSize: 13 }}>
                      {u.lastActive ? new Date(u.lastActive).toLocaleString("en-MY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </td>
                    <td>
                      <span className={`badge ${u.disabled ? "block" : "approve"}`}>
                        {u.disabled ? "Disabled" : "Active"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          className="row-action-btn"
                          disabled={busyUid === u.uid}
                          onClick={() => handleToggleDisabled(u)}
                        >
                          {u.disabled
                            ? <><CheckCircle2 size={14} /> Enable</>
                            : <><Ban size={14} /> Disable</>
                          }
                        </button>
                        <button
                          className="row-action-btn danger"
                          onClick={() => handleClearHistory(u.uid)}
                        >
                          <Trash2 size={14} /> Clear History
                        </button>
                      </div>
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