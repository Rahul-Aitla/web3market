"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useBalance,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatEther, BaseError, type Abi } from "viem";
import { Button } from "@/components/ui/button";
import marketplaceAbi from "@/lib/contracts/marketplaceAbi.json";

const CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}` | undefined;

export function BuyButton({
  assetId,
  onChainId,
  priceWei,
}: {
  assetId: string;
  onChainId: number;
  priceWei: string;
}) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useAccount().chainId;
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const { data: balance } = useBalance({
    address,
    chainId: sepolia.id,
    query: { enabled: isConnected },
  });

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmed = useRef(false);

  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (!receipt.isSuccess || !txHash || confirmed.current) return;
    confirmed.current = true;
    setConfirming(true);
    fetch("/api/purchases/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId, txHash }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Confirmation failed");
        router.push("/purchases");
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Confirmation failed")
      )
      .finally(() => setConfirming(false));
  }, [receipt.isSuccess, txHash, assetId, router]);

  if (!CONTRACT_ADDRESS) {
    return (
      <div className="flex flex-col gap-2">
        <Button disabled>Buy</Button>
        <p className="text-sm text-muted-foreground">
          Marketplace contract not deployed yet.
        </p>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <Button onClick={() => openConnectModal?.()}>Connect wallet to buy</Button>
    );
  }

  if (chainId !== sepolia.id) {
    return (
      <Button onClick={() => switchChainAsync({ chainId: sepolia.id })}>
        Switch to Sepolia
      </Button>
    );
  }

  const enoughBalance = balance === undefined || balance.value >= BigInt(priceWei);

  async function onBuy() {
    if (!CONTRACT_ADDRESS) return;
    setError(null);
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: marketplaceAbi as Abi,
        functionName: "purchase",
        args: [BigInt(onChainId)],
        value: BigInt(priceWei),
      });
      setTxHash(hash);
    } catch (e) {
      setError(
        e instanceof BaseError
          ? e.shortMessage
          : e instanceof Error
            ? e.message
            : "Transaction failed"
      );
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={onBuy}
        disabled={!enoughBalance || confirming || receipt.isLoading}
        title={!enoughBalance ? "Not enough Sepolia ETH" : undefined}
      >
        {confirming || receipt.isLoading
          ? "Waiting for confirmation..."
          : `Buy for ${formatEther(BigInt(priceWei))} ETH`}
      </Button>
      {!enoughBalance && (
        <p className="text-sm text-muted-foreground">Not enough Sepolia ETH</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
