// client/src/pages/AdminPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { csrfHeaders, clearSession } from "../utils/auth";
import { API_BASE_URL } from "../config";

async function apiFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(!["GET", "HEAD", "OPTIONS"].includes(method) ? csrfHeaders() : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { ok: res.ok, status: res.status, data };
}

function nowISO() {
  return new Date().toISOString();
}

function safeClone(x) {
  try {
    return structuredClone(x);
  } catch {
    return JSON.parse(JSON.stringify(x));
  }
}

export default function AdminPanel() {
  const [tab, setTab] = useState("overview"); // overview | manage | live | voters | feedback
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [election, setElection] = useState(null);
  const [alreadyVotedFlag, setAlreadyVotedFlag] = useState(false);

  const [votes, setVotes] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [polling, setPolling] = useState(true);

  const [draftPositions, setDraftPositions] = useState([]);

  async function loadElection() {
    const r = await apiFetch("/api/election/current");
    if (!r.ok) throw new Error(r?.data?.message || `Election load failed (${r.status})`);

    setElection(r.data.election);
    setAlreadyVotedFlag(!!r.data.alreadyVoted);

    // ✅ schema: positions[].name, candidates[].dept
    setDraftPositions(safeClone(r.data.election?.positions || []));
  }

  async function loadVotes() {
    const r = await apiFetch("/api/admin/results");

    // Helpful error so you can see if it's 401/403/404 etc.
    if (!r.ok) {
      const m = r?.data?.message || `Votes load failed (${r.status})`;
      throw new Error(m);
    }

    const arr = Array.isArray(r.data?.votes) ? r.data.votes : [];
    setVotes(arr);

    if (Array.isArray(r.data?.feedback)) {
      setFeedback(r.data.feedback);
      return;
    }

    const fallback = await apiFetch("/api/admin/feedback");
    if (fallback.ok && Array.isArray(fallback.data?.feedback)) {
      setFeedback(fallback.data.feedback);
    }
  }

  async function refreshAll() {
    setMsg("");
    setLoading(true);
    try {
      await loadElection();
      await loadVotes();
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(async () => {
      try {
        await loadVotes();
      } catch {
        // ignore polling errors
      }
    }, 2500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling]);

  // pid -> cid -> count
  const tally = useMemo(() => {
    const t = new Map();
    for (const v of votes || []) {
      for (const s of v.selections || []) {
        const pid = s.positionId;
        const cid = s.candidateId;
        if (!pid || !cid) continue;
        if (!t.has(pid)) t.set(pid, new Map());
        const inner = t.get(pid);
        inner.set(cid, (inner.get(cid) || 0) + 1);
      }
    }
    return t;
  }, [votes]);

  // winners per position
  const winners = useMemo(() => {
    const out = [];
    for (const p of election?.positions || []) {
      const inner = tally.get(p.id) || new Map();

      const leaderboard = (p.candidates || [])
        .map((c) => ({ c, cnt: inner.get(c.id) || 0 }))
        .sort((a, b) => b.cnt - a.cnt);

      const top = leaderboard[0] || null;
      const second = leaderboard[1] || null;

      const topVotes = top?.cnt || 0;

      // ✅ tie only matters if > 0 votes
      const tie = !!(top && second && top.cnt === second.cnt && top.cnt > 0);

      out.push({
        positionId: p.id,
        positionName: p.name || "Position",
        top,
        topVotes,
        tie,
        leaderboard,
      });
    }
    return out;
  }, [election, tally]);

  // ✅ Overview cards (NO fake winners when votes=0)
  const results = useMemo(() => {
    return winners.map((w) => {
      const winner = w.topVotes > 0 ? w.top?.c : null;

      return {
        positionId: w.positionId,
        positionName: w.positionName,
        tie: w.tie,
        winnerName: winner ? winner.name : "No votes yet",
        winnerDept: winner ? (winner.dept || "—") : "—",
        winnerVotes: w.topVotes || 0,
      };
    });
  }, [winners]);

  // voters list
  const voterRows = useMemo(() => {
    const seen = new Set();
    const rows = [];

    for (const v of votes || []) {
      const key = v.voterId || v.voterMatric || v._id;
      if (seen.has(key)) continue;
      seen.add(key);

      rows.push({
        voterId: v.voterId || "",
        voterMatric: v.voterMatric || "",
        receiptId: v.receiptId || "",
        createdAt: v.createdAt || "",
      });
    }

    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return rows;
  }, [votes]);

  const feedbackRows = useMemo(() => {
    const rows = (feedback || []).map((f) => ({
      id: f._id || `${f.voterMatric || ""}-${f.createdAt || ""}`,
      voterMatric: f.voterMatric || "",
      rating: Number(f.rating) || 0,
      comment: f.comment || "",
      issue: f.issue || "",
      createdAt: f.createdAt || "",
    }));

    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return rows;
  }, [feedback]);

  // ----- Manage helpers -----
  function addPosition() {
    setDraftPositions((p) => [
      ...p,
      {
        id: `pos-${Math.random().toString(16).slice(2, 8)}`,
        name: "New Position",
        candidates: [],
      },
    ]);
  }

  function removePosition(pid) {
    setDraftPositions((p) => p.filter((x) => x.id !== pid));
  }

  function updatePosition(pid, patch) {
    setDraftPositions((p) => p.map((x) => (x.id === pid ? { ...x, ...patch } : x)));
  }

  function addCandidate(pid) {
    setDraftPositions((p) =>
      p.map((pos) => {
        if (pos.id !== pid) return pos;
        const next = {
          id: `c-${Math.random().toString(16).slice(2, 8)}`,
          name: "Candidate Name",
          dept: "",
        };
        return { ...pos, candidates: [...(pos.candidates || []), next] };
      })
    );
  }

  function removeCandidate(pid, cid) {
    setDraftPositions((p) =>
      p.map((pos) => {
        if (pos.id !== pid) return pos;
        return { ...pos, candidates: (pos.candidates || []).filter((c) => c.id !== cid) };
      })
    );
  }

  function updateCandidate(pid, cid, patch) {
    setDraftPositions((p) =>
      p.map((pos) => {
        if (pos.id !== pid) return pos;
        return {
          ...pos,
          candidates: (pos.candidates || []).map((c) => (c.id === cid ? { ...c, ...patch } : c)),
        };
      })
    );
  }

  async function saveElectionDraft() {
    setMsg("");
    setLoading(true);
    try {
      const r = await apiFetch("/api/admin/election/current", {
        method: "PUT",
        body: { positions: draftPositions },
      });

      if (!r.ok) throw new Error(r?.data?.message || `Save failed (${r.status})`);

      setMsg("✅ Saved.");
      await refreshAll();
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  const latestVoteAt = votes?.[0]?.createdAt || "";

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={styles.title}>Admin Panel</div>
          <div style={styles.sub}>
            {election?.title || "Current election"} • {votes.length} votes • {nowISO()}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={styles.toggle}>
            <input type="checkbox" checked={polling} onChange={(e) => setPolling(e.target.checked)} />
            <span style={{ marginLeft: 8 }}>Live</span>
          </label>

          <button style={styles.btn} onClick={refreshAll} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>

          <button
            style={{ ...styles.btn, background: "rgba(255,255,255,.06)" }}
            onClick={() => {
              clearSession();
              window.location.href = "/login";
            }}
          >
            Logout
          </button>
        </div>
      </div>

      <div style={styles.wrap}>
        <aside style={styles.side}>
          <NavItem label="Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
          <NavItem label="Manage Election" active={tab === "manage"} onClick={() => setTab("manage")} />
          <NavItem label="Live Results" active={tab === "live"} onClick={() => setTab("live")} />
          <NavItem label="Voters" active={tab === "voters"} onClick={() => setTab("voters")} />
          <NavItem label="Feedback" active={tab === "feedback"} onClick={() => setTab("feedback")} />

          <div style={styles.sideMeta}>
            <div style={styles.metaLine}>
              <span style={styles.dot(election?.isActive ? "#27c93f" : "#ffbd2e")} />
              <span>{election?.isActive ? "Election active" : "Election inactive"}</span>
            </div>
            <div style={styles.metaLine}>
              <span style={styles.dot(alreadyVotedFlag ? "#ff5f57" : "#7aa2ff")} />
              <span>{alreadyVotedFlag ? "You already voted (admin session)" : "Admin session OK"}</span>
            </div>
          </div>
        </aside>

        <main style={styles.main}>
          {msg ? <div style={styles.msg}>{msg}</div> : null}

          {tab === "overview" && (
            <section style={styles.card}>
              <h2 style={styles.h2}>Winners (current)</h2>

              {/* ✅ diagnostics to prove whether server is returning votes */}
              <div style={{ ...styles.msg, marginTop: 12 }}>
                <b>Diagnostics:</b> votes from API = <b>{votes.length}</b>
                {latestVoteAt ? (
                  <>
                    {" "}
                    • latest vote at <span style={{ opacity: 0.9 }}>{latestVoteAt}</span>
                  </>
                ) : null}
              </div>

              <div style={styles.grid2}>
                {results.map((pos) => (
                  <div key={pos.positionId} style={styles.winnerCard}>
                    <div style={styles.winnerTitle}>🏆 {pos.positionName}</div>

                    <div style={styles.winnerBox}>
                      <div style={styles.winnerName}>{pos.winnerName}</div>
                      <div style={styles.winnerDept}>{pos.winnerDept}</div>
                      <div style={styles.winnerVotes}>{pos.winnerVotes} votes</div>
                      {pos.tie ? <div style={styles.tieTag}>Tie detected</div> : null}
                    </div>
                  </div>
                ))}
              </div>

              {results.length === 0 ? <div style={styles.emptyRow}>No positions found.</div> : null}
            </section>
          )}

          {tab === "manage" && (
            <section style={styles.card}>
              <div style={styles.rowBetween}>
                <h2 style={styles.h2}>Manage Positions & Candidates</h2>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={styles.btn} onClick={addPosition}>
                    + Add position
                  </button>
                  <button style={styles.btnPrimary} onClick={saveElectionDraft} disabled={loading}>
                    Save changes
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {draftPositions.map((pos) => (
                  <div key={pos.id} style={styles.block}>
                    <div style={styles.rowBetween}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={styles.pill}>Position ID: {pos.id}</div>
                        <input
                          style={styles.input}
                          value={pos.name || ""}
                          onChange={(e) => updatePosition(pos.id, { name: e.target.value })}
                        />
                      </div>

                      <div style={{ display: "flex", gap: 10 }}>
                        <button style={styles.btn} onClick={() => addCandidate(pos.id)}>
                          + Candidate
                        </button>
                        <button
                          style={{ ...styles.btn, background: "rgba(255,0,0,.15)" }}
                          onClick={() => removePosition(pos.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div style={styles.table}>
                      <div style={styles.trHeadManage}>
                        <div style={styles.th}>Candidate ID</div>
                        <div style={styles.th}>Name</div>
                        <div style={styles.th}>Department</div>
                        <div style={styles.th}>Action</div>
                      </div>

                      {(pos.candidates || []).map((c) => (
                        <div key={c.id} style={styles.trManage}>
                          <div style={styles.tdMono}>{c.id}</div>

                          <div style={styles.td}>
                            <input
                              style={styles.inputSmall}
                              value={c.name || ""}
                              onChange={(e) => updateCandidate(pos.id, c.id, { name: e.target.value })}
                            />
                          </div>

                          <div style={styles.td}>
                            <input
                              style={styles.inputSmall}
                              value={c.dept || ""}
                              onChange={(e) => updateCandidate(pos.id, c.id, { dept: e.target.value })}
                            />
                          </div>

                          <div style={styles.td}>
                            <button
                              style={{ ...styles.btn, background: "rgba(255,0,0,.15)" }}
                              onClick={() => removeCandidate(pos.id, c.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}

                      {(pos.candidates || []).length === 0 ? (
                        <div style={styles.emptyRow}>No candidates yet.</div>
                      ) : null}
                    </div>
                  </div>
                ))}

                {draftPositions.length === 0 ? <div style={styles.emptyBig}>No positions in this election.</div> : null}
              </div>
            </section>
          )}

          {tab === "live" && (
            <section style={styles.card}>
              <div style={styles.rowBetween}>
                <h2 style={styles.h2}>Live Results</h2>
                <div style={styles.pill}>Auto refresh: {polling ? "ON" : "OFF"}</div>
              </div>

              {(election?.positions || []).map((p) => {
                const inner = tally.get(p.id) || new Map();
                const rows = (p.candidates || [])
                  .map((c) => ({ c, cnt: inner.get(c.id) || 0 }))
                  .sort((a, b) => b.cnt - a.cnt);

                const totalVotes = rows.reduce((s, r) => s + r.cnt, 0);

                return (
                  <div key={p.id} style={styles.block}>
                    <div style={styles.rowBetween}>
                      <div style={styles.blockTitle}>{p.name}</div>
                      <div style={styles.pill}>Position ID: {p.id}</div>
                    </div>

                    <div style={styles.table}>
                      <div style={styles.trHeadLive}>
                        <div style={styles.th}>Candidate</div>
                        <div style={styles.th}>Department</div>
                        <div style={styles.th}>Votes</div>
                        <div style={styles.th}>%</div>
                      </div>

                      {rows.map(({ c, cnt }) => {
                        const pct = totalVotes ? Math.round((cnt / totalVotes) * 100) : 0;
                        return (
                          <div key={c.id} style={styles.trLive}>
                            <div style={styles.td}>{c.name}</div>
                            <div style={styles.td}>{c.dept || "—"}</div>
                            <div style={styles.tdMono}>{cnt}</div>
                            <div style={styles.td}>
                              <div style={styles.barWrap}>
                                <div style={{ ...styles.bar, width: `${pct}%` }} />
                                <span style={styles.barText}>{pct}%</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {rows.length === 0 ? <div style={styles.emptyRow}>No candidates.</div> : null}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {tab === "voters" && (
            <section style={styles.card}>
              <div style={styles.rowBetween}>
                <h2 style={styles.h2}>Voters</h2>
                <div style={styles.pill}>{voterRows.length} unique voters</div>
              </div>

              <div style={styles.table}>
                <div style={styles.trHeadVoters}>
                  <div style={styles.th}>Matric</div>
                  <div style={styles.th}>Receipt</div>
                  <div style={styles.th}>Time</div>
                </div>

                {voterRows.map((r) => (
                  <div key={r.voterId || r.voterMatric || r.receiptId} style={styles.trVoters}>
                    <div style={styles.tdMono}>{r.voterMatric || "—"}</div>
                    <div style={styles.tdMono}>{r.receiptId || "—"}</div>
                    <div style={styles.td}>{r.createdAt || "—"}</div>
                  </div>
                ))}

                {voterRows.length === 0 ? <div style={styles.emptyRow}>No votes yet.</div> : null}
              </div>
            </section>
          )}

          {tab === "feedback" && (
            <section style={styles.card}>
              <div style={styles.rowBetween}>
                <h2 style={styles.h2}>Customer Feedback</h2>
                <div style={styles.pill}>{feedbackRows.length} submissions</div>
              </div>

              <div style={styles.table}>
                <div style={styles.trHeadFeedback}>
                  <div style={styles.th}>Matric</div>
                  <div style={styles.th}>Rating</div>
                  <div style={styles.th}>Comment</div>
                  <div style={styles.th}>Issue</div>
                  <div style={styles.th}>Time</div>
                </div>

                {feedbackRows.map((r) => (
                  <div key={r.id} style={styles.trFeedback}>
                    <div style={styles.tdMono}>{r.voterMatric || "—"}</div>
                    <div style={styles.td}>{r.rating ? `${r.rating}/5` : "—"}</div>
                    <div style={styles.td}>{r.comment || "—"}</div>
                    <div style={styles.td}>{r.issue || "—"}</div>
                    <div style={styles.td}>{r.createdAt || "—"}</div>
                  </div>
                ))}

                {feedbackRows.length === 0 ? <div style={styles.emptyRow}>No feedback yet.</div> : null}
              </div>
            </section>
          )}

          <div style={styles.footer}>
            Admin routes must be protected by role check (server) + RequireAdmin (frontend).
          </div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.navItem,
        ...(active ? styles.navItemActive : null),
      }}
    >
      {label}
    </button>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1000px 600px at 20% 10%, rgba(90,140,255,.18), transparent 55%), radial-gradient(1000px 600px at 80% 30%, rgba(180,90,255,.12), transparent 55%), #060912",
    color: "rgba(255,255,255,.92)",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  topbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 18px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    position: "sticky",
    top: 0,
    backdropFilter: "blur(8px)",
    background: "rgba(6,9,18,.65)",
    zIndex: 10,
  },
  title: { fontSize: 20, fontWeight: 800, letterSpacing: 0.2 },
  sub: { fontSize: 12, opacity: 0.75, marginTop: 2 },

  wrap: { display: "grid", gridTemplateColumns: "260px 1fr", gap: 14, padding: 14 },
  side: {
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,.03)",
    height: "fit-content",
  },
  main: { display: "flex", flexDirection: "column", gap: 14 },

  navItem: {
    width: "100%",
    textAlign: "left",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.02)",
    color: "rgba(255,255,255,.9)",
    cursor: "pointer",
    marginBottom: 8,
    fontWeight: 700,
  },
  navItemActive: {
    background: "rgba(120,160,255,.14)",
    border: "1px solid rgba(120,160,255,.25)",
  },

  sideMeta: { marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.08)" },
  metaLine: { display: "flex", gap: 10, alignItems: "center", fontSize: 12, opacity: 0.85, marginTop: 8 },
  dot: (c) => ({
    width: 10,
    height: 10,
    borderRadius: 99,
    background: c,
    boxShadow: `0 0 0 3px rgba(255,255,255,.06)`,
  }),

  card: {
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 16,
    padding: 14,
    background: "rgba(255,255,255,.03)",
  },
  h2: { margin: 0, fontSize: 16, fontWeight: 900 },
  msg: {
    border: "1px solid rgba(255,255,255,.1)",
    background: "rgba(255,255,255,.04)",
    borderRadius: 14,
    padding: 10,
    fontSize: 13,
    opacity: 0.95,
  },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },

  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.05)",
    color: "rgba(255,255,255,.92)",
    cursor: "pointer",
    fontWeight: 800,
  },
  btnPrimary: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(130,170,255,.35)",
    background: "rgba(130,170,255,.18)",
    color: "rgba(255,255,255,.96)",
    cursor: "pointer",
    fontWeight: 900,
  },
  toggle: { display: "flex", alignItems: "center", fontSize: 12, opacity: 0.9 },

  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 12 },

  winnerCard: {
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(0,0,0,.18)",
  },
  winnerTitle: { fontSize: 13, fontWeight: 900, opacity: 0.95, marginBottom: 10 },
  winnerBox: { display: "flex", flexDirection: "column", gap: 6 },
  winnerName: { fontSize: 16, fontWeight: 900 },
  winnerDept: { fontSize: 13, opacity: 0.85 },
  winnerVotes: { fontSize: 12, opacity: 0.9, fontWeight: 800 },
  tieTag: {
    marginTop: 6,
    fontSize: 11,
    padding: "4px 8px",
    borderRadius: 999,
    width: "fit-content",
    border: "1px solid rgba(255,210,120,.35)",
    background: "rgba(255,210,120,.12)",
    color: "rgba(255,220,160,.95)",
    fontWeight: 900,
  },

  block: {
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    padding: 12,
    background: "rgba(0,0,0,.16)",
  },
  blockTitle: { fontSize: 14, fontWeight: 900 },

  pill: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.05)",
    opacity: 0.95,
  },

  input: {
    minWidth: 260,
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.92)",
    outline: "none",
    fontWeight: 800,
  },
  inputSmall: {
    width: "100%",
    padding: "9px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.92)",
    outline: "none",
    fontWeight: 700,
  },

  table: {
    marginTop: 10,
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 14,
    overflow: "hidden",
  },
  th: { fontSize: 12, opacity: 0.75, fontWeight: 900 },

  trHeadManage: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr .6fr",
    padding: "10px 10px",
    background: "rgba(255,255,255,.05)",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    gap: 10,
  },
  trManage: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr .6fr",
    padding: "10px 10px",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    alignItems: "center",
    gap: 10,
  },

  trHeadLive: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr .4fr 1fr",
    padding: "10px 10px",
    background: "rgba(255,255,255,.05)",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    gap: 10,
  },
  trLive: {
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr .4fr 1fr",
    padding: "10px 10px",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    alignItems: "center",
    gap: 10,
  },

  trHeadVoters: {
    display: "grid",
    gridTemplateColumns: ".7fr .9fr 1.2fr",
    padding: "10px 10px",
    background: "rgba(255,255,255,.05)",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    gap: 10,
  },
  trVoters: {
    display: "grid",
    gridTemplateColumns: ".7fr .9fr 1.2fr",
    padding: "10px 10px",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    alignItems: "center",
    gap: 10,
  },

  trHeadFeedback: {
    display: "grid",
    gridTemplateColumns: ".7fr .5fr 1.2fr 1.2fr 1fr",
    padding: "10px 10px",
    background: "rgba(255,255,255,.05)",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    gap: 10,
  },
  trFeedback: {
    display: "grid",
    gridTemplateColumns: ".7fr .5fr 1.2fr 1.2fr 1fr",
    padding: "10px 10px",
    borderBottom: "1px solid rgba(255,255,255,.06)",
    alignItems: "center",
    gap: 10,
  },

  td: { fontSize: 13 },
  tdMono: { fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", opacity: 0.92 },

  emptyRow: { padding: 12, fontSize: 12, opacity: 0.75 },
  emptyBig: { padding: 14, fontSize: 13, opacity: 0.8, border: "1px dashed rgba(255,255,255,.15)", borderRadius: 14 },

  barWrap: {
    position: "relative",
    height: 16,
    borderRadius: 999,
    background: "rgba(255,255,255,.08)",
    overflow: "hidden",
  },
  bar: { height: "100%", background: "rgba(120,160,255,.55)" },
  barText: { position: "absolute", top: 0, left: 8, fontSize: 11, lineHeight: "16px", opacity: 0.9 },

  footer: { fontSize: 12, opacity: 0.65, padding: "6px 4px" },
};

