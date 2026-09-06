import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./testUtil.js";
import { dueBadge } from "../src/components/dueBadge.js";
import { gradeBadge } from "../src/components/gradeBadge.js";
import { assignmentCard } from "../src/components/assignmentCard.js";
import { assignCourseColors } from "../src/lib/courseColor.js";

test("dueBadge never bands an availability date as overdue, regardless of the sign of daysUntilDue", () => {
  setupDom("<div></div>");
  const overdue = dueBadge(-3);
  assert.equal(overdue?.textContent, "Overdue by 3 days");
  assert.equal(overdue?.className, "docket-badge docket-badge-overdue");

  // Confirmed live (Sep 2026, Combined Schedule): an item listed under its own "Opens" day
  // group can be well in the past (daysUntilDue negative) without being overdue at all.
  const opens = dueBadge(-3, "Sep 9");
  assert.equal(opens?.textContent, "Opens Sep 9");
  assert.equal(opens?.className, "docket-badge docket-badge-neutral", "must never use the red/urgency treatment");
});

test("gradeBadge renders a neutral 'Not yet graded' chip, never the failing-red treatment, when nothing has been scored", () => {
  setupDom("<div></div>");
  const unscored = gradeBadge("0%", false);
  assert.equal(unscored?.textContent, "Not yet graded");
  assert.equal(unscored?.className, "docket-badge docket-badge-neutral");

  // A real low score, once something has actually been graded, must still band red — the two
  // states ("nothing scored yet" vs. "scored and doing badly") must not collapse together.
  const scored = gradeBadge("0.58%", true);
  assert.equal(scored?.textContent, "0.58%");
  assert.equal(scored?.className, "docket-badge docket-badge-overdue");
});

test("assignmentCard renders a real score readout, using an em dash (never a fabricated 0) for ungraded work", () => {
  setupDom("<div></div>");
  const ungraded = assignmentCard({ title: "HW 1", scorePossible: "20.0" });
  assert.equal(ungraded.querySelector(".docket-score")?.textContent, "—/20.0");

  const graded = assignmentCard({ title: "HW 2", scoreEarned: "18", scorePossible: "20.0" });
  assert.equal(graded.querySelector(".docket-score")?.textContent, "18/20.0");

  const noScoreConcept = assignmentCard({ title: "Holiday" });
  assert.equal(noScoreConcept.querySelector(".docket-score"), null);
});

test("assignmentCard suppresses the urgency badge for a completed item, however overdue its due date is", () => {
  setupDom("<div></div>");
  const card = assignmentCard({ title: "Syllabus Video Quiz", daysUntilDue: -4, completed: true });
  assert.equal(card.querySelector(".docket-badge"), null, "a completed item must never also show a red 'Overdue' badge");
  assert.equal(card.querySelector(".docket-checkbox-done") !== null, true);
});

test("assignmentCard only renders the completion checkbox when the source data has a real completion concept", () => {
  setupDom("<div></div>");
  const noConcept = assignmentCard({ title: "Labor Day" }); // e.g. a dashboard holiday marker
  assert.equal(noConcept.querySelector(".docket-checkbox"), null);

  const notDone = assignmentCard({ title: "Lab 3", completed: false });
  assert.ok(notDone.querySelector(".docket-checkbox"));
  assert.equal(notDone.querySelector(".docket-checkbox")?.getAttribute("aria-label"), "Not yet completed");
});

test("assignCourseColors assigns distinct colors up to the palette size, deterministically regardless of input order", () => {
  const codes = Array.from({ length: 12 }, (_, i) => `COURSE ${i}`);
  const colors = assignCourseColors(codes);
  const distinct = new Set(colors.values());
  assert.equal(distinct.size, 12, "12 real courses must never collide on the same accent color");

  // Order-independence: the same set of codes, shuffled, must map each code to the same color.
  const shuffled = [...codes].reverse();
  const colorsShuffled = assignCourseColors(shuffled);
  for (const code of codes) {
    assert.equal(colorsShuffled.get(code), colors.get(code), `${code} must get the same color regardless of extraction order`);
  }
});
