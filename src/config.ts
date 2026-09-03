import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { KnownCourse } from "./connectors/icsConnector.js";
import { icalFeedUrl } from "./connectors/icsConnector.js";
import { FileSnapshotStore } from "./core/store.js";
import type { SnapshotStorage } from "./core/store.js";

// Resolved against the working directory (npm scripts always run from the
// project root) rather than import.meta.url — the compiled output lives
// under dist/src/, one level deeper than source, and data/ is never copied
// into dist, so a URL relative to this file's own location would silently
// point at a nonexistent dist/data/ directory.
export const DATA_DIR = resolve(process.cwd(), "data") + "/";
export const SNAPSHOT_PATH = `${DATA_DIR}snapshot.json`;
export const COURSES_CONFIG_PATH = `${DATA_DIR}courses.config.json`;

const COURSES_KEY = "docket:courses";

/**
 * True when a Redis store is provisioned (deployed to Vercel with the
 * Upstash Marketplace integration — see docs/ARCHITECTURE.md §12). Local
 * dev/demo runs without it, using plain files, no external account needed.
 * Everything above `config.ts` is unaware of which mode is active — that's
 * the point of `SnapshotStorage` (`src/core/store.ts`).
 */
export function isCloudMode(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL;
}

let cachedStore: SnapshotStorage | undefined;

export async function getSnapshotStore(): Promise<SnapshotStorage> {
  if (cachedStore) return cachedStore;
  if (isCloudMode()) {
    const { RedisSnapshotStore } = await import("./core/redisStore.js");
    cachedStore = new RedisSnapshotStore();
  } else {
    cachedStore = new FileSnapshotStore(SNAPSHOT_PATH);
  }
  return cachedStore;
}

/**
 * The user's real course list + per-course ICS feed URLs, added during
 * onboarding (docs/ROADMAP.md Phase 1/2). Never fabricated — Docket never
 * guesses a LearningSuite courseID (see docs/ARCHITECTURE.md §1.4 privacy
 * note: the ICS endpoint has no auth, so only ever fetch courses the user
 * told us they're enrolled in).
 */
export async function loadKnownCourses(): Promise<KnownCourse[]> {
  if (isCloudMode()) {
    const { Redis } = await import("@upstash/redis");
    const data = await Redis.fromEnv().get<KnownCourse[]>(COURSES_KEY);
    return data ?? [];
  }
  try {
    const raw = await readFile(COURSES_CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as KnownCourse[];
  } catch {
    return [];
  }
}

export interface DiscoveredCourse {
  courseId: string;
  code: string;
  title: string;
  term?: string | null;
}

/**
 * Writes the course list discovered by the "Connect LearningSuite"
 * bookmarklet (docs/ARCHITECTURE.md §8) — replaces the list wholesale,
 * since this is meant to always reflect current enrollment rather than
 * accumulate stale semesters. Never guesses an ICS URL from anything but
 * LearningSuite's own confirmed pattern.
 */
export async function saveDiscoveredCourses(discovered: DiscoveredCourse[]): Promise<KnownCourse[]> {
  const known: KnownCourse[] = discovered.map((c) => ({
    courseId: c.courseId,
    code: c.code,
    title: c.title,
    term: c.term ?? undefined,
    icsUrl: icalFeedUrl(c.courseId),
  }));

  if (isCloudMode()) {
    const { Redis } = await import("@upstash/redis");
    await Redis.fromEnv().set(COURSES_KEY, known);
    return known;
  }

  await mkdir(dirname(COURSES_CONFIG_PATH), { recursive: true });
  await writeFile(COURSES_CONFIG_PATH, JSON.stringify(known, null, 2), "utf-8");
  return known;
}
