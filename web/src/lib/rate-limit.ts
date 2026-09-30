import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Uses Upstash Redis when configured; falls back to an in-memory sliding
// window for local dev without Upstash. The fallback is per-process, which is
// fine for a localhost demo but not for multi-instance deployments.
const upstash =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

const buckets = new Map<string, number[]>();

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  if (upstash) {
    const rl = new Ratelimit({
      redis: upstash,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
    });
    return (await rl.limit(key)).success;
  }
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

export function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "local-dev";
}
