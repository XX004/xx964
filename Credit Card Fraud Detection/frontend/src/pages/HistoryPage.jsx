import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../utils/api";
import { useSocket } from "../context/SocketContext";
import { 
  CheckCircle, XCircle, RefreshCw, Clock, ChevronDown, ChevronRight, Flag, ShieldCheck, ArrowDownUp
} from "lucide-react";
import "./HistoryPage.css";

const DECISION_ICONS = {
  APPROVE: <CheckCircle size={15} className="hist-icon approve" />,
  BLOCK:   <XCircle     size={15} className="hist-icon block"   />,
};

const DECISION_BADGE = {
  APPROVE: "badge approve",
  BLOCK:   "badge block",
};

export default function HistoryPage() {
  const [txns,    setTxns]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [filter,  setFilter]  = useState("ALL");
  const [expandedRow, setExpandedRow] = useState(null);
  const [searchParams] = useSearchParams();
  const targetTxnId = searchParams.get("txnId");
  const [sortOrder, setSortOrder] = useState("DESC"); 

  // Dispute (ticket) state
  const [tickets, setTickets] = useState([]);       //  user's own tickets
  const [disputeOpenFor, setDisputeOpenFor] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeError, setDisputeError] = useState("");
  const { ticketUpdateSignal } = useSocket();

  async function loadTickets() {
    try {
      const res = await api.tickets();
      setTickets(res.tickets || []);
    } catch (e) {
      console.error("Failed to load tickets", e);
    }
  }

  function ticketFor(txnId) {
    return tickets.find((tk) => tk.transaction_id === txnId) || null;
  }

  async function submitDispute(txnId) {
    if (!disputeReason.trim()) {
      setDisputeError("Please explain why you think this wasn't fraud.");
      return;
    }
    setDisputeSubmitting(true);
    setDisputeError("");
    try {
      const ticket = await api.createTicket({ transaction_id: txnId, reason: disputeReason.trim() });
      setTickets((prev) => [ticket, ...prev]);
      setDisputeOpenFor(null);
      setDisputeReason("");
    } catch (e) {
      setDisputeError(e.message || "Failed to submit dispute");
    } finally {
      setDisputeSubmitting(false);
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.transactions();
      setTxns(res.transactions || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); loadTickets(); }, []);
  
  useEffect(() => {
    if (ticketUpdateSignal > 0) {
      load();
      loadTickets();
    }
  }, [ticketUpdateSignal]);

  useEffect(() => {
    if (targetTxnId && txns.length > 0) {
      setFilter("ALL");
      setExpandedRow(targetTxnId);
    }
  }, [targetTxnId, txns]);

  const filtered = [...txns]
    .filter((t) => filter === "ALL" ? true : t.decision === filter)
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === "DESC" ? timeB - timeA : timeA - timeB;
    });

  const toggleRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h1 className="page-title">Transaction History</h1>
          <p className="page-sub">Your recent fraud detection results</p>
        </div>
        <button className="refresh-btn" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        {["ALL","APPROVE","BLOCK"].map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "All" : f}
          </button>
        ))}
        <span style={{ margin: "0 8px", borderLeft: "1px solid #cbd5e1", height: "20px" }}></span>
        
        <button
          className="filter-btn active"
          onClick={() => setSortOrder(prev => prev === "DESC" ? "ASC" : "DESC")}
          title={sortOrder === "DESC" ? "Sort: Newest first" : "Sort: Oldest first"}
          style={{ width: "32px", padding: "0", display: "flex", justifyContent: "center", alignItems: "center" }}
        >
          {sortOrder === "DESC" ? <ArrowDownUp size={20} /> : <ArrowDownUp size={20} />}
        </button>
        <span className="filter-count">{filtered.length} records</span>
      </div>

      {error && <div className="error-box">{error}</div>}

      {loading && (
        <div className="loading-state">
          <RefreshCw size={24} className="spin" /> Loading transactions…
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="empty-history">
          <Clock size={36} className="empty-icon" />
          <p>No transactions found. Run a prediction first.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="txn-table-wrap">
          <table className="txn-table">
            <thead>
              <tr>
                <th style={{ width: '30px' }}></th>
                <th>Time</th>
                <th>Amount (RM)</th>
                <th>District</th>
                <th>Stage 1</th>
                <th>Stage 2</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <React.Fragment key={t.id}>
                  {/* Main Clickable Row */}
                  <tr 
                    className={`txn-row-clickable ${expandedRow === t.id ? 'active' : ''}`} 
                    onClick={() => toggleRow(t.id)}
                  >
                    <td style={{ color: '#94a3b8', textAlign: 'center' }}>
                      {expandedRow === t.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="td-time">
                      <Clock size={13} />
                      {new Date(t.timestamp).toLocaleString("en-MY", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="td-amount">RM {parseFloat(t.amount || 0).toFixed(2)}</td>
                    <td>{t.district || "—"}</td>
                    <td className={t.stage1_prob >= 0.5 ? "prob-danger" : "prob-safe"}>
                      {t.stage1_prob != null ? `${(t.stage1_prob * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className={t.stage2_prob >= 0.5 ? "prob-danger" : "prob-safe"}>
                      {t.stage2_prob != null ? `${(t.stage2_prob * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td>
                      <span className={DECISION_BADGE[t.decision] || "badge block"}>
                        {DECISION_ICONS[t.decision]} {t.decision}
                      </span>
                      {t.manually_reviewed && (
                        <span
                          className="badge reviewed"
                          title={
                            t.original_decision && t.original_decision !== t.decision
                              ? "Overturned via approved dispute"
                              : "Reviewed by admin — original decision upheld"
                          }
                        >
                          <ShieldCheck size={12} /> Reviewed
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Details Row */}
                  {expandedRow === t.id && (
                    <tr className="txn-expanded-row">
                      {/* colSpan is 7 to cover all columns including the new chevron column */}
                      <td colSpan="7">
                        <div className="expanded-grid">
                          <div className="expanded-item">
                            <span className="expanded-label">Full Timestamp</span>
                            <span className="expanded-value">{new Date(t.timestamp).toLocaleString("en-MY")}</span>
                          </div>
                          <div className="expanded-item">
                            <span className="expanded-label">Stage 1 Probability</span>
                            <span className={`expanded-value ${t.stage1_prob >= 0.5 ? 'prob-danger' : 'prob-safe'}`}>
                              {t.stage1_prob != null ? `${(t.stage1_prob * 100).toFixed(2)}%` : "N/A"}
                            </span>
                          </div>
                          <div className="expanded-item">
                            <span className="expanded-label">Stage 2 Probability</span>
                            <span className={`expanded-value ${t.stage2_prob >= 0.5 ? 'prob-danger' : 'prob-safe'}`}>
                              {t.stage2_prob != null ? `${(t.stage2_prob * 100).toFixed(2)}%` : "N/A"}
                            </span>
                          </div>
                          <div className="expanded-item">
                            <span className="expanded-label">Triggered Stage</span>
                            <span className="expanded-value">{t.triggered_stage ?? "None"}</span>
                          </div>
                          <div className="expanded-item">
                            <span className="expanded-label">Area Expenditure Mean</span>
                            <span className="expanded-value">
                              {t.area_expenditure_mean ? `RM ${parseFloat(t.area_expenditure_mean).toFixed(2)}` : "N/A"}
                            </span>
                          </div>
                          <div className="expanded-item">
                            <span className="expanded-label">Area Gini Index</span>
                            <span className="expanded-value">{t.area_gini_index ?? "N/A"}</span>
                          </div>
                          <div className="expanded-item">
                            <span className="expanded-label">Spending vs Area Avg</span>
                            <span className="expanded-value">
                            {t.spending_deviation_ratio != null ? `${(t.spending_deviation_ratio * 100).toFixed(1)}%` : "N/A"}
                            </span>
                          </div>
                        </div>

                        {/* Dispute this decision */}
                        <div className="dispute-section">
                          {(() => {
                            if (t.source === "mobile") {
                                return null;
                              }
                            const ticket = ticketFor(t.id);
                            if (ticket) {
                              return (
                                <div className={`ticket-status ticket-${ticket.status.toLowerCase()}`}>
                                  <Flag size={13} />
                                  {ticket.status === "PENDING" && "Dispute submitted — awaiting admin review"}
                                  {ticket.status === "APPROVED" && "Dispute approved — decision was overturned"}
                                  {ticket.status === "REJECTED" && "Dispute reviewed — original decision upheld"}
                                </div>
                              );
                            }

                            if (t.decision !== "BLOCK" && t.decision !== "APPROVE") return null;
                            
                            const isBlock = t.decision === "BLOCK";

                            if (disputeOpenFor === t.id) {
                              return (
                                <div className="dispute-form" onClick={(e) => e.stopPropagation()}>
                                  <textarea
                                    rows={2}
                                    placeholder={isBlock ? "Why do you think this wasn't fraud?" : "Why do you think this was fraud?"}
                                    value={disputeReason}
                                    onChange={(e) => setDisputeReason(e.target.value)}
                                  />
                                  {disputeError && <div className="dispute-error">{disputeError}</div>}
                                  <div className="dispute-form-actions">
                                    <button
                                      className="dispute-submit-btn"
                                      disabled={disputeSubmitting}
                                      onClick={() => submitDispute(t.id)}
                                    >
                                      {disputeSubmitting ? "Submitting…" : "Submit dispute"}
                                    </button>
                                    <button
                                      className="dispute-cancel-btn"
                                      onClick={() => { setDisputeOpenFor(null); setDisputeReason(""); setDisputeError(""); }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <button
                                className="dispute-open-btn"
                                onClick={(e) => { e.stopPropagation(); setDisputeOpenFor(t.id); }}
                              >
                                <Flag size={13} /> {isBlock ? "Make a ticket" : "Report as fraud"}
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}