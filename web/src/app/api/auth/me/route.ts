import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ walletAddress: null });
  }
  return NextResponse.json({
    walletAddress: user.walletAddress,
    userId: user.userId,
  });
}
