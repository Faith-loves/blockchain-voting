import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BrowserProvider, Contract } from "ethers";
import { clearSession, getSession, isLoggedIn } from "../utils/auth";
import { CONTRACT_ABI, CONTRACT_ADDRESS, LOCAL_CHAIN_ID, API_BASE_URL } from "../config";
import "../App.css";

export default function Verify() {
  const nav = useNavigate();
  const session = getSession();
  const matric = session?.user?.matric || "";

  const [receipt, setReceipt] = useState("");
  const [hasWallet, setHasWallet] = useState(false);
  const [walletAddr, setWalletAddr] = useState("");
  const [chainId, setChainId] = useState(null);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) nav("/login");
  }, [nav]);

  useEffect(() => {
    setHasWallet(typeof window !== "undefined" && !!window.ethereum);
  }, []);

  const chainOk = useMemo(() => {
    if (!chainId) return false;
    const dec =
      typeof chainId === "string" && chainId.startsWith("0x")
        ? parseInt(chainId, 16)
        : Number(chainId);
    return dec === LOCAL_CHAIN_ID;
  }, [chainId]);

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
      setStatus("Wallet connected");
    } catch {
      setStatus("Wallet connection failed");
    }
  }

  async function loadMyReceipt() {
    setLoading(true);
    setStatus("Loading your receipt...");
    setFound(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/votes/mine`, {
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setStatus(data?.message || "Server error");
        return;
      }

      if (!data.receiptId) {
        setStatus("No receipt found. You may not have voted yet.");
        return;
      }

      setReceipt(data.receiptId);
      setStatus("Receipt loaded. Click verify.");
    } catch (err) {
      console.error(err);
      setStatus("Failed to load receipt");
    } finally {
      setLoading(false);
    }
  }

  async function verifyReceipt() {
    const rid = receipt.trim();
    if (!rid) {
      setStatus("Enter receipt ID");
      return;
    }
    if (!window?.ethereum) {
      setStatus("Install MetaMask");
      return;
    }
    if (!walletAddr) {
      setStatus("Connect wallet first");
      return;
    }
    if (!chainOk) {
      setStatus(`Switch network to Localhost 8545 (chain ${LOCAL_CHAIN_ID})`);
      return;
    }

    setLoading(true);
    setStatus("Verifying...");
    setFound(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/verify/${encodeURIComponent(rid)}`);
      const data = await res.json();

      if (!data.found) {
        setFound(false);
        setStatus("Receipt not found in database");
        return;
      }

      if (!data.match) {
        setFound(false);
        setStatus("Database hash mismatch — possible tampering");
        return;
      }

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const exists = await contract.isReceiptRecorded(data.receiptHash);

      setFound(exists);
      setStatus(
        exists
          ? "Valid receipt ✔ Verified on blockchain"
          : "Exists in DB but not on blockchain"
      );
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "Verification failed");
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
            </p>
          </div>

          <div className="voteBtns">
            <button className="btn2 ghost2" onClick={() => nav("/dashboard")}>
              Dashboard
            </button>
            <button className="btn2 ghost2" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        {status && (
          <div className="authError" style={{ marginBottom: 12 }}>
            <strong>Status:</strong> {status}
          </div>
        )}

        <div className="cardGlass">
          <div className="cardTitle">Receipt + Wallet</div>

          <div className="cardSub" style={{ marginTop: 8 }}>
            <b>Contract:</b> {CONTRACT_ADDRESS}
            <br />
            <b>Wallet:</b> {walletAddr || "Not connected"}
            <br />
            <b>Network:</b>{" "}
            {chainId ? `${chainId} ${chainOk ? "(OK)" : "(Wrong)"}` : "Unknown"}
          </div>

          <input
            className="fieldInput"
            placeholder="Paste receipt ID"
            value={receipt}
            onChange={(e) => setReceipt(e.target.value)}
            style={{ marginTop: 12 }}
          />

          <div className="voteNav" style={{ marginTop: 15 }}>
            <button className="btn2 ghost2" onClick={connectWallet} disabled={!hasWallet}>
              {walletAddr ? "Wallet Connected" : "Connect Wallet"}
            </button>

            <button className="btn2 ghost2" onClick={loadMyReceipt}>
              Load My Receipt
            </button>

            <button className="btn2 primary2" onClick={verifyReceipt}>
              {loading ? "Checking..." : "Verify Receipt"}
            </button>
          </div>

          {found !== null && (
            <div className="cardSub" style={{ marginTop: 15 }}>
              Result:{" "}
              <b style={{ color: found ? "#22c55e" : "#ef4444" }}>
                {found ? "VALID VOTE" : "INVALID"}
              </b>
            </div>
          )}
        </div>

        <div className="dashFoot">
          Milestone: Receipt verification (DB + Blockchain)
        </div>
      </div>
    </div>
  );
}
