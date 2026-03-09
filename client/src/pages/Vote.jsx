import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, CONTRACT_ADDRESS } from "../config";
import { clearSession, csrfHeaders, getSession, isLoggedIn } from "../utils/auth";
const EXPLORER_BASE = "";

import "../App.css";

export default function Vote() {
  const nav = useNavigate();

  const session = getSession();
  const matric = session?.user?.matric || "";

  const [loading, setLoading] = useState(true);
  const [election, setElection] = useState(null);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [err, setErr] = useState("");

  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState({});
  const [review, setReview] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [showThanks, setShowThanks] = useState(false);

  // ✅ receipt details
  const [receiptId, setReceiptId] = useState("");
  const [receiptHash, setReceiptHash] = useState("");
  const [chainRecorded, setChainRecorded] = useState(false);
  const [txHash, setTxHash] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      nav("/login");
      return;
    }

    let cancelled = false;

    async function load() {
      setErr("");
      setLoading(true);

      try {
        const res = await fetch(`${API_BASE_URL}/api/election/current`, {
          credentials: "include",
        });

        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.message || "Failed to load election");

        if (cancelled) return;

        setElection(data.election);
        setAlreadyVoted(!!data.alreadyVoted);

        if (data.alreadyVoted) {
          nav("/dashboard");
        }
      } catch (e) {
        if (cancelled) return;
        setErr(String(e.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  const total = election?.positions?.length || 0;
  const pos = election?.positions?.[step] || null;
  const selectedCandidateId = pos ? choices[pos.id] : null;

  const progressText = useMemo(() => {
    if (!total) return "";
    return `Position ${step + 1} of ${total}`;
  }, [step, total]);

  const allComplete = useMemo(() => {
    if (!election?.positions?.length) return false;
    return election.positions.every((p) => choices[p.id]);
  }, [choices, election]);

  function selectCandidate(candidateId) {
    if (!pos) return;
    setChoices((p) => ({ ...p, [pos.id]: candidateId }));
  }

  function next() {
    if (!selectedCandidateId) return;
    if (step === total - 1) setReview(true);
    else setStep((s) => s + 1);
  }

  function back() {
    if (review) {
      setReview(false);
      return;
    }
    if (step > 0) setStep((s) => s - 1);
  }

  async function submitBallot() {
    if (!allComplete || !election) return;

    setErr("");
    setSubmitting(true);

    try {
      const selections = election.positions.map((p) => ({
        positionId: p.id,
        candidateId: choices[p.id]
      }));

      const res = await fetch(`${API_BASE_URL}/api/votes/submit`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...csrfHeaders(),
        },
        body: JSON.stringify({ selections })
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.message || "Vote submission failed");

      // ✅ save all returned receipt data
      setReceiptId(data.receiptId || "");
      setReceiptHash(data.receiptHash || "");
      setChainRecorded(!!data.chainRecorded);
      setTxHash(data.txHash || "");

      setShowThanks(true);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    clearSession();
    nav("/");
  }

  function goFeedback() {
    nav("/feedback");
  }

  function goDashboard() {
    nav("/dashboard");
  }

  // ✅ NEW: go to verification page (passes receipt info too)
  function goVerify() {
    nav("/verify", {
      state: {
        receiptId,
        receiptHash,
        chainRecorded,
        txHash
      }
    });
  }

  async function copyText(text) {
    try {
      if (!text) return;
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  if (!isLoggedIn()) return null;

  return (
    <div className="dashPage">
      <div className="dashBg" />
      <div className="dashShade" />

      <div className="voteWrap">
        <div className="voteTop">
          <div>
            <div className="chip">Voting</div>
            <h1 className="voteH1">{loading ? "Loading election…" : election?.title || "Election"}</h1>
            <p className="voteP">
              {matric ? (
                <>
                  Signed in as <b>{matric}</b>
                </>
              ) : null}
              <br />
              {loading
                ? "Preparing ballot…"
                : review
                  ? "Review your selections before submitting."
                  : pos
                    ? `${progressText} — ${pos.name}`
                    : ""}
            </p>
          </div>

          <div className="voteBtns">
            <button className="btn2 ghost2" onClick={goDashboard}>Dashboard</button>
            <button className="btn2 ghost2" onClick={() => nav("/")}>Home</button>
          </div>
        </div>

        {err && (
          <div className="authError" style={{ marginBottom: 12 }}>
            <strong>Error:</strong> {err}
          </div>
        )}

        {loading && (
          <div className="cardGlass">
            <div className="cardTitle">Loading…</div>
            <div className="cardSub">Please wait.</div>
          </div>
        )}

        {!loading && election && !review && pos && (
          <div className="voteGrid">
            <div className="cardGlass">
              <div className="cardTitleRow">
                <div>
                  <div className="cardTitle">{pos.name}</div>
                  <div className="cardSub">Select exactly one candidate.</div>
                </div>
                <div className="counterPill">
                  {step + 1}/{total}
                </div>
              </div>

              <div className="candGrid">
                {pos.candidates.map((c) => {
                  const active = selectedCandidateId === c.id;
                  return (
                    <button
                      key={c.id}
                      className={`candCard ${active ? "active" : ""}`}
                      onClick={() => selectCandidate(c.id)}
                      type="button"
                    >
                      <div className="candAvatar">
                        {String(c.name || "")
                          .split(" ")
                          .slice(0, 2)
                          .map((s) => s[0])
                          .join("")}
                      </div>

                      <div className="candInfo">
                        <div className="candName">{c.name}</div>
                        <div className="candDept">{c.dept}</div>
                      </div>

                      <div className={`radioDot ${active ? "on" : ""}`} />
                    </button>
                  );
                })}
              </div>

              <div className="voteNav">
                <button className="btn2 ghost2" onClick={back} disabled={step === 0}>
                  Back
                </button>

                <button className="btn2 primary2" onClick={next} disabled={!selectedCandidateId}>
                  {step === total - 1 ? "Review" : "Next"}
                </button>
              </div>

              <div className="hint">You must choose a candidate before continuing.</div>
            </div>

            <div className="sideStack">
              <div className="cardGlass">
                <div className="cardTitle">Progress</div>
                <div className="progressList">
                  {election.positions.map((p, i) => {
                    const done = !!choices[p.id];
                    const current = i === step;
                    return (
                      <div className={`progRow ${current ? "current" : ""}`} key={p.id}>
                        <div className={`progDot ${done ? "done" : ""}`} />
                        <div>
                          <div className="progName">{p.name}</div>
                          <div className="progMeta">{done ? "Selected" : "Pending"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="cardGlass">
                <div className="cardTitle">Rule</div>
                <div className="cardSub">One vote per position. No skipping.</div>
              </div>
            </div>
          </div>
        )}

        {!loading && election && review && (
          <div className="cardGlass">
            <div className="cardTitleRow">
              <div>
                <div className="cardTitle">Review Ballot</div>
                <div className="cardSub">Confirm before submission.</div>
              </div>
              <div className="counterPill">
                {Object.keys(choices).length}/{total}
              </div>
            </div>

            <div className="reviewList">
              {election.positions.map((p) => {
                const cid = choices[p.id];
                const c = p.candidates.find((x) => x.id === cid);
                return (
                  <div className="reviewRow" key={p.id}>
                    <div>
                      <div className="reviewPos">{p.name}</div>
                      <div className="reviewCand">{c ? `${c.name} — ${c.dept}` : "Not selected"}</div>
                    </div>
                    <div className="statusPill">{c ? "Chosen" : "Missing"}</div>
                  </div>
                );
              })}
            </div>

            <div className="voteNav">
              <button className="btn2 ghost2" onClick={back} disabled={submitting}>
                Back
              </button>
              <button className="btn2 primary2" onClick={submitBallot} disabled={!allComplete || submitting}>
                {submitting ? "Submitting…" : "Submit Ballot"}
              </button>
            </div>

            {!allComplete && <div className="hint">You must select a candidate for every position.</div>}
          </div>
        )}
      </div>

      {/* Thank you dialog */}
      {showThanks && (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="modalCard">
            <div className="modalTitle">Thank you for voting ✅</div>

            <div className="modalText" style={{ lineHeight: 1.6 }}>
              Your ballot has been submitted successfully.
              <br />
              <br />

              <div>
                <b>Receipt ID:</b>{" "}
                <span style={{ opacity: 0.9, wordBreak: "break-all" }}>{receiptId}</span>{" "}
                <button
                  type="button"
                  className="linkBtn"
                  onClick={() => copyText(receiptId)}
                  style={{ marginLeft: 8 }}
                >
                  Copy
                </button>
              </div>

              <div style={{ marginTop: 8 }}>
                <b>Receipt Hash (DB proof):</b>{" "}
                <span style={{ opacity: 0.9, wordBreak: "break-all" }}>{receiptHash || "—"}</span>{" "}
                <button
                  type="button"
                  className="linkBtn"
                  onClick={() => copyText(receiptHash)}
                  style={{ marginLeft: 8 }}
                  disabled={!receiptHash}
                >
                  Copy
                </button>
              </div>

              <div style={{ marginTop: 8 }}>
                <b>Chain Recorded:</b> <span style={{ opacity: 0.9 }}>{chainRecorded ? "Yes" : "No"}</span>
              </div>

              <div style={{ marginTop: 8 }}>
                <b>Tx Hash:</b>{" "}
                {txHash ? (
                  EXPLORER_BASE ? (
                    <a
                      href={`${EXPLORER_BASE}${txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#60a5fa" }}
                    >
                      View Transaction
                    </a>
                  ) : (
                    <span style={{ opacity: 0.9, wordBreak: "break-all" }}>{txHash}</span>
                  )
                ) : (
                  "—"
                )}
                <button
                  type="button"
                  className="linkBtn"
                  onClick={() => copyText(txHash)}
                  style={{ marginLeft: 8 }}
                  disabled={!txHash}
                >
                  Copy
                </button>
              </div>

              <div style={{ marginTop: 10, opacity: 0.85 }}>
                Save your Receipt ID + Receipt Hash. You can verify later.
              </div>
            </div>

            <div className="modalBtns">
              <button className="btn2 ghost2" onClick={logout}>No, Log out</button>

              <button className="btn2 primary2" onClick={goFeedback}>Yes, Feedback</button>

              {/* ✅ NEW: Verification link */}
              <button className="btn2 primary2" onClick={goVerify} disabled={!receiptHash}>
                Verify Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
