import { randomUUID } from "node:crypto";
import type { ChangeKind, ChangeLogEntry, SyncRecord } from "./types.js";

export interface ReconcileInput<T extends { id: string }> {
  entityType: SyncRecord["entityType"];
  source: string;
  /**
   * What one pass actually covers, e.g. a courseId. Required whenever a
   * connector is queried per-course (assignments, announcements) — without
   * it, "absent from this pass" can't be told apart from "belongs to a
   * different course that just hasn't been synced in this loop iteration
   * yet." Omit only when the connector returns everything it knows about
   * this entity type in a single call (e.g. the course list itself).
   */
  scope?: string;
  /** What the connector returned this pass, for `scope`. */
  incoming: T[];
  /** Everything currently stored for this entity type, across all scopes. */
  existingRecords: T[];
  existingSyncRecords: SyncRecord[];
  hash: (item: T) => string;
  /** Only called when a previously-seen record's hash changed. Returning undefined = don't log a change entry. */
  describeChange: (before: T, after: T) => { kind: ChangeKind; detail: string } | undefined;
  now?: string;
  /** consecutive missing passes before a record is archived (never deleted) */
  missingPassesToArchive?: number;
}

export interface ReconcileResult<T> {
  mergedRecords: T[];
  syncRecords: SyncRecord[];
  newChangeLogEntries: ChangeLogEntry[];
}

/**
 * The one place "did this actually change, and what do we do about it" is
 * decided. Implements docs/ARCHITECTURE.md §Sync Semantics exactly:
 *   1. unseen stableId       -> create
 *   2. known, hash unchanged -> no-op
 *   3. known, hash changed   -> update in place, log the change
 *   4. known, now absent     -> mark missing; only archive after N consecutive passes
 * This function is pure and connector-agnostic — it doesn't know about
 * LearningSuite, ICS, or ajax.php. Feed it any T with a stable `id`.
 */
export function reconcile<T extends { id: string }>(input: ReconcileInput<T>): ReconcileResult<T> {
  const now = input.now ?? new Date().toISOString();
  const missingThreshold = input.missingPassesToArchive ?? 3;

  const incomingById = new Map(input.incoming.map((r) => [r.id, r]));
  const existingRecordById = new Map(input.existingRecords.map((r) => [r.id, r]));

  const mergedRecordById = new Map(existingRecordById);
  const nextSyncRecordById = new Map(input.existingSyncRecords.map((r) => [r.stableId, r]));
  const changeLog: ChangeLogEntry[] = [];

  for (const item of input.incoming) {
    const hash = input.hash(item);
    const existingSync = nextSyncRecordById.get(item.id);

    if (!existingSync) {
      // Case 1: unseen -> create
      nextSyncRecordById.set(item.id, {
        stableId: item.id,
        entityType: input.entityType,
        source: input.source,
        scope: input.scope,
        contentHash: hash,
        firstSeenAt: now,
        lastSeenAt: now,
        lastUpdatedAt: now,
        missingPasses: 0,
        status: "active",
      });
      mergedRecordById.set(item.id, item);
      changeLog.push({
        id: randomUUID(),
        stableId: item.id,
        kind: "created",
        detail: input.describeChange(item, item)?.detail ?? "New item discovered",
        occurredAt: now,
      });
      continue;
    }

    if (existingSync.contentHash === hash) {
      // Case 2: unchanged -> no-op (just bump lastSeenAt, reset missing counter)
      nextSyncRecordById.set(item.id, { ...existingSync, lastSeenAt: now, missingPasses: 0, status: "active" });
      mergedRecordById.set(item.id, item);
      continue;
    }

    // Case 3: changed -> update in place, log it
    const before = existingRecordById.get(item.id);
    nextSyncRecordById.set(item.id, {
      ...existingSync,
      contentHash: hash,
      lastSeenAt: now,
      lastUpdatedAt: now,
      missingPasses: 0,
      status: "active",
    });
    mergedRecordById.set(item.id, item);
    if (before) {
      const change = input.describeChange(before, item);
      if (change) {
        changeLog.push({ id: randomUUID(), stableId: item.id, kind: change.kind, detail: change.detail, occurredAt: now });
      }
    }
  }

  // Case 4: known-but-absent-this-pass. Strictly scoped to entityType + source + scope —
  // a pass over one course's assignments must never mark another course's assignments
  // missing just because this loop iteration didn't happen to mention them.
  for (const sr of input.existingSyncRecords) {
    if (sr.entityType !== input.entityType || sr.source !== input.source) continue;
    if (sr.scope !== input.scope) continue;
    if (incomingById.has(sr.stableId)) continue;
    if (sr.status === "archived") continue;

    const missingPasses = sr.missingPasses + 1;
    if (missingPasses >= missingThreshold) {
      nextSyncRecordById.set(sr.stableId, { ...sr, missingPasses, status: "archived" });
      changeLog.push({ id: randomUUID(), stableId: sr.stableId, kind: "archived", detail: "No longer reported by source after repeated sync passes", occurredAt: now });
    } else {
      nextSyncRecordById.set(sr.stableId, { ...sr, missingPasses });
    }
  }

  return {
    mergedRecords: [...mergedRecordById.values()],
    syncRecords: [...nextSyncRecordById.values()],
    newChangeLogEntries: changeLog,
  };
}
