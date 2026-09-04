/**
 * Parses LearningSuite's own "Sep 4 11:59 pm MDT"-shaped due text (read live
 * off an Assignments-page row — see src/connectors/bookmarklet.ts's
 * assignmentsExtractorSource(), same regex shape) into a calendar date, so
 * the reskin can feed it to the shared agendaFormatting.ts wording
 * functions. The header never carries a year — nearestYearDate() reuses the
 * exact heuristic scheduleExtractorSource()'s parseHeaderDate() already
 * validated live: pick whichever of this-year/adjacent-year is closer to
 * today.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function nearestYearDate(month0: number, day: number, now = new Date()): Date {
  const a = new Date(now.getFullYear(), month0, day);
  const b = new Date(now.getFullYear() + (a < now ? 1 : -1), month0, day);
  return Math.abs(b.getTime() - now.getTime()) < Math.abs(a.getTime() - now.getTime()) ? b : a;
}

/** Y-M-D from LOCAL date fields, deliberately not `toISOString()` (which converts through
 * UTC and can shift the calendar date by a day for viewers east of UTC). */
export function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * "9/11 - Friday" -> a real Date — same shape and heuristic as
 * src/connectors/bookmarklet.ts's scheduleExtractorSource() parseHeaderDate()
 * (Combined Schedule's day headers use M/D, never Month-name/D like an
 * Assignments-page row's due text does).
 */
export function parseSlashDate(text: string): Date | null {
  const m = text.match(/^(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const month0 = Number(m[1]) - 1;
  const day = Number(m[2]);
  return nearestYearDate(month0, day);
}

export interface ParsedDue {
  iso?: string;
  time?: string;
}

export function parseAssignmentDueText(text: string | undefined | null): ParsedDue {
  if (!text) return {};
  const m = text.match(/([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{1,2}:\d{2}\s*[ap]m\s*[A-Z]{2,5}))?/);
  if (!m) return {};
  const month0 = MONTHS.indexOf((m[1] ?? "").toLowerCase());
  if (month0 === -1) return {};
  const day = Number(m[2]);
  if (!Number.isFinite(day)) return {};
  const iso = formatIsoDate(nearestYearDate(month0, day));
  return { iso, time: m[3] };
}
