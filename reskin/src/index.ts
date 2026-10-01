import fontInterCss from "./styles/font-inter.css";
import tokensCss from "./styles/tokens.css";
import globalCss from "./styles/global.css";
import typographyCss from "./styles/typography.css";
import layoutCss from "./styles/layout.css";
import navigationCss from "./styles/navigation.css";
import cardsCss from "./styles/cards.css";
import responsiveCss from "./styles/responsive.css";
import scheduleCss from "./styles/schedule.css";
import maxCss from "./styles/max.css";

import { adapters } from "./adapters/registry.js";
import { mountShell, refreshShell } from "./adapters/shell.js";
import { loadSettings } from "./core/settings.js";
import { looksLikeAnnouncementsPage, looksLikeCompactAssignmentsPage } from "./core/pageDetector.js";
import type { ReskinSettings, Appearance } from "./core/settings.js";
import { BACKGROUND_CHOICES } from "./core/settings.js";
import { diagnostics, resetDiagnostics } from "./core/diagnostics.js";
import { observeMutations } from "./lib/observe.js";
import { markScheduleTableGrids } from "./lib/scheduleLayout.js";
import type { Adapter } from "./adapters/types.js";
import { getSetting, setSetting } from "./lib/storage.js";
import { isLearningSuiteHost, isMaxHost } from "./core/hosts.js";

function injectStyles(): void {
  if (document.getElementById("docket-reskin-styles")) return;
  const style = document.createElement("style");
  style.id = "docket-reskin-styles";
  // The @font-face block goes first: its data: URI carries the bundled Inter face
  // (zero network requests) that tokens.css's --docket-font stack leads with.
  style.textContent = [fontInterCss, tokensCss, globalCss, typographyCss, layoutCss, navigationCss, cardsCss, responsiveCss, scheduleCss].join("\n");
  // At @run-at document-start (issue #7 fix) <head> may not exist yet — a <style>
  // appended to <html> still applies (CSS doesn't care where it lives), which is the
  // whole point: kill the native-typeface flash BEFORE first paint instead of after it.
  (document.head ?? document.documentElement).appendChild(style);
}

function injectMaxStyles(): void {
  if (document.getElementById("docket-max-reskin-styles")) return;
  const style = document.createElement("style");
  style.id = "docket-max-reskin-styles";
  // MAX does not share LearningSuite's markup, but it does share the same
  // settings and token vocabulary. MAX-specific CSS maps those tokens onto its
  // legacy selectors without mounting the LearningSuite shell.
  style.textContent = [fontInterCss, maxCss].join("\n");
  (document.head ?? document.documentElement).appendChild(style);
}

// MAX's legacy styles are loaded after a document-start userscript. Move our
// layer to the end of <head> once, so equal-specificity native rules cannot
// reclaim the course chrome after the page finishes streaming.
function ensureMaxStylesLast(): void {
  const style = document.getElementById("docket-max-reskin-styles");
  if (!style || !document.head || document.head.lastElementChild === style) return;
  document.head.appendChild(style);
}

/**
 * MAX support intentionally starts as a non-destructive CSS layer. Its views are
 * not LearningSuite-shaped, so none of the LearningSuite shell/adapters/settings
 * run here. This keeps every MAX link, menu, row, and form native while giving the
 * dashboard's observed semantic surfaces a consistent accessible presentation.
 */
function applyMaxTheme(settings: ReskinSettings): void {
  // MAX's production baseline is dark and has no site-side appearance signal.
  // Keep System aligned with that baseline; an explicit Light/Dark setting
  // remains available through the shared reskin settings.
  const dark = settings.appearance !== "light";
  document.documentElement.setAttribute("data-docket-theme", dark ? "dark" : "light");
  if (BACKGROUND_CHOICES.includes(settings.background)) {
    document.documentElement.setAttribute("data-docket-background", settings.background);
  } else {
    document.documentElement.removeAttribute("data-docket-background");
  }
  document.documentElement.setAttribute("data-docket-reduced-motion", String(settings.reducedMotion));
}

function maxAncestors(element: Element): HTMLElement[] {
  const ancestors: HTMLElement[] = [];
  for (let current = element.parentElement; current; current = current.parentElement) ancestors.push(current);
  return ancestors;
}

