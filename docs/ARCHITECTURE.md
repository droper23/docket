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

## 8. Onboarding without a browser extension: the bookmarklet

Course discovery and grade/due-time enrichment both need to read an authenticated
LearningSuite page — and per §2, that can only ever happen inside a browser session a
human already opened, never a headless process. Before a packaged Safari Web Extension
exists (Phase 3), a **bookmarklet** is the lightest way to do that: one click, no install,
no code-signing, and — critically for a project other students will read the code of —
fully readable, auditable JavaScript (`src/connectors/bookmarklet.ts`, served from
`/connect`, linked directly from that page so nobody has to trust it blind).

Two bookmarklets exist:

- **Connect LearningSuite** — run on the Course List page. Reads course codes/titles and
  the `cid-...` course ID out of each course link's `href`, POSTs the result (a same-origin
  HTML form submission, not `fetch` — needs no CORS setup and can't silently exfiltrate
  anywhere but the exact origin baked into the button) to `/connect/learningsuite/import`,
  which writes `data/courses.config.json`. This is what replaced manually hunting down and
  typing in each course's ID.
- **Sync Grades & Due Times** — run on one course's Assignments page. Posts to
  `/connect/learningsuite/import-assignments`, handled by `applySessionEnrichment()`
  (`src/core/enrichment.ts`) — deliberately *not* run through the generic `reconcile()`
  engine, because this is a partial patch of a few fields onto records the ICS connector
  already owns, not "the complete authoritative listing from one source" that `reconcile()`
  assumes. It matches rows to existing assignments **by normalized title only** (no
  assignment ID is readable from this page without risking reading a session-bearing URL —
  see below) and skips — never guesses — a row with no match or an *ambiguous* match
  (two assignments sharing a title). This safety rule caught something real on the first
  live run: LearningSuite's own ICS export sometimes lists the same assignment twice under
  near-identical titles from separate calendar entries; both were correctly left
  unenriched rather than one being guessed at.

**Both extractors only ever read `.textContent` and, for the course list, one specific
`href` pattern** — never a full element/HTML dump. This isn't cosmetic: during this
project's own research, attempting to dump a table's outer HTML on an authenticated page
tripped a tooling safety filter for containing what looked like session/query-string data
(some links on that page embed the subsession-scoped URL). Reading only the specific text
needed, never a raw dump, avoids that class of accidental exposure entirely — a real
constraint the code is written around, not a hypothetical one.

**A second real gotcha, also found live, not hypothesized:** LearningSuite renders the
Assignments page differently depending on viewport width — full desktop width has every
category's rows already in the DOM, but a narrower window collapses categories into
click-to-expand accordions whose rows don't exist in the DOM until opened. A fixed
cell-index read (`row.children[4]`) also silently grabs the wrong text on one layout vs.
the other, since the two layouts split the same information across a different number of
cells. The extractor handles this by reading via regex over each row's full text (layout-
independent) and falling back to sequentially clicking each category open only if no rows
are found up front — see the comment above `assignmentsExtractorSource()` for the details
and the exact timing constant (450ms between clicks) that testing against the live page
required for the re-render to reliably complete before the next read.

## 9. Phone access

The dashboard is a plain server-rendered page (no framework, works in any browser,
responsive CSS down to phone width) — the only question is how a phone reaches a Node
process running on a laptop. The server binds `0.0.0.0` rather than `localhost` and prints
reachable addresses on startup, in priority order:

1. **Same Wi-Fi, the machine's own `.local` mDNS hostname** — zero setup, works in Safari
   with no install, the default instruction. Falls back to the raw LAN IP if mDNS doesn't
   resolve.
2. **Tailscale**, if installed — detected by asking the `tailscale` CLI directly for its
   own address (`tailscale ip -4`), never by guessing from an IP range. That distinction
   turned out to matter live: this project's own test network (BYU's campus Wi-Fi) hands
   out addresses from the *same* 100.64.0.0/10 CGNAT block Tailscale's virtual interface
   uses, so a naive "100.64–127.x.x = Tailscale" heuristic mislabeled an ordinary Wi-Fi
   address. Asking the CLI for its actual address sidesteps that instead of guessing.
   Presented as an optional fallback (most students won't have it installed), useful
   specifically because campus/eduroam-style networks often isolate devices from each
   other, breaking plan 1 even when both devices are on the same Wi-Fi.

Nothing here is exposed to the public internet — both paths are private-network-only by
construction (LAN scope or Tailscale's own private mesh), no port-forwarding involved.

## 10. Keeping data current without a human

Teachers add, move, and remove assignments continuously — the sync engine already handles
this correctly (§5), but only when something actually triggers a sync. `scripts/install-
launchd.sh` installs a macOS `launchd` user agent that runs `docket sync --source ics` on
an interval (default hourly) unattended. This is safe specifically *because* the ICS
connector needs no authentication (§2) — there is no session to keep alive, no credential
to refresh, nothing that requires a human present, so "run this forever in the background"
is a fundamentally different (and fine) proposition than it would be for anything touching
an authenticated session.

## 11. What's deliberately NOT built yet

- Completion status and announcements from the authenticated session — the Assignments
  page (§8) doesn't render completion state as readable text; that's the Prioritizer page,
  a documented next step, not guessed at here.
- A packaged Safari Web Extension (Phase 3) — the bookmarklet in §8 is the validated
  prototype of exactly this logic; promoting it is packaging work, not open questions.
- Apple Calendar / Reminders sync (EventKit) — Phase 4, needs completion status and a
  deadline-vs-work-session distinction first.
- Multi-device sync (CloudKit) — only justified once there's a native app; local-first
  JSON is correct for a single Mac today.
- Packaging/signing/distribution beyond what §10 already provides — Phase 5.

None of this is deferred out of laziness — each is blocked on either a human-in-the-loop
capture step (Duo) or on the layer below it being solid first, per the project's own
stated priority: "prefer maintainability over short-term implementation speed."
