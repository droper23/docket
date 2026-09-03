import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AssignmentEvent, DataStore, SyncChange } from "./types.js";

const MISSING_STREAK_BEFORE_ARCHIVE = 3;

export function loadStore(path: string): DataStore {
  if (!existsSync(path)) {
    return { assignments: {}, changelog: [], lastSyncAt: null };
  }
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw) as DataStore;
}

export function saveStore(path: string, store: DataStore): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Reconciles one course's freshly-fetched events into the store, in place.
 * Implements the sync semantics from learningsuite-handoff.md §2.2:
 * create on unseen id, update-in-place on changed hash, no-op on unchanged,
 * and a multi-pass "missing" grace period before archiving (never delete on
 * a single absence — a partial fetch is a false negative, not proof of removal).
 */
export function applyCourseSync(
  store: DataStore,
  courseId: string,
  freshEvents: AssignmentEvent[],
  timestamp: string,
): SyncChange[] {
  const changes: SyncChange[] = [];
  const freshIds = new Set(freshEvents.map((e) => e.stableId));

  for (const fresh of freshEvents) {
    const existing = store.assignments[fresh.stableId];

    if (!existing) {
      store.assignments[fresh.stableId] = fresh;
      changes.push({
        timestamp,
        stableId: fresh.stableId,
        courseId,
        kind: "created",
        detail: `${fresh.title} — due ${fresh.dueDate}`,
      });
      continue;
    }

    if (existing.lastContentHash !== fresh.lastContentHash) {
      const diffs: string[] = [];
      if (existing.title !== fresh.title) diffs.push(`title "${existing.title}" → "${fresh.title}"`);
      if (existing.dueDate !== fresh.dueDate) diffs.push(`due ${existing.dueDate} → ${fresh.dueDate}`);
      store.assignments[fresh.stableId] = { ...fresh, missingStreak: 0 };
      changes.push({
        timestamp,
        stableId: fresh.stableId,
        courseId,
        kind: "updated",
        detail: diffs.join("; ") || "content changed",
      });
    } else {
      existing.lastSyncedAt = timestamp;
      existing.missingStreak = 0;
    }
  }

  // Anything belonging to this course that wasn't in this pass's fetch.
  for (const [stableId, existing] of Object.entries(store.assignments)) {
    if (existing.courseId !== courseId) continue;
    if (freshIds.has(stableId)) continue;

    existing.missingStreak += 1;
    if (existing.missingStreak >= MISSING_STREAK_BEFORE_ARCHIVE) {
      delete store.assignments[stableId];
      changes.push({
        timestamp,
        stableId,
        courseId,
        kind: "archived",
        detail: `${existing.title} — absent for ${existing.missingStreak} consecutive syncs`,
      });
    } else {
      changes.push({
        timestamp,
        stableId,
        courseId,
        kind: "missing",
        detail: `${existing.title} — absent this pass (${existing.missingStreak}/${MISSING_STREAK_BEFORE_ARCHIVE})`,
      });
    }
  }

  store.changelog.push(...changes);
  store.lastSyncAt = timestamp;
  return changes;
}
