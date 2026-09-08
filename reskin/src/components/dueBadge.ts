import { h } from "../lib/dom.js";
import { dueCountdown } from "../../../src/core/agendaFormatting.js";

/**
 * Reminders/Calendar-app-style urgency bands, reusing the exact wording
 * src/core/agendaFormatting.ts (shared with the Docket dashboard) already
 * produces, just re-colored to Apple's system palette instead of Docket's
 * amber one. Five real bands, not two — a flat "everything past tomorrow
 * is the same gray" badge defeats the entire point of an urgency
 * indicator, since a card due tomorrow and one due in 6 days used to read
 * identically at a glance (confirmed live, Sep 2026 UX audit — this doc
 * comment had described five bands for several passes without the code
 * actually implementing more than three):
 *   overdue           -> red
 *   due today         -> strongest amber ("soon")
 *   due tomorrow      -> amber, one step down ("tomorrow")
 *   due within 7 days -> pale amber, barely warmer than neutral ("week")
 *   beyond that (or no due date) -> neutral gray
 */
/**
 * `opensText`, when given, means this item is an availability date, not a deadline (e.g.
 * assignmentsAdapter.ts's "Opens Sep 9" status column, or homeAdapter.ts's Combined Schedule
 * rows whose own real title ends in the word "Opens" — both confirmed live, Sep 2026). An
 * "opens" item never goes through the urgency ladder below, regardless of the sign of
 * `daysUntilDue` — a negative value there means "opened N days ago," not "overdue by N days,"
 * and coloring that red was a real, alarming false positive.
 */
export function dueBadge(daysUntilDue: number | undefined, opensText?: string): HTMLElement | null {
  if (opensText) {
    return h("span", { class: "docket-badge docket-badge-neutral" }, [`Opens ${opensText}`]);
  }
  const label = dueCountdown(daysUntilDue);
  if (!label) return null;
  let role = "neutral";
  if (daysUntilDue !== undefined) {
    if (daysUntilDue < 0) role = "overdue";
    else if (daysUntilDue === 0) role = "soon";
    else if (daysUntilDue === 1) role = "tomorrow";
    else if (daysUntilDue <= 7) role = "week";
  }
  return h("span", { class: `docket-badge docket-badge-${role}` }, [label]);
}
