import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setupDom } from "./testUtil.js";
import { courseListAdapter } from "../src/adapters/courseListAdapter.js";
import { assignmentsAdapter } from "../src/adapters/assignmentsAdapter.js";
import { homeAdapter } from "../src/adapters/homeAdapter.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const courseListHtml = readFileSync(join(__dirname, "fixtures/course-list.html"), "utf8");
const courseListClickableHtml = readFileSync(join(__dirname, "fixtures/course-list-clickable.html"), "utf8");
const assignmentsHtml = readFileSync(join(__dirname, "fixtures/assignments.html"), "utf8");

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
