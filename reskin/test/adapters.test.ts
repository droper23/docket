import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setupDom } from "./testUtil.js";
import { courseListAdapter } from "../src/adapters/courseListAdapter.js";
import { assignmentsAdapter } from "../src/adapters/assignmentsAdapter.js";
import { homeAdapter } from "../src/adapters/homeAdapter.js";
import { gradesAdapter } from "../src/adapters/gradesAdapter.js";
import { gradeSummaryAdapter } from "../src/adapters/gradeSummaryAdapter.js";
import { dashboardAdapter } from "../src/adapters/dashboardAdapter.js";
import { formatIsoDate } from "../src/lib/parseDueText.js";
import { dueDateLabel } from "../../src/core/agendaFormatting.js";
import { DEFAULT_SETTINGS, saveSettings } from "../src/core/settings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const courseListHtml = readFileSync(join(__dirname, "fixtures/course-list.html"), "utf8");
const courseListClickableHtml = readFileSync(join(__dirname, "fixtures/course-list-clickable.html"), "utf8");
const assignmentsHtml = readFileSync(join(__dirname, "fixtures/assignments.html"), "utf8");
const gradesHtml = readFileSync(join(__dirname, "fixtures/grades.html"), "utf8");
const gradeSummaryHtml = readFileSync(join(__dirname, "fixtures/grade-summary.html"), "utf8");
const dashboardHtml = readFileSync(join(__dirname, "fixtures/dashboard.html"), "utf8");

test("courseListAdapter renders one card per real course link, preserving the original href verbatim", () => {
  setupDom(courseListHtml, "https://learningsuite.byu.edu/top/course-list");
  try {
    assert.equal(courseListAdapter.matches(), true);
    courseListAdapter.mount(false);
    const cards = document.querySelectorAll(".docket-course-card");
    assert.equal(cards.length, 3);
    const hrefs = Array.from(cards)
      .map((c) => c.getAttribute("href"))
      .sort();
    assert.deepEqual(hrefs, ["/cid-abc123/student/home", "/cid-def456/student/home", "/cid-ghi789/student/home"]);
  } finally {
    courseListAdapter.unmount();
  }
});

test("courseListAdapter hides (never deletes) the original list outside Compatibility Mode", () => {
  setupDom(courseListHtml, "https://learningsuite.byu.edu/top/course-list");
  try {
    courseListAdapter.mount(false);
    // The new card and the original link share the same href (copied verbatim) — find the
    // original specifically by excluding our own inserted card.
    const matches = Array.from(document.querySelectorAll("a[href='/cid-abc123/student/home']")) as HTMLElement[];
    const original = matches.find((a) => !a.classList.contains("docket-course-card"))!;
    assert.ok(original, "original anchor must still be findable");
    assert.equal(original.hidden, true);
    assert.ok(document.body.contains(original), "original anchor must still be in the DOM");
  } finally {
    courseListAdapter.unmount();
  }
});

test("courseListAdapter keeps the original list visible in Compatibility Mode", () => {
  setupDom(courseListHtml, "https://learningsuite.byu.edu/top/course-list");
  try {
    courseListAdapter.mount(true);
    const matches = Array.from(document.querySelectorAll("a[href='/cid-abc123/student/home']")) as HTMLElement[];
    const original = matches.find((a) => !a.classList.contains("docket-course-card"))!;
    assert.ok(original, "original anchor must still be findable");
    assert.equal(original.hidden, false);
  } finally {
    courseListAdapter.unmount();
  }
});

test("courseListAdapter falls back to click-through cards when rows have no real href (confirmed live shape, Sep 2026)", () => {
  setupDom(courseListClickableHtml, "https://learningsuite.byu.edu/top/course-list");
  try {
    assert.equal(courseListAdapter.matches(), true);
    courseListAdapter.mount(false);
    const cards = document.querySelectorAll(".docket-course-card");
    assert.equal(cards.length, 2);
    // No card can carry a real href here — LearningSuite exposes no static courseID
    // anywhere in the row, only inside the URL after its own click handler runs.
    for (const c of cards) assert.equal(c.hasAttribute("href"), false);

    let originalClicked = false;
    const originalRow = document.querySelector("p.cursor-pointer") as HTMLElement;
    originalRow.addEventListener("click", () => {
      originalClicked = true;
    });
    (cards[0] as HTMLElement).click();
    assert.equal(originalClicked, true, "clicking the card must re-fire the original row's own click handler");
  } finally {
    courseListAdapter.unmount();
  }
});

