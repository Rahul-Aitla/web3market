import { sepolia, hardhat } from "viem/chains";

// Target chain for the whole app. NEXT_PUBLIC_CHAIN_ID=31337 switches to a
// local `npx hardhat node` (instant txs, no faucet needed); anything else
// stays on Sepolia.
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
export const targetChain = CHAIN_ID === 31337 ? hardhat : sepolia;
