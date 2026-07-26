import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { Shield, Activity, ClipboardList, LayoutDashboard, LogOut, Wifi, WifiOff, Bell, X , Users, CreditCard, Flag, BrainCog, Settings } from "lucide-react";
import "./Layout.css";

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const { connected, alerts, dismissAlert } = useSocket();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const latestAlert = alerts[0];

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Shield size={22} className="brand-icon" />
          <span className="brand-name">Fraud Detection</span>
        </div>

        <nav className="sidebar-nav">
          {/* Only Admins see these links */}
          {isAdmin ? (
            <>
              <NavLink to="/admin" end className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <LayoutDashboard size={18} />  Admin Panel
              </NavLink>
              <NavLink to="/admin/history" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <ClipboardList size={18} /> Transaction Logs
              </NavLink>
              <NavLink to="/admin/users" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <Users size={18} /> Manage Users
              </NavLink>
              <NavLink to="/admin/tickets" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <Flag size={18} /> Manage Tickets
              </NavLink>
              <NavLink to="/admin/model" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
                <BrainCog size={18} /> Manage Model
              </NavLink>
            </>
          ) : (
            <>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Activity size={18} /> Dashboard
            </NavLink>
            <NavLink to="/cards" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <CreditCard size={18} /> Manage Cards
            </NavLink>
            <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Bell size={18} /> Notifications
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <ClipboardList size={18} /> History
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
              <Settings size={18} /> Settings
            </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className={`conn-badge ${connected ? "online" : "offline"}`}>
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            {connected ? "Live" : "Offline"}
          </div>
          <div className="user-info">
            <div className="user-avatar">{(user?.displayName || user?.email || "U")[0].toUpperCase()}</div>
            <div className="user-meta">
              <span className="user-name">{user?.displayName || "User"}</span>
              <span className="user-role">{isAdmin ? "Administrator" : "Member"}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-area">
        {/* Alert banner */}
        {!isAdmin && latestAlert && (
          <div className={`alert-banner ${latestAlert.decision === "BLOCK" ? "danger" : "warning"}`}>
            <Bell size={16} />
            <span>
              <strong>{latestAlert.decision}</strong> — Stage {latestAlert.triggered_stage ?? "?"} fired
              &nbsp;(S1: {(latestAlert.stage1_prob * 100).toFixed(1)}%
              {latestAlert.stage2_prob != null ? `, S2: ${(latestAlert.stage2_prob * 100).toFixed(1)}%` : ""})
            </span>
            <button className="dismiss-btn" onClick={() => dismissAlert(latestAlert._key)}>
              <X size={14} />
            </button>
          </div>
        )}

        <Outlet />
      </main>
    </div>
  );
}