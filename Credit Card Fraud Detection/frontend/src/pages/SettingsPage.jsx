import { useState, useEffect } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import { User, Mail, Phone, Calendar, KeyRound, CheckCircle2, AlertTriangle } from "lucide-react";
import "./SettingsPage.css";

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getProfile();
        setProfile(res.profile);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handlePasswordReset() {
    if (!user?.email) return;
    setResetSending(true);
    setResetError(null);
    setResetSent(false);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
    } catch (e) {
      setResetError(e.message);
    } finally {
      setResetSending(false);
    }
  }

  const createdAt = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-MY", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "Unknown";

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Your account details</p>
      </div>

      <div className="settings-panel">
        <div className="settings-row">
          <User size={16} className="settings-icon" />
          <div>
            <span className="settings-label">Display name</span>
            <span className="settings-value">{user?.displayName || "—"}</span>
          </div>
        </div>

        <div className="settings-row">
          <Mail size={16} className="settings-icon" />
          <div>
            <span className="settings-label">Email</span>
            <span className="settings-value">{user?.email || "—"}</span>
          </div>
        </div>

        <div className="settings-row">
          <Phone size={16} className="settings-icon" />
          <div>
            <span className="settings-label">Phone</span>
            <span className="settings-value">
              {loading ? "Loading…" : profile?.phone || "Not set"}
            </span>
          </div>
        </div>

        <div className="settings-row">
          <Calendar size={16} className="settings-icon" />
          <div>
            <span className="settings-label">Account created</span>
            <span className="settings-value">{createdAt}</span>
          </div>
        </div>
      </div>

      <div className="settings-panel">
        <h2 className="settings-panel-title">
          <KeyRound size={16} /> Password
        </h2>
        <p className="settings-desc">
          We'll email a reset link to <strong>{user?.email}</strong>.
        </p>
        <button
          className="settings-btn"
          onClick={handlePasswordReset}
          disabled={resetSending}
        >
          {resetSending ? "Sending…" : "Send password reset email"}
        </button>

        {resetSent && (
          <div className="settings-banner settings-banner-success">
            <CheckCircle2 size={16} /> Reset email sent — check your inbox.
          </div>
        )}
        {resetError && (
          <div className="settings-banner settings-banner-danger">
            <AlertTriangle size={16} /> {resetError}
          </div>
        )}
      </div>
    </div>
  );
}