test("assignmentsAdapter reads title, category, and real completion status off row text", () => {
  setupDom(assignmentsHtml, "https://learningsuite.byu.edu/cid-abc123/student/assignments");
  try {
    assert.equal(assignmentsAdapter.matches(), true);
    assignmentsAdapter.mount(false);
    const titles = Array.from(document.querySelectorAll(".docket-row-title")).map((el) => el.textContent);
    assert.deepEqual(titles, ["Lab 3: Linked Lists", "Lab 2: Arrays"]);
    const subtitles = Array.from(document.querySelectorAll(".docket-row-subtitle")).map((el) => el.textContent);
    assert.ok(
      subtitles.every((s) => s?.includes("20% of grade")),
      "category's % of grade (visible on the native table) must carry into the card subtitle, not silently disappear",
    );
    const checkboxes = document.querySelectorAll(".docket-checkbox");
    assert.equal(checkboxes[0]!.classList.contains("docket-checkbox-done"), false, "Lab 3 (Submit) must not read as completed");
    assert.equal(checkboxes[1]!.classList.contains("docket-checkbox-done"), true, "Lab 2 (Completed) must read as completed");
  } finally {
    assignmentsAdapter.unmount();
  }
});

test("homeAdapter keeps previously rendered rows on a second pass with no new items (Combined Schedule wipe regression, Sep 2026)", () => {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const md = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
  const html = `<main>
    <div class="listViewDay">
      <div>${md} - Some Day</div>
      <div class="flex-4"><a class="cursor-pointer block truncate">Reading: Chapter 3</a></div>
      <div>CS 235</div>
    </div>
    <div class="listViewDay">
      <div>${md} - Some Day</div>
      <div class="flex-4"><a class="cursor-pointer block truncate">Lab 5 writeup</a></div>
      <div>EC EN 224</div>
    </div>
  </main>`;
  setupDom(html, "https://learningsuite.byu.edu/.sess1/student/top/schedule");
  try {
    homeAdapter.mount(false);
    const before = document.querySelectorAll(".docket-row-title").length;
    assert.equal(before, 2);
    // Any stray DOM mutation schedules a second debounced mount() pass. Every real
    // anchor is already marked processed, so that pass extracts nothing new — it must
    // merge into (not replace) the already-rendered set. Confirmed live: the old
    // code went 65 rendered rows → 0 here.
    homeAdapter.mount(false);
    const after = document.querySelectorAll(".docket-row-title").length;
    assert.equal(after, 2, "second pass must not wipe previously rendered rows");
  } finally {
    homeAdapter.unmount();
  }
});

test("homeAdapter reads Combined Schedule items within the lookahead window", () => {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const md = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
  const html = `<main>
    <div class="listViewDay">
      <div>${md} - Some Day</div>
      <div class="flex-4"><a class="cursor-pointer block truncate">Reading: Chapter 3</a></div>
      <div>CS 235</div>
    </div>
  </main>`;
  setupDom(html, "https://learningsuite.byu.edu/.sess1/student/top/schedule");
  try {
    assert.equal(homeAdapter.matches(), true);
    homeAdapter.mount(false);
    const titles = Array.from(document.querySelectorAll(".docket-row-title")).map((el) => el.textContent);
    assert.deepEqual(titles, ["Reading: Chapter 3"]);
  } finally {
    homeAdapter.unmount();
  }
});

