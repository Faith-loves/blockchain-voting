import { BrowserProvider, Contract } from "ethers";
import { ABI, CONTRACT_ADDRESS } from "../web3config";

declare global {
  interface Window { ethereum?: any; }
}

export type Candidate = { id: bigint; name: string; voteCount: bigint };

export function hasMetaMask() {
  return typeof window.ethereum !== "undefined";
}

export async function getProvider() {
  if (!hasMetaMask()) throw new Error("MetaMask not found");
  return new BrowserProvider(window.ethereum);
}

export async function requestAccounts() {
  const provider = await getProvider();
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts as string[];
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

export async function getContractWithSigner() {
  const signer = await getSigner();
  return new Contract(CONTRACT_ADDRESS, ABI, signer);
}

export async function readCandidates(): Promise<Candidate[]> {
  const c = await getContractWithSigner();
  const list: Candidate[] = await c.getAllCandidates();
  return list;
}

export async function readHasVoted(address: string): Promise<boolean> {
  const c = await getContractWithSigner();
  return await c.hasVoted(address);
}

export async function vote(candidateId: bigint) {
  const c = await getContractWithSigner();
  const tx = await c.vote(candidateId);
  return tx.wait();
}