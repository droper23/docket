/**
 * Bookmarklet-based onboarding: the piece of Docket that runs *inside the
 * student's own browser tab*, on a session they already logged into.
 *
 * Why a bookmarklet and not a background fetch from Node: Docket never
 * stores a password or a session cookie (see docs/THREAT_MODEL.md), so a
 * server-side process has no way to see an authenticated LearningSuite page
 * at all. The only thing that CAN see it is the student's own browser, in
 * the tab they're already signed into. A bookmarklet is the lightest
 * possible way to run a small, fully-readable script there — one click, no
 * install, no extension packaging/signing (that's Phase 3, once this same
 * logic is validated). This is also exactly the "prototype as a userscript
 * first" step docs/ROADMAP.md Phase 2 already called for.
 *
 * Both extractors below only ever read `.textContent`, plus a narrow,
 * deliberate set of `href` attributes: the course list's `cid-...`
 * course-link hrefs, and — in the assignments extractor's detail panels —
 * external (explicitly non-`learningsuite.byu.edu`) resource links a
 * teacher attached (e.g. an autograder or scoreboard URL). Never a full
 * element/HTML dump, never `document.cookie`, never a LearningSuite-hosted
 * link (which would need this session's own path-scoped subsessionID to
 * mean anything, and is exactly the kind of session-scoped value never
 * worth capturing) — see the comment above each function. They POST the
 * result as a same-origin-agnostic HTML form submission (not `fetch`),
 * which needs no CORS configuration and cannot silently exfiltrate to
 * anywhere but the exact origin baked in below.
 */

/** Extracts the student's current-term course list. Verified live against a real LearningSuite account. */
function courseListExtractorSource(): string {
  return `(function(){
  var ORIGIN = "%ORIGIN%";
  // Empty string on a single-tenant (self-deployed, no login) instance — the import
  // routes there accept any request, exactly as before multi-tenant mode existed. On a
  // multi-tenant hosted instance this is a real per-user token, baked in when this script
  // was generated on the logged-in /connect page, so the server knows whose data this is
  // without needing a cookie (this POST comes from LearningSuite's own origin, which can
  // never carry Docket's session cookie cross-site) — see docs/ARCHITECTURE.md §14.
  var TOKEN = "%TOKEN%";
  try {
    if (!/learningsuite\\.byu\\.edu$/.test(location.hostname)) {
      alert("Docket: open this on your LearningSuite Course List page first (learningsuite.byu.edu > Home > Course List).");
      return;
    }
    var main = document.querySelector("main");
    if (!main) { alert("Docket: could not find page content. Make sure you're on your Course List page."); return; }
    var nodes = main.querySelectorAll("h2, a[href*='cid-']");
    var seen = {};
    var results = [];
    var currentTerm = null;
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.tagName === "H2") { currentTerm = node.textContent.trim(); continue; }
      var href = node.getAttribute("href");
      var m = href && href.match(/cid-([^\\/]+)\\//);
      if (!m) continue;
      var courseId = m[1];
      if (seen[courseId]) continue;
      var label = node.textContent.trim();
      if (!label || label === "Go") continue;
      seen[courseId] = true;
      var dashIdx = label.indexOf(" - ");
      var codeRaw = dashIdx >= 0 ? label.slice(0, dashIdx) : label;
      var title = dashIdx >= 0 ? label.slice(dashIdx + 3).trim() : "";
      var code = codeRaw.replace(/\\s*\\(\\d+\\)\\s*$/, "").replace(/\\s+/g, " ").trim();
      results.push({ courseId: courseId, code: code, title: title, term: currentTerm });
    }
    if (!results.length) {
      alert("Docket: no courses found on this page. Open Home > Course List in LearningSuite and try again.");
      return;
    }
    var form = document.createElement("form");
    form.method = "POST";
    form.action = ORIGIN + "/connect/learningsuite/import";
    form.target = "docket-import";
    var input = document.createElement("input");
    input.type = "hidden";
    input.name = "courses";
    input.value = JSON.stringify(results);
    form.appendChild(input);
    var tokenInput = document.createElement("input");
    tokenInput.type = "hidden";
    tokenInput.name = "token";
    tokenInput.value = TOKEN;
    form.appendChild(tokenInput);
    document.body.appendChild(form);
    window.open("", "docket-import");
    form.submit();
    form.parentNode.removeChild(form);
  } catch (e) {
    alert("Docket bookmarklet error: " + (e && e.message ? e.message : e));
  } finally {
    // Present only when this is running as an iOS Shortcut's "Run JavaScript on Web Page"
    // action, never as a plain bookmarklet or userscript — that action requires the script
    // to explicitly call completion() when done, or it shows an error ("the script must
    // call the function completion(result) when finished") instead of just finishing. A
    // plain "finally" (not tacked onto the end of the try body) is what makes this run
    // after every exit path above, including the early "wrong page" alerts-and-returns,
    // not just the success path.
    if (typeof completion === "function") completion("done");
  }
})();`;
}

