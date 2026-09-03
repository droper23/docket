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
- 13 automated tests, all passing (`test/`)
- **Verified live**: synced the user's real Fall 2026 LearningSuite account — 5 courses,
  457 real assignments, zero authentication required, idempotent re-sync confirmed (second
  sync = 0 changes), dashboard rendered and clicked through in an actual browser.
- **One real bug found and fixed during this verification**: missing-detection wasn't
  scoped per-course and would have archived 297 of 457 real assignments on the very first
  sync. See `docs/ARCHITECTURE.md` §5 and the regression test in `test/syncEngine.test.ts`.

**Not covered yet** (by design — none of this exists in the ICS feed): due *time*
(all-day only), grades, points, completion status, announcements.

## Phase 2 — Userscript extraction prototype — **not started**
Goal: validate reading grades, exact due *time*, completion status, and announcements from
a live authenticated LearningSuite session, using a Safari "Userscripts" app script (or
Tampermonkey during prototyping) — fast edit/reload, no code-signing pipeline.

This is a **human-in-the-loop step that cannot be faked with synthetic fixtures**: it
requires a person with a live LearningSuite session to safely capture real DOM structure
and/or real `ajax.php` response bodies (the prior research confirmed only one `funcName`
— a completion-toggle — end-to-end; no other actions, no response body shapes, no DOM
selectors were captured). `LearningSuiteSessionConnector` is already interface-conformant
and waiting — every method currently returns `not_implemented` rather than a guessed
parser, deliberately, so nothing gets shipped as "real" data that wasn't actually observed.

**Next concrete step**: with the user, open LearningSuite's Grade Summary / Prioritizer /
Announcements pages, capture sanitized DOM/response fixtures (no real grades committed to
the repo), and write the parsing logic against those fixtures the same way `icsParser.ts`
was built and tested.

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

1. Decide, with the user: pursue Phase 2 now (requires them to have a live LearningSuite
   session open to capture fixtures), or first wire up unattended scheduling for Phase 1
   (e.g. a `launchd` user agent running `npm run sync:ics` every few hours) since that's
   already fully working and useful on its own.
2. If Phase 2: capture sanitized fixtures together, don't guess response shapes.
3. Re-run `npm test` and a live `npm run sync:ics` after *any* change to the sync engine or
   a connector — the Phase 1 archival bug only showed up against real multi-course data,
   not the demo fixture.
