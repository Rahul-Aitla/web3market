import path from "node:path";
import fs from "node:fs";
import zlib from "node:zlib";
import { PrismaClient, Prisma } from "@prisma/client";
import { parseEther } from "viem";

const prisma = new PrismaClient();

const uploadsDir = path.resolve(
  process.cwd(),
  process.env.UPLOADS_DIR ?? "../uploads"
);
const repoRoot = path.resolve(process.cwd(), "..");

// Minimal PNG encoder — generates a real 320x200 vertical-gradient image.
function crc32(buf: Buffer): number {
  let c, table = (crc32 as any).table as number[] | undefined;
  if (!table) {
    table = (crc32 as any).table = [] as number[];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function makePng(top: [number, number, number], bottom: [number, number, number], w = 320, h = 200): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    const r = Math.round(top[0] + (bottom[0] - top[0]) * t);
    const g = Math.round(top[1] + (bottom[1] - top[1]) * t);
    const b = Math.round(top[2] + (bottom[2] - top[2]) * t);
    const row = y * (w * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < w; x++) {
      // subtle diagonal light streak for texture
      const streak = Math.max(0, 24 - Math.abs(x - y * 1.2) * 0.8);
      raw[row + 1 + x * 3] = Math.min(255, r + streak);
      raw[row + 2 + x * 3] = Math.min(255, g + streak);
      raw[row + 3 + x * 3] = Math.min(255, b + streak);
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const FILES: Record<string, string> = {
  "cold-email": `You are a world-class B2B copywriter. Write a cold outreach email for the
given prospect. Rules: 3 short paragraphs max, personalized first line, one
clear CTA (15-min call), no buzzwords, under 120 words. Output the email only.`,
  "sql-optimizer": `You are a senior database engineer. Given a SQL query:
1) Explain what it does in plain English.
2) Identify performance issues (missing indexes, N+1 patterns, scans).
3) Rewrite it optimized for PostgreSQL. Return concise markdown.`,
  "ts-reviewer": `You are a strict senior TypeScript reviewer. Review the pasted code for:
type safety gaps, async errors, hidden mutations, API contract drift.
Return findings ordered by severity (BLOCKER > MAJOR > MINOR), each with a
one-line fix. No praise, no fluff.`,
  "nextjs-scaffold": `Generate a production-ready Next.js App Router route handler for the
described endpoint. Include: zod input validation, typed response, error
mapping to HTTP codes, and JSDoc comments. TypeScript strict mode.`,
  "cursor-rules": `# .cursorrules - Clean TypeScript Architecture
- Never use \`any\`; prefer \`unknown\` + narrowing
- Server components by default; "use client" only at leaf nodes
- All DB access via src/lib/db.ts, never in components
- Errors: throw typed AppError, map at route boundary
- No default exports except pages/layouts
- Tests colocated: foo.ts -> foo.test.ts`,
  "mcp-config": `{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./src"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "\${GITHUB_TOKEN}" }
    }
  }
}`,
  "product-shot": `Professional product photography: matte black wireless headphones on a
pedestal, soft studio lighting, seamless light-gray background, subtle
reflection beneath, centered composition, 50mm lens, f/8, commercial quality,
no text or watermark.`,
  "cyberpunk": `Cyberpunk city diorama at night: neon-lit street market, holographic signs
in Japanese, rain-slicked pavement with pink/cyan reflections, volumetric fog,
cinematic wide shot, ultra-detailed, blade-runner aesthetic, no watermark.`,
  "aurora": `Northern lights over a frozen Norwegian fjord: ribbons of emerald and violet
aurora, mirror-still water reflection, snow-dusted peaks, starfield sky,
long-exposure look, 14mm wide angle, ethereal glow, no text.`,
  "archviz": `Minimalist concrete villa architectural render: cantilevered slabs, floor-to-
ceiling glass, warm interior glow at dusk, infinity pool reflection, photoreal
archviz style, 3ds-max quality, golden hour, no people, no watermark.`,
  "watercolor": `Delicate watercolor botanical illustration: eucalyptus branch with soft
color bleeds, wet-on-wet technique, paper texture visible, muted sage and dusty
rose palette, white background, hand-painted feel, no text.`,
  "logomark": `Minimal geometric logo mark for a fintech startup: abstract ascending arrow
formed from negative space, single warm amber accent on deep charcoal, flat
vector style, crisp edges, centered on plain background, no text.`,
  "isometric": `Isometric illustration of a cozy developer workspace: desk with dual
monitors, mechanical keyboard, coffee mug, plants, floating UI elements, soft
purple-blue palette, clean vector shading, game-asset quality, no text.`,
  "portrait": `Cinematic portrait photograph: weathered fisherman face in window light,
Rembrandt lighting, deep shadows, textured skin detail, 85mm f/1.4 bokeh,
moody teal-and-orange grade, editorial quality, no watermark.`,
};

async function main() {
  const sellerAddress = (process.env.SEED_SELLER_ADDRESS ?? "").toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(sellerAddress)) {
    throw new Error("SEED_SELLER_ADDRESS is not set or invalid");
  }

  fs.mkdirSync(path.join(uploadsDir, "private"), { recursive: true });
  fs.mkdirSync(path.join(uploadsDir, "preview"), { recursive: true });
  for (const [name, content] of Object.entries(FILES)) {
    fs.writeFileSync(path.join(uploadsDir, "private", `seed-${name}.txt`), content);
  }
  fs.writeFileSync(
    path.join(uploadsDir, "preview", "seed-product.png"),
    makePng([200, 200, 210], [60, 62, 80])
  );
  fs.writeFileSync(
    path.join(uploadsDir, "preview", "seed-cyberpunk.png"),
    makePng([255, 40, 140], [20, 10, 60])
  );
  const previews: [string, [number, number, number], [number, number, number]][] = [
    ["seed-aurora.png", [40, 220, 160], [10, 20, 60]],
    ["seed-archviz.png", [230, 215, 190], [90, 80, 70]],
    ["seed-watercolor.png", [180, 210, 200], [240, 235, 225]],
    ["seed-logomark.png", [30, 30, 34], [240, 160, 40]],
    ["seed-isometric.png", [140, 110, 240], [60, 40, 130]],
    ["seed-portrait.png", [200, 140, 80], [40, 30, 25]],
  ];
  for (const [name, top, bottom] of previews) {
    fs.writeFileSync(path.join(uploadsDir, "preview", name), makePng(top, bottom));
  }

  const seller = await prisma.user.upsert({
    where: { walletAddress: sellerAddress },
    update: {},
    create: { walletAddress: sellerAddress },
  });

  const F = (k: string) => ({
    fileStoragePath: `private/seed-${k}.txt`,
    fileType: "text/plain",
    fileSizeBytes: Buffer.byteLength(FILES[k]),
  });

  const seeds = [
    {
      slug: "seed-seo-blog-generator",
      title: "SEO Blog Post Generator",
      shortDesc: "Turns a topic into a 600-word SEO-ready blog post.",
      fullDesc: "A battle-tested text prompt that generates structured, SEO-friendly blog posts. Includes a live playground - try it before buying.",
      category: "TEXT_PROMPT" as const,
      priceWei: parseEther("0.001").toString(),
      fileStoragePath: "private/seed-text-prompt.txt",
      fileType: "text/plain",
      fileSizeBytes: 238,
      previewMediaType: "NONE" as const,
      previewMediaPath: null,
      playgroundConfig: {
        inputs: [{ name: "topic", label: "Blog topic" }],
        systemPrompt: `You are an expert SEO copywriter. Write a 600-word blog post about the given topic. Use short paragraphs, one H2 per section, and end with a call to action. Tone: confident, plain language.`,
      },
    },
    {
      slug: "seed-cold-email",
      title: "B2B Cold Email Writer",
      shortDesc: "Personalized cold outreach emails that get replies.",
      fullDesc: "Generates tight, personalized B2B outreach emails with a proven 3-paragraph structure. Live playground included.",
      category: "TEXT_PROMPT" as const,
      priceWei: parseEther("0.0008").toString(),
      ...F("cold-email"),
      previewMediaType: "NONE" as const,
      previewMediaPath: null,
      playgroundConfig: {
        inputs: [
          { name: "prospect", label: "Prospect (name, role, company)" },
          { name: "offer", label: "What you offer" },
        ],
        systemPrompt: FILES["cold-email"],
      },
    },
    {
      slug: "seed-sql-optimizer",
      title: "SQL Query Optimizer",
      shortDesc: "Explains and rewrites slow PostgreSQL queries.",
      fullDesc: "Paste any query - get a plain-English explanation, bottleneck analysis, and an optimized rewrite. Playground enabled.",
      category: "CODE_DEV_PROMPT" as const,
      priceWei: parseEther("0.0015").toString(),
      ...F("sql-optimizer"),
      previewMediaType: "NONE" as const,
      previewMediaPath: null,
      playgroundConfig: {
        inputs: [{ name: "query", label: "SQL query to analyze" }],
        systemPrompt: FILES["sql-optimizer"],
      },
    },
    {
      slug: "seed-ts-reviewer",
      title: "Senior TypeScript Reviewer",
      shortDesc: "Brutal, actionable code review as a system prompt.",
      fullDesc: "A system prompt that turns any LLM into a strict senior reviewer - severity-ranked findings with one-line fixes. Try it live.",
      category: "SYSTEM_PROMPT" as const,
      priceWei: parseEther("0.0012").toString(),
      ...F("ts-reviewer"),
      previewMediaType: "NONE" as const,
      previewMediaPath: null,
      playgroundConfig: {
        inputs: [{ name: "code", label: "Paste code to review" }],
        systemPrompt: FILES["ts-reviewer"],
      },
    },
    {
      slug: "seed-nextjs-scaffold",
      title: "Next.js Route Scaffolder",
      shortDesc: "Production-grade route handlers from a spec.",
      fullDesc: "Describe an endpoint; get a validated, typed, error-mapped App Router handler. Code-dev prompt with live playground.",
      category: "CODE_DEV_PROMPT" as const,
      priceWei: parseEther("0.001").toString(),
      ...F("nextjs-scaffold"),
      previewMediaType: "NONE" as const,
      previewMediaPath: null,
      playgroundConfig: {
        inputs: [{ name: "endpoint", label: "Describe the endpoint" }],
        systemPrompt: FILES["nextjs-scaffold"],
      },
    },
    {
      slug: "seed-cursor-rules",
      title: "cursorrules - Clean TS Architecture",
      shortDesc: "Drop-in Cursor rules for strict TypeScript projects.",
      fullDesc: "A curated .cursorrules file enforcing clean architecture: no any, server-first components, typed errors, colocated tests.",
      category: "CURSOR_RULES" as const,
      priceWei: parseEther("0.0005").toString(),
      ...F("cursor-rules"),
      previewMediaType: "NONE" as const,
      previewMediaPath: null,
      playgroundConfig: Prisma.JsonNull,
    },
    {
      slug: "seed-mcp-config",
      title: "MCP Server Config Pack",
      shortDesc: "Ready mcp.json for filesystem + GitHub tools.",
      fullDesc: "A working MCP servers config - filesystem scoping and GitHub integration with env-var auth. Copy, paste, run.",
      category: "MCP_SERVER" as const,
      priceWei: parseEther("0.0005").toString(),
      ...F("mcp-config"),
      previewMediaType: "NONE" as const,
      previewMediaPath: null,
      playgroundConfig: Prisma.JsonNull,
    },
    {
      slug: "seed-product-shot",
      title: "Studio Product Shot Prompt",
      shortDesc: "Commercial-grade product photography prompt.",
      fullDesc: "Image prompt tuned for catalog-quality studio product shots - lighting, lens, and composition specs included. Preview shows sample output.",
      category: "IMAGE_PROMPT" as const,
      priceWei: parseEther("0.002").toString(),
      ...F("product-shot"),
      previewMediaType: "IMAGE" as const,
      previewMediaPath: "preview/seed-product.png",
      playgroundConfig: Prisma.JsonNull,
    },
    {
      slug: "seed-cyberpunk",
      title: "Cyberpunk City Diorama",
      shortDesc: "Neon-noir cinematic cityscape for image models.",
      fullDesc: "A richly parameterized image prompt producing blade-runner street scenes with rain, neon, and volumetric fog. Preview shows sample output.",
      category: "IMAGE_PROMPT" as const,
      priceWei: parseEther("0.0025").toString(),
      ...F("cyberpunk"),
      previewMediaType: "IMAGE" as const,
      previewMediaPath: "preview/seed-cyberpunk.png",
      playgroundConfig: Prisma.JsonNull,
    },
    {
      slug: "seed-aurora",
      title: "Aurora Fjord Landscape",
      shortDesc: "Northern-lights long exposure for photo models.",
      fullDesc: "Prompt tuned for ethereal aurora scenes - palette, lens, and atmosphere parameters dialed in. Preview shows sample output.",
      category: "IMAGE_PROMPT" as const,
      priceWei: parseEther("0.002").toString(),
      ...F("aurora"),
      previewMediaType: "IMAGE" as const,
      previewMediaPath: "preview/seed-aurora.png",
      playgroundConfig: Prisma.JsonNull,
    },
    {
      slug: "seed-archviz",
      title: "Minimal Villa Archviz",
      shortDesc: "Photoreal architecture render prompt.",
      fullDesc: "Archviz-quality prompt for minimalist concrete villas at dusk - glass, glow, and reflections. Preview shows sample output.",
      category: "IMAGE_PROMPT" as const,
      priceWei: parseEther("0.002").toString(),
      ...F("archviz"),
      previewMediaType: "IMAGE" as const,
      previewMediaPath: "preview/seed-archviz.png",
      playgroundConfig: Prisma.JsonNull,
    },
    {
      slug: "seed-watercolor",
      title: "Watercolor Botanicals",
      shortDesc: "Soft hand-painted botanical illustrations.",
      fullDesc: "Image prompt for delicate wet-on-wet watercolor florals with visible paper texture. Preview shows sample output.",
      category: "IMAGE_PROMPT" as const,
      priceWei: parseEther("0.0015").toString(),
      ...F("watercolor"),
      previewMediaType: "IMAGE" as const,
      previewMediaPath: "preview/seed-watercolor.png",
      playgroundConfig: Prisma.JsonNull,
    },
    {
      slug: "seed-logomark",
      title: "Minimal Logo Mark Generator",
      shortDesc: "Flat geometric logo prompts for brand work.",
      fullDesc: "Prompt for crisp negative-space logo marks - flat vector look, single accent color. Preview shows sample output.",
      category: "IMAGE_PROMPT" as const,
      priceWei: parseEther("0.0015").toString(),
      ...F("logomark"),
      previewMediaType: "IMAGE" as const,
      previewMediaPath: "preview/seed-logomark.png",
      playgroundConfig: Prisma.JsonNull,
    },
    {
      slug: "seed-isometric",
      title: "Isometric Workspace Art",
      shortDesc: "Clean isometric illustration prompt.",
      fullDesc: "Cozy isometric dev-desk illustrations with floating UI - game-asset quality vector shading. Preview shows sample output.",
      category: "IMAGE_PROMPT" as const,
      priceWei: parseEther("0.0018").toString(),
      ...F("isometric"),
      previewMediaType: "IMAGE" as const,
      previewMediaPath: "preview/seed-isometric.png",
      playgroundConfig: Prisma.JsonNull,
    },
    {
      slug: "seed-portrait",
      title: "Cinematic Portrait Prompt",
      shortDesc: "Rembrandt-lit editorial portrait prompt.",
      fullDesc: "Prompt for moody window-lit portraits with textured detail and teal-orange grade. Preview shows sample output.",
      category: "IMAGE_PROMPT" as const,
      priceWei: parseEther("0.002").toString(),
      ...F("portrait"),
      previewMediaType: "IMAGE" as const,
      previewMediaPath: "preview/seed-portrait.png",
      playgroundConfig: Prisma.JsonNull,
    },
  ];

  // Keep legacy files used by the original two seed rows if they persist.
  fs.writeFileSync(
    path.join(uploadsDir, "private", "seed-text-prompt.txt"),
    "You are an expert SEO copywriter. Write a 600-word blog post about the given topic. Use short paragraphs, one H2 per section, and end with a call to action. Tone: confident, plain language."
  );
  fs.writeFileSync(
    path.join(uploadsDir, "private", "seed-image-prompt.txt"),
    "Photorealistic macro shot of a dewdrop on a green leaf at sunrise, shallow depth of field, 85mm lens, golden hour lighting, high detail, no text or watermark."
  );
  fs.writeFileSync(
    path.join(uploadsDir, "preview", "seed-sample.png"),
    makePng([120, 180, 120], [20, 50, 30])
  );

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
