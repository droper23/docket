import { COURSES, icalFeedUrl } from "./courses.config.js";
import { fetchIcsFeed } from "./fetchFeed.js";
import { normalizeIcs } from "./normalize.js";
import { applyCourseSync, loadStore, saveStore } from "./store.js";
import type { DataStore, SyncChange } from "./types.js";

export const STORE_PATH = new URL("../data/store.json", import.meta.url).pathname;

export interface SyncSummary {
  timestamp: string;
  perCourse: { code: string; title: string; ok: boolean; error?: string; eventCount: number }[];
  changes: SyncChange[];
}

export async function runSync(): Promise<SyncSummary> {
  const store: DataStore = loadStore(STORE_PATH);
  const timestamp = new Date().toISOString();
  const summary: SyncSummary = { timestamp, perCourse: [], changes: [] };

  for (const course of COURSES) {
    const result = await fetchIcsFeed(icalFeedUrl(course.courseId));

    if (!result.ok || !result.text) {
      summary.perCourse.push({
        code: course.code,
        title: course.title,
        ok: false,
        error: result.error,
        eventCount: 0,
      });
      // Fail soft: skip this course's reconciliation entirely rather than
      // treating a fetch failure as "everything was deleted."
      continue;
    }

    const events = normalizeIcs(result.text, course.courseId, timestamp);
    const changes = applyCourseSync(store, course.courseId, events, timestamp);
    summary.changes.push(...changes);
    summary.perCourse.push({
      code: course.code,
      title: course.title,
      ok: true,
      eventCount: events.length,
    });
  }

  saveStore(STORE_PATH, store);
  return summary;
}
