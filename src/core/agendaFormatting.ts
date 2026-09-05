/**
 * Human-phrased due-date/countdown labels and day-grouping — pure functions,
 * only dependent on schoolTime.ts (Intl.DateTimeFormat-based, already
 * browser-portable). Extracted out of src/server/render.ts so the exact same
 * wording/logic can be bundled into the LearningSuite reskin userscript
 * (reskin/) without re-implementing it — see reskin/README.md and
 * docs/ARCHITECTURE.md for why this file has no Node-specific dependency.
 */
import { daysBetween, todayInSchoolTimeZone } from "./schoolTime.js";
import type { AgendaItem } from "./academicViews.js";

/** "Due in 3 days" / "Due today" / "Overdue by 2 days" — the countdown itself, not just a due-date string, is what makes it obvious what needs doing now vs. later. */
export function dueCountdown(daysUntilDue: number | undefined): string | undefined {
  if (daysUntilDue === undefined) return undefined;
  if (daysUntilDue < 0) {
    const n = Math.abs(daysUntilDue);
    return `Overdue by ${n} day${n === 1 ? "" : "s"}`;
  }
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${daysUntilDue} days`;
}

/** "Today" / "Tomorrow" / "Wednesday, September 3" — mirrors LearningSuite's own Combined Schedule day headers. */
export function dayLabel(dateStr: string): string {
  // daysBetween anchors "today" to BYU's own timezone (src/core/schoolTime.ts), not the
  // server's — this is the same class of bug that made most assignments show up as "due
  // today," now fixed in one shared place both the countdown and this label go through.
  const diffDays = daysBetween(todayInSchoolTimeZone(), dateStr);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  // UTC here is deliberate, not a shortcut: dateStr is a bare calendar date with no
  // time-of-day, so parsing/formatting it consistently in one fixed zone (rather than
  // whichever zone the server happens to be running in) is what keeps "September 4"
  // from ever silently becoming "September 3" or "September 5" depending on server TZ.
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * "Due Friday" / "Due next Tuesday" / "Due last Monday" — the inline meta line's due-date
 * text, phrased the way a person would say it out loud, never a bare ISO string. Distinct
 * from dueCountdown's "Due in 3 days" badge: that's the urgency signal, this is "which day
 * is that." Beyond ~2 weeks out (or overdue) a bare weekday is ambiguous, so it falls back
 * to a full "Weekday, Month Day" — same fallback dayLabel uses for its out-of-range case.
 */
export function dueDateLabel(dateStr: string | undefined): string {
  if (!dateStr) return "no due date";
  const diffDays = daysBetween(todayInSchoolTimeZone(), dateStr);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  const date = new Date(`${dateStr}T00:00:00Z`);
  const weekday = date.toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" });
  if (diffDays > 1 && diffDays < 7) return weekday;
  if (diffDays >= 7 && diffDays < 14) return `next ${weekday}`;
  if (diffDays < -1 && diffDays > -7) return `last ${weekday}`;
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Groups already-sorted agenda items by due date so a page can show day
 * headers — see docs/ARCHITECTURE.md §8: LearningSuite's own Combined
 * Schedule always groups by day, and a flat list made it hard to tell "due
 * today" apart from "due later" at a glance. Items are assumed pre-sorted
 * chronologically (academicViews.ts already does this) — this only groups,
 * never re-sorts.
 */
export function groupByDueDate(items: AgendaItem[]): { date: string; items: AgendaItem[] }[] {
  const groups: { date: string; items: AgendaItem[] }[] = [];
  for (const item of items) {
    const date = item.assignment.dueDate?.value ?? "unknown";
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.items.push(item);
    } else {
      groups.push({ date, items: [item] });
    }
  }
  return groups;
}
