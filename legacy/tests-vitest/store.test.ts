import { describe, expect, it } from "vitest";
import { applyCourseSync } from "../src/store.js";
import type { AssignmentEvent, DataStore } from "../src/types.js";

function makeEvent(overrides: Partial<AssignmentEvent> = {}): AssignmentEvent {
  return {
    stableId: "course-1:uid-1",
    courseId: "course-1",
    uid: "uid-1",
    title: "Exam 1",
    dueDate: "2026-10-05",
    inferredType: "exam",
    lastContentHash: "hash-a",
    lastSyncedAt: "2026-09-02T00:00:00.000Z",
    missingStreak: 0,
    source: "ical",
    ...overrides,
  };
}

function emptyStore(): DataStore {
  return { assignments: {}, changelog: [], lastSyncAt: null };
}

describe("applyCourseSync", () => {
  it("creates a new record for an unseen stable id", () => {
    const store = emptyStore();
    const changes = applyCourseSync(store, "course-1", [makeEvent()], "t1");
    expect(changes).toHaveLength(1);
    expect(changes[0]?.kind).toBe("created");
    expect(Object.keys(store.assignments)).toEqual(["course-1:uid-1"]);
  });

  it("is a no-op when content is unchanged, and never duplicates", () => {
    const store = emptyStore();
    applyCourseSync(store, "course-1", [makeEvent()], "t1");
    const changes = applyCourseSync(store, "course-1", [makeEvent()], "t2");
    expect(changes).toHaveLength(0);
    expect(Object.keys(store.assignments)).toHaveLength(1);
  });

  it("updates the existing record in place when the due date changes, never creating a duplicate", () => {
    const store = emptyStore();
    applyCourseSync(store, "course-1", [makeEvent()], "t1");
    const changed = makeEvent({ dueDate: "2026-10-06", lastContentHash: "hash-b" });
    const changes = applyCourseSync(store, "course-1", [changed], "t2");

    expect(changes).toHaveLength(1);
    expect(changes[0]?.kind).toBe("updated");
    expect(changes[0]?.detail).toContain("2026-10-05");
    expect(changes[0]?.detail).toContain("2026-10-06");
    expect(Object.keys(store.assignments)).toHaveLength(1);
    expect(store.assignments["course-1:uid-1"]?.dueDate).toBe("2026-10-06");
  });

  it("does not delete an item on a single missed pass", () => {
    const store = emptyStore();
    applyCourseSync(store, "course-1", [makeEvent()], "t1");
    applyCourseSync(store, "course-1", [], "t2"); // item absent this pass
    expect(store.assignments["course-1:uid-1"]).toBeDefined();
    expect(store.assignments["course-1:uid-1"]?.missingStreak).toBe(1);
  });

  it("archives (removes) an item only after several consecutive missed passes", () => {
    const store = emptyStore();
    applyCourseSync(store, "course-1", [makeEvent()], "t1");
    applyCourseSync(store, "course-1", [], "t2");
    applyCourseSync(store, "course-1", [], "t3");
    const changes = applyCourseSync(store, "course-1", [], "t4");

    expect(store.assignments["course-1:uid-1"]).toBeUndefined();
    expect(changes.some((c) => c.kind === "archived")).toBe(true);
  });

  it("only reconciles items belonging to the course being synced", () => {
    const store = emptyStore();
    applyCourseSync(store, "course-1", [makeEvent()], "t1");
    applyCourseSync(
      store,
      "course-2",
      [makeEvent({ stableId: "course-2:uid-2", courseId: "course-2", uid: "uid-2" })],
      "t2",
    );
    // course-1's item must be untouched by a course-2 sync pass.
    expect(store.assignments["course-1:uid-1"]?.missingStreak).toBe(0);
  });
});