test("homeAdapter loads a course section's exact deadline onto today's Combined Schedule card", async () => {
  const today = new Date();
  const md = `${today.getMonth() + 1}/${today.getDate()}`;
  const todayIso = formatIsoDate(today);
  const html = `<main>
    <div class="listViewDay">
      <div>${md} - Today</div>
      <div class="flex-4"><a class="cursor-pointer block truncate"><i class="fa-circle"></i>Problem Set 1</a></div>
      <div>MATH 313</div>
    </div>
  </main>`;
  setupDom(html, "https://learningsuite.byu.edu/.sess1/student/top/schedule");
  const originalFetch = globalThis.fetch;
  // Course List and Assignments are both client-rendered: their raw HTML has no rendered rows
  // or real <a href> links at all (confirmed live, Sep 2026) — real data only ever shows up as a
  // JSON literal inside one of the page's own inline <script> tags (Course List's
  // "courseGroups", an Assignments page's own `var assignments = [...]`), so that's what the
  // mocks below reproduce instead of pre-rendered markup.
  globalThis.fetch = (async (input: URL | RequestInfo) => {
    const url = String(input);
    const text = url.includes("/courses")
      // LearningSuite includes the section in Course List, but Combined Schedule only shows
      // the catalog code. This must still select the course's Assignments page.
      ? `<script>var data = {"courseGroups":[{"courseList":[{"studentViewHref":"cid-math313/student/home"}]}]};</script>`
      : `<script>var assignments = [{"name":"Problem Set 1","dueDate":"${todayIso} 23:59:00"}];</script>`;
    return { text: async () => text } as Response;
  }) as typeof fetch;
  try {
    homeAdapter.mount(false);
    const button = document.querySelector(".docket-load-due-times") as HTMLButtonElement;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(document.querySelector(".docket-badge")?.textContent ?? "", /^(Due in|Overdue by) /);
    assert.match(document.querySelector(".docket-row-subtitle")?.textContent ?? "", /11:59 pm/);
  } finally {
    globalThis.fetch = originalFetch;
    homeAdapter.unmount();
  }
});

test("homeAdapter splits a single anchor's blank-line-separated real content into a title and a meta line (Sep 2026 concatenated-title bug)", () => {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const md = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
  // Confirmed live (EC EN 224, real account): a single real anchor's own textContent carries
  // several blank-line-separated logical lines — LearningSuite's native `truncate` CSS clips
  // this to one line; collapsing all whitespace instead runs every line together.
  const html = `<main>
    <div class="listViewDay">
      <div>${md} - Some Day</div>
      <div class="flex-4"><a class="cursor-pointer block truncate">Chapter 2.1

04-Information Storage.pdf&nbsp;&nbsp;Download&nbsp;(Updated on 09/01/2026)

Zoom Recording&nbsp;(05/01/26)</a></div>
      <div>EC EN 224</div>
    </div>
  </main>`;
  setupDom(html, "https://learningsuite.byu.edu/.sess1/student/top/schedule");
  try {
    homeAdapter.mount(false);
    const title = document.querySelector(".docket-row-title")!.textContent;
    assert.equal(title, "Chapter 2.1", "only the first real line becomes the title, not the whole run-on string");
    const subtitle = document.querySelector(".docket-row-subtitle")!.textContent;
    assert.match(subtitle!, /04-Information Storage\.pdf Download \(Updated on 09\/01\/2026\)/, "the remaining real content must survive, not be dropped");
    assert.match(subtitle!, /Zoom Recording \(05\/01\/26\)/);
  } finally {
    homeAdapter.unmount();
  }
});

test("homeAdapter wires the card's checkbox to the real native checkbox found on the same row (Sep 2026 'checking something off reverts to native' bug)", () => {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const md = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
  // Confirmed live: LearningSuite's own real checkbox is a SIBLING of the title cell within
  // the row, not nested inside it.
  const html = `<main>
    <div class="listViewDay">
      <div>${md} - Some Day</div>
      <div class="flex-4"><a class="cursor-pointer block truncate"><i class="fa-circle"></i><span class="truncate">Recitation Quiz 9/8</span></a></div>
      <div>MATH 113</div>
      <input type="checkbox">
    </div>
  </main>`;
  setupDom(html, "https://learningsuite.byu.edu/.sess1/student/top/schedule");
  try {
    homeAdapter.mount(false);
    const checkbox = document.querySelector(".docket-checkbox") as HTMLElement;
    assert.equal(checkbox.getAttribute("role"), "checkbox", "a real native checkbox was found on the row, so the card's own checkbox must be interactive");
    const nativeCheckbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    assert.equal(nativeCheckbox.checked, false);
    checkbox.click();
    assert.equal(nativeCheckbox.checked, true, "clicking the card's checkbox must toggle the real native checkbox in place, never reveal/navigate");
  } finally {
    homeAdapter.unmount();
  }
});

