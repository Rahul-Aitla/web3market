import { NextResponse } from "next/server";
import { generateNonce } from "siwe";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const allowed = await rateLimit(`nonce:${clientKey(request)}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }
  const nonce = generateNonce();
  const res = NextResponse.json({ nonce });
  res.cookies.set("siwe_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
