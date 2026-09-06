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

test("gradesAdapter renders the Grades page's identical row shape as a grade list, not an assignment list", () => {
  setupDom(gradesHtml, "https://learningsuite.byu.edu/cid-abc123/student/gradebook");
  try {
    // Confirmed live (Sep 2026): Grades' default sub-view shares assignmentsAdapter's exact
    // row shape, so the two must be mutually exclusive on the same fixture-shaped DOM.
    assert.equal(gradesAdapter.matches(), true);
    assert.equal(assignmentsAdapter.matches(), false, "the identical row shape must not also match Assignments once .bg-top-nav-highlight reads Grades");
    gradesAdapter.mount(false);
    assert.equal(document.querySelector(".docket-display")?.textContent, "Grades");
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
    // DANCE 280 (0/8 assignments scored) must read as neutral "Not yet graded," never a
    // failing red 0% — see gradeBadge.ts. MATH 113 (5/171 scored) has genuinely been graded,
    // so its real 0.58% still bands red: "nothing scored yet" and "scored and doing badly"
    // must not collapse into the same signal.
    assert.deepEqual(badgeTexts, ["Not yet graded", "Not yet graded", "100%", "0.58%"]);
    const overdueBadges = document.querySelectorAll(".docket-badge-overdue");
    assert.equal(overdueBadges.length, 1, "MATH 113's genuinely-scored 0.58% must still band red");
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
    assert.deepEqual(rowTitles, ["Labor Day", "Recitation Quiz 5.3/5.5: The FUNdamental Theorem", "Recitation Quiz 9/8"]);

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
    (Array.from(document.querySelectorAll(".docket-row-title")).find((el) => el.textContent === "Recitation Quiz 9/8")!.closest(".docket-row-tappable") as HTMLElement).click();
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
    (Array.from(document.querySelectorAll(".docket-row-title")).find((el) => el.textContent === "Slides PDF")!.closest(".docket-row-tappable") as HTMLElement).click();
    assert.equal(slidesClicked, true, "the second anchor's own click handler must be reachable, not just the first");
    assert.equal(recordingClicked, false);
  } finally {
    dashboardAdapter.unmount();
  }
});
