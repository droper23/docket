# LearningSuite Reskin — Roadmap

## Eighth pass: live comparison against real LearningSuite, apple.com, and about.google (Sep 2026)

Direct response to "it still has the foundation of the original site and you can tell":
screenshotted every major page type both native and reskinned (real authenticated account,
CDP against `tools/.chrome-audit-profile`, same methodology as every prior live pass) side
by side with a full scroll of apple.com and about.google, then fixed what the comparison
actually showed rather than guessing. All fixes are CSS-only against selectors confirmed
live first — no new adapter/JS logic, deliberately: the first six passes' hard bugs were
all in JS-based DOM extraction, and every gap found this pass was fixable without it.

1. **Real regression found and fixed:** the fifth pass's `.instructorText.font-nunito`
   "inset paper card" (sized for a whole Content/Syllabus page) also fires on the course
   Dashboard's per-day schedule — an instructor's own lesson-topic bullets for that day.
   Live: a jarring full-width white drop-shadowed slab breaking a compact dark list row.
   Confirmed-live scoping fix: `.text-sm .instructorText.font-nunito` (the compact case is
   always wrapped in `p.text-sm`; the whole-page case never is) gets a small inline chip
   instead — same light "paper" background (still needed, instructor content still carries
   inline `color:#000000`), no card padding/shadow.
2. **The single most-visited page never had a real adapter.** The course Dashboard's
   per-day schedule — the *same data shape* Combined Schedule's own adapter already
   redesigns one page over — was still LearningSuite's raw date-bar-plus-list. Confirmed
   live: `.bg-gray1.text-primary-alt.px-4.py-2` (the date bar) is a different compound from
   Combined Schedule's own week header (`.text-primary.cursor-pointer` instead — the two
   never collide, checked against 6 other page types this pass) and is followed immediately
   by `.pl-mobile` (a generic sitewide utility, so targeted only via the adjacent-sibling
   combinator, never bare). Now renders as one grouped card per day, matching the treatment
   the identical data already gets on Combined Schedule.
3. **Grade Summary had zero elevation.** Confirmed live it's a CSS grid
   (`div.grid.gridColsStyle`, confirmed unique — 0 matches on 5 other censused page types),
   not a `<table>`, so the sitewide `table` rule never reached it: flat text on bare canvas
   next to the Course List's own proper cards. Now wrapped as one elevated card; each
   course's percentage (`.clicky`, already tinted blue) becomes a pill badge.
4. **The masthead was the one piece of chrome on every page that never got touched.**
   Confirmed live real elements `button.header-coursedropdown-trigger` (course/term
   switcher) and `button.header-userdropdown-trigger` (account menu) had no hover/focus
   affordance at all — bare text next to a caret. Both get the same soft pill-hover fill
   already used for nav items and menu rows; verified live via real CDP hover events on
   both (no layout shift, no clipping against the truncated course-name text).
5. **Primary buttons moved from an 8px rounded rectangle to a true pill (999px)** —
   `.goBtn`/`.bg-action`/`button.bg-primary-dark` — matching apple.com's and
   about.google's own consistent pill-CTA language. Verified live via computed style
   (`border-radius: 999px`, no height/layout change).

`npm run build && npm run typecheck && npm test` all pass (20/20, unchanged — every fix
here is additive CSS against already-confirmed selectors). Bundle 174.1 KB. Live-verified
this pass via fresh before/after screenshots on the course Dashboard, Grade Summary, and
both masthead triggers (hover state).

**Explicitly deferred:** color-coding Grade Summary's percentage badges by value (green/
yellow/red) — real signal, but requires reading and classifying the displayed number in JS,
which is adapter-shaped risk this pass deliberately avoided; a sitewide max-width/breathing-
room pass on native page content (Apple/Google's biggest visible difference is generous
whitespace) — deferred for lack of a low-risk confirmed wrapper common to every page shape
this session; Announcements, Class Info, Groups, Prioritizer were not part of this pass's
before/after comparison and likely have their own version of finding #2's "never got a real
treatment" gap — worth the same before/after treatment next time.

## Seventh pass: verifying the sixth pass's report + focus-ring/empty-state polish (Sep 2026)

Re-verified the sixth pass's own written report against the actual working tree rather
than taking it at face value: re-ran `npm run typecheck && npm test && npm run build`
(20/20, clean, 168.5 KB before this pass's additions) and re-read every diff named in the
report (`homeAdapter.ts`'s accumulator, `observe.ts`'s `takeRecords()` flush,
`pageDetector.ts`'s `main h1` Grade Summary check, `index.ts`'s `earlyInject()`/
`ensureStylesLast()`, `shell.ts`'s FAB dedup, `build.mjs`'s `document-start`). All of it
checks out against the code as written — no discrepancies found. This was a code-level
re-verification only, not a new live CDP session against a real account, so nothing here
re-confirms the report's own live screenshots/measurements; take those on the report's
own word as before.

Then, code-review-only (no live session this pass), closed a real gap the sixth pass's own
accessibility work didn't reach: every custom-styled interactive element that is a genuine
`<a>`/`<button>`/`role="button"` widget — sidebar nav items, top tabs, the settings FAB,
course cards (including the `tabindex="0"` div fallback in `courseCard.ts`), the
keyboard-activatable assignment rows (`tabindex="0" role="button"` in `assignmentCard.ts`),
"Back to card view", and every control inside the Shadow-DOM settings/diagnostics
panels (`.sheet-close`, `.swatch`, `.switch`, `select`, `.seg`) — had no `:focus-visible`
rule anywhere, unlike the native `<input>` elements the sixth pass explicitly covered. Each
now gets the same `outline: 2px solid` accent-blue ring already established as this
reskin's own convention (panel.css repeats the raw hex rather than the custom property, per
its own file-header rule: a Shadow root shares no tokens with the page). Also added a
`:active` press-scale on the FAB and the background swatches, matching the swatch's
existing hover-scale idiom instead of a bare color change, and replaced the schedule
overlay's plain-text empty state with an icon + text pairing (`icons.checklist()` for
"Nothing in the next two weeks"), matching the Apple grouped-list empty-state idiom
(Reminders'/Mail's own empty screens) instead of a floating sentence.

