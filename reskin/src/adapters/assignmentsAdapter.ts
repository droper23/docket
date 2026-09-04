import type { Adapter } from "./types.js";
import { looksLikeAssignmentsPage } from "../core/pageDetector.js";
import { overlayContent, markProcessed, isProcessed, h } from "../lib/dom.js";
import type { Overlay } from "../lib/dom.js";
import { assignmentCard } from "../components/assignmentCard.js";
import { parseAssignmentDueText } from "../lib/parseDueText.js";
import { diagnostics } from "../core/diagnostics.js";
import { dueDateLabel } from "../../../src/core/agendaFormatting.js";
import { daysUntilInSchoolTimeZone } from "../../../src/core/schoolTime.js";

interface RowData {
  el: HTMLElement;
  titleCell: HTMLElement;
  title: string;
  category: string;
  /** e.g. "20%" — read off the category header's own "of Grade: NN%" label (see extractRows). */
  categoryWeight?: string;
  dueText?: string;
  completed: boolean;
}

/**
 * Reuses the exact row/category selectors and text-parsing regexes
 * src/connectors/bookmarklet.ts's assignmentsExtractorSource() already
 * validated live: rows at `main .bg-base.text-highlight`, category headers
 * at `main .lineHeight > div.cursor-pointer` (whose *own* text also
 * contains a second "of Grade: NN%" label — `children[1]` is the clean
 * name, `children[2]` the weight, per that file's docstring). A single
 * document-order walk attributes each row to whichever category header
 * preceded it, the same trick bookmarklet.ts uses to find a row's detail
 * panel by scanning `main *` in order rather than assuming a fixed
 * parent/child shape. The weight is carried into the card's subtitle
 * (assignmentCard.ts) — the native table shows it, so the card view must
 * too, rather than silently dropping information the original page has.
 *
 * Deliberately read-only: unlike the bookmarklet (a one-shot export run by a
 * user click), this runs continuously via MutationObserver, so it never
 * auto-clicks a category header or a row to "discover" more — only what
 * LearningSuite has already rendered is read. Expanding a collapsed
 * category is left to the student, exactly as today; the observer picks up
 * newly-rendered rows once they do (see the `listContainer` append path
 * below).
 */
function extractRows(main: Element): RowData[] {
  const all = Array.from(main.querySelectorAll("*"));
  let currentCategory = "";
  let currentWeight: string | undefined;
  const results: RowData[] = [];
  for (const el of all) {
    if (el.matches(".lineHeight > div.cursor-pointer")) {
      const nameEl = el.children[1] as HTMLElement | undefined;
      currentCategory = (nameEl ?? el).textContent?.replace(/\s+/g, " ").trim() ?? "";
      const weightEl = el.children[2] as HTMLElement | undefined;
      const weightMatch = weightEl?.textContent?.match(/(\d+(?:\.\d+)?)\s*%/);
      currentWeight = weightMatch ? `${weightMatch[1]}%` : undefined;
      continue;
    }
    if (!el.matches(".bg-base.text-highlight") || isProcessed(el, "assignmentrow")) continue;
    const titleCell = el.children[1] as HTMLElement | undefined;
    const title = titleCell?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!titleCell || !title) continue;

    // Column order (confirmed live, src/connectors/bookmarklet.ts's extractCategory()):
    // Title, Due, Submission status ("Submit"/"Completed"/"Opens <date>"), Score — so the
    // status text sits BETWEEN the due match and the score fraction, not before the due
    // match. "Opens <date>" is stripped before the score regex runs so its bare day number
    // (e.g. "Opens Sep 4 /10.0") can't be misread as a score numerator. At least one
    // assignment type leaves this column blank once graded — a real earned score is the
    // fallback completion signal for that case, per the same source.
    const rowText = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const dueMatch = rowText.match(/[A-Z][a-z]{2}\s+\d{1,2}\s+\d{1,2}:\d{2}\s*[ap]m\s*[A-Z]{2,5}/);
    const afterDue = dueMatch ? rowText.slice(dueMatch.index! + dueMatch[0].length) : rowText;
    const afterDueForScore = afterDue.replace(/^\s*Opens\s+[A-Z][a-z]{2}\s+\d{1,2}/, "");
    const scoreMatch = afterDueForScore.match(/(\d+(?:\.\d+)?)?\s*\/\s*(\d+(?:\.\d+)?)/);
    const submissionText = (scoreMatch ? afterDueForScore.slice(0, scoreMatch.index) : afterDueForScore).trim();
    const completed = /\bcompleted\b/i.test(submissionText) || !!(scoreMatch && scoreMatch[1]);

    results.push({ el: el as HTMLElement, titleCell, title, category: currentCategory, categoryWeight: currentWeight, dueText: dueMatch?.[0], completed });
  }
  return results;
}

function buildCard(overlayRef: () => Overlay | null, r: RowData): HTMLElement {
  const { iso, time } = parseAssignmentDueText(r.dueText);
  const daysUntilDue = iso ? daysUntilInSchoolTimeZone(iso) : undefined;
  return assignmentCard(
    {
      title: r.title,
      category: r.category || undefined,
      categoryWeight: r.categoryWeight,
      dueLabel: iso ? dueDateLabel(iso) : undefined,
      dueTime: time,
      daysUntilDue,
      completed: r.completed,
    },
    () => {
      // Reveal LearningSuite's own row and re-fire its real click handler —
      // this is how expand/submit/view-feedback keep working: nothing here
      // is reimplemented, just surfaced.
      overlayRef()?.setOriginalHidden(false);
      r.titleCell.click();
      r.el.scrollIntoView({ block: "center", behavior: "smooth" });
    },
  );
}

let overlay: Overlay | null = null;
let listContainer: HTMLElement | null = null;
let processedRows: HTMLElement[] = [];

export const assignmentsAdapter: Adapter = {
  id: "assignments",
  matches: () => looksLikeAssignmentsPage(),
  mount(compatibilityMode) {
    const main = document.querySelector("main");
    if (!main) return;
    const rows = extractRows(main);
    if (!rows.length && !overlay) return; // nothing to show yet — a collapsed-accordion course, or wrong page

    for (const r of rows) markProcessed(r.el, "assignmentrow");
    processedRows.push(...rows.map((r) => r.el));
    const cards = rows.map((r) => buildCard(() => overlay, r));

    if (overlay && listContainer) {
      // A MutationObserver pass found newly-rendered rows (e.g. an
      // accordion category the student just opened) — append to the
      // existing list rather than re-running overlayContent, which would
      // wrongly re-capture our own enhanced view as "original" content.
      for (const c of cards) listContainer.appendChild(c);
    } else {
      listContainer = h("div", { class: "docket-group" }, cards);
      const backToCards = h("button", { class: "docket-toggle-original" }, ["← Back to card view"]);
      backToCards.addEventListener("click", () => overlay?.setOriginalHidden(true));
      const view = h("div", { class: "docket-scope docket-page" }, [
        h("div", { class: "docket-header" }, [h("div", { class: "docket-large-title" }, ["Assignments"])]),
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
