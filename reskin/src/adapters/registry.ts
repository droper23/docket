import type { Adapter } from "./types.js";
import { courseListAdapter } from "./courseListAdapter.js";
import { assignmentsAdapter } from "./assignmentsAdapter.js";
import { homeAdapter } from "./homeAdapter.js";
import { gradesAdapter } from "./gradesAdapter.js";
import { gradeSummaryAdapter } from "./gradeSummaryAdapter.js";
import { dashboardAdapter } from "./dashboardAdapter.js";

/**
 * First match wins. Announcements/Calendar have no adapter yet — an
 * unmatched page is functionally identical to a "stub that no-ops" (spec
 * §27's fallback), just without dead code to maintain: LearningSuite's
 * native UI is simply never touched. See reskin/ROADMAP.md for the plan to
 * add them.
 *
 * gradesAdapter and gradeSummaryAdapter are listed ahead of the generic
 * pages they'd otherwise collide with (courseListAdapter/assignmentsAdapter)
 * — see pageDetector.ts's own comments on each collision this order
 * resolves (Grades vs. Assignments' identical row shape; Grade Summary vs.
 * Course List's shared per-course cid- anchors). dashboardAdapter is listed
 * before courseListAdapter for the same reason: a course Dashboard also
 * carries the generic clickable-row shape courseListAdapter's fallback
 * detection reacts to, so the more specific match must win first.
 */
export const adapters: Adapter[] = [
  gradesAdapter,
  gradeSummaryAdapter,
  dashboardAdapter,
  courseListAdapter,
  assignmentsAdapter,
  homeAdapter,
];
