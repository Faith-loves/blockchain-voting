import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "../App.css";

export default function ForgotPassword() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", matric: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          matric: form.matric.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Password recovery failed");
      setResult(data);
    } catch (e2) {
      setErr(String(e2?.message || e2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="authBg" />
      <div className="authShade" />
      <div className="authWrap">
        <div className="authCard">
          <div className="authHeader">
            <div className="authBadge">Recovery</div>
            <h1 className="authTitle">Forgot Password</h1>
            <p className="authSub">Enter the email and matric number for your account.</p>
          </div>

          <form className="authForm" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input className="fieldInput" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </label>
            <label className="field">
              <span>Matric Number</span>
              <input className="fieldInput" value={form.matric} onChange={(e) => setForm((prev) => ({ ...prev, matric: e.target.value }))} />
            </label>

            {err ? <div className="authError"><strong>Error:</strong> {err}</div> : null}
            {result ? (
              <div className="authError" style={{ background: "rgba(34,197,94,.12)", borderColor: "rgba(34,197,94,.35)" }}>
                <strong>{result.message}</strong>
                {result.resetToken ? <div style={{ marginTop: 8, wordBreak: "break-all" }}>Reset token: {result.resetToken}</div> : null}
                {result.expiresAt ? <div style={{ marginTop: 4 }}>Expires: {new Date(result.expiresAt).toLocaleString()}</div> : null}
                {result.resetToken ? (
                  <button type="button" className="linkBtn" onClick={() => nav(`/reset-password?token=${encodeURIComponent(result.resetToken)}`)}>
                    Continue to reset password →
                  </button>
                ) : null}
              </div>
            ) : null}

            <button className="authBtn on" disabled={loading}>{loading ? "Generating..." : "Generate Reset Token"}</button>

            <div className="authFooter">
              <button type="button" className="linkBtn" onClick={() => nav("/login")}>Back to login</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
