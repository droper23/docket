import type { Adapter } from "./types.js";
import { looksLikeScheduleListView } from "../core/pageDetector.js";
import { overlayContent, markProcessed, isProcessed, h } from "../lib/dom.js";
import type { Overlay } from "../lib/dom.js";
import { assignmentCard } from "../components/assignmentCard.js";
import { parseSlashDate, formatIsoDate } from "../lib/parseDueText.js";
import { dayLabel } from "../../../src/core/agendaFormatting.js";
import { daysUntilInSchoolTimeZone } from "../../../src/core/schoolTime.js";
import { diagnostics } from "../core/diagnostics.js";

interface ScheduleItem {
  title: string;
  courseCode?: string;
  dateIso: string;
  anchor: HTMLElement;
}

// Same window src/connectors/bookmarklet.ts's scheduleExtractorSource() uses, for the same
// reason: this page renders the entire remaining semester at once (confirmed live, 300+
// items for 5 courses), so a window keeps a Today/Upcoming view from becoming a full-semester
// dump — this reskin re-runs on every debounced mutation pass anyway, unlike the one-shot
// bookmarklet, so it can afford a narrower window than that script's own.
const WINDOW_DAYS_PAST = 1;
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
    const title = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!title) continue;
    results.push({ title, courseCode: courseCell?.textContent?.trim() || undefined, dateIso: formatIsoDate(date), anchor: a as HTMLElement });
  }
  results.sort((x, y) => x.dateIso.localeCompare(y.dateIso));
  return results;
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

export const homeAdapter: Adapter = {
  id: "home",
  matches: () => looksLikeScheduleListView(),
  mount(compatibilityMode) {
    const main = document.querySelector("main");
    if (!main) return;
    const items = extractItems(main);
    if (!items.length && !overlay) return;

    for (const i of items) markProcessed(i.anchor, "scheduleitem");
    processedAnchors.push(...items.map((i) => i.anchor));

    const groups = groupByDate(items).map((g) =>
      h("div", { class: "docket-section" }, [
        h("div", { class: "docket-day-header" }, [
          h("div", { class: "docket-headline" }, [dayLabel(g.dateIso)]),
          h("span", { class: "docket-day-count" }, [String(g.items.length)]),
        ]),
        h(
          "div",
          { class: "docket-group" },
          g.items.map((item) =>
            assignmentCard(
              { title: item.title, category: item.courseCode, daysUntilDue: daysUntilInSchoolTimeZone(item.dateIso) },
              () => {
                overlay?.setOriginalHidden(false);
                item.anchor.click();
                item.anchor.scrollIntoView({ block: "center", behavior: "smooth" });
              },
            ),
          ),
        ),
      ]),
    );

    if (overlay && dayList) {
      dayList.replaceChildren(...groups);
    } else {
      dayList = h("div", {}, groups.length ? groups : [h("div", { class: "docket-empty" }, ["Nothing in the next two weeks."])]);
      const backToCards = h("button", { class: "docket-toggle-original" }, ["← Back to card view"]);
      backToCards.addEventListener("click", () => overlay?.setOriginalHidden(true));
      const view = h("div", { class: "docket-scope docket-page" }, [
        h("div", { class: "docket-header" }, [h("div", { class: "docket-large-title" }, ["Today & Upcoming"])]),
        backToCards,
        dayList,
      ]);
      overlay = overlayContent(main, view, compatibilityMode);
    }
    diagnostics.transformCount += items.length;
  },
  unmount() {
    overlay?.remove();
    overlay = null;
    dayList = null;
    for (const a of processedAnchors) a.removeAttribute("data-docket-scheduleitem");
    processedAnchors = [];
  },
};
