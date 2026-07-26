  import React, { useState, useEffect } from "react";
  import { api } from "../utils/api";
  import { 
    Search, RefreshCw, Clock, ChevronDown, ChevronRight, CheckCircle, XCircle, X, ArrowDownUp, ShieldCheck
  } from "lucide-react";
  import { Link,useSearchParams  } from "react-router-dom";
  import "./AdminHistoryPage.css"; 

  const DECISION_ICONS = {
    APPROVE: <CheckCircle size={15} className="hist-icon approve" />,
    BLOCK:   <XCircle     size={15} className="hist-icon block"   />,
  };

  const DECISION_BADGE = {
    APPROVE: "badge approve",
    BLOCK:   "badge block",
  };

  export default function AdminHistoryPage() {
    const [txns, setTxns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchUid, setSearchUid] = useState("");
    const [expandedRow, setExpandedRow] = useState(null);
    const [searchParams] = useSearchParams();
    const targetTxnId = searchParams.get("txnId");
    const [filter, setFilter] = useState("ALL"); 
    const [sortOrder, setSortOrder] = useState("DESC"); 

    async function load() {
      setLoading(true);
      try {
        const res = await api.transactions();
        setTxns(res.transactions || []); 
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => { load(); }, []);

    useEffect(() => {
      if (targetTxnId && txns.length > 0) {
        setExpandedRow(targetTxnId);
      }
    }, [targetTxnId, txns]);

    // Filter transactions by UID search input
    const filteredTxns = [...txns]
      .filter((t) => {
        const matchesSearch = t.uid?.toLowerCase().includes(searchUid.toLowerCase());
        const matchesFilter = filter === "ALL" || t.decision === filter;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortOrder === "DESC" ? timeB - timeA : timeA - timeB;
      }); 

    const toggleRow = (id) => {
      setExpandedRow(expandedRow === id ? null : id);
    };

    const getReasonText = (t) => {
      if (t.decision === "APPROVE") {
        return "Approved: No anomalous patterns detected and the amount aligns with typical expenditure for this district.";
      }
      if (t.triggered_stage === 1) {
        return "Blocked at Stage 1: The AI detected highly anomalous patterns within the encrypted transaction signature (V-features).";
      }
      if (t.triggered_stage === 2) {
        return `Blocked at Stage 2: The transaction amount of RM ${parseFloat(t.amount || 0).toFixed(2)} significantly exceeds normal spending behavior for this district.`;
      }
      if (t.triggered_stage === "velocity") {
        return "Blocked by velocity rule: Too many transactions in a short period.";
      }
      if (t.source === "mobile") {
        return t.decision === "BLOCK"
          ? "Flagged as fraud via the mobile app."
          : "Approved via the mobile app.";
      }
      return "Decision recorded.";
    };

    return (
      <div className="history-page admin-history-page">
        <div className="history-header">
          <div>
            <h1 className="page-title">Transaction Logs</h1>
            <p className="page-sub">System-wide transaction history</p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* UID Search Bar */}
            <div className="uid-search">
              <Search size={14} className="uid-search-icon" />
              <input
                type="text"
                placeholder="Search by UID..."
                value={searchUid}
                onChange={(e) => setSearchUid(e.target.value)}
              />
              {/* Render the clear button ONLY if there is text in the input */}
              {searchUid && (
                <X 
                  size={14} 
                  className="uid-clear-icon" 
                  onClick={() => setSearchUid("")} 
                />
              )}
            </div>
            <button className="refresh-btn" onClick={load} disabled={loading}>
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
            </button>
          </div>
        </div>
        <div className="filter-bar" style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          {["ALL","APPROVE","BLOCK"].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? "All" : f}
            </button>
          ))}
          {/* Date Sorting Toggle */}
          <span style={{ margin: "0 4px", borderLeft: "1px solid #cbd5e1", height: "20px" }}></span>
          
          <button
            className="filter-btn active"
            onClick={() => setSortOrder(prev => prev === "DESC" ? "ASC" : "DESC")}
            title={sortOrder === "DESC" ? "Sort: Newest first" : "Sort: Oldest first"}
            style={{ width: "32px", padding: "0", display: "flex", justifyContent: "center", alignItems: "center" }}
          >
            {sortOrder === "DESC" ? <ArrowDownUp size={20} /> : <ArrowDownUp size={20} />}
          </button>

          <span className="filter-count" style={{ marginLeft: 'auto', fontSize: '0.9rem', color: '#64748b' }}>
            {filteredTxns.length} records
          </span>
        </div>

        {loading ? (
          <div className="loading-state">
            <RefreshCw size={24} className="spin" /> Loading logs…
          </div>
        ) : filteredTxns.length === 0 ? (
          <div className="empty-history">No transactions match your search.</div>
        ) : (
          <div className="txn-table-wrap">
            <table className="txn-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Time</th>
                  <th>User (UID)</th>
                  <th>Amount (RM)</th>
                  <th>District</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxns.map((t) => (
                  <React.Fragment key={t.id}>
                    {/* Clickable Main Row */}
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
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td className="td-uid">{t.uid ? t.uid.slice(0, 8) + "…" : "Unknown"}</td>
                      <td className="td-amount">RM {parseFloat(t.amount || 0).toFixed(2)}</td>
                      <td>{t.district || "—"}</td>
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

                    {/* Expanded Data View */}
                    {expandedRow === t.id && (
                      <tr className="txn-expanded-row">
                        <td colSpan="6">
                          <div className="expanded-grid">
                            <div className="expanded-item">
                              <span className="expanded-label">Full UID / User</span>
                              <span className="expanded-value td-uid">{t.uid || "N/A"}</span>
                            </div>
                            <div className="expanded-item">
                              <span className="expanded-label">Full Timestamp</span>
                              <span className="expanded-value">{new Date(t.timestamp).toLocaleString("en-MY")}</span>
                            </div>
                            <div className="expanded-item">
                              <span className="expanded-label">Triggered Stage</span>
                              <span className="expanded-value">{t.triggered_stage ?? "None"}</span>
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
                            <div className="expanded-item" style={{ gridColumn: '1 / -1' }}>
                              <span className="expanded-label">Reasoning</span>
                              <span className="expanded-value">{getReasonText(t) ?? "N/A"}</span>
                            </div>
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