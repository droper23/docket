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
 */
export interface SnapshotStorage {
  load(): Promise<AcademicSnapshot>;
  save(snapshot: AcademicSnapshot): Promise<void>;
  reset(): Promise<void>;
}

/**
 * Local-first persistence: one JSON file on disk, written atomically
 * (write-to-temp, then rename) so a crash mid-write can never corrupt the
 * student's academic data — "stale is better than wrong"
 * (docs/ARCHITECTURE.md §Failure Philosophy).
 */
export class FileSnapshotStore implements SnapshotStorage {
  constructor(private readonly filePath: string) {}

  async load(): Promise<AcademicSnapshot> {
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

  async save(snapshot: AcademicSnapshot): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp-${process.pid}`;
    await writeFile(tmpPath, JSON.stringify(snapshot, null, 2), "utf-8");
    await rename(tmpPath, this.filePath);
  }

  async reset(): Promise<void> {
    await this.save(emptySnapshot());
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ENOENT";
}
