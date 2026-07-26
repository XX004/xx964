import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, Mail, Lock, AlertCircle } from "lucide-react";
import "./Auth.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      const token = await user.getIdTokenResult();
      navigate(token.claims?.admin ? "/admin" : "/dashboard");
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Shield size={28} />
        </div>
        <h1 className="auth-title">Credit Card Fraud Detection</h1>
      
        <p className="auth-sub">Sign in to your account</p>

        {error && (
          <div className="auth-error">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label htmlFor="email">Email</label>
            <div className="input-wrap">
              <Mail size={16} className="input-icon" />
              <input
                id="email" type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <Lock size={16} className="input-icon" />
              <input
                id="password" type="password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account?{" "}
          <Link to="/register">Create one</Link>
        </p>
        
      </div>
    </div>
  );
}

function friendlyError(msg) {
  if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential"))
    return "Invalid email or password.";
  if (msg.includes("too-many-requests"))
    return "Too many attempts. Please try again later.";
  return "Sign in failed. Please try again.";
}
