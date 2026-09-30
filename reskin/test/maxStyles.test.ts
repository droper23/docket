import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(new URL("../src/styles/max.css", import.meta.url), "utf8");
const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "");

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