test("homeAdapter classifies items from their native icon markup: a dot means due, a BYU Y-logo means calendar, neither means plain info", () => {
  const tomorrow = new Date(Date.now() + 86_400_000);
  const md = `${tomorrow.getMonth() + 1}/${tomorrow.getDate()}`;
  const html = `<main>
    <div class="listViewDay">
      <div>${md} - Some Day</div>
      <div class="flex-4"><a class="cursor-pointer block truncate"><i class="fa-circle"></i><span class="truncate">Recitation Quiz 9/8</span></a></div>
      <div>MATH 113</div>
    </div>
    <div class="listViewDay">
      <div>${md} - Some Day</div>
      <div class="flex-4"><a class="cursor-pointer block truncate"><img class="academic-y-logo"><span class="truncate">Labor Day</span></a></div>
      <div>MATH 113</div>
    </div>
    <div class="listViewDay">
      <div>${md} - Some Day</div>
      <div class="flex-4"><a class="cursor-pointer block truncate"><span class="truncate">Appendix D: Trigonometry</span></a></div>
      <div>MATH 113</div>
    </div>
  </main>`;
  setupDom(html, "https://learningsuite.byu.edu/.sess1/student/top/schedule");
  try {
    homeAdapter.mount(false);
    const rows = Array.from(document.querySelectorAll(".docket-row"));
    const byTitle = (t: string) => rows.find((r) => r.querySelector(".docket-row-title")?.textContent === t)!;
    assert.equal(byTitle("Recitation Quiz 9/8").classList.contains("docket-row-info"), false, "a real due item (dot) must not be muted");
    assert.ok(byTitle("Labor Day").classList.contains("docket-row-info"), "a university calendar entry (Y-logo) must be muted, not treated as due");
    assert.ok(byTitle("Appendix D: Trigonometry").classList.contains("docket-row-info"), "a plain topic line (no dot, no Y-logo) must be muted, not treated as due");
  } finally {
    homeAdapter.unmount();
  }
});

test("assignmentsAdapter formats an 'Opens' date with the same shared wording Combined Schedule uses, not the raw scraped text (Sep 2026 cross-page inconsistency bug)", () => {
  // Confirmed live: the identical real assignment (MATH 113's Video Quiz 7.2) read "Opens
  // Wednesday" on Combined Schedule (homeAdapter.ts, via dueDateLabel()) and "Opens Sep 9" here
  // — the raw regex-captured status text passed straight through with no shared formatting.
  const target = new Date(Date.now() + 10 * 86_400_000);
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const opensRaw = `${monthNames[target.getMonth()]} ${target.getDate()}`;
  const expectedIso = formatIsoDate(target);
  const expectedLabel = dueDateLabel(expectedIso);

  const html = `<main>
    <div class="lineHeight"><div class="cursor-pointer"><span></span><span>Video Quizzes</span><span>of Grade: 5%</span></div></div>
    <div class="bg-base text-highlight">
      <div></div>
      <div>Video Quiz 7.2</div>
      <div>Sep 16 1:59 pm MDT</div>
      <div>Opens ${opensRaw}</div>
      <div>/10.0</div>
    </div>
  </main>`;
  setupDom(html, "https://learningsuite.byu.edu/cid-abc123/student/assignments");
  try {
    assignmentsAdapter.mount(false);
    const badge = document.querySelector(".docket-badge")!;
    assert.equal(badge.textContent, `Opens ${expectedLabel}`, "must use the same shared dueDateLabel() wording homeAdapter.ts uses, not the raw scraped date text");
    assert.equal(document.querySelectorAll(".docket-badge")[1]?.textContent, `Due ${dueDateLabel("2026-09-16")}`);
  } finally {
    assignmentsAdapter.unmount();
  }
});

