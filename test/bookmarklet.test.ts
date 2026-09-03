import assert from "node:assert/strict";
import { test } from "node:test";
import { bookmarkletHref, bookmarkletSource } from "../src/connectors/bookmarklet.js";

const ORIGIN = "https://example.test";

test("bookmarkletSource: origin placeholder is fully substituted, for both kinds", () => {
  for (const kind of ["courses", "assignments"] as const) {
    const source = bookmarkletSource(kind, ORIGIN);
    assert.ok(source.includes(`"${ORIGIN}"`), `${kind}: origin should appear literally in the source`);
    assert.ok(!source.includes("%ORIGIN%"), `${kind}: no unsubstituted placeholder should remain`);
  }
});

test(
  "regression: both scripts call completion() in a finally block when running as an iOS " +
    "Shortcut (\"Run JavaScript on Web Page\" errors with \"the script must call the " +
    "function completion(result) when finished\" otherwise) — and only when that global " +
    "actually exists, so this is a no-op as a plain desktop bookmarklet",
  () => {
    for (const kind of ["courses", "assignments"] as const) {
      const source = bookmarkletSource(kind, ORIGIN);
      assert.match(source, /finally\s*\{[^}]*typeof completion === "function"[^}]*completion\(/s, `${kind}: missing the completion() finally block`);
      // Must be the *outermost* finally (paired with the top-level try), not nested inside
      // a helper — otherwise an early "wrong page" alert-and-return could skip it.
      const finallyIndex = source.search(/finally\s*\{/);
      const lastCloseBraceBeforeIIFEEnd = source.lastIndexOf("})();");
      assert.ok(finallyIndex > 0 && finallyIndex < lastCloseBraceBeforeIIFEEnd, `${kind}: finally block should be near the end of the top-level IIFE`);
    }
  },
);

test(
  "regression: the assignments script skips opening each row's detail panel when running " +
    "as an iOS Shortcut (that per-row click+wait step reliably exceeds Shortcuts' undocumented " +
    "\"Run JavaScript on Web Page\" time limit for anything but a tiny course, producing a " +
    '"JavaScript Timeout" error) — due time/score/category are read from row text earlier and ' +
    "are unaffected; only description/links are skipped",
  () => {
    const source = bookmarkletSource("assignments", ORIGIN);
    assert.match(source, /isShortcuts\s*=\s*typeof completion === "function"/, "missing isShortcuts detection");
    assert.match(source, /if\s*\(titleCell\s*&&\s*!isShortcuts\)/, "detail-panel click should be gated on !isShortcuts");
  },
);

test(
  "regression: the assignments script reads completion status from the row's own " +
    "Submission column text (no click needed) instead of never capturing it — a real " +
    "production bug where already-completed LearningSuite items kept showing as undone " +
    'and overdue in Docket because nothing fed completionStatus. Checks for the literal ' +
    '"Completed" word and, for the one assignment type observed to leave that column blank ' +
    "once graded, a real earned score as a fallback signal",
  () => {
    const source = bookmarkletSource("assignments", ORIGIN);
    assert.match(source, /\\bcompleted\\b\/i\.test\(submissionText\)/, "missing the Submission-column completion check");
    assert.match(source, /completed:\s*completed/, "completed must be included in the row object sent to the server");
    // Must be computed in the shared part of extractCategory(), outside the
    // `!isShortcuts`-gated detail-panel block — completion has to work on the fast/phone
    // path too, not just the desktop one, since no click is needed to read it.
    const completedComputedIdx = source.search(/var completed = /);
    const shortcutsGateIdx = source.search(/if\s*\(titleCell\s*&&\s*!isShortcuts\)/);
    assert.ok(completedComputedIdx > 0 && shortcutsGateIdx > 0 && completedComputedIdx < shortcutsGateIdx, "completed must be computed before the isShortcuts-gated block, not inside it");
  },
);

test("bookmarkletHref: produces a javascript: URI that round-trips back to the same source", () => {
  const href = bookmarkletHref("courses", ORIGIN);
  assert.ok(href.startsWith("javascript:"));
  const decoded = decodeURIComponent(href.slice("javascript:".length));
  assert.equal(decoded, bookmarkletSource("courses", ORIGIN));
});
