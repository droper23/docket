import { Redis } from "@upstash/redis";
import { DEFAULT_USER_ID } from "../config.js";
import type { SnapshotStorage } from "./store.js";
import type { AcademicSnapshot } from "./types.js";
import { emptySnapshot } from "./types.js";

/**
 * Per-user key builders, not fixed constants — multi-tenant mode
 * (docs/ARCHITECTURE.md §14) needs one snapshot/course-list per student in
 * the same Redis database. Deliberately preserves the exact legacy key
 * (`docket:snapshot`, no suffix) for `DEFAULT_USER_ID` specifically — a
 * real production deployment already has real data sitting under that
 * literal key from before multi-tenancy existed; using a suffixed key for
 * the default user too would silently orphan it. Only a real (non-default)
 * userId gets the `:<userId>` suffix.
 */
function snapshotKey(userId: string): string {
  return userId === DEFAULT_USER_ID ? "docket:snapshot" : `docket:snapshot:${userId}`;
}

/** Tracks every userId that has ever saved a snapshot, so cron (`api/cron/sync.js`) can enumerate all users in multi-tenant mode without a separate index table. */
const USERS_SET_KEY = "docket:users";

/**
 * Builds the Redis client from this specific integration's env var names.
 * `Redis.fromEnv()` looks for `UPSTASH_REDIS_REST_URL`/`_TOKEN` — but the
 * Vercel Marketplace's "Upstash for Redis" integration (`upstash-kv`)
 * provisions `KV_REST_API_URL`/`KV_REST_API_TOKEN` instead (legacy
 * `@vercel/kv`-compatible naming, confirmed live after provisioning —
 * `.fromEnv()` would silently find nothing). `isCloudMode()`
 * (`src/config.ts`) checks the same variable for consistency.
 */
export function getRedisClient(): Redis {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("KV_REST_API_URL / KV_REST_API_TOKEN are not set — is the Upstash integration connected to this project?");
  }
  return new Redis({ url, token });
}

/**
 * Cloud persistence for a deployed Docket instance — see
 * docs/ARCHITECTURE.md §9. Same one-blob-of-JSON shape as
 * `FileSnapshotStore`; only where it lives differs, which is exactly the
 * point of the `SnapshotStorage` interface. Upstash's REST client
 * JSON-encodes/decodes object values automatically — no manual
 * `JSON.stringify`/`parse` needed here, unlike the file store (which needs
 * it because `fs` only ever deals in bytes).
 */
export class RedisSnapshotStore implements SnapshotStorage {
  private readonly redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  async load(userId: string): Promise<AcademicSnapshot> {
    const data = await this.redis.get<AcademicSnapshot>(snapshotKey(userId));
    return data ?? emptySnapshot();
  }

  async save(userId: string, snapshot: AcademicSnapshot): Promise<void> {
    await this.redis.set(snapshotKey(userId), snapshot);
  }

  async reset(userId: string): Promise<void> {
    await this.redis.del(snapshotKey(userId));
  }
}

/** Registers a real (multi-tenant) userId as enumerable for cron — called once, from `src/server/auth.ts`, when a user's Docket account is first created. Never called with `DEFAULT_USER_ID`. */
export async function registerUser(userId: string): Promise<void> {
  await getRedisClient().sadd(USERS_SET_KEY, userId);
}

/** All registered multi-tenant userIds — used by `api/cron/sync.js` to iterate every student. Never includes `DEFAULT_USER_ID` (that path doesn't use this set at all). */
export async function listAllUserIds(): Promise<string[]> {
  return getRedisClient().smembers(USERS_SET_KEY);
}