function maxPathMatchScore(current: string, href: string): number {
  const path = new URL(href, document.baseURI).pathname.replace(/\/+$/, "");
  const here = current.replace(/\/+$/, "");
  if (path === here) return path.length + 1000;
  return here.startsWith(path + "/") || path.startsWith(here + "/") ? path.length : -1;
}

function markMaxAncestor(
  element: Element,
  className: string,
  predicate: (candidate: HTMLElement, rect: DOMRect) => boolean,
): HTMLElement | undefined {
  const match = maxAncestors(element).find((candidate) => predicate(candidate, candidate.getBoundingClientRect()));
  match?.classList.add(className);
  return match;
}

function setMaxStyle(element: HTMLElement, properties: Record<string, string>): void {
  for (const [property, value] of Object.entries(properties)) {
    element.style.setProperty(property, value, "important");
  }
}

/**
 * MAX's production views use generated class names, so its shell cannot be
 * styled safely with a Bootstrap selector list. Mark the actual visible roles
 * from their stable semantics and measured positions instead. This only adds
 * classes; MAX retains all existing links, menus, and handlers.
 */
function markMaxStructure(): void {
  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"));
  const courseSegment = location.pathname.split("/").filter(Boolean)[0];
  const courseLink = anchors.find((anchor) => courseSegment && new URL(anchor.href).pathname === `/${courseSegment}/`);
  const navLinks = anchors.filter((anchor) => ["Home", "Content", "Grades", "Courses"].includes(anchor.textContent?.trim() ?? ""));

  if (courseLink) {
    courseLink.classList.add("docket-max-course-context");
    const courseHeader = markMaxAncestor(courseLink, "docket-max-course-header", (_candidate, rect) =>
      rect.top < 180 && rect.width > 480 && rect.height >= 42 && rect.height <= 120,
    );
    courseHeader?.classList.add("docket-max-course-header");
  }

  const navigationToggle = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    /toggle navigation/i.test(button.getAttribute("aria-label") ?? button.textContent ?? ""),
  );
  navigationToggle?.classList.add("docket-max-menu-toggle");

  const userLink = anchors.find((anchor) => {
    const label = anchor.textContent?.trim() ?? "";
    const rect = anchor.getBoundingClientRect();
    return anchor !== courseLink && label.length > 2 && rect.top < 260 &&
      !["Home", "Content", "Grades", "Courses", "iCalendar", "Print"].includes(label);
  });
  if (userLink) {
    userLink.classList.add("docket-max-user-menu");
  }

  anchors.filter((anchor) => ["iCalendar", "Print"].includes(anchor.textContent?.trim() ?? ""))
    .forEach((anchor) => anchor.classList.add("docket-max-utility-link"));

  // MAX renders its unused "Navigate" search control differently across views.
  // Mark its small, top-level shell rather than changing the header's DOM.
  const textControls = Array.from(document.querySelectorAll<HTMLElement>("input, [role='searchbox'], [role='textbox'], [contenteditable='true'], [aria-label], [placeholder]"));
  const navigateControl = textControls.find((element) =>
    /navigate/i.test([
      element.getAttribute("placeholder"),
      element.getAttribute("aria-label"),
      element.textContent,
      element instanceof HTMLInputElement ? element.value : "",
    ].filter(Boolean).join(" ")),
  ) ?? textControls.find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < 250 && rect.width >= 100 && rect.width <= 700 && rect.height >= 20 && rect.height <= 120;
  });
  if (navigateControl) {
    navigateControl.classList.add("docket-max-empty-search");
    maxAncestors(navigateControl).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top < 250 && rect.width >= 100 && rect.width <= 700 && rect.height >= 20 && rect.height <= 120;
    })?.classList.add("docket-max-empty-search-shell");
  }

  const firstNavLink = navLinks[0];
  if (firstNavLink && navLinks.length >= 3) {
    const primaryNav = maxAncestors(firstNavLink).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 500 && rect.height <= 140 && navLinks.every((link) => element.contains(link));
    });
    primaryNav?.classList.add("docket-max-primary-nav");
    let activeNav: HTMLAnchorElement | undefined;
    let activeScore = -1;
    for (const link of navLinks) {
      const score = maxPathMatchScore(location.pathname, link.href);
      if (score > activeScore) {
        activeScore = score;
        activeNav = link;
      }
    }
    activeNav?.classList.add("docket-max-active-nav");
  }

  // Dashboard repeats the rail's essential links in a legacy light strip.
  // Hide only that short, fully duplicated group; the rail remains the context nav.
  const shortcutNames = ["Syllabus", "Notes", "Schedule", "Content", "Grade"];
  anchors.find((anchor) => anchor.textContent?.trim() === shortcutNames[0])
    && Array.from(document.querySelectorAll<HTMLElement>("body *")).find((element) => {
      const labels = Array.from(element.querySelectorAll("a"), (link) => link.textContent?.trim());
      return labels.length === shortcutNames.length && shortcutNames.every((label, index) => labels[index] === label);
    })?.classList.add("docket-max-shortcuts");

  // Legacy schedule events use course-provided pastel fills. Detect only visible
  // painted descendants inside the dated schedule table and apply the shared,
  // contrast-safe event treatment without altering any event handlers.
  const scheduleTable = Array.from(document.querySelectorAll<HTMLTableElement>("table")).find((table) => {
    const text = table.textContent ?? "";
    const rect = table.getBoundingClientRect();
    return rect.width > 400 && /Reading|Homework|iClicker/.test(text);
  });
  if (scheduleTable) {
    scheduleTable.classList.add("docket-max-schedule-table");
    // MAX applies fixed row heights inline on this legacy table. A 1px table
    // row is allowed to expand for its contents but cannot retain that empty
    // vertical allocation.
    for (const row of Array.from(scheduleTable.rows)) {
      setMaxStyle(row, { height: "1px", "min-height": "0" });
      for (const cell of Array.from(row.cells)) {
        setMaxStyle(cell, { height: "1px", "min-height": "0", padding: "8px 16px" });
      }
    }
    markMaxAncestor(scheduleTable, "docket-max-main-pane", (_candidate, rect) =>
      rect.left > 180 && rect.width > scheduleTable.getBoundingClientRect().width + 80 && rect.height > 400,
    );
    const eventSurfaces = new Map<HTMLElement, string>();
    for (const cell of Array.from(scheduleTable.querySelectorAll<HTMLElement>("td, [role='cell']"))) {
      const cellRect = cell.getBoundingClientRect();
      const isPaintedEvent = (candidate: HTMLElement): string | undefined => {
        const rect = candidate.getBoundingClientRect();
        const background = getComputedStyle(candidate).backgroundColor;
        const fillsCell = rect.width >= cellRect.width - 4 && rect.height >= cellRect.height - 4;
        return rect.width > 100 && rect.height > 18 && rect.height < 220 && !fillsCell
          && background !== "transparent" && background !== "rgba(0, 0, 0, 0)"
          ? background
          : undefined;
      };

      for (const element of Array.from(cell.querySelectorAll<HTMLElement>("*"))) {
        const background = isPaintedEvent(element);
        if (!background) continue;
        // Several nested descendants can inherit one event's color. Keep the
        // outermost painted wrapper only, so each event receives exactly one
        // rail, width, and left padding.
        let eventSurface = element;
        let eventBackground = background;
        for (let candidate = element.parentElement; candidate && candidate !== cell; candidate = candidate.parentElement) {
          const candidateBackground = isPaintedEvent(candidate);
          if (candidateBackground) {
            eventSurface = candidate;
            eventBackground = candidateBackground;
          }
        }
        eventSurfaces.set(eventSurface, eventBackground);
      }
    }

    for (const [eventSurface, background] of eventSurfaces) {
      eventSurface.classList.add("docket-max-schedule-event");
      // MAX paints event categories with inline colors. Keep each category as a thin
      // LearningSuite-style rail, but clear the large legacy color block itself.
      eventSurface.style.setProperty("--docket-max-rail", background);
      setMaxStyle(eventSurface, {
        display: "block",
        float: "none",
        clear: "both",
        width: "100%",
        "max-width": "100%",
        margin: "3px 0",
        // Reading/Homework labels arrive in a nested text wrapper; iClicker is
        // direct text. Give the latter the same final text start column.
        padding: /^iClicker\b/i.test(eventSurface.textContent?.trim() ?? "")
          ? "6px 10px 6px 30px"
          : "6px 10px 6px 14px",
        background: "transparent",
        "background-color": "transparent",
        "background-image": "none",
        "border-left": `4px solid ${background}`,
      });
    }
  }

  const contentHeading = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3")).find((heading) => heading.textContent?.trim() === "Content");
  if (contentHeading) {
    maxAncestors(contentHeading).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left < 300 && rect.width < 380 && rect.height > 400;
    })?.classList.add("docket-max-sidebar");
  }

  const sidebarHeading = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3")).find((heading) => heading.textContent?.trim() === "Home");
  if (sidebarHeading) {
    const sidebar = markMaxAncestor(sidebarHeading, "docket-max-sidebar", (_candidate, rect) =>
      rect.left < 320 && rect.width >= 180 && rect.width <= 360 && rect.height > 360,
    );
    if (sidebar) {
      setMaxStyle(sidebar, { background: "var(--docket-max-canvas)", "border-right": "1px solid var(--docket-max-border)" });
      const activeLabel = location.pathname.includes("/schedule") ? "Schedule" : location.pathname.includes("/calendar") ? "Calendar" : "Dashboard";
      const activeItem = Array.from(sidebar.querySelectorAll<HTMLElement>("a, button, div")).find((item) => {
        const rect = item.getBoundingClientRect();
        return item.textContent?.trim() === activeLabel && rect.width > 120 && rect.height >= 28 && rect.height < 90;
      });
      if (activeItem) {
        activeItem.classList.add("docket-max-sidebar-active");
        setMaxStyle(activeItem, { background: "var(--docket-max-accent-container)", color: "var(--docket-max-on-accent-container)" });
      }
    }
  }

  const railAnchor = anchors.find((anchor) => ["Dashboard", "Schedule", "Syllabus"].includes(anchor.textContent?.trim() ?? ""));
  if (railAnchor) {
    const sidebar = markMaxAncestor(railAnchor, "docket-max-sidebar", (_candidate, rect) =>
      rect.left < 320 && rect.width >= 180 && rect.width <= 360 && rect.height > 360,
    );
    const currentRail = Array.from(sidebar?.querySelectorAll<HTMLAnchorElement>("a") ?? []).reduce<HTMLAnchorElement | undefined>((best, link) =>
      maxPathMatchScore(location.pathname, link.href) > maxPathMatchScore(location.pathname, best?.href ?? "") ? link : best,
    undefined);
    currentRail?.classList.add("docket-max-sidebar-active");
  }

  const readingHeading = Array.from(document.querySelectorAll<HTMLElement>("h1")).find((heading) => heading.textContent?.trim() !== "");
  if (readingHeading) {
    maxAncestors(readingHeading).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 200 && rect.width > 1000 && rect.height > 400;
    })?.classList.add("docket-max-main-pane");
  }

  const dashboardHeading = Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3")).find((heading) => /^(Upcoming Week|Announcements)$/i.test(heading.textContent?.trim() ?? ""));
  if (dashboardHeading) {
    markMaxAncestor(dashboardHeading, "docket-max-main-pane", (_candidate, rect) =>
      rect.left >= 180 && rect.width > 900 && rect.height > 380,
    );
  }

  const contentRows = anchors.filter((anchor) => {
    const path = new URL(anchor.href).pathname;
    return path.startsWith(`${location.pathname}/`) && path !== location.pathname;
  });
  contentRows.forEach((link) => {
    maxAncestors(link).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 360 && rect.height > 20 && rect.height < 110 &&
        contentRows.filter((row) => element.contains(row)).length === 1;
    })?.classList.add("docket-max-content-row");
  });

  // Content exposes the same outline three ways: rail, a native select, and
  // the reading list. Keep the rail as the contextual outline and remove this
  // duplicate only when its options plainly mirror the rail's Reading view.
  Array.from(document.querySelectorAll<HTMLSelectElement>("select")).forEach((select) => {
    const mirrorsReadingOutline = Array.from(select.options).some((option) => option.textContent?.trim() === "Reading Instructions");
    if (!mirrorsReadingOutline) return;
    maxAncestors(select).find((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 500 && rect.height < 120;
    })?.classList.add("docket-max-redundant-outline");
  });
}

