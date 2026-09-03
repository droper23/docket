import assert from "node:assert/strict";
import { test } from "node:test";
import { daysBetween, todayInSchoolTimeZone } from "../src/core/schoolTime.js";

test("daysBetween: same date is 0, tomorrow is 1, yesterday is -1", () => {
  assert.equal(daysBetween("2026-09-02", "2026-09-02"), 0);
  assert.equal(daysBetween("2026-09-02", "2026-09-03"), 1);
  assert.equal(daysBetween("2026-09-02", "2026-09-01"), -1);
});

test("daysBetween: correct across a month boundary", () => {
  assert.equal(daysBetween("2026-09-30", "2026-10-01"), 1);
  assert.equal(daysBetween("2026-08-31", "2026-09-02"), 2);
});

test("daysBetween: correct across a year boundary", () => {
  assert.equal(daysBetween("2026-12-31", "2027-01-01"), 1);
});

test(
  "regression: daysBetween is unaffected by the server process's own timezone — " +
    "this is exactly the bug that made most assignments show up as \"due today\" once " +
    "deployed to a UTC server instead of the Mountain-Time dev machine it was built on",
  () => {
    const originalTZ = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const utcResult = daysBetween("2026-09-02", "2026-09-05");
      process.env.TZ = "America/Denver";
      const mountainResult = daysBetween("2026-09-02", "2026-09-05");
      // Node doesn't always respect a runtime TZ change without re-init of internal ICU
      // state on every platform, so this asserts the *contract* (pure calendar-date
      // arithmetic, no wall-clock "now" involved) rather than relying on the env var
      // flip actually taking effect on every CI environment.
      assert.equal(utcResult, 3);
      assert.equal(mountainResult, 3);
    } finally {
      if (originalTZ === undefined) delete process.env.TZ;
      else process.env.TZ = originalTZ;
    }
  },
);

test("todayInSchoolTimeZone returns a well-formed YYYY-MM-DD string", () => {
  assert.match(todayInSchoolTimeZone(), /^\d{4}-\d{2}-\d{2}$/);
});
