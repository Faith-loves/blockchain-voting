import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "../App.css";

export default function ResetPassword() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    token: searchParams.get("token") || "",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  const canSubmit = useMemo(() => form.token.trim() && form.password.length >= 6 && form.password === form.confirm, [form]);

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    setDone("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: form.token.trim(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Reset failed");
      setDone(data.message || "Password reset successful");
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
            <h1 className="authTitle">Reset Password</h1>
            <p className="authSub">Paste the reset token you generated and choose a new password.</p>
          </div>

          <form className="authForm" onSubmit={onSubmit}>
            <label className="field">
              <span>Reset Token</span>
              <input className="fieldInput" value={form.token} onChange={(e) => setForm((prev) => ({ ...prev, token: e.target.value }))} />
            </label>
            <label className="field">
              <span>New Password</span>
              <input className="fieldInput" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} />
            </label>
            <label className="field">
              <span>Confirm Password</span>
              <input className="fieldInput" type="password" value={form.confirm} onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))} />
            </label>

            {err ? <div className="authError"><strong>Error:</strong> {err}</div> : null}
            {done ? <div className="authError" style={{ background: "rgba(34,197,94,.12)", borderColor: "rgba(34,197,94,.35)" }}>{done}</div> : null}

            <button className={`authBtn ${canSubmit && !loading ? "on" : ""}`} disabled={!canSubmit || loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <div className="authFooter">
              <button type="button" className="linkBtn" onClick={() => nav("/login")}>Back to login</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
