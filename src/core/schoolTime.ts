/**
 * All "days until due" / "which day is this" math has to be anchored to
 * one timezone, and it can't be whatever timezone the server process
 * happens to run in — a real bug, not a hypothetical: this project's own
 * local dev machine happens to already be set to America/Denver, so the
 * bug was completely invisible locally and only showed up once deployed,
 * where Vercel's Node runtime defaults to UTC. A student in Mountain Time
 * checking Docket at 9pm was seeing "now" computed as if it were already
 * ~3am the next UTC day — enough to shift a real cluster of assignments
 * due "today" into the wrong bucket. The fix isn't "use the visitor's
 * browser timezone" either: LearningSuite's own due dates are always
 * Mountain Time regardless of where a student happens to be sitting when
 * they check (studying abroad doesn't move when a BYU deadline is), so
 * BYU's own timezone is the one correct, fixed reference frame — not the
 * server's, not the viewer's.
 */
const SCHOOL_TIME_ZONE = "America/Denver";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date (YYYY-MM-DD) in BYU's own timezone, regardless of the server's. */
export function todayInSchoolTimeZone(): string {
  return isoDateFormatter.format(new Date());
}

function parseIsoDateAsUtcMidnight(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/**
 * Whole calendar days between two YYYY-MM-DD dates — pure date arithmetic,
 * deliberately not clock-time math (no `Math.ceil` on a fractional-hours
 * difference): both dates are anchored to the same synthetic UTC midnight,
 * so "due today" is always exactly 0, "due tomorrow" is always exactly 1,
 * with no time-of-day or DST edge cases sneaking in.
 */
export function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = parseIsoDateAsUtcMidnight(fromDateStr);
  const to = parseIsoDateAsUtcMidnight(toDateStr);
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

/** Days between "today" (BYU time) and a due date — the one function the rest of the app should use for this. */
export function daysUntilInSchoolTimeZone(dateStr: string): number {
  return daysBetween(todayInSchoolTimeZone(), dateStr);
}
