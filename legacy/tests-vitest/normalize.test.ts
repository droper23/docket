import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normalizeIcs } from "../src/normalize.js";

const fixture = readFileSync(
  fileURLToPath(new URL("./fixtures/sample.ics", import.meta.url)),
  "utf-8",
);

describe("normalizeIcs", () => {
  it("parses every VEVENT into an AssignmentEvent", () => {
    const events = normalizeIcs(fixture, "course-abc", "2026-09-02T00:00:00.000Z");
    expect(events).toHaveLength(3);
  });

  it("builds a stable id from courseId + uid, not from content", () => {
    const events = normalizeIcs(fixture, "course-abc", "2026-09-02T00:00:00.000Z");
    const exam = events.find((e) => e.uid === "evt-exam-1");
    expect(exam?.stableId).toBe("course-abc:evt-exam-1");
  });

  it("infers assignment type from the title as a labeled heuristic", () => {
    const events = normalizeIcs(fixture, "course-abc", "2026-09-02T00:00:00.000Z");
    expect(events.find((e) => e.uid === "evt-exam-1")?.inferredType).toBe("exam");
    expect(events.find((e) => e.uid === "evt-quiz-1")?.inferredType).toBe("quiz");
    expect(events.find((e) => e.uid === "evt-reading-1")?.inferredType).toBe("reading");
  });

  it("produces the same content hash for identical title+dueDate across runs", () => {
    const a = normalizeIcs(fixture, "course-abc", "2026-09-02T00:00:00.000Z");
    const b = normalizeIcs(fixture, "course-abc", "2026-09-03T12:00:00.000Z"); // different sync time
    expect(a[0]?.lastContentHash).toBe(b[0]?.lastContentHash);
  });
});
