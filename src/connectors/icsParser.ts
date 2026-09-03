/**
 * Minimal RFC 5545 (iCalendar) VEVENT parser — just enough to read the
 * LearningSuite course-schedule feed. Deliberately hand-rolled instead of
 * pulling in a general-purpose ICS library: LearningSuite's feed only uses
 * VEVENT blocks with a handful of properties (confirmed during prior
 * research), and a smaller surface area is easier to keep correct than a
 * full RFC 5545 implementation with recurrence rules, timezones, etc. we
 * don't need. See docs/ARCHITECTURE.md §Supply Chain.
 */

export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  /** ISO date (YYYY-MM-DD) if this is an all-day event */
  startDate?: string;
  /** ISO datetime if this event carries a time component */
  startDateTime?: string;
  endDate?: string;
  endDateTime?: string;
  allDay: boolean;
}

/** Un-fold RFC 5545 continuation lines: a line starting with a space or tab continues the previous line. */
function unfold(raw: string): string[] {
  const rawLines = raw.split(/\r\n|\n|\r/);
  const lines: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&ndash;": "–",
  "&mdash;": "—",
  "&hellip;": "…",
};

/**
 * LearningSuite's own ICS export leaves some titles with undecoded HTML
 * entities (e.g. a literal "&ldquo;" instead of a curly quote) — a real,
 * previously-observed data-quality quirk in production feeds, not a
 * hypothetical. Decode the common ones rather than showing raw markup to
 * students. Runs after ICS-level unescaping, and also handles a double-
 * escaped case like "&amp;ldquo;" (the "&amp;" unescapes first, revealing
 * "&ldquo;" for this pass to catch).
 */
function decodeHtmlEntities(value: string): string {
  let out = value;
  // Loop rather than a single pass: a double-escaped entity like "&amp;ldquo;"
  // only reveals "&ldquo;" after the &amp; itself is decoded — this was an
  // actual observed case in a real LearningSuite ICS export.
  for (let i = 0; i < 3; i++) {
    const next = out
      .replace(/&(amp|lt|gt|quot|#39|apos|nbsp|ldquo|rdquo|lsquo|rsquo|ndash|mdash|hellip);/g, (m) => HTML_ENTITIES[m] ?? m)
      .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)));
    if (next === out) break;
    out = next;
  }
  return out;
}

function unescapeText(value: string): string {
  const icsUnescaped = value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
  return decodeHtmlEntities(icsUnescaped);
}

/** Parses "NAME;PARAM=X;PARAM2=Y:VALUE" into { name, params, value }. */
function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) return null;
  const head = line.slice(0, colonIndex);
  const value = line.slice(colonIndex + 1);
  const [name, ...paramParts] = head.split(";");
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

/** DTSTART style value like "20260905" (date) or "20260905T190000Z" / "20260905T190000" (datetime). */
function parseDateValue(value: string): { date?: string; dateTime?: string } {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/;
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/;
  let m = value.match(dateTime);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    return { dateTime: `${y}-${mo}-${d}T${h}:${mi}:${s}` };
  }
  m = value.match(dateOnly);
  if (m) {
    const [, y, mo, d] = m;
    return { date: `${y}-${mo}-${d}` };
  }
  return {};
}

export function parseIcs(raw: string): IcsEvent[] {
  const lines = unfold(raw);
  const events: IcsEvent[] = [];
  let current: Partial<IcsEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = { allDay: false };
      continue;
    }
    if (line === "END:VEVENT") {
      if (current && current.uid && current.summary) {
        events.push(current as IcsEvent);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;

    switch (name) {
      case "UID":
        current.uid = value.trim();
        break;
      case "SUMMARY":
        current.summary = unescapeText(value.trim());
        break;
      case "DESCRIPTION":
        current.description = unescapeText(value.trim());
        break;
      case "DTSTART": {
        const { date, dateTime } = parseDateValue(value.trim());
        if (date) {
          current.startDate = date;
          current.allDay = params.VALUE === "DATE" || true;
        }
        if (dateTime) {
          current.startDateTime = dateTime;
          current.allDay = false;
        }
        break;
      }
      case "DTEND": {
        const { date, dateTime } = parseDateValue(value.trim());
        if (date) current.endDate = date;
        if (dateTime) current.endDateTime = dateTime;
        break;
      }
      default:
        break;
    }
  }

  return events;
}