test("gradesAdapter renders the Grades page's identical row shape as a grade list, not an assignment list", () => {
  setupDom(gradesHtml, "https://learningsuite.byu.edu/cid-abc123/student/gradebook");
  try {
    // Confirmed live (Sep 2026): Grades' default sub-view shares assignmentsAdapter's exact
    // row shape, so the two must be mutually exclusive on the same fixture-shaped DOM.
    assert.equal(gradesAdapter.matches(), true);
    assert.equal(assignmentsAdapter.matches(), false, "the identical row shape must not also match Assignments once .bg-top-nav-highlight reads Grades");
    gradesAdapter.mount(false);
    // .docket-title-1, not .docket-display — Grades is a course-scoped, one-level-deep page
    // (see PASS12_PLAN.md Phase 4.2 and gradesAdapter.ts's own comment on this).
    assert.equal(document.querySelector(".docket-title-1")?.textContent, "Grades");
    const titles = Array.from(document.querySelectorAll(".docket-row-title")).map((el) => el.textContent);
    assert.deepEqual(titles, ["Lab 3: Linked Lists", "Lab 2: Arrays"]);
  } finally {
    gradesAdapter.unmount();
  }
});

test("gradeSummaryAdapter renders one card per course, skipping the header row, with both progress percentages", () => {
  setupDom(gradeSummaryHtml, "https://learningsuite.byu.edu/student/top/summary");
  try {
    assert.equal(gradeSummaryAdapter.matches(), true);
    gradeSummaryAdapter.mount(false);
    const cards = document.querySelectorAll(".docket-course-card");
    assert.equal(cards.length, 2, "the term/column header row (no cid- link) must be skipped, only real course rows rendered");
    const hrefs = Array.from(cards).map((c) => c.getAttribute("href")).sort();
    assert.deepEqual(hrefs, ["/cid-abc123/student/home", "/cid-def456/student/home"]);
    const badgeTexts = Array.from(document.querySelectorAll(".docket-badge")).map((b) => b.textContent);
    // DANCE 280 (0/8 assignments scored) must read as neutral "Not yet graded" for both
    // columns — see gradeBadge.ts. MATH 113's Current (100%, genuinely 5/5 scored) still bands
    // by performance; MATH 113's Total (0.58%, "% of ALL possible points in the class," per
    // LearningSuite's own legend) must NOT band red just because it's numerically low — that
    // number is guaranteed to look catastrophic for nearly the whole semester by construction
    // regardless of real standing (confirmed live, Sep 2026 false-alarm bug), so "Total" always
    // renders neutral.
    assert.deepEqual(badgeTexts, ["Not yet graded", "Not yet graded", "100%", "0.58%"]);
    const doneBadges = document.querySelectorAll(".docket-badge-done");
    assert.equal(doneBadges.length, 1, "MATH 113's genuinely-scored Current 100% must still band as a real performance signal");
    const overdueBadges = document.querySelectorAll(".docket-badge-overdue");
    assert.equal(overdueBadges.length, 0, "Total course progress must never band red, however low the raw percentage");
  } finally {
    gradeSummaryAdapter.unmount();
  }
});

test("gradeSummaryAdapter carries the real 'N/M assignments scored' detail and the native explanatory footnote through, and adds an escape hatch", () => {
  setupDom(gradeSummaryHtml, "https://learningsuite.byu.edu/student/top/summary");
  try {
    gradeSummaryAdapter.mount(false);
    const details = Array.from(document.querySelectorAll(".docket-grade-stat .docket-body-sm")).map((el) => el.textContent);
    assert.ok(details.some((d) => d === "0/8 assignments scored"));
    assert.ok(details.some((d) => d === "5/171 assignments scored"));
    const footer = document.querySelector(".docket-page > .docket-body-sm");
    assert.ok(footer?.textContent?.includes("Current progress represents"), "the native legend explaining the two columns must not be silently dropped");
    assert.ok(document.querySelector(".docket-toggle-original"), "this adapter previously had zero way back to the native page");
  } finally {
    gradeSummaryAdapter.unmount();
  }
});

