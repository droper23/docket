import { daysUntilInSchoolTimeZone } from "./schoolTime.js";
import type { AcademicSnapshot, AssignmentRecord, ChangeLogEntry, CourseRecord } from "./types.js";

function daysUntil(dateStr: string | undefined): number | undefined {
  if (!dateStr) return undefined;
  // Anchored to BYU's own timezone, not the server's — see src/core/schoolTime.ts for why
  // this isn't optional. A naive `new Date()` here is exactly the bug that made most
  // assignments show up as "due today" once this ran on a UTC server instead of a
  // Mountain-Time dev machine.
  return daysUntilInSchoolTimeZone(dateStr);
}

function isActive(snapshot: AcademicSnapshot, assignmentId: string): boolean {
  const sr = snapshot.syncRecords.find((r) => r.entityType === "assignment" && r.stableId === assignmentId);
  return !sr || sr.status === "active";
}

function isOpen(a: AssignmentRecord): boolean {
  return a.completionStatus?.value !== "completed";
}

/**
 * Excludes pure calendar/schedule markers (holidays, "Start of Classes") from
 * every actionable view — see AssignmentKind in src/core/types.ts. `kind` is
 * only ever `undefined` for connectors that don't set it (none currently
 * do); treated as real work in that case, matching the "shown is better
 * than hidden when unsure" rule the classifier itself follows.
 */
function isRealWork(a: AssignmentRecord): boolean {
  return a.kind?.value !== "calendar_event";
}

export interface AgendaItem {
  assignment: AssignmentRecord;
  course?: CourseRecord;
  daysUntilDue?: number;
}

function courseFor(snapshot: AcademicSnapshot, courseId: string): CourseRecord | undefined {
  return snapshot.courses.find((c) => c.id === courseId);
}

function toAgendaItem(snapshot: AcademicSnapshot, a: AssignmentRecord): AgendaItem {
  return {
    assignment: a,
    course: courseFor(snapshot, a.courseId),
    daysUntilDue: daysUntil(a.dueDate?.value),
  };
}

/**
 * "What do I need to do?" — every open, active, real-work item due within
 * `withinDays` (overdue items included: a negative `daysUntilDue` is never
 * filtered out here), most urgent first. Used to be two separate views
 * (`todayView` for <=2 days, `upcomingView` for the rest of the window) —
 * merged into one since the split forced picking an arbitrary cutoff for a
 * single continuous list a student reads top-to-bottom anyway.
 */
export function scheduleView(snapshot: AcademicSnapshot, withinDays = 14): AgendaItem[] {
  return snapshot.assignments
    .filter((a) => isActive(snapshot, a.id) && isOpen(a) && isRealWork(a) && a.dueDate?.value)
    .map((a) => toAgendaItem(snapshot, a))
    .filter((item) => item.daysUntilDue !== undefined && item.daysUntilDue <= withinDays)
    .sort((x, y) => (x.daysUntilDue ?? 0) - (y.daysUntilDue ?? 0));
}

export interface CourseWorkload {
  course: CourseRecord;
  itemCount: number;
}

/** How many open items are due per course in the next `withinDays` — a plain count, not a time estimate (Docket doesn't guess how long anything takes). */
export function workloadView(snapshot: AcademicSnapshot, withinDays = 7): CourseWorkload[] {
  const items = snapshot.assignments
    .filter((a) => isActive(snapshot, a.id) && isOpen(a) && isRealWork(a) && a.dueDate?.value)
    .map((a) => toAgendaItem(snapshot, a))
    .filter((item) => item.daysUntilDue !== undefined && item.daysUntilDue >= 0 && item.daysUntilDue <= withinDays);

  const byCourse = new Map<string, CourseWorkload>();
  for (const item of items) {
    if (!item.course) continue;
    const existing = byCourse.get(item.course.id) ?? { course: item.course, itemCount: 0 };
    existing.itemCount += 1;
    byCourse.set(item.course.id, existing);
  }
  return [...byCourse.values()].sort((a, b) => b.itemCount - a.itemCount);
}

/** "What changed since I last checked?" */
export function recentChanges(snapshot: AcademicSnapshot, withinHours = 24): ChangeLogEntry[] {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return [...snapshot.changeLog]
    .filter((c) => new Date(c.occurredAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}
