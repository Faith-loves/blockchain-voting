import { useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract } from "ethers";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "./config";

type Candidate = { id: bigint; name: string; voteCount: bigint };

declare global {
  interface Window { ethereum?: any; }
}

export default function App() {
  const [account, setAccount] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [voted, setVoted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const hasWallet = useMemo(() => typeof window.ethereum !== "undefined", []);

  async function getContract() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    return { provider, signer, contract };
  }

  async function connect() {
    if (!hasWallet) return setStatus("Install MetaMask.");
    const { provider } = await getContract();
    const accounts = await provider.send("eth_requestAccounts", []);
    setAccount(accounts?.[0] ?? "");
    setStatus("Connected");
    await refresh();
  }

  async function refresh() {
    if (!hasWallet) return;
    try {
      const { signer, contract } = await getContract();
      const addr = await signer.getAddress();

      const list: Candidate[] = await contract.getAllCandidates();
      setCandidates(list);

      const hasVoted: boolean = await contract.hasVoted(addr);
      setVoted(hasVoted);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "Refresh failed");
    }
  }

  async function vote(candidateId: bigint) {
    try {
      setLoading(true);
      setStatus("Sending vote...");
      const { contract } = await getContract();
      const tx = await contract.vote(candidateId);
      setStatus("Waiting confirmation...");
      await tx.wait();
      setStatus("Vote recorded.");
      await refresh();
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "Vote failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasWallet) return;
    (async () => {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_accounts", []);
        if (accounts?.[0]) setAccount(accounts[0]);
        await refresh();
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWallet]);

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", padding: 16, fontFamily: "system-ui, Arial" }}>
      <h1>Blockchain Voting</h1>
      <p style={{ opacity: 0.75 }}>Contract: <code>{CONTRACT_ADDRESS}</code></p>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <button onClick={connect} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}>
          {account ? "Connected" : "Connect MetaMask"}
        </button>
        <button onClick={refresh} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ddd" }}>
          Refresh
        </button>
        <div style={{ marginLeft: "auto", fontSize: 14, opacity: 0.85 }}>
          {account ? <>Account: <code>{account.slice(0, 6)}...{account.slice(-4)}</code> | {voted ? "Voted" : "Not voted"}</> : "Not connected"}
        </div>
      </div>

      {status && <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, marginBottom: 14 }}>{status}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {candidates.map((c) => (
          <div key={String(c.id)} style={{ border: "1px solid #eee", borderRadius: 16, padding: 14 }}>
            <div style={{ fontWeight: 700 }}>{c.name}</div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>Votes: <b>{c.voteCount.toString()}</b></div>
            <button
              onClick={() => vote(c.id)}
              disabled={!account || voted || loading}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
                opacity: (!account || voted || loading) ? 0.6 : 1
              }}
            >
              {voted ? "Already voted" : loading ? "Processing..." : "Vote"}
            </button>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 18, fontSize: 13, opacity: 0.75 }}>
        Make sure MetaMask is on <b>Localhost 8545</b> when using the local Hardhat node.
      </p>
    </div>
  );
}