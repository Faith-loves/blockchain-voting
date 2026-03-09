import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BrowserProvider, Contract } from "ethers";
import { getSession, isLoggedIn, clearSession } from "../utils/auth";
import { CONTRACT_ABI, CONTRACT_ADDRESS, LOCAL_CHAIN_ID } from "../config";
import "../App.css";

const API = "http://localhost:5000";

export default function VerifyReceipt() {
  const nav = useNavigate();
  const { state } = useLocation();
  const initialReceiptId = typeof state?.receiptId === "string" ? state.receiptId : "";
  const initialReceiptHash = typeof state?.receiptHash === "string" ? state.receiptHash : "";
  const initialChainRecorded =
    typeof state?.chainRecorded === "boolean" ? state.chainRecorded : null;

  const session = getSession();
  const token = session?.token || "";
  const matric = session?.user?.matric || "";

  const [hasWallet, setHasWallet] = useState(false);
  const [walletAddr, setWalletAddr] = useState("");
  const [chainId, setChainId] = useState(null);

  const [receiptId, setReceiptId] = useState(initialReceiptId);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [dbFound, setDbFound] = useState(false);
  const [dbReceiptHash, setDbReceiptHash] = useState(initialReceiptHash);
  const [chainOkRecorded, setChainOkRecorded] = useState(initialChainRecorded);

  useEffect(() => {
    if (!isLoggedIn()) nav("/login");
  }, [nav]);

  useEffect(() => {
    setHasWallet(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  const chainOk = useMemo(() => {
    if (!chainId) return false;
    const dec = typeof chainId === "string" && chainId.startsWith("0x") ? parseInt(chainId, 16) : Number(chainId);
    return dec === LOCAL_CHAIN_ID;
  }, [chainId]);

  useEffect(() => {
    if (initialReceiptId) {
      setStatus("Receipt loaded from vote. Click Verify.");
    }
  }, [initialReceiptId]);

  function shortAddr(a) {
    if (!a) return "";
    return `${a.slice(0, 6)}...${a.slice(-4)}`;
  }

  async function connectWallet() {
    if (!window?.ethereum) {
      setStatus("MetaMask not found. Install MetaMask.");
      return;
    }
    try {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      setWalletAddr(accs?.[0] || "");
      const cid = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(cid || null);
      setStatus("Wallet connected.");
    } catch {
      setStatus("Wallet connection cancelled or failed.");
    }
  }

  async function loadMyReceipt() {
    setLoading(true);
    setStatus("Loading your receipt...");
    setDbFound(false);
    setDbReceiptHash("");
    setChainOkRecorded(null);

    try {
      const res = await fetch(`${API}/api/votes/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // IMPORTANT: handle non-JSON responses safely
      const ct = res.headers.get("content-type") || "";
      const raw = await res.text();
      const data = ct.includes("application/json") ? JSON.parse(raw) : null;

      if (!res.ok || !data?.ok) {
        // If server returned HTML, show a clear message
        if (!data) throw new Error("Backend did not return JSON. Check API URL / server.");
        throw new Error(data?.message || "Failed to load receipt");
      }

      if (!data.receiptId) {
        setStatus("No receipt found. You may not have voted yet.");
        return;
      }

      setReceiptId(data.receiptId);
      setDbReceiptHash(data.receiptHash || "");
      setDbFound(true);
      setStatus("Receipt loaded. Now click Verify.");
    } catch (e) {
      setStatus(e?.message || "Failed to load receipt");
    } finally {
      setLoading(false);
    }
  }

  async function verifyNow() {
    const rid = receiptId.trim();
    if (!rid) {
      setStatus("Enter Receipt ID first (or click Load My Receipt).");
      return;
    }

    setLoading(true);
    setStatus("Checking database + blockchain...");
    setDbFound(false);
    setDbReceiptHash("");
    setChainOkRecorded(null);

    try {
      // 1) DB verify
      const res = await fetch(`${API}/api/verify/${encodeURIComponent(rid)}`);

      const ct = res.headers.get("content-type") || "";
      const raw = await res.text();
      const data = ct.includes("application/json") ? JSON.parse(raw) : null;

      if (!data) throw new Error("Backend did not return JSON. Check API URL / server.");

      if (!data.found) {
        setStatus("DB: Receipt not found.");
        setDbFound(false);
        return;
      }

      if (!data.match) {
        setStatus("DB: Hash mismatch (possible tampering).");
        setDbFound(false);
        return;
      }

      setDbFound(true);
      setDbReceiptHash(String(data.receiptHash || ""));

      // 2) Blockchain verify
      if (!window?.ethereum) {
        setStatus("DB OK ✅  Install MetaMask to verify blockchain.");
        return;
      }
      if (!walletAddr) {
        setStatus("DB OK ✅  Connect wallet to verify blockchain.");
        return;
      }
      if (!chainOk) {
        setStatus(`Wrong network. Switch MetaMask to Localhost 8545 (chainId ${LOCAL_CHAIN_ID}).`);
        return;
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const recorded = await contract.isReceiptRecorded(String(data.receiptHash));
      setChainOkRecorded(!!recorded);

      setStatus(recorded ? "DB OK ✅  Chain OK ✅" : "DB OK ✅  Chain NOT RECORDED ❌");
    } catch (e) {
      setStatus(e?.shortMessage || e?.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearSession();
    nav("/");
  }

  if (!isLoggedIn()) return null;

  return (
    <div className="dashPage">
      <div className="dashBg" />
      <div className="dashShade" />

      <div className="voteWrap">
        <div className="voteTop">
          <div>
            <div className="chip">Verification</div>
            <h1 className="voteH1">Verify Receipt</h1>
            <p className="voteP">
              Signed in as <b>{matric}</b>
              <br />
              Verify your receipt in DB and (optionally) on blockchain.
            </p>
          </div>

          <div className="voteBtns">
            <button className="btn2 ghost2" onClick={() => nav("/dashboard")}>Dashboard</button>
            <button className="btn2 ghost2" onClick={logout}>Logout</button>
          </div>
        </div>

        {status && (
          <div className="authError" style={{ marginBottom: 12 }}>
            <strong>Status:</strong> {status}
          </div>
        )}

        <div className="cardGlass">
          <div className="cardTitleRow">
            <div>
              <div className="cardTitle">Receipt</div>
              <div className="cardSub">
                Contract: <span style={{ opacity: 0.9 }}>{CONTRACT_ADDRESS}</span>
              </div>
            </div>
            <div className="counterPill">DB + Chain</div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label className="field">
              <span>Enter Receipt ID</span>
              <input
                className="fieldInput"
                value={receiptId}
                onChange={(e) => setReceiptId(e.target.value)}
                placeholder="e.g. bN3ObenEVoZD"
              />
            </label>
          </div>

          <div className="voteNav" style={{ marginTop: 14 }}>
            <button className="btn2 ghost2" onClick={loadMyReceipt} disabled={loading}>
              {loading ? "Loading…" : "Load My Receipt"}
            </button>

            <button className="btn2 ghost2" onClick={connectWallet} disabled={!hasWallet}>
              {walletAddr ? `Wallet: ${shortAddr(walletAddr)}` : "Connect Wallet"}
            </button>

            <button className="btn2 primary2" onClick={verifyNow} disabled={loading}>
              {loading ? "Verifying…" : "Verify"}
            </button>
          </div>

          <div className="cardSub" style={{ marginTop: 12 }}>
            <b>MetaMask:</b> {hasWallet ? "Detected" : "Not installed"} <br />
            <b>Wallet:</b> {walletAddr ? shortAddr(walletAddr) : "Not connected"} <br />
            <b>Network:</b>{" "}
            {chainId ? (
              <>
                {String(chainId)} {chainOk ? "(Localhost OK)" : "(Wrong network)"}
              </>
            ) : (
              "Unknown"
            )}
          </div>
        </div>

        <div className="voteGrid" style={{ marginTop: 12 }}>
          <div className="cardGlass">
            <div className="cardTitleRow">
              <div>
                <div className="cardTitle">DB Result</div>
                <div className="cardSub">Checks MongoDB by receiptId.</div>
              </div>
              <div className="statusPill">{dbFound ? "FOUND" : "NOT FOUND"}</div>
            </div>

            <div className="cardSub" style={{ marginTop: 10, wordBreak: "break-all" }}>
              <b>receiptHash:</b> {dbReceiptHash || "—"}
            </div>
          </div>

          <div className="cardGlass">
            <div className="cardTitleRow">
              <div>
                <div className="cardTitle">Blockchain Result</div>
                <div className="cardSub">Checks isReceiptRecorded(receiptHash).</div>
              </div>
              <div className="statusPill">
                {chainOkRecorded === null ? "—" : chainOkRecorded ? "RECORDED" : "NOT RECORDED"}
              </div>
            </div>

            <div className="cardSub" style={{ marginTop: 10 }}>
              {chainOkRecorded === null
                ? "Connect MetaMask + correct network, then verify."
                : chainOkRecorded
                ? "Receipt hash exists on-chain."
                : "Receipt hash not found on-chain (maybe chain write failed)."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
