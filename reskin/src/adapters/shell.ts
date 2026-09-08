import { icons, navIconByLabel } from "../components/icons.js";
import { openSettingsPanel } from "../components/settingsPanel.js";
import { diagnostics } from "../core/diagnostics.js";
import type { ReskinSettings } from "../core/settings.js";
import { h } from "../lib/dom.js";

let navEl: Element | null = null;
let topTabsEl: Element | null = null;
let fabBar: HTMLElement | null = null;
let skipLink: HTMLElement | null = null;
let fabAutoHideAttached = false;

/**
 * Below LearningSuite's own `lg` breakpoint (1024px — see `.docket-wordmark`'s media queries
 * above for the same confirmed cutoff) the sidebar collapses to a hamburger and the floating
 * settings bar loses the dead column it normally sits in, landing directly on top of scrolled
 * list content instead (confirmed live, Sep 2026 UX audit). Fading it out while the page is
 * actively being scrolled down, and back in on scroll-up or once scrolling stops, keeps it from
 * blocking content without removing the control.
 *
 * Confirmed live: the page does NOT scroll via `window`/`document.documentElement` — the real
 * content pane is an inner `overflow-auto` div LearningSuite renders itself (a generic Tailwind
 * class combination, not a stable selector worth hardcoding). `scroll` doesn't bubble, so a
 * listener on `document` only ever sees it by registering for the CAPTURE phase (the `true`
 * below) — that's what lets this find the real scrolling element on any page without having to
 * name it, the same "don't guess a selector" discipline this file's own comments follow
 * elsewhere, just applied to an event target instead of a CSS selector.
 */
function initFabAutoHide(): void {
  if (fabAutoHideAttached) return;
  fabAutoHideAttached = true;
  const narrow = window.matchMedia("(max-width: 1023px)");
  const lastY = new WeakMap<EventTarget, number>();
  let settleTimer: number | undefined;
  document.addEventListener(
    "scroll",
    (e) => {
      if (!fabBar || !narrow.matches) return;
      const target = e.target === document ? (document.scrollingElement ?? document.documentElement) : e.target;
      if (!target) return;
      const y = target instanceof Element ? target.scrollTop : window.scrollY;
      const delta = y - (lastY.get(target) ?? 0);
      lastY.set(target, y);
      if (delta > 4 && y > 80) {
        fabBar.classList.add("docket-floating-bar-hidden");
      } else if (delta < -4 || y <= 80) {
        fabBar.classList.remove("docket-floating-bar-hidden");
      }
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => fabBar?.classList.remove("docket-floating-bar-hidden"), 900);
    },
    { passive: true, capture: true },
  );
}

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

/**
 * First-letter-of-first-word + first-letter-of-last-word, uppercased — the same "derive from
 * real rendered text, never fabricate" discipline navIconByLabel matching already follows.
 * Exported for direct unit testing (see test/shell.test.ts), same rationale as
 * pathMatchScore() above. A single-word name falls back to just that letter; an empty/
 * unparseable string falls back to "" so the caller can skip rendering the avatar entirely
 * rather than showing an empty or malformed chip.
 */
export function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0]![0]!;
  const last = parts[parts.length - 1]![0]!;
  return (parts.length > 1 ? first + last : first).toUpperCase();
}

/**
 * Restyles the masthead's own real `#_topLink` (confirmed live, Sep 2026: LearningSuite's own
 * id for the BYU-logo + "Learning Suite" icon-and-text lockup, a real link to the LearningSuite
 * home page) and `.header-userdropdown-trigger` in place — never replaced, per this file's own
 * restyleNav()/restyleTopTabs() discipline above. navigation.css hides the native `<img>`s and
 * stacked text via CSS (`display: none`, not removed from the DOM); this only INSERTS the two
 * new elements CSS alone can't produce: a real text wordmark (a marketing-hero color/weight
 * scale needs its own real DOM text node, not a `content:` pseudo-element — this codebase's only
 * prior use of pseudo-element content is the decorative hover-pill in navigation.css, never real
 * text) and an initials avatar chip (computed from the trigger's own already-rendered name text,
 * `span.hidden.md\:inline` — the same "read what's really on the page" rule matching every other
 * adapter's own extraction). Idempotent — guarded so a later debounced mutation pass never
 * inserts a second copy, matching restyleNav()'s own icon-insertion guard.
 */
function restyleMasthead(): void {
  const topLink = document.querySelector("#_topLink");
  if (topLink && !topLink.querySelector(".docket-wordmark")) {
    topLink.appendChild(
      h("span", { class: "docket-wordmark docket-scope", "aria-hidden": "true" }, [
        h("span", { class: "docket-wordmark-brand" }, ["BYU"]),
        h("span", { class: "docket-wordmark-suite" }, ["Learning Suite"]),
      ]),
    );
  }

  const trigger = document.querySelector(".header-userdropdown-trigger");
  if (trigger && !trigger.querySelector(".docket-user-avatar")) {
    const nameEl = trigger.querySelector(".hidden.md\\:inline");
    const initials = computeInitials(nameEl?.textContent ?? "");
    if (initials) {
      trigger.insertBefore(
        h("span", { class: "docket-user-avatar docket-scope", "aria-hidden": "true" }, [initials]),
        trigger.firstChild,
      );
    }
  }
}

