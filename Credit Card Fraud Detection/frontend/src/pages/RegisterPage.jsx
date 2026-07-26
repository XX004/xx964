import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../utils/api";
import { Shield, Mail, Lock, User, Phone, AlertCircle } from "lucide-react";
import "./Auth.css";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("+60");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      await register(email, password, name.trim());
      // Account exists at this point even if this next call fails, so we
      // don't block navigation on it — just log it for now.
      try {
        await api.updateProfile({ fullName: name.trim(), email, phone: phone.trim() });
      } catch (profileErr) {
        console.error("Failed to save profile:", profileErr);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><Shield size={28} /></div>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">Get started with us!</p>

        {error && <div className="auth-error"><AlertCircle size={15} /> {error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="name">Full name</label>
            <div className="input-wrap">
              <User size={16} className="input-icon" />
              <input id="name" type="text" required value={name}
                onChange={(e) => setName(e.target.value)} placeholder="Ahmad Razif" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <div className="input-wrap">
              <Mail size={16} className="input-icon" />
              <input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="phone">Phone number</label>
            <div className="input-wrap">
              <Phone size={16} className="input-icon" />
              <input id="phone" type="tel" required value={phone}
                onChange={(e) => setPhone(e.target.value)} placeholder="+60123456789" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input id="password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input id="confirm" type="password" required value={confirm}
                onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}

function friendlyError(msg) {
  if (msg.includes("email-already-in-use")) return "This email is already registered.";
  if (msg.includes("invalid-email"))        return "Please enter a valid email address.";
  if (msg.includes("weak-password"))        return "Password is too weak.";
  return "Registration failed. Please try again.";
}