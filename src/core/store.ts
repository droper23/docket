import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AcademicSnapshot } from "./types.js";
import { emptySnapshot } from "./types.js";

/**
 * Local-first persistence: one JSON file on disk, written atomically
 * (write-to-temp, then rename) so a crash mid-write can never corrupt the
 * student's academic data — "stale is better than wrong"
 * (docs/ARCHITECTURE.md §Failure Philosophy).
 *
 * A single JSON file is deliberately simple for a single-user local tool.
 * If/when this needs to back a native app too, this class is the only
 * place that would change — everything else depends on AcademicSnapshot,
 * not on how it's stored.
 */
export class SnapshotStore {
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
