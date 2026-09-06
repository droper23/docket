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

    // Polls \`check()\` every \`intervalMs\` until it returns a truthy value or \`timeoutMs\`
    // elapses, resolving with whatever \`check()\` last returned either way. Used instead of
    // a single fixed sleep before reading a just-opened detail panel: a fixed wait is either
    // too short on a slow connection/device (reported live — the panel hadn't rendered yet,
    // so nothing was captured) or wastefully long on a fast one. Polling adapts to whichever
    // is true without having to guess a number.
    function waitUntil(check, timeoutMs, intervalMs) {
      return new Promise(function (resolve) {
        var waited = 0;
        (function poll() {
          var v = check();
          if (v || waited >= timeoutMs) { resolve(v); return; }
          waited += intervalMs;
          setTimeout(poll, intervalMs);
        })();
      });
    }

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
          var panel = await waitUntil(function () { return findDescriptionPanel(row); }, 2500, 100);
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
          await waitUntil(function () { return !findDescriptionPanel(row); }, 1500, 100);
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
      var rowCountBefore = document.querySelectorAll("main .bg-base.text-highlight").length;
      headers[h].click();
      await waitUntil(function () { return document.querySelectorAll("main .bg-base.text-highlight").length !== rowCountBefore; }, 2000, 100);
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

/**
 * Extracts description + external links for whatever's visible on the
 * Combined Schedule's List view, across every course at once — the one
 * place LearningSuite shows a lecture topic's attached resource link (e.g.
 * a YouTube video) or an exam's real due-time, none of which ever appear on
 * a course's own Assignments page (that page only lists gradable rows, not
 * lecture topics or exams). Verified live against a real account:
 *
 * 1. Every item on this page — a real assignment, an exam, or a pure
 *    "Instructor Note" (a lecture topic or a schedule note like "No LAB")
 *    — opens the *same* shape of detail dialog on click: a "Description"
 *    label, sometimes a "Due: ..." line, optional external links, and a
 *    "Close" button (confirmed absent from the page before any dialog is
 *    open, so its appearance reliably marks one as open). This script
 *    doesn't attempt to tell those three kinds apart or change how Docket
 *    classifies them (see AssignmentKind in src/core/types.ts) — it only
 *    ever adds description/links/due-time to a title Docket already has
 *    from the ICS sync, via the same title-match `applySessionEnrichment`
 *    already uses for the Assignments-page bookmarklet.
 * 2. A row's title link (`a.cursor-pointer.block.truncate`) sits inside a
 *    `.flex-4` cell whose very next sibling cell holds that row's course
 *    code as plain text, and `.closest(".listViewDay")`'s first child is
 *    that day's own header ("9/11 - Friday") — confirmed against all 305
 *    item rows on a real 5-course schedule, zero mismatches. This is what
 *    lets one pass over the whole page attribute a course and a date to
 *    every item without needing a separate page load per course.
 * 3. The List view renders the **entire remaining semester** in the DOM at
 *    once (confirmed live: 60+ day headers, 300+ items, for just 5
 *    courses) — there is no pagination to defeat, but also no way to ask
 *    for "just this week." Every item needs its own click-wait-read-close
 *    round trip (~600ms), so this script only processes items within
 *    `WINDOW_DAYS_PAST`/`WINDOW_DAYS_FUTURE` of today, both to keep a run
 *    to a reasonable length and to stay under the server's own per-request
 *    row cap (see handler.ts's `MAX_IMPORTED_ITEMS`).
 * 4. Only rows whose course code matches one of this student's own known
 *    courses (baked in below, exactly like the assignments extractor's
 *    courseId) are ever processed — never guessed from arbitrary schedule
 *    text.
 *
 * Desktop-only by design (no iOS Shortcuts variant): unlike the Assignments
 * page's few dozen rows, a semester-window pass here can be 50-150+ clicks,
 * far past what Apple's "Run JavaScript on Web Page" time limit tolerates
 * even with the Shortcuts-specific shortcut the assignments extractor uses
 * (see its own docstring, point 4) — there's no cheaper "read the row
 * without opening its dialog" path here the way due-time/score/category are
 * readable straight off an Assignments-page row's own text.
 */
