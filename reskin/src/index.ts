import tokensCss from "./styles/tokens.css";
import globalCss from "./styles/global.css";
import typographyCss from "./styles/typography.css";
import layoutCss from "./styles/layout.css";
import navigationCss from "./styles/navigation.css";
import cardsCss from "./styles/cards.css";
import responsiveCss from "./styles/responsive.css";

import { adapters } from "./adapters/registry.js";
import { mountShell } from "./adapters/shell.js";
import { loadSettings } from "./core/settings.js";
import type { ReskinSettings, Appearance } from "./core/settings.js";
import { diagnostics, resetDiagnostics } from "./core/diagnostics.js";
import { observeMutations } from "./lib/observe.js";
import type { Adapter } from "./adapters/types.js";

function injectStyles(): void {
  if (document.getElementById("docket-reskin-styles")) return;
  const style = document.createElement("style");
  style.id = "docket-reskin-styles";
  style.textContent = [tokensCss, globalCss, typographyCss, layoutCss, navigationCss, cardsCss, responsiveCss].join("\n");
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
 */
function applyTheme(appearance: Appearance): void {
  let dark: boolean;
  if (appearance === "dark" || appearance === "light") {
    dark = appearance === "dark";
  } else {
    dark = document.documentElement.classList.contains("dark");
  }
  document.documentElement.setAttribute("data-docket-theme", dark ? "dark" : "light");
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
