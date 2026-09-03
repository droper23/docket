import type { AnnouncementRecord, AssignmentRecord, CourseRecord } from "../core/types.js";
import { derivedField, realField } from "../core/types.js";
import { assignmentStableId } from "../core/stableId.js";
import { connectorErr, connectorOk } from "./types.js";
import type { ConnectorResult, LearningPlatformConnector } from "./types.js";
import { parseIcs } from "./icsParser.js";

/**
 * One course the student is enrolled in, as they told Docket about it during
 * onboarding. Docket does not — and, per the LearningSuite ICS endpoint
 * having no auth (docs/ARCHITECTURE.md §1.4), must not — guess course IDs.
 * Only courses the user explicitly added are ever fetched.
 */
export interface KnownCourse {
  courseId: string;
  code: string;
  title: string;
  instructor?: string;
  term?: string;
  icsUrl: string;
}

/** LearningSuite's confirmed, unauthenticated per-course schedule feed URL pattern. */
export function icalFeedUrl(courseId: string): string {
  return `https://learningsuite.byu.edu/iCalFeed/ical.php?courseID=${encodeURIComponent(courseId)}`;
}

/**
 * Baseline connector: LearningSuite's per-course iCalendar feed. Confirmed
 * during prior research to require no authentication and to return the full
 * remaining-semester schedule (lecture topics, exams, quizzes, assignment
 * titles + due dates) as all-day events — no due *time*, no grades, no
 * completion status, no announcements. That's fine: it's the reliable,
 * zero-maintenance backbone; the authenticated session connector is the
 * opportunistic enrichment layer on top of it (see docs/ARCHITECTURE.md).
 */
export class IcsConnector implements LearningPlatformConnector {
  readonly id = "learningsuite-ics";
  readonly capabilities = ["courses", "assignments", "schedule"] as const;

  constructor(
    private readonly knownCourses: KnownCourse[],
    /** Injectable for tests / offline demo use — defaults to a real network fetch. */
    private readonly fetchIcs: (url: string) => Promise<string> = defaultFetchIcs,
  ) {}

  async getCourses(): Promise<ConnectorResult<CourseRecord[]>> {
    const now = new Date().toISOString();
    const courses: CourseRecord[] = this.knownCourses.map((c) => ({
      id: c.courseId,
      code: realField(c.code, "user-provided-course-list", now),
      title: realField(c.title, "user-provided-course-list", now),
      instructor: c.instructor ? realField(c.instructor, "user-provided-course-list", now) : undefined,
      term: c.term ? realField(c.term, "user-provided-course-list", now) : undefined,
    }));
    return connectorOk(courses);
  }

  async getAssignments(courseId: string): Promise<ConnectorResult<AssignmentRecord[]>> {
    const course = this.knownCourses.find((c) => c.courseId === courseId);
    if (!course) {
      return connectorErr({ code: "unexpected_shape", message: `Unknown courseId: not in this student's course list` });
    }

    let raw: string;
    try {
      raw = await this.fetchIcs(course.icsUrl);
    } catch (err) {
      return connectorErr({
        code: "network_error",
        message: "Could not fetch the course's iCalendar feed",
        diagnostic: err instanceof Error ? err.message : String(err),
      });
    }

    let events;
    try {
      events = parseIcs(raw);
    } catch (err) {
      return connectorErr({
        code: "parse_error",
        message: "Course schedule feed was not valid iCalendar data",
        diagnostic: err instanceof Error ? err.message : String(err),
      });
    }

    const capturedAt = new Date().toISOString();
    const assignments: AssignmentRecord[] = events.map((ev) => ({
      id: assignmentStableId(courseId, ev.uid),
      courseId,
      title: realField(ev.summary, "learningsuite-ics", capturedAt),
      // Derived, not real: the ICS feed doesn't tag a type at all — this is a title-keyword
      // guess, useful for effort estimation but never to be shown as LearningSuite fact.
      type: derivedField(inferAssignmentType(ev.summary), "title-keyword-heuristic", capturedAt),
      dueDate: (ev.startDate ?? ev.startDateTime?.slice(0, 10))
        ? realField((ev.startDate ?? ev.startDateTime!.slice(0, 10))!, "learningsuite-ics", capturedAt)
        : undefined,
      // The ICS feed never carries a time component per prior research — all-day only.
    }));

    return connectorOk(assignments);
  }

  async getAnnouncements(_courseId: string): Promise<ConnectorResult<AnnouncementRecord[]>> {
    return connectorErr({
      code: "not_implemented",
      message: "The iCalendar feed does not carry announcements — use the authenticated session connector",
    });
  }
}

/**
 * Title-keyword heuristic for assignment type — LearningSuite's ICS export
 * does not tag a type at all. Vocabulary matches what was actually observed
 * in a real student's Fall 2026 schedule feed across five courses spanning
 * math, engineering, dance, and religion — deliberately broad, not tuned to
 * one department.
 */
function inferAssignmentType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("exam") || t.includes("test") || t.includes("midterm") || t.includes("final")) return "exam";
  if (t.includes("quiz")) return "quiz";
  if (t.includes("read")) return "reading";
  if (t.includes("webassign") || t.includes("homework") || /\bhw\b/.test(t)) return "homework";
  if (t.includes("lab")) return "lab";
  if (t.includes("project")) return "project";
  if (t.includes("text item") || t.includes("syllabus")) return "text-item";
  return "other";
}

const RETRY_DELAYS_MS = [500, 1500, 4000];

/**
 * Confirmed live: this endpoint requires no authentication at all — no
 * cookies, no session. A plain, unattended-safe HTTP GET with a short retry
 * ladder for transient network hiccups, and a payload-shape check so a
 * non-ICS response (e.g. an HTML error page) is treated as a parse failure
 * rather than fed to the parser.
 */
async function defaultFetchIcs(url: string): Promise<string> {
  let lastError = "unknown error";

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: { Accept: "text/calendar" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status} ${res.statusText}`;
      } else {
        const text = await res.text();
        if (!text.startsWith("BEGIN:VCALENDAR")) {
          lastError = "response was not a valid ICS payload (missing BEGIN:VCALENDAR)";
        } else {
          return text;
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    const delay = RETRY_DELAYS_MS[attempt];
    if (delay !== undefined) await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error(lastError);
}
