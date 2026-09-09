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
 * "opens" item never goes through the due-urgency ladder below, regardless of the sign of
 * `daysUntilDue` — a negative value there means "opened N days ago," not "overdue by N days,"
 * and coloring that red was a real, alarming false positive.
 *
 * It still gets a two-way color of its own, using the same `daysUntilDue` value (both callers
 * pass the days-until-THIS-date, not the days-until-some-other-due-date — see homeAdapter.ts's
 * `daysUntilInSchoolTimeZone(item.dateIso)` and assignmentsAdapter.ts's opens-aware reordering):
 * not yet open (`daysUntilDue >= 0`) reuses the "done" role's green, since the item is on its
 * way to becoming available rather than needing attention yet; already open in the past (or no
 * date at all) stays neutral gray, same as before.
 */
export function dueBadge(daysUntilDue: number | undefined, opensText?: string, dueAt?: Date, label?: string): HTMLElement | null {
  if (opensText) {
    const role = daysUntilDue !== undefined && daysUntilDue >= 0 ? "done" : "neutral";
    return h("span", { class: `docket-badge docket-badge-${role}` }, [`Opens ${opensText}`]);
  }
  const countdown = label ?? dueCountdown(daysUntilDue, dueAt);
  if (!countdown) return null;
  let role = "neutral";
  if (daysUntilDue !== undefined) {
    if (dueAt && dueAt <= new Date()) role = "overdue";
    else if (daysUntilDue < 0) role = "overdue";
    else if (daysUntilDue === 0) role = "soon";
    else if (daysUntilDue === 1) role = "tomorrow";
    else if (daysUntilDue <= 7) role = "week";
  }
  return h("span", { class: `docket-badge docket-badge-${role}` }, [countdown]);
}
