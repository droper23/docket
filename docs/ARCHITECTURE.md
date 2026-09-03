# Docket — Architecture

Docket is a privacy-first productivity layer on top of BYU LearningSuite. LearningSuite
remains the source of truth for courses, assignments, due dates, and grades; Docket is
the interface students actually want to use to answer "what do I need to do today?"

This document is Phase 0 of the project: the architecture decisions, the rationale behind
them, and the contracts the rest of the code is built against. See [`ROADMAP.md`](./ROADMAP.md)
for what's built vs. planned, and [`THREAT_MODEL.md`](./THREAT_MODEL.md) for the security
analysis.

The verified technical research behind every claim in this document (LearningSuite's auth
architecture, the `ajax.php` RPC shape, the ICS feed, prior art) lives in
[`../learningsuite-handoff.md`](../learningsuite-handoff.md) — that document is the primary
source; this one is the resulting product architecture.

## Why "Docket"

A docket is literally an agenda — the list of things that need handling today. That's the
whole product in one word, and it doesn't carry LearningSuite's or BYU's branding (this is
an unofficial, unaffiliated student tool — no trademark claims, no implied endorsement).

## 1. The core architectural bet: hybrid, two connectors, one local data layer

```
LearningSuite (source of truth)
   │                                    │
   │ ICS feed, no auth, scheduled       │ live browser session, opportunistic
   ▼                                    ▼
IcsConnector                       LearningSuiteSessionConnector
(unattended, runs anywhere)        (Safari Web Extension, Phase 2+)
   │                                    │
   └──────────────┬─────────────────────┘
                   ▼
         LearningPlatformConnector interface
                   │
                   ▼
         Local data layer (AcademicSnapshot, on-device JSON)
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
     Today     Upcoming    Workload / Diagnostics / What Changed
```

**Why two connectors instead of one:**
- The ICS feed alone is insufficient: all-day events only (no due *time*), no grades, no
  points, no completion status, no announcements — those simply aren't in a course
  schedule feed.
- A browser extension alone is insufficient: it only sees data while the student is
  actually on LearningSuite — no baseline coverage on days they don't open it.
- Together: the feed is the reliable, zero-maintenance backbone; the extension (Phase 2+)
  is opportunistic enrichment on top of it. Neither has to solve the other's problem.

**Why this beats the alternatives** (full comparison in the handoff doc):
- A **web app with its own backend** that logs into LearningSuite server-side was
  rejected: it would need to hold the user's session/credentials outside the browser they
  authenticated in, hits Duo, and moves academic data off-device.
- A **native app doing its own login** hits the same Duo wall unless it's just a WebView
  on CAS — which is the extension approach, minus the daily-use advantage of already
  running inside the browser the student uses anyway.
- A **background daemon holding a stored session cookie** was rejected: cookies expire,
  unattended re-auth isn't realistically automatable without secret storage, and a
  silently-failing poller is exactly the fragile-scraper failure mode this project exists
  to avoid.

## 2. Authentication — the constraint that shapes everything

BYU CAS federates through Okta with Duo two-step verification enforced. There is no OAuth
token exposed to the frontend; auth resolves to a server-side session referenced only by
an opaque `subsessionID`. **There is no way to complete this login headlessly.** Any
design that needs unattended re-authentication is the wrong shape, full stop.

Docket's rule: **observe a session the human already opened, never simulate the login
itself.** This is why the ICS connector needs no auth at all, and why the future
authenticated connector is a browser extension riding along on the student's own login,
not a service that logs in on their behalf.

## 3. The connector abstraction

```ts
interface LearningPlatformConnector {
  readonly id: string;
  readonly capabilities: readonly ConnectorCapability[];
  getCourses(): Promise<ConnectorResult<CourseRecord[]>>;
  getAssignments(courseId: string): Promise<ConnectorResult<AssignmentRecord[]>>;
  getAnnouncements(courseId: string): Promise<ConnectorResult<AnnouncementRecord[]>>;
}
```

(`src/connectors/types.ts`) Every call returns a `ConnectorResult<T>` — `{ok:true,
data}` or `{ok:false, error}` — never throws for an expected failure. Nothing outside
`src/connectors/` knows LearningSuite's URL patterns, the `ajax.php` RPC shape, or any DOM
structure. Three implementations exist today:

- **`IcsConnector`** (`src/connectors/icsConnector.ts`) — real, working, verified against
  the user's actual Fall 2026 LearningSuite account (5 courses, 457 real assignments,
  zero auth). Covers `courses`, `assignments`, `schedule`.
- **`DemoConnector`** (`src/connectors/demoConnector.ts`) — fully synthetic fixture data
  spanning unrelated departments, so the app runs end-to-end with no LearningSuite account
  at all (development, screenshots, evaluating the project before connecting a real
  account).
