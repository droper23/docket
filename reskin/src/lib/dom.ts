/**
 * Small DOM builder + safety helpers. Every LearningSuite-sourced string
 * (a course title, an assignment name, an announcement body) must reach the
 * page only via `textContent`/`h()`'s text-node children, never `innerHTML`
 * — see docs/THREAT_MODEL.md's "malicious page content" row, which this
 * reskin inherits directly.
 */

type Attrs = Record<string, string | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  children?: (Node | string | null | undefined)[],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined) continue;
      if (k === "class") el.className = v;
      else el.setAttribute(k, v);
    }
  }
  if (children) {
    for (const c of children) {
      if (c === null || c === undefined) continue;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
  }
  return el;
}

export function svgIcon(pathD: string, viewBox = "0 0 24 24"): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("class", "docket-icon");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  return svg;
}

/** Marks a node so a future MutationObserver pass never re-processes it — see lib/observe.ts. */
export function markProcessed(el: Element, key: string): void {
  el.setAttribute(`data-docket-${key}`, "1");
}

export function isProcessed(el: Element, key: string): boolean {
  return el.hasAttribute(`data-docket-${key}`);
}

export interface Overlay {
  /** The nodes that were already inside the container before mounting. */
  originalNodes: ChildNode[];
  /** Show/hide the original LearningSuite content — reversible any time, never deletes it. */
  setOriginalHidden(hidden: boolean): void;
  /** Removes the enhanced view and restores the original content, undoing mount() entirely. */
  remove(): void;
}

/**
 * Inserts `enhanced` as the first child of `container` and, unless
 * `compatibilityMode` is true, hides (via `.hidden`, never removed from the
 * DOM) every node that was already inside `container`. This is the one
 * mutation every page adapter performs on LearningSuite's own markup: add a
 * new node, toggle `.hidden` on old ones. Nothing is ever deleted, so
 * Compatibility Mode / the emergency disable path is just calling
 * `overlay.remove()`.
 */
export function overlayContent(container: Element, enhanced: Node, compatibilityMode: boolean): Overlay {
  const originalNodes = Array.from(container.childNodes);
  container.insertBefore(enhanced, container.firstChild);
  const setOriginalHidden = (hidden: boolean) => {
    for (const n of originalNodes) {
      if (n instanceof HTMLElement) n.hidden = hidden;
    }
  };
  setOriginalHidden(!compatibilityMode);
  return {
    originalNodes,
    setOriginalHidden,
    remove() {
      enhanced.parentNode?.removeChild(enhanced);
      setOriginalHidden(false);
    },
  };
}
