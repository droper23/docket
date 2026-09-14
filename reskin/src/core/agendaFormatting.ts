import { daysBetween, todayInSchoolTimeZone } from "./schoolTime.js";

export function dueCountdown(daysUntilDue: number | undefined, dueAt?: Date, now = new Date()): string | undefined {
  if (daysUntilDue === undefined) return undefined;
  if (dueAt) {
    const minutes = Math.max(1, Math.ceil(Math.abs(dueAt.getTime() - now.getTime()) / 60_000));
    const duration = minutes < 60
      ? `${minutes} minute${minutes === 1 ? "" : "s"}`
      : minutes < 1_440
        ? `${Math.ceil(minutes / 60)} hour${Math.ceil(minutes / 60) === 1 ? "" : "s"}`
        : `${Math.floor(minutes / 1_440)} day${Math.floor(minutes / 1_440) === 1 ? "" : "s"}${minutes % 1_440 >= 60 ? ` ${Math.ceil((minutes % 1_440) / 60)} hour${Math.ceil((minutes % 1_440) / 60) === 1 ? "" : "s"}` : ""}`;
    return dueAt > now ? `Due in ${duration}` : `Overdue by ${duration}`;
  }
  if (daysUntilDue < 0) return `Overdue by ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"}`;
  if (daysUntilDue === 0) return "Due today";
  if (daysUntilDue === 1) return "Due tomorrow";
  return `Due in ${daysUntilDue} days`;
}

export function dayLabel(dateStr: string): string {
  const diffDays = daysBetween(todayInSchoolTimeZone(), dateStr);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

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
