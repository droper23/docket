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
}

/**
 * Wraps LearningSuite's own row, it doesn't replace it: `onActivate` re-fires
 * the original click behavior (opening LearningSuite's own detail panel) so
 * every real interaction — expand, submit, view feedback — still runs
 * through LearningSuite's own code, never a reimplementation of it.
 */
export function assignmentCard(data: AssignmentCardData, onActivate?: () => void): HTMLElement {
  const badge = dueBadge(data.daysUntilDue);
  const dueText = data.dueLabel
    ? `Due ${data.dueLabel}${data.dueTime ? " " + data.dueTime : ""}`
    : undefined;
  const categoryText = data.category
    ? data.category + (data.categoryWeight ? ` (${data.categoryWeight} of grade)` : "")
    : undefined;

  const row = h(
    "div",
    { class: "docket-row" + (onActivate ? " docket-row-tappable" : "") },
    [
      h("div", { class: `docket-checkbox${data.completed ? " docket-checkbox-done" : ""}` }),
      h("div", { class: "docket-row-main" }, [
        h("div", { class: "docket-row-title" }, [data.title]),
        h("div", { class: "docket-row-subtitle" }, [[categoryText, dueText].filter(Boolean).join(" · ") || undefined]),
      ]),
      h("div", { class: "docket-row-trailing" }, [badge ?? undefined, onActivate ? h("span", { class: "docket-chevron" }) : undefined]),
    ],
  );
  if (onActivate) {
    row.addEventListener("click", onActivate);
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    });
  }
  return row;
}
