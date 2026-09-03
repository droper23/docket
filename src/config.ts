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

/**
 * The implicit user identity for every self-deployed, single-tenant
 * instance (the project's original and still-default deployment model —
 * one deployment, one student, no login). Every storage call in that mode
 * passes this constant, which `RedisSnapshotStore`/course-list storage
 * deliberately map back onto the exact unsuffixed legacy Redis keys
 * (`docket:snapshot`, `docket:courses`) a production deployment already has
 * real data under — see `src/core/redisStore.ts`.
 */
export const DEFAULT_USER_ID = "default";

/**
 * True when this deployment is a shared, multi-student hosted instance —
 * see docs/ARCHITECTURE.md §14. Purely additive: a self-deployed instance
 * with no Google OAuth credentials set behaves exactly as before (no login,
 * everything scoped to `DEFAULT_USER_ID`). Checking for both env vars
 * (rather than, say, a separate `MULTI_TENANT=true` flag) means multi-tenant
 * mode can never accidentally turn on half-configured — either both the
 * client id and secret are present, or the deployment is single-tenant.
 */
export function isMultiTenantMode(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

/**
 * True when a Redis store is provisioned (deployed to Vercel with the
 * Upstash Marketplace integration — see docs/ARCHITECTURE.md §9). Local
 * dev/demo runs without it, using plain files, no external account needed.
 * Everything above `config.ts` is unaware of which mode is active — that's
 * the point of `SnapshotStorage` (`src/core/store.ts`). Checks
 * `KV_REST_API_URL` specifically — the actual variable name the
 * `upstash-kv` Marketplace integration provisions (confirmed live), not
 * the `UPSTASH_REDIS_REST_URL` name `@upstash/redis`'s own `fromEnv()`
 * looks for by default — see `src/core/redisStore.ts`'s `getRedisClient()`.
 */
export function isCloudMode(): boolean {
  return !!process.env.KV_REST_API_URL;
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
 * Same legacy-key-preservation reasoning as `snapshotKey()` in
 * `src/core/redisStore.ts`: `DEFAULT_USER_ID` maps onto the exact
 * unsuffixed `docket:courses` key a single-tenant deployment already has
 * real data under; only a real multi-tenant userId gets a suffix.
 */
function coursesKey(userId: string): string {
  return userId === DEFAULT_USER_ID ? "docket:courses" : `docket:courses:${userId}`;
}

/**
 * The user's real course list + per-course ICS feed URLs, added during
 * onboarding (docs/ROADMAP.md Phase 1/2). Never fabricated — Docket never
 * guesses a LearningSuite courseID (see docs/ARCHITECTURE.md §1.4 privacy
 * note: the ICS endpoint has no auth, so only ever fetch courses the user
 * told us they're enrolled in).
 */
export async function loadKnownCourses(userId: string): Promise<KnownCourse[]> {
  if (isCloudMode()) {
    const { getRedisClient } = await import("./core/redisStore.js");
    const data = await getRedisClient().get<KnownCourse[]>(coursesKey(userId));
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
export async function saveDiscoveredCourses(userId: string, discovered: DiscoveredCourse[]): Promise<KnownCourse[]> {
  const known: KnownCourse[] = discovered.map((c) => ({
    courseId: c.courseId,
    code: c.code,
    title: c.title,
    term: c.term ?? undefined,
    icsUrl: icalFeedUrl(c.courseId),
  }));

  if (isCloudMode()) {
    const { getRedisClient } = await import("./core/redisStore.js");
    await getRedisClient().set(coursesKey(userId), known);
    return known;
  }

  await mkdir(dirname(COURSES_CONFIG_PATH), { recursive: true });
  await writeFile(COURSES_CONFIG_PATH, JSON.stringify(known, null, 2), "utf-8");
  return known;
}
