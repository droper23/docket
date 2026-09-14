/** Date helpers anchored to BYU's Mountain Time calendar. */
const SCHOOL_TIME_ZONE = "America/Denver";

const isoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayInSchoolTimeZone(): string {
  return isoDateFormatter.format(new Date());
}

function parseIsoDateAsUtcMidnight(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function daysBetween(fromDateStr: string, toDateStr: string): number {
  return Math.round((parseIsoDateAsUtcMidnight(toDateStr) - parseIsoDateAsUtcMidnight(fromDateStr)) / 86_400_000);
}

export function daysUntilInSchoolTimeZone(dateStr: string): number {
  return daysBetween(todayInSchoolTimeZone(), dateStr);
}

/** Convert a LearningSuite date and 12-hour Mountain-time label into an instant. */
export function schoolDateTime(dateStr: string, time: string): Date | undefined {
  const date = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const clock = time.match(/^(\d{1,2}):(\d{2})\s*([ap]m)\b/i);
  if (!date || !clock) return undefined;
  const year = Number(date[1]);
  const month = Number(date[2]);
  const day = Number(date[3]);
  let hour = Number(clock[1]);
  const minute = Number(clock[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 1 || hour > 12 || minute > 59) return undefined;
  hour = (hour % 12) + (clock[3]!.toLowerCase() === "pm" ? 12 : 0);
  const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: SCHOOL_TIME_ZONE,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const part = (type: string) => Number(parts.find((value) => value.type === type)?.value);
    return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute")) - instant;
  };
  let instant = wallClockUtc - offsetAt(wallClockUtc);
  instant = wallClockUtc - offsetAt(instant);
  return new Date(instant);
}