function bootMax(): void {
  if (!isMaxHost(location.hostname)) return;
  document.documentElement.setAttribute("data-docket-max-reskin", "true");
  injectMaxStyles();
  ensureMaxStylesLast();
  applyMaxTheme(loadSettings());
  // MAX streams its course chrome and schedule after DOMContentLoaded. A two-frame
  // pass catches a warm cache, while this child-list observer catches the normal
  // delayed render without observing our own class/style writes.
  const mark = () => markMaxStructure();
  requestAnimationFrame(() => requestAnimationFrame(mark));
  observeMutations(document.body, mark);
}

/**
 * Companion to injectStyles() for the document-start path: a style tag injected
 * before <head> exists ends up on <html>, i.e. EARLIER in document order than
 * LearningSuite's own <link>/<style> elements — and equal-specificity,
 * equal-importance rules are won by whichever comes last. boot() re-parents our
 * style to the end of <head> once it exists, restoring the cascade position the
 * document-idle injection used to get, while the early copy already covered first
 * paint. (Moving a <style> node re-evaluates it; once per page load, not a hot path.)
 */
function ensureStylesLast(): void {
  const style = document.getElementById("docket-reskin-styles");
  if (!style || !document.head) return;
  if (style.parentElement === document.head && document.head.lastElementChild === style) return;
  document.head.appendChild(style);
}

