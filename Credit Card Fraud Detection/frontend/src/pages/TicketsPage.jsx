import { useState, useEffect } from "react";
import { api } from "../utils/api";
import {
  RefreshCw, Flag, Clock, Check, X, CheckCircle, XCircle, Trash2, Search
} from "lucide-react";
import { Link } from "react-router-dom";
import "./HistoryPage.css";
import "./TicketsPage.css";

export default function TicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [searchQuery, setSearchQuery] = useState("");
  const [resolvingId, setResolvingId] = useState(null);
  const [clearing, setClearing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await api.tickets();
      const sorted = (res.tickets || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setTickets(sorted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleResolve(ticketId, status) {
    setResolvingId(ticketId);
    try {
      await api.resolveTicket(ticketId, status);
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status, resolved_at: new Date().toISOString() } : t))
      );
    } catch (e) {
      console.error(e);
      alert(e.message || "Failed to resolve ticket");
    } finally {
      setResolvingId(null);
    }
  }

  const filtered = tickets.filter((t) => {
    // 1. Check status
    const matchesStatus = filter === "ALL" || t.status === filter;
    
    // 2. Check search (UID or Date)
    const q = searchQuery.toLowerCase();
    const dateStr = new Date(t.created_at).toLocaleString("en-MY", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).toLowerCase();
    
    const matchesSearch = 
      !q || // Show all if search is empty
      (t.uid && t.uid.toLowerCase().includes(q)) || 
      dateStr.includes(q);

    return matchesStatus && matchesSearch;
  });

  const pendingCount = tickets.filter((t) => t.status === "PENDING").length;

  async function handleClearAll() {
    // Determine if we are filtering the view
    const isFiltering = filter !== "ALL" || searchQuery.trim() !== "";
    
    // Setup dynamic warning message
    let warning = "";
    if (isFiltering) {
      warning = `You are about to delete ONLY the ${filtered.length} tickets matching your current filter. Continue?`;
    } else {
      warning = pendingCount > 0
        ? `This deletes ALL ${tickets.length} tickets, including ${pendingCount} still PENDING. This does NOT undo any already-approved decision changes. Continue?`
        : `This deletes all ${tickets.length} tickets. This does NOT undo any already-approved decision changes. Continue?`;
    }

    if (!window.confirm(warning)) return;

    setClearing(true);
    try {
      if (isFiltering) {
        const idsToDelete = filtered.map(t => t.id);
        await api.clearTickets(idsToDelete);
        setTickets(prev => prev.filter(t => !idsToDelete.includes(t.id)));
      } else {
        await api.clearTickets();
        setTickets([]);
      }
    } catch (e) {
      alert(e.message || "Failed to clear tickets");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1 className="page-title">Dispute Tickets</h1>
          <p className="page-sub">Users disputing a blocked transaction</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Search bar */}
          <div className="uid-search">
            <Search size={14} className="uid-search-icon" />
            <input
              type="text"
              placeholder="Search UID or Date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <X size={14} className="uid-clear-icon" onClick={() => setSearchQuery("")} />
            )}
          </div>

          {tickets.length > 0 && (
            <button className="clear-all-btn" onClick={handleClearAll} disabled={clearing}>
              <Trash2 size={14} /> {clearing ? "Deleting…" : "Delete all"}
            </button>
          )}
          <button className="refresh-btn" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="filter-bar">
        {["PENDING", "APPROVED", "REJECTED", "ALL"].map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "PENDING" ? `Pending (${pendingCount})` : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
        <span className="filter-count">{filtered.length} tickets</span>
      </div>

      {loading && (
        <div className="loading-state">
          <RefreshCw size={24} className="spin" /> Loading tickets…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="empty-history">
          <Flag size={36} className="empty-icon" />
          <p>{searchQuery ? "No tickets match your search." : `No ${filter !== "ALL" ? filter.toLowerCase() : ""} tickets.`}</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="ticket-list">
          {filtered.map((t) => (
            <div key={t.id} className={`ticket-card ticket-card-${t.status.toLowerCase()}`}>
              <div className="ticket-card-header">
                <div className="ticket-card-txn">
                  <strong>RM {parseFloat(t.amount || 0).toFixed(2)}</strong>
                  {t.district ? ` · ${t.district}` : ""}
                  {t.stage1_prob != null && ` · S1: ${(t.stage1_prob * 100).toFixed(1)}%`}
                  {t.stage2_prob != null && ` · S2: ${(t.stage2_prob * 100).toFixed(1)}%`}
                  {" · "}{t.decision === "BLOCK" ? "Requesting release" : "Reporting as fraud"}
                </div>
                <span className={`badge ${t.status === "APPROVED" ? "approve" : t.status === "REJECTED" ? "block" : "hold"}`}>
                  {t.status}
                </span>
              </div>

              <div className="ticket-card-meta">
                <Clock size={12} />
                Submitted {new Date(t.created_at).toLocaleString("en-MY", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
                {" · "}Transaction from {new Date(t.timestamp).toLocaleString("en-MY", {
                  month: "short", day: "numeric",
                })}
                {" · "}User {t.uid?.slice(0, 8)}…
              </div>

              <div className="ticket-card-reason">"{t.reason}"</div>

              <div className="ticket-card-actions">
                <Link to={`/admin/history?txnId=${t.transaction_id}`} className="ticket-view-link">
                  View original transaction
                </Link>
                {t.status === "PENDING" && (
                  <div className="ticket-resolve-actions">
                    <button
                      className="ticket-approve-btn"
                      disabled={resolvingId === t.id}
                      onClick={() => handleResolve(t.id, "APPROVED")}
                    >
                      <Check size={14} /> {t.decision === "BLOCK" ? "Approve (release)" : "Approve (flag as fraud)"}
                    </button>
                    <button
                      className="ticket-reject-btn"
                      disabled={resolvingId === t.id}
                      onClick={() => handleResolve(t.id, "REJECTED")}
                    >
                      <X size={14} /> {t.decision === "BLOCK" ? "Reject (uphold block)" : "Reject (keep approved)"}
                    </button>
                  </div>
                )}
                {t.status === "APPROVED" && (
                  <span className="ticket-resolved-note">
                    <CheckCircle size={13} /> Decision changed to {t.decision === "BLOCK" ? "APPROVE" : "BLOCK"}
                  </span>
                )}
                {t.status === "REJECTED" && (
                  <span className="ticket-resolved-note muted"><XCircle size={13} /> Original decision upheld</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}