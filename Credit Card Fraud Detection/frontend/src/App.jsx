import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import LoginPage    from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard     from "./pages/Dashboard";
import HistoryPage  from "./pages/HistoryPage";
import AdminPage    from "./pages/AdminPage";
import Layout       from "./components/Layout";
import AdminHistoryPage from "./pages/AdminHistoryPage";
import ManageUserPage from "./pages/ManageUserPage";
import ManageCard from "./pages/ManageCard";
import NotificationsPage from "./pages/NotificationsPage";
import TicketsPage from "./pages/TicketsPage";
import ManageModel from "./pages/ManageModel";
import SettingsPage from "./pages/SettingsPage";

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="splash">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function ForceLogout() {
  const { logout } = useAuth();
  
  useEffect(() => {
    async function wipeState() {
      await logout();
      window.location.href = "/login"; // Force a hard redirect
    }
    wipeState();
  }, [logout]);

  return <div className="splash">Clearing user state...</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/nuke" element={<ForceLogout />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={
                <ProtectedRoute><Dashboard /></ProtectedRoute>
              } />
              <Route path="/history" element={
                <ProtectedRoute><HistoryPage /></ProtectedRoute>
              } />
              <Route path="/cards" element={
                <ProtectedRoute><ManageCard /></ProtectedRoute>
              } />
              <Route path="/notifications" element={
                <ProtectedRoute><NotificationsPage /></ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute><SettingsPage /></ProtectedRoute>
              } />
              <Route path="/admin/tickets" element={
                <ProtectedRoute adminOnly><TicketsPage /></ProtectedRoute>
              } />
              <Route path="/admin/history" element={
                <ProtectedRoute adminOnly><AdminHistoryPage /></ProtectedRoute>
              } />
              <Route path="/admin/model" element={
                <ProtectedRoute adminOnly><ManageModel /></ProtectedRoute>
              } />
              <Route path="/admin/users" element={
                <ProtectedRoute adminOnly><ManageUserPage /></ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>
              } />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}
