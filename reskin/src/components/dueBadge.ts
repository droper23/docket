import { h } from "../lib/dom.js";
import { dueCountdown } from "../../../src/core/agendaFormatting.js";

/**
 * Reminders/Calendar-app-style urgency bands, reusing the exact wording
 * src/core/agendaFormatting.ts (shared with the Docket dashboard) already
 * produces, just re-colored to Apple's system palette instead of Docket's
 * amber one. Five real bands, not two — a flat "everything past tomorrow
 * is the same gray" badge defeats the entire point of an urgency
 * indicator, since a card due in 2 days and one due in 105 days read
 * identically at a glance:
 *   overdue          -> red
 *   due today/tomorrow -> red-orange
 *   due within 3 days  -> orange
 *   due within 7 days  -> yellow
 *   beyond that (or no due date) -> neutral gray
 */
export function dueBadge(daysUntilDue: number | undefined): HTMLElement | null {
  const label = dueCountdown(daysUntilDue);
  if (!label) return null;
  let color = "docket-badge-gray";
  if (daysUntilDue !== undefined) {
    if (daysUntilDue < 0) color = "docket-badge-red";
    else if (daysUntilDue <= 1) color = "docket-badge-red-orange";
    else if (daysUntilDue <= 3) color = "docket-badge-orange";
    else if (daysUntilDue <= 7) color = "docket-badge-yellow";
  }
  return h("span", { class: `docket-badge ${color}` }, [label]);
}
