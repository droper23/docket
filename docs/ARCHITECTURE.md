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

## 7.5. "Today" has to mean BYU's today, not the server's

Every "days until due" / "which day is this" computation goes through
`src/core/schoolTime.ts`, anchored to `America/Denver`, never a bare `new Date()`. This is a
real bug that shipped and was only caught by a user report ("almost all my assignments show
up as being due today"), not by testing: this project's own local dev machine happens to
already be set to Mountain Time, so a server-local `new Date()` was *correct by accident*
in every local check and every screenshot taken during development — and silently wrong the
moment it ran on Vercel, whose Node runtime defaults to UTC. Concretely, checking Docket in
the evening (Mountain Time, still "today" locally) could already be past midnight UTC on the
server — so a bare `new Date()` reported "tomorrow" as the current date, shifting the whole
day-difference calculation by one and clustering assignments from two different real due
dates into a single wrong bucket. `schoolTime.ts` fixes this two ways: `todayInSchoolTimeZone()`
gets "today" via `Intl.DateTimeFormat` with an explicit `timeZone`, never the runtime's
default, and `daysBetween()` does pure calendar-date arithmetic (both dates anchored to
synthetic UTC-midnight instants) rather than wall-clock-time subtraction, so there's no
fractional-day rounding surprise on top of the timezone fix. Hardcoding BYU's timezone
rather than trying to detect the viewer's own is deliberate, not a shortcut: a due date is
fixed by LearningSuite in Mountain Time regardless of what timezone a student happens to be
physically sitting in when they check.

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
  unenriched rather than one being guessed at. Beyond due time and points, this bookmarklet
  also clicks each row's title to open LearningSuite's own expandable detail panel — the
  same one a student sees clicking into an assignment — and captures the real grading
  **category** (e.g. "Programming Assignments", replacing the title-keyword `type` guess
  whenever available), the full **description**/instructions text, and any **external
  resource links** a teacher attached (an autograder URL, a scoreboard, etc.) — never a
  link back into LearningSuite itself, which would carry this session's own path-scoped
  identifier and isn't useful to store anyway. This is what lets the dashboard answer "what
  does this assignment actually want from me, and where's the submission link" without
  opening LearningSuite at all — the actual product goal (see §12 for the related question
  of telling real coursework apart from pure calendar markers in the same feed).

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

**Two more real gotchas, both found by actually running the extractor against the live
account and inspecting what came back, not by reasoning about the DOM in the abstract:**

- The detail panel's due/open/close info sits inside several nested wrapping elements of
  increasing size, and the *innermost* one is often just a bare label span — literally the
  five characters `"Open:"`, with the actual date in a sibling the label doesn't contain.
  `findDescriptionPanel()`'s first version picked the *shortest* element whose text starts
  with `"Due:"`/`"Open:"` (reasoning: a wider ancestor's text also satisfies that prefix,
  so avoid over-grabbing) — which silently returned almost nothing, live, for every
  exam-style item. The fix is the opposite of the original reasoning: pick the *largest*
  matching element instead. That's safe specifically because the very same "must start
  with Due:/Open:" constraint that motivated the shortest-match instinct already prevents
  over-grabbing — a wider ancestor that also included the *next* row would have that row's
  title text appear first, breaking the prefix match, so the largest matching element is
  reliably the full panel and nothing past it. Trailing UI chrome that rides along in that
  largest match (button labels like "Check off", "Submit" — DOM siblings of the real
  content, never clicked, just present in `.textContent`) is stripped by name afterward
  (`stripActionChrome()`) rather than solved by shrinking the match.
- A category header's own `.textContent` includes a second, separate label the UI renders
  right next to it — `"Programming Assignments"` `.textContent` reads as `"Programming
  Assignments of Grade: 20%"`. The header element's second child specifically (`children[1]`,
  after a first, empty chevron-icon child) is the clean category name alone; grabbing the
  whole header's text pollutes the `category` field with the grading weight on every course.

**Phone-native install, no computer involved at all:** a browser bookmarklet's usual
install gesture — drag a link to the bookmarks bar — doesn't really exist on a phone.
Rather than accept "you need a laptop to run this once," `/connect` offers the *same*
script (`bookmarkletSource()`, not a second implementation) through iOS's built-in
**Shortcuts** app: its "Run JavaScript on Web Page" action executes arbitrary JS in the
current Safari tab, which is exactly what a bookmarklet does — Shortcuts is just a
different, phone-native installation mechanism for the identical code. Set up once (paste
the copied script into that one action, a few taps), it then runs from the Share sheet
with a single tap, on any future visit, forever — not "paste a link per course," a
one-time setup followed by a tap. The `/connect` page's copy button has a hard 1.2s
timeout race around `navigator.clipboard.writeText()` specifically because that promise
was observed, during this project's own testing, to hang indefinitely rather than reject
in at least one automated-browser context — with a visible, selectable fallback textarea
underneath either way, so a stuck clipboard call never leaves the button silently dead.