- **`LearningSuiteSessionConnector`** (`src/connectors/learningSuiteSessionConnector.ts`)
  — an interface-conformant **skeleton**, not yet implemented. This is the Phase 2+ piece
  (grades, exact due time, completion status, announcements) that has to run inside a
  browser extension against a live session. It fails soft with `not_implemented` rather
  than fabricate a response shape that was never actually captured — see
  `ROADMAP.md` Phase 2 for why.

Because the rest of the app only depends on this interface, a connector for a different
school's LMS is a new file, not a rewrite.

## 4. Data ownership — never blur real vs. invented

Every field that could be confused with LearningSuite fact is wrapped:

```ts
interface Field<T> {
  value: T;
  provenance: "real" | "derived" | "manual";
  source: string;
  capturedAt: string;
}
```

| Entity.Field | Provenance | Why |
|---|---|---|
| `Course.code`, `Course.title` | real | from the student's own course list |
| `Assignment.title`, `dueDate` | real | LearningSuite ICS feed / session |
| `Assignment.dueTime` | real | authenticated connector only — never in the ICS feed |
| `Assignment.pointsEarned`, `completionStatus` | real | authenticated connector only |
| `Assignment.type` | **derived** | title-keyword heuristic — LearningSuite's ICS export doesn't tag a type at all |
| `estimatedMinutes`, `priorityScore` | derived | Docket's guess, always labeled "estimate" in the UI, user-overridable |
| `notes`, `subtasks` | manual | LearningSuite has no equivalent field |

This distinction is load-bearing, not decorative: the dashboard renders a visible
"estimate" badge on derived time, and the provenance table above is the contract every
new field must be added under.

## 5. Stable identifiers & sync semantics

Stable ID reuses LearningSuite's own opaque IDs — confirmed present in the `ajax.php` RPC
call shape (`funcParams[courseID]`, `funcParams[assignmentID]`) — never a fabricated or
title-derived ID: `${courseId}:${assignmentId}`.

The sync engine (`src/core/syncEngine.ts`, `reconcile()`) is a pure function, unaware of
LearningSuite or ICS, implementing exactly:

1. **Unseen stable ID** → create.
2. **Known, hash unchanged** → no-op (bump `lastSeenAt`, reset missing counter).
3. **Known, hash changed** → update the *existing* record in place, log one change entry.
4. **Known, absent this pass** → do not delete. Increment a missing-pass counter; only
   archive after `missingPassesToArchive` (default 3) *consecutive* absences, scoped
   strictly to the same course — see the note below.

**A real bug found and fixed during this build:** the first version scoped "missing"
detection only by entity type + source, not by course. Syncing five courses in one run
caused course A's just-synced assignments to look "missing" during course B's pass
(different incoming list, same entity type/source), and by course 4 or 5 they'd cross the
archive threshold *within a single sync run* — verified against the live account, where it
incorrectly archived 297 of 457 real assignments on the very first sync. Fixed by adding an
explicit `scope` (the courseId) to `SyncRecord` and requiring an exact scope match before a
record can be considered missing. Regression test:
`test/syncEngine.test.ts` → *"syncing multiple scopes in one pass never
cross-contaminates missing-detection."* This is exactly the kind of bug that never shows up
against a one-course demo fixture and only appears against real multi-course data — a
concrete argument for always validating against the live account, not just synthetic
fixtures.

## 6. Local-first storage

One JSON file (`data/snapshot.json`), written atomically (temp file + rename) so a crash
mid-write can never corrupt the store — see `src/core/store.ts`. A read failure that isn't
a plain "file doesn't exist" throws loudly rather than silently resetting the user's data.
No SQLite, no IndexedDB, no cloud database for a single-user local tool at this scale — see
`ROADMAP.md` for when that calculus changes (multi-device sync).

## 7. Failure philosophy: stale is better than wrong

If a course's fetch fails, that course's *existing* data is left untouched and the sync
outcome reports it as a per-course failure — never treated as "everything was deleted."
`SyncOutcome.coursesFailed` surfaces this to the CLI/diagnostics without corrupting state.
See `docs/THREAT_MODEL.md` for the corresponding "malformed source data" threat entry.

## 8. What's deliberately NOT built yet

- The authenticated session connector (grades, due time, completion, announcements) —
  needs a human with a live session running the Phase 2 userscript prototype to safely
  capture real DOM/response shapes; see `ROADMAP.md`.
- Apple Calendar / Reminders sync (EventKit) — Phase 4, needs the enrichment data above
  first (deadline vs. work-session distinction, idempotent mapping table).
- Multi-device sync (CloudKit) — only justified once there's a native app; local-first
  JSON is correct for a single Mac today.
- Packaging/signing/distribution — Phase 5.

None of this is deferred out of laziness — each is blocked on either a human-in-the-loop
capture step (Duo) or on the layer below it being solid first, per the project's own
stated priority: "prefer maintainability over short-term implementation speed."
