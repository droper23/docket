import { Redis } from "@upstash/redis";
import type { SnapshotStorage } from "./store.js";
import type { AcademicSnapshot } from "./types.js";
import { emptySnapshot } from "./types.js";

const SNAPSHOT_KEY = "docket:snapshot";

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

  async load(): Promise<AcademicSnapshot> {
    const data = await this.redis.get<AcademicSnapshot>(SNAPSHOT_KEY);
    return data ?? emptySnapshot();
  }

  async save(snapshot: AcademicSnapshot): Promise<void> {
    await this.redis.set(SNAPSHOT_KEY, snapshot);
  }

  async reset(): Promise<void> {
    await this.redis.del(SNAPSHOT_KEY);
  }
}
