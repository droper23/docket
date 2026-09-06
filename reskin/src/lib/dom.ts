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

/**
 * Wraps an existing interactive row/card in a `role="listitem"` shell without replacing its
 * own role (`role="link"`/`"button"` etc. stays on the inner element) — pair with
 * `role="list"` on the containing group/grid so assistive tech announces "list, N items"
 * instead of an unordered pile of divs.
 */
export function listItem(el: HTMLElement): HTMLElement {
  return h("div", { role: "listitem" }, [el]);
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
 *
 * Confirmed live (Sep 2026, Combined Schedule): LearningSuite keeps
 * appending real DOM nodes to `container` well after this first mount pass
 * (the page renders its schedule progressively) — a one-time snapshot here
 * left every later-appended native node fully visible, unhidden, below the
 * enhanced view (reported as "the original page just moved lower, all the
 * original stuff is still there"). A `MutationObserver` scoped to exactly
 * this container's own childList (no `subtree` — only direct children ever
 * need catching) now folds any newly-appeared sibling into `originalNodes`
 * and applies the current hidden state to it immediately, so a later
 * LearningSuite render can never leak through again. This only ever sets
 * the `.hidden` attribute, never adds/removes a child itself, so it cannot
 * observe its own writes or fight the body-level observer in lib/observe.ts.
 */
export function overlayContent(container: Element, enhanced: Node, compatibilityMode: boolean): Overlay {
  const originalNodes = Array.from(container.childNodes);
  container.insertBefore(enhanced, container.firstChild);
  let hidden = !compatibilityMode;
  const applyHidden = (n: ChildNode) => {
    if (n instanceof HTMLElement) n.hidden = hidden;
  };
  const setOriginalHidden = (h: boolean) => {
    hidden = h;
    for (const n of originalNodes) applyHidden(n);
  };
  setOriginalHidden(hidden);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes) as ChildNode[]) {
        if (node === enhanced || originalNodes.includes(node)) continue;
        originalNodes.push(node);
        applyHidden(node);
      }
    }
  });
  observer.observe(container, { childList: true });

  return {
    originalNodes,
    setOriginalHidden,
    remove() {
      observer.disconnect();
      enhanced.parentNode?.removeChild(enhanced);
      setOriginalHidden(false);
    },
  };
}

export interface OverlayToggle {
  button: HTMLElement;
  /** Reveals the native content (e.g. before re-firing a row's own click, so its real detail
   * panel is visible) and updates the button's own label to match — see `reveal`'s callers. */
  reveal(): void;
}

/**
 * A single stateful escape hatch, shared by every adapter that wraps LearningSuite's own page:
 * every adapter's own toggle button previously only ever called `setOriginalHidden(true)` —
 * `setOriginalHidden` itself has always been a real two-way toggle, but nothing ever called it
 * with `false` again once pressed, so there was no way back to the enhanced view short of a
 * full reload (confirmed live, Sep 2026). This tracks the revealed state itself and flips the
 * button's label between the two so it always describes what pressing it will do next.
 */
export function createOverlayToggle(
  overlayRef: () => Overlay | null,
  revealLabel = "View original LearningSuite page",
  hideLabel = "← Back to redesigned view",
): OverlayToggle {
  let revealed = false;
  const btn = h("button", { class: "docket-toggle-original" }, [revealLabel]);
  const setRevealed = (next: boolean): void => {
    revealed = next;
    overlayRef()?.setOriginalHidden(next);
    btn.textContent = next ? hideLabel : revealLabel;
  };
  btn.addEventListener("click", () => setRevealed(!revealed));
  return { button: btn, reveal: () => setRevealed(true) };
}
