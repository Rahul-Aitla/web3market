import path from "node:path";
import fs from "node:fs";
import { PrismaClient, Prisma } from "@prisma/client";
import { parseEther } from "viem";

const prisma = new PrismaClient();

const uploadsDir = path.resolve(
  process.cwd(),
  process.env.UPLOADS_DIR ?? "../uploads"
);
const repoRoot = path.resolve(process.cwd(), "..");

// 1x1 transparent PNG
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const TEXT_PROMPT_CONTENT = `You are an expert SEO copywriter. Write a 600-word
blog post about the given topic. Use short paragraphs, one H2 per section,
and end with a call to action. Tone: confident, plain language.`;

const IMAGE_PROMPT_CONTENT = `Photorealistic macro shot of a dewdrop on a green
leaf at sunrise, shallow depth of field, 85mm lens, golden hour lighting,
high detail, no text or watermark.`;

async function main() {
  const sellerAddress = (process.env.SEED_SELLER_ADDRESS ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(sellerAddress)) {
    throw new Error(
      "SEED_SELLER_ADDRESS is not set or invalid (must be the deployer wallet, lowercase ok)"
    );
  }

  fs.mkdirSync(path.join(uploadsDir, "private"), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, "preview"), { recursive: true });
  fs.writeFileSync(
    path.join(uploadsDir, "private", "seed-text-prompt.txt"),
    TEXT_PROMPT_CONTENT
  );
  fs.writeFileSync(
    path.join(uploadsDir, "private", "seed-image-prompt.txt"),
    IMAGE_PROMPT_CONTENT
  );
  fs.writeFileSync(
    path.join(uploadsDir, "preview", "seed-sample.png"),
    Buffer.from(PNG_B64, "base64")
  );

  const seller = await prisma.user.upsert({
    where: { walletAddress: sellerAddress },
    update: {},
    create: { walletAddress: sellerAddress },
  });

  const seeds = [
    {
      slug: "seed-seo-blog-generator",
      title: "SEO Blog Post Generator",
      shortDesc: "Turns a topic into a 600-word SEO-ready blog post.",
      fullDesc:
        "A battle-tested text prompt that generates structured, SEO-friendly blog posts. Includes a live playground - try it before buying.",
      category: "TEXT_PROMPT" as const,
      priceWei: parseEther("0.001").toString(),
      fileStoragePath: "private/seed-text-prompt.txt",
      fileType: "text/plain",
      fileSizeBytes: Buffer.byteLength(TEXT_PROMPT_CONTENT),
      previewMediaType: "NONE" as const,
      previewMediaPath: null,
      playgroundConfig: {
        inputs: [{ name: "topic", label: "Blog topic" }],
        systemPrompt: TEXT_PROMPT_CONTENT,
      },
    },
    {
      slug: "seed-macro-dewdrop",
      title: "Macro Dewdrop Photo Prompt",
      shortDesc: "Photorealistic macro nature shot for image models.",
      fullDesc:
        "An image-generation prompt producing sharp macro photography results. Preview shows a sample output.",
      category: "IMAGE_PROMPT" as const,
      priceWei: parseEther("0.002").toString(),
      fileStoragePath: "private/seed-image-prompt.txt",
      fileType: "text/plain",
      fileSizeBytes: Buffer.byteLength(IMAGE_PROMPT_CONTENT),
      previewMediaType: "IMAGE" as const,
      previewMediaPath: "preview/seed-sample.png",
      playgroundConfig: Prisma.JsonNull,
    },
  ];

  const out: { onChainId: number; priceWei: string }[] = [];
  for (const s of seeds) {
    const asset = await prisma.asset.upsert({
      where: { slug: s.slug },
      update: {},
      create: { ...s, sellerId: seller.id, status: "PUBLISHED" },
    });
    out.push({ onChainId: asset.onChainId, priceWei: asset.priceWei });
    console.log(`seeded "${asset.title}" onChainId=${asset.onChainId}`);
  }

  const seedDir = path.join(repoRoot, "seed");
  fs.mkdirSync(seedDir, { recursive: true });
  fs.writeFileSync(
    path.join(seedDir, "seed-assets.json"),
    JSON.stringify(out, null, 2) + "\n"
  );
  console.log(`wrote ${path.join(seedDir, "seed-assets.json")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
