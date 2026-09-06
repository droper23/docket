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
  const headline = h("h2", { class: "docket-title-2" }, [data.code]);
  const footnote = h("div", { class: "docket-body-sm" }, [data.title]);
  // A plain inline custom-property addition (no new attribute, no behavior change) — the
  // course's own de-collided color (courseColor.ts) appears once, at full strength, as the
  // card's top-edge accent rule (see layout.css's .docket-course-card::before).
  const cardStyle = `--docket-card-accent:${data.accent}`;

  if (data.href) {
    return h("a", { class: "docket-course-card", href: data.href, style: cardStyle }, [headline, footnote]);
  }

  const card = h("div", { class: "docket-course-card", role: "link", tabindex: "0", style: cardStyle }, [headline, footnote]);
  if (data.onActivate) {
    card.addEventListener("click", data.onActivate);
    // A link (activates and navigates), not a button — Enter only, no Space, per platform
    // link convention (Space is reserved for scrolling the page).
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        data.onActivate!();
      }
    });
  }
  return card;
}
