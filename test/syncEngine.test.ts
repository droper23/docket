import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcile } from "../src/core/syncEngine.js";
import type { SyncRecord } from "../src/core/types.js";

interface Item {
  id: string;
  val: string;
}

const hash = (i: Item) => i.val;
const describeChange = (before: Item, after: Item) => ({ kind: "due_date_changed" as const, detail: `${before.val} -> ${after.val}` });

test("unseen item is created and logged", () => {
  const result = reconcile<Item>({
    entityType: "assignment",
    source: "test",
    incoming: [{ id: "a1", val: "x" }],
    existingRecords: [],
    existingSyncRecords: [],
    hash,
    describeChange,
  });
  assert.equal(result.mergedRecords.length, 1);
  assert.equal(result.syncRecords.length, 1);
  assert.equal(result.syncRecords[0]!.status, "active");
  assert.equal(result.newChangeLogEntries.length, 1);
  assert.equal(result.newChangeLogEntries[0]!.kind, "created");
});

test("unchanged item produces no change log entry and resets missingPasses", () => {
  const existingSync: SyncRecord[] = [
    {
      stableId: "a1",
      entityType: "assignment",
      source: "test",
      contentHash: "x",
      firstSeenAt: "t0",
      lastSeenAt: "t0",
      lastUpdatedAt: "t0",
      missingPasses: 1,
      status: "active",
    },
  ];
  const result = reconcile<Item>({
    entityType: "assignment",
    source: "test",
    incoming: [{ id: "a1", val: "x" }],
    existingRecords: [{ id: "a1", val: "x" }],
    existingSyncRecords: existingSync,
    hash,
    describeChange,
  });
  assert.equal(result.newChangeLogEntries.length, 0);
  assert.equal(result.syncRecords[0]!.missingPasses, 0);
});

test("changed item updates in place (no duplicate record) and logs one change", () => {
  const existingSync: SyncRecord[] = [
    {
      stableId: "a1",
      entityType: "assignment",
      source: "test",
      contentHash: "x",
      firstSeenAt: "t0",
      lastSeenAt: "t0",
      lastUpdatedAt: "t0",
      missingPasses: 0,
      status: "active",
    },
  ];
  const result = reconcile<Item>({
    entityType: "assignment",
    source: "test",
    incoming: [{ id: "a1", val: "y" }],
    existingRecords: [{ id: "a1", val: "x" }],
    existingSyncRecords: existingSync,
    hash,
    describeChange,
  });
  assert.equal(result.mergedRecords.length, 1);
  assert.equal(result.mergedRecords[0]!.val, "y");
  assert.equal(result.syncRecords.length, 1); // updated, not duplicated
  assert.equal(result.newChangeLogEntries.length, 1);
  assert.equal(result.newChangeLogEntries[0]!.detail, "x -> y");
});

test("missing item is not archived on first absence (avoids false-negative deletion)", () => {
  const existingSync: SyncRecord[] = [
    {
      stableId: "a1",
      entityType: "assignment",
      source: "test",
      contentHash: "x",
      firstSeenAt: "t0",
      lastSeenAt: "t0",
      lastUpdatedAt: "t0",
      missingPasses: 0,
      status: "active",
    },
  ];
  const result = reconcile<Item>({
    entityType: "assignment",
    source: "test",
    incoming: [],
    existingRecords: [{ id: "a1", val: "x" }],
    existingSyncRecords: existingSync,
    hash,
    describeChange,
  });
  assert.equal(result.syncRecords[0]!.status, "active");
  assert.equal(result.syncRecords[0]!.missingPasses, 1);
  assert.equal(result.newChangeLogEntries.length, 0);
});

test("item missing across the configured threshold of passes gets archived, not deleted", () => {
  let syncRecords: SyncRecord[] = [
    {
      stableId: "a1",
      entityType: "assignment",
      source: "test",
      contentHash: "x",
      firstSeenAt: "t0",
      lastSeenAt: "t0",
      lastUpdatedAt: "t0",
      missingPasses: 0,
      status: "active",
    },
  ];
  let records: Item[] = [{ id: "a1", val: "x" }];

  for (let pass = 0; pass < 3; pass++) {
    const result = reconcile<Item>({
      entityType: "assignment",
      source: "test",
      incoming: [],
      existingRecords: records,
      existingSyncRecords: syncRecords,
      hash,
      describeChange,
      missingPassesToArchive: 3,
    });
    syncRecords = result.syncRecords;
    records = result.mergedRecords;
    if (pass < 2) {
      assert.equal(syncRecords[0]!.status, "active", `should still be active after pass ${pass + 1}`);
    } else {
      assert.equal(syncRecords[0]!.status, "archived");
      assert.equal(result.newChangeLogEntries.some((c) => c.kind === "archived"), true);
    }
  }

  // Critically: the underlying record is preserved, never deleted.
  assert.equal(records.length, 1);
});

test("syncing multiple scopes (e.g. courses) in one pass never cross-contaminates missing-detection", () => {
  // Regression test for a real bug found against live data: syncing course A then
  // course B in the same run must not make course A's items look "missing" just
  // because course B's incoming list doesn't mention them.
  let syncRecords: SyncRecord[] = [];
  let records: Item[] = [];

  const syncCourse = (scope: string, incoming: Item[]) => {
    const result = reconcile<Item>({
      entityType: "assignment",
      source: "test",
      scope,
      incoming,
      existingRecords: records,
      existingSyncRecords: syncRecords,
      hash,
      describeChange,
    });
    syncRecords = result.syncRecords;
    records = result.mergedRecords;
    return result;
  };

  const courseA = [{ id: "A:1", val: "x" }, { id: "A:2", val: "x" }];
  const courseB = [{ id: "B:1", val: "x" }];

  const resultA = syncCourse("A", courseA);
  assert.equal(resultA.newChangeLogEntries.length, 2); // both created

  const resultB = syncCourse("B", courseB);
  // Course A's items must NOT show up as missing/archived just because this pass was scoped to course B.
  assert.equal(resultB.newChangeLogEntries.length, 1); // only B's item created
  const aRecords = syncRecords.filter((r) => r.scope === "A");
  assert.equal(aRecords.every((r) => r.status === "active" && r.missingPasses === 0), true);

  // Re-sync course A with the same data again — still no false missing/archive, no duplicates.
  const resultA2 = syncCourse("A", courseA);
  assert.equal(resultA2.newChangeLogEntries.length, 0);
  assert.equal(syncRecords.filter((r) => r.scope === "A").length, 2);
  assert.equal(syncRecords.every((r) => r.status === "active"), true);
});

test("running the same incoming data twice is idempotent (no duplicate records, no duplicate change entries)", () => {
  let syncRecords: SyncRecord[] = [];
  let records: Item[] = [];
  let totalChanges = 0;

  for (let pass = 0; pass < 5; pass++) {
    const result = reconcile<Item>({
      entityType: "assignment",
      source: "test",
      incoming: [{ id: "a1", val: "same" }],
      existingRecords: records,
      existingSyncRecords: syncRecords,
      hash,
      describeChange,
    });
    syncRecords = result.syncRecords;
    records = result.mergedRecords;
    totalChanges += result.newChangeLogEntries.length;
  }

  assert.equal(records.length, 1);
  assert.equal(syncRecords.length, 1);
  assert.equal(totalChanges, 1); // only the initial "created" — 4 subsequent no-ops
});
