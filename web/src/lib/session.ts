import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export type SessionUser = { userId: string; walletAddress: string };

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const secret = process.env.SESSION_JWT_SECRET;
    if (!secret) return null;
    const store = await cookies();
    const token = store.get("session")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    if (!payload.sub || typeof payload.walletAddress !== "string") return null;
    return { userId: payload.sub, walletAddress: payload.walletAddress };
  } catch {
    return null;
  }
}
