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
 * Both extractors below only ever read `.textContent` and, for the course
 * list, the `cid-...` course-link `href` (never a full element dump, never
 * `document.cookie`, never a query string) — see the comment above each
 * function. They POST the result as a same-origin-agnostic HTML form
 * submission (not `fetch`), which needs no CORS configuration and cannot
 * silently exfiltrate to anywhere but the exact origin baked in below.
 */

/** Extracts the student's current-term course list. Verified live against a real LearningSuite account. */
function courseListExtractorSource(): string {
  return `(function(){
  var ORIGIN = "%ORIGIN%";
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
    document.body.appendChild(form);
    window.open("", "docket-import");
    form.submit();
    form.parentNode.removeChild(form);
  } catch (e) {
    alert("Docket bookmarklet error: " + (e && e.message ? e.message : e));
  }
})();`;
}

/**
 * Extracts one course's assignment rows (real due time, real score) from
 * that course's Assignments page — data that genuinely does not exist in
 * the ICS feed. Verified live, including a real gotcha: LearningSuite
 * renders this page differently depending on viewport width — at normal
 * desktop width every category's rows are already in the DOM, but at
 * narrower widths (a resized window, or a phone) categories collapse into
 * click-to-expand accordions and their rows aren't rendered until opened.
 * `collectRows()` handles the common desktop case directly; only if that
 * finds nothing does it fall back to clicking each category open in turn.
 * Score/due-time are pulled via regex over each row's full text rather
 * than a fixed cell index, because the two layouts also split that text
 * across a different number of cells — a fixed index silently reads the
 * wrong thing on one of the two layouts, while text search doesn't care.
 * Deliberately does not read completion-status: it isn't rendered as
 * readable text on this page (see docs/ROADMAP.md Phase 2 notes) — that's
 * the Prioritizer page, a documented next step, not guessed at here.
 */
function assignmentsExtractorSource(): string {
  return `(async function(){
  var ORIGIN = "%ORIGIN%";
  try {
    if (!/learningsuite\\.byu\\.edu$/.test(location.hostname)) {
      alert("Docket: open this on a LearningSuite course's Assignments page first.");
      return;
    }
    var m = location.pathname.match(/cid-([^\\/]+)/);
    if (!m) { alert("Docket: open a specific course's Assignments page (course > Assignments) and try again."); return; }
    var courseId = m[1];

    var seen = {};
    var results = [];
    function collectRows() {
      var rows = document.querySelectorAll("main .bg-base.text-highlight");
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var titleCell = row.children[1];
        var title = titleCell ? titleCell.textContent.replace(/\\s+/g, " ").trim() : "";
        if (!title || seen[title]) continue;
        var rowText = row.textContent.replace(/\\s+/g, " ").trim();
        var dueMatch = rowText.match(/[A-Z][a-z]{2}\\s+\\d{1,2}\\s+\\d{1,2}:\\d{2}\\s*[ap]m\\s*[A-Z]{2,5}/);
        var due = dueMatch ? dueMatch[0] : "";
        var beforeGrade = rowText.split(/of Grade/i)[0];
        var afterDue = due ? beforeGrade.slice(beforeGrade.indexOf(due) + due.length) : beforeGrade;
        var scoreMatch = afterDue.match(/(\\d+(?:\\.\\d+)?)?\\s*\\/\\s*(\\d+(?:\\.\\d+)?)/);
        var score = scoreMatch ? scoreMatch[0] : "";
        seen[title] = true;
        results.push({ title: title, due: due, score: score });
      }
    }

    collectRows();
    if (results.length === 0) {
      var headers = document.querySelectorAll("main .lineHeight > div.cursor-pointer");
      for (var h = 0; h < headers.length; h++) {
        headers[h].click();
        await new Promise(function (r) { setTimeout(r, 450); });
        collectRows();
      }
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
    form.appendChild(courseInput);
    form.appendChild(rowsInput);
    document.body.appendChild(form);
    window.open("", "docket-import");
    form.submit();
    form.parentNode.removeChild(form);
  } catch (e) {
    alert("Docket bookmarklet error: " + (e && e.message ? e.message : e));
  }
})();`;
}

export type BookmarkletKind = "courses" | "assignments";

/** Human-readable source (for display/audit on the /connect page — not minified, meant to be read). */
export function bookmarkletSource(kind: BookmarkletKind, origin: string): string {
  const raw = kind === "courses" ? courseListExtractorSource() : assignmentsExtractorSource();
  return raw.replace("%ORIGIN%", origin);
}

/** The actual `javascript:` URI a student drags to their bookmarks bar. */
export function bookmarkletHref(kind: BookmarkletKind, origin: string): string {
  return `javascript:${encodeURIComponent(bookmarkletSource(kind, origin))}`;
}