function scheduleExtractorSource(): string {
  return `(async function(){
  var ORIGIN = "%ORIGIN%";
  var TOKEN = "%TOKEN%";
  var COURSES = %COURSE_MAP%;
  try {
    if (!/learningsuite\\.byu\\.edu$/.test(location.hostname) || !/\\/schedule/.test(location.pathname)) {
      alert("Docket: open your Combined Schedule page first (Home > Combined Schedule), in List view, then run this.");
      return;
    }
    var codeToId = {};
    for (var i = 0; i < COURSES.length; i++) codeToId[COURSES[i].code] = COURSES[i].courseId;

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    // See the matching helper/comment in assignmentsExtractorSource() — polls instead of a
    // fixed wait so a slow render (reported live to be an issue with a fixed wait here)
    // doesn't get read before the dialog actually finishes opening/closing.
    function waitUntil(check, timeoutMs, intervalMs) {
      return new Promise(function (resolve) {
        var waited = 0;
        (function poll() {
          var v = check();
          if (v || waited >= timeoutMs) { resolve(v); return; }
          waited += intervalMs;
          setTimeout(poll, intervalMs);
        })();
      });
    }

    var WINDOW_DAYS_PAST = 3;
    var WINDOW_DAYS_FUTURE = 30;

    // "9/11 - Friday" -> a real Date. The header never carries a year, so this picks
    // whichever of this-year/adjacent-year lands closest to today.
    function parseHeaderDate(text) {
      var m = text.match(/^(\\d{1,2})\\/(\\d{1,2})/);
      if (!m) return null;
      var month = parseInt(m[1], 10) - 1, day = parseInt(m[2], 10);
      var now = new Date();
      var a = new Date(now.getFullYear(), month, day);
      var b = new Date(now.getFullYear() + (a < now ? 1 : -1), month, day);
      return Math.abs(b - now) < Math.abs(a - now) ? b : a;
    }

    var now = new Date();
    var minDate = new Date(now.getTime() - WINDOW_DAYS_PAST * 86400000);
    var maxDate = new Date(now.getTime() + WINDOW_DAYS_FUTURE * 86400000);

    var anchors = document.querySelectorAll("a.cursor-pointer.block.truncate");
    var seen = {};
    var queue = [];
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var titleCell = a.closest(".flex-4");
      var courseCell = titleCell ? titleCell.nextElementSibling : null;
      var dayEl = a.closest(".listViewDay");
      var headerEl = dayEl ? dayEl.querySelector(":scope > div:first-child") : null;
      if (!titleCell || !courseCell || !headerEl) continue;
      var courseId = codeToId[courseCell.textContent.trim()];
      if (!courseId) continue;
      var date = parseHeaderDate(headerEl.textContent.trim());
      if (!date || date < minDate || date > maxDate) continue;
      var title = a.textContent.replace(/\\s+/g, " ").trim();
      // Never click into an obvious exam entry: unlike every other item type here (an
      // Instructor Note, a homework/quiz/reading row), clicking into an exam risks
      // LearningSuite's Testing Center flow instead of the safe read-only "Description"
      // popup every other item type opens. This title check is a cheap first filter, not
      // the real safety net — confirmed live that a title with NO mention of "exam" at all
      // (a timed "Syllabus Mastery Quiz") can still open into a "Begin exam" prompt, which
      // is why isExamPrompt() below is the check that actually matters; this just avoids
      // opening the most obvious cases at all.
      if (/\\bexams?\\b/i.test(title)) continue;
      // Confirmed live: "Class Attendance" opens an entirely different dialog shape (a
      // calendar-style attendance picker with an "OK" button, "Your instructor will mark
      // attendance") with no "Description" text and no button literally labeled "Close" at
      // all — findOpenDialog() can never recognize or close it, so it's excluded outright
      // rather than risk it being left open and blocking every item after it (see the
      // Escape-key fallback below for whatever OTHER undiscovered shape might still exist).
      if (/\\battendance\\b/i.test(title)) continue;
      var key = courseId + "|" + title;
      if (seen[key]) continue;
      seen[key] = true;
      queue.push({ anchor: a, courseId: courseId, title: title });
    }

    if (!queue.length) {
      alert("Docket: no items found for your connected courses in the next " + WINDOW_DAYS_FUTURE + " days. Make sure you're on Combined Schedule's List view.");
      return;
    }

    // Locates the just-opened detail dialog by walking up from its "Close" button (present
    // only while a dialog is open — confirmed absent from the page otherwise) to the
    // smallest ancestor that also contains the "Description" label every dialog shape
    // shares. Not a fixed number of levels: an Instructor Note's dialog and a real
    // assignment's dialog nest it at different depths, confirmed live against both.
    //
    // This is ONE popup component LearningSuite reuses across every click, not a fresh
    // element per item — confirmed live: clicking item B right after item A can catch the
    // popup still showing item A's exact title and content (its own async data fetch for B
    // hasn't resolved yet), with no visible sign anything is wrong beyond a small loading
    // spinner in the body. So this only ever returns a dialog once its own title text has
    // caught up to expectedTitle — that's what the loading spinner is actually gating on,
    // confirmed by watching the same dialog's title flip from stale to correct at the exact
    // moment its content also filled in. Passing no expectedTitle (the "is anything open at
    // all" check used while waiting for a close to finish) skips that comparison.
    function findOpenDialog(expectedTitle) {
      var buttons = document.querySelectorAll("button");
      var closeBtn = null;
      for (var i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent.trim() === "Close") { closeBtn = buttons[i]; break; }
      }
      if (!closeBtn) return null;
      var node = closeBtn;
      for (var d = 0; d < 12 && node; d++) {
        if (node.textContent.indexOf("Description") !== -1) {
          // Whitespace-normalize before comparing: expectedTitle is already collapsed to
          // single spaces (it comes from a queue title built the same way), but the
          // dialog's own textContent is raw DOM text — confirmed live for a two-line title
          // ("Intro to Linux Shell" / "Linux Survival Tutorial" on separate lines) where the
          // literal whitespace between them never matched the collapsed form, so this never
          // resolved until it timed out — comparing two collapsed strings is what actually
          // fixes that, not just stripping Opens/Closes.
          if (expectedTitle && node.textContent.replace(/\\s+/g, " ").indexOf(expectedTitle) === -1) return null;
          return { root: node, closeBtn: closeBtn };
        }
        node = node.parentElement;
      }
      return null;
    }

    // The real, content-based safety net (see the title-check comment above): any dialog
    // offering to begin a timed attempt — confirmed live on an item whose title gave no
    // hint of it — is never read or reported on, just closed immediately. Checked by button
    // text rather than title/category, since that's the one signal that showed up exactly
    // where expected regardless of what the item was called.
    //
    // Deliberately checks the WHOLE page, not scoped to a specific dialog.root — confirmed
    // live that scoping this to the same walked-up ancestor findOpenDialog() itself uses is
    // NOT safe: that walk stops at the first ancestor whose text contains both "Description"
    // and the expected title, and while that's the right node once it's fully rendered, it's
    // not guaranteed to still be the same node an outer caller is holding a reference to by
    // the time "Begin exam" itself attaches — this bit a live test twice. A page-wide check
    // has no such dependency: nothing on this page ever renders a "Begin exam" button except
    // inside an actually-open exam-start dialog, so a global match is exactly as trustworthy
    // as a scoped one here, without the scoping bug.
    function isExamPrompt() {
      var buttons = document.querySelectorAll("button");
      for (var i = 0; i < buttons.length; i++) {
        if (/begin exam/i.test(buttons[i].textContent)) return true;
      }
      return false;
    }

    var results = [];
    for (var q = 0; q < queue.length; q++) {
      var item = queue[q];
      // The dialog doesn't always echo an item's exact schedule-list title back verbatim —
      // confirmed live for "<title> Opens"/"<title> Closes" schedule markers, whose dialog
      // shows just "<title>". Matching on the stripped form avoids waiting out the full
      // timeout (and reading nothing) on every item like that; the unstripped item.title is
      // still what's reported to Docket, since that's what the ICS-synced record uses.
      var matchTitle = item.title.replace(/\\s+(Opens|Closes)$/i, "");
      item.anchor.click();
      var dialog = await waitUntil(function () { return findOpenDialog(matchTitle); }, 6000, 150);
      if (dialog) {
        // Confirmed live, across multiple failed attempts, that a single point-in-time check
        // here is not safe at any fixed delay: the title/description text can resolve —
        // satisfying the wait above — a variable amount of time before a same-dialog button
        // like "Begin exam" finishes rendering, and that variability wasn't bounded by any
        // delay tried (400ms, 3000ms) or by waiting for the button count to stop changing
        // (fooled by an early plateau) — plausibly a slower/eligibility-check-gated fetch on
        // LearningSuite's side for that button specifically. So instead of picking one moment
        // to check, keep checking across a window, reacting the instant it appears.
        //
        // That window has a real cost (every item pays it, exam-like or not), and paying the
        // full, most-cautious window unconditionally on all ~150 items in a typical run would
        // turn "a minute or two" into 20+ minutes. So the window itself is tiered by
        // plausibility: a title that already reads as quiz/exam/test-like gets the long,
        // most-cautious window; everything else still gets checked (this is a real safety
        // net, never skippable), just not held to the slowest-observed timing, since nothing
        // in any live test suggested an exam-start prompt hiding behind a title with zero
        // hint of assessment at all — only that its OWN render time is unpredictable once
        // something did suggest it.
        var mightBeTimedAssessment = /\\b(quiz|exam|test|assessment)\\b/i.test(item.title);
        var examWindowMs = mightBeTimedAssessment ? 8000 : 1500;
        var sawExam = false;
        var examWaited = 0;
        while (examWaited < examWindowMs) {
          if (isExamPrompt()) { sawExam = true; break; }
          await sleep(250);
          examWaited += 250;
        }
        if (sawExam) {
          var openNow = findOpenDialog();
          if (openNow) {
            openNow.closeBtn.click();
            await waitUntil(function () { return !findOpenDialog(); }, 1500, 100);
          }
          continue;
        }
      }
      if (dialog) {
        var links = [];
        var dialogAnchors = dialog.root.querySelectorAll("a[href]");
        for (var k = 0; k < dialogAnchors.length && links.length < 10; k++) {
          var href = dialogAnchors[k].getAttribute("href");
          if (href && /^https?:\\/\\//.test(href) && !/learningsuite\\.byu\\.edu/i.test(href)) {
            links.push({ text: dialogAnchors[k].textContent.replace(/\\s+/g, " ").trim().slice(0, 100), url: href.slice(0, 500) });
          }
        }
        // Text cleanup: strip the item's own title (Docket already has it — it may appear
        // anywhere in the dialog, not necessarily first, depending on dialog shape), the
        // "Instructor Note"/"Description" labels, the bare day stamp ("Fri, Sep 11"), a
        // captured "Due: ..." segment, and trailing button chrome. What's left, if
        // anything, is real added detail — an Instructor Note whose only content duplicates
        // its own title (e.g. "No LAB") correctly reduces to nothing here and is skipped
        // below rather than sent as a no-op update.
        var body = dialog.root.textContent.replace(/\\s+/g, " ").trim().split(item.title).join(" ");
        body = body.replace(/^\\s*Instructor Note\\s*/i, " ").replace(/\\bDescription\\b/i, " ");
        var dueMatch = body.match(/Due:\\s*(.*?)\\s*(?=Check [Oo]ff|Close|$)/i);
        var due = dueMatch ? dueMatch[1].trim() : "";
        if (dueMatch) body = body.replace(dueMatch[0], " ");
        body = body.replace(/[A-Z][a-z]{2},\\s*[A-Z][a-z]{2}\\s*\\d{1,2}/, " ");
        body = body.replace(/\\s*(Check [Oo]ff|Uncheck|Submit|Close)(\\s+(Check [Oo]ff|Uncheck|Submit|Close))*\\s*$/i, "");
        var description = body.replace(/\\s+/g, " ").trim();

        if (description || links.length) {
          results.push({ courseId: item.courseId, title: item.title, due: due, description: description.slice(0, 2000), links: links });
        }
        dialog.closeBtn.click();
        await waitUntil(function () { return !findOpenDialog(); }, 1500, 100);
      } else {
        // The title never matched within the timeout — could be a genuinely unexpected
        // dialog shape, but could just as easily mean the popup that DID open belongs to a
        // still-lingering previous item (its own close never resolved in time). Either way,
        // closing whatever's actually open now, best-effort, is what stops one mismatch
        // from cascading: leaving a stale dialog open blocks every later item's click too,
        // since the modal backdrop sits on top of the whole page — confirmed live, this is
        // exactly what turned one bad match into the rest of a run silently doing nothing.
        var stale = findOpenDialog();
        if (stale) {
          stale.closeBtn.click();
          await waitUntil(function () { return !findOpenDialog(); }, 1500, 100);
        } else {
          // findOpenDialog() only ever recognizes a dialog with "Description" text in it —
          // confirmed live that at least one item type ("Class Attendance") opens a
          // completely different dialog shape (a calendar-style picker, no "Description"
          // anywhere, no button literally labeled "Close") that this can never see or close.
          // That specific title is now excluded above, but as defense-in-depth for whatever
          // OTHER shape might still exist and hasn't been seen yet: Escape is a safe,
          // universal, purely-dismissive convention — it cancels/closes, never submits or
          // confirms anything — so sending it here can only help if something unrecognized
          // is actually open, and does nothing if the page is already clean.
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true }));
          await sleep(150);
        }
      }
    }

    if (!results.length) {
      alert("Docket: opened " + queue.length + " item(s) but found no new description or links to add.");
      return;
    }
    var form = document.createElement("form");
    form.method = "POST";
    form.action = ORIGIN + "/connect/learningsuite/import-schedule-details";
    form.target = "docket-import";
    var itemsInput = document.createElement("input");
    itemsInput.type = "hidden"; itemsInput.name = "items"; itemsInput.value = JSON.stringify(results);
    var tokenInput = document.createElement("input");
    tokenInput.type = "hidden"; tokenInput.name = "token"; tokenInput.value = TOKEN;
    form.appendChild(itemsInput);
    form.appendChild(tokenInput);
    document.body.appendChild(form);
    window.open("", "docket-import");
    form.submit();
    form.parentNode.removeChild(form);
  } catch (e) {
    alert("Docket bookmarklet error: " + (e && e.message ? e.message : e));
  }
})();`;
}

