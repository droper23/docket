import { icons, navIconByLabel } from "../components/icons.js";
import { openSettingsPanel } from "../components/settingsPanel.js";
import { diagnostics } from "../core/diagnostics.js";
import type { ReskinSettings } from "../core/settings.js";
import { h } from "../lib/dom.js";

let navEl: Element | null = null;
let topTabsEl: Element | null = null;
let fabBar: HTMLElement | null = null;

/**
 * Boundary-safe path comparison: `current` is considered "on" `link` if they're equal, or
 * one is a `/`-delimited ancestor of the other — never a raw substring match (so `/home`
 * never matches `/homework`). Returns a specificity score (higher = more specific match) or
 * -1 for no match at all, so callers can pick the single best match among several
 * candidates rather than the first one-directional hit. Exported for direct unit testing
 * (see test/shell.test.ts) — the exact bidirectional-boundary logic is the part worth
 * regression-testing in isolation from the rest of restyleNav()'s DOM work.
 */
export function pathMatchScore(current: string, link: string): number {
  const c = current.replace(/\/+$/, "");
  const l = link.replace(/\/+$/, "");
  if (c === l) return l.length + 1000; // exact match always wins
  if (c.startsWith(l + "/") || l.startsWith(c + "/")) return l.length;
  return -1;
}

/**
 * Restyles LearningSuite's OWN existing top-level `<nav>` (the left sidebar
 * — Course List / To Do List / Announcements / etc.) in place — never a
 * fabricated replacement with guessed routes (spec §10/§48: clicking a nav
 * item must go to a real LearningSuite page). `document.querySelector('nav')`
 * is a defensive heuristic (the first `<nav>` with 2+ links), but confirmed
 * LIVE (Sep 2026) to reliably find this exact sidebar — fails soft, leaving
 * navigation completely untouched, if nothing matches.
 */
function restyleNav(): Element | null {
  const nav = document.querySelector("nav");
  if (!nav) return null;
  const links = Array.from(nav.querySelectorAll("a"));
  if (links.length < 2) return null;
  nav.classList.add("docket-nav-enhanced", "docket-scope");
  // Confirmed live (Sep 2026): landing on a section's shorter index route (e.g.
  // `/student/home`) with the matching sidebar link pointing at a longer default child
  // (`/student/home/dashboard`) is the common case, not the exception — a one-directional
  // `location.pathname.startsWith(href)` check misses it entirely (no row highlighted at
  // all). Score every link bidirectionally first, then mark only the single best
  // (most-specific) match active, so a shorter or longer real match can win, but two
  // links can never both light up for one path.
  let bestLink: Element | null = null;
  let bestScore = -1;
  for (const a of links) {
    const href = a.getAttribute("href");
    if (!href) continue;
    // Confirmed live (Sep 2026): every page carries `<base href="/">`, so these hrefs
    // (e.g. ".Ska5/cid-.../student/home/dashboard", no leading slash) resolve against the
    // SITE ROOT, not against the current page path — resolving against `location.href`
    // instead (as this used to) silently produced a nonsensical doubled-up path that never
    // matched `location.pathname`, so no sidebar row was EVER marked active, on any page.
    // `document.baseURI` is exactly the resolved <base>, so this now matches what the
    // browser itself would actually navigate to on click.
    const score = pathMatchScore(location.pathname, new URL(href, document.baseURI).pathname);
    if (score > bestScore) {
      bestScore = score;
      bestLink = a;
    }
  }
  for (const a of links) {
    a.classList.add("docket-nav-item");
    // Matched purely on the link's own real, already-rendered label text — confirmed live
    // (Sep 2026) across the sidebar, its Grades sub-nav, and the top tab strip — never a
    // fabricated destination. Guarded so re-running on every debounced mutation pass never
    // inserts a second icon into the same link.
    const label = a.textContent?.trim();
    const iconKey = label ? navIconByLabel[label] : undefined;
    if (iconKey && !a.querySelector(".docket-nav-icon")) {
      const icon = icons[iconKey]();
      icon.classList.add("docket-nav-icon");
      a.insertBefore(icon, a.firstChild);
    }
    if (a === bestLink) {
      a.classList.add("docket-nav-item-active");
    }
  }
  return nav;
}

/**
 * Restyles the course-level top tab strip (Home / Content / Exams / Grades /
 * Schedule / Syllabus) in place. Selector confirmed LIVE (Sep 2026):
 * `.bg-top-nav` is LearningSuite's own class name for this exact bar, with
 * real `<a href>` tabs inside — a genuine, semantic, stable selector, not a
 * guess. LearningSuite marks the active tab with its own
 * `bg-top-nav-highlight` class; that's read as the source of truth for
 * which tab gets our active styling, rather than re-deriving it from the
 * URL (spec §10: never invent what's already told to us).
 */
function restyleTopTabs(): Element | null {
  const bar = document.querySelector(".bg-top-nav");
  if (!bar) return null;
  bar.classList.add("docket-top-tabs");
  for (const a of Array.from(bar.querySelectorAll("a"))) {
    a.classList.add("docket-top-tab");
    if (a.classList.contains("bg-top-nav-highlight")) a.classList.add("docket-top-tab-active");
  }
  return bar;
}

export function mountShell(settings: ReskinSettings, onSettingsSaved: (s: ReskinSettings) => void): void {
  navEl = settings.useCompanionNav ? restyleNav() : null;
  topTabsEl = settings.useCompanionNav ? restyleTopTabs() : null;
  diagnostics.shellMounted = !!navEl || !!topTabsEl;

  fabBar = h("div", { class: "docket-floating-bar docket-scope" });
  const settingsBtn = h("button", { class: "docket-fab", "aria-label": "Docket reskin settings" }, [icons.gear()]);
  settingsBtn.addEventListener("click", () => openSettingsPanel(onSettingsSaved));
  fabBar.appendChild(settingsBtn);
  document.body.appendChild(fabBar);
}

export function unmountShell(): void {
  if (navEl) {
    navEl.classList.remove("docket-nav-enhanced", "docket-scope");
    navEl.querySelectorAll(".docket-nav-icon").forEach((icon) => icon.remove());
    navEl.querySelectorAll(".docket-nav-item").forEach((a) => a.classList.remove("docket-nav-item", "docket-nav-item-active"));
  }
  navEl = null;
  if (topTabsEl) {
    topTabsEl.classList.remove("docket-top-tabs");
    topTabsEl.querySelectorAll(".docket-top-tab").forEach((a) => a.classList.remove("docket-top-tab", "docket-top-tab-active"));
  }
  topTabsEl = null;
  fabBar?.remove();
  fabBar = null;
}
