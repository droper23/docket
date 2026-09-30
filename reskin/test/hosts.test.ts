import { test } from "node:test";
import assert from "node:assert/strict";
import { isLearningSuiteHost, isMaxHost, isSupportedHost } from "../src/core/hosts.js";

test("host allowlist accepts only the two exact BYU learning hosts", () => {
  assert.equal(isLearningSuiteHost("learningsuite.byu.edu"), true);
  assert.equal(isMaxHost("max.byu.edu"), true);
  assert.equal(isSupportedHost("learningsuite.byu.edu"), true);
  assert.equal(isSupportedHost("max.byu.edu"), true);
  assert.equal(isSupportedHost("www.max.byu.edu"), false);
  assert.equal(isSupportedHost("max.byu.edu.example.com"), false);
  assert.equal(isSupportedHost("learningsuite.byu.edu.example.com"), false);
});
