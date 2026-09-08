import { getSetting, setSetting } from "../lib/storage.js";

export interface KnownCourse {
  code: string;
  title: string;
}

const KEY = "knownCourses";

/**
 * A small on-device cache of code -> title, so Settings > Course Colors has real courses to
 * list even when opened from a page whose own extraction never sees a course's full title
 * (homeAdapter.ts's schedule rows, gradeSummaryAdapter.ts's combined "CODE - Title" label).
 * courseListAdapter.ts is the only writer — Course List is the one page with a clean, already-
 * split code/title pair per course — so this only ever grows/updates, never shrinks, keeping a
 * student's color choices meaningful even for a course they haven't revisited on Course List
 * since a title changed.
 */
export function recordKnownCourses(courses: KnownCourse[]): void {
  if (!courses.length) return;
  const existing = getSetting<Record<string, string>>(KEY, {});
  const next = { ...existing };
  let changed = false;
  for (const c of courses) {
    if (!c.code) continue;
    const title = c.title || c.code;
    if (next[c.code] !== title) {
      next[c.code] = title;
      changed = true;
    }
  }
  if (changed) setSetting(KEY, next);
}

export function getKnownCourses(): KnownCourse[] {
  const map = getSetting<Record<string, string>>(KEY, {});
  return Object.entries(map)
    .map(([code, title]) => ({ code, title }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
