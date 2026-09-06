import type { Adapter } from "./types.js";
import { looksLikeGradeSummaryPage } from "../core/pageDetector.js";
import { overlayContent, markProcessed, isProcessed, h } from "../lib/dom.js";
import type { Overlay } from "../lib/dom.js";
import { gradeBadge } from "../components/gradeBadge.js";
import { diagnostics } from "../core/diagnostics.js";

interface CourseGrade {
  href: string;
  title: string;
  /** "Current progress" column — confirmed live column order. */
  currentPercent?: string;
  /** "Total course progress" column — confirmed live column order. */
  totalPercent?: string;
}

/**
 * Confirmed live (Sep 2026, real account): the whole page is one CSS grid,
 * `main .gridColsStyle`, its children a flat list of `.contents` rows — a header row per
 * term ("Fall 2026" + the two column titles) has no `a[href*='cid-']` inside it and is
 * skipped; every real course row does, and was confirmed to always carry exactly two
 * `.clicky` percentage readouts in the row's own document order (Current progress, then
 * Total course progress). The course name anchor is a real, already-confirmed shape A link
 * (identical to courseListAdapter's own shape A) — copied verbatim, never fabricated.
 */
function extractCourses(main: Element): CourseGrade[] {
  const grid = main.querySelector(".gridColsStyle");
  if (!grid) return [];
  const results: CourseGrade[] = [];
  for (const row of Array.from(grid.children)) {
    const link = row.querySelector("a[href*='cid-']");
    const href = link?.getAttribute("href");
    if (!link || !href) continue; // a term/column header row, not a course row
    const title = link.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!title) continue;
    const percents = Array.from(row.querySelectorAll(".clicky")).map((c) => c.textContent?.trim());
    results.push({ href, title, currentPercent: percents[0], totalPercent: percents[1] });
  }
  return results;
}

function courseGradeCard(c: CourseGrade): HTMLElement {
  const children: (Node | string)[] = [h("div", { class: "docket-headline" }, [c.title])];
  const current = gradeBadge(c.currentPercent);
  const total = gradeBadge(c.totalPercent);
  if (current || total) {
    const stats = h("div", { class: "docket-grade-stats" });
    if (current) stats.appendChild(h("div", { class: "docket-grade-stat" }, [h("span", { class: "docket-footnote" }, ["Current"]), current]));
    if (total) stats.appendChild(h("div", { class: "docket-grade-stat" }, [h("span", { class: "docket-footnote" }, ["Total"]), total]));
    children.push(stats);
  }
  return h("a", { class: "docket-course-card", href: c.href }, children);
}

let overlay: Overlay | null = null;

export const gradeSummaryAdapter: Adapter = {
  id: "gradeSummary",
  matches: () => looksLikeGradeSummaryPage(),
  mount(compatibilityMode) {
    const main = document.querySelector("main");
    if (!main || isProcessed(main, "gradesummary")) return;
    const courses = extractCourses(main);
    if (!courses.length) return; // nothing recognizable — leave LearningSuite's page untouched

    const grid = h("div", { class: "docket-scope docket-page" }, [
      h("div", { class: "docket-header" }, [h("div", { class: "docket-large-title" }, ["Grade Summary"])]),
      h("div", { class: "docket-course-grid" }, courses.map(courseGradeCard)),
    ]);

    overlay = overlayContent(main, grid, compatibilityMode);
    markProcessed(main, "gradesummary");
    diagnostics.transformCount += courses.length;
  },
  unmount() {
    overlay?.remove();
    overlay = null;
  },
};
