import type { Adapter } from "./types.js";
import { looksLikeScheduleListView } from "../core/pageDetector.js";
import { overlayContent, markProcessed, isProcessed, h, listItem, createOverlayToggle } from "../lib/dom.js";
import type { Overlay, OverlayToggle } from "../lib/dom.js";
import { assignmentCard } from "../components/assignmentCard.js";
import { icons } from "../components/icons.js";
import { parseSlashDate, formatIsoDate } from "../lib/parseDueText.js";
import { dayLabel, dueDateLabel } from "../../../src/core/agendaFormatting.js";
import { daysUntilInSchoolTimeZone } from "../../../src/core/schoolTime.js";
import { diagnostics } from "../core/diagnostics.js";
import { assignCourseColors } from "../lib/courseColor.js";

interface ScheduleItem {
  title: string;
  /** Real secondary content the anchor's own text carried after a blank-line break — see
   * `extractItems()`'s doc comment below. */
  meta?: string;
  courseCode?: string;
  dateIso: string;
  anchor: HTMLElement;
  /** Confirmed live (Sep 2026): a not-yet-due item's own real anchor text ends in the literal
   * word "Opens" (e.g. "HW 1 - Information Storage Opens") when listed under its availability
   * date rather than its due date — that day can be well in the past, which previously read as
   * "Overdue by N days" in the most alarming color in the badge system. Stripped from the
   * display title; carried forward so the card can show a neutral "Opens ..." badge instead. */
  opens: boolean;
  /** Confirmed live (Sep 2026): the native row's own title anchor carries a real, structural
   * signal for what kind of line this is — a small gold `i.fa-circle` icon (LearningSuite's own
   * "text-star" color token) precedes a genuine due/gradable item's title; a `img.academic-y-logo`
   * (the BYU "Y" mark) precedes a university calendar entry (holiday, devotional); neither is
   * present for a plain topic/lesson/file-note line. Never derived from wording — real markup
   * only, same discipline as `opens` above. Drives dueBadge suppression and muted styling for
   * non-due lines in assignmentCard.ts (spec: neither a "Recitation Quiz 5.3/5.5" topic header
   * nor a "Labor Day" calendar entry is actually due on the date it's grouped under, so both
   * previously could render an alarming "Overdue"/"Due in N days" badge they had no business
   * showing). */
  kind: "due" | "calendar" | "info";
  /** The real native `<input type="checkbox">` LearningSuite renders for this row — confirmed
   * live to exist on EVERY row (due, calendar, or plain info alike), as a SIBLING of the title
   * cell, not nested inside it (`titleCell.parentElement`'s own child, found via a scoped
   * query — never a hardcoded child index, since the row's own column count isn't guaranteed
   * stable). Confirmed live: clicking it toggles completion via an in-place Vue re-render, no
   * navigation and no page reload — and still works correctly even while an ancestor has
   * `.hidden` set on it (exactly `overlayContent()`'s own hiding mechanism), so the card's own
   * checkbox can drive this directly without ever revealing the native page first. */
  checkboxEl?: HTMLInputElement;
  /** Resynced every mount() pass from `checkboxEl.checked` (see mount()'s resync pass below) —
   * never frozen at first-seen value, since extractItems() itself only reads each anchor once. */
  completed?: boolean;
}

// Same window src/connectors/bookmarklet.ts's scheduleExtractorSource() uses, for the same
// reason: this page renders the entire remaining semester at once (confirmed live, 300+
// items for 5 courses), so a window keeps a Today/Upcoming view from becoming a full-semester
// dump — this reskin re-runs on every debounced mutation pass anyway, unlike the one-shot
// bookmarklet, so it can afford a narrower window than that script's own.
//
// WINDOW_DAYS_PAST was 1 (real user complaint, Sep 2026: "can't scroll up to see past
// assignments" — a real data-window limit, not a scroll bug). Widened to comfortably cover a
// full semester back now that the overlay-leak fix (see lib/dom.ts's overlayContent()) means
// there's no longer a duplicate-content reason to keep the window narrow; ROADMAP.md's own
// prior live measurement already called the full ~300-item/~6.4k-node semester acceptable.
const WINDOW_DAYS_PAST = 120;
const WINDOW_DAYS_FUTURE = 14;