/**
 * Extracts one course's assignment rows — due time, score, real category,
 * and the full detail panel (description + external links) LearningSuite
 * only shows once you click into an assignment — from that course's
 * Assignments page. Verified live, including real gotchas:
 *
 * 1. LearningSuite renders this page differently depending on viewport
 *    width — full desktop width has every category's rows already in the
 *    DOM, but narrower widths (a resized window, or a phone) collapse
 *    categories into click-to-expand accordions. `extractCategory()` is
 *    called once for whatever's already visible (covers desktop and
 *    uncategorized courses) and again after opening each category header
 *    in turn — a title already captured (via `seenTitles`) is never
 *    processed twice, so this is safe to do unconditionally rather than
 *    branching on viewport width.
 * 2. A row's own detail panel (description, due/open/close info, and any
 *    external links — e.g. a course-specific autograder or scoreboard
 *    URL) is *also* click-to-expand, on **every** viewport width, and is
 *    a completely separate toggle from the category accordion above. It's
 *    inserted into the DOM near the row, not nested inside it, so
 *    `findDescriptionPanel()` scans document order starting just after the
 *    row for elements whose text starts with "Due:" or "Open:" (both
 *    observed live, for assignment-style vs. exam-style items) and keeps
 *    the *largest* such match. That sounds backwards — a wider ancestor's
 *    text could in principle also include the next row — but in practice
 *    never does, because the next row's own title text always appears
 *    first in that ancestor and breaks the "starts with Due:/Open:" match;
 *    the real failure mode this avoids is the *opposite* one, confirmed
 *    live: the smallest match is often just a bare label span ("Open:",
 *    5 characters, no date, no description) sitting inside the real panel,
 *    which a *shortest*-match strategy picks by mistake and returns
 *    almost nothing. Trailing UI chrome that rides along in the largest
 *    match ("Check off", "Submit") is stripped afterward by
 *    `stripActionChrome()` rather than solved by shrinking the match.
 * 3. Score/due-time are pulled via regex over each row's own text rather
 *    than a fixed cell index, because the two viewport layouts also split
 *    that text across a different number of cells — a fixed index
 *    silently reads the wrong thing on one of the two, while text search
 *    doesn't care.
 *
 * Does read completion status, from the row's own Submission column text
 * ("Completed" / "Submit" / "Opens <date>", or blank-once-graded for at
 * least one assignment type observed live) — correcting an earlier
 * assumption in this file that it "isn't rendered as readable text on this
 * page." It is; the mistake was not looking at the row text carefully
 * enough the first time. See the `completed` derivation inside
 * `extractCategory()` and docs/ARCHITECTURE.md §8 for the full reasoning
 * and its one real ambiguity (a column left blank rather than saying
 * "Completed"). Never clicks "Check off" or "Submit" — only the row title
 * (read-only expand) and category headers (read-only expand) are ever
 * clicked; completion is read, never toggled.
 *
 * 4. Running as an iOS Shortcut specifically (detected via `typeof completion
 *    === "function"`, same signal used for the completion() call itself)
 *    skips opening each row's detail panel — due time/score/category are
 *    unaffected (read from the row before that step), but description/links
 *    stay empty. This isn't a shortcut for its own sake: Apple's Shortcuts
 *    documentation confirms "Run JavaScript on Web Page" has a strict, short
 *    time limit and fails outright with a "JavaScript Timeout" error if
 *    exceeded — and opening a detail panel costs ~650ms *per row*, which
 *    reliably blows through that budget for anything but a tiny course. The
 *    desktop bookmarklet has no such limit and always does the full
 *    extraction. See docs/ARCHITECTURE.md §8.
 */
