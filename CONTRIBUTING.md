# Contributing to Docket

Thanks for looking at this. It's a small, early-stage tool built by one BYU student for
personal use, opened up so other students can inspect it, use it, and help it survive
LearningSuite changing under it. There's no formal process — just a few things worth
knowing before you dig in.

## Getting started

```sh
git clone <this repo>
cd docket
npm install
npm run build
npm test
npm run sync:demo && npm run serve   # try it with synthetic data, no LearningSuite account needed
```

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) first — it explains *why* things are
built the way they are (the connector abstraction, the provenance model, why there's no
password anywhere), not just what the code does. Most "why didn't you just..." questions
are answered there.

## The rules that aren't optional

These came from real research and real incidents during this project's build, not
arbitrary style preferences — see `docs/THREAT_MODEL.md` and `learningsuite-handoff.md`
for the full reasoning:

- **Never add code that stores, logs, or transmits a LearningSuite/BYU password, cookie,
  or session identifier.** Anywhere. This is the one hard line.
- **Never make Docket log into LearningSuite unattended.** Duo makes this genuinely
  infeasible without storing a credential — any PR attempting it will be declined
  regardless of how it's implemented. The pattern here is: observe a session a human
  already opened (a bookmarklet, eventually a browser extension), never simulate the
  login.
- **Never guess a LearningSuite `courseID`.** The ICS feed has no auth, so guessing IDs
  would mean pulling other students' course schedules. Only ever fetch courses a user's
  own session told Docket about.
- **Every field is `real`, `derived`, or `manual` — never blur them.** If you add a new
  data field, decide which one it is and wrap it in `Field<T>` (`src/core/types.ts`)
  accordingly. A `derived` estimate must never render as if LearningSuite said it.
- **A connector failure must never corrupt or delete existing data.** "Stale is better
  than wrong" — see `docs/ARCHITECTURE.md` §7. If you're touching `src/core/syncEngine.ts`
  or a connector, this is the property to protect above all else.

## Before you touch the sync engine or a connector

A real bug shipped during this project's own build: the sync engine's "missing item"
detection wasn't scoped per-course, and it would have archived 297 of 457 real assignments
on the very first live sync. It passed every test that only used synthetic single-course
fixtures. It was only caught by running against a real multi-course account.

The lesson, concretely: **if you change `syncEngine.ts`, `syncRunner.ts`, or a
connector, add a test that would have caught the bug you're fixing or the regression
you're worried about** — not just a happy-path test. `test/syncEngine.test.ts`'s
"syncing multiple scopes in one pass never cross-contaminates missing-detection" test is
the template for what this looks like. If you can, also actually run `npm run sync:ics`
against a real account before calling it done — synthetic fixtures alone did not catch
the bug above.

## Code style

- No new runtime dependencies without a real reason. The ICS parser is hand-rolled on
  purpose (see `docs/THREAT_MODEL.md` "Supply-chain compromise") — a smaller, well-tested
  surface beats pulling in a general-purpose library for a narrow, understood format.
- Comments explain *why*, not *what* — see the existing code for the tone. Delete a
  comment that only restates the line below it.
- Keep the connector abstraction honest: nothing outside `src/connectors/` should know
  LearningSuite's URL patterns, DOM structure, or the `ajax.php` RPC shape.

## Reporting a LearningSuite-side change (something broke)

If a connector starts failing — dashboard shows "connection needs attention," or a sync
that used to work now returns errors — that almost certainly means LearningSuite changed
something, not that your account is broken. Open an issue with:
- Which connector/route (ICS feed? a bookmarklet?)
- The error message from `/diagnostics` or the terminal
- If you're comfortable sharing it: a **sanitized** example of what changed (no real
  grades, no personal identifiers) so a fixture-based regression test can be added

## What NOT to open a PR for

- Anything that would need storing a password or automating Duo (see above — this isn't a
  missing feature, it's a deliberate boundary).
- Analytics, telemetry, or crash reporting wired up by default. `docs/ARCHITECTURE.md`'s
  whole premise is local-first with nothing leaving the device by default.
- A cloud backend "for convenience." If you have a real multi-device sync need, open an
  issue to discuss it first — the intended answer there is CloudKit's private database
  when a native app exists, not a hosted server.
