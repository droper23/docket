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
 * inside `<main>` — that shape is checked first. Re-confirmed live Sep 2026:
 * the current Course List renders real `<a href="cid-...">` rows again (the
 * click-handler-only `<p class="cursor-pointer">` shape an earlier pass
 * documented appears per-term; both shapes are kept as OR'd signals for
 * exactly that reason, and the clickable-shape fixture stays as its test);
 * either way, a course-scoped URL (`cid-` already in the URL itself) is
 * never a Course List page, and Grade Summary is excluded explicitly — see
 * the comment inside.
 */
export function looksLikeCourseListPage(doc: Document = document): boolean {
  if (courseIdFromUrl()) return false;
  // Grade Summary false positive (confirmed live Sep 2026,
  // tools/audit/34..41): /top/summary renders "Course Grade Summary" with one
  // `cid-` anchor per course inside its per-course summary panels — the same
  // hasAnchorShape below — so courseListAdapter mounted over it and replaced
  // the whole page with a card grid. Neither URL shape nor top-tab signal
  // disambiguates (the summary page has no distinct .bg-top-nav-highlight —
  // both it and the real Course List read "Home"), but each page's own <h1>
  // is stable and distinct ("Course List" vs "Course Grade Summary"), so the
  // page's own title is the real disambiguator here, exactly like the
  // Assignments/Grades fix below used the top-tab title.
  const mainTitle = doc.querySelector("main h1")?.textContent?.trim() ?? "";
  if (/grade/i.test(mainTitle)) return false;
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