function assignmentsExtractorSource(): string {
  return `(async function(){
  var ORIGIN = "%ORIGIN%";
  // See the matching comment in courseListExtractorSource() — empty on a single-tenant
  // instance, a real per-user identity token on a multi-tenant hosted one.
  var TOKEN = "%TOKEN%";
  try {
    if (!/learningsuite\\.byu\\.edu$/.test(location.hostname)) {
      alert("Docket: open this on a LearningSuite course's Assignments page first.");
      return;
    }
    var m = location.pathname.match(/cid-([^\\/]+)/);
    if (!m) { alert("Docket: open a specific course's Assignments page (course > Assignments) and try again."); return; }
    var courseId = m[1];

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function findDescriptionPanel(rowEl) {
      var all = document.querySelectorAll("main *");
      var rowIdx = -1;
      for (var i = 0; i < all.length; i++) { if (all[i] === rowEl) { rowIdx = i; break; } }
      if (rowIdx === -1) return null;
      var best = null, bestLen = -1;
      var scanEnd = Math.min(all.length, rowIdx + 80);
      for (var i = rowIdx + 1; i < scanEnd; i++) {
        var t = all[i].textContent.trim();
        if (/^(Due|Open):/.test(t) && t.length > bestLen) { best = all[i]; bestLen = t.length; }
      }
      return best;
    }

    // Strips trailing button labels ("Check off", "Submit", ...) that ride along in the
    // description panel's textContent since they're DOM siblings/children of the real
    // content, not because they were clicked — nothing here is ever clicked but the row
    // title and category headers.
    function stripActionChrome(text) {
      return text.replace(/\\s*(Check off|Uncheck|Submit|Mark (as )?complete)(\\s+(Check off|Uncheck|Submit|Mark (as )?complete))*\\s*$/i, "").trim();
    }

    // iOS Shortcuts' "Run JavaScript on Web Page" action has a strict, short time limit —
    // exceed it and the whole thing fails with a "JavaScript Timeout" error instead of
    // whatever alert/result the script would otherwise produce (confirmed against Apple's
    // own documentation, not guessed at: support.apple.com/guide/shortcuts/apd218e2187d).
    // Reading a full detail panel costs ~650ms per row (a click + wait + a second click +
    // wait, per assignment) — fine for a handful of rows on a desktop bookmarklet with no
    // such limit, but for anything but a tiny course this reliably blows through Shortcuts'
    // budget. So on Shortcuts specifically (detected the same way as the completion() call
    // below — nothing else reliably signals this environment), skip opening each row's
    // panel entirely: due time, score, and category are already read from the row's own
    // text before that step and are unaffected; description/links stay empty for a
    // Shortcuts run, same as if enrichment had never been run for that item (the dashboard
    // explains this rather than silently showing nothing — see the "hasAnyEnrichment" hint
    // logic in src/server/render.ts).
    var isShortcuts = typeof completion === "function";

    var seenTitles = {};
    var results = [];

    async function extractCategory(categoryName) {
      var titles = [];
      var rows = document.querySelectorAll("main .bg-base.text-highlight");
      for (var i = 0; i < rows.length; i++) {
        var tc = rows[i].children[1];
        var t = tc ? tc.textContent.replace(/\\s+/g, " ").trim() : "";
        if (t && !seenTitles[t]) titles.push(t);
      }
      for (var i = 0; i < titles.length; i++) {
        var title = titles[i];
        if (seenTitles[title]) continue;
        seenTitles[title] = true;

        var freshRows = document.querySelectorAll("main .bg-base.text-highlight");
        var row = null;
        for (var j = 0; j < freshRows.length; j++) {
          var tc2 = freshRows[j].children[1];
          if (tc2 && tc2.textContent.replace(/\\s+/g, " ").trim() === title) { row = freshRows[j]; break; }
        }
        if (!row) continue;

        var rowText = row.textContent.replace(/\\s+/g, " ").trim();
        var dueMatch = rowText.match(/[A-Z][a-z]{2}\\s+\\d{1,2}\\s+\\d{1,2}:\\d{2}\\s*[ap]m\\s*[A-Z]{2,5}/);
        var due = dueMatch ? dueMatch[0] : "";
        var beforeGrade = rowText.split(/of Grade/i)[0];
        var afterDue = due ? beforeGrade.slice(beforeGrade.indexOf(due) + due.length) : beforeGrade;
        // "Opens <Mon> <D>" (not yet available) sits in this same span, and its bare day
        // number reads as a false score numerator to the regex below otherwise — confirmed
        // live: "Opens Sep 4 /10.0" was matching "4 /10.0" as the score, corrupting both
        // the score field and (worse) the completion signal derived from it. Strip that
        // prefix before searching for a real score.
        var afterDueForScore = afterDue.replace(/^\\s*Opens\\s+[A-Z][a-z]{2}\\s+\\d{1,2}/, "");
        var scoreMatch = afterDueForScore.match(/(\\d+(?:\\.\\d+)?)?\\s*\\/\\s*(\\d+(?:\\.\\d+)?)/);
        var score = scoreMatch ? scoreMatch[0] : "";

        // Real, read straight off the row's own Submission column — no click needed, so
        // this works on the fast (Shortcuts) path too, not just the desktop one. The
        // column holds one of a few literal strings: "Submit" (not done), "Opens <date>"
        // (not yet available), or "Completed" — but at least one assignment type observed
        // live (a recurring poll quiz) leaves this column blank once graded rather than
        // ever showing "Completed", so a real earned score (the part of scoreMatch before
        // the slash) counts as completion evidence too. Never inferred from the *absence*
        // of "Submit"/"Opens" text alone — an unrecognized/blank column stays not-complete,
        // the conservative default, rather than being guessed at.
        var submissionText = (scoreMatch ? afterDueForScore.slice(0, scoreMatch.index) : afterDueForScore).trim();
        var completed = /\\bcompleted\\b/i.test(submissionText) || !!(scoreMatch && scoreMatch[1]);

        var description = "";
        var links = [];
        var titleCell = row.children[1];
        if (titleCell && !isShortcuts) {
          titleCell.click();
          await sleep(400);
          var panel = findDescriptionPanel(row);
          if (panel) {
            description = stripActionChrome(panel.textContent.replace(/\\s+/g, " ").trim()).slice(0, 2000);
            var anchors = panel.querySelectorAll("a");
            for (var k = 0; k < anchors.length && links.length < 10; k++) {
              var href = anchors[k].getAttribute("href");
              var linkText = anchors[k].textContent.replace(/\\s+/g, " ").trim();
              // Only external (non-LearningSuite) links: a link back into LearningSuite
              // itself would need this session's own path-scoped subsessionID to work,
              // which is exactly the kind of session-scoped value never worth capturing,
              // and it's not useful to store long-term anyway.
              if (href && /^https?:\\/\\//.test(href) && !/learningsuite\\.byu\\.edu/i.test(href)) {
                links.push({ text: linkText.slice(0, 100), url: href.slice(0, 500) });
              }
            }
          }
          titleCell.click();
          await sleep(250);
        }

        results.push({ title: title, due: due, score: score, category: categoryName || "", description: description, links: links, completed: completed });
      }
    }

    await extractCategory(null);
    var headers = document.querySelectorAll("main .lineHeight > div.cursor-pointer");
    for (var h = 0; h < headers.length; h++) {
      // headers[h] itself also contains the "of Grade: NN%" weight as a second child —
      // its own second child (index 1: [chevron icon, name, weight]) is the clean name alone.
      var nameEl = headers[h].children[1];
      var headerText = (nameEl || headers[h]).textContent.replace(/\\s+/g, " ").trim();
      headers[h].click();
      await sleep(450);
      await extractCategory(headerText);
    }

    if (!results.length) {
      alert("Docket: found the page but no assignment rows to read. Make sure you're on the course's Assignments page (not Grades or Schedule).");
      return;
    }
    var form = document.createElement("form");
    form.method = "POST";
    form.action = ORIGIN + "/connect/learningsuite/import-assignments";
    form.target = "docket-import";
    var courseInput = document.createElement("input");
    courseInput.type = "hidden"; courseInput.name = "courseId"; courseInput.value = courseId;
    var rowsInput = document.createElement("input");
    rowsInput.type = "hidden"; rowsInput.name = "rows"; rowsInput.value = JSON.stringify(results);
    var tokenInput = document.createElement("input");
    tokenInput.type = "hidden"; tokenInput.name = "token"; tokenInput.value = TOKEN;
    form.appendChild(courseInput);
    form.appendChild(rowsInput);
    form.appendChild(tokenInput);
    document.body.appendChild(form);
    window.open("", "docket-import");
    form.submit();
    form.parentNode.removeChild(form);
  } catch (e) {
    alert("Docket bookmarklet error: " + (e && e.message ? e.message : e));
  } finally {
    // See the matching comment in courseListExtractorSource() — required by iOS
    // Shortcuts' "Run JavaScript on Web Page" action specifically, harmless as a plain
    // bookmarklet (no global completion() exists there, so this is simply skipped).
    if (typeof completion === "function") completion("done");
  }
})();`;
}

export type BookmarkletKind = "courses" | "assignments";

/**
 * Human-readable source (for display/audit on the /connect page — not
 * minified, meant to be read). `token` is the user's own bookmarklet
 * identity token (docs/ARCHITECTURE.md §14) on a multi-tenant hosted
 * instance — omit it (or pass `""`) for a single-tenant self-deployed
 * instance, where the import routes accept any request exactly as before
 * multi-tenant mode existed.
 */
export function bookmarkletSource(kind: BookmarkletKind, origin: string, token = ""): string {
  const raw = kind === "courses" ? courseListExtractorSource() : assignmentsExtractorSource();
  return raw.replace("%ORIGIN%", origin).replace("%TOKEN%", token);
}

/** The actual `javascript:` URI a student drags to their bookmarks bar. */
export function bookmarkletHref(kind: BookmarkletKind, origin: string, token = ""): string {
  return `javascript:${encodeURIComponent(bookmarkletSource(kind, origin, token))}`;
}
