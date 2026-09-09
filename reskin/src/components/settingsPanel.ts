import panelCss from "../styles/panel.css";
import { loadSettings, saveSettings, BACKGROUND_CHOICES } from "../core/settings.js";
import type { Appearance, BackgroundChoice, ReskinSettings } from "../core/settings.js";
import { openDiagnosticsPanel } from "./diagnosticsPanel.js";
import { getKnownCourses } from "../core/courseRegistry.js";
import { assignCourseColors, PALETTE } from "../lib/courseColor.js";

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

/**
 * Settings > Background (Sep 2026 pass, issue #3): a macOS-System-Settings-
 * style row of canvas swatches — the curated-palette model the brief asked
 * for, not a raw color picker. Each swatch shows the light-theme tint of its
 * choice (mirroring the Apple wallpaper picker's appearance-agnostic
 * thumbnails); the actual per-theme values live in tokens.css. Built with
 * DOM builders + textContent only, like the rest of this panel.
 */
const BACKGROUND_SWATCH_COLORS: Record<BackgroundChoice, string> = {
  default: "#f2f2f7",
  graphite: "#e8e8ed",
  blue: "#e4edf8",
  purple: "#eee7f8",
  rose: "#f8e7ea",
  sand: "#f7f1e5",
};

function backgroundRow(initial: BackgroundChoice, onChange: (v: BackgroundChoice) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "row row-col";
  const text = document.createElement("span");
  text.className = "row-label";
  text.textContent = "Background";
  row.append(text);
  const swatches = document.createElement("div");
  swatches.className = "swatch-row";
  swatches.setAttribute("role", "radiogroup");
  swatches.setAttribute("aria-label", "Background color");
  for (const choice of BACKGROUND_CHOICES) {
    const sw = document.createElement("button");
    sw.className = "swatch";
    sw.dataset["choice"] = choice;
    sw.dataset["selected"] = String(choice === initial);
    sw.style.setProperty("--swatch", BACKGROUND_SWATCH_COLORS[choice]);
    sw.setAttribute("role", "radio");
    sw.setAttribute("aria-checked", String(choice === initial));
    sw.setAttribute("aria-label", choice === "default" ? "Default" : choice.charAt(0).toUpperCase() + choice.slice(1));
    sw.addEventListener("click", () => {
      for (const other of Array.from(swatches.children) as HTMLElement[]) {
        other.dataset["selected"] = String(other === sw);
        other.setAttribute("aria-checked", String(other === sw));
      }
      onChange(choice);
    });
    swatches.appendChild(sw);
  }
  row.appendChild(swatches);
  return row;
}

/**
 * Settings > Course Colors: one swatch row per course the student is actually enrolled in
 * (from courseRegistry.ts's on-device cache, populated by courseListAdapter.ts — the same
 * curated-palette swatch idiom backgroundRow() above uses, not a raw color picker, so an
 * override can never pick a color the rest of the app's contrast work didn't already account
 * for). A course with no override keeps its automatic palette-by-sorted-index color, shown
 * pre-selected here so the row never looks unset. An explicit "Auto" pill clears the override
 * and goes back to that automatic assignment.
 */
function courseColorRow(label: string, current: string, isOverridden: boolean, onChange: (hex: string | null) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "row row-col";
  const text = document.createElement("span");
  text.className = "row-label";
  text.textContent = label;
  row.append(text);

  const controls = document.createElement("div");
  controls.className = "swatch-row-controls";

  const swatches = document.createElement("div");
  swatches.className = "swatch-row swatch-row-wrap";
  swatches.setAttribute("role", "radiogroup");
  swatches.setAttribute("aria-label", `${label} color`);
  const select = (hex: string | null) => {
    for (const other of Array.from(swatches.children) as HTMLElement[]) {
      const match = hex !== null && other.dataset["hex"] === hex;
      other.dataset["selected"] = String(match);
      other.setAttribute("aria-checked", String(match));
    }
  };
  for (const hex of PALETTE) {
    const sw = document.createElement("button");
    sw.className = "swatch swatch-sm";
    sw.dataset["hex"] = hex;
    sw.dataset["selected"] = String(isOverridden && hex === current);
    sw.style.setProperty("--swatch", hex);
    sw.setAttribute("role", "radio");
    sw.setAttribute("aria-checked", String(isOverridden && hex === current));
    sw.setAttribute("aria-label", hex);
    sw.addEventListener("click", () => {
      select(hex);
      onChange(hex);
    });
    swatches.appendChild(sw);
  }

  const resetBtn = document.createElement("button");
  resetBtn.className = "seg";
  resetBtn.textContent = "Auto";
  resetBtn.addEventListener("click", () => {
    select(null);
    onChange(null);
  });

  controls.append(swatches, resetBtn);
  row.appendChild(controls);
  return row;
}

