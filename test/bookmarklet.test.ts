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

test("bookmarkletHref: produces a javascript: URI that round-trips back to the same source", () => {
  const href = bookmarkletHref("courses", ORIGIN);
  assert.ok(href.startsWith("javascript:"));
  const decoded = decodeURIComponent(href.slice("javascript:".length));
  assert.equal(decoded, bookmarkletSource("courses", ORIGIN));
});
