import type { Adapter } from "./types.js";
import { looksLikeDashboardPage } from "../core/pageDetector.js";
import { overlayContent, markProcessed, isProcessed, h, listItem, createOverlayToggle } from "../lib/dom.js";
import type { Overlay, OverlayToggle } from "../lib/dom.js";
import { assignmentCard } from "../components/assignmentCard.js";
import { icons } from "../components/icons.js";
import { diagnostics } from "../core/diagnostics.js";

interface DashboardItem {
  text: string;
  activate?: () => void;
}
interface DashboardDay {
  dateText: string;
  items: DashboardItem[];
}

/**
 * Confirmed live (Sep 2026, course Dashboard, real account): each day is
 * `div.bg-gray1.text-primary-alt.px-4.py-2` (the date bar, e.g. "Mon, Sep 7" — already
 * confirmed page-unique from Combined Schedule's own `.bg-gray1.px-4.py-2` week header by
 * an earlier pass's `.text-primary-alt` vs. `.text-primary.cursor-pointer` split) followed
 * immediately by `div.pl-mobile` (the day's item list, grouped into one or more
 * "Column N" sub-sections that this adapter flattens — that grouping only exists for the
 * native page's own multi-column desktop layout, not because the items mean anything
 * different from each other). Each entry is a `p.mb-2.text-sm.break-words`, confirmed to be
 * one of three real shapes: a real assignment link (`a.cursor-pointer`, a Vue click handler
 * with no static href — re-fired on activate, same pattern homeAdapter/assignmentsAdapter
 * already use for hrefless rows), a BYU-calendar event/holiday marker (an icon + label,
 * never clickable), or an instructor's own lesson-topic note (nested
 * `.instructorText.font-nunito`, already given the compact-chip treatment in global.css).
 * All three read out as a plain-text row here; only the real assignment case gets a working
 * click-through.
 *
 * Confirmed live (Sep 2026, MATH 113 Dashboard, Tue Sep 8): a date bar is followed by exactly
 * two `div.pl-mobile.sm:pl-0` siblings every day — "Column 1" and "Column 2" — even on days
 * where Column 2 has no real content (an empty div). Reading only `bar.nextElementSibling`
 * silently drops Column 2's items entirely on the days that do have them (that day's real BYU
 * Devotional calendar entry, in this account). Both columns must be walked and merged into one
 * flat list — the "Column N" grouping only exists for the native page's own desktop layout, not
 * because the items mean anything different from each other.
 */
function extractDays(main: Element): DashboardDay[] {
  const bars = Array.from(main.querySelectorAll(".bg-gray1.text-primary-alt.px-4.py-2")) as HTMLElement[];
  const days: DashboardDay[] = [];
  for (const bar of bars) {
    if (isProcessed(bar, "dashboardday")) continue;
    markProcessed(bar, "dashboardday");
    processedBars.push(bar);

    const columns: HTMLElement[] = [];
    let sib = bar.nextElementSibling;
    while (sib instanceof HTMLElement && sib.classList.contains("pl-mobile")) {
      columns.push(sib);
      sib = sib.nextElementSibling;
    }
    if (!columns.length) continue;

    const items: DashboardItem[] = [];
    for (const list of columns) {
      for (const p of Array.from(list.querySelectorAll("p.mb-2.text-sm.break-words"))) {
        // A paragraph commonly holds more than one real anchor (e.g. a file download AND a Zoom
        // recording link) — `querySelector` (singular) used to keep only the first, flattening
        // every other real anchor into inert plain text. Every real anchor gets its own row now.
        const anchors = Array.from(p.querySelectorAll("a.cursor-pointer")) as HTMLElement[];
        if (!anchors.length) {
          const text = p.textContent?.replace(/\s+/g, " ").trim() ?? "";
          if (text) items.push({ text });
          continue;
        }
        for (const link of anchors) {
          const text = link.textContent?.replace(/\s+/g, " ").trim() ?? "";
          if (text) items.push({ text, activate: () => link.click() });
        }
        // Any text in the paragraph outside the anchors themselves (e.g. an "(Updated on …)"
        // date) — captured separately so it's never silently dropped or concatenated onto one
        // link's own label.
        const clone = p.cloneNode(true) as HTMLElement;
        clone.querySelectorAll("a.cursor-pointer").forEach((a) => a.remove());
        const metaText = clone.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (metaText) items.push({ text: metaText });
      }
    }
    if (!items.length) continue;
    days.push({ dateText: bar.textContent?.trim() ?? "", items });
  }
  return days;
}

