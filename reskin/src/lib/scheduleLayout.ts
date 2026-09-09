/**
 * The course Schedule Table view is a CSS grid, not a `<table>` (confirmed
 * live Sep 2026). At phone width its inline `128px 1fr 1fr` template leaves
 * each content column about 120px wide. Mark its real, repeated three-cell
 * rows so schedule.css can reflow the existing native cells without reading,
 * replacing, or changing any assignment/calendar control.
 */
export function markScheduleTableGrids(main: Element): void {
  for (const grid of Array.from(main.querySelectorAll(".bg-base.p-1.pt-4 > .grid"))) {
    const cells = Array.from(grid.children) as HTMLElement[];
    const headings = cells.slice(0, 3).map((cell) => cell.textContent?.replace(/\s+/g, " ").trim());
    if (headings.join("|") === "Date|Column 1|Column 2") {
      grid.setAttribute("data-docket-schedule-header", "true");
      continue;
    }
    if (cells.length < 3 || cells.length % 3 !== 0) continue;
    grid.setAttribute("data-docket-schedule-reflow", "true");
    cells.forEach((cell, index) => {
      cell.setAttribute("data-docket-schedule-cell", index % 3 === 0 ? "date" : index % 3 === 1 ? "primary" : "secondary");
      // In the native Table view an em dash is the literal empty-column placeholder. It has no
      // associated action or content, so the phone reflow may hide it without concealing data.
      const text = cell.textContent?.replace(/\s+/g, " ").trim();
      if (text === "—") cell.setAttribute("data-docket-schedule-empty", "true");
      else cell.removeAttribute("data-docket-schedule-empty");
    });
  }
}
