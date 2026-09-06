import assert from "node:assert/strict";
import { test } from "node:test";
import { applySessionEnrichment } from "../src/core/enrichment.js";
import { realField } from "../src/core/types.js";
import type { AcademicSnapshot, AssignmentRecord } from "../src/core/types.js";
import { assignmentStableId } from "../src/core/stableId.js";

function baseSnapshot(assignments: AssignmentRecord[]): AcademicSnapshot {
  return {
    courses: [],
    assignments,
    announcements: [],
    companionTasks: [],
    syncRecords: assignments.map((a) => ({
      stableId: a.id,
      entityType: "assignment",
      source: "learningsuite-ics",
      scope: a.courseId,
      contentHash: "orig-hash",
      firstSeenAt: "t0",
      lastSeenAt: "t0",
      lastUpdatedAt: "t0",
      missingPasses: 0,
      status: "active",
    })),
    changeLog: [],
  };
}

function makeAssignment(courseId: string, localId: string, title: string): AssignmentRecord {
  return {
    id: assignmentStableId(courseId, localId),
    courseId,
    title: realField(title, "learningsuite-ics"),
    dueDate: realField("2026-09-10", "learningsuite-ics"),
  };
}

test("enriches a matched assignment with real due time and score, logs a change", () => {
  const a = makeAssignment("c1", "1", "Bomb Programming Assignment");
  const snapshot = baseSnapshot([a]);

  const outcome = applySessionEnrichment(snapshot, "c1", [{ title: "Bomb Programming Assignment", due: "Nov 20 11:59 pm MST", score: "65/70.0" }]);

  assert.equal(outcome.matched, 1);
  assert.equal(outcome.unmatched.length, 0);
  assert.equal(outcome.changeCount, 1);

  const updated = snapshot.assignments.find((x) => x.id === a.id)!;
  assert.equal(updated.dueTime?.value, "11:59 pm MST");
  assert.equal(updated.dueTime?.provenance, "real");
  assert.equal(updated.pointsPossible?.value, 70.0);
  assert.equal(updated.pointsEarned?.value, 65);
  // The date, sourced from ICS, must be untouched by enrichment.
  assert.equal(updated.dueDate?.value, "2026-09-10");
});

test("ungraded row (no leading number before the slash) leaves pointsEarned unset", () => {
  const a = makeAssignment("c1", "1", "Attack Programming Assignment");
  const snapshot = baseSnapshot([a]);

  applySessionEnrichment(snapshot, "c1", [{ title: "Attack Programming Assignment", due: "Dec 9 11:59 pm MST", score: "/95.0" }]);

  const updated = snapshot.assignments[0]!;
  assert.equal(updated.pointsPossible?.value, 95);
  assert.equal(updated.pointsEarned, undefined);
});

test("a row with no matching title is reported unmatched, never guessed into a new record", () => {
  const a = makeAssignment("c1", "1", "Game 1");
  const snapshot = baseSnapshot([a]);

  const outcome = applySessionEnrichment(snapshot, "c1", [{ title: "Some Renamed Assignment", due: "Oct 1 9:00 pm MDT", score: "/100" }]);

  assert.equal(outcome.matched, 0);
  assert.deepEqual(outcome.unmatched, ["Some Renamed Assignment"]);
  assert.equal(snapshot.assignments.length, 1); // no phantom record created
});

test("an ambiguous title (two assignments in the same course share a title) is skipped, not guessed", () => {
  const a1 = makeAssignment("c1", "1", "Quiz");
  const a2 = makeAssignment("c1", "2", "Quiz");
  const snapshot = baseSnapshot([a1, a2]);

  const outcome = applySessionEnrichment(snapshot, "c1", [{ title: "Quiz", due: "Oct 1 9:00 pm MDT", score: "/10" }]);

  assert.equal(outcome.matched, 0);
  assert.deepEqual(outcome.unmatched, ["Quiz"]);
});

test("re-running with identical data is a no-op (no duplicate change log entries)", () => {
  const a = makeAssignment("c1", "1", "Bomb Programming Assignment");
  const snapshot = baseSnapshot([a]);
  const row = { title: "Bomb Programming Assignment", due: "Nov 20 11:59 pm MST", score: "65/70.0" };

  applySessionEnrichment(snapshot, "c1", [row]);
  const outcome2 = applySessionEnrichment(snapshot, "c1", [row]);

  assert.equal(outcome2.changeCount, 0);
  assert.equal(snapshot.changeLog.length, 1);
});

