import { getRedisClient } from "./redisStore.js";

/**
 * Fixed-window rate limiter, backed by the same Redis instance everything
 * else uses — no new dependency, matching this project's existing
 * "hand-roll a small, correct thing instead of pulling in a library" bias
 * (see `icsParser.ts`). Guards against a leaked/guessed bookmarklet token,
 * or the auth callback route, being hammered — not a general-purpose
 * abuse-prevention system, just enough to make the obvious attacks cost
 * more than they're worth.
 *
 * Fixed windows (not sliding) are a deliberate simplification: a burst
 * right at a window boundary can momentarily allow up to ~2x `limit` — an
 * acceptable, well-understood tradeoff for this project's scale, not worth
 * the extra complexity of a sliding-window or token-bucket algorithm.
 */
export async function checkRateLimit(bucket: string, key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number }> {
  const windowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
  const redisKey = `docket:ratelimit:${bucket}:${key}:${windowIndex}`;
  const redis = getRedisClient();
  const count = await redis.incr(redisKey);
  if (count === 1) {
    // Only the request that actually created this window's counter sets its
    // expiry — avoids resetting the TTL on every subsequent increment.
    await redis.expire(redisKey, windowSeconds);
  }
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
