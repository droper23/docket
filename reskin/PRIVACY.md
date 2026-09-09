# Privacy — LearningSuite Reskin

Plain language, not legal boilerplate. See `../docs/THREAT_MODEL.md` for the fuller
technical analysis this inherits from the rest of the project.

## What this reads

Whatever LearningSuite has already rendered into the page you're looking at — course names/
links, an assignment's title/due text/category/completion status, a schedule item's title
and date. Never a password, a Duo code, a session cookie, or a `subsessionID`.

## What this sends, and to whom

Nothing, to anyone, by default. This reskin's core behavior makes no network requests of
its own at all — it only reads and restyles the DOM of a page your own browser already
loaded from `learningsuite.byu.edu`. No backend, no analytics, no third-party service, no
external AI.

**The one opt-in exception: External Calendars (Settings).** If you add a course's
iCalendar feed URL there (e.g. a BYU MAX course, which has no LearningSuite page to read at
all), this reskin fetches that exact URL on your behalf — a plain, read-only GET, using the
userscript manager's own cross-origin grant (`GM_xmlhttpRequest`, declared in the script's
metadata alongside `@connect max.byu.edu`) rather than the page's own `fetch()`, since the
target site doesn't grant browser-JS cross-origin access. Nothing about you or your
LearningSuite data is sent in that request — no cookie, no identifier, just a GET to the URL
you typed in. Off by default; only ever talks to a URL you explicitly added, never one
discovered or guessed.

## Where settings live

Appearance, navigation, and Compatibility Mode preferences are stored on your own device
only — in the Userscripts extension's own storage if available, otherwise in
`learningsuite.byu.edu`'s own `localStorage` under a namespaced key. Never transmitted
anywhere, never readable by LearningSuite's own JavaScript (a different storage key), never
synced to any account.

## Diagnostics

The in-page Diagnostics panel shows counts and statuses only (which page was detected,
whether an adapter is active, how many elements were transformed) — never an assignment
title, grade, or announcement body. It isn't persisted or sent anywhere; it resets on every
page load.

## Turning it off

Disable the script instantly from the Userscripts extension's own popup, or turn on
Compatibility Mode from this reskin's own Settings panel. Either way, LearningSuite's
original interface and your access to your real data are completely unaffected — this
project only ever changes how you look at data LearningSuite already shows you.
