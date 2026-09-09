import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { setupDom } from "./testUtil.js";
import {
  looksLikeCourseListPage,
  looksLikeAssignmentsPage,
  looksLikeCompactAssignmentsPage,
  looksLikeAnnouncementsPage,
  looksLikeGradesPage,
  looksLikeGradeSummaryPage,
  looksLikeDashboardPage,
  courseIdFromUrl,
  isScheduleUrl,
} from "../src/core/pageDetector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const courseListHtml = readFileSync(join(__dirname, "fixtures/course-list.html"), "utf8");
const assignmentsHtml = readFileSync(join(__dirname, "fixtures/assignments.html"), "utf8");
const gradesHtml = readFileSync(join(__dirname, "fixtures/grades.html"), "utf8");
const gradeSummaryHtml = readFileSync(join(__dirname, "fixtures/grade-summary.html"), "utf8");
const dashboardHtml = readFileSync(join(__dirname, "fixtures/dashboard.html"), "utf8");

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

test("looksLikeCompactAssignmentsPage: true on LearningSuite's live narrow category-disclosure shape", () => {
  const compactAssignmentsHtml = `<main><div id="assignmentsComponent">
    <h1>Assignments</h1>
    <div class="lineHeight"><div class="cursor-pointer">Video Quizzes</div></div>
    <div class="lineHeight"><div class="cursor-pointer">YPoll Quizzes</div></div>
  </div></main>`;
  setupDom(compactAssignmentsHtml, "https://learningsuite.byu.edu/cid-abc123/student/home/assignments");
  assert.equal(looksLikeCompactAssignmentsPage(), true);
});

test("looksLikeCompactAssignmentsPage: rejects a Gradebook with coincidental disclosure rows", () => {
  const compactGradesHtml = `<div class="bg-top-nav-highlight">Grades</div><main><div id="assignmentsComponent">
    <h1>Assignments</h1>
    <div class="lineHeight"><div class="cursor-pointer">Video Quizzes</div></div>
    <div class="lineHeight"><div class="cursor-pointer">YPoll Quizzes</div></div>
  </div></main>`;
  setupDom(compactGradesHtml, "https://learningsuite.byu.edu/cid-abc123/student/gradebook");
  assert.equal(looksLikeCompactAssignmentsPage(), false);
});

test("looksLikeAnnouncementsPage: matches only the real course announcement rich-text shape", () => {
  setupDom(`<main><div><h1>Announcements</h1><div class="instructorText font-nunito">A real announcement</div></div></main>`, "https://learningsuite.byu.edu/cid-abc123/student/home/announcements");
  assert.equal(looksLikeAnnouncementsPage(), true);
});

test("looksLikeAnnouncementsPage: rejects an unrelated course page with rich text", () => {
  setupDom(`<main><h1>Syllabus</h1><div class="instructorText font-nunito">Course material</div></main>`, "https://learningsuite.byu.edu/cid-abc123/student/home/syllabus");
  assert.equal(looksLikeAnnouncementsPage(), false);
});

test("courseIdFromUrl extracts LearningSuite's own opaque courseID", () => {
  setupDom("<main></main>", "https://learningsuite.byu.edu/cid-xyz987/student/home");
  assert.equal(courseIdFromUrl(), "xyz987");
});

test("isScheduleUrl matches Combined Schedule's confirmed URL shape", () => {
  setupDom("<main></main>", "https://learningsuite.byu.edu/.sess123/student/top/schedule");
  assert.equal(isScheduleUrl(), true);
});

test("looksLikeGradesPage: true on the Grades page's identical-row-shape sub-view", () => {
  setupDom(gradesHtml, "https://learningsuite.byu.edu/cid-abc123/student/gradebook");
  assert.equal(looksLikeGradesPage(), true);
});

test("looksLikeGradesPage: false on the real Assignments page (same row shape, different active tab)", () => {
  setupDom(assignmentsHtml, "https://learningsuite.byu.edu/cid-abc123/student/assignments");
  assert.equal(looksLikeGradesPage(), false);
});

test("looksLikeGradesPage: false without a courseId in the URL", () => {
  setupDom(gradesHtml, "https://learningsuite.byu.edu/top/schedule");
  assert.equal(looksLikeGradesPage(), false);
});

test("looksLikeGradeSummaryPage: true on the real Grade Summary grid", () => {
  setupDom(gradeSummaryHtml, "https://learningsuite.byu.edu/student/top/summary");
  assert.equal(looksLikeGradeSummaryPage(), true);
});

test("looksLikeGradeSummaryPage: false once the URL itself is course-scoped", () => {
  setupDom(gradeSummaryHtml, "https://learningsuite.byu.edu/cid-abc123/student/home");
  assert.equal(looksLikeGradeSummaryPage(), false);
});

test("looksLikeGradeSummaryPage: false on Course List, which shares the same URL shape but not the heading or grid", () => {
  setupDom(courseListHtml, "https://learningsuite.byu.edu/top/course-list");
  assert.equal(looksLikeGradeSummaryPage(), false);
});

test("looksLikeDashboardPage: true on a course Dashboard", () => {
  setupDom(dashboardHtml, "https://learningsuite.byu.edu/cid-abc123/student/home");
  assert.equal(looksLikeDashboardPage(), true);
});

test("looksLikeDashboardPage: false on the real Assignments page, which shares the course-scoped URL shape", () => {
  setupDom(assignmentsHtml, "https://learningsuite.byu.edu/cid-abc123/student/assignments");
  assert.equal(looksLikeDashboardPage(), false);
});

test("looksLikeDashboardPage: false without a courseId in the URL", () => {
  setupDom(dashboardHtml, "https://learningsuite.byu.edu/top/course-list");
  assert.equal(looksLikeDashboardPage(), false);
});
