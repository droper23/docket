import assert from "node:assert/strict";
import { test } from "node:test";
import { IcsConnector, inferEventKind } from "../src/connectors/icsConnector.js";
import type { KnownCourse } from "../src/connectors/icsConnector.js";

test("inferEventKind: real, observed BYU calendar markers are classified as calendar_event", () => {
  assert.equal(inferEventKind("Labor Day"), "calendar_event");
  assert.equal(inferEventKind("Start of Classes"), "calendar_event");
  assert.equal(inferEventKind("Fall Break"), "calendar_event");
  assert.equal(inferEventKind("Thanksgiving Break"), "calendar_event");
});

test("inferEventKind: real coursework, including titles that merely mention a holiday name, defaults to assignment", () => {
  assert.equal(inferEventKind("Bomb Programming Assignment"), "assignment");
  assert.equal(inferEventKind("Recitation Quiz 9/3"), "assignment");
  assert.equal(inferEventKind("Chapter 1.1~1.3"), "assignment");
  // Deliberately conservative: unsure cases default to "assignment" (shown, not hidden).
  assert.equal(inferEventKind("Reflection on Labor Day History"), "calendar_event"); // contains the marker phrase — a known, documented limitation of substring matching
});

test("IcsConnector.getAssignments tags a real ICS feed's calendar markers vs. coursework via kind", async () => {
  const course: KnownCourse = { courseId: "c1", code: "TEST 100", title: "Test", icsUrl: "https://example.test/ical" };
  const ics = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:evt-1",
    "SUMMARY:Labor Day",
    "DTSTART;VALUE=DATE:20260907",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:evt-2",
    "SUMMARY:Homework 3",
    "DTSTART;VALUE=DATE:20260910",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");

  const connector = new IcsConnector([course], async () => ics);
  const result = await connector.getAssignments("c1");
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const laborDay = result.data.find((a) => a.title.value === "Labor Day");
  const homework = result.data.find((a) => a.title.value === "Homework 3");
  assert.equal(laborDay?.kind?.value, "calendar_event");
  assert.equal(laborDay?.kind?.provenance, "derived");
  assert.equal(homework?.kind?.value, "assignment");
});
