import type { AcademicSnapshot } from "./types.js";

export interface DiagnosticsReport {
  lastSyncAttemptAt?: string;
  lastSyncSuccessAt?: string;
  connectionHealthy: boolean;
  courseCount: number;
  activeAssignmentCount: number;
  archivedAssignmentCount: number;
  recentChangeCount: number;
  message: string;
}

/**
 * Human-readable connection/health summary — docs/ARCHITECTURE.md §Health &
 * Diagnostics. Never silently fails: if sync hasn't succeeded recently, say
 * so plainly and note that existing data is still intact.
 */
export function computeDiagnostics(snapshot: AcademicSnapshot): DiagnosticsReport {
  const activeAssignments = snapshot.syncRecords.filter((r) => r.entityType === "assignment" && r.status === "active");
  const archivedAssignments = snapshot.syncRecords.filter((r) => r.entityType === "assignment" && r.status === "archived");

  const lastAttempt = snapshot.lastSyncAttemptAt ? new Date(snapshot.lastSyncAttemptAt) : undefined;
  const lastSuccess = snapshot.lastSyncSuccessAt ? new Date(snapshot.lastSyncSuccessAt) : undefined;

  const staleMs = lastAttempt && lastSuccess ? lastAttempt.getTime() - lastSuccess.getTime() : 0;
  const connectionHealthy = !lastAttempt || (!!lastSuccess && staleMs < 1000 * 60 * 60 * 24 * 3); // 3 days grace

  const message = connectionHealthy
    ? "Connected. Data is current as of the last sync."
    : "LearningSuite connection needs attention — recent syncs have not succeeded. Your existing data is safe and unchanged.";

  const recentChangeCount = snapshot.changeLog.filter((c) => {
    const age = Date.now() - new Date(c.occurredAt).getTime();
    return age < 1000 * 60 * 60 * 24; // last 24h
  }).length;

  return {
    lastSyncAttemptAt: snapshot.lastSyncAttemptAt,
    lastSyncSuccessAt: snapshot.lastSyncSuccessAt,
    connectionHealthy,
    courseCount: snapshot.courses.length,
    activeAssignmentCount: activeAssignments.length,
    archivedAssignmentCount: archivedAssignments.length,
    recentChangeCount,
    message,
  };
}
