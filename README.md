# Docket

A privacy-first productivity layer on top of BYU LearningSuite. LearningSuite stays the
source of truth for your courses, assignments, and grades — Docket is the interface you
actually want, so you can answer "what do I need to do today?" in seconds instead of
clicking through five LearningSuite pages.

This is an unofficial, student-built tool. It is not affiliated with, endorsed by, or
supported by Brigham Young University or LearningSuite.

**Status:** Phase 1 (course schedule sync + dashboard) and the first slice of Phase 2
(real grades/due-times via a bookmarklet, course auto-discovery) are built and verified
against a real LearningSuite account. Completion status and Apple Calendar/Reminders
integration are not built yet — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

## What it does today

- Discovers your enrolled courses automatically — no course IDs to hunt down or type in
  (see **Connect your real LearningSuite account** below).
- Fetches your courses' schedules from LearningSuite's own per-course iCalendar feed —
  **confirmed to need zero authentication** (see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
  for why). No password, no browser automation, no login flow of any kind for this part.
- Optionally pulls in real due *times* and grades too (the ICS feed only has dates), via a
  one-click bookmarklet that reads a page you're already looking at.
- Normalizes everything into one local data store on your machine — nothing leaves your
  device except read-only requests to LearningSuite's own feed.
- Shows a **Today** view (what's due now), **Upcoming** (next two weeks), **Courses**
  (estimated workload per class), **What Changed** (since your last check), and
  **Diagnostics** (is the connection healthy).
- Works on your phone too — same Wi-Fi, no app to install (see **Using it on your phone**).
- Can sync itself automatically on a schedule, so it stays current without you doing
  anything (see **Keeping it up to date automatically**).
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

```sh
npm run serve
```

Open http://localhost:4127/connect — it walks you through two one-click bookmarklets:

1. **Connect LearningSuite** — drag it to your bookmarks bar, open your LearningSuite
   Course List while signed in, click it. Docket reads the course names and IDs already on
   that page and saves them — nothing to copy/paste, nothing to type in. Re-run any time
   your enrollment changes.
2. **Sync Grades & Due Times** (optional) — same idea, run on a course's Assignments page,
   pulls in real due times and grades on top of the schedule feed.

Then click **Sync now** on the dashboard (or run `npm run sync:ics`). Safe to run
repeatedly — it's idempotent, only updates what actually changed.

The bookmarklets only ever read the page you're already on and send it to your own Docket
server on this machine — see [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) and
[`src/connectors/bookmarklet.ts`](src/connectors/bookmarklet.ts) (plain, readable source).

## Using it on your phone

Run `npm run serve` and check the terminal output — it prints a URL like
`http://your-computer-name.local:4127`. Open that in Safari (or any browser) on your
phone, same Wi-Fi, no install needed. Optionally tap Share → **Add to Home Screen** for an
app-like icon.

If that doesn't load — common on campus Wi-Fi networks that isolate devices from each
other for security — install [Tailscale](https://tailscale.com/download) (free) on this
computer and your phone. Docket detects it automatically and the Diagnostics page will
show a second URL that works from anywhere, not just this Wi-Fi. Entirely optional.

## Keeping it up to date automatically

Teachers add, remove, and reschedule assignments constantly. Rather than syncing by hand:

```sh
npm run build
scripts/install-launchd.sh        # macOS: syncs every hour in the background
```

This only ever calls the unauthenticated ICS feed (no browser, no login needed — see
`docs/ARCHITECTURE.md` §2), so it's safe to run unattended. Logs to `data/sync.log`. Stop
it any time with `scripts/uninstall-launchd.sh`.

## Running the tests

```sh
npm test
```

19 tests covering ICS parsing (real-world quirks like double-escaped HTML entities and
RFC 5545 line folding), the sync engine's reconcile logic (create / no-op /
update-in-place / never-duplicate / missing-grace-period-before-archive / never
cross-contaminate between courses — a regression test for a real bug found while
validating against a live account; see `docs/ARCHITECTURE.md` §5), and the
bookmarklet-enrichment merge logic (matches by title, refuses to guess on an ambiguous or
missing match — also caught a real case live: LearningSuite's own ICS feed sometimes lists
the same assignment twice with near-identical titles, and the ambiguous-match test is
exactly what keeps that from silently merging into the wrong record).

## Project layout

```
src/core/         canonical data model, local store, sync engine — connector-agnostic
src/connectors/   LearningPlatformConnector implementations (ics, demo, session-stub, bookmarklet)
src/server/       the dashboard (plain Node http server, no framework, zero JS deps)
src/cli.ts        sync / reset commands
scripts/          optional launchd install/uninstall for automatic background sync
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
