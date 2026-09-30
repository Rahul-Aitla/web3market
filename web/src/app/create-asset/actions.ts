"use server";

import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import slugify from "slugify";
import { Category, PreviewMediaType, Prisma } from "@prisma/client";
import { parseEther, createPublicClient, http, type Abi } from "viem";
import { sepolia } from "viem/chains";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isPlaygroundEligible } from "@/lib/categories";
import { resolvedUploadsDir } from "@/lib/uploads";
import marketplaceAbi from "@/lib/contracts/marketplaceAbi.json";

const inputSchema = z.object({
  title: z.string().min(3).max(120),
  shortDesc: z.string().min(10).max(160),
  fullDesc: z.string().min(20).max(4000),
  category: z.nativeEnum(Category),
  priceEth: z.string().regex(/^\d+(\.\d+)?$/, "Enter a valid amount"),
  promptFilePath: z.string().min(1),
  promptFileType: z.string().min(1),
  promptFileSizeBytes: z.number().int().positive(),
  previewMediaPath: z.string().optional(),
  previewMediaType: z.nativeEnum(PreviewMediaType).optional(),
  playgroundInputs: z
    .array(z.object({ name: z.string().min(1), label: z.string().min(1) }))
    .optional(),
  systemPrompt: z.string().optional(),
});

const PREVIEW_REQUIRED = new Set<Category>([
  Category.IMAGE_PROMPT,
  Category.VIDEO_PROMPT,
  Category.UI_DESIGN_PROMPT,
]);

// basename() kills any traversal; the file must exist directly under
// uploadsDir/<subdir>. A client cannot submit fake or traversal paths
// without actually having uploaded a file.
function assertExistingFile(subdir: "private" | "preview", relPath: string) {
  const abs = path.resolve(resolvedUploadsDir(), subdir, path.basename(relPath));
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error("Uploaded file not found");
  }
}

export async function createAsset(raw: unknown) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const input = inputSchema.parse(raw);

  assertExistingFile("private", input.promptFilePath);
  if (input.previewMediaPath) {
    assertExistingFile("preview", input.previewMediaPath);
  }
  if (PREVIEW_REQUIRED.has(input.category) && !input.previewMediaPath) {
    throw new Error("Preview media is required for this category");
  }

  const playgroundConfig = isPlaygroundEligible(input.category)
    ? {
        inputs: input.playgroundInputs ?? [],
        systemPrompt: input.systemPrompt ?? "",
      }
    : Prisma.JsonNull;

  const data = {
    sellerId: user.userId,
    title: input.title,
    shortDesc: input.shortDesc,
    fullDesc: input.fullDesc,
    category: input.category,
    priceWei: parseEther(input.priceEth).toString(),
    status: "DRAFT" as const,
    fileStoragePath: input.promptFilePath,
    fileType: input.promptFileType,
    fileSizeBytes: input.promptFileSizeBytes,
    previewMediaType: input.previewMediaType ?? PreviewMediaType.NONE,
    previewMediaPath: input.previewMediaPath ?? null,
    playgroundConfig,
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = `${slugify(input.title, { lower: true, strict: true })}-${crypto
      .randomUUID()
      .slice(0, 8)}`;
    try {
      const asset = await prisma.asset.create({ data: { ...data, slug } });
      return {
        id: asset.id,
        slug: asset.slug,
        onChainId: asset.onChainId,
        priceWei: asset.priceWei,
      };
    } catch (e) {
      const isSlugConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isSlugConflict || attempt === 1) throw e;
    }
  }
  throw new Error("Unreachable");
}

export async function publishAsset(assetId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset || asset.sellerId !== user.userId) {
    throw new Error("Asset not found");
  }
  if (asset.status === "PUBLISHED") return { status: "PUBLISHED" };

  // Verify the on-chain listing belongs to this wallet before flipping the
  // DB flag. Skipped when the contract address is not configured yet.
  const contractAddress = process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT_ADDRESS;
  if (contractAddress && process.env.SEPOLIA_RPC_URL) {
    const client = createPublicClient({
      chain: sepolia,
      transport: http(process.env.SEPOLIA_RPC_URL),
    });
    const seller = await client.readContract({
      address: contractAddress as `0x${string}`,
      abi: marketplaceAbi as Abi,
      functionName: "assetSeller",
      args: [BigInt(asset.onChainId)],
    });
    if (
      typeof seller !== "string" ||
      seller.toLowerCase() !== user.walletAddress
    ) {
      throw new Error("On-chain listing not confirmed for this wallet");
    }
  }

  await prisma.asset.update({
    where: { id: asset.id },
    data: { status: "PUBLISHED" },
  });
  return { status: "PUBLISHED" };
}
