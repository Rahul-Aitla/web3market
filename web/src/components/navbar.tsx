"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { SiweMessage } from "siwe";

export function Navbar() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const signingRef = useRef(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setSessionWallet(d.walletAddress ?? null))
      .catch(() => {})
      .finally(() => setMeLoaded(true));
  }, []);

  useEffect(() => {
    if (!isConnected || !address || !meLoaded || signingRef.current) return;
    if (sessionWallet === address.toLowerCase()) return;

    const hadSession = sessionWallet !== null;
    signingRef.current = true;

    (async () => {
      try {
        if (hadSession) {
          await fetch("/api/auth/logout", { method: "POST" });
        }
        const { nonce } = await (await fetch("/api/auth/nonce")).json();
        const message = new SiweMessage({
          domain: window.location.host,
          address,
          statement: "Sign in to AI Prompt Marketplace",
          uri: window.location.origin,
          version: "1",
          chainId: 11155111,
          nonce,
          expirationTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        });
        const prepared = message.prepareMessage();
        const signature = await signMessageAsync({ message: prepared });
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: prepared, signature }),
        });
        if (res.ok) {
          const data = await res.json();
          setSessionWallet(data.walletAddress);
        } else {
          setSessionWallet(null);
        }
      } catch {
        setSessionWallet(null);
      } finally {
        signingRef.current = false;
      }
    })();
  }, [isConnected, address, sessionWallet, meLoaded, signMessageAsync]);

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-semibold">
          AI Prompt Marketplace
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/marketplace" className="hover:underline">
            Marketplace
          </Link>
          <Link href="/create-asset" className="hover:underline">
            Sell
          </Link>
          <Link href="/purchases" className="hover:underline">
            Purchases
          </Link>
        </nav>
      </div>
      <ConnectButton />
    </header>
  );
}