/**
 * Confirmed live: LearningSuite has its own independent dark-mode toggle
 * (`html.dark`), a manual per-site setting unrelated to the OS
 * `prefers-color-scheme` — a user can have either in either state, and
 * LearningSuite ALWAYS gives this signal one way or another (the class is
 * either present or absent — there is no "LearningSuite is silent" case).
 * So "system" here means "match what LearningSuite itself is actually
 * showing" — full stop. Reproduced live: OR-ing in `prefers-color-scheme`
 * broke this exact case — LearningSuite in native light mode
 * (`html.className === "h-full"`, no `dark` class) with the OS/browser set
 * to a dark color scheme painted this reskin's dark header/nav over
 * LearningSuite's own light content, producing white-on-white and
 * beige-on-black. `prefers-color-scheme` is never consulted here: the site
 * signal is always available, so there is nothing for it to be a fallback
 * for. Always sets an explicit dark/light attribute — see tokens.css, which
 * has no bare `prefers-color-scheme` fallback path of its own.
 *
 * `html.classList.contains("h-full")` (confirmed live present on every real
 * LearningSuite-rendered page regardless of dark/light) is the actual "site gave a signal"
 * check, not just "dark is absent" — confirmed live a genuine native error page renders
 * `<html class="">`, neither `h-full` nor `dark`. Without this, that case fell through to
 * a hardcoded `light`, flipping a Dark-mode account's whole reskin to light outside the
 * SPA's own state (Sep 2026 fix). The last real (non-fallback) reading is persisted via
 * getSetting/setSetting (src/lib/storage.ts) and reused instead, so a stray error page
 * inherits whatever the user was just actually looking at.
 */