**Two real constraints "Run JavaScript on Web Page" imposes that a plain bookmarklet
doesn't, both found by actually running it on a phone, not by reading Apple's docs
first:**

- It requires the script to explicitly call a `completion(result)` function when done —
  a plain bookmarklet has no such contract and neither script originally called one,
  which surfaced as "the script must call the function completion(result) when finished."
  Both scripts now call `completion("done")` from a top-level `finally` block (a `finally`
  runs after every `try` exit path, including early `return`s, so this is one line that
  covers every exit rather than needing to be threaded through each one) — guarded by
  `typeof completion === "function"` so it's a silent no-op as a plain bookmarklet, where
  no such global exists.
- Separately, and less visibly, the action also enforces a strict, short overall time
  limit — confirmed against Apple's own support documentation
  (support.apple.com/guide/shortcuts/apd218e2187d), not guessed at — and exceeding it fails
  the whole thing with a "JavaScript Timeout" error instead of whatever the script would
  otherwise have produced. The Sync Grades & Due Times script's per-row detail-panel read
  (§8 above — a click, a ~400ms wait, a second click, a ~250ms wait, per assignment) costs
  ~650ms per row, which reliably exceeds that budget for anything but a tiny course. The
  fix isn't tuning the delays down — the fix is that the same script, detected via the
  same `typeof completion === "function"` check used for the `completion()` call, skips
  opening each row's detail panel entirely when running as a Shortcut: due time, score,
  and category are read from the row's own text earlier and are unaffected, but
  description/links stay empty for a phone-run sync. The desktop bookmarklet has no such
  limit and always does the full extraction. The dashboard's card hint (`agendaCard()` in
  `src/server/render.ts`) distinguishes "never synced" from "phone-synced but no
  description/links yet" so this doesn't read as broken — see the `hasAnyEnrichment` check
  there.

## 9. Deployment: reachable from anywhere, no laptop required

A single JSON file on one Mac (§6 as originally written) cannot satisfy "I should be able
to open this on my phone from anywhere, without needing my laptop to be on" — that's not a
tuning problem, it's a different architecture. Docket now runs in two modes from the exact
same code, chosen automatically by environment (`isCloudMode()` in `src/config.ts`):

- **Local mode** (no `KV_REST_API_URL` set) — the original design: a local JSON
  file (`FileSnapshotStore`), the local dev server, `launchd` for background sync. Zero
  external accounts, nothing leaves the machine. Good for development, demos, and anyone
  who's fine with "reachable only while my computer is on."
- **Deployed mode** — the same `handleRequest()` handler (`src/server/handler.ts`, shared
  by both modes — there is exactly one implementation of every route, not two) runs as a
  Vercel serverless function (`api/index.js`), and the snapshot lives in a small Redis
  store (`RedisSnapshotStore`, via the Upstash Marketplace integration) instead of a file.
  A Vercel Cron job (`api/cron/sync.js`, `vercel.json`) replaces `launchd`, hitting the
  ICS feed on a schedule — safe unattended for the same reason `launchd` was (§10): no
  authentication needed. Once deployed, the dashboard has one stable HTTPS URL reachable
  from any device, any network, with nothing running on anyone's laptop.

**Why this doesn't compromise the local-first principle it seemingly contradicts:** the
project's own stated rule (§8 of the original brief) is "a backend should only exist if
there is a compelling product requirement that cannot reasonably be satisfied locally" —
and "reachable from a phone with no computer involved, ever" is exactly that requirement,
not a convenience default. Local mode is still fully intact and still the default for
anyone who runs this without deploying it.

**Storage stays a single blob, deliberately.** `RedisSnapshotStore` stores the *entire*
`AcademicSnapshot` under one key (`docket:snapshot`) — same shape as the file store, just
a different address. This was a conscious choice over a relational schema: Docket's access
pattern is "read the whole thing, maybe write the whole thing back," never a partial
query, so a single JSON blob in Redis is both the simplest correct option and requires no
new query logic anywhere else in the app (`SnapshotStorage` in `src/core/store.ts` is
still the only contract the rest of the code depends on).

