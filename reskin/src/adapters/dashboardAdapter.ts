import type { Adapter } from "./types.js";
import { looksLikeDashboardPage } from "../core/pageDetector.js";
import { overlayContent, markProcessed, isProcessed, h } from "../lib/dom.js";
import type { Overlay } from "../lib/dom.js";
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
 */
function extractDays(main: Element): DashboardDay[] {
  const bars = Array.from(main.querySelectorAll(".bg-gray1.text-primary-alt.px-4.py-2")) as HTMLElement[];
  const days: DashboardDay[] = [];
  for (const bar of bars) {
    if (isProcessed(bar, "dashboardday")) continue;
    const list = bar.nextElementSibling;
    markProcessed(bar, "dashboardday");
    processedBars.push(bar);
    if (!list || !(list instanceof HTMLElement) || !list.classList.contains("pl-mobile")) continue;

    const items: DashboardItem[] = [];
    for (const p of Array.from(list.querySelectorAll("p.mb-2.text-sm.break-words"))) {
      const link = p.querySelector("a.cursor-pointer") as HTMLElement | null;
      const text = (link ?? p).textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (!text) continue;
      items.push(link ? { text, activate: () => link.click() } : { text });
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
        h("div", { class: "docket-day-header" }, [h("div", { class: "docket-headline" }, [d.dateText])]),
        h(
          "div",
          { class: "docket-group" },
          d.items.map((item) => assignmentCard({ title: item.text }, item.activate)),
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
      // No docket-large-title here (unlike every other adapter's view): confirmed live the
      // page's own real `<h1>Dashboard</h1>` sits one level above this column, outside what
      // scheduleColumn hides, so it's already visible and already styled by the sitewide h1
      // rule — adding a second "Dashboard" title here just duplicated it.
      const backToNative = h("button", { class: "docket-toggle-original" }, ["← Back to original view"]);
      backToNative.addEventListener("click", () => overlay?.setOriginalHidden(true));
      const view = h("div", { class: "docket-scope docket-page", style: "padding-top: 0;" }, [backToNative, dayList]);
      overlay = overlayContent(scheduleColumn, view, compatibilityMode);
    }
    diagnostics.transformCount += days.reduce((n, d) => n + d.items.length, 0);
  },
  unmount() {
    overlay?.remove();
    overlay = null;
    dayList = null;
    accumulated.clear();
    orderedKeys = [];
    for (const bar of processedBars) bar.removeAttribute("data-docket-dashboardday");
    processedBars = [];
  },
};
