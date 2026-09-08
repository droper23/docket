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
/**
 * Ordered by hue-distance dispersion (a farthest-point-first walk over the 12 hues' positions
 * on the color wheel), not just "no two entries share the exact same hex" — the previous order
 * guaranteed the latter but not the former. Confirmed live (Sep 2026, real 5-course account):
 * red (index 1, ~5° hue) and the old index-4 orange (~16° hue) are only ~11° apart — both
 * warm, similarly dark/saturated — and rendered close enough that both independent reviewers
 * had to sample pixels to be sure the real course-card top-edge rule wasn't reusing one color.
 * A hash-free, index-based assignment (see assignCourseColors() below) means WHICH hues land in
 * a typical student's small N is entirely a function of this array's order, not of the colors
 * themselves — reordering the same 12 hex values, greedily maximizing the minimum pairwise hue
 * distance among the first k for every k = 1..12, keeps every common course-load size (most
 * students have 4-8 courses) maximally spread without inventing new colors. The two closest
 * hues overall (index 10 orange ~16° and index 11 teal's near-duplicate, cyan at index 6 ~185°
 * vs. teal ~187°) fall out at the END of this order — only relevant once a student has 10+
 * concurrent enrollments, the one case a 12-color fixed palette can't fully avoid some
 * closeness in. Extend `test/components.test.ts`'s dispersion check before reordering this
 * array again.
 */
export const PALETTE = [
  "#0b57d0", // blue
  "#b3261e", // red
  "#146c2e", // green
  "#7b3ff2", // purple
  "#5c6b00", // olive
  "#a30059", // pink
  "#00696d", // cyan
  "#946200", // amber
  "#5b5fc7", // indigo
  "#8e4a00", // brown
  "#c4370a", // orange
  "#0e7c86", // teal
];

/**
 * Overrides are keyed by course CODE (e.g. "CS 142" — the same prefix courseListAdapter's own
 * `splitCodeTitle()` extracts and Settings > Course Colors lets a student pick), but not every
 * page's own extracted key is that short: gradeSummaryAdapter.ts passes its row's full,
 * unsplit "CODE - Title" anchor text. Stripping the same " - Title" suffix here (never
 * splitting on the first " " alone, which would butcher a multi-word code) lets one override
 * picked once in Settings apply on every page a course appears on, not just the one whose own
 * extraction happens to key by bare code.
 */
function codeKey(raw: string): string {
  const idx = raw.indexOf(" - ");
  return (idx >= 0 ? raw.slice(0, idx) : raw).trim();
}

export function assignCourseColors(codes: string[], overrides: Record<string, string> = {}): Map<string, string> {
  const sorted = [...new Set(codes)].sort();
  const map = new Map<string, string>();
  for (let i = 0; i < sorted.length; i++) {
    const code = sorted[i]!;
    map.set(code, overrides[codeKey(code)] || PALETTE[i % PALETTE.length]!);
  }
  return map;
}
