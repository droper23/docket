import { Redis } from "@upstash/redis";
import type { SnapshotStorage } from "./store.js";
import type { AcademicSnapshot } from "./types.js";
import { emptySnapshot } from "./types.js";

const SNAPSHOT_KEY = "docket:snapshot";

/**
 * Cloud persistence for a deployed Docket instance — see
 * docs/ARCHITECTURE.md §12. Same one-blob-of-JSON shape as
 * `FileSnapshotStore`; only where it lives differs, which is exactly the
 * point of the `SnapshotStorage` interface. Upstash's REST client
 * JSON-encodes/decodes object values automatically — no manual
 * `JSON.stringify`/`parse` needed here, unlike the file store (which needs
 * it because `fs` only ever deals in bytes).
 */
export class RedisSnapshotStore implements SnapshotStorage {
  private readonly redis: Redis;

  constructor() {
    this.redis = Redis.fromEnv();
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
