import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { parseIcs } from "../src/connectors/icsParser.js";

const fixturePath = new URL("./fixtures/sample-course.ics", import.meta.url);

test("parses a realistic all-day course schedule feed", async () => {
  const raw = await readFile(fixturePath, "utf-8");
  const events = parseIcs(raw);

  assert.equal(events.length, 3);

  const lab = events.find((e) => e.uid === "evt-1001@learningsuite.byu.edu");
  assert.ok(lab);
  assert.equal(lab!.summary, "Lab 3: Binary Search Trees");
  assert.equal(lab!.startDate, "2026-09-05");
  assert.equal(lab!.allDay, true);
  assert.equal(lab!.startDateTime, undefined);
});

test("unescapes commas and newlines in text values", async () => {
  const raw = await readFile(fixturePath, "utf-8");
  const events = parseIcs(raw);
  const reading = events.find((e) => e.uid === "evt-1003@learningsuite.byu.edu");
  assert.ok(reading);
  assert.equal(reading!.summary, "Reading: Chapter 6, Sorting Algorithms");

  const exam = events.find((e) => e.uid === "evt-1002@learningsuite.byu.edu");
  assert.ok(exam!.description!.includes("\n"));
});

test("handles RFC 5545 line folding (continuation lines starting with a space)", () => {
  // Per RFC 5545 §3.1, folding inserts CRLF + exactly one whitespace char which
  // unfolding strips — so a fold at a word boundary keeps the original space on
  // the *first* physical line, and the continuation line's leading char is purely
  // the fold marker (not itself part of the content).
  const raw = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:evt-folded@learningsuite.byu.edu",
    "SUMMARY:This is a very long summary that got ",
    " folded across two physical lines by the server",
    "DTSTART;VALUE=DATE:20260910",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const events = parseIcs(raw);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.summary, "This is a very long summary that got folded across two physical lines by the server");
});

test("decodes double-escaped HTML entities (observed real-world LearningSuite export quirk)", () => {
  const raw = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:evt-entities",
    "SUMMARY:Read &amp;ldquo;Intro to Systems&amp;rdquo; &amp;amp; take notes",
    "DTSTART;VALUE=DATE:20260909",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  const events = parseIcs(raw);
  assert.equal(events[0]!.summary, "Read “Intro to Systems” & take notes");
});

test("ignores malformed VEVENT blocks missing required fields instead of throwing", () => {
  const raw = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:no-summary-here", "END:VEVENT", "END:VCALENDAR"].join("\n");
  const events = parseIcs(raw);
  assert.equal(events.length, 0);
});

test("parses a datetime (non-all-day) event as a smoke test for the authenticated-connector future path", () => {
  const raw = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:evt-timed",
    "SUMMARY:Review Session",
    "DTSTART:20260910T190000Z",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  const events = parseIcs(raw);
  assert.equal(events[0]!.allDay, false);
  assert.equal(events[0]!.startDateTime, "2026-09-10T19:00:00");
});
