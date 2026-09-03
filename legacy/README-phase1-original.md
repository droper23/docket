# Academic Control Tower — Phase 1

Unattended sync from BYU LearningSuite's official per-course iCalendar feeds into a
local data store, plus a minimal local dashboard (Today / Upcoming / Workload / Changes).

No login, no browser automation, no password anywhere. See `../learningsuite-handoff.md`
for the full research and architecture behind this — this is Phase 1 of that roadmap.

## Setup

```sh
npm install
```

## Run a sync

```sh
npm run sync
```

Fetches all five courses' ICS feeds (configured in `src/courses.config.ts`), normalizes
them, and reconciles into `data/store.json` — creating new items, updating changed ones
in place, and only archiving an item after it's been absent for several consecutive
syncs (never on one missed pass). Prints a summary of what changed.

## View the dashboard

```sh
npm run dashboard
```

Then open http://localhost:4173. Reads straight from `data/store.json` — run `npm run
sync` again and refresh the page to see updates.

## Run the tests

```sh
npm test
```

Covers the ICS normalization (parsing, type inference, stable ids, content hashing) and
the sync reconciliation logic (create / update-in-place / no-duplicate / missing-grace-
period / archive).

## What this does and doesn't cover

Covered: due dates, exams, quizzes, and other schedule items for all five courses, from
LearningSuite's own official calendar feed — confirmed to need zero authentication.

Not covered yet (needs Phase 2/3 — a browser extension, since none of this exists in the
ICS feed): exact due *time* (the feed is all-day only), grades, points, completion
status, and announcements. See `learningsuite-handoff.md` §2.3 for the full field-by-
field provenance table.

## Automating it (optional, once you trust it)

This is a plain script — nothing here needs to run inside a browser or hold a login
session, so it's safe to schedule unattended. On macOS, a `launchd` user agent plist
running `npm run sync` every few hours is the native way to do this; that's intentionally
not set up automatically here — add it once you're happy with what a manual run produces.

## Course list

Edit `src/courses.config.ts` at the start of each new semester — the course ids come
from the "Get iCalendar Feed" link on each course's Schedule tab in LearningSuite.
