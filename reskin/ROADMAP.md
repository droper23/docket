# LearningSuite Reskin — Roadmap

## Thirteenth pass: four user-reported UX fixes — live-toggling schedule checkboxes, masthead wordmark, due/info distinction, banner-to-FAB (Sep 2026)

Direct response to four specific user complaints, each brainstormed via two independent spec
agents before implementation, then live-verified against the real authenticated account (Dark
mode, desktop viewport, Combined Schedule in Student View). Live verification used a different
method this session — `tools/cdp.mjs` needs a Chrome running with `--remote-debugging-port=9222`,
which wasn't available — so the built script was injected by serving `dist/` over a throwaway
localhost HTTP server, stashing it in `window.name` (which survives a cross-origin navigation)
via a hand-written scratch `dist/inject.html` page that navigates to learningsuite.byu.edu, then
eval'd in page context (a direct `fetch()` of `http://127.0.0.1` from the `https://` page hangs
on mixed content, confirmed live). The scratch page is gitignored, not a build output.

One live-DOM correction to both brainstorm specs before any code: they assumed only genuine due
items carry native checkboxes. Live inspection shows EVERY Combined Schedule row has one —
including plain informational lines — so checkbox interactivity is wired whenever a real checkbox
element is found, independent of `kind`; `kind` only controls badge suppression and muting.

1. **Checking an item off no longer kicks the whole page back to the native look.** Root-caused:
   the reskinned card had no path to the real native checkbox, so reaching completion state meant
   the row's own `onActivate` — whose first act is `toggle.reveal()`: revealing the native page
   WAS the toggle mechanism, which is exactly the reported symptom. `homeAdapter.ts` now finds
   each row's real native checkbox (a sibling of the title cell, scoped
   `parentElement.querySelector('input[type="checkbox"]')` — never a hardcoded child index, the
   row's column count isn't a stable contract) and hands the card an `onToggleComplete` that just
   calls `checkboxEl.click()`: confirmed live to toggle completion via an in-place Vue re-render,
   no navigation, no reload — and to work correctly even while an ancestor has `.hidden` set
   (exactly `overlayContent()`'s own hiding mechanism), so no reveal is ever needed. The card's
   checkbox (`assignmentCard.ts`) becomes a real control when `onToggleComplete` is given:
   `role="checkbox"`, `tabIndex=0`, `aria-checked`, a Space-key toggle, and `stopPropagation()`
   so the row's own `onActivate` never fires; without it (assignments/grades pages) the checkbox
   is exactly the old decorative `role="img"` mark. Two staleness fixes in `mount()`: a resync
   pass re-reads `checkboxEl.checked` every pass (`extractItems()` reads each anchor once,
   guarded by `isProcessed`, so `completed` would otherwise freeze at its first-seen value), and
   a prune pass deletes accumulated entries whose anchor is no longer `.isConnected`
   (LearningSuite removes a row from its own DOM once checked complete — its "Completed items"
   sidebar filter is off by default — which would otherwise leave a permanently stale entry).
   Live-verified end to end: clicking "Textbook 7.1: 15, 16, 24, 29, 44" (MATH 113)'s card
   checkbox toggled real completion, the row disappeared from the reskin's own list (native's
   own hide-completed default), and the page stayed reskinned.
2. **The masthead got a centered "BYU Learning Suite" wordmark and an initials avatar.**
   `shell.ts`'s new `restyleMasthead()` inserts a `.docket-wordmark` span into the real
   `#_topLink` (LearningSuite's own BYU-logo + "Learning Suite" lockup link) and a
   `.docket-user-avatar` initials chip into `.header-userdropdown-trigger`, computed by new
   exported `computeInitials()` from the trigger's own already-rendered name text — never
   fabricated. Both idempotent (guarded against a second insertion by a later debounced mutation
   pass); `unmountShell()` removes both. `navigation.css` hides the native logo `<img>`s and
   stacked text via CSS (`display: none`, never removed from the DOM) and centers the wordmark
   responsively (hidden <768px, inline 768–1023px, absolutely centered ≥1024px). Live-verified:
   wordmark renders centered with the logos hidden, "DR" chip renders.
3. **Combined Schedule now visually distinguishes real due items from informational lines.**
   New `ScheduleItem.kind` is read from real structural markup only — `i.fa-circle` (the native
   gold dot) → "due", `img.academic-y-logo` (the BYU "Y") → "calendar", neither → "info" —
   never from wording, same discipline as the "Opens" fix. "info"/"calendar" rows suppress the
   due-urgency badge entirely and render muted via a new `.docket-row-info` class (reusing the
   existing `--docket-label-secondary`/`-tertiary` tokens — no new tokens). Live-verified: due
   items badge ("Due tomorrow" etc.); plain lines ("Appendix D: Trigonometry") render muted
   with no badge.
4. **The full-width yellow "Student View / Back to Instructor View" banner became a small
   eye-icon FAB.** `mountStudentViewBadge()` finds `section.bg-attention`'s one real action (its
   `a > i.fa-undo` link), appends a new eye-icon button (new `icons.eye()`) to the existing
   settings-gear `fabBar` that re-fires the real anchor's own `.click()` — the same "re-fire the
   row's own click" idiom `createOverlayToggle()` already uses; the anchor is never moved (any
   parent-scoped listener survives) and its `href` never read (any attached handler survives).
   The banner itself gets `.docket-banner-relocated` (`display: none`); the function fails soft
   if the banner or its real link isn't found, and `global.css`'s `.bg-attention` treatment —
   now documented as the fallback path — stays in place for exactly that case, so an instructor
   is never left with a hidden banner and no way back. Live-verified: banner gone, eye FAB
   renders next to the settings-gear FAB. (The FAB's own click-through back to instructor view
   was not exercised this session — the session was left in Student View; the re-fire path is
   the same idiom the escape-hatch work already verified live.) A small "Back to Instructor
   View" text link was found to already exist separately in the `.bg-top-nav` strip — a distinct
   real anchor, pre-existing, left untouched as a second path to the same action.

