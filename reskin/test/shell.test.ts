import { test } from "node:test";
import assert from "node:assert/strict";
import { pathMatchScore } from "../src/adapters/shell.js";

// Regression coverage for the Sep 2026 fix: the active-nav-item highlight used to be a
// one-directional `location.pathname.startsWith(href)` check, which missed the common case
// of landing on a section's shorter index route (e.g. "/student/home") when the matching
// sidebar link points at a longer default child ("/student/home/dashboard").

test("pathMatchScore: exact match scores highest and beats any prefix match", () => {
  const exact = pathMatchScore("/cid-1/student/home", "/cid-1/student/home");
  const prefix = pathMatchScore("/cid-1/student/home", "/cid-1/student");
  assert.ok(exact > prefix);
  assert.ok(exact >= 0);
});

test("pathMatchScore: current path longer than link href (existing case) still matches", () => {
  const score = pathMatchScore("/cid-1/student/home/dashboard", "/cid-1/student/home");
  assert.ok(score >= 0);
});

test("pathMatchScore: current path shorter than link href (index-route case) now matches", () => {
  // The bug this fix closes: landing on "/student/home" with the "Dashboard" link pointing
  // at "/student/home/dashboard" must resolve to a real match, not -1.
  const score = pathMatchScore("/cid-1/student/home", "/cid-1/student/home/dashboard");
  assert.ok(score >= 0);
});

test("pathMatchScore: never matches on a raw substring across a path-segment boundary", () => {
  assert.equal(pathMatchScore("/cid-1/student/homework", "/cid-1/student/home"), -1);
  assert.equal(pathMatchScore("/cid-1/student/home", "/cid-1/student/homework"), -1);
});

test("pathMatchScore: picks the single most specific match among several candidates", () => {
  const current = "/cid-1/student/home";
  const candidates = [
    { label: "Home", href: "/cid-1/student/home" },
    { label: "Dashboard", href: "/cid-1/student/home/dashboard" },
    { label: "Unrelated", href: "/cid-1/student/gradebook" },
  ];
  const scored = candidates.map((c) => ({ ...c, score: pathMatchScore(current, c.href) }));
  const best = scored.reduce((a, b) => (b.score > a.score ? b : a));
  assert.equal(best.label, "Home", "the exact match must win over the longer descendant match");
  assert.equal(scored.find((c) => c.label === "Unrelated")!.score, -1);
});