test("enrichment for one course never touches another course's assignments", () => {
  const a1 = makeAssignment("c1", "1", "Shared Title");
  const a2 = makeAssignment("c2", "1", "Shared Title");
  const snapshot = baseSnapshot([a1, a2]);

  applySessionEnrichment(snapshot, "c1", [{ title: "Shared Title", due: "Oct 1 9:00 pm MDT", score: "5/10" }]);

  const c2Assignment = snapshot.assignments.find((a) => a.courseId === "c2")!;
  assert.equal(c2Assignment.pointsEarned, undefined);
});

test("merges real category, description, and external links from the detail panel", () => {
  const a = makeAssignment("c1", "1", "Bomb Programming Assignment");
  const snapshot = baseSnapshot([a]);

  const outcome = applySessionEnrichment(snapshot, "c1", [
    {
      title: "Bomb Programming Assignment",
      due: "Nov 20 11:59 pm MST",
      score: "/70.0",
      category: "Programming Assignments",
      description: "Due: Nov 20 11:59 pm MST (right before midnight) Download bomb View scoreboard To turn in this assignment...",
      links: [
        { text: "Download bomb", url: "http://ecen224.byu.edu:5100" },
        { text: "View scoreboard", url: "http://ecen224.byu.edu:5100/scoreboard" },
      ],
    },
  ]);

  const updated = snapshot.assignments[0]!;
  assert.equal(outcome.matched, 1);
  assert.equal(updated.category?.value, "Programming Assignments");
  assert.equal(updated.category?.provenance, "real");
  assert.ok(updated.description?.value.startsWith("Due: Nov 20"));
  assert.equal(updated.description?.provenance, "real");
  assert.deepEqual(updated.links?.value, [
    { text: "Download bomb", url: "http://ecen224.byu.edu:5100" },
    { text: "View scoreboard", url: "http://ecen224.byu.edu:5100/scoreboard" },
  ]);
  // A title actually found on the real Assignments page is confirmed coursework,
  // never a calendar marker — see docs/ARCHITECTURE.md §13.
  assert.equal(updated.kind?.value, "assignment");
  assert.equal(updated.kind?.provenance, "derived");
});

test("re-enriching with unchanged category/description/links is still a no-op (no phantom changes)", () => {
  const a = makeAssignment("c1", "1", "Game 1");
  const snapshot = baseSnapshot([a]);
  const row = { title: "Game 1", due: "Oct 16 9:00 pm MDT", score: "/100", category: "Games", description: "Open: Oct 12 Close: Oct 16" };

  applySessionEnrichment(snapshot, "c1", [row]);
  const outcome2 = applySessionEnrichment(snapshot, "c1", [row]);

  assert.equal(outcome2.changeCount, 0);
});

test("a row reporting completed: true marks the assignment completed", () => {
  const a = makeAssignment("c1", "1", "Syllabus Video Quiz");
  const snapshot = baseSnapshot([a]);

  applySessionEnrichment(snapshot, "c1", [{ title: "Syllabus Video Quiz", due: "Sep 2 11:59 pm MDT", score: "/10.0", completed: true }]);

  const updated = snapshot.assignments[0]!;
  assert.equal(updated.completionStatus?.value, "completed");
  assert.equal(updated.completionStatus?.provenance, "real");
});

test("a row without completed: true leaves completion status untouched — never un-completes something already confirmed done", () => {
  const a: AssignmentRecord = { ...makeAssignment("c1", "1", "Syllabus Video Quiz"), completionStatus: realField("completed", "learningsuite-session:assignments-page") };
  const snapshot = baseSnapshot([a]);

  // A later sync where this row's title didn't match (page reflowed, renamed) or simply
  // reported completed: false — either way, previously-confirmed completion must survive.
  applySessionEnrichment(snapshot, "c1", [{ title: "Syllabus Video Quiz", due: "Sep 2 11:59 pm MDT", score: "/10.0", completed: false }]);

  const updated = snapshot.assignments[0]!;
  assert.equal(updated.completionStatus?.value, "completed");
});