/**
 * Reuses scheduleExtractorSource()'s exact anchor/cell-walking shape
 * (`a.cursor-pointer.block.truncate` inside a `.flex-4` cell whose sibling
 * holds the course code, `.closest(".listViewDay")`'s first child as the day
 * header) — confirmed live against a real 5-course, 305-item schedule.
 * Read-only: never clicks an item to discover more, unlike the bookmarklet's
 * one-shot export pass.
 */
function extractItems(main: Element): ScheduleItem[] {
  const anchors = Array.from(main.querySelectorAll("a.cursor-pointer.block.truncate"));
  const now = new Date();
  const minDate = new Date(now.getTime() - WINDOW_DAYS_PAST * 86400000);
  const maxDate = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86400000);
  const results: ScheduleItem[] = [];
  for (const a of anchors) {
    if (isProcessed(a, "scheduleitem")) continue;
    const titleCell = a.closest(".flex-4");
    const courseCell = titleCell?.nextElementSibling;
    const dayEl = a.closest(".listViewDay");
    const headerEl = dayEl?.querySelector(":scope > div:first-child");
    if (!titleCell || !headerEl) continue;
    const date = parseSlashDate(headerEl.textContent?.trim() ?? "");
    if (!date || date < minDate || date > maxDate) continue;
    // Confirmed live (Sep 2026, real EC EN 224 row): a single real anchor's own text — not
    // multiple sibling anchors — can carry more than one logical line, blank-line-separated in
    // its raw textContent (e.g. "Chapter 2.1\n\n04-Information Storage.pdf  Download (Updated on
    // 09/01/2026)\n\nZoom Recording (05/01/26)"). LearningSuite's own native row keeps this as
    // one anchor and lets a `truncate` CSS class clip it to one line; collapsing all whitespace
    // (this adapter's old behavior) instead runs every line together into one unbroken title.
    // Split on the blank-line boundary first, so only the first real line becomes the title and
    // the rest survive as a separate, still-visible meta line (see assignmentCard.ts's `meta`).
    const rawSegments = (a.textContent ?? "")
      .split(/\n\s*\n+/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    if (!rawSegments.length) continue;
    const firstLine = rawSegments[0]!;
    const opensMatch = firstLine.match(/^(.*?)\s+Opens$/i);
    const title = opensMatch ? opensMatch[1]! : firstLine;
    const meta = rawSegments.slice(1).join(" · ") || undefined;
    const kind: ScheduleItem["kind"] = a.querySelector("i.fa-circle")
      ? "due"
      : a.querySelector("img.academic-y-logo")
        ? "calendar"
        : "info";
    // Scoped to this row only, never a hardcoded child index — see ScheduleItem.checkboxEl's
    // own doc comment for why (the row's column count isn't a stable contract).
    const rowEl = titleCell.parentElement;
    const checkboxEl = (rowEl?.querySelector('input[type="checkbox"]') as HTMLInputElement | null) ?? undefined;
    results.push({
      title,
      meta,
      courseCode: courseCell?.textContent?.trim() || undefined,
      dateIso: formatIsoDate(date),
      anchor: a as HTMLElement,
      opens: !!opensMatch,
      kind,
      checkboxEl,
      completed: checkboxEl?.checked,
    });
  }
  results.sort((x, y) => x.dateIso.localeCompare(y.dateIso));
  return results;
}