test("dashboardAdapter renders the per-day schedule as grouped cards without hiding the sibling Announcements widget", () => {
  setupDom(dashboardHtml, "https://learningsuite.byu.edu/cid-abc123/student/home");
  try {
    // Confirmed live: an instructor lesson-topic note is a real `<p>` nested inside the
    // outer `p.mb-2.text-sm.break-words` — only reachable because Vue builds it via
    // imperative DOM calls, not HTML parsing (a raw HTML fixture string can't express this;
    // any HTML parser, jsdom included, auto-closes a `<p>` before a nested block element).
    // Built here with the same DOM APIs the real page uses, to exercise the real shape.
    const tueList = document.querySelectorAll(".pl-mobile")[1]!.querySelector(".pb-5")!;
    const noteP = document.createElement("p");
    noteP.className = "mb-2 text-sm break-words";
    const noteDiv = document.createElement("div");
    noteDiv.className = "default-list default-table instructorText font-nunito break-words";
    noteDiv.innerHTML = "<p>Recitation Quiz 5.3/5.5: The FUNdamental Theorem</p>";
    noteP.appendChild(noteDiv);
    tueList.insertBefore(noteP, tueList.firstChild);

    assert.equal(dashboardAdapter.matches(), true);
    dashboardAdapter.mount(false);
    const dayHeadlines = Array.from(document.querySelectorAll(".docket-day-header .docket-title-2")).map((el) => el.textContent);
    assert.deepEqual(dayHeadlines, ["Mon, Sep 7", "Tue, Sep 8"]);
    const rowTitles = Array.from(document.querySelectorAll(".docket-row-title")).map((el) => el.textContent);
    assert.deepEqual(rowTitles, [
      "Labor Day",
      "Recitation Quiz 5.3/5.5: The FUNdamental Theorem",
      "Recitation Quiz 9/8",
      // Regression check for the Column-2 data-loss bug (Sep 2026): a day's real second
      // "Column 2" sibling (a BYU calendar/Devotional entry here) was silently dropped when
      // extraction only ever read `bar.nextElementSibling` — see extractDays()'s doc comment.
      "Devotional: President and Sister Reese",
    ]);

    // The real regression this test guards: overlaying the whole page (not just the
    // schedule column) hid the sibling Announcements widget along with the native schedule
    // — confirmed live before this was scoped down to `[class~="md:mr-6"]` specifically.
    const announcements = document.querySelector(".announcements-widget") as HTMLElement;
    assert.equal(announcements.hidden, false, "the Announcements sidebar must stay visible — only the schedule column is overlaid");

    let originalClicked = false;
    const originalLink = document.querySelector("a.cursor-pointer") as HTMLElement;
    originalLink.addEventListener("click", () => {
      originalClicked = true;
    });
    (Array.from(document.querySelectorAll(".docket-row-title")).find((el) => el.textContent === "Recitation Quiz 9/8")!.closest(".docket-row") as HTMLElement).click();
    assert.equal(originalClicked, true, "clicking a real assignment row must re-fire the original element's own click handler");
  } finally {
    dashboardAdapter.unmount();
  }
});

test("dashboardAdapter preserves every real anchor in a paragraph, not just the first", () => {
  const html = `<main>
    <h1>Dashboard</h1>
    <div class="flex flex-col-reverse md:flex-row md:justify-between">
      <div class="md:w-3/4 md:mr-6">
        <div class="mb-2">
          <div class="mb-4 text-primary-alt bg-gray1 text-md font-normal px-4 py-2">Wed, Sep 9</div>
          <div class="pl-mobile sm:pl-0">
            <div>
              <h3>Column 1</h3>
              <div class="pb-5 pt-1 break-words">
                <p class="mb-2 text-sm break-words"><a class="cursor-pointer">Lecture Recording</a> <a class="cursor-pointer">Slides PDF</a> (Updated on 9/9)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="announcements-widget"></div>
    </div>
  </main>`;
  setupDom(html, "https://learningsuite.byu.edu/cid-abc123/student/home");
  try {
    dashboardAdapter.mount(false);
    const rowTitles = Array.from(document.querySelectorAll(".docket-row-title")).map((el) => el.textContent);
    assert.deepEqual(rowTitles, ["Lecture Recording", "Slides PDF", "(Updated on 9/9)"], "both real anchors, plus the leftover meta text, must each render as their own row");

    let recordingClicked = false;
    let slidesClicked = false;
    const [recordingLink, slidesLink] = Array.from(document.querySelectorAll("a.cursor-pointer")) as HTMLElement[];
    recordingLink!.addEventListener("click", () => (recordingClicked = true));
    slidesLink!.addEventListener("click", () => (slidesClicked = true));
    (Array.from(document.querySelectorAll(".docket-row-title")).find((el) => el.textContent === "Slides PDF")!.closest(".docket-row") as HTMLElement).click();
    assert.equal(slidesClicked, true, "the second anchor's own click handler must be reachable, not just the first");
    assert.equal(recordingClicked, false);
  } finally {
    dashboardAdapter.unmount();
  }
});

