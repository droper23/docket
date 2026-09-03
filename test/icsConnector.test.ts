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

test("inferEventKind: lecture-slide/recording postings are calendar_event, not real work", () => {
  assert.equal(inferEventKind("Chapter 12.1 33-Processes.pdf  Download (06/01/26) Zoom Recording (06/06/26)"), "calendar_event");
  assert.equal(inferEventKind("08-C Overview and Variables.pdf  Download (05/02/26)"), "calendar_event");
  assert.equal(inferEventKind("00 Syllabus.pdf  Download (Updated on 08/30/2026)"), "calendar_event");
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

test(
  "regression: dueDate prefers DTEND over DTSTART when both are present — a real production " +
    "bug where every 'Content'-page item (DTSTART = the day it was assigned/opened, same " +
    "value shared by every item on the page; DTEND = its real, individually-different due " +
    "date) showed as due on day one of the semester, the root cause of a user report of " +
    "dozens of items wrongly marked overdue. A DTSTART-only event (no DTEND) is a single-day " +
    "marker and correctly stays its own due date.",
  async () => {
    const course: KnownCourse = { courseId: "c1", code: "TEST 100", title: "Test", icsUrl: "https://example.test/ical" };
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:evt-1",
      "SUMMARY:HW17 - Assembly Memory Management Part 2",
      "DTSTART;VALUE=DATE:20260902",
      "DTEND;VALUE=DATE:20261105",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:evt-2",
      "SUMMARY:Bomb Programming Assignment",
      "DTSTART;VALUE=DATE:20261120",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const connector = new IcsConnector([course], async () => ics);
    const result = await connector.getAssignments("c1");
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const hw = result.data.find((a) => a.title.value.startsWith("HW17"));
    const bomb = result.data.find((a) => a.title.value === "Bomb Programming Assignment");
    assert.equal(hw?.dueDate?.value, "2026-11-05", "must use DTEND, not the DTSTART 'opens' date");
    assert.equal(bomb?.dueDate?.value, "2026-11-20", "DTSTART-only event is unaffected");
  },
);
