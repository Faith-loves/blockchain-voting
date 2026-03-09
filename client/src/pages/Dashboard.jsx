import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearSession, getSession, isLoggedIn } from "../utils/auth";
import "../App.css";

export default function Dashboard() {
  const nav = useNavigate();

  const session = getSession();
  const matric = session?.user?.matric || "";
  const email = session?.user?.email || "";
  const role = session?.user?.role || "voter";

  const [loading, setLoading] = useState(true);
  const [election, setElection] = useState(null);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const [err, setErr] = useState("");

  // MetaMask / wallet states
  const [hasWallet, setHasWallet] = useState(false);
  const [walletAddr, setWalletAddr] = useState("");
  const [chainId, setChainId] = useState(null);
  const [walletMsg, setWalletMsg] = useState("");

  function shortAddr(a) {
    if (!a) return "";
    return `${a.slice(0, 6)}...${a.slice(-4)}`;
  }

  async function refreshWalletState() {
    if (!window?.ethereum) {
      setHasWallet(false);
      setWalletAddr("");
      setChainId(null);
      return;
    }
    setHasWallet(true);

    try {
      const accs = await window.ethereum.request({ method: "eth_accounts" });
      setWalletAddr(accs?.[0] || "");
    } catch {
      setWalletAddr("");
    }

    try {
      const cid = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(cid || null);
    } catch {
      setChainId(null);
    }
  }

  async function connectWallet() {
    setWalletMsg("");
    if (!window?.ethereum) {
      setWalletMsg("MetaMask not detected. Install it to connect wallet.");
      return;
    }
    try {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWalletAddr(accs?.[0] || "");
      const cid = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(cid || null);
      setWalletMsg(accs?.[0] ? "Wallet connected." : "No wallet selected.");
    } catch {
      setWalletMsg("Wallet connection cancelled or failed.");
    }
  }

  useEffect(() => {
    // 1) not logged in -> login
    if (!isLoggedIn()) {
      nav("/login");
      return;
    }

    // 2) admin should NEVER see voter dashboard
    if (role === "admin") {
      nav("/admin", { replace: true });
      return;
    }

    let cancelled = false;

    async function load() {
      setErr("");
      setLoading(true);

      try {
        const res = await fetch("http://localhost:5000/api/election/current", {
          credentials: "include",
        });
        const data = await res.json();

        if (!res.ok || !data.ok) throw new Error(data?.message || "Failed to load election");
        if (cancelled) return;

        setElection(data.election);
        setAlreadyVoted(!!data.alreadyVoted);
      } catch (e) {
        if (cancelled) return;
        setErr(String(e.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    refreshWalletState();

    const onAccountsChanged = (accs) => setWalletAddr(accs?.[0] || "");
    const onChainChanged = (cid) => setChainId(cid || null);

    try {
      window?.ethereum?.on?.("accountsChanged", onAccountsChanged);
      window?.ethereum?.on?.("chainChanged", onChainChanged);
    } catch {}

    return () => {
      cancelled = true;
      try {
        window?.ethereum?.removeListener?.("accountsChanged", onAccountsChanged);
        window?.ethereum?.removeListener?.("chainChanged", onChainChanged);
      } catch {}
    };
  }, [nav, role]);

  const total = useMemo(() => election?.positions?.length ?? 0, [election]);

  function logout() {
    clearSession();
    nav("/");
  }

  const isLocalhost31337 =
    chainId === "0x7a69" || chainId === "0x539" || chainId === "31337" || chainId === 31337;

  return (
    <div className="dashPage">
      <div className="dashBg" />
      <div className="dashShade" />

      <div className="dashContainer">
        <div className="dashHeader">
          <div>
            <div className="chip">Voter Dashboard</div>
            <h1 className="dashH1">{loading ? "Loading…" : election?.title || "Election"}</h1>
            <p className="dashP">
              Signed in as <b>{matric}</b> {email ? `• ${email}` : ""}
              <br />
              {loading
                ? "Preparing your ballot…"
                : alreadyVoted
                ? "Status: You have already voted. Thank you."
                : `You have ${total} positions. Vote once per position.`}
            </p>
          </div>

          <div className="dashHeaderBtns">
            <button className="btn2 ghost2" onClick={() => nav("/")}>Home</button>
            <button className="btn2 ghost2" onClick={logout}>Logout</button>
            <button
              className="btn2 primary2"
              onClick={() => nav("/vote")}
              disabled={loading || alreadyVoted}
              title={alreadyVoted ? "You already voted" : "Start voting"}
            >
              {alreadyVoted ? "Already Voted" : "Start Voting"}
            </button>
          </div>
        </div>

        {err && (
          <div className="authError" style={{ marginBottom: 12 }}>
            <strong>Error:</strong> {err}
          </div>
        )}

        <div className="dashMain">
          <div className="cardGlass">
            <div className="cardTitleRow">
              <div>
                <div className="cardTitle">Ballot Positions</div>
                <div className="cardSub">
                  {alreadyVoted ? "Voting is locked for your account." : "You must complete all positions."}
                </div>
              </div>
              <div className="counterPill">{total || 0} total</div>
            </div>

            <div className="posGrid">
              {loading && <div className="skeletonRow">Loading positions…</div>}

              {!loading && election?.positions?.map((p, idx) => (
                <div className="posItem" key={p.id}>
                  <div className="posLeft">
                    <div className="posNum">{String(idx + 1).padStart(2, "0")}</div>
                    <div className="posName">{p.name}</div>
                  </div>
                  <div className="statusPill">{alreadyVoted ? "Locked" : "Pending"}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="sideStack">
            <div className="cardGlass">
              <div className="cardTitle">Status</div>
              <div className="cardSub">
                {alreadyVoted ? "Your vote is recorded in the database." : "You can vote now."}
                <br /><br />
                <b>Wallet:</b>{" "}
                {hasWallet ? (walletAddr ? shortAddr(walletAddr) : "Not connected") : "MetaMask not installed"}
                <br />
                <b>Network:</b>{" "}
                {chainId ? `${chainId}${isLocalhost31337 ? " (Localhost OK)" : ""}` : "Unknown"}
                {!isLocalhost31337 && chainId ? (
                  <>
                    <br />
                    <span style={{ opacity: 0.85 }}>
                      Tip: Use MetaMask network <b>Localhost 8545</b> (chainId 31337) for Hardhat node.
                    </span>
                  </>
                ) : null}
                {walletMsg ? (
                  <>
                    <br />
                    <span style={{ opacity: 0.9 }}>{walletMsg}</span>
                  </>
                ) : null}
              </div>

              <button
                className="btn2 ghost2 full"
                onClick={connectWallet}
                disabled={!hasWallet}
                title={!hasWallet ? "Install MetaMask" : "Connect wallet"}
              >
                {walletAddr ? "Wallet Connected" : "Connect Wallet"}
              </button>

              <button
                className="btn2 primary2 full"
                onClick={() => nav(alreadyVoted ? "/feedback" : "/vote")}
                style={{ marginTop: 10 }}
              >
                {alreadyVoted ? "Give Feedback" : "Start Voting"}
              </button>
            </div>

            <div className="cardGlass">
              <div className="cardTitle">Next (Blockchain)</div>
              <div className="cardSub">
                MetaMask + Hardhat receipt hash after DB voting is stable.
              </div>
            </div>
          </div>
        </div>

        <div className="dashFoot">Milestone: DB voting + double-vote prevention</div>
      </div>
    </div>
  );
}
