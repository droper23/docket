import type { LearningPlatformConnector } from "../connectors/types.js";
import { contentHash } from "./hash.js";
import { reconcile } from "./syncEngine.js";
import type { AcademicSnapshot, AnnouncementRecord, AssignmentRecord, CourseRecord } from "./types.js";

export interface SyncOutcome {
  ok: boolean;
  coursesSynced: number;
  coursesFailed: { courseId: string; message: string }[];
  changeCount: number;
}

/**
 * Runs one connector across every known course and folds the results into
 * the snapshot via the sync engine. A failure fetching one course's
 * assignments never touches another course's data — see
 * docs/ARCHITECTURE.md §Resilient Synchronization.
 */
export async function runSync(snapshot: AcademicSnapshot, connector: LearningPlatformConnector): Promise<SyncOutcome> {
  const now = new Date().toISOString();
  snapshot.lastSyncAttemptAt = now;

  const coursesResult = await connector.getCourses();
  if (!coursesResult.ok) {
    return { ok: false, coursesSynced: 0, coursesFailed: [{ courseId: "*", message: coursesResult.error.message }], changeCount: 0 };
  }

  const courseReconcile = reconcile<CourseRecord>({
    entityType: "course",
    source: connector.id,
    incoming: coursesResult.data,
    existingRecords: snapshot.courses,
    existingSyncRecords: snapshot.syncRecords,
    hash: (c) => contentHash([c.code.value, c.title.value, c.instructor?.value, c.term?.value]),
    // reconcile() only ever uses the returned `kind` for an actual in-place update (Case 3) —
    // for a brand-new record (Case 1) it calls this with before===after and hardcodes "created"
    // itself, ignoring the kind here. So `before === after` reliably means "this is the create
    // path, the kind below is moot" — anything else is a genuine update to an existing course.
    describeChange: (before, after) =>
      before === after
        ? { kind: "created", detail: `Course ${after.code.value} — ${after.title.value}` }
        : { kind: "updated", detail: `Course ${after.code.value} — ${after.title.value} (details changed)` },
  });
  snapshot.courses = courseReconcile.mergedRecords;
  snapshot.syncRecords = courseReconcile.syncRecords;
  snapshot.changeLog.push(...courseReconcile.newChangeLogEntries);

  let changeCount = courseReconcile.newChangeLogEntries.length;
  let coursesSynced = 0;
  const coursesFailed: { courseId: string; message: string }[] = [];

  for (const course of coursesResult.data) {
    const assignmentsResult = await connector.getAssignments(course.id);
    if (assignmentsResult.ok) {
      const result = reconcile<AssignmentRecord>({
        entityType: "assignment",
        source: connector.id,
        scope: course.id,
        incoming: assignmentsResult.data,
        existingRecords: snapshot.assignments,
        existingSyncRecords: snapshot.syncRecords,
        hash: assignmentHash,
        describeChange: describeAssignmentChange,
      });
      snapshot.assignments = result.mergedRecords;
      snapshot.syncRecords = result.syncRecords;
      snapshot.changeLog.push(...result.newChangeLogEntries);
      changeCount += result.newChangeLogEntries.length;
      coursesSynced += 1;
    } else if (assignmentsResult.error.code !== "not_implemented") {
      // "not_implemented" is an expected, honest response from a connector that doesn't
      // cover this data type (e.g. the ICS connector has no announcements) — not a failure.
      coursesFailed.push({ courseId: course.id, message: assignmentsResult.error.message });
    }

    const announcementsResult = await connector.getAnnouncements(course.id);
    if (announcementsResult.ok) {
      const result = reconcile<AnnouncementRecord>({
        entityType: "announcement",
        source: connector.id,
        scope: course.id,
        incoming: announcementsResult.data,
        existingRecords: snapshot.announcements,
        existingSyncRecords: snapshot.syncRecords,
        hash: (a) => contentHash([a.title.value, a.body.value, a.postedDate.value]),
        describeChange: (_before, after) => ({ kind: "announcement_new", detail: `${after.title.value}` }),
      });
      snapshot.announcements = result.mergedRecords;
      snapshot.syncRecords = result.syncRecords;
      snapshot.changeLog.push(...result.newChangeLogEntries);
      changeCount += result.newChangeLogEntries.length;
    } else if (announcementsResult.error.code !== "not_implemented") {
      coursesFailed.push({ courseId: course.id, message: announcementsResult.error.message });
    }
  }

  const ok = coursesFailed.length === 0;
  if (ok || coursesSynced > 0) {
    snapshot.lastSyncSuccessAt = now;
  }

  return { ok, coursesSynced, coursesFailed, changeCount };
}

export function assignmentHash(a: AssignmentRecord): string {
  return contentHash([
    a.title.value,
    a.dueDate?.value,
    a.dueTime?.value,
    a.pointsPossible?.value,
    a.pointsEarned?.value,
    a.completionStatus?.value,
  ]);
}

export function describeAssignmentChange(before: AssignmentRecord, after: AssignmentRecord): { kind: import("./types.js").ChangeKind; detail: string } | undefined {
  if (before.dueDate?.value !== after.dueDate?.value) {
    return { kind: "due_date_changed", detail: `${after.title.value}: due date moved from ${before.dueDate?.value ?? "unknown"} to ${after.dueDate?.value ?? "unknown"}` };
  }
  if (before.pointsEarned?.value === undefined && after.pointsEarned?.value !== undefined) {
    return { kind: "grade_posted", detail: `${after.title.value}: grade posted (${after.pointsEarned.value}/${after.pointsPossible?.value ?? "?"})` };
  }
  if (before.completionStatus?.value !== "completed" && after.completionStatus?.value === "completed") {
    return { kind: "completed", detail: `${after.title.value}: marked complete` };
  }
  return { kind: "due_date_changed", detail: `${after.title.value}: details updated` };
}
