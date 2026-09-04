/**
 * LearningSuite triggers a full page reload between top-level sections and
 * has no discoverable client-side route table (learningsuite-handoff.md
 * §1.1) — so there is no single "router" to hook. Detection here is
 * deliberately DOM-signature-first, matching the same validated approach
 * src/connectors/bookmarklet.ts already uses (it alerts "wrong page" from a
 * content check, not a path check): only two URL shapes are actually
 * confirmed live (course-scoped pages carry `cid-{courseID}`, and Combined
 * Schedule carries `/top/schedule`) — everything else is inferred from DOM
 * content already proven stable by the bookmarklet extractors, not from a
 * guessed path segment.
 */

/** Confirmed live: every course-scoped LearningSuite page's path contains this segment. */
export function courseIdFromUrl(pathname: string = location.pathname): string | undefined {
  return pathname.match(/cid-([^/]+)/)?.[1];
}

/** Confirmed live: Combined Schedule's URL always has this suffix. */
export function isScheduleUrl(pathname: string = location.pathname): boolean {
  return /\/top\/schedule\b/.test(pathname);
}

/**
 * Course List page detection. `src/connectors/bookmarklet.ts`'s
 * courseListExtractorSource() relies on several `cid-...` course links
 * inside `<main>` — that shape is checked first, but confirmed LIVE against
 * a real account (Sep 2026) to no longer be how this page actually renders:
 * each row is now a Vue `<p class="cursor-pointer">` with a click handler
 * and no static href anywhere (the courseID only appears in the resulting
 * URL after the handler runs — see adapters/courseListAdapter.ts). Checking
 * for that shape too is what makes detection work again on the current
 * page; either way, a course-scoped URL (`cid-` already in the URL itself)
 * is never a Course List page.
 */
export function looksLikeCourseListPage(doc: Document = document): boolean {
  if (courseIdFromUrl()) return false;
  const hasAnchorShape = doc.querySelectorAll("main a[href*='cid-']").length > 1;
  const hasClickableRowShape = doc.querySelectorAll("main p.cursor-pointer").length > 1;
  return hasAnchorShape || hasClickableRowShape;
}

/**
 * Assignments-page detection, same signature assignmentsExtractorSource()
 * relies on (it only checks the URL for a courseId, then a DOM content
 * check to confirm it landed on the right page — the literal path segment
 * beyond `cid-{id}/student/` was never confirmed/documented).
 *
 * Confirmed live (Sep 2026): the Grades page's default sub-view renders the
 * *exact same* `main .bg-base.text-highlight` row shape as the real
 * Assignments page (BYU appears to reuse the same table component for
 * both) — so the DOM signature alone is ambiguous and this adapter was
 * silently mounting on Grades, mislabeling it "Assignments" and hiding the
 * real Course Progress summary underneath. Real, live-confirmed
 * disambiguator: LearningSuite's own top-tab bar marks the active section
 * via `.bg-top-nav-highlight` — confirmed to read exactly "Grades" on the
 * Grades page and "Home" on the real Assignments page (reached via
 * Home > Assignments in the sidebar, not its own top tab). Excluding on
 * that real signal avoids guessing a path segment, consistent with this
 * file's own discipline above.
 */
export function looksLikeAssignmentsPage(doc: Document = document): boolean {
  if (!courseIdFromUrl()) return false;
  const activeTab = doc.querySelector(".bg-top-nav-highlight")?.textContent?.trim();
  if (activeTab === "Grades") return false;
  return doc.querySelectorAll("main .bg-base.text-highlight").length > 0;
}

/** Combined Schedule List view: confirmed via URL, cross-checked against the same `.listViewDay` markup scheduleExtractorSource() reads. */
export function looksLikeScheduleListView(doc: Document = document): boolean {
  return isScheduleUrl() && doc.querySelectorAll(".listViewDay").length > 0;
}
