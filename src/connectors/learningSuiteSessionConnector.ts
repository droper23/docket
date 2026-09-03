import type { AnnouncementRecord, AssignmentRecord, CourseRecord } from "../core/types.js";
import { connectorErr } from "./types.js";
import type { ConnectorResult, LearningPlatformConnector } from "./types.js";

/**
 * Enrichment connector: reads data only visible in an authenticated
 * LearningSuite session (due *time*, points earned, completion status,
 * announcements). This is the piece that must run inside a Safari Web
 * Extension riding along on a session the student already opened — see
 * docs/ARCHITECTURE.md §Authentication for why this can never run
 * unattended (Duo) and must never store a password or long-lived cookie.
 *
 * STATUS: interface-conformant skeleton only. Prior research (see the
 * handoff doc) confirmed the *shape* of the ajax.php RPC protocol
 * (funcName / funcParams / classname / contructorParams) by observing one
 * live request, but did not capture full response payloads or DOM
 * selectors for courses/grades/announcements — doing that safely requires
 * a human with an active session running the Phase 2 userscript prototype
 * (docs/ROADMAP.md), not fabricated fixtures. Every method here fails soft
 * with `not_implemented` until that capture happens and real parsing logic
 * replaces this file. Do not guess response shapes and ship them as if
 * verified — that violates the provenance guarantee this whole project is
 * built on (nothing gets labeled "real" that wasn't actually observed).
 */
export class LearningSuiteSessionConnector implements LearningPlatformConnector {
  readonly id = "learningsuite-session";
  readonly capabilities = ["assignments", "grades", "announcements", "completionStatus"] as const;

  async getCourses(): Promise<ConnectorResult<CourseRecord[]>> {
    return connectorErr({
      code: "not_implemented",
      message: "Authenticated course discovery not yet implemented — pending Phase 2 capture",
    });
  }

  async getAssignments(_courseId: string): Promise<ConnectorResult<AssignmentRecord[]>> {
    return connectorErr({
      code: "not_implemented",
      message: "Authenticated assignment/grade extraction not yet implemented — pending Phase 2 capture",
    });
  }

  async getAnnouncements(_courseId: string): Promise<ConnectorResult<AnnouncementRecord[]>> {
    return connectorErr({
      code: "not_implemented",
      message: "Authenticated announcement extraction not yet implemented — pending Phase 2 capture",
    });
  }
}
