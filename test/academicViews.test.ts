import assert from "node:assert/strict";
import { test } from "node:test";
import { todayView, upcomingView, workloadView } from "../src/core/academicViews.js";
import { todayInSchoolTimeZone } from "../src/core/schoolTime.js";
import { derivedField, realField } from "../src/core/types.js";
import type { AcademicSnapshot, AssignmentRecord, CourseRecord } from "../src/core/types.js";

// Anchored to BYU's own timezone, matching what academicViews.ts itself now uses — a
// server-local `new Date()` here would make this test only pass by coincidence on a
// machine that happens to already be set to America/Denver (exactly how the real "most
// assignments show up as due today" bug went unnoticed locally and only appeared deployed).
function iso(daysFromNow: number): string {
  const [y, m, d] = todayInSchoolTimeZone().split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + daysFromNow)).toISOString().slice(0, 10);
}

function snapshotWith(assignments: AssignmentRecord[], courses: CourseRecord[]): AcademicSnapshot {
  return { courses, assignments, announcements: [], companionTasks: [], syncRecords: [], changeLog: [] };
}

const course: CourseRecord = {
  id: "c1",
  code: realField("TEST 100", "demo"),
  title: realField("Test Course", "demo"),
};

test("todayView excludes calendar_event items even when due today", () => {
  const holiday: AssignmentRecord = {
    id: "c1:holiday",
    courseId: "c1",
    title: realField("Labor Day", "learningsuite-ics"),
    dueDate: realField(iso(0), "learningsuite-ics"),
    kind: derivedField("calendar_event", "title-keyword-heuristic"),
  };
  const real: AssignmentRecord = {
    id: "c1:hw1",
    courseId: "c1",
    title: realField("Homework 1", "learningsuite-ics"),
    dueDate: realField(iso(0), "learningsuite-ics"),
    kind: derivedField("assignment", "title-keyword-heuristic"),
  };
  const snapshot = snapshotWith([holiday, real], [course]);

  const items = todayView(snapshot);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.assignment.title.value, "Homework 1");
});

test("upcomingView and workloadView also exclude calendar_event items", () => {
  const holiday: AssignmentRecord = {
    id: "c1:holiday",
    courseId: "c1",
    title: realField("Fall Break", "learningsuite-ics"),
    dueDate: realField(iso(5), "learningsuite-ics"),
    kind: derivedField("calendar_event", "title-keyword-heuristic"),
  };
  const real: AssignmentRecord = {
    id: "c1:hw2",
    courseId: "c1",
    title: realField("Homework 2", "learningsuite-ics"),
    dueDate: realField(iso(5), "learningsuite-ics"),
    kind: derivedField("assignment", "title-keyword-heuristic"),
  };
  const snapshot = snapshotWith([holiday, real], [course]);

  const upcoming = upcomingView(snapshot);
  assert.equal(upcoming.length, 1);
  assert.equal(upcoming[0]!.assignment.title.value, "Homework 2");

  const workload = workloadView(snapshot, 7);
  assert.equal(workload.length, 1);
  assert.equal(workload[0]!.itemCount, 1);
});

test("an item with no kind set at all (connector doesn't classify) is treated as real work, not hidden", () => {
  const noKind: AssignmentRecord = {
    id: "c1:unclassified",
    courseId: "c1",
    title: realField("Something", "demo"),
    dueDate: realField(iso(0), "demo"),
  };
  const snapshot = snapshotWith([noKind], [course]);
  assert.equal(todayView(snapshot).length, 1);
});