/**
 * Relocates the Student View banner's one REAL action (confirmed live, Sep 2026:
 * `section.bg-attention` — present only for an instructor account currently previewing a course
 * as a student — contains a decorative eye icon, a "Student View" label, and a real
 * `a > i.fal.fa-undo` link that actually navigates back to instructor view) from a permanent
 * full-width banner into a small icon on the existing settings-gear `fabBar`. The user's own
 * framing: this is a rarely-used action that doesn't deserve to permanently occupy a full-width
 * strip of chrome. The real anchor is never physically moved (risks breaking any parent-scoped
 * listener) and never re-navigated by reading its `href` (risks skipping an attached handler) —
 * this button just re-fires the real anchor's own click, the exact same "re-fire a row's own
 * click" idiom `lib/dom.ts`'s `createOverlayToggle` already uses. Fails soft (returns without
 * touching anything) if the banner or its real link isn't found — the existing `.bg-attention`
 * color-token rule in global.css stays in place as the fallback for exactly that case, so an
 * instructor is never left with a hidden banner and no way back.
 */
function mountStudentViewBadge(): void {
  for (const stale of document.querySelectorAll(".docket-student-view-fab")) stale.remove();
  const banner = document.querySelector("section.bg-attention");
  const undoLink = banner?.querySelector("a i.fa-undo")?.closest("a");
  if (!banner || !undoLink || !fabBar) return;

  const btn = h(
    "button",
    { class: "docket-fab docket-student-view-fab", "aria-label": "Student View — back to instructor view", title: "Back to instructor view" },
    [icons.eye()],
  );
  btn.addEventListener("click", () => (undoLink as HTMLElement).click());
  fabBar.appendChild(btn);
  banner.classList.add("docket-banner-relocated");
}

export function mountShell(settings: ReskinSettings, onSettingsSaved: (s: ReskinSettings) => void): void {
  navEl = settings.useCompanionNav ? restyleNav() : null;
  topTabsEl = settings.useCompanionNav ? restyleTopTabs() : null;
  diagnostics.shellMounted = !!navEl || !!topTabsEl;

  // Idempotency guard: boot() runs once per page load, but any other re-entry
  // (e.g. the project's CDP re-injection loop, or a future programmatic remount)
  // would otherwise stack duplicate settings FABs — observed live this pass when
  // three accumulated over an audit session. One bar, ever.
  for (const stale of document.querySelectorAll(".docket-floating-bar")) stale.remove();
  fabBar = h("div", { class: "docket-floating-bar docket-scope" });
  const settingsBtn = h("button", { class: "docket-fab", "aria-label": "Docket reskin settings" }, [icons.gear()]);
  settingsBtn.addEventListener("click", () => openSettingsPanel(onSettingsSaved));
  fabBar.appendChild(settingsBtn);
  // `position: fixed` means this doesn't move it visually — but on a long page (Combined
  // Schedule can render ~300 rows) appending it at the end of <body> put it near the very
  // last tab stop. Inserted at the front instead so it's reachable early.
  document.body.insertBefore(fabBar, document.body.firstChild);
  initFabAutoHide();

  for (const stale of document.querySelectorAll(".docket-skip")) stale.remove();
  const main = document.querySelector("main");
  if (main) {
    if (!main.id) main.id = "docket-main";
    skipLink = h("a", { href: `#${main.id}`, class: "docket-skip docket-scope" }, ["Skip to content"]);
    document.body.insertBefore(skipLink, document.body.firstChild);
  }

  // Unconditional (not gated by useCompanionNav — this isn't a nav feature): the wordmark/
  // avatar restyle the masthead's own real elements in place, and the Student View badge needs
  // `fabBar`, just created above.
  restyleMasthead();
  mountStudentViewBadge();
}

export function unmountShell(): void {
  if (navEl) {
    navEl.classList.remove("docket-nav-enhanced", "docket-scope");
    navEl.querySelectorAll(".docket-nav-icon").forEach((icon) => icon.remove());
    navEl.querySelectorAll(".docket-nav-item").forEach((a) => a.classList.remove("docket-nav-item", "docket-nav-item-active"));
  }
  navEl = null;
  document.querySelector("#_topLink .docket-wordmark")?.remove();
  document.querySelector(".header-userdropdown-trigger .docket-user-avatar")?.remove();
  document.querySelector(".docket-banner-relocated")?.classList.remove("docket-banner-relocated");
  if (topTabsEl) {
    topTabsEl.classList.remove("docket-top-tabs");
    topTabsEl.querySelectorAll(".docket-top-tab").forEach((a) => a.classList.remove("docket-top-tab", "docket-top-tab-active"));
  }
  topTabsEl = null;
  fabBar?.remove();
  fabBar = null;
  skipLink?.remove();
  skipLink = null;
}
