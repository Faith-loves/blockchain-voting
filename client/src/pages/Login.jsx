import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveSession } from "../utils/auth";
import "../App.css";

export default function Login() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    email: "",
    matric: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = useMemo(() => {
    return (
      form.email.trim().length > 0 &&
      form.matric.trim().length > 0 &&
      form.password.trim().length > 0
    );
  }, [form]);

  function onChange(e) {
    setForm((p) => ({
      ...p,
      [e.target.name]: e.target.value
    }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          matric: form.matric.trim(),
          password: form.password
        })
      });

      const data = await res.json();

      if (!res.ok || !data?.ok) {
        throw new Error(data?.message || "Login failed");
      }

      saveSession({ user: data.user });

      const role = data?.user?.role || "voter";
      nav(role === "admin" ? "/admin" : "/dashboard", { replace: true });

    } catch (e) {
      setErr(String(e.message || e));
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
            <div className="authBadge">Student Portal</div>
            <h1 className="authTitle">Sign in</h1>
            <p className="authSub">Use your email, matric number, and password.</p>
          </div>

          <form className="authForm" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                className="fieldInput"
                name="email"
                value={form.email}
                onChange={onChange}
              />
            </label>

            <label className="field">
              <span>Matric Number</span>
              <input
                className="fieldInput"
                name="matric"
                value={form.matric}
                onChange={onChange}
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                className="fieldInput"
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
              />
            </label>

            {err && (
              <div className="authError">
                <strong>Login error:</strong> {err}
              </div>
            )}

            <button
              className={`authBtn ${canSubmit && !loading ? "on" : ""}`}
              disabled={!canSubmit || loading}
            >
              {loading ? "Signing in…" : "Continue"}
            </button>

            <div className="authFooter">
              <button type="button" className="linkBtn" onClick={() => nav("/register")}>
                New student? Create account →
              </button>

              <button type="button" className="linkBtn" onClick={() => nav("/")}>
                ← Back to Home
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