/**
 * Accumulates items across mount() calls, keyed by the anchor element.
 * mount()'s second pass extracts only NEWLY-appeared anchors (every real
 * anchor is already marked processed), so re-rendering from just that batch
 * wiped everything previously rendered (confirmed live Sep 2026: 65 rendered
 * rows → 0 after one trivial DOM mutation). Every mount() call now merges
 * its batch into this accumulator and re-renders from the merged map, so a
 * later pass can only ever ADD rows, never drop them.
 */
const accumulated = new Map<HTMLElement, ScheduleItem>();

function mergedItemsSorted(): ScheduleItem[] {
  const items = [...accumulated.values()];
  items.sort((x, y) => x.dateIso.localeCompare(y.dateIso));
  return items;
}

function groupByDate(items: ScheduleItem[]): { dateIso: string; items: ScheduleItem[] }[] {
  const groups: { dateIso: string; items: ScheduleItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.dateIso === item.dateIso) last.items.push(item);
    else groups.push({ dateIso: item.dateIso, items: [item] });
  }
  return groups;
}

/**
 * LearningSuite reuses one detail dialog across every click, closable via a button whose own
 * text is literally "Close" — same shape src/connectors/bookmarklet.ts's findOpenDialog() relies
 * on live. Used here only to detect open/close, never to read the dialog's content.
 */
function findDialogCloseButton(): HTMLElement | null {
  const buttons = Array.from(document.querySelectorAll("button"));
  return (buttons.find((b) => b.textContent?.trim() === "Close") as HTMLElement | undefined) ?? null;
}

const DIALOG_POLL_MS = 150;
// A dialog can legitimately never open at all (e.g. an exam-start flow the student backs out
// of before it renders) — bail out rather than leave a poll loop running forever.
const DIALOG_POLL_TIMEOUT_MS = 15000;

/**
 * Reveals native content and re-fires the row's own click — same as every other adapter's
 * `toggle.reveal()` — but Combined Schedule's click opens an in-place detail DIALOG rather than
 * navigating to a new page, so nothing ever reverses the reveal on its own. Previously left the
 * page stuck showing native LearningSuite after the student closed the dialog (reported bug,
 * Sep 2026: closing an assignment's popup "goes back to the original learningsuite look"). Polls
 * for that same dialog's own "Close" button appearing then disappearing and calls
 * `toggle.conceal()` the moment it's gone, returning to the redesigned view automatically.
 */
function openNativeDetail(item: ScheduleItem): void {
  toggle?.reveal();
  item.anchor.click();
  item.anchor.scrollIntoView({ block: "center", behavior: "smooth" });

  let sawDialog = false;
  let elapsed = 0;
  const poll = () => {
    const open = !!findDialogCloseButton();
    if (open) sawDialog = true;
    else if (sawDialog) {
      toggle?.conceal();
      return;
    }
    elapsed += DIALOG_POLL_MS;
    if (elapsed >= DIALOG_POLL_TIMEOUT_MS) return;
    setTimeout(poll, DIALOG_POLL_MS);
  };
  setTimeout(poll, DIALOG_POLL_MS);
}

let overlay: Overlay | null = null;
let dayList: HTMLElement | null = null;
let processedAnchors: HTMLElement[] = [];
let toggle: OverlayToggle | null = null;
/** Scrolls to today's day group once, the first time it's found rendered — see mount()'s end.
 * A module-level flag, not a per-render check, so a later mutation-triggered re-render (which
 * only ever ADDS rows, see `accumulated`'s own doc) never re-triggers the scroll and yanks the
 * student back to today after they've scrolled elsewhere themselves. */
let scrolledToToday = false;

