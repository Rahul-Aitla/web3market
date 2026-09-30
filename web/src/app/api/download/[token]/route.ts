import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { jwtVerify } from "jose";
import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { resolvedUploadsDir } from "@/lib/uploads";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let payload: { assetId?: string; walletAddress?: string };
  try {
    const { payload: p } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.DOWNLOAD_TOKEN_SECRET!)
    );
    payload = p as { assetId?: string; walletAddress?: string };
  } catch {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }
  if (!payload.assetId || !payload.walletAddress) {
    return NextResponse.json({ error: "Invalid link" }, { status: 403 });
  }

  // Re-check that a CONFIRMED purchase still exists for this pair.
  const buyer = await prisma.user.findUnique({
    where: { walletAddress: payload.walletAddress },
    select: { id: true },
  });
  const purchase = buyer
    ? await prisma.purchase.findUnique({
        where: {
          buyerId_assetId: { buyerId: buyer.id, assetId: payload.assetId },
          status: "CONFIRMED",
        },
      })
    : null;
  if (!purchase) {
    return NextResponse.json({ error: "Not found" }, { status: 403 });
  }

  const asset = await prisma.asset.findUnique({
    where: { id: payload.assetId },
    select: { title: true, fileType: true, fileStoragePath: true },
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = path.resolve(
    resolvedUploadsDir(),
    "private",
    path.basename(asset.fileStoragePath)
  );
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1);
  const filename = `${slugify(asset.title, { lower: true, strict: true }) || "download"}.${ext}`;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": asset.fileType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}
