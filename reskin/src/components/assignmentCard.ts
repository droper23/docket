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
  /** What kind of line this is, when the source page carries a real structural signal for it
   * (currently only homeAdapter.ts's Combined Schedule does — see its ScheduleItem.kind doc
   * comment): "due" is a genuine gradable/deadline item, "calendar" is a university calendar
   * entry (holiday, devotional), "info" is a plain topic/lesson/file-note line with no due
   * semantics at all. Undefined (e.g. from assignmentsAdapter.ts/gradesAdapter.ts, which have
   * no such signal to read) is treated the same as "due" — every row on those pages already is
   * one. Suppresses the due-urgency badge for "info"/"calendar" (neither is actually due on the
   * date it's grouped under) and mutes the row's own typography so it visually reads as
   * non-actionable at a glance. */
  kind?: "due" | "calendar" | "info";
  /** When given, the card's own checkbox becomes a real interactive control that calls this
   * instead of just displaying `completed`'s value — see homeAdapter.ts's `checkboxEl` doc
   * comment for why this can toggle the real native completion state in place, without ever
   * revealing the native page first. Absent (assignmentsAdapter.ts/gradesAdapter.ts's current
   * usage) keeps today's exact behavior: a decorative, non-interactive `role="img"` mark. */
  onToggleComplete?: () => void;
}

/**
 * Wraps LearningSuite's own row, it doesn't replace it: `onActivate` re-fires
 * the original click behavior (opening LearningSuite's own detail panel) so
 * every real interaction — expand, submit, view feedback — still runs
 * through LearningSuite's own code, never a reimplementation of it.
 */
export function assignmentCard(data: AssignmentCardData, onActivate?: () => void): HTMLElement {
  // Neither a plain topic/info line nor a university calendar entry is actually due on the
  // date it happens to be grouped under — undefined `kind` (assignmentsAdapter.ts/
  // gradesAdapter.ts) means every row on that page already is a real due item, so only an
  // explicit "info"/"calendar" suppresses the badge here.
  const infoLike = data.kind === "info" || data.kind === "calendar";
  // A completed item doesn't need an urgency scare-badge regardless of its due date — without
  // this, a graded-and-completed assignment past its due date showed a green completion mark
  // AND a red "Overdue" badge on the same row, contradicting itself (confirmed live, Sep 2026:
  // MATH 113's "Syllabus Video Quiz," due Sep 2, Completed, still due-badged "Overdue by 4 days").
  const badge = data.completed || infoLike ? null : dueBadge(data.daysUntilDue, data.opensText);
  const dueText = data.dueLabel
    ? `Due ${data.dueLabel}${data.dueTime ? " " + data.dueTime : ""}`
    : undefined;
  const categoryText = data.category
    ? data.category + (data.categoryWeight ? ` (${data.categoryWeight} of grade)` : "")
    : undefined;
  const metaText = data.meta || undefined;
  // Em dash, never a fabricated 0 — this is real, ungraded work, not a zero score.
  const scoreText = data.scorePossible ? `${data.scoreEarned ?? "—"}/${data.scorePossible}` : undefined;

  // Only rendered when the source data has a real completion concept (assignment rows) —
  // `undefined` here means "not a task" (a dashboard holiday/lesson-note), not "not done".
  let checkbox: HTMLElement | undefined;
  if (data.completed !== undefined && !infoLike) {
    const interactive = !!data.onToggleComplete;
    checkbox = h("div", {
      class: `docket-checkbox${data.completed ? " docket-checkbox-done" : ""}`,
      role: interactive ? "checkbox" : "img",
      "aria-checked": interactive ? String(!!data.completed) : undefined,
      "aria-label": data.completed ? "Completed" : "Not yet completed",
      tabindex: interactive ? "0" : undefined,
    });
    if (interactive) {
      // Toggles this card's own visual state synchronously (an instant paint, not waiting on
      // the ~150ms debounced mutation-observer re-render — see lib/observe.ts) and — crucially
      // — never calls onActivate: the whole point of this fix is that checking an item off must
      // not also trigger onActivate's toggle.reveal(), which used to be the ONLY way to reach
      // the native checkbox at all (confirmed live, Sep 2026: this was the reported "checking
      // something off kicks the whole page back to the native LearningSuite look" bug).
      const onToggle = (e: Event) => {
        e.stopPropagation();
        const next = !checkbox!.classList.contains("docket-checkbox-done");
        checkbox!.classList.toggle("docket-checkbox-done", next);
        checkbox!.setAttribute("aria-checked", String(next));
        checkbox!.setAttribute("aria-label", next ? "Completed" : "Not yet completed");
        data.onToggleComplete!();
      };
      checkbox.addEventListener("click", onToggle);
      checkbox.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === " ") {
          e.preventDefault(); // Space normally scrolls the page — this is a real checkbox now.
          onToggle(e);
        }
      });
    }
  }

  // Keep task completion and opening the native detail view as sibling controls. A previous
  // implementation made the entire row a role=link, which nested an interactive checkbox
  // inside another interactive target on Combined Schedule. That is both invalid semantics
  // and confusing in keyboard/screen-reader traversal.
  const openControl = onActivate
    ? h("button", { class: "docket-row-open", type: "button", "aria-label": `Open ${data.title}` }, ["Open"])
    : undefined;
  if (openControl) openControl.addEventListener("click", onActivate!);

  const row = h(
    "div",
    {
      class: "docket-row" + (infoLike ? " docket-row-info" : ""),
      // A left-edge accent stripe, same color/assignment as the course's own card elsewhere
      // (courseListAdapter.ts/gradeSummaryAdapter.ts's assignCourseColors()) — lets a multi-course
      // agenda (Combined Schedule) be scanned by color the same way the Course List/Grade Summary
      // grids already can. `.docket-row`'s own left border defaults to transparent, so omitting
      // this on pages with no course-color context (assignmentsAdapter.ts, already single-course)
      // keeps today's exact appearance.
      style: data.courseAccent ? `--docket-row-accent:${data.courseAccent}` : undefined,
    },
    [
      checkbox,
      h("div", { class: "docket-row-main" }, [
        h("div", { class: "docket-row-title" }, [data.title]),
        h("div", { class: "docket-row-subtitle" }, [[categoryText, dueText, metaText].filter(Boolean).join(" · ") || undefined]),
      ]),
      h("div", { class: "docket-row-trailing" }, [
        scoreText ? h("span", { class: "docket-score" }, [scoreText]) : undefined,
        badge ?? undefined,
        openControl,
      ]),
    ],
  );
  return row;
}
