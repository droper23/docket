import type { Adapter } from "./types.js";
import { looksLikeGradeSummaryPage } from "../core/pageDetector.js";
import { overlayContent, markProcessed, isProcessed, h, listItem, createOverlayToggle } from "../lib/dom.js";
import type { Overlay } from "../lib/dom.js";
import { gradeBadge } from "../components/gradeBadge.js";
import { assignCourseColors } from "../lib/courseColor.js";
import { diagnostics } from "../core/diagnostics.js";

interface CourseGrade {
  href: string;
  title: string;
  /** "Current progress" column — confirmed live column order. */
  currentPercent?: string;
  /** "N/M assignments scored" text for that same column, copied verbatim — confirmed live
   * (Sep 2026) as the percent's own next sibling; see `statDetail()`. */
  currentDetail?: string;
  /** "Total course progress" column — confirmed live column order. */
  totalPercent?: string;
  totalDetail?: string;
}

/** The percent's own next sibling in the same stat cell — confirmed live (Sep 2026, real
 * account): `.clicky` and its "N/M assignments scored" line are siblings under one wrapper
 * (`<div><div class="clicky">0%</div><div class="text-sm text-info">0/8 assignments
 * scored</div><div class="text-sm text-info">(0% of all points)</div></div>`); `:scope >`
 * limits the match to the FIRST such sibling (the scored-count line, not the "% of all
 * points" line after it). */
function statDetail(clicky: Element): string | undefined {
  const detail = clicky.parentElement?.querySelector(":scope > .text-sm.text-info");
  return detail?.textContent?.replace(/\s+/g, " ").trim() || undefined;
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
    const [current, total] = Array.from(row.querySelectorAll(".clicky"));
    results.push({
      href,
      title,
      currentPercent: current?.textContent?.trim(),
      currentDetail: current ? statDetail(current) : undefined,
      totalPercent: total?.textContent?.trim(),
      totalDetail: total ? statDetail(total) : undefined,
    });
  }
  return results;
}

/** True only when the "N/M assignments scored" text's own N is > 0 — a boolean read of real
 * page text, never a competing computed percentage: LearningSuite's own math is trusted and
 * displayed verbatim, never re-derived. */
function hasBeenScored(detail: string | undefined): boolean {
  const m = detail?.match(/^(\d+)\s*\/\s*\d+/);
  return !!m && Number(m[1]) > 0;
}

function statBlock(label: string, percent: string | undefined, detail: string | undefined): HTMLElement | null {
  if (!percent) return null;
  const badge = gradeBadge(percent, hasBeenScored(detail));
  if (!badge) return null;
  const children: (Node | string)[] = [h("span", { class: "docket-eyebrow" }, [label]), badge];
  // The real "N/M assignments scored" context the native page has and the pre-pass-11 build
  // silently dropped — without it there's no way to tell a genuinely low score apart from a
  // course that just hasn't been graded yet.
  if (detail) children.push(h("div", { class: "docket-body-sm" }, [detail]));
  return h("div", { class: "docket-grade-stat" }, children);
}

function courseGradeCard(c: CourseGrade, accent: string): HTMLElement {
  const current = statBlock("Current", c.currentPercent, c.currentDetail);
  const total = statBlock("Total", c.totalPercent, c.totalDetail);
  const children: (Node | string)[] = [h("h2", { class: "docket-title-2" }, [c.title])];
  if (current || total) {
    children.push(h("div", { class: "docket-grade-stats" }, [current ?? undefined, total ?? undefined]));
  }
  return h("a", { class: "docket-course-card", href: c.href, style: `--docket-card-accent:${accent}` }, children);
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

    const colors = assignCourseColors(courses.map((c) => c.title));
    // Confirmed live (Sep 2026): a real explanatory footnote — what "Current"/"Total progress"
    // actually mean — sits just below the grid (`.flex.pb-3.text-sm.text-info`, confirmed
    // page-unique, is the first of the two paragraphs; its parent holds both). The pre-pass-11
    // build dropped this entirely rather than just not finding it.
    const legendEl = main.querySelector(".flex.pb-3.text-sm.text-info")?.parentElement;
    const legendText = legendEl?.textContent?.replace(/\s+/g, " ").trim();

    const toggle = createOverlayToggle(() => overlay);
    const grid = h("div", { class: "docket-scope docket-page" }, [
      h("div", { class: "docket-header" }, [
        h("h1", { class: "docket-display" }, ["Grade Summary"]),
        h("div", { class: "docket-lead" }, [`${courses.length} course${courses.length === 1 ? "" : "s"}`]),
      ]),
      h(
        "div",
        { class: "docket-course-grid", role: "list" },
        courses.map((c) => listItem(courseGradeCard(c, colors.get(c.title) ?? "#0b57d0"))),
      ),
      legendText ? h("p", { class: "docket-body-sm" }, [legendText]) : undefined,
      toggle.button,
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
