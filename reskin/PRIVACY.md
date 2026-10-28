# Privacy — LearningSuite Reskin

Plain language, not legal boilerplate.

## What this reads

Whatever LearningSuite or MAX has already rendered into the page you're looking at — course
names/links, an assignment's title/due text/category/completion status, a schedule item's title
and date. Never a password or a Duo code. It reads the session cookie and `subsessionID` only
if you turn on Session Relay (below).

## What this sends, and to whom

Nothing, to anyone, by default. Apart from the LearningSuite session keep-alive below, this reskin's core behavior makes no network requests of
its own at all — it only reads and restyles the DOM of a page your own browser already
loaded from LearningSuite or MAX. No backend, no analytics, no third-party service, no external AI.

**Session keep-alive (LearningSuite only).** While a LearningSuite tab is open, this reskin asks
LearningSuite itself to keep your session alive every 10 minutes, using the same `keepAlive`
request LearningSuite's own "session expiring" dialog sends. It goes only to
learningsuite.byu.edu, through the page's own request code, and carries nothing beyond what
LearningSuite already sends on every request. If the session has already expired (for example after the laptop slept
for more than 2 hours), it reloads the page so BYU's own sign-in can restore it; it never does
that over unsaved form edits.

**Opt-in: Session Relay (Settings).** Off by default. If you enter a relay URL, this reskin
sends your LearningSuite session cookie (`PHPSESSID`), subsession id and app id to that URL every
10 minutes, through `GM_xmlhttpRequest`. The relay (`tools/session-relay.mjs`, which you run
yourself) uses them only to send LearningSuite's `keepAlive` request while your laptop sleeps,
holds them in memory only and never logs them. Anyone who gets that cookie can use LearningSuite
as you until the session ends, so run the relay only on a machine you own and reach it only over
a private network such as Tailscale.

**Opt-in: External Calendars (Settings).** If you add a course's
iCalendar feed URL there (e.g. a BYU MAX course, which has no LearningSuite page to read at
all), this reskin fetches that exact URL on your behalf — a plain, read-only GET, using the
userscript manager's own cross-origin grant (`GM_xmlhttpRequest`, declared in the script's
metadata alongside `@connect max.byu.edu`) rather than the page's own `fetch()`, since the
target site doesn't grant browser-JS cross-origin access. Nothing about you or your
LearningSuite data is sent in that request — no cookie, no identifier, just a GET to the URL
you typed in. Off by default; only ever talks to a URL you explicitly added, never one
discovered or guessed.

## Where settings live

LearningSuite appearance, navigation, and Compatibility Mode preferences are stored on your own
device only — in the Userscripts extension's own storage if available, otherwise in
`learningsuite.byu.edu`'s own `localStorage` under a namespaced key. MAX's CSS-only layer stores
no settings. Nothing is transmitted or synced to an account.

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
