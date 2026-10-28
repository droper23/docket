import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/navigation.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

test("shell styles target LearningSuite's own classes so they apply at first paint", () => {
  for (const selector of ["body > header", "header .bg-top-nav > a.bg-top-nav-highlight", "nav.bg-left-nav a", "#_topLink::before", "#fullLSPage"]) {
    assert.ok(css.includes(selector), selector);
  }
});

test("the rail never adds vertical margin to nav (it overflowed body and scrolled the page)", () => {
  const navRule = css.match(/\[data-docket-reskin\] nav\.bg-left-nav \{([^}]*)\}/);
  assert.ok(navRule, "nav.bg-left-nav rule");
  assert.match(navRule[1]!, /margin:\s*0 !important/);
});
