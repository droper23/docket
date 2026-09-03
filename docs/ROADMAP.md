# Docket — Roadmap

Status as of this build. See `docs/ARCHITECTURE.md` for the reasoning behind the phase
order — each phase is blocked on the one before it, or on a human-in-the-loop step Duo
makes unavoidable.

## Phase 0 — Product architecture — **done**
Connector abstraction, data ownership/provenance model, threat model, sync semantics.
`docs/ARCHITECTURE.md`, `docs/THREAT_MODEL.md`.

## Phase 1 — Core data layer + ICS connector — **done, verified against the live account**
- Canonical schema with `Field<T>` provenance wrapper (`src/core/types.ts`)
- Local JSON store, atomic writes (`src/core/store.ts`)
- Generic, connector-agnostic sync engine — create / no-op / update-in-place / missing-grace-period-then-archive (`src/core/syncEngine.ts`)
- Hand-rolled ICS parser with HTML-entity decoding, RFC 5545 line-folding, malformed-input tolerance (`src/connectors/icsParser.ts`)
- `IcsConnector`, `DemoConnector` (`src/connectors/`)
- Today / Upcoming / Courses (workload) / What Changed / Diagnostics dashboard, zero JS framework (`src/server/`)
- Automatic background sync via `launchd` (`scripts/install-launchd.sh`) — keeps data
  current as teachers add/move/remove assignments, with no human needed since the ICS feed
  needs no auth
- Phone access — dashboard reachable over the same Wi-Fi (`.local` hostname, no install)
  with Tailscale auto-detected as an optional fallback for networks that isolate devices
- **Verified live**: synced the user's real Fall 2026 LearningSuite account — 5 courses,
  457 real assignments, zero authentication required, idempotent re-sync confirmed (second
  sync = 0 changes), dashboard rendered and clicked through in an actual browser (including
  at phone width).
- **One real bug found and fixed during this verification**: missing-detection wasn't
  scoped per-course and would have archived 297 of 457 real assignments on the very first
  sync. See `docs/ARCHITECTURE.md` §5 and the regression test in `test/syncEngine.test.ts`.

**Not covered by the ICS feed itself** (by design): due *time* (all-day only), grades,
points, completion status, announcements — see Phase 2, part of which is now done.

## Phase 2 — Authenticated enrichment — **partially done**

**Done, verified against the live account:**
- **Course auto-discovery** — a bookmarklet (`src/connectors/bookmarklet.ts`, served from
  `/connect`) reads the student's Course List page and saves their real courses, replacing
  manual courseID lookup/entry entirely. Verified live: correctly extracted all 5 real
  courses; also correctly produced its "no courses found" failure message rather than wrong
  data when accidentally run on this account's *instructor* view (this account has a
  secondary TA role) instead of the student view — a real edge case, not a hypothetical.
- **Grades & due-time enrichment** — a second bookmarklet reads a course's Assignments page
  (real due time + real points, data the ICS feed structurally cannot have) and merges it
  onto the matching ICS-synced assignment by title, via `applySessionEnrichment()`
  (`src/core/enrichment.ts` — deliberately not the generic `reconcile()` engine; see
  `docs/ARCHITECTURE.md` §8 for why). Verified live: of 5 real assignment rows, 3 matched
  and enriched correctly (due time + points), 2 were correctly left unmatched because
  LearningSuite's own ICS feed lists them twice under near-identical titles — the code
  refused to guess which one to update, exactly as designed.
- Handles a real, discovered LearningSuite quirk: the Assignments page's DOM structure
  changes at narrower viewport widths (accordion-collapsed categories, different cell
  layout) — the extractor is layout-independent (regex over row text, not fixed cell
  indices) and was verified against both layouts.

**Not done yet** — needs a live session to safely capture, same constraint as before:
- Completion status and announcements. `LearningSuiteSessionConnector` is still an
  interface-conformant skeleton for these specifically — every method returns
  `not_implemented` rather than a guessed parser. The Prioritizer page is the likely next
  place to look (per the original research), not yet captured.
- The underlying `ajax.php` RPC surface remains mostly unexplored beyond the one
  `funcName` (a completion-toggle) confirmed during the original research — no other
  actions or response shapes have been captured. DOM extraction via bookmarklet has
  covered what was needed so far without touching this.

**Next concrete step**: capture the Prioritizer page's completion-checkbox structure the
same way the Assignments page was captured — live, with a human, reading only text content
(never a full HTML dump — see `docs/ARCHITECTURE.md` §8 for why that specifically matters).

## Phase 3 — Promote to a signed Safari Web Extension — **not started**
Package the validated Phase 2 logic for Mac + iOS from one codebase, narrowest possible
permission scope (LearningSuite's origin, not `<all_urls>`), wired to the same
`AcademicSnapshot` local data layer Phase 1 already built.

## Phase 4 — Apple Calendar & Reminders via EventKit — **not started**
Stable-ID-keyed create/update, never duplicate (the sync engine's `SyncRecord` already has
`reminderId`/`calendarEventId` fields reserved for this). Distinguish deadline events
(LearningSuite-owned) from suggested work sessions (Companion-owned). Local notifications
for newly-changed items — this is what makes "What Changed" proactive instead of
pull-only.

## Phase 5 — Distribution — **not started**
Packaging, code-signing story (free Apple ID needs re-signing ~weekly; $99/yr developer
program removes that chore), install docs, privacy policy, demo mode already exists
(`DemoConnector`) and doubles as the no-account evaluation path for anyone (App Store
reviewers, future contributors) trying the project before connecting a real account.

## Phase 6 — Hardening — **partially ongoing, not a discrete future step**
Security/dependency/permission/logging audits should happen continuously, not as a
one-time gate at the end — `docs/THREAT_MODEL.md` is a living document, updated as each
phase actually ships code, not written once and left stale.

## What the next session should do first

1. Finish Phase 2: capture the Prioritizer page's completion-status structure live, with a
   human present, the same way the Course List and Assignments pages were captured — don't
   guess a DOM shape or ship a parser against one that wasn't actually observed.
2. Then Phase 3: promote the two validated bookmarklets into a packaged Safari Web
   Extension so the same logic runs opportunistically without a manual click, on Mac + iOS.
3. Re-run `npm test` and a live `npm run sync:ics` after *any* change to the sync engine,
   a connector, or `enrichment.ts` — the Phase 1 archival bug and the enrichment
   ambiguous-title behavior only surfaced against real multi-course data, not synthetic
   fixtures.
