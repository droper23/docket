# Docket

A privacy-first productivity layer on top of BYU LearningSuite. LearningSuite stays the
source of truth for your courses, assignments, and grades — Docket is the interface you
actually want, so you can answer "what do I need to do today?" in seconds instead of
clicking through five LearningSuite pages.

This is an unofficial, student-built tool. It is not affiliated with, endorsed by, or
supported by Brigham Young University or LearningSuite.

**Status:** Phase 1 (course schedule sync + dashboard) is built and verified against a
real LearningSuite account. Grades, exact due times, completion status, and Apple
Calendar/Reminders integration are not built yet — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

## What it does today

- Fetches your enrolled courses' schedules from LearningSuite's own per-course iCalendar
  feed — **confirmed to need zero authentication** (see
  [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for why). No password, no browser
  automation, no login flow of any kind for this part.
- Normalizes everything into one local data store on your machine — nothing leaves your
  device except the read-only request to LearningSuite's own feed.
- Shows a **Today** view (what's due now), **Upcoming** (next two weeks), **Courses**
  (estimated workload per class), **What Changed** (since your last check), and
  **Diagnostics** (is the connection healthy).
- Never invents data and presents it as fact: every field is labeled *real* (LearningSuite
  said it), *derived* (Docket estimated it, e.g. "how long will this take"), or *manual*
  (you typed it) — see `docs/ARCHITECTURE.md` §4.

## Quickstart

```sh
npm install
npm run build
```

### Try it with no LearningSuite account (demo mode)

```sh
npm run sync:demo
npm run serve
```

Open http://localhost:4127 — you'll see a fully synthetic, generic course schedule (no
real student's data).

### Connect your real LearningSuite account

1. Open each of your courses in LearningSuite → the course's **Schedule** tab → **Get
   iCalendar Feed**. Copy the `courseID` out of the URL it gives you
   (`.../ical.php?courseID=THIS_PART`).
2. Copy `data/courses.config.example.json` to `data/courses.config.json` and fill in your
   real courses. This file is gitignored — it's your own data, never committed.
3. Run:
   ```sh
   npm run sync:ics
   npm run serve
   ```
4. Open http://localhost:4127. Run `npm run sync:ics` again any time to refresh — it's
   idempotent (safe to run repeatedly; it only updates what actually changed).

## Running the tests

```sh
npm test
```

12+ tests covering ICS parsing (real-world quirks like double-escaped HTML entities and
RFC 5545 line folding), and the sync engine's reconcile logic (create / no-op /
update-in-place / never-duplicate / missing-grace-period-before-archive / never
cross-contaminate between courses — the last one is a regression test for a real bug found
while validating against a live account; see `docs/ARCHITECTURE.md` §5).

## Project layout

```
src/core/         canonical data model, local store, sync engine — connector-agnostic
src/connectors/   LearningPlatformConnector implementations (ics, demo, session-stub)
src/server/       the dashboard (plain Node http server, no framework, zero JS deps)
src/cli.ts        sync / reset commands
docs/             architecture, threat model, roadmap
legacy/           an earlier prototype of this same Phase 1 idea, superseded by src/ —
                  kept for reference, not part of the running app
```

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — why it's built this way
- [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) — security analysis
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — what's built vs. planned
- [`learningsuite-handoff.md`](learningsuite-handoff.md) — the underlying LearningSuite
  research this project is built on (auth architecture, the `ajax.php` protocol, the ICS
  feed, prior art)

## Privacy

No password, cookie, or session identifier is ever stored, logged, or transmitted by this
project. The only network requests it makes are read-only GETs to LearningSuite's own
public iCalendar feed for courses *you* told it you're enrolled in. Your academic data
stays in one local JSON file on your machine (`data/snapshot.json`, gitignored) unless you
explicitly opt into a future sync mechanism. See `docs/THREAT_MODEL.md` for the full
analysis.

## License

MIT — see [`LICENSE`](LICENSE). Chosen deliberately: this is a personal productivity tool,
not a product with a business model to protect, and a permissive license makes it easiest
for other BYU students to read the code, verify what it does with their data, fork it, or
fix a connector when LearningSuite changes something.