// Set once an explicit Appearance override ever writes to LearningSuite's own native `dark`
// class this page load (see applyTheme() below) — after that, the class no longer reflects
// LearningSuite's real state, so the "system" branch must stop trusting a live read of it.
let nativeThemeClassOverridden = false;

function applyTheme(appearance: Appearance): void {
  let dark: boolean;
  if (appearance === "dark" || appearance === "light") {
    dark = appearance === "dark";
    nativeThemeClassOverridden = true;
  } else if (!nativeThemeClassOverridden && document.documentElement.classList.contains("h-full")) {
    // Safe to trust a live read only as long as nothing above has ever touched the class this
    // page load — otherwise this would just be reading our own prior override back, live-
    // confirmed to flip "system" mode permanently to whatever the last explicit override was
    // (a real regression the override fix above would otherwise introduce: switching Light →
    // System never returned to the account's actual Dark preference).
    dark = document.documentElement.classList.contains("dark");
    setSetting("lastKnownDark", dark);
  } else {
    dark = getSetting("lastKnownDark", true);
  }
  // LearningSuite's own native `.dark`-gated tokens (e.g. `--ba`, which bare `.bg-base` reads —
  // global.css's own documented, deliberate native-passthrough for menus/dropdowns) are a real,
  // live surface this reskin doesn't fully paint over. Live-confirmed: Appearance forced to
  // Light with the account's LearningSuite-side preference left on Dark left every `.bg-base`
  // surface (the narrow-viewport nav backdrop and every native dropdown/menu) rendering
  // native's dark gray on an otherwise light page. Keeping the class unconditionally in sync
  // with whatever `dark` this function just resolved — not only in the explicit-override
  // branch — also restores it correctly when the user switches back to "system" after an
  // override (the branch above deliberately ignores the now-untrustworthy live class then, but
  // the class itself still needs to end up matching the real resolved theme, not be left as
  // whatever the last override set it to).
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.setAttribute("data-docket-theme", dark ? "dark" : "light");
}

