import type { AcademicSnapshot, AssignmentRecord, ChangeLogEntry, CourseRecord } from "./types.js";

/** Companion-owned effort heuristic, by LearningSuite's own assignment `type` string. Always "derived" — never shown as fact. */
const EFFORT_MINUTES_BY_TYPE: Record<string, number> = {
  lab: 90,
  homework: 45,
  quiz: 30,
  reading: 30,
  exam: 120,
  project: 180,
};
const DEFAULT_EFFORT_MINUTES = 45;

export function estimateEffortMinutes(a: AssignmentRecord): number {
  const type = a.type?.value?.toLowerCase();
  if (!type) return DEFAULT_EFFORT_MINUTES;
  return EFFORT_MINUTES_BY_TYPE[type] ?? DEFAULT_EFFORT_MINUTES;
}

function daysUntil(dateStr: string | undefined): number | undefined {
  if (!dateStr) return undefined;
  const due = new Date(`${dateStr}T23:59:59`);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
  estimatedMinutes: number;
}

function courseFor(snapshot: AcademicSnapshot, courseId: string): CourseRecord | undefined {
  return snapshot.courses.find((c) => c.id === courseId);
}

function toAgendaItem(snapshot: AcademicSnapshot, a: AssignmentRecord): AgendaItem {
  return {
    assignment: a,
    course: courseFor(snapshot, a.courseId),
    daysUntilDue: daysUntil(a.dueDate?.value),
    estimatedMinutes: estimateEffortMinutes(a),
  };
}

/** "What do I need to do today?" — open, active items due within 2 days, most urgent first. */
export function todayView(snapshot: AcademicSnapshot): AgendaItem[] {
  return snapshot.assignments
    .filter((a) => isActive(snapshot, a.id) && isOpen(a) && isRealWork(a) && a.dueDate?.value)
    .map((a) => toAgendaItem(snapshot, a))
    .filter((item) => item.daysUntilDue !== undefined && item.daysUntilDue <= 2)
    .sort((x, y) => (x.daysUntilDue ?? 0) - (y.daysUntilDue ?? 0));
}

/** Everything open and active beyond the urgent window, within `withinDays`. */
export function upcomingView(snapshot: AcademicSnapshot, withinDays = 14): AgendaItem[] {
  return snapshot.assignments
    .filter((a) => isActive(snapshot, a.id) && isOpen(a) && isRealWork(a) && a.dueDate?.value)
    .map((a) => toAgendaItem(snapshot, a))
    .filter((item) => item.daysUntilDue !== undefined && item.daysUntilDue > 2 && item.daysUntilDue <= withinDays)
    .sort((x, y) => (x.daysUntilDue ?? 0) - (y.daysUntilDue ?? 0));
}

export interface CourseWorkload {
  course: CourseRecord;
  itemCount: number;
  estimatedMinutes: number;
}

/** Estimated workload per course for the next `withinDays` — clearly derived, never presented as LearningSuite fact. */
export function workloadView(snapshot: AcademicSnapshot, withinDays = 7): CourseWorkload[] {
  const items = snapshot.assignments
    .filter((a) => isActive(snapshot, a.id) && isOpen(a) && isRealWork(a) && a.dueDate?.value)
    .map((a) => toAgendaItem(snapshot, a))
    .filter((item) => item.daysUntilDue !== undefined && item.daysUntilDue >= 0 && item.daysUntilDue <= withinDays);

  const byCourse = new Map<string, CourseWorkload>();
  for (const item of items) {
    if (!item.course) continue;
    const existing = byCourse.get(item.course.id) ?? { course: item.course, itemCount: 0, estimatedMinutes: 0 };
    existing.itemCount += 1;
    existing.estimatedMinutes += item.estimatedMinutes;
    byCourse.set(item.course.id, existing);
  }
  return [...byCourse.values()].sort((a, b) => b.estimatedMinutes - a.estimatedMinutes);
}

/** "What changed since I last checked?" */
export function recentChanges(snapshot: AcademicSnapshot, withinHours = 24): ChangeLogEntry[] {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;
  return [...snapshot.changeLog]
    .filter((c) => new Date(c.occurredAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}
