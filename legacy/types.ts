/**
 * Data model. Every field is tagged by provenance so the UI never presents
 * a guess as if LearningSuite had actually said it:
 *   real    — value came directly from a LearningSuite feed/page
 *   derived — computed locally from real fields
 *   manual  — the user typed it; LearningSuite has no equivalent
 * See learningsuite-handoff.md §2.3 for the source table this mirrors.
 */

export interface Course {
  /** LearningSuite's own opaque course id (from the ICS feed URL). real */
  courseId: string;
  /** e.g. "MATH 113". real */
  code: string;
  /** e.g. "Calculus 2". real */
  title: string;
}

export type AssignmentType =
  | "exam"
  | "quiz"
  | "reading"
  | "homework"
  | "text-item"
  | "other";

export interface AssignmentEvent {
  /** Stable id: `${courseId}:${uid}` — never regenerated across syncs. derived (from real ids) */
  stableId: string;
  courseId: string;
  /** LearningSuite's own UID for this calendar item. real */
  uid: string;
  /** real — from ICS SUMMARY */
  title: string;
  /**
   * real — from ICS DTSTART. The ICS feed only carries all-day granularity
   * (confirmed live); a precise time-of-day is NOT available from this
   * source and must come from a future extension-based connector (Phase 2/3).
   */
  dueDate: string; // ISO date, YYYY-MM-DD
  /** derived — keyword-matched from the title, not provided by LearningSuite */
  inferredType: AssignmentType;
  /** derived — sync bookkeeping, never shown to the user as "data" */
  lastContentHash: string;
  lastSyncedAt: string; // ISO datetime
  /** derived — how many consecutive sync passes this item was absent, for soft-delete */
  missingStreak: number;
  source: "ical";
}

export interface SyncChange {
  timestamp: string;
  stableId: string;
  courseId: string;
  kind: "created" | "updated" | "missing" | "archived";
  detail: string;
}

export interface DataStore {
  assignments: Record<string, AssignmentEvent>;
  changelog: SyncChange[];
  lastSyncAt: string | null;
}
