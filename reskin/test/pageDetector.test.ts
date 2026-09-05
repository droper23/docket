import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setupDom } from "./testUtil.js";
import { looksLikeCourseListPage, looksLikeAssignmentsPage, courseIdFromUrl, isScheduleUrl } from "../src/core/pageDetector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const courseListHtml = readFileSync(join(__dirname, "fixtures/course-list.html"), "utf8");
const assignmentsHtml = readFileSync(join(__dirname, "fixtures/assignments.html"), "utf8");

test("looksLikeCourseListPage: true on a course-list-shaped page with no cid- in the URL", () => {
  setupDom(courseListHtml, "https://learningsuite.byu.edu/top/course-list");
  assert.equal(looksLikeCourseListPage(), true);
});

test("looksLikeCourseListPage: false once the URL itself is course-scoped", () => {
  setupDom(courseListHtml, "https://learningsuite.byu.edu/cid-abc123/student/home");
  assert.equal(looksLikeCourseListPage(), false);
});

test("looksLikeCourseListPage: false on Grade Summary, whose per-course cid- anchors previously triggered a full card-grid takeover (regression, Sep 2026)", () => {
  const gradeSummaryHtml = `<main>
    <h1>Course Grade Summary</h1>
    <div><a href=".ORi6/cid-9R_ouvfPP1_r/student/home">DANCE 280 (003) - Social Dance, Technique 1</a></div>
    <div><a href=".ORi6/cid-Kkcc7zi3RXcJ/student/home">EC EN 224 (001) - Introduction to Computer Systems</a></div>
    <div><a href=".ORi6/cid-meOTckV8t7qV/student/home">EC EN 225 (001) - Computer System Design</a></div>
  </main>`;
  setupDom(gradeSummaryHtml, "https://learningsuite.byu.edu/.ORi6/student/top/summary");
  assert.equal(looksLikeCourseListPage(), false);
});

test("looksLikeAssignmentsPage: true on a course-scoped URL with real assignment rows present", () => {
  setupDom(assignmentsHtml, "https://learningsuite.byu.edu/cid-abc123/student/assignments");
  assert.equal(looksLikeAssignmentsPage(), true);
});

test("looksLikeAssignmentsPage: false without a courseId in the URL, even with matching DOM content", () => {
  setupDom(assignmentsHtml, "https://learningsuite.byu.edu/top/schedule");
  assert.equal(looksLikeAssignmentsPage(), false);
});

test("looksLikeAssignmentsPage: false on the Grades page, which shares the identical row markup (confirmed live, Sep 2026)", () => {
  const gradesHtml = `<div class="bg-top-nav">
    <a>Home</a><a class="bg-top-nav-highlight">Grades</a>
  </div>
  ${assignmentsHtml}`;
  setupDom(gradesHtml, "https://learningsuite.byu.edu/cid-abc123/student/gradebook");
  assert.equal(looksLikeAssignmentsPage(), false);
});

test("courseIdFromUrl extracts LearningSuite's own opaque courseID", () => {
  setupDom("<main></main>", "https://learningsuite.byu.edu/cid-xyz987/student/home");
  assert.equal(courseIdFromUrl(), "xyz987");
});

test("isScheduleUrl matches Combined Schedule's confirmed URL shape", () => {
  setupDom("<main></main>", "https://learningsuite.byu.edu/.sess123/student/top/schedule");
  assert.equal(isScheduleUrl(), true);
});
