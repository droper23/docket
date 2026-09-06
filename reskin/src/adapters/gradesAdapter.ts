import type { Adapter } from "./types.js";
import { looksLikeGradesPage } from "../core/pageDetector.js";
import { overlayContent, markProcessed, h } from "../lib/dom.js";
import type { Overlay } from "../lib/dom.js";
import { extractRows, buildCard } from "./assignmentsAdapter.js";
import { diagnostics } from "../core/diagnostics.js";

/**
 * Confirmed live (Sep 2026, real-usage pass): the Grades page's default "Assignments"
 * sub-view (`/student/gradebook`) renders the exact same `main .bg-base.text-highlight` row
 * grid and `.lineHeight > div.cursor-pointer` category headers as the real course-level
 * Assignments page — same title/due/score/completion cell shape, confirmed against a real
 * 171-row gradebook (7 categories). This adapter reuses assignmentsAdapter.ts's extraction
 * and card-building directly rather than re-deriving the same parsing twice for the same
 * DOM shape.
 *
 * `pageDetector.ts`'s `looksLikeGradesPage()` is what actually tells this page apart from
 * real Assignments (both used to collide on the DOM-shape check alone until an earlier pass
 * fixed the false-merge by excluding Grades from `looksLikeAssignmentsPage()`; this is the
 * mirror-image positive match using the same confirmed `.bg-top-nav-highlight === "Grades"`
 * signal) — never a guessed URL segment.
 *
 * A native "Course Progress" stat panel was searched for on this pass (real account, MATH
 * 113's gradebook) and not found above the row list — ROADMAP.md has flagged this same gap
 * across multiple prior passes as "still no non-generic hook." Left untouched here too,
 * fail-soft, exactly like every other not-confidently-extractable element on this project;
 * re-check if a future pass finds a real selector for it.
 */
let overlay: Overlay | null = null;
let listContainer: HTMLElement | null = null;
let processedRows: HTMLElement[] = [];

export const gradesAdapter: Adapter = {
  id: "grades",
  matches: () => looksLikeGradesPage(),
  mount(compatibilityMode) {
    const main = document.querySelector("main");
    if (!main) return;
    const rows = extractRows(main);
    if (!rows.length && !overlay) return;

    for (const r of rows) markProcessed(r.el, "assignmentrow");
    processedRows.push(...rows.map((r) => r.el));
    const cards = rows.map((r) => buildCard(() => overlay, r));

    if (overlay && listContainer) {
      for (const c of cards) listContainer.appendChild(c);
    } else {
      listContainer = h("div", { class: "docket-group" }, cards);
      const backToCards = h("button", { class: "docket-toggle-original" }, ["← Back to card view"]);
      backToCards.addEventListener("click", () => overlay?.setOriginalHidden(true));
      const view = h("div", { class: "docket-scope docket-page" }, [
        h("div", { class: "docket-header" }, [h("div", { class: "docket-large-title" }, ["Grades"])]),
        backToCards,
        listContainer,
      ]);
      overlay = overlayContent(main, view, compatibilityMode);
    }
    diagnostics.transformCount += rows.length;
  },
  unmount() {
    overlay?.remove();
    overlay = null;
    listContainer = null;
    for (const el of processedRows) el.removeAttribute("data-docket-assignmentrow");
    processedRows = [];
  },
};
