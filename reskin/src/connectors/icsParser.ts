/** Minimal RFC 5545 VEVENT parser for opt-in external calendar feeds. */
export interface IcsEvent {
  uid: string;
  summary: string;
  description?: string;
  startDate?: string;
  startDateTime?: string;
  endDate?: string;
  endDateTime?: string;
  allDay: boolean;
}

function unfold(raw: string): string[] {
  const lines: string[] = [];
  for (const line of raw.split(/\r\n|\n|\r/)) {
    if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }
  return lines;
}

const entities: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
  "&ldquo;": "“", "&rdquo;": "”", "&lsquo;": "‘", "&rsquo;": "’", "&ndash;": "–", "&mdash;": "—", "&hellip;": "…",
};

function unescapeText(value: string): string {
  let output = value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
  for (let index = 0; index < 3; index++) {
    const next = output
      .replace(/&(amp|lt|gt|quot|#39|apos|nbsp|ldquo|rdquo|lsquo|rsquo|ndash|mdash|hellip);/g, (match) => entities[match] ?? match)
      .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)));
    if (next === output) break;
    output = next;
  }
  return output;
}

function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | undefined {
  const colon = line.indexOf(":");
  if (colon < 0) return undefined;
  const [name, ...parameterParts] = line.slice(0, colon).split(";");
  if (!name) return undefined;
  const params: Record<string, string> = {};
  for (const part of parameterParts) {
    const equals = part.indexOf("=");
    if (equals >= 0) params[part.slice(0, equals).toUpperCase()] = part.slice(equals + 1);
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function parseDate(value: string): { date?: string; dateTime?: string } {
  const dateTime = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (dateTime) return { dateTime: `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}T${dateTime[4]}:${dateTime[5]}:${dateTime[6]}` };
  const date = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  return date ? { date: `${date[1]}-${date[2]}-${date[3]}` } : {};
}

export function parseIcs(raw: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: Partial<IcsEvent> | undefined;
  for (const line of unfold(raw)) {
    if (line === "BEGIN:VEVENT") { current = { allDay: false }; continue; }
    if (line === "END:VEVENT") {
      if (current?.uid && current.summary) events.push(current as IcsEvent);
      current = undefined;
      continue;
    }
    if (!current) continue;
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;
    if (name === "UID") current.uid = value.trim();
    if (name === "SUMMARY") current.summary = unescapeText(value.trim());
    if (name === "DESCRIPTION") current.description = unescapeText(value.trim());
    if (name === "DTSTART") {
      const parsedDate = parseDate(value.trim());
      if (parsedDate.date) { current.startDate = parsedDate.date; current.allDay = true; }
      if (parsedDate.dateTime) { current.startDateTime = parsedDate.dateTime; current.allDay = false; }
      if (params.VALUE === "DATE") current.allDay = true;
    }
    if (name === "DTEND") {
      const parsedDate = parseDate(value.trim());
      if (parsedDate.date) current.endDate = parsedDate.date;
      if (parsedDate.dateTime) current.endDateTime = parsedDate.dateTime;
    }
  }
  return events;
}
