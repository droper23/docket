import panelCss from "../styles/panel.css";
import { loadSettings, saveSettings } from "../core/settings.js";
import type { Appearance, ReskinSettings } from "../core/settings.js";
import { openDiagnosticsPanel } from "./diagnosticsPanel.js";

let host: HTMLElement | null = null;

/** Settings live in a Shadow DOM root so neither LearningSuite's CSS nor this panel's own can leak across the boundary (spec §39). */
export function closeSettingsPanel(): void {
  host?.remove();
  host = null;
}

function switchRow(shadow: ShadowRoot, label: string, initial: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  const text = document.createElement("span");
  text.className = "row-label";
  text.textContent = label;
  const btn = document.createElement("button");
  btn.className = "switch";
  btn.dataset["on"] = String(initial);
  btn.setAttribute("role", "switch");
  btn.setAttribute("aria-checked", String(initial));
  btn.addEventListener("click", () => {
    const next = btn.dataset["on"] !== "true";
    btn.dataset["on"] = String(next);
    btn.setAttribute("aria-checked", String(next));
    onChange(next);
  });
  row.append(text, btn);
  return row;
}

function appearanceRow(initial: Appearance, onChange: (v: Appearance) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  const text = document.createElement("span");
  text.className = "row-label";
  text.textContent = "Appearance";
  const select = document.createElement("select");
  for (const [value, label] of [
    ["system", "System"],
    ["light", "Light"],
    ["dark", "Dark"],
  ] as [Appearance, string][]) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    opt.selected = value === initial;
    select.appendChild(opt);
  }
  select.addEventListener("change", () => onChange(select.value as Appearance));
  row.append(text, select);
  return row;
}

function diagnosticsRow(): HTMLElement {
  const row = document.createElement("div");
  row.className = "row";
  const label = document.createElement("span");
  label.className = "row-label";
  label.textContent = "Diagnostics";
  const btn = document.createElement("button");
  btn.className = "seg";
  btn.textContent = "View";
  btn.addEventListener("click", () => {
    closeSettingsPanel();
    openDiagnosticsPanel();
  });
  row.append(label, btn);
  return row;
}

function group(rows: HTMLElement[]): HTMLElement {
  const g = document.createElement("div");
  g.className = "group";
  g.append(...rows);
  return g;
}

/**
 * `onSave` gets the full updated settings object after every change; the
 * caller (src/index.ts) decides how to re-apply it — currently a full page
 * reload, which is safe and predictable given LearningSuite's own
 * full-page-reload navigation model (learningsuite-handoff.md §1.1).
 */
export function openSettingsPanel(onSave: (settings: ReskinSettings) => void): void {
  if (host) return;
  const settings = loadSettings();

  host = document.createElement("div");
  host.setAttribute("data-docket-settings-host", "1");
  // Threaded explicitly from the same attributes src/index.ts's applyTheme()/runAdapters()
  // already wrote to <html> — the panel must always match whatever the page is currently
  // showing, never an independent prefers-color-scheme signal of its own (panel.css keys
  // off these same data attributes instead of its own media query).
  host.setAttribute("data-docket-theme", document.documentElement.getAttribute("data-docket-theme") === "dark" ? "dark" : "light");
  host.setAttribute("data-docket-reduced-motion", document.documentElement.getAttribute("data-docket-reduced-motion") ?? String(settings.reducedMotion));
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = panelCss;
  shadow.appendChild(style);

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeSettingsPanel();
  });

  const sheet = document.createElement("div");
  sheet.className = "sheet";

  const header = document.createElement("div");
  header.className = "sheet-header";
  const title = document.createElement("span");
  title.textContent = "Settings";
  const closeBtn = document.createElement("button");
  closeBtn.className = "sheet-close";
  closeBtn.textContent = "✕";
  closeBtn.setAttribute("aria-label", "Close settings");
  closeBtn.addEventListener("click", closeSettingsPanel);
  header.append(title, closeBtn);

  const persist = (patch: Partial<ReskinSettings>) => {
    const next = { ...settings, ...patch };
    Object.assign(settings, patch);
    saveSettings(next);
    onSave(next);
  };

  sheet.append(
    header,
    group([appearanceRow(settings.appearance, (v) => persist({ appearance: v }))]),
    group([
      switchRow(shadow, "Use Companion navigation", settings.useCompanionNav, (v) => persist({ useCompanionNav: v })),
      switchRow(shadow, "Show upcoming on Home", settings.showUpcomingOnHome, (v) => persist({ showUpcomingOnHome: v })),
      switchRow(shadow, "Reduce Motion", settings.reducedMotion, (v) => persist({ reducedMotion: v })),
    ]),
    group([
      switchRow(shadow, "Compatibility Mode", settings.compatibilityMode, (v) => persist({ compatibilityMode: v })),
    ]),
    group([diagnosticsRow()]),
  );

  const compatNote = document.createElement("div");
  compatNote.className = "footer-note";
  compatNote.textContent = "Compatibility Mode keeps LearningSuite's original layout visible alongside the redesigned view — turn it on if something looks broken.";
  sheet.appendChild(compatNote);

  const footer = document.createElement("div");
  footer.className = "footer-note";
  footer.textContent = "Nothing here is sent anywhere — settings are stored only on this device, and this reskin talks to no server but learningsuite.byu.edu itself.";
  sheet.appendChild(footer);

  backdrop.appendChild(sheet);
  shadow.appendChild(backdrop);
}