/**
 * Same accumulate-and-merge discipline homeAdapter.ts uses for Combined Schedule (see its
 * own doc comment on `accumulated`) — a later debounced pass only extracts NEWLY-appeared
 * date bars, so re-rendering must always draw from the full merged set, never just the
 * latest batch, or a later pass would wipe out previously-rendered days.
 */
const accumulated = new Map<string, DashboardDay>();
let orderedKeys: string[] = [];
let processedBars: HTMLElement[] = [];

let overlay: Overlay | null = null;
let dayList: HTMLElement | null = null;
let toggle: OverlayToggle | null = null;

export const dashboardAdapter: Adapter = {
  id: "dashboard",
  matches: () => looksLikeDashboardPage(),
  mount(compatibilityMode) {
    const main = document.querySelector("main");
    if (!main) return;
    // Confirmed live: the schedule and the "Announcements" sidebar widget are SIBLING
    // columns under one shared `main` wrapper (`div.flex.flex-col-reverse.md:flex-row...`),
    // not two independent `main` children — overlaying `main` itself (this adapter's first
    // draft) hid the Announcements widget along with the native schedule, a real regression
    // caught live. `[class~="md:mr-6"]` (an attribute selector, sidestepping the need to
    // escape the literal `:`/`/` in a class selector) isolates the confirmed schedule-only
    // column one level up from the date bar, so the overlay never touches its sibling.
    const scheduleColumn = main.querySelector('[class~="md:mr-6"]');
    if (!scheduleColumn) return;
    const days = extractDays(scheduleColumn);
    if (!days.length && !overlay) return;

    for (const d of days) {
      if (!accumulated.has(d.dateText)) orderedKeys.push(d.dateText);
      accumulated.set(d.dateText, d);
    }

    const sections = orderedKeys.map((key) => {
      const d = accumulated.get(key)!;
      return h("div", { class: "docket-section" }, [
        h("div", { class: "docket-day-header" }, [h("h2", { class: "docket-title-2" }, [d.dateText])]),
        h(
          "div",
          { class: "docket-group", role: "list" },
          d.items.map((item) => listItem(assignmentCard({ title: item.text }, item.activate))),
        ),
      ]);
    });

    if (overlay && dayList) {
      dayList.replaceChildren(...sections);
    } else {
      dayList = h(
        "div",
        {},
        sections.length ? sections : [h("div", { class: "docket-empty" }, [icons.checklist(), h("span", {}, ["Nothing scheduled."])])],
      );
      // No docket-display here (unlike every other adapter's view): confirmed live the
      // page's own real `<h1>Dashboard</h1>` sits one level above this column, outside what
      // scheduleColumn hides, so it's already visible and already styled by the sitewide h1
      // rule — adding a second "Dashboard" title here just duplicated it.
      toggle = createOverlayToggle(() => overlay, "View original LearningSuite page", "← Back to redesigned view");
      const view = h("div", { class: "docket-scope docket-page", style: "padding-top: 0;" }, [dayList, toggle.button]);
      overlay = overlayContent(scheduleColumn, view, compatibilityMode);
    }
    diagnostics.transformCount += days.reduce((n, d) => n + d.items.length, 0);
  },
  unmount() {
    overlay?.remove();
    overlay = null;
    dayList = null;
    toggle = null;
    accumulated.clear();
    orderedKeys = [];
    for (const bar of processedBars) bar.removeAttribute("data-docket-dashboardday");
    processedBars = [];
  },
};
