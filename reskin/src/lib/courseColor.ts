/**
 * Deterministic, collision-free course accent colors — replaces courseCard.ts's old
 * `accentForCourse()`, which hashed a single course code into a 7-color palette (`hash % 7`).
 * With a real 5-course load that collided often (confirmed in the pass-10 screenshots: two
 * different courses rendered the identical yellow dot), and being a pure per-code hash it was
 * never called by gradeSummaryAdapter.ts at all, so a course's color identity disagreed
 * between Course List/Home and Grade Summary even where one existed.
 *
 * Assigns by SORTED INDEX into a fixed palette, not a hash — colors never collide up to the
 * palette size, and stay stable across reloads because the ordering is derived from the real
 * enrolled code strings themselves, never DOM order. Every adapter that wants a course color
 * must call this against the same extracted code list so a course reads as the same color on
 * every page.
 */
const PALETTE = [
  "#0b57d0", // blue
  "#b3261e", // red
  "#146c2e", // green
  "#7b3ff2", // purple
  "#c4370a", // orange
  "#0e7c86", // teal
  "#946200", // amber
  "#a30059", // pink
  "#5b5fc7", // indigo
  "#5c6b00", // olive
  "#8e4a00", // brown
  "#00696d", // cyan
];

export function assignCourseColors(codes: string[]): Map<string, string> {
  const sorted = [...new Set(codes)].sort();
  const map = new Map<string, string>();
  for (let i = 0; i < sorted.length; i++) {
    map.set(sorted[i]!, PALETTE[i % PALETTE.length]!);
  }
  return map;
}
