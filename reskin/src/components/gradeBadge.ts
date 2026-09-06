import { h } from "../lib/dom.js";

/**
 * Grade-performance coloring, the same five-tier idea dueBadge.ts uses for due-date
 * urgency but banded around real letter-grade cutoffs (90/80/70) instead of days-until-due.
 * Explicitly deferred by an earlier pass ("requires reading and classifying the displayed
 * number in JS, which is adapter-shaped risk this pass deliberately avoided") — now safe to
 * add because gradeSummaryAdapter.ts already parses the real percentage text as part of its
 * own extraction, so no new DOM reading is introduced here, just a color decision on data
 * already in hand.
 */
/**
 * `hasBeenScored` (confirmed live, Sep 2026, real Grade Summary page): a course with nothing
 * graded yet reads its "Current"/"Total" percentage as a real "0%," and that used to band
 * straight into the same red "failing" chip as a genuinely low score — the two are not the
 * same thing, and telling a student their un-started course is failing is a real, alarming
 * false positive. Defaults to `true` so any other caller (there are none today) keeps the old
 * behavior unless it explicitly says otherwise.
 */
export function gradeBadge(percentLabel: string | undefined, hasBeenScored = true): HTMLElement | null {
  if (!percentLabel) return null;
  if (!hasBeenScored) {
    return h("span", { class: "docket-badge docket-badge-neutral" }, ["Not yet graded"]);
  }
  const value = parseFloat(percentLabel);
  let role = "neutral";
  if (!Number.isNaN(value)) {
    if (value >= 90) role = "done";
    else if (value >= 80) role = "upcoming";
    else if (value >= 70) role = "soon";
    else role = "overdue";
  }
  return h("span", { class: `docket-badge docket-badge-${role}` }, [percentLabel]);
}
