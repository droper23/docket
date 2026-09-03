/**
 * Stable identifiers reuse LearningSuite's own opaque IDs wherever possible
 * (see docs/ARCHITECTURE.md §Stable IDs — confirmed present in the ajax.php
 * RPC call shape during prior research). Never derive an ID from a title —
 * titles change, get renamed, or collide across courses.
 */
export function assignmentStableId(courseId: string, assignmentId: string): string {
  return `${courseId}:${assignmentId}`;
}

export function announcementStableId(courseId: string, announcementId: string): string {
  return `${courseId}:announcement:${announcementId}`;
}
