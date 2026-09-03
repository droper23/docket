import type { Course } from "./types.js";

/**
 * Your enrolled courses for Fall 2026, with LearningSuite's real course ids
 * (pulled from the "Get iCalendar Feed" link on each course's Schedule tab —
 * see learningsuite-handoff.md §1.4). Edit this file each semester.
 */
export const COURSES: Course[] = [
  { courseId: "wKe8p3wBxgcU", code: "MATH 113", title: "Calculus 2" },
  { courseId: "9R_ouvfPP1_r", code: "DANCE 280", title: "Social Dance, Technique 1" },
  { courseId: "Kkcc7zi3RXcJ", code: "EC EN 224", title: "Introduction to Computer Systems" },
  { courseId: "meOTckV8t7qV", code: "EC EN 225", title: "Computer Systems Lab" },
  { courseId: "FTth2KYoz9cP", code: "REL C 200", title: "The Eternal Family" },
];

export function icalFeedUrl(courseId: string): string {
  return `https://learningsuite.byu.edu/iCalFeed/ical.php?courseID=${encodeURIComponent(courseId)}`;
}