**Verification:** `npm run typecheck && npm run build && npm test` all pass — 59/59 (11 new:
homeAdapter's checkbox wiring and icon-based kind classification; assignmentCard's interactive
click/Space toggle, no-onActivate guarantee, decorative fallback, badge suppression, and muted
info rows; `computeInitials`'s four edge cases). Bundle → 211.0 KB.

**Follow-up verification session (Sep 2026):** closed out every item this pass's own
"explicitly deferred" list had left open, live against the real account (Chrome DevTools MCP
automation this time, not `tools/cdp.mjs`/AppleScript — see note at the end of this entry).

- **Live account state confirmed clean** at session start: "Textbook 7.1: 15, 16, 24, 29, 44"
  had already been unchecked and the native "Completed items" filter turned back off (done in
  the gap between sessions) — nothing left to restore.
- **Keyboard Space toggle** live-confirmed both directions on a real Combined Schedule card: a
  synthetic Space keydown flips the card synchronously and the real native checkbox follows
  (`checked` true→false→true), with filter state restored after.
- **Decorative-checkbox regression** live-confirmed on both real pages the unit test covers:
  Grades and Assignments each render their 8 checkboxes `role="img"`, no `tabindex`,
  non-interactive — old (pre-interactive) behavior intact where no `onToggleComplete` is wired.
- **Masthead breakpoints** live-verified at true emulated viewport widths (a same-origin
  `<iframe>` sized to the target width and re-injected — real window resize tools/AppleScript
  bounds edits proved unreliable in this environment, see note below; the iframe gets its own
  independent viewport regardless). <768px: wordmark absent, no collision with hamburger/course
  dropdown/avatar. 768–1023px: wordmark renders inline, left-aligned, between the hamburger and
  course dropdown, full course name still unclipped. ≥1024px: wordmark absolutely centered
  (confirmed on the real un-emulated window). All three match `navigation.css`'s intent exactly.
- **Light theme — real bug found and fixed.** Switching Appearance to Light while the account's
  LearningSuite-side preference is Dark left large native surfaces (the narrow-viewport nav
  drawer, and every native dropdown/menu) rendering solid dark gray on an otherwise light page —
  legible per-element `getComputedStyle` checks all said "light," so this was invisible to
  anything short of an actual rendered screenshot. Root-caused to `global.css`'s own documented,
  deliberate choice to leave bare `.bg-base` un-themed (native's own `--ba` custom property,
  gated by a literal `dark` class LearningSuite itself puts on `<html>` — reused verbatim for
  menus/dropdowns since it "matches gray on both themes"). That assumption only holds when the
  reskin's own theme tracks LearningSuite's native one; an explicit Appearance override never
  touched LearningSuite's own class, so the two fell out of sync. Fixed in `index.ts`'s
  `applyTheme()`: an explicit Light/Dark override now also syncs LearningSuite's native `dark`
  class to match, closing the gap for every `.bg-base` consumer at once rather than patching
  each selector. A second bug surfaced live while verifying the first fix: switching back to
  "System" after an override read the (now self-modified) class back and got stuck on whatever
  the last override was, never returning to the account's real Dark preference — fixed by a new
  `nativeThemeClassOverridden` module flag that makes the "system" branch fall back to the
  value `earlyApplyTheme()` already captured (authoritatively, before any override could ever
  run) instead of re-trusting a live class read once anything has written to it. Live-verified
  the full cycle post-fix: System(dark, `--ba:#242424`) → Light(`--ba` unset, native class
  removed) → System (correctly back to dark, `--ba:#242424` restored) → Dark (unchanged,
  correctly stays dark) → System (still correctly dark) — every step confirmed via both the
  `data-docket-theme` attribute and a live `getComputedStyle` read of `--ba`, not just the
  setting's own stored value. Also spot-checked on Light: schedule cards/badges (due-soon
  yellow, due-in-2-days blue, neutral "Opens" chips), muted info rows, the masthead wordmark and
  initials avatar, the Student View eye FAB, and the interactive checkbox's keyboard focus ring
  (a real blue ring, reached via genuine Tab navigation, not `.focus()` — Chrome's
  `:focus-visible` heuristic didn't apply to the scripted call) — all legible.
- **Tooling note:** `mcp__claude-in-chrome__resize_window` reported success but never actually
  changed the live page's `innerWidth` in this environment. Root-caused mid-session: the target
  tab was open in a background browser tab (`document.visibilityState === "hidden"`, not the
  active tab in its window) — resizing and screenshotting both silently no-op/return stale
  compositor frames for a backgrounded tab. Activating the tab first (AppleScript `set active
  tab index of window ... to N`) fixed both; the same-origin-iframe viewport-emulation technique
  above was developed as a resize-independent fallback and is worth reaching for directly next
  time rather than re-diagnosing the resize gap.

## Twelfth pass: three independent design critiques, real correctness bugs, settings-panel
## token migration (Sep 2026)

Implements the correctness/settings-panel portion of `PASS12_PLAN.md` (that file's own synthesis
of three independent AI design critiques of the eleventh pass, each given the same live
screenshot set and told to rethink Apple/Google design language from the ground up). Every item
below was live-verified this pass against the real authenticated account (`tools/cdp.mjs`,
commit `ebdd323`'s profile) in both Dark and Light mode, not just confirmed against source — see
each item for what was actually observed. Sequenced correctness before visual polish, per the
plan's own ordering; Phase 5 (information architecture) was explicitly NOT attempted — see
"Explicitly deferred" below.

**Correctness & data-integrity (Phase 1 — all six items live-verified):**

1. **Course Dashboard no longer silently drops a day's second "Column 2" content.**
   `dashboardAdapter.ts`'s `extractDays()` read only `bar.nextElementSibling` per date bar.
   Live-verified (MATH 113, Tue Sep 8): a date bar is followed by exactly two real
   `div.pl-mobile` siblings every day ("Column 1"/"Column 2," even when Column 2 is empty) —
   Column 2 held a real BYU Devotional calendar entry that never rendered. Now walks every
   consecutive `.pl-mobile` sibling, not just the first, merging their items into one list.
2. **The "View original LearningSuite page" escape hatch actually works now.**
   `lib/dom.ts`'s `createOverlayToggle()` called `setOriginalHidden(next)` where `next` was the
   *new* revealed-state, but `setOriginalHidden(true)` HIDES native content — so the first click
   was a no-op (button label flipped, nothing became visible) and the second click stacked native
   content underneath the still-visible enhanced view. Fixed to `setOriginalHidden(!next)`.
   Live-verified end to end on Course List: first click now reveals native content below the
   enhanced view with the label correctly reading "← Back to redesigned view"; second click hides
   it again. New tests in `test/dom.test.ts` cover both the button and `.reveal()`.
3. **Combined Schedule no longer runs a multi-line real anchor into one unbroken title.**
   `reskinned-schedule.png` showed *"Chapter 2.1 04-Information Storage.pdf Download (Updated on
   09/01/2026) Zoom Recording (05/01/26)"* as one line. Live-inspected the real DOM: this is
   **one** anchor (not several, as `PASS12_PLAN.md` assumed from screenshot evidence alone) whose
   own `textContent` carries blank-line-separated logical lines that LearningSuite's native
   `truncate` CSS just clips to one line. `homeAdapter.ts`'s `extractItems()` now splits on that
   blank-line boundary, keeping only the first line as the title and surfacing the rest as a new
   `meta` field (`assignmentCard.ts`) rendered as a secondary subtitle segment instead of being
   run together or dropped.
4. **Grade Summary's "Total course progress" no longer reads as a failing red 0%.**
   Live-verified real MATH 113 data: "Current 100%" (correct, 5/5 graded) sat directly next to
   "Total 0.71%" in a red "failing" badge — Total counts every not-yet-due assignment as a zero by
   construction (per the page's own legend text), so it's guaranteed to look catastrophic for
   nearly the whole semester regardless of real standing. `gradeBadge()` takes a new
   `isTermProgress` flag; `gradeSummaryAdapter.ts` passes it for the Total column only, which now
   always renders neutral regardless of value. Current progress is unaffected.
5. **Course accent colors are perceptually distinct, not just distinct hex values.**
   Live-verified on the real 5-course account: index-1 red (`#b3261e`) and the old index-4 orange
   (`#c4370a`) rendered close enough on the course-card top-edge rule that both review agents had
   to sample pixels to be sure. `lib/courseColor.ts`'s `PALETTE` is reordered (same 12 hex values,
   not new ones) via a farthest-point-first walk over hue distance, so every common course-load
   size (a real account's first 4-8 slots) stays maximally spread; the two closest hues in the set
   now fall at positions 10-11, only relevant at 10+ concurrent courses. New test in
   `test/components.test.ts` asserts a real minimum hue-distance floor for every prefix length,
   not just hex distinctness.
6. **The masthead course/term switcher no longer truncates on every course-scoped page.**
   Live-measured: `"MATH 113 – Calculus 2"` needs ~165px and rendered in full natively, but
   truncated to `"MATH 113 – Calc…"` under the reskin with ~146px available — a **root-caused**
   regression, not the font-substitution guess `PASS12_PLAN.md` proposed (live-tested: swapping
   the page's font back to the native stack only changed the available width by ~4px). The actual
   cause: `navigation.css`'s hover-pill treatment on `.header-coursedropdown-trigger` used
   `padding: 4px 12px; margin: -4px -12px` — visually neutral for *position* but not for the
   button's own *content box*, which the flex-shrink course-name child absorbed entirely. Replaced
   with a `::before` pseudo-element (needs `z-index: 0` on the button itself to scope the pseudo's
   `z-index: -1` to a local stacking context — a first attempt without it rendered the hover pill
   behind the whole header bar). Live-verified: full course name now renders with room to spare,
   hover pill still visible.
7. **The Student View banner is a real, legible "attention" treatment, not muddy olive.**
   Live-inspected `section.bg-attention`'s actual computed style (two reviewers disagreed on its
   exact prior appearance — resolved by direct observation, not by guessing which was right): a
   prior fix already existed (`--docket-yellow-banner-bg`, a translucent tint) but rendered as a
   low-contrast olive-brown on the dark canvas. Reused the existing `--docket-status-soon`
   container/on-container pair instead (the same "attention" role every due-soon badge already
   uses) rather than inventing a bespoke color a second time; the bespoke token is removed.
   Live-verified legible in both themes.

**Cross-page consistency (Phase 2, partial):**

8. **The same real assignment's "Opens" date now reads identically on every page.**
   Live-confirmed: MATH 113's "Video Quiz 7.2" read "Opens Wednesday" on Combined Schedule
   (`homeAdapter.ts`, via the shared `dueDateLabel()`) and "Opens Sep 9" on Assignments
   (`assignmentsAdapter.ts`, the raw regex-captured text passed through unformatted).
   `assignmentsAdapter.ts` now parses that captured text into an ISO date
   (`parseAssignmentDueText()`, already handled a bare "Mon D" shape) and runs it through the same
   `dueDateLabel()` homeAdapter.ts uses. Live-verified: both pages now read "Opens Wednesday" for
   the identical real item.
9. **Cosmetic settings apply live; only structural ones reload.** `index.ts`'s `boot()` called
   `location.reload()` unconditionally for every settings change — live-confirmed this discarded
   scroll position and reset Combined Schedule's own accumulator/scroll-to-today flag even for a
   background-color preview. Now compares the new settings against the current ones: Appearance/
   Background/Reduce Motion apply live via the same `applyTheme()`/`applyBackground()`/attribute
   calls `runAdapters()` already uses every pass; only `useCompanionNav`/`compatibilityMode`
   changes (which genuinely need a clean adapter remount) still reload. Live-verified: changing
   the background swatch while scrolled 1500px into a 69-row Combined Schedule kept the scroll
   position and every rendered row; toggling Companion Navigation still reloads as before.

**Settings panel design-system migration (Phase 3):** `panel.css` was the one surface left behind
by four passes of token rewrites — hardcoded translucent glass (`rgba(242,242,247,0.82)` +
`backdrop-filter: blur(24px)`), iOS system blue (`#007aff`) for focus rings/selection instead of
the app's real accent, iOS system green (`#34c759`) for the toggle-on state, and a heavier shadow
than the rest of the app's one surviving shadow token. Live-verified before rewriting: CSS custom
properties DO inherit into this Shadow DOM root from the host element's own computed style with
**no JS threading required at all** (`getComputedStyle()` on an element inside the shadow root
already resolved `--docket-accent`/`--docket-surface-2` to the exact page-level values) — the
file's own prior comment ("a Shadow root's styles can't leak in") was only half true, exactly as
`PASS12_PLAN.md` predicted, and this pass confirmed it live rather than trusting the spec-level
reasoning alone. `panel.css` now consumes `var(--docket-token, fallback)` throughout: opaque
`--docket-surface-2` background (no more blur), `--docket-accent` for focus rings/selected-swatch
ring/switch-on state (reserving `--docket-green` for its existing completed-checkbox semantic
specifically), `--docket-status-soon-fg` for the diagnostics warning color, `--docket-shadow-float`
for the one surviving shadow. Live-verified in both themes: the panel now reads as the same opaque
design language as every other surface in the app.

**Type scale (Phase 4, partial):** `.docket-display` is now 700 weight (was 600) — live-compared
against fresh apple.com/design.google captures, both render their biggest headline visibly heavier
than a flat 600 cut at this size. Assignments and Grades (both genuinely course-scoped,
one-level-deep pages per `pageDetector.ts`'s own `cid-`-in-URL requirement) downgraded from
`.docket-display` to the already-defined-but-unused `.docket-title-1`, fixing a marketing-hero-
scaled headline sitting directly above a dense data grid. Course List/Combined Schedule/Grade
Summary keep `.docket-display`: confirmed against `pageDetector.ts` that all three are
cross-course, root-level pages in this app's own URL structure — despite `PASS12_PLAN.md`'s own
Phase 4.2 text also naming "Grade Summary" for the downgrade, which doesn't match this codebase's
real page hierarchy (flagged rather than silently followed).

**Small fixes:** `components/icons.ts`'s `navIconByLabel` mapped both "Syllabus" and "Library
Resources" to the identical `book` glyph (flagged, unfixed, since `PASS11_PLAN.md`'s own Phase 6)
— Syllabus now gets a distinct `clipboard` glyph, independent of the still-open icon-removal
question below.

**Explicitly deferred this pass** (not attempted, or not confirmed feasible — tracked here rather
than silently dropped):

- **Phase 2.1-2.3, 2.5** (Combined Schedule's lost native filter panel/view-switcher/"+Item"
  button; the per-row Statistics icon; Assignments' collapsible category accordion; the "actionable
  now" native green Begin-button signal) — all real, live-confirmed functional-parity gaps, but
  each is IA-shaped work (a new control surface or a category-disclosure rebuild), not a
  same-shape fix like the items above. Reachable via the now-actually-working escape hatch (#2)
  in the meantime.
- **Phase 4.1** (renaming/extending the token system from a 3-step to Material 3's full 5-step
  surface-container model) — a real rename-and-extend per the plan, but touches every surface
  selector in the app for a depth-relationship benefit (`.docket-group` vs. `.docket-course-card`
  currently sharing one token) that's real but lower-urgency than this pass's correctness bugs.
- **Phase 4.3** (widen course-card color from a 4px top-edge rule to a fuller header band) and
  **4.4** (a "Compact rows" density toggle) — both genuinely additive, low-DOM-risk, but net-new
  surface area (a new settings row + storage key for 4.4) sized for their own pass rather than a
  tail-end addition to this one.
- **Phase 4.5's icon-removal question** (keep vs. drop sidebar icons) — a genuine three-way
  disagreement among the three reviewers about which real Apple product is the correct reference
  class (Reminders/Mail's sidebar icons vs. neither marketing page pairing icons with nav labels).
  Left as an explicit open question for whoever picks this up next, not resolved by a drive-by
  change.
- **All of Phase 5** (the cross-course "hero fact" home surface; sidebar/top-tab redundancy
  spike; Combined Schedule's collapsed Overdue/Today/This Week/Later sections) — per the plan's
  own explicit staging, this is spike-first, highest-DOM-risk work sequenced last, and this pass's
  time went to the larger Phase 1-3 correctness/settings-panel set instead. `tools/cdp.mjs` also
  still has no viewport-resize command, a real prerequisite the plan flagged before attempting
  5.3's narrow-viewport nav spike.
- A CDP viewport-resize command for `tools/cdp.mjs` (flagged again — see Phase 5 note above).

## Eleventh pass: real bugs fixed, a genuine post-gradient visual identity (Sep 2026)

Implements `PASS11_PLAN.md` (that file's own synthesis of three independent design critiques of
the tenth pass) — real functional/data bugs the tenth pass's shipped build didn't intend, plus a
from-the-ground-up visual rewrite replacing that pass's gradient/glow signature with opaque
tonal surfaces and a flat accent, grounded in real apple.com/about.google/Material 3 source
values. Sequenced correctness before cosmetics, per the plan's own ordering.

**Correctness & data-integrity (Phase 1):**

1. **The Grades page now shows scores.** `assignmentsAdapter.ts`'s `extractRows()` already
   parsed a score fraction out of each row's text but only used it to compute a `completed`
   boolean, discarding the fraction itself. `RowData`/`AssignmentCardData` now carry
   `scoreEarned`/`scorePossible` verbatim; `assignmentCard()` renders a trailing, tabular-nums
   readout (`"18/20.0"`, or `"—/20.0"` for real ungraded work — an em dash, never a fabricated
   0). Live-verified on a real 171-row gradebook: `"10.0/10.0"` for graded rows, `"—/10.0"` for
   ungraded ones.
2. **Grade Summary no longer flags "nothing graded yet" as a failing red 0%.** Live-verified the
   real DOM (`.clicky`'s own sibling `.text-sm.text-info` line reads e.g. "0/8 assignments
   scored") and threaded that verbatim detail through `CourseGrade`. `gradeBadge()` now takes a
   `hasBeenScored` flag derived from that real count (never a re-derived percentage) and renders
   a neutral "Not yet graded" chip instead of banding straight to red — a genuinely low but
   *scored* grade (confirmed live: MATH 113 at 0.58% off 5/171 scored assignments) still bands
   red correctly, so the two states don't collapse together. The real "N/M assignments scored"
   line and the page's own explanatory legend paragraph (previously dropped entirely) now render
   too, plus this adapter finally has a `.docket-toggle-original` escape hatch (see #4).
3. **"Opens" dates never render as red "Overdue" badges; a completed item never also shows one.**
   Two distinct real shapes, both confirmed live: on a course's own Assignments/Grades table, an
   unavailable assignment's status column reads "Opens Sep 9" — a real availability date,
   separate from the row's own due date; on Combined Schedule, an item listed under its own
   opening day has that literal word appended to its real title text ("HW 1 - Information
   Storage Opens"), and that day can be well in the past (daysUntilDue negative) without the
   item being overdue at all. `dueBadge()` now takes an optional `opensText` and, when given,
   always renders a neutral "Opens …" chip regardless of the sign of `daysUntilDue`.
   `assignmentCard()` also now suppresses the urgency badge entirely when `completed === true`
   (confirmed live: a graded-and-completed quiz past its due date showed a green check *and* a
   red "Overdue by 4 days" on the same row).
4. **Every adapter now has a real, two-way escape hatch back to the native page.**
   `courseListAdapter.ts`/`gradeSummaryAdapter.ts` had none at all — `overlayContent()` hides
   every child of the container it's given, so Course List's native term tabs, "Refresh," and
   "Combined Schedule" shortcut were unreachable short of a full Compatibility Mode reload. New
   `lib/dom.ts` `createOverlayToggle()` is a single stateful toggle (every adapter's own button
   previously only ever called `setOriginalHidden(true)`, with no way to call it with `false`
   again) shared by all six adapters, relabeling itself between "View original LearningSuite
   page" and "← Back to redesigned view," and repositioned to the end of each view instead of
   the first tab stop after the page title.
5. **Course List and Grade Summary agree on section numbers.** `courseListAdapter.ts`'s
   `splitCodeTitle()` stripped `(003)`-style section numbers; Grade Summary never did — a
   student in two sections of one course saw identical cards on one page, distinct labels on the
   other. Stripping removed.
6. **Every real anchor in a Dashboard day's paragraph survives, not just the first.**
   `dashboardAdapter.ts`'s `extractDays()` used `querySelector` (singular) to find a paragraph's
   real link, flattening every other real anchor (e.g. a file download *and* a Zoom recording
   link in the same entry) into inert text. Now `querySelectorAll`: every real anchor renders as
   its own independently-clickable row, with any leftover non-anchor text (e.g. an "(Updated on
   …)" date) rendered as its own separate plain-text row rather than concatenated onto a link's
   label.
7. **Course accent colors never collide, and now agree across every page.** New
   `lib/courseColor.ts` (`assignCourseColors()`) assigns by sorted index into a fixed
   12-color palette instead of `courseCard.ts`'s old `hash % 7`, so real course loads never
   collide up to 12 courses and the same course gets the same color on Course List, Grade
   Summary, and anywhere else that calls it — previously Grade Summary never called the old
   function at all, so its cards had no course color at all. Old `accentForCourse()` deleted.
8. **Combined Schedule no longer opens 120 days into the past.** One-time
   `scrollIntoView({ block: "start" })` on the first day group whose date is `>=` today, guarded
   by a module-level flag so a later mutation-triggered re-render (which only ever *adds* rows,
   never replaces them) can't re-trigger it and yank the student back after they've scrolled
   elsewhere. Live-verified: the page still renders oldest-first in document order (no IA
   restructuring this pass), but loads scrolled to "Tuesday, September 8" (the nearest real item
   `>=` today), not "Wednesday, September 2."
9. **Removed the dead `showUpcomingOnHome` setting** — grep confirmed zero consumers; the
   stretch goal it was meant to gate (hero-fact course cards) wasn't attempted this pass, so the
   control was removed rather than left doing nothing.

**Accessibility floor (Phase 2):** every adapter's page title is now a real `<h1>`, day/section
headers and course-card titles real `<h2>`s (previously every one was a styled `<div>`, and the
overlay hides LearningSuite's own real headings along with everything else it hides). Every
grouped list/grid gets `role="list"`, each row/card wrapped `role="listitem"` (new `lib/dom.ts`
`listItem()`). `assignmentCard()`/`courseCard.ts`'s hrefless fallback both changed `role="button"`
→ `role="link"` with the Space-key branch removed from their keydown handlers, matching real
link semantics. A skip link (`adapters/shell.ts`, targeting the real `<main>`) and the settings
FAB (`position: fixed`, so this doesn't move it visually) both now insert at the front of
`<body>` instead of the end — on a ~300-row Combined Schedule the FAB used to be close to the
very last tab stop on the page. `.docket-checkbox` only renders when the source data has a real
completion concept (`completed !== undefined`) rather than an unlabeled "not done" circle on
every Dashboard holiday/lesson-note row; when it does render it carries `role="img"` and a
computed `aria-label`. `.docket-row-title`/`-subtitle` moved from `nowrap` + ellipsis (cut real
content mid-word) to a 2-line `-webkit-line-clamp`.

**Paint-integrity (Phase 3):** the plan's Phase 3.1 ("the one canvas is not actually one
canvas" — three different fill colors on one screen in the pass-10 screenshots) was
live-re-verified against the real account before touching any CSS, per this project's own
selector-discipline rule, and turned out **not to reproduce** — `getComputedStyle` walked from
`body` down through `<nav>` and the main content column came back uniformly `--docket-canvas` in
both themes on Home, Combined Schedule, and a Grades page. Most likely already fixed by the tenth
pass's own `--docket-sidebar-bg` → `--docket-canvas` alias (see that pass's entry below) landing
after the screenshots the critique reports were sampling. No fix needed; documented here instead
of silently dropped. Phase 3.2 (a real dark-mode flash-of-light-theme on every full-page
navigation — `earlyInject()`'s `document-start` half never set `data-docket-theme`, only
`applyTheme()` at `DOMContentLoaded` did) is fixed: `index.ts`'s new `earlyApplyTheme()` sets the
real theme attribute as soon as `html.h-full` lands (normally the same tick), with a bounded
~400ms poll and a last-known-theme fallback. A new ready-gate
(`html[data-docket-reskin]:not([data-docket-ready]) main { visibility: hidden }`, lifted by
`runAdapters()` once it's decided what to show, with its own ~400ms failsafe so a page with no
matching adapter is never left permanently hidden) closes the matching "native content visible
for one frame before hide" gap.

**Design-system rewrite (Phase 4) and component rewrites (Phase 5):** the tenth pass's own
signature — a blue→purple→pink gradient on every interactive fill, a blurred "hero glow" behind
page titles, translucent shadow-heavy cards — is gone. Both apple.com and about.google's real,
fetched production CSS use neither a gradient nor (for about.google) any shadow at all sitewide.
Replaced with:
- **Opaque tonal surfaces.** `--docket-bg-elevated` (previously a translucent `rgba(...)`
  overlay measuring ~1.1–1.3:1 contrast against real backgrounds — barely visible in light mode,
  mud in dark) is now an alias for new, fully opaque `--docket-surface-1/2/3` steps. Every
  `box-shadow`-for-depth usage across `cards.css`/`layout.css`/`global.css`/`navigation.css`/
  `schedule.css` replaced with the surface-step difference plus a 1px `--docket-separator`
  border; one shadow token (`--docket-shadow-float`) survives for chrome that genuinely floats
  over arbitrary page content (dropdown menus, the settings FAB, the Preferences sheet).
- **One flat accent, never a gradient**, split into `--docket-accent`/`--docket-on-accent` (real
  actions/links/focus rings) and `--docket-accent-container`/`--docket-on-accent-container`
  (the active nav pill, quieter emphasis). `--docket-blue` stays defined as an alias to
  `--docket-accent` so the ~25 already-correct, live-confirmed sitewide selectors that reference
  it keep working with zero behavior change. Caught and fixed two real contrast bugs this
  surfaced: `::selection` and the native "today" calendar marker both hardcoded `color: #fff` on
  what is now, in dark mode, a *light* accent fill — both switched to `var(--docket-on-accent)`,
  which is correctly dark in that theme.
- **Status roles, not raw hues.** New `--docket-status-{overdue,soon,upcoming,done,neutral}-{bg,fg}`
  container/on-container pairs replace the old same-hue-tint badge construction, which
  independently-computed contrast checks (and this pass's own live spot-check via
  `tools/cdp.mjs`, relative-luminance formula against the actual rendered token values) found
  failing WCAG AA in at least one theme for every prior badge color. One pair
  (`status-soon-fg` in light mode) needed darkening from its initial Material-3-sourced value
  (~4.34:1) to `#9c5500` (~5.3:1) after that live check. `gradeBadge()`/`dueBadge()` now select a
  role rather than a raw color.
- **Typography capped at 600 weight**, replacing 800-weight/-0.03em headlines neither real
  reference uses: new `.docket-display/-title-1/-title-2/-lead/-body/-body-sm/-label/-eyebrow`
  scale (`typography.css`) with a 13px real-content floor (the old 11px `.docket-caption`/12px
  `.docket-footnote` tier measured ~1.7–3.3:1 contrast). Every component/adapter's old class
  names migrated (`.docket-large-title`→`.docket-display`, `.docket-headline`→`.docket-title-2`,
  `.docket-footnote`→`.docket-body-sm`/`.docket-eyebrow` by context). Sitewide native
  `h1`/`h2`/`h3` (pages with no dedicated adapter) matched to the same scale.
- **Simplified radius scale** (`xs`6/`sm`10/`md`14/`lg`20/`pill` — 14px is the new default for
  any card/grouped surface, not the old 20/28px "editorial tile" scale) and **role-specific
  motion** (`--docket-ease-standard/-enter/-exit` at `--docket-dur-fast/-medium/-slow`,
  replacing one `cubic-bezier(0.16,1,0.3,1)` used 13+ times sitewide) — both reduced-motion gates
  already in `tokens.css` are unaffected.
- **Course cards** wash a flat, opaque `--docket-surface-1` fill with the course's own
  de-collided color as a 4px top-edge rule (`layout.css`'s `.docket-course-card::before`) instead
  of the old translucent gradient wash; hover is a state-layer opacity overlay plus an asymmetric
  corner-radius morph (about.google's own real hover signature on its image tiles), replacing
  `translateY(-4px)` (which moved the click target out from under the cursor). The leading
  `.docket-dot` was dropped — the course's color now appears once, at full strength, on the
  top-edge rule rather than twice.
- **Navigation** is now an opaque `--docket-surface-1` "island" with a 1px separator border
  instead of a translucent, blurred material relying on a shadow for edge definition;
  `backdrop-filter` kept only on chrome that genuinely floats (dropdown menus, the FAB). Active
  nav pill and top-tab underline both flat now, no gradient.
- **Page headers** (Course List, Grade Summary) gained a real, truthful `.docket-lead` line
  ("5 courses") under the display title — only where a real, already-computed count exists;
  every other page kept a bare title rather than shipping filler copy to fill the pattern.

**Verification:** `npm run typecheck && npm run build && npm test` all pass (42/42 — 7 new,
covering score plumbing, the neutral "not yet graded" state, "opens" never overdue, a completed
item's suppressed badge, the checkbox-only-with-a-real-concept rule, the multi-anchor Dashboard
fix, and `courseColor.ts`'s de-collision guarantee). Live-verified via `tools/cdp.mjs` against the
real authenticated account (Dark Mode — the account's actual current setting; Light Mode was
*not* re-verified live this pass, see below) across Grade Summary (real "Not yet graded" chips
confirmed, real 0.58%/100% still band correctly, escape hatch present), a real course's
Grades/Assignments page (real scores rendering, "Opens Sep 9"/"Opens Sep 11" neutral chips, a
completed-and-overdue row's badge correctly suppressed), Combined Schedule (an "Opens" item
listed 4 days in the past reads "Opens last Wednesday" not "Overdue," page loads scrolled to
the nearest real day `>=` today), and Course List (5 real courses, 5 distinct accent colors, real
section numbers, working escape hatch). Contrast for every new token pair was computed
programmatically against the actual declared hex values (not just reasoned about) via
`tools/cdp.mjs eval`, relative-luminance formula — all ≥4.5:1 after the one fix above.

**Explicitly deferred** (Phase 6 of `PASS11_PLAN.md` — none attempted this pass): hero-fact
course cards (cross-adapter data caching), rebuilding Course List's hidden native controls as
real re-fired elements instead of relying solely on the escape hatch, restructuring Combined
Schedule's IA into collapsed Overdue/Today/Upcoming sections, sidebar icon simplification (and
the `Syllabus`/`Library Resources` icon-collision fix that goes with it if icons are kept), and
the Google Sans Flex font swap. Also not done: a live re-verification of Light Mode specifically
(the account's own real Preferences toggle was opened but not switched this pass — the
programmatic contrast check above covers the same token *values*, just not a rendered
screenshot); flag this if picking the project up next.

## Tenth pass: a real visual identity, not just Apple-HIG polish (Sep 2026)

Direct response to "make the reskinned site look nothing remotely similar [to the original],
instead taking inspiration from the Apple pages and About Google." The prior nine passes'
Apple-HIG work (dark canvas, SF-style type, translucent materials) had converged on something
that reads as a competent, generic dark SaaS dashboard — real progress over native
LearningSuite, but with no signature of its own, and structurally still "sidebar + top bar +
flat card grid" regardless of color. This pass is CSS-only (plus one small, purely additive
inline-style change in `courseCard.ts` — see below), deliberately: every adapter/detector/
event-handling code path is untouched, so there is no new functional-risk surface, only a
visual one, verified live against the real authenticated account (`tools/cdp.mjs`, same
methodology as every prior pass) in both the account's real Dark Mode and (toggled live via
its own real Preferences control, then restored) Light Mode.

1. **A signature accent — one gradient sweep, used everywhere a flat brand-blue used to be.**
   New `--docket-accent-gradient` (`tokens.css`, blue → purple → pink, light/dark variants)
   replaces the flat `--docket-blue` fill on the active sidebar pill, the active top-tab
   underline (via `border-image`, since `border-color` can't take a gradient), and every
   primary button (`.goBtn`/`.bg-action`/`button.bg-primary-dark`). A flat single-color pill
   is indistinguishable from any other app's default `background: blue`; a deliberate
   multi-hue sweep is the kind of specific, ownable choice both apple.com's keynote/product
   pages and about.google's own four-color identity actually make. Verified live in both
   themes (screenshots below) — no selector changes, same elements, just a different `fill`.
2. **Page titles became headlines, not app-chrome labels.** `.docket-large-title` went from
   34px/700-weight to a `clamp(32px, 5.2vw, 48px)`/800-weight/-0.03em ladder (`typography.css`)
   — apple.com and about.google both treat a page's own title as the biggest, boldest thing
   on it; Apple HIG's own 34px Large Title is sized for app chrome next to a nav bar, not for
   a page that has no competing chrome above it. Native `<h1>/<h2>/<h3>` (pages with no
   dedicated adapter — Announcements, Class Info, etc.) got the matching bump in `global.css`
   (700→800 weight, larger sizes) so they don't read as a visibly older design generation next
   to the adapter-rendered pages. `responsive.css`'s old fixed 28px mobile override is now
   redundant (the `clamp()` already scales down) and was removed.
3. **A hero glow behind every page title.** New `.docket-header::before` (`layout.css`): a
   soft, blurred radial gradient positioned behind `.docket-large-title`, `isolation: isolate`
   on the header so its negative z-index can never render behind unrelated DOM (confirmed:
   this only ever touches `.docket-header`'s own stacking context). The specific device
   apple.com's own product pages use above a headline, scoped only to the pages this reskin
   fully renders (Home, Course List, Assignments, Grades, Grade Summary) — pages still
   rendered by native markup alone (no wrapping container to hang it from) don't get one, and
   weren't forced into one.
4. **Course cards wash their own course color instead of sitting on flat gray.** Confirmed
   live each course already gets a deterministic accent color (`accentForCourse()` in
   `courseCard.ts`, previously only visible as a small leading dot). `courseCard()` now also
   sets `--docket-card-accent` as an inline custom property on the card element itself (a
   plain style-attribute addition — no new attribute, no behavior change, `href`/`onActivate`
   navigation untouched) so `layout.css` can wash a soft gradient of that same color through
   the card background (`color-mix`, with a flat-color fallback for engines without it),
   radius bumped to a new `--docket-radius-xl` (28px), and a hover lift
   (`translateY(-4px)` + expanded shadow) replacing the old flat background-color swap. Cards
   that carry no course-color data (Grade Summary's own cards) fall back to the plain accent
   blue wash — no data was invented to force every card into the new treatment.
5. **The sidebar became a floating rounded "island," not a flush native rail.** Confirmed live
   (re-checked this pass, matches the third pass's own finding) that `<nav>`'s column width is
   set by its parent `.bg-left-nav` wrapper, not by `<nav>` itself — so giving the real `<nav>`
   element a `margin` (`navigation.css`) insets it within that same reserved column with zero
   risk of resizing or reflowing the main content area. Bigger radius (`--docket-radius-lg`),
   padding, and per-item radius (999px pill instead of 8px rectangle) match the same
   editorial-not-utility scale as everything else this pass. Deliberately did NOT touch
   `flex-direction` (a documented constraint from an earlier pass — the nav's own native class
   controls row-vs-column behavior across viewport widths; overriding it here isn't this
   pass's to make).
6. **The masthead — the one piece of chrome on every single page — got its first color
   signature.** Confirmed live `header` computes `position: static`, so a `::after` gradient
   hairline along its bottom edge (`global.css`, same accent sweep as everywhere else) cannot
   disturb any sticky/fixed behavior. Previously a stark flat bar with zero color of its own on
   every page in the app.
7. **Radius/weight consistency pass on the surfaces this didn't touch directly**: the Grade
   Summary grid and native `<table>` (Grade Scale, etc.) moved from `--docket-radius-md` to
   `--docket-radius-lg`; the Preferences dialog sheet from `--docket-radius-lg` to
   `--docket-radius-xl`; `.docket-group`/`.docket-row` padding and radius increased to match;
   `.docket-badge` made bolder (700 weight) — all so the bigger, rounder, bolder language
   introduced above reads as one coherent system rather than one redesigned surface next to
   several unchanged smaller-radius ones.

Explicitly scoped away from a full DOM/adapter rewrite: the underlying shape (sidebar + top
bar + content column) is inherent to skinning LearningSuite's own real markup in place, and a
CSS-only pass cannot turn a vertical app nav into apple.com's own horizontal marketing nav
without either fabricating a replacement (this project's own spec explicitly forbids that) or
restructuring real, working navigation DOM (adapter-shaped risk this pass deliberately did not
take on, per the brief's own "don't break any Learning Suite functionality" constraint). What
changed here is everything CSS *can* own: color identity, type scale, corner language, and
elevation — confirmed live this is now visually distinct from both native LearningSuite (no
shared color, radius, or type scale left) and from the prior passes' own "generic dark SaaS"
ceiling.

`npm run build && npm run typecheck && npm test` all pass (34/34, unchanged — no
adapter/detector logic touched, so no test surface changed). Bundle 184.6 → 191.6 KB (CSS
only). Live-verified via `tools/cdp.mjs` against the real account, both the account's actual
Dark Mode and a live toggle to Light Mode through its own real Preferences control (then
restored back to Dark, the account's original setting, via the same real control — confirmed
via a fresh page load after save, not just an in-memory check): Home/Course List (course
grid), Grade Summary, Combined Schedule (Today & Upcoming), a real course's Grades page, and a
real course's Dashboard — all in `tools/shots/pass10-*.png` (gitignored, per prior passes'
convention). Settings panel (Shadow DOM, unaffected by any of this pass's page-level CSS)
spot-checked to confirm it still opens and reads correctly.

**Explicitly deferred, not attempted this pass:** a real mobile/narrow-viewport screenshot
pass (the sidebar-margin and `clamp()` title changes were reasoned through against documented
constraints from prior passes rather than screenshotted at a narrow width this session —
tooling gap, `tools/cdp.mjs` has no viewport-resize command; worth adding before the next pass
touches responsive.css again); Announcements/Class Info/Groups/Email/Exams/Prioritizer/
Copyright Resources were not individually re-screenshotted this pass (they inherit the h1/h2/
h3, button, table, and masthead changes for free, same as every prior sitewide-selector pass,
but weren't visually re-confirmed page-by-page); a second, more ambitious pass at the sidebar
shape itself (e.g., a real horizontal top-nav conversion) if a future pass decides the
DOM-restructuring risk is worth taking.

## Ninth pass: fixing real bugs, closing the "still looks native" gap structurally, three new full adapters (Sep 2026)

Direct response to a user report describing three things at once: "on the Combined Schedule
page you can't scroll up to see past assignments, and scrolling down shows what looks like
the original page just moved lower — all the original stuff is still there"; "many pages have
random big white boxes"; "the main screen, sidebar, and top bar backgrounds should all be the
same." The user explicitly asked for the most ambitious of three response options: fix the
confirmed bugs, add a systemic fix for the white-box problem instead of patching one more
instance of it, **and** start converting the highest-traffic still-100%-native pages into real
custom-rendered adapters (this project's biggest lever for genuinely looking different, not
just recolored) — all verified live via the existing `tools/cdp.mjs` harness against the
session already saved in `tools/.chrome-audit-profile` (still authenticated; no fresh BYU
login needed this pass), a real 5-course Fall 2026 account.

1. **Root-caused and fixed the Combined Schedule bug — a real overlay leak, not "ugly."**
   `lib/dom.ts`'s `overlayContent()` snapshotted-and-hid `container.childNodes` exactly ONCE,
   at mount time. Confirmed live: LearningSuite keeps appending real DOM nodes to that same
   container well after the reskin's first mount pass (the Combined Schedule page renders its
   300+-item semester progressively), and every later-appended native node was never hidden —
   it rendered fully visible, natively styled, below the enhanced view. Exactly the reported
   symptom. Fixed inside `overlayContent()` itself (not per-adapter): a `MutationObserver`
   scoped to the container's own `childList` now folds any newly-appeared sibling into
   `originalNodes` and hides it immediately — benefits all three existing adapters
   (home/assignments/courseList) that call this same function, with no adapter having to
   remember anything. New regression tests in `test/dom.test.ts` (append-after-mount gets
   hidden; `remove()` un-hides everything it ever hid, including late-appended nodes).
2. **The "can't scroll up" complaint was a real, deliberate data window, not a scroll trap.**
   `homeAdapter.ts`'s `WINDOW_DAYS_PAST` was `1` (by design, to avoid a full-semester dump).
   Now that #1 removed the reason to keep history hidden, widened to `120` — comfortably a
   full semester back. The existing accumulator already renders the full merged set every
   pass; ROADMAP's own prior measurement (~6.4k DOM nodes for the full semester) already
   called that acceptable.
3. **Sidebar/top-bar/main cohesion, confirmed in code before touching it.** `body`/`header`/
   `.bg-top-nav` all painted the flat `--docket-canvas` token, but the actual `<nav>` element
   deliberately used a *different*, translucent `--docket-sidebar-bg` ("macOS sidebar
   material") — a prior pass's deliberate design choice, and exactly what this user asked to
   remove. `--docket-sidebar-bg` now just aliases `--docket-canvas` (both themes, and every
   `data-docket-background` swatch override, since CSS custom properties resolve per-element,
   not at definition time) — `.docket-nav-enhanced`/`.docket-fab` both reference the token, so
   both picked up the fix with no selector changes. Verified live: no visible seam between
   sidebar, top bar, and main content in either theme.
4. **A confirmed, live-caught instance of the "white box" bug that an earlier pass's fix
   didn't actually fix.** The compact "instructor lesson-topic chip" rule
   (`.text-sm .instructorText.font-nunito` in `global.css`, added specifically to avoid this)
   used `display: inline-block` with no `max-width` — confirmed live on the course Dashboard
   that an inline-block box's shrink-to-fit width still grows to fit a long sentence on one
   line before wrapping, so anything longer than a couple words rendered as a wide white slab
   nearly the width of its column. Added `max-width: 260px` to force real multi-line wrapping;
   confirmed live it now reads as a genuinely compact note instead of a slab. (The *other*
   place the same base rule fires — a full announcement body, in the Dashboard's Announcements
   sidebar widget and on the standalone Announcements page — was checked live and left alone:
   full-width "paper card" treatment for a whole letter-length message reads fine there,
   matching Apple Mail's own convention; it's the inline-block sizing on a short chip that was
   actually broken, not the paper-card idiom itself.)
5. **Broader live census of every still-unaudited page type** (Groups, Email, Exams, Class
   Info, Prioritizer, Copyright Resources, course-level Announcements) turned up no further
   white-box gaps this pass — all read as cohesive, no unstyled native surfaces found. (Not
   exhaustive: Learning Outcomes, Library Resources' own interior, and the top-level standalone
   Copyright Resources/Announcements-list pages were not individually screenshotted this pass.)
6. **Three new full adapters — the actual "genuinely different, not just recolored" lever.**
   Rather than one more round of CSS patches on native markup, the three highest-traffic pages
   that were still 100% native got real custom-rendered adapters, following the established
   `overlayContent` + `h()`-card + `pageDetector` matcher + `registry` pattern:
   - **`gradesAdapter`** — confirmed live the Grades page's default sub-view renders the
     *identical* `.bg-base.text-highlight` row grid as the real Assignments page (same
     BYU-shared table component), so it reuses `assignmentsAdapter.ts`'s own
     `extractRows`/`buildCard` directly (both now exported) rather than re-deriving the same
     parsing twice. `pageDetector.ts`'s new `looksLikeGradesPage()` is the positive
     counterpart of the exclusion `looksLikeAssignmentsPage()` already used
     (`.bg-top-nav-highlight === "Grades"`) — confirmed live real Assignments (reached via
     Home > Assignments, active tab "Home") and Grades never collide.
   - **`gradeSummaryAdapter`** — confirmed live the whole page is one CSS grid
     (`main .gridColsStyle`), each row a `.contents` div; a header row has no
     `a[href*='cid-']` and is skipped, every real course row does, with two `.clicky`
     percentages in confirmed column order (Current progress, Total course progress). Renders
     as a real card grid (real hrefs, copied verbatim) with color-coded percentage badges —
     closes an item an earlier pass explicitly deferred ("color-coding by value... requires
     reading and classifying the number in JS, adapter-shaped risk"), now safe because the
     adapter already parses the real percentage text as part of its own extraction. New
     `gradeBadge()` component, reusing the `.docket-badge-{red,yellow,blue,green}` classes
     already defined (unused) in `cards.css`.
   - **`dashboardAdapter`** — confirmed live (full-page screenshot, not just the already-known
     per-day-schedule selectors) the course Dashboard has TWO sibling regions under one shared
     wrapper: the per-day schedule and an "Announcements" sidebar widget. First draft
     overlaid the whole page and accidentally hid the Announcements widget too — caught live,
     fixed by scoping the overlay to `[class~="md:mr-6"]` specifically (an attribute selector,
     sidestepping the need to escape the literal `:`/`/` in LearningSuite's own Tailwind-style
     class name), confirmed live the sidebar widget stays visible and untouched. Each day
     (`.bg-gray1.text-primary-alt.px-4.py-2` + adjacent `.pl-mobile`, both already confirmed
     by an earlier pass) contains three real entry shapes — a real assignment link
     (`a.cursor-pointer`, no static href, re-fired on click same as every other hrefless-row
     adapter), a BYU-calendar event/holiday marker, or an instructor lesson-topic note (a
     genuinely nested `<p>` inside a `<p>`, only possible because Vue builds it via imperative
     DOM calls rather than HTML parsing) — all three now render as plain-text rows, only the
     first kind tappable. Also dropped this view's own would-be "Dashboard" title: confirmed
     live the page's real, already-visible `<h1>Dashboard</h1>` sits one level above the
     overlaid column, so a second one was a plain duplicate.
   `registry.ts` now lists `gradesAdapter`/`gradeSummaryAdapter`/`dashboardAdapter` ahead of
   the generic pages they'd otherwise collide with, mirroring the disambiguation comments
   already in `pageDetector.ts`.

`npm run build && npm run typecheck && npm test` all pass (34/34 — 12 new: two `dom.test.ts`
overlay-leak regressions, one test each for the three new adapters, and seven new
`pageDetector` matcher cases). Live-verified end-to-end via `tools/cdp.mjs` against the real
account: Combined Schedule (no more duplicate content, full semester scrollable, screenshots
`live-09-schedule-mounted.png`/`live-09-schedule-scrolled-bottom2.png`), course Dashboard
(`live-09-dashboard-fixed2.png`, plus a live click-through into a real native quiz-detail
modal), Grade Summary (`live-09-gradesummary-newadapter.png`, plus a real-href check), and
Grades (`live-09-grades-newadapter.png`, plus confirming the real Assignments page still
mounts its own unchanged adapter). All screenshots gitignored per `tools/shots/`'s existing
entry, per prior passes' own convention.

**Explicitly deferred, not attempted this pass:** the still-unconfirmed "Course Progress" stat
panel on the Grades page (searched for live this pass, not found above the row list — flagged
across multiple prior passes as "still no non-generic hook"; `gradesAdapter` fails soft and
leaves it native, same as every other not-confidently-extractable element on this project);
Announcements/Groups/Email/Exams/Class Info/Prioritizer/Copyright Resources converted to full
adapters (all currently read fine via the sitewide CSS pass — census in item 5 above found no
active defect, so no adapter conversion was justified this pass); the native quiz/assignment
detail modal opened by a real click-through (confirmed working, native chrome, unstyled — out
of scope for this pass, pre-existing on every page that opens it, not new).

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