/**
 * Settings > External Calendars: opt-in feeds (e.g. a BYU MAX course) merged into the
 * Combined Schedule agenda — see homeAdapter.ts's loadExternalFeeds(). List of existing feeds
 * (remove-only; edit by removing and re-adding) plus a two-field add row, same plain
 * `<input>`/button idiom as the rest of this panel (no new interaction pattern introduced).
 */
function externalFeedsSection(feeds: { label: string; url: string }[], onChange: (next: { label: string; url: string }[]) => void): HTMLElement[] {
  const title = document.createElement("div");
  title.className = "group-title";
  title.textContent = "External Calendars";

  const rows = feeds.map((feed, index) => {
    const row = document.createElement("div");
    row.className = "row";
    const label = document.createElement("span");
    label.className = "row-label";
    label.textContent = feed.label;
    const removeBtn = document.createElement("button");
    removeBtn.className = "seg";
    removeBtn.textContent = "Remove";
    removeBtn.setAttribute("aria-label", `Remove ${feed.label}`);
    removeBtn.addEventListener("click", () => onChange(feeds.filter((_, i) => i !== index)));
    row.append(label, removeBtn);
    return row;
  });

  const addRow = document.createElement("div");
  addRow.className = "row row-col";
  const labelInput = document.createElement("input");
  labelInput.className = "text-input";
  labelInput.type = "text";
  labelInput.placeholder = "Course label (e.g. PHSCS 121)";
  const urlInput = document.createElement("input");
  urlInput.className = "text-input";
  urlInput.type = "url";
  urlInput.placeholder = "iCalendar (.ics) feed URL";
  const addBtn = document.createElement("button");
  addBtn.className = "seg";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", () => {
    const label = labelInput.value.trim();
    const url = urlInput.value.trim();
    if (!label || !url) return;
    onChange([...feeds, { label, url }]);
  });
  addRow.append(labelInput, urlInput, addBtn);

  const note = document.createElement("div");
  note.className = "footer-note";
  note.textContent = "Only used to fetch the exact URL you enter here — nothing else is sent. See PRIVACY.md.";

  return [title, group([...rows, addRow]), note];
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

  const knownCourses = getKnownCourses();
  const courseColorTitle = document.createElement("div");
  courseColorTitle.className = "group-title";
  courseColorTitle.textContent = "Course Colors";
  const courseColorDefaults = assignCourseColors(knownCourses.map((c) => c.code));
  const courseColorSection: HTMLElement[] = knownCourses.length
    ? [
        courseColorTitle,
        group(
          knownCourses.map((c) => {
            const label = c.title && c.title !== c.code ? `${c.code} — ${c.title}` : c.code;
            return courseColorRow(label, settings.courseColors[c.code] ?? courseColorDefaults.get(c.code) ?? PALETTE[0]!, c.code in settings.courseColors, (hex) => {
              const next = { ...settings.courseColors };
              if (hex) next[c.code] = hex;
              else delete next[c.code];
              persist({ courseColors: next });
            });
          }),
        ),
      ]
    : [
        courseColorTitle,
        (() => {
          const note = document.createElement("div");
          note.className = "footer-note";
          note.textContent = "Course colors appear here once you've visited Course List.";
          return note;
        })(),
      ];

  sheet.append(
    header,
    group([appearanceRow(settings.appearance, (v) => persist({ appearance: v })), backgroundRow(settings.background, (v) => persist({ background: v }))]),
    ...courseColorSection,
    ...externalFeedsSection(settings.externalFeeds, (next) => persist({ externalFeeds: next })),
    group([
      switchRow(shadow, "Use Companion navigation", settings.useCompanionNav, (v) => persist({ useCompanionNav: v })),
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
  footer.textContent = "Nothing here is sent anywhere — settings are stored only on this device. This reskin talks to no server but learningsuite.byu.edu itself, except any URL you explicitly add under External Calendars above.";
  sheet.appendChild(footer);

  backdrop.appendChild(sheet);
  shadow.appendChild(backdrop);
}
