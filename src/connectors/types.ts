import type { AnnouncementRecord, AssignmentRecord, CourseRecord } from "../core/types.js";

/**
 * What kind of data a connector can actually provide. A connector should be
 * honest about this rather than returning empty arrays that look like "no
 * data exists" when the truth is "this connector doesn't cover that".
 */
export type ConnectorCapability =
  | "courses"
  | "assignments"
  | "grades"
  | "announcements"
  | "schedule"
  | "completionStatus";

/**
 * Every connector call fails soft. A thrown exception would let one bad
 * page/response corrupt an entire sync pass (see docs/ARCHITECTURE.md
 * §Resilient Synchronization / "stale is better than wrong").
 */
export type ConnectorResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ConnectorError };

export interface ConnectorError {
  code: "not_implemented" | "not_authenticated" | "parse_error" | "network_error" | "unexpected_shape";
  message: string;
  /** Safe to log — must never include cookies, tokens, or full response bodies. */
  diagnostic?: string;
}

export function connectorOk<T>(data: T): ConnectorResult<T> {
  return { ok: true, data };
}

export function connectorErr<T>(error: ConnectorError): ConnectorResult<T> {
  return { ok: false, error };
}

/**
 * The abstraction the rest of the app (sync engine, dashboard) depends on.
 * A LearningSuite-specific connector, a demo connector, and — one day — a
 * connector for a different school's LMS all implement this same shape.
 * Nothing outside src/connectors/ should know LearningSuite's URL patterns,
 * ajax.php RPC shape, or DOM structure.
 */
export interface LearningPlatformConnector {
  /** e.g. "learningsuite-ics", "learningsuite-session", "demo" */
  readonly id: string;
  readonly capabilities: readonly ConnectorCapability[];

  getCourses(): Promise<ConnectorResult<CourseRecord[]>>;
  getAssignments(courseId: string): Promise<ConnectorResult<AssignmentRecord[]>>;
  getAnnouncements(courseId: string): Promise<ConnectorResult<AnnouncementRecord[]>>;
}
