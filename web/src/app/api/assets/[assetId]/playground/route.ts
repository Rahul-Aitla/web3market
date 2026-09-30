import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { isPlaygroundEligible } from "@/lib/categories";

type PlaygroundConfig = {
  inputs?: { name: string; label: string }[];
  systemPrompt?: string;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const user = await getSessionUser();
  const key = user ? `pg:${user.userId}` : `pg:ip:${clientKey(request)}`;
  if (!(await rateLimit(key, 5, 60))) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const { assetId } = await params;
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { category: true, playgroundConfig: true, status: true },
  });
  if (!asset || asset.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isPlaygroundEligible(asset.category)) {
    return NextResponse.json(
      { error: "This asset has no playground" },
      { status: 400 }
    );
  }

  let body: { values?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const values = body.values ?? {};

  // playgroundConfig is read here, inside the handler only - never passed
  // through props, never logged, never returned in any response.
  const config = (asset.playgroundConfig ?? {}) as PlaygroundConfig;
  const userContent = (config.inputs ?? [])
    .map((i) => `${i.name} (${i.label}): ${values[i.name] ?? ""}`)
    .join("\n");

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      max_tokens: 512,
      messages: [
        { role: "system", content: config.systemPrompt ?? "" },
        { role: "user", content: userContent },
      ],
    });
    return NextResponse.json({
      output: completion.choices[0]?.message?.content ?? "",
    });
  } catch (e) {
    console.error(
      "Groq call failed:",
      e instanceof Error ? e.message : "unknown"
    );
    return NextResponse.json(
      { error: "Model unavailable, try again" },
      { status: 502 }
    );
  }
}
