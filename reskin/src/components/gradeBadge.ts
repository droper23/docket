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
export function gradeBadge(percentLabel: string | undefined): HTMLElement | null {
  if (!percentLabel) return null;
  const value = parseFloat(percentLabel);
  let color = "docket-badge-gray";
  if (!Number.isNaN(value)) {
    if (value >= 90) color = "docket-badge-green";
    else if (value >= 80) color = "docket-badge-blue";
    else if (value >= 70) color = "docket-badge-yellow";
    else color = "docket-badge-red";
  }
  return h("span", { class: `docket-badge ${color}` }, [percentLabel]);
}
