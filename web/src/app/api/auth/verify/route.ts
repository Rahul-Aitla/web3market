import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SiweMessage, generateNonce } from "siwe";
import { SignJWT } from "jose";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientKey } from "@/lib/rate-limit";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export async function POST(request: Request) {
  const allowed = await rateLimit(`verify:${clientKey(request)}`, 10, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const cookieStore = await cookies();
  const cookieNonce = cookieStore.get("siwe_nonce")?.value;
  if (!cookieNonce) {
    return NextResponse.json({ error: "Missing nonce" }, { status: 400 });
  }

  let body: { message?: string; signature?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!body.message || !body.signature) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let siweMessage: SiweMessage;
  try {
    siweMessage = new SiweMessage(body.message);
  } catch {
    return NextResponse.json({ error: "Invalid SIWE message" }, { status: 401 });
  }

  const expectedHost =
    process.env.APP_DOMAIN || request.headers.get("host") || "";

  try {
    const result = await siweMessage.verify({
      signature: body.signature,
      nonce: cookieNonce,
      domain: expectedHost,
      time: new Date().toISOString(),
    });
    if (!result.success) {
      return NextResponse.json({ error: "Verification failed" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 401 });
  }

  if (siweMessage.chainId !== 11155111) {
    return NextResponse.json({ error: "Wrong chain" }, { status: 401 });
  }
  if (
    siweMessage.expirationTime &&
    new Date(siweMessage.expirationTime).getTime() < Date.now()
  ) {
    return NextResponse.json({ error: "Message expired" }, { status: 401 });
  }

  const walletAddress = siweMessage.address.toLowerCase();

  let user;
  try {
    user = await prisma.user.upsert({
      where: { walletAddress },
      update: { nonce: generateNonce() },
      create: { walletAddress, nonce: generateNonce() },
    });
  } catch {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 }
    );
  }

  const token = await new SignJWT({ walletAddress })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(process.env.SESSION_JWT_SECRET!));

  const res = NextResponse.json({ walletAddress, userId: user.id });
  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  res.cookies.set("siwe_nonce", "", { path: "/", maxAge: 0 });
  return res;
}
