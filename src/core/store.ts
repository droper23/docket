import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AcademicSnapshot } from "./types.js";
import { emptySnapshot } from "./types.js";

/**
 * Storage contract the rest of the app depends on — not how or where the
 * snapshot actually lives. Two implementations exist: `FileSnapshotStore`
 * (local dev/demo, no external account needed) and `RedisSnapshotStore`
 * (`src/core/redisStore.ts`, used when deployed — see docs/ARCHITECTURE.md
 * §9 for why a single local JSON file can't satisfy "reachable from my
 * phone without my laptop being on"). `src/config.ts`'s `getSnapshotStore()`
 * picks between them based on environment; nothing else needs to know
 * which one is active.
 *
 * Every method takes a `userId` — added for multi-tenant hosted mode
 * (docs/ARCHITECTURE.md §14), where one deployment serves many students'
 * isolated data. `FileSnapshotStore` (local, single-user by design) ignores
 * the value entirely; `RedisSnapshotStore` uses it to key which student's
 * blob is being read/written. In single-tenant mode (self-deployed, no
 * Google OAuth env vars) every caller passes the same `DEFAULT_USER_ID`
 * constant (`src/config.ts`), so this is one code path either way, not two.
 */
export interface SnapshotStorage {
  load(userId: string): Promise<AcademicSnapshot>;
  save(userId: string, snapshot: AcademicSnapshot): Promise<void>;
  reset(userId: string): Promise<void>;
}

/**
 * Local-first persistence: one JSON file on disk, written atomically
 * (write-to-temp, then rename) so a crash mid-write can never corrupt the
 * student's academic data — "stale is better than wrong"
 * (docs/ARCHITECTURE.md §Failure Philosophy). Deliberately single-user:
 * `userId` is accepted (to satisfy `SnapshotStorage`) but ignored — local
 * mode is the personal-machine dev/demo path, not the multi-tenant one.
 */
export class FileSnapshotStore implements SnapshotStorage {
  constructor(private readonly filePath: string) {}

  async load(_userId: string): Promise<AcademicSnapshot> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as AcademicSnapshot;
    } catch (err: unknown) {
      if (isNotFound(err)) {
        return emptySnapshot();
      }
      // A corrupted file must never silently reset the user's data.
      throw new Error(
        `Local data store at ${this.filePath} could not be read and was not simply "missing". Refusing to overwrite it. Original error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async save(_userId: string, snapshot: AcademicSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp-${process.pid}`;
    await writeFile(tmpPath, JSON.stringify(snapshot, null, 2), "utf-8");
    await rename(tmpPath, this.filePath);
  }

  async reset(userId: string): Promise<void> {
    await this.save(userId, emptySnapshot());
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ENOENT";
}
