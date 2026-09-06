import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./testUtil.js";
import { overlayContent } from "../src/lib/dom.js";

/**
 * Regression test for the Combined Schedule "original page just moved lower" bug (Sep 2026):
 * overlayContent() used to snapshot-and-hide container.childNodes exactly once, at mount
 * time. LearningSuite's own Vue app keeps appending real DOM nodes to the same container
 * well after that first pass (confirmed live on Combined Schedule's progressive render), and
 * those later nodes were never hidden — they rendered fully visible, natively styled, below
 * the enhanced view. overlayContent() now watches its own container's childList so any
 * later-appended native sibling gets folded in and hidden immediately.
 */
test("overlayContent hides native nodes the page appends after the initial mount", async () => {
  setupDom("<main><p>original item</p></main>");
  const main = document.querySelector("main")!;
  const enhanced = document.createElement("div");
  const overlay = overlayContent(main, enhanced, false);
  try {
    const original = main.querySelector("p")!;
    assert.equal(original.hidden, true, "node present at mount time is hidden immediately");

    // Simulate LearningSuite appending more content after the overlay has already mounted.
    const late = document.createElement("p");
    late.textContent = "later-appended item";
    main.appendChild(late);

    // MutationObserver delivers records as a microtask, per lib/observe.ts's own documented
    // gotcha — give it a tick before asserting.
    await Promise.resolve();

    assert.equal(late.hidden, true, "a node appended after mount must also end up hidden");
    assert.ok(document.body.contains(late), "the late node must never be removed, only hidden");
  } finally {
    overlay.remove();
  }
});

test("overlayContent.remove() restores every node it ever hid, including late-appended ones", async () => {
  setupDom("<main><p>original item</p></main>");
  const main = document.querySelector("main")!;
  const enhanced = document.createElement("div");
  const overlay = overlayContent(main, enhanced, false);

  const late = document.createElement("p");
  main.appendChild(late);
  await Promise.resolve();
  assert.equal(late.hidden, true);

  overlay.remove();
  assert.equal(late.hidden, false, "remove() must un-hide late-appended nodes too");
  assert.equal(main.querySelector("p")!.hidden, false);
});