/**
 * Settings > Background (Sep 2026 pass): threads the curated canvas choice onto
 * <html> as `data-docket-background`, which tokens.css keys per-theme canvas
 * overrides off. "default" (or any unknown/stale persisted value) removes the
 * attribute entirely so the theme's own canvas applies — no-op for the default
 * user, and self-healing if a saved value ever falls out of the curated set.
 */
function applyBackground(settings: ReskinSettings): void {
  if (BACKGROUND_CHOICES.includes(settings.background)) {
    document.documentElement.setAttribute("data-docket-background", settings.background);
  } else {
    document.documentElement.removeAttribute("data-docket-background");
  }
}

let activeAdapter: Adapter | null = null;

/**
 * Re-run on every full page load and every debounced DOM mutation (see
 * lib/observe.ts) — LearningSuite reloads the whole page between top-level
 * sections but re-renders some widgets (Vue islands, accordions) in place
 * without one, so both triggers matter (spec §29). Compatibility Mode stops
 * here, before any adapter runs, keeping only the CSS polish already
 * injected — no DOM rewriting at all.
 */
function runAdapters(settings: ReskinSettings): void {
  resetDiagnostics();
  diagnostics.pageKind = location.pathname;
  // Re-checked on every pass, not just at boot: LearningSuite's own dark-mode toggle can
  // change without a full page reload, and this reskin should always track it.
  applyTheme(settings.appearance);
  applyBackground(settings);
  // Course-scoped Schedule page scope (Sep 2026 pass, issue #6): schedule.css's deeper
  // restyle keys off this attribute instead of a CSS :has() so it also works on Safari 14
  // (the build's own target — :has() only shipped in Safari 15.4). The probe is a
  // live-confirmed DOM signal, not a guessed selector: `main .innerBox` is the page's view
  // switcher trigger, present ONLY on the Schedule page across the eight page types
  // censused this pass (tools/audit/40-compound-census.mjs: calendar 1, home/dashboard/
  // announcements/assignments/gradebook/syllabus/pages 0). Re-checked every pass, so the
  // attribute (and with it the scoped styles) self-corrects if LearningSuite ever changes
  // that page's chrome.
  const pageKind = document.querySelector("main .innerBox")
    ? "schedule"
    : looksLikeAnnouncementsPage()
      ? "announcements"
      : undefined;
  if (pageKind) document.documentElement.setAttribute("data-docket-page", pageKind);
  else document.documentElement.removeAttribute("data-docket-page");
  if (pageKind === "schedule") {
    // The Schedule Table view's mobile grid is reshaped only by CSS; these markers identify
    // its confirmed repeating Date / Column 1 / Column 2 cells without touching their content
    // or listeners. See lib/scheduleLayout.ts and schedule.css.
    const main = document.querySelector("main");
    if (main) markScheduleTableGrids(main);
  }
  // LearningSuite serves a genuinely different compact Assignments DOM at phone widths:
  // category disclosure rows replace the desktop assignment rows, so the card adapter
  // correctly falls back. Scope the native-control polish to the live-confirmed shape rather
  // than attempting to recreate its expanders, homework-ID menu, or Course Progress panel.
  if (looksLikeCompactAssignmentsPage()) {
    document.documentElement.setAttribute("data-docket-compact-assignments", "true");
  } else {
    document.documentElement.removeAttribute("data-docket-compact-assignments");
  }
  // Threaded onto <html> so both the main page (tokens.css) and any shadow-DOM panel
  // (settingsPanel.ts/diagnosticsPanel.ts read this same attribute at open time) can
  // suppress motion from one explicit signal — see settings.ts's reducedMotion field.
  document.documentElement.setAttribute("data-docket-reduced-motion", String(settings.reducedMotion));
  // Lifts global.css's ready-gate (`main { visibility: hidden }` until this is set — see
  // earlyInject()'s own failsafe timeout for the "no adapter ever runs" case). Safe to set
  // before the adapter branch below despite hiding native content synchronously inside
  // mount(): everything from here to the end of this function call runs in one JS task, so
  // the browser can't paint an intermediate "ready but not yet hidden" frame in between.
  document.documentElement.setAttribute("data-docket-ready", "true");

  if (settings.compatibilityMode) {
    activeAdapter?.unmount();
    activeAdapter = null;
    return;
  }

  const match =
    adapters.find((a) => {
      try {
        return a.matches();
      } catch {
        return false;
      }
    }) ?? null;

  if (match !== activeAdapter) {
    activeAdapter?.unmount();
    activeAdapter = match;
  }
  if (!activeAdapter) return;

  try {
    activeAdapter.mount(settings.compatibilityMode);
    diagnostics.activeAdapterId = activeAdapter.id;
  } catch (err) {
    // Spec §27: a broken adapter must never destroy the page — undo whatever
    // it managed to do and fall back to LearningSuite's native UI untouched.
    diagnostics.adapterError = err instanceof Error ? err.message : String(err);
    try {
      activeAdapter.unmount();
    } catch {
      // Already broken; nothing more to safely undo.
    }
    activeAdapter = null;
  }
}

