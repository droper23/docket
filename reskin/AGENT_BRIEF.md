# Agent brief: real-usage UX/performance issues (Sep 2026)

## Mission

This is a Safari/Chrome/Firefox userscript (`reskin/`) that restyles BYU LearningSuite
(`learningsuite.byu.edu`) in place to look like an Apple-designed app, without replacing any
of LearningSuite's own functionality. It has been through several live-audited design passes
(see `ROADMAP.md` — read it in full before touching anything, especially the two most recent
entries) that fixed a long list of styling/color-discipline/accessibility bugs. This next pass
is different in kind: it's feedback from someone actually **using** the redesigned site
day-to-day, not a design critique. Several of these are real functional bugs, not taste, and
this brief includes concrete, code-grounded leads for most of them — verify each one live
before writing a fix, per this project's own established discipline (no guessed selectors,
everything traced to real DOM confirmed against a real authenticated account).

**The user's own instruction on method:** *"The agent should be actively taking lots of
screenshots to get an accurate idea of how the page looks and take inspiration from websites
like Apple's home page and the About Google page for UI/UX design."* Take that literally —
screenshot liberally at every stop (before and after each fix), and hold the result up against
the restraint, whitespace, and typographic confidence of `apple.com` and Google's "About"
pages, not just "does it have rounded corners and a blue accent now."

## Required reading before starting

- `ROADMAP.md` — full history of what's been tried, confirmed, and deferred. Do not
  re-investigate something already documented as a confirmed dead end without new evidence.