test("homeAdapter merges an 'External Calendars' iCalendar feed into the Combined Schedule agenda", async () => {
  // Appended last in this file, and never resets homeAdapter's own module-level
  // externalItems/externalFeedsLoadedForKey cache (see homeAdapter.ts's doc comment on why
  // that's safe in production — Settings changes always force a full page reload) — so this
  // must stay the final test to touch homeAdapter, or a later test would inherit this feed.
  const todayIso = formatIsoDate(new Date());
  const todayCompact = todayIso.replace(/-/g, "");
  // Real shape confirmed live against a BYU MAX (max.byu.edu) Physics 121 feed, Sep 2026:
  // DESCRIPTION reads "<title> is due at H:MM, <url>" and RFC 5545 line-folds past 75 octets
  // (a continuation line starting with a single space) — both reproduced here, not simplified
  // away, since parseIcs()'s unfold() is exactly what has to handle this correctly.
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:max-hw2@max.byu.edu",
    "SUMMARY:Homework 2",
    `DTSTART;VALUE=DATE:${todayCompact}`,
    "DESCRIPTION:Homework 2 is due at 23:59\\, https://max.byu.edu/20265-phscs",
    " 121/content/homework/2",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  setupDom("<main></main>", "https://learningsuite.byu.edu/.sess1/student/top/schedule");
  const g = globalThis as unknown as Record<string, unknown>;
  // storage.ts prefers GM_getValue/GM_setValue over localStorage — mocked directly so this
  // test doesn't depend on whether Node's test environment has a working localStorage.
  const gmStore: Record<string, unknown> = {};
  g["GM_getValue"] = (key: string, def: unknown) => (key in gmStore ? gmStore[key] : def);
  g["GM_setValue"] = (key: string, value: unknown) => {
    gmStore[key] = value;
  };
  saveSettings({ ...DEFAULT_SETTINGS, externalFeeds: [{ label: "PHSCS 121", url: "https://max.byu.edu/calendar/ical/20265-phscs121/3" }] });
  const requestedUrls: string[] = [];
  g["GM_xmlhttpRequest"] = (details: { url: string; onload: (r: { status: number; responseText: string }) => void }) => {
    requestedUrls.push(details.url);
    details.onload({ status: 200, responseText: ics });
  };
  const originalOpen = window.open;
  const openedUrls: string[] = [];
  window.open = ((url?: string | URL) => {
    openedUrls.push(String(url));
    return null;
  }) as typeof window.open;

  try {
    homeAdapter.mount(false);
    // loadExternalFeeds() fetches and re-mounts from its own `finally` block — both async hops
    // (the GM_xmlhttpRequest call above resolves synchronously, but the surrounding Promise
    // chain in gmFetchText/loadExternalFeeds still needs a couple of microtask turns).
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(requestedUrls, ["https://max.byu.edu/calendar/ical/20265-phscs121/3"]);
    const titles = Array.from(document.querySelectorAll(".docket-row-title")).map((el) => el.textContent);
    assert.ok(titles.includes("Homework 2"), "the external feed's item must appear in the merged agenda");
    const subtitle = Array.from(document.querySelectorAll(".docket-row-subtitle")).find((el) => el.textContent?.includes("PHSCS 121"))!.textContent;
    assert.match(subtitle!, /11:59 pm/, "MAX's own due-time convention (\"is due at HH:MM\") must be parsed, not just the bare date");

    const row = Array.from(document.querySelectorAll(".docket-row")).find((row) => row.querySelector(".docket-row-title")?.textContent === "Homework 2") as HTMLElement;
    row.click();
    assert.deepEqual(openedUrls, ["https://max.byu.edu/20265-phscs121/content/homework/2"], "opening an external item must go to its real MAX URL in a new tab, never LearningSuite's own (nonexistent) detail dialog");
  } finally {
    window.open = originalOpen;
    delete g["GM_xmlhttpRequest"];
    delete g["GM_getValue"];
    delete g["GM_setValue"];
    homeAdapter.unmount();
  }
});
