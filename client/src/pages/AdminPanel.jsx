import { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "../config";
import { clearSession, csrfHeaders } from "../utils/auth";

async function apiFetch(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(!["GET", "HEAD", "OPTIONS"].includes(method) ? csrfHeaders() : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json() : { message: await res.text() };
  return { ok: res.ok, status: res.status, data, headers: res.headers };
}

const clone = (x) => { try { return structuredClone(x); } catch { return JSON.parse(JSON.stringify(x)); } };
const toIso = (v) => (!v ? null : Number.isNaN(new Date(v).getTime()) ? null : new Date(v).toISOString());
const formatInputDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const prettyDate = (v) => (!v ? "-" : Number.isNaN(new Date(v).getTime()) ? String(v) : new Date(v).toLocaleString());
const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "download";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

export default function AdminPanel() {
  const [tab, setTab] = useState("winners");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [currentElection, setCurrentElection] = useState(null);
  const [elections, setElections] = useState([]);
  const [audits, setAudits] = useState([]);
  const [votes, setVotes] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [draftPositions, setDraftPositions] = useState([]);
  const [schedule, setSchedule] = useState({ title: "", startsAt: "", endsAt: "", isActive: true, adminPassword: "" });
  const [newElection, setNewElection] = useState({ title: "", startsAt: "", endsAt: "", isActive: true, adminPassword: "" });
  const [adminForm, setAdminForm] = useState({ email: "", matric: "", password: "", adminPassword: "" });
  const [restoreForm, setRestoreForm] = useState({ snapshotText: "", adminPassword: "" });

  async function refreshAll() {
    setLoading(true);
    setMsg("");
    try {
      const [resultsRes, electionsRes, adminsRes] = await Promise.all([apiFetch("/api/admin/results"), apiFetch("/api/admin/elections"), apiFetch("/api/admin/admins")]);
      if (!resultsRes.ok) throw new Error(resultsRes.data?.message || `Results failed (${resultsRes.status})`);
      if (!electionsRes.ok) throw new Error(electionsRes.data?.message || `Elections failed (${electionsRes.status})`);
      if (!adminsRes.ok) throw new Error(adminsRes.data?.message || `Admins failed (${adminsRes.status})`);
      const current = electionsRes.data?.currentElection || resultsRes.data?.election || null;
      setCurrentElection(current);
      setElections(Array.isArray(electionsRes.data?.elections) ? electionsRes.data.elections : []);
      setAudits(Array.isArray(electionsRes.data?.audits) ? electionsRes.data.audits : []);
      setVotes(Array.isArray(resultsRes.data?.votes) ? resultsRes.data.votes : []);
      setFeedback(Array.isArray(resultsRes.data?.feedback) ? resultsRes.data.feedback : []);
      setAdmins(Array.isArray(adminsRes.data?.admins) ? adminsRes.data.admins : []);
      setDraftPositions(clone(current?.positions || []));
      setSchedule((prev) => ({ ...prev, title: current?.title || "", startsAt: formatInputDate(current?.startsAt), endsAt: formatInputDate(current?.endsAt), isActive: !!current?.isActive }));
    } catch (e) {
      setMsg(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refreshAll(); }, []);

  const summary = useMemo(() => {
    const tally = new Map();
    for (const vote of votes) for (const selection of vote.selections || []) tally.set(`${selection.positionId}:${selection.candidateId}`, (tally.get(`${selection.positionId}:${selection.candidateId}`) || 0) + 1);
    return (currentElection?.positions || []).map((position) => ({ ...position, candidates: (position.candidates || []).map((candidate) => ({ ...candidate, votes: tally.get(`${position.id}:${candidate.id}`) || 0 })).sort((a, b) => b.votes - a.votes) }));
  }, [currentElection, votes]);

  const overviewStats = [
    { label: "Votes", value: votes.length, note: currentElection?.isActive ? "Active election traffic" : "Election currently disabled" },
    { label: "Admins", value: admins.length, note: "Accounts with management access" },
    { label: "Feedback", value: feedback.length, note: "Voter comments and issue reports" },
    { label: "Archives", value: elections.filter((item) => item.archivedAt).length, note: "Historical election records" },
  ];

  function patchPosition(id, patch) { setDraftPositions((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item))); }
  function addPosition() { setDraftPositions((prev) => [...prev, { id: `pos-${Math.random().toString(16).slice(2, 8)}`, name: "New Position", candidates: [] }]); }
  function removePosition(id) { setDraftPositions((prev) => prev.filter((item) => item.id !== id)); }
  function addCandidate(positionId) { setDraftPositions((prev) => prev.map((item) => item.id !== positionId ? item : { ...item, candidates: [...(item.candidates || []), { id: `c-${Math.random().toString(16).slice(2, 8)}`, name: "Candidate Name", dept: "" }] })); }
  function patchCandidate(positionId, candidateId, patch) { setDraftPositions((prev) => prev.map((item) => item.id !== positionId ? item : { ...item, candidates: (item.candidates || []).map((candidate) => (candidate.id === candidateId ? { ...candidate, ...patch } : candidate)) })); }
  function removeCandidate(positionId, candidateId) { setDraftPositions((prev) => prev.map((item) => item.id !== positionId ? item : { ...item, candidates: (item.candidates || []).filter((candidate) => candidate.id !== candidateId) })); }

  async function saveCurrentElection() {
    setLoading(true); setMsg("");
    try {
      const res = await apiFetch("/api/admin/election/current", { method: "PUT", body: { title: schedule.title, startsAt: toIso(schedule.startsAt), endsAt: toIso(schedule.endsAt), isActive: schedule.isActive, positions: draftPositions, adminPassword: schedule.adminPassword } });
      if (!res.ok) throw new Error(res.data?.message || `Save failed (${res.status})`);
      setMsg("Current election updated."); setSchedule((prev) => ({ ...prev, adminPassword: "" })); await refreshAll();
    } catch (e) { setMsg(String(e?.message || e)); } finally { setLoading(false); }
  }

  async function toggleElection(isActive) {
    setLoading(true); setMsg("");
    try {
      const res = await apiFetch("/api/admin/election/current/status", { method: "PATCH", body: { isActive, adminPassword: schedule.adminPassword } });
      if (!res.ok) throw new Error(res.data?.message || `Status change failed (${res.status})`);
      setMsg(isActive ? "Election enabled." : "Election disabled."); setSchedule((prev) => ({ ...prev, adminPassword: "" })); await refreshAll();
    } catch (e) { setMsg(String(e?.message || e)); } finally { setLoading(false); }
  }

  async function archiveElection() {
    setLoading(true); setMsg("");
    try {
      const res = await apiFetch("/api/admin/election/current/archive", { method: "POST", body: { adminPassword: schedule.adminPassword } });
      if (!res.ok) throw new Error(res.data?.message || `Archive failed (${res.status})`);
      setMsg("Current election archived."); setSchedule((prev) => ({ ...prev, adminPassword: "" })); await refreshAll();
    } catch (e) { setMsg(String(e?.message || e)); } finally { setLoading(false); }
  }

  async function createElection() {
    setLoading(true); setMsg("");
    try {
      const res = await apiFetch("/api/admin/elections", { method: "POST", body: { title: newElection.title, startsAt: toIso(newElection.startsAt), endsAt: toIso(newElection.endsAt), isActive: newElection.isActive, positions: draftPositions, adminPassword: newElection.adminPassword } });
      if (!res.ok) throw new Error(res.data?.message || `Create failed (${res.status})`);
      setMsg("New election created and set as current."); setNewElection({ title: "", startsAt: "", endsAt: "", isActive: true, adminPassword: "" }); await refreshAll();
    } catch (e) { setMsg(String(e?.message || e)); } finally { setLoading(false); }
  }

  async function submitAdmin(e) {
    e.preventDefault(); setLoading(true); setMsg("");
    try {
      const res = await apiFetch("/api/admin/admins", { method: "POST", body: { email: adminForm.email.trim().toLowerCase(), matric: adminForm.matric.trim().toUpperCase(), password: adminForm.password, adminPassword: adminForm.adminPassword } });
      if (!res.ok) throw new Error(res.data?.message || `Admin creation failed (${res.status})`);
      setMsg("Admin created."); setAdminForm({ email: "", matric: "", password: "", adminPassword: "" }); await refreshAll();
    } catch (e) { setMsg(String(e?.message || e)); } finally { setLoading(false); }
  }

  async function removeAdmin(adminId) {
    if (!window.confirm("Remove this admin?")) return;
    setLoading(true); setMsg("");
    try {
      const res = await apiFetch(`/api/admin/admins/${adminId}`, { method: "DELETE", body: { adminPassword: adminForm.adminPassword } });
      if (!res.ok) throw new Error(res.data?.message || `Remove failed (${res.status})`);
      setMsg("Admin removed."); await refreshAll();
    } catch (e) { setMsg(String(e?.message || e)); } finally { setLoading(false); }
  }

  async function download(path, fallbackName) {
    setLoading(true); setMsg("");
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || fallbackName;
      saveBlob(blob, filename);
      setMsg(`${filename} downloaded.`);
    } catch (e) { setMsg(String(e?.message || e)); } finally { setLoading(false); }
  }

  async function restoreBackup() {
    setLoading(true); setMsg("");
    try {
      const snapshot = JSON.parse(restoreForm.snapshotText || "{}");
      const res = await apiFetch("/api/admin/backup/restore", { method: "POST", body: { snapshot, adminPassword: restoreForm.adminPassword } });
      if (!res.ok) throw new Error(res.data?.message || `Restore failed (${res.status})`);
      setMsg("Backup restore finished in merge mode."); setRestoreForm({ snapshotText: "", adminPassword: "" }); await refreshAll();
    } catch (e) { setMsg(String(e?.message || e)); } finally { setLoading(false); }
  }

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div>
          <div style={styles.title}>Admin Control Center</div>
          <div style={styles.sub}>{currentElection?.title || "No current election"} | {votes.length} votes | {admins.length} admins</div>
        </div>
        <div style={styles.row}>
          <button style={styles.btn} onClick={refreshAll} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
          <button style={styles.btn} onClick={() => { clearSession(); window.location.href = "/login"; }}>Logout</button>
        </div>
      </div>

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          {["winners", "overview", "manage", "schedule", "admins", "history", "tools"].map((value) => (
            <button key={value} style={{ ...styles.nav, ...(tab === value ? styles.navActive : null) }} onClick={() => setTab(value)}>
              {value === "winners" ? "Winners" : value === "overview" ? "Overview" : value === "manage" ? "Manage Ballot" : value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </aside>

        <main style={styles.main}>
          {msg ? <div style={styles.message}>{msg}</div> : null}

          {tab === "winners" && <section style={styles.card}>
            <div style={styles.winnersHero}>
              <div style={styles.winnersGlowA} />
              <div style={styles.winnersGlowB} />
              <div style={styles.winnersHeroContent}>
                <div style={styles.winnersEyebrow}>Election Results</div>
                <h2 style={styles.winnersTitle}>Winners Gallery</h2>
                <div style={styles.winnersCopy}>
                  A more polished presentation of the current winning candidates across every position in the election.
                </div>
                <div style={styles.winnersMetaRow}>
                  <div style={styles.winnersMetaPill}>{currentElection?.title || "No current election"}</div>
                  <div style={styles.winnersMetaPill}>{summary.length} positions</div>
                  <div style={styles.winnersMetaPill}>{votes.length} votes recorded</div>
                  <div style={styles.winnersMetaPill}>{currentElection?.isActive ? "Live results" : "Final results"}</div>
                </div>
              </div>
            </div>

            <div style={styles.winnersGrid}>
              {summary.map((position) => {
                const winner = position.candidates?.[0] || null;
                const second = position.candidates?.[1] || null;
                const tie = winner && second && winner.votes === second.votes && winner.votes > 0;
                const winners = tie ? [winner, second] : winner ? [winner] : [];
                const initials = winners[0]?.name
                  ? winners[0].name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")
                      .toUpperCase()
                  : "--";

                return (
                  <div key={position.id} style={styles.winnerShowcase}>
                    <div style={styles.winnerAccent} />
                    <div style={styles.winnerTopRow}>
                      <div style={styles.winnerAvatar}>{initials}</div>
                      <div style={styles.winnerIcon}>{"\uD83C\uDFC6"}</div>
                    </div>
                    <div style={styles.winnerPosition}>{position.name}</div>
                    {winners.length ? (
                      <div style={styles.winnerList}>
                        {winners.map((candidate) => (
                          <div key={`${position.id}-${candidate.id || candidate.name}`} style={styles.winnerEntry}>
                            <div style={styles.winnerPerson}>{candidate?.name || "No winner yet"}</div>
                            <div style={styles.winnerDepartment}>{candidate?.dept || "Department not provided"}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={styles.winnerList}>
                        <div style={styles.winnerEntry}>
                          <div style={styles.winnerPerson}>No winner yet</div>
                          <div style={styles.winnerDepartment}>No votes recorded for this position</div>
                        </div>
                      </div>
                    )}
                    <div style={styles.winnerVoteTag}>{winner?.votes ? `${winner.votes} votes` : "No votes yet"}</div>
                    {tie ? <div style={styles.tieBadge}>Joint winners</div> : <div style={styles.winnerCrown}>Winner</div>}
                  </div>
                );
              })}
            </div>
          </section>}

          {tab === "overview" && <section style={styles.card}>
            <div style={styles.rowBetween}>
              <div>
                <h2 style={styles.h2}>Executive Overview</h2>
                <div style={styles.sectionSub}>A formal summary of election performance and the new admin tools now available.</div>
              </div>
              <div style={styles.statusWrap}>
                <div style={{ ...styles.statusChip, ...(currentElection?.isActive ? styles.statusLive : styles.statusIdle) }}>{currentElection?.isActive ? "Election Active" : "Election Disabled"}</div>
                <div style={styles.pill}>{currentElection?.title || "No current election"}</div>
              </div>
            </div>
            <div style={styles.metricsGrid}>{overviewStats.map((item) => <div key={item.label} style={styles.metricCard}><div style={styles.metricLabel}>{item.label}</div><div style={styles.metricValue}>{item.value}</div><div style={styles.metricNote}>{item.note}</div></div>)}</div>
            <div style={styles.grid}>
              <div style={styles.heroPanel}>
                <div style={styles.heroTitle}>Current Election Window</div>
                <div style={styles.timelineRow}><span>Starts</span><strong>{prettyDate(currentElection?.startsAt)}</strong></div>
                <div style={styles.timelineRow}><span>Ends</span><strong>{prettyDate(currentElection?.endsAt)}</strong></div>
                <div style={styles.timelineRow}><span>Positions</span><strong>{summary.length}</strong></div>
                <div style={styles.timelineRow}><span>Latest Audit</span><strong>{audits[0] ? prettyDate(audits[0].createdAt) : "No activity yet"}</strong></div>
              </div>
              <div style={styles.block}>
                <div style={styles.blockTitle}>Quick Access</div>
                {[
                  ["schedule", "Election Schedule", "Set start and end time, enable, disable, or archive the election."],
                  ["admins", "Admin Management", "Create and remove admin accounts from one place."],
                  ["tools", "Reports and Backup", "Download reports, audit files, backups, and restore data."],
                  ["history", "Election History", "Review archived elections and audit activity."],
                ].map(([nextTab, title, note]) => <button key={title} style={styles.quickAction} onClick={() => setTab(nextTab)}><span><strong>{title}</strong><span style={styles.quickNote}>{note}</span></span><span>Open</span></button>)}
              </div>
            </div>
            <div style={styles.grid}>
              <div style={styles.block}>
                <div style={styles.blockTitle}>New Features Included</div>
                {[
                  "Admin creation and removal controls",
                  "Election scheduling, enable, disable, and archive actions",
                  "Create a new election from the current ballot structure",
                  "Forgot-password and reset-password flow from login",
                  "Audit export, election report download, backup export, and restore",
                  "Election history and archive tracking",
                ].map((item) => <div key={item} style={styles.featureItem}>{item}</div>)}
              </div>
              <div style={styles.block}>
                <div style={styles.blockTitle}>Recent Audit</div>
                {audits.slice(0, 6).map((audit) => <div key={`${audit._id}-${audit.createdAt}`} style={styles.auditLine}><strong>{audit.action}</strong><div style={styles.smallText}>{audit.adminMatric || "-"} | {prettyDate(audit.createdAt)}</div></div>)}
              </div>
            </div>
            <div style={styles.stack}>{summary.map((position) => <div key={position.id} style={styles.block}><div style={styles.rowBetween}><div><div style={styles.blockTitle}>{position.name}</div><div style={styles.smallText}>Position ID: {position.id}</div></div><div style={styles.pill}>{position.candidates?.[0]?.votes > 0 ? `${position.candidates[0].votes} leading votes` : "No votes yet"}</div></div>{(position.candidates || []).map((candidate) => <div key={candidate.id} style={styles.resultRow}><span>{candidate.name}</span><span>{candidate.dept || "-"}</span><span>{candidate.votes} vote(s)</span></div>)}</div>)}</div>
          </section>}

          {tab === "manage" && <section style={styles.card}><div style={styles.rowBetween}><h2 style={styles.h2}>Manage Ballot</h2><div style={styles.row}><button style={styles.btn} onClick={addPosition}>Add Position</button><button style={styles.primaryBtn} onClick={saveCurrentElection} disabled={loading}>Save Current Election</button></div></div>{draftPositions.map((position) => <div key={position.id} style={{ ...styles.block, marginTop: 12 }}><div style={styles.rowBetween}><div style={styles.row}><div style={styles.pill}>{position.id}</div><input style={styles.input} value={position.name || ""} onChange={(e) => patchPosition(position.id, { name: e.target.value })} /></div><div style={styles.row}><button style={styles.btn} onClick={() => addCandidate(position.id)}>Add Candidate</button><button style={styles.dangerBtn} onClick={() => removePosition(position.id)}>Remove Position</button></div></div>{(position.candidates || []).map((candidate) => <div key={candidate.id} style={styles.candidateRow}><div style={styles.smallText}>{candidate.id}</div><input style={styles.input} value={candidate.name || ""} onChange={(e) => patchCandidate(position.id, candidate.id, { name: e.target.value })} /><input style={styles.input} value={candidate.dept || ""} onChange={(e) => patchCandidate(position.id, candidate.id, { dept: e.target.value })} /><button style={styles.dangerBtn} onClick={() => removeCandidate(position.id, candidate.id)}>Delete</button></div>)}</div>)}</section>}

          {tab === "schedule" && <section style={styles.card}><h2 style={styles.h2}>Election Schedule</h2><div style={styles.grid}><div style={styles.block}><div style={styles.blockTitle}>Current Election</div><div style={styles.form}><input style={styles.input} placeholder="Title" value={schedule.title} onChange={(e) => setSchedule((prev) => ({ ...prev, title: e.target.value }))} /><input style={styles.input} type="datetime-local" value={schedule.startsAt} onChange={(e) => setSchedule((prev) => ({ ...prev, startsAt: e.target.value }))} /><input style={styles.input} type="datetime-local" value={schedule.endsAt} onChange={(e) => setSchedule((prev) => ({ ...prev, endsAt: e.target.value }))} /><label style={styles.checkbox}><input type="checkbox" checked={schedule.isActive} onChange={(e) => setSchedule((prev) => ({ ...prev, isActive: e.target.checked }))} /> Election enabled</label><input style={styles.input} type="password" placeholder="Admin password if reauth is enabled" value={schedule.adminPassword} onChange={(e) => setSchedule((prev) => ({ ...prev, adminPassword: e.target.value }))} /><div style={styles.row}><button style={styles.primaryBtn} onClick={saveCurrentElection}>Save Schedule</button><button style={styles.btn} onClick={() => toggleElection(!schedule.isActive)}>{schedule.isActive ? "Disable" : "Enable"}</button><button style={styles.dangerBtn} onClick={archiveElection}>Archive</button></div></div></div><div style={styles.block}><div style={styles.blockTitle}>Create New Election</div><div style={styles.form}><input style={styles.input} placeholder="New election title" value={newElection.title} onChange={(e) => setNewElection((prev) => ({ ...prev, title: e.target.value }))} /><input style={styles.input} type="datetime-local" value={newElection.startsAt} onChange={(e) => setNewElection((prev) => ({ ...prev, startsAt: e.target.value }))} /><input style={styles.input} type="datetime-local" value={newElection.endsAt} onChange={(e) => setNewElection((prev) => ({ ...prev, endsAt: e.target.value }))} /><label style={styles.checkbox}><input type="checkbox" checked={newElection.isActive} onChange={(e) => setNewElection((prev) => ({ ...prev, isActive: e.target.checked }))} /> Activate immediately</label><input style={styles.input} type="password" placeholder="Admin password if reauth is enabled" value={newElection.adminPassword} onChange={(e) => setNewElection((prev) => ({ ...prev, adminPassword: e.target.value }))} /><div style={styles.smallText}>The new election will reuse the ballot draft from the Manage Ballot tab.</div><button style={styles.primaryBtn} onClick={createElection}>Create New Election</button></div></div></div></section>}

          {tab === "admins" && <section style={styles.card}><div style={styles.grid}><form style={styles.block} onSubmit={submitAdmin}><div style={styles.blockTitle}>Add Admin</div><div style={styles.form}><input style={styles.input} placeholder="Admin email" value={adminForm.email} onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))} /><input style={styles.input} placeholder="Admin matric" value={adminForm.matric} onChange={(e) => setAdminForm((prev) => ({ ...prev, matric: e.target.value }))} /><input style={styles.input} type="password" placeholder="Temporary password" value={adminForm.password} onChange={(e) => setAdminForm((prev) => ({ ...prev, password: e.target.value }))} /><input style={styles.input} type="password" placeholder="Admin password if reauth is enabled" value={adminForm.adminPassword} onChange={(e) => setAdminForm((prev) => ({ ...prev, adminPassword: e.target.value }))} /><button type="submit" style={styles.primaryBtn}>Create Admin</button></div></form><div style={styles.block}><div style={styles.blockTitle}>Existing Admins</div>{admins.map((admin) => <div key={admin._id || admin.id} style={styles.candidateRow}><div>{admin.email}</div><div>{admin.matric}</div><div>{prettyDate(admin.createdAt)}</div><button style={styles.dangerBtn} onClick={() => removeAdmin(admin._id || admin.id)}>Remove</button></div>)}</div></div></section>}

          {tab === "history" && <section style={styles.card}><h2 style={styles.h2}>Election History</h2>{elections.map((election) => <div key={election.key} style={styles.block}><div style={styles.rowBetween}><div><div style={styles.blockTitle}>{election.title}</div><div style={styles.smallText}>{election.key}</div></div><div style={styles.pill}>{election.isCurrent ? "Current" : election.isActive ? "Active" : "Inactive"}</div></div><div style={styles.line}>Window: {prettyDate(election.startsAt)} - {prettyDate(election.endsAt)}</div><div style={styles.line}>Archived: {prettyDate(election.archivedAt)}</div></div>)}</section>}

          {tab === "tools" && <section style={styles.card}><div style={styles.grid}><div style={styles.block}><div style={styles.blockTitle}>Downloads</div><div style={styles.form}><button style={styles.btn} onClick={() => download("/api/admin/report/export", "election-report.csv")}>Download Election Report</button><button style={styles.btn} onClick={() => download("/api/admin/audit/export", "admin-audit.csv")}>Download Audit CSV</button><button style={styles.btn} onClick={() => download("/api/admin/backup/export", "backup.json")}>Download Backup JSON</button></div></div><div style={styles.block}><div style={styles.blockTitle}>Restore Backup</div><div style={styles.form}><textarea style={styles.textarea} placeholder="Paste backup JSON here" value={restoreForm.snapshotText} onChange={(e) => setRestoreForm((prev) => ({ ...prev, snapshotText: e.target.value }))} /><input style={styles.input} type="password" placeholder="Admin password if reauth is enabled" value={restoreForm.adminPassword} onChange={(e) => setRestoreForm((prev) => ({ ...prev, adminPassword: e.target.value }))} /><div style={styles.smallText}>Restore uses merge mode. Existing records are kept.</div><button style={styles.primaryBtn} onClick={restoreBackup}>Restore Backup</button></div></div></div></section>}
        </main>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: "100vh", background: "linear-gradient(180deg, #07111d 0%, #0a1728 55%, #0c1b30 100%)", color: "white", fontFamily: "\"Segoe UI\", Arial, sans-serif" },
  topbar: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 18, borderBottom: "1px solid rgba(255,255,255,.08)", background: "rgba(8,17,31,.94)", position: "sticky", top: 0, zIndex: 10 },
  title: { fontSize: 22, fontWeight: 900 }, sub: { fontSize: 12, opacity: 0.74, marginTop: 4 },
  layout: { display: "grid", gridTemplateColumns: "240px 1fr", gap: 16, padding: 16 },
  sidebar: { display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", height: "fit-content" },
  nav: { padding: "11px 13px", borderRadius: 12, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", color: "inherit", textAlign: "left", cursor: "pointer", fontWeight: 700 },
  navActive: { background: "rgba(64,131,255,.18)", border: "1px solid rgba(64,131,255,.34)" },
  main: { display: "flex", flexDirection: "column", gap: 16 },
  card: { padding: 18, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", boxShadow: "0 16px 40px rgba(0,0,0,.18)" },
  h2: { margin: 0, fontSize: 18 }, sectionSub: { fontSize: 13, opacity: 0.74, marginTop: 6, maxWidth: 700 },
  row: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }, rowBetween: { display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" },
  statusWrap: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }, statusChip: { padding: "8px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800 },
  statusLive: { background: "rgba(25,181,107,.18)", border: "1px solid rgba(25,181,107,.32)", color: "#9ff0c8" }, statusIdle: { background: "rgba(255,183,77,.16)", border: "1px solid rgba(255,183,77,.28)", color: "#ffd694" },
  metricsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginTop: 18 },
  metricCard: { padding: 16, borderRadius: 16, border: "1px solid rgba(255,255,255,.08)", background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03))" },
  metricLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.8, opacity: 0.68 }, metricValue: { fontSize: 30, fontWeight: 900, marginTop: 8 }, metricValueSmall: { fontSize: 18, fontWeight: 800, marginTop: 8, lineHeight: 1.4 }, metricNote: { fontSize: 12, opacity: 0.72, marginTop: 8, lineHeight: 1.5 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginTop: 16 }, stack: { display: "grid", gap: 14, marginTop: 16 },
  block: { padding: 14, borderRadius: 16, border: "1px solid rgba(255,255,255,.08)", background: "rgba(0,0,0,.16)" },
  winnerCard: { padding: 18, borderRadius: 18, border: "1px solid rgba(255,255,255,.08)", background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(0,0,0,.18))" },
  winnerHeading: { fontSize: 18, fontWeight: 800 },
  winnerHighlight: { marginTop: 14, padding: 16, borderRadius: 16, border: "1px solid rgba(94,234,212,.18)", background: "linear-gradient(135deg, rgba(94,234,212,.14), rgba(255,255,255,.02))" },
  winnerLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.9, opacity: 0.72 },
  winnerName: { fontSize: 24, fontWeight: 900, marginTop: 8 },
  winnerMeta: { fontSize: 13, opacity: 0.78, marginTop: 4 },
  stackList: { display: "grid", gap: 0, marginTop: 14 },
  heroPanel: { padding: 18, borderRadius: 16, border: "1px solid rgba(114,156,255,.18)", background: "linear-gradient(135deg, rgba(64,131,255,.18), rgba(10,23,40,.55))" },
  heroTitle: { fontSize: 15, fontWeight: 800, marginBottom: 12 }, timelineRow: { display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.08)" },
  quickAction: { width: "100%", display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "14px 0", background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,.08)", color: "inherit", textAlign: "left", cursor: "pointer" },
  quickNote: { display: "block", fontSize: 12, opacity: 0.72, marginTop: 4, lineHeight: 1.45 },
  winnersHero: { position: "relative", overflow: "hidden", borderRadius: 22, border: "1px solid rgba(255,255,255,.08)", background: "linear-gradient(135deg, rgba(18,34,62,.96), rgba(7,17,29,.96))", padding: 24, minHeight: 220 },
  winnersGlowA: { position: "absolute", width: 280, height: 280, borderRadius: "50%", background: "rgba(123,92,255,.20)", filter: "blur(18px)", top: -70, right: -40 },
  winnersGlowB: { position: "absolute", width: 220, height: 220, borderRadius: "50%", background: "rgba(55,189,181,.18)", filter: "blur(18px)", bottom: -70, left: -30 },
  winnersHeroContent: { position: "relative", zIndex: 1, maxWidth: 760 },
  winnersEyebrow: { fontSize: 11, textTransform: "uppercase", letterSpacing: 1.4, opacity: 0.74 },
  winnersTitle: { margin: "10px 0 0", fontSize: 40, lineHeight: 1.05, fontWeight: 900 },
  winnersCopy: { marginTop: 14, maxWidth: 620, fontSize: 14, lineHeight: 1.7, opacity: 0.8 },
  winnersMetaRow: { marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" },
  winnersMetaPill: { padding: "8px 12px", borderRadius: 999, fontSize: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.06)" },
  winnersGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 18 },
  winnerShowcase: { position: "relative", overflow: "hidden", padding: "22px 18px 18px", borderRadius: 22, border: "1px solid rgba(255,255,255,.09)", background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.03))", boxShadow: "0 18px 50px rgba(0,0,0,.18)" },
  winnerAccent: { position: "absolute", inset: "0 auto auto 0", width: "100%", height: 5, background: "linear-gradient(90deg, #7dd3fc, #c084fc, #f9a8d4)" },
  winnerTopRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  winnerAvatar: { width: 58, height: 58, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 20, fontWeight: 900, background: "linear-gradient(135deg, rgba(125,211,252,.24), rgba(192,132,252,.22))", border: "1px solid rgba(255,255,255,.12)" },
  winnerIcon: { width: 50, height: 50, borderRadius: 16, display: "grid", placeItems: "center", fontSize: 24, background: "linear-gradient(135deg, rgba(255,215,110,.18), rgba(255,168,76,.10))", border: "1px solid rgba(255,220,120,.22)", boxShadow: "0 10px 24px rgba(0,0,0,.16)" },
  winnerPosition: { marginTop: 18, fontSize: 12, textTransform: "uppercase", letterSpacing: 1, opacity: 0.68 },
  winnerList: { display: "grid", gap: 10, marginTop: 6 },
  winnerEntry: { padding: "10px 12px", borderRadius: 16, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" },
  winnerPerson: { marginTop: 8, fontSize: 24, lineHeight: 1.15, fontWeight: 900 },
  winnerDepartment: { marginTop: 6, fontSize: 13, opacity: 0.76 },
  winnerVoteTag: { marginTop: 18, width: "fit-content", padding: "8px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.06)" },
  winnerCrown: { marginTop: 12, fontSize: 12, opacity: 0.74 },
  tieBadge: { marginTop: 12, width: "fit-content", padding: "7px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, border: "1px solid rgba(255,205,86,.26)", background: "rgba(255,205,86,.12)", color: "#ffe29a" },
  blockTitle: { fontWeight: 800, marginBottom: 10 }, featureItem: { padding: "10px 12px", borderRadius: 12, background: "rgba(255,255,255,.04)", fontSize: 13, lineHeight: 1.5, marginTop: 8 },
  auditLine: { padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.06)" }, resultRow: { display: "grid", gridTemplateColumns: "1.1fr 1fr auto", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 13 },
  line: { padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,.06)", fontSize: 13 },
  btn: { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)", color: "inherit", cursor: "pointer", fontWeight: 700 },
  primaryBtn: { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(64,131,255,.36)", background: "rgba(64,131,255,.20)", color: "inherit", cursor: "pointer", fontWeight: 800 },
  dangerBtn: { padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,110,110,.35)", background: "rgba(255,110,110,.15)", color: "inherit", cursor: "pointer", fontWeight: 800 },
  message: { padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)" },
  pill: { padding: "6px 10px", borderRadius: 999, fontSize: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.05)" },
  form: { display: "flex", flexDirection: "column", gap: 10, marginTop: 10 },
  input: { width: "100%", minWidth: 0, padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)", color: "inherit", outline: "none" },
  checkbox: { display: "flex", gap: 10, alignItems: "center", fontSize: 13 },
  candidateRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,.06)" },
  smallText: { fontSize: 12, opacity: 0.72 },
  textarea: { minHeight: 220, width: "100%", padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,.12)", background: "rgba(255,255,255,.04)", color: "inherit", resize: "vertical", outline: "none" },
};