export const homeAdapter: Adapter = {
  id: "home",
  matches: () => looksLikeScheduleListView(),
  mount(compatibilityMode) {
    const main = document.querySelector("main");
    if (!main) return;
    const items = extractItems(main);
    if (!items.length && !overlay) return;

    for (const i of items) {
      markProcessed(i.anchor, "scheduleitem");
      accumulated.set(i.anchor, i);
    }
    processedAnchors.push(...items.map((i) => i.anchor));

    // Resync + prune pass: extractItems() only ever reads a given anchor once (guarded by
    // isProcessed), so a later toggle of the real native checkbox — by this card's own
    // onToggleComplete below, or by the student themselves after revealing the native view —
    // would otherwise freeze `completed` at whatever it was the first time the row was seen.
    // Also closes a real staleness gap: LearningSuite removes a row from its own DOM once
    // checked complete (its "Completed items" sidebar filter is off by default), which would
    // otherwise leave a permanently-stale entry in `accumulated` that native itself no longer
    // shows.
    for (const [anchor, item] of accumulated) {
      if (!item.checkboxEl) continue;
      if (!anchor.isConnected) {
        accumulated.delete(anchor);
        continue;
      }
      item.completed = item.checkboxEl.checked;
    }

    // Always re-render from the FULL accumulated set (see accumulated's doc).
    const sortedItems = mergedItemsSorted();
    // Same per-course color identity as Course List/Grade Summary (courseListAdapter.ts/
    // gradeSummaryAdapter.ts both call this same function against their own extracted code
    // list) — a multi-course agenda can now be scanned by color the same way those grids
    // already can, not just by reading each row's course-code text.
    const courseColors = assignCourseColors(
      sortedItems.map((i) => i.courseCode).filter((c): c is string => !!c),
    );
    const groupedData = groupByDate(sortedItems);
    const groups = groupedData.map((g) =>
      h("div", { class: "docket-section" }, [
        h("div", { class: "docket-day-header" }, [
          h("h2", { class: "docket-title-2" }, [dayLabel(g.dateIso)]),
          h("span", { class: "docket-day-count" }, [String(g.items.length)]),
        ]),
        h(
          "div",
          { class: "docket-group", role: "list" },
          g.items.map((item) =>
            listItem(
              assignmentCard(
                {
                  title: item.title,
                  meta: item.meta,
                  category: item.courseCode,
                  daysUntilDue: daysUntilInSchoolTimeZone(item.dateIso),
                  opensText: item.opens ? dueDateLabel(item.dateIso) : undefined,
                  completed: item.completed,
                  kind: item.kind,
                  courseAccent: item.courseCode ? courseColors.get(item.courseCode) : undefined,
                  onToggleComplete: item.checkboxEl
                    ? () => {
                        item.completed = !item.completed;
                        item.checkboxEl!.click();
                      }
                    : undefined,
                },
                () => openNativeDetail(item),
              ),
            ),
          ),
        ),
      ]),
    );

    if (overlay && dayList) {
      dayList.replaceChildren(...groups);
    } else {
      dayList = h(
        "div",
        {},
        groups.length
          ? groups
          : [h("div", { class: "docket-empty" }, [icons.checklist(), h("span", {}, ["Nothing in the next two weeks."])])],
      );
      toggle = createOverlayToggle(() => overlay);
      const view = h("div", { class: "docket-scope docket-page" }, [
        h("div", { class: "docket-header" }, [h("h1", { class: "docket-display" }, ["Today & Upcoming"])]),
        dayList,
        toggle.button,
      ]);
      overlay = overlayContent(main, view, compatibilityMode);
    }

    if (!scrolledToToday) {
      const todayIso = formatIsoDate(new Date());
      const idx = groupedData.findIndex((g) => g.dateIso >= todayIso);
      if (idx >= 0) {
        // Optional call: jsdom (this project's test environment) doesn't implement
        // scrollIntoView at all — real browsers always have it.
        groups[idx]!.scrollIntoView?.({ block: "start" });
        scrolledToToday = true;
      }
    }
    diagnostics.transformCount += items.length;
  },
  unmount() {
    overlay?.remove();
    overlay = null;
    dayList = null;
    toggle = null;
    scrolledToToday = false;
    for (const a of processedAnchors) {
      a.removeAttribute("data-docket-scheduleitem");
      accumulated.delete(a);
    }
    processedAnchors = [];
  },
};
