// server/chain.js
const { ethers } = require("ethers");
const crypto = require("crypto");

// Minimal ABI: only what we need
const ABI = [
  {
    inputs: [{ internalType: "bytes32", name: "receiptHash", type: "bytes32" }],
    name: "recordReceipt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
];

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env`);
  return v;
}

// Normalizes inputs so the SAME receipt always hashes to the SAME value
function normalize(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " "); // collapse extra spaces
}

function makeHash(receiptId, matric, electionKey) {
  // IMPORTANT: Use server-side keyed HMAC so receipt proofs cannot be forged by clients.
  const secret = requireEnv("RECEIPT_SECRET");
  const r = normalize(receiptId);
  const m = normalize(matric).toUpperCase(); // keep consistent even if user types lower/upper
  const e = normalize(electionKey);

  const data = `${r}|${m}|${e}`;
  return `0x${crypto.createHmac("sha256", secret).update(data).digest("hex")}`;
}

function makeLegacyHash(receiptId, matric, electionKey) {
  const r = normalize(receiptId);
  const m = normalize(matric).toUpperCase();
  const e = normalize(electionKey);
  return ethers.solidityPackedKeccak256(["string", "string", "string"], [r, m, e]);
}

function getContract() {
  const rpcUrl = requireEnv("CHAIN_RPC_URL"); // e.g. http://127.0.0.1:8545
  const pk = requireEnv("CHAIN_PRIVATE_KEY"); // hardhat account private key
  const addr = requireEnv("VOTING_CONTRACT_ADDRESS");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(pk, provider);
  return new ethers.Contract(addr, ABI, wallet);
}

async function assertRpcAvailable(rpcUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`RPC returned ${res.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Writes receiptHash to chain. Returns txHash + receiptHash.
 * Call inside try/catch. This function throws on:
 * - bad RPC URL
 * - wrong contract address
 * - hardhat node not running
 * - contract missing recordReceipt(bytes32)
 */
async function storeReceiptOnChain(receiptId, matric, electionKey) {
  const rpcUrl = requireEnv("CHAIN_RPC_URL");
  await assertRpcAvailable(rpcUrl);

  const contract = getContract();
  const receiptHash = makeHash(receiptId, matric, electionKey);

  const tx = await contract.recordReceipt(receiptHash);
  const receipt = await tx.wait();

  return {
    receiptHash,
    txHash: tx.hash,
    blockNumber: receipt?.blockNumber ?? null
  };
}

module.exports = {
  makeHash,
  makeLegacyHash,
  getContract,
  storeReceiptOnChain
};
