import assert from "node:assert/strict";
import { test } from "node:test";
import { validateScheduleItems } from "../src/server/handler.js";

test(
  "regression: validateScheduleItems skips one malformed item instead of aborting the whole " +
    "batch — a real production case: a Combined Schedule item's title comes straight off a " +
    "calendar SUMMARY field, and one real instructor's full weekly-reading text ran to 430 " +
    "characters, well past the field limit sized for a normal assignment name. The bug wasn't " +
    "just that one item being rejected — it threw and discarded every other well-formed item " +
    "in the same request, so a real sync run saved nothing at all with no visible sign why.",
  () => {
    const items = [
      { courseId: "c1", title: "Trig HW 2", description: "some detail" },
      { courseId: "c1", title: "x".repeat(1500) }, // past even the raised MAX_SCHEDULE_TITLE_LEN
      { courseId: "c1", title: "Intro to Linux Shell" },
    ];
    const { byCourse, skipped } = validateScheduleItems(items);
    assert.equal(skipped, 1, "exactly the one over-long item should be skipped");
    assert.equal(byCourse.get("c1")?.length, 2, "the two well-formed items must still be saved, not discarded along with the bad one");
  },
);

test(
  "validateScheduleItems accepts a long title well past the old 200-char limit — confirmed " +
    "real production data (a 430-character instructor reading assignment) that used to be " +
    "rejected outright",
  () => {
    const longTitle = "Wk 1 (9/3-9/15) ".repeat(30).trim(); // > 200 chars, well under the new limit
    const { byCourse, skipped } = validateScheduleItems([{ courseId: "c1", title: longTitle }]);
    assert.equal(skipped, 0);
    assert.equal(byCourse.get("c1")?.[0]?.title, longTitle);
  },
);
