"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useBalance,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { CHAIN_ID, targetChain } from "@/lib/chain";
import { formatEther, BaseError, type Abi } from "viem";
import { Button } from "@/components/ui/button";
import marketplaceAbi from "@/lib/contracts/marketplaceAbi.json";

const CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS as `0x${string}` | undefined;

const PURCHASED_EVENT = {
  type: "event",
  name: "Purchased",
  inputs: [
    { name: "assetId", type: "uint256", indexed: true },
    { name: "buyer", type: "address", indexed: true },
    { name: "seller", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "timestamp", type: "uint256", indexed: false },
  ],
} as const;

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
  const { address, isConnected, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { data: balance } = useBalance({
    address,
    chainId: targetChain.id,
    query: { enabled: isConnected },
  });
  const { data: alreadyOwned, refetch: refetchOwned } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: marketplaceAbi as Abi,
    functionName: "hasPurchased",
    args: [BigInt(onChainId), address ?? "0x0000000000000000000000000000000000000000"],
    chainId: CHAIN_ID,
    query: { enabled: isConnected && !!CONTRACT_ADDRESS },
  });

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [owned, setOwned] = useState(false);
  const confirmed = useRef(false);

  const receipt = useWaitForTransactionReceipt({ hash: txHash });

  // After a new purchase confirms, register it server-side.
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

  // Owned on-chain but no purchase recorded (e.g. tab closed mid-flow):
  // recover by finding the Purchased event and replaying /confirm.
  useEffect(() => {
    if (!alreadyOwned || !publicClient || !address || !CONTRACT_ADDRESS) return;
    setRecovering(true);
    (async () => {
      try {
        const logs = await publicClient.getLogs({
          address: CONTRACT_ADDRESS,
          event: PURCHASED_EVENT,
          args: { assetId: BigInt(onChainId), buyer: address },
          fromBlock: BigInt(0),
        });
        if (logs.length > 0) {
          await fetch("/api/purchases/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assetId,
              txHash: logs[logs.length - 1].transactionHash,
            }),
          });
        }
      } catch {
        // Best-effort recovery - the "Owned" state is still shown.
      } finally {
        setRecovering(false);
        setOwned(true);
      }
    })();
  }, [alreadyOwned, publicClient, address, assetId, onChainId]);

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

  if (chainId !== CHAIN_ID) {
    return (
      <Button onClick={() => switchChainAsync({ chainId: CHAIN_ID })}>
        Switch to {targetChain.name}
      </Button>
    );
  }

  if (alreadyOwned || owned) {
    return (
      <div className="flex flex-col gap-2">
        <Link href="/purchases">
          <Button variant="outline">
            {recovering ? "Syncing purchase..." : "You own this — view purchases"}
          </Button>
        </Link>
      </div>
    );
  }

  const enoughBalance =
    balance === undefined || balance.value >= BigInt(priceWei);

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
      if (e instanceof BaseError && /already purchased/i.test(e.message)) {
        refetchOwned();
      }
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
        title={!enoughBalance ? "Not enough ETH" : undefined}
      >
        {confirming || receipt.isLoading
          ? "Waiting for confirmation..."
          : `Buy for ${formatEther(BigInt(priceWei))} ETH`}
      </Button>
      {!enoughBalance && (
        <p className="text-sm text-muted-foreground">Not enough ETH</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
