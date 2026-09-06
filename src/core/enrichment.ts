import { randomUUID } from "node:crypto";
import { assignmentHash, describeAssignmentChange } from "./syncRunner.js";
import { derivedField, realField } from "./types.js";
import type { AcademicSnapshot, AssignmentLink, AssignmentRecord } from "./types.js";

export interface AssignmentPageRow {
  title: string;
  /**
   * Raw text from the page, e.g. "Nov 20 11:59 pm MST" — date is redundant with ICS,
   * time+zone is not. Optional: a Combined Schedule capture (see
   * src/connectors/bookmarklet.ts's schedule extractor) reads a row's detail dialog rather
   * than an Assignments-page row, and some item types (an Instructor Note, an exam with no
   * time-of-day) never show a due time there at all.
   */
  due?: string;
  /**
   * Raw text from the page, e.g. "/70.0" (ungraded) or "65/70.0" (graded). Optional for the
   * same reason as `due` — the Combined Schedule's detail dialog never shows a score.
   */
  score?: string;
  /** This course's own grading-category name (e.g. "Programming Assignments"), or "" if uncategorized. */
  category?: string;
  /** Full text from the assignment's expandable detail panel (instructions, open/close/due info). */
  description?: string;
  /** External (non-LearningSuite) resource links found in that same panel. */
  links?: AssignmentLink[];
  /**
   * Read directly off the row's own Submission column — real, not guessed. Whether the
   * literal word "Completed" appears there, or (for assignment types that leave that
   * column blank once graded, observed live for at least one course's recurring poll
   * quizzes) a real earned score is present. Never set true from absence of "Submit"/
   * "Opens <date>" text alone — those cases stay `false`, the conservative default.
   */
  completed?: boolean;
}

export interface EnrichmentOutcome {
  matched: number;
  unmatched: string[];
  changeCount: number;
}

/**
 * Strips ALL whitespace, not just collapses it — confirmed live as a real, necessary case,
 * not over-caution: LearningSuite's own ICS export concatenates a multi-part schedule note's
 * lines with no separator at all ("Intro to Linux ShellLinux Survival Tutorial", one word run
 * together), while the same item's live DOM rendering naturally has whitespace between the
 * parts (separate inline elements) that a scraper reading `.textContent` correctly reports.
 * Collapsing-to-one-space still leaves those two forms unequal; only removing whitespace
 * entirely unifies them. Safe to do broadly: this is used purely to decide whether two
 * strings are "the same title," and the ambiguous-match guard just below (candidates.length
 * !== 1) already refuses to guess if this ever makes two genuinely different titles collide —
 * broadening the match can only ever turn a previously-unmatched row into a correct match or
 * a caught ambiguity, never a wrong one.
 */
function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

/** Pulls just the time-of-day + zone off a "Mon DD h:mm am/pm ZZZ" string — the date is already known from the ICS feed. */
function parseDueTime(due: string | undefined): string | undefined {
  if (!due) return undefined;
  const m = due.match(/\d{1,2}:\d{2}\s*[ap]m\s*[A-Z]{2,5}$/i);
  return m ? m[0] : undefined;
}

function parseScore(score: string | undefined): { earned?: number; possible?: number } {
  if (!score) return {};
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
 *
 * `source` records which authenticated page this capture actually came from
 * (the course's own Assignments page vs. the Combined Schedule's per-item
 * detail dialog — see src/connectors/bookmarklet.ts) — shown in field
 * provenance, never hardcoded, since the two pages don't offer the same
 * fields (Assignments rows carry score/category, Schedule dialogs don't).
 */
export function applySessionEnrichment(
  snapshot: AcademicSnapshot,
  courseId: string,
  rows: AssignmentPageRow[],
  source = "learningsuite-session:assignments-page",
): EnrichmentOutcome {
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

  // Confirmed live: LearningSuite's own ICS export silently truncates a long SUMMARY field
  // mid-word ("...Zoom Reco" instead of "...Zoom Recording (05/01/26)" — not a hypothetical,
  // a real production title cut off exactly like that), so an ICS-synced record's stored
  // title can be a truncated PREFIX of what a live-DOM capture (this bookmarklet) reports in
  // full. Falls back to this only when no exact match exists, matches only in that one
  // direction (stored-is-prefix-of-incoming, never the reverse — a live capture is always at
  // least as complete as a truncated ICS title, never less), and only for long titles (a
  // ~20-char floor) so a short numbered title like "HW1" can't spuriously prefix-match
  // "HW10". Still refuses to guess on more than one candidate, same as the exact-match path.
  const MIN_PREFIX_MATCH_LEN = 20;
  function findCandidates(rowTitle: string): AssignmentRecord[] {
    const normalizedRow = normalizeTitle(rowTitle);
    const exact = byTitle.get(normalizedRow);
    if (exact && exact.length > 0) return exact;
    return existingForCourse.filter((a) => {
      const normalizedStored = normalizeTitle(a.title.value);
      return normalizedStored.length >= MIN_PREFIX_MATCH_LEN && normalizedRow.startsWith(normalizedStored) && normalizedStored !== normalizedRow;
    });
  }

  let matched = 0;
  let changeCount = 0;
  const unmatched: string[] = [];

  for (const row of rows) {
    const candidates = findCandidates(row.title);
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
      dueTime: time ? realField(time, source, now) : before.dueTime,
      pointsPossible: possible !== undefined ? realField(possible, source, now) : before.pointsPossible,
      pointsEarned: earned !== undefined ? realField(earned, source, now) : before.pointsEarned,
      category: row.category ? realField(row.category, source, now) : before.category,
      description: row.description ? realField(row.description, source, now) : before.description,
      links: row.links && row.links.length > 0 ? realField(row.links, source, now) : before.links,
      // Confirmed real coursework: this title was actually found on an authenticated page
      // (either the course's own Assignments page, or an item the student actually clicked
      // open on the Combined Schedule), neither of which a pure calendar/schedule marker
      // like a holiday would ever be matched against in the first place.
      kind: derivedField("assignment", source, now),
      // Real, not guessed — read directly off the row's own Submission column (see
      // AssignmentPageRow.completed). Only ever moves forward from unset/false to
      // "completed" on a row that actually reported it; a row that didn't report
      // completed:true leaves the existing value alone rather than resetting it back to
      // not_started, since a later sync omitting this row (title changed, page layout
      // shifted) shouldn't un-complete something already confirmed done.
      completionStatus: row.completed ? realField("completed", source, now) : before.completionStatus,
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