export type BookmarkletKind = "courses" | "assignments" | "schedule";

/** One of this student's own known courses — baked into the schedule bookmarklet so it can attribute each row to a courseId without guessing. */
export interface CourseMapEntry {
  code: string;
  courseId: string;
}

/**
 * Human-readable source (for display/audit on the /connect page — not
 * minified, meant to be read). `token` is the user's own bookmarklet
 * identity token (docs/ARCHITECTURE.md §14) on a multi-tenant hosted
 * instance — omit it (or pass `""`) for a single-tenant self-deployed
 * instance, where the import routes accept any request exactly as before
 * multi-tenant mode existed. `courseMap` is only used (and required to be
 * non-empty to be useful) for `kind: "schedule"`.
 */
export function bookmarkletSource(kind: BookmarkletKind, origin: string, token = "", courseMap: CourseMapEntry[] = []): string {
  const raw = kind === "courses" ? courseListExtractorSource() : kind === "assignments" ? assignmentsExtractorSource() : scheduleExtractorSource();
  return raw.replace("%ORIGIN%", origin).replace("%TOKEN%", token).replace("%COURSE_MAP%", JSON.stringify(courseMap));
}

/** The actual `javascript:` URI a student drags to their bookmarks bar. */
export function bookmarkletHref(kind: BookmarkletKind, origin: string, token = "", courseMap: CourseMapEntry[] = []): string {
  return `javascript:${encodeURIComponent(bookmarkletSource(kind, origin, token, courseMap))}`;
}