function boot(): void {
  if (!isLearningSuiteHost(location.hostname)) return;

  document.documentElement.setAttribute("data-docket-reskin", "true");
  injectStyles();
  ensureStylesLast();

  let currentSettings = loadSettings();

  mountShell(currentSettings, (next) => {
    // Nav on/off and Compatibility Mode genuinely need a clean remount (they change which
    // adapters run and how LearningSuite's own nav markup is rewritten) — a full reload is
    // the simplest safe way to get one, matching LearningSuite's own full-page-reload
    // navigation model (learningsuite-handoff.md §1.1). Appearance/background/reduced-motion
    // are pure CSS/attribute toggles with no adapter-remount dependency at all — reloading for
    // those discarded scroll position and, on Combined Schedule specifically, reset
    // homeAdapter.ts's own module-level accumulator and scrolledToToday flag, yanking a
    // student previewing background colors back to today's position (confirmed live, Sep
    // 2026). Applied live instead, via the exact same functions runAdapters() already calls on
    // every pass — `data-docket-theme`/`data-docket-background` were already
    // live-toggleable attributes elsewhere in the codebase; this just stops throwing that away
    // with an unconditional reload.
    const needsRemount = next.useCompanionNav !== currentSettings.useCompanionNav || next.compatibilityMode !== currentSettings.compatibilityMode;
    // Course-color overrides are baked into the enhanced cards when their adapter mounts;
    // unlike theme/background, there is no document-level CSS token to update. Remount the
    // current adapter so the selected color is visible immediately (and remains backed by the
    // settings value already saved by the panel).
    const courseColorsChanged = next.courseColors !== currentSettings.courseColors;
    currentSettings = next;
    if (needsRemount) {
      location.reload();
      return;
    }
    applyTheme(next.appearance);
    applyBackground(next);
    document.documentElement.setAttribute("data-docket-reduced-motion", String(next.reducedMotion));
    if (courseColorsChanged) {
      activeAdapter?.unmount();
      activeAdapter = null;
      runAdapters(next);
    }
  });

  runAdapters(currentSettings);
  observeMutations(document.body, () => {
    const settings = loadSettings();
    refreshShell(settings);
    runAdapters(settings);
  });
  // The body observer above only sees childList/subtree changes — it never fires when the
  // user flips LearningSuite's own Dark Mode toggle, which only changes the `class`
  // attribute on <html>, not body content. Watch that specifically so theme changes are
  // caught immediately rather than waiting on the next unrelated content mutation.
  observeMutations(document.documentElement, () => runAdapters(loadSettings()), { attributes: true, attributeFilter: ["class"] });
}

