import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { targetChain } from "@/lib/chain";

export const wagmiConfig = getDefaultConfig({
  appName: "AI Prompt Marketplace",
  // WalletConnect Cloud projectId. Fallback keeps the build and injected
  // wallets (MetaMask) working before a real ID is set; WalletConnect
  // QR-code wallets need the real value in NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-placeholder",
  chains: [targetChain],
  transports: {
    [targetChain.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssr: true,
});
