import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import "../App.css";

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "", matric: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = useMemo(() => {
    const emailOk = form.email.trim().length > 0;
    const matricOk = form.matric.trim().length > 0;
    const passwordOk = form.password.trim().length >= 6;
    const confirmOk = form.password === form.confirm && form.confirm.length > 0;
    return emailOk && matricOk && passwordOk && confirmOk;
  }, [form]);

  function onChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) {
      setErr("Complete all fields and make sure both passwords match.");
      return;
    }

    setErr("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          matric: form.matric.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.message || "Registration failed");

      nav("/login");
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
            <div className="authBadge">Student Portal</div>
            <h1 className="authTitle">Create account</h1>
            <p className="authSub">Register once, then sign in to vote.</p>
          </div>

          <form className="authForm" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                className="fieldInput"
                name="email"
                placeholder="name@stu.babcock.edu.ng"
                value={form.email}
                onChange={onChange}
              />
            </label>

            <label className="field">
              <span>Matric Number</span>
              <input
                className="fieldInput"
                name="matric"
                placeholder="22/1124"
                value={form.matric}
                onChange={onChange}
              />
            </label>

            <label className="field">
              <span>Password (min 6)</span>
              <input
                className="fieldInput"
                name="password"
                type="password"
                value={form.password}
                onChange={onChange}
              />
            </label>

            <label className="field">
              <span>Confirm Password</span>
              <input
                className="fieldInput"
                name="confirm"
                type="password"
                value={form.confirm}
                onChange={onChange}
              />
            </label>

            {!canSubmit && !err ? (
              <div className="authError">
                Fill email, matric number, password, and matching confirm password to enable account creation.
              </div>
            ) : null}

            {err ? (
              <div className="authError">
                <strong>Register error:</strong> {err}
              </div>
            ) : null}

            <button
              type="submit"
              className={`authBtn ${canSubmit && !loading ? "on" : ""}`}
              disabled={!canSubmit || loading}
            >
              {loading ? "Creating..." : "Create account"}
            </button>

            <div className="authFooter">
              <button type="button" className="linkBtn" onClick={() => nav("/login")}>
                Already have an account? Sign in
              </button>
              <button type="button" className="linkBtn" onClick={() => nav("/")}>
                Back to Home
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
