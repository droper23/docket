import { h } from "../lib/dom.js";
import { dueBadge } from "./dueBadge.js";

export interface AssignmentCardData {
  title: string;
  category?: string;
  /** e.g. "20%" — this category's weighting toward the final grade, shown on the native table; must not silently disappear in the card view. */
  categoryWeight?: string;
  dueLabel?: string; // e.g. "today", "Friday" — from dueDateLabel()
  dueTime?: string;
  daysUntilDue?: number;
  completed?: boolean;
  courseAccent?: string; // CSS color for the leading dot
  /** Availability date ("Opens Sep 9") — see dueBadge.ts; never treated as a deadline. */
  opensText?: string;
  /** Secondary real content the source anchor carried alongside its title (e.g. a file name,
   * "Download," an "(Updated on …)" stamp, a Zoom-recording label) — LearningSuite's own native
   * row keeps this on the same line and lets its own `truncate` CSS clip it; folding it into
   * `title` verbatim instead produces one long run-on line, so it's surfaced here as its own
   * subtitle segment instead of being dropped or concatenated into the title. */
  meta?: string;
  /** Earned points, copied verbatim — absent (not "0") when nothing has been graded yet. */
  scoreEarned?: string;
  /** Possible points, copied verbatim. Score readout only renders when this is present. */
  scorePossible?: string;
}

/**
 * Wraps LearningSuite's own row, it doesn't replace it: `onActivate` re-fires
 * the original click behavior (opening LearningSuite's own detail panel) so
 * every real interaction — expand, submit, view feedback — still runs
 * through LearningSuite's own code, never a reimplementation of it.
 */
export function assignmentCard(data: AssignmentCardData, onActivate?: () => void): HTMLElement {
  // A completed item doesn't need an urgency scare-badge regardless of its due date — without
  // this, a graded-and-completed assignment past its due date showed a green completion mark
  // AND a red "Overdue" badge on the same row, contradicting itself (confirmed live, Sep 2026:
  // MATH 113's "Syllabus Video Quiz," due Sep 2, Completed, still due-badged "Overdue by 4 days").
  const badge = data.completed ? null : dueBadge(data.daysUntilDue, data.opensText);
  const dueText = data.dueLabel
    ? `Due ${data.dueLabel}${data.dueTime ? " " + data.dueTime : ""}`
    : undefined;
  const categoryText = data.category
    ? data.category + (data.categoryWeight ? ` (${data.categoryWeight} of grade)` : "")
    : undefined;
  const metaText = data.meta || undefined;
  // Em dash, never a fabricated 0 — this is real, ungraded work, not a zero score.
  const scoreText = data.scorePossible ? `${data.scoreEarned ?? "—"}/${data.scorePossible}` : undefined;

  const row = h(
    "div",
    { class: "docket-row" + (onActivate ? " docket-row-tappable" : "") },
    [
      // Only rendered when the source data has a real completion concept (assignment rows) —
      // `undefined` here means "not a task" (a dashboard holiday/lesson-note), not "not done".
      data.completed !== undefined
        ? h("div", {
            class: `docket-checkbox${data.completed ? " docket-checkbox-done" : ""}`,
            role: "img",
            "aria-label": data.completed ? "Completed" : "Not yet completed",
          })
        : undefined,
      h("div", { class: "docket-row-main" }, [
        h("div", { class: "docket-row-title" }, [data.title]),
        h("div", { class: "docket-row-subtitle" }, [[categoryText, dueText, metaText].filter(Boolean).join(" · ") || undefined]),
      ]),
      h("div", { class: "docket-row-trailing" }, [
        scoreText ? h("span", { class: "docket-score" }, [scoreText]) : undefined,
        badge ?? undefined,
        onActivate ? h("span", { class: "docket-chevron" }) : undefined,
      ]),
    ],
  );
  if (onActivate) {
    row.addEventListener("click", onActivate);
    row.tabIndex = 0;
    // A link (activates and navigates), not a button — Enter only, no Space (platform link
    // convention; Space is reserved for scrolling the page, same as any other real link).
    row.setAttribute("role", "link");
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onActivate();
      }
    });
  }
  return row;
}
