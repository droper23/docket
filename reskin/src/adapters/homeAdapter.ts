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

interface ScheduleItem {
  title: string;
  courseCode?: string;
  dateIso: string;
  anchor: HTMLElement;
  /** Confirmed live (Sep 2026): a not-yet-due item's own real anchor text ends in the literal
   * word "Opens" (e.g. "HW 1 - Information Storage Opens") when listed under its availability
   * date rather than its due date — that day can be well in the past, which previously read as
   * "Overdue by N days" in the most alarming color in the badge system. Stripped from the
   * display title; carried forward so the card can show a neutral "Opens ..." badge instead. */
  opens: boolean;
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
    const rawTitle = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!rawTitle) continue;
    const opensMatch = rawTitle.match(/^(.*?)\s+Opens$/i);
    const title = opensMatch ? opensMatch[1]! : rawTitle;
    results.push({ title, courseCode: courseCell?.textContent?.trim() || undefined, dateIso: formatIsoDate(date), anchor: a as HTMLElement, opens: !!opensMatch });
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

    // Always re-render from the FULL accumulated set (see accumulated's doc).
    const groupedData = groupByDate(mergedItemsSorted());
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
                  category: item.courseCode,
                  daysUntilDue: daysUntilInSchoolTimeZone(item.dateIso),
                  opensText: item.opens ? dueDateLabel(item.dateIso) : undefined,
                },
                () => {
                  toggle?.reveal();
                  item.anchor.click();
                  item.anchor.scrollIntoView({ block: "center", behavior: "smooth" });
                },
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
