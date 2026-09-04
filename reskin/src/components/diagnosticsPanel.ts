import panelCss from "../styles/panel.css";
import { diagnostics } from "../core/diagnostics.js";
import { loadSettings } from "../core/settings.js";

let host: HTMLElement | null = null;

export function closeDiagnosticsPanel(): void {
  host?.remove();
  host = null;
}

function row(label: string, value: string, ok: boolean): HTMLElement {
  const r = document.createElement("div");
  r.className = "row";
  const l = document.createElement("span");
  l.className = `row-label ${ok ? "diag-ok" : "diag-warn"}`;
  l.textContent = (ok ? "✓ " : "⚠ ") + label;
  const v = document.createElement("span");
  v.textContent = value;
  r.append(l, v);
  return r;
}

export function openDiagnosticsPanel(): void {
  if (host) return;
  host = document.createElement("div");
  host.setAttribute("data-docket-diagnostics-host", "1");
  // Same explicit threading as settingsPanel.ts — must match the page's actual theme, never
  // an independent prefers-color-scheme signal.
  host.setAttribute("data-docket-theme", document.documentElement.getAttribute("data-docket-theme") === "dark" ? "dark" : "light");
  host.setAttribute("data-docket-reduced-motion", document.documentElement.getAttribute("data-docket-reduced-motion") ?? String(loadSettings().reducedMotion));
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = panelCss;
  shadow.appendChild(style);

  const backdrop = document.createElement("div");
  backdrop.className = "backdrop";
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeDiagnosticsPanel();
  });

  const sheet = document.createElement("div");
  sheet.className = "sheet";

  const header = document.createElement("div");
  header.className = "sheet-header";
  const title = document.createElement("span");
  title.textContent = "Diagnostics";
  const closeBtn = document.createElement("button");
  closeBtn.className = "sheet-close";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", closeDiagnosticsPanel);
  header.append(title, closeBtn);

  const g = document.createElement("div");
  g.className = "group";
  g.append(
    row("Reskin", "Running", true),
    row("Page detected", diagnostics.pageKind, diagnostics.pageKind !== "unknown"),
    row("Navigation shell", diagnostics.shellMounted ? "Restyled" : "Not applied", diagnostics.shellMounted),
    row("Active adapter", diagnostics.activeAdapterId ?? "none", !!diagnostics.activeAdapterId),
    row("Elements transformed", String(diagnostics.transformCount), true),
  );
  if (diagnostics.adapterError) {
    g.appendChild(row("Last adapter error", diagnostics.adapterError, false));
  }

  const footer = document.createElement("div");
  footer.className = "footer-note";
  footer.textContent = "No assignment titles, grades, or announcement text ever appear here.";

  sheet.append(header, g, footer);
  backdrop.appendChild(sheet);
  shadow.appendChild(backdrop);
}
