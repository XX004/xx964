import { useState, useEffect, useMemo } from "react";
import { api } from "../utils/api";
import { useSocket } from "../context/SocketContext";
import {
  Bell, BellOff, RefreshCw, Clock, CheckCheck, XCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import "./HistoryPage.css";
import "./NotificationsPage.css";

export default function NotificationsPage() {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL"); // ALL | UNREAD
  const { markSeen, markAllSeen, dismissedIds, ticketUpdateSignal } = useSocket();

  async function load() {
    setLoading(true);
    try {
      // Already scoped server-side to this user's own transactions
      const res = await api.transactions();
      const blocked = (res.transactions || [])
        .filter((t) => t.decision === "BLOCK")
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setTxns(blocked);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (ticketUpdateSignal > 0) load();
  }, [ticketUpdateSignal]);

  const unreadIds = useMemo(
    () => txns.filter((t) => !dismissedIds.has(t.id)).map((t) => t.id),
    [txns, dismissedIds]
  );

  const visibleTxns = filter === "UNREAD"
    ? txns.filter((t) => !dismissedIds.has(t.id))
    : txns;

  return (
    <div className="history-page notifications-page">
      <div className="history-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-sub">All fraud alerts on your account</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {unreadIds.length > 0 && (
            <button className="mark-all-btn" onClick={() => markAllSeen(unreadIds)}>
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
          <button className="refresh-btn" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="filter-bar">
        {["ALL", "UNREAD"].map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "All" : `Unread (${unreadIds.length})`}
          </button>
        ))}
        <span className="filter-count">{visibleTxns.length} notifications</span>
      </div>

      {loading && (
        <div className="loading-state">
          <RefreshCw size={24} className="spin" /> Loading notifications…
        </div>
      )}

      {!loading && visibleTxns.length === 0 && (
        <div className="empty-history">
          <BellOff size={36} className="empty-icon" />
          <p>{filter === "UNREAD" ? "You're all caught up." : "No fraud alerts yet."}</p>
        </div>
      )}

      {!loading && visibleTxns.length > 0 && (
        <div className="notif-list">
          {visibleTxns.map((t) => {
            const isUnread = !dismissedIds.has(t.id);
            return (
              <div key={t.id} className={`notif-item ${isUnread ? "unread" : ""}`}>
                {isUnread && <span className="unread-dot" />}
                <XCircle size={18} className="notif-icon" />
                <div className="notif-body">
                  <div className="notif-title">
                    Transaction blocked — RM {parseFloat(t.amount || 0).toFixed(2)}
                    {t.district ? ` · ${t.district}` : ""}
                  </div>
                  <div className="notif-meta">
                    <Clock size={12} />
                    {new Date(t.timestamp).toLocaleString("en-MY", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                    {t.stage1_prob != null && ` · S1: ${(t.stage1_prob * 100).toFixed(1)}%`}
                    {t.stage2_prob != null && ` · S2: ${(t.stage2_prob * 100).toFixed(1)}%`}
                  </div>
                </div>
                <div className="notif-actions">
                  <Link to={`/history?txnId=${t.id}`} className="notif-view-link">
                    View
                  </Link>
                  {isUnread && (
                    <button className="notif-read-btn" onClick={() => markSeen(t.id)}>
                      <Bell size={13} /> Mark read
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}