test(
  "regression: title matching strips ALL whitespace, not just collapses it — confirmed live " +
    "as a real mismatch, not a hypothetical: LearningSuite's own ICS export concatenates a " +
    "multi-part schedule note's lines with no separator at all ('Intro to Linux " +
    "ShellLinux Survival Tutorial', one run-together word), while the same item's live DOM " +
    "naturally renders whitespace between the parts — a bookmarklet reading .textContent " +
    "correctly reports that space, but collapsing-to-one-space still leaves the two forms " +
    "unequal. This is what made a real production sync report 0 of 10 items matched.",
  () => {
    const a = makeAssignment("c1", "1", "Intro to Linux ShellLinux Survival Tutorial");
    const snapshot = baseSnapshot([a]);

    const outcome = applySessionEnrichment(snapshot, "c1", [
      { title: "Intro to Linux Shell Linux Survival Tutorial", links: [{ text: "Linux Survival Tutorial", url: "https://linuxsurvival.com" }] },
    ]);

    assert.equal(outcome.matched, 1, "the space-containing DOM-scraped title must still match the space-free ICS-sourced title");
    assert.equal(outcome.unmatched.length, 0);
  },
);

test(
  "title matching still refuses to guess when whitespace-stripping makes two different real " +
    "titles collide — the broader match must never silently merge genuinely distinct " +
    "assignments, only catch cases that really are the same title",
  () => {
    const a1 = makeAssignment("c1", "1", "Trig HW1");
    const a2 = makeAssignment("c1", "2", "Trig H W1");
    const snapshot = baseSnapshot([a1, a2]);

    const outcome = applySessionEnrichment(snapshot, "c1", [{ title: "Trig HW1", description: "some detail" }]);

    assert.equal(outcome.matched, 0, "an ambiguous whitespace-stripped match must still be refused, not guessed at");
    assert.equal(outcome.unmatched.length, 1);
  },
);

test(
  "regression: a stored title that's a truncated prefix of the incoming row's title still " +
    "matches — confirmed live as a real, not hypothetical, case: LearningSuite's own ICS " +
    "export truncates a long SUMMARY field mid-word ('...Zoom Reco' instead of '...Zoom " +
    "Recording (05/01/26)'), so the ICS-synced record Docket already has is shorter than " +
    "what a live-DOM capture (the schedule bookmarklet) reports for the same real item",
  () => {
    const truncatedIcsTitle = "Chapter 2.104-Information Storage.pdf  Download (Updated on 04/28/2026)Zoom Reco";
    const a = makeAssignment("c1", "1", truncatedIcsTitle);
    const snapshot = baseSnapshot([a]);

    const fullLiveTitle = "Chapter 2.1 04-Information Storage.pdf Download (Updated on 04/28/2026) Zoom Recording (05/01/26)";
    const outcome = applySessionEnrichment(snapshot, "c1", [{ title: fullLiveTitle, links: [{ text: "Zoom Recording", url: "https://example.test/rec" }] }]);

    assert.equal(outcome.matched, 1, "the fuller live-captured title must still match its truncated ICS-stored counterpart");
  },
);

test(
  "prefix matching only ever goes one direction (stored-is-prefix-of-incoming) and never " +
    "fires for short titles — a live capture is always at least as complete as a truncated " +
    "ICS title, never less, and a short numbered title like 'HW1' must never spuriously " +
    "prefix-match something like 'HW10'",
  () => {
    const shortStored = makeAssignment("c1", "1", "HW1");
    const snapshotShort = baseSnapshot([shortStored]);
    const outcomeShort = applySessionEnrichment(snapshotShort, "c1", [{ title: "HW10" }]);
    assert.equal(outcomeShort.matched, 0, "a short stored title must never prefix-match a longer, genuinely different title");

    // The reverse direction: the stored title is LONGER/fuller than the incoming row — this
    // should never happen in practice (ICS truncates, it doesn't grow), so it must not match.
    const fullStored = makeAssignment(
      "c2",
      "1",
      "Chapter 2.1 04-Information Storage.pdf Download (Updated on 04/28/2026) Zoom Recording (05/01/26)",
    );
    const snapshotFull = baseSnapshot([fullStored]);
    const outcomeReverse = applySessionEnrichment(snapshotFull, "c2", [{ title: "Chapter 2.104-Information Storage.pdf  Download (Updated on 04/28/2026)Zoom Reco" }]);
    assert.equal(outcomeReverse.matched, 0, "must never match in the reverse direction (incoming shorter than stored)");
  },
);
