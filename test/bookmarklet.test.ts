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

test("bookmarkletSource: token placeholder is always substituted — empty by default (single-tenant), a real value when given (multi-tenant)", () => {
  for (const kind of ["courses", "assignments"] as const) {
    const withoutToken = bookmarkletSource(kind, ORIGIN);
    assert.ok(!withoutToken.includes("%TOKEN%"), `${kind}: no unsubstituted placeholder should remain`);
    assert.match(withoutToken, /var TOKEN = "";/, `${kind}: defaults to an empty token`);

    const withToken = bookmarkletSource(kind, ORIGIN, "user-secret-token-123");
    assert.ok(withToken.includes('"user-secret-token-123"'), `${kind}: token should appear literally in the source`);
    assert.ok(!withToken.includes("%TOKEN%"), `${kind}: no unsubstituted placeholder should remain`);
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

test("bookmarkletSource: schedule kind substitutes origin, token, and the course map — never leaves a placeholder behind", () => {
  const courseMap = [{ code: "EC EN 224", courseId: "Kkcc7zi3RXcJ" }];
  const source = bookmarkletSource("schedule", ORIGIN, "user-secret-token-123", courseMap);
  assert.ok(source.includes(`"${ORIGIN}"`));
  assert.ok(source.includes('"user-secret-token-123"'));
  assert.ok(source.includes('"Kkcc7zi3RXcJ"'), "the known course's id should appear literally in the source");
  assert.ok(!source.includes("%ORIGIN%") && !source.includes("%TOKEN%") && !source.includes("%COURSE_MAP%"), "no unsubstituted placeholder should remain");
});

test("bookmarkletSource: schedule kind defaults to an empty course map, never crashing on the substitution", () => {
  const source = bookmarkletSource("schedule", ORIGIN);
  assert.match(source, /var COURSES = \[\];/);
});

test(
  "regression: the schedule script's dialog-title match normalizes whitespace on both sides " +
    "before comparing — a two-line title (its own two lines rendered as separate DOM text, " +
    "e.g. a lecture topic plus a linked video title) never matched the single-space-collapsed " +
    "form, so the wait always ran out the full timeout and read nothing for items like that",
  () => {
    const source = bookmarkletSource("schedule", ORIGIN);
    assert.ok(
      source.includes('node.textContent.replace(/\\s+/g, " ").indexOf(expectedTitle) === -1'),
      "findOpenDialog must whitespace-normalize node.textContent before comparing to expectedTitle",
    );
  },
);

test(
  "regression: the schedule script closes whatever dialog is actually open when a title match " +
    "times out, instead of leaving it open — an unclosed dialog's backdrop blocks every later " +
    "item's click too, so one mismatch was silently turning the rest of a run into a no-op " +
    "(confirmed live: a stuck dialog from one item stalled the whole remaining chunk)",
  () => {
    const source = bookmarkletSource("schedule", ORIGIN);
    assert.ok(source.includes("var stale = findOpenDialog();"), "missing the stale-dialog fallback in the no-match branch");
    assert.ok(source.includes("stale.closeBtn.click();"), "the stale dialog, once found, must actually be closed");
  },
);

test(
  "regression: the schedule script polls for 'Begin exam' across a multi-second window after " +
    "a dialog is found, rather than checking once at a fixed delay — confirmed live, across " +
    "multiple failed attempts, that no single point-in-time check is safe here: the title/" +
    "description can resolve a beat before the button itself renders (missed by a flat 400ms " +
    "wait AND by a flat 3000ms wait), and a 'wait until the button count stops changing' poll " +
    "was separately fooled by an early plateau. Checking repeatedly across a real window, and " +
    "reacting the instant the button appears, is what's actually safe — not picking a bigger " +
    "number and hoping.",
  () => {
    const source = bookmarkletSource("schedule", ORIGIN);
    const dialogFoundIdx = source.indexOf("findOpenDialog(matchTitle)");
    const examLoopIdx = source.indexOf("while (examWaited < examWindowMs)");
    assert.ok(dialogFoundIdx > 0 && examLoopIdx > dialogFoundIdx, "the exam-detection poll must run after the dialog is found");
    const between = source.slice(examLoopIdx, examLoopIdx + 400);
    assert.ok(between.includes("if (isExamPrompt()) { sawExam = true; break; }"), "must check isExamPrompt() on every iteration of the poll, breaking immediately once it appears");
    assert.ok(/await sleep\(250\);/.test(between), "must actually wait between polls, not spin");
  },
);

test(
  "the schedule script's exam-detection window is tiered by title plausibility, not skipped " +
    "for either tier — paying the slowest-observed window (8s) unconditionally on every one " +
    "of a typical ~150-item run would turn a sync into 20+ minutes, but a title with zero " +
    "quiz/exam/test/assessment wording still gets checked, just with a shorter window, since " +
    "nothing live ever suggested a timed prompt hiding behind a title with no hint of it",
  () => {
    const source = bookmarkletSource("schedule", ORIGIN);
    assert.ok(
      source.includes('var mightBeTimedAssessment = /\\b(quiz|exam|test|assessment)\\b/i.test(item.title);'),
      "missing the plausibility check that selects which window to use",
    );
    assert.ok(source.includes("var examWindowMs = mightBeTimedAssessment ? 8000 : 1500;"), "both tiers must be real, non-zero windows — never skip the check outright for either");
  },
);

test(
  "regression: the schedule script closes and skips any dialog offering to 'Begin exam' " +
    "without reading or reporting it, even for an item whose title never mentioned an exam " +
    'at all — confirmed live on a "Syllabus Mastery Quiz" item that opened straight into a ' +
    "timed-attempt prompt, which the title-keyword filter alone can't catch",
  () => {
    const source = bookmarkletSource("schedule", ORIGIN);
    assert.match(source, /function isExamPrompt\(\)/, "missing the isExamPrompt() content-based check");
    assert.match(source, /\/begin exam\/i\.test\(buttons\[i\]\.textContent\)/, "isExamPrompt must check button text for 'begin exam'");
    // Must run before the normal extraction branch, and must close+continue without ever
    // reaching the results.push(...) call for that item.
    const examCheckIdx = source.indexOf("if (sawExam)");
    const pushIdx = source.indexOf("results.push({ courseId:");
    assert.ok(examCheckIdx > 0 && pushIdx > examCheckIdx, "exam-prompt check must run before the item is ever pushed to results");
  },
);

test(
  "regression: the schedule script matches an 'X Opens'/'X Closes' schedule marker's dialog " +
    'against its title with that suffix stripped — the dialog itself shows just "X", so ' +
    "matching on the unstripped title would time out waiting on every item like that and " +
    "capture nothing",
  () => {
    const source = bookmarkletSource("schedule", ORIGIN);
    assert.ok(source.includes('var matchTitle = item.title.replace(/\\s+(Opens|Closes)$/i, "");'), "missing the Opens/Closes suffix stripping");
    assert.ok(source.includes("findOpenDialog(matchTitle)"), "the dialog wait must use the stripped matchTitle, not the raw item.title");
  },
);

test(
  "regression: the schedule script never clicks into an item whose title mentions an exam — " +
    "unlike every other item type on Combined Schedule (confirmed live to open a safe, read-only " +
    "detail popup), clicking an exam has never been verified not to navigate away or start a real " +
    "attempt, so the whole category is skipped rather than risking it",
  () => {
    const source = bookmarkletSource("schedule", ORIGIN);
    assert.match(source, /if\s*\(\/\\bexams\?\\b\/i\.test\(title\)\)\s*continue;/, "missing the exam-title exclusion before queueing");
    // Must run before the item is pushed onto the click queue, not after.
    const excludeIdx = source.search(/\\bexams\?\\b/);
    const pushIdx = source.indexOf("queue.push(");
    assert.ok(excludeIdx > 0 && pushIdx > excludeIdx, "exam exclusion must be checked before queue.push");
  },
);

test(
  "regression: the schedule script never clicks into a 'Class Attendance' item — confirmed " +
    "live that it opens an entirely different dialog shape (a calendar-style attendance " +
    "picker) with no \"Description\" text and no button literally labeled \"Close\" at all, " +
    "which findOpenDialog() can never recognize or close — left unclosed, it would block " +
    "every later item's click the same way any other stuck dialog does",
  () => {
    const source = bookmarkletSource("schedule", ORIGIN);
    assert.ok(source.includes('if (/\\battendance\\b/i.test(title)) continue;'), "missing the attendance-title exclusion before queueing");
    const excludeIdx = source.indexOf("battendance");
    const pushIdx = source.indexOf("queue.push(");
    assert.ok(excludeIdx > 0 && pushIdx > excludeIdx, "attendance exclusion must be checked before queue.push");
  },
);

test(
  "regression: the schedule script sends Escape as a last-resort dismiss when no recognizable " +
    "dialog is found at all — defense-in-depth for a dialog shape neither the title exclusions " +
    "above nor findOpenDialog()'s \"Description\"-text requirement can catch, so one unknown " +
    "shape can't silently cascade into blocking the rest of a run the way 'Class Attendance' " +
    "did before it was excluded by title",
  () => {
    const source = bookmarkletSource("schedule", ORIGIN);
    assert.ok(
      source.includes('document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));'),
      "missing the Escape-key fallback dispatch",
    );
    // Must be the last-resort branch — only reached when the stale-dialog-by-Close-button
    // check has already failed to find anything.
    const staleCheckIdx = source.indexOf("var stale = findOpenDialog();");
    const escapeIdx = source.indexOf("key: \"Escape\"");
    assert.ok(staleCheckIdx > 0 && escapeIdx > staleCheckIdx, "Escape fallback must come after the stale-dialog check, not replace it");
  },
);
