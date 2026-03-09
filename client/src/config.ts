export const LOCAL_CHAIN_ID = 31337; // Hardhat local node
export const LOCAL_RPC_HINT = "http://127.0.0.1:8545";
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const EXPLORER_BASE =
  LOCAL_CHAIN_ID === 31337
    ? null
    : "https://etherscan.io/address/0x5FbDB2315678afecb367f032d93F642f64180aa3";
export const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "string[]", name: "names", type: "string[]" }],
    stateMutability: "nonpayable",
    type: "constructor",
  },

  {
    inputs: [],
    name: "admin",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "candidates",
    outputs: [
      { internalType: "uint256", name: "id", type: "uint256" },
      { internalType: "string", name: "name", type: "string" },
      { internalType: "uint256", name: "voteCount", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [],
    name: "candidatesCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [],
    name: "getAllCandidates",
    outputs: [
      {
        components: [
          { internalType: "uint256", name: "id", type: "uint256" },
          { internalType: "string", name: "name", type: "string" },
          { internalType: "uint256", name: "voteCount", type: "uint256" },
        ],
        internalType: "struct Voting.Candidate[]",
        name: "",
        type: "tuple[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "hasVoted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  {
    inputs: [{ internalType: "uint256", name: "candidateId", type: "uint256" }],
    name: "vote",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // ? REQUIRED for verification
  {
    inputs: [{ internalType: "bytes32", name: "receiptHash", type: "bytes32" }],
    name: "isReceiptRecorded",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },

  // Optional (admin-only write)
  {
    inputs: [{ internalType: "bytes32", name: "receiptHash", type: "bytes32" }],
    name: "recordReceipt",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "uint256", name: "candidateId", type: "uint256" }],
    name: "votedEvent",
    type: "event",
  },

  {
    anonymous: false,
    inputs: [{ indexed: true, internalType: "bytes32", name: "receiptHash", type: "bytes32" }],
    name: "ReceiptRecorded",
    type: "event",
  },


];

