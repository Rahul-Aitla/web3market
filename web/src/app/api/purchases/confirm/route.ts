import { NextResponse } from "next/server";
import {
  createPublicClient,
  decodeEventLog,
  http,
  type Abi,
} from "viem";
import { sepolia } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import marketplaceAbi from "@/lib/contracts/marketplaceAbi.json";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await rateLimit(`confirm:${user.userId}`, 10, 60))) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: { assetId?: string; txHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (
    typeof body.assetId !== "string" ||
    typeof body.txHash !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(body.txHash)
  ) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const asset = await prisma.asset.findUnique({
    where: { id: body.assetId },
    select: { id: true, onChainId: true, priceWei: true },
  });
  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const contractAddress = (
    process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS ?? ""
  ).toLowerCase();
  if (!contractAddress || !process.env.SEPOLIA_RPC_URL) {
    return NextResponse.json(
      { error: "Contract/RPC not configured" },
      { status: 503 }
    );
  }

  const client = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL),
  });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({
      hash: body.txHash as `0x${string}`,
    });
  } catch {
    return NextResponse.json(
      { error: "Transaction not found" },
      { status: 400 }
    );
  }
  if (
    receipt.status !== "success" ||
    receipt.to?.toLowerCase() !== contractAddress
  ) {
    return NextResponse.json(
      { error: "Transaction does not match this purchase" },
      { status: 400 }
    );
  }

  // Only decode logs emitted by our contract - decodeEventLog throws on
  // unrelated logs.
  const purchasedLogs = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== contractAddress) continue;
    try {
      const decoded = decodeEventLog({
        abi: marketplaceAbi as Abi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "Purchased") purchasedLogs.push(decoded);
    } catch {
      continue;
    }
  }

  const matching = purchasedLogs.filter((d) => {
    const args = d.args as unknown as {
      assetId: bigint;
      buyer: string;
      amount: bigint;
    };
    return (
      args.assetId === BigInt(asset.onChainId) &&
      args.buyer.toLowerCase() === user.walletAddress
    );
  });
  if (matching.length !== 1) {
    return NextResponse.json(
      { error: "Transaction does not match this purchase" },
      { status: 400 }
    );
  }

  const amount = (matching[0].args as unknown as { amount: bigint }).amount;
  if (amount !== BigInt(asset.priceWei)) {
    return NextResponse.json(
      { error: "Paid amount does not match listing price" },
      { status: 400 }
    );
  }

  const existing = await prisma.purchase.findUnique({
    where: { txHash: body.txHash },
  });
  if (existing) {
    if (existing.buyerId === user.userId) {
      return NextResponse.json({ status: existing.status });
    }
    return NextResponse.json(
      { error: "This transaction is already associated with a different purchase" },
      { status: 400 }
    );
  }

  await prisma.purchase.create({
    data: {
      buyerId: user.userId,
      assetId: asset.id,
      txHash: body.txHash,
      amountWei: amount.toString(),
      status: "CONFIRMED",
      blockNumber: receipt.blockNumber,
    },
  });

  return NextResponse.json({ status: "CONFIRMED" });
}
