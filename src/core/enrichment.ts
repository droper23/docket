import { randomUUID } from "node:crypto";
import { assignmentHash, describeAssignmentChange } from "./syncRunner.js";
import { derivedField, realField } from "./types.js";
import type { AcademicSnapshot, AssignmentLink, AssignmentRecord } from "./types.js";

export interface AssignmentPageRow {
  title: string;
  /** Raw text from the page, e.g. "Nov 20 11:59 pm MST" — date is redundant with ICS, time+zone is not. */
  due: string;
  /** Raw text from the page, e.g. "/70.0" (ungraded) or "65/70.0" (graded). */
  score: string;
  /** This course's own grading-category name (e.g. "Programming Assignments"), or "" if uncategorized. */
  category?: string;
  /** Full text from the assignment's expandable detail panel (instructions, open/close/due info). */
  description?: string;
  /** External (non-LearningSuite) resource links found in that same panel. */
  links?: AssignmentLink[];
}

export interface EnrichmentOutcome {
  matched: number;
  unmatched: string[];
  changeCount: number;
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Pulls just the time-of-day + zone off a "Mon DD h:mm am/pm ZZZ" string — the date is already known from the ICS feed. */
function parseDueTime(due: string): string | undefined {
  const m = due.match(/\d{1,2}:\d{2}\s*[ap]m\s*[A-Z]{2,5}$/i);
  return m ? m[0] : undefined;
}

function parseScore(score: string): { earned?: number; possible?: number } {
  const m = score.match(/^\s*([\d.]+)?\s*\/\s*([\d.]+)\s*$/);
  if (!m) return {};
  const [, earnedStr, possibleStr] = m;
  return {
    earned: earnedStr ? Number(earnedStr) : undefined,
    possible: possibleStr ? Number(possibleStr) : undefined,
  };
}

/**
 * Enriches this course's already-ICS-synced assignments with data that only
 * exists in an authenticated session (real due *time*, real points). This
 * is deliberately NOT run through the generic sync engine's reconcile() —
 * reconcile() assumes "this pass is the complete, authoritative listing
 * from one source" (see docs/ARCHITECTURE.md §5), which is true for a full
 * ICS course sync but not true here: this is a partial patch of a few
 * fields, sourced from a page a human happened to capture via the
 * bookmarklet, layered on top of records the ICS connector already owns.
 * Never creates a new assignment record — a row with no matching title
 * (or an ambiguous, non-unique title within the course) is reported as
 * unmatched rather than guessed at, per docs/ARCHITECTURE.md §4's rule
 * against inventing identity.
 */
export function applySessionEnrichment(snapshot: AcademicSnapshot, courseId: string, rows: AssignmentPageRow[]): EnrichmentOutcome {
  const now = new Date().toISOString();
  const existingForCourse = snapshot.assignments.filter((a) => a.courseId === courseId);

  const byTitle = new Map<string, AssignmentRecord[]>();
  for (const a of existingForCourse) {
    const key = normalizeTitle(a.title.value);
    const bucket = byTitle.get(key) ?? [];
    bucket.push(a);
    byTitle.set(key, bucket);
  }

  const assignmentById = new Map(snapshot.assignments.map((a) => [a.id, a]));
  const syncRecordByStableId = new Map(snapshot.syncRecords.map((sr) => [sr.stableId, sr]));

  let matched = 0;
  let changeCount = 0;
  const unmatched: string[] = [];

  for (const row of rows) {
    const candidates = byTitle.get(normalizeTitle(row.title));
    if (!candidates || candidates.length !== 1) {
      unmatched.push(row.title);
      continue;
    }
    matched += 1;
    const before = candidates[0]!;
    const { earned, possible } = parseScore(row.score);
    const time = parseDueTime(row.due);

    const after: AssignmentRecord = {
      ...before,
      dueTime: time ? realField(time, "learningsuite-session:assignments-page", now) : before.dueTime,
      pointsPossible: possible !== undefined ? realField(possible, "learningsuite-session:assignments-page", now) : before.pointsPossible,
      pointsEarned: earned !== undefined ? realField(earned, "learningsuite-session:assignments-page", now) : before.pointsEarned,
      category: row.category ? realField(row.category, "learningsuite-session:assignments-page", now) : before.category,
      description: row.description ? realField(row.description, "learningsuite-session:assignments-page", now) : before.description,
      links: row.links && row.links.length > 0 ? realField(row.links, "learningsuite-session:assignments-page", now) : before.links,
      // Confirmed real coursework: this title was actually found on the course's own
      // Assignments page, which pure calendar/schedule markers never appear on.
      kind: derivedField("assignment", "learningsuite-session:assignments-page", now),
    };

    const newHash = assignmentHash(after);
    const syncRecord = syncRecordByStableId.get(before.id);
    if (syncRecord && syncRecord.contentHash !== newHash) {
      syncRecordByStableId.set(before.id, { ...syncRecord, contentHash: newHash, lastUpdatedAt: now, lastSeenAt: now });
      const change = describeAssignmentChange(before, after);
      if (change) {
        snapshot.changeLog.push({ id: randomUUID(), stableId: before.id, kind: change.kind, detail: change.detail, occurredAt: now });
        changeCount += 1;
      }
    }
    assignmentById.set(before.id, after);
  }

  snapshot.assignments = [...assignmentById.values()];
  snapshot.syncRecords = [...syncRecordByStableId.values()];

  return { matched, unmatched, changeCount };
}
