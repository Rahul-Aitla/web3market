import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { assetId } = await params;
  const purchase = await prisma.purchase.findUnique({
    where: {
      buyerId_assetId: { buyerId: user.userId, assetId },
      status: "CONFIRMED",
    },
  });
  if (!purchase) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = await new SignJWT({
    assetId,
    walletAddress: user.walletAddress,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(new TextEncoder().encode(process.env.DOWNLOAD_TOKEN_SECRET!));

  return NextResponse.json({ downloadUrl: `/api/download/${token}` });
}