`npm run build && npm run typecheck && npm test` all pass (20/20, unchanged — this pass
touched no logic, only additive CSS + one icon in an existing empty-state branch). Bundle
168.5 KB. **Not verified live this pass** (no authenticated-session audit was run): the new
rings/press states should be spot-checked keyboard-only against a real account before
calling this closed, the way every prior pass's CSS claims were.

## Sixth live pass: real-usage fixes — the vanishing schedule, Grade Summary takeover, first-paint styling, bundled Inter, background setting (Sep 2026)

Different in kind from every earlier pass: this one started from a real user's day-to-day
complaints ("content flashes in then disappears, especially the Combined Schedule", "Grade
Summary shows my Courses", "fonts look generic", "the sidebar link click flashes", "the
Schedule view looks super ugly", "no way to change the background") rather than a design
critique. Every complaint was first reproduced or ruled out live via the established CDP
harness against a real authenticated account, then fixed, then re-verified live; audit
scripts and screenshots are named inline below.

1. **The Combined Schedule wiped itself clean after rendering — root cause found and
   doubled.** Two independent bugs, both reproduced live before touching code:
   (a) `homeAdapter.mount()` re-rendered from only the *newly extracted* batch — every real
   anchor is already marked processed after the first pass, so any later pass extracted an
   empty batch and `dayList.replaceChildren()` erased all previously rendered days. Live
   repro: 65 rendered rows → **0** after one trivial `body.appendChild` (audit 31). Fix: a
   module-level accumulator (`Map` keyed by anchor element) merged into on every pass;
   re-render always draws the *merged* set, so a later pass can only ever add rows. Live
   post-fix: 63 rows stable across a stray mutation (and the user's "Today eventually
   loaded but only after a long time" follow-up is explained by the same mechanism — each
   progressive batch previously replaced, not joined, the prior one).
   (b) `observeMutations()`'s `applying` flag never actually suppressed self-triggered
   passes: the flag is cleared in `run()`'s `finally`, but MutationObserver callbacks fire
   as a microtask *after* the current task, so records queued by our own writes were
   delivered with the flag already false. Live repro: exactly one redundant extra run per
   adapter write (audit 32) — on the Combined Schedule, that extra run was the wipe. Fix:
   `run()` flushes `observer.takeRecords()` in its `finally` — records queued *during* the
   callback are by definition our own; records queued before the timer fired were already
   consumed (microtasks drain before the next task), so the queue is provably empty at
   `run()` start and takeRecords can only ever catch self-writes (pattern verified live in
   audit 33 *before* editing the source). Post-fix live measurement: exactly one
   re-render per external mutation, zero self-triggered passes — the per-mutation churn
   behind the "slow, janky" complaint is gone.
2. **Grade Summary was silently replaced by the Courses card grid.** The detector's
   `main a[href*='cid-']` shape matched the summary page's five per-course anchors (live:
   `.ORi6/student/top/summary`, h1 "Course Grade Summary"), so courseListAdapter mounted
   over it. Neither URL shape (the `.XXXX` session prefix rotates every session — observed
   twice live this pass) nor top-tab signal (both pages' active tab reads "Home")
   disambiguates. Real disambiguator: each page's own `main h1` — "Course Grade Summary"
   vs "Course List" — the same discipline as the earlier Assignments/Grades tab-title fix.
   (The session prefix rotated three separate times during this session's audit alone —
   `.KcSn` → `.ORi6` → `.6mo1` — reinforcing why path-segment guesses are off-limits.)
   Also re-confirmed live: the current Course List renders real `<a href>` rows again (the
   older "`p.cursor-pointer` only" note was per-term rendering); both shapes stay as OR'd
   signals, and the clickable-shape fixture keeps covering the second one. Live post-fix:
   zero `.docket-course-grid`/`.docket-course-card` elements on the summary page, native
   main intact (screenshot `live-07-grade-summary-after.png`).
3. **The course Schedule view's ugliness was shape, not color — and the bare-table
   suspicion was ruled out live.** First finding: the page contains **zero `<table>`
   elements** in both views (the grid is CSS-grid divs), so the fifth pass's bare-table
   rule never fires here — the brief's prime suspect was innocent. Second: the earlier
   "custom Vue component with no stable class names" note was outdated — the page renders
   LearningSuite's own utility classes, and the compounds `.innerBox`/`.outerBox`/
   `.bg-base.p-1.pt-4` are Schedule-unique across eight censused page types (audit 40);
   `.bg-gray1.px-4.py-2` also appears on course Dashboard, so week-header rules needed a
   page-level gate. Added `data-docket-page="schedule"` on `<html>` (derived each pass
   from `main .innerBox`, a JS-computed scope that works on Safari 14 — no `:has()`), plus
   new `schedule.css`: the Table/List view switcher gets 8px radius + tinted fill
   (natively 0px); its dropdown menu gets the elevated-surface treatment (canvas fill,
   hairline, shadow — natively solid off-palette rgb(36,36,36) in both themes, 0px
   radius); the *open* view choice turns solid accent blue with white text (natively
   indistinguishable from inactive rows because `.bg-accent` and `.bg-gray1` remap to the
   same fill); week headers get 600-weight type and a rounded top; week panels round at
   the bottom, clip, and carry elevation; grid hairlines take the separator token; the
   blue "today" chip gets the Apple-Calendar pill treatment; the "Go to Combined
   Schedule" button gets the token radius. All verified via computed styles live
   (screenshot `live-06-schedule-after.png`).
4. **The sidebar-click font flash: styles now land before first paint.** `@run-at
   document-idle` is the latest possible injection — every full-page navigation painted
   LearningSuite's native type first, then visibly re-styled. Metadata now requests
   `document-start`; style injection no longer waits for DOMContentLoaded (adapters/shell
   still do). Verified live via CDP `addScriptToEvaluateOnNewDocument` (the exact point a
   manager's document-start injection runs): the script executed at readyState
   `"loading"` with `document.head` null — and the first attempt exposed a real bug: even
   `document.documentElement` is absent on the very first task, so an unconditional
   `setAttribute` threw and killed the bundle before boot's listener registered. Fixed
   with a 0-timeout poll for the root element — nothing can paint before a root exists,
   so this still lands pre-first-paint. Post-load assertions live: attribute set, style
   re-parented to the end of `<head>` (`ensureStylesLast()` restores the cascade position
   a document-idle injection used to get), shell + adapters mount normally, body computes
   Inter (audit 50).
5. **"All the fonts should be the same": the stack fell through to Arial off-Apple, so
   Inter is now bundled.** Live-confirmed the native pages run `-apple-system,
   "system-ui", "SF Pro Text"...`; the reskin's identical-first-keywords stack resolved
   SF only on Apple platforms — on Windows/Android/Linux every keyword misses and text
   lands on plain Arial (the "generic" look). Fix: Inter variable (SIL OFL), Google
   Fonts' latin subset woff2, 47.3 KB embedded as a base64 `data:` URI — zero network
   requests, per PRIVACY.md (a CDN is not an option; a data: URI makes no request).
   Generated by `tools/fetch-font.mjs` into `src/styles/font-inter.css` (committed, so
   `npm run build` itself stays network-free); `--docket-font` now leads with Inter on
   every platform, and the shadow-DOM panels match it. Verified live:
   `document.fonts.check('16px Inter')` true, computed body/h1 families start with
   Inter, and resource timing shows zero non-LearningSuite requests added (the site's
   own GA/Dynatrace calls and its Metropolis/FontAwesome fetches are LearningSuite's).
   Bundle cost: 85.3 → 165.9 KB (the font is ~80 KB of that).
6. **New Settings row: Background.** Six curated canvas swatches (Default, Graphite,
   Blue, Purple, Rose, Sand) in a macOS-System-Settings-style strip — a curated palette,
   not a raw picker, so every value can promise HIG-legible contrast against
   LearningSuite's near-black/near-white text in *both* themes. `BackgroundChoice` in
   `settings.ts`; threaded to `<html data-docket-background>` by `applyBackground()`
   (unknown/stale persisted values self-heal to absent); per-theme `--docket-canvas`
   overrides in tokens.css (dark tints like #0b1220, light like #e4edf8). Verified
   end-to-end live: swatch click → persisted → full reload → `attr=blue` → canvas
   computes rgb(11,18,32) → default reset restores the stock canvas (screenshot
   `live-05-background-blue.png`).
7. **Settings FAB moved to the left edge** (user request) and checked live for collisions:
   at 1440×813 the sidebar's links end at y≈313 while the FAB sits at y≈751 — no
   interactive element overlaps; on narrow widths the enhanced nav is in-flow (not a
   fixed rail), so there is no fixed-overlay conflict to clip against. `responsive.css`
   needed no change.
8. **Small correctness catch from the audit loop itself:** `mountShell()` appended its
   FAB unconditionally, so CDP re-injections stacked duplicates (three were live in this
   session's tab). It now removes any stale `.docket-floating-bar` (all of them — a
   single-removal querySelector left two of three alive on the first try) before mounting
   exactly one.

`npm run build && npm run typecheck && npm test` all pass (20/20 — two new regression
tests: homeAdapter must keep previously rendered rows on a second pass with no new items;
`looksLikeCourseListPage` must reject the Grade Summary shape). As always, the CSS-side
fixes (items 3, 5, 6, 7) have no automated coverage and were verified live via computed
styles and screenshots (`tools/shots/`, gitignored: `live-04-schedule-reskin-before2.png`,
`live-05-background-blue.png`, `live-06-schedule-after.png`,
`live-07-grade-summary-after.png`).

**Explicitly deferred, not attempted this pass:** any virtualization for the 300+-item
schedule (post-fix DOM measures ~6.4k nodes with the overlay copy — acceptable, and the
churn half of the "slow" complaint is fixed at the root); a second look at
`backdrop-filter` breadth on low-end hardware (unmeasured; nothing observed janky in this
session); LearningSuite's own loading skeletons/spinners during full-page navigations
(document-start CSS now skins the typeface flash, but the site's own spinner phases are
its markup and stay); the course Schedule's *List* view (only the Table view was audited
live this pass; the scoped selectors are color/shape-only and low-risk, but it deserves
its own live look); and the real Safari Userscripts install flow (unchanged, see below —
this pass's document-start work was verified with CDP's equivalent timing, but the
Userscripts app itself remains unexercised).

**Still open after this pass:** the never-audited page types (Exams, Copyright Resources,
Prioritizer, Groups, Email interior); the Grades "Course Progress" stat panel (still no
non-generic hook); the sitewide `.hover\:bg-accent` question; the low-priority tooling fix
noted by the fifth pass (synthetic-dispatch hover checks in older audit scripts);
Regenerate `font-inter.css` with `node tools/fetch-font.mjs` when bumping Inter.

## Fifth live pass: Apple-HIG fidelity fixes — color discipline, active nav, readability (Sep 2026)

A fresh, skeptical re-audit of the fourth pass's build (real authenticated account, both
themes, real CDP mouse/keyboard events rather than synthetic `dispatchEvent`) confirmed its
four specific claims (header dropdown material, Preferences sheet chrome, font-metro remap,
menu-row hover) hold up, but surfaced 12 new problems — several correctness/accessibility
bugs, not just taste. This pass fixed the ones with the widest reach: two systemic issues
visible on nearly every page (color-tint discipline, active-nav-item matching), rather than
more one-off per-page CSS. Most fixes are global-selector changes every already-touched
**and** every still-unaudited page inherits for free, with no new adapter.

1. **Instructor-authored rich text could render invisible.** `.instructorText.font-nunito`
   only ever remapped `font-family`. Confirmed live instructor WYSIWYG content carries inline
   `style="color:#000000"` (authored assuming a light page) — on the near-black dark canvas
   that's pure-black-on-near-black, not a cosmetic miss. Fixed by rendering it as an inset
   light "paper" card (white background, `#1d1d1f` text, own shadow) in both app themes —
   the same way Apple Mail/Notes handle pasted rich content, rather than chasing every
   possible inline color an instructor might set. Confirmed live post-fix: the same black
   inline text now sits on a white card, fully legible.
2. **Sidebar/top-tab active-item highlight silently failed on every section's landing
   route.** The one-directional `location.pathname.startsWith(href)` check only worked when
   the current URL was equal-or-longer than the link's href — confirmed live it missed the
   common case of landing on a shorter index route (`/student/home`) while the matching link
   points at a longer default child (`/student/home/dashboard`). Replaced with a bidirectional,
   `/`-boundary-safe scoring function (`pathMatchScore`, now exported and unit-tested in
   `test/shell.test.ts`) that picks the single most specific match among all candidates.
   Confirmed live: landing on `/student/home` now highlights exactly "Home"; landing on
   `/student/gradebook` highlights exactly "Grades" — one match, not zero or two.
3. **"One canvas" light-mode leak: the sidebar's own wrapper div.** `<nav>` is sibling-wrapped
   in its own `<div class="bg-left-nav flex flex-col">`; both carry `.bg-left-nav`, which the
   canvas rule skipped entirely so the real `<nav>` could keep its own sidebar material. That
   same skip let the plain wrapper div fall through to native fill — barely visible in dark
   mode but a clear warm tan cast in light mode (`rgb(230,219,206)` vs. canvas
   `rgb(242,242,247)`). Fixed by narrowing the exclusion to `:not(.docket-nav-enhanced)`
   instead of dropping it: confirmed live in both themes afterward — every `.bg-left-nav`
   element now computes the flat canvas color except the mounted `<nav>`, which keeps
   `rgba(255,255,255,0.06)`/`rgba(246,246,246,0.78)`.
4. **Theme could flip to light with zero LearningSuite signal at all.** `applyTheme()` fell
   back to a hardcoded `light` whenever `<html>` carried no `dark` class — correct for real
   light mode, but also wrongly fired on a genuine native error page (`<html class="">`, no
   signal either way), flipping a Dark-mode account's whole reskin outside the SPA's own
   state. Fixed by checking for `.h-full` (confirmed present on every real LearningSuite
   render, dark or light) as the actual "the site gave a signal" test, and persisting the
   last real reading via `getSetting`/`setSetting` (`src/lib/storage.ts`) as the fallback
   instead of a hardcoded value. Verified live in both directions: toggled the real account
   to Light, hit a nonexistent URL, confirmed `data-docket-theme="light"`; toggled back to
   Dark (the account's original setting, restored), hit the same nonexistent URL again,
   confirmed `data-docket-theme="dark"`.
5. **Color-tint discipline — the single biggest fidelity gap.** `.text-primary`/
   `.text-primary-alt`/`.text-action`/`.text-highlight` were one blanket
   `color: var(--docket-blue)` rule. Confirmed live these classes wrap entire static native
   panels — Preferences' plain field labels, Grade Scale's every table cell, empty-state
   strings — none of it tappable, violating Apple's own tint-means-interactive rule
   everywhere at once. Meanwhile the genuinely clickable assignment-name row
   (`div.clicky` inside each `.bg-base.text-highlight` row) carried none of these classes and
   kept LearningSuite's own separate, un-remapped native blue (`rgb(115,175,211)`). Fixed
   both with one split: a default neutral-label rule, overridden only for real interactive
   tags/classes (`a`, `button.text-primary`, `.clicky`) via a more-specific tag-qualified
   selector — deterministic regardless of source order. Confirmed live: Preferences labels
   and Grade Scale cells are now neutral; assignment-row titles are now the correct app blue
   (`rgb(10,132,255)`) instead of the old native pale blue; non-title cells in the same row
   (due date, score) inherit neutral correctly.
6. **`.bg-primary` "today" marker** (the Schedule mini-calendar) was a third, un-remapped
   native blue with hardcoded near-black text. Remapped to a solid app-blue chip with white
   text, matching how Apple Calendar marks "today". Confirmed live.
7. **Type scale.** Native `h1`/`h2`/`h3` got font-family/weight/color in earlier passes but no
   controlled size — native headings varied 24–28px per page with no real hierarchy. Added
   explicit sizes/tracking (28/22/17px) to the same already-owned selector. Confirmed live
   (28px on a checked `h1`).
8. **Native `<table>` (Grade Scale, etc.) had zero elevation** — raw grid borders, 0 radius,
   one tab away from the Assignments view's card-row treatment. Live-checked eight page types
   (Grade Scale, What-If Calculator, Content, Syllabus, Announcements, Email, Schedule,
   Groups) for any table used purely for layout before adding a bare `table` selector — none
   found, only genuine tabular data — so this is a safe bare-tag rule the way `<button>`/
   `<select>` deliberately aren't. Confirmed live: Grade Scale now has card radius/shadow.
9. **Bare `input[type=text/number]` had zero styling** and, worse, a *third* focus-ring
   language (the raw browser default) next to the correct one radios/checkboxes already had.
   Live-census across Email, What-If Calculator, Groups, Schedule, Announcements, Syllabus,
   Content found only `text` and `number` inputs sitewide (no `email`/`search` — not
   guessed beyond what was observed) — both now get the same bg/border/radius treatment plus
   a matching `:focus-visible` ring. Confirmed live on a real click (a scripted `.focus()`
   doesn't reliably trigger Chrome's `:focus-visible` heuristic — a real click does): 2px
   solid app-blue, 2px offset.
10. **Preferences dialog had three different button shapes in one sheet.** Save was a full
    pill; Cancel (confirmed live: `button.bg-base.border-info.text-info.font-metro`) stayed
    fully native — 0 radius, near-invisible border. Gave Cancel the same radius as Save with a
    lighter tinted fill, dialog-scoped (never bare `.bg-base`) like the existing accordion-
    header exception. Confirmed live: both now compute `8px` radius. A "Reset" button
    mentioned in the prior review could not be reproduced live this session (checked General/
    Communication/Email accordion tabs) — not styled; re-check if one turns up elsewhere.
11. **`<iframe>` (Library Resources, confirmed live to embed cross-origin
    `apps.lib.byu.edu`) can't be restyled inside** — no `@match`/`@grant` reaches it, and this
    pass isn't adding a second match block for an unaudited third-party origin. Framed it from
    the parent-page side instead (rounded, clipped, shadowed) so the boundary is consistent
    with every other elevated surface even though the interior stays native. Confirmed live.
12. **`.bg-attention` (native instructor-view banner)** — flagged in the prior review as the
    highest-visibility untouched native color, a solid saturated yellow under the header. A
    remap to a translucent system-yellow token (new `--docket-yellow-banner-bg`, light/dark)
    plus a link-color fix was added in `tokens.css`/`global.css`, but the banner could **not
    be reproduced live this session** across every course in the account (checked all four
    enrolled courses' Home/Class Info/Announcements/Content/Syllabus pages) — it may be tied
    to a role/notice state that's no longer active. The rule is a narrow, safe addition
    targeting a real previously-observed class; it's just functionally unverified this pass.

`npm run build && npm run typecheck && npm test` all pass (18/18, including five new
`pathMatchScore` regression cases covering the exact index-route bug plus a
`/home`-must-not-match-`/homework` boundary check). As always: this covers adapter/detection
logic only — the CSS-only fixes (items 1, 3, 5–9, 11–12) have no automated coverage and were
verified live, via computed styles and screenshots (`tools/shots/`, gitignored).

**Explicitly deferred, not attempted this pass:** restructuring Announcements/Groups/Class
Info/Email into card layouts (still arbitrary native div/table soup — items 5, 7, 8, 9 above
reach these pages for free without a new adapter, which is the safe ceiling here); Library
Resources' iframe *interior* (cross-origin, item 11 covers only the frame); a live re-check of
`.bg-attention` on whatever course/role state originally showed it (item 12).

**Still open after this pass:** the never-audited page types from the fourth pass (Exams,
Copyright Resources, Prioritizer, Grade Summary, Schedule's Table/Calendar view and its Vue
mini-calendar widget); the Grades "Course Progress" stat panel (still no non-generic hook);
the sitewide `.hover\:bg-accent` question; a low-priority tooling fix (some of this project's
own `tools/audit/*.mjs` scripts verify `:hover` via a synthetic `element.dispatchEvent(new
MouseEvent(...))`, which never actually triggers CSS `:hover` — switch them to real CDP
`Input.dispatchMouseEvent`, as this pass's own live checks did, so a future pass doesn't get a
false "confirmed"); and the real Safari Userscripts install flow (unchanged, see below).

## Fourth live pass: top-bar dropdowns, modal chrome, and the real font story (Sep 2026)

This pass targeted the seams the third pass explicitly left behind: the top bar's own
dropdown panels, the Preferences dialog's outer chrome, and remaining font coverage.
Method unchanged from prior passes — a real authenticated `learningsuite.byu.edu` account
in Chrome, driven over the DevTools protocol (`reskin/tools/cdp.mjs`, a dependency-free
custom driver this pass; audit snippets in `tools/audit/`, screenshots in `tools/shots/`).
The built bundle was verified by stripping its `==UserScript==` metadata and evaluating the
rest in the live tab (the established loop), re-injected after every full-page navigation.
Every selector below was dumped from the live DOM before any CSS was written.

1. **Header dropdown panels (the requested top-bar fix).** Both menus — the account menu
   (Messages/Preferences/Help/Logout, from the user's name top-right) and the course/term
   switcher — live in named containers (`div.header-userdropdown-dropdown`,
   `div.header-coursedropdown-dropdown`) wrapping a `ul ... bg-base border-info (sm|lg):rounded`.
   Natively each rendered a solid `rgb(36,36,36)` box, 4px radius, **no shadow, no blur**
   floating over an otherwise-redesigned page — exactly the seam predicted. Both now get the
   translucent-menu treatment (canvas at 85% via `color-mix` with an opaque-canvas fallback
   for engines without it, `--docket-radius-md`, the two-layer `--docket-shadow` plus glass
   edge, saturate/blur backdrop), in `navigation.css` next to `.docket-nav-enhanced`, whose
   recipe they reuse. The course-scoped term switcher and the top-level "All courses" menu
   were confirmed to be the *same component* (identical container class on Combined Schedule
   and on the top-level Course List page) — one fix covers both, as hoped but not assumed.
2. **Preferences dialog chrome.** Confirmed live: a full-screen scrim `div.popupWrapper`
   (note: the class is *named* `bg-blur` but its computed `backdrop-filter` is `none` — the
   blur has to come from us) wrapping the sheet `div.minMax.bg-base.height-Lg` — solid
   `rgb(36,36,36)`, 0px radius, no shadow. The scrim gets `rgba(0,0,0,0.35)` + real backdrop
   blur; the sheet gets `--docket-canvas`, `--docket-radius-lg`, and the shadow token —
   deliberately opaque, not glass: a modal sheet floats over a dimmed page, and translucency
   here would let the dimmed content bleed through the text. Inside it, the accordion
   section headers were confirmed in both states — collapsed
   `div.text-primary.bg-gray1` (already covered by the existing `.bg-gray1` rule) and
   expanded `div.text-white.bg-primary-dark` (newly scoped rule, fill + label colors). The
   Display radios are real native `input[name=typeSelector]` radios — already covered by the
   radio restyle from the third pass.
3. **`.bg-primary-dark` is NOT a safe blanket target — census before styling paid off.** On
   the schedule page it fills four unrelated things: the **active top tab**
   (`a.bg-primary-dark.bg-top-nav-highlight`, owned by `.docket-top-tabs`), the Preferences
   accordion header (a `div`), and two real action buttons (the schedule's "+ Item", the
   prefs "Save", both bare `<button>`s with `hover:bg-primary-alt`). A blanket class remap
   would have fought the first two. Instead only `button.bg-primary-dark` joined the
   `.goBtn`/`.bg-action` action-button group, and only `.popupWrapper div.bg-primary-dark`
   gets the accordion-header treatment.
4. **The real font story (supersedes the third pass's census).** The earlier "only 4
   sitewide `.font-metro` elements" figure was taken on the Grades page alone. Re-run on
   Combined Schedule: 76 visible elements compute Metropolis as their first family, and 76
   carry `.font-metro` directly — because a class rule always beats an *inherited* font, the
   `body` remap never reached any of them (74 were `.bg-action` buttons already covered by
   their own rule; the one true gap was the `bg-primary-dark` buttons above). Fix: remap the
   class itself (`[data-docket-reskin] .font-metro`) — it is LearningSuite's own semantic
   "branded UI text" signal, and a font-family remap cannot change layout behavior the way a
   color/background remap could. Confirmed live post-fix that a `.font-metro` trigger now
   computes `-apple-system`. Course List's census (8 hits, all covered) found no new gaps.
5. **Row hover in menus, scoped not sitewide.** Menu rows are `li.hover\:bg-accent` (header
   dropdowns) and the Preferences timezone-picker options are
   `div.cursor-pointer.text-primary.hover\:bg-accent`; natively they hover-fill
   LearningSuite's raw accent. Remapped to `--docket-fill` for exactly those three confirmed
   surfaces. A sitewide `.hover\:bg-accent` remap was considered and deliberately deferred —
   it is a Tailwind-style utility that could sit on unconfirmed non-menu elements.

Verified with computed-style assertions AND real mouse events (synthetic `.click()` cannot
produce `:hover`): hovered menu rows compute `rgba(255,255,255,0.1)` in dark and
`rgba(120,120,128,0.12)` in light — exactly `--docket-fill` in each theme. Both themes were
toggled via LearningSuite's own real Preferences radios, never simulated, and restored
afterwards. Before/after screenshots (both themes, dropdowns open, prefs open) are in
`tools/shots/` (00–12). `npm run typecheck` and `npm test` (13/13) pass; as always, they
cover adapter/detection logic only — the CSS additions above have no automated coverage and
were verified live, visually, and via computed styles.

**Still open after this pass:** the never-audited page types (Email, Exams, Syllabus, the
real Announcements page, Schedule's Table/Calendar views and their Vue mini-calendar
widget, Groups, Library Resources, Class Info, Copyright Resources, Prioritizer, Grade
Summary, What If Calculator — the latter likely the next good, bounded target for native
number inputs); the Grades "Course Progress" stat panel (still no non-generic hook — do not
invent a structural selector); the sitewide `.hover\:bg-accent` question; and the real
Safari Userscripts install flow (unchanged, see below).

## Third live pass: theme correctness + real canvas/sidebar unity (Sep 2026)

A design review tested the second-pass build live (real account, Chrome, both LearningSuite
themes) and found it still read as "LearningSuite with a dark theme," plus a reproducible
bug making pages nearly illegible. Root causes, all confirmed against the real DOM before
being fixed (not guessed):

1. **Theme detection bug, reproduced and fixed.** `applyTheme()` OR'd LearningSuite's own
   `html.dark` class with `prefers-color-scheme`. Live repro: LearningSuite in native light
   mode (`html.className === "h-full"`) with the OS set to dark painted this reskin's dark
   canvas over LearningSuite's light content — white-on-white, beige-on-black. Confirmed live
   that the `dark` class is *always* present-or-absent (never ambiguous), so there is nothing
   for `prefers-color-scheme` to be a fallback for — it's now never consulted. Also added a
   second `MutationObserver` watching `class` attribute changes on `<html>` (the original one
   only watched `body` childList/subtree, so flipping LearningSuite's own toggle didn't
   re-trigger anything until an unrelated content mutation happened to fire).
2. **Settings/Diagnostics panels now thread the page's real theme explicitly** — the shadow
   host gets `data-docket-theme`/`data-docket-reduced-motion` attributes copied from the exact
   values `applyTheme()`/`runAdapters()` just computed on `<html>`, and `panel.css` keys off
   those instead of its own independent `prefers-color-scheme` query.
3. **The "one canvas" seam, root-caused via live DOM audit, not guessed.** Confirmed live
   (both themes): each sidebar row (Dashboard/Announcements/Assignments/...) is wrapped in a
   `<div class="navItem ... bg-primary lg:bg-base ...">` one level inside the `<nav>` this
   reskin restyles — the SAME shade `.bg-base` gives the header, distinct from `<nav>`'s own
   `.bg-left-nav` shade — so every row painted as its own mismatched solid box. Separately,
   `<nav>` itself carries `.bg-left-nav`, which the old canvas rule flattened to solid opaque
   `--docket-canvas`, `!important`-clobbering `.docket-nav-enhanced`'s own translucent
   material (also non-`!important`, so it always lost). Fixed: `.bg-left-nav` no longer
   appears in global.css's canvas group (body still gets canvas via the bare `body` selector);
   `nav .navItem` is forced transparent; `.docket-nav-enhanced` gets its own
   `!important` translucent background. Result: header/top-tabs/sidebar/main all read as one
   canvas, with the sidebar as a genuine translucent material panel, not an accidental
   mismatch — verified with zoomed screenshots in both themes, no visible seam.
4. **Sidebar active-row pill was silently dead on every page, confirmed live and fixed.**
   Every page carries `<base href="/">`; `restyleNav()`'s active-item check resolved each
   link's `href` against `location.href` (not the page's actual base), which for these
   relative, no-leading-slash hrefs produced a doubled-up, nonsensical path that could never
   match `location.pathname` — so `.docket-nav-item-active` never applied, on any page, ever.
   Fixed by resolving against `document.baseURI` instead; confirmed live the correct item
   (e.g. "Assignments" on the Assignments page) now gets the blue pill.
5. **Badge urgency bands**: `dueBadge()` only had two bands (overdue/red, ≤1 day/orange,
   everything else gray) — a card due in 2 days and one due in 105 days looked identical.
   Now five bands (red / red-orange / orange / yellow / neutral gray), verified visually.
6. **Assignments cards now show each category's "% of grade"** (read off the same category
   header LearningSuite itself shows it on, `children[2]`'s "of Grade: NN%" text) in the card
   subtitle — confirmed live against a real weighted-category course.
7. **`reducedMotion` wired up**: a real "Reduce Motion" switch now exists in Settings: writes
   `data-docket-reduced-motion` onto `<html>` (main page) and onto each panel's shadow host,
   both consumed by CSS rules that zero out transition/animation duration. Verified live that
   toggling it actually changes a live element's computed `transitionDuration`.

All of the above were verified against a real, authenticated `learningsuite.byu.edu` account
(Chrome browser automation — Safari's Userscripts app itself still not exercised, see below)
across Dashboard, Course List, and Assignments, in both LearningSuite's native light and dark
modes (toggled via LearningSuite's own real Preferences control, not simulated), including the
native "back to card view" → real native detail panel fallback.

## Second live pass: from "islands" to a full-page skin (Sep 2026)

The first live pass (below) built isolated widgets (course grid, assignment cards) but left
LearningSuite's own header, sidebar, top tab bar, and typography completely untouched —
real user feedback against actual screenshots: "most of the website looks the exact same...
just a big black box in the middle." Two root causes, both fixed:

1. **Inserted content painted its own opaque background** (`--docket-bg`, solid black/white)
   next to LearningSuite's own differently-colored chrome, reading as a mismatched box
   rather than blended content. Fixed: `.docket-page` is now transparent; cards use a
   translucent overlay tint (`--docket-bg-elevated`) that reads as "slightly raised" against
   whatever is actually behind it, and a new `--docket-canvas` token is instead applied
   *globally* (`src/styles/global.css`) to LearningSuite's own real chrome containers
   (`body`, `header`, `.bg-left-nav`, `.bg-top-nav`, `.bg-header`) so the whole page shares
   one background rather than several native panels each keeping their own slightly
   different gray.
2. **Only two components were ever restyled** (the sidebar nav, and whatever a page adapter
   inserted) — everywhere else kept LearningSuite's native look entirely. Fixed with
   `src/styles/global.css`, a sitewide stylesheet that remaps LearningSuite's own real
   Tailwind-esque utility classes (confirmed live: `text-primary`, `text-primary-alt`,
   `text-action`, `text-highlight`, `text-info`, `.goBtn`, `.bg-action`, `.bg-accent`,
   `.bg-gray1`, `[class*="border-gray"]`) onto the Apple palette, plus a new
   `restyleTopTabs()` in `adapters/shell.ts` for the course-level tab strip
   (`.bg-top-nav` — Home/Content/Exams/Grades/Schedule/Syllabus), styled as an
   Apple-tab-bar underline instead of LearningSuite's solid highlight block. This means
   pages with no dedicated adapter (Dashboard, Grades, Announcements) now still look
   visually consistent with the ones that do, even though their layout/structure isn't
   restructured — closing most of the "looks like the original site" gap without needing a
   bespoke adapter for every single page.

Also fixed while investigating: confirmed live that LearningSuite has its own independent
dark-mode toggle (`html.dark`), unrelated to the OS `prefers-color-scheme` — a user could
have either in either state. `applyTheme()` now checks LearningSuite's own class first
(falling back to the OS preference only if that gives no signal), and re-checks it on every
adapter pass, not just at boot, in case the user flips LearningSuite's own toggle at runtime.

Deliberately NOT touched: bare `<button>` (breaks dropdown-trigger menus that reuse the tag
with no background styling) and bare `.bg-base` (reused for both header/panel chrome AND
highlighted table rows — see `assignmentsAdapter.ts`'s own selector — so a blanket override
would erase a real visual signal elsewhere). See `global.css`'s own file comment.

**Not yet re-verified after this pass**: the Combined Schedule (Today/Upcoming) adapter
against the new global stylesheet, and a full contrast/accessibility check of the remapped
utility-class colors across pages this session didn't visit (Grades, Announcements, Files,
Email, etc. all inherit the global pass but weren't individually screenshotted).

## First live pass: verified live (Sep 2026, real authenticated account, via Chrome browser
## automation —
## Safari's Userscripts app itself was not exercised, only the code that would run inside it)

Since Safari automation wasn't available in that pass, the built bundle was injected
directly into a live, authenticated `learningsuite.byu.edu` tab (Chrome). This is not a
substitute for a real Userscripts install — it validates the adapter/selector logic itself,
not the Safari extension install/update flow (still open, see below).

- **A real, load-bearing DOM-drift bug found and fixed**: the Course List page no longer
  renders course rows as `a[href*='cid-']` anchors — confirmed live, each row is now a Vue
  `<p class="cursor-pointer">` with a click handler and no static href anywhere in the row
  (the courseID only appears in the resulting URL, `cid-{id}/student/home`, after the
  handler runs). Both `looksLikeCourseListPage()` (the adapter's own match gate — this part
  silently made the adapter never even attempt to mount) and `courseListAdapter`'s
  extraction/card logic were fixed to detect and handle this shape, with the old
  anchor-based shape kept as the first-choice fallback. `courseCard` now supports both a
  real `href` and an `onActivate` click-through (re-firing the original row's own handler)
  — verified live end-to-end, including that clicking a card navigates to the correct real
  course. This means the main Docket project's `src/connectors/bookmarklet.ts`
  (`courseListExtractorSource()`), which assumes the same now-stale anchor shape, is very
  likely also broken against the current live site — flagged for that project separately,
  not fixed here since it's a different codebase/deliverable.
- **Assignments page selectors confirmed still accurate as-is**: `main .bg-base.text-highlight`
  (rows) and `main .lineHeight > div.cursor-pointer` (category headers) both matched real
  live rows/categories correctly, including due date parsing, category attribution, and
  completion status — no changes needed there.
- **The nav-restyle heuristic (`shell.ts`'s `restyleNav()`) works on the real DOM**:
  `document.querySelector('nav')` does find LearningSuite's actual primary sidebar
  (confirmed via live inspection), and the `docket-nav-*` classes/computed styles apply
  correctly — the "unconfirmed selector" gap below is resolved for the common case, though
  visual impact is subtle since LearningSuite's own dark background is already close to the
  reskin's sidebar-material color.
- **A second real bug found and fixed**: `resetDiagnostics()` (called on every
  mutation-triggered `runAdapters()` pass, not just page load) was unconditionally clearing
  `shellMounted` back to `false`, even though `mountShell()` only runs once at boot — the
  Diagnostics panel would misreport "Navigation shell: Not applied" after the very first DOM
  mutation on a page, despite the nav restyle still actually being in effect. Fixed by no
  longer resetting that one field on each pass.

## Done (this pass)

- Build pipeline (`build.mjs`, esbuild) producing one Safari-userscript file with a valid
  `// ==UserScript==` metadata block, `@match`-scoped to `learningsuite.byu.edu` only.
- Page detection (`src/core/pageDetector.ts`) — DOM-signature-first, matching the same
  validated approach `src/connectors/bookmarklet.ts` already uses, since only two URL shapes
  are actually confirmed live (course-scoped `cid-{id}` pages, and Combined Schedule's
  `/top/schedule`).
- Apple-HIG-styled design tokens (`src/styles/tokens.css`) — system colors, grouped-list
  cards, a restyled nav bar, dark mode via `prefers-color-scheme` + an explicit override.
- Adapters: Course List → card grid, Assignments → grouped card list (real due date/
  category/completion), Combined Schedule List view → Today/Upcoming agenda.
- Settings (appearance, Companion nav on/off, Compatibility Mode) persisted on-device
  (`GM_getValue`/`GM_setValue`, falling back to `localStorage`), plus an in-page Diagnostics
  view.
- jsdom-backed tests against sanitized fixtures for page detection and all three adapters.

## Not built yet, deliberately left untouched (spec: fail soft, never a fabricated page)

- **Grades** — no adapter registered; LearningSuite's own Grade Summary page renders as-is.
- **Announcements** — same; `src/connectors/learningSuiteSessionConnector.ts` in the main
  project is *also* still an unimplemented skeleton for this, so there's no validated
  selector set yet to build an adapter against.
- **A dedicated calendar view** — the Today/Upcoming agenda (from Combined Schedule's List
  view) covers the "what's due soon" need; a month-grid calendar view is a separate,
  larger adapter not attempted yet.

## Known gaps to close next

- **The Combined Schedule (Today/Upcoming) adapter has not been checked against the live
  site yet** — only Course List and Assignments were verified live this pass. Its selectors
  (`a.cursor-pointer.block.truncate`, `.listViewDay`) are unchanged from
  `scheduleExtractorSource()`'s own "confirmed live" claim, but that claim predates this
  session and hasn't been re-checked against the current DOM the way Course List's
  (wrongly) was assumed to still hold.
- **The actual Safari + Userscripts install/update flow is still unverified** — everything
  above was checked by injecting the built bundle directly into a live Chrome tab, not by
  installing it through the real Userscripts app. The `@updateURL` update-check UX and
  `GM_getValue`/`GM_setValue` sync-vs-async behavior (see `src/lib/storage.ts`'s defensive
  handling either way) both still need a real on-device pass.
- **Submission/quiz/grade flows themselves weren't exercised** — the live pass confirmed
  read-only rendering and real navigation (clicking a course card correctly lands on that
  course's real dashboard), not that a form submission or quiz-start flow is unaffected by
  the reskin being active on that page. Low risk given nothing is ever deleted or replaced,
  only hidden/wrapped, but not yet actually clicked through.

## Longer-term (from the original spec, not started)

- Grades/Announcements/Calendar adapters, once their selectors are captured live.
- Visual regression screenshots (desktop/iPhone/iPad × light/dark).
- A packaged Safari Web Extension as a possible future upgrade path — not required to meet
  the $0/no-resigning bar, since the userscript approach already does, but could reduce
  reliance on a third-party extension if ever justified by a real limitation encountered in
  practice.
