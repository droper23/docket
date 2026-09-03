/**
 * Canonical data model for Docket.
 *
 * This module intentionally has zero dependency on any connector, storage
 * engine, or UI framework — it is the contract every platform (web dashboard
 * today, a future Safari extension / native app / Chrome extension) builds
 * against. See docs/ARCHITECTURE.md §Data Ownership for the rationale.
 */

/** Where a piece of data came from, and how much to trust it as fact. */
export type Provenance = "real" | "derived" | "manual";

/**
 * Every field that could be confused with LearningSuite fact is wrapped in
 * a Field<T> so the UI can never accidentally render a Companion guess as
 * if LearningSuite had said it.
 */
export interface Field<T> {
  value: T;
  provenance: Provenance;
  /** Human-readable origin, e.g. "learningsuite-ics", "learningsuite-session:grades-page", "user-input" */
  source: string;
  capturedAt: string; // ISO 8601
}

export function realField<T>(value: T, source: string, capturedAt: string = new Date().toISOString()): Field<T> {
  return { value, provenance: "real", source, capturedAt };
}

export function derivedField<T>(value: T, source: string, capturedAt: string = new Date().toISOString()): Field<T> {
  return { value, provenance: "derived", source, capturedAt };
}

export function manualField<T>(value: T, capturedAt: string = new Date().toISOString()): Field<T> {
  return { value, provenance: "manual", source: "user-input", capturedAt };
}

export type CompletionStatus = "not_started" | "in_progress" | "completed" | "unknown";

/**
 * A LearningSuite course, keyed by LearningSuite's own opaque courseID.
 * Never invent a course ID — always the ID LearningSuite itself uses,
 * because that ID is also what the ICS feed and ajax.php calls use.
 */
export interface CourseRecord {
  /** Stable ID = LearningSuite's own courseID. Never fabricated, never a title/slug. */
  id: string;
  code: Field<string>; // e.g. "CS 235"
  title: Field<string>;
  instructor?: Field<string>;
  term?: Field<string>;
}

/**
 * A gradeable/trackable item: assignment, quiz, exam, reading, project.
 * Stable ID = `${courseId}:${assignmentId}` per docs/ARCHITECTURE.md §Stable IDs.
 */
export interface AssignmentRecord {
  id: string;
  courseId: string;
  title: Field<string>;
  type?: Field<string>; // "assignment" | "exam" | "quiz" | "reading" | ... (LearningSuite's own vocabulary, not ours)
  dueDate?: Field<string>; // ISO date (YYYY-MM-DD) — may be all-day granularity from ICS
  dueTime?: Field<string>; // ISO time (HH:mm) — only available from the authenticated connector
  availableDate?: Field<string>;
  pointsPossible?: Field<number>;
  pointsEarned?: Field<number>;
  completionStatus?: Field<CompletionStatus>;
}

export interface AnnouncementRecord {
  id: string;
  courseId: string;
  title: Field<string>;
  body: Field<string>;
  postedDate: Field<string>;
}

/**
 * Companion-owned data about an assignment. LearningSuite has no concept of
 * any of these fields — they exist purely to make the Today view useful.
 */
export interface CompanionTask {
  assignmentId: string;
  estimatedMinutes?: Field<number>; // always provenance "derived" or "manual" — never "real"
  priorityScore?: Field<number>; // "derived"
  notes?: Field<string>; // "manual"
  subtasks?: { id: string; title: string; done: boolean }[]; // "manual"
}

/** Bookkeeping row the sync engine uses to detect changes and avoid duplicate side effects. */
export interface SyncRecord {
  stableId: string;
  entityType: "course" | "assignment" | "announcement";
  source: string;
  /**
   * What one sync pass actually covers — e.g. a courseId. "Missing this
   * pass" must only ever be evaluated against records from the *same*
   * scope: a pass over course A's assignments says nothing about whether
   * course B's assignments are still there. Undefined = the connector
   * reports everything it knows about in one call (e.g. the course list
   * itself), so there's only ever one scope to compare against.
   */
  scope?: string;
  contentHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastUpdatedAt: string;
  /** consecutive sync passes in which this record was absent from its source */
  missingPasses: number;
  status: "active" | "archived";
  /** external mapping targets, populated once Phase 4 (EventKit) exists */
  reminderId?: string;
  calendarEventId?: string;
}

export type ChangeKind =
  | "created"
  | "due_date_changed"
  | "grade_posted"
  | "completed"
  | "announcement_new"
  | "archived";

export interface ChangeLogEntry {
  id: string;
  stableId: string;
  kind: ChangeKind;
  detail: string;
  occurredAt: string;
}

/** The full local academic snapshot Docket maintains for one student. */
export interface AcademicSnapshot {
  courses: CourseRecord[];
  assignments: AssignmentRecord[];
  announcements: AnnouncementRecord[];
  companionTasks: CompanionTask[];
  syncRecords: SyncRecord[];
  changeLog: ChangeLogEntry[];
  lastSyncAttemptAt?: string;
  lastSyncSuccessAt?: string;
}

export function emptySnapshot(): AcademicSnapshot {
  return {
    courses: [],
    assignments: [],
    announcements: [],
    companionTasks: [],
    syncRecords: [],
    changeLog: [],
  };
}
