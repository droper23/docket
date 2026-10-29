import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const css = readFileSync(new URL("../src/styles/max.css", import.meta.url), "utf8");
const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "");

test("delayed MathJax PNGs stay dark in light homework data boxes only", () => {
  const dom = new JSDOM(`<html data-docket-max-reskin data-docket-theme="dark"><head><style>${css}</style></head><body>
    <div class="assignment"><span class="data" style="background-color:#e7f4ff;color:#258"></span>
    <span class="MathJax"><img id="ordinary"></span></div>
    <div class="data"><span class="MathJax"><img id="outside-assignment"></span></div>
  </body></html>`);
  const { document, getComputedStyle } = dom.window;
  // MathJax can replace its preview with image glyphs after the stylesheet loads.
  const box = document.querySelector(".assignment .data")!;
  for (const renderer of ["MathJax", "MathJax_Display"]) {
    const math = document.createElement("span");
    math.className = renderer;
    const glyph = math.appendChild(document.createElement("img"));
    box.appendChild(math);
    assert.equal(getComputedStyle(glyph).filter, "none");
  }
  assert.equal(getComputedStyle(document.getElementById("ordinary")!).filter, "invert(.86)");
  assert.equal(getComputedStyle(document.getElementById("outside-assignment")!).filter, "invert(.86)");
  document.documentElement.dataset.docketTheme = "light";
  assert.equal(getComputedStyle(box.querySelector("img")!).filter, "");
  dom.window.close();
});

test("MAX styles are semantic and course-agnostic", () => {
  for (const selector of ["h1", "h2", "h3", "table", "ul", "ol", "a", ":focus-visible"]) {
    assert.match(selectors, new RegExp(`data-docket-max-reskin[^\\n]*${selector}`));
  }
  assert.doesNotMatch(selectors, /physics|phscs|dashboard|syllabus|grade(?:details)?/i);
});

test("MAX styles preserve mobile access to wide native tables", () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /overflow-x: auto/);
});

test("MAX styles target its confirmed Bootstrap shell and keep icon fonts intact", () => {
  for (const selector of [".navbar-fixed-top", "#sidebar", "#form-toolbar", ".maximize-minimize", "#today-highlight", ".list-view-item.green-item"]) {
    assert.ok(selectors.includes(selector), selector);
  }
  // Glyphicons and MathJax glyphs are spans with their own fonts; a span font
  // reset renders them as blank boxes.
  assert.doesNotMatch(selectors, /:is\([^)]*\bspan\b[^)]*\)[^{]*\{[^}]*font-family/);
});

test("MAX styles use shared appearance, accessibility, and surface primitives", () => {
  for (const selector of [
    '[data-docket-theme="light"]',
    '[data-docket-theme="dark"]',
    "data-docket-background",
    "data-docket-reduced-motion",
    "[aria-current=\"page\"]",
    "[aria-expanded=\"true\"]",
    ".skip-link",
    ".docket-max-redundant-outline",
    ".docket-max-fixed-pane",
  ]) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(css, /body div\s*\{\s*background-color:\s*transparent/);
});
