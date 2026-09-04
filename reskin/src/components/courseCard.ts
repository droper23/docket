import { h } from "../lib/dom.js";

export interface CourseCardData {
  code: string;
  title: string;
  term?: string | null;
  accent: string;
  /** A real, existing LearningSuite link's href — copied verbatim, never fabricated. Prefer this when the row actually is a plain anchor. */
  href?: string;
  /**
   * Re-fires the original row's own click handler — needed because
   * LearningSuite's Course List rows (confirmed live, Sep 2026) render as a
   * Vue `<p class="cursor-pointer">` with a click handler, not a real
   * `<a href="...cid-...">`; the destination courseID only ever appears in
   * the resulting URL after that handler runs, never as a static attribute.
   * Exactly one of `href`/`onActivate` should be given.
   */
  onActivate?: () => void;
}

export function courseCard(data: CourseCardData): HTMLElement {
  const dot = h("div", { class: "docket-dot", style: `background:${data.accent}` });
  const headline = h("div", { class: "docket-headline" }, [data.code]);
  const footnote = h("div", { class: "docket-footnote" }, [data.title]);

  if (data.href) {
    return h("a", { class: "docket-course-card", href: data.href }, [dot, headline, footnote]);
  }

  const card = h("div", { class: "docket-course-card", role: "link", tabindex: "0" }, [dot, headline, footnote]);
  if (data.onActivate) {
    card.addEventListener("click", data.onActivate);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        data.onActivate!();
      }
    });
  }
  return card;
}

/** Deterministic accent per course so the same course always gets the same dot color across pages, without a shared palette config to keep in sync. */
export function accentForCourse(code: string): string {
  const palette = ["#007aff", "#ff9500", "#34c759", "#af52de", "#ff3b30", "#5ac8fa", "#ffcc00"];
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length]!;
}
