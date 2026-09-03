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
- Deployable to a free Vercel URL that works on your phone from anywhere — no laptop
  needs to be on, ever (see **Deploying so it works from anywhere**). A local-only mode
  also exists for development/demo, reachable over the same Wi-Fi.
- Connecting your account is phone-native too: an iOS Shortcut (built on the same script
  as the desktop bookmarklet) installs once, then runs with one tap from the Share sheet
  — no laptop needed for that step either.
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

Open http://localhost:4127/connect (or your deployed URL's `/connect`, once you've
deployed — see below) — it has two tabs:

- **📱 On your phone** — a one-time setup (about a minute): create an iOS Shortcut using
  the built-in **Shortcuts** app's "Run JavaScript on Web Page" action, paste in the
  script the page gives you. After that, open LearningSuite in Safari, tap **Share** →
  your shortcut, on any page — one tap, no typing, no links to copy, ever again. Android:
  the same script works as a Chrome bookmarklet (see the "On a computer" tab's
  instructions, they work from Chrome's own address bar too).
- **💻 On a computer** — the classic drag-to-bookmarks-bar version of the same script.

Either way, running it on your **Course List** page discovers your courses (nothing to
copy/paste, nothing to type in — re-run any time your enrollment changes), and running it
on a course's **Assignments** page (optional) pulls in real due *times* and grades, which
the schedule feed alone doesn't have.

Then click **Sync now** on the dashboard (or run `npm run sync:ics`). Safe to run
repeatedly — it's idempotent, only updates what actually changed.

Both install paths run the exact same script, which only ever reads the page you're
already on and sends it to Docket — see [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md)
and [`src/connectors/bookmarklet.ts`](src/connectors/bookmarklet.ts) (plain, readable
source).

## Deploying so it works from anywhere

Local mode (above) only works while your computer is on and `npm run serve` is running.
For a stable URL that works on your phone from anywhere — no laptop involved at all —
deploy to [Vercel](https://vercel.com) (free tier is enough for personal use):

```sh
npm install -g vercel      # if you don't have it
vercel link                # one-time: connects this project to your Vercel account
vercel integration add upstash/upstash-kv --no-claim   # provisions free Redis storage
npm run deploy              # deploys to production
```

The `upstash-kv` integration needs a one-time terms acceptance in your browser the first
time — the CLI prints a link if so. That's the only manual step; environment variables are
wired up automatically. This also sets up a Vercel Cron job that syncs your courses every
hour automatically, same as `scripts/install-launchd.sh` does locally (see **Keeping it up
to date automatically**) — nothing to configure separately.

Once deployed, `/connect` on your deployed URL gives you the same phone-native setup
described above, except now the whole thing — connecting *and* viewing — never needs your
laptop. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §9 for how this works without
compromising the project's local-first default (local mode still exists and is still what
runs if you never deploy).

## Keeping it up to date automatically

Teachers add, remove, and reschedule assignments constantly. If you deployed (above), this
is already handled — a Vercel Cron job syncs hourly with no setup. Running locally instead:

```sh
npm run build
scripts/install-launchd.sh        # macOS: syncs every hour in the background
```

Both only ever call the unauthenticated ICS feed (no browser, no login needed — see
`docs/ARCHITECTURE.md` §2), so they're safe to run unattended. The local version logs to
`data/sync.log`; stop it any time with `scripts/uninstall-launchd.sh`.

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
src/core/         canonical data model, storage (file + Redis), sync engine — connector-agnostic
src/connectors/   LearningPlatformConnector implementations (ics, demo, session-stub, bookmarklet)
src/server/       handler.ts (shared route logic) + index.ts (local dev server wrapper)
src/cli.ts        sync / reset commands
api/               Vercel serverless entry points (dashboard + cron sync) for deployed mode
vercel.json       Vercel build/rewrite/cron config
scripts/          optional launchd install/uninstall for local automatic background sync
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
public iCalendar feed for courses *you* told it you're enrolled in. In local mode, your
academic data stays in one JSON file on your machine (`data/snapshot.json`, gitignored,
never sent anywhere). If you deploy (opt-in, see above), that same data instead lives in a
Redis store under your own Vercel/Upstash account — still yours, not a third party Docket
itself controls, and a deployed instance has no login gating it yet (see
`docs/THREAT_MODEL.md` for that specific, currently-open tradeoff before sharing a
deployed URL with anyone). See `docs/THREAT_MODEL.md` for the full analysis either way.

## License

MIT — see [`LICENSE`](LICENSE). Chosen deliberately: this is a personal productivity tool,
not a product with a business model to protect, and a permissive license makes it easiest
for other BYU students to read the code, verify what it does with their data, fork it, or
fix a connector when LearningSuite changes something.