**The connect flow gets a nice side effect from this, not just the dashboard.** The
bookmarklet's cross-origin POST target (§8) becomes the deployment's stable HTTPS URL
instead of `localhost`. That's not just "still works" — it's *more* correct: an
HTTPS-to-HTTPS POST from LearningSuite never risks the mixed-content blocking an
HTTP-only `localhost` origin could theoretically hit (`requestOrigin()` in
`src/server/handler.ts` reads Vercel's `x-forwarded-proto` header to always bake in the
right scheme). And because the deployed store is shared, running "Connect LearningSuite"
from *any* device with an authenticated LearningSuite session immediately updates what the
phone sees — the one-time connect step doesn't have to happen on the same device you
check the dashboard from.

## 10. Keeping data current without a human

Teachers add, move, and remove assignments continuously — the sync engine already handles
this correctly (§5), but only when something actually triggers a sync. Two mechanisms
exist depending on mode: locally, `scripts/install-launchd.sh` installs a macOS `launchd`
user agent running `docket sync --source ics` hourly; deployed, a Vercel Cron job hits
`/api/cron/sync` once a day (protected by a `CRON_SECRET` bearer check so a random
visitor can't trigger unlimited syncs) — Vercel's Hobby (free) plan caps cron jobs at
once daily, confirmed by an actual failed deploy attempt during this build rather than
assumed; a Pro plan removes that cap if more frequent background sync is ever wanted. The
**Sync now** button on the dashboard always works regardless of plan, for "I want this
current right now." Both automated paths are safe to run completely
unattended specifically *because* the ICS connector needs no authentication (§2) — there
is no session to keep alive, no credential to refresh, nothing that requires a human
present, so "run this forever in the background" is a fundamentally different (and fine)
proposition than it would be for anything touching an authenticated session.

## 12. Distinguishing real coursework from calendar markers

LearningSuite's ICS schedule feed (§1) is one undifferentiated stream of VEVENTs — a real
homework assignment and "Labor Day" come back with exactly the same shape. Left alone,
that means Today/Upcoming would show a federal holiday as something to do. `AssignmentKind`
(`src/core/types.ts`) exists to fix that: every assignment carries a `kind` of either
`"assignment"` or `"calendar_event"`, and `isRealWork()` (`src/core/academicViews.ts`)
filters `"calendar_event"` items out of every actionable view (Today, Upcoming, workload) —
they still exist in the store, just never shown as something to do.

Two sources feed `kind`, in order of trust:

1. **Confirmed by enrichment** (`src/core/enrichment.ts`) — a title that was actually found
   on a course's real Assignments page is definitively coursework; `kind` is set to
   `"assignment"` unconditionally on a match. This is the reliable case: if it has a real
   grading category and a real detail panel, it's real work, full stop.
2. **ICS-only guess** (`inferEventKind()`, `src/connectors/icsConnector.ts`) — for
   everything not yet enriched, a deliberately conservative title-keyword match against
   real, observed BYU calendar markers ("Labor Day," "Start of Classes," "Fall Break," and
   similar). Unmatched titles default to `"assignment"` — a false "this is real work" is
   harmless clutter; a false "this is just a calendar marker" would hide something the
   student actually needs to do. Same asymmetric-risk reasoning as §7's "stale is better
   than wrong," applied here as "shown is better than hidden."

This is also where the `category` field (§8) does double duty: a course's own real grading
category (e.g. "Programming Assignments") is always a better signal than the generic
`type` guess, so the dashboard prefers it wherever enrichment has run — see the badge logic
in `src/server/render.ts`.

## 13. What's deliberately NOT built yet

- Completion status and announcements from the authenticated session — the Assignments
  page (§8) doesn't render completion state as readable text; that's the Prioritizer page,
  a documented next step, not guessed at here.
- A packaged Safari Web Extension (Phase 3) — the bookmarklet in §8 is the validated
  prototype of exactly this logic; promoting it is packaging work, not open questions. The
  phone-native Shortcuts install path (§8) covers the "no laptop" requirement in the
  meantime without waiting on it.
- Apple Calendar / Reminders sync (EventKit) — Phase 4, needs completion status and a
  deadline-vs-work-session distinction first.
- A native app / true multi-device CloudKit sync — the Vercel+Redis deployment (§9)
  already satisfies "reachable from my phone from anywhere" for the web dashboard; CloudKit
  would only become the better answer once there's a native app to justify it.

None of this is deferred out of laziness — each is blocked on either a human-in-the-loop
capture step (Duo) or on the layer below it being solid first, per the project's own
stated priority: "prefer maintainability over short-term implementation speed."
