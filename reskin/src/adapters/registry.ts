import type { Adapter } from "./types.js";
import { courseListAdapter } from "./courseListAdapter.js";
import { assignmentsAdapter } from "./assignmentsAdapter.js";
import { homeAdapter } from "./homeAdapter.js";

/**
 * First match wins. Grades/Announcements/Calendar have no adapter yet — an
 * unmatched page is functionally identical to a "stub that no-ops" (spec
 * §27's fallback), just without dead code to maintain: LearningSuite's
 * native UI is simply never touched. See reskin/ROADMAP.md for the plan to
 * add them.
 */
export const adapters: Adapter[] = [courseListAdapter, assignmentsAdapter, homeAdapter];
