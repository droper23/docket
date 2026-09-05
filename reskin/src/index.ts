import fontInterCss from "./styles/font-inter.css";
import tokensCss from "./styles/tokens.css";
import globalCss from "./styles/global.css";
import typographyCss from "./styles/typography.css";
import layoutCss from "./styles/layout.css";
import navigationCss from "./styles/navigation.css";
import cardsCss from "./styles/cards.css";
import responsiveCss from "./styles/responsive.css";
import scheduleCss from "./styles/schedule.css";

import { adapters } from "./adapters/registry.js";
import { mountShell } from "./adapters/shell.js";
import { loadSettings } from "./core/settings.js";
import type { ReskinSettings, Appearance } from "./core/settings.js";
import { BACKGROUND_CHOICES } from "./core/settings.js";
import { diagnostics, resetDiagnostics } from "./core/diagnostics.js";
import { observeMutations } from "./lib/observe.js";
import type { Adapter } from "./adapters/types.js";
import { getSetting, setSetting } from "./lib/storage.js";

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
function applyTheme(appearance: Appearance): void {
  let dark: boolean;
  if (appearance === "dark" || appearance === "light") {
    dark = appearance === "dark";
  } else if (document.documentElement.classList.contains("h-full")) {
    dark = document.documentElement.classList.contains("dark");
    setSetting("lastKnownDark", dark);
  } else {
    dark = getSetting("lastKnownDark", true);
  }
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
  if (document.querySelector("main .innerBox")) {
    document.documentElement.setAttribute("data-docket-page", "schedule");
  } else {
    document.documentElement.removeAttribute("data-docket-page");
  }
  // Threaded onto <html> so both the main page (tokens.css) and any shadow-DOM panel
  // (settingsPanel.ts/diagnosticsPanel.ts read this same attribute at open time) can
  // suppress motion from one explicit signal — see settings.ts's reducedMotion field.
  document.documentElement.setAttribute("data-docket-reduced-motion", String(settings.reducedMotion));

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
  if (!/learningsuite\.byu\.edu$/.test(location.hostname)) return;

  document.documentElement.setAttribute("data-docket-reskin", "true");
  injectStyles();
  ensureStylesLast();

  const settings = loadSettings();

  mountShell(settings, (next) => {
    // Nav on/off and Compatibility Mode need a clean remount; a full reload
    // is the simplest safe way to get one, matching LearningSuite's own
    // full-page-reload navigation model (learningsuite-handoff.md §1.1) —
    // this is not a workaround, it's the same transition the site already
    // uses for its own top-level navigation.
    void next;
    location.reload();
  });

  runAdapters(settings);
  observeMutations(document.body, () => runAdapters(loadSettings()));
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
function earlyInject(): void {
  const tick = (): void => {
    if (document.getElementById("docket-reskin-styles")) return; // already in
    if (!document.documentElement) {
      setTimeout(tick, 0);
      return;
    }
    document.documentElement.setAttribute("data-docket-reskin", "true");
    injectStyles();
  };
  if (document.documentElement) tick();
  else setTimeout(tick, 0);
}

if (!/learningsuite\.byu\.edu$/.test(location.hostname)) {
  // Not LearningSuite: do nothing at all (same guard boot() had — hoisted so even
  // the style injection never happens on another origin).
} else if (document.readyState === "loading") {
  earlyInject();
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
