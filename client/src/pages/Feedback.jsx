import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, csrfHeaders, getSession, isLoggedIn } from "../utils/auth";
import "../App.css";

export default function Feedback() {
  const nav = useNavigate();

  const session = getSession();
  const matric = session?.user?.matric || "";

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [issue, setIssue] = useState("");

  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = useMemo(() => {
    const r = Number(rating);
    return r >= 1 && r <= 5;
  }, [rating]);

  useEffect(() => {
    if (!isLoggedIn()) nav("/login");
  }, [nav]);

  if (!isLoggedIn()) return null;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setErr("");
    setOk(false);
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        },
        body: JSON.stringify({
          rating: Number(rating),
          comment,
          issue
        })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Feedback failed");

      setOk(true);
      setComment("");
      setIssue("");
    } catch (e2) {
      setErr(String(e2.message || e2));
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearSession();
    nav("/login");
  }

  return (
    <div className="dashPage">
      <div className="dashBg" />
      <div className="dashShade" />

      <div className="voteWrap">
        <div className="voteTop">
          <div>
            <div className="chip">Feedback</div>
            <h1 className="voteH1">Post-Election Feedback</h1>
            <p className="voteP">
              Signed in as <b>{matric}</b>
              <br />
              Rate your experience and report any issue.
            </p>
          </div>

          <div className="voteBtns">
            <button className="btn2 ghost2" onClick={() => nav("/dashboard")}>Dashboard</button>
            <button className="btn2 ghost2" onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="cardGlass">
          <div className="cardTitleRow">
            <div>
              <div className="cardTitle">Your Feedback</div>
              <div className="cardSub">This is stored in MongoDB.</div>
            </div>
            <div className="counterPill">1–5</div>
          </div>

          {err && (
            <div className="authError" style={{ marginBottom: 12 }}>
              <strong>Error:</strong> {err}
            </div>
          )}

          {ok && (
            <div
              className="authError"
              style={{
                marginBottom: 12,
                background: "rgba(34,197,94,.12)",
                border: "1px solid rgba(34,197,94,.22)"
              }}
            >
              <strong>Submitted:</strong> Thank you for your feedback.
            </div>
          )}

          <form onSubmit={submit} className="authForm">
            <label className="field">
              <span>Rating</span>
              <select
                className="fieldInput"
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
              >
                <option value={5}>5 — Excellent</option>
                <option value={4}>4 — Good</option>
                <option value={3}>3 — Average</option>
                <option value={2}>2 — Poor</option>
                <option value={1}>1 — Very poor</option>
              </select>
            </label>

            <label className="field">
              <span>Comment (optional)</span>
              <textarea
                className="fieldInput"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What worked well?"
              />
            </label>

            <label className="field">
              <span>Issue / Complaint (optional)</span>
              <textarea
                className="fieldInput"
                rows={3}
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="Any bug, delay, or confusion?"
              />
            </label>

            <button className={`authBtn ${canSubmit && !loading ? "on" : ""}`} disabled={!canSubmit || loading}>
              {loading ? "Submitting…" : "Submit Feedback"}
            </button>

            <div className="authFooter">
              <button type="button" className="linkBtn" onClick={() => nav("/dashboard")}>
                ← Back to Dashboard
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
