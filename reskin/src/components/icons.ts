import { svgIcon } from "../lib/dom.js";

/**
 * Simple SF-Symbols-style outline glyphs (thin stroke, rounded joins) — not the licensed
 * SF Symbols font itself, just its visual idiom. The nav-item set below is matched purely
 * by a real link's own `textContent` in shell.ts's restyleNav() — decorative only, never a
 * fabricated destination — with a graceful no-icon fallback for anything unmatched.
 */
export const icons = {
  gear: () =>
    svgIcon(
      "M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM4 12a8 8 0 01.3-2.2L2.6 8.4l1.5-2.6 2 .8a8 8 0 013.8-2.2l.3-2.1h3l.3 2.1a8 8 0 013.8 2.2l2-.8 1.5 2.6-1.7 1.4A8 8 0 0120 12a8 8 0 01-.3 2.2l1.7 1.4-1.5 2.6-2-.8a8 8 0 01-3.8 2.2l-.3 2.1h-3l-.3-2.1a8 8 0 01-3.8-2.2l-2 .8-1.5-2.6 1.7-1.4A8 8 0 014 12z",
    ),
  checklist: () => svgIcon("M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11"),
  close: () => svgIcon("M6 6l12 12M18 6L6 18"),

  dashboard: () => svgIcon("M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"),
  bell: () => svgIcon("M12 3a4 4 0 00-4 4v3c0 1.5-.6 2.6-1.6 3.6a.5.5 0 00.35.85h10.5a.5.5 0 00.35-.85C16.6 12.6 16 11.5 16 10V7a4 4 0 00-4-4zM9.5 18.5a2.5 2.5 0 005 0"),
  target: () =>
    svgIcon(
      "M4,12 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 M8,12 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0 M11,12 a1,1 0 1,0 2,0 a1,1 0 1,0 -2,0",
    ),
  envelope: () => svgIcon("M4 6h16v12H4zM4 6.5l8 6.5 8-6.5"),
  book: () => svgIcon("M12 6c-2-1.3-5-1.3-8 0v13c3-1.3 6-1.3 8 0c2-1.3 5-1.3 8 0V6c-3-1.3-6-1.3-8 0zM12 6v13"),
  people: () =>
    svgIcon(
      "M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 2.7-5 6-5s6 2 6 5M13.5 15.2c2.4.3 4.5 2.3 4.5 4.8h4c0-2.7-1.8-4.7-4-5.2",
    ),
  infoCircle: () => svgIcon("M4,12 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 M12 8v.01 M12 11v5"),
  grid: () => svgIcon("M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"),
  calendar: () => svgIcon("M4 5h16v15H4zM4 9.5h16M8 3v4M16 3v4"),
  flag: () => svgIcon("M6 3v18M6 4h11l-3 4 3 4H6z"),
  barChart: () => svgIcon("M5 20V10M11 20V4M17 20v-7"),
  copyright: () => svgIcon("M4,12 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0 M14.8 9.7a3.2 3.2 0 100 4.6"),
  ruler: () => svgIcon("M4 12h16M4 8v8M9 10v4M14 8v8M19 10v4"),
  calculator: () => svgIcon("M6 3h12v18H6zM8 6h8v3H8zM8.5 12.5h1M12 12.5h1M15.5 12.5h1M8.5 15.5h1M12 15.5h1M15.5 15.5h1M8.5 18.5h1M12 18.5h1M15.5 18.5h1"),
  home: () => svgIcon("M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"),
  document: () => svgIcon("M6 3h9l5 5v13H6zM14 3v5h5"),
  examDoc: () => svgIcon("M6 3h9l5 5v13H6zM14 3v5h5M9 14l2 2 4-4"),
};

/**
 * Real nav-item labels confirmed live (Sep 2026) across the sidebar, its Grades sub-nav,
 * and the top tab strip. Matched on a link's exact trimmed `textContent` in
 * adapters/shell.ts — several distinct destinations reuse the same icon on purpose where
 * they're the same real-world concept (e.g. "Schedule" and "Combined Schedule" both get the
 * calendar glyph); anything not in this table gets no icon at all rather than a guessed one.
 */
export const navIconByLabel: Record<string, keyof typeof icons> = {
  Dashboard: "dashboard",
  Home: "home",
  Announcements: "bell",
  Assignments: "checklist",
  "Learning Outcomes": "target",
  Email: "envelope",
  "Library Resources": "book",
  Groups: "people",
  "Class Info": "infoCircle",
  "Course List": "grid",
  "All Courses": "grid",
  "Combined Schedule": "calendar",
  Schedule: "calendar",
  Prioritizer: "flag",
  "Grade Summary": "barChart",
  Grades: "barChart",
  "Grade Scale": "ruler",
  "What If Calculator": "calculator",
  "Copyright Resources": "copyright",
  Content: "document",
  Exams: "examDoc",
  Syllabus: "book",
};