- `docs/THREAT_MODEL.md` and this project's own `PRIVACY.md` — hard constraints, not
  suggestions: no `innerHTML` on LearningSuite content, no network contact except
  `learningsuite.byu.edu` itself, no guessed CSS selectors, no bare `<button>`/`<select>`
  rules (LearningSuite reuses bare `<button>` for dropdown triggers with no styling — see
  `global.css`'s own file comment for why a blanket rule there is unsafe).
- `src/adapters/*.ts`, `src/core/pageDetector.ts`, `src/lib/observe.ts`, `src/index.ts` — the
  actual mount/detect/re-render architecture; several issues below trace into this loop, not
  just CSS.
- The live-injection testing technique already established in this project: `tools/cdp.mjs` +
  the pattern in `tools/audit/*.mjs` — build (`npm run build`), strip the `==UserScript==`
  metadata header off `dist/learningsuite-reskin.user.js`, inject the rest into a real
  authenticated tab, re-inject after every full navigation (LearningSuite reloads the whole
  page between sections, which wipes injected JS).

## Issues to investigate and fix

### 1. Content flashes in, then disappears — "especially the Combined Schedule"

**This one has a concrete, code-confirmed lead — start here.**
`src/adapters/homeAdapter.ts`'s `mount()` (lines ~74-120): `extractItems()` skips any anchor
already marked `isProcessed(a, "scheduleitem")` (line 41), so a second call only returns
**newly appeared** items, not the full set. But `mount()`'s render branch does:
```ts
if (overlay && dayList) {
  dayList.replaceChildren(...groups);   // groups can be EMPTY on a re-run
}
```
On the very next debounced re-render (any DOM mutation anywhere in `document.body` triggers
this via `observeMutations` in `src/index.ts`, 150ms debounce), `groups` is very likely `[]`
(all real anchors already marked processed) — `dayList.replaceChildren()` with no arguments
**wipes every previously-rendered day out to nothing**. This matches the reported symptom
exactly, and also explains the follow-up detail from the user ("Today did end up loading
after initially disappearing, but only after a long time"): if LearningSuite's own Vue
component renders the 300+-item schedule progressively, each later debounced pass only
recaptures whatever *new* anchors just appeared, and `replaceChildren` wipes out the prior
groups instead of merging — so the final state may also be an incomplete schedule, not just
delayed. Fix direction: don't wholesale-replace `dayList`'s children with only this pass's
incremental batch — accumulate/merge groups across calls (e.g., keep a persistent
date-keyed map of rendered items across the adapter's lifetime, append newly-extracted items
into it, and only re-render from the merged accumulator), or re-extract the full item set
every time instead of skipping already-processed anchors. Confirm live with a version that
logs each `mount()` call's `items.length` / `groups.length` to the console while watching the
Combined Schedule page load, to nail the exact sequence before picking a fix.

Also check whether this same class of bug exists elsewhere ("when going to different sites" —
plural) — `src/adapters/courseListAdapter.ts` looks safer (it has an
`isProcessed(main, "courselist")` early-return guard that skips *all* re-render work once
mounted, not just extraction), but confirm live rather than assuming.

Secondary, lower-confidence lead worth checking while you're in `src/lib/observe.ts`: the
`applying` flag is set/cleared synchronously inside `run()` (itself invoked via
`setTimeout`), but `MutationObserver` callbacks fire as a microtask **after** the current
task (including `run()`'s `finally` block) has already completed — meaning `applying` may
already be back to `false` by the time the observer callback that was triggered by our own
DOM writes actually runs, so `if (applying) return;` may not be preventing self-triggered
re-scheduling the way the file's own comment claims it does. This could explain repeated
unnecessary re-render passes contributing to issue #8 (slowness) even outside the
Schedule-specific bug above. Verify with real logging (call counts over time on a page with
heavy DOM activity), don't just reason about it statically — timing here is subtle and worth
confirming empirically.

### 2. Settings (gear) button should be on the left, not the right

Trivial CSS fix — `src/styles/navigation.css`, `.docket-floating-bar` (~line 91):
`right: 18px` → `left: 18px`. No `responsive.css` override currently touches this rule, but
check live at a narrow/mobile viewport width that a left-anchored FAB doesn't collide with
the sidebar or any mobile nav toggle before shipping it.

### 3. Customizable background — new feature, not a bug

There is currently no way to customize the app's background at all —
`src/core/settings.ts`'s `ReskinSettings` has `appearance`/`useCompanionNav`/
`compatibilityMode`/`showUpcomingOnHome`/`reducedMotion`, nothing background-related, and
`--docket-canvas` in `tokens.css` is a fixed value per theme. Design and build a real setting
for this, following the existing settings-panel pattern (`src/components/settingsPanel.ts`,
persisted via `src/lib/storage.ts`'s `getSetting`/`setSetting`, applied via a
`data-docket-*` attribute or a CSS custom property override the way `data-docket-theme`/
`data-docket-reduced-motion` already work). At minimum: a custom accent/canvas color picker,
consistent with how macOS System Settings' Appearance pane and iOS's wallpaper picker feel —
a curated palette of a few HIG-appropriate options is likely more "Apple-designed" than a
raw color-picker input, but use your judgment and check what actually looks good live.

### 4. "All the fonts should be the same, and should look good. This looks generic."

Read `tokens.css`'s `--docket-font` stack first:
`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Arial,
sans-serif`. **This is very likely the actual root cause, and it depends entirely on what
platform/browser this is being tested on** — confirm that first, don't guess:
- `-apple-system`/`BlinkMacSystemFont` only resolve to real San Francisco on macOS (in Safari
  or Chrome) and iOS/iPadOS Safari.
- On Windows, Android, or Linux — including Chrome or Firefox on those platforms — none of
  those keywords are recognized, "SF Pro Text"/"SF Pro Display" aren't installed fonts there
  either, and the stack falls all the way through to **plain Arial** — which would look
  exactly as "generic" as reported.
- If earlier passes' live verification was done on a platform where the fallback silently
  succeeded (e.g. macOS Chrome), this generic-Arial failure mode could have gone completely
  unnoticed until now.

If that's confirmed as the cause, the real fix is to stop depending on an OS-provided font
existing at all: bundle an actual open-license font (e.g. **Inter**, SIL OFL-licensed, widely
regarded as the closest well-supported alternative to San Francisco's proportions and a
common choice for exactly this "looks native everywhere" problem) as a `@font-face` with the
font file embedded as a base64 `data:` URI directly inside the built CSS. This is the only
way to add a real font **without violating this project's own privacy promise** (`PRIVACY.md`,
`THREAT_MODEL.md` — no network contact besides `learningsuite.byu.edu` itself; a `data:` URI
makes zero network requests, unlike pulling from Google Fonts or any other CDN, which is not
an option here). Budget for the bundle-size increase (a couple of font weights as base64 will
add real KB to the single-file script — check the resulting `dist/` file size stays
reasonable) and confirm live, on whatever platform reproduces the "generic" complaint, that
text now renders the bundled font instead of falling back.

Separately: re-confirm there isn't *also* a residual inconsistency between adapter-inserted
UI (which uses `--docket-font` via `typography.css`'s classes) and native LearningSuite text
that some selector still misses — take screenshots of a few different page types side by side
and look for any visibly different typeface within the same page, not just theoretical gaps.

### 5. Grade Summary page defaults to the Courses (Course List) card grid

**This one also has a concrete, code-confirmed lead.** `src/core/pageDetector.ts`'s
`looksLikeCourseListPage()`:
```ts
const hasClickableRowShape = doc.querySelectorAll("main p.cursor-pointer").length > 1;
return hasAnchorShape || hasClickableRowShape;
```
`main p.cursor-pointer` is a very loose, generic shape (any page with 2+ clickable `<p>`
elements inside `<main>`, no other confirming signal). If Grade Summary renders each course's
grade as a `<p class="cursor-pointer">` row (plausible: a per-course breakdown list, each row
clickable through to that course), it would satisfy this exact same shape and get matched by
`courseListAdapter` — which is checked first in `src/adapters/registry.ts`'s array — instead
of being left alone (there is no Grade Summary adapter). This is the same class of bug as the
already-fixed Assignments/Grades collision documented in this file's own comment on
`looksLikeAssignmentsPage()` a few lines below: a DOM-shape-only check with no real
disambiguating signal. Confirm live (open Grade Summary, inspect its actual DOM — is it really
`p.cursor-pointer` rows? how many?), then add the same kind of real disambiguator the
Assignments fix used (LearningSuite's own active-tab/section signal, e.g.
`.bg-top-nav-highlight` or whatever the live DOM actually shows on Grade Summary vs. real
Course List) rather than guessing a path segment.

### 6. Course page's Schedule view "looks super ugly"

**Prime suspect, added in the immediately prior pass** — `src/styles/global.css`'s bare
`[data-docket-reskin] table` rule (search for the comment starting "Native `<table>`..."):
```css
[data-docket-reskin] table {
  border-collapse: separate;
  border-spacing: 0;
  border-radius: var(--docket-radius-md);
  overflow: hidden;
  box-shadow: var(--docket-shadow), var(--docket-highlight);
  background-color: var(--docket-bg-elevated);
}
```
This was added and live-verified against **Grade Scale only**. If the course-scoped
Schedule's Table view (or the mini-calendar widget's day grid) also uses a real `<table>`
underneath — contradicting an earlier pass's note that it was "a custom Vue component with
no stable class names" — this rule would now apply there too, and would visibly break a dense
calendar-style grid: `border-collapse: separate` with `border-spacing: 0` turns shared
hairlines between adjacent cells into doubled/thicker borders (a classic "instant ugly grid"
regression), and `overflow: hidden` would clip anything that's meant to overflow the table's
bounds (a popover, a sticky header, a tooltip). Confirm live whether Schedule's ugliness
traces to this rule first — it's the highest-probability, fastest thing to check — before
investigating anything else. If confirmed, scope the rule away from Schedule specifically
(e.g. exclude via `:not()` on a real confirmed class, or narrow the selector to only the
actual Grade Scale table's confirmed class) rather than reverting the Grade Scale
improvement entirely.

If it's not the table rule, then this needs the real live audit the earlier "out of scope"
note admitted was never done properly — screenshot it, find whatever real, stable selectors
actually exist this time, and give it genuine card/spacing/elevation treatment consistent
with the rest of the redesign.

### 7. Clicking a sidebar link: font visibly gets bigger, looks disjointed, before the next page loads

Check `build.mjs`'s userscript metadata block first: `@run-at document-idle` — this is the
**latest possible** injection point (after the entire page, including images, has finished
loading). On every full-page navigation (LearningSuite reloads the whole page between
sections — there's no client router), this guarantees a real window where the raw native
LearningSuite page is fully visible with its own native font sizing before this script does
anything at all. The most recent pass added explicit type-scale sizes to native headings
(`h1: 28px`, etc., in `global.css`) — if LearningSuite's native size is smaller, that exact
jump (small → suddenly 28px) at an unpredictable, possibly-late moment would look precisely
like what's being reported. Fix direction: change `@run-at` to inject the `<style>` block as
early as possible (`document-start`, with the CSS/style-injection part specifically not
gated on `DOMContentLoaded` the way adapter mounting still needs to be — a `<style>` tag can
usually be appended even before `document.head` exists by falling back to
`document.documentElement`, or by polling for `document.head` at `document-start`). Confirm
live with screen recordings of an actual sidebar-click navigation, before and after, since
"before loading the next page" is a bit ambiguous as reported — pin down the exact visual
sequence first.

### 8. Overall: poor UX, slow, still looks ugly

This is likely the cumulative effect of #1 (re-render churn/flashing), #6 (a real visual
regression), and #7 (late injection causing FOUC on every navigation) rather than one
separate thing — fix those first, then re-assess with fresh eyes and fresh screenshots
whether a distinct performance problem remains. If it does, profile actual navigation/render
timing live (Chrome DevTools Performance panel via the CDP tooling, or simple
`performance.now()` logging around `boot()`/`runAdapters()`) rather than guessing at causes —
candidates worth checking with real numbers, not assumptions: the debounced
`MutationObserver` re-running `runAdapters()` (and therefore every adapter's `matches()`
check plus a full DOM query pass) more often than necessary given #1's finding above; the
`overlayContent()` pattern hiding rather than removing original content, roughly doubling
live DOM node count on large pages (300+-item schedules, big course lists) with no
virtualization; and `backdrop-filter: blur(20px)` now applied fairly widely (nav, dropdowns,
tables) — expensive to paint/composite, worth checking whether it's actually janky on a real
device rather than just "sounds expensive."

## Constraints (non-negotiable, same as every prior pass)

- No third-party network requests beyond `learningsuite.byu.edu` itself (a bundled font as a
  `data:` URI is fine; loading one from a CDN is not).
- No `innerHTML` on any LearningSuite-originated content; DOM builders / `textContent` only.
- No guessed CSS selectors or URL path segments — everything traced to real, live-confirmed
  DOM, the same discipline `pageDetector.ts`'s own comments demonstrate throughout.
- No bare `<button>`/`<select>` rules (see `global.css`'s file comment for why).
- A broken adapter must never take down the page — the existing try/catch/unmount fallback
  in `src/index.ts`'s `runAdapters()` already guarantees this; don't weaken it.

## Deliverables

1. Fixes for as many of #1–#8 as get confirmed and resolved, each grounded in a live check,
   not assumption — say plainly in your final report which ones you fixed vs. which turned
   out to need more investigation than this pass could close out.
2. `npm run build && npm run typecheck && npm test` passing.
3. A new entry in `ROADMAP.md` in the established style (check the file's current latest
   dated entry and number this one accordingly — don't hardcode an assumed number here).
   Include real before/after screenshots' worth of description even though the images
   themselves aren't committed (see `tools/shots/`'s existing `.gitignore` entry and why).
4. Do **not** commit or push — stop after implementation and live verification, and report
   back a concise summary (what was confirmed live vs. assumed correctly by this brief, what
   changed per file, test/build results, and the outcome of each live-verification
   checkpoint) so the diff can be reviewed before it ships.
