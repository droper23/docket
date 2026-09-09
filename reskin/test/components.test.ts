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

test("dueBadge uses an exact clock deadline when LearningSuite provides one", () => {
  setupDom("<div></div>");
  const dueAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  assert.equal(dueBadge(0, undefined, dueAt)?.textContent, "Due in 2 hours");
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

test("gradeBadge never bands 'Total course progress' as failing, even at a real, low, early-semester value (Sep 2026 false-alarm bug)", () => {
  setupDom("<div></div>");
  // Confirmed live, real MATH 113 data: Current 100% (5/5 graded assignments, correctly green)
  // sat directly next to Total 0.71% in a red "failing" badge — Total counts every one of the
  // 166 not-yet-due assignments as a zero by construction, so it reads as catastrophic for
  // nearly the whole semester regardless of the student's actual standing.
  const total = gradeBadge("0.71%", true, true);
  assert.equal(total?.textContent, "0.71%");
  assert.equal(total?.className, "docket-badge docket-badge-neutral", "term progress is not a performance signal and must never band red/amber/green");

  // The "Current" column (the real performance signal) must be unaffected by this change.
  const current = gradeBadge("100%", true, false);
  assert.equal(current?.className, "docket-badge docket-badge-done");
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

test("assignmentCard shows an opening date and its separate deadline as chips", () => {
  setupDom("<div></div>");
  const card = assignmentCard({
    title: "Video Quiz 7.2",
    opensText: "today",
    daysUntilDue: 0,
    dueLabel: "Friday",
    dueDaysUntil: 2,
  });
  assert.deepEqual(
    Array.from(card.querySelectorAll(".docket-badge"), (badge) => badge.textContent),
    ["Opens today", "Due Friday"],
  );
});

test("assignmentCard only renders the completion checkbox when the source data has a real completion concept", () => {
  setupDom("<div></div>");
  const noConcept = assignmentCard({ title: "Labor Day" }); // e.g. a dashboard holiday marker
  assert.equal(noConcept.querySelector(".docket-checkbox"), null);

  const notDone = assignmentCard({ title: "Lab 3", completed: false });
  assert.ok(notDone.querySelector(".docket-checkbox"));
  assert.equal(notDone.querySelector(".docket-checkbox")?.getAttribute("aria-label"), "Not yet completed");
});

// Regression coverage for the Sep 2026 fix: checking an item off used to have no independent
// path at all — the whole card's onActivate (toggle.reveal() + a real click) was the only way
// to reach the native checkbox, so "checking something off" always kicked the page back to raw
// native LearningSuite. onToggleComplete is the card's own, separate, native-checkbox-driving path.

test("assignmentCard: completion and detail are separate controls", () => {
  setupDom("<div></div>");
  let toggled = 0;
  let activated = 0;
  const card = assignmentCard(
    { title: "Textbook 7.1", completed: false, onToggleComplete: () => toggled++ },
    () => activated++,
  );
  const checkbox = card.querySelector(".docket-checkbox") as HTMLElement;
  assert.equal(checkbox.getAttribute("role"), "checkbox", "an interactive checkbox must not stay role=img");
  assert.equal(checkbox.getAttribute("aria-checked"), "false");

  checkbox.click();
  assert.equal(toggled, 1);
  assert.equal(activated, 0, "clicking the checkbox must never also trigger the row's own onActivate");
  assert.ok(checkbox.classList.contains("docket-checkbox-done"), "the visual state must flip instantly, not wait on a re-render");
  assert.equal(checkbox.getAttribute("aria-checked"), "true");

  const open = card.querySelector(".docket-row-open") as HTMLElement;
  assert.equal(card.getAttribute("role"), null, "the row itself must not be an interactive wrapper");
  open.click();
  assert.equal(activated, 1, "opening details must remain available as its own control");
});

test("assignmentCard: Space toggles a keyboard-focused interactive checkbox the same way a click does", () => {
  setupDom("<div></div>");
  let toggled = 0;
  const card = assignmentCard({ title: "Textbook 7.1", completed: false, onToggleComplete: () => toggled++ });
  const checkbox = card.querySelector(".docket-checkbox") as HTMLElement;
  assert.equal(checkbox.getAttribute("tabindex"), "0");
  const event = new (globalThis as any).window.KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
  checkbox.dispatchEvent(event);
  assert.equal(toggled, 1);
  assert.ok(checkbox.classList.contains("docket-checkbox-done"));
});

test("assignmentCard: without onToggleComplete the checkbox stays exactly the old decorative role=img mark", () => {
  setupDom("<div></div>");
  const card = assignmentCard({ title: "Assignment", completed: true }); // assignmentsAdapter.ts's current usage
  const checkbox = card.querySelector(".docket-checkbox") as HTMLElement;
  assert.equal(checkbox.getAttribute("role"), "img");
  assert.equal(checkbox.getAttribute("aria-checked"), null);
  assert.equal(checkbox.getAttribute("tabindex"), null);
});

// Regression coverage for the Sep 2026 fix: a plain topic/lesson line or university calendar
// entry (Combined Schedule's "kind") isn't actually due on the date it's grouped under, but
// used to still get a full urgency badge (e.g. a scary "Overdue by N days") since dueBadge()
// only ever looked at daysUntilDue/completed, never at whether the line was really a deadline.

test("assignmentCard: an 'info' or 'calendar' kind item never shows a due-urgency badge, even with a real daysUntilDue", () => {
  setupDom("<div></div>");
  const info = assignmentCard({ title: "Appendix D: Trigonometry", daysUntilDue: -2, kind: "info" });
  assert.equal(info.querySelector(".docket-badge"), null);
  const calendar = assignmentCard({ title: "Labor Day", daysUntilDue: 1, kind: "calendar" });
  assert.equal(calendar.querySelector(".docket-badge"), null);
  const due = assignmentCard({ title: "Recitation Quiz 9/8", daysUntilDue: 1, kind: "due" });
  assert.ok(due.querySelector(".docket-badge"), "a real due item must keep its badge");
});

test("assignmentCard: an 'info'/'calendar' kind item is visually muted via docket-row-info", () => {
  setupDom("<div></div>");
  const info = assignmentCard({ title: "Chapter 2.1", kind: "info" });
  assert.ok(info.classList.contains("docket-row-info"));
  const due = assignmentCard({ title: "WebAssign 7.1", kind: "due" });
  assert.equal(due.classList.contains("docket-row-info"), false);
});

test("assignmentCard: informational items never expose a completion control", () => {
  setupDom("<div></div>");
  const info = assignmentCard({ title: "Appendix D", kind: "info", completed: false, onToggleComplete: () => {} }, () => {});
  assert.equal(info.querySelector(".docket-checkbox"), null);
  assert.ok(info.querySelector(".docket-row-open"), "resources can still be opened without looking like tasks");
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

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Regression test for the "no two exact hex values collide, but two adjacent ones are still
 * perceptually indistinguishable at a glance" bug (Sep 2026, confirmed live: the palette's old
 * index-1 red and index-4 orange, both landing in a real 5-course account's small N). Distinct
 * hex values alone (the previous guarantee) don't imply any minimum VISUAL separation — this
 * asserts an actual hue-distance floor for every prefix length a real course load could hit.
 */
test("assignCourseColors keeps every prefix length's colors at a minimum hue distance, not just distinct hex values", () => {
  const codes = Array.from({ length: 12 }, (_, i) => `COURSE ${String(i).padStart(2, "0")}`);
  const colors = assignCourseColors(codes);
  const hexInOrder = codes.map((c) => colors.get(c)!);
  const hues = hexInOrder.map(hexToHue);

  for (let n = 2; n <= 8; n++) {
    let minDist = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        minDist = Math.min(minDist, hueDistance(hues[i]!, hues[j]!));
      }
    }
    // A real 4-8 course account (the common case) must never see two hues this close — the old
    // palette's red/orange pair measured ~11° apart; 25° is a real, visually-distinguishable
    // floor for these common prefix lengths.
    assert.ok(minDist >= 25, `first ${n} palette colors must stay at least 25° apart in hue, got ${minDist.toFixed(1)}° (hues: ${hues.slice(0, n).map((h) => h.toFixed(0)).join(", ")})`);
  }
});
