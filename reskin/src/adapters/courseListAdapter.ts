import type { Adapter } from "./types.js";
import { looksLikeCourseListPage } from "../core/pageDetector.js";
import { overlayContent, markProcessed, isProcessed, h, listItem, createOverlayToggle } from "../lib/dom.js";
import type { Overlay } from "../lib/dom.js";
import { courseCard } from "../components/courseCard.js";
import { assignCourseColors } from "../lib/courseColor.js";
import { diagnostics } from "../core/diagnostics.js";

interface ParsedCourse {
  code: string;
  title: string;
  /** A real anchor's href, copied verbatim — only set for shape A below. */
  href?: string;
  /** The original clickable row — only set for shape B below (no href exists to copy). */
  element?: HTMLElement;
}

function splitCodeTitle(label: string): { code: string; title: string } {
  const dashIdx = label.indexOf(" - ");
  const codeRaw = dashIdx >= 0 ? label.slice(0, dashIdx) : label;
  const title = dashIdx >= 0 ? label.slice(dashIdx + 3).trim() : "";
  // Keep the section number ("(003)") — gradeSummaryAdapter.ts's own extraction never strips
  // it, so a student in two sections of the same course previously saw identical cards here
  // but different labels on Grade Summary. Stripping it also made two real sections
  // indistinguishable from each other on this page alone.
  const code = codeRaw.replace(/\s+/g, " ").trim();
  return { code, title };
}

/**
 * Two shapes observed for this page, in order of preference:
 *
 * Shape A — src/connectors/bookmarklet.ts's courseListExtractorSource() shape
 * (a real `a[href*='cid-']` anchor). Kept as the first choice in case any
 * LearningSuite view still renders this way.
 *
 * Shape B — confirmed LIVE against a real account (Sep 2026): the row is a
 * Vue-rendered `<p class="cursor-pointer">` with a click handler and NO
 * static href at all. Clicking it (verified by hand) navigates to
 * `cid-{courseID}/student/home` — that URL pattern from
 * learningsuite-handoff.md is still accurate, it's just that the courseID
 * is no longer exposed anywhere in the row's own DOM; it only appears in
 * the resulting URL after the handler runs. So this shape can't produce a
 * real `href` to copy — the card has to re-fire the original element's own
 * click instead (same "wrap, don't replace" pattern the other adapters use
 * for LearningSuite's real interactions).
 */
function extractCourses(main: Element): ParsedCourse[] {
  const results: ParsedCourse[] = [];
  const seenIds = new Set<string>();
  for (const a of Array.from(main.querySelectorAll("a[href*='cid-']"))) {
    const href = a.getAttribute("href");
    const m = href?.match(/cid-([^/]+)\//);
    if (!m) continue;
    const courseId = m[1]!;
    if (seenIds.has(courseId)) continue;
    const label = a.textContent?.trim() ?? "";
    if (!label || label === "Go") continue;
    seenIds.add(courseId);
    results.push({ ...splitCodeTitle(label), href: href! });
  }
  if (results.length) return results;

  for (const p of Array.from(main.querySelectorAll("p.cursor-pointer"))) {
    const label = p.textContent?.trim() ?? "";
    if (!label) continue;
    const parsed = splitCodeTitle(label);
    if (!parsed.code) continue;
    results.push({ ...parsed, element: p as HTMLElement });
  }
  return results;
}

let overlay: Overlay | null = null;

export const courseListAdapter: Adapter = {
  id: "courseList",
  matches: () => looksLikeCourseListPage(),
  mount(compatibilityMode) {
    const main = document.querySelector("main");
    if (!main || isProcessed(main, "courselist")) return;
    const courses = extractCourses(main);
    if (!courses.length) return; // nothing recognizable — leave LearningSuite's page untouched

    const colors = assignCourseColors(courses.map((c) => c.code || c.title));
    const toggle = createOverlayToggle(() => overlay);
    const grid = h("div", { class: "docket-scope docket-page" }, [
      h("div", { class: "docket-header" }, [
        h("h1", { class: "docket-display" }, ["Courses"]),
        h("div", { class: "docket-lead" }, [`${courses.length} course${courses.length === 1 ? "" : "s"}`]),
      ]),
      h(
        "div",
        { class: "docket-course-grid", role: "list" },
        courses.map((c) =>
          listItem(
            courseCard({
              code: c.code || c.title || "Course",
              title: c.title,
              accent: colors.get(c.code || c.title) ?? "#0b57d0",
              href: c.href,
              onActivate: c.element
                ? () => {
                    toggle.reveal();
                    c.element!.click();
                  }
                : undefined,
            }),
          ),
        ),
      ),
      toggle.button,
    ]);

    overlay = overlayContent(main, grid, compatibilityMode);
    markProcessed(main, "courselist");
    diagnostics.transformCount += courses.length;
  },
  unmount() {
    overlay?.remove();
    overlay = null;
  },
};