/**
 * The document-start half of the issue #7 fix. The bundle now runs before the
 * parser has built the page (confirmed live via CDP
 * addScriptToEvaluateOnNewDocument: readyState "loading", document.head null) —
 * and in that same live check document.documentElement itself was still absent on
 * the very first task, so an unconditional setAttribute here would throw and take
 * the whole bundle (including boot()'s DOMContentLoaded registration) down with it.
 * Poll until the root element appears — nothing can be painted before a root
 * element exists, so even the first successful tick lands before first paint —
 * then apply the reskin attribute + full CSS immediately. Everything that touches
 * LearningSuite's markup (mountShell, adapters) stays in boot(), deferred to
 * DOMContentLoaded exactly as before.
 */
/**
 * Mirrors applyTheme()'s real-signal logic (see its own doc comment for the confirmed-live
 * failure mode this avoids) but safe to call before boot() — `runAdapters()`'s own
 * applyTheme() remains the authoritative, continuously-reconciling pass once boot() runs;
 * this only kills the gap where NO theme attribute is set at all during initial load.
 */
function earlyApplyTheme(): boolean {
  if (!document.documentElement.classList.contains("h-full")) return false;
  const dark = document.documentElement.classList.contains("dark");
  document.documentElement.setAttribute("data-docket-theme", dark ? "dark" : "light");
  setSetting("lastKnownDark", dark);
  return true;
}

/**
 * The document-start half of the issue #7 fix. The bundle now runs before the
 * parser has built the page (confirmed live via CDP
 * addScriptToEvaluateOnNewDocument: readyState "loading", document.head null) —
 * and in that same live check document.documentElement itself was still absent on
 * the very first task, so an unconditional setAttribute here would throw and take
 * the whole bundle (including boot()'s DOMContentLoaded registration) down with it.
 * Poll until the root element appears — nothing can be painted before a root
 * element exists, so even the first successful tick lands before first paint —
 * then apply the reskin attribute + full CSS immediately. Everything that touches
 * LearningSuite's markup (mountShell, adapters) stays in boot(), deferred to
 * DOMContentLoaded exactly as before.
 *
 * `tokens.css`'s un-attributed base block is the LIGHT palette, so before this pass a
 * dark-mode student saw the viewport paint light first, then snap to dark once boot() ran
 * `applyTheme()` at DOMContentLoaded — a real flash-of-wrong-theme on every full-page
 * navigation (LearningSuite navigates between top-level sections with real page loads, not
 * SPA routing). `earlyApplyTheme()` above sets the real theme attribute as soon as
 * LearningSuite's own `html.h-full` class lands, which is normally within the same
 * document-start tick; a short bounded poll covers the rare case it hasn't yet, falling back
 * to the last real theme this reskin ever observed (same fallback `applyTheme()` itself
 * uses) rather than leaving the gap open indefinitely.
 */
function earlyInject(): void {
  const pollTheme = (attempt: number): void => {
    if (earlyApplyTheme()) return;
    if (attempt >= 20) {
      // ~400ms of polling with nothing from LearningSuite yet — fall back rather than leave
      // no theme attribute set at all.
      document.documentElement.setAttribute("data-docket-theme", getSetting("lastKnownDark", true) ? "dark" : "light");
      return;
    }
    setTimeout(() => pollTheme(attempt + 1), 20);
  };

  const tick = (): void => {
    if (document.getElementById("docket-reskin-styles")) return; // already in
    if (!document.documentElement) {
      setTimeout(tick, 0);
      return;
    }
    document.documentElement.setAttribute("data-docket-reskin", "true");
    injectStyles();
    pollTheme(0);
    // Failsafe for global.css's ready-gate (`main { visibility: hidden }` until
    // `data-docket-ready` is set, normally by runAdapters() at the end of boot()): a native
    // page with no matching adapter must still become visible, never fail permanently hidden.
    setTimeout(() => {
      if (!document.documentElement.hasAttribute("data-docket-ready")) {
        document.documentElement.setAttribute("data-docket-ready", "true");
      }
    }, 400);
  };
  if (document.documentElement) tick();
  else setTimeout(tick, 0);
}

if (isMaxHost(location.hostname)) {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootMax);
  else bootMax();
} else if (!isLearningSuiteHost(location.hostname)) {
  // Not a supported learning product: do nothing at all. Exact host checks avoid
  // styling lookalike subdomains or unrelated BYU properties.
} else if (document.readyState === "loading") {
  earlyInject();
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
