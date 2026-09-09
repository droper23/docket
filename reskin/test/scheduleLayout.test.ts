import { test } from "node:test";
import assert from "node:assert/strict";
import { setupDom } from "./testUtil.js";
import { markScheduleTableGrids } from "../src/lib/scheduleLayout.js";

test("markScheduleTableGrids marks the native Schedule column header separately", () => {
  setupDom(`<main><div class="bg-base p-1 pt-4"><div class="grid">
    <div>Date</div><div>Column 1</div><div>Column 2</div>
  </div></div></main>`);
  const main = document.querySelector("main")!;
  markScheduleTableGrids(main);
  assert.equal(main.querySelector(".grid")?.getAttribute("data-docket-schedule-header"), "true");
  assert.equal(main.querySelector("[data-docket-schedule-cell]"), null);
});

test("markScheduleTableGrids labels every real Date / Column 1 / Column 2 trio without altering content", () => {
  setupDom(`<main><div class="bg-base p-1 pt-4"><div class="grid">
    <div>Mon, Sep 7</div><div>Labor Day</div><div>—</div>
    <div>Tue, Sep 8</div><div>Quiz</div><div>Devotional</div>
  </div></div></main>`);
  const main = document.querySelector("main")!;
  markScheduleTableGrids(main);
  const cells = Array.from(main.querySelectorAll(".grid > div"));
  assert.deepEqual(cells.map((cell) => cell.getAttribute("data-docket-schedule-cell")), ["date", "primary", "secondary", "date", "primary", "secondary"]);
  assert.equal(cells[2]!.getAttribute("data-docket-schedule-empty"), "true");
  assert.equal(cells[5]!.hasAttribute("data-docket-schedule-empty"), false);
  assert.equal(cells[4]!.textContent, "Quiz");
});

test("markScheduleTableGrids ignores a non-tabular grid instead of guessing", () => {
  setupDom(`<main><div class="bg-base p-1 pt-4"><div class="grid"><div>One</div><div>Two</div></div></div></main>`);
  const main = document.querySelector("main")!;
  markScheduleTableGrids(main);
  assert.equal(main.querySelector(".grid")?.hasAttribute("data-docket-schedule-reflow"), false);
});
