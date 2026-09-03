import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { KnownCourse } from "./connectors/icsConnector.js";

// Resolved against the working directory (npm scripts always run from the
// project root) rather than import.meta.url — the compiled output lives
// under dist/src/, one level deeper than source, and data/ is never copied
// into dist, so a URL relative to this file's own location would silently
// point at a nonexistent dist/data/ directory.
export const DATA_DIR = resolve(process.cwd(), "data") + "/";
export const SNAPSHOT_PATH = `${DATA_DIR}snapshot.json`;
export const COURSES_CONFIG_PATH = `${DATA_DIR}courses.config.json`;

/**
 * The user's real course list + per-course ICS feed URLs, added during
 * onboarding (docs/ROADMAP.md Phase 1). Never fabricated — Docket never
 * guesses a LearningSuite courseID (see docs/ARCHITECTURE.md §1.4 privacy
 * note: the ICS endpoint has no auth, so only ever fetch courses the user
 * told us they're enrolled in).
 */
export async function loadKnownCourses(): Promise<KnownCourse[]> {
  try {
    const raw = await readFile(COURSES_CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as KnownCourse[];
  } catch {
    return [];
  }
}
