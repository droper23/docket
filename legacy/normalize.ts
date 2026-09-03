import { createHash } from "node:crypto";
import ical from "node-ical";
import type { AssignmentEvent, AssignmentType } from "./types.js";

/**
 * Heuristic only — LearningSuite does not tag assignment type in the ICS
 * feed. This is a derived field; never present it as if LearningSuite said it.
 */
function inferType(title: string): AssignmentType {
  const t = title.toLowerCase();
  if (t.includes("exam") || t.includes("test")) return "exam";
  if (t.includes("quiz")) return "quiz";
  if (t.includes("read")) return "reading";
  if (t.includes("webassign") || t.includes("homework") || t.includes(" hw")) return "homework";
  if (t.includes("text item") || t.includes("syllabus")) return "text-item";
  return "other";
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * LearningSuite's own ICS export leaves some titles with undecoded HTML
 * entities (observed live, e.g. literal "&ldquo" text). Decode the common
 * ones so the dashboard shows readable text — this is display cleanup of
 * LearningSuite's real title, not an invented field.
 */
const HTML_ENTITIES: Record<string, string> = {
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&lsquo;": "‘",
  "&rsquo;": "’",
  "&amp;": "&",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
};

function decodeEntities(text: string): string {
  let out = text;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    out = out.split(entity).join(char);
  }
  return out.replace(/\s+/g, " ").trim();
}

function contentHash(title: string, dueDate: string): string {
  return createHash("sha256").update(`${title}|${dueDate}`).digest("hex").slice(0, 16);
}

export function normalizeIcs(
  icsText: string,
  courseId: string,
  syncedAt: string,
): AssignmentEvent[] {
  const parsed = ical.sync.parseICS(icsText);
  const events: AssignmentEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== "VEVENT") continue;
    if (!item.start || !item.summary) continue;

    const uid = item.uid ?? key;
    const title = decodeEntities(String(item.summary));
    if (!title) continue; // LearningSuite occasionally exports a blank-summary event
    const dueDate = toIsoDate(new Date(item.start));
    const stableId = `${courseId}:${uid}`;

    events.push({
      stableId,
      courseId,
      uid,
      title,
      dueDate,
      inferredType: inferType(title),
      lastContentHash: contentHash(title, dueDate),
      lastSyncedAt: syncedAt,
      missingStreak: 0,
      source: "ical",
    });
  }

  return events;
